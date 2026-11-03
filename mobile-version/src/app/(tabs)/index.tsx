import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { improvementAPI } from '../../api/improvement';
import { postsAPI, type DatingPost } from '../../api/posts';
import { profileAPI } from '../../api/profile';
import { relationshipAPI } from '../../api/relationship';
import { formatAxiosError } from '../../lib/apiError';
import { getAuthToken } from '../../session/authStorage';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../ui/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [blowingUp, setBlowingUp] = useState(0);
  const [matchScore, setMatchScore] = useState(0);
  const [inRelationship, setInRelationship] = useState(false);
  const [highlights, setHighlights] = useState(0);

  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !user?.id) {
      setPosts([]);
      setError('Sign in with Google to load your dashboard.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError('');
    try {
      const [feedRes, blowing, relationship, improvement, profile] = await Promise.all([
        postsAPI.getFeed('for_you').catch(async (err) => {
          const plain = await postsAPI.getPosts().catch(() => ({ posts: [] as DatingPost[] }));
          if (plain.posts?.length) return { posts: plain.posts };
          throw err;
        }),
        postsAPI.getBlowingUpCount().catch(() => ({ count: 0 })),
        relationshipAPI.getMyRelationship().catch(() => ({ relationship: null })),
        improvementAPI.getUserImprovement(user.id).catch(() => ({
          improvementPercentage: 0,
          completedCourses: 0,
          courses: [],
        })),
        profileAPI.getCurrentUser().catch(() => null),
      ]);
      setPosts(Array.isArray(feedRes.posts) ? feedRes.posts : []);
      setBlowingUp(blowing.count || 0);
      setInRelationship(relationship.relationship?.status === 'active');
      setMatchScore(improvement.improvementPercentage || 0);
      setHighlights(profile?.highlights?.length || 0);
    } catch (err) {
      setPosts([]);
      setError(formatAxiosError(err, 'Could not load the feed. Pull to retry — the API may be waking up.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = user?.name || user?.email || 'there';

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Welcome, {name}.</Text>
          <View style={styles.stats}>
            <Stat label="Match score" value={`${matchScore}%`} />
            <Stat label="Blowing up" value={String(blowingUp)} />
            <Stat label="Highlights" value={String(highlights)} />
            <Stat label="Status" value={inRelationship ? 'Dating' : 'Single'} />
          </View>
          {error ? (
            <Pressable onPress={() => void load()}>
              <Text style={styles.error}>{error}</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.pink} style={styles.spinner} />
        ) : (
          <Text style={styles.empty}>No posts in your feed yet.</Text>
        )
      }
      renderItem={({ item }) => <PostRow post={item} />}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PostRow({ post }: { post: DatingPost }) {
  const author = post.user?.name || post.user?.username || 'Someone';
  return (
    <View style={styles.card}>
      <Text style={styles.author}>{author}</Text>
      {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
      <Text style={styles.body} numberOfLines={4}>
        {post.content}
      </Text>
      <Text style={styles.meta}>
        {post.likes || 0} likes · {post.comments?.length || 0} comments
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12, flexGrow: 1, backgroundColor: colors.bg },
  header: { gap: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: '47%',
    flexGrow: 1,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  spinner: { marginTop: 24 },
  empty: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  author: { color: colors.pink, fontSize: 14, fontWeight: '700' },
  postTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.muted, fontSize: 12 },
});
