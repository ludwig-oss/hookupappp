import { useState } from 'react';
import { reportsAPI, ReportCategory } from '../../api/reports';
import './Widget.css';

interface ReportModalProps {
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
  onReported: () => void;
}

const ReportModal = ({ reportedUserId, reportedUserName, onClose, onReported }: ReportModalProps) => {
  const [category, setCategory] = useState<ReportCategory>('other');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const categories: { value: ReportCategory; label: string; description: string }[] = [
    { value: 'harassment', label: 'Harassment', description: 'Inappropriate or threatening behavior' },
    { value: 'fake', label: 'Fake Profile', description: 'This profile appears to be fake or impersonating someone' },
    { value: 'inappropriate', label: 'Inappropriate Content', description: 'Offensive or inappropriate photos/content' },
    { value: 'spam', label: 'Spam', description: 'Spam or promotional content' },
    { value: 'scam', label: 'Scam', description: 'Suspected scam or fraud' },
    { value: 'underage', label: 'Underage', description: 'User appears to be under 18' },
    { value: 'violence', label: 'Violence', description: 'Threats or violent behavior' },
    { value: 'other', label: 'Other', description: 'Other reason' },
  ];

  const handleSubmit = async () => {
    if (!category) {
      alert('Please select a category');
      return;
    }

    setLoading(true);
    try {
      await reportsAPI.createReport(reportedUserId, category, description);
      alert('Report submitted successfully. Thank you for helping keep our community safe.');
      onReported();
      onClose();
    } catch (err) {
      console.error('Failed to submit report', err);
      alert('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Report {reportedUserName}</h3>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
          Help us understand what's wrong. Your report will be reviewed by our team.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Reason</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.map(cat => (
              <label
                key={cat.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  border: `2px solid ${category === cat.value ? '#ff6b9d' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: category === cat.value ? '#fef2f2' : 'white',
                }}
              >
                <input
                  type="radio"
                  value={cat.value}
                  checked={category === cat.value}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  style={{ marginRight: '10px' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold' }}>{cat.label}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{cat.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Additional Details (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide more information about this report..."
            rows={4}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} className="select-user-btn" disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            onClick={onClose}
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
  );
};

export default ReportModal;



