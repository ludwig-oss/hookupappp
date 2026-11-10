import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeatureCoach } from './FeatureCoach';
import axios from 'axios';
import { datingBattleAPI, type BattleState, type PersonCard, type SpotlightCard } from '../../api/datingBattle';
import { formatAxiosError } from '../../lib/apiError';
import { shell } from './chrome';

const TUTORIAL_KEY = '@seen_connection_tutorial';

type TutorialTarget = 'filters' | 'aiStats' | 'wingman' | 'eject';

const TUTORIAL_STEPS: Array<{ title: string; description: string; target: TutorialTarget }> = [
  {
    title: '⚡ DER GEGNER-RADAR',
    description:
      'Gib ein, wonach du suchst, und wähle deinen Tinder-Style Radius. Unser Algorithmus matcht dich anhand deiner aktuellen Lebensphase!',
    target: 'filters',
  },
  {
    title: '🤖 DIE KI-CHARME-BORE',
    description:
      "Deine Angaben werden von unserer KI extrem gepusht. Aus 'Lehrer' wird automatisch ein 'Retter der Erde' – das wird deinem Date sofort angezeigt!",
    target: 'aiStats',
  },
  {
    title: '🛡️ DEIN DEUTSCHER WINGMAN',
    description:
      'Die ersten 5 Minuten versucht dieser Button euch zu verkuppeln. Er zeigt euch die besten Qualitäten des anderen, damit ihr euch eine echte Chance gebt.',
    target: 'wingman',
  },
  {
    title: '🚨 DER EJECTION-KNOPF',
    description:
      'Nach 5 Minuten wird der Button BLAU und dann ROT. Gefällt dir dein Date nicht? Drücke drauf und katapultiere sie/ihn sofort aus dem Stream!',
    target: 'eject',
  },
];

const REASONS = [
  'No chemistry',
  'Different life stage',
  'They didn’t engage',
  'The energy was off',
  'I need someone more grounded',
];

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SpotlightLines({ card }: { card?: Pick<SpotlightCard, 'polishedQuality' | 'polishedFuture'> | null }) {
  if (!card) return null;
  return (
    <View style={styles.spot}>
      <Text style={styles.quality}>{card.polishedQuality}</Text>
      <Text style={styles.plan}>{card.polishedFuture}</Text>
    </View>
  );
}

