import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { postsAPI, DatingPost } from '../../api/posts';
import './Widget.css';

const PostsWidgetFull = () => {
  const { user } = useContext(AuthContext);
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<DatingPost | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [newComment, setNewComment] = useState('');

  // Form state
  const [postType, setPostType] = useState<'warning' | 'positive'>('warning');
  const [contentType, setContentType] = useState<'text' | 'video' | 'image'>('text');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postTags, setPostTags] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await postsAPI.getPosts();
      setPosts(response.posts);
    } catch (err) {
      console.error('Failed to load posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      alert('Please enter content');
      return;
    }

    try {
      await postsAPI.createPost({
        type: postType,
        contentType,
        content: postContent,
        title: postTitle || undefined,
        tags: postTags ? postTags.split(',').map(t => t.trim()) : undefined,
      });
      setShowCreateModal(false);
      setPostContent('');
      setPostTitle('');
      setPostTags('');
      await loadPosts();
    } catch (err) {
      console.error('Failed to create post', err);
      alert('Failed to create post');
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await postsAPI.likePost(postId);
      await loadPosts();
    } catch (err) {
      console.error('Failed to like post', err);
    }
  };

  const handleComment = async (postId: string) => {
    if (!newComment.trim()) return;

    try {
      await postsAPI.commentOnPost(postId, newComment);
      setNewComment('');
      await loadPosts();
    } catch (err) {
      console.error('Failed to add comment', err);
      alert('Failed to add comment');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await postsAPI.deletePost(postId);
      await loadPosts();
    } catch (err) {
      console.error('Failed to delete post', err);
      alert('Failed to delete post');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading posts...</div>;
  }

  return (
    <div className="widget-full-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>📱 Dating Stories</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="select-user-btn"
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          + Create Post
        </button>
      </div>

      {/* Scrollable Feed - Right to Left */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          scrollBehavior: 'smooth',
          padding: '16px',
          gap: '16px',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        {posts.length === 0 ? (
          <div style={{
            width: '100%',
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280'
          }}>
            <p>No posts yet. Be the first to share your story!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              style={{
                minWidth: '350px',
                maxWidth: '350px',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: post.type === 'warning' ? '2px solid #ef4444' : '2px solid #10b981',
              }}
            >
              {/* Post Header */}
              <div style={{
                padding: '12px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: post.type === 'warning' ? '#fef2f2' : '#f0fdf4',
              }}>
                <div className="user-avatar" style={{ width: '40px', height: '40px' }}>
                  {post.user?.profilePicture ? (
                    <img src={post.user.profilePicture} alt={post.user.name} />
                  ) : (
                    <div className="avatar-placeholder">{post.user?.name[0] || 'U'}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>{post.user?.name || 'Anonymous'}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>@{post.user?.username || 'user'}</p>
                </div>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: post.type === 'warning' ? '#fee2e2' : '#d1fae5',
                  color: post.type === 'warning' ? '#991b1b' : '#065f46',
                }}>
                  {post.type === 'warning' ? '⚠️ Warning' : '✨ Positive'}
                </div>
              </div>

              {/* Post Content */}
              <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                {post.title && (
                  <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 'bold' }}>
                    {post.title}
                  </h3>
                )}
                
                {post.contentType === 'text' && (
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </p>
                )}
                
                {post.contentType === 'image' && (
                  <div style={{ marginBottom: '12px' }}>
                    <img
                      src={post.content}
                      alt="Post"
                      style={{ width: '100%', borderRadius: '8px' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {post.contentType === 'video' && (
                  <div style={{ marginBottom: '12px' }}>
                    <video
                      src={post.content}
                      controls
                      style={{ width: '100%', borderRadius: '8px' }}
                    />
                  </div>
                )}

                {post.tags && post.tags.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {post.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '4px 8px',
                          background: '#f3f4f6',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: '#6b7280',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div style={{
                padding: '12px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => handleLike(post.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '14px',
                    }}
                  >
                    ❤️ {post.likes}
                  </button>
                  <button
                    onClick={() => setShowComments(showComments === post.id ? null : post.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '14px',
                    }}
                  >
                    💬 {post.comments.length}
                  </button>
                  {post.userId === user?.id && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#ef4444',
                        marginLeft: 'auto',
                      }}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>

                {/* Comments Section */}
                {showComments === post.id && (
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb',
                  }}>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '8px' }}>
                      {post.comments.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>No comments yet</p>
                      ) : (
                        post.comments.map((comment) => (
                          <div key={comment.id} style={{ marginBottom: '8px' }}>
                            <p style={{ margin: 0, fontSize: '12px' }}>
                              <strong>{comment.userName}:</strong> {comment.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                      />
                      <button
                        onClick={() => handleComment(post.id)}
                        className="send-btn"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ marginTop: 0 }}>Create New Post</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Post Type
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setPostType('warning')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${postType === 'warning' ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: postType === 'warning' ? '#fef2f2' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  ⚠️ Warning
                </button>
                <button
                  onClick={() => setPostType('positive')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${postType === 'positive' ? '#10b981' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: postType === 'positive' ? '#f0fdf4' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  ✨ Positive
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as 'text' | 'video' | 'image')}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              >
                <option value="text">Text</option>
                <option value="image">Image (URL)</option>
                <option value="video">Video (URL)</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Title (optional)
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Enter a title..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Content {contentType === 'text' ? '' : '(URL)'}
              </label>
              {contentType === 'text' ? (
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Share your story..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    resize: 'vertical',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder={`Enter ${contentType} URL...`}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Tags (comma-separated, optional)
              </label>
              <input
                type="text"
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
                placeholder="dating, safety, advice..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCreatePost}
                className="select-user-btn"
                style={{ flex: 1 }}
              >
                Post
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setPostContent('');
                  setPostTitle('');
                  setPostTags('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsWidgetFull;




