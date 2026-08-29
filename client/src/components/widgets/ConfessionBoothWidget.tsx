import { useState, useEffect, useCallback, useRef } from 'react';
import { confessionAPI, ConfessionSessionView } from '../../api/confession';
import { formatAxiosError } from '../../lib/apiError';
import './Widget.css';

type Step = 'intro' | 'safety' | 'pay' | 'waiting' | 'chat' | 'guide';

export default function ConfessionBoothWidget() {
  const [step, setStep] = useState<Step>('intro');
  const [info, setInfo] = useState<{ seekerSafetyAgreement: string; guideNdaAgreement: string; prices: number[] } | null>(null);
  const [guideInfo, setGuideInfo] = useState<Awaited<ReturnType<typeof confessionAPI.getGuidePrefs>> | null>(null);
  const [session, setSession] = useState<ConfessionSessionView | null>(null);
  const [amountEur, setAmountEur] = useState<5 | 10>(5);
  const [safetySignature, setSafetySignature] = useState('');
  const [guideNdaSignature, setGuideNdaSignature] = useState('');
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSession = useCallback(async (sessionId: string) => {
    const { session: s } = await confessionAPI.getSession(sessionId);
    setSession(s);
    if (s.status === 'active') setStep('chat');
    else if (s.paymentStatus === 'paid' && s.status !== 'ended' && s.status !== 'reported') setStep('waiting');
    return s;
  }, []);

  useEffect(() => {
    confessionAPI.getInfo().then(setInfo).catch(() => {});
    confessionAPI.getGuidePrefs().then((g) => {
      setGuideInfo(g);
      setGuideEnabled(g.prefs.enabled);
    }).catch(() => {});
    confessionAPI.listSessions().then(({ sessions }) => {
      const open = sessions.find((s) => ['awaiting_payment', 'seeking_guide', 'pending_guide_nda', 'active'].includes(s.status));
      if (open) {
        setSession(open);
        if (open.status === 'awaiting_payment') setStep('pay');
        else if (open.status === 'active') setStep('chat');
        else setStep('waiting');
      }
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const confession = params.get('confession');
    const sessionId = params.get('sessionId');
    const orderId = params.get('token');
    if (confession === 'success' && sessionId && orderId) {
      confessionAPI.capturePayPalOrder(sessionId, orderId).then((r) => {
        setSession(r.session);
        setSuccess(r.message);
        setStep('waiting');
        window.history.replaceState({}, '', window.location.pathname);
      }).catch((e) => setError(formatAxiosError(e)));
    }
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (session && (step === 'waiting' || step === 'chat') && session.status !== 'ended') {
      pollRef.current = setInterval(() => {
        refreshSession(session.id).catch(() => {});
      }, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.id, step, session?.status, refreshSession]);

  const handleStartSafety = () => {
    setError('');
    setStep('safety');
  };

  const handleCreateSession = async () => {
    if (!safetySignature.trim()) {
      setError('Type your full name to sign the safety agreement');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: s } = await confessionAPI.createSession(amountEur, safetySignature.trim());
      setSession(s);
      setStep('pay');
    } catch (e) {
      setError(formatAxiosError(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePayPal = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const { approvalUrl } = await confessionAPI.createPayPalOrder(session.id);
      if (approvalUrl) window.location.href = approvalUrl;
      else setError('PayPal unavailable');
    } catch (e) {
      setError(formatAxiosError(e));
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
        setError(formatAxiosError(e));
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
      setError(formatAxiosError(e));
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
      setError(formatAxiosError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="widget confession-booth-widget">
      <div
        style={{
          textAlign: 'center',
          padding: '20px 16px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #1a0f0a 0%, #0d0705 100%)',
          border: '2px solid rgba(180, 140, 80, 0.35)',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 8 }} aria-hidden>⛪</div>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fde68a' }}>Confession Booth</h2>
        <p style={{ fontSize: 13, color: '#a8a29e', marginTop: 8, lineHeight: 1.5 }}>
          Like the old confessional — you cannot see each other. Speak freely to an anonymous guide who is bound by NDA never to reveal what they hear.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" className={step !== 'guide' ? 'select-user-btn' : 'chat-back-btn'} onClick={() => setStep('intro')}>
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
            <li>Completely anonymous — neither side knows who the other is</li>
            <li>Guide signs a legal NDA — revealing anything can lead to lawsuit</li>
            <li>€5 or €10 before your session (guide keeps 80%)</li>
            <li><strong>Forbidden:</strong> confessing crimes or intent to harm — blocked &amp; reported</li>
          </ul>
          <button type="button" className="select-user-btn" style={{ width: '100%', marginTop: 12 }} onClick={handleStartSafety}>
            Enter the booth
          </button>
        </div>
      )}

      {step === 'safety' && info && (
        <div>
          <div
            style={{
              maxHeight: 200,
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
          <p style={{ fontSize: 13, marginBottom: 8 }}>Choose session fee (paid before confession):</p>
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
          <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Sign with your full name</label>
          <input
            type="text"
            value={safetySignature}
            onChange={(e) => setSafetySignature(e.target.value)}
            placeholder="Your full name"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #374151', background: '#111827', color: '#fff', marginBottom: 12 }}
          />
          <button type="button" className="select-user-btn" style={{ width: '100%' }} disabled={loading} onClick={handleCreateSession}>
            {loading ? 'Preparing…' : 'I agree — continue to payment'}
          </button>
        </div>
      )}

      {step === 'pay' && session && (
        <div>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Pay €{session.amountEur} to open the booth. A random anonymous guide will be notified after payment.
          </p>
          <button type="button" className="select-user-btn" style={{ width: '100%' }} disabled={loading} onClick={handlePayPal}>
            {loading ? 'Opening PayPal…' : `Pay €${session.amountEur} with PayPal`}
          </button>
        </div>
      )}

      {step === 'waiting' && session && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕯️</div>
          <p style={{ color: '#d1d5db' }}>
            {session.status === 'seeking_guide'
              ? 'Payment received. Waiting for an available anonymous guide…'
              : 'Your guide is reviewing the NDA. The booth opens when they accept.'}
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>You are: {session.seekerAlias}</p>
        </div>
      )}

      {step === 'chat' && session && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            <span>
              {session.role === 'seeker' ? `You: ${session.seekerAlias}` : `You: ${session.guideAlias}`}
              {' · '}
              Other: anonymous
            </span>
            <button
              type="button"
              className="chat-back-btn"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={async () => {
                await confessionAPI.endSession(session.id);
                setSession(null);
                setStep('intro');
                setSuccess('Session ended. May peace be with you.');
              }}
            >
              End session
            </button>
          </div>

          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 12,
              padding: 8,
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 12,
            }}
          >
            {session.messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.fromRole === session.role ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: m.fromRole === session.role ? 'rgba(180,140,80,0.25)' : 'rgba(255,255,255,0.06)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 10, color: '#a8a29e', marginBottom: 4 }}>{m.alias}</div>
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
            As a guide, you never see who is confessing. Sign the NDA — breaking confidentiality may result in legal action.
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
            <>
              <input
                type="text"
                value={guideNdaSignature}
                onChange={(e) => setGuideNdaSignature(e.target.value)}
                placeholder="Sign with full name"
                style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 8, background: '#111827', color: '#fff', border: '1px solid #374151' }}
              />
            </>
          )}
          <button type="button" className="select-user-btn" style={{ width: '100%', marginBottom: 16 }} disabled={loading} onClick={handleGuideToggle}>
            {guideEnabled ? 'Disable confession support' : 'Enable — accept anonymous sessions'}
          </button>

          {guideInfo.pendingSessions.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>Pending requests</h4>
              {guideInfo.pendingSessions.map((s) => (
                <div key={s.id} style={{ padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 8, marginBottom: 8 }}>
                  <p style={{ fontSize: 13 }}>Anonymous seeker · €{s.amountEur} prepaid</p>
                  <button type="button" className="select-user-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading} onClick={() => handleGuideAccept(s.id)}>
                    Accept &amp; open booth
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
