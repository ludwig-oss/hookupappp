import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { adviceAPI, AdviceQuestion } from '../../api/advice';
import { formatAxiosError } from '../../lib/apiError';
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
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadFeed = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await adviceAPI.getFeed(q);
      setQuestions(data.questions);
      setCohortLabel(data.cohortLabel);
      setPrizeEur(data.prizeEur);
    } catch (e) {
      setError(formatAxiosError(e));
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
      setError(formatAxiosError(err));
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
      if (res.firstTimeMessage) {
        setSuccess(res.firstTimeMessage);
      } else {
        setSuccess('Advice posted! The asker was notified.');
      }
      setAnswerDrafts((d) => ({ ...d, [questionId]: '' }));
      await loadFeed(feedQuery || undefined);
    } catch (err) {
      setError(formatAxiosError(err));
    } finally {
      setSubmittingId(null);
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

  return (
    <div className="widget dating-advice-widget">
      <h2 className="widget-title">Dating Advice</h2>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
        Ask anything — peers in your group ({cohortLabel || 'your cohort'}) get notified to help.
        Best advice each month wins €{prizeEur} in your account balance.
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
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              opacity: searchQuery ? 0 : 0.35,
              fontSize: 15,
              fontWeight: 500,
              color: '#f9a8d4',
              textAlign: 'center',
              padding: '0 16px',
            }}
          >
            Search anything or dating advice…
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder=""
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 15,
              position: 'relative',
              zIndex: 1,
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
                    {isMine && ' · Your question'}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.query}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {q.user?.name || 'Someone'} · {new Date(q.createdAt).toLocaleDateString()}
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
                                <span>{a.userName}</span>
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
