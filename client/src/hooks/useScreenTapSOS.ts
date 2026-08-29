import { useEffect, useRef } from 'react';

/** Rapid screen taps trigger safety signal (configurable count). */
export function useScreenTapSOS(onTrigger: () => void, tapCount = 5, enabled = false) {
  const tapsRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      tapsRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onTap = () => {
      tapsRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(reset, 2000);
      if (tapsRef.current >= tapCount) {
        reset();
        onTrigger();
      }
    };

    window.addEventListener('pointerdown', onTap, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onTap);
      reset();
    };
  }, [enabled, tapCount, onTrigger]);
}
