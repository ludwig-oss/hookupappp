import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { postsAPI, type DatingPost, type FeedMode } from '../../api/posts';
import { formatAxiosError } from '../../lib/apiError';
import { pickAndUploadPostMedia } from '../../lib/uploadMedia';
import { Field, Hint, NeonButton, Notice, PanelTitle, StageFrame, shell } from './chrome';
import { isVideoMedia, PostMedia } from './PostMedia';

const MODES: Array<{ id: FeedMode; label: string }> = [
  { id: 'for_you', label: 'For You' },
  { id: 'trending', label: 'Trending' },
  { id: 'videos', label: 'Videos' },
  { id: 'saved', label: 'Saved posts' },
];

const BANNER = 'Strictly dating, relationship & marriage content only. To inform, warn & educate.';

export function FeedPanel({ onShare }: { onShare: () => void }) {
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next: FeedMode) => {
    setLoading(true);
    setError('');
    try {
      const feed = await postsAPI.getFeed(next);
      setPosts(feed.posts || []);
      setDescription(feed.feedMeta?.description || '');
    } catch (err) {
      setPosts([]);
      setError(formatAxiosError(err, 'Could not load the feed. The API may be waking up.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(mode);
  }, [load, mode]);

  const publish = async () => {
    const content = draft.trim();
    if (!content) return;
    setError('');
    setPosting(true);
    try {
      await postsAPI.createPost({ type: 'positive', contentType: 'text', content });
      setDraft('');
      setComposing(false);
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
      const title = draft.trim();
      await postsAPI.createPost({
        type: 'positive',
        contentType: uploaded.contentType,
        content: uploaded.url,
        title: title || undefined,
      });
      setDraft('');
      setComposing(false);
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

  const blowing = posts.filter((post) => (post.likes || 0) >= 25);

  return (
    <StageFrame>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{BANNER}</Text>
      </View>
      <View style={styles.header}>
        <PanelTitle>Love Life Feed</PanelTitle>
        <Pressable onPress={() => setComposing((open) => !open)} style={styles.postBtn}>
          <Text style={styles.postBtnText}>+ Post</Text>
        </Pressable>
      </View>
      <Hint>Post photos, videos and updates — dating, relationships & marriage only.</Hint>
      <View style={styles.modes}>
        {MODES.map((item) => (
          <Pressable key={item.id} onPress={() => setMode(item.id)} style={[styles.mode, mode === item.id && styles.modeOn]}>
            <Text style={styles.modeText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {description && !loading ? <Hint>{description}</Hint> : null}
      {composing ? (
        <>
          <Field label="New post" value={draft} onChangeText={setDraft} multiline placeholder="Share something" />
          <NeonButton label={posting ? 'Posting…' : 'Post'} tone="magenta" onPress={() => void publish()} disabled={posting} />
          <NeonButton label={posting ? 'Uploading…' : 'Photo or video'} tone="ghost" onPress={() => void publishMedia()} disabled={posting} />
        </>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}
      {!loading && blowing.length > 0 ? (
        <Text style={styles.section}>🔥 Blowing up ({blowing.length})</Text>
      ) : null}
      {!loading && posts.length === 0 ? <Hint>Nothing in this feed yet.</Hint> : null}
      {posts.map((post) => (
        <View key={post.id} style={styles.card}>
          <Text style={styles.author}>{post.user?.name || post.user?.username || 'Someone'}</Text>
          {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
          {post.contentType === 'image' || post.contentType === 'video' ? (
            <PostMedia uri={post.content} video={post.contentType === 'video' || isVideoMedia(post.contentType, post.content)} />
          ) : (
            <Text style={styles.body}>{post.content}</Text>
          )}
          <Text style={styles.meta}>
            {post.likes || 0} likes · {post.comments?.length || 0} comments
          </Text>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <NeonButton label="Like" tone="ghost" onPress={() => void like(post.id)} />
            </View>
            <View style={styles.flex}>
              <NeonButton label="Share to chat" tone="ghost" onPress={onShare} />
            </View>
          </View>
        </View>
      ))}
    </StageFrame>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  bannerText: { color: shell.pinkSoft, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  postBtn: {
    backgroundColor: 'rgba(236, 72, 153, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ec4899',
  },
  postBtnText: { color: shell.white, fontWeight: '700', fontSize: 13 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mode: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeOn: { borderWidth: 2, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.2)' },
  modeText: { color: shell.white, fontSize: 12 },
  section: { color: shell.cream, fontSize: 14, fontWeight: '700' },
  card: {
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  author: { color: shell.pink, fontSize: 14, fontWeight: '700' },
  postTitle: { color: shell.white, fontSize: 16, fontWeight: '700' },
  body: { color: shell.text, fontSize: 15, lineHeight: 21 },
  meta: { color: shell.faint, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
