import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { adminAPI } from '../api/admin';
import './AdminSafetyReview.css';

type CoachApp = {
  id: string;
  userId: string;
  categories: string[];
  region: string;
  experience: string;
  qualifications: string;
  status: string;
  applicantName?: string;
  applicantUsername?: string;
  applicantPicture?: string | null;
  applicantAge?: number | null;
  applicantCity?: string | null;
  applicantCountry?: string | null;
  widgetAnswers?: Array<{
    categoryId: string;
    whyGood: string;
    proofType?: string;
    instagramHandle?: string;
    imageUrls?: string[];
    videoUrl?: string;
  }>;
  proofPerCategory?: Record<string, { whyGood?: string; description?: string; proofType?: string; instagramHandle?: string; imageUrls?: string[]; videoUrl?: string }>;
};

const AdminCoachReview = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<CoachApp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starRating, setStarRating] = useState(4.5);
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
      .listCoachApplications()
      .then((r) => setApplications(r.applications as CoachApp[]))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load applications'));
  };

  useEffect(() => {
    if (allowed) loadList();
  }, [allowed]);

  const selected = applications.find((a) => a.id === selectedId) || null;

  const approve = async () => {
    if (!selectedId) return;
    setDeciding(true);
    setError('');
    try {
      await adminAPI.approveCoachApplication(selectedId, starRating);
      setSelectedId(null);
      loadList();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Approve failed');
    } finally {
      setDeciding(false);
    }
  };

  const reject = async () => {
    if (!selectedId) return;
    setDeciding(true);
    try {
      await adminAPI.rejectCoachApplication(selectedId);
      setSelectedId(null);
      loadList();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Reject failed');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return <div className="admin-safety-page"><p>Loading…</p></div>;
  }

  if (!allowed) {
    return (
      <div className="admin-safety-page">
        <h1>Admin only</h1>
        <p>Add your user id ({user?.id}) to ADMIN_USER_IDS in server .env.</p>
        <Link to="/home">← Home</Link>
      </div>
    );
  }

  return (
    <div className="admin-safety-page">
      <header className="admin-safety-header">
        <h1>Style / Problem Coach applications</h1>
        <div>
          <Link to="/admin/safety" style={{ marginRight: 12 }}>Safety queue</Link>
          <button type="button" onClick={() => navigate('/home')}>Home</button>
        </div>
      </header>

      {error && <p className="admin-safety-error">{error}</p>}

      <div className="admin-safety-layout">
        <ul className="admin-safety-list">
          {applications.length === 0 && <li>No pending applications 🎉</li>}
          {applications.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                className={selectedId === app.id ? 'active' : ''}
                onClick={() => setSelectedId(app.id)}
              >
                {app.applicantName || app.applicantUsername || app.userId}
                <span className="admin-safety-meta">{app.region} · {app.categories?.length || 0} areas</span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="admin-safety-detail">
            <h2>{selected.applicantName}</h2>
            <p><strong>@{selected.applicantUsername}</strong></p>
            <p>
              <Link to={`/profile/${selected.userId}`}>View full profile</Link>
            </p>
            {selected.applicantPicture && (
              <img src={selected.applicantPicture} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <p><strong>Region:</strong> {selected.region}</p>
            <p><strong>Categories:</strong> {selected.categories?.join(', ')}</p>
            <p><strong>Experience:</strong> {selected.experience}</p>
            <p><strong>Qualifications:</strong> {selected.qualifications}</p>
            {(selected.widgetAnswers?.length || Object.keys(selected.proofPerCategory || {}).length > 0) && (
              <div style={{ marginTop: 16 }}>
                <h3>Compatibility proofs</h3>
                {(selected.widgetAnswers?.length
                  ? selected.widgetAnswers
                  : Object.entries(selected.proofPerCategory || {}).map(([categoryId, p]) => ({
                      categoryId,
                      whyGood: p.whyGood || p.description || '',
                      proofType: p.proofType,
                      instagramHandle: p.instagramHandle,
                      imageUrls: p.imageUrls,
                      videoUrl: p.videoUrl,
                    }))
                ).map((a) => (
                  <div key={a.categoryId} style={{ marginBottom: 12, padding: 10, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }}>
                    <strong>{a.categoryId}</strong>
                    <p>{a.whyGood}</p>
                    {a.instagramHandle && <p>Instagram: @{a.instagramHandle}</p>}
                    {a.imageUrls?.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', marginRight: 6 }} />
                      </a>
                    ))}
                    {a.videoUrl && <video src={a.videoUrl} controls style={{ width: '100%', maxHeight: 180 }} />}
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'block', marginTop: 16 }}>
              Qualification star rating (1–5)
              <input
                type="number"
                min={1}
                max={5}
                step={0.5}
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                style={{ marginLeft: 8, width: 80 }}
              />
            </label>
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button type="button" disabled={deciding} onClick={approve}>Approve coach</button>
              <button type="button" disabled={deciding} onClick={reject}>Reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCoachReview;
