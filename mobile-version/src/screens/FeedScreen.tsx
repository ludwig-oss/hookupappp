import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { postsAPI, type DatingPost, type FeedMode } from '../api/posts';
import { formatAxiosError } from '../lib/apiError';
import { isVideoMedia, PostMedia } from '../components/dashboard/PostMedia';
import { UgcSafetyActions } from '../components/UgcSafetyActions';
import { pickAndUploadPostMedia } from '../lib/uploadMedia';
import { Card, ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

const MODES: FeedMode[] = ['for_you', 'trending', 'videos', 'saved'];

export function FeedScreen() {
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (next: FeedMode) => {
    setLoading(true);
    setError('');
    try {
      const feed = await postsAPI.getFeed(next);
      setPosts(feed.posts || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load the feed.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(mode);
    }, [load, mode])
  );

  const publish = async () => {
    const content = draft.trim();
    if (!content) return;
    setError('');
    setPosting(true);
    try {
      await postsAPI.createPost({ type: 'positive', contentType: 'text', content });
      setDraft('');
      await load(mode);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not publish that post.'));
    } finally {
      setPosting(false);
    }
  };

  const publishMedia = async () => {
    setError('');
    setPosting(true);
    try {
      const uploaded = await pickAndUploadPostMedia();
      if (!uploaded) return;
      await postsAPI.createPost({
        type: 'positive',
        contentType: uploaded.contentType,
        content: uploaded.url,
        title: draft.trim() || undefined,
      });
      setDraft('');
      await load(mode);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not post that photo or video.'));
    } finally {
      setPosting(false);
    }
  };

  const like = async (postId: string) => {
    try {
      await postsAPI.likePost(postId);
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post)));
    } catch (err) {
      setError(formatAxiosError(err, 'Could not like that post.'));
    }
  };

  return (
    <Screen>
      <Title subtitle="Love feed from /api/posts.">Feed</Title>
      <View style={styles.row}>
        {MODES.map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.chip, mode === item && styles.chipOn]}>
            <Text style={styles.chipText}>{item.replace('_', ' ')}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="New post" value={draft} onChangeText={setDraft} multiline placeholder="Share something" />
      <PrimaryButton label={posting ? 'Posting…' : 'Post'} onPress={() => void publish()} loading={posting} />
      <PrimaryButton label="Photo or video" tone="ghost" onPress={() => void publishMedia()} disabled={posting} />
      <PrimaryButton label={loading ? 'Loading…' : 'Reload'} tone="ghost" onPress={() => void load(mode)} loading={loading} />
      <ErrorText>{error}</ErrorText>
      {posts.length === 0 && !loading ? <Muted>Nothing in this feed yet.</Muted> : null}
      {posts.map((post) => (
        <Card key={post.id}>
          <Text style={styles.name}>{post.user?.name || post.title || post.type}</Text>
          {post.contentType === 'image' || post.contentType === 'video' ? (
            <PostMedia uri={post.content} video={post.contentType === 'video' || isVideoMedia(post.contentType, post.content)} />
          ) : (
            <Text style={styles.body}>{post.content}</Text>
          )}
          <Muted>{post.likes || 0} likes{post.user?.username ? ` · @${post.user.username}` : ''}</Muted>
          <UgcSafetyActions
            userId={post.userId || post.user?.id}
            onBlocked={(id) => setPosts((current) => current.filter((item) => String(item.userId || item.user?.id) !== id))}
          />
          <PrimaryButton label="Like" tone="ghost" onPress={() => void like(post.id)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  chipText: { color: colors.text, textTransform: 'capitalize', fontSize: 13 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
