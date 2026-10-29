/**
 * Isolated matching engine — no HTTP, no DB.
 * Scores top + bottom + accessory, drops contradictory patterns unless asked,
 * prefers is_owned, and flags unowned pieces as shop fills for structural events.
 */

export type MatchOccasion = 'everyday' | 'special_event' | 'work' | 'night_out';
export type MatchSlot = 'top' | 'bottom' | 'accessory';

export type PatternFamily =
  | 'solid'
  | 'plaid'
  | 'stripe'
  | 'floral'
  | 'animal'
  | 'polka'
  | 'shimmer'
  | 'velvet'
  | 'camo'
  | 'graphic'
  | 'unknown';

export interface MatchPiece {
  id: string;
  slot: MatchSlot;
  name: string;
  color?: string;
  pattern?: string;
  tags?: string[];
  isOwned: boolean;
  shopUrl?: string | null;
  shopPriceEur?: number | null;
  imageUrl?: string | null;
}

export interface MatchEngineRequest {
  pieces: MatchPiece[];
  occasion: MatchOccasion;
  /** When true, clashing patterns (plaid+floral, etc.) stay in the ranking. */
  allowContradictoryPatterns?: boolean;
  /** User asked for these families (e.g. ['plaid','stripe']) — those clashes are kept. */
  requestedPatterns?: string[];
  limit?: number;
}

export interface ShoppingAlternative {
  piece: MatchPiece;
  slot: MatchSlot;
  reason: string;
  forStructuralEvent: true;
}

export interface ScoredLook {
  top: MatchPiece;
  bottom: MatchPiece;
  accessory: MatchPiece | null;
  scores: {
    pattern: number;
    color: number;
    ownership: number;
    total: number;
  };
  patternFamilies: PatternFamily[];
  usedUnowned: boolean;
  shoppingAlternatives: ShoppingAlternative[];
  notes: string[];
}

const LOUD: PatternFamily[] = ['plaid', 'floral', 'animal', 'stripe', 'camo', 'graphic', 'polka'];

const CLASH: Record<PatternFamily, PatternFamily[]> = {
  solid: [],
  velvet: [],
  shimmer: ['plaid', 'floral', 'animal', 'camo'],
  unknown: [],
  plaid: ['floral', 'stripe', 'animal', 'polka', 'camo', 'graphic'],
  stripe: ['plaid', 'floral', 'animal', 'camo'],
  floral: ['plaid', 'stripe', 'animal', 'camo', 'graphic'],
  animal: ['plaid', 'stripe', 'floral', 'camo'],
  polka: ['plaid', 'animal', 'camo'],
  camo: ['plaid', 'floral', 'stripe', 'animal'],
  graphic: ['plaid', 'floral'],
};

const STRUCTURAL: MatchOccasion[] = ['special_event', 'work'];

export function isStructuralEvent(occasion: MatchOccasion): boolean {
  return STRUCTURAL.includes(occasion);
}

export function detectPatternFamily(piece: MatchPiece): PatternFamily {
  const blob = `${piece.pattern || ''} ${piece.name || ''} ${(piece.tags || []).join(' ')}`.toLowerCase();
  if (/\b(plaid|tartan|check|gingham)\b/.test(blob)) return 'plaid';
  if (/\bstripe/.test(blob)) return 'stripe';
  if (/\b(floral|flower|botanic)\b/.test(blob)) return 'floral';
  if (/\b(leopard|zebra|snake|animal)\b/.test(blob)) return 'animal';
  if (/\b(polka|dot)\b/.test(blob)) return 'polka';
  if (/\b(shimmer|sequin|sparkle|lamé|lame)\b/.test(blob)) return 'shimmer';
  if (/\bvelvet\b/.test(blob)) return 'velvet';
  if (/\bcamo/.test(blob)) return 'camo';
  if (/\b(graphic|logo|print)\b/.test(blob)) return 'graphic';
  if (/\b(solid|plain)\b/.test(blob) || !blob.trim()) return 'solid';
  return 'unknown';
}

export function contradictoryPatterns(
  a: PatternFamily,
  b: PatternFamily
): { clash: boolean; reason: string } {
  if (a === b) return { clash: false, reason: '' };
  if (a === 'solid' || b === 'solid' || a === 'unknown' || b === 'unknown') {
    return { clash: false, reason: '' };
  }
  const hit = (CLASH[a] || []).includes(b) || (CLASH[b] || []).includes(a);
  if (!hit) return { clash: false, reason: '' };
  return { clash: true, reason: `${a} fights ${b}` };
}

function requestedAllows(families: PatternFamily[], requested: string[]): boolean {
  if (!requested.length) return false;
  const want = new Set(requested.map((r) => r.toLowerCase()));
  return families.every((f) => f === 'solid' || f === 'unknown' || want.has(f));
}

function colorScore(a?: string, b?: string): number {
  const na = (a || '').trim().toLowerCase();
  const nb = (b || '').trim().toLowerCase();
  if (!na || !nb) return 6;
  if (na === nb) return 9;
  const pair = `${na}|${nb}`;
  if (/navy\|white|white\|navy|black\|white|white\|black|camel\|navy|navy\|camel/.test(pair)) return 10;
  if (/red\|green|green\|red|orange\|pink|pink\|orange/.test(pair)) return 3;
  return 7;
}

function patternScore(families: PatternFamily[]): { score: number; notes: string[] } {
  const notes: string[] = [];
  const loud = families.filter((f) => LOUD.includes(f));
  if (families.filter((f) => f === 'plaid').length >= 2) {
    notes.push('Matched plaid set');
    return { score: 12, notes };
  }
  if (loud.length <= 1) {
    notes.push('One statement pattern, rest quiet');
    return { score: 10, notes };
  }
  notes.push('More than one loud pattern');
  return { score: 4, notes };
}

