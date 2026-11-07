import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  confessionAPI,
  type BlurredConfessionGuide,
  type ConfessionAiGuide,
  type ConfessionSessionView,
} from '../../api/confession';
import { formatAxiosError } from '../../lib/apiError';
import { Field, Hint, NeonButton, Notice, StageFrame, shell } from './chrome';

type Step = 'home' | 'ai' | 'scope' | 'guides' | 'chat' | 'pay' | 'waiting';

export function ConfessionPanel() {
  const [step, setStep] = useState<Step>('home');
  const [aiGuides, setAiGuides] = useState<ConfessionAiGuide[]>([]);
  const [terms, setTerms] = useState('');
  const [humanTerms, setHumanTerms] = useState('');
  const [selectedAi, setSelectedAi] = useState<ConfessionAiGuide | null>(null);
  const [scope, setScope] = useState<'local' | 'international'>('local');
  const [guides, setGuides] = useState<BlurredConfessionGuide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<BlurredConfessionGuide | null>(null);
  const [amount, setAmount] = useState<5 | 10>(5);
  const [agreed, setAgreed] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [session, setSession] = useState<ConfessionSessionView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void confessionAPI
      .getInfo()
      .then((info) => {
        setAiGuides(info.aiGuides || []);
        setTerms(info.aiSeekerTerms || '');
        setHumanTerms(info.seekerSafetyAgreement || '');
      })
      .catch((err) => setError(formatAxiosError(err, 'Could not open the booth.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session || step !== 'chat') return;
    const timer = setInterval(() => {
      void confessionAPI
        .getSession(session.id)
        .then((res) => setSession(res.session))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [session?.id, step]);

  const openSession = (next: ConfessionSessionView, free?: boolean) => {
    setSession(next);
    if (next.status === 'active' || free) {
      setStep('chat');
      setNote(free ? 'Booth is open.' : '');
      return;
    }
    if (next.status === 'awaiting_payment') {
      setStep('pay');
      setNote('Agree recorded. Pay to open the booth.');
      return;
    }
    setStep('waiting');
    setNote('Request sent. The guide has to accept before the booth opens.');
  };

  const startAi = async () => {
    if (!selectedAi) return;
    if (!agreed) {
      setError('Agree to the terms before you start.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: next, simulatorFree } = await confessionAPI.createSession({
        amountEur: amount,
        agreeToTerms: true,
        kind: 'ai',
        aiGuideId: selectedAi.id,
      });
      openSession(next, simulatorFree);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not start that conversation.'));
    } finally {
      setLoading(false);
    }
  };

  const loadHuman = async (nextScope: 'local' | 'international') => {
    setScope(nextScope);
    setLoading(true);
    setError('');
    try {
      const data = await confessionAPI.listGuides(nextScope);
      setGuides(data.guides || []);
      setStep('guides');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load guides.'));
    } finally {
      setLoading(false);
    }
  };

  const bookHuman = async () => {
    if (!selectedGuide) return;
    if (!agreed) {
      setError('Agree to the safety rules before you book.');
      return;
    }
    if (!date.trim() || !time.trim()) {
      setError('Add a date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }
    const when = new Date(`${date.trim()}T${time.trim()}`);
    if (Number.isNaN(when.getTime())) {
      setError('Use a date like 2026-11-20 and a time like 19:30.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { session: next, simulatorFree } = await confessionAPI.createSession({
        amountEur: amount,
        agreeToTerms: true,
        kind: 'human',
        guideId: selectedGuide.id,
        guideScope: scope,
        appointmentAt: when.toISOString(),
      });
      openSession(next, simulatorFree);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not book that guide.'));
    } finally {
      setLoading(false);
    }
  };

  const pay = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const { url } = await confessionAPI.createStripeCheckout(session.id);
      if (!url) {
        setError('Payment is not available right now.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not open payment.'));
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!session || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setError('');
    try {
      const res = await confessionAPI.sendMessage(session.id, text);
      setSession(res.session);
    } catch (err) {
      setDraft(text);
      setError(formatAxiosError(err, 'Could not send that.'));
    }
  };

  const end = async () => {
    if (!session) return;
    try {
      await confessionAPI.endSession(session.id);
      setSession(null);
      setStep('home');
      setNote('Session ended.');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not end the session.'));
    }
  };

  return (
    <StageFrame>
      <Text style={styles.hero}>⛪</Text>
      <Text style={styles.title}>Confession Booth</Text>
      <Hint>A screen between you. You never see each other.</Hint>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice>{note}</Notice> : null}
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}

      {step === 'home' ? (
        <>
          <NeonButton label="Talk to an AI guide" onPress={() => { setAgreed(false); setStep('ai'); }} />
          <NeonButton label="Book a human guide" tone="magenta" onPress={() => setStep('scope')} />
        </>
      ) : null}

      {step === 'ai' ? (
        <>
          <NeonButton label="Back" tone="ghost" onPress={() => setStep('home')} />
          {aiGuides.map((guide) => (
            <Pressable key={guide.id} onPress={() => setSelectedAi(guide)} style={[styles.card, selectedAi?.id === guide.id && styles.cardOn]}>
              <Text style={styles.name}>{guide.name}</Text>
              <Text style={styles.meta}>{guide.tagline || guide.specialty}</Text>
            </Pressable>
          ))}
          {selectedAi ? (
            <>
              <View style={styles.row}>
                <Pressable onPress={() => setAmount(5)} style={[styles.chip, amount === 5 && styles.chipOn]}>
                  <Text style={styles.chipText}>€5</Text>
                </Pressable>
                <Pressable onPress={() => setAmount(10)} style={[styles.chip, amount === 10 && styles.chipOn]}>
                  <Text style={styles.chipText}>€10</Text>
                </Pressable>
              </View>
              {terms ? <Hint>{terms}</Hint> : null}
              <Pressable onPress={() => setAgreed((value) => !value)} style={styles.agree}>
                <Text style={styles.chipText}>{agreed ? '☑' : '☐'} I agree to the AI terms and safety rules</Text>
              </Pressable>
              <NeonButton label={loading ? 'Starting…' : `Talk to ${selectedAi.name.split(' ')[0]}`} tone="gold" onPress={() => void startAi()} disabled={loading} />
            </>
          ) : (
            <Hint>Pick a guide, then agree and start the conversation.</Hint>
          )}
        </>
      ) : null}

      {step === 'scope' ? (
        <>
          <NeonButton label="Back" tone="ghost" onPress={() => setStep('home')} />
          <Hint>The guide stays blurred and the voice stays masked.</Hint>
          <NeonButton label="Local guides" onPress={() => void loadHuman('local')} />
          <NeonButton label="International guides" tone="magenta" onPress={() => void loadHuman('international')} />
        </>
      ) : null}

      {step === 'guides' ? (
        <>
          <NeonButton label="Back" tone="ghost" onPress={() => setStep('scope')} />
          {guides.length === 0 && !loading ? <Hint>No guides in that area yet.</Hint> : null}
          {guides.map((guide) => (
            <Pressable key={guide.id} onPress={() => { setSelectedGuide(guide); setAgreed(false); setStep('guides'); }} style={[styles.card, selectedGuide?.id === guide.id && styles.cardOn]}>
              <Text style={styles.name}>{guide.label}</Text>
              <Text style={styles.meta}>{guide.scope} · {guide.rating} · {guide.experienceSnippet}</Text>
            </Pressable>
          ))}
          {selectedGuide ? (
            <>
              <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-11-20" autoCapitalize="none" />
              <Field label="Time" value={time} onChangeText={setTime} placeholder="19:30" autoCapitalize="none" />
              <View style={styles.row}>
                <Pressable onPress={() => setAmount(5)} style={[styles.chip, amount === 5 && styles.chipOn]}>
                  <Text style={styles.chipText}>€5</Text>
                </Pressable>
                <Pressable onPress={() => setAmount(10)} style={[styles.chip, amount === 10 && styles.chipOn]}>
                  <Text style={styles.chipText}>€10</Text>
                </Pressable>
              </View>
              {humanTerms ? <Hint>{humanTerms}</Hint> : null}
              <Pressable onPress={() => setAgreed((value) => !value)} style={styles.agree}>
                <Text style={styles.chipText}>{agreed ? '☑' : '☐'} I agree to the safety rules</Text>
              </Pressable>
              <NeonButton label={loading ? 'Booking…' : 'Request this guide'} tone="magenta" onPress={() => void bookHuman()} disabled={loading} />
            </>
          ) : null}
        </>
      ) : null}

      {step === 'pay' && session ? (
        <>
          <Hint>The booth opens after payment.</Hint>
          <NeonButton label="Pay and open the booth" tone="gold" onPress={() => void pay()} disabled={loading} />
          <NeonButton label="Back" tone="ghost" onPress={() => setStep('home')} />
        </>
      ) : null}

      {step === 'waiting' && session ? (
        <>
          <Hint>
            {session.appointmentAt
              ? `Appointment requested for ${new Date(session.appointmentAt).toLocaleString()}.`
              : 'Waiting for the guide.'}
          </Hint>
          <NeonButton
            label="Check again"
            onPress={() => {
              void confessionAPI.getSession(session.id).then((res) => openSession(res.session)).catch((err) => setError(formatAxiosError(err, 'Could not refresh.')));
            }}
          />
          <NeonButton label="Back" tone="ghost" onPress={() => setStep('home')} />
        </>
      ) : null}

      {step === 'chat' && session ? (
        <>
          <Hint>{session.guideDisplayLabel || session.guideAlias || selectedAi?.name || 'Private booth'}</Hint>
          {session.messages.map((item) => (
            <Text key={item.id} style={styles.line}>
              {item.alias}: {item.content}
            </Text>
          ))}
          <Field label="Message" value={draft} onChangeText={setDraft} placeholder="Say it here" autoCapitalize="sentences" />
          <NeonButton label="Send" tone="magenta" onPress={() => void send()} />
          <NeonButton label="End session" tone="danger" onPress={() => void end()} />
        </>
      ) : null}
    </StageFrame>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 42, textAlign: 'center' },
  title: { color: shell.cream, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  card: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  cardOn: { backgroundColor: shell.active, borderRadius: 8, paddingHorizontal: 8 },
  name: { color: shell.white, fontSize: 15, fontWeight: '700' },
  meta: { color: shell.faint, fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { borderColor: shell.cyan, backgroundColor: 'rgba(0,212,255,0.16)' },
  chipText: { color: shell.white, fontSize: 13, fontWeight: '700' },
  agree: { paddingVertical: 8 },
  line: { color: shell.text, fontSize: 14, lineHeight: 20 },
});
