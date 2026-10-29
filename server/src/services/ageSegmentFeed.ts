/**
 * Age-segment feed partitioner.
 * Mature: drop scandalous + ultra-fast fashion.
 * Teen: drop overly traditional/conservative unless personal style tags override.
 */

export type AgeSegmentSlug = 'teen' | 'young_adult' | 'mature';

export interface OutfitFeedRecord {
  id: string;
  title?: string;
  tags: string[];
  isScandalous?: boolean;
  isUltraFastFashion?: boolean;
  isTraditional?: boolean;
  isConservative?: boolean;
}

export interface PartitionResult<T extends OutfitFeedRecord> {
  segment: AgeSegmentSlug;
  kept: T[];
  dropped: Array<{ item: T; reason: string }>;
}

const SCANDALOUS_RE =
  /\b(micro[- ]?mini|see[- ]?through|sheer nude|stripper|onlyfans|explicit|bondage|g-string|thong dress)\b/i;
const FAST_FASHION_RE =
  /\b(shein|temu|ultra[- ]?fast|haul[- ]?drop|disposable trend|micro[- ]?trend haul)\b/i;
const TRADITIONAL_RE =
  /\b(church suit|sunday best|twinset|brogue|power suit|country club|debutante|pearls and twinset)\b/i;
const CONSERVATIVE_RE =
  /\b(modest maxi|high collar office|boardroom conservative|funeral black suit|overly traditional)\b/i;

const TEEN_OVERRIDE_TAGS = new Set([
  'classic',
  'traditional',
  'conservative',
  'preppy',
  'tailored',
  'modest',
  'old money',
  'quiet luxury',
]);

export function ageSegmentFromAge(age: number): AgeSegmentSlug {
  if (age < 20) return 'teen';
  if (age <= 39) return 'young_adult';
  return 'mature';
}

export function toAgeGroupSlug(segment: AgeSegmentSlug): 'teen' | 'twenty_thirty' | 'forty_plus' {
  if (segment === 'teen') return 'teen';
  if (segment === 'young_adult') return 'twenty_thirty';
  return 'forty_plus';
}

function blobOf(item: OutfitFeedRecord): string {
  return `${item.title || ''} ${item.tags.join(' ')}`.toLowerCase();
}

export function classifyOutfitFlags(item: OutfitFeedRecord): Required<
  Pick<OutfitFeedRecord, 'isScandalous' | 'isUltraFastFashion' | 'isTraditional' | 'isConservative'>
> {
  const blob = blobOf(item);
  return {
    isScandalous: Boolean(item.isScandalous) || SCANDALOUS_RE.test(blob),
    isUltraFastFashion: Boolean(item.isUltraFastFashion) || FAST_FASHION_RE.test(blob),
    isTraditional: Boolean(item.isTraditional) || TRADITIONAL_RE.test(blob),
    isConservative: Boolean(item.isConservative) || CONSERVATIVE_RE.test(blob),
  };
}

function teenAllowsTraditional(styleTags: string[]): boolean {
  return styleTags.some((t) => TEEN_OVERRIDE_TAGS.has(t.toLowerCase().trim()));
}

export function partitionOutfitFeed<T extends OutfitFeedRecord>(
  items: T[],
  segment: AgeSegmentSlug,
  personalStyleTags: string[] = []
): PartitionResult<T> {
  const kept: T[] = [];
  const dropped: Array<{ item: T; reason: string }> = [];
  const teenOverride = segment === 'teen' && teenAllowsTraditional(personalStyleTags);

  for (const item of items) {
    const flags = classifyOutfitFlags(item);

    if (segment === 'mature' && flags.isScandalous) {
      dropped.push({ item, reason: 'scandalous looks are excluded from mature feeds' });
      continue;
    }
    if (segment === 'mature' && flags.isUltraFastFashion) {
      dropped.push({ item, reason: 'ultra-fast fashion is excluded from mature feeds' });
      continue;
    }
    if (segment === 'teen' && (flags.isTraditional || flags.isConservative) && !teenOverride) {
      dropped.push({
        item,
        reason: 'overly traditional/conservative looks are excluded from teen feeds unless style tags override',
      });
      continue;
    }

    kept.push(item);
  }

  return { segment, kept, dropped };
}

export function personalStyleOverridesTeenFilter(styleTags: string[]): boolean {
  return teenAllowsTraditional(styleTags);
}
