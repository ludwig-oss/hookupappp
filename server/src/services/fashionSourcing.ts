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
export function pairForCompare(
  looks: FashionLook[],
  excludeIds: string[] = []
): [FashionLook, FashionLook] {
  const filtered = looks.filter((l) => !excludeIds.includes(l.id));
  const pool = filtered.length >= 2 ? filtered : looks;
  const a = pool[0];
  const b = pool.find((l) => l.id !== a.id) || pool[1] || pool[0];
  return [a, b];
}

/** Mix one wardrobe piece into a catalog look for a unique combo. */
export function mixWardrobeIntoLook(
  base: FashionLook,
  wardrobe: { id: string; title: string; imageUrl: string; pieces: string[]; pieceSlot?: string }
): FashionLook {
  const slot = (wardrobe.pieceSlot || 'top').toLowerCase();
  const pieces = [...base.pieces];
  if (slot === 'bottom' && pieces[1]) pieces[1] = wardrobe.title || wardrobe.pieces[0] || pieces[1];
  else if (slot === 'shoes' && pieces[3]) pieces[3] = wardrobe.title || wardrobe.pieces[0] || pieces[3];
  else if (slot === 'outer') pieces.unshift(wardrobe.title || 'Your outer layer');
  else pieces[0] = wardrobe.title || wardrobe.pieces[0] || pieces[0];

  return {
    ...base,
    id: `mix-${wardrobe.id}-${base.id}`.slice(0, 64),
    title: `${wardrobe.title.split(',')[0]} + ${base.title.split(',')[0]}`,
    vibe: `your closet mixed with ${base.vibe}`,
    pieces,
    imageUrl: wardrobe.imageUrl || base.imageUrl,
    trendNotes: `Unique mix: your ${slot} with a fresh ${base.event.replace('-', ' ')} base. ${base.trendNotes}`,
  };
}

export async function sourceLooks(
  intent: FashionIntent,
  opts?: { excludeIds?: string[]; diversify?: boolean }
): Promise<FashionLook[]> {
  const pool = looksForGender(intent.genderFit);
  const exclude = new Set(opts?.excludeIds || []);
  let ranked = [...pool]
    .filter((l) => !exclude.has(l.id))
    .sort((a, b) => scoreLook(b, intent) - scoreLook(a, intent));
  if (opts?.diversify && ranked.length > 3) {
    // Prefer something different from the top hit so "shuffle" feels new
    const head = ranked.slice(0, 2);
    const rest = ranked.slice(2).sort(() => Math.random() - 0.5);
    ranked = [...rest.slice(0, 4), ...head];
  }
  let top = ranked.slice(0, 8);
  if (top.length < 2) {
    top = FASHION_CATALOG.filter((l) => !exclude.has(l.id)).slice(0, 4);
  }
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
