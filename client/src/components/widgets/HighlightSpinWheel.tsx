import { useState, useRef, useEffect } from 'react';
import {
  getActiveWheelGames,
  minutesUntilWheelRotate,
  peekRestOfPool,
  type WheelGame,
} from '../../data/wheelGames';

const SECTIONS = 6;
const SLICE_ANGLE = 360 / SECTIONS;
const REMIX_KEY = 'highlights:wheelRemixBump';

function readRemixBump(): number {
  try {
    const n = Number(localStorage.getItem(REMIX_KEY) || '0');
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return 0;
  }
}

interface HighlightSpinWheelProps {
  onOutcome?: (gameId: string) => void;
}

export default function HighlightSpinWheel({ onOutcome }: HighlightSpinWheelProps) {
  const [remixBump, setRemixBump] = useState(() => readRemixBump());
  const [games, setGames] = useState<WheelGame[]>(() => getActiveWheelGames(Date.now(), readRemixBump()));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const rotateIn = minutesUntilWheelRotate();
  const poolPeek = peekRestOfPool(games, 8);

  useEffect(() => {
    const tick = () => setGames(getActiveWheelGames(Date.now(), remixBump));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [remixBump]);

  const handleRemix = () => {
    if (spinning) return;
    const next = remixBump + 1;
    setRemixBump(next);
    try {
      localStorage.setItem(REMIX_KEY, String(next));
    } catch {
      /* ignore */
    }
    setGames(getActiveWheelGames(Date.now(), next));
  };

  const handleSpin = () => {
    if (spinning || games.length < 6) return;
    setSpinning(true);
    const fullSpins = 4 + Math.floor(Math.random() * 4);
    const finalSlice = Math.floor(Math.random() * SECTIONS);
    const landedId = games[finalSlice]?.id || games[0]?.id;
    const finalAngle = 360 - (finalSlice * SLICE_ANGLE + SLICE_ANGLE / 2);
    const totalDegrees = rotationRef.current + fullSpins * 360 + finalAngle;
    setRotation(totalDegrees);
    rotationRef.current = totalDegrees;
    window.setTimeout(() => {
      setSpinning(false);
      if (landedId) {
        onOutcome?.(landedId);
      }
    }, 4000);
  };

  const conicGradient = [
    'rgba(0, 212, 255, 0.55) 0deg',
    'rgba(255, 0, 255, 0.45) 60deg',
    'rgba(0, 212, 255, 0.4) 120deg',
    'rgba(255, 0, 255, 0.4) 180deg',
    'rgba(0, 212, 255, 0.45) 240deg',
    'rgba(255, 0, 255, 0.5) 300deg',
    'rgba(0, 212, 255, 0.55) 360deg',
  ].join(', ');

  return (
    <div className="highlight-spin-wheel-wrap">
      <div className="highlight-spin-wheel-pointer" aria-hidden>▼</div>
      <button
        type="button"
        className="highlight-spin-wheel"
        onClick={handleSpin}
        disabled={spinning}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          background: `conic-gradient(${conicGradient})`,
        }}
        aria-label="Spin the wheel"
      >
        <div className="highlight-spin-wheel-labels">
          {games.slice(0, SECTIONS).map((g, i) => {
            const angle = 30 + i * SLICE_ANGLE;
            return (
              <div
                key={g.id}
                className="highlight-spin-wheel-label-pos"
                style={{
                  transform: `rotate(${angle}deg) translateY(-58px)`,
                }}
              >
                <span className="highlight-spin-wheel-label" style={{ transform: `rotate(${-angle}deg)` }} title={g.name}>
                  {g.short}
                </span>
              </div>
            );
          })}
        </div>
        <div className="highlight-spin-wheel-center" />
      </button>
      <p className="highlight-spin-wheel-hint">{spinning ? 'Spinning...' : 'Click the wheel to spin'}</p>
      <p className="highlight-spin-wheel-how" style={{ maxWidth: 340, margin: '0.5rem auto', fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.4 }}>
        Only <strong>6 of 24</strong> games sit on the wheel at once. They auto-remix about every {rotateIn} min — or tap Remix to swap in the wild ones now. Simulator restart is not needed.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <button
          type="button"
          className="wheel-outcome-btn"
          onClick={handleRemix}
          disabled={spinning}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Remix games
        </button>
      </div>
      <div className="highlight-spin-wheel-legend" aria-label="Games on this wheel">
        <p>On the wheel right now:</p>
        <ul>
          {games.slice(0, SECTIONS).map((g, i) => (
            <li key={g.id}>{i + 1}. {g.name}</li>
          ))}
        </ul>
        {poolPeek.length > 0 && (
          <>
            <p style={{ marginTop: 10 }}>Also in the 24-game pool (tap Remix to bring some on):</p>
            <ul style={{ opacity: 0.85 }}>
              {poolPeek.map((g) => (
                <li key={g.id}>{g.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
