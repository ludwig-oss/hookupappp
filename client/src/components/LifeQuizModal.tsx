import { useState } from 'react';
import { walkMatchAPI } from '../api/walkMatch';
import { formatAxiosError } from '../lib/apiError';
import './WalkingPartnerPopup.css';

type Props = {
  onClose: () => void;
  onComplete: () => void;
};

export default function LifeQuizModal({ onClose, onComplete }: Props) {
  const [lifeStage, setLifeStage] = useState('');
  const [financialSituation, setFinancialSituation] = useState('');
  const [datingGoals, setDatingGoals] = useState('');
  const [isFamous, setIsFamous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifeStage || !financialSituation || !datingGoals.trim()) {
      setError('Please answer all questions.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await walkMatchAPI.submitLifeQuiz({
        lifeStage,
        financialSituation,
        datingGoals: datingGoals.trim(),
        isFamousOrInfluencer: isFamous,
      });
      onComplete();
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not save quiz'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card walk-quiz-card">
        <h2>Quick life check-in</h2>
        <p className="walk-popup-sub">
          Men 20–30: help us match you with the right partners when you are out walking. Be honest — this improves suggestions.
        </p>
        {error && <div className="walk-popup-error">{error}</div>}
        <form onSubmit={handleSubmit} className="walk-quiz-form">
          <label>
            Where are you in life right now?
            <select value={lifeStage} onChange={(e) => setLifeStage(e.target.value)} required>
              <option value="">Select…</option>
              <option value="building">Still building my career & life</option>
              <option value="stable">Stable job, growing savings</option>
              <option value="established">Established / financially comfortable</option>
            </select>
          </label>
          <label>
            Financial situation
            <select value={financialSituation} onChange={(e) => setFinancialSituation(e.target.value)} required>
              <option value="">Select…</option>
              <option value="building">Paycheck to paycheck / saving up</option>
              <option value="comfortable">Comfortable & planning ahead</option>
              <option value="wealthy">Very comfortable / wealthy</option>
            </select>
          </label>
          <label>
            Dating & life goals (next 2 years)
            <textarea
              value={datingGoals}
              onChange={(e) => setDatingGoals(e.target.value)}
              placeholder="What are you looking for? How do you want to grow?"
              rows={3}
              required
            />
          </label>
          <label className="walk-quiz-check">
            <input type="checkbox" checked={isFamous} onChange={(e) => setIsFamous(e.target.checked)} />
            I am publicly known / influencer / notable figure
          </label>
          <div className="walk-popup-actions">
            <button type="button" className="walk-btn-secondary" onClick={onClose} disabled={loading}>
              Later
            </button>
            <button type="submit" className="walk-btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save & continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
