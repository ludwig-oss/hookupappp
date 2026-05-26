import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import {
  improvementAPI,
  paymentAPI,
  SESSION_PRICE_EUR,
  ImprovementCategory,
  Guide,
  GuideApplication,
  AvailabilitySlot,
  GuideRequest,
  Booking,
} from '../../api/improvement';
import './Widget.css';

const VIDEO_CALL_BASE = 'https://meet.jit.si';

/** Proof hint per category type for expert application */
function getProofHint(categoryId: string): string {
  const hints: Record<string, string> = {
    communication: 'Provide evidence you\'re a pro (e.g. credentials, portfolio) and that it\'s really you.',
    texting: 'Provide evidence of expertise in texting/DMs and that it\'s really you.',
    bedroom: 'Provide proof of expertise in this area (credentials or evidence).',
    'keeping-partner': 'Provide proof of expertise (e.g. social proof, credentials).',
    'first-date': 'If appearance-related: photos of yourself. Otherwise: credentials or social proof.',
    flirting: 'If appearance-related: photos of yourself. Otherwise: credentials or social proof.',
    'body-language-dating': 'If appearance-related: photos of yourself. Otherwise: credentials or social proof.',
    'confidence-dating': 'If appearance-related: photos of yourself. Otherwise: credentials or social proof.',
    'dating-apps': 'Provide proof (e.g. profile screenshots, credentials) and that it\'s really you.',
  };
  return hints[categoryId] || 'Provide proof of expertise (e.g. credentials, social proof, or photos if applicable) and that it\'s really you.';
}

type GuideSeekStep = 'choose' | 'region' | 'ready' | 'skipped';

