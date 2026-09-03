import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  TEXTING_HELP_PRICE_EUR,
  textingHelpAPI,
  type TextingHelpGuideCard,
  type TextingHelpSession,
} from '../api/textingHelp';
import { formatAxiosError } from '../lib/apiError';
import './TextingHelpWheel.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');
const QUAD_COLORS = ['#7cb87c', '#7eb6d9', '#e29a62', '#c084fc'];

type Props = {
  otherUserId: string;
  partnerName: string;
  resumeSessionId?: string | null;
  onClose: () => void;
};

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="th-stars" aria-label={`${value} stars`}>
      {'★★★★★'.slice(0, Math.max(0, Math.min(5, full)))}
      <span className="th-stars-empty">{'★★★★★'.slice(Math.max(0, Math.min(5, full)))}</span>
    </span>
  );
}

function StripePay({ sessionId, onPaid }: { sessionId: string; onPaid: (s: TextingHelpSession) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (confirmError) throw new Error(confirmError.message);
      const piId = paymentIntent?.id;
      if (!piId) throw new Error('Payment incomplete');
      const { session } = await textingHelpAPI.confirmStripe(sessionId, piId);
      onPaid(session);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Card payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="th-stripe">
      <PaymentElement />
      {error && <p className="th-error">{error}</p>}
      <button type="button" className="th-primary" onClick={pay} disabled={loading || !stripe}>
        {loading ? 'Processing…' : `Pay €${TEXTING_HELP_PRICE_EUR} with card`}
      </button>
    </div>
  );
}

