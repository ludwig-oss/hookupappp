import { useEffect, useState } from 'react';
import { reviewsAPI } from '../api/reviews';
import './ExperienceReviewModal.css';

interface ExperienceReviewModalProps {
  open: boolean;
  partnerUserId: string;
  partnerName: string;
  source: 'unmatch' | 'manual';
  onClose: () => void;
  onComplete: () => void;
}

const ExperienceReviewModal = ({
  open,
  partnerUserId,
  partnerName,
  source,
  onClose,
  onComplete,
}: ExperienceReviewModalProps) => {
  const [overallStars, setOverallStars] = useState(3);
  const [reviewText, setReviewText] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState('');
  const [seriousPreview, setSeriousPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'review' | 'court'>('review');
  const [courtReviewId, setCourtReviewId] = useState<string | null>(null);
  const [courtSummary, setCourtSummary] = useState('');
  const [courtNote, setCourtNote] = useState('');
  const [courtConfirm, setCourtConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOverallStars(3);
    setReviewText('');
    setDisclaimerAccepted(false);
    setError('');
    setSeriousPreview(false);
    setStep('review');
    setCourtReviewId(null);
    setCourtSummary('');
    setCourtNote('');
    setCourtConfirm(false);
    reviewsAPI.getPolicy().then((r) => setDisclaimerText(r.disclaimer)).catch(() => {});
  }, [open, partnerUserId]);

  useEffect(() => {
    if (!reviewText.trim()) {
      setSeriousPreview(false);
      return;
    }
    const t = reviewText.toLowerCase();
    const heavy =
      /\b(rape|assault|abuse|stole|fraud|drugged|stalk|threat|violent|criminal|hit me)\b/i.test(t);
    setSeriousPreview(heavy);
  }, [reviewText]);

  if (!open) return null;

  const handleCourtSubmit = async () => {
    if (!courtReviewId || !courtSummary.trim() || !courtConfirm) {
      setError('Provide a court outcome summary and confirm it is official.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await reviewsAPI.submitCourtEvidence(courtReviewId, {
        summary: courtSummary.trim(),
        documentNote: courtNote.trim() || undefined,
        confirmOfficial: true,
      });
      onComplete();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to submit evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!disclaimerAccepted) {
      setError('You must accept the review policy.');
      return;
    }
    if (!reviewText.trim()) {
      setError('Please write about your experience.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await reviewsAPI.submitReview({
        toUserId: partnerUserId,
        overallStars,
        reviewText: reviewText.trim(),
        disclaimerAccepted: true,
        source,
      });
      if (res.seriousClaimNotice && res.review?.id) {
        setCourtReviewId(res.review.id);
        setStep('court');
        return;
      }
      onComplete();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'court' && courtReviewId) {
    return (
      <div className="exp-review-overlay" onClick={onComplete}>
        <div className="exp-review-modal" onClick={(e) => e.stopPropagation()}>
          <h2>Official court evidence (optional)</h2>
          <p className="exp-review-sub">
            Your review is marked <strong>pending — innocent until proven guilty</strong>. If you pursued legal
            action and have an official court outcome, you may submit it now. It will be pinned below your comment as
            proven.
          </p>
          <label className="exp-review-label">Court outcome summary</label>
          <textarea
            className="exp-review-textarea"
            rows={3}
            value={courtSummary}
            onChange={(e) => setCourtSummary(e.target.value)}
            placeholder="e.g. Case #… — conviction / acquittal / restraining order…"
          />
          <label className="exp-review-label">Document reference (optional)</label>
          <input
            className="exp-review-textarea"
            style={{ marginBottom: 12 }}
            value={courtNote}
            onChange={(e) => setCourtNote(e.target.value)}
            placeholder="Docket number, court name, date…"
          />
          <label className="exp-review-check">
            <input type="checkbox" checked={courtConfirm} onChange={(e) => setCourtConfirm(e.target.checked)} />
            I confirm this is official court documentation or a verified legal outcome
          </label>
          {error && <div className="exp-review-error">{error}</div>}
          <div className="exp-review-actions">
            <button type="button" className="exp-review-skip" onClick={onComplete} disabled={submitting}>
              Skip for now
            </button>
            <button type="button" className="exp-review-submit" onClick={handleCourtSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Submit evidence'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exp-review-overlay" onClick={onClose}>
      <div className="exp-review-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Rate your experience with {partnerName}</h2>
        <p className="exp-review-sub">
          {source === 'unmatch'
            ? 'Before you unmatch, share an honest review. It stays on their profile — you cannot delete it later, but they may reply once.'
            : 'Share an honest review. It stays on their profile — you cannot delete it later, but they may reply once.'}
        </p>

        <div className="exp-review-stars-row">
          <span className="exp-review-stars-label">Overall rating</span>
          <div className="exp-review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`exp-review-star ${n <= overallStars ? 'active' : ''}`}
                onClick={() => setOverallStars(n)}
                aria-label={`${n} stars`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="exp-review-label">Your comment</label>
        <textarea
          className="exp-review-textarea"
          rows={4}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="How was your experience? Be honest and respectful."
        />

        {seriousPreview && (
          <div className="exp-review-serious-warn">
            <strong>Serious allegation detected</strong>
            <p>
              This will be highlighted as <em>innocent until proven guilty</em>. The person may reply, but
              cannot delete your comment. You are encouraged to pursue legal action if appropriate. After a
              court outcome, you may submit official evidence to mark the claim as proven.
            </p>
          </div>
        )}

        <div className="exp-review-disclaimer-box">
          <p>{disclaimerText || 'False or malicious reviews can lead to ban or suspension.'}</p>
          <label className="exp-review-check">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
            />
            I understand and accept this policy
          </label>
        </div>

        {error && <div className="exp-review-error">{error}</div>}

        <div className="exp-review-actions">
          <button type="button" className="exp-review-skip" onClick={onClose} disabled={submitting}>
            {source === 'unmatch' ? 'Unmatch without review' : 'Cancel'}
          </button>
          <button type="button" className="exp-review-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : source === 'unmatch' ? 'Submit & unmatch' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExperienceReviewModal;
