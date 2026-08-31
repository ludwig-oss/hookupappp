import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { markProximityBannerShown, setConnectionsStartView, shouldShowProximityBanner } from '../lib/proximitySession';
import { formatAxiosError } from '../lib/apiError';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenConnections?: () => void;
};

export default function ConnectionsBuzzPopup({ onOpenConnections }: Props) {
  const { user } = useContext(AuthContext);
  const [queue, setQueue] = useState<Buzz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queuedIdsRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { received } = await connectionsAPI.getMyBuzzes(user.id);
      const pending = received.filter(
        (b) => b.status === 'pending' && shouldShowProximityBanner('buzz-incoming', b.fromUserId)
      );
      const fresh = pending.filter((b) => !queuedIdsRef.current.has(b.id));
      if (!fresh.length) return;
      fresh.forEach((b) => queuedIdsRef.current.add(b.id));
      setQueue((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const add = fresh.filter((b) => !have.has(b.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Hook Up — nearby interest', {
            body: fresh.length > 1
              ? `${fresh.length} people want to connect.`
              : 'Someone wants to connect. Accept or decline.',
          });
        } catch {
          /* ignore */
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

  const incoming = queue[0] || null;
  const moreCount = Math.max(0, queue.length - 1);

  const dropCurrent = (permanent: boolean) => {
    if (!incoming) return;
    if (permanent) markProximityBannerShown('buzz-incoming', incoming.fromUserId);
    setQueue((prev) => prev.filter((b) => b.id !== incoming.id));
    setError('');
  };

  const respond = async (response: 'accepted' | 'rejected' | 'talk_later') => {
    if (!incoming) return;
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.respondBuzz({ buzzId: incoming.id, response });
      dropCurrent(true);
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
        {moreCount > 0 && (
          <p className="walk-popup-sub" style={{ color: '#00d4ff' }}>
            {moreCount} more waiting — Open list to see everyone.
          </p>
        )}
        <div className="walk-popup-avatar" style={{ overflow: 'hidden', padding: 0, border: '3px solid rgba(255, 0, 255, 0.6)' }}>
          {incoming.fromUserProfilePicture ? (
            <img src={incoming.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 48 }}>?</span>
          )}
        </div>
        {error && <p className="walk-popup-error">{error}</p>}
        <div className="walk-popup-actions">
          <button
            type="button"
            className="walk-btn-secondary"
            disabled={loading}
            onClick={() => {
              setQueue([]);
              setConnectionsStartView('buzzes');
              onOpenConnections?.();
            }}
          >
            Open list
          </button>
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => respond('rejected')}>
            Decline
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={() => respond('accepted')}>
            {loading ? '…' : 'Accept — talk'}
          </button>
        </div>
      </div>
    </div>
  );
}
