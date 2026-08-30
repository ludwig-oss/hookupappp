import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { markProximityBannerShown, shouldShowProximityBanner } from '../lib/proximitySession';
import { formatAxiosError } from '../lib/apiError';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenConnections?: () => void;
};

export default function ConnectionsBuzzPopup({ onOpenConnections }: Props) {
  const { user } = useContext(AuthContext);
  const [incoming, setIncoming] = useState<Buzz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const knownIdsRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);

  const poll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { received } = await connectionsAPI.getMyBuzzes(user.id);
      const pending = received.filter((b) => b.status === 'pending');
      if (!readyRef.current) {
        pending.forEach((b) => knownIdsRef.current.add(b.id));
        readyRef.current = true;
        return;
      }
      const fresh = pending.find(
        (b) => !knownIdsRef.current.has(b.id) && shouldShowProximityBanner('buzz-incoming', b.fromUserId)
      );
      pending.forEach((b) => knownIdsRef.current.add(b.id));
      if (fresh) {
        setIncoming(fresh);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Hook Up — nearby interest', {
              body: 'Someone matching your preferences is nearby. Tap to respond.',
            });
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* offline */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    poll();
    const t = window.setInterval(poll, 8000);
    return () => window.clearInterval(t);
  }, [user?.id, poll]);

  const closeIncoming = (fromUserId: string) => {
    markProximityBannerShown('buzz-incoming', fromUserId);
    setIncoming(null);
  };

  const respond = async (response: 'accepted' | 'rejected' | 'talk_later') => {
    if (!incoming) return;
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.respondBuzz({ buzzId: incoming.id, response });
      closeIncoming(incoming.fromUserId);
      if (response === 'accepted' || response === 'talk_later') {
        const chatId = (result as { chatUserId?: string }).chatUserId || incoming.fromUserId;
        if (chatId) openChatWithUser(chatId);
      }
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not respond'));
    } finally {
      setLoading(false);
    }
  };

  if (!incoming) return null;

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card">
        <p className="walk-popup-badge">Nearby · your type</p>
        <h2>Someone nearby is interested</h2>
        <p className="walk-popup-sub">Profile only — name hidden until you both match.</p>
        <div className="walk-popup-avatar" style={{ overflow: 'hidden', padding: 0, border: '3px solid rgba(255, 0, 255, 0.6)' }}>
          {incoming.fromUserProfilePicture ? (
            <img src={incoming.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 48 }}>?</span>
          )}
        </div>
        {error && <p className="walk-popup-error">{error}</p>}
        <div className="walk-popup-actions">
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => { closeIncoming(incoming.fromUserId); onOpenConnections?.(); }}>
            Later
          </button>
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => respond('rejected')}>
            No
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={() => respond('accepted')}>
            Yes — buzz back
          </button>
        </div>
      </div>
    </div>
  );
}
