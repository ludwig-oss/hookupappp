import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { adminAPI, SafetyReviewSummary } from '../api/admin';
import './AdminSafetyReview.css';

const AdminSafetyReview = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<SafetyReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    plan: SafetyReviewSummary;
    userName: string;
    partnerName: string | null;
    idFront: string | null;
    idBack: string | null;
    safetyVideo: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    adminAPI
      .checkAccess()
      .then(() => setAllowed(true))
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, []);

  const loadList = () => {
    adminAPI
      .listSafetyReviews()
      .then((r) => setReviews(r.reviews))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load queue'));
  };

  useEffect(() => {
    if (allowed) loadList();
  }, [allowed]);

  const openDetail = (planId: string) => {
    setSelectedId(planId);
    setDetail(null);
    adminAPI
      .getSafetyReview(planId)
      .then(setDetail)
      .catch((e) => setError(e.response?.data?.error || 'Failed to load review'));
  };

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selectedId) return;
    setDeciding(true);
    try {
      await adminAPI.decideSafetyReview(selectedId, decision);
      setSelectedId(null);
      setDetail(null);
      loadList();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save decision');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-safety-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="admin-safety-page">
        <h1>Admin only</h1>
        <p>Your account is not in ADMIN_USER_IDS. Add your user id ({user?.id}) to server .env to enable review.</p>
        <Link to="/">← Home</Link>
      </div>
    );
  }

  return (
    <div className="admin-safety-page">
      <header className="admin-safety-header">
        <h1>Safety review queue</h1>
        <p>Encrypted ID & 360° check-in videos — admin eyes only</p>
        <button type="button" className="admin-safety-back" onClick={() => navigate('/')}>
          ← Home
        </button>
      </header>

      {error && (
        <div className="admin-safety-error">
          {error}
          <button type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="admin-safety-layout">
        <aside className="admin-safety-list">
          <h2>Pending ({reviews.length})</h2>
          {reviews.length === 0 && <p className="admin-safety-empty">No pending check-ins</p>}
          {reviews.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`admin-safety-item ${selectedId === r.id ? 'active' : ''}`}
              onClick={() => openDetail(r.id)}
            >
              <strong>{r.userName}</strong>
              <span>{new Date(r.safetyCheckSubmittedAt || r.expectedBackAt).toLocaleString()}</span>
              <span>{r.location}</span>
            </button>
          ))}
        </aside>

        <main className="admin-safety-detail">
          {!detail && selectedId && <p>Loading review…</p>}
          {!selectedId && <p className="admin-safety-hint">Select a pending check-in</p>}
          {detail && (
            <>
              <h2>
                {detail.userName}
                {detail.partnerName ? ` · met ${detail.partnerName}` : ''}
              </h2>
              <p>
                <strong>When:</strong> {new Date(detail.plan.meetAt).toLocaleString()} · <strong>Back by:</strong>{' '}
                {new Date(detail.plan.expectedBackAt).toLocaleString()}
              </p>
              <p>
                <strong>Spot:</strong> {detail.plan.location}
              </p>

              <div className="admin-safety-media-grid">
                <div>
                  <h3>ID front</h3>
                  {detail.idFront ? (
                    <img src={detail.idFront} alt="ID front" className="admin-safety-id-img" />
                  ) : (
                    <p>Not on file</p>
                  )}
                </div>
                <div>
                  <h3>ID back</h3>
                  {detail.idBack ? (
                    <img src={detail.idBack} alt="ID back" className="admin-safety-id-img" />
                  ) : (
                    <p>Not on file</p>
                  )}
                </div>
              </div>

              <div className="admin-safety-video-wrap">
                <h3>360° safety check-in</h3>
                {detail.safetyVideo ? (
                  <video src={detail.safetyVideo} controls className="admin-safety-video" />
                ) : (
                  <p>No video submitted</p>
                )}
              </div>

              <div className="admin-safety-actions">
                <button type="button" className="admin-safety-approve" disabled={deciding} onClick={() => decide('approved')}>
                  Approve — user safe
                </button>
                <button type="button" className="admin-safety-reject" disabled={deciding} onClick={() => decide('rejected')}>
                  Flag / reject
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminSafetyReview;
