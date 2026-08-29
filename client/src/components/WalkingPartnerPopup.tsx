import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { walkMatchAPI, WalkSuggestion, WalkIncomingInterest } from '../api/walkMatch';
import { markProximityBannerShown, shouldShowProximityBanner } from '../lib/proximitySession';
import { formatAxiosError } from '../lib/apiError';
import LifeQuizModal from './LifeQuizModal';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenChat: (userId: string) => void;
};

export default function WalkingPartnerPopup({ onOpenChat }: Props) {
  const { user, updateUser } = useContext(AuthContext);
  const [suggestion, setSuggestion] = useState<WalkSuggestion | null>(null);
  const [incoming, setIncoming] = useState<WalkIncomingInterest | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nearbyDiscoverable, setNearbyDiscoverable] = useState(false);
  const [atHome, setAtHome] = useState(false);
  const [homeSet, setHomeSet] = useState(false);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const actedOnRef = useRef<Set<string>>(new Set());

  const hidePerson = useCallback((kind: 'walk-suggest' | 'walk-incoming', otherUserId: string) => {
    markProximityBannerShown(kind, otherUserId);
    actedOnRef.current.add(`${kind}:${otherUserId}`);
  }, []);

  const poll = useCallback(async () => {
    if (!user?.id || !coordsRef.current) return;
    const { lat, lon } = coordsRef.current;
    try {
      await walkMatchAPI.updateLocation(lat, lon);
      const inc = await walkMatchAPI.getIncoming();
      if (inc.incoming.length > 0) {
        const first = inc.incoming[0];
        const key = `walk-incoming:${first.fromUserId}`;
        if (!actedOnRef.current.has(key) && shouldShowProximityBanner('walk-incoming', first.fromUserId)) {
          setIncoming(first);
          setSuggestion(null);
        }
        return;
      }
      setIncoming(null);

      const data = await walkMatchAPI.getSuggestions(lat, lon);
      setNearbyDiscoverable(data.nearbyDiscoverable);
      setAtHome(data.atHome);
      setHomeSet(data.homeSet);
      if (data.nearbyDiscoverable !== user.nearbyDiscoverable) {
        updateUser({ nearbyDiscoverable: data.nearbyDiscoverable });
      }

      if (data.needsLifeQuiz) {
        setShowQuiz(true);
        return;
      }

      if (!data.nearbyDiscoverable || !data.atHome) {
        setSuggestion(null);
        return;
      }

      const top = data.suggestions[0];
      if (!top) {
        setSuggestion(null);
        return;
      }
      const key = `walk-suggest:${top.id}`;
      if (actedOnRef.current.has(key) || !shouldShowProximityBanner('walk-suggest', top.id)) {
        setSuggestion(null);
        return;
      }
      await walkMatchAPI.recordImpression(top.id);
      setSuggestion(top);
    } catch {
      /* silent when offline */
    }
  }, [user?.id, user?.nearbyDiscoverable, updateUser]);

  useEffect(() => {
    if (!user?.id || user.outdoorWalkEnabled === false) return;
    if (!navigator.geolocation) return;

    const onPos = (pos: GeolocationPosition) => {
      coordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      poll();
    };

    navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 15000 });
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 20000,
    });
    const interval = setInterval(poll, 45000);

    return () => {
      clearInterval(interval);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [user?.id, user?.outdoorWalkEnabled, poll]);

  const toggleNearby = async (next: boolean) => {
    if (!coordsRef.current) {
      setActionError('Turn on location to use nearby.');
      return;
    }
    const { lat, lon } = coordsRef.current;
    setLoading(true);
    setActionError(null);
    try {
      if (next && !homeSet) {
        await walkMatchAPI.updateSettings({ setHome: true, lat, lon });
        setHomeSet(true);
        updateUser({ homeLocation: { lat, lon } });
      }
      const res = await walkMatchAPI.updateSettings({ nearbyDiscoverable: next, lat, lon });
      const visible = res.user?.nearbyDiscoverable === true;
      setNearbyDiscoverable(visible);
      updateUser({ nearbyDiscoverable: visible, homeLocation: res.user?.homeLocation ?? user?.homeLocation });
      if (next && !visible) {
        setActionError('You can only go visible when you are at home.');
      } else {
        poll();
      }
    } catch (err: unknown) {
      setActionError(formatAxiosError(err, 'Could not update nearby visibility'));
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async (targetId: string) => {
    setLoading(true);
    setActionError(null);
    try {
      try {
        await walkMatchAPI.recordClick(targetId);
      } catch {
        /* non-blocking analytics */
      }
      const res = await walkMatchAPI.sendInterest(targetId);
      hidePerson('walk-suggest', targetId);
      setSuggestion(null);
      onOpenChat(res.chatUserId || targetId);
    } catch (err: unknown) {
      setActionError(formatAxiosError(err, 'Could not connect — try again'));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (targetId: string) => {
    setLoading(true);
    setActionError(null);
    try {
      await walkMatchAPI.dismiss(targetId);
      hidePerson('walk-suggest', targetId);
      setSuggestion(null);
    } catch (err: unknown) {
      setActionError(formatAxiosError(err, 'Could not dismiss'));
    } finally {
      setLoading(false);
    }
  };

  const handleIncoming = async (accept: boolean) => {
    if (!incoming) return;
    setLoading(true);
    setActionError(null);
    try {
      if (accept) {
        const res = await walkMatchAPI.respondInterest(incoming.id, true);
        hidePerson('walk-incoming', incoming.fromUserId);
        setIncoming(null);
        if (res.chatUserId) onOpenChat(res.chatUserId);
      } else {
        await walkMatchAPI.respondInterest(incoming.id, false);
        hidePerson('walk-incoming', incoming.fromUserId);
        setIncoming(null);
      }
    } catch (err: unknown) {
      setActionError(formatAxiosError(err, 'Could not respond'));
    } finally {
      setLoading(false);
    }
  };

  const nearbyToggleBar =
    user?.outdoorWalkEnabled !== false ? (
      <div className="walk-nearby-bar">
        <div>
          <strong>Available nearby</strong>
          <p className="walk-nearby-hint">
            {atHome
              ? nearbyDiscoverable
                ? 'You appear online at home only.'
                : 'Off — turn on when you are home.'
              : 'Away from home — visibility is off.'}
          </p>
        </div>
        <button
          type="button"
          className={`walk-nearby-switch${nearbyDiscoverable ? ' on' : ''}`}
          disabled={loading || !atHome}
          aria-pressed={nearbyDiscoverable}
          onClick={() => toggleNearby(!nearbyDiscoverable)}
        >
          {nearbyDiscoverable ? 'On' : 'Off'}
        </button>
      </div>
    ) : null;

  if (showQuiz) {
    return (
      <>
        {nearbyToggleBar}
        <LifeQuizModal
          onClose={() => setShowQuiz(false)}
          onComplete={() => {
            setShowQuiz(false);
            updateUser({ lifeQuizCompleted: true });
            poll();
          }}
        />
      </>
    );
  }

  if (incoming) {
    return (
      <>
        {nearbyToggleBar}
        <div className="walk-popup-overlay" role="dialog" aria-modal="true">
          <div className="walk-popup-card">
            <p className="walk-popup-badge">Someone is near</p>
            <h2>{incoming.fromUser?.name || 'A match'} is interested</h2>
            <p className="walk-popup-sub">They are home and open to connect — say yes to start chatting.</p>
            {incoming.fromUser?.profilePicture && (
              <img src={incoming.fromUser.profilePicture} alt="" className="walk-popup-avatar" />
            )}
            {actionError && <p className="walk-popup-error">{actionError}</p>}
            <div className="walk-popup-actions">
              <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => handleIncoming(false)}>
                Dismiss
              </button>
              <button type="button" className="walk-btn-primary" disabled={loading} onClick={() => handleIncoming(true)}>
                Yes — let&apos;s chat
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!suggestion) {
    return nearbyToggleBar;
  }

  return (
    <>
      {nearbyToggleBar}
      <div className="walk-popup-overlay" role="dialog" aria-modal="true">
        <div className="walk-popup-card">
          <p className="walk-popup-badge">Someone is near</p>
          <div className="walk-popup-profile">
            {suggestion.profilePicture ? (
              <img src={suggestion.profilePicture} alt="" className="walk-popup-avatar" />
            ) : (
              <div className="walk-popup-avatar walk-popup-avatar-placeholder">{suggestion.name[0]}</div>
            )}
            <div>
              <h2>
                {suggestion.name}
                {suggestion.age ? `, ${suggestion.age}` : ''}
              </h2>
              <p className="walk-popup-meta">
                {suggestion.distance}m away
                {suggestion.isOnline ? ' · at home now' : ''}
              </p>
            </div>
          </div>
          <p className="walk-popup-reason">{suggestion.matchReason}</p>
          {actionError && <p className="walk-popup-error">{actionError}</p>}
          <div className="walk-popup-actions">
            <button type="button" className="walk-btn-secondary" disabled={loading} onClick={() => handleDismiss(suggestion.id)}>
              Dismiss
            </button>
            <button type="button" className="walk-btn-primary" disabled={loading} onClick={() => handleInterest(suggestion.id)}>
              {loading ? '…' : "I'm interested"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
