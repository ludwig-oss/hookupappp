import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import {
  DatingTipAudience,
  nextTipIndex,
  shouldShowDatingTip,
  writeDatingTipDismiss,
} from '../lib/datingTipStorage';
import './MensDatingTipPopup.css';

export interface DatingTipItem {
  id: string;
  title: string;
  summary: string;
  pros: string;
  cons: string;
}

type Props = {
  audience: DatingTipAudience;
  tips: DatingTipItem[];
  matchGender: (gender?: string | null) => boolean;
  /** Stagger vs other popups on dashboard */
  delayMs?: number;
  cardClassName?: string;
};

/** Periodic dating hint (~every 3–4 months), gender-targeted. */
export default function PeriodicDatingTipPopup({
  audience,
  tips,
  matchGender,
  delayMs = 10000,
  cardClassName = '',
}: Props) {
  const { user } = useContext(AuthContext);
  const [visible, setVisible] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  const evaluate = useCallback(async () => {
    if (!user?.id) return;
    setChecked(true);
    try {
      const profile = await profileAPI.getCurrentUser();
      if (!matchGender(profile.gender)) return;
      if (!shouldShowDatingTip(user.id, audience)) return;
      const idx = nextTipIndex(user.id, audience, tips.length);
      setTipIndex(idx);
      setVisible(true);
    } catch {
      /* profile offline */
    }
  }, [user?.id, audience, tips.length, matchGender]);

  useEffect(() => {
    if (!user?.id || checked) return;
    const timer = window.setTimeout(() => {
      evaluate();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [user?.id, checked, evaluate, delayMs]);

  const dismiss = () => {
    if (user?.id) {
      writeDatingTipDismiss(user.id, audience, tipIndex);
    }
    setVisible(false);
  };

  if (!visible) return null;

  const tip = tips[tipIndex];
  if (!tip) return null;

  return (
    <div className="dating-tip-overlay" role="dialog" aria-modal="true" aria-labelledby={`dating-tip-title-${audience}`}>
      <div className={`dating-tip-card ${cardClassName}`.trim()}>
        <div className="dating-tip-header">
          <span className="dating-tip-label">Dating tip</span>
          <button type="button" className="dating-tip-close" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dating-tip-helper">A quick hint to help you connect better</p>
        <h2 id={`dating-tip-title-${audience}`} className="dating-tip-title">
          {tip.title}
        </h2>
        <p className="dating-tip-summary">{tip.summary}</p>
        <div className="dating-tip-columns">
          <div className="dating-tip-col dating-tip-pros">
            <span className="dating-tip-col-label">If you do this</span>
            <p>{tip.pros}</p>
          </div>
          <div className="dating-tip-col dating-tip-cons">
            <span className="dating-tip-col-label">If you skip it</span>
            <p>{tip.cons}</p>
          </div>
        </div>
        <button type="button" className="dating-tip-gotit" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
