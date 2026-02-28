import { useState, useRef } from 'react';

const SECTIONS = 6;
const SLICE_ANGLE = 360 / SECTIONS;

/** Short labels on wheel segments (fit in small circle); full names in WHEEL_GAME_LABELS */
const WHEEL_SEGMENT_LABELS: string[] = ['Blind', 'Pick', 'Rush', 'Lucky', 'Speed', 'Mystery'];

export const WHEEL_GAME_LABELS: Record<number, string> = {
  1: 'Blind Date',
  2: 'Picture Pick',
  3: 'Compatibility Rush',
  4: 'Lucky Like',
  5: 'Speed Pick',
  6: 'Mystery Message',
};

interface HighlightSpinWheelProps {
  onOutcome?: (segment: number) => void;
}

export default function HighlightSpinWheel({ onOutcome }: HighlightSpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    const fullSpins = 4 + Math.floor(Math.random() * 4);
    const finalSlice = Math.floor(Math.random() * SECTIONS);
    const finalAngle = 360 - (finalSlice * SLICE_ANGLE + SLICE_ANGLE / 2);
    const totalDegrees = rotationRef.current + fullSpins * 360 + finalAngle;
    setRotation(totalDegrees);
    rotationRef.current = totalDegrees;
    setTimeout(() => {
      setSpinning(false);
      onOutcome?.(finalSlice + 1);
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
          {Array.from({ length: SECTIONS }, (_, i) => {
            const angle = 30 + i * SLICE_ANGLE;
            return (
              <div
                key={i}
                className="highlight-spin-wheel-label-pos"
                style={{
                  transform: `rotate(${angle}deg) translateY(-58px)`,
                }}
              >
                <span className="highlight-spin-wheel-label" style={{ transform: `rotate(${-angle}deg)` }} title={WHEEL_GAME_LABELS[i + 1]}>
                  {WHEEL_SEGMENT_LABELS[i] ?? i + 1}
                </span>
              </div>
            );
          })}
        </div>
        <div className="highlight-spin-wheel-center" />
      </button>
      <p className="highlight-spin-wheel-hint">{spinning ? 'Spinning...' : 'Click the wheel to spin'}</p>
      <div className="highlight-spin-wheel-legend" aria-label="Games on this wheel">
        <p>Games on this wheel:</p>
        <ul>
          {(Object.entries(WHEEL_GAME_LABELS) as [string, string][]).map(([num, name]) => (
            <li key={num}>{num}. {name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
