import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { profileAPI } from '../../api/profile';
import {
  eventsAPI,
  Event,
  EventRequest,
  EventMessage,
  EVENT_TYPE_LABELS,
  EventType,
} from '../../api/events';
import './Widget.css';
import '../../pages/Dashboard.css';

const SAFETY_NOTE =
  "Be careful: meet at a public place first. Get details of where you're going and who you're with. Share your plans with an emergency contact.";

type View = 'list' | 'create' | 'detail' | 'my';

export default function EventsWidget() {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<View>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [describeQuery, setDescribeQuery] = useState('');
  const [locationUsed, setLocationUsed] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [meetupDetailsDraft, setMeetupDetailsDraft] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const userCity = (user as any)?.city || '';
  const userCountry = (user as any)?.country || '';

  useEffect(() => {
    if (view === 'list') loadEvents();
    if (view === 'my') loadMyEvents();
  }, [view]);

  useEffect(() => {
    if (selectedEvent && view === 'detail') {
      if (selectedEvent.creatorUserId === user?.id) {
        eventsAPI.getRequests(selectedEvent.id).then((r) => setRequests(r.requests)).catch(() => setRequests([]));
      }
      if (selectedEvent.canChat) {
        eventsAPI.getMessages(selectedEvent.id).then((r) => setMessages(r.messages)).catch(() => setMessages([]));
        setMeetupDetailsDraft(selectedEvent.meetupDetails || '');
      }
    }
  }, [selectedEvent?.id, selectedEvent?.canChat, view, user?.id]);

  useEffect(() => {
    if (!selectedEvent || !selectedEvent.canChat || view !== 'detail') return;
    const interval = setInterval(() => {
      eventsAPI.getMessages(selectedEvent.id).then((r) => setMessages(r.messages)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedEvent?.id, selectedEvent?.canChat, view]);

  const loadEvents = () => {
    setLoading(true);
    const city = cityFilter.trim() || userCity;
    eventsAPI
      .list(city || undefined, userCountry || undefined, searchQuery, describeQuery)
      .then((r) => {
        setEvents(r.events || []);
        setLocationUsed(r.locationUsed || city || userCity || null);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  const loadMyEvents = () => {
    setLoading(true);
    eventsAPI
      .myEvents()
      .then((r) => setMyEvents(r.events || []))
      .catch(() => setMyEvents([]))
      .finally(() => setLoading(false));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const type = (form.querySelector('[name="type"]') as HTMLSelectElement)?.value as EventType;
    const title = (form.querySelector('[name="title"]') as HTMLInputElement)?.value?.trim();
    const description = (form.querySelector('[name="description"]') as HTMLTextAreaElement)?.value?.trim();
    const city = (form.querySelector('[name="city"]') as HTMLInputElement)?.value?.trim();
    const startDate = (form.querySelector('[name="startDate"]') as HTMLInputElement)?.value;
    const startTime = (form.querySelector('[name="startTime"]') as HTMLInputElement)?.value;
    if (!type || !title || !city || !startDate || !startTime) {
      alert('Please fill type, title, city, date and start time');
      return;
    }
    eventsAPI
      .create({ type, title, description, city, country: userCountry, startDate, startTime, endTime: '06:00' })
      .then(() => {
        setView('my');
        loadMyEvents();
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to create event'));
  };

  const openDetail = (event: Event) => {
    eventsAPI
      .getById(event.id)
      .then((r) => {
        setSelectedEvent(r.event);
        setView('detail');
      })
      .catch(() => alert('Failed to load event'));
  };

  const requestToJoin = () => {
    if (!selectedEvent) return;
    eventsAPI
      .requestToJoin(selectedEvent.id)
      .then(() => eventsAPI.getById(selectedEvent.id).then((r) => setSelectedEvent(r.event)))
      .catch((err) => alert(err.response?.data?.error || 'Failed to send request'));
  };

  const respondRequest = (requestId: string, accept: boolean) => {
    if (!selectedEvent) return;
    eventsAPI
      .respondToRequest(requestId, selectedEvent.id, accept)
      .then(() => eventsAPI.getRequests(selectedEvent!.id).then((r) => setRequests(r.requests)))
      .catch((err) => alert(err.response?.data?.error || 'Failed'));
  };

  const sendMessage = () => {
    if (!selectedEvent || !messageDraft.trim()) return;
    eventsAPI
      .postMessage(selectedEvent.id, messageDraft.trim())
      .then((r) => {
        setMessages((prev) => [...prev, { ...r.message, userName: user?.name || 'You' }]);
        setMessageDraft('');
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to send'));
  };

  const saveMeetupDetails = () => {
    if (!selectedEvent) return;
    eventsAPI
      .updateMeetupDetails(selectedEvent.id, meetupDetailsDraft)
      .then((r) => setSelectedEvent((prev) => (prev ? { ...prev, meetupDetails: r.event.meetupDetails } : null)))
      .catch((err) => alert(err.response?.data?.error || 'Failed to save'));
  };

  const loadProfile = (userId: string) => {
    setProfileUserId(userId);
    setProfileLoading(true);
    setProfileData(null);
    profileAPI
      .getUserProfile(userId)
      .then((d) => setProfileData(d))
      .catch(() => setProfileData(null))
      .finally(() => setProfileLoading(false));
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (t: string) => t.slice(0, 5);

  return (
    <div className="widget events-widget">
      <div className="events-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 1.25 + 'rem', color: '#00d4ff' }}>Events</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="love-feed-create-btn" onClick={() => setView('list')} style={{ padding: '6px 12px' }}>
            Discover
          </button>
          <button type="button" className="love-feed-create-btn" onClick={() => setView('my')} style={{ padding: '6px 12px' }}>
            My events
          </button>
          <button type="button" className="profile-location-btn" onClick={() => { setView('create'); setSelectedEvent(null); }} style={{ padding: '6px 12px' }}>
            + Create event
          </button>
        </div>
      </div>

      <p className="events-safety-banner" style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,212,255,0.15)', padding: 10, borderRadius: 8, marginBottom: 16 }}>
        ⚠️ {SAFETY_NOTE}
      </p>

      {view === 'list' && (
        <>
          {locationUsed && (
            <p style={{ fontSize: 12, color: 'rgba(0,212,255,0.9)', marginBottom: 10 }}>
              Showing events near <strong>{locationUsed}</strong>
            </p>
          )}
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            City (leave empty to use your profile city)
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder={userCity || 'e.g. Munich'}
              className="profile-input"
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            Search name or type (party, club, drinks…)
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. party, house bash, football"
              className="profile-input"
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            Describe what you&apos;re looking for
            <textarea
              value={describeQuery}
              onChange={(e) => setDescribeQuery(e.target.value)}
              placeholder="e.g. chill house party with music, not too loud, near city center"
              rows={2}
              className="profile-input"
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <button type="button" className="profile-save-btn" style={{ marginBottom: 16 }} onClick={loadEvents}>
            Search events
          </button>
          {loading && <p style={{ color: 'rgba(255,255,255,0.7)' }}>Loading...</p>}
          {!loading && events.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>No events in this area yet. Create one!</p>
          )}
          {!loading && events.length > 0 && (
            <div className="events-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="events-card"
                  style={{ padding: 14, border: '1px solid rgba(0,212,255,0.3)', borderRadius: 12, background: 'rgba(0,0,0,0.2)', cursor: 'pointer' }}
                  onClick={() => openDetail(ev)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 'bold', color: '#00d4ff' }}>{(ev.creator as any)?.goldStar && '⭐ '}{ev.creator?.name || 'Host'}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>· {EVENT_TYPE_LABELS[ev.type]}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                    {formatDate(ev.startDate)} · {formatTime(ev.startTime)} – next day {formatTime(ev.endTime)} · {ev.city}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'my' && (
        <>
          {loading && <p>Loading...</p>}
          {!loading && myEvents.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>You haven’t created or joined any events yet.</p>
          )}
          {!loading && myEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{ padding: 14, border: '1px solid rgba(0,212,255,0.3)', borderRadius: 12, background: 'rgba(0,0,0,0.2)', cursor: 'pointer' }}
                  onClick={() => openDetail(ev)}
                >
                  <div style={{ fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                    {formatDate(ev.startDate)} · {ev.city} {ev.ended && '(Ended)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'create' && (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13 }}>
            Type
            <select name="type" className="profile-input" style={{ width: '100%', marginTop: 4 }} required>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((k) => (
                <option key={k} value={k}>{EVENT_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Title
            <input name="title" type="text" placeholder="e.g. Watch football at mine" className="profile-input" style={{ width: '100%', marginTop: 4 }} required />
          </label>
          <label style={{ fontSize: 13 }}>
            Description (optional)
            <textarea name="description" rows={2} className="profile-input" style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            City
            <input name="city" type="text" placeholder="e.g. London" className="profile-input" style={{ width: '100%', marginTop: 4 }} defaultValue={userCity} required />
          </label>
          <label style={{ fontSize: 13 }}>
            Date
            <input name="startDate" type="date" className="profile-input" style={{ width: '100%', marginTop: 4 }} required />
          </label>
          <label style={{ fontSize: 13 }}>
            Start time
            <input name="startTime" type="time" className="profile-input" style={{ width: '100%', marginTop: 4 }} required />
          </label>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Event ends the following day at 6:00.</p>
          <button type="submit" className="profile-save-btn">Create event</button>
          <button type="button" className="profile-location-btn" onClick={() => setView('list')}>Cancel</button>
        </form>
      )}

      {view === 'detail' && selectedEvent && (
        <div className="events-detail">
          <button type="button" className="chat-back-btn" style={{ marginBottom: 12 }} onClick={() => { setView(selectedEvent.creatorUserId === user?.id ? 'my' : 'list'); setSelectedEvent(null); }}>
            ← Back
          </button>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 'bold', color: '#00d4ff' }}>{(selectedEvent.creator as any)?.goldStar && '⭐ '}{selectedEvent.creator?.name || 'Host'}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>· {EVENT_TYPE_LABELS[selectedEvent.type]}</span>
            </div>
            <h3 style={{ margin: '0 0 8px' }}>{selectedEvent.title}</h3>
            {selectedEvent.description && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>{selectedEvent.description}</p>}
            <p style={{ fontSize: 13, margin: 0 }}>
              📅 {formatDate(selectedEvent.startDate)} · 🕐 {formatTime(selectedEvent.startTime)} – next day {formatTime(selectedEvent.endTime)} · 📍 {selectedEvent.city}
            </p>
          </div>

          {selectedEvent.creatorUserId === user?.id && (
            <>
              <div className="highlights-title" style={{ marginBottom: 8 }}>Requests to join</div>
              {requests.filter((r) => r.status === 'pending').length === 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>No pending requests.</p>}
              {requests.filter((r) => r.status === 'pending').map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button type="button" className="profile-location-btn" style={{ padding: '6px 10px' }} onClick={() => loadProfile(r.userId)}>
                    {(r.user as any)?.goldStar && '⭐ '}{r.user?.name || 'User'}
                  </button>
                  <button type="button" className="profile-save-btn" style={{ padding: '6px 10px' }} onClick={() => respondRequest(r.id, true)}>Accept</button>
                  <button type="button" className="chat-back-btn" style={{ padding: '6px 10px' }} onClick={() => respondRequest(r.id, false)}>Decline</button>
                </div>
              ))}
            </>
          )}

          {selectedEvent.creatorUserId !== user?.id && !selectedEvent.myRequest && (
            <button type="button" className="profile-save-btn" style={{ marginBottom: 16 }} onClick={requestToJoin}>
              Request to join
            </button>
          )}
          {selectedEvent.myRequest?.status === 'pending' && (
            <p style={{ color: '#eab308', marginBottom: 16 }}>Request sent. Waiting for host to accept.</p>
          )}

          {selectedEvent.canChat && (
            <>
              <div className="highlights-title" style={{ marginTop: 16, marginBottom: 8 }}>Meet up details</div>
              {selectedEvent.creatorUserId === user?.id ? (
                <>
                  <textarea
                    value={meetupDetailsDraft}
                    onChange={(e) => setMeetupDetailsDraft(e.target.value)}
                    placeholder="Where to meet, what to bring, requirements..."
                    rows={3}
                    className="profile-input"
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                  <button type="button" className="profile-save-btn" style={{ marginBottom: 16 }} onClick={saveMeetupDetails}>Save details</button>
                </>
              ) : (
                selectedEvent.meetupDetails && (
                  <div style={{ padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                    {selectedEvent.meetupDetails}
                  </div>
                )
              )}

              <div className="highlights-title" style={{ marginBottom: 8 }}>Live chat (until event ends)</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 6 }}>
                    <strong style={{ fontSize: 12 }}>{m.userName}:</strong> <span style={{ fontSize: 13 }}>{m.content}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Message..."
                  className="profile-input"
                  style={{ flex: 1 }}
                />
                <button type="button" className="profile-save-btn" onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
        </div>
      )}

      {profileUserId && (
        <div className="chat-profile-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setProfileUserId(null); setProfileData(null); }}>
          <div className="chat-profile-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="chat-profile-header">
              <h3>Profile</h3>
              <button type="button" className="chat-profile-close" onClick={() => { setProfileUserId(null); setProfileData(null); }}>×</button>
            </div>
            <div className="chat-profile-body">
              {profileLoading && <div className="chat-loading">Loading...</div>}
              {!profileLoading && profileData && (
                <>
                  <div className="chat-profile-avatar">
                    {profileData.profilePicture ? <img src={profileData.profilePicture} alt="" /> : <span>{(profileData as any).name?.[0] || '?'}</span>}
                  </div>
                  <div className="chat-profile-name">{(profileData as any).name}</div>
                  {(profileData as any).age && <div className="chat-profile-detail">Age: {(profileData as any).age}</div>}
                  {(profileData as any).country && <div className="chat-profile-detail">{(profileData as any).country}{(profileData as any).city ? `, ${(profileData as any).city}` : ''}</div>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
