import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, NearbyUser } from '../api/connections';
import {
  markProximityBannerShown,
  setConnectionsStartView,
  shouldShowProximityBanner,
  NEARBY_CHECK_NOW_EVENT,
  markNearbyPopupVisible,
} from '../lib/proximitySession';
import { nearbyPeopleRadiusMeters, readStoredCoords, resolveWorkingCoords } from '../lib/locationSession';
import { formatAxiosError } from '../lib/apiError';
import { openChatWithUser } from '../lib/openChat';
import { notifyDevice } from '../lib/deviceNotify';
import SeeTranslation from './SeeTranslation';
import { isRtlLanguage } from '../i18n/countryLanguage';
import { fillInterest } from '../i18n/interestCopy';
import { ensureInterestLocale, useInterestLocale } from '../i18n/useInterestLocale';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenConnections?: () => void;
};

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
  locateByIp: () => connectionsAPI.locateByIp(),
};

/** Proactive popup when someone matching your orientation is within ~50 m. */
export default function NearbyMatchPopup({ onOpenConnections }: Props) {
  const { user } = useContext(AuthContext);
  const { lang, copy } = useInterestLocale(user?.country);
  const [queue, setQueue] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emptyHint, setEmptyHint] = useState('');
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const lastGpsAt = useRef(0);
  const queueLenRef = useRef(0);
  queueLenRef.current = queue.length;

  const poll = useCallback(async (opts?: { force?: boolean }) => {
    if (!user?.id) return;
    const { copy: placeCopy } = await ensureInterestLocale(user?.country);
    const cached = readStoredCoords();
    const refreshGps = !cached || cached.source !== 'gps' || Date.now() - lastGpsAt.current > 45_000;
    const coords = await resolveWorkingCoords(
      { userId: user.id, allowIp: true, refreshGps },
      locationApi
    );
    if (coords?.source === 'gps') lastGpsAt.current = Date.now();
    if (!coords) {
      if (opts?.force) setEmptyHint(placeCopy.emptyLocation);
      return;
    }
    try {
      const [{ users }, buzzes] = await Promise.all([
        connectionsAPI.getNearby({
          lat: coords.lat,
          lon: coords.lon,
          radius: nearbyPeopleRadiusMeters(coords),
          accuracy: coords.accuracy,
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
      if (!fresh.length) {
        if (opts?.force && queue.length === 0) {
          setEmptyHint(users.length ? placeCopy.emptyAlready : placeCopy.emptyNobody);
        }
        return;
      }
      setEmptyHint('');
      fresh.forEach((u) => queuedIdsRef.current.add(u.id));
      setQueue((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const add = fresh.filter((u) => !have.has(u.id) && !blockedIds.has(u.id));
        return add.length ? [...prev, ...add] : prev;
      });
      markNearbyPopupVisible();
      notifyDevice(
        placeCopy.notifyNearbyTitle,
        fresh.length > 1
          ? fillInterest(placeCopy.notifyNearbyMany, { n: fresh.length })
          : placeCopy.notifyNearbyOne,
        'interest'
      );
    } catch {
      if (opts?.force) setEmptyHint(placeCopy.emptyFail);
    }
  }, [user?.id, user?.city, user?.country, queue.length]);

  useEffect(() => {
    if (!user?.id) return;
    poll();
    const t = window.setInterval(() => poll(), 5000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    const onForce = () => {
      if (queueLenRef.current > 0) markNearbyPopupVisible();
      void poll({ force: true });
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(NEARBY_CHECK_NOW_EVENT, onForce);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(NEARBY_CHECK_NOW_EVENT, onForce);
    };
  }, [user?.id, poll]);

  useEffect(() => {
    if (queue.length > 0) markNearbyPopupVisible();
  }, [queue.length]);

  // Drop anyone who already sent you interest (they show on the incoming-interest popup)
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
      { userId: user.id, allowIp: true },
      locationApi
    );
    if (!coords) {
      setError(copy.errLocation);
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
      if (chatId) {
        notifyDevice(copy.hookUp, copy.notifyMatch, 'matches');
        openChatWithUser(chatId);
      } else {
        notifyDevice(copy.hookUp, copy.notifyInterestSent, 'interest');
      }
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
    setEmptyHint('');
    onOpenConnections?.();
  };

  if (!match && emptyHint) {
    return (
      <div className="walk-popup-overlay" role="dialog" aria-modal="true">
        <div className="walk-popup-card" dir={isRtlLanguage(lang) ? 'rtl' : 'ltr'}>
          <p className="walk-popup-badge">{copy.nearbyBadge}</p>
          <h2>{copy.nearbyTitle}</h2>
          <p className="walk-popup-sub">{emptyHint}</p>
          <SeeTranslation texts={[emptyHint]} sourceLang={lang} labels={copy} />
          <div className="walk-popup-actions">
            <button type="button" className="walk-btn-secondary" onClick={() => setEmptyHint('')}>
              {copy.close}
            </button>
            <button type="button" className="walk-btn-primary" onClick={openList}>
              {copy.openList}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card" dir={isRtlLanguage(lang) ? 'rtl' : 'ltr'}>
        <p className="walk-popup-badge">{copy.nearbyBadge}</p>
        <h2>{copy.nearbyTitle}</h2>
        <p className="walk-popup-sub">{copy.nearbyBody}</p>
        {moreCount > 0 && (
          <p className="walk-popup-sub" style={{ color: '#00d4ff' }}>
            {fillInterest(copy.nearbyMore, { n: moreCount })}
          </p>
        )}
        <SeeTranslation
          texts={[
            copy.nearbyTitle,
            copy.nearbyBody,
            moreCount > 0 ? fillInterest(copy.nearbyMore, { n: moreCount }) : '',
          ]}
          sourceLang={lang}
          labels={copy}
        />
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
            {copy.openList}
          </button>
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => dropCurrent(true)}>
            {copy.later}
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={sendInterest}>
            {loading ? '…' : copy.showInterest}
          </button>
        </div>
      </div>
    </div>
  );
}
