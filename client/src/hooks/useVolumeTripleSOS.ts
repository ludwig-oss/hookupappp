import { useEffect, useRef } from 'react';

/** Detect triple volume-down key press (best-effort; works on some Android browsers). */
export function useVolumeTripleSOS(onTrigger: () => void, enabled: boolean) {
  const pressesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'VolumeDown' && e.key !== 'AudioVolumeDown') return;
      const now = Date.now();
      pressesRef.current = pressesRef.current.filter((t) => now - t < 2000);
      pressesRef.current.push(now);
      if (pressesRef.current.length >= 3) {
        pressesRef.current = [];
        e.preventDefault();
        onTrigger();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onTrigger]);
}
