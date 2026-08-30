import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { adviceAPI, AdviceQuestion } from '../../api/advice';
import { formatAxiosError } from '../../lib/apiError';
import TranslateButton from '../TranslateButton';
import './Widget.css';

export default function DatingAdviceWidget() {
  const { user } = useContext(AuthContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedQuery, setFeedQuery] = useState('');
  const [questions, setQuestions] = useState<AdviceQuestion[]>([]);
  const [cohortLabel, setCohortLabel] = useState('');
  const [prizeEur, setPrizeEur] = useState(5);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [replySubmittingKey, setReplySubmittingKey] = useState<string | null>(null);

  const loadFeed = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await adviceAPI.getFeed(q);
      setQuestions(data.questions);
      setCohortLabel(data.cohortLabel);
      setPrizeEur(data.prizeEur);
    } catch (e) {
      setError(formatAxiosError(e, 'Could not load advice feed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setError('');
    setSuccess('');
    try {
      const res = await adviceAPI.search(q);
      setSuccess(res.message);
      setSearchQuery('');
      setExpandedId(res.question.id);
      await loadFeed();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not post your question'));
    } finally {
      setSearching(false);
    }
  };

  const handlePostAnswer = async (questionId: string) => {
    const content = (answerDrafts[questionId] || '').trim();
    if (!content) return;
    setSubmittingId(questionId);
    setError('');
    try {
      const res = await adviceAPI.postAnswer(questionId, content);
      if (res.firstTimeMessage) setSuccess(res.firstTimeMessage);
      else setSuccess('Advice posted! The asker was notified.');
      setAnswerDrafts((d) => ({ ...d, [questionId]: '' }));
      await loadFeed(feedQuery || undefined);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not post advice'));
    } finally {
      setSubmittingId(null);
    }
  };

  const handlePostReply = async (questionId: string, answerId: string) => {
    const key = `${questionId}:${answerId}`;
    const content = (replyDrafts[key] || '').trim();
    if (!content) return;
    setReplySubmittingKey(key);
    setError('');
    try {
      await adviceAPI.postReply(questionId, answerId, content);
      setReplyDrafts((d) => ({ ...d, [key]: '' }));
      await loadFeed(feedQuery || undefined);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not post comment'));
    } finally {
      setReplySubmittingKey(null);
    }
  };

  const handleLike = async (questionId: string, answerId: string) => {
    try {
      await adviceAPI.likeAnswer(questionId, answerId);
      await loadFeed(feedQuery || undefined);
    } catch {
      /* ignore */
    }
  };

  const handleLikeReply = async (questionId: string, answerId: string, replyId: string) => {
    try {
      await adviceAPI.likeReply(questionId, answerId, replyId);
      await loadFeed(feedQuery || undefined);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="widget dating-advice-widget">
      <h2 className="widget-title">Dating Advice</h2>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
        Ask anything — your post stays <strong>anonymous</strong>. {cohortLabel || 'Your cohort'} in your area see it first;
        hot questions spread wider. Best advice each month wins €{prizeEur}.
      </p>

      <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            background: 'linear-gradient(135deg, rgba(30,20,40,0.95), rgba(50,20,60,0.9))',
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask anything — e.g. gold diggers, first dates, red flags…"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 15,
            }}
          />
        </div>
        <button
          type="submit"
          className="select-user-btn"
          disabled={searching || !searchQuery.trim()}
          style={{ width: '100%', marginTop: 10 }}
        >
          {searching ? 'Posting…' : 'Ask & notify my group'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={feedQuery}
          onChange={(e) => setFeedQuery(e.target.value)}
          placeholder="Filter feed…"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #374151',
            background: '#111827',
            color: '#fff',
          }}
        />
        <button type="button" className="select-user-btn" onClick={() => loadFeed(feedQuery || undefined)}>
          Filter
        </button>
      </div>

      {error && <div className="error-message" style={{ marginBottom: 10 }}>{error}</div>}
      {success && (
        <div style={{ padding: 10, background: 'rgba(16,185,129,0.15)', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
          {success}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading advice feed…</p>
      ) : questions.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No questions yet. Be the first to ask!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q) => {
            const expanded = expandedId === q.id;
            const isMine = q.userId === user?.id;
            return (
              <div
                key={q.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(0,0,0,0.25)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : q.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#f472b6', marginBottom: 4 }}>
                    {q.cohortLabel || cohortLabel} · {q.answers.length} answers
                    {q.city ? ` · ${q.city}` : ''}
                    {isMine && ' · Your question (anonymous to others)'}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.query}</div>
                  <TranslateButton text={q.query} />
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                    {isMine ? 'You' : q.user?.name || 'Anonymous'} · {new Date(q.createdAt).toLocaleDateString()}
                  </div>
                </button>

                {expanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {q.answers.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af' }}>No answers yet — be the first to help!</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        {q.answers.map((a) => {
                          const liked = a.likeUserIds.includes(user?.id || '');
                          const replyKey = `${q.id}:${a.id}`;
                          return (
                            <div
                              key={a.id}
                              style={{
                                padding: 10,
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.04)',
                              }}
                            >
                              <div style={{ fontSize: 13 }}>{a.content}</div>
                              <TranslateButton text={a.content} />
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: 6,
                                  fontSize: 11,
                                  color: '#9ca3af',
                                }}
                              >
                                <span>{a.userId === user?.id ? 'You' : a.userName}</span>
                                <button
                                  type="button"
                                  onClick={() => handleLike(q.id, a.id)}
                                  style={{
                                    background: liked ? 'rgba(236,72,153,0.3)' : 'transparent',
                                    border: '1px solid rgba(236,72,153,0.4)',
                                    borderRadius: 999,
                                    padding: '4px 10px',
                                    color: '#fbcfe8',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                  }}
                                >
                                  ♥ {a.likeUserIds.length}
                                </button>
                              </div>

                              {(a.replies || []).length > 0 && (
                                <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid rgba(236,72,153,0.25)' }}>
                                  {(a.replies || []).map((r) => {
                                    const replyLiked = r.likeUserIds.includes(user?.id || '');
                                    return (
                                      <div key={r.id} style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 12 }}>{r.content}</div>
                                        <TranslateButton text={r.content} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#9ca3af' }}>
                                          <span>{r.userId === user?.id ? 'You' : r.userName}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleLikeReply(q.id, a.id, r.id)}
                                            style={{
                                              background: replyLiked ? 'rgba(236,72,153,0.3)' : 'transparent',
                                              border: '1px solid rgba(236,72,153,0.3)',
                                              borderRadius: 999,
                                              padding: '2px 8px',
                                              color: '#fbcfe8',
                                              cursor: 'pointer',
                                              fontSize: 10,
                                            }}
                                          >
                                            ♥ {r.likeUserIds.length}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div style={{ marginTop: 8 }}>
                                <input
                                  type="text"
                                  value={replyDrafts[replyKey] || ''}
                                  onChange={(e) => setReplyDrafts((d) => ({ ...d, [replyKey]: e.target.value }))}
                                  placeholder="Comment on this reply…"
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #374151',
                                    background: '#111827',
                                    color: '#fff',
                                    fontSize: 12,
                                  }}
                                />
                                <button
                                  type="button"
                                  className="select-user-btn"
                                  style={{ marginTop: 6, width: '100%', fontSize: 12, padding: '6px 10px' }}
                                  disabled={replySubmittingKey === replyKey || !(replyDrafts[replyKey] || '').trim()}
                                  onClick={() => handlePostReply(q.id, a.id)}
                                >
                                  {replySubmittingKey === replyKey ? 'Posting…' : 'Comment'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!isMine && (
                      <div>
                        <textarea
                          value={answerDrafts[q.id] || ''}
                          onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                          placeholder="Share your advice…"
                          rows={3}
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #374151',
                            background: '#111827',
                            color: '#fff',
                            resize: 'vertical',
                          }}
                        />
                        <button
                          type="button"
                          className="select-user-btn"
                          style={{ marginTop: 8, width: '100%' }}
                          disabled={submittingId === q.id || !(answerDrafts[q.id] || '').trim()}
                          onClick={() => handlePostAnswer(q.id)}
                        >
                          {submittingId === q.id ? 'Posting…' : 'Post advice'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
