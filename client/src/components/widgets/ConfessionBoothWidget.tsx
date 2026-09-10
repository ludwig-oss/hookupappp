import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  confessionAPI,
  ConfessionSessionView,
  BlurredConfessionGuide,
  ConfessionAiGuide,
} from '../../api/confession';
import { formatAxiosError } from '../../lib/apiError';
import ConfessionMaskedCall from '../ConfessionMaskedCall';
import { AuthContext } from '../../context/AuthContext';
import './Widget.css';

type Step =
  | 'intro'
  | 'path'
  | 'ai_guides'
  | 'ai_book'
  | 'scope'
  | 'guides'
  | 'book'
  | 'waiting_accept'
  | 'pay'
  | 'waiting'
  | 'chat'
  | 'guide';
type GuideScope = 'local' | 'international';

function defaultAppointmentValue(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return d.toISOString().slice(0, 16);
}

function formatAppointment(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function stepForSession(session: ConfessionSessionView): Step {
  if (session.status === 'active') return 'chat';
  if (session.status === 'awaiting_payment') return 'pay';
  if (session.status === 'pending_appointment') return 'waiting_accept';
  if (session.status === 'pending_guide_nda' || session.status === 'seeking_guide') return 'waiting';
  return 'intro';
}

/** Deepened / veiled TTS so AI replies feel like the lattice — not a clear real voice. */
function speakVeiled(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = 0.55;
  utter.rate = 0.88;
  const voices = window.speechSynthesis.getVoices();
  const deep = voices.find((v) => /male|david|daniel|google uk english male/i.test(`${v.name} ${v.lang}`));
  if (deep) utter.voice = deep;
  window.speechSynthesis.speak(utter);
}

export default function ConfessionBoothWidget() {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState<Step>('intro');
  const [info, setInfo] = useState<Awaited<ReturnType<typeof confessionAPI.getInfo>> | null>(null);
  const [guideInfo, setGuideInfo] = useState<Awaited<ReturnType<typeof confessionAPI.getGuidePrefs>> | null>(null);
  const [session, setSession] = useState<ConfessionSessionView | null>(null);
  const [guideScope, setGuideScope] = useState<GuideScope | null>(null);
  const [guides, setGuides] = useState<BlurredConfessionGuide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<BlurredConfessionGuide | null>(null);
  const [aiGuides, setAiGuides] = useState<ConfessionAiGuide[]>([]);
  const [selectedAi, setSelectedAi] = useState<ConfessionAiGuide | null>(null);
  const [amountEur, setAmountEur] = useState<5 | 10>(5);
  const [appointmentAt, setAppointmentAt] = useState(defaultAppointmentValue());
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [guideNdaSignature, setGuideNdaSignature] = useState('');
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAiSpoke = useRef('');

  const accountLabel = (user?.name || user?.username || '').trim();
  const simulatorFree = !!info?.simulatorFree;

  const refreshSession = useCallback(async (sessionId: string) => {
    const { session: s } = await confessionAPI.getSession(sessionId);
    setSession(s);
    const next = stepForSession(s);
    setStep((prev) => (prev === 'guide' ? prev : next));
    return s;
  }, []);

  useEffect(() => {
    confessionAPI.getInfo().then((r) => {
      setInfo(r);
      setAiGuides(r.aiGuides || []);
    }).catch(() => {});
    confessionAPI.getGuidePrefs().then((g) => {
      setGuideInfo(g);
      setGuideEnabled(g.prefs.enabled);
    }).catch(() => {});
    confessionAPI.listSessions().then(({ sessions }) => {
      const open = sessions.find((s) =>
        ['pending_appointment', 'awaiting_payment', 'seeking_guide', 'pending_guide_nda', 'active'].includes(s.status)
      );
      if (open) {
        setSession(open);
        setStep(stepForSession(open));
      }
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const confession = params.get('confession');
    const sessionId = params.get('sessionId');
    const stripeCheckoutId = params.get('session_id');
    if (confession === 'success' && sessionId && stripeCheckoutId) {
      confessionAPI
        .confirmStripe(sessionId, stripeCheckoutId)
        .then((r) => {
          setSession(r.session);
          setSuccess(r.message);
          setStep(stepForSession(r.session));
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((e) => setError(formatAxiosError(e, 'Payment failed')));
    }
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (session && ['waiting_accept', 'waiting', 'chat', 'pay'].includes(step) && session.status !== 'ended') {
      pollRef.current = setInterval(() => {
        refreshSession(session.id).catch(() => {});
      }, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.id, step, session?.status, refreshSession]);

  useEffect(() => {
    if (!session || session.kind !== 'ai' || session.status !== 'active') return;
    const last = [...session.messages].reverse().find((m) => m.fromRole === 'guide');
    if (last && last.content !== lastAiSpoke.current) {
      lastAiSpoke.current = last.content;
      speakVeiled(last.content);
    }
  }, [session?.messages, session?.kind, session?.status]);

  const loadGuides = async (scope: GuideScope) => {
    setLoading(true);
    setError('');
    setGuideScope(scope);
    try {
      const data = await confessionAPI.listGuides(scope);
      setGuides(data.guides);
      setStep('guides');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not load guides'));
    } finally {
      setLoading(false);
    }
  };

  const handleBookAiSession = async () => {
    if (!selectedAi) return;
    if (!agreedToTerms) {
      setError('Tick the box to agree to the AI Terms and safety rules');
      return;
    }
    if (!accountLabel) {
      setError('Your account needs a name before you can continue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: s, simulatorFree: free } = await confessionAPI.createSession({
        amountEur,
        agreeToTerms: true,
        kind: 'ai',
        aiGuideId: selectedAi.id,
      });
      setSession(s);
      if (free || info?.simulatorFree || s.status === 'active') {
        setStep(stepForSession(s));
        setSuccess('Terms agreed (simulator) — booth open, no payment.');
      } else {
        setStep('pay');
        setSuccess('Terms agreed with your account name. Pay to open your private AI booth — 100% goes to the app.');
      }
    } catch (e) {
      setError(formatAxiosError(e, 'Could not start AI confession'));
    } finally {
      setLoading(false);
    }
  };

  const handleBookSession = async () => {
    if (!selectedGuide || !guideScope) return;
    if (!agreedToTerms) {
      setError('Tick the box to agree to the safety rules');
      return;
    }
    if (!accountLabel) {
      setError('Your account needs a name before you can continue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: s, simulatorFree: free } = await confessionAPI.createSession({
        amountEur,
        agreeToTerms: true,
        guideId: selectedGuide.id,
        appointmentAt: new Date(appointmentAt).toISOString(),
        guideScope,
        kind: 'human',
      });
      setSession(s);
      if (free || info?.simulatorFree) {
        setStep(stepForSession(s));
        setSuccess('Appointment requested (simulator — no payment when the guide accepts).');
      } else {
        setStep('waiting_accept');
        setSuccess('Appointment requested — your guide must accept before you pay.');
      }
    } catch (e) {
      setError(formatAxiosError(e, 'Could not book appointment'));
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const { url } = await confessionAPI.createStripeCheckout(session.id);
      if (url) window.location.href = url;
      else setError('Stripe checkout unavailable. Set STRIPE_SECRET_KEY on the server.');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not start Stripe payment'));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!session || !message.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await confessionAPI.sendMessage(session.id, message.trim());
      setSession(res.session);
      setMessage('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { blocked?: boolean; error?: string } } };
      if (err.response?.data?.blocked) {
        setError(err.response.data.error || 'Message blocked for safety');
      } else {
        setError(formatAxiosError(e, 'Could not send message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuideToggle = async () => {
    setLoading(true);
    setError('');
    try {
      const enabling = !guideEnabled;
      if (enabling && !guideNdaSignature.trim() && !guideInfo?.prefs.ndaSignedAt) {
        setError('Sign the guide NDA to enable confession support');
        setLoading(false);
        return;
      }
      await confessionAPI.setGuidePrefs(enabling, guideNdaSignature.trim() || undefined);
      const g = await confessionAPI.getGuidePrefs();
      setGuideInfo(g);
      setGuideEnabled(g.prefs.enabled);
      setSuccess(enabling ? 'You can receive anonymous confession requests' : 'Confession support disabled');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not update guide settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuideRespondAppointment = async (sessionId: string, accept: boolean) => {
    setLoading(true);
    setError('');
    try {
      await confessionAPI.respondAppointment(sessionId, accept);
      const g = await confessionAPI.getGuidePrefs();
      setGuideInfo(g);
      setSuccess(accept ? 'Appointment accepted — seeker can pay now' : 'Appointment declined');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not respond'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuideAccept = async (sessionId: string) => {
    if (!guideNdaSignature.trim() && !guideInfo?.prefs.ndaSignedAt) {
      setError('Sign the guide NDA below first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: s } = await confessionAPI.acceptSession(sessionId, guideNdaSignature.trim() || 'Signed');
      setSession(s);
      setStep('chat');
      setSuccess('Session started — identities remain hidden');
    } catch (e) {
      setError(formatAxiosError(e, 'Could not open booth'));
    } finally {
      setLoading(false);
    }
  };

  const resetSeekerFlow = () => {
    setSession(null);
    setSelectedGuide(null);
    setSelectedAi(null);
    setGuideScope(null);
    setGuides([]);
    setAgreedToTerms(false);
    setStep('intro');
    setSuccess('');
    setError('');
  };

  const isAiSession = session?.kind === 'ai' || Boolean(session?.aiGuideId);

  return (
    <div className="widget confession-booth-widget">
      <div className="confession-booth-hero">
        <div style={{ fontSize: 48, marginBottom: 8 }} aria-hidden>⛪</div>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fde68a' }}>Confession Booth</h2>
        <p style={{ fontSize: 13, color: '#a8a29e', marginTop: 8, lineHeight: 1.5 }}>
          Like the old confessional — a screen between you. You never see each other, and voices are deepened through the lattice so you stay unknown. Start with an AI helper for private matters, or a human guide from your region.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" className={step !== 'guide' ? 'select-user-btn' : 'chat-back-btn'} onClick={resetSeekerFlow}>
          I need help
        </button>
        {guideInfo?.isGuide && (
          <button type="button" className={step === 'guide' ? 'select-user-btn' : 'chat-back-btn'} onClick={() => setStep('guide')}>
            Guide mode
          </button>
        )}
      </div>

      {error && <div className="error-message" style={{ marginBottom: 10 }}>{error}</div>}
      {success && (
        <div style={{ padding: 10, background: 'rgba(16,185,129,0.15)', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
          {success}
        </div>
      )}

      {step === 'intro' && (
        <div>
          <ul style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, paddingLeft: 18 }}>
            <li>Completely private — for personal matters you are not ready to share face-to-face</li>
            <li>AI helpers first — ready now; payment goes 100% to the app</li>
            <li>Human guides by region — blurred identity, NDA, veiled voice (guide keeps 80%)</li>
            <li>Voice is deepened / messed with so nobody hears a clear real voice</li>
            <li><strong>Forbidden:</strong> crimes or intent to harm — blocked &amp; reported</li>
          </ul>
          <button type="button" className="select-user-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setStep('path')}>
            Enter the booth
          </button>
        </div>
      )}

      {step === 'path' && (
        <div className="confession-path-grid">
          <p style={{ fontSize: 14, color: '#d1d5db', marginBottom: 4 }}>
            Who do you want behind the lattice?
          </p>
          <button type="button" className="confession-path-card" onClick={() => setStep('ai_guides')}>
            <strong>AI guide helpers — start here</strong>
            <span>
              {simulatorFree
                ? 'Private AI support. Agree to Terms (simulator — free, no Stripe), then confess anonymously with a veiled voice reply.'
                : 'Private AI support for things too personal to say out loud elsewhere. Agree to Terms, pay €5 or €10 (100% to the app), then confess anonymously with a veiled voice reply.'}
            </span>
          </button>
          <button type="button" className="confession-path-card human" onClick={() => setStep('scope')}>
            <strong>Human guide — same region or international</strong>
            <span>
              Pick blurred guides near you when they apply, or international. Appointment, Stripe, NDA, veiled call — neither of you sees the other.
            </span>
          </button>
          <button type="button" className="chat-back-btn" onClick={() => setStep('intro')}>
            Back
          </button>
        </div>
      )}

      {step === 'ai_guides' && (
        <div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
            Choose an AI helper. They stay anonymous; replies are veiled. Private matters only — no crimes, no harm.
          </p>
          <div className="confession-guide-list">
            {(aiGuides.length ? aiGuides : []).map((g) => (
              <button
                key={g.id}
                type="button"
                className={`confession-guide-card${selectedAi?.id === g.id ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedAi(g);
                  setAgreedToTerms(false);
                  setStep('ai_book');
                }}
              >
                <img className="confession-ai-avatar" src={g.portrait} alt="" />
                <div className="confession-guide-meta">
                  <strong>{g.name.split(' ')[0]} · AI</strong>
                  <span>{g.specialty}</span>
                  <span className="confession-guide-snippet">{g.tagline}</span>
                </div>
              </button>
            ))}
          </div>
          {!aiGuides.length && <p style={{ fontSize: 13, color: '#d1d5db' }}>Loading AI helpers…</p>}
          <button type="button" className="chat-back-btn" style={{ marginTop: 12 }} onClick={() => setStep('path')}>
            Back
          </button>
        </div>
      )}

      {step === 'ai_book' && selectedAi && info && (
        <div>
          <div className="confession-guide-card selected" style={{ marginBottom: 12, cursor: 'default' }}>
            <img className="confession-ai-avatar" src={selectedAi.portrait} alt="" />
            <div className="confession-guide-meta">
              <strong>{selectedAi.name.split(' ')[0]} · AI helper</strong>
              <span>{selectedAi.specialty}</span>
            </div>
          </div>
          <div
            style={{
              maxHeight: 180,
              overflowY: 'auto',
              padding: 12,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#fca5a5',
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            {info.aiSeekerTerms || info.seekerSafetyAgreement}
          </div>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {simulatorFree ? (
              <>Session fee — <strong>waived in simulator</strong> (real app still charges €5 / €10 to the app):</>
            ) : (
              <>Session fee — <strong>100% to the app</strong> (not a human guide):</>
            )}
          </p>
          {!simulatorFree && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {([5, 10] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountEur(p)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: amountEur === p ? '2px solid #fbbf24' : '1px solid #4b5563',
                    background: amountEur === p ? 'rgba(251,191,36,0.15)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  €{p}
                </button>
              ))}
            </div>
          )}
          <label
            style={{
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 12,
              color: '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
            />
            <span>
              I agree to the Terms &amp; no crime / no harm
              {accountLabel ? (
                <>
                  {' '}
                  — signed as <strong>{accountLabel}</strong> (your account)
                </>
              ) : null}
            </span>
          </label>
          <button type="button" className="select-user-btn" style={{ width: '100%' }} disabled={loading} onClick={handleBookAiSession}>
            {loading
              ? 'Opening…'
              : simulatorFree
                ? 'Agree & open booth (free in simulator)'
                : 'Agree & continue to pay'}
          </button>
          <button type="button" className="chat-back-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep('ai_guides')}>
            Choose another AI helper
          </button>
        </div>
      )}

      {step === 'scope' && (
        <div>
          <p style={{ fontSize: 14, color: '#d1d5db', marginBottom: 12 }}>
            Choose human guides from your region (when they apply) or international. Guides stay blurred — you never see their identity. Voices stay veiled.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="select-user-btn" style={{ flex: 1 }} disabled={loading} onClick={() => loadGuides('local')}>
              Guides in my area
            </button>
            <button type="button" className="select-user-btn" style={{ flex: 1 }} disabled={loading} onClick={() => loadGuides('international')}>
              International guides
            </button>
          </div>
          <button type="button" className="chat-back-btn" style={{ marginTop: 12 }} onClick={() => setStep('path')}>
            Back
          </button>
        </div>
      )}

      {step === 'guides' && (
        <div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
            {guideScope === 'local' ? 'Anonymous guides near you' : 'International anonymous guides'} — identities hidden until the booth opens.
          </p>
          {guides.length === 0 ? (
            <p style={{ fontSize: 13, color: '#d1d5db' }}>
              No human guides available here right now. Try {guideScope === 'local' ? 'international' : 'local'}, or use an AI helper instead.
            </p>
          ) : (
            <div className="confession-guide-list">
              {guides.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`confession-guide-card${selectedGuide?.id === g.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedGuide(g);
                    setStep('book');
                  }}
                >
                  <div className="confession-guide-avatar blurred" aria-hidden />
                  <div className="confession-guide-meta">
                    <strong>{g.label}</strong>
                    <span>★ {g.rating} · {g.totalSessions} sessions</span>
                    <span className="confession-guide-snippet">{g.experienceSnippet}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="select-user-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setStep('ai_guides')}>
            Use an AI helper instead
          </button>
          <button type="button" className="chat-back-btn" style={{ marginTop: 8 }} onClick={() => setStep('scope')}>
            Back
          </button>
        </div>
      )}

      {step === 'book' && selectedGuide && info && (
        <div>
          <div className="confession-guide-card selected" style={{ marginBottom: 12, cursor: 'default' }}>
            <div className="confession-guide-avatar blurred" aria-hidden />
            <div className="confession-guide-meta">
              <strong>{selectedGuide.label}</strong>
              <span>★ {selectedGuide.rating}</span>
            </div>
          </div>
          <div
            style={{
              maxHeight: 160,
              overflowY: 'auto',
              padding: 12,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#fca5a5',
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            {info.seekerSafetyAgreement}
          </div>
          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Appointment date &amp; time</label>
          <input
            type="datetime-local"
            value={appointmentAt}
            min={defaultAppointmentValue()}
            onChange={(e) => setAppointmentAt(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#fff', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {simulatorFree
              ? 'Session fee — waived in simulator (real app: paid only after the guide accepts — guide keeps 80%):'
              : 'Session fee (paid only after the guide accepts — guide keeps 80%):'}
          </p>
          {!simulatorFree && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {([5, 10] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountEur(p)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: amountEur === p ? '2px solid #fbbf24' : '1px solid #4b5563',
                    background: amountEur === p ? 'rgba(251,191,36,0.15)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  €{p}
                </button>
              ))}
            </div>
          )}
          <label
            style={{
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 12,
              color: '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
            />
            <span>
              I agree to the safety rules
              {accountLabel ? (
                <>
                  {' '}
                  — signed as <strong>{accountLabel}</strong> (your account)
                </>
              ) : null}
            </span>
          </label>
          <button type="button" className="select-user-btn" style={{ width: '100%' }} disabled={loading} onClick={handleBookSession}>
            {loading ? 'Booking…' : 'Request appointment'}
          </button>
          <button type="button" className="chat-back-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep('guides')}>
            Choose another guide
          </button>
        </div>
      )}

      {step === 'waiting_accept' && session && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕯️</div>
          <p style={{ color: '#d1d5db' }}>
            Waiting for {session.guideDisplayLabel || 'your guide'} to accept your appointment.
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
            {session.appointmentAt ? formatAppointment(session.appointmentAt) : 'Scheduled time pending'}
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>You are: {session.seekerAlias}</p>
          <p style={{ fontSize: 12, color: '#6b7280' }}>Pay €{session.amountEur} only after they accept.</p>
        </div>
      )}

      {step === 'pay' && session && (
        <div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            {isAiSession
              ? `${session.guideDisplayLabel || 'Your AI helper'} is ready.`
              : `${session.guideDisplayLabel || 'Your guide'} accepted your appointment${
                  session.appointmentAt ? ` for ${formatAppointment(session.appointmentAt)}` : ''
                }.`}
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
            Pay €{session.amountEur} to open the anonymous booth.
            {isAiSession ? ' Payment goes 100% to the app account.' : ' Guide keeps 80%.'}
          </p>
          <button type="button" className="select-user-btn" style={{ width: '100%' }} disabled={loading} onClick={() => void handlePay()}>
            {loading ? 'Opening Stripe…' : `Pay €${session.amountEur} with Stripe`}
          </button>
          {info && info.stripeConfigured === false && (
            <p style={{ fontSize: 12, color: '#fca5a5', marginTop: 10, lineHeight: 1.4 }}>
              Stripe is not configured on the live server. Add STRIPE_SECRET_KEY on Render, then redeploy.
            </p>
          )}
        </div>
      )}

      {step === 'waiting' && session && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕯️</div>
          <p style={{ color: '#d1d5db' }}>Payment received. Your guide is opening the booth…</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>You are: {session.seekerAlias}</p>
        </div>
      )}

      {step === 'chat' && session && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12, color: '#9ca3af' }}>
            <span>
              {session.role === 'seeker' ? `You: ${session.seekerAlias}` : `You: ${session.guideAlias}`}
              {' · '}
              {isAiSession ? session.guideDisplayLabel || 'AI helper' : 'Other: anonymous'}
            </span>
            <button
              type="button"
              className="chat-back-btn"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={async () => {
                await confessionAPI.endSession(session.id);
                resetSeekerFlow();
                setSuccess('Session ended. May peace be with you.');
              }}
            >
              End session
            </button>
          </div>

          {isAiSession ? (
            <p className="confession-veil-note">
              AI replies speak through a deepened veil — private matters only. Crimes and harm are blocked.
            </p>
          ) : (
            session.status === 'active' &&
            session.role && <ConfessionMaskedCall sessionId={session.id} role={session.role} />
          )}

          <div className="confession-chat-log">
            {session.messages.map((m) => (
              <div
                key={m.id}
                className={`confession-chat-bubble${m.fromRole === session.role ? ' mine' : ''}`}
              >
                <div className="confession-chat-alias">{m.alias}</div>
                {m.content}
              </div>
            ))}
          </div>

          {session.status === 'active' && (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share what weighs on you…"
                rows={3}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #374151',
                  background: '#111827',
                  color: '#fff',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                className="select-user-btn"
                style={{ width: '100%', marginTop: 8 }}
                disabled={loading || !message.trim()}
                onClick={handleSend}
              >
                {loading ? 'Sending…' : 'Send anonymously'}
              </button>
            </>
          )}
        </div>
      )}

      {step === 'guide' && guideInfo && (
        <div>
          <p style={{ fontSize: 13, color: '#d1d5db', marginBottom: 12 }}>
            As a human guide, you never see who is confessing. Sign the NDA — breaking confidentiality may result in legal action. Seekers from your region can find you under “Guides in my area”.
          </p>
          <div
            style={{
              maxHeight: 160,
              overflowY: 'auto',
              padding: 10,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              marginBottom: 12,
              color: '#fcd34d',
            }}
          >
            {guideInfo.guideNdaAgreement}
          </div>
          {!guideInfo.prefs.ndaSignedAt && (
            <input
              type="text"
              value={guideNdaSignature}
              onChange={(e) => setGuideNdaSignature(e.target.value)}
              placeholder="Sign with full name"
              style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 8, background: '#111827', color: '#fff', border: '1px solid #374151', boxSizing: 'border-box' }}
            />
          )}
          <button type="button" className="select-user-btn" style={{ width: '100%', marginBottom: 16 }} disabled={loading} onClick={handleGuideToggle}>
            {guideEnabled ? 'Disable confession support' : 'Enable — accept anonymous sessions'}
          </button>

          {guideInfo.pendingSessions.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>Pending requests</h4>
              {guideInfo.pendingSessions.map((s) => (
                <div key={s.id} style={{ padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 8, marginBottom: 8 }}>
                  {s.status === 'pending_appointment' ? (
                    <>
                      <p style={{ fontSize: 13 }}>Anonymous seeker · €{s.amountEur}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af' }}>
                        Requested: {s.appointmentAt ? formatAppointment(s.appointmentAt) : 'TBD'}
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" className="chat-back-btn" style={{ flex: 1 }} disabled={loading} onClick={() => handleGuideRespondAppointment(s.id, false)}>
                          Decline
                        </button>
                        <button type="button" className="select-user-btn" style={{ flex: 1 }} disabled={loading} onClick={() => handleGuideRespondAppointment(s.id, true)}>
                          Accept appointment
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13 }}>Anonymous seeker · €{s.amountEur} prepaid</p>
                      <button type="button" className="select-user-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading} onClick={() => handleGuideAccept(s.id)}>
                        Accept &amp; open booth
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
