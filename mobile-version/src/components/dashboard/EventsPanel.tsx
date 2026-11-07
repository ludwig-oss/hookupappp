import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EVENT_TYPE_LABELS,
  eventsAPI,
  type Event,
  type EventMessage,
  type EventRequest,
  type EventType,
} from '../../api/events';
import { formatAxiosError } from '../../lib/apiError';
import { useAuth } from '../../state/AuthContext';
import { Field, Hint, NeonButton, Notice, PanelTitle, StageFrame, shell } from './chrome';

type ViewId = 'list' | 'create' | 'detail' | 'mine';

const TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];

export function EventsPanel({ city, country }: { city?: string; country?: string }) {
  const { user } = useAuth();
  const [view, setView] = useState<ViewId>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [mine, setMine] = useState<Event[]>([]);
  const [filter, setFilter] = useState(city || '');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Event | null>(null);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [type, setType] = useState<EventType>('drinks');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventCity, setEventCity] = useState(city || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [joinQuestion, setJoinQuestion] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [meetup, setMeetup] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});

  const loadList = async (nextCity?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await eventsAPI.list(nextCity || undefined, country, query);
      setEvents(res.events || []);
      setNote(res.safetyNote || '');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  };

  const loadMine = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await eventsAPI.myEvents();
      setMine(res.events || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load your events.'));
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (event: Event) => {
    setError('');
    try {
      const res = await eventsAPI.getById(event.id);
      setSelected(res.event);
      setMeetup(res.event.meetupDetails || '');
      setView('detail');
      if (res.event.creatorUserId === user?.id) {
        const reqs = await eventsAPI.getRequests(res.event.id);
        setRequests(reqs.requests || []);
      }
      if (res.event.canChat) {
        const chat = await eventsAPI.getMessages(res.event.id);
        setMessages(chat.messages || []);
      }
    } catch (err) {
      setError(formatAxiosError(err, 'Could not open that event.'));
    }
  };

  useEffect(() => {
    void loadList(city);
  }, [city, country]);

  useEffect(() => {
    if (!selected || view !== 'detail') return;
    const timer = setInterval(() => {
      if (selected.creatorUserId === user?.id) {
        void eventsAPI.getRequests(selected.id).then((res) => setRequests(res.requests || [])).catch(() => undefined);
      }
      if (selected.canChat) {
        void eventsAPI.getMessages(selected.id).then((res) => setMessages(res.messages || [])).catch(() => undefined);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [selected, view, user?.id]);

  const create = async () => {
    if (!title.trim() || !eventCity.trim() || !startDate.trim() || !startTime.trim()) {
      setError('Add a type, title, city, date (YYYY-MM-DD) and start time (HH:MM).');
      return;
    }
    setError('');
    try {
      const res = await eventsAPI.create({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        city: eventCity.trim(),
        country,
        startDate: startDate.trim(),
        startTime: startTime.trim(),
        endTime: '06:00',
      });
      setTitle('');
      setDescription('');
      await openDetail(res.event);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not create that event.'));
    }
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const res = await eventsAPI.getById(selected.id);
    setSelected(res.event);
    if (res.event.creatorUserId === user?.id) {
      const reqs = await eventsAPI.getRequests(res.event.id);
      setRequests(reqs.requests || []);
    }
  };

  const join = async () => {
    if (!selected) return;
    setError('');
    try {
      await eventsAPI.requestToJoin(selected.id, joinQuestion.trim() || undefined);
      setJoinQuestion('');
      await refreshSelected();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not request to join.'));
    }
  };

  const respond = async (requestId: string, accept: boolean) => {
    if (!selected) return;
    setError('');
    try {
      await eventsAPI.respondToRequest(requestId, selected.id, accept);
      await refreshSelected();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not update that request.'));
    }
  };

  const reply = async (requestId: string) => {
    if (!selected) return;
    const text = (replies[requestId] || '').trim();
    if (!text) return;
    setError('');
    try {
      await eventsAPI.replyToRequest(requestId, selected.id, text);
      setReplies((prev) => ({ ...prev, [requestId]: '' }));
      await refreshSelected();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send that reply.'));
    }
  };

  const cancel = async () => {
    if (!selected) return;
    if (cancelReason.trim().length < 4) {
      setError('Add a reason why you cannot come.');
      return;
    }
    setError('');
    try {
      await eventsAPI.cancelRequest(selected.id, cancelReason.trim());
      setCancelReason('');
      await refreshSelected();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not cancel.'));
    }
  };

  const saveMeetup = async () => {
    if (!selected) return;
    setError('');
    try {
      const res = await eventsAPI.updateMeetupDetails(selected.id, meetup.trim());
      setSelected(res.event);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not save meetup details.'));
    }
  };

  const sendChat = async () => {
    if (!selected || !chatDraft.trim()) return;
    setError('');
    try {
      const res = await eventsAPI.postMessage(selected.id, chatDraft.trim());
      setMessages((prev) => [...prev, res.message]);
      setChatDraft('');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send that message.'));
    }
  };

  const host = selected?.creatorUserId === user?.id;

  return (
    <StageFrame>
      <PanelTitle icon="📅">Events</PanelTitle>
      <Hint>{note || 'Meet at a public place first. Share your plans with someone you trust.'}</Hint>
      <View style={styles.tabs}>
        {(['list', 'create', 'mine'] as ViewId[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setView(item);
              setSelected(null);
              if (item === 'list') void loadList(filter.trim());
              if (item === 'mine') void loadMine();
            }}
            style={[styles.tab, view === item && styles.tabOn]}
          >
            <Text style={styles.tabText}>{item === 'list' ? 'Discover' : item === 'create' ? 'Create' : 'Mine'}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading && view !== 'create' ? <ActivityIndicator color={shell.cyan} /> : null}

      {view === 'list' ? (
        <>
          <Field label="City" value={filter} onChangeText={setFilter} autoCapitalize="words" />
          <Field label="Search" value={query} onChangeText={setQuery} placeholder="football, drinks, picnic" />
          <NeonButton label="Search events" onPress={() => void loadList(filter.trim())} />
          {!loading && events.length === 0 ? <Hint>No events in this city yet. Create one.</Hint> : null}
          {events.map((event) => (
            <Pressable key={event.id} onPress={() => void openDetail(event)} style={styles.card}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>
                {EVENT_TYPE_LABELS[event.type]} · {event.city} · {event.startDate} {event.startTime}
              </Text>
              {event.myRequest?.status ? <Text style={styles.meta}>{event.myRequest.status}</Text> : null}
            </Pressable>
          ))}
        </>
      ) : null}

      {view === 'mine' ? (
        <>
          {!loading && mine.length === 0 ? <Hint>You have not created or joined an event yet.</Hint> : null}
          {mine.map((event) => (
            <Pressable key={event.id} onPress={() => void openDetail(event)} style={styles.card}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>
                {event.city} · {event.startDate} {event.startTime}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {view === 'create' ? (
        <>
          <Text style={styles.label}>Type</Text>
          <View style={styles.tabs}>
            {TYPES.map((item) => (
              <Pressable key={item} onPress={() => setType(item)} style={[styles.tab, type === item && styles.tabOn]}>
                <Text style={styles.tabText}>{EVENT_TYPE_LABELS[item]}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Watch football at mine" autoCapitalize="sentences" />
          <Field label="Description" value={description} onChangeText={setDescription} multiline autoCapitalize="sentences" />
          <Field label="City" value={eventCity} onChangeText={setEventCity} autoCapitalize="words" />
          <Field label="Date" value={startDate} onChangeText={setStartDate} placeholder="2026-11-20" autoCapitalize="none" />
          <Field label="Start time" value={startTime} onChangeText={setStartTime} placeholder="19:30" autoCapitalize="none" />
          <Hint>The event ends the next day at 06:00, same as the website.</Hint>
          <NeonButton label="Create event" tone="magenta" onPress={() => void create()} />
        </>
      ) : null}

      {view === 'detail' && selected ? (
        <>
          <NeonButton label="Back" tone="ghost" onPress={() => setView(host ? 'mine' : 'list')} />
          <Text style={styles.title}>{selected.title}</Text>
          <Text style={styles.meta}>
            {selected.creator?.name || 'Host'} · {EVENT_TYPE_LABELS[selected.type]}
          </Text>
          {selected.description ? <Text style={styles.body}>{selected.description}</Text> : null}
          <Text style={styles.meta}>
            {selected.startDate} {selected.startTime} – next day {selected.endTime} · {selected.city}
          </Text>

          {host ? (
            <>
              <Text style={styles.label}>Requests to join</Text>
              {requests.filter((item) => item.status === 'pending').length === 0 ? <Hint>No pending requests.</Hint> : null}
              {requests
                .filter((item) => item.status === 'pending')
                .map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.title}>{item.user?.name || 'Someone'}</Text>
                    {item.question ? <Text style={styles.body}>Question: {item.question}</Text> : null}
                    <View style={styles.tabs}>
                      <Pressable onPress={() => void respond(item.id, true)} style={[styles.tab, styles.tabOn]}>
                        <Text style={styles.tabText}>Accept</Text>
                      </Pressable>
                      <Pressable onPress={() => void respond(item.id, false)} style={styles.tab}>
                        <Text style={styles.tabText}>Decline</Text>
                      </Pressable>
                    </View>
                    {item.question && !item.organizerReply ? (
                      <>
                        <Field
                          label="Reply"
                          value={replies[item.id] || ''}
                          onChangeText={(value) => setReplies((prev) => ({ ...prev, [item.id]: value }))}
                        />
                        <NeonButton label="Reply" tone="ghost" onPress={() => void reply(item.id)} />
                      </>
                    ) : null}
                    {item.organizerReply ? <Text style={styles.meta}>Your reply: {item.organizerReply}</Text> : null}
                  </View>
                ))}
              {requests.some((item) => item.status === 'cancelled') ? <Text style={styles.label}>Can’t come</Text> : null}
              {requests
                .filter((item) => item.status === 'cancelled')
                .map((item) => (
                  <Text key={item.id} style={styles.meta}>
                    {item.user?.name || 'Guest'} cancelled: {item.cancelReason || 'No reason'}
                  </Text>
                ))}
            </>
          ) : null}

          {!host && !selected.myRequest ? (
            <>
              <Field label="Question for the host" value={joinQuestion} onChangeText={setJoinQuestion} multiline />
              <NeonButton label="Request to join" tone="magenta" onPress={() => void join()} />
            </>
          ) : null}
          {!host && selected.myRequest?.status === 'pending' ? (
            <>
              <Notice tone="gold">Request sent. Waiting for the host.</Notice>
              {selected.myRequest.organizerReply ? <Hint>{`Host reply: ${selected.myRequest.organizerReply}`}</Hint> : null}
              <Field label="Why you can’t come" value={cancelReason} onChangeText={setCancelReason} multiline />
              <NeonButton label="Cancel request" tone="danger" onPress={() => void cancel()} />
            </>
          ) : null}
          {!host && selected.myRequest?.status === 'accepted' ? (
            <>
              <Notice>You’re accepted.</Notice>
              <Field label="Why you can’t come" value={cancelReason} onChangeText={setCancelReason} multiline />
              <NeonButton label="Cancel — I can’t come" tone="danger" onPress={() => void cancel()} />
            </>
          ) : null}
          {!host && selected.myRequest?.status === 'cancelled' ? (
            <NeonButton label="Request to join again" onPress={() => void join()} />
          ) : null}

          {selected.canChat || host ? (
            <>
              <Text style={styles.label}>Meetup details</Text>
              {host ? (
                <>
                  <Field label="Where to meet" value={meetup} onChangeText={setMeetup} multiline />
                  <NeonButton label="Save details" onPress={() => void saveMeetup()} />
                </>
              ) : selected.meetupDetails ? (
                <Hint>{selected.meetupDetails || ''}</Hint>
              ) : null}
            </>
          ) : null}

          {selected.canChat ? (
            <>
              <Text style={styles.label}>Live chat</Text>
              {messages.map((item) => (
                <Text key={item.id} style={styles.body}>
                  {item.userName || 'Someone'}: {item.content}
                </Text>
              ))}
              <Field label="Message" value={chatDraft} onChangeText={setChatDraft} />
              <NeonButton label="Send" tone="magenta" onPress={() => void sendChat()} />
            </>
          ) : null}
        </>
      ) : null}
    </StageFrame>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabOn: { borderColor: shell.cyan, backgroundColor: 'rgba(0,212,255,0.16)' },
  tabText: { color: shell.white, fontSize: 13, fontWeight: '700' },
  card: {
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: shell.white, fontSize: 16, fontWeight: '700' },
  meta: { color: shell.faint, fontSize: 12 },
  body: { color: shell.text, fontSize: 14, lineHeight: 20 },
  label: { color: shell.cyan, fontSize: 13, fontWeight: '700', marginTop: 8 },
});
