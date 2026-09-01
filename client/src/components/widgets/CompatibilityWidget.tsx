import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
  improvementAPI,
  paymentAPI,
  walletAPI,
  SESSION_PRICE_EUR,
  ImprovementCategory,
  Guide,
  GuideApplication,
  AvailabilitySlot,
  GuideRequest,
  Booking,
  GuideWalletSummary,
} from '../../api/improvement';
import CoachVoteWidget from './CoachVoteWidget';
import GuidePrepayPanel from './GuidePrepayPanel';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import { formatAxiosError } from '../../lib/apiError';
import { notifyDevice } from '../../lib/deviceNotify';
import './Widget.css';

const VIDEO_CALL_BASE = 'https://meet.jit.si';

type GuideSeekStep = 'choose' | 'region' | 'ready' | 'skipped';

function clipText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function CompatibilityWidget() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [view, setView] = useState<'main' | 'recommended' | 'search' | 'guides' | 'request' | 'send_proof' | 'booking' | 'expert_apply' | 'expert_dashboard'>('main');
  /** Wizard: want a guide → region → browse areas & pick an expert */
  const [guideSeekStep, setGuideSeekStep] = useState<GuideSeekStep>('choose');
  const [clientRegion, setClientRegion] = useState('');
  const [expertTab, setExpertTab] = useState<'requests' | 'upcoming' | 'previous' | 'availability' | 'wallet' | 'applications'>('requests');
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
  const [applyProofPerCategory, setApplyProofPerCategory] = useState<
    Record<string, { whyGood: string; proofType: 'instagram' | 'pictures' | 'video'; instagramHandle: string; imageUrls: string; videoUrl: string }>
  >({});
  const [proofUploading, setProofUploading] = useState<Record<string, boolean>>({});
  const [applyRegion, setApplyRegion] = useState('');
  // Expert set availability
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');
  const [walletSummary, setWalletSummary] = useState<GuideWalletSummary | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletPaypal, setWalletPaypal] = useState('');
  const [pendingGuideApps, setPendingGuideApps] = useState<GuideApplication[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paypal') === 'success' && params.get('requestId')) {
      const requestId = params.get('requestId')!;
      const orderId = params.get('token') || '';
      if (orderId) {
        paymentAPI
          .capturePayPalOrder(orderId, requestId)
          .then(() => {
            alert('PayPal payment complete — session is prepaid. Recording is forbidden during your meeting.');
            loadMyRequests();
          })
          .catch((err) => console.error('PayPal capture:', err))
          .finally(() => {
            window.history.replaceState({}, '', window.location.pathname);
          });
      }
    }
  }, []);

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

  const refreshMyGuideStatus = () => {
    if (!user?.id) return;
    improvementAPI.getMyApplication(user.id).then(r => setMyApplication(r.application || null)).catch(() => setMyApplication(null));
      improvementAPI.getMyGuideProfile(user.id).then(r => {
        if (r.guide) setMyGuide(r.guide);
        else setMyGuide(null);
      }).catch(() => setMyGuide(null));
  };

  useEffect(() => {
    if (user?.id) {
      loadRecommended();
      loadMyRequests();
      improvementAPI.getMyBookings(user.id).then(r => setMyBookings(r.bookings || [])).catch(() => {});
      refreshMyGuideStatus();
    }
  }, [user?.id]);

  useEffect(() => {
    const onUpdate = () => {
      refreshMyGuideStatus();
      if (myGuide?.id) {
        improvementAPI.listPendingGuideApplications().then(r => setPendingGuideApps(r.applications || [])).catch(() => setPendingGuideApps([]));
      }
    };
    window.addEventListener('guide:application-updated', onUpdate);
    return () => window.removeEventListener('guide:application-updated', onUpdate);
  }, [user?.id, myGuide?.id]);

  useEffect(() => {
    if (myGuide?.id) {
      improvementAPI.getGuideRequests(myGuide.id).then(r => setGuideRequestsIncoming(r.requests || [])).catch(() => setGuideRequestsIncoming([]));
      improvementAPI.getGuideBookings(myGuide.id).then(r => setGuideBookings(r.bookings || [])).catch(() => setGuideBookings([]));
      improvementAPI.listPendingGuideApplications().then(r => setPendingGuideApps(r.applications || [])).catch(() => setPendingGuideApps([]));
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
      const res = await improvementAPI.getRecommendedGuides(
        user.id,
        region,
        user.country || undefined,
        user.city || undefined
      );
      setRecommendedGuides(res.guides || []);
      if (res.country && !clientRegion) setClientRegion([res.city, res.country].filter(Boolean).join(', '));
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
      const res = await improvementAPI.searchGuidesByProblem(
        q,
        region,
        user?.country || undefined,
        user?.city || undefined
      );
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
      const res = await improvementAPI.getGuidesForCategory(
        catId,
        region,
        user?.country || undefined,
        user?.city || undefined
      );
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

  const emptyProof = {
    whyGood: '',
    proofType: 'pictures' as const,
    instagramHandle: '',
    imageUrls: '',
    videoUrl: '',
  };

  const uploadCategoryProof = async (catId: string, files: FileList | null, kind: 'pictures' | 'video') => {
    if (!files?.length) return;
    const current = applyProofPerCategory[catId] || emptyProof;
    setProofUploading((prev) => ({ ...prev, [catId]: true }));
    setError('');
    try {
      const picked = kind === 'video' ? [files[0]] : Array.from(files).slice(0, 8);
      const urls: string[] = [];
      for (const file of picked) {
        if (kind === 'pictures' && !file.type.startsWith('image/')) continue;
        if (kind === 'video' && !file.type.startsWith('video/')) continue;
        urls.push(await prepareAndUploadFile(file, 'guide-proof'));
      }
      if (!urls.length) {
        setError(kind === 'video' ? 'Please choose a video file.' : 'Please choose a photo.');
        return;
      }
      setApplyProofPerCategory((prev) => {
        const cur = prev[catId] || { ...emptyProof, ...current };
        if (kind === 'video') {
          return { ...prev, [catId]: { ...cur, proofType: 'video', videoUrl: urls[0] } };
        }
        const existing = cur.imageUrls.split(/[\s,]+/).filter(Boolean);
        return { ...prev, [catId]: { ...cur, proofType: 'pictures', imageUrls: [...existing, ...urls].join(',') } };
      });
    } catch (err) {
      setError(formatAxiosError(err, 'Could not upload proof. Try a smaller photo or a shorter video.'));
    } finally {
      setProofUploading((prev) => ({ ...prev, [catId]: false }));
    }
  };

  const handleSubmitExpertApplication = async () => {
    if (!user?.id) return;
    if (applyCategories.length === 0) {
      setError('Select at least one category');
      return;
    }
    if (!applyRegion.trim()) {
      setError('Region is required (e.g. Munich, Europe)');
      return;
    }
    const proofPerCategory: Record<string, {
      whyGood: string;
      proofType: 'instagram' | 'pictures' | 'video';
      instagramHandle?: string;
      imageUrls?: string;
      videoUrl?: string;
    }> = {};
    for (const catId of applyCategories) {
      const p = applyProofPerCategory[catId] || {
        whyGood: '',
        proofType: 'pictures' as const,
        instagramHandle: '',
        imageUrls: '',
        videoUrl: '',
      };
      const whyGood = p.whyGood?.trim();
      if (!whyGood) {
        setError(`Explain why you're good at ${categories.find((c) => c.id === catId)?.name || catId}`);
        return;
      }
      const proofType = p.proofType || 'pictures';
      if (proofType === 'instagram' && !p.instagramHandle?.trim()) {
        setError(`Instagram handle required for ${categories.find((c) => c.id === catId)?.name || catId}`);
        return;
      }
      if (proofType === 'pictures' && !p.imageUrls?.trim()) {
        setError(`Upload at least one photo for ${categories.find((c) => c.id === catId)?.name || catId}`);
        return;
      }
      if (proofType === 'video' && !p.videoUrl?.trim()) {
        setError(`Upload a video for ${categories.find((c) => c.id === catId)?.name || catId}`);
        return;
      }
      proofPerCategory[catId] = {
        whyGood,
        proofType,
        ...(proofType === 'instagram' ? { instagramHandle: p.instagramHandle.trim() } : {}),
        ...(proofType === 'pictures' ? { imageUrls: p.imageUrls.trim() } : {}),
        ...(proofType === 'video' ? { videoUrl: p.videoUrl.trim() } : {}),
      };
    }
    setLoading(true);
    setError('');
    try {
      const res = await improvementAPI.applyAsGuide({
        userId: user.id,
        categories: applyCategories,
        region: applyRegion.trim(),
        experience: applyExperience.trim() || undefined,
        qualifications: applyQualifications.trim() || undefined,
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
      notifyDevice(
        res.autoApproved ? 'You are a qualified guide' : 'Application received',
        res.message
      );
      if (res.autoApproved && user?.id) {
        const g = await improvementAPI.getMyGuideProfile(user.id);
        if (g.guide) setMyGuide(g.guide);
      }
      alert(res.message);
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

  const handleApproveGuideApplicant = async (applicationId: string) => {
    if (!window.confirm('Approve this person as a qualified guide? They will be notified and can start guiding others.')) return;
    setLoading(true);
    setError('');
    try {
      await improvementAPI.approveGuideApplication(applicationId);
      const r = await improvementAPI.listPendingGuideApplications();
      setPendingGuideApps(r.applications || []);
      notifyDevice('Applicant approved', 'They were notified that they are qualified and can start guiding.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not approve');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectGuideApplicant = async (applicationId: string) => {
    if (!window.confirm('Reject this application? They will be notified.')) return;
    setLoading(true);
    setError('');
    try {
      await improvementAPI.rejectGuideApplication(applicationId);
      const r = await improvementAPI.listPendingGuideApplications();
      setPendingGuideApps(r.applications || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reject');
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
        const needSendProof = accepted && accepted.paymentStatus !== 'confirmed';
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
                  {(guide.qualifiedCoach || guide.badge) && (
                    <span style={{ fontSize: '10px', color: '#ff00ff' }}>✓ Qualified Coach</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  🌐 {guide.region}
                  {guide.user?.city || guide.user?.country ? ` · ${[guide.user.city, guide.user.country].filter(Boolean).join(', ')}` : ''}
                  &nbsp; ⭐ {(guide.coachStarRating ?? guide.rating ?? 0).toFixed(1)} qualification
                  &nbsp; {guide.totalSessions || 0} sessions &nbsp; €{guide.sessionPriceEur ?? SESSION_PRICE_EUR}/session
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
                    Send €{SESSION_PRICE_EUR} — prepay session
                  </button>
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
          You will get an answer within 48 hours. Qualified guides are reviewing your profile and the proofs you submitted in Compatibility.
        </div>
      )}
      {myApplication?.status === 'approved' && (
        <div style={{ marginBottom: '12px', padding: '12px', border: '2px solid rgba(34, 197, 94, 0.6)', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '13px' }}>
          You are a qualified guide. You can start guiding others now.
        </div>
      )}
      {myApplication?.status === 'rejected' && (
        <div style={{ marginBottom: '12px', padding: '12px', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '13px' }}>
          Your application was not approved. You can try again with stronger proof in the future.
        </div>
      )}

      {(myGuide || myApplication?.status === 'approved') && (
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

      {!myGuide && (!myApplication || myApplication.status === 'rejected') && (
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
            {myApplication?.status === 'rejected' ? 'Apply again with stronger proofs' : 'Apply to be an expert'}
          </button>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
            {myApplication?.status === 'rejected'
              ? 'Submit stronger proofs in Compatibility. First 10 qualified guides are approved immediately; after that you get an answer within 48 hours.'
              : 'First 10 qualified guides are approved immediately. After that, existing guides review your proofs and you get an answer within 48 hours.'}
          </p>
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
          <CoachVoteWidget />
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
        <GuidePrepayPanel
          requestId={acceptedRequestForPay.id}
          guideName={selectedGuide.user?.name || 'Guide'}
          onPaid={() => {
            setView('guides');
            setAcceptedRequestForPay(null);
            loadMyRequests();
            alert('Payment complete! Book your session time next.');
          }}
          onBack={() => {
            setView('guides');
            setAcceptedRequestForPay(null);
          }}
        />
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
          <h3 style={{ color: '#00d4ff', marginBottom: '8px', fontFamily: 'Orbitron, monospace' }}>Apply to be a guide</h3>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
            For each area: explain why you&apos;re good, then add proof (Instagram, photos, or video). If fewer than 10 qualified guides exist yet, you are approved automatically. Otherwise a qualified guide reviews your profile and proofs, and you get an answer within 48 hours.
          </p>
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
            const proof = applyProofPerCategory[catId] || {
              whyGood: '',
              proofType: 'pictures' as const,
              instagramHandle: '',
              imageUrls: '',
              videoUrl: '',
            };
            return (
              <div key={catId} style={{ ...cardStyle(), marginBottom: '12px' }}>
                <div style={{ color: '#00d4ff', fontSize: '12px', marginBottom: '6px' }}>{cat?.icon} {cat?.name}</div>
                <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: 4 }}>Why I&apos;m good at this</label>
                <textarea
                  value={proof.whyGood}
                  onChange={e => setApplyProofPerCategory(prev => ({
                    ...prev,
                    [catId]: { ...proof, whyGood: e.target.value },
                  }))}
                  placeholder="e.g. I've styled people for 5 years because..."
                  rows={2}
                  style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: 4 }}>Proof type</label>
                <select
                  value={proof.proofType}
                  onChange={e => setApplyProofPerCategory(prev => ({
                    ...prev,
                    [catId]: { ...proof, proofType: e.target.value as 'instagram' | 'pictures' | 'video' },
                  }))}
                  style={{ width: '100%', padding: '8px', marginBottom: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                >
                  <option value="instagram">Instagram proof (@handle or profile)</option>
                  <option value="pictures">Photo proof (upload)</option>
                  <option value="video">Video proof (upload)</option>
                </select>
                {proof.proofType === 'instagram' && (
                  <input
                    type="text"
                    value={proof.instagramHandle}
                    onChange={e => setApplyProofPerCategory(prev => ({ ...prev, [catId]: { ...proof, instagramHandle: e.target.value } }))}
                    placeholder="@yourhandle or instagram.com/you"
                    style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  />
                )}
                {proof.proofType === 'pictures' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={!!proofUploading[catId]}
                      onChange={(e) => {
                        void uploadCategoryProof(catId, e.target.files, 'pictures');
                        e.target.value = '';
                      }}
                      style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
                      {proofUploading[catId] ? 'Uploading photo…' : 'Choose one or more photos from your phone or computer.'}
                    </p>
                    {proof.imageUrls.trim() && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {proof.imageUrls.split(/[\s,]+/).filter(Boolean).map((url) => (
                          <div key={url} style={{ position: 'relative' }}>
                            <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,212,255,0.4)' }} />
                            <button
                              type="button"
                              onClick={() => {
                                const next = proof.imageUrls.split(/[\s,]+/).filter((u) => u && u !== url).join(',');
                                setApplyProofPerCategory((prev) => ({ ...prev, [catId]: { ...proof, imageUrls: next } }));
                              }}
                              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: '20px' }}
                              aria-label="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {proof.proofType === 'video' && (
                  <div>
                    <input
                      type="file"
                      accept="video/*"
                      disabled={!!proofUploading[catId]}
                      onChange={(e) => {
                        void uploadCategoryProof(catId, e.target.files, 'video');
                        e.target.value = '';
                      }}
                      style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
                      {proofUploading[catId] ? 'Uploading video…' : 'Choose a video from your phone or computer.'}
                    </p>
                    {proof.videoUrl.trim() && (
                      <div style={{ marginTop: 8 }}>
                        <video src={proof.videoUrl} controls playsInline style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }} />
                        <button
                          type="button"
                          onClick={() => setApplyProofPerCategory((prev) => ({ ...prev, [catId]: { ...proof, videoUrl: '' } }))}
                          style={{ marginTop: 6, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Remove video
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {applyCategories.length > 0 && (
            <>
              <label style={{ display: 'block', marginBottom: '6px', color: '#00d4ff', fontSize: '12px' }}>Your region (required)</label>
              <input type="text" value={applyRegion} onChange={e => setApplyRegion(e.target.value)} placeholder="e.g. Munich, Europe, Global" style={{ width: '100%', padding: '10px', marginBottom: '16px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.4)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <button type="button" onClick={handleSubmitExpertApplication} disabled={loading || Object.values(proofUploading).some(Boolean)} style={{ padding: '12px 20px', background: 'rgba(0, 212, 255, 0.3)', border: '2px solid #00d4ff', borderRadius: '8px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Submitting...' : Object.values(proofUploading).some(Boolean) ? 'Uploading proof…' : 'Submit application'}</button>
            </>
          )}
        </div>
      )}

      {view === 'expert_dashboard' && myGuide && (
        <div>
          <button type="button" onClick={() => setView('main')} style={{ marginBottom: '12px', background: 'transparent', border: '2px solid #00d4ff', color: '#00d4ff', padding: '8px 14px', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>← Back to Compatibility</button>
          <h3 style={{ color: '#22c55e', marginBottom: '12px', fontFamily: 'Orbitron, monospace' }}>Expert dashboard</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {(['requests', 'applications', 'upcoming', 'previous', 'availability', 'wallet'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setExpertTab(tab);
                  if (tab === 'wallet') {
                    walletAPI.getMyWallet().then(setWalletSummary).catch(() => {});
                  }
                  if (tab === 'applications') {
                    improvementAPI.listPendingGuideApplications().then(r => setPendingGuideApps(r.applications || [])).catch(() => setPendingGuideApps([]));
                  }
                }}
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
                {tab === 'applications' && `Guide applicants (${pendingGuideApps.length})`}
                {tab === 'upcoming' && 'Upcoming'}
                {tab === 'previous' && 'Previous clients'}
                {tab === 'availability' && 'Set availability'}
                {tab === 'wallet' && 'Earnings & withdraw'}
              </button>
            ))}
          </div>
          {expertTab === 'applications' && (
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {pendingGuideApps.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>No pending guide applications.</p>
              ) : (
                pendingGuideApps.map((app) => {
                  const answers = app.widgetAnswers?.length
                    ? app.widgetAnswers
                    : Object.entries(app.proofPerCategory || {}).map(([categoryId, p]) => ({
                        categoryId,
                        whyGood: p.whyGood || p.description || '',
                        proofType: p.proofType || 'pictures',
                        instagramHandle: p.instagramHandle,
                        imageUrls: p.imageUrls,
                        videoUrl: p.videoUrl,
                        fileUrls: [...(p.imageUrls || []), ...(p.videoUrl ? [p.videoUrl] : [])],
                      }));
                  return (
                    <div key={app.id} style={cardStyle()}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                        {app.applicant?.profilePicture ? (
                          <img src={app.applicant.profilePicture} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d4ff' }}>
                            {(app.applicant?.name || '?')[0]}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{app.applicant?.name || 'Applicant'}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>
                            {app.applicant?.username ? `@${app.applicant.username}` : ''}
                            {app.applicant?.age ? ` · ${app.applicant.age}` : ''}
                            {app.applicant?.city || app.applicant?.country ? ` · ${[app.applicant.city, app.applicant.country].filter(Boolean).join(', ')}` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#00d4ff', marginTop: 2 }}>Region: {app.region}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${app.userId}`)}
                        style={{ marginBottom: 10, padding: '6px 12px', background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff', borderRadius: 8, fontFamily: 'Orbitron, monospace', fontSize: 11, cursor: 'pointer' }}
                      >
                        View profile
                      </button>
                      {answers.map((a) => (
                        <div key={a.categoryId} style={{ marginBottom: 10, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#00d4ff', marginBottom: 4 }}>{categories.find((c) => c.id === a.categoryId)?.name || a.categoryId}</div>
                          <p style={{ fontSize: 12, color: '#e5e7eb', margin: 0 }}>{a.whyGood}</p>
                          {a.instagramHandle && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Instagram: @{a.instagramHandle}</p>}
                          {a.imageUrls && a.imageUrls.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                              {a.imageUrls.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                                </a>
                              ))}
                            </div>
                          )}
                          {a.videoUrl && (
                            <video src={a.videoUrl} controls style={{ width: '100%', maxHeight: 160, marginTop: 6, borderRadius: 8 }} />
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => handleApproveGuideApplicant(app.id)} disabled={loading} style={{ padding: '8px 14px', background: 'rgba(34, 197, 94, 0.3)', border: '2px solid #22c55e', color: '#22c55e', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>
                          Yes, they are approved
                        </button>
                        <button type="button" onClick={() => handleRejectGuideApplicant(app.id)} disabled={loading} style={{ padding: '8px 14px', background: 'transparent', border: '2px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontFamily: 'Orbitron, monospace', cursor: 'pointer' }}>
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
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
          {expertTab === 'wallet' && (
            <div>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
                OnlyFans-style split: you keep {walletSummary?.split.guidePercent ?? 80}% per session. Withdraw to PayPal when ready (min €
                {walletSummary?.split.minWithdrawalEur ?? 20}).
              </p>
              {walletSummary ? (
                <>
                  <div style={cardStyle()}>
                    <div>Available: €{walletSummary.wallet.availableBalanceEur.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Pending withdrawal: €{walletSummary.wallet.pendingBalanceEur.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Total earned: €{walletSummary.wallet.totalEarnedEur.toFixed(2)}</div>
                  </div>
                  <label style={{ display: 'block', marginTop: 12, marginBottom: 6, color: '#00d4ff', fontSize: 12 }}>PayPal email for payouts</label>
                  <input
                    type="text"
                    value={walletPaypal || walletSummary.wallet.paypalEmail || ''}
                    onChange={(e) => setWalletPaypal(e.target.value)}
                    placeholder="you@email.com"
                    style={{ width: '100%', padding: 10, marginBottom: 8, background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: 8, color: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await walletAPI.setPaypalEmail(walletPaypal || walletSummary.wallet.paypalEmail || '');
                        alert('PayPal saved');
                      } catch (err: unknown) {
                        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{ padding: '8px 14px', marginBottom: 12, background: 'rgba(0,112,186,0.3)', border: '2px solid #0070ba', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
                  >
                    Save PayPal
                  </button>
                  <label style={{ display: 'block', marginBottom: 6, color: '#00d4ff', fontSize: 12 }}>Withdraw amount (€)</label>
                  <input
                    type="number"
                    min={walletSummary.split.minWithdrawalEur}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    style={{ width: '100%', padding: 10, marginBottom: 8, background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: 8, color: '#fff' }}
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      const amt = parseFloat(withdrawAmount);
                      if (!amt) return;
                      setLoading(true);
                      try {
                        await walletAPI.withdraw(amt, walletPaypal || walletSummary.wallet.paypalEmail || undefined);
                        alert('Withdrawal requested — processed via PayPal like OnlyFans payouts.');
                        setWithdrawAmount('');
                        walletAPI.getMyWallet().then(setWalletSummary);
                      } catch (err: unknown) {
                        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Withdrawal failed');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{ padding: '10px 18px', background: 'rgba(34, 197, 94, 0.3)', border: '2px solid #22c55e', color: '#22c55e', borderRadius: 8, cursor: 'pointer' }}
                  >
                    Request withdrawal
                  </button>
                  <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 12 }}>
                    Session rules: no video recording. Share tips, not every secret — keep your edge as a guide.
                  </p>
                </>
              ) : (
                <p style={{ color: '#9ca3af' }}>Loading wallet…</p>
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
