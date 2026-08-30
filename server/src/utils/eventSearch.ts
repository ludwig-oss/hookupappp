import type { Event, EventType } from '../models/events.js';

const TYPE_KEYWORDS: Record<EventType, string[]> = {
  house_party: ['house', 'party', 'parties', 'home', 'houseparty', 'bash', 'gathering', 'kickback'],
  club: ['club', 'clubbing', 'night', 'nightclub', 'dance', 'rave', 'out', 'going out'],
  picnic: ['picnic', 'park', 'outdoor', 'outside', 'sun', 'grass'],
  chilling: ['chill', 'chilling', 'hang', 'hangout', 'relax', 'fun', 'vibes'],
  watch_football: ['football', 'soccer', 'match', 'game', 'watch', 'sports', 'premier'],
  drinks: ['drink', 'drinks', 'bar', 'pub', 'cocktail', 'wine', 'beer'],
  other: ['event', 'meetup', 'social'],
};

const TYPE_LABELS: Record<EventType, string> = {
  house_party: 'House party',
  club: 'Club / going out',
  picnic: 'Picnic',
  chilling: 'Chilling & fun',
  watch_football: 'Watch football',
  drinks: 'Going for a drink',
  other: 'Other',
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length > 1);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/** Loose rhyme / sound-alike: same ending syllable or small edit distance. */
function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && a.slice(-3) === b.slice(-3)) return 0.75;
  if (minLen >= 2 && a.slice(-2) === b.slice(-2)) return 0.55;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (dist <= 1 && maxLen >= 4) return 0.85;
  if (dist <= 2 && maxLen >= 5) return 0.65;
  return Math.max(0, 1 - dist / maxLen);
}

function bestTokenScore(queryTokens: string[], haystack: string): number {
  const hayTokens = tokens(haystack);
  if (!queryTokens.length || !hayTokens.length) return 0;
  let total = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const ht of hayTokens) {
      best = Math.max(best, wordSimilarity(qt, ht));
    }
    total += best;
  }
  return total / queryTokens.length;
}

function typeKeywordBoost(event: Event, queryTokens: string[]): number {
  const keywords = [...TYPE_KEYWORDS[event.type], ...tokens(TYPE_LABELS[event.type])];
  let boost = 0;
  for (const qt of queryTokens) {
    for (const kw of keywords) {
      boost = Math.max(boost, wordSimilarity(qt, kw));
    }
  }
  return boost;
}

export function scoreEventSearch(event: Event, rawQuery: string, rawDescribe?: string): number {
  const query = norm(rawQuery);
  const describe = norm(rawDescribe || '');
  const combined = [query, describe].filter(Boolean).join(' ');
  if (!combined) return 0;

  const queryTokens = tokens(combined);
  const titleScore = bestTokenScore(queryTokens, event.title) * 1.4;
  const descScore = bestTokenScore(queryTokens, event.description || '') * 1.0;
  const cityScore = bestTokenScore(queryTokens, event.city) * 0.4;
  const typeScore = typeKeywordBoost(event, queryTokens) * 1.2;

  let exactBoost = 0;
  const blob = norm(`${event.title} ${event.description || ''} ${TYPE_LABELS[event.type]}`);
  if (query && blob.includes(query)) exactBoost += 0.5;
  if (describe && blob.includes(describe)) exactBoost += 0.35;

  return titleScore + descScore + cityScore + typeScore + exactBoost;
}

export function filterAndRankEvents(
  events: Event[],
  rawQuery?: string,
  rawDescribe?: string
): Event[] {
  const q = (rawQuery || '').trim();
  const d = (rawDescribe || '').trim();
  if (!q && !d) return events;

  const scored = events
    .map((e) => ({ e, score: scoreEventSearch(e, q, d) }))
    .filter(({ score }) => score >= 0.35);

  scored.sort((a, b) => b.score - a.score || new Date(b.e.createdAt).getTime() - new Date(a.e.createdAt).getTime());
  return scored.map(({ e }) => e);
}

export function cityMatches(a: string, b: string): boolean {
  const al = norm(a);
  const bl = norm(b);
  if (!al || !bl) return true;
  return al.includes(bl) || bl.includes(al);
}

export function countryMatches(viewerCountry?: string, eventCountry?: string): boolean {
  const vc = norm(viewerCountry || '');
  const ec = norm(eventCountry || '');
  if (!vc || !ec) return true;
  if (vc === ec) return true;
  return vc.includes(ec) || ec.includes(vc);
}
