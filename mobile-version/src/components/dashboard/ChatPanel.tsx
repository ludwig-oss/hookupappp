import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { chatAPI, type ChatIntent, type Conversation, type Message } from '../../api/chat';
import { formatAxiosError } from '../../lib/apiError';
import { Field, Hint, NeonButton, Notice, PanelTitle, StageFrame, shell } from './chrome';

const LANES: Array<{ id: 'all' | ChatIntent; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'serious', label: 'Serious' },
  { id: 'casual', label: 'Casual' },
  { id: 'friends', label: 'Friends' },
];

export function ChatPanel({
  userId,
  openUserId,
  onOpened,
}: {
  userId: string;
  openUserId: string | null;
  onOpened: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [lane, setLane] = useState<(typeof LANES)[number]['id']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadName, setThreadName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [finding, setFinding] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await chatAPI.getConversations(userId);
      setConversations(res.conversations || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load messages.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const openThread = useCallback(
    async (otherId: string, name: string) => {
      setThreadId(otherId);
      setThreadName(name);
      setError('');
      setFinding(false);
      try {
        const res = await chatAPI.getConversation(otherId, userId);
        setMessages(res.messages || []);
      } catch (err) {
        setError(formatAxiosError(err, 'Could not open that chat.'));
      }
    },
    [userId]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!openUserId) return;
    const known = conversations.find((item) => item.userId === openUserId);
    void openThread(openUserId, known?.name || 'Chat');
    onOpened();
    // Open once per requested user. Listing conversations here re-fires after the parent clears the id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openUserId]);

  useEffect(() => {
    if (!threadId) return;
    const known = conversations.find((item) => item.userId === threadId);
    if (known?.name) setThreadName(known.name);
  }, [conversations, threadId]);

  const send = async () => {
    if (!threadId || !draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    try {
      const res = await chatAPI.sendMessage(threadId, content, userId);
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send that message.'));
    }
  };

  const findPeople = async () => {
    setFinding(true);
    setError('');
    try {
      const res = search.trim()
        ? await chatAPI.searchUsers(userId, search.trim())
        : await chatAPI.getAvailableUsers(userId);
      setResults(res.users || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not search people.'));
    }
  };

  const visible = conversations.filter((item) => lane === 'all' || item.intent === lane);

  if (threadId) {
    return (
      <StageFrame>
        <View style={styles.threadHead}>
          <Pressable
            onPress={() => {
              setThreadId(null);
              void loadList();
            }}
            style={styles.back}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.threadName} numberOfLines={1}>
            {threadName}
          </Text>
        </View>
        <View style={styles.pills}>
          {(['serious', 'casual', 'friends'] as ChatIntent[]).map((intent) => (
            <Pressable
              key={intent}
              onPress={() => void chatAPI.setChatIntent(threadId, intent).catch(() => {})}
              style={styles.pill}
            >
              <Text style={styles.pillText}>{intent}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {messages.length === 0 ? <Hint>No messages yet. Say hello.</Hint> : null}
        {messages.map((message) => {
          const mine = message.fromUserId === userId;
          return (
            <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={styles.bubbleText}>{message.content}</Text>
            </View>
          );
        })}
        <Field placeholder="Message" value={draft} onChangeText={setDraft} />
        <NeonButton label="Send" onPress={() => void send()} disabled={!draft.trim()} />
      </StageFrame>
    );
  }

  return (
    <StageFrame>
      <PanelTitle icon="💬">Communication</PanelTitle>
      <View style={styles.policy}>
        <Text style={styles.policyText}>
          Reply within 24 hours to every message you receive after a match or mutual interest — or the match ends.
        </Text>
      </View>
      <View style={styles.lanes}>
        {LANES.map((item) => {
          const count = item.id === 'all' ? conversations.length : conversations.filter((c) => c.intent === item.id).length;
          return (
            <Pressable key={item.id} onPress={() => setLane(item.id)} style={[styles.lane, lane === item.id && styles.laneOn]}>
              <Text style={[styles.laneText, lane === item.id && styles.laneTextOn]}>
                {item.label} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.select}>Select a conversation, or start a new chat.</Text>
      <NeonButton label="+ New chat" onPress={() => void findPeople()} />
      {finding ? (
        <>
          <Field placeholder="Search friends" value={search} onChangeText={setSearch} autoCapitalize="words" />
          <NeonButton label="Search friends" tone="ghost" onPress={() => void findPeople()} />
          {results.map((person) => (
            <Pressable key={person.id} onPress={() => void openThread(person.id, person.name || person.username)}>
              <Text style={styles.result}>{person.name || person.username}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}
      {!loading && visible.length === 0 ? (
        <Hint>No conversations yet. Tap + New chat to see people.</Hint>
      ) : null}
      {visible.map((item) => (
        <Pressable key={item.userId} onPress={() => void openThread(item.userId, item.name)} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.name || '?').slice(0, 1)}</Text>
            {item.unreadCount > 0 ? (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage?.fromUserId === userId ? 'You: ' : ''}
              {item.lastMessage?.content?.startsWith('data:') ? 'Media' : item.lastMessage?.content || 'Open chat'}
            </Text>
          </View>
        </Pressable>
      ))}
    </StageFrame>
  );
}

const styles = StyleSheet.create({
  policy: {
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.35)',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: 8,
    padding: 10,
  },
  policyText: { color: shell.text, fontSize: 12, lineHeight: 18 },
  lanes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lane: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: shell.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  laneOn: { backgroundColor: shell.active, borderColor: shell.cyan },
  laneText: { color: shell.muted, fontSize: 12, textTransform: 'capitalize' },
  laneTextOn: { color: shell.white, fontWeight: '700' },
  select: { color: shell.muted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: shell.sideLine,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: shell.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: shell.white, fontWeight: '700' },
  unread: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: shell.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { color: shell.white, fontSize: 10, fontWeight: '700' },
  copy: { flex: 1, gap: 2 },
  name: { color: shell.white, fontSize: 15, fontWeight: '700' },
  preview: { color: shell.muted, fontSize: 13 },
  result: { color: shell.cyan, fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { color: shell.cyan, fontSize: 22 },
  threadName: { color: shell.white, fontSize: 16, fontWeight: '700', flex: 1 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: shell.white, fontSize: 11, textTransform: 'capitalize' },
  bubble: { maxWidth: '85%', borderRadius: 12, padding: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: 'rgba(0, 212, 255, 0.2)' },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#1a1a1a' },
  bubbleText: { color: shell.text, fontSize: 15, lineHeight: 20 },
});