export default function TextingHelpWheel({ otherUserId, partnerName, resumeSessionId, onClose }: Props) {
  const [session, setSession] = useState<TextingHelpSession | null>(null);
  const [paypalOn, setPaypalOn] = useState(false);
  const [stripeOn, setStripeOn] = useState(false);
  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [guides, setGuides] = useState<TextingHelpGuideCard[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ startX: number; startRot: number } | null>(null);

  const loadGuides = async (sess: TextingHelpSession, nextOffset = 0) => {
    const page = await textingHelpAPI.listGuides(sess.id, nextOffset);
    setGuides(page.guides);
    setOffset(page.nextOffset);
    setTotal(page.total);
    setSession(sess);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (resumeSessionId) {
          const { session: s } = await textingHelpAPI.getSession(resumeSessionId);
          if (cancelled) return;
          setSession(s);
          setPaypalOn(true);
          setStripeOn(true);
          if (s.status !== 'pending_payment') await loadGuides(s, 0);
        } else {
          const started = await textingHelpAPI.start(otherUserId);
          if (cancelled) return;
          setSession(started.session);
          setPaypalOn(started.paypalConfigured);
          setStripeOn(started.stripeConfigured);
          if (started.session.status !== 'pending_payment') await loadGuides(started.session, 0);
          if (started.stripeConfigured) {
            textingHelpAPI.createStripe(started.session.id).then((r) => {
              if (r.clientSecret) setStripeSecret(r.clientSecret);
            }).catch(() => {});
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(formatAxiosError(e, 'Could not start texting help'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      shareRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [otherUserId, resumeSessionId]);

  useEffect(() => {
    const onAnswered = (e: Event) => {
      const d = (e as CustomEvent).detail as { sessionId?: string; guideUserId?: string } | undefined;
      if (!d?.guideUserId || d.sessionId !== session?.id) return;
      setGuides((prev) => prev.map((g) => ({ ...g, answeredSos: g.userId === d.guideUserId })));
      setSession((s) => (s ? { ...s, firstAnsweredGuideUserId: d.guideUserId! } : s));
    };
    window.addEventListener('texting-help:answered', onAnswered);
    return () => window.removeEventListener('texting-help:answered', onAnswered);
  }, [session?.id]);

  const quads = useMemo(() => {
    const slots: Array<TextingHelpGuideCard | null> = [null, null, null, null];
    guides.slice(0, 4).forEach((g, i) => {
      slots[i] = g;
    });
    return slots;
  }, [guides]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const extra = 360 * (3 + Math.floor(Math.random() * 4)) + Math.floor(Math.random() * 360);
    setRotation((r) => r + extra);
    window.setTimeout(() => setSpinning(false), 2800);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startRot: rotation };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    setRotation(dragRef.current.startRot + dx * 0.8);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const payPaypal = async () => {
    if (!session) return;
    setError('');
    try {
      const r = await textingHelpAPI.payPal(session.id);
      if (r.alreadyPaid && r.session) {
        await loadGuides(r.session, 0);
        return;
      }
      if (!r.approvalUrl) throw new Error('PayPal unavailable');
      window.location.href = r.approvalUrl;
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'PayPal failed'));
    }
  };

  const payDemo = async () => {
    if (!session) return;
    setError('');
    try {
      const { session: paid } = await textingHelpAPI.payDemo(session.id);
      await loadGuides(paid, 0);
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'Payment failed'));
    }
  };

  const swapGuides = async () => {
    if (!session) return;
    setError('');
    try {
      const next = total > 0 ? offset % total : 0;
      await loadGuides(session, next);
      spin();
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'Could not load more guides'));
    }
  };

  const choose = async (guide: TextingHelpGuideCard) => {
    if (!session) return;
    setError('');
    try {
      const { session: live } = await textingHelpAPI.choose(session.id, guide.userId);
      setSession(live);
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'Could not choose this guide'));
    }
  };

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      shareRef.current = stream;
      setSharing(true);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setSharing(false);
        shareRef.current = null;
      });
      if (session?.liveRoomUrl) window.open(session.liveRoomUrl, '_blank', 'width=900,height=700');
    } catch {
      if (session?.liveRoomUrl) window.open(session.liveRoomUrl, '_blank', 'width=900,height=700');
    }
  };

  const submitReview = async () => {
    if (!session) return;
    try {
      await textingHelpAPI.review(session.id, reviewStars, reviewText);
      onClose();
    } catch (e: unknown) {
      setError(formatAxiosError(e, 'Could not save review'));
    }
  };

  const chosen = guides.find((g) => g.userId === session?.chosenGuideUserId) || null;

  return (
    <div className="th-overlay" role="dialog" aria-modal="true">
      <div className="th-panel">
        <button type="button" className="th-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {loading && <p className="th-muted">Looking for guides near you…</p>}
        {error && <p className="th-error">{error}</p>}

        {session && session.status === 'pending_payment' && (
          <div className="th-pay">
            <h2>Need help texting {partnerName}?</h2>
            <p>
              Pay €{TEXTING_HELP_PRICE_EUR} to unlock live guides in your region. They get an SOS, the first to
              answer is highlighted, and you pick who joins you — including live screen share.
            </p>
            {paypalOn && (
              <button type="button" className="th-primary" onClick={payPaypal}>
                Pay €{TEXTING_HELP_PRICE_EUR} with PayPal
              </button>
            )}
            {stripeOn && stripeSecret && stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret: stripeSecret }}>
                <StripePay sessionId={session.id} onPaid={(s) => loadGuides(s, 0)} />
              </Elements>
            )}
            {!paypalOn && !stripeOn && (
              <button type="button" className="th-primary" onClick={payDemo}>
                Confirm €{TEXTING_HELP_PRICE_EUR} and see guides
              </button>
            )}
          </div>
        )}

        {session && session.status === 'paid' && (
          <div className="th-wheel-stage">
            <h2>Pick a texting guide</h2>
            <p className="th-muted">
              Online guides near you. Spin freely, or swap if you want a new four. Stars show how they have helped others.
            </p>
            <div
              className="th-wheel"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 2.6s cubic-bezier(0.12, 0.7, 0.2, 1)' : 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {quads.map((g, i) => (
                <button
                  key={g?.userId || i}
                  type="button"
                  className={`th-quad th-quad-${i} ${g?.answeredSos ? 'answered' : ''} ${g?.online ? 'online' : ''}`}
                  style={{ ['--quad' as string]: QUAD_COLORS[i] }}
                  disabled={!g}
                  onClick={() => g && choose(g)}
                >
                  <span className="th-quad-inner" style={{ transform: `rotate(${-rotation}deg)` }}>
                    {g ? (
                      <>
                        <span className="th-avatar">
                          {g.profilePicture ? <img src={g.profilePicture} alt="" /> : g.name[0]}
                        </span>
                        <span className="th-quad-name">{g.name.split(' ')[0]}</span>
                        <Stars value={g.rating} />
                        <span className="th-quad-meta">
                          {g.helpedCount} helped · {g.reviewCount} reviews
                        </span>
                        {g.answeredSos && <span className="th-answered">Answered SOS</span>}
                        {!g.online && <span className="th-offline">Away</span>}
                      </>
                    ) : (
                      <span className="th-empty">Waiting…</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {guides.length === 0 && !loading && (
              <p className="th-muted">No guides are available in your region right now. Try again in a moment or tap More guides.</p>
            )}
            <div className="th-wheel-actions">
              <button type="button" className="th-ghost" onClick={spin} disabled={spinning}>
                Spin
              </button>
              <button type="button" className="th-ghost" onClick={swapGuides}>
                {offset < total ? 'More guides' : 'Shuffle again'}
              </button>
            </div>
          </div>
        )}

        {session && session.status === 'live' && (
          <div className="th-live">
            <h2>Live texting help</h2>
            <p>
              {chosen?.name || 'Your guide'} is on this SOS. Share your screen so they can see the chat with {partnerName} and
              coach you in real time.
            </p>
            <button type="button" className="th-primary" onClick={shareScreen}>
              {sharing ? 'Screen sharing — join live room' : 'Share screen live'}
            </button>
            {session.liveRoomUrl && (
              <button type="button" className="th-ghost" onClick={() => window.open(session.liveRoomUrl!, '_blank')}>
                Open live room
              </button>
            )}
            <div className="th-review">
              <p>When you are done, rate how they helped:</p>
              <div className="th-star-pick">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n <= reviewStars ? 'on' : ''}
                    onClick={() => setReviewStars(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What helped you most?"
                rows={3}
              />
              <button type="button" className="th-primary" onClick={submitReview}>
                Leave stars &amp; close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
