import { useEffect, useRef, useState } from 'react';
import type { AiGuideCharacter } from '../../api/aiGuides';
import {
  intimacyAPI,
  type IntimacyPosition,
  type IntimacyRoutine,
  type IntimacyTip,
  type TermActList,
  type TermActSide,
  type TermActTactic,
} from '../../api/intimacy';
import { speakGuideLine } from '../../lib/aiGuideSpeech';
import './IntimacyDesk.css';

function speakLine(guide: AiGuideCharacter, text: string, onStart: () => void, onEnd: () => void) {
  void speakGuideLine(guide.voice, text, onStart, onEnd, { rateCap: 0.96 });
}

function clock(total: number): string {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function IntimacyDesk({
  guide,
  onClose,
  onSpeaking,
  startOnTermAct = false,
}: {
  guide: AiGuideCharacter;
  onClose: () => void;
  onSpeaking: (on: boolean) => void;
  startOnTermAct?: boolean;
}) {
  const first = guide.name.split(' ')[0];
  const [tab, setTab] = useState<'positions' | 'termact'>(startOnTermAct ? 'termact' : 'positions');
  const [routine, setRoutine] = useState<IntimacyRoutine | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'brief' | 'flow'>('brief');
  const [index, setIndex] = useState(0);
  const [nowTip, setNowTip] = useState<IntimacyTip | null>(null);
  const [extraTip, setExtraTip] = useState<IntimacyTip | null>(null);
  const [nextName, setNextName] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const asked = useRef(false);

  const [termPack, setTermPack] = useState<TermActList | null>(null);
  const [side, setSide] = useState<TermActSide>('him-to-her');
  const [tactic, setTactic] = useState<TermActTactic | null>(null);
  const [termSeconds, setTermSeconds] = useState(0);
  const [termRunning, setTermRunning] = useState(false);
  const [discreet, setDiscreet] = useState<'earphone' | 'silent'>('earphone');
  const [toast, setToast] = useState('');
  const advancing = useRef(false);
  const tacticReq = useRef(0);

  const pos: IntimacyPosition | undefined = routine?.positions[index];
  const termTotal = Math.max(1, (tactic?.duration_minutes || 1) * 60);
  const termPct = Math.max(0, Math.min(100, (termSeconds / termTotal) * 100));

  useEffect(() => {
    intimacyAPI
      .routine()
      .then(setRoutine)
      .catch(() => setError('Could not load the bedroom flow.'));
  }, []);

  useEffect(() => {
    intimacyAPI
      .termAct()
      .then((pack) => {
        setTermPack(pack);
        setSide(pack.defaultSide || pack.side);
      })
      .catch(() => setError('Could not load TermAct.'));
  }, []);

  useEffect(() => {
    if (asked.current || !routine || tab !== 'positions') return;
    asked.current = true;
    speakLine(
      guide,
      `Both of you into this. Stop if it hurts. Three things before you start. Then I walk the shapes one at a time.`,
      () => onSpeaking(true),
      () => onSpeaking(false)
    );
  }, [guide, routine, onSpeaking, tab]);

  const loadStep = async (id: number, speakIt: boolean) => {
    try {
      const s = await intimacyAPI.step(id);
      const idx = Math.max(0, (routine?.positions || []).findIndex((p) => p.id === s.position.id));
      setIndex(idx >= 0 ? idx : 0);
      setNowTip(s.tips.now);
      setExtraTip(s.tips.extra);
      setNextName(s.next.name);
      setSeconds(s.position.durationMinutes * 60);
      setRunning(false);
      if (speakIt) {
        speakLine(guide, s.speak, () => onSpeaking(true), () => onSpeaking(false));
      }
    } catch {
      setError('Could not open that position.');
    }
  };

  const loadTactic = async (id: number, nextSide: TermActSide, speakIt: boolean) => {
    const mine = ++tacticReq.current;
    try {
      const s = await intimacyAPI.termActStep(id, nextSide);
      if (mine !== tacticReq.current) return;
      setTactic(s.tactic);
      setTermSeconds(s.tactic.duration_minutes * 60);
      setTermRunning(false);
      if (speakIt && discreet === 'earphone') {
        speakLine(
          guide,
          `Step ${s.tactic.id}. ${s.tactic.name}. ${s.tactic.description}`,
          () => onSpeaking(true),
          () => onSpeaking(false)
        );
      } else {
        window.speechSynthesis?.cancel();
        onSpeaking(false);
      }
    } catch {
      if (mine !== tacticReq.current) return;
      setError('Could not open that tactic.');
    }
  };

  useEffect(() => {
    if (!termPack || tab !== 'termact') return;
    void loadTactic(1, side, discreet === 'earphone');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termPack, tab, side]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setSeconds((n) => n - 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!termRunning) return;
    const t = window.setInterval(() => {
      setTermSeconds((n) => n - 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [termRunning]);

  useEffect(() => {
    if (!running || seconds > 0 || !pos) return;
    setRunning(false);
    void loadStep(pos.nextPositionId, true);
  }, [seconds, running, pos]);

  useEffect(() => {
    if (!termRunning || termSeconds > 0 || !tactic) return;
    if (advancing.current) return;
    advancing.current = true;
    setTermRunning(false);
    setToast(`Time. Next: ${tactic.next_id === 1 ? 'loop reset' : `step ${tactic.next_id}`}`);
    window.setTimeout(() => setToast(''), 3200);
    void loadTactic(tactic.next_id, side, discreet === 'earphone').finally(() => {
      advancing.current = false;
    });
  }, [termSeconds, termRunning, tactic, side, discreet]);

  const startFlow = () => {
    const firstPos = routine?.positions[0];
    if (!firstPos) return;
    setPhase('flow');
    setIndex(0);
    setSeconds(firstPos.durationMinutes * 60);
    setNextName(routine.positions[1]?.name || '');
    void loadStep(firstPos.id, true);
  };

  const go = (id: number) => {
    void loadStep(id, true);
  };

  const changeSide = (next: TermActSide) => {
    setSide(next);
    setTermRunning(false);
  };

  return (
    <div className={`intimacy-desk ${tab === 'termact' && discreet === 'silent' ? 'is-discreet' : ''}`}>
      <div className="intimacy-bar">
        <strong>Bedroom · {first}</strong>
        <button type="button" onClick={onClose}>
          Back to crew
        </button>
      </div>
      <div className="intimacy-tabs">
        <button type="button" className={tab === 'positions' ? 'is-on' : ''} onClick={() => setTab('positions')}>
          Positions
        </button>
        <button type="button" className={tab === 'termact' ? 'is-on' : ''} onClick={() => setTab('termact')}>
          TermAct
        </button>
      </div>
      {error && <p className="intimacy-error">{error}</p>}

      {tab === 'positions' && !routine && !error && <p>Loading the 59-step loop…</p>}

      {tab === 'positions' && routine && phase === 'brief' && (
        <div className="intimacy-brief">
          <p>{routine.disclaimer}</p>
          <h3>Before you start — not the whole lecture</h3>
          <p className="intimacy-note">Three tips now. More show up with each shape so you are not drowning.</p>
          <ul>
            {routine.briefing.map((t) => (
              <li key={t.id}>
                <b>{t.title}</b>
                <p>{t.line}</p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={startFlow}>
            Start with Elevated Lotus
          </button>
        </div>
      )}

      {tab === 'positions' && routine && phase === 'flow' && pos && (
        <div className="intimacy-flow">
          <div className="intimacy-main">
            <p className="intimacy-phase">
              Position {pos.id} of {routine.count}
            </p>
            <h2>{pos.name}</h2>
            <div className="intimacy-metrics">
              <span>{pos.difficulty}</span>
              <span>{pos.durationMinutes} min</span>
              <span>Next: {nextName}</span>
            </div>
            <p className="intimacy-desc">{pos.description}</p>
            <div className="intimacy-nav">
              <button
                type="button"
                onClick={() => go(routine.positions[(index - 1 + routine.positions.length) % routine.positions.length].id)}
              >
                Previous
              </button>
              <button type="button" onClick={() => go(pos.nextPositionId)}>
                Next transition
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunning(false);
                  go(routine.positions[0].id);
                }}
              >
                Reset loop
              </button>
            </div>
          </div>
          <aside className="intimacy-side">
            <p className="intimacy-clock">{clock(seconds)}</p>
            <div className="intimacy-timer-btns">
              <button type="button" onClick={() => setRunning(true)}>
                Start timer
              </button>
              <button type="button" onClick={() => setRunning(false)}>
                Pause
              </button>
            </div>
            {nowTip && (
              <article className={`intimacy-tip is-${nowTip.kind}`}>
                <b>{nowTip.title}</b>
                <p>{nowTip.line}</p>
              </article>
            )}
            {extraTip && extraTip.id !== nowTip?.id && (
              <article className={`intimacy-tip is-${extraTip.kind}`}>
                <b>{extraTip.title}</b>
                <p>{extraTip.line}</p>
              </article>
            )}
            <p className="intimacy-media">Guide clip for {pos.name} — Mei talks you through this shape. No video file; follow the text and the timer.</p>
          </aside>
        </div>
      )}

      {tab === 'termact' && (
        <div className="termact-desk">
          {toast && <div className="termact-toast">{toast}</div>}
          <p className="intimacy-note">
            80 tactics each way. Boy to girl is for men with a woman. Girl to boy is for women with a man. Adults, both
            into it. Stop on pain or “wait.”
          </p>
          <div className="termact-radios" role="radiogroup" aria-label="Perspective">
            <label className={side === 'him-to-her' ? 'is-on' : ''}>
              <input
                type="radio"
                name="termact-side"
                checked={side === 'him-to-her'}
                onChange={() => changeSide('him-to-her')}
              />
              Boy to girl
            </label>
            <label className={side === 'her-to-him' ? 'is-on' : ''}>
              <input
                type="radio"
                name="termact-side"
                checked={side === 'her-to-him'}
                onChange={() => changeSide('her-to-him')}
              />
              Girl to boy
            </label>
          </div>
          {termPack?.gender && (
            <p className="termact-lock">
              Profile gender is {termPack.gender}. Defaulted to {termPack.defaultSide === 'her-to-him' ? 'girl to boy' : 'boy to girl'}. You can still switch.
            </p>
          )}
          <div className="termact-discreet">
            <button
              type="button"
              className={discreet === 'earphone' ? 'is-on' : ''}
              onClick={() => setDiscreet('earphone')}
            >
              Earphones — Mei talks
            </button>
            <button
              type="button"
              className={discreet === 'silent' ? 'is-on' : ''}
              onClick={() => {
                window.speechSynthesis?.cancel();
                onSpeaking(false);
                setDiscreet('silent');
              }}
            >
              Silent — phone face-down
            </button>
          </div>
          {discreet === 'earphone' && (
            <p className="intimacy-note">Wear an earphone. Mei reads the steps. Keep the screen dim if anyone else is around.</p>
          )}
          {discreet === 'silent' && (
            <p className="intimacy-note">
              Put the phone where it cannot be seen. No voice. The progress bar is the only “video.” Follow by feel.
            </p>
          )}

          {!tactic && <p>Loading TermAct…</p>}
          {tactic && (
            <div className="intimacy-flow">
              <div className="intimacy-main">
                <p className="intimacy-phase">
                  Step {tactic.id} of 80 · {tactic.category}
                </p>
                <h2>{tactic.name}</h2>
                <div className="intimacy-metrics">
                  <span>{tactic.duration_minutes} min</span>
                  <span>Next: {tactic.next_id}</span>
                </div>
                <p className="intimacy-desc">{tactic.description}</p>
                <div className="intimacy-nav">
                  <button type="button" onClick={() => void loadTactic(tactic.id === 1 ? 80 : tactic.id - 1, side, discreet === 'earphone')}>
                    Previous tactic
                  </button>
                  <button type="button" onClick={() => void loadTactic(tactic.next_id, side, discreet === 'earphone')}>
                    Skip tactic
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTermRunning(false);
                      void loadTactic(1, side, discreet === 'earphone');
                    }}
                  >
                    Reset loop
                  </button>
                </div>
              </div>
              <aside className="intimacy-side">
                <p className="intimacy-clock">{clock(termSeconds)}</p>
                <div className="intimacy-timer-btns">
                  <button type="button" onClick={() => setTermRunning(true)}>
                    Start timer
                  </button>
                  <button type="button" onClick={() => setTermRunning(false)}>
                    Pause timer
                  </button>
                </div>
                <div className="termact-video" aria-label="Instructional video window (simulated)">
                  <span>Instructional video window (simulated)</span>
                  <div className="termact-video-bar">
                    <div style={{ width: `${termPct}%` }} />
                  </div>
                  <small>{Math.round(termPct)}% remaining · no film, just the timer</small>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
