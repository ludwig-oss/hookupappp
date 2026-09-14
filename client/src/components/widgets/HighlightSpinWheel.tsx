import { useState, useRef } from 'react';
import {
  pickWheelBatch,
  peekRestOfPool,
  readRecentWheelIds,
  writeRecentWheelIds,
  type WheelGame,
} from '../../data/wheelGames';

const SECTIONS = 6;
const SLICE_ANGLE = 360 / SECTIONS;

interface HighlightSpinWheelProps {
  onOutcome?: (gameId: string) => void;
}

export default function HighlightSpinWheel({ onOutcome }: HighlightSpinWheelProps) {
  const [games, setGames] = useState<WheelGame[]>(() => pickWheelBatch(readRecentWheelIds()));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const poolPeek = peekRestOfPool(games, 12);

  const remixForNextSpin = (justPlayedId?: string) => {
    const prevIds = gamesRef.current.map((g) => g.id);
    const recent = [...readRecentWheelIds(), ...prevIds, ...(justPlayedId ? [justPlayedId] : [])];
    writeRecentWheelIds(recent);
    const next = pickWheelBatch(recent);
    setGames(next);
    gamesRef.current = next;
  };

  const handleSpin = () => {
    if (spinning || gamesRef.current.length < 6) return;
    setSpinning(true);
    const batch = gamesRef.current;
    const fullSpins = 4 + Math.floor(Math.random() * 4);
    const finalSlice = Math.floor(Math.random() * SECTIONS);
    const landedId = batch[finalSlice]?.id || batch[0]?.id;
    const finalAngle = 360 - (finalSlice * SLICE_ANGLE + SLICE_ANGLE / 2);
    const totalDegrees = rotationRef.current + fullSpins * 360 + finalAngle;
    setRotation(totalDegrees);
    rotationRef.current = totalDegrees;
    window.setTimeout(() => {
      setSpinning(false);
      if (landedId) onOutcome?.(landedId);
      // Auto-remix after every spin so the next wheel shows other games from the 24
      remixForNextSpin(landedId);
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
                key={`${g.id}-${i}`}
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
        <strong>6 of 24</strong> games on the wheel. After every spin the wheel auto-remixes so you can test the wild ones (Ex-Talk Ban, Ghost Protocol, First-Date Roulette, etc.).
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="wheel-outcome-btn"
          onClick={() => remixForNextSpin()}
          disabled={spinning}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Remix now
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
            <p style={{ marginTop: 10 }}>Coming up after spins (not on this wheel yet):</p>
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
