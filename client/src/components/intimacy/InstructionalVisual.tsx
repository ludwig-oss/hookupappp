import './InstructionalVisual.css';

/** Stick-figure style motion gif substitute — educational, not explicit. */
export default function InstructionalVisual({
  label,
  vibe = 'close',
  category,
}: {
  label: string;
  vibe?: string;
  category?: string;
}) {
  const kind = (category || vibe || 'close').toLowerCase();
  const pose =
    /psych|breath|pause|permission|eye|talk/.test(kind)
      ? 'pause'
      : /side|scissors|lateral/.test(kind)
        ? 'side'
        : /stand|wall|counter/.test(kind)
          ? 'stand'
          : /chair|seat|sit/.test(kind)
            ? 'sit'
            : /prone|behind|edge|lift/.test(kind)
              ? 'edge'
              : 'close';

  return (
    <div className={`instr-visual instr-visual--${pose}`} aria-label={`How-to visual: ${label}`}>
      <div className="instr-visual-stage">
        <span className="instr-fig instr-fig-a" />
        <span className="instr-fig instr-fig-b" />
        <span className="instr-pulse" />
      </div>
      <strong>{label}</strong>
      <small>Animated how-to · follow the motion · stop if it hurts</small>
    </div>
  );
}
