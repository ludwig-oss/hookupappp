import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import './SwipeableOutfitWrapper.css';

type Drag = { x: number; y: number; transition: string };

const IDLE: Drag = { x: 0, y: 0, transition: 'none' };

/**
 * Web stand-in for the outfit card swipe.
 * Right past 120px tries the look on. Left past 120px shuffles. A short drag springs back.
 */
export default function SwipeableOutfitWrapper({
  children,
  onSwipeLeft,
  onSwipeRight,
}: {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [drag, setDrag] = useState<Drag>(IDLE);
  const start = useRef<{ x: number; y: number; locked: boolean; pointerId: number } | null>(null);
  const busy = useRef(false);

  const rotate =
    typeof window === 'undefined'
      ? 0
      : Math.max(-10, Math.min(10, (drag.x / (window.innerWidth / 2)) * 10));

  const endGesture = (dx: number, dy: number) => {
    if (busy.current) return;
    const width = window.innerWidth;
    if (dx > 120) {
      busy.current = true;
      setDrag({ x: width, y: dy, transition: 'transform 200ms linear' });
      window.setTimeout(() => {
        onSwipeRight();
        setDrag(IDLE);
        busy.current = false;
      }, 200);
      return;
    }
    if (dx < -120) {
      busy.current = true;
      setDrag({ x: -width, y: dy, transition: 'transform 200ms linear' });
      window.setTimeout(() => {
        onSwipeLeft();
        setDrag(IDLE);
        busy.current = false;
      }, 200);
      return;
    }
    setDrag({ x: 0, y: 0, transition: 'transform 280ms cubic-bezier(0.2, 0.85, 0.2, 1.15)' });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || busy.current) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) return;
    start.current = { x: event.clientX, y: event.clientY, locked: false, pointerId: event.pointerId };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin || origin.pointerId !== event.pointerId || busy.current) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!origin.locked) {
      if (Math.abs(dx) > 20 && Math.abs(dy) < 20) {
        origin.locked = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* The pointer is already gone, or this event was synthesized. */
        }
      } else if (Math.abs(dy) > 20) {
        start.current = null;
        return;
      } else {
        return;
      }
    }
    setDrag({ x: dx, y: dy, transition: 'none' });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const locked = origin.locked;
    start.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* No active capture to release. */
    }
    if (!locked) return;
    endGesture(dx, dy);
  };

  const rightStamp = Math.max(0, Math.min(1, drag.x / 120));
  const leftStamp = Math.max(0, Math.min(1, -drag.x / 120));

  return (
    <div
      className="swipe-outfit"
      style={{ transform: `translateX(${drag.x}px) rotate(${rotate}deg)`, transition: drag.transition }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="swipe-stamp swipe-stamp-save" style={{ opacity: rightStamp }} aria-hidden={rightStamp < 0.4}>
        TRY ON
      </span>
      <span className="swipe-stamp swipe-stamp-skip" style={{ opacity: leftStamp }} aria-hidden={leftStamp < 0.4}>
        AS IF!
      </span>
      {children}
    </div>
  );
}
