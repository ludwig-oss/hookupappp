import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, NearbyUser } from '../api/connections';
import { markProximityBannerShown, setConnectionsStartView, shouldShowProximityBanner } from '../lib/proximitySession';
import { nearbyRadiusForCoords, resolveWorkingCoords } from '../lib/locationSession';
import { formatAxiosError } from '../lib/apiError';
import { openChatWithUser } from '../lib/openChat';
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
      const { users } = await connectionsAPI.getNearby({
        lat: coords.lat,
        lon: coords.lon,
        radius: nearbyRadiusForCoords(coords),
        userId: user.id,
      });
      const fresh = users.filter(
        (u) => !queuedIdsRef.current.has(u.id) && shouldShowProximityBanner('nearby-match', u.id)
      );
      if (!fresh.length) return;
      fresh.forEach((u) => queuedIdsRef.current.add(u.id));
      setQueue((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const add = fresh.filter((u) => !have.has(u.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Hook Up — nearby match', {
            body: fresh.length > 1
              ? `${fresh.length} people matching you are nearby.`
              : 'Someone matching your preferences is nearby. Tap to respond.',
          });
        } catch {
          /* ignore */
        }
      }
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
        <p className="walk-popup-sub">Profile only — name hidden until you both match.</p>
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
            {loading ? '…' : 'Send interest'}
          </button>
        </div>
      </div>
    </div>
  );
}
