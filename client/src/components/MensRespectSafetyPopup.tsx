import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { profileAPI } from '../api/profile';
import { MENS_RESPECT_SAFETY_TIPS } from '../data/mensRespectSafetyTips';
import {
  nextRespectTipIndex,
  recordRespectTipSeen,
  shouldShowRespectTip,
  taperMessageForUser,
} from '../lib/respectTipStorage';
import './MensDatingTipPopup.css';

function isMaleGender(gender?: string | null): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === 'male' || g === 'm' || g === 'man';
}

/** Men-only respect & safety education: shows a few times/month, then tapers. */
export default function MensRespectSafetyPopup() {
  const { user } = useContext(AuthContext);
  const [visible, setVisible] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  const evaluate = useCallback(async () => {
    if (!user?.id) return;
    setChecked(true);
    try {
      const profile = await profileAPI.getCurrentUser();
      if (!isMaleGender(profile.gender)) return;
      if (!shouldShowRespectTip(user.id)) return;
      const idx = nextRespectTipIndex(user.id, MENS_RESPECT_SAFETY_TIPS.length);
      setTipIndex(idx);
      setVisible(true);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || checked) return;
    // Stagger after other popups
    const timer = window.setTimeout(() => evaluate(), 18000);
    return () => clearTimeout(timer);
  }, [user?.id, checked, evaluate]);

  const dismiss = () => {
    if (user?.id) recordRespectTipSeen(user.id, tipIndex);
    setVisible(false);
  };

  if (!visible) return null;
  const tip = MENS_RESPECT_SAFETY_TIPS[tipIndex];
  if (!tip) return null;

  return (
    <div className="dating-tip-overlay" role="dialog" aria-modal="true" aria-labelledby="respect-tip-title">
      <div className="dating-tip-card respect-tip-card">
        <div className="dating-tip-header">
          <span className="dating-tip-label">Respect tip · public safety</span>
          <button type="button" className="dating-tip-close" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dating-tip-helper">
          {taperMessageForUser(user?.id || '')} Think: would your favorite teacher, mother, sister, or cousin want this done to them?
        </p>
        <h2 id="respect-tip-title" className="dating-tip-title">
          {tip.title}
        </h2>
        <p className="dating-tip-summary">{tip.avoid}</p>
        <div className="dating-tip-columns">
          <div className="dating-tip-col dating-tip-cons">
            <span className="dating-tip-col-label">The harm it causes</span>
            <p>{tip.impact}</p>
          </div>
          <div className="dating-tip-col dating-tip-pros">
            <span className="dating-tip-col-label">Do this instead</span>
            <p>{tip.doInstead}</p>
          </div>
        </div>
        <button type="button" className="dating-tip-gotit" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}

