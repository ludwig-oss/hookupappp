import { useState, useRef, useEffect } from 'react';
import {
  getActiveWheelGames,
  minutesUntilWheelRotate,
  type WheelGame,
} from '../../data/wheelGames';

const SECTIONS = 6;
const SLICE_ANGLE = 360 / SECTIONS;

interface HighlightSpinWheelProps {
  onOutcome?: (gameId: string) => void;
}

export default function HighlightSpinWheel({ onOutcome }: HighlightSpinWheelProps) {
  const [games, setGames] = useState<WheelGame[]>(() => getActiveWheelGames());
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const rotateIn = minutesUntilWheelRotate();

  useEffect(() => {
    const tick = () => setGames(getActiveWheelGames());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handleSpin = () => {
    if (spinning || games.length < 6) return;
    setSpinning(true);
    const fullSpins = 4 + Math.floor(Math.random() * 4);
    const finalSlice = Math.floor(Math.random() * SECTIONS);
    const finalAngle = 360 - (finalSlice * SLICE_ANGLE + SLICE_ANGLE / 2);
    const totalDegrees = rotationRef.current + fullSpins * 360 + finalAngle;
    setRotation(totalDegrees);
    rotationRef.current = totalDegrees;
    setTimeout(() => {
      setSpinning(false);
      onOutcome?.(games[finalSlice]?.id || games[0].id);
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
      <p className="highlight-spin-wheel-how" style={{ maxWidth: 320, margin: '0.5rem auto', fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.4 }}>
        How it works: spin lands on a mini-game. Faces stay blurred on voice rounds. The 6 games on this wheel remix every ~{rotateIn} min from a pool of 24 crazy dating games.
      </p>
      <div className="highlight-spin-wheel-legend" aria-label="Games on this wheel">
        <p>Games on this wheel right now:</p>
        <ul>
          {games.slice(0, SECTIONS).map((g, i) => (
            <li key={g.id}>{i + 1}. {g.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
