import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { notifyDevice } from '../lib/deviceNotify';
import SeeTranslation from './SeeTranslation';
import { isRtlLanguage } from '../i18n/countryLanguage';
import { ensureInterestLocale, useInterestLocale } from '../i18n/useInterestLocale';
import './WalkingPartnerPopup.css';

const SEEN_KEY = 'hookup:buzz-outcome-seen';

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* ignore */
  }
}

/** Sender sees accept / decline after the other person responds. */
export default function BuzzResultPopup() {
  const { user } = useContext(AuthContext);
  const { lang, copy } = useInterestLocale(user?.country);
  const [outcome, setOutcome] = useState<Buzz | null>(null);
  const seenRef = useRef<Set<string>>(readSeen());

  const poll = useCallback(async () => {
    if (!user?.id) return;
    const { copy: placeCopy } = await ensureInterestLocale(user?.country);
    try {
      const { sent } = await connectionsAPI.getMyBuzzes(user.id);
      const now = Date.now();
      for (const b of sent) {
        if (b.status === 'pending') continue;
        const t = new Date(b.respondedAt || b.createdAt).getTime();
        if (!Number.isFinite(t) || now - t > 30 * 60 * 1000) {
          seenRef.current.add(b.id);
        }
      }
      writeSeen(seenRef.current);
      const next = sent.find(
        (b) =>
          (b.status === 'accepted' || b.status === 'rejected' || b.status === 'talk_later') &&
          !seenRef.current.has(b.id)
      );
      if (next) {
        seenRef.current.add(next.id);
        writeSeen(seenRef.current);
        setOutcome(next);
        notifyDevice(
          placeCopy.hookUp,
          next.status === 'rejected' ? placeCopy.notifyDeclined : placeCopy.notifyAccepted,
          next.status === 'rejected' ? 'interest' : 'matches'
        );
      }
    } catch {
      /* offline */
    }
  }, [user?.id, user?.country]);

  useEffect(() => {
    if (!user?.id) return;
    poll();
    const t = window.setInterval(poll, 7000);
    return () => window.clearInterval(t);
  }, [user?.id, poll]);

  if (!outcome) return null;

  const accepted = outcome.status === 'accepted' || outcome.status === 'talk_later';

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card" dir={isRtlLanguage(lang) ? 'rtl' : 'ltr'}>
        <p className="walk-popup-badge">{accepted ? copy.badgeAccepted : copy.badgeDeclined}</p>
        <h2>{accepted ? copy.titleAccepted : copy.titleDeclined}</h2>
        <p className="walk-popup-sub">{accepted ? copy.bodyAccepted : copy.bodyDeclined}</p>
        <SeeTranslation
          texts={[accepted ? copy.titleAccepted : copy.titleDeclined, accepted ? copy.bodyAccepted : copy.bodyDeclined]}
          sourceLang={lang}
          labels={copy}
        />
        <div className="walk-popup-actions">
          <button type="button" className="walk-btn-secondary" onClick={() => setOutcome(null)}>
            {copy.ok}
          </button>
          {accepted && (
            <button
              type="button"
              className="walk-btn-primary"
              onClick={() => {
                openChatWithUser(outcome.toUserId);
                setOutcome(null);
              }}
            >
              {copy.openChat}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
