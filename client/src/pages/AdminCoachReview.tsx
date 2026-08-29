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
            <p><strong>Region:</strong> {selected.region}</p>
            <p><strong>Categories:</strong> {selected.categories?.join(', ')}</p>
            <p><strong>Experience:</strong> {selected.experience}</p>
            <p><strong>Qualifications:</strong> {selected.qualifications}</p>
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
