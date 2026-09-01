import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { improvementAPI, ImprovementCategory, Guide, AvailabilitySlot, Booking } from '../../api/improvement';
import { paymentAPI } from '../../api/improvement';
import './Widget.css';

function clipText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const ImprovementWidgetFull = () => {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<'start' | 'region' | 'categories' | 'guides' | 'booking' | 'apply'>('start');
  const [guidedPath, setGuidedPath] = useState(false);
  const [userRegion, setUserRegion] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

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
    setLoading(true);
    setError('');
    try {
      const response = await improvementAPI.getCategories();
      setCategories(response.categories);
      setError('');
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load categories.';
      setError(`Unable to connect to server. Please ensure the backend server is running on port 5000. Error: ${errorMessage}`);
    } finally {
      setLoading(false);
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
    <div className="widget-full-content">
      {error && (
        <div className="error-message" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          alignItems: 'center'
        }}>
          <div>{error}</div>
          <button 
            onClick={loadCategories} 
            className="select-user-btn"
            style={{ padding: '8px 16px', fontSize: '14px' }}
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {view === 'start' && (
        <div className="improvement-content">
          <p style={{ marginBottom: '16px', color: '#374151', lineHeight: 1.5 }}>
            Want a certified guide to help you improve? We’ll ask your region next, then the areas you care about, then
            you’ll pick an expert by name and expertise.
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
              style={{ background: '#6b7280', border: '2px solid #4b5563' }}
            >
              Browse topics on my own
            </button>
          </div>
        </div>
      )}

      {view === 'region' && (
        <div className="improvement-content">
          <button
            type="button"
            onClick={() => setView('start')}
            className="back-btn"
            style={{ marginBottom: '12px' }}
          >
            ← Back
          </button>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>Your country or region</h3>
          <p style={{ marginBottom: '12px', color: '#6b7280', fontSize: '14px', lineHeight: 1.45 }}>
            Experts who serve your area appear first. Leave blank to see guides worldwide.
          </p>
          <input
            type="text"
            value={userRegion}
            onChange={(e) => setUserRegion(e.target.value)}
            placeholder="e.g. Germany, UK, Texas"
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '14px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '15px',
            }}
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
                padding: '10px 12px',
                background: '#f0f9ff',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#0369a1',
              }}
            >
              Region: <strong>{userRegion.trim() || 'Worldwide'}</strong>
              <button
                type="button"
                onClick={() => setView('region')}
                style={{ marginLeft: '10px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1' }}
              >
                Edit
              </button>
            </div>
          )}
          {loading && categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading categories...</div>
          ) : (
            <>
              <p style={{ marginBottom: '16px', color: '#6b7280' }}>
                {guidedPath
                  ? 'Select a topic. Next you’ll see guides with names, regions, and expertise — pick who fits you best.'
                  : 'Select an area you want to improve, then browse available guides.'}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px',
                maxHeight: '500px',
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
            <button
              onClick={() => setView('apply')}
              className="select-user-btn"
              style={{ marginTop: '16px', width: '100%' }}
            >
              Apply to Become a Guide
            </button>
            </>
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
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              Showing experts for <strong>{userRegion.trim() || 'all regions'}</strong> in this topic. Tap Book on the guide you want.
            </p>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading guides...</div>
          ) : guides.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No guides available for this category yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
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
                      🌐 {guide.region} • ${guide.hourlyRate}/hr • ⭐ {guide.rating.toFixed(1)} • {guide.totalSessions} sessions
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
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#4b5563', lineHeight: 1.4 }}>
                        {guide.experience && (
                          <div>
                            <strong>Experience:</strong> {clipText(guide.experience, 140)}
                          </div>
                        )}
                        {guide.qualifications && (
                          <div style={{ marginTop: '4px' }}>
                            <strong>Credentials:</strong> {clipText(guide.qualifications, 140)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleBookGuide(guide)}
                    className="send-btn"
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          )}
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
              <strong>Experience:</strong> {clipText(selectedGuide.experience || '', 160)}
            </p>
          </div>

          <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>Available Times</h4>
          {availability.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
              No available slots. Please check back later.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
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
              {loading ? 'Processing...' : `Proceed to Checkout ($${selectedGuide.hourlyRate})`}
            </button>
          )}
        </div>
      )}

      {view === 'apply' && <GuideApplicationForm onBack={() => setView('categories')} />}
    </div>
  );
};

const GuideApplicationForm = ({ onBack }: { onBack: () => void }) => {
  const { user } = useContext(AuthContext);
  const [categories, setCategories] = useState<ImprovementCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
        experience,
        qualifications,
        identificationUrl: identificationUrl || 'uploaded-id-url',
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
          maxHeight: '200px',
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
          placeholder="Upload ID document (URL - in production, use file upload)"
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

export default ImprovementWidgetFull;