function clipText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function CompatibilityWidget() {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<'main' | 'recommended' | 'search' | 'guides' | 'request' | 'send_proof' | 'booking' | 'expert_apply' | 'expert_dashboard'>('main');
  /** Wizard: want a guide → region → browse areas & pick an expert */
  const [guideSeekStep, setGuideSeekStep] = useState<GuideSeekStep>('choose');
  const [clientRegion, setClientRegion] = useState('');
  const [expertTab, setExpertTab] = useState<'requests' | 'upcoming' | 'previous' | 'availability'>('requests');
  const [myApplication, setMyApplication] = useState<GuideApplication | null>(null);
  const [myGuide, setMyGuide] = useState<Guide | null>(null);
  const [guideRequestsIncoming, setGuideRequestsIncoming] = useState<GuideRequest[]>([]);
  const [guideBookings, setGuideBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [recommendedGuides, setRecommendedGuides] = useState<Guide[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGuides, setSearchGuides] = useState<Guide[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [myRequests, setMyRequests] = useState<GuideRequest[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [acceptedRequestForPay, setAcceptedRequestForPay] = useState<GuideRequest | null>(null);
  const [proofText, setProofText] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Apply-as-expert form
  const [applyCategories, setApplyCategories] = useState<string[]>([]);
  const [applyExperience, setApplyExperience] = useState('');
  const [applyQualifications, setApplyQualifications] = useState('');
  const [applyIdentificationUrl, setApplyIdentificationUrl] = useState('');
  const [applyProofPerCategory, setApplyProofPerCategory] = useState<Record<string, { description: string; imageUrls: string }>>({});
  const [applyRegion, setApplyRegion] = useState('');
  // Expert set availability
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const catId = (e as CustomEvent<{ categoryId?: string }>).detail?.categoryId;
      if (catId) {
        loadGuidesForCategory(catId);
        setView('guides');
      }
    };
    window.addEventListener('school:open-guides', handler);
    return () => window.removeEventListener('school:open-guides', handler);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadRecommended();
      loadMyRequests();
      improvementAPI.getMyBookings(user.id).then(r => setMyBookings(r.bookings || [])).catch(() => {});
      improvementAPI.getMyApplication(user.id).then(r => setMyApplication(r.application || null)).catch(() => setMyApplication(null));
      improvementAPI.getMyGuideProfile(user.id).then(r => {
        if (r.guide && r.user) setMyGuide(r.guide);
        else setMyGuide(null);
      }).catch(() => setMyGuide(null));
    }
  }, [user?.id]);

  useEffect(() => {
    if (myGuide?.id) {
      improvementAPI.getGuideRequests(myGuide.id).then(r => setGuideRequestsIncoming(r.requests || [])).catch(() => setGuideRequestsIncoming([]));
      improvementAPI.getGuideBookings(myGuide.id).then(r => setGuideBookings(r.bookings || [])).catch(() => setGuideBookings([]));
    }
  }, [myGuide?.id]);

  useEffect(() => {
    if (myGuide?.id && expertTab === 'availability') {
      loadAvailability(myGuide.id);
    }
  }, [myGuide?.id, expertTab]);

  const loadCategories = async () => {
    try {
      const res = await improvementAPI.getCategories();
      setCategories(res.categories);
    } catch {
      setError('Failed to load categories');
    }
  };

  const loadRecommended = async (regionFilter?: string | null) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let region: string | undefined;
      if (regionFilter !== undefined) {
        region = regionFilter?.trim() ? regionFilter.trim() : undefined;
      } else {
        region =
          guideSeekStep === 'ready' && clientRegion.trim() ? clientRegion.trim() : undefined;
      }
      const res = await improvementAPI.getRecommendedGuides(user.id, region);
      setRecommendedGuides(res.guides || []);
    } catch {
      setRecommendedGuides([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRequests = async () => {
    if (!user?.id) return;
    try {
      const res = await improvementAPI.getMyGuideRequests(user.id);
      setMyRequests(res.requests || []);
    } catch {}
  };

  const handleSearchProblem = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const region =
        guideSeekStep === 'ready' && clientRegion.trim() ? clientRegion.trim() : undefined;
      const res = await improvementAPI.searchGuidesByProblem(q, region);
      setSearchGuides(res.guides || []);
      setView('search');
    } catch {
      setError('Search failed');
      setSearchGuides([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGuidesForCategory = async (catId: string) => {
    setSelectedCategory(catId);
    setLoading(true);
    try {
      const region =
        guideSeekStep === 'ready' && clientRegion.trim() ? clientRegion.trim() : undefined;
      const res = await improvementAPI.getGuidesForCategory(catId, region);
      setGuides(res.guides || []);
      setView('guides');
    } catch {
      setError('Failed to load experts');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (guideId: string) => {
    try {
      const res = await improvementAPI.getGuideAvailability(guideId);
      setAvailability(res.availability || []);
    } catch {
      setAvailability([]);
    }
  };

  const handleSendRequest = (guide: Guide) => {
    setSelectedGuide(guide);
    setView('request');
  };

  const handleSubmitRequest = async () => {
    if (!selectedGuide || !user) return;
    setLoading(true);
    setError('');
    try {
      await improvementAPI.sendGuideRequest({
        guideId: selectedGuide.id,
        category: selectedCategory || (selectedGuide.categories && selectedGuide.categories[0]) || '',
        message: requestMessage,
        userId: user.id,
      });
      setRequestMessage('');
      setView('guides');
      loadMyRequests();
      alert('Request sent! The expert will respond soon.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const handleSendProof = (guide: Guide, req: GuideRequest) => {
    setSelectedGuide(guide);
    setAcceptedRequestForPay(req);
    setProofText('');
    setProofImageUrl('');
    setView('send_proof');
  };

  const handleSubmitProof = async () => {
    if (!acceptedRequestForPay || !proofText.trim()) {
      setError('Please describe your payment (e.g. transaction ID or note).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await paymentAPI.submitPaymentProof(acceptedRequestForPay.id, proofText.trim(), proofImageUrl.trim() || undefined);
      setView('guides');
      setAcceptedRequestForPay(null);
      loadMyRequests();
      alert('Proof submitted. The trainer has up to 48 hours to confirm they received the €50. You can then book your appointment.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit proof');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAfterConfirm = (guide: Guide, req: GuideRequest) => {
    setSelectedGuide(guide);
    setAcceptedRequestForPay(req);
    setView('booking');
    loadAvailability(guide.id);
  };

  const handleSubmitExpertApplication = async () => {
    if (!user?.id) return;
    if (applyCategories.length === 0) {
      setError('Select at least one category');
      return;
    }
    if (!applyExperience.trim() || !applyQualifications.trim()) {
      setError('Experience and qualifications are required');
      return;
    }
    const proofPerCategory: Record<string, { description: string; imageUrls?: string[] }> = {};
    for (const catId of applyCategories) {
      const p = applyProofPerCategory[catId];
      const desc = p?.description?.trim();
      if (!desc) {
        setError(`Proof description required for ${categories.find(c => c.id === catId)?.name || catId}`);
        return;
      }
      const urls = p?.imageUrls?.trim() ? p.imageUrls.split(/[\s,]+/).filter(Boolean) : undefined;
      proofPerCategory[catId] = { description: desc, imageUrls: urls };
    }
    setLoading(true);
    setError('');
    try {
      const res = await improvementAPI.applyAsGuide({
        userId: user.id,
        categories: applyCategories,
        region: applyRegion.trim() || undefined,
        experience: applyExperience.trim(),
        qualifications: applyQualifications.trim(),
        identificationUrl: applyIdentificationUrl.trim() || undefined,
        proofPerCategory,
      });
      setMyApplication(res.application);
      setView('main');
      setApplyCategories([]);
      setApplyExperience('');
      setApplyQualifications('');
      setApplyIdentificationUrl('');
      setApplyProofPerCategory({});
      alert(res.message || 'Application submitted. You will get a response within 48 hours.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const handleExpertAcceptRequest = async (requestId: string) => {
    setLoading(true);
    try {
      await improvementAPI.acceptGuideRequest(requestId);
      improvementAPI.getGuideRequests(myGuide!.id).then(r => setGuideRequestsIncoming(r.requests || []));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept');
    } finally {
      setLoading(false);
    }
  };

  const handleExpertDeclineRequest = async (requestId: string) => {
    setLoading(true);
    try {
      await improvementAPI.rejectGuideRequest(requestId);
      improvementAPI.getGuideRequests(myGuide!.id).then(r => setGuideRequestsIncoming(r.requests || []));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to decline');
    } finally {
      setLoading(false);
    }
  };

  const handleExpertSetAvailability = async () => {
    if (!user?.id || !myGuide) return;
    const start = availStart ? new Date(availStart).toISOString() : '';
    const end = availEnd ? new Date(availEnd).toISOString() : '';
    if (!start || !end) {
      setError('Set both start and end time');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await improvementAPI.setAvailability({ userId: user.id, startTime: start, endTime: end });
      setAvailStart('');
      setAvailEnd('');
      loadAvailability(myGuide.id);
      alert('Availability added. Users can now book this slot.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set availability');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBookingWithRequest = async () => {
    if (!selectedGuide || !selectedSlot || !user || !acceptedRequestForPay) return;
    if (acceptedRequestForPay.paymentStatus !== 'confirmed') {
      setError('Trainer must confirm payment first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await improvementAPI.createBooking({
        guideId: selectedGuide.id,
        category: acceptedRequestForPay.category,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        duration: 60,
        userId: user.id,
        requestId: acceptedRequestForPay.id,
      });
      setSelectedSlot(null);
      setAcceptedRequestForPay(null);
      setView('main');
      loadMyRequests();
      improvementAPI.getMyBookings(user.id).then(r => setMyBookings(r.bookings || [])).catch(() => {});
      alert('Appointment booked! You can join the video call at the scheduled time.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = (active?: boolean) => ({
    padding: '14px',
    border: `2px solid ${active ? 'rgba(0, 212, 255, 0.7)' : 'rgba(0, 212, 255, 0.3)'}`,
    borderRadius: '10px',
    background: 'rgba(0, 0, 0, 0.35)',
    color: '#fff',
    fontFamily: 'Orbitron, monospace',
    boxShadow: active ? '0 0 15px rgba(0, 212, 255, 0.3)' : 'none',
  });

  const renderGuideList = (list: Guide[], categoryLabel: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
      {list.map((guide) => {
        const pending = myRequests.find(r => r.guideId === guide.id && r.status === 'pending');
        const accepted = myRequests.find(r => r.guideId === guide.id && r.status === 'accepted');
        const needSendProof = accepted && accepted.paymentStatus !== 'sent_pending_confirmation' && accepted.paymentStatus !== 'confirmed';
        const waitingConfirmation = accepted && accepted.paymentStatus === 'sent_pending_confirmation';
        const confirmed = accepted && accepted.paymentStatus === 'confirmed';
        const expertiseLabels = (guide.categories || [])
          .map((id) => categories.find((c) => c.id === id)?.name)
          .filter(Boolean)
          .slice(0, 6);
        return (
          <div key={guide.id} style={cardStyle()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="user-avatar" style={{ width: '48px', height: '48px', flexShrink: 0 }}>
                {guide.user?.profilePicture ? (
                  <img src={guide.user.profilePicture} alt="" />
                ) : (
                  <div className="avatar-placeholder">{guide.user?.name?.[0] || 'E'}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#00d4ff' }}>{guide.user?.name}</span>
                  {guide.badge && <span style={{ fontSize: '10px', color: '#ff00ff' }}>✓ Verified</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  🌐 {guide.region} &nbsp; ⭐ {typeof guide.rating === 'number' ? guide.rating.toFixed(1) : '0'} &nbsp; {guide.totalSessions || 0} sessions &nbsp; €{guide.sessionPriceEur ?? SESSION_PRICE_EUR}/session
                </div>
                {expertiseLabels.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {expertiseLabels.map((name) => (
                      <span
                        key={`${guide.id}-${name}`}
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          border: '1px solid rgba(0, 212, 255, 0.45)',
                          color: '#a5f3fc',
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {(guide.experience || guide.qualifications) && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#d1d5db', lineHeight: 1.45 }}>
                    {guide.experience ? (
                      <div>
                        <span style={{ color: '#00d4ff' }}>Experience: </span>
                        {clipText(guide.experience, 160)}
                      </div>
                    ) : null}
                    {guide.qualifications ? (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ color: '#00d4ff' }}>Credentials: </span>
                        {clipText(guide.qualifications, 160)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div>
                {pending && <span style={{ fontSize: '12px', color: '#fbbf24' }}>Pending</span>}
                {needSendProof && (
                  <button
                    type="button"
                    onClick={() => handleSendProof(guide, accepted!)}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(255, 165, 0, 0.25)',
                      color: '#ffa500',
                      border: '2px solid #ffa500',
                      borderRadius: '8px',
                      fontFamily: 'Orbitron, monospace',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Send €{SESSION_PRICE_EUR} & proof
                  </button>
                )}
                {waitingConfirmation && (
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Waiting confirmation (48h)</span>
                )}
                {confirmed && (
                  <button
                    type="button"
                    onClick={() => handleBookAfterConfirm(guide, accepted!)}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      border: '2px solid #00d4ff',
                      borderRadius: '8px',
                      fontFamily: 'Orbitron, monospace',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Book appointment
                  </button>
                )}
                {!pending && !accepted && (
                  <button
                    type="button"
                    onClick={() => handleSendRequest(guide)}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(255, 0, 255, 0.2)',
                      color: '#ff00ff',
                      border: '2px solid #ff00ff',
                      borderRadius: '8px',
                      fontFamily: 'Orbitron, monospace',
                      cursor: 'pointer',
                    }}
                  >
                    Send request
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="widget compatibility-widget-inner" style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '16px', padding: '20px', boxShadow: '0 0 25px rgba(0, 212, 255, 0.2)' }}>
      <div className="compat-line" style={{ marginBottom: '16px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontSize: '16px', textShadow: '0 0 10px rgba(0, 212, 255, 0.5)' }}>
        IMPROVE YOURSELF — EXPERT HELPERS
      </div>
      <div className="compat-status" style={{ marginBottom: '16px', fontSize: '12px', color: '#9ca3af' }}>
        {guideSeekStep === 'ready'
          ? `Experts matched for ${clientRegion.trim() || 'your region'}. Pick a focus area, then choose a guide by name and expertise.`
          : guideSeekStep === 'skipped'
            ? 'Browse by area or search. Experts worldwide — filter by category or problem.'
            : 'Start by telling us if you want a personal guide, then your region, then the areas you want to improve.'}
      </div>

      {guideSeekStep === 'choose' && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            borderRadius: '12px',
            border: '2px solid rgba(0, 212, 255, 0.45)',
            background: 'rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontSize: '13px', marginBottom: '8px' }}>
            Step 1 — Looking for a guide?
          </div>
          <p style={{ fontSize: '13px', color: '#e5e7eb', marginBottom: '14px', lineHeight: 1.5 }}>
            If you want hands-on help, we’ll ask your country or region next, then the topics you want to work on. Verified
            experts who cover those areas will appear for you to choose from.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setGuideSeekStep('region')}
              style={{
                padding: '12px 18px',
                background: 'rgba(255, 0, 255, 0.22)',
                border: '2px solid #ff00ff',
                borderRadius: '8px',
                color: '#ff00ff',
                fontFamily: 'Orbitron, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Yes — find a guide
            </button>
            <button
              type="button"
              onClick={() => {
                setGuideSeekStep('skipped');
                setClientRegion('');
              }}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: '2px solid rgba(0, 212, 255, 0.5)',
                borderRadius: '8px',
                color: '#00d4ff',
                fontFamily: 'Orbitron, monospace',
                cursor: 'pointer',
              }}
            >
              No thanks — browse only
            </button>
          </div>
        </div>
      )}

      {guideSeekStep === 'region' && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            borderRadius: '12px',
            border: '2px solid rgba(255, 0, 255, 0.35)',
            background: 'rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ color: '#ff00ff', fontFamily: 'Orbitron, monospace', fontSize: '13px', marginBottom: '8px' }}>
            Step 2 — Your country or region
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.45 }}>
            We use this to prioritize experts who serve your area (e.g. Germany, California, UK). Leave blank to see
            worldwide listings.
          </p>
          <input
            type="text"
            value={clientRegion}
            onChange={(e) => setClientRegion(e.target.value)}
            placeholder="e.g. Germany, UK, California"
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '12px',
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid rgba(0, 212, 255, 0.5)',
              borderRadius: '8px',
              color: '#fff',
              fontFamily: 'Orbitron, monospace',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={async () => {
                setGuideSeekStep('ready');
                if (user?.id) await loadRecommended(clientRegion);
              }}
              style={{
                padding: '12px 18px',
                background: 'rgba(0, 212, 255, 0.28)',
                border: '2px solid #00d4ff',
                borderRadius: '8px',
                color: '#00d4ff',
                fontFamily: 'Orbitron, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Continue — pick focus areas
            </button>
            <button
              type="button"
              onClick={() => setGuideSeekStep('choose')}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: '2px solid rgba(156, 163, 175, 0.6)',
                borderRadius: '8px',
                color: '#9ca3af',
                fontFamily: 'Orbitron, monospace',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {guideSeekStep === 'ready' && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(0, 212, 255, 0.12)',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            fontSize: '12px',
            color: '#a5f3fc',
            fontFamily: 'Orbitron, monospace',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Step 3 — Region: <strong style={{ color: '#fff' }}>{clientRegion.trim() || 'Worldwide'}</strong>
          </span>
          <button
            type="button"
            onClick={() => setGuideSeekStep('region')}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid rgba(0, 212, 255, 0.6)',
              borderRadius: '6px',
              color: '#00d4ff',
              cursor: 'pointer',
              fontFamily: 'Orbitron, monospace',
              fontSize: '11px',
            }}
          >
            Edit region
          </button>
        </div>
      )}

      {myApplication?.status === 'pending' && (
        <div style={{ marginBottom: '12px', padding: '12px', border: '2px solid rgba(251, 191, 36, 0.6)', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', fontSize: '13px' }}>
          Your expert application is under review. You will get a response within 48 hours.
        </div>
      )}
      {myApplication?.status === 'rejected' && (
        <div style={{ marginBottom: '12px', padding: '12px', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '13px' }}>
          Your application was not approved. You can try again with stronger proof in the future.
        </div>
      )}

      {myGuide && (
        <div style={{ marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setView('expert_dashboard')}
            style={{
              padding: '10px 18px',
              background: 'rgba(34, 197, 94, 0.25)',
              border: '2px solid #22c55e',
              borderRadius: '8px',
              color: '#22c55e',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Expert dashboard — Requests, appointments, availability
          </button>
        </div>
      )}

      {!myGuide && !myApplication && (
        <div style={{ marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setView('expert_apply')}
            style={{
              padding: '10px 18px',
              background: 'rgba(0, 212, 255, 0.2)',
              border: '2px solid #00d4ff',
              borderRadius: '8px',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              cursor: 'pointer',
            }}
          >
            Apply to be an expert
          </button>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>Provide proof per area. Reviewed within 48 hours.</p>
        </div>
      )}

      {myBookings.filter(b => b.status === 'scheduled').length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '10px', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '8px', fontFamily: 'Orbitron, monospace' }}>My appointments</div>
          {myBookings.filter(b => b.status === 'scheduled').slice(0, 5).map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: '#e5e7eb' }}>
              <span>{new Date(b.startTime).toLocaleString()} – {b.category}</span>
              <a href={getVideoCallUrl(b.id)} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>Join video call</a>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}

      {view === 'main' && (guideSeekStep === 'ready' || guideSeekStep === 'skipped') && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00d4ff', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>Search by problem</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchProblem()}
                placeholder="e.g. jealousy, first date, trust"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '2px solid rgba(0, 212, 255, 0.5)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontFamily: 'Orbitron, monospace',
                }}
              />
              <button
                type="button"
                onClick={handleSearchProblem}
                disabled={loading}
                style={{
                  padding: '12px 18px',
                  background: 'rgba(0, 212, 255, 0.3)',
                  border: '2px solid #00d4ff',
                  borderRadius: '8px',
                  color: '#00d4ff',
                  fontFamily: 'Orbitron, monospace',
                  cursor: 'pointer',
                }}
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
          </div>

          {user?.improvementCategories && user.improvementCategories.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '8px', fontFamily: 'Orbitron, monospace' }}>
                Your focus areas (from signup) — tap to see guides
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {user.improvementCategories.map((catId: string) => {
                  const cat = categories.find(c => c.id === catId);
                  if (!cat) return null;
                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => loadGuidesForCategory(catId)}
                      style={{
                        padding: '8px 14px',
                        background: 'rgba(255, 0, 255, 0.15)',
                        border: '2px solid rgba(255, 0, 255, 0.5)',
                        borderRadius: '8px',
                        color: '#ff00ff',
                        fontFamily: 'Orbitron, monospace',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '8px', fontFamily: 'Orbitron, monospace' }}>
              Or browse all topics — then choose an expert
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {categories.slice(0, 24).map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => loadGuidesForCategory(cat.id)}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '2px solid rgba(0, 212, 255, 0.4)',
                    borderRadius: '8px',
                    color: '#00d4ff',
                    fontFamily: 'Orbitron, monospace',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'search' && (
        <div>
          <button type="button" onClick={() => { setView('main'); setSearchQuery(''); }} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff', fontSize: '14px' }}>Experts for &quot;{searchQuery}&quot;</div>
          {searchGuides.length === 0 ? <p style={{ color: '#9ca3af' }}>No experts found. Try another search.</p> : renderGuideList(searchGuides, searchQuery)}
        </div>
      )}

      {view === 'recommended' && (
        <div>
          <button type="button" onClick={() => setView('main')} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff', fontSize: '14px' }}>Recommended experts</div>
          {recommendedGuides.length === 0 ? <p style={{ color: '#9ca3af' }}>No recommended experts yet.</p> : renderGuideList(recommendedGuides, 'Recommended')}
        </div>
      )}

      {view === 'guides' && (
        <div>
          <button type="button" onClick={() => { setView('main'); setSelectedCategory(''); }} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff', fontSize: '14px' }}>
            {categories.find(c => c.id === selectedCategory)?.name || 'Experts'}
          </div>
          {guides.length === 0 ? <p style={{ color: '#9ca3af' }}>No experts in this area yet.</p> : renderGuideList(guides, selectedCategory)}
        </div>
      )}

      {view === 'request' && selectedGuide && (
        <div>
          <button type="button" onClick={() => setView('guides')} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={cardStyle()}>
            <div style={{ marginBottom: '12px' }}>Send request to <strong style={{ color: '#00d4ff' }}>{selectedGuide.user?.name}</strong></div>
            <div style={{ marginBottom: '12px', fontSize: '12px', color: '#9ca3af' }}>€{selectedGuide.sessionPriceEur ?? SESSION_PRICE_EUR} per session. After they accept, you pay via PayPal and then book a time.</div>
            <textarea value={requestMessage} onChange={e => setRequestMessage(e.target.value)} placeholder="Message (optional)" rows={3} style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <button type="button" onClick={handleSubmitRequest} disabled={loading} style={{ padding: '12px 20px', background: 'rgba(255, 0, 255, 0.3)', border: '2px solid #ff00ff', borderRadius: '8px', color: '#ff00ff', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>{loading ? 'Sending...' : 'Send request'}</button>
          </div>
        </div>
      )}

      {view === 'send_proof' && selectedGuide && acceptedRequestForPay && (
        <div>
          <button type="button" onClick={() => { setView('guides'); setAcceptedRequestForPay(null); }} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={cardStyle()}>
            <div style={{ marginBottom: '12px', color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>Send €{SESSION_PRICE_EUR} to trainer via PayPal</div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>1. Send €{SESSION_PRICE_EUR} to the trainer&apos;s PayPal below. 2. Then submit proof (e.g. transaction ID or screenshot URL) so they can confirm within 48 hours. Only after they confirm can you book an appointment.</p>
            {selectedGuide.paypalInfo ? (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(0, 212, 255, 0.4)' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Trainer&apos;s PayPal (send €{SESSION_PRICE_EUR} here):</div>
                <div style={{ color: '#00d4ff', fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedGuide.paypalInfo}</div>
              </div>
            ) : (
              <p style={{ color: '#fbbf24', fontSize: '12px', marginBottom: '12px' }}>This trainer has not set their PayPal info yet. Please contact them or try another trainer.</p>
            )}
            <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>Proof of payment (required) *</label>
            <textarea value={proofText} onChange={e => setProofText(e.target.value)} placeholder="e.g. Transaction ID, or note that you sent €50 to the PayPal above" rows={3} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ display: 'block', marginBottom: '6px', color: '#9ca3af', fontSize: '12px' }}>Proof image URL (optional)</label>
            <input type="text" value={proofImageUrl} onChange={e => setProofImageUrl(e.target.value)} placeholder="https://... screenshot of payment" style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={handleSubmitProof} disabled={loading || !selectedGuide.paypalInfo} style={{ padding: '12px 18px', background: 'rgba(0, 212, 255, 0.3)', border: '2px solid #00d4ff', borderRadius: '8px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>{loading ? 'Submitting...' : 'Submit proof'}</button>
              <button type="button" onClick={() => { setView('guides'); setAcceptedRequestForPay(null); }} style={{ padding: '8px 14px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {view === 'booking' && selectedGuide && acceptedRequestForPay && (
        <div>
          <button type="button" onClick={() => { setView('main'); setSelectedSlot(null); setAcceptedRequestForPay(null); }} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff' }}>Select appointment with {selectedGuide.user?.name}</div>
          {availability.length === 0 ? <p style={{ color: '#9ca3af' }}>No slots available. Check back later.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '16px' }}>
              {availability.map(slot => (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  style={cardStyle(selectedSlot?.id === slot.id)}
                >
                  {new Date(slot.startTime).toLocaleString()} – {new Date(slot.endTime).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}
          {selectedSlot && (
            <button type="button" onClick={handleCreateBookingWithRequest} disabled={loading} style={{ padding: '12px 20px', width: '100%', background: 'rgba(0, 212, 255, 0.3)', border: '2px solid #00d4ff', borderRadius: '8px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Booking...' : 'Confirm appointment'}</button>
          )}
        </div>
      )}

      {view === 'expert_apply' && (
        <div>
          <button type="button" onClick={() => setView('main')} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back</button>
          <h3 style={{ color: '#00d4ff', marginBottom: '8px', fontFamily: 'Orbitron, monospace' }}>Apply to be an expert</h3>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>For each area you apply for, provide proof of expertise (e.g. photos for appearance, credentials for communications, evidence it&apos;s really you). Applications are reviewed within 48 hours.</p>
          <label style={{ display: 'block', marginBottom: '8px', color: '#00d4ff', fontSize: '12px' }}>Categories (select all that apply)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', maxHeight: '140px', overflowY: 'auto' }}>
            {categories.map(cat => (
              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={applyCategories.includes(cat.id)}
                  onChange={e => {
                    if (e.target.checked) setApplyCategories(prev => [...prev, cat.id]);
                    else setApplyCategories(prev => prev.filter(id => id !== cat.id));
                  }}
                />
                {cat.icon} {cat.name}
              </label>
            ))}
          </div>
          {applyCategories.map(catId => {
            const cat = categories.find(c => c.id === catId);
            const proof = applyProofPerCategory[catId] || { description: '', imageUrls: '' };
            return (
              <div key={catId} style={{ ...cardStyle(), marginBottom: '12px' }}>
                <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '6px' }}>{cat?.icon} {cat?.name} — proof required</div>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{getProofHint(catId)}</p>
                <textarea
                  value={proof.description}
                  onChange={e => setApplyProofPerCategory(prev => ({ ...prev, [catId]: { ...prev[catId], description: e.target.value } }))}
                  placeholder="Describe your proof / paste credentials or image URLs"
                  rows={2}
                  style={{ width: '100%', padding: '8px', marginBottom: '6px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <input
                  type="text"
                  value={proof.imageUrls}
                  onChange={e => setApplyProofPerCategory(prev => ({ ...prev, [catId]: { ...prev[catId], imageUrls: e.target.value } }))}
                  placeholder="Image URLs (optional, comma or space separated)"
                  style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                />
              </div>
            );
          })}
          {applyCategories.length > 0 && (
            <>
              <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>Experience (required)</label>
              <textarea value={applyExperience} onChange={e => setApplyExperience(e.target.value)} placeholder="Your experience in these areas" rows={2} style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>Qualifications (required)</label>
              <textarea value={applyQualifications} onChange={e => setApplyQualifications(e.target.value)} placeholder="Credentials, certifications, social proof" rows={2} style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <label style={{ display: 'block', marginBottom: '6px', color: '#9ca3af', fontSize: '12px' }}>Identification or main proof URL (optional if proof per category provided)</label>
              <input type="text" value={applyIdentificationUrl} onChange={e => setApplyIdentificationUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <label style={{ display: 'block', marginBottom: '6px', color: '#9ca3af', fontSize: '12px' }}>Region (optional)</label>
              <input type="text" value={applyRegion} onChange={e => setApplyRegion(e.target.value)} placeholder="e.g. Global, Europe" style={{ width: '100%', padding: '10px', marginBottom: '16px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <button type="button" onClick={handleSubmitExpertApplication} disabled={loading} style={{ padding: '12px 20px', background: 'rgba(0, 212, 255, 0.3)', border: '2px solid #00d4ff', borderRadius: '8px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Submitting...' : 'Submit application'}</button>
            </>
          )}
        </div>
      )}

      {view === 'expert_dashboard' && myGuide && (
        <div>
          <button type="button" onClick={() => setView('main')} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back to Compatibility</button>
          <h3 style={{ color: '#22c55e', marginBottom: '12px', fontFamily: 'Orbitron, monospace' }}>Expert dashboard</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {(['requests', 'upcoming', 'previous', 'availability'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setExpertTab(tab)}
                style={{
                  padding: '8px 14px',
                  background: expertTab === tab ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0,0,0,0.3)',
                  border: `2px solid ${expertTab === tab ? '#22c55e' : 'rgba(0, 212, 255, 0.4)'}`,
                  borderRadius: '8px',
                  color: expertTab === tab ? '#22c55e' : '#00d4ff',
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {tab === 'requests' && `Requests (${guideRequestsIncoming.filter(r => r.status === 'pending').length})`}
                {tab === 'upcoming' && 'Upcoming'}
                {tab === 'previous' && 'Previous clients'}
                {tab === 'availability' && 'Set availability'}
              </button>
            ))}
          </div>
          {expertTab === 'requests' && (
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {guideRequestsIncoming.filter(r => r.status === 'pending').length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No pending requests.</p>
              ) : (
                guideRequestsIncoming.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} style={cardStyle()}>
                    <div style={{ marginBottom: '8px' }}>Category: <strong>{req.category}</strong></div>
                    {req.message && <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>{req.message}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => handleExpertAcceptRequest(req.id)} disabled={loading} style={{ padding: '8px 14px', background: 'rgba(34, 197, 94, 0.3)', border: '2px solid #22c55e', color: '#22c55e', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>Accept</button>
                      <button type="button" onClick={() => handleExpertDeclineRequest(req.id)} disabled={loading} style={{ padding: '8px 14px', background: 'transparent', border: '2px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>Decline</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {expertTab === 'upcoming' && (
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {guideBookings.filter(b => b.status === 'scheduled').length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No upcoming appointments.</p>
              ) : (
                guideBookings.filter(b => b.status === 'scheduled').map(b => (
                  <div key={b.id} style={cardStyle()}>
                    <div>{new Date(b.startTime).toLocaleString()} – {b.category}</div>
                    <a href={getVideoCallUrl(b.id)} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', fontSize: '12px' }}>Join video call</a>
                  </div>
                ))
              )}
            </div>
          )}
          {expertTab === 'previous' && (
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {guideBookings.filter(b => b.status === 'completed').length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No previous clients yet.</p>
              ) : (
                guideBookings.filter(b => b.status === 'completed').map(b => (
                  <div key={b.id} style={cardStyle()}>
                    <div>{b.category} – {new Date(b.startTime).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
          {expertTab === 'availability' && (
            <div>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>Set when you&apos;re free. Users can then book these slots.</p>
              <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>Start</label>
              <input type="datetime-local" value={availStart} onChange={e => setAvailStart(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff' }} />
              <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>End</label>
              <input type="datetime-local" value={availEnd} onChange={e => setAvailEnd(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '12px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff' }} />
              <button type="button" onClick={handleExpertSetAvailability} disabled={loading} style={{ padding: '10px 18px', background: 'rgba(34, 197, 94, 0.3)', border: '2px solid #22c55e', color: '#22c55e', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>{loading ? 'Adding...' : 'Add availability'}</button>
              {availability.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '8px' }}>Your slots</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {availability.map(slot => (
                      <div key={slot.id} style={cardStyle()}>
                        {new Date(slot.startTime).toLocaleString()} – {new Date(slot.endTime).toLocaleTimeString()} {slot.isBooked ? '(booked)' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function getVideoCallUrl(bookingId: string): string {
  return `${VIDEO_CALL_BASE}/aswp-${bookingId}`;
}
