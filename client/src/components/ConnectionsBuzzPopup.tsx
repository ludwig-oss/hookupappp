import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { markProximityBannerShown, setConnectionsStartView, shouldShowProximityBanner } from '../lib/proximitySession';
import { resolveWorkingCoords } from '../lib/locationSession';
import { formatAxiosError } from '../lib/apiError';
import { notifyDevice } from '../lib/deviceNotify';
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
      notifyDevice(
        'Hook Up — interest',
        fresh.length > 1
          ? `${fresh.length} people nearby showed interest. Show interest back only if you want to talk.`
          : 'Someone nearby showed interest. Show interest back to join Communications — otherwise you will not be added.',
        'interest'
      );
      fresh.forEach((b) => {
        markProximityBannerShown('nearby-match', b.fromUserId);
      });
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

  const sendInterestBack = async () => {
    if (!incoming || !user?.id) return;
    setLoading(true);
    setError('');
    try {
      const coords = await resolveWorkingCoords(
        {
          userId: user.id,
          city: (user as { city?: string }).city,
          country: (user as { country?: string }).country,
        },
        {
          getMyLocation: () => connectionsAPI.getMyLocation(),
          forwardGeocode: (q) => connectionsAPI.forwardGeocode(q),
          updateLocation: (data) => connectionsAPI.updateLocation(data),
        }
      );
      const result = await connectionsAPI.sendBuzz({
        toUserId: incoming.fromUserId,
        location: coords ? { lat: coords.lat, lon: coords.lon } : undefined,
        userId: user.id,
      });
      dropCurrent(true);
      if (result.chatUserId) {
        notifyDevice('Hook Up', "It's a match — they're in Communications.", 'matches');
        openChatWithUser(result.chatUserId);
      }
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not send interest'));
    } finally {
      setLoading(false);
    }
  };

  const decline = async () => {
    if (!incoming) return;
    setLoading(true);
    setError('');
    try {
      await connectionsAPI.respondBuzz({ buzzId: incoming.id, response: 'rejected' });
      dropCurrent(true);
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
        <p className="walk-popup-sub">
          Show interest back to join Communications. If you do not, you will not be added to chat.
        </p>
        {moreCount > 0 && (
          <p className="walk-popup-sub" style={{ color: '#00d4ff' }}>
            {moreCount} more waiting. The list shows 10 at a time — respond and the next fills in, or open the list to search / Next page.
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
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={decline}>
            Not interested
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={sendInterestBack}>
            {loading ? '…' : 'Show interest too'}
          </button>
        </div>
      </div>
    </div>
  );
}
