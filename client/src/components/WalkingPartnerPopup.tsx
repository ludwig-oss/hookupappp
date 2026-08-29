import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { walkMatchAPI, WalkSuggestion, WalkIncomingInterest } from '../api/walkMatch';
import { markProximityBannerShown, shouldShowProximityBanner } from '../lib/proximitySession';
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
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastShownRef = useRef<string>('');

  const poll = useCallback(async () => {
    if (!user?.id || !coordsRef.current) return;
    const { lat, lon } = coordsRef.current;
    try {
      await walkMatchAPI.updateLocation(lat, lon);
      const inc = await walkMatchAPI.getIncoming();
      if (inc.incoming.length > 0) {
        const first = inc.incoming[0];
        if (shouldShowProximityBanner('walk-incoming', first.fromUserId)) {
          setIncoming(first);
          setSuggestion(null);
        }
        return;
      }
      setIncoming(null);

      const data = await walkMatchAPI.getSuggestions(lat, lon);
      if (data.needsLifeQuiz) {
        setShowQuiz(true);
        return;
      }
      const top = data.suggestions[0];
      if (!top || top.id === dismissedId) return;
      if (!shouldShowProximityBanner('walk-suggest', top.id)) return;
      await walkMatchAPI.recordImpression(top.id);
      setSuggestion(top);
      lastShownRef.current = top.id;
    } catch {
      /* silent when offline */
    }
  }, [user?.id, dismissedId]);

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

  const handleInterest = async (targetId: string) => {
    setLoading(true);
    setMessage('');
    try {
      await walkMatchAPI.recordClick(targetId);
      const res = await walkMatchAPI.sendInterest(targetId);
      if (res.mutual && res.chatUserId) {
        setMessage("It's a match! Opening chat…");
        setSuggestion(null);
        setIncoming(null);
        onOpenChat(res.chatUserId);
      } else {
        setMessage('Interest sent — if they say yes too, you can chat!');
        setSuggestion(null);
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Could not send interest');
    } finally {
      setLoading(false);
    }
  };

  const handleIncoming = async (accept: boolean) => {
    if (!incoming) return;
    setLoading(true);
    try {
      const res = await walkMatchAPI.respondInterest(incoming.id, accept);
      if (accept && res.mutual && res.chatUserId) {
        onOpenChat(res.chatUserId);
      }
      markProximityBannerShown('walk-incoming', incoming.fromUserId);
      setIncoming(null);
    } finally {
      setLoading(false);
    }
  };

  if (showQuiz) {
    return (
      <LifeQuizModal
        onClose={() => setShowQuiz(false)}
        onComplete={() => {
          setShowQuiz(false);
          updateUser({ lifeQuizCompleted: true });
          poll();
        }}
      />
    );
  }

  if (incoming) {
    return (
      <div className="walk-popup-overlay" role="dialog" aria-modal="true">
        <div className="walk-popup-card">
          <p className="walk-popup-badge">Someone is near</p>
          <h2>{incoming.fromUser?.name || 'A match'} is interested</h2>
          <p className="walk-popup-sub">You are both out — say yes to start chatting.</p>
          {incoming.fromUser?.profilePicture && (
            <img src={incoming.fromUser.profilePicture} alt="" className="walk-popup-avatar" />
          )}
          <div className="walk-popup-actions">
            <button
              type="button"
              className="walk-btn-secondary"
              disabled={loading}
              onClick={() => {
                markProximityBannerShown('walk-incoming', incoming.fromUserId);
                setIncoming(null);
              }}
            >
              Dismiss
            </button>
            <button type="button" className="walk-btn-primary" disabled={loading} onClick={() => handleIncoming(true)}>
              Yes — let&apos;s chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  return (
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
              {suggestion.distance}m away {suggestion.isOnline ? '· online now' : ''}
            </p>
          </div>
        </div>
        <p className="walk-popup-reason">{suggestion.matchReason}</p>
        {message && <p className="walk-popup-msg">{message}</p>}
        <div className="walk-popup-actions">
          <button
            type="button"
            className="walk-btn-secondary"
            disabled={loading}
            onClick={() => {
              markProximityBannerShown('walk-suggest', suggestion.id);
              setDismissedId(suggestion.id);
              setSuggestion(null);
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="walk-btn-primary"
            disabled={loading}
            onClick={() => handleInterest(suggestion.id)}
          >
            {loading ? '…' : "I'm interested"}
          </button>
        </div>
      </div>
    </div>
  );
}
