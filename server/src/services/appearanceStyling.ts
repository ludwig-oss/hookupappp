/**
 * Auto-choice complete look (outfit + hair) and natural-language iteration.
 *
 * The desk always picks a first look for the occasion. Chat can retarget
 * a single element (hair, jacket, shirt, color) without rebuilding the rest.
 */

import { HAIR_CATALOG, hairById, type HairLook } from '../data/appearanceCatalog.js';
import { FASHION_CATALOG, type FashionLook } from '../data/fashionCatalog.js';
import { parseFashionIntent } from './fashionIntent.js';
import { pairForCompare, sourceLooks } from './fashionSourcing.js';

export interface CompleteLook {
  id: string;
  occasion: string;
  autoChosen: boolean;
  outfit: FashionLook;
  hair: HairLook;
  shopUrl: string;
}

export interface StyleSession {
  occasion: string;
  optionA: CompleteLook;
  optionB: CompleteLook;
  askLike: string;
}

function hairPool(genderFit: 'any' | 'masc' | 'fem'): HairLook[] {
  if (genderFit === 'any') return HAIR_CATALOG;
  return HAIR_CATALOG.filter((h) => h.genderFit === 'any' || h.genderFit === genderFit);
}

function scoreHair(hair: HairLook, occasion: string, formality: string): number {
  let n = 0;
  if (formality === 'high' && (hair.density === 'tight' || hair.family === 'slick' || hair.id === 'hair-low-bun')) n += 4;
  if (occasion === 'club' && (hair.family === 'protective' || hair.family === 'slick' || hair.id === 'hair-geometric-crown')) n += 3;
  if (occasion === 'brunch' && hair.density === 'soft') n += 2;
  if (occasion === 'first-date' && hair.family !== 'slick') n += 2;
  if (hair.genderFit === 'any') n += 1;
  return n;
}

function serializeLook(outfit: FashionLook, hair: HairLook, occasion: string, autoChosen: boolean): CompleteLook {
  return {
    id: `${outfit.id}__${hair.id}`,
    occasion,
    autoChosen,
    outfit,
    hair,
    shopUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(outfit.shopQuery || outfit.title)}`,
  };
}

export async function autoChooseLooks(prompt: string, gender?: string): Promise<StyleSession> {
  const intent = parseFashionIntent(prompt || 'first date', gender);
  const sourced = await sourceLooks(intent);
  const [a, b] = pairForCompare(sourced);
  const hairs = [...hairPool(intent.genderFit)].sort(
    (x, y) => scoreHair(y, intent.event, intent.formality) - scoreHair(x, intent.event, intent.formality)
  );
  const hairA = hairs[0] || HAIR_CATALOG[0];
  const hairB = hairs.find((h) => h.id !== hairA.id) || hairs[1] || hairA;
  return {
    occasion: intent.event,
    optionA: serializeLook(a, hairA, intent.event, true),
    optionB: serializeLook(b, hairB, intent.event, false),
    askLike: 'Do you like this look?',
  };
}

function nextFashion(current: FashionLook, message: string): FashionLook {
  const q = message.toLowerCase();
  const pool = FASHION_CATALOG.filter((l) => l.id !== current.id);
  const wantDark = /\b(darker|black|navy|charcoal)\b/.test(q);
  const wantBlazer = /\b(blazer|jacket|suit)\b/.test(q);
  const wantShirt = /\b(shirt|tee|knit|sweater|blouse)\b/.test(q);
  const wantDress = /\b(dress|slip|midi)\b/.test(q);
  const scored = pool.map((l) => {
    let n = 0;
    if (wantDark && l.palette.some((p) => /black|navy|charcoal|espresso|ink/.test(p))) n += 5;
    if (wantBlazer && /blazer|jacket|leather/i.test(l.pieces.join(' ') + l.title)) n += 6;
    if (wantShirt && /shirt|tee|knit|polo|oxford/i.test(l.pieces.join(' '))) n += 4;
    if (wantDress && /dress/i.test(l.title + l.pieces.join(' '))) n += 6;
    if (l.event === current.event) n += 2;
    return { l, n };
  });
  scored.sort((a, b) => b.n - a.n);
  return scored[0] && scored[0].n > 0 ? scored[0].l : current;
}

function nextHair(current: HairLook, message: string): HairLook {
  const q = message.toLowerCase();
  if (/\b(braid|crown|geometric)\b/.test(q)) return hairById('hair-geometric-crown') || current;
  if (/\b(cornrow|rows)\b/.test(q)) return hairById('hair-cornrow-back') || current;
  if (/\b(tighter|tight)\b/.test(q) && current.family === 'protective') {
    return hairById('hair-geometric-crown') || current;
  }
  if (/\b(bun)\b/.test(q)) return hairById('hair-low-bun') || current;
  if (/\b(slick)\b/.test(q)) return hairById('hair-slick-back') || current;
  if (/\b(wave|blowout)\b/.test(q)) return hairById('hair-soft-wave') || current;
  if (/\b(curtain|bang)\b/.test(q)) return hairById('hair-curtain') || current;
  if (/\b(crop|short|fade)\b/.test(q)) return hairById('hair-taper-fade') || current;
  if (/\b(twist)\b/.test(q)) return hairById('hair-twist-out') || current;
  if (/\b(layer)\b/.test(q)) return hairById('hair-soft-layers') || current;
  return current;
}

/**
 * Re-render only the named element. Unmentioned outfit/hair stays put.
 */
export function iterateLook(current: CompleteLook, message: string): { look: CompleteLook; changed: 'hair' | 'outfit' | 'both' | 'none'; reply: string } {
  const q = (message || '').trim();
  if (!q) return { look: current, changed: 'none', reply: 'Tell me what to change. Hair, jacket, color, or “tighter braids.”' };
  const hairCue = /\b(hair|braid|bun|crop|fade|slick|bang|wave|cornrow|twist|crown|tighter)\b/i.test(q);
  const outfitCue = /\b(shirt|blazer|jacket|dress|pant|jean|tee|knit|darker|lighter|swap|outfit|shoe)\b/i.test(q);
  let outfit = current.outfit;
  let hair = current.hair;
  let changed: 'hair' | 'outfit' | 'both' | 'none' = 'none';
  if (hairCue) {
    hair = nextHair(current.hair, q);
    changed = 'hair';
  }
  if (outfitCue || (!hairCue && /swap|darker|blazer|shirt/.test(q.toLowerCase()))) {
    outfit = nextFashion(current.outfit, q);
    changed = changed === 'hair' ? 'both' : 'outfit';
  }
  if (changed === 'none') {
    hair = nextHair(current.hair, q);
    outfit = nextFashion(current.outfit, q);
    if (hair.id !== current.hair.id && outfit.id !== current.outfit.id) changed = 'both';
    else if (hair.id !== current.hair.id) changed = 'hair';
    else if (outfit.id !== current.outfit.id) changed = 'outfit';
  }
  const look = serializeLook(outfit, hair, current.occasion, false);
  const reply =
    changed === 'none'
      ? 'I kept this look. Try “make the braids tighter into a geometric crown” or “swap the shirt for a darker blazer.”'
      : changed === 'hair'
        ? `Hair is now ${hair.title}. Outfit stays. Do you like this look?`
        : changed === 'outfit'
          ? `Outfit is now ${outfit.title}. Hair stays. Do you like this look?`
          : `Updated hair to ${hair.title} and outfit to ${outfit.title}. Do you like this look?`;
  return { look, changed, reply };
}
