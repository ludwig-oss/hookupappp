import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  datingBattleAPI,
  type BattleState,
  type SpotlightCard,
} from '../../api/datingBattle';
import { formatAxiosError } from '../../lib/apiError';
import { openChatWithUser } from '../../lib/openChat';
import { FeatureCoach } from './FeatureCoach';
import './DatingBattle.css';

const MODES = ['age', 'hot', 'random'] as const;
type PairMode = (typeof MODES)[number];

function nextMode(mode: PairMode): PairMode {
  if (mode === 'age') return 'hot';
  if (mode === 'hot') return 'random';
  return 'age';
}

function modeLine(mode?: string) {
  if (mode === 'hot') return 'Date round — someone with a lot of interest.';
  if (mode === 'random') return 'Random person this round.';
  if (mode === 'age') return 'Age match, close to the average interest.';
  return '';
}

const REASONS = [
  'No chemistry',
  'Different life stage',
  'They didn’t engage',
  'The energy was off',
  'I need someone more grounded',
];

const TIPS_KEY = 'datingBattleTipsHidden';
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

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function liveClock(state: BattleState | null, now: number, skew: number): { phase: 'wingman' | 'ejection' | 'matched' | 'ejected'; ms: number } {
  const battle = state?.battle;
  if (!battle || battle.status !== 'live') {
    return { phase: battle?.status === 'ejected' ? 'ejected' : 'matched', ms: 0 };
  }
  const t = now + skew;
  const wingmanEnd = new Date(battle.wingmanEndsAt).getTime();
  const ejectEnd = new Date(battle.ejectEndsAt).getTime();
  if (t < wingmanEnd) return { phase: 'wingman', ms: wingmanEnd - t };
  return { phase: 'ejection', ms: Math.max(0, ejectEnd - t) };
}

export function SpotlightLines({ card }: { card?: Pick<SpotlightCard, 'polishedQuality' | 'polishedFuture'> | null }) {
  if (!card) return null;
  return (
    <div className="dbattle-spot">
      <div>{card.polishedQuality}</div>
      <div>{card.polishedFuture}</div>
    </div>
  );
}

