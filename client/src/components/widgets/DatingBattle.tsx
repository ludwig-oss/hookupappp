import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  datingBattleAPI,
  type BattleState,
  type SpotlightCard,
} from '../../api/datingBattle';
import { formatAxiosError } from '../../lib/apiError';
import { openChatWithUser } from '../../lib/openChat';
import './DatingBattle.css';

const REASONS = [
  'No chemistry',
  'Different life stage',
  'They didn’t engage',
  'The energy was off',
  'I need someone more grounded',
];

const TIPS_KEY = 'datingBattleTipsHidden';

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
    return <section className="dbattle"><p className="dbattle-lead">{error || 'Loading Connection…'}</p></section>;
  }

  const timing = liveClock(data, now, skewRef.current);
  const battle = data.battle;
  const paywall = !battle && data.triesLeft <= 0 && !data.blocked && !data.coachLocked;
  const triesLabel = data.freeRemaining > 0
    ? `Free rounds left: ${data.freeRemaining} / 5`
    : data.paidRemaining > 0
      ? `Paid rounds left: ${data.paidRemaining}`
      : 'Free rounds left: 0 / 5';

  return (
    <section className="dbattle">
      <h3>CONNECTION</h3>
      <p className="dbattle-lead">
        Search, set a distance, then take a 5-minute split-screen battle. No ejection means you land in Communications.
      </p>
      <div className="dbattle-tries">{triesLabel}</div>
      {error ? <div className="dbattle-error">{error}</div> : null}
      {data.blocked ? <div className="dbattle-empty">{data.blocked.message}</div> : null}

      {!battle && !data.blocked ? (
        <>
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

      {!battle && data.preview && !data.coachLocked && !data.blocked ? (
        <article className="dbattle-card">
          <div className="dbattle-kicker">NEXT CONTESTANT</div>
          <strong>{data.preview.username ? `@${data.preview.username}` : data.preview.name}</strong>
          <span> {data.preview.age ? `· ${data.preview.age}` : ''}{data.preview.distanceKm != null ? ` · ${data.preview.distanceKm} km` : ''}</span>
          <p className="dbattle-quality">{data.preview.polishedQuality}</p>
          <p className="dbattle-plan">{data.preview.polishedFuture}</p>
        </article>
      ) : null}
      {data.allocationNote && !battle ? <p className="dbattle-note">{data.allocationNote}</p> : null}
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

      {!battle && !paywall && !data.coachLocked && !data.blocked ? (
        <button type="button" className="dbattle-start" disabled={busy || !data.preview} onClick={() => void run(() => datingBattleAPI.start())}>
          Start 5:00 battle
        </button>
      ) : null}

      {battle ? (
        <>
          <div className="dbattle-stage" aria-label="Dating battle">
            <Side card={battle.me} kicker="YOU" mine />
            <Side card={battle.partner} kicker="THEM" />
            <div className="dbattle-vs">VS</div>
            <div className="dbattle-clock" aria-live="polite">
              {battle.status === 'live' ? clock(timing.ms) : battle.status === 'matched' ? 'MATCH' : 'OUT'}
            </div>
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
                <>
                  <button type="button" className="dbattle-eject" disabled={busy} onClick={() => setReasonOpen(true)}>
                    Eject
                  </button>
                  <p className="dbattle-lead">Blue, then red. Press it to eliminate this date, or let the window close and move to Communications.</p>
                </>
              )}
              {reasonOpen ? (
                <div className="dbattle-reason">
                  <div className="dbattle-chips">
                    {REASONS.map((preset) => (
                      <button key={preset} type="button" onClick={() => setReason(preset)}>{preset}</button>
                    ))}
                  </div>
                  <textarea
                    value={reason}
                    placeholder="Why are you ejecting? Required."
                    onChange={(event) => setReason(event.target.value)}
                    style={{ minHeight: 72, borderRadius: 10, padding: 10 }}
                  />
                  <button
                    type="button"
                    className="dbattle-eject"
                    style={{ animation: 'none', background: '#dc2626' }}
                    disabled={busy || reason.trim().length < 2}
                    onClick={() => void run(() => datingBattleAPI.eject(battle.id, reason.trim())).then(() => {
                      setReason('');
                      setReasonOpen(false);
                    })}
                  >
                    Confirm eject
                  </button>
                </div>
              ) : null}
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
    </section>
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
