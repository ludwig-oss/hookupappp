import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, NearbyUser } from '../api/connections';
import { markProximityBannerShown, setConnectionsStartView, shouldShowProximityBanner } from '../lib/proximitySession';
import { nearbyRadiusForCoords, resolveWorkingCoords } from '../lib/locationSession';
import { formatAxiosError } from '../lib/apiError';
import { openChatWithUser } from '../lib/openChat';
import { notifyDevice } from '../lib/deviceNotify';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenConnections?: () => void;
};

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
};

/** Proactive popup when someone matching your preferences is nearby (profile only). */
export default function NearbyMatchPopup({ onOpenConnections }: Props) {
  const { user } = useContext(AuthContext);
  const [queue, setQueue] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queuedIdsRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!user?.id) return;
    const coords = await resolveWorkingCoords(
      { userId: user.id, city: (user as { city?: string }).city, country: (user as { country?: string }).country },
      locationApi
    );
    if (!coords) return;
    try {
      const [{ users }, buzzes] = await Promise.all([
        connectionsAPI.getNearby({
          lat: coords.lat,
          lon: coords.lon,
          radius: nearbyRadiusForCoords(coords),
          userId: user.id,
        }),
        connectionsAPI.getMyBuzzes(user.id).catch(() => ({ received: [], sent: [] })),
      ]);
      const blockedIds = new Set<string>();
      for (const b of buzzes.received || []) {
        if (b.status === 'pending') blockedIds.add(b.fromUserId);
      }
      for (const b of buzzes.sent || []) {
        blockedIds.add(b.toUserId);
      }

      const fresh = users.filter(
        (u) =>
          !blockedIds.has(u.id) &&
          !queuedIdsRef.current.has(u.id) &&
          shouldShowProximityBanner('nearby-match', u.id)
      );
      if (!fresh.length) return;
      fresh.forEach((u) => queuedIdsRef.current.add(u.id));
      setQueue((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const add = fresh.filter((u) => !have.has(u.id) && !blockedIds.has(u.id));
        return add.length ? [...prev, ...add] : prev;
      });
      notifyDevice(
        'Hook Up — nearby',
        fresh.length > 1
          ? `${fresh.length} people matching you are nearby.`
          : 'Someone matching you is nearby. Tap Show interest if you want.',
        'interest'
      );
    } catch {
      /* offline */
    }
  }, [user?.id, user?.city, user?.country]);

  useEffect(() => {
    if (!user?.id) return;
    poll();
    const t = window.setInterval(poll, 12000);
    return () => window.clearInterval(t);
  }, [user?.id, poll]);

  // Drop anyone who already sent you interest (accept flow owns that person)
  useEffect(() => {
    if (!user?.id || queue.length === 0) return;
    let cancelled = false;
    connectionsAPI.getMyBuzzes(user.id).then(({ received }) => {
      if (cancelled) return;
      const pendingFrom = new Set(
        (received || []).filter((b) => b.status === 'pending').map((b) => b.fromUserId)
      );
      if (!pendingFrom.size) return;
      setQueue((prev) => {
        const next = prev.filter((u) => !pendingFrom.has(u.id));
        prev.forEach((u) => {
          if (pendingFrom.has(u.id)) queuedIdsRef.current.delete(u.id);
        });
        return next.length === prev.length ? prev : next;
      });
      pendingFrom.forEach((id) => markProximityBannerShown('nearby-match', id));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, queue.length]);

  const match = queue[0] || null;
  const moreCount = Math.max(0, queue.length - 1);

  const dropCurrent = (permanent: boolean) => {
    if (!match) return;
    if (permanent) markProximityBannerShown('nearby-match', match.id);
    setQueue((prev) => prev.filter((u) => u.id !== match.id));
    setError('');
  };

  const sendInterest = async () => {
    if (!match || !user?.id) return;
    const coords = await resolveWorkingCoords(
      { userId: user.id, city: (user as { city?: string }).city, country: (user as { country?: string }).country },
      locationApi
    );
    if (!coords) {
      setError('Add your city on Profile, or allow location — then try again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.sendBuzz({
        toUserId: match.id,
        location: { lat: coords.lat, lon: coords.lon },
        userId: user.id,
      });
      const chatId = result.chatUserId;
      dropCurrent(true);
      if (chatId) openChatWithUser(chatId);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not send interest'));
    } finally {
      setLoading(false);
    }
  };

  const openList = () => {
    setConnectionsStartView('nearby');
    setQueue([]);
    setError('');
    onOpenConnections?.();
  };

  if (!match) return null;

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card">
        <p className="walk-popup-badge">Nearby · your type</p>
        <h2>Someone matching you is nearby</h2>
        <p className="walk-popup-sub">Show interest once — they only need to accept. No need for them to send interest back.</p>
        {moreCount > 0 && (
          <p className="walk-popup-sub" style={{ color: '#00d4ff' }}>
            {moreCount} more nearby — Open list to see everyone.
          </p>
        )}
        <div
          className="walk-popup-avatar"
          style={{ overflow: 'hidden', padding: 0, border: '3px solid rgba(0, 212, 255, 0.6)' }}
        >
          {match.profilePicture ? (
            <img src={match.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 48 }}>?</span>
          )}
        </div>
        {error && <p className="walk-popup-error">{error}</p>}
        <div className="walk-popup-actions">
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={openList}>
            Open list
          </button>
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => dropCurrent(true)}>
            Later
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={sendInterest}>
            {loading ? '…' : 'Show interest'}
          </button>
        </div>
      </div>
    </div>
  );
}
