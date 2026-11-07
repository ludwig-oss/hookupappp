import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { postsAPI, type DatingPost } from '../../api/posts';
import { formatAxiosError } from '../../lib/apiError';
import { pickAndUploadPostMedia } from '../../lib/uploadMedia';
import { isVideoMedia, PostMedia } from './PostMedia';

export function ProfilePosts({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const mine = await postsAPI.getPostsByUser(userId);
    setPosts(mine.posts || []);
  }, [userId]);

  useEffect(() => {
    void load().catch(() => setPosts([]));
  }, [load]);

  const publishMedia = async () => {
    setPosting(true);
    setError('');
    try {
      const uploaded = await pickAndUploadPostMedia();
      if (!uploaded) return;
      const title = caption.trim();
      const { post } = await postsAPI.createPost({
        type: 'positive',
        contentType: uploaded.contentType,
        content: uploaded.url,
        title: title || undefined,
      });
      setCaption('');
      setPosts((prev) => [post, ...prev.filter((item) => item.id !== post.id)]);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not post that photo or video.'));
    } finally {
      setPosting(false);
    }
  };

  const like = async (postId: string) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post)));
    try {
      await postsAPI.likePost(postId);
    } catch (err) {
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: Math.max(0, (post.likes || 0) - 1) } : post))
      );
      setError(formatAxiosError(err, 'Could not like that post.'));
    }
  };

  const share = async (postId: string) => {
    try {
      await postsAPI.sharePost(postId);
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, shares: (post.shares || 0) + 1 } : post)));
    } catch (err) {
      setError(formatAxiosError(err, 'Could not share that post.'));
    }
  };

  const comment = async (postId: string) => {
    const content = (drafts[postId] || '').trim();
    if (!content) return;
    try {
      await postsAPI.commentOnPost(postId, content);
      setDrafts((prev) => ({ ...prev, [postId]: '' }));
      await load();
      setOpenComments(postId);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not comment on that post.'));
    }
  };

  const remove = async (postId: string) => {
    try {
      await postsAPI.deletePost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      setError(formatAxiosError(err, 'Could not delete that post.'));
    }
  };

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>POSTS</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Caption (optional)"
        placeholderTextColor="rgba(0,212,255,0.5)"
        style={styles.input}
      />
      <Pressable style={styles.add} onPress={() => void publishMedia()} disabled={posting}>
        <Text style={styles.addText}>{posting ? 'UPLOADING…' : 'ADD PHOTO OR VIDEO'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {posts.length === 0 ? <Text style={styles.empty}>You have not posted yet.</Text> : null}
      {posts.map((post) => {
        const video = post.contentType === 'video' || isVideoMedia(post.contentType, post.content);
        const showMedia = post.contentType === 'image' || post.contentType === 'video';
        return (
          <View key={post.id} style={styles.post}>
            {showMedia && post.content ? <PostMedia uri={post.content} video={video} /> : null}
            {!showMedia && post.content ? <Text style={styles.postText}>{post.content}</Text> : null}
            {post.title ? <Text style={styles.postText}>{post.title}</Text> : null}
            {showMedia && !post.title ? (
              <Text style={styles.note}>{video ? 'Shared a video' : 'Shared a post'}</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => void like(post.id)}>
                <Text style={styles.action}>♥ {post.likes || 0}</Text>
              </Pressable>
              <Pressable onPress={() => setOpenComments((current) => (current === post.id ? null : post.id))}>
                <Text style={styles.action}>💬 {post.comments?.length || 0}</Text>
              </Pressable>
              <Pressable onPress={() => void share(post.id)}>
                <Text style={styles.action}>↗ {post.shares || 0}</Text>
              </Pressable>
              <Pressable onPress={() => void remove(post.id)}>
                <Text style={styles.action}>Delete</Text>
              </Pressable>
            </View>
            {openComments === post.id ? (
              <View style={styles.comments}>
                {(post.comments || []).map((item) => (
                  <Text key={item.id} style={styles.comment}>
                    <Text style={styles.commentName}>{item.userName}</Text>
                    {item.replyToUserName ? ` → ${item.replyToUserName}` : ''}: {item.content}
                  </Text>
                ))}
                <View style={styles.commentRow}>
                  <TextInput
                    value={drafts[post.id] || ''}
                    onChangeText={(value) => setDrafts((prev) => ({ ...prev, [post.id]: value }))}
                    placeholder="Write a comment"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    style={styles.commentInput}
                  />
                  <Pressable onPress={() => void comment(post.id)}>
                    <Text style={styles.action}>Reply</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18, paddingHorizontal: 20 },
  sectionTitle: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: '#fff',
    fontSize: 13,
  },
  add: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.15)',
    alignItems: 'center',
  },
  addText: { color: '#00d4ff', fontWeight: '700', fontSize: 13, letterSpacing: 0.6 },
  error: { color: '#ff6b6b', marginTop: 8, fontSize: 13 },
  empty: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 10 },
  post: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,143,171,0.4)',
  },
  postText: { color: '#fff', paddingHorizontal: 10, paddingTop: 10, fontSize: 14 },
  note: { color: 'rgba(255,255,255,0.7)', fontSize: 12, paddingHorizontal: 10, paddingTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 10 },
  action: { color: '#00d4ff', fontSize: 13, fontWeight: '700' },
  comments: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  comment: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  commentName: { color: '#fff', fontWeight: '700' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    borderRadius: 6,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
});
