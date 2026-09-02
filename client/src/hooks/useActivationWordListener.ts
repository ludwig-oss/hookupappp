import { useEffect, useRef } from 'react';

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
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

function transcriptHasWord(transcript: string, word: string): boolean {
  const hay = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const needle = word.trim().toLowerCase();
  if (!needle || needle.length < 2) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i').test(hay);
}

/** Listens on-device for the user's activation word and fires once when they shout it. */
export function useActivationWordListener(
  word: string | null | undefined,
  enabled: boolean,
  onHeard: () => void
) {
  const onHeardRef = useRef(onHeard);
  onHeardRef.current = onHeard;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [word, enabled]);

  useEffect(() => {
    const secret = (word || '').trim();
    if (!enabled || secret.length < 2) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    let stopped = false;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (ev) => {
      if (firedRef.current) return;
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        const alt = ev.results[i]?.[0]?.transcript;
        if (alt) parts.push(alt);
      }
      if (transcriptHasWord(parts.join(' '), secret)) {
        firedRef.current = true;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        onHeardRef.current();
      }
    };

    rec.onend = () => {
      if (stopped || firedRef.current) return;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        stopped = true;
      }
    };

    try {
      rec.start();
    } catch {
      /* mic busy */
    }

    return () => {
      stopped = true;
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, [word, enabled]);
}