export default function DatingBattle() {
  const [data, setData] = useState<BattleState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  const [hideTips, setHideTips] = useState(() => localStorage.getItem(TIPS_KEY) === '1');
  const [pairMode, setPairMode] = useState<PairMode>(() => MODES[Math.floor(Math.random() * MODES.length)]);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [coachTarget, setCoachTarget] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const wingmanRef = useRef<HTMLButtonElement>(null);
  const ejectRef = useRef<HTMLButtonElement>(null);
  const skewRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedChat = useRef('');

  const apply = (next: BattleState, takeProfile: boolean) => {
    if (next.battle) {
      skewRef.current = new Date(next.battle.serverNow).getTime() - Date.now();
    }
    setData(next);
    if (takeProfile) {
      setSearchText(next.profile.searchText);
      setDistance(next.profile.maxDistanceKm);
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
    const onRefresh = () => {
      datingBattleAPI.getState().then((state) => applyRef.current(state, false)).catch(() => undefined);
    };
    window.addEventListener('dating-battle:refresh', onRefresh);
    return () => {
      cancel = true;
      window.removeEventListener('dating-battle:refresh', onRefresh);
    };
  }, []);

  useEffect(() => {
    if (data?.pairMode === 'age' || data?.pairMode === 'hot' || data?.pairMode === 'random') {
      setPairMode(data.pairMode);
    }
  }, [data?.pairMode]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const battle = data?.battle;
    if (!battle || battle.status !== 'live') return;
    const skew = new Date(battle.serverNow).getTime() - Date.now();
    const left = new Date(battle.ejectEndsAt).getTime() - (Date.now() + skew);
    const wait = Math.max(800, left + 300);
    const id = window.setTimeout(() => {
      datingBattleAPI.resolve(battle.id).then((next) => applyRef.current(next, false)).catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(id);
  }, [data?.battle?.id, data?.battle?.status, data?.battle?.ejectEndsAt]);

  useEffect(() => {
    const battle = data?.battle;
    if (!battle || battle.status !== 'live') return;
    const id = window.setInterval(() => {
      datingBattleAPI.getState().then((next) => applyRef.current(next, false)).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [data?.battle?.id, data?.battle?.status]);

  useEffect(() => {
    if (!data?.searching) return;
    const id = window.setInterval(() => {
      datingBattleAPI.getState().then((next) => applyRef.current(next, false)).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [data?.searching]);

  useEffect(() => {
    const outcome = data?.outcome;
    if (!outcome || outcome.status !== 'matched' || !outcome.matchedUserId) return;
    if (openedChat.current === outcome.id) return;
    openedChat.current = outcome.id;
    const id = window.setTimeout(() => openChatWithUser(outcome.matchedUserId || ''), 1200);
    return () => window.clearTimeout(id);
  }, [data?.outcome]);

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

  const tutorialStepRef = useRef(0);
  const nextTutorialStep = () => {
    if (tutorialStepRef.current >= TUTORIAL_STEPS.length - 1) {
      localStorage.setItem(TUTORIAL_KEY, 'true');
      setShowTutorial(false);
      return;
    }
    tutorialStepRef.current += 1;
    setTutorialStep(tutorialStepRef.current);
  };

  useEffect(() => {
    if (!showTutorial) {
      setCoachTarget(null);
      return;
    }
    const target = TUTORIAL_STEPS[tutorialStep].target;
    const node = target === 'filters'
      ? filtersRef.current
      : target === 'aiStats'
        ? cardsRef.current
        : target === 'wingman'
          ? wingmanRef.current
          : ejectRef.current;
    setCoachTarget(node);
  }, [showTutorial, tutorialStep, Boolean(data), data?.battle?.id, data?.battle?.status]);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await datingBattleAPI.checkout();
      window.location.href = session.url;
    } catch (err) {
      setError(formatAxiosError(err, 'Checkout is unavailable.'));
      setBusy(false);
    }
  };

  if (!data) {
    return <section ref={rootRef} className="dbattle"><p className="dbattle-lead">{error || 'Loading Connection…'}</p></section>;
  }

  const timing = liveClock(data, now, skewRef.current);
  const battle = data.battle;
  const paywall = !battle && data.triesLeft <= 0 && !data.blocked && !data.coachLocked;
  const coachStep = TUTORIAL_STEPS[tutorialStep];
  const triesLabel = data.freeRemaining > 0
    ? `Free rounds left: ${data.freeRemaining} / 5`
    : data.paidRemaining > 0
      ? `Paid rounds left: ${data.paidRemaining}`
      : 'Free rounds left: 0 / 5';

  return (
    <section ref={rootRef} className="dbattle">
      <h3>CONNECTION</h3>
      <p className="dbattle-lead">
        Search, set a distance, then take a 5-minute split-screen battle. No ejection means you land in Communications.
      </p>
      <div className="dbattle-tries">{triesLabel}</div>
      {error ? <div className="dbattle-error">{error}</div> : null}
      {data.blocked ? <div className="dbattle-empty">{data.blocked.message}</div> : null}

      {!battle && !data.searching && !data.blocked ? (
        <>
          <div ref={filtersRef}>
          <label className="dbattle-field">
            Who or what are you searching for?
            <input
              type="text"
              value={searchText}
              placeholder="A teacher, someone starting a channel, a night owl…"
              onChange={(event) => {
                const value = event.target.value;
                setSearchText(value);
                if (formReady) persist({ searchText: value });
              }}
            />
          </label>
          <label className="dbattle-field">
            <span className="dbattle-slider-row">
              <span>Distance limit</span>
              <strong>{distance} km</strong>
            </span>
            <input
              type="range"
              min={1}
              max={100}
              value={distance}
              aria-label="Distance limit"
              onChange={(event) => {
                const value = Number(event.target.value);
                setDistance(value);
                if (formReady) persist({ maxDistanceKm: value });
              }}
            />
          </label>
          </div>
          <label className="dbattle-field">
            Your best dating quality
            <input
              type="text"
              value={bestQuality}
              placeholder="I remember the small things"
              onChange={(event) => setBestQuality(event.target.value)}
              onBlur={() => formReady && persist({ bestQuality })}
            />
          </label>
          <label className="dbattle-field">
            Future plans
            <input
              type="text"
              value={futurePlans}
              placeholder="Starting a YouTube channel"
              onChange={(event) => setFuturePlans(event.target.value)}
              onBlur={() => formReady && persist({ futurePlans })}
            />
          </label>
          <label className="dbattle-check">
            <input
              type="checkbox"
              checked={workingOnSelf}
              onChange={(event) => {
                const value = event.target.checked;
                setWorkingOnSelf(value);
                if (formReady) persist({ workingOnSelf: value });
              }}
            />
            <span>I’m still working on myself. Pair me with grounded people, not untouchable 10s.</span>
          </label>
        </>
      ) : null}

      {data.coachLocked && data.coach && !battle ? (
        <div className="dbattle-coach">
          <strong>Dating coach</strong>
          <p className="dbattle-lead">Matching is paused until you finish this. {data.coach.rejectionsInWindow} rejections landed in a short window.</p>
          {data.coach.steps.map((step) => (
            <div key={step.id} style={{ marginBottom: 10 }}>
              <strong>{step.title}</strong>
              <p className="dbattle-lead">{step.body}</p>
              {step.field === 'quality' ? (
                <input value={quality} onChange={(event) => setQuality(event.target.value)} placeholder="A specific quality" style={{ width: '100%', padding: 8, borderRadius: 8 }} />
              ) : null}
              {step.field === 'plans' ? (
                <input value={plans} onChange={(event) => setPlans(event.target.value)} placeholder="A specific next step" style={{ width: '100%', padding: 8, borderRadius: 8 }} />
              ) : null}
              {step.field === 'opener' ? (
                <div className="dbattle-chips">
                  {step.options?.map((option) => (
                    <button key={option} type="button" onClick={() => setOpener(option)} style={{ outline: opener === option ? '2px solid #00d4ff' : undefined }}>
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="dbattle-start"
            disabled={busy}
            onClick={() => void run(() => datingBattleAPI.completeCoach({ quality, plans, opener }))}
          >
            Finish guide and unlock tips
          </button>
        </div>
      ) : null}

      {data.tips && !hideTips && !battle ? (
        <div className="dbattle-note">
          <strong>Coach tips</strong>
          <ul className="dbattle-tips">
            {data.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          <button type="button" className="dbattle-ghost" onClick={() => { localStorage.setItem(TIPS_KEY, '1'); setHideTips(true); }}>
            Got it
          </button>
        </div>
      ) : null}

      {!battle && !data.searching && data.preview && !data.coachLocked && !data.blocked ? (
        <article className="dbattle-card">
          <div className="dbattle-kicker">NEXT CONTESTANT</div>
          <strong>{data.preview.username ? `@${data.preview.username}` : data.preview.name}</strong>
          <span> {data.preview.age ? `· ${data.preview.age}` : ''}{data.preview.distanceKm != null ? ` · ${data.preview.distanceKm} km` : ''}</span>
          <p className="dbattle-quality">{data.preview.polishedQuality}</p>
          <p className="dbattle-plan">{data.preview.polishedFuture}</p>
        </article>
      ) : null}
      {!battle ? (
        <div ref={cardsRef} className={`dbattle-stage${data.searching ? ' is-live' : ''}`} aria-label="AI fighter cards">
          <div className="dbattle-side is-me">
            <div className="dbattle-shade" />
            <div className="dbattle-copy">
              <div className="dbattle-kicker">YOU</div>
              <strong>{bestQuality || 'Your quality'}</strong>
              <p className="dbattle-plan">{futurePlans || 'Your future plan'}</p>
            </div>
          </div>
          <div className="dbattle-side is-them">
            <div className="dbattle-shade" />
            <div className="dbattle-copy">
              <div className="dbattle-kicker">THEM</div>
              <strong>{data.preview?.name || 'Fighter'}</strong>
              <p className="dbattle-quality">{data.preview?.polishedQuality || 'Lehrer → Retter der Erde'}</p>
              <p className="dbattle-plan">{data.preview?.polishedFuture || 'The polished plan lands on this card.'}</p>
            </div>
          </div>
          {data.searching ? <div className="dbattle-clock">{clock(Math.max(0, new Date(data.searchingSince || Date.now()).getTime() + 5 * 60 * 1000 - (now + skewRef.current)))}</div> : null}
          {data.searching && !reasonOpen && now + skewRef.current >= new Date(data.searchingSince || 0).getTime() + 5 * 60 * 1000 ? (
            <button type="button" className="dbattle-mid" onClick={() => setReasonOpen(true)}>Next person</button>
          ) : data.searching ? <div className="dbattle-vs">VS</div> : null}
          {data.searching && reasonOpen ? (
            <ReasonSheet
              reason={reason}
              busy={busy}
              onPick={setReason}
              onChange={setReason}
              onConfirm={() => void run(async () => {
                const following = nextMode(data.pairMode || pairMode);
                const next = await datingBattleAPI.shuffle(reason.trim(), following);
                setPairMode(following);
                setReason('');
                setReasonOpen(false);
                return next;
              })}
            />
          ) : null}
        </div>
      ) : null}
      {data.allocationNote && !battle ? <p className="dbattle-note">{modeLine(data.pairMode) || data.allocationNote}</p> : null}
      {!battle && data.emptyReason && !data.blocked && !data.coachLocked ? <p className="dbattle-empty">{data.emptyReason}</p> : null}
      {!battle && data.outcome?.status === 'matched' ? (
        <div className="dbattle-note">
          It’s a match. Opening Communications…
          <div className="dbattle-actions" style={{ marginTop: 8 }}>
            <button type="button" className="dbattle-start" onClick={() => openChatWithUser(data.outcome?.matchedUserId || '')}>
              Open chat
            </button>
          </div>
        </div>
      ) : null}
      {!battle && data.outcome?.status === 'ejected' ? (
        <div className="dbattle-empty">
          {data.outcome.youWereRejected
            ? `They ejected the date.${data.outcome.ejectReason ? ` Reason: ${data.outcome.ejectReason}` : ''}`
            : 'You ejected this date. Start another round when you are ready.'}
        </div>
      ) : null}

      {paywall ? (
        <div className="dbattle-paywall">
          <strong>5 free rounds are used</strong>
          <p className="dbattle-lead">€{data.priceEur.toFixed(2)} unlocks {data.packRounds} more speed-dating battles.</p>
          <button type="button" className="dbattle-pay" disabled={busy} onClick={() => void pay()}>
            Pay €{data.priceEur.toFixed(2)}
          </button>
        </div>
      ) : null}

      {data.searching && !battle ? (
        <p className="dbattle-note">You’re live. The pool is open — a match starts the moment someone compatible joins.</p>
      ) : null}
      {!battle && !paywall && !data.coachLocked && !data.blocked ? (
        <button type="button" className="dbattle-start" disabled={busy || Boolean(data.searching)} onClick={() => void run(() => datingBattleAPI.start(pairMode))}>
          {data.searching ? 'Live — finding a match' : 'Start Live Battle'}
        </button>
      ) : null}
      {!battle ? (
        <>
          <button ref={wingmanRef} type="button" className="dbattle-wingman" disabled>
            Wingman — give them a fair chance
            <small>You: {bestQuality || 'Your best quality'}</small>
            <small>Them: {data.preview?.bestQuality || 'Their best quality'}</small>
          </button>
          {showTutorial ? (
            <button ref={ejectRef} type="button" className="dbattle-eject" disabled>
              Eject
            </button>
          ) : null}
        </>
      ) : null}

      {battle ? (
        <>
          <div ref={cardsRef} className={`dbattle-stage${battle.status === 'live' ? ' is-live' : ''}`} aria-label="Dating battle">
            <Side card={battle.me} kicker="YOU" mine />
            <Side card={battle.partner} kicker="THEM" />
            {battle.status === 'live' && timing.phase === 'ejection' && !reasonOpen ? (
              <button ref={ejectRef} type="button" className="dbattle-mid" disabled={busy} onClick={() => setReasonOpen(true)}>
                Next person
              </button>
            ) : battle.status === 'live' && !reasonOpen ? <div className="dbattle-vs">VS</div> : null}
            <div className="dbattle-clock" aria-live="polite">
              {battle.status === 'live' ? clock(timing.ms) : battle.status === 'matched' ? 'MATCH' : 'OUT'}
            </div>
            {battle.status === 'live' && reasonOpen ? (
              <ReasonSheet
                reason={reason}
                busy={busy}
                onPick={setReason}
                onChange={setReason}
                onConfirm={() => void run(async () => {
                  const following = nextMode(data.pairMode || pairMode);
                  const next = await datingBattleAPI.shuffle(reason.trim(), following);
                  setPairMode(following);
                  setReason('');
                  setReasonOpen(false);
                  return next;
                })}
              />
            ) : null}
          </div>
          {battle.status === 'live' ? (
            <>
              <div className="dbattle-prompt">{battle.prompt.text}</div>
              <div className="dbattle-actions" style={{ marginBottom: 10 }}>
                <button type="button" className="dbattle-next" disabled={busy} onClick={() => void run(() => datingBattleAPI.prompt(battle.id))}>
                  New question
                </button>
              </div>
              {data.coachOpener ? <p className="dbattle-lead">Coach opener: {data.coachOpener}</p> : null}
              {timing.phase === 'wingman' ? (
                <button
                  type="button"
                  ref={wingmanRef}
                  className="dbattle-wingman"
                  disabled={busy || battle.myConfirmed}
                  onClick={() => void run(() => datingBattleAPI.confirm(battle.id))}
                >
                  Wingman — give them a fair chance
                  <small>You: {battle.me.bestQuality}</small>
                  <small>Them: {battle.partner.bestQuality}</small>
                  <small>{battle.myConfirmed ? 'You locked in. Waiting on them.' : battle.partnerConfirmed ? 'They already locked in.' : 'Both locks make a match before the clock ends.'}</small>
                </button>
              ) : (
                <p className="dbattle-lead">Five minutes are up. The blue button in the middle asks why, then brings another person.</p>
              )}
            </>
          ) : null}
          {battle.status === 'matched' ? (
            <div className="dbattle-note">
              It’s a match. Opening Communications…
              <div className="dbattle-actions" style={{ marginTop: 8 }}>
                <button type="button" className="dbattle-start" onClick={() => openChatWithUser(battle.matchedUserId || battle.partner.id)}>
                  Open chat
                </button>
              </div>
            </div>
          ) : null}
          {battle.status === 'ejected' ? (
            <div className="dbattle-empty">
              {battle.youWereRejected
                ? `They ejected the date.${battle.ejectReason ? ` Reason: ${battle.ejectReason}` : ''}`
                : 'You ejected this date. The next contestant is ready when you start another round.'}
            </div>
          ) : null}
        </>
      ) : null}
      {showTutorial && coachStep ? (
      <FeatureCoach
        active={showTutorial}
        stepIndex={tutorialStep}
        stepCount={TUTORIAL_STEPS.length}
        title={coachStep.title}
        body={coachStep.description}
        cta={tutorialStep === TUTORIAL_STEPS.length - 1 ? 'LOSLEGEN 🚀' : 'WEITER →'}
        target={coachTarget}
        rootRef={rootRef}
        onNext={nextTutorialStep}
      />
      ) : null}
    </section>
  );
}

function ReasonSheet({
  reason,
  busy,
  onPick,
  onChange,
  onConfirm,
}: {
  reason: string;
  busy: boolean;
  onPick: (value: string) => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dbattle-reason is-center">
      <strong>Why this one?</strong>
      <div className="dbattle-chips">
        {REASONS.map((preset) => (
          <button key={preset} type="button" onClick={() => onPick(preset)}>{preset}</button>
        ))}
      </div>
      <textarea
        value={reason}
        placeholder="Why are you moving on? Required."
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" className="dbattle-mid is-inline" disabled={busy || reason.trim().length < 2} onClick={onConfirm}>
        Shuffle
      </button>
    </div>
  );
}

function Side({ card, kicker, mine = false }: { card: BattleState['preview']; kicker: string; mine?: boolean }) {
  if (!card) return null;
  return (
    <div className={`dbattle-side ${mine ? 'is-me' : 'is-them'}`}>
      {card.profilePicture ? <img src={card.profilePicture} alt="" /> : null}
      <div className="dbattle-shade" />
      <div className="dbattle-copy">
        <div className="dbattle-kicker">{kicker}</div>
        <strong>{card.name}</strong>
        <p className="dbattle-quality">{card.polishedQuality}</p>
        <p className="dbattle-plan">{card.polishedFuture}</p>
      </div>
    </div>
  );
}
