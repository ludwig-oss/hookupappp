import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { notifyDevice } from '../lib/deviceNotify';
import './WalkingPartnerPopup.css';

const SEEN_KEY = 'hookup:buzz-outcome-seen';

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/** Sender sees accept / decline after the other person responds. */
export default function BuzzResultPopup() {
  const { user } = useContext(AuthContext);
  const [outcome, setOutcome] = useState<Buzz | null>(null);
  const seenRef = useRef<Set<string>>(readSeen());

  const poll = useCallback(async () => {
    if (!user?.id) return;
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
          'Hook Up',
          next.status === 'rejected'
            ? 'They declined. They were not added to chat.'
            : 'They accepted — you can talk in Communications.'
        );
      }
    } catch {
      /* offline */
    }
  }, [user?.id]);

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
      <div className="walk-popup-card">
        <p className="walk-popup-badge">{accepted ? 'Accepted' : 'Declined'}</p>
        <h2>{accepted ? 'They accepted your request' : 'They declined your request'}</h2>
        <p className="walk-popup-sub">
          {accepted
            ? 'You can talk in Communications now.'
            : 'They will not be added to Communications.'}
        </p>
        <div className="walk-popup-actions">
          <button type="button" className="walk-btn-secondary" onClick={() => setOutcome(null)}>
            OK
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
              Open chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
