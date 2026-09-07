import { FASHION_CATALOG, looksForGender, type FashionLook } from '../data/fashionCatalog.js';
import type { FashionIntent } from './fashionIntent.js';

const FORMALITY_RANK: Record<FashionLook['formality'], number> = { low: 0, mid: 1, high: 2 };

function scoreLook(look: FashionLook, intent: FashionIntent): number {
  let n = 0;
  if (look.event === intent.event) n += 8;
  else if (
    (intent.event === 'first-date' && (look.event === 'dinner' || look.event === 'casual')) ||
    (intent.event === 'dinner' && look.event === 'first-date')
  ) {
    n += 4;
  }
  const gap = Math.abs(FORMALITY_RANK[look.formality] - FORMALITY_RANK[intent.formality]);
  n += 4 - gap * 2;
  for (const c of intent.colors) {
    if (look.palette.some((p) => p.includes(c) || c.includes(p))) n += 3;
  }
  if (intent.vibe === 'easy' && look.formality === 'low') n += 2;
  if (intent.vibe === 'polished' && look.formality !== 'low') n += 2;
  if (intent.vibe === 'sharp' && (look.event === 'club' || look.warp === 'drape')) n += 2;
  if (look.genderFit === intent.genderFit) n += 2;
  if (look.genderFit === 'any') n += 1;
  return n;
}

/**
 * Match the prompt to live-feeling looks.
 * Optional UNSPLASH_ACCESS_KEY swaps in a current photo for the same recipe.
 * We do not scrape retailer catalogs (ToS / copyright). Shop links are search queries.
 */
export async function sourceLooks(intent: FashionIntent): Promise<FashionLook[]> {
  const pool = looksForGender(intent.genderFit);
  const ranked = [...pool].sort((a, b) => scoreLook(b, intent) - scoreLook(a, intent));
  let top = ranked.slice(0, 6);
  if (top.length < 2) top = FASHION_CATALOG.slice(0, 2);
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (key && top[0]) {
    try {
      const q = encodeURIComponent(`${intent.event} outfit ${intent.colors.join(' ')}`.trim());
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${q}&per_page=4&orientation=portrait`, {
        headers: { Authorization: `Client-ID ${key}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: { urls?: { regular?: string } }[] };
        const urls = (data.results || []).map((r) => r.urls?.regular).filter(Boolean) as string[];
        top = top.map((look, i) => (urls[i] ? { ...look, imageUrl: urls[i] } : look));
      }
    } catch {
      /* catalog images still work */
    }
  }
  return top;
}

export function pairForCompare(looks: FashionLook[]): [FashionLook, FashionLook] {
  const a = looks[0];
  const b = looks.find((l) => l.id !== a.id && l.event === a.event) || looks[1] || looks[0];
  return [a, b];
}
