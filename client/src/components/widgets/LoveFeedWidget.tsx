import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import { postsAPI, DatingPost, FeedMode } from '../../api/posts';
import { formatAxiosError } from '../../lib/apiError';
import { uploadMediaDataUrl } from '../../lib/uploadMedia';
import './Widget.css';

const BLOWING_UP_LIKES = 25;

const BANNER_TEXT = 'Strictly dating, relationship & marriage content only. To inform, warn & educate.';

const SEEK_STEP_SEC = 10;

/** Resolve video src to a blob URL if data URL */
function useVideoBlobUrl(src: string): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    if (src.startsWith('http')) {
      setBlobUrl(src);
      return;
    }
    if (!src.startsWith('data:video')) return;
    let objectUrl: string | null = null;
    try {
      const comma = src.indexOf(',');
      if (comma === -1) throw new Error('Invalid data URL');
      const base64 = src.slice(comma + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const mimeMatch = src.match(/^data:(video\/[^;]+)/);
      let type = mimeMatch ? mimeMatch[1] : 'video/mp4';
      if (type === 'video/quicktime') type = 'video/mp4';
      const blob = new Blob([bytes], { type });
      objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
    } catch {
      setBlobUrl(null);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return blobUrl;
}

/** Full-screen media viewer: zoom in/out, video controls (pause, rewind, ffwd), double-tap to like, left/right tap seek. */
function FullScreenMediaViewer({
  type,
  src,
  onClose,
  onLike,
}: {
  type: 'image' | 'video';
  src: string;
  onClose: () => void;
  onLike?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [showLikeHeart, setShowLikeHeart] = useState(false);
  const lastTapRef = useRef<{ x: number; t: number } | null>(null);
  const openedAtRef = useRef(Date.now());
  const videoBlobUrl = useVideoBlobUrl(type === 'video' ? src : '');

  const isVideo = type === 'video';
  const videoSrc = isVideo ? videoBlobUrl : null;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const seekBack = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - SEEK_STEP_SEC);
  }, []);

  const seekForward = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_STEP_SEC);
  }, []);

  const triggerLike = useCallback(() => {
    onLike?.();
    setShowLikeHeart(true);
    setTimeout(() => setShowLikeHeart(false), 600);
  }, [onLike]);

  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in e ? e.changedTouches?.[0]?.clientX : e.clientX;
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const w = rect.width;
      const x = (clientX ?? 0) - rect.left;
      if (x < w / 3) {
        seekBack();
        return;
      }
      if (x > (2 * w) / 3) {
        seekForward();
        return;
      }
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && now - last.t < 400 && Math.abs(x - last.x) < 30) {
        lastTapRef.current = null;
        triggerLike();
        return;
      }
      lastTapRef.current = { x, t: now };
      if (Date.now() - openedAtRef.current < 400) return;
      setShowControls((c) => !c);
    },
    [seekBack, seekForward, triggerLike]
  );

  const hasEnteredFullscreenRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    hasEnteredFullscreenRef.current = false;
    const onFullscreenChange = () => {
      if (document.fullscreenElement === el) hasEnteredFullscreenRef.current = true;
      if (hasEnteredFullscreenRef.current && !document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    const req = el.requestFullscreen?.();
    if (req) {
      req.then(() => { hasEnteredFullscreenRef.current = true; }).catch(() => {});
    }
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement === el) document.exitFullscreen?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (!isVideo || !videoSrc) return;
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  }, [isVideo, videoSrc]);

  if (type === 'image') {
    const handleBackdropClick = () => {
      if (Date.now() - openedAtRef.current < 400) return;
      onClose();
    };
    return (
      <div
        ref={containerRef}
        className="love-feed-fullscreen-viewer"
        onClick={(e) => e.target === e.currentTarget && handleBackdropClick()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
        <button type="button" className="love-feed-fullscreen-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    );
  }

  if (!videoSrc) {
    return (
      <div ref={containerRef} className="love-feed-fullscreen-viewer">
        <div style={{ color: '#fff', padding: 24 }}>Loading video…</div>
        <button type="button" className="love-feed-fullscreen-close" onClick={onClose}>×</button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="love-feed-fullscreen-viewer"
      onClick={handleTap}
      onTouchEnd={(e) => { e.preventDefault(); handleTap(e as any); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === ' ') {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        playsInline
        preload="auto"
        className="love-feed-fullscreen-video"
        onClick={(e) => e.stopPropagation()}
        onPlay={() => setShowControls(false)}
        onPause={() => setShowControls(true)}
      />
      {showLikeHeart && (
        <div className="love-feed-fullscreen-heart" aria-hidden>
          ♥
        </div>
      )}
      {showControls && (
        <div className="love-feed-fullscreen-controls" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={seekBack} aria-label="Rewind 10s">⏪ -10s</button>
          <button type="button" onClick={togglePlay} aria-label="Play / Pause">⏯</button>
          <button type="button" onClick={seekForward} aria-label="Forward 10s">+10s ⏩</button>
          <button type="button" className="love-feed-fullscreen-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}

/** Renders a video from a post's data URL using a blob URL so it loads and plays reliably. */
function VideoPostPlayer({ dataUrl, onOpenFullScreen }: { dataUrl: string; onOpenFullScreen?: () => void }) {
  const blobUrl = useVideoBlobUrl(dataUrl);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="love-feed-video-error" style={{ padding: 24, textAlign: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 8, color: 'rgba(255,255,255,0.8)' }}>
        Video could not be loaded. Try MP4 or WebM.
      </div>
    );
  }
  if (!blobUrl) {
    return (
      <div className="love-feed-video-loading" style={{ padding: 24, textAlign: 'center', background: '#000', borderRadius: 8, color: 'rgba(255,255,255,0.6)' }}>
        Loading video…
      </div>
    );
  }
  return (
    <div className="love-feed-card-media-video-wrap" onClick={onOpenFullScreen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenFullScreen?.()} title="Tap to open full screen">
      <video
        src={blobUrl}
        controls
        playsInline
        preload="auto"
        style={{ maxWidth: '100%', maxHeight: 320, display: 'block', background: '#000' }}
        onError={() => setError('Video could not be played')}
        onClick={(e) => { e.stopPropagation(); onOpenFullScreen?.(); }}
      />
    </div>
  );
}

export default function LoveFeedWidget({ onShareToFriends }: { onShareToFriends?: (post: DatingPost) => void }) {
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [recommendations, setRecommendations] = useState<DatingPost[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you');
  const [feedDescription, setFeedDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [postType, setPostType] = useState<'warning' | 'positive'>('positive');
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postTags, setPostTags] = useState('');
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ type: 'image' | 'video'; src: string; postId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureImageRef = useRef<HTMLInputElement>(null);
  const captureVideoRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());

  const closeCreateModal = () => {
    revokePreview();
    setMediaData(null);
    setSelectedMediaType(null);
    setPostContent('');
    setPostTitle('');
    setPostTags('');
    setShowCreateModal(false);
  };

  useEffect(() => {
    if (!showCreateModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showCreateModal]);

  const revokePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    loadFeed(feedMode);
  }, [feedMode]);

  const loadFeed = async (mode: FeedMode = feedMode) => {
    setFeedError(null);
    setLoading(true);
    try {
      const [feedRes, recRes] = await Promise.all([
        postsAPI.getFeed(mode),
        mode === 'for_you' ? postsAPI.getRecommendations().catch(() => ({ recommendations: [], trendingTags: [] })) : Promise.resolve({ recommendations: [], trendingTags: [] }),
      ]);
      setPosts(Array.isArray(feedRes.posts) ? feedRes.posts : []);
      setRecommendations(recRes.recommendations || []);
      setTrendingTags(feedRes.feedMeta?.trendingTags || recRes.trendingTags || []);
      setFeedDescription(feedRes.feedMeta?.description || '');
    } catch (err) {
      console.error('Failed to load feed', err);
      setPosts([]);
      setFeedError(formatAxiosError(err, 'Could not load the feed. Tap Retry — the API may be waking up.'));
    } finally {
      setLoading(false);
    }
  };

  const trackPostView = useCallback((postId: string) => {
    if (!user || viewedPostsRef.current.has(postId)) return;
    viewedPostsRef.current.add(postId);
    postsAPI.recordView(postId).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !feedRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = (entry.target as HTMLElement).dataset.postId;
          if (id) trackPostView(id);
        });
      },
      { threshold: 0.45, root: feedRef.current }
    );
    feedRef.current.querySelectorAll('[data-post-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts, recommendations, user, trackPostView]);

  const handleCreatePost = async () => {
    if (!postContent.trim() && !mediaData) {
      alert('Add a statement, image or video');
      return;
    }
    let content = mediaData || postContent.trim();
    if (!content) return;
    let resolvedContentType: 'text' | 'image' | 'video' = mediaData
      ? (mediaData.startsWith('data:video/') || selectedMediaType === 'video' ? 'video' : 'image')
      : 'text';
    setPosting(true);
    try {
      if (mediaData && content.startsWith('data:') && (resolvedContentType === 'video' || content.length > 350_000)) {
        content = await uploadMediaDataUrl(content, 'posts');
        resolvedContentType = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(content) ? 'video' : 'image';
      }
      await postsAPI.createPost({
        type: postType,
        contentType: resolvedContentType,
        content,
        title: postTitle || undefined,
        tags: postTags
          .split(/[,\s#]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      closeCreateModal();
      await loadFeed(feedMode);
    } catch (err: any) {
      console.error('Failed to create post', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to create post';
      if (err?.response?.status === 413 || msg.toLowerCase().includes('too large')) {
        alert('Upload failed — try again on Wi‑Fi or use a shorter clip.');
      } else {
        alert(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await postsAPI.likePost(postId);
      await loadFeed(feedMode);
    } catch (err: any) {
      console.error('Failed to like', err);
      if (err?.response?.status === 401) alert('Please sign in to like posts.');
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentDraft[postId]?.trim();
    if (!text) return;
    try {
      await postsAPI.commentOnPost(postId, text);
      setCommentDraft((prev) => ({ ...prev, [postId]: '' }));
      await loadFeed(feedMode);
    } catch (err: any) {
      console.error('Failed to comment', err);
      if (err?.response?.status === 401) alert('Please sign in to comment.');
    }
  };

  const handleShare = async (post: DatingPost) => {
    try {
      await postsAPI.sharePost(post.id);
      await loadFeed(feedMode);
      onShareToFriends?.(post);
    } catch (err: any) {
      console.error('Failed to share', err);
      if (err?.response?.status === 401) alert('Please sign in to share.');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await postsAPI.deletePost(postId);
      await loadFeed(feedMode);
    } catch (err: any) {
      console.error('Failed to delete post', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete post';
      alert(msg);
    }
  };

  const isPostAuthor = (post: DatingPost) => {
    if (!user?.id) return false;
    const uid = String(user.id).trim();
    const fromPost = post.userId != null && String(post.userId).length > 0 ? String(post.userId).trim() : '';
    const fromNested = post.user?.id != null ? String(post.user.id).trim() : '';
    return fromPost === uid || fromNested === uid;
  };

  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${date.getDate()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const processFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return;
    revokePreview();
    setMediaData(null);
    setSelectedMediaType(isVideo ? 'video' : 'image');
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setMediaLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaData(reader.result as string);
      setMediaLoading(false);
    };
    reader.onerror = () => {
      setMediaLoading(false);
      revokePreview();
      alert('Could not read file. Try another.');
    };
    reader.readAsDataURL(file);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  const trendingPosts = [...posts]
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 5)
    .filter((p) => (p.likes || 0) > 0);
  const blowingUpPosts = posts.filter((p) => (p.likes || 0) >= BLOWING_UP_LIKES);

  const renderPostCard = (post: DatingPost, opts?: { compact?: boolean }) => (
    <article key={post.id} className="love-feed-card" data-post-id={post.id}>
      {isPostAuthor(post) && (
        <div className="love-feed-card-own-toolbar">
          <button
            type="button"
            className="love-feed-delete-post-btn"
            onClick={() => handleDelete(post.id)}
          >
            Delete post
          </button>
        </div>
      )}
      <div className="love-feed-card-media">
        {post.contentType === 'video' && post.content.startsWith('data:video') ? (
          <VideoPostPlayer
            dataUrl={post.content}
            onOpenFullScreen={() => setFullScreenMedia({ type: 'video', src: post.content, postId: post.id })}
          />
        ) : post.contentType === 'video' && post.content.startsWith('http') ? (
          <div
            className="love-feed-card-media-video-wrap"
            onClick={() => setFullScreenMedia({ type: 'video', src: post.content, postId: post.id })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setFullScreenMedia({ type: 'video', src: post.content, postId: post.id })}
            title="Tap to open full screen"
          >
            <video src={post.content} controls playsInline preload="auto" style={{ maxWidth: '100%', maxHeight: 320, display: 'block', background: '#000' }} onClick={(e) => e.stopPropagation()} />
          </div>
        ) : post.contentType === 'image' && (post.content.startsWith('data:') || post.content) ? (
          <div
            className="love-feed-card-media-tappable"
            onClick={() => setFullScreenMedia({ type: 'image', src: post.content, postId: post.id })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setFullScreenMedia({ type: 'image', src: post.content, postId: post.id })}
            title="Tap to open full screen"
          >
            <img src={post.content} alt="" />
          </div>
        ) : (
          <div className="love-feed-card-media-text">{post.content.slice(0, 200)}{post.content.length > 200 ? '…' : ''}</div>
        )}
      </div>
      <div className="love-feed-card-meta">
        <div className="love-feed-card-author">
          {post.user?.profilePicture ? (
            <img src={post.user.profilePicture} alt="" className="love-feed-avatar" />
          ) : (
            <div className="love-feed-avatar-placeholder">{post.user?.name?.[0] || '?'}</div>
          )}
          <div className="love-feed-card-author-info">
            <span className="love-feed-author-name">
              {post.user?.name || 'Anonymous'}
              <span className="love-feed-verified" aria-hidden>✓</span>
            </span>
            <span className="love-feed-card-date">{formatDate(post.createdAt)}</span>
            {post.feedReason && !opts?.compact && (
              <span style={{ display: 'block', fontSize: 11, color: '#f472b6', marginTop: 2 }}>✦ {post.feedReason}</span>
            )}
          </div>
        </div>
        {(post.tags?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {post.tags!.slice(0, 5).map((tag) => (
              <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(236,72,153,0.15)', color: '#fbcfe8' }}>
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}
        <p className="love-feed-card-headline">
          {post.title ? `"${post.title}"` : post.contentType === 'text' ? `"${post.content.slice(0, 120)}${post.content.length > 120 ? '…' : ''}"` : post.contentType === 'video' ? 'Shared a video' : 'Shared a post'}
        </p>
      </div>
      <div className="love-feed-card-actions">
        <div className="love-feed-actions-primary">
          <button type="button" className="love-feed-action" onClick={() => user && handleLike(post.id)} title="Like" disabled={!user}>
            <span className="love-feed-icon">♥</span>
            <span>{formatCount(post.likes || 0)}</span>
          </button>
          <button
            type="button"
            className="love-feed-action"
            onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
            title="Comment"
          >
            <span className="love-feed-icon">💬</span>
            <span>{formatCount(post.comments?.length || 0)}</span>
          </button>
        </div>
        <div className="love-feed-actions-secondary">
          <button type="button" className="love-feed-action love-feed-share" onClick={() => user && handleShare(post)} title="Share in app" disabled={!user}>
            <span className="love-feed-icon">↗</span>
            <span>Share</span>
          </button>
          {isPostAuthor(post) && (
            <button type="button" className="love-feed-action love-feed-delete" onClick={() => handleDelete(post.id)} title="Delete your post">
              <span className="love-feed-icon">🗑</span>
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            className="love-feed-show-comments"
            onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
          >
            {expandedComments === post.id ? 'Hide comments' : 'Comments'}
          </button>
        </div>
      </div>
      {expandedComments === post.id && (
        <div className="love-feed-comments">
          {(post.comments || []).map((c) => (
            <div key={c.id} className="love-feed-comment">
              <strong>{c.userName}</strong>: {c.content}
            </div>
          ))}
          {user && (
            <div className="love-feed-comment-form">
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentDraft[post.id] || ''}
                onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
              />
              <button type="button" onClick={() => handleComment(post.id)}>Reply</button>
            </div>
          )}
        </div>
      )}
    </article>
  );

  return (
    <div className="love-feed-widget">
      <div className="love-feed-banner">{BANNER_TEXT}</div>

      <div className="love-feed-header">
        <h2 className="love-feed-title">Love Life Feed</h2>
        <button type="button" className="love-feed-create-btn" onClick={() => setShowCreateModal(true)}>
          + Post
        </button>
      </div>

      <p className="love-feed-hint">
        Post photos, videos and updates — the feed learns from what you watch, like and comment on. Tags and views shape what you see next.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          ['for_you', 'For You'],
          ['trending', 'Trending'],
          ['videos', 'Videos'],
          ['following', 'Following'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFeedMode(mode)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: feedMode === mode ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.2)',
              background: feedMode === mode ? 'rgba(236,72,153,0.2)' : 'transparent',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {feedDescription && !loading && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>{feedDescription}</p>
      )}

      {trendingTags.length > 0 && !loading && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#9ca3af' }}>
          Trending: {trendingTags.map((t) => `#${t}`).join(' · ')}
        </div>
      )}

      {!user && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12, padding: '0 4px' }}>Sign in to post, like, comment and share.</p>
      )}

      <div ref={feedRef} className="love-feed-scroll">
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#00d4ff' }}>Loading feed… (API may take a moment on first open)</div>
        )}
        {!loading && feedError && (
          <div className="love-feed-error">
            <p>{feedError}</p>
            <button type="button" className="love-feed-create-btn" onClick={() => loadFeed(feedMode)}>Retry</button>
          </div>
        )}
        {!loading && !feedError && feedMode === 'for_you' && recommendations.length > 0 && (
          <section className="love-feed-trending" style={{ marginBottom: 16 }}>
            <h3 className="love-feed-trending-title">✨ Recommended for you</h3>
            <p className="love-feed-trending-sub">Picks based on what you watch, like and comment on.</p>
            {recommendations.slice(0, 3).map((post) => renderPostCard(post, { compact: true }))}
          </section>
        )}
        {!loading && !feedError && blowingUpPosts.length > 0 && (
          <section className="love-feed-trending">
            <h3 className="love-feed-trending-title">🔥 Blowing up ({blowingUpPosts.length})</h3>
            <p className="love-feed-trending-sub">Posts with {BLOWING_UP_LIKES}+ likes — open Chat after Share to send to a match.</p>
          </section>
        )}
        {!loading && !feedError && trendingPosts.length > 0 && (
          <section className="love-feed-trending">
            <h3 className="love-feed-trending-title">📈 Trending (most likes)</h3>
            <ul className="love-feed-trending-list">
              {trendingPosts.map((post) => (
                <li key={post.id}>
                  ♥ {formatCount(post.likes || 0)} — {post.title || post.content.slice(0, 60)}
                  {post.content.length > 60 ? '…' : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && !feedError && posts.length === 0 && (
          <div className="love-feed-empty">
            <p>No posts yet. Share advice, warnings or stories about dating, relationships & marriage.</p>
            <button type="button" className="love-feed-create-btn" onClick={() => setShowCreateModal(true)}>
              Create first post
            </button>
          </div>
        )}
        {!loading && !feedError && posts.length > 0 && (
          <section>
            <h3 className="love-feed-trending-title" style={{ marginBottom: 10 }}>Feed</h3>
            {posts.map((post) => renderPostCard(post))}
          </section>
        )}
      </div>

      {fullScreenMedia && (
        <FullScreenMediaViewer
          type={fullScreenMedia.type}
          src={fullScreenMedia.src}
          onClose={() => setFullScreenMedia(null)}
          onLike={user ? () => { handleLike(fullScreenMedia.postId); loadFeed(feedMode); } : undefined}
        />
      )}

      {showCreateModal && createPortal(
        <div className="love-feed-modal-overlay" onClick={closeCreateModal} role="dialog" aria-modal="true">
          <div className="love-feed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="love-feed-modal-header">
              <h3>New post</h3>
              <button type="button" className="love-feed-modal-close" onClick={closeCreateModal} aria-label="Close">×</button>
            </div>
            <p className="love-feed-modal-note">Text thoughts, photos, or videos — dating, relationship & marriage only.</p>
            <div className="love-feed-modal-form">
              <label>
                Type
                <select value={postType} onChange={(e) => setPostType(e.target.value as 'warning' | 'positive')}>
                  <option value="positive">Positive / advice</option>
                  <option value="warning">Warning / story</option>
                </select>
              </label>
              <label>
                Headline (optional)
                <input type="text" placeholder="e.g. How we made long-distance work" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
              </label>
              <label>
                Tags (helps recommendations)
                <input type="text" placeholder="e.g. longdistance, firstdate, redflags" value={postTags} onChange={(e) => setPostTags(e.target.value)} />
              </label>
              <label>
                Statement
                <textarea placeholder="Your post..." value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={3} />
              </label>
              <div className="love-feed-media-actions">
                <span style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Add image or video</span>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaSelect} />
                <input ref={captureImageRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleMediaSelect} />
                <input ref={captureVideoRef} type="file" accept="video/*" capture="user" style={{ display: 'none' }} onChange={handleMediaSelect} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button type="button" className="love-feed-create-btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => fileInputRef.current?.click()} disabled={mediaLoading}>
                    Choose file
                  </button>
                  <button type="button" className="profile-location-btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => captureImageRef.current?.click()} disabled={mediaLoading}>
                    📷 Take photo
                  </button>
                  <button type="button" className="profile-location-btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => captureVideoRef.current?.click()} disabled={mediaLoading}>
                    🎬 Record video
                  </button>
                </div>
                {mediaLoading && selectedMediaType === 'video' && <p style={{ marginTop: 4, color: '#00d4ff', fontSize: 12 }}>Preparing video for post…</p>}
              </div>
              {previewUrl && (
                <div className="love-feed-preview-wrap" style={{ marginTop: 12 }}>
                  {selectedMediaType === 'video' && (
                    <div style={{ minHeight: 200, width: '100%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                      <video
                        ref={videoPreviewRef}
                        key={previewUrl}
                        src={previewUrl}
                        controls
                        playsInline
                        preload="auto"
                        style={{ width: '100%', maxHeight: 280, display: 'block' }}
                      />
                    </div>
                  )}
                  {selectedMediaType === 'image' && (
                    <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, display: 'block', borderRadius: 8 }} />
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="profile-location-btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { revokePreview(); setMediaData(null); setSelectedMediaType(null); if (fileInputRef.current) fileInputRef.current.value = ''; if (captureImageRef.current) captureImageRef.current.value = ''; if (captureVideoRef.current) captureVideoRef.current.value = ''; }}>
                      Remove & choose another
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="love-feed-modal-footer">
              <button type="button" onClick={closeCreateModal} disabled={posting}>Cancel</button>
              <button type="button" className="love-feed-create-btn" onClick={handleCreatePost} disabled={posting || (selectedMediaType === 'video' && mediaLoading)}>
                {posting ? 'Posting…' : (selectedMediaType === 'video' && mediaLoading ? 'Preparing…' : 'Post')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