function ownershipScore(pieces: MatchPiece[]): number {
  const owned = pieces.filter((p) => p.isOwned).length;
  return owned * 4;
}

export function scoreTrio(
  top: MatchPiece,
  bottom: MatchPiece,
  accessory: MatchPiece | null,
  opts: { allowContradictoryPatterns: boolean; requestedPatterns: string[] }
): { ok: boolean; look?: ScoredLook; rejectReason?: string } {
  const worn = accessory ? [top, bottom, accessory] : [top, bottom];
  const families = worn.map(detectPatternFamily);

  for (let i = 0; i < families.length; i += 1) {
    for (let j = i + 1; j < families.length; j += 1) {
      const { clash, reason } = contradictoryPatterns(families[i], families[j]);
      if (!clash) continue;
      const allowed =
        opts.allowContradictoryPatterns || requestedAllows([families[i], families[j]], opts.requestedPatterns);
      if (!allowed) {
        return { ok: false, rejectReason: reason };
      }
    }
  }

  const pat = patternScore(families);
  const col =
    (colorScore(top.color, bottom.color) + (accessory ? colorScore(bottom.color, accessory.color) : 6)) / 2;
  const own = ownershipScore(worn);
  const total = pat.score + col + own;
  const unowned = worn.filter((p) => !p.isOwned);

  return {
    ok: true,
    look: {
      top,
      bottom,
      accessory,
      scores: {
        pattern: Math.round(pat.score * 10) / 10,
        color: Math.round(col * 10) / 10,
        ownership: own,
        total: Math.round(total * 10) / 10,
      },
      patternFamilies: families,
      usedUnowned: unowned.length > 0,
      shoppingAlternatives: unowned.map((piece) => ({
        piece,
        slot: piece.slot,
        reason: 'Not in closet — e-commerce fill for a structural event',
        forStructuralEvent: true as const,
      })),
      notes: pat.notes,
    },
  };
}

function bySlot(pieces: MatchPiece[], slot: MatchSlot): MatchPiece[] {
  return pieces.filter((p) => p.slot === slot);
}

function preferOwned(list: MatchPiece[], occasion: MatchOccasion): MatchPiece[] {
  const owned = list.filter((p) => p.isOwned);
  const shop = list.filter((p) => !p.isOwned);
  if (!isStructuralEvent(occasion)) return owned.length ? owned : [];
  return [...owned, ...shop];
}

export function rankLooks(req: MatchEngineRequest): {
  looks: ScoredLook[];
  rejectedClashCount: number;
  shoppingPool: ShoppingAlternative[];
} {
  const allow = Boolean(req.allowContradictoryPatterns);
  const requested = (req.requestedPatterns || []).map((s) => s.toLowerCase());
  const limit = Math.min(Math.max(req.limit ?? 8, 1), 24);

  const tops = preferOwned(bySlot(req.pieces, 'top'), req.occasion).slice(0, 8);
  const bottoms = preferOwned(bySlot(req.pieces, 'bottom'), req.occasion).slice(0, 8);
  const accessories = preferOwned(bySlot(req.pieces, 'accessory'), req.occasion).slice(0, 8);

  const shopPool: ShoppingAlternative[] = req.pieces
    .filter((p) => !p.isOwned)
    .map((piece) => ({
      piece,
      slot: piece.slot,
      reason: 'Unowned tracking target — shop alternative',
      forStructuralEvent: true as const,
    }));

  let rejectedClashCount = 0;
  const looks: ScoredLook[] = [];
  const accOptions: Array<MatchPiece | null> = accessories.length ? accessories : [null];

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const accessory of accOptions) {
        if (!isStructuralEvent(req.occasion)) {
          const worn = accessory ? [top, bottom, accessory] : [top, bottom];
          if (worn.some((p) => !p.isOwned)) continue;
        } else {
          const worn = accessory ? [top, bottom, accessory] : [top, bottom];
          const unowned = worn.filter((p) => !p.isOwned).length;
          if (unowned > 1) continue;
        }
        const scored = scoreTrio(top, bottom, accessory, {
          allowContradictoryPatterns: allow,
          requestedPatterns: requested,
        });
        if (!scored.ok || !scored.look) {
          rejectedClashCount += 1;
          continue;
        }
        looks.push(scored.look);
      }
    }
  }

  looks.sort((a, b) => {
    if (b.scores.ownership !== a.scores.ownership) return b.scores.ownership - a.scores.ownership;
    return b.scores.total - a.scores.total;
  });

  return {
    looks: looks.slice(0, limit),
    rejectedClashCount,
    shoppingPool: isStructuralEvent(req.occasion) ? shopPool : [],
  };
}

export function clutchItemToMatchPiece(item: {
  id: string;
  category: string;
  color?: string;
  pattern?: string;
  styleTags?: string[];
  imageUrl?: string;
  isOwned: boolean;
  name?: string;
}): MatchPiece | null {
  const cat = item.category;
  const slot: MatchSlot | null =
    cat === 'top' ? 'top' : cat === 'bottom' ? 'bottom' : cat === 'accessory' || cat === 'outerwear' ? 'accessory' : null;
  if (!slot) return null;
  return {
    id: item.id,
    slot,
    name: item.name || item.pattern || item.id,
    color: item.color,
    pattern: item.pattern,
    tags: item.styleTags,
    isOwned: item.isOwned,
    imageUrl: item.imageUrl,
  };
}
