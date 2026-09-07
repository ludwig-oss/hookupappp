import { getStoredLanguage } from '../i18n/languageStorage';
import { translateText } from './translateText';

type VoiceHint = 'female' | 'male';

type GuideVoice = {
  hint: VoiceHint;
  pitch: number;
  rate: number;
};

const BCP47: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ru: 'ru-RU',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
  ms: 'ms-MY',
  sv: 'sv-SE',
  da: 'da-DK',
  fi: 'fi-FI',
  no: 'nb-NO',
  nb: 'nb-NO',
  nn: 'nn-NO',
  el: 'el-GR',
  he: 'he-IL',
  ro: 'ro-RO',
  hu: 'hu-HU',
  cs: 'cs-CZ',
  bg: 'bg-BG',
  uk: 'uk-UA',
  hr: 'hr-HR',
  sk: 'sk-SK',
  sl: 'sl-SI',
  sr: 'sr-RS',
  lt: 'lt-LT',
  lv: 'lv-LV',
  et: 'et-EE',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-PK',
  fa: 'fa-IR',
  sw: 'sw-KE',
  af: 'af-ZA',
  ca: 'ca-ES',
  eu: 'eu-ES',
  gl: 'gl-ES',
  tl: 'fil-PH',
};

const FEMALE_RE =
  /female|zira|samantha|susan|karen|moira|tessa|fiona|veena|hazel|aria|jenny|linda|hedda|katja|helena|paulina|luciana|victoria|monica|lekha|sin.?ji|mei.?jia|kyoko|yuna|naayf|google\s+.*(espa|fran|deut|ital|port|neder|pol|tur|rus|chin|jap|kor|hind|arab)/i;
const MALE_RE =
  /male|david|daniel|mark|alex|fred|thomas|jorge|diego|stefan|rainer|jorge|pablo|raul|google\s+uk\s+english\s+male/i;

const cache = new Map<string, string>();

export function normalizeAppLang(code?: string): string {
  return (code || getStoredLanguage() || 'en').toLowerCase().split('-')[0];
}

export function speechLangFor(code?: string): string {
  const base = normalizeAppLang(code);
  return BCP47[base] || `${base}-${base.toUpperCase()}`;
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(window.speechSynthesis.getVoices());
    }, 800);
  });
}

export function pickGuideVoice(hint: VoiceHint, langCode?: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const base = normalizeAppLang(langCode);
  const bcp = speechLangFor(base).toLowerCase();
  const inLang = voices.filter((v) => {
    const l = (v.lang || '').toLowerCase();
    return l === bcp || l.startsWith(`${base}-`) || l === base;
  });
  const pool = inLang.length ? inLang : voices;
  const prefer = hint === 'female' ? FEMALE_RE : MALE_RE;
  return pool.find((v) => prefer.test(`${v.name} ${v.lang}`)) || pool[0];
}

/** Translate English guide copy into the user's app language (cached). */
export async function translateGuideText(text: string, targetLang?: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const lang = normalizeAppLang(targetLang);
  if (lang === 'en') return trimmed;
  const key = `${lang}::${trimmed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    // Chunk long lines — MyMemory caps ~450 chars per request
    const parts: string[] = [];
    let rest = trimmed;
    while (rest.length > 420) {
      let cut = rest.lastIndexOf('. ', 400);
      if (cut < 120) cut = rest.lastIndexOf(' ', 400);
      if (cut < 80) cut = 400;
      parts.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) parts.push(rest);
    const out: string[] = [];
    for (const p of parts) {
      out.push(await translateText(p, lang));
    }
    const joined = out.join(' ').trim() || trimmed;
    cache.set(key, joined);
    return joined;
  } catch {
    return trimmed;
  }
}

function utterNow(
  guide: GuideVoice,
  text: string,
  lang: string,
  onStart: () => void,
  onEnd: () => void,
  rateCap?: number
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = speechLangFor(lang);
  utter.pitch = guide.pitch;
  utter.rate = rateCap != null ? Math.min(guide.rate, rateCap) : guide.rate;
  const match = pickGuideVoice(guide.hint, lang);
  if (match) utter.voice = match;
  utter.onstart = onStart;
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
}

/**
 * Speak guide advice in the user's current app language.
 * Translates first when language is not English, then picks a matching voice.
 */
export async function speakGuideLine(
  guide: GuideVoice,
  text: string,
  onStart: () => void,
  onEnd: () => void,
  opts?: { lang?: string; rateCap?: number }
): Promise<void> {
  const lang = normalizeAppLang(opts?.lang);
  await waitForVoices();
  const spoken = await translateGuideText(text, lang);
  utterNow(guide, spoken, lang, onStart, onEnd, opts?.rateCap);
}
