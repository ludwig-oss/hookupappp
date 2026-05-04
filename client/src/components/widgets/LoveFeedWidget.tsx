import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { postsAPI, DatingPost } from '../../api/posts';
import './Widget.css';

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
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [postType, setPostType] = useState<'warning' | 'positive'>('positive');
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
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

  const MAX_VIDEO_MB = 25;
  const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
  const feedRef = useRef<HTMLDivElement>(null);

  const closeCreateModal = () => {
    revokePreview();
    setMediaData(null);
    setSelectedMediaType(null);
    setPostContent('');
    setPostTitle('');
    setShowCreateModal(false);
  };
  const revokePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const res = await postsAPI.getFeed();
      setPosts(res.posts);
    } catch (err) {
      console.error('Failed to load feed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !mediaData) {
      alert('Add a statement, image or video');
      return;
    }
    const content = mediaData || postContent.trim();
    if (!content) return;
    const resolvedContentType = mediaData
      ? (mediaData.startsWith('data:video/') ? 'video' : 'image')
      : 'text';
    if (resolvedContentType === 'video' && content.length > MAX_VIDEO_BYTES * (4 / 3)) {
      alert(`Video is too large. Use a file under ${MAX_VIDEO_MB}MB or a shorter clip.`);
      return;
    }
    setPosting(true);
    try {
      await postsAPI.createPost({
        type: postType,
        contentType: resolvedContentType,
        content,
        title: postTitle || undefined,
      });
      closeCreateModal();
      await loadFeed();
    } catch (err: any) {
      console.error('Failed to create post', err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || 'Failed to create post';
      if (status === 413 || msg.toLowerCase().includes('too large')) {
        alert(`Video is too large. Try a shorter or smaller file (under ${MAX_VIDEO_MB}MB).`);
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
      await loadFeed();
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
      await loadFeed();
    } catch (err: any) {
      console.error('Failed to comment', err);
      if (err?.response?.status === 401) alert('Please sign in to comment.');
    }
  };

  const handleShare = async (post: DatingPost) => {
    try {
      await postsAPI.sharePost(post.id);
      await loadFeed();
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
      await loadFeed();
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
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      alert(`Video must be under ${MAX_VIDEO_MB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }
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

  if (loading) {
    return (
      <div className="love-feed-widget">
        <div className="love-feed-banner">{BANNER_TEXT}</div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#00d4ff' }}>Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="love-feed-widget">
      <div className="love-feed-banner">{BANNER_TEXT}</div>

      <div className="love-feed-header">
        <h2 className="love-feed-title">Love Life Feed</h2>
        <button type="button" className="love-feed-create-btn" onClick={() => setShowCreateModal(true)}>
          + Post
        </button>
      </div>

      {!user && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12, padding: '0 4px' }}>Sign in to like, comment and share posts.</p>
      )}
      <div ref={feedRef} className="love-feed-scroll">
        {posts.length === 0 ? (
          <div className="love-feed-empty">
            <p>No posts yet. Share advice, warnings or stories about dating, relationships & marriage.</p>
            <button type="button" className="love-feed-create-btn" onClick={() => setShowCreateModal(true)}>
              Create first post
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="love-feed-card">
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
                  </div>
                </div>
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
                  <button type="button" className="love-feed-action love-feed-share" onClick={() => user && handleShare(post)} title="Share" disabled={!user}>
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
          ))
        )}
      </div>

      {fullScreenMedia && (
        <FullScreenMediaViewer
          type={fullScreenMedia.type}
          src={fullScreenMedia.src}
          onClose={() => setFullScreenMedia(null)}
          onLike={user ? () => { handleLike(fullScreenMedia.postId); loadFeed(); } : undefined}
        />
      )}

      {showCreateModal && (
        <div className="love-feed-modal-overlay" onClick={closeCreateModal}>
          <div className="love-feed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="love-feed-modal-header">
              <h3>New post</h3>
              <button type="button" className="love-feed-modal-close" onClick={closeCreateModal}>×</button>
            </div>
            <p className="love-feed-modal-note">Dating, relationship & marriage only.</p>
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
        </div>
      )}
    </div>
  );
}
