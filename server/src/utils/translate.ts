const MYMEMORY = 'https://api.mymemory.translated.net/get';

const LANG_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  ar: 'ar',
  hi: 'hi',
  ru: 'ru',
  nl: 'nl',
  pl: 'pl',
  tr: 'tr',
  vi: 'vi',
  th: 'th',
  id: 'id',
  ms: 'ms',
  sv: 'sv',
  da: 'da',
  fi: 'fi',
  no: 'no',
  nb: 'no',
  nn: 'no',
  el: 'el',
  he: 'he',
  ro: 'ro',
  hu: 'hu',
  cs: 'cs',
  bg: 'bg',
  uk: 'uk',
  hr: 'hr',
  sk: 'sk',
  sl: 'sl',
  sr: 'sr',
  lt: 'lt',
  lv: 'lv',
  et: 'et',
  bn: 'bn',
  ta: 'ta',
  te: 'te',
  mr: 'mr',
  gu: 'gu',
  kn: 'kn',
  ml: 'ml',
  pa: 'pa',
  ur: 'ur',
  fa: 'fa',
  sw: 'sw',
  af: 'af',
  ca: 'ca',
  tl: 'tl',
};

export function normalizeTranslateLang(code: string): string {
  const c = (code || 'en').toLowerCase().split('-')[0];
  return LANG_MAP[c] || c || 'en';
}

function chunkText(text: string, max = 420): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];
  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max - 20);
    if (cut < max * 0.3) cut = rest.lastIndexOf(' ', max - 10);
    if (cut < max * 0.2) cut = max;
    parts.push(rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)).trim());
    rest = rest.slice(cut + (rest[cut] === '.' ? 1 : 0)).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function translateChunk(text: string, target: string, source: string): Promise<string> {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'HookUpApp/1.0' } });
  if (!res.ok) throw new Error('Translation service unavailable');
  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  const out = data.responseData?.translatedText?.trim();
  if (!out) throw new Error('Could not translate');
  return out;
}

export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'en'
): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const target = normalizeTranslateLang(targetLang);
  const source = sourceLang === 'auto' ? 'auto' : normalizeTranslateLang(sourceLang);
  if (target === 'en' && (source === 'en' || source === 'auto')) return trimmed;
  const chunks = chunkText(trimmed);
  const out: string[] = [];
  for (const chunk of chunks) {
    out.push(await translateChunk(chunk, target, source));
  }
  return out.join(' ').trim();
}
