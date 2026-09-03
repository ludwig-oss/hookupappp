import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
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
  const navigate = useNavigate();
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
  const [joinQuestion, setJoinQuestion] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [hostReplyDrafts, setHostReplyDrafts] = useState<Record<string, string>>({});

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

  const refreshDetail = (eventId: string) => {
    eventsAPI.getById(eventId).then((r) => setSelectedEvent(r.event)).catch(() => {});
  };

  const requestToJoin = () => {
    if (!selectedEvent) return;
    eventsAPI
      .requestToJoin(selectedEvent.id, joinQuestion.trim() || undefined)
      .then(() => {
        setJoinQuestion('');
        refreshDetail(selectedEvent.id);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to send request'));
  };

  const respondRequest = (requestId: string, accept: boolean) => {
    if (!selectedEvent) return;
    eventsAPI
      .respondToRequest(requestId, selectedEvent.id, accept)
      .then(() => {
        eventsAPI.getRequests(selectedEvent.id).then((r) => setRequests(r.requests)).catch(() => {});
        refreshDetail(selectedEvent.id);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed'));
  };

  const sendHostReply = (requestId: string) => {
    if (!selectedEvent) return;
    const reply = (hostReplyDrafts[requestId] || '').trim();
    if (!reply) {
      alert('Write a reply first');
      return;
    }
    eventsAPI
      .replyToRequest(requestId, selectedEvent.id, reply)
      .then(() => {
        setHostReplyDrafts((prev) => ({ ...prev, [requestId]: '' }));
        eventsAPI.getRequests(selectedEvent.id).then((r) => setRequests(r.requests)).catch(() => {});
        refreshDetail(selectedEvent.id);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to send reply'));
  };

  const cancelMyRequest = () => {
    if (!selectedEvent) return;
    if (cancelReason.trim().length < 4) {
      alert('Add a reason why you cannot come');
      return;
    }
    eventsAPI
      .cancelRequest(selectedEvent.id, cancelReason.trim())
      .then(() => {
        setCancelReason('');
        refreshDetail(selectedEvent.id);
        if (selectedEvent.creatorUserId === user?.id) {
          eventsAPI.getRequests(selectedEvent.id).then((r) => setRequests(r.requests)).catch(() => {});
        }
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to cancel'));
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

  const openUserProfile = (userId: string) => {
    if (!userId) return;
    if (userId === user?.id) {
      navigate('/profile');
      return;
    }
    navigate(`/profile/${userId}`);
  };

  const guestPhoto = (src: string | null | undefined, key: string, mine = false) => (
    <div
      key={key}
      title={mine ? 'You — accepted' : 'Accepted'}
      style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        overflow: 'hidden',
        border: mine ? '2px solid #22c55e' : '2px solid rgba(0,212,255,0.55)',
        background: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          👤
        </div>
      )}
    </div>
  );

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
                  {ev.creatorUserId !== user?.id && ev.myRequest?.status === 'accepted' && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#86efac', fontSize: 12, fontWeight: 600 }}>
                      {guestPhoto((user as { profilePicture?: string | null })?.profilePicture, `my-${ev.id}`, true)}
                      Accepted
                    </div>
                  )}
                  {ev.creatorUserId !== user?.id && ev.myRequest?.status === 'pending' && (
                    <div style={{ marginTop: 6, color: '#eab308', fontSize: 12 }}>Request pending</div>
                  )}
                  {ev.creatorUserId === user?.id && (ev.acceptedGuests?.length || 0) > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {ev.acceptedGuests!.map((g, i) => guestPhoto(g.profilePicture, `${ev.id}-g-${i}`))}
                    </div>
                  )}
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
              <div className="highlights-title" style={{ marginBottom: 8 }}>Accepted</div>
              {(selectedEvent.acceptedGuests || []).length === 0 ? (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>No one accepted yet. You’ll only see their profile photo here.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {(selectedEvent.acceptedGuests || []).map((g, i) => guestPhoto(g.profilePicture, `acc-${i}`))}
                </div>
              )}

              {requests.filter((r) => r.status === 'accepted' && r.question).map((r) => (
                <div key={`aq-${r.id}`} style={{ padding: 10, border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, marginBottom: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {guestPhoto(r.user?.profilePicture, `aqp-${r.id}`)}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, margin: '0 0 6px' }}>Question: {r.question}</p>
                    {r.organizerReply ? (
                      <p style={{ fontSize: 12, margin: 0, color: '#86efac' }}>Your reply: {r.organizerReply}</p>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="profile-input"
                          style={{ flex: 1, minWidth: 160 }}
                          placeholder="Reply to their question"
                          value={hostReplyDrafts[r.id] || ''}
                          onChange={(e) => setHostReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        />
                        <button type="button" className="profile-save-btn" style={{ padding: '6px 10px' }} onClick={() => sendHostReply(r.id)}>Reply</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {requests.filter((r) => r.status === 'cancelled').length > 0 && (
                <>
                  <div className="highlights-title" style={{ marginBottom: 8 }}>Can’t come</div>
                  {requests.filter((r) => r.status === 'cancelled').map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {guestPhoto(r.user?.profilePicture, `c-${r.id}`)}
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                        Cancelled: {r.cancelReason || 'No reason given'}
                      </p>
                    </div>
                  ))}
                </>
              )}

              <div className="highlights-title" style={{ marginBottom: 8 }}>Requests to join</div>
              {requests.filter((r) => r.status === 'pending').length === 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>No pending requests.</p>}
              {requests.filter((r) => r.status === 'pending').map((r) => (
                <div key={r.id} style={{ padding: 10, border: '1px solid rgba(0,212,255,0.25)', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button type="button" className="profile-location-btn" style={{ padding: '6px 10px' }} onClick={() => openUserProfile(r.userId)}>
                      {(r.user as any)?.goldStar && '⭐ '}{r.user?.name || 'User'}
                    </button>
                    <button type="button" className="profile-save-btn" style={{ padding: '6px 10px' }} onClick={() => respondRequest(r.id, true)}>Accept</button>
                    <button type="button" className="chat-back-btn" style={{ padding: '6px 10px' }} onClick={() => respondRequest(r.id, false)}>Decline</button>
                  </div>
                  {r.question && (
                    <p style={{ fontSize: 13, margin: '0 0 8px', color: 'rgba(255,255,255,0.9)' }}>
                      Question: {r.question}
                    </p>
                  )}
                  {r.organizerReply ? (
                    <p style={{ fontSize: 12, margin: 0, color: '#86efac' }}>Your reply: {r.organizerReply}</p>
                  ) : r.question ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        className="profile-input"
                        style={{ flex: 1, minWidth: 160 }}
                        placeholder="Reply (e.g. yes, one extra is fine)"
                        value={hostReplyDrafts[r.id] || ''}
                        onChange={(e) => setHostReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <button type="button" className="profile-save-btn" style={{ padding: '6px 10px' }} onClick={() => sendHostReply(r.id)}>Reply</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          )}

          {selectedEvent.creatorUserId !== user?.id && !selectedEvent.myRequest && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
                Question for the organiser (optional — e.g. can I bring someone?)
                <textarea
                  value={joinQuestion}
                  onChange={(e) => setJoinQuestion(e.target.value)}
                  rows={2}
                  className="profile-input"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="Ask anything the host should know before they accept"
                />
              </label>
              <button type="button" className="profile-save-btn" onClick={requestToJoin}>
                Request to join
              </button>
            </div>
          )}

          {selectedEvent.creatorUserId !== user?.id && selectedEvent.myRequest?.status === 'pending' && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)' }}>
              <p style={{ color: '#eab308', margin: '0 0 8px', fontWeight: 600 }}>Request sent. Waiting for the host to accept.</p>
              {selectedEvent.myRequest.question && (
                <p style={{ fontSize: 13, margin: '0 0 6px' }}>Your question: {selectedEvent.myRequest.question}</p>
              )}
              {selectedEvent.myRequest.organizerReply ? (
                <p style={{ fontSize: 13, margin: '0 0 10px', color: '#86efac' }}>Host reply: {selectedEvent.myRequest.organizerReply}</p>
              ) : (
                selectedEvent.myRequest.question && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '0 0 10px' }}>The host has not replied yet.</p>
                )
              )}
              <label style={{ display: 'block', fontSize: 13 }}>
                Can’t come? Add a reason to cancel (required)
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className="profile-input"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="Why you can’t come"
                />
              </label>
              <button type="button" className="chat-back-btn" style={{ marginTop: 8 }} onClick={cancelMyRequest}>
                Cancel request
              </button>
            </div>
          )}

          {selectedEvent.creatorUserId !== user?.id && selectedEvent.myRequest?.status === 'accepted' && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {guestPhoto((user as { profilePicture?: string | null })?.profilePicture, 'me-accepted', true)}
                <div>
                  <div style={{ color: '#86efac', fontWeight: 700 }}>Accepted</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>You’re on the list for this event.</div>
                </div>
              </div>
              {(selectedEvent.acceptedGuests || []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(selectedEvent.acceptedGuests || []).map((g, i) => guestPhoto(g.profilePicture, `ag-${i}`))}
                </div>
              )}
              {selectedEvent.myRequest.question && (
                <p style={{ fontSize: 13, margin: '0 0 6px' }}>Your question: {selectedEvent.myRequest.question}</p>
              )}
              {selectedEvent.myRequest.organizerReply && (
                <p style={{ fontSize: 13, margin: '0 0 10px', color: '#86efac' }}>Host reply: {selectedEvent.myRequest.organizerReply}</p>
              )}
              <label style={{ display: 'block', fontSize: 13 }}>
                Can’t come? Add a reason to cancel (required)
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className="profile-input"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="Why you can’t come"
                />
              </label>
              <button type="button" className="chat-back-btn" style={{ marginTop: 8 }} onClick={cancelMyRequest}>
                Cancel — I can’t come
              </button>
            </div>
          )}

          {selectedEvent.creatorUserId !== user?.id && selectedEvent.myRequest?.status === 'cancelled' && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: '#fca5a5', margin: '0 0 10px' }}>
                You cancelled this request{selectedEvent.myRequest.cancelReason ? `: ${selectedEvent.myRequest.cancelReason}` : '.'}
              </p>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>
                Question for the organiser (optional)
                <textarea
                  value={joinQuestion}
                  onChange={(e) => setJoinQuestion(e.target.value)}
                  rows={2}
                  className="profile-input"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </label>
              <button type="button" className="profile-save-btn" onClick={requestToJoin}>
                Request to join again
              </button>
            </div>
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
    </div>
  );
}
