import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { textingHelpAPI, TEXTING_HELP_PRICE_EUR, type TextingHelpIncoming } from '../api/textingHelp';
import { formatAxiosError } from '../lib/apiError';
import { notifyDevice } from '../lib/deviceNotify';
import './TextingHelpWheel.css';

export default function TextingHelpSosPopup() {
  const { user } = useContext(AuthContext);
  const [queue, setQueue] = useState<TextingHelpIncoming[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { incoming } = await textingHelpAPI.incoming();
      const fresh = incoming.filter((i) => !seen.current.has(i.sessionId));
      if (fresh.length) {
        fresh.forEach((i) => seen.current.add(i.sessionId));
        setQueue((prev) => {
          const have = new Set(prev.map((p) => p.sessionId));
          return [...prev, ...fresh.filter((i) => !have.has(i.sessionId))];
        });
        notifyDevice(
          'Texting SOS — extra cash',
          `${fresh[0].fromName} needs help texting someone. Answer first to land on their wheel.`,
          'safety'
        );
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    poll();
    const t = window.setInterval(poll, 7000);
    const onSos = (e: Event) => {
      const d = (e as CustomEvent).detail as TextingHelpIncoming | undefined;
      if (!d?.sessionId || seen.current.has(d.sessionId)) return;
      seen.current.add(d.sessionId);
      setQueue((prev) => [...prev, d]);
    };
    window.addEventListener('texting-help:sos', onSos);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('texting-help:sos', onSos);
    };
  }, [user?.id, poll]);

  const current = queue[0] || null;
  if (!current) return null;

  const drop = () => setQueue((prev) => prev.filter((p) => p.sessionId !== current.sessionId));

  const answer = async () => {
    setLoading(true);
    setError('');
    try {
      const { session } = await textingHelpAPI.answer(current.sessionId);
      drop();
      if (session.liveRoomUrl && session.chosenGuideUserId === user?.id) {
        window.open(session.liveRoomUrl, '_blank', 'width=900,height=700');
      }
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'Could not answer SOS'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="th-sos-overlay" role="dialog" aria-modal="true">
      <div className="th-sos-card">
        <p className="th-sos-badge">SOS · extra cash</p>
        <h2>{current.fromName} needs texting help</h2>
        <p>
          Someone paid €{TEXTING_HELP_PRICE_EUR} for live help texting their crush. Answer now to show up on their
          character wheel. If they pick you, extra cash hits your guide wallet.
        </p>
        {error && <p className="th-error">{error}</p>}
        <button type="button" className="th-primary" onClick={answer} disabled={loading}>
          {loading ? 'Answering…' : 'I can help — answer SOS'}
        </button>
        <button type="button" className="th-ghost" onClick={drop}>
          Not now
        </button>
      </div>
    </div>
  );
}
