import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { connectionsAPI, Buzz } from '../api/connections';
import { openChatWithUser } from '../lib/openChat';
import { markProximityBannerShown, setConnectionsStartView, shouldShowProximityBanner } from '../lib/proximitySession';
import { formatAxiosError } from '../lib/apiError';
import { notifyDevice } from '../lib/deviceNotify';
import SeeTranslation from './SeeTranslation';
import { isRtlLanguage } from '../i18n/countryLanguage';
import { fillInterest } from '../i18n/interestCopy';
import { ensureInterestLocale, useInterestLocale } from '../i18n/useInterestLocale';
import './WalkingPartnerPopup.css';

type Props = {
  onOpenConnections?: () => void;
};

export default function ConnectionsBuzzPopup({ onOpenConnections }: Props) {
  const { user } = useContext(AuthContext);
  const { lang, copy } = useInterestLocale(user?.country);
  const [queue, setQueue] = useState<Buzz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queuedIdsRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!user?.id) return;
    const { copy: placeCopy } = await ensureInterestLocale(user?.country);
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
        placeCopy.notifyInterestTitle,
        fresh.length > 1
          ? fillInterest(placeCopy.notifyInterestMany, { n: fresh.length })
          : placeCopy.notifyInterestOne,
        'interest'
      );
      fresh.forEach((b) => {
        markProximityBannerShown('nearby-match', b.fromUserId);
      });
    } catch {
      /* offline */
    }
  }, [user?.id, user?.country]);

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

  const accept = async () => {
    if (!incoming || !user?.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.respondBuzz({ buzzId: incoming.id, response: 'accepted' });
      dropCurrent(true);
      const chatId = result.chatUserId || incoming.fromUserId;
      if (chatId) openChatWithUser(chatId);
    } catch (err: unknown) {
      setError(formatAxiosError(err, copy.accept));
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
      setError(formatAxiosError(err, copy.notInterested));
    } finally {
      setLoading(false);
    }
  };

  if (!incoming) return null;

  return (
    <div className="walk-popup-overlay" role="dialog" aria-modal="true">
      <div className="walk-popup-card" dir={isRtlLanguage(lang) ? 'rtl' : 'ltr'}>
        <p className="walk-popup-badge">{copy.badgeNearby}</p>
        <h2>{copy.titleShowedInterest}</h2>
        <p className="walk-popup-sub">{copy.bodyShowedInterest}</p>
        {moreCount > 0 && (
          <p className="walk-popup-sub" style={{ color: '#00d4ff' }}>
            {fillInterest(copy.moreWaiting, { n: moreCount })}
          </p>
        )}
        <SeeTranslation
          texts={[
            copy.titleShowedInterest,
            copy.bodyShowedInterest,
            moreCount > 0 ? fillInterest(copy.moreWaiting, { n: moreCount }) : '',
          ]}
          sourceLang={lang}
          labels={copy}
        />
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
            {copy.openList}
          </button>
          <button type="button" className="walk-btn-secondary" disabled={loading} onClick={decline}>
            {copy.notInterested}
          </button>
          <button type="button" className="walk-btn-primary" disabled={loading} onClick={accept}>
            {loading ? '…' : copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
