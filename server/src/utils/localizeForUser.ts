import { getUserById } from '../models/user.js';
import { languageForCountry } from './countryLanguage.js';
import { translateText } from './translate.js';

const cache = new Map<string, string>();

/** Interest and reply notices in the language of the recipient's country. */
export async function textForUser(userId: string, text: string): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return text;
  try {
    const user = await getUserById(userId);
    const lang = languageForCountry(user?.country || '') || 'en';
    if (lang === 'en') return text;
    const key = `${lang}::${trimmed}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const translated = await Promise.race([
      translateText(trimmed, lang, 'en'),
      new Promise<string>((resolve) => setTimeout(() => resolve(text), 4000)),
    ]);
    if (translated && translated !== text) cache.set(key, translated);
    return translated || text;
  } catch {
    return text;
  }
}
