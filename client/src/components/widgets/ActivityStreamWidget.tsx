import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { activityAPI, fetchCountries, fetchCities, Interest, PreCommProfile } from '../../api/activity';
import { openChatWithUser } from '../../lib/openChat';
import './Widget.css';

const SAFETY_WARNING = (
  <div style={{
    padding: '12px', marginBottom: '16px', borderRadius: '10px',
    background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.5)',
    color: '#fca5a5', fontSize: '12px', fontFamily: 'Orbitron, monospace',
  }}>
    <strong>⚠ Safety:</strong> Never send money or sensitive personal info. When you meet, do it in a <strong>public, safe place</strong>—not somewhere you can be set up. Trust slowly. If you need to talk to their family or friends, get to know them first.
  </div>
);

export default function ActivityStreamWidget({ onOpenChat }: { onOpenChat?: (userId: string) => void }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [view, setView] = useState<'search' | 'list' | 'received' | 'precomm'>('search');
  const [countries, setCountries] = useState<{ country: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [regionUsers, setRegionUsers] = useState<Array<{ id: string; name: string; username: string; profilePicture: string | null; country?: string; city?: string }>>([]);
  const [sent, setSent] = useState<Interest[]>([]);
  const [received, setReceived] = useState<Interest[]>([]);
  const [quota, setQuota] = useState<{ acceptedCount: number; freeLimit: number; tier: string; requiresPremium: boolean } | null>(null);
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(null);
  const [preCommData, setPreCommData] = useState({
    whatLookingFor: '', howWillMeet: '', canAffordTravelProof: '', willingToMoveWhere: '',
    whereWork: '', whereLive: '', whereChill: '', name: '', familyFriends: '',
  });
  const [preCommProfiles, setPreCommProfiles] = useState<PreCommProfile[]>([]);
  const [canChat, setCanChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  useEffect(() => {
    fetchCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (country) fetchCities(country).then(setCities).catch(() => setCities([]));
    else setCities([]);
  }, [country]);

  useEffect(() => {
    if (user?.id) loadInterests();
  }, [user?.id]);

  const loadInterests = () => {
    if (!user?.id) return;
    activityAPI.getMyInterests().then(({ sent: s, received: r, quota: q }) => {
      setSent(s);
      setReceived(r);
      if (q) setQuota(q);
    }).catch(() => {});
  };

  const loadRegion = async () => {
    const countryVal = (country || countrySearch).trim();
    if (!countryVal) { setError('Enter or select a country'); return; }
    setLoading(true);
    setError('');
    try {
      const { users } = await activityAPI.getRegionUsers(countryVal, (city || citySearch).trim() || undefined);
      setRegionUsers(users);
      if (!country) setCountry(countryVal);
      setView('list');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load region');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInterest = async (toUserId: string) => {
    if (!user?.id) return;
    if (quota?.requiresPremium) {
      setError(`You used your ${quota.freeLimit} free accepted interests. Pick Plus, Gold, or Platinum for unlimited connections.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await activityAPI.sendInterest(toUserId);
      loadInterests();
      const chatId = (res as { chatUserId?: string; openChat?: boolean }).openChat
        ? (res as { chatUserId?: string }).chatUserId
        : undefined;
      if (chatId) {
        openChatWithUser(chatId);
        onOpenChat?.(chatId);
      }
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'ACTIVITY_PREMIUM_REQUIRED') {
        setQuota((prev) =>
          prev
            ? { ...prev, requiresPremium: true, acceptedCount: e.response?.data?.acceptedCount ?? prev.acceptedCount }
            : {
                acceptedCount: e.response?.data?.acceptedCount ?? 3,
                freeLimit: e.response?.data?.limit ?? 3,
                tier: 'free',
                requiresPremium: true,
              }
        );
      }
      setError(e.response?.data?.error || 'Could not send interest');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (interestId: string) => {
    if (quota?.requiresPremium) {
      setError(`You used your ${quota.freeLimit} free accepted interests. Pick Plus, Gold, or Platinum for unlimited connections.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await activityAPI.acceptInterest(interestId);
      loadInterests();
      const chatId = (res as { chatUserId?: string }).chatUserId;
      if (chatId) {
        openChatWithUser(chatId);
        onOpenChat?.(chatId);
      }
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === 'ACTIVITY_PREMIUM_REQUIRED') {
        setQuota((prev) =>
          prev
            ? { ...prev, requiresPremium: true }
            : { acceptedCount: 3, freeLimit: 3, tier: 'free', requiresPremium: true }
        );
      }
      setError(e.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (interestId: string) => {
    setLoading(true);
    try {
      await activityAPI.rejectInterest(interestId);
      loadInterests();
    } finally {
      setLoading(false);
    }
  };

  const openPreComm = (interest: Interest) => {
    setSelectedInterest(interest);
    setView('precomm');
    setPreCommData({
      whatLookingFor: '', howWillMeet: '', canAffordTravelProof: '', willingToMoveWhere: '',
      whereWork: '', whereLive: '', whereChill: '', name: '', familyFriends: '',
    });
    if (interest.id) {
      activityAPI.getPreComm(interest.id).then(({ profiles, canChat: ch }) => {
        setPreCommProfiles(profiles);
        setCanChat(ch);
        const mine = profiles.find(p => p.userId === user?.id);
        if (mine) {
          setPreCommData({
            whatLookingFor: mine.whatLookingFor || '',
            howWillMeet: mine.howWillMeet || '',
            canAffordTravelProof: mine.canAffordTravelProof || '',
            willingToMoveWhere: mine.willingToMoveWhere || '',
            whereWork: mine.whereWork || '',
            whereLive: mine.whereLive || '',
            whereChill: mine.whereChill || '',
            name: mine.name || '',
            familyFriends: mine.familyFriends || '',
          });
        }
      }).catch(() => {});
    }
  };

  const loadPreCommForInterest = () => {
    if (!selectedInterest?.id) return;
    activityAPI.getPreComm(selectedInterest.id).then(({ profiles, canChat: ch }) => {
      setPreCommProfiles(profiles);
      setCanChat(ch);
    }).catch(() => {});
  };

  const handleSavePreComm = async () => {
    if (!selectedInterest?.id || !user?.id) return;
    if (!preCommData.whatLookingFor.trim() || !preCommData.howWillMeet.trim()) {
      setError('What you\'re looking for and how you\'ll meet are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await activityAPI.savePreComm(selectedInterest.id, preCommData);
      loadPreCommForInterest();
      activityAPI.getPreComm(selectedInterest.id).then(({ canChat: ch }) => setCanChat(ch));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const style = {
    card: {
      padding: '14px', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '10px',
      background: 'rgba(0, 0, 0, 0.35)', color: '#fff', fontFamily: 'Orbitron, monospace' as const,
      letterSpacing: '0.04em', wordSpacing: '0.08em', lineHeight: 1.4,
    },
    btn: (primary?: boolean) => ({
      padding: '10px 16px', borderRadius: '8px', fontFamily: 'Orbitron, monospace' as const, cursor: 'pointer' as const,
      background: primary ? 'rgba(0, 212, 255, 0.3)' : 'transparent',
      border: '2px solid #00d4ff', color: '#00d4ff',
      letterSpacing: '0.05em', wordSpacing: '0.1em', fontSize: '13px',
    }),
  };

  const statusForUser = (userId: string) => {
    const s = sent.find(i => i.toUserId === userId);
    const r = received.find(i => i.fromUserId === userId);
    if (s) return { status: s.status, interest: s };
    if (r) return { status: r.status, interest: r };
    return null;
  };

  const countryFiltered = countrySearch.trim()
    ? countries.filter(c => c.country.toLowerCase().includes(countrySearch.toLowerCase().trim())).slice(0, 80)
    : countries.slice(0, 80);
  const cityFiltered = citySearch.trim()
    ? cities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase().trim())).slice(0, 80)
    : cities.slice(0, 300);

  const inputStyle = {
    width: '100%' as const,
    padding: '12px 14px',
    background: 'rgba(0,0,0,0.5)',
    border: '2px solid rgba(0, 212, 255, 0.5)',
    borderRadius: '8px',
    color: '#00d4ff',
    fontFamily: 'Orbitron, monospace' as const,
    fontSize: '14px',
    letterSpacing: '0.04em',
  };
  const labelStyle = { display: 'block' as const, marginBottom: '8px', color: '#00d4ff', fontSize: '13px', letterSpacing: '0.06em', wordSpacing: '0.1em' };

  return (
    <div className="widget data-viz-widget" style={{ padding: '20px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
      <h2 className="activity-stream-title" style={{
        position: 'relative', bottom: 'auto', left: 'auto', transform: 'none', display: 'block',
        margin: '0 0 20px 0', padding: '0 0 16px 0', borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
        color: '#00d4ff', letterSpacing: '0.12em', wordSpacing: '0.25em', lineHeight: 1.6, fontSize: '15px', fontWeight: 600, textTransform: 'uppercase',
      }}>
        ACTIVITY STREAM — CONNECT WORLDWIDE
      </h2>
      {SAFETY_WARNING}
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px', lineHeight: 1.5, letterSpacing: '0.03em' }}>
        Search any city in your country (e.g. Frankfurt → Berlin) or any country worldwide. Send interest — chat in Communications only after they accept. Free: 3 accepted interests; Plus, Gold, or Platinum = unlimited.
      </p>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px', lineHeight: 1.5, letterSpacing: '0.03em' }}>
        Set your country and city in your profile so others can find you in region search.
      </p>

      {quota && quota.tier === 'free' && (
        <div style={{
          padding: '12px', marginBottom: '14px', borderRadius: '10px',
          background: quota.requiresPremium ? 'rgba(251, 191, 36, 0.18)' : 'rgba(0, 212, 255, 0.1)',
          border: `2px solid ${quota.requiresPremium ? 'rgba(251, 191, 36, 0.65)' : 'rgba(0, 212, 255, 0.35)'}`,
          color: quota.requiresPremium ? '#fde68a' : '#a5f3fc',
          fontSize: '12px', fontFamily: 'Orbitron, monospace', lineHeight: 1.5,
        }}>
          {quota.requiresPremium ? (
            <>
              You used your {quota.freeLimit} free accepted interests. Pick Plus, Gold, or Platinum for unlimited connections (any city or country).
              <button
                type="button"
                onClick={() => navigate('/settings', { state: { openTab: 'premium' } })}
                style={{ ...style.btn(true), display: 'block', width: '100%', marginTop: '10px', borderColor: '#fbbf24', color: '#fde68a', background: 'rgba(251, 191, 36, 0.25)' }}
              >
                Choose a premium plan
              </button>
            </>
          ) : (
            <>Accepted interests: {quota.acceptedCount} / {quota.freeLimit} free (any city or country). After {quota.freeLimit}, Plus / Gold / Platinum = unlimited.</>
          )}
        </div>
      )}

      {quota && quota.tier !== 'free' && (
        <div style={{
          padding: '10px 12px', marginBottom: '14px', borderRadius: '10px',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '2px solid rgba(34, 197, 94, 0.45)',
          color: '#86efac',
          fontSize: '12px', fontFamily: 'Orbitron, monospace', lineHeight: 1.5,
        }}>
          {quota.tier.toUpperCase()} — unlimited Activity connections worldwide.
        </div>
      )}

      {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}

      {view === 'search' && (
        <>
          <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={labelStyle}>Search country</label>
            <input
              type="text"
              value={countrySearch || country}
              onChange={e => { setCountrySearch(e.target.value); setCountryDropdownOpen(true); if (!e.target.value) setCountry(''); setCity(''); setCitySearch(''); }}
              onFocus={() => setCountryDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCountryDropdownOpen(false), 200)}
              placeholder="Type to search countries..."
              style={inputStyle}
            />
            {countryDropdownOpen && countryFiltered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.95)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', zIndex: 10, marginTop: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }}>
                {countryFiltered.map(c => (
                  <div
                    key={c.country}
                    onClick={() => { setCountry(c.country); setCountrySearch(''); setCountryDropdownOpen(false); setCity(''); setCitySearch(''); }}
                    style={{ padding: '12px 14px', cursor: 'pointer', color: '#00d4ff', borderBottom: '1px solid rgba(0,212,255,0.2)', letterSpacing: '0.04em' }}
                  >
                    {c.country}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={labelStyle}>Search city (optional)</label>
            <input
              type="text"
              value={citySearch || city}
              onChange={e => { setCitySearch(e.target.value); setCity(e.target.value); setCityDropdownOpen(true); }}
              onFocus={() => setCityDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCityDropdownOpen(false), 200)}
              placeholder={country ? 'Any city in this country (e.g. Berlin)…' : 'Select a country first'}
              disabled={!country}
              style={{ ...inputStyle, opacity: country ? 1 : 0.6 }}
            />
            {cityDropdownOpen && country && cityFiltered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '220px', overflowY: 'auto', background: 'rgba(0,0,0,0.95)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', zIndex: 10, marginTop: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }}>
                {cityFiltered.map(cityName => (
                  <div
                    key={cityName}
                    onClick={() => { setCity(cityName); setCitySearch(''); setCityDropdownOpen(false); }}
                    style={{ padding: '12px 14px', cursor: 'pointer', color: '#00d4ff', borderBottom: '1px solid rgba(0,212,255,0.2)', letterSpacing: '0.04em' }}
                  >
                    {cityName}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => void loadRegion()}
            disabled={!country.trim() || loading}
            style={{
              ...style.btn(true),
              width: '100%',
              padding: '14px',
              marginBottom: '12px',
              letterSpacing: '0.06em',
              wordSpacing: '0.15em',
            }}
          >
            {loading ? 'Loading people…' : 'Confirm region — see people here'}
          </button>
          <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.2)' }}>
            <button onClick={() => setView('received')} style={{ ...style.btn(), padding: '12px 18px', letterSpacing: '0.06em', wordSpacing: '0.15em' }}>
              View received interests
            </button>
          </div>
        </>
      )}

      {view === 'list' && (
        <>
          <button onClick={() => setView('search')} style={{ marginBottom: '14px', ...style.btn() }}>← Back</button>
          <div style={{ marginBottom: '8px', color: '#00d4ff', fontSize: '13px', letterSpacing: '0.05em', wordSpacing: '0.1em' }}>
            People in {country}{city ? `, ${city}` : ''} — send interest to connect
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', lineHeight: 1.4 }}>
            They must accept before you can keep talking in Communications.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {regionUsers.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No users in this region yet. Make sure your profile has country (and city) set.</p>
            ) : (
              regionUsers.map(u => {
                const st = statusForUser(u.id);
                return (
                  <div key={u.id} style={style.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div className="user-avatar" style={{ width: '44px', height: '44px' }}>
                        {u.profilePicture ? <img src={u.profilePicture} alt="" className={(u as any).blurred ? 'celeb-blur-img' : ''} /> : <div className={`avatar-placeholder ${(u as any).blurred ? 'celeb-blur' : ''}`}>{(u as any).blurred ? '?' : u.name?.[0] || '?'}</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#00d4ff', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {(u as any).goldStar && '⭐ '}{u.name}
                          {(u as any).photoVerifiedAt && <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '600' }} title="Photo verified">✓</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{u.country}{u.city ? `, ${u.city}` : ''}</div>
                      </div>
                      {st?.status === 'pending' && <span style={{ fontSize: '12px', color: '#fbbf24' }}>Pending</span>}
                      {st?.status === 'rejected' && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Declined</span>}
                      {st?.status === 'accepted' && (
                        <button onClick={() => openPreComm(st.interest)} style={{ ...style.btn(true), fontSize: '11px' }}>Complete profile & chat</button>
                      )}
                      {!st && (
                        <button
                          onClick={() => handleSendInterest(u.id)}
                          disabled={loading || !!quota?.requiresPremium}
                          style={{ ...style.btn(true), fontSize: '11px', opacity: quota?.requiresPremium ? 0.5 : 1 }}
                        >
                          Send interest
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.2)' }}>
            <button onClick={() => setView('received')} style={style.btn()}>View received interests</button>
          </div>
        </>
      )}

      {view === 'received' && (
        <>
          <button onClick={() => setView('search')} style={{ marginBottom: '14px', ...style.btn() }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff', fontSize: '13px', letterSpacing: '0.06em', wordSpacing: '0.12em' }}>Received interests</div>
          {received.filter(i => i.status === 'pending').length === 0 && received.filter(i => i.status !== 'pending').length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No received interests.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {received.map(i => (
                <div key={i.id} style={style.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="user-avatar" style={{ width: '44px', height: '44px' }}>
                      {i.otherUser?.profilePicture ? <img src={i.otherUser.profilePicture} alt="" /> : <div className={`avatar-placeholder ${(i.otherUser as any)?.blurred ? 'celeb-blur' : ''}`}>{(i.otherUser as any)?.blurred ? '?' : i.otherUser?.name?.[0] || '?'}</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#00d4ff', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {(i.otherUser as any)?.goldStar && '⭐ '}{i.otherUser?.name}
                        {(i.otherUser as any)?.photoVerifiedAt && <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '600' }} title="Photo verified">✓</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{i.otherUser?.country}{i.otherUser?.city ? `, ${i.otherUser.city}` : ''}</div>
                    </div>
                    {i.status === 'pending' && (
                      <>
                        <button onClick={() => handleAccept(i.id)} disabled={loading || !!quota?.requiresPremium} style={{ ...style.btn(true), background: 'rgba(34, 197, 94, 0.3)', borderColor: '#22c55e', color: '#22c55e', opacity: quota?.requiresPremium ? 0.5 : 1 }}>Accept</button>
                        <button onClick={() => handleReject(i.id)} disabled={loading} style={{ ...style.btn(), borderColor: '#ef4444', color: '#ef4444' }}>Decline</button>
                      </>
                    )}
                    {i.status === 'accepted' && <button onClick={() => openPreComm(i)} style={{ ...style.btn(true), fontSize: '11px' }}>Complete profile & chat</button>}
                    {i.status === 'rejected' && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Declined</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'precomm' && selectedInterest && (
        <>
          <button onClick={() => { setView('search'); setSelectedInterest(null); }} style={{ marginBottom: '12px', ...style.btn() }}>← Back</button>
          <div style={{ marginBottom: '12px', color: '#00d4ff' }}>Before you communicate: both must complete this. Share only what you’re comfortable with.</div>
          {SAFETY_WARNING}
          <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px' }}>Where you work, live, chill, name, family & friends help build trust. If someone needs to talk to them, get to know them first.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            <label style={{ color: '#00d4ff', fontSize: '11px' }}>What are you looking for? *</label>
            <textarea value={preCommData.whatLookingFor} onChange={e => setPreCommData(d => ({ ...d, whatLookingFor: e.target.value }))} rows={2} placeholder="e.g. serious relationship, meet in person" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#00d4ff', fontSize: '11px' }}>How will you meet? *</label>
            <input value={preCommData.howWillMeet} onChange={e => setPreCommData(d => ({ ...d, howWillMeet: e.target.value }))} placeholder="e.g. video first, then public place" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#00d4ff', fontSize: '11px' }}>Can you afford to travel back and forth? Proof (e.g. note or link) *</label>
            <input value={preCommData.canAffordTravelProof} onChange={e => setPreCommData(d => ({ ...d, canAffordTravelProof: e.target.value }))} placeholder="Brief proof you can afford travel" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#00d4ff', fontSize: '11px' }}>Willing to move for your partner? If yes, where?</label>
            <input value={preCommData.willingToMoveWhere} onChange={e => setPreCommData(d => ({ ...d, willingToMoveWhere: e.target.value }))} placeholder="e.g. Yes, Europe or No" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#9ca3af', fontSize: '11px' }}>Where you work</label>
            <input value={preCommData.whereWork} onChange={e => setPreCommData(d => ({ ...d, whereWork: e.target.value }))} placeholder="Optional" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#9ca3af', fontSize: '11px' }}>Where you live</label>
            <input value={preCommData.whereLive} onChange={e => setPreCommData(d => ({ ...d, whereLive: e.target.value }))} placeholder="Optional" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#9ca3af', fontSize: '11px' }}>Where you chill</label>
            <input value={preCommData.whereChill} onChange={e => setPreCommData(d => ({ ...d, whereChill: e.target.value }))} placeholder="Optional" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#9ca3af', fontSize: '11px' }}>Your name</label>
            <input value={preCommData.name} onChange={e => setPreCommData(d => ({ ...d, name: e.target.value }))} placeholder="Optional" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
            <label style={{ color: '#9ca3af', fontSize: '11px' }}>Family & friends (if someone needs to talk to them, get to know you first)</label>
            <textarea value={preCommData.familyFriends} onChange={e => setPreCommData(d => ({ ...d, familyFriends: e.target.value }))} rows={2} placeholder="Optional" style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '8px', color: '#fff', fontFamily: 'Orbitron, monospace' }} />
          </div>

          <button onClick={handleSavePreComm} disabled={loading} style={{ ...style.btn(true), width: '100%', marginBottom: '12px' }}>{loading ? 'Saving...' : 'Save my answers'}</button>

          {canChat && (
            <div style={{ padding: '12px', border: '2px solid #22c55e', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', color: '#86efac' }}>
              <div style={{ marginBottom: '8px', fontSize: '12px' }}>Both of you have completed the profile. You can now add each other to communications.</div>
              <button onClick={() => { const otherId = selectedInterest.fromUserId === user?.id ? selectedInterest.toUserId : selectedInterest.fromUserId; onOpenChat?.(otherId); setView('search'); setSelectedInterest(null); }} style={{ ...style.btn(true), background: 'rgba(34, 197, 94, 0.3)', borderColor: '#22c55e', color: '#22c55e' }}>Open chat</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