export function DatingBattlePanel({
  onOpenChat,
  scrollRef,
}: {
  onOpenChat: (userId: string) => void;
  scrollRef?: RefObject<React.ComponentRef<typeof ScrollView> | null>;
}) {
  const [data, setData] = useState<BattleState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [hotFlash, setHotFlash] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [quality, setQuality] = useState('');
  const [plans, setPlans] = useState('');
  const [opener, setOpener] = useState('');
  const [searchText, setSearchText] = useState('');
  const [distance, setDistance] = useState(40);
  const [bestQuality, setBestQuality] = useState('');
  const [futurePlans, setFuturePlans] = useState('');
  const [workingOnSelf, setWorkingOnSelf] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [trackWidth, setTrackWidth] = useState(1);
  const distanceRef = useRef(40);
  const [pendingCheckout, setPendingCheckout] = useState('');
  const skewRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedChat = useRef('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const filtersRef = useRef<React.ComponentRef<typeof View>>(null);
  const cardsRef = useRef<React.ComponentRef<typeof View>>(null);
  const wingmanRef = useRef<React.ComponentRef<typeof View>>(null);
  const ejectRef = useRef<React.ComponentRef<typeof View>>(null);

  useEffect(() => {
    let cancel = false;
    AsyncStorage.getItem(TUTORIAL_KEY)
      .then((value) => {
        if (!cancel && value !== 'true') setShowTutorial(true);
      })
      .catch(() => {
        if (!cancel) setShowTutorial(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const nextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep((step) => step + 1);
      return;
    }
    setShowTutorial(false);
    void AsyncStorage.setItem(TUTORIAL_KEY, 'true');
  };

  const apply = (next: BattleState, takeProfile: boolean) => {
    if (next.battle) skewRef.current = new Date(next.battle.serverNow).getTime() - Date.now();
    setData(next);
    if (takeProfile) {
      setSearchText(next.profile.searchText);
      setDistance(next.profile.maxDistanceKm);
      distanceRef.current = next.profile.maxDistanceKm;
      setBestQuality(next.profile.bestQuality);
      setFuturePlans(next.profile.futurePlans);
      setWorkingOnSelf(next.profile.workingOnSelf);
      setFormReady(true);
    }
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    let cancel = false;
    datingBattleAPI.getState().then((state) => {
      if (!cancel) applyRef.current(state, true);
    }).catch((err) => {
      if (!cancel) setError(formatAxiosError(err, 'Could not open Connection.'));
    });
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const phase = (() => {
    const battle = data?.battle;
    if (!battle || battle.status !== 'live') return battle?.status || 'lobby';
    const t = now + skewRef.current;
    return t < new Date(battle.wingmanEndsAt).getTime() ? 'wingman' : 'ejection';
  })();

  useEffect(() => {
    if (phase !== 'ejection') return;
    const id = setInterval(() => setHotFlash((value) => !value), 350);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const battle = data?.battle;
    if (!battle || battle.status !== 'live') return;
    const skew = new Date(battle.serverNow).getTime() - Date.now();
    const left = new Date(battle.ejectEndsAt).getTime() - (Date.now() + skew);
    const id = setTimeout(() => {
      datingBattleAPI.resolve(battle.id).then((next) => applyRef.current(next, false)).catch(() => undefined);
    }, Math.max(800, left + 300));
    return () => clearTimeout(id);
  }, [data?.battle?.id, data?.battle?.status, data?.battle?.ejectEndsAt]);

  useEffect(() => {
    const battle = data?.battle;
    if (!battle || battle.status !== 'live') return;
    const id = setInterval(() => {
      datingBattleAPI.getState().then((next) => applyRef.current(next, false)).catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [data?.battle?.id, data?.battle?.status]);

  useEffect(() => {
    const outcome = data?.outcome;
    if (!outcome || outcome.status !== 'matched' || !outcome.matchedUserId) return;
    if (openedChat.current === outcome.id) return;
    openedChat.current = outcome.id;
    const id = setTimeout(() => onOpenChat(outcome.matchedUserId || ''), 1200);
    return () => clearTimeout(id);
  }, [data?.outcome, onOpenChat]);

  const persist = (patch: Partial<BattleState['profile']>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      datingBattleAPI.saveProfile(patch).then((next) => applyRef.current(next, false)).catch((err) => {
        setError(formatAxiosError(err, 'Could not save filters.'));
      });
    }, 400);
  };

  const run = async (task: () => Promise<BattleState>) => {
    setBusy(true);
    setError('');
    try {
      apply(await task(), false);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : 0;
      if (status === 402) {
        setData((prev) => (prev ? { ...prev, triesLeft: 0, freeRemaining: 0, paidRemaining: 0 } : prev));
      }
      if (status === 423) {
        const next = await datingBattleAPI.getState().catch(() => null);
        if (next) apply(next, false);
      }
      setError(formatAxiosError(err, 'That action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await datingBattleAPI.checkout();
      setPendingCheckout(session.sessionId);
      await Linking.openURL(session.url);
    } catch (err) {
      setError(formatAxiosError(err, 'Checkout is unavailable.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmPaid = async () => {
    if (!pendingCheckout) return;
    setBusy(true);
    try {
      await datingBattleAPI.confirmPayment(pendingCheckout);
      apply(await datingBattleAPI.getState(), false);
      setPendingCheckout('');
    } catch (err) {
      setError(formatAxiosError(err, 'Payment is not confirmed yet.'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <Text style={styles.lead}>{error || 'Loading Connection…'}</Text>;
  }

  const battle = data.battle;
  const paywall = !battle && data.triesLeft <= 0 && !data.blocked && !data.coachLocked;
  const ms = battle && battle.status === 'live'
    ? Math.max(0, (phase === 'wingman' ? new Date(battle.wingmanEndsAt).getTime() : new Date(battle.ejectEndsAt).getTime()) - (now + skewRef.current))
    : 0;
  const tourTarget = showTutorial ? TUTORIAL_STEPS[tutorialStep].target : null;
  const coachRef = tourTarget === 'filters'
    ? filtersRef
    : tourTarget === 'aiStats'
      ? cardsRef
      : tourTarget === 'wingman'
        ? wingmanRef
        : ejectRef;
  const coachStep = TUTORIAL_STEPS[tutorialStep];
  const triesLabel = data.freeRemaining > 0
    ? `Free rounds left: ${data.freeRemaining} / 5`
    : data.paidRemaining > 0
      ? `Paid rounds left: ${data.paidRemaining}`
      : 'Free rounds left: 0 / 5';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>CONNECTION</Text>
      <Text style={styles.lead}>Search, set a distance, then take a 5-minute split-screen battle.</Text>
      <Text style={styles.tries}>{triesLabel}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data.blocked ? <Text style={styles.empty}>{data.blocked.message}</Text> : null}

      {!battle && !data.blocked ? (
        <>
        <View ref={filtersRef} collapsable={false}>
          <Text style={styles.label}>Who or what are you searching for?</Text>
          <TextInput
            value={searchText}
            placeholder="A teacher, someone starting a channel…"
            placeholderTextColor={shell.faint}
            style={styles.input}
            onChangeText={(value) => {
              setSearchText(value);
              if (formReady) persist({ searchText: value });
            }}
          />
          <View style={styles.sliderHead}>
            <Text style={styles.label}>Distance limit</Text>
            <Text style={styles.km}>{distance} km</Text>
          </View>
          <View
            style={styles.trackHit}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              const next = Math.round(1 + Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth)) * 99);
              distanceRef.current = next;
              setDistance(next);
              if (formReady) persist({ maxDistanceKm: next });
            }}
            onResponderMove={(event) => {
              const next = Math.round(1 + Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth)) * 99);
              distanceRef.current = next;
              setDistance(next);
            }}
            onResponderRelease={() => {
              if (formReady) persist({ maxDistanceKm: distanceRef.current });
            }}
          >
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${((distance - 1) / 99) * 100}%` }]} />
            </View>
          </View>
        </View>
          <Text style={styles.label}>Your best dating quality</Text>
          <TextInput
            value={bestQuality}
            placeholder="I remember the small things"
            placeholderTextColor={shell.faint}
            style={styles.input}
            onChangeText={setBestQuality}
            onBlur={() => formReady && persist({ bestQuality })}
          />
          <Text style={styles.label}>Future plans</Text>
          <TextInput
            value={futurePlans}
            placeholder="Starting a YouTube channel"
            placeholderTextColor={shell.faint}
            style={styles.input}
            onChangeText={setFuturePlans}
            onBlur={() => formReady && persist({ futurePlans })}
          />
          <Pressable
            style={styles.check}
            onPress={() => {
              const value = !workingOnSelf;
              setWorkingOnSelf(value);
              if (formReady) persist({ workingOnSelf: value });
            }}
          >
            <Text style={styles.checkBox}>{workingOnSelf ? '☑' : '☐'}</Text>
            <Text style={styles.lead}>I’m still working on myself. Pair me with grounded people, not untouchable 10s.</Text>
          </Pressable>
        </>
      ) : null}

      {data.coachLocked && data.coach && !battle ? (
        <View style={styles.card}>
          <Text style={styles.title}>Dating coach</Text>
          <Text style={styles.lead}>Matching is paused. {data.coach.rejectionsInWindow} rejections landed in a short window.</Text>
          {data.coach.steps.map((step) => (
            <View key={step.id} style={{ marginBottom: 8 }}>
              <Text style={styles.label}>{step.title}</Text>
              <Text style={styles.lead}>{step.body}</Text>
              {step.field === 'quality' ? (
                <TextInput value={quality} onChangeText={setQuality} placeholder="A specific quality" placeholderTextColor={shell.faint} style={styles.input} />
              ) : null}
              {step.field === 'plans' ? (
                <TextInput value={plans} onChangeText={setPlans} placeholder="A specific next step" placeholderTextColor={shell.faint} style={styles.input} />
              ) : null}
              {step.field === 'opener' ? step.options?.map((option) => (
                <Pressable key={option} onPress={() => setOpener(option)} style={[styles.chip, opener === option && styles.chipOn]}>
                  <Text style={styles.chipText}>{option}</Text>
                </Pressable>
              )) : null}
            </View>
          ))}
          <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => datingBattleAPI.completeCoach({ quality, plans, opener }))}>
            <Text style={styles.primaryText}>Finish guide and unlock tips</Text>
          </Pressable>
        </View>
      ) : null}

      {data.tips && !battle ? (
        <View style={styles.card}>
          {data.tips.map((tip) => <Text key={tip} style={styles.lead}>• {tip}</Text>)}
        </View>
      ) : null}

      {!battle && data.preview && !data.coachLocked && !data.blocked ? <Preview card={data.preview} /> : null}
      {!battle ? (
        <View ref={cardsRef} collapsable={false} style={styles.stage}>
          <View style={styles.half}>
            <View style={styles.shade} />
            <View style={styles.copy}>
              <Text style={styles.kicker}>YOU</Text>
              <Text style={styles.halfName}>{bestQuality || 'Your quality'}</Text>
              <Text style={styles.plan}>{futurePlans || 'Your future plan'}</Text>
            </View>
          </View>
          <View style={styles.half}>
            <View style={styles.shade} />
            <View style={styles.copy}>
              <Text style={styles.kicker}>THEM</Text>
              <Text style={styles.halfName}>{data.preview?.name || 'Fighter'}</Text>
              <Text style={styles.quality}>{data.preview?.polishedQuality || 'Lehrer → Retter der Erde'}</Text>
              <Text style={styles.plan}>{data.preview?.polishedFuture || 'The polished plan lands on this card.'}</Text>
            </View>
          </View>
        </View>
      ) : null}
      {data.allocationNote && !battle ? <Text style={styles.note}>{data.allocationNote}</Text> : null}
      {!battle && data.emptyReason && !data.blocked && !data.coachLocked ? <Text style={styles.empty}>{data.emptyReason}</Text> : null}
      {!battle && data.outcome?.status === 'ejected' ? (
        <Text style={styles.empty}>
          {data.outcome.youWereRejected
            ? `They ejected the date.${data.outcome.ejectReason ? ` Reason: ${data.outcome.ejectReason}` : ''}`
            : 'You ejected this date. Start another round when you are ready.'}
        </Text>
      ) : null}
      {!battle && data.outcome?.status === 'matched' ? (
        <Pressable style={styles.primary} onPress={() => onOpenChat(data.outcome?.matchedUserId || '')}>
          <Text style={styles.primaryText}>Open chat</Text>
        </Pressable>
      ) : null}

      {paywall ? (
        <View style={styles.card}>
          <Text style={styles.title}>5 free rounds are used</Text>
          <Text style={styles.lead}>€{data.priceEur.toFixed(2)} unlocks {data.packRounds} more speed-dating battles.</Text>
          <Pressable disabled={busy} style={styles.primary} onPress={() => void pay()}>
            <Text style={styles.primaryText}>Pay €{data.priceEur.toFixed(2)}</Text>
          </Pressable>
          {pendingCheckout ? (
            <Pressable disabled={busy} style={[styles.primary, { marginTop: 8, backgroundColor: shell.cyan }]} onPress={() => void confirmPaid()}>
              <Text style={styles.primaryText}>I’ve paid — unlock rounds</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!battle && !paywall && !data.coachLocked && !data.blocked ? (
        <Pressable disabled={busy || !data.preview} style={styles.primary} onPress={() => void run(() => datingBattleAPI.start())}>
          <Text style={styles.primaryText}>Start 5:00 battle</Text>
        </Pressable>
      ) : null}
      {!battle ? (
        <View ref={wingmanRef} collapsable={false}>
          <Pressable disabled style={styles.wingman}>
            <Text style={styles.primaryText}>Wingman — give them a fair chance</Text>
            <Text style={styles.lead}>You: {bestQuality || 'Your best quality'}</Text>
            <Text style={styles.lead}>Them: {data.preview?.bestQuality || 'Their best quality'}</Text>
          </Pressable>
        </View>
      ) : null}
      {!battle && showTutorial ? (
        <View ref={ejectRef} collapsable={false}>
          <Pressable disabled style={[styles.eject, { backgroundColor: '#2563eb' }]}>
            <Text style={styles.primaryText}>Eject</Text>
          </Pressable>
        </View>
      ) : null}

      {battle && battle.status === 'live' ? (
        <>
          <View ref={cardsRef} collapsable={false} style={styles.stage}>
            <Half card={battle.me} kicker="YOU" />
            <Half card={battle.partner} kicker="THEM" />
            <View style={styles.vs}><Text style={styles.vsText}>VS</Text></View>
            <View style={styles.clock}><Text style={styles.clockText}>{clock(ms)}</Text></View>
          </View>
          <Text style={styles.prompt}>{battle.prompt.text}</Text>
          <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => datingBattleAPI.prompt(battle.id))}>
            <Text style={styles.primaryText}>New question</Text>
          </Pressable>
          {phase === 'wingman' ? (
            <View ref={wingmanRef} collapsable={false}>
            <Pressable
              disabled={busy || battle.myConfirmed}
              style={styles.wingman}
              onPress={() => void run(() => datingBattleAPI.confirm(battle.id))}
            >
              <Text style={styles.primaryText}>Wingman — give them a fair chance</Text>
              <Text style={styles.lead}>You: {battle.me.bestQuality}</Text>
              <Text style={styles.lead}>Them: {battle.partner.bestQuality}</Text>
            </Pressable>
            </View>
          ) : (
            <View ref={ejectRef} collapsable={false}>
              <Pressable disabled={busy} style={[styles.eject, { backgroundColor: hotFlash ? '#dc2626' : '#2563eb' }]} onPress={() => setReasonOpen(true)}>
                <Text style={styles.primaryText}>Eject</Text>
              </Pressable>
            </View>
          )}
          {reasonOpen ? (
            <View>
              {REASONS.map((preset) => (
                <Pressable key={preset} style={styles.chip} onPress={() => setReason(preset)}>
                  <Text style={styles.chipText}>{preset}</Text>
                </Pressable>
              ))}
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Why are you ejecting? Required."
                placeholderTextColor={shell.faint}
                style={[styles.input, { minHeight: 72 }]}
                multiline
              />
              <Pressable
                disabled={busy || reason.trim().length < 2}
                style={[styles.eject, { backgroundColor: '#dc2626' }]}
                onPress={() => {
                  void run(() => datingBattleAPI.eject(battle.id, reason.trim()));
                  setReason('');
                  setReasonOpen(false);
                }}
              >
                <Text style={styles.primaryText}>Confirm eject</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      <FeatureCoach
        visible={showTutorial}
        stepIndex={tutorialStep}
        stepCount={TUTORIAL_STEPS.length}
        title={coachStep.title}
        body={coachStep.description}
        cta={tutorialStep === TUTORIAL_STEPS.length - 1 ? 'LOSLEGEN 🚀' : 'WEITER →'}
        targetRef={coachRef}
        scrollRef={scrollRef}
        onNext={nextTutorialStep}
      />
    </View>
  );
}

function Preview({ card }: { card: PersonCard }) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>NEXT CONTESTANT</Text>
      <Text style={styles.label}>{card.username ? `@${card.username}` : card.name}{card.age ? ` · ${card.age}` : ''}</Text>
      <Text style={styles.quality}>{card.polishedQuality}</Text>
      <Text style={styles.plan}>{card.polishedFuture}</Text>
    </View>
  );
}

function Half({ card, kicker }: { card: PersonCard; kicker: string }) {
  return (
    <View style={styles.half}>
      {card.profilePicture ? <Image source={{ uri: card.profilePicture }} style={styles.photo} /> : null}
      <View style={styles.shade} />
      <View style={styles.copy}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.halfName}>{card.name}</Text>
        <Text style={styles.quality}>{card.polishedQuality}</Text>
        <Text style={styles.plan}>{card.polishedFuture}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,0,255,0.45)',
    backgroundColor: '#100814',
  },
  title: { color: shell.magentaSoft, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  lead: { color: shell.faint, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  tries: { color: shell.cyan, fontSize: 12, marginBottom: 10 },
  error: { color: '#fda4af', marginBottom: 8 },
  empty: { color: shell.cream, marginBottom: 8 },
  note: { color: shell.goldText, marginBottom: 8 },
  label: { color: shell.text, fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
    borderRadius: 10,
    color: shell.white,
    padding: 10,
    marginBottom: 10,
  },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  km: { color: '#ff6b9a', fontWeight: '800' },
  trackHit: { height: 36, justifyContent: 'center', marginBottom: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#333', overflow: 'hidden' },
  fill: { height: 6, backgroundColor: '#ff2d55' },
  check: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  checkBox: { color: shell.cyan, fontSize: 16 },
  card: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 10 },
  quality: { color: '#ffb3c6', fontSize: 13, marginTop: 4 },
  plan: { color: '#fde68a', fontSize: 12, marginTop: 2 },
  spot: { marginTop: 4, marginBottom: 8 },
  kicker: { color: shell.cyan, fontSize: 10, letterSpacing: 1 },
  primary: { backgroundColor: shell.cyan, borderRadius: 12, padding: 12, marginBottom: 8 },
  primaryText: { color: '#041016', fontWeight: '800', textAlign: 'center' },
  chip: { borderWidth: 1, borderColor: 'rgba(147,197,253,0.4)', borderRadius: 10, padding: 8, marginBottom: 6 },
  chipOn: { borderColor: shell.cyan },
  chipText: { color: '#dbeafe', fontSize: 12 },
  stage: { height: 280, flexDirection: 'row', borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  half: { flex: 1, backgroundColor: '#161616', justifyContent: 'flex-end' },
  photo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  copy: { padding: 8 },
  halfName: { color: '#fff', fontWeight: '800' },
  vs: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  clock: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -42,
    width: 84,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  clockText: { color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 18 },
  prompt: { color: shell.white, fontSize: 16, lineHeight: 22, marginBottom: 8 },
  wingman: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 8,
  },
  eject: { borderRadius: 12, padding: 14, marginTop: 8 },
});
