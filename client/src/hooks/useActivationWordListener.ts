import { useEffect, useRef } from 'react';

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript?: string }>>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/** Human-readable support hint for PC + phones. */
export function speechRecognitionSupportHint(): string {
  if (!speechRecognitionSupported()) {
    return 'Voice detection needs Chrome or Edge (PC or Android) with a microphone. iPhone Safari often blocks continuous listening — keep the app open in Chrome if you can.';
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return 'On iPhone/iPad, keep this app open in the foreground. Screen lock or switching apps may pause listening.';
  }
  return 'Listening stays on while this app is open (PC or phone). Keep the tab in the foreground for best results.';
}

export async function ensureMicPermission(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return speechRecognitionSupported();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    // Keep a quiet track alive briefly so mobile browsers do not revoke mic mid-session
    stream.getTracks().forEach((t) => {
      try {
        t.enabled = true;
      } catch {
        /* ignore */
      }
    });
    // Stop tracks after priming — SpeechRecognition opens its own mic session
    setTimeout(() => {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    }, 400);
    return true;
  } catch {
    return false;
  }
}

function transcriptHasWord(transcript: string, word: string): boolean {
  const hay = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
  const needle = word.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle || needle.length < 2) return false;
  // Exact token match
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i').test(hay)) return true;
  // Speech engines often drop spaces ("redbicycle") or add filler — allow compact includes
  const compactHay = hay.replace(/\s+/g, '');
  const compactNeedle = needle.replace(/\s+/g, '');
  if (compactNeedle.length >= 2 && compactHay.includes(compactNeedle)) return true;
  // Fuzzy: allow 1-char ASR slip for longer secrets (e.g. "bicycle" vs "bicicle")
  if (compactNeedle.length >= 5) {
    for (let i = 0; i <= compactHay.length - compactNeedle.length + 1; i++) {
      const slice = compactHay.slice(i, i + compactNeedle.length);
      if (!slice || Math.abs(slice.length - compactNeedle.length) > 1) continue;
      let diff = 0;
      const n = Math.min(slice.length, compactNeedle.length);
      for (let j = 0; j < n; j++) if (slice[j] !== compactNeedle[j]) diff += 1;
      diff += Math.abs(slice.length - compactNeedle.length);
      if (diff <= 1) return true;
    }
  }
  // Also accept if every word of the secret appears in order
  const parts = needle.split(/\s+/).filter((p) => p.length >= 2);
  if (parts.length > 1) {
    let idx = 0;
    for (const p of parts) {
      const at = hay.indexOf(p, idx);
      if (at < 0) return false;
      idx = at + p.length;
    }
    return true;
  }
  return false;
}

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed']);

/**
 * Always-on on-device listener for the activation word (PC + phones).
 * Restarts after silence, errors, and when the tab becomes visible again.
 */
export function useActivationWordListener(
  word: string | null | undefined,
  enabled: boolean,
  onHeard: () => void,
  onStatus?: (status: 'off' | 'listening' | 'blocked' | 'unsupported') => void
) {
  const onHeardRef = useRef(onHeard);
  onHeardRef.current = onHeard;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [word, enabled]);

  useEffect(() => {
    const secret = (word || '').trim();
    if (!enabled || secret.length < 2) {
      onStatusRef.current?.('off');
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onStatusRef.current?.('unsupported');
      return;
    }

    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let wakeLock: { release: () => Promise<void> } | null = null;
    let rec: SpeechRec | null = null;

    const setStatus = (s: 'off' | 'listening' | 'blocked' | 'unsupported') => {
      onStatusRef.current?.(s);
    };

    const clearRestart = () => {
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
    };

    const scheduleRestart = (delayMs: number) => {
      clearRestart();
      if (stopped || firedRef.current) return;
      restartTimer = setTimeout(() => {
        restartTimer = null;
        startRec();
      }, delayMs);
    };

    const requestWakeLock = async () => {
      try {
        const wl = (navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        if (!wl?.request) return;
        wakeLock = await wl.request('screen');
      } catch {
        /* optional */
      }
    };

    const releaseWakeLock = async () => {
      try {
        await wakeLock?.release();
      } catch {
        /* ignore */
      }
      wakeLock = null;
    };

    const startRec = () => {
      if (stopped || firedRef.current) return;
      try {
        if (rec) {
          try {
            rec.onresult = null;
            rec.onend = null;
            rec.onerror = null;
            rec.onstart = null;
            rec.abort?.() || rec.stop();
          } catch {
            /* ignore */
          }
        }
        rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || 'en-US';
        if (typeof rec.maxAlternatives === 'number') rec.maxAlternatives = 3;

        rec.onstart = () => {
          if (!stopped) setStatus('listening');
        };

        rec.onresult = (ev) => {
          if (firedRef.current || stopped) return;
          const parts: string[] = [];
          for (let i = 0; i < ev.results.length; i++) {
            const row = ev.results[i];
            const alt = row?.[0]?.transcript;
            if (alt) parts.push(alt);
          }
          // Also check only the newest slice for interim matches
          for (let i = Math.max(0, ev.resultIndex); i < ev.results.length; i++) {
            const alt = ev.results[i]?.[0]?.transcript;
            if (alt) parts.push(alt);
          }
          if (transcriptHasWord(parts.join(' '), secret)) {
            firedRef.current = true;
            stopped = true;
            clearRestart();
            try {
              rec?.stop();
            } catch {
              /* ignore */
            }
            setStatus('off');
            onHeardRef.current();
          }
        };

        rec.onend = () => {
          if (stopped || firedRef.current) return;
          // Mobile browsers drop continuous sessions — restart quickly
          scheduleRestart(280);
        };

        rec.onerror = (ev) => {
          const err = ev.error || '';
          if (FATAL_ERRORS.has(err)) {
            stopped = true;
            clearRestart();
            setStatus('blocked');
            return;
          }
          // no-speech, aborted, network, audio-capture → retry
          if (stopped || firedRef.current) return;
          scheduleRestart(err === 'network' ? 1200 : 400);
        };

        rec.start();
      } catch {
        scheduleRestart(800);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !stopped && !firedRef.current) {
        void requestWakeLock();
        scheduleRestart(200);
      }
    };

    void (async () => {
      const ok = await ensureMicPermission();
      if (stopped) return;
      if (!ok) {
        setStatus('blocked');
        // Still try SpeechRecognition — some browsers grant via recognition prompt
      }
      await requestWakeLock();
      startRec();
    })();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);

    return () => {
      stopped = true;
      clearRestart();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      void releaseWakeLock();
      if (rec) {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        rec.onstart = null;
        try {
          rec.abort?.() || rec.stop();
        } catch {
          /* ignore */
        }
      }
      setStatus('off');
    };
  }, [word, enabled]);
}
