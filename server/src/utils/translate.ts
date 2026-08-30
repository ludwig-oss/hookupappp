const MYMEMORY = 'https://api.mymemory.translated.net/get';

const LANG_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
};

export function normalizeTranslateLang(code: string): string {
  const c = (code || 'en').toLowerCase().split('-')[0];
  return LANG_MAP[c] || c || 'en';
}

export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'auto'
): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const target = normalizeTranslateLang(targetLang);
  const source = sourceLang === 'auto' ? 'auto' : normalizeTranslateLang(sourceLang);
  const url = `${MYMEMORY}?q=${encodeURIComponent(trimmed.slice(0, 450))}&langpair=${source}|${target}`;
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
