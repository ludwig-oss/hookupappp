/** Loose match for account recovery descriptions. Never returns the original text. */

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'the', 'and', 'for', 'you', 'your', 'that', 'this', 'with', 'from', 'they', 'them',
  'was', 'were', 'have', 'has', 'had', 'about', 'just', 'like', 'what', 'when', 'who',
  'how', 'are', 'but', 'not', 'last', 'talk', 'talked', 'chat', 'chatted', 'message',
  'person', 'people', 'someone', 'something', 'hello', 'hi', 'hey', 'yes', 'no',
]);

export function significantTokens(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function tokenHits(needles: string[], haystack: string): number {
  const hay = normalize(haystack);
  if (!hay) return 0;
  let hits = 0;
  for (const n of needles) {
    if (hay.includes(n)) hits += 1;
  }
  return hits;
}

/** True when the user's description overlaps enough with known private facts. */
export function descriptionMatches(description: string, facts: string[]): boolean {
  const tokens = significantTokens(description);
  if (tokens.length < 2) return false;
  let best = 0;
  for (const fact of facts) {
    const hits = tokenHits(tokens, fact);
    if (hits > best) best = hits;
  }
  return best >= 2 || (tokens.length >= 3 && best / tokens.length >= 0.4);
}
