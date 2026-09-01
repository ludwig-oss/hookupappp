import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { improvementAPI, paymentAPI, SESSION_PRICE_EUR, ImprovementCategory, Guide, AvailabilitySlot, Booking, GuideRequest } from '../../api/improvement';
import './Widget.css';

// Stripe is only used in Checkout page, not in widget

function clipText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const ImprovementWidget = () => {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<
    'start' | 'region' | 'categories' | 'guides' | 'request' | 'send_proof' | 'booking' | 'apply' | 'trainer_paypal' | 'trainer_confirm'
  >('start');
  const [guidedPath, setGuidedPath] = useState(false);
  const [userRegion, setUserRegion] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [myRequests, setMyRequests] = useState<GuideRequest[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [acceptedRequestForProof, setAcceptedRequestForProof] = useState<GuideRequest | null>(null);
  const [proofText, setProofText] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [myPaypalInfo, setMyPaypalInfo] = useState('');
  const [myGuideId, setMyGuideId] = useState<string | null>(null);
  const [guideRequestsForMe, setGuideRequestsForMe] = useState<GuideRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (user?.id) {
      improvementAPI.getMyGuideProfile(user.id).then((res: any) => {
        if (res.guide) {
          setMyGuideId(res.guide.id);
          setMyPaypalInfo(res.guide.paypalInfo || '');
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedCategory && view === 'guides') {
      loadGuides();
    }
  }, [selectedCategory, view]);

  useEffect(() => {
    if (selectedGuide) {
      loadAvailability();
    }
  }, [selectedGuide]);

  const loadCategories = async () => {
    try {
      const response = await improvementAPI.getCategories();
      setCategories(response.categories);
      setError('');
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err.response?.data?.error || 'Failed to load categories. Make sure the server is running on port 5000.');
    }
  };

  const loadGuides = async () => {
    setLoading(true);
    try {
      const region =
        guidedPath && userRegion.trim() ? userRegion.trim() : undefined;
      const response = await improvementAPI.getGuidesForCategory(selectedCategory, region);
      setGuides(response.guides);
    } catch (err) {
      setError('Failed to load guides');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!selectedGuide) return;
    try {
      const response = await improvementAPI.getGuideAvailability(selectedGuide.id);
      setAvailability(response.availability);
    } catch (err) {
      setError('Failed to load availability');
    }
  };

  const loadMyRequests = async () => {
    if (!user?.id) return;
    try {
      const response = await improvementAPI.getMyGuideRequests(user.id);
      setMyRequests(response.requests);
    } catch (err) {
      console.error('Failed to load requests:', err);
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
        category: selectedCategory,
        message: requestMessage,
        userId: user.id,
      });
      setRequestMessage('');
      setView('guides');
      loadMyRequests();
      alert('Request sent! The guide will review and respond.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const handleBookGuide = (guide: Guide) => {
    setSelectedGuide(guide);
    setView('booking');
  };

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
  };

  const handleCreateBooking = async () => {
    if (!selectedGuide || !selectedSlot || !user) return;

    setLoading(true);
    setError('');

    try {
      const duration = 60;
      const startTime = selectedSlot.startTime;
      const endTime = selectedSlot.endTime;
      const acceptedReq = myRequests.find(r => r.guideId === selectedGuide.id && r.category === selectedCategory && r.status === 'accepted' && r.paymentStatus === 'confirmed');

      if (acceptedReq && acceptedReq.paymentStatus === 'confirmed') {
        await improvementAPI.createBooking({
          guideId: selectedGuide.id,
          category: selectedCategory,
          startTime,
          endTime,
          duration,
          userId: user.id,
          requestId: acceptedReq.id,
        });
        setView('guides');
        setSelectedSlot(null);
        loadMyRequests();
        alert('Appointment booked! Join the video call at the scheduled time.');
        return;
      }

      const bookingResponse = await improvementAPI.createBooking({
        guideId: selectedGuide.id,
        category: selectedCategory,
        startTime,
        endTime,
        duration,
        userId: user.id,
      });

      const paymentResponse = await paymentAPI.createPaymentIntent(
        bookingResponse.booking.amount,
        bookingResponse.booking.id
      );

      localStorage.setItem('pendingBooking', JSON.stringify({
        booking: bookingResponse.booking,
        clientSecret: paymentResponse.clientSecret,
        paymentIntentId: paymentResponse.paymentIntentId,
      }));

      window.location.href = '/checkout';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="widget">
      <h2 className="widget-title">
        <span>💪</span> Self Improvement
      </h2>

      {error && <div className="error-message">{error}</div>}

      {view === 'start' && (
        <div className="improvement-content">
          <p style={{ marginBottom: '16px', color: '#6b7280', lineHeight: 1.5 }}>
            Want a guide to help you improve? We’ll ask your region, then your focus areas, then you’ll pick an expert by
            name and expertise.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setGuidedPath(true);
                setView('region');
              }}
              className="select-user-btn"
            >
              Yes — match me with guides
            </button>
            <button
              type="button"
              onClick={() => {
                setGuidedPath(false);
                setUserRegion('');
                setView('categories');
              }}
              className="select-user-btn"
              style={{ background: '#6b7280' }}
            >
              Browse topics on my own
            </button>
          </div>
        </div>
      )}

      {view === 'region' && (
        <div className="improvement-content">
          <button type="button" onClick={() => setView('start')} className="back-btn" style={{ marginBottom: '12px' }}>
            ← Back
          </button>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Your country or region</h3>
          <p style={{ marginBottom: '10px', fontSize: '13px', color: '#6b7280' }}>
            Experts in your area are shown first. Leave blank for worldwide.
          </p>
          <input
            type="text"
            value={userRegion}
            onChange={(e) => setUserRegion(e.target.value)}
            placeholder="e.g. Germany, UK, Texas"
            style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
          />
          <button type="button" onClick={() => setView('categories')} className="select-user-btn" style={{ width: '100%' }}>
            Continue — choose focus areas
          </button>
        </div>
      )}

      {view === 'categories' && (
        <div className="improvement-content">
          <button
            type="button"
            onClick={() => (guidedPath ? setView('region') : setView('start'))}
            className="back-btn"
            style={{ marginBottom: '12px' }}
          >
            ← Back
          </button>
          {guidedPath && (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px 10px',
                background: '#f0f9ff',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#0369a1',
              }}
            >
              Region: <strong>{userRegion.trim() || 'Worldwide'}</strong>
              <button
                type="button"
                onClick={() => setView('region')}
                style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Edit
              </button>
            </div>
          )}
          <p style={{ marginBottom: '16px', color: '#6b7280' }}>
            {guidedPath
              ? 'Pick a topic. Next you’ll see guides with names, regions, and expertise.'
              : 'Select an area you want to improve and find expert guides to help you.'}
          </p>
          {user?.improvementCategories && user.improvementCategories.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#374151' }}>Your Selected Categories:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {user.improvementCategories.map((catId: string) => {
                  const cat = categories.find(c => c.id === catId);
                  if (!cat) return null;
                  return (
                    <span
                      key={catId}
                      onClick={() => {
                        setSelectedCategory(catId);
                        setView('guides');
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#ff6b9d',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {cat.icon} {cat.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '10px',
            maxHeight: '350px',
            overflowY: 'auto',
          }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setView('guides');
                }}
                style={{
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ff6b9d';
                  e.currentTarget.style.background = '#fff5f8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = 'white';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{cat.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>{cat.name}</div>
              </div>
            ))}
          </div>
          {myGuideId && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setView('trainer_paypal')} className="select-user-btn" style={{ background: '#0070ba', color: '#fff' }}>
                Trainer: My PayPal info
              </button>
              <button onClick={async () => { setView('trainer_confirm'); const res = await improvementAPI.getGuideRequests(myGuideId!); setGuideRequestsForMe(res.requests || []); }} className="select-user-btn" style={{ background: '#059669', color: '#fff' }}>
                Trainer: Pending confirmations
              </button>
            </div>
          )}
          <button
            onClick={() => setView('apply')}
            className="select-user-btn"
            style={{ marginTop: '16px', width: '100%' }}
          >
            Apply to Become a Guide
          </button>
        </div>
      )}

      {view === 'trainer_paypal' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => setView('categories')} className="back-btn">← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Your PayPal info</h3>
          </div>
          <p style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>Users will send €50 here. Enter your PayPal email or PayPal.me link.</p>
          <input type="text" value={myPaypalInfo} onChange={e => setMyPaypalInfo(e.target.value)} placeholder="e.g. you@email.com or https://paypal.me/yourname" style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
          <button onClick={async () => { setLoading(true); try { await paymentAPI.setMyPaypalInfo(myPaypalInfo.trim()); alert('Saved.'); setView('categories'); } catch (err: any) { setError(err.response?.data?.error || 'Failed'); } finally { setLoading(false); }} } className="select-user-btn" disabled={loading} style={{ width: '100%' }}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      )}

      {view === 'trainer_confirm' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => setView('categories')} className="back-btn">← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Confirm payment received</h3>
          </div>
          <p style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>Users have sent €50 and submitted proof. Confirm within 48 hours so they can book.</p>
          {guideRequestsForMe.filter(r => r.paymentStatus === 'sent_pending_confirmation').length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No pending confirmations.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
              {guideRequestsForMe.filter(r => r.paymentStatus === 'sent_pending_confirmation').map(req => (
                <div key={req.id} style={{ padding: '14px', border: '2px solid #e5e7eb', borderRadius: '10px', background: '#f9fafb' }}>
                  <div style={{ marginBottom: '8px' }}>Request: {req.category} • {req.paymentProofText}</div>
                  {req.paymentProofImageUrl && <a href={req.paymentProofImageUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>View proof image</a>}
                  <button onClick={async () => { setLoading(true); try { await paymentAPI.confirmPaymentReceived(req.id); setGuideRequestsForMe(prev => prev.map(r => r.id === req.id ? { ...r, paymentStatus: 'confirmed' as const } : r)); } catch (err: any) { setError(err.response?.data?.error || 'Failed'); } finally { setLoading(false); }} } className="send-btn" style={{ background: '#059669', color: '#fff' }} disabled={loading}>Confirm I received the money</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'guides' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => { setView('categories'); setSelectedCategory(''); }} className="back-btn">
              ← Back
            </button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              Choose a guide — {categories.find(c => c.id === selectedCategory)?.name}
            </h3>
          </div>
          {guidedPath && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
              Experts for <strong>{userRegion.trim() || 'all regions'}</strong> in this topic.
            </p>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading guides...</div>
          ) : guides.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No guides available for this category yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
              {guides.map((guide) => (
                <div
                  key={guide.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <div className="user-avatar" style={{ width: '50px', height: '50px' }}>
                    {guide.user?.profilePicture ? (
                      <img src={guide.user.profilePicture} alt={guide.user.name} />
                    ) : (
                      <div className="avatar-placeholder">{guide.user?.name[0] || 'G'}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px' }}>{guide.user?.name}</h4>
                      {guide.badge && <span style={{ fontSize: '12px' }}>✓ Verified Guide</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      🌐 {guide.region} • ${guide.hourlyRate}/hr • ⭐ {guide.rating.toFixed(1)} • {guide.totalSessions}{' '}
                      sessions
                    </p>
                    {(guide.categories?.length ?? 0) > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {guide.categories
                          .map((id) => categories.find((c) => c.id === id)?.name)
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((name) => (
                            <span
                              key={`${guide.id}-${name}`}
                              style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: '#fff5f8',
                                border: '1px solid #fecdd3',
                                color: '#9f1239',
                              }}
                            >
                              {name}
                            </span>
                          ))}
                      </div>
                    )}
                    {(guide.experience || guide.qualifications) && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#4b5563', lineHeight: 1.35 }}>
                        {guide.experience && (
                          <div>
                            <strong>Experience:</strong> {clipText(guide.experience, 120)}
                          </div>
                        )}
                        {guide.qualifications && (
                          <div style={{ marginTop: '2px' }}>
                            <strong>Credentials:</strong> {clipText(guide.qualifications, 120)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const acceptedRequest = myRequests.find(
                      r => r.guideId === guide.id && r.category === selectedCategory && r.status === 'accepted'
                    );
                    const pendingRequest = myRequests.find(
                      r => r.guideId === guide.id && r.category === selectedCategory && r.status === 'pending'
                    );
                    const needSendProof = acceptedRequest && acceptedRequest.paymentStatus !== 'sent_pending_confirmation' && acceptedRequest.paymentStatus !== 'confirmed';
                    const waitingConfirmation = acceptedRequest && acceptedRequest.paymentStatus === 'sent_pending_confirmation';
                    const confirmed = acceptedRequest && acceptedRequest.paymentStatus === 'confirmed';

                    if (needSendProof) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedGuide(guide);
                            setView('send_proof');
                            setAcceptedRequestForProof(acceptedRequest!);
                          }}
                          className="send-btn"
                          style={{ background: '#ffa500', color: '#000' }}
                        >
                          Send €{SESSION_PRICE_EUR} & proof
                        </button>
                      );
                    } else if (waitingConfirmation) {
                      return <span style={{ fontSize: '12px', color: '#9ca3af' }}>Waiting trainer confirm (48h)</span>;
                    } else if (confirmed) {
                      return (
                        <button
                          onClick={() => handleBookGuide(guide)}
                          className="send-btn"
                          style={{ background: '#10b981' }}
                        >
                          Book appointment
                        </button>
                      );
                    } else if (pendingRequest) {
                      return (
                        <button
                          className="send-btn"
                          disabled
                          style={{ background: '#9ca3af', cursor: 'not-allowed' }}
                        >
                          Pending
                        </button>
                      );
                    } else {
                      return (
                        <button
                          onClick={() => handleSendRequest(guide)}
                          className="send-btn"
                        >
                          Send Request
                        </button>
                      );
                    }
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'request' && selectedGuide && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => { setView('guides'); setRequestMessage(''); }} className="back-btn">
              ← Back
            </button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Send Request to {selectedGuide.user?.name}</h3>
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>Category:</strong> {categories.find(c => c.id === selectedCategory)?.name}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '14px' }}>
              <strong>Session:</strong> €{selectedGuide.sessionPriceEur ?? 50} — Send via PayPal (trainer&apos;s info) then submit proof; they confirm within 48h, then you book.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Message (Optional)
            </label>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Tell the guide why you're interested in their help..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            onClick={handleSubmitRequest}
            className="select-user-btn"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      )}

      {view === 'send_proof' && selectedGuide && acceptedRequestForProof && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => { setView('guides'); setAcceptedRequestForProof(null); }} className="back-btn">← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Send €{SESSION_PRICE_EUR} & proof to {selectedGuide.user?.name}</h3>
          </div>
          <p style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>
            Send €{SESSION_PRICE_EUR} to the trainer&apos;s PayPal below. Then submit proof (e.g. transaction ID or screenshot URL). They have 48 hours to confirm; then you can book.
          </p>
          {selectedGuide.paypalInfo ? (
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Trainer&apos;s PayPal (send €{SESSION_PRICE_EUR} here):</div>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedGuide.paypalInfo}</div>
            </div>
          ) : (
            <p style={{ color: '#b45309', marginBottom: '12px' }}>This trainer has not set their PayPal info yet.</p>
          )}
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Proof of payment (required) *</label>
          <textarea value={proofText} onChange={e => setProofText(e.target.value)} placeholder="e.g. Transaction ID or note" rows={3} style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Proof image URL (optional)</label>
          <input type="text" value={proofImageUrl} onChange={e => setProofImageUrl(e.target.value)} placeholder="https://... screenshot" style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
          <button
            onClick={async () => {
              if (!proofText.trim()) { setError('Enter proof of payment'); return; }
              setLoading(true);
              setError('');
              try {
                await paymentAPI.submitPaymentProof(acceptedRequestForProof.id, proofText.trim(), proofImageUrl.trim() || undefined);
                setView('guides');
                setAcceptedRequestForProof(null);
                loadMyRequests();
                alert('Proof submitted. Trainer has up to 48 hours to confirm.');
              } catch (err: any) {
                setError(err.response?.data?.error || 'Failed');
              } finally {
                setLoading(false);
              }
            }}
            className="select-user-btn"
            disabled={loading || !selectedGuide.paypalInfo}
            style={{ width: '100%' }}
          >
            {loading ? 'Submitting...' : 'Submit proof'}
          </button>
        </div>
      )}

      {view === 'booking' && selectedGuide && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => { setView('guides'); setSelectedSlot(null); }} className="back-btn">
              ← Back
            </button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Book {selectedGuide.user?.name}</h3>
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>Rate:</strong> ${selectedGuide.hourlyRate}/hour
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '14px' }}>
              <strong>Experience:</strong> {selectedGuide.experience.substring(0, 100)}...
            </p>
          </div>

          <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>Available Times</h4>
          {availability.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
              No available slots. Please check back later.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {availability.map((slot) => (
                <div
                  key={slot.id}
                  onClick={() => handleSelectSlot(slot)}
                  style={{
                    padding: '12px',
                    border: `2px solid ${selectedSlot?.id === slot.id ? '#ff6b9d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedSlot?.id === slot.id ? '#fff5f8' : 'white',
                  }}
                >
                  {new Date(slot.startTime).toLocaleString()} - {new Date(slot.endTime).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}

          {selectedSlot && (
            <button
              onClick={handleCreateBooking}
              className="select-user-btn"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Processing...' : myRequests.some(r => r.guideId === selectedGuide.id && r.category === selectedCategory && r.status === 'accepted' && r.paymentStatus === 'confirmed')
                ? 'Confirm appointment'
                : `Proceed to Checkout ($${selectedGuide.hourlyRate})`}
            </button>
          )}
        </div>
      )}

      {view === 'apply' && (
        <GuideApplicationForm onBack={() => setView('categories')} />
      )}
    </div>
  );
};

const GuideApplicationForm = ({ onBack }: { onBack: () => void }) => {
  const { user } = useContext(AuthContext);
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [experience, setExperience] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [identificationUrl, setIdentificationUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await improvementAPI.getCategories();
      setCategories(response.categories);
    } catch (err) {
      setError('Failed to load categories');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedCategories.length === 0) {
      setError('Select at least one category');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await improvementAPI.applyAsGuide({
        categories: selectedCategories,
        region: region || 'Global',
        experience,
        qualifications,
        identificationUrl: identificationUrl || 'uploaded-id-url', // In production, upload file first
        userId: user.id,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h3 style={{ marginBottom: '12px' }}>Application Submitted!</h3>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
          You will get an answer within 48 hours. Qualified guides review your Compatibility proofs. If you are approved, you will be notified that you can start guiding others.
        </p>
        <button onClick={onBack} className="select-user-btn">Back to Categories</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="improvement-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button type="button" onClick={onBack} className="back-btn">← Back</button>
        <h3 style={{ margin: 0, fontSize: '18px' }}>Apply as Guide</h3>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>Select Your Expertise Areas</label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '8px',
          maxHeight: '150px',
          overflowY: 'auto',
          marginTop: '8px',
        }}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedCategories(prev =>
                  prev.includes(cat.id)
                    ? prev.filter(id => id !== cat.id)
                    : [...prev, cat.id]
                );
              }}
              style={{
                padding: '10px',
                border: `2px solid ${selectedCategories.includes(cat.id) ? '#ff6b9d' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedCategories.includes(cat.id) ? '#fff5f8' : 'white',
                textAlign: 'center',
                fontSize: '12px',
              }}
            >
              {cat.icon} {cat.name}
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Region (e.g. Europe, US, Global)</label>
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Global"
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
      </div>

      <div className="form-group">
        <label>Your Experience</label>
        <textarea
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          required
          placeholder="Describe your experience and expertise..."
          rows={4}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div className="form-group">
        <label>Qualifications</label>
        <textarea
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          required
          placeholder="List your qualifications, certifications, etc..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div className="form-group">
        <label>Upload Identification Document</label>
        <input
          type="text"
          value={identificationUrl}
          onChange={(e) => setIdentificationUrl(e.target.value)}
          required
          placeholder="ID document URL or upload link"
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <small style={{ color: '#6b7280', fontSize: '12px' }}>
          Apply from Compatibility with text and file proofs. Fewer than 10 qualified guides are approved immediately; otherwise you get an answer within 48 hours.
        </small>
      </div>

      <button type="submit" className="select-user-btn" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
};

export default ImprovementWidget;

