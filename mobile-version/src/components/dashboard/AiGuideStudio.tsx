import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiGuidesAPI, type AiGuideCharacter } from '../../api/aiGuides';
import { formatAxiosError } from '../../lib/apiError';
import { useAuth } from '../../state/AuthContext';
import { shell } from './chrome';

const WEB_ORIGIN = 'https://hookupapp.dev';

export function guidePortraitUri(portrait?: string | null): string | null {
  if (!portrait) return null;
  if (/^https?:\/\//i.test(portrait)) return portrait;
  return `${WEB_ORIGIN}${portrait.startsWith('/') ? portrait : `/${portrait}`}`;
}

function greetingFor(guide: AiGuideCharacter) {
  const first = guide.name.split(' ')[0];
  const warm = (guide.ratings?.warmth ?? 5) >= 6;
  if (warm) return `Hey — it's ${first}. How's your day going? What's on your mind? I'm here.`;
  return `Hey. ${first} here. What's the real situation — say it straight. I'm listening.`;
}

function deskLabel(guide: AiGuideCharacter) {
  if (guide.desk === 'fashion') return 'Fashion desk';
  if (guide.desk === 'appearance') return 'Face desk';
  if (guide.desk === 'hair') return 'Hair desk';
  if (guide.desk === 'relationship') return 'Couples desk';
  if (guide.desk === 'finance') return 'Finance desk';
  if (guide.desk === 'texting') return 'Texting desk';
  if (guide.desk === 'intimacy') return 'Bedroom desk';
  if (guide.lens === 'feminine') return 'Feminine lens';
  return '';
}

type Msg = { id: string; from: 'guide' | 'me'; text: string };

export function AiGuideStudio({
  visible,
  startInChat = false,
  assignOnOpen = false,
  initialGuideId,
  onClose,
  onAssigned,
}: {
  visible: boolean;
  startInChat?: boolean;
  assignOnOpen?: boolean;
  initialGuideId?: string;
  onClose: () => void;
  onAssigned: (guide: AiGuideCharacter) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [guides, setGuides] = useState<AiGuideCharacter[]>([]);
  const [selected, setSelected] = useState<AiGuideCharacter | null>(null);
  const [inChat, setInChat] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const userGuideId = useRef(user?.aiGuideId);
  userGuideId.current = user?.aiGuideId;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const onAssignedRef = useRef(onAssigned);
  onAssignedRef.current = onAssigned;

  const chooseGuide = async (guide: AiGuideCharacter) => {
    setBusy(true);
    setError('');
    try {
      await aiGuidesAPI.assign(guide.id);
      updateUserRef.current({ aiGuideId: guide.id });
      onAssignedRef.current(guide);
      setSelected(guide);
      setInChat(true);
    } catch (err) {
      setInChat(false);
      setError(formatAxiosError(err, 'Could not start with this guide.'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError('');
    setQuery('');
    setLoading(true);
    void aiGuidesAPI
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = res.guides || [];
        setGuides(list);
        const guide =
          list.find((item) => item.id === initialGuideId) ||
          list.find((item) => item.id === userGuideId.current) ||
          list[0] ||
          null;
        setSelected(guide);
        if (startInChat && guide) {
          if (assignOnOpen) void chooseGuide(guide);
          else setInChat(true);
        } else {
          setInChat(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(formatAxiosError(err, 'Could not load guides.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // chooseGuide reads the latest auth helpers through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialGuideId, startInChat, assignOnOpen]);

  useEffect(() => {
    if (!inChat || !selected) return;
    setMessages([{ id: `g-${selected.id}`, from: 'guide', text: greetingFor(selected) }]);
    setDraft('');
  }, [inChat, selected?.id]);

  useEffect(() => {
    if (!inChat) return;
    const timer = setTimeout(() => threadRef.current?.scrollToEnd({ animated: true }), 40);
    return () => clearTimeout(timer);
  }, [messages, inChat]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !selected) return;
    const history = messages.slice(-12).map((item) => ({ from: item.from, text: item.text }));
    setDraft('');
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, from: 'me', text }]);
    setBusy(true);
    setError('');
    try {
      const turn = await aiGuidesAPI.chat(selected.id, text, history);
      const reply = (turn.reply || 'Say that again in one sentence.').replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
      setMessages((prev) => [...prev, { id: `g-${Date.now()}`, from: 'guide', text: reply }]);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not reach that guide.'));
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await aiGuidesAPI.interpret(q);
      const moneyCue = /\b(money|debt|budget|income|business|saas|hustle|broke|spend)\b/i.test(q);
      const guide =
        ((moneyCue || result.guess?.id === 'cash-flow-execution') && guides.find((item) => item.desk === 'finance')) ||
        selected ||
        guides[0] ||
        null;
      if (!guide) {
        setError('Pick a coach and talk.');
        return;
      }
      await chooseGuide(guide);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not read that. Try fewer words.'));
    } finally {
      setBusy(false);
    }
  };

  const portrait = guidePortraitUri(selected?.portrait);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => (inChat ? setInChat(false) : onClose())}
            style={styles.topBtn}
            accessibilityLabel={inChat ? 'Back to guides' : 'Close'}
          >
            <Text style={styles.topBtnText}>{inChat ? '← Guides' : 'Close'}</Text>
          </Pressable>
          <Text style={styles.brand} numberOfLines={1}>
            {inChat && selected ? selected.name : 'AI Crew'}
          </Text>
          <Pressable onPress={onClose} style={styles.topBtn} accessibilityLabel="Close AI guides">
            <Text style={styles.topBtnText}>Close</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={shell.gold} style={styles.spinner} /> : null}

        {inChat && selected ? (
          <>
            <ScrollView
              ref={threadRef}
              style={styles.thread}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.chatHead}>
                {portrait ? <Image source={{ uri: portrait }} style={styles.chatFace} /> : <View style={styles.chatFace} />}
                <View style={styles.chatMeta}>
                  <Text style={styles.chatName}>{selected.name}</Text>
                  <Text style={styles.chatSpecialty}>{selected.specialty}</Text>
                </View>
              </View>
              {messages.map((item) => (
                <View key={item.id} style={[styles.bubble, item.from === 'me' ? styles.bubbleMe : styles.bubbleGuide]}>
                  <Text style={[styles.bubbleText, item.from === 'me' && styles.bubbleTextMe]}>{item.text}</Text>
                </View>
              ))}
              {busy ? <Text style={styles.thinking}>Thinking…</Text> : null}
            </ScrollView>
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message ${selected.name.split(' ')[0]}`}
                placeholderTextColor={shell.faint}
                style={styles.composerInput}
                multiline
              />
              <Pressable
                onPress={() => void send()}
                disabled={busy || !draft.trim()}
                style={[styles.send, (!draft.trim() || busy) && styles.sendOff]}
              >
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.crew} keyboardShouldPersistTaps="handled">
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ghosting, what to wear, a first date…"
                placeholderTextColor={shell.faint}
                style={styles.searchInput}
                onSubmitEditing={() => void runSearch()}
                returnKeyType="search"
              />
              <Pressable onPress={() => void runSearch()} disabled={busy || !query.trim()} style={styles.find}>
                <Text style={styles.findText}>{busy ? '…' : 'Find'}</Text>
              </Pressable>
            </View>
            <Text style={styles.lead}>Tap a guide. They start the conversation right away.</Text>
            {guides.map((guide) => {
              const uri = guidePortraitUri(guide.portrait);
              const tag = deskLabel(guide);
              const on = selected?.id === guide.id;
              return (
                <Pressable
                  key={guide.id}
                  disabled={busy}
                  onPress={() => void chooseGuide(guide)}
                  style={[styles.card, on && styles.cardOn]}
                >
                  {uri ? <Image source={{ uri }} style={styles.cardFace} /> : <View style={styles.cardFace} />}
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardName}>{guide.name}</Text>
                    <Text style={styles.cardSpecialty}>{guide.specialty}</Text>
                    {tag ? <Text style={styles.cardTag}>{tag}</Text> : null}
                    <Text style={styles.cardTagline} numberOfLines={2}>{guide.tagline}</Text>
                  </View>
                  <Text style={styles.choose}>{busy && on ? '…' : 'Choose'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0c0c10' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.35)',
  },
  topBtn: { minWidth: 72, paddingVertical: 8, paddingHorizontal: 8 },
  topBtnText: { color: shell.goldText, fontSize: 14, fontWeight: '700' },
  brand: { flex: 1, textAlign: 'center', color: shell.white, fontSize: 16, fontWeight: '800' },
  error: { color: shell.pinkSoft, paddingHorizontal: 16, paddingTop: 10, fontSize: 13 },
  spinner: { marginTop: 16 },
  crew: { padding: 16, paddingBottom: 32, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: shell.white,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  find: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.28)',
    borderWidth: 1,
    borderColor: shell.gold,
  },
  findText: { color: shell.goldText, fontWeight: '800' },
  lead: { color: '#e7c9a0', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  cardOn: { borderColor: shell.goldText },
  cardFace: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#222' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardName: { color: shell.goldText, fontSize: 15, fontWeight: '800' },
  cardSpecialty: { color: '#e7c9a0', fontSize: 12, marginTop: 2 },
  cardTag: { color: shell.cyan, fontSize: 11, marginTop: 4, fontWeight: '700' },
  cardTagline: { color: shell.faint, fontSize: 12, marginTop: 4 },
  choose: { color: shell.goldText, fontWeight: '800', fontSize: 13 },
  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 10 },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  chatFace: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#222' },
  chatMeta: { flex: 1 },
  chatName: { color: shell.white, fontSize: 18, fontWeight: '800' },
  chatSpecialty: { color: '#e7c9a0', fontSize: 13, marginTop: 2 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleGuide: { alignSelf: 'flex-start', backgroundColor: '#1c1c24', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)' },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: shell.gold },
  bubbleText: { color: shell.white, fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: '#1a1206' },
  thinking: { color: shell.faint, fontSize: 13 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: shell.white,
  },
  send: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: shell.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
  sendText: { color: '#1a1206', fontWeight: '800' },
});
