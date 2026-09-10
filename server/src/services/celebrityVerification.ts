/**
 * Public-figure / celebrity verification.
 * Scores identity proof + 4 notability signals inspired by platform blue-check logic:
 * 1) Impersonation threshold  2) Search volume  3) Web credibility  4) Cross-platform presence
 */
import type { User } from '../models/user.js';
import { getAllUsers } from '../models/user.js';
import { isSimulatorEnabled } from '../simulator/runtime.js';
import { MOCK_CELEBRITY_NAMES } from '../simulator/celebNames.js';

export { MOCK_CELEBRITY_NAMES };

export type CelebrityLevel = 'world' | 'community' | 'country';

export interface CelebrityScorePart {
  score: number; // 0–100
  detail: string;
}

export interface CelebrityVerificationResult {
  approved: boolean;
  identityOk: boolean;
  scores: {
    impersonationThreshold: CelebrityScorePart;
    searchVolume: CelebrityScorePart;
    webCredibility: CelebrityScorePart;
    crossPlatform: CelebrityScorePart;
  };
  averageScore: number;
  reasons: string[];
  steps: string[];
  message: string;
}

const PLATFORM_HOSTS: { key: string; re: RegExp }[] = [
  { key: 'instagram', re: /instagram\.com|instagr\.am/i },
  { key: 'tiktok', re: /tiktok\.com|vm\.tiktok/i },
  { key: 'youtube', re: /youtube\.com|youtu\.be/i },
  { key: 'x', re: /(?:twitter\.com|x\.com)\//i },
  { key: 'facebook', re: /facebook\.com|fb\.com/i },
  { key: 'wikipedia', re: /wikipedia\.org/i },
  { key: 'imdb', re: /imdb\.com/i },
  { key: 'linkedin', re: /linkedin\.com/i },
];

const NEWS_HOSTS =
  /bbc\.|nytimes\.|reuters\.|theguardian\.|cnn\.|forbes\.|bloomberg\.|variety\.|rollingstone\.|espn\.|wsj\./i;

/** In-memory search velocity (name → recent search hits). */
const searchHits = new Map<string, { count: number; updatedAt: number }>();

function normalizeName(n: string): string {
  return (n || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(n: string): string[] {
  return normalizeName(n).split(' ').filter((t) => t.length > 1);
}

/** Call from discover/search when a user looks someone up — feeds “search volume”. */
export function recordProfileSearchQuery(query: string): void {
  const key = normalizeName(query);
  if (key.length < 3) return;
  const prev = searchHits.get(key) || { count: 0, updatedAt: 0 };
  searchHits.set(key, { count: prev.count + 1, updatedAt: Date.now() });
}

function extractLinks(proof: string): string[] {
  const matches = proof.match(/https?:\/\/[^\s]+/gi) || [];
  const bare = proof.match(/(?:instagram|tiktok|youtube|twitter|x|facebook|wikipedia)\.com\/[^\s]+/gi) || [];
  return [...matches, ...bare.map((b) => (b.startsWith('http') ? b : `https://${b}`))];
}

function platformsFound(links: string[]): string[] {
  const found = new Set<string>();
  for (const link of links) {
    for (const p of PLATFORM_HOSTS) {
      if (p.re.test(link)) found.add(p.key);
    }
  }
  return Array.from(found);
}

async function countNameCollisions(name: string, excludeUserId: string): Promise<number> {
  const tokens = nameTokens(name);
  if (!tokens.length) return 0;
  const users = await getAllUsers();
  let hits = 0;
  for (const u of users) {
    if (u.id === excludeUserId) continue;
    const other = normalizeName(u.name || u.username || '');
    if (!other) continue;
    const overlap = tokens.filter((t) => other.includes(t)).length;
    if (overlap >= Math.min(2, tokens.length) || other === normalizeName(name)) hits++;
  }
  return hits;
}

function searchVolumeForName(name: string): number {
  const key = normalizeName(name);
  let total = searchHits.get(key)?.count || 0;
  // Also count partial token hits
  for (const [k, v] of searchHits) {
    if (k !== key && (key.includes(k) || k.includes(key))) total += Math.floor(v.count / 2);
  }
  return total;
}

export async function evaluateCelebrityApplication(input: {
  user: User;
  displayName?: string;
  level: CelebrityLevel | string | null;
  socialProof?: string | null;
  uniqueImage?: string | null;
  idImage?: string | null;
}): Promise<CelebrityVerificationResult> {
  const steps: string[] = [
    '1. Impersonation threshold — spike in copycat accounts / name collisions → protect with a check.',
    '2. Search volume — many unique people searching this name → “notable”.',
    '3. Web credibility — news / Wikipedia / Knowledge-style sources (ignore paid PR fluff).',
    '4. Cross-platform presence — active verified-style presence on IG, TikTok, YouTube, X, etc.',
  ];

  const name = (input.displayName || input.user.name || input.user.username || '').trim();
  const selfieOk = !!(input.user as any).photoVerifiedAt;
  const idOk = !!(input.idImage && String(input.idImage).length > 40);
  const identityOk = selfieOk && idOk;

  const links = extractLinks(input.socialProof || '');
  const platforms = platformsFound(links);
  const hasUnique = !!(input.uniqueImage && String(input.uniqueImage).length > 40);
  const sim = isSimulatorEnabled();
  const isKnownMockCeleb = MOCK_CELEBRITY_NAMES.some((n) => normalizeName(n) === normalizeName(name));

  // --- 1 Impersonation threshold ---
  const collisions = await countNameCollisions(name, input.user.id);
  let impersonationScore = Math.min(100, collisions * 22);
  if (isKnownMockCeleb) impersonationScore = Math.max(impersonationScore, 78);
  if (sim && (input.level === 'world' || input.level === 'country')) {
    impersonationScore = Math.max(impersonationScore, 55 + collisions * 10);
  }
  const impersonation: CelebrityScorePart = {
    score: Math.round(impersonationScore),
    detail:
      collisions > 0
        ? `Detected ${collisions} similar name/photo-style accounts — elevated impersonation risk.`
        : isKnownMockCeleb
          ? 'Known public-figure name in this environment — treated as high impersonation risk target.'
          : 'Low copycat activity so far; notability must come from search/web/platforms.',
  };

  // --- 2 Search volume ---
  let searches = searchVolumeForName(name);
  if (sim) {
    // Simulator: invent realistic velocity for demo celebs / world applicants with social proof
    if (isKnownMockCeleb) searches = Math.max(searches, 4200);
    else if (platforms.length >= 2) searches = Math.max(searches, 800);
    else if (platforms.length === 1 || hasUnique) searches = Math.max(searches, 180);
  }
  const searchScore = Math.min(100, searches < 20 ? searches * 2 : 40 + Math.log10(searches + 1) * 25);
  const searchVolume: CelebrityScorePart = {
    score: Math.round(searchScore),
    detail:
      searches >= 100
        ? `High search velocity (~${searches} recent lookups) — flagged as Highly Searched / notable.`
        : searches > 0
          ? `Moderate search interest (~${searches}). Needs stronger web/platform signals.`
          : 'Little search velocity yet. Add credible links or wait until people search your name.',
  };

  // --- 3 Web credibility ---
  let webScore = 0;
  const webBits: string[] = [];
  if (platforms.includes('wikipedia') || links.some((l) => /wikipedia\.org/i.test(l))) {
    webScore += 45;
    webBits.push('Wikipedia / Knowledge-style page found');
  }
  if (links.some((l) => NEWS_HOSTS.test(l))) {
    webScore += 35;
    webBits.push('Credible news outlet reference');
  }
  if (platforms.includes('imdb')) {
    webScore += 20;
    webBits.push('IMDb presence');
  }
  if (isKnownMockCeleb) {
    webScore = Math.max(webScore, 72);
    webBits.push('Mock celebrity knowledge match (simulator)');
  }
  // Paid PR-looking domains get no boost (explicitly ignored)
  if (/prnewswire|einpresswire|paid-press|sponsored-release/i.test(input.socialProof || '')) {
    webBits.push('Ignored paid press-release style links');
  }
  if (hasUnique && webScore < 40) {
    webScore += 15;
    webBits.push('Unique verification photo submitted as alternate proof');
  }
  webScore = Math.min(100, webScore);
  const webCredibility: CelebrityScorePart = {
    score: Math.round(webScore),
    detail: webBits.length ? webBits.join(' · ') : 'No strong news/Wikipedia signals in the links provided.',
  };

  // --- 4 Cross-platform ---
  let crossScore = Math.min(100, platforms.filter((p) => p !== 'wikipedia' && p !== 'imdb').length * 28);
  if (platforms.length >= 3) crossScore = Math.min(100, crossScore + 15);
  if (isKnownMockCeleb) crossScore = Math.max(crossScore, 80);
  if (sim && platforms.length >= 1) crossScore = Math.max(crossScore, 60);
  const crossPlatform: CelebrityScorePart = {
    score: Math.round(crossScore),
    detail: platforms.length
      ? `Linked platforms: ${platforms.join(', ')}.`
      : hasUnique
        ? 'No social links — relying on unique photo + other signals.'
        : 'No cross-platform links detected.',
  };

  const scores = {
    impersonationThreshold: impersonation,
    searchVolume,
    webCredibility,
    crossPlatform,
  };
  const averageScore =
    (scores.impersonationThreshold.score +
      scores.searchVolume.score +
      scores.webCredibility.score +
      scores.crossPlatform.score) /
    4;

  const reasons: string[] = [];
  if (!selfieOk) reasons.push('Live selfie verification is missing.');
  if (!idOk) reasons.push('ID photo is missing or incomplete.');
  if (!input.level) reasons.push('Select a verification level.');
  if (!links.length && !hasUnique) reasons.push('Provide social links or a unique verification photo.');

  // Algorithm does ~90% of filtering: need notability, not just identity
  const strongSignals = [
    scores.impersonationThreshold.score >= 50,
    scores.searchVolume.score >= 45,
    scores.webCredibility.score >= 40,
    scores.crossPlatform.score >= 45,
  ].filter(Boolean).length;

  let approved = false;
  if (identityOk && input.level && (links.length > 0 || hasUnique)) {
    if (isKnownMockCeleb && sim) {
      approved = true;
    } else if (averageScore >= 55 && strongSignals >= 2) {
      approved = true;
    } else if (sim && averageScore >= 48 && strongSignals >= 2 && (platforms.length >= 2 || hasUnique)) {
      // Simulator is slightly more lenient so you can demo the happy path
      approved = true;
    } else {
      reasons.push(
        `Notability filter: average ${Math.round(averageScore)}/100 with ${strongSignals}/4 strong signals (need ~55 avg and 2+ signals).`
      );
    }
  }

  if (approved) {
    reasons.length = 0;
    reasons.push('Identity (selfie + ID) matched.');
    reasons.push('Automated notability checks passed — blue-check style protection enabled.');
  }

  const message = approved
    ? 'Verified. You now get blurred profile, gold star, and NDA controls until you reveal yourself.'
    : `Not verified yet. ${reasons[0] || 'Strengthen search presence and credible links, then resubmit.'}`;

  return {
    approved,
    identityOk,
    scores,
    averageScore: Math.round(averageScore * 10) / 10,
    reasons,
    steps,
    message,
  };
}
