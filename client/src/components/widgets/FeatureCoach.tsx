import { useEffect, useState, type RefObject } from 'react';

type Hole = { x: number; y: number; width: number; height: number };

export function FeatureCoach({
  active,
  stepIndex,
  stepCount,
  title,
  body,
  cta,
  target,
  rootRef,
  onNext,
}: {
  active: boolean;
  stepIndex: number;
  stepCount: number;
  title: string;
  body: string;
  cta: string;
  target: HTMLElement | null;
  rootRef: RefObject<HTMLElement | null>;
  onNext: () => void;
}) {
  const [hole, setHole] = useState<Hole | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!active || !target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active, target, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const read = () => {
      const root = rootRef.current;
      if (!root) return;
      setSize({ w: root.clientWidth, h: root.clientHeight });
      if (!target) {
        setHole(null);
        return;
      }
      const base = root.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const pad = 6;
      setHole({
        x: rect.left - base.left - pad,
        y: rect.top - base.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };
    read();
    const late = window.setTimeout(read, 320);
    window.addEventListener('resize', read);
    window.addEventListener('scroll', read, true);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener('resize', read);
      window.removeEventListener('scroll', read, true);
    };
  }, [active, target, stepIndex, rootRef]);

  if (!active) return null;

  const zones = hole
    ? [
        { top: 0, left: 0, width: size.w, height: Math.max(0, hole.y) },
        { top: hole.y + hole.height, left: 0, width: size.w, height: Math.max(0, size.h - hole.y - hole.height) },
        { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.height },
        { top: hole.y, left: hole.x + hole.width, width: Math.max(0, size.w - hole.x - hole.width), height: hole.height },
      ]
    : [{ top: 0, left: 0, width: size.w, height: size.h }];

  const below = hole ? hole.y + hole.height + 12 : size.h * 0.62;
  const cardTop = hole && below + 220 > size.h - 12 ? Math.max(12, hole.y - 220) : below;

  return (
    <div className="fc-coach" role="dialog" aria-modal="true">
      {zones.map((zone, index) => (
        <div key={index} className="fc-zone" style={zone} />
      ))}
      {hole ? (
        <div className="fc-ring" style={{ top: hole.y, left: hole.x, width: hole.width, height: hole.height }} />
      ) : null}
      <div className="fc-card" style={{ top: cardTop }}>
        <div className="fc-stripe" />
        <div className="fc-card-body">
          <div className="fc-progress">
            <span>{stepIndex + 1} / {stepCount}</span>
            <span className="fc-dots">
              {Array.from({ length: stepCount }, (_, index) => (
                <i key={index} className={index === stepIndex ? 'fc-dot is-on' : 'fc-dot'} />
              ))}
            </span>
          </div>
          <div className="fc-title">{title}</div>
          <p className="fc-body">{body}</p>
          <button type="button" className="fc-next" onClick={onNext}>{cta}</button>
        </div>
      </div>
    </div>
  );
}
