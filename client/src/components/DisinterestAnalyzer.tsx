import './DisinterestAnalyzer.css';
import type { DisinterestReport } from '../api/disinterest';

type Props = {
  report: DisinterestReport;
  partnerName: string;
  onClose: () => void;
};

export default function DisinterestAnalyzer({ report, partnerName, onClose }: Props) {
  const score = Math.max(0, Math.min(100, report.score));
  const circumference = 2 * Math.PI * 54;
  const dash = (score / 100) * circumference;

  return (
    <div className="di-overlay" role="dialog" aria-modal="true" aria-labelledby="di-title">
      <div className="di-panel">
        <button type="button" className="di-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="di-status-row">
          <span className="di-dot di-dot-blue" /> AI Analyzer Active
          <span className="di-dot di-dot-green" /> Monitoring Steady State
        </div>
        <div className="di-stream-head">
          <span>Communication stream</span>
          <span aria-hidden>⏸</span>
        </div>
        <h2 id="di-title" className="di-sr-only">
          Watch out — disinterest patterns with {partnerName}
        </h2>

        <div className="di-gauge-wrap">
          <svg className="di-gauge" viewBox="0 0 140 140" aria-hidden>
            <circle cx="70" cy="70" r="54" className="di-gauge-track" />
            <circle
              cx="70"
              cy="70"
              r="54"
              className="di-gauge-fill"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="di-gauge-label">
            <div className="di-gauge-metric">Disinterest</div>
            <div className="di-gauge-pct">{score}%</div>
            <div className="di-gauge-status">{report.statusLabel}</div>
          </div>
        </div>

        <div className={`di-warn-box ${report.warningSent ? 'sent' : ''}`}>
          <span className="di-warn-icon">🛡</span>
          <div>
            <strong>{report.warningSent ? 'WATCH OUT SENT' : 'NO WARN ACTIONS SENT'}</strong>
            <p>
              {report.score >= report.threshold
                ? 'This is not a red flag. It is a heads-up: slow down, watch the pattern, and gather your own evidence before you decide anything.'
                : `Real-time trigger bound to score levels over ${report.threshold}%.`}
            </p>
          </div>
        </div>

        <div className="di-meta">
          <div>
            <span>Channel Mode</span>
            <strong>{report.channelMode}</strong>
          </div>
          <div>
            <span>Risk Index</span>
            <strong>{report.riskIndex.toFixed(2)}</strong>
          </div>
          <div>
            <span>A11y System</span>
            <strong>Active</strong>
          </div>
        </div>

        <p className="di-advice">
          Do not rush into decisions or accusations. Take time. Keep talking if you want to. Collect what you actually see
          in this chat — then you can decide what it means for you.
        </p>

        <div className="di-mod-label">Detection modality channel</div>
        <div className="di-pills">
          <button type="button" className="di-pill on">
            Texts Logs
          </button>
          <button type="button" className="di-pill" disabled>
            Voice Calls
          </button>
          <button type="button" className="di-pill" disabled>
            Video Calls
          </button>
        </div>

        <div className="di-mod-label">Detected signs</div>
        <div className="di-pills">
          {report.signs.length ? (
            report.signs.slice(0, 6).map((s) => (
              <span key={s.id} className="di-pill sign" title={s.detail}>
                {s.label}
              </span>
            ))
          ) : (
            <span className="di-pill">Not enough pattern yet</span>
          )}
        </div>

        <label className="di-slider-label">
          Disinterest coefficient
          <input type="range" min={0} max={100} value={score} readOnly disabled />
          <span>{score}%</span>
        </label>

        {report.signs[0] && <p className="di-sign-detail">{report.signs[0].detail}</p>}
      </div>
    </div>
  );
}
