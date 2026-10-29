/**
 * Isolated internet-trend filter — no HTTP, no live crawl.
 * Age-gates Pinterest / runway / celebrity looks, then maps tags to closet vs shop.
 */

export type AgeGroup = 'teen' | 'twenty_thirty' | 'forty_plus';
export type TrendSource = 'pinterest' | 'fashion_show' | 'celebrity_streetwear';

export interface IngestedTrendOutfit {
  sourceUrl: string;
  sourcePlatform: TrendSource;
  celebrityOrBoardName?: string | null;
  extractedTags: string[];
  targetAgeGroups: AgeGroup[];
  /** Placeholder embedding (tag hash). Swap in a ViT + vector DB when wired. */
  imageEmbeddingVector: number[];
  id?: string;
  imageUrl?: string;
}

export interface UserStyleProfile {
  userId: string;
  age: number;
  stylePreference: string[];
}

export function ageGroupFromAge(age: number): AgeGroup {
  if (age < 20) return 'teen';
  if (age <= 39) return 'twenty_thirty';
  return 'forty_plus';
}

function normalizeTag(tag: string): string {
  return String(tag || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

function tagHits(preference: string[], extracted: string[]): boolean {
  const prefs = preference.map(normalizeTag).filter(Boolean);
  const tags = extracted.map(normalizeTag);
  if (!prefs.length) return true;
  return prefs.some((p) => tags.some((t) => t.includes(p) || p.includes(t)));
}

export class InternetTrendOutfitMatcher {
  constructor(private readonly vectorDbClient: { query?: (vec: number[]) => unknown } | null = null) {
    void this.vectorDbClient;
  }

  matchInternetTrends(
    user: UserStyleProfile,
    trendPool: IngestedTrendOutfit[],
    limit = 5
  ): IngestedTrendOutfit[] {
    const group = ageGroupFromAge(user.age);
    const appropriate: IngestedTrendOutfit[] = [];
    for (const look of trendPool) {
      if (!look.targetAgeGroups.includes(group)) continue;
      if (!tagHits(user.stylePreference, look.extractedTags)) continue;
      appropriate.push(look);
    }
    return appropriate.slice(0, Math.min(Math.max(limit, 1), 24));
  }

  crossReferenceWithCloset(
    userCloset: Array<{ styleTags?: string[]; title?: string; notes?: string; pieces?: string[] }>,
    targetTrend: IngestedTrendOutfit
  ): {
    trendMetadata: { source: TrendSource; inspiredBy: string | null };
    closetPiecesToUse: Array<{ tag: string; source: 'user_closet' }>;
    shoppingListToCompleteLook: Array<{ tag: string; source: 'retail_search'; query: string }>;
  } {
    const owned: Array<{ tag: string; source: 'user_closet' }> = [];
    const missing: Array<{ tag: string; source: 'retail_search'; query: string }> = [];
    const inspired = targetTrend.celebrityOrBoardName || 'Pinterest';

    for (const tag of targetTrend.extractedTags) {
      const needle = normalizeTag(tag);
      const matchFound = userCloset.some((item) => {
        const blob = [
          ...(item.styleTags || []),
          item.title || '',
          item.notes || '',
          ...(item.pieces || []),
        ]
          .map(normalizeTag)
          .join(' ');
        return blob.includes(needle) || needle.split(' ').every((w) => w.length < 3 || blob.includes(w));
      });
      if (matchFound) owned.push({ tag, source: 'user_closet' });
      else {
        missing.push({
          tag,
          source: 'retail_search',
          query: `Buy ${tag} inspired by ${inspired}`,
        });
      }
    }

    return {
      trendMetadata: {
        source: targetTrend.sourcePlatform,
        inspiredBy: targetTrend.celebrityOrBoardName || null,
      },
      closetPiecesToUse: owned,
      shoppingListToCompleteLook: missing,
    };
  }
}

export const internetTrendMatcher = new InternetTrendOutfitMatcher();

/** Deterministic stand-in until a Vision Transformer writes real embeddings. */
export function hashEmbedding(tags: string[], dims = 16): number[] {
  const vec = new Array(dims).fill(0);
  const blob = tags.join('|').toLowerCase();
  for (let i = 0; i < blob.length; i += 1) {
    const idx = blob.charCodeAt(i) % dims;
    vec[idx] += (blob.charCodeAt(i) % 13) / 13;
  }
  const mag = Math.sqrt(vec.reduce((s, n) => s + n * n, 0)) || 1;
  return vec.map((n) => Math.round((n / mag) * 1000) / 1000);
}
