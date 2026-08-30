import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/** 50%+ yes votes from expert guides within 48h → approved */
export const COACH_VOTE_THRESHOLD = 0.5;
export const COACH_VOTE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const COACH_VOTE_MIN_VOTES = 3;

export type CoachVoteCampaignStatus = 'voting' | 'passed' | 'failed';

export interface CoachVoteCampaign {
  id: string;
  applicationId: string;
  applicantUserId: string;
  applicantGender: string;
  /** Snapshot shown to voters */
  profileName: string;
  profilePicture: string | null;
  profileBio: string | null;
  profileAge: number | null;
  applicationCategories: string[];
  applicationRegion: string;
  applicantCountry?: string | null;
  applicantCity?: string | null;
  status: CoachVoteCampaignStatus;
  startedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  /** Feedback tags from "not" votes for improvement hints */
  improvementHints: string[];
}

export interface CoachVote {
  id: string;
  campaignId: string;
  voterUserId: string;
  vote: 'baddie' | 'not' | 'yes' | 'no';
  feedbackTags: string[];
  createdAt: string;
}

const CAMPAIGNS_PATH = join(process.cwd(), 'server', 'data', 'coach-vote-campaigns.json');
const VOTES_PATH = join(process.cwd(), 'server', 'data', 'coach-votes.json');

async function readCampaigns(): Promise<CoachVoteCampaign[]> {
  try {
    const raw = JSON.parse(await readFile(CAMPAIGNS_PATH, 'utf-8')) as CoachVoteCampaign[];
    return raw.map((c) => ({
      ...c,
      applicationCategories: c.applicationCategories || [],
      applicationRegion: c.applicationRegion || 'Global',
    }));
  } catch {
    return [];
  }
}

async function writeCampaigns(list: CoachVoteCampaign[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(CAMPAIGNS_PATH, JSON.stringify(list, null, 2));
}

async function readVotes(): Promise<CoachVote[]> {
  try {
    return JSON.parse(await readFile(VOTES_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeVotes(list: CoachVote[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(VOTES_PATH, JSON.stringify(list, null, 2));
}

export function normalizeGender(g?: string | null): string {
  const g2 = (g || '').trim().toLowerCase();
  if (g2 === 'm' || g2 === 'man' || g2 === 'male') return 'male';
  if (g2 === 'f' || g2 === 'woman' || g2 === 'female') return 'female';
  if (g2 === 'nonbinary' || g2 === 'non-binary' || g2 === 'nb') return 'nonbinary';
  return g2 || 'unknown';
}

/** Opposite gender for peer review (binary + nonbinary sees both). */
export function isOppositeGender(applicantGender: string, voterGender: string): boolean {
  const a = normalizeGender(applicantGender);
  const v = normalizeGender(voterGender);
  if (a === 'unknown' || v === 'unknown') return false;
  if (a === v) return false;
  if (a === 'male' && v === 'female') return true;
  if (a === 'female' && v === 'male') return true;
  if (a === 'nonbinary' && (v === 'male' || v === 'female')) return true;
  if (v === 'nonbinary' && (a === 'male' || a === 'female')) return true;
  return false;
}

const IMPROVEMENT_TAG_LABELS: Record<string, string> = {
  photos: 'Profile photos / presentation',
  style: 'Style & grooming',
  confidence: 'Confidence & energy',
  communication: 'Communication vibe',
  authenticity: 'Authenticity / trust',
};

export function tagToHint(tag: string): string {
  return IMPROVEMENT_TAG_LABELS[tag] || tag;
}

export async function createCoachVoteCampaign(params: {
  applicationId: string;
  applicantUserId: string;
  applicantGender: string;
  profileName: string;
  profilePicture: string | null;
  profileBio: string | null;
  profileAge: number | null;
  applicationCategories?: string[];
  applicationRegion?: string;
  applicantCountry?: string | null;
  applicantCity?: string | null;
}): Promise<CoachVoteCampaign> {
  const campaigns = await readCampaigns();
  const existing = campaigns.find(
    (c) => c.applicationId === params.applicationId || c.applicantUserId === params.applicantUserId
  );
  if (existing && existing.status === 'voting') return existing;

  const now = new Date();
  const campaign: CoachVoteCampaign = {
    id: Date.now().toString(),
    applicationId: params.applicationId,
    applicantUserId: params.applicantUserId,
    applicantGender: normalizeGender(params.applicantGender),
    profileName: params.profileName,
    profilePicture: params.profilePicture,
    profileBio: params.profileBio,
    profileAge: params.profileAge,
    applicationCategories: params.applicationCategories || [],
    applicationRegion: params.applicationRegion || 'Global',
    applicantCountry: params.applicantCountry ?? null,
    applicantCity: params.applicantCity ?? null,
    status: 'voting',
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + COACH_VOTE_WINDOW_MS).toISOString(),
    resolvedAt: null,
    improvementHints: [],
  };
  campaigns.push(campaign);
  await writeCampaigns(campaigns);
  return campaign;
}

export async function getCampaignById(id: string): Promise<CoachVoteCampaign | null> {
  const campaigns = await readCampaigns();
  return campaigns.find((c) => c.id === id) || null;
}

export async function getCampaignByApplicant(userId: string): Promise<CoachVoteCampaign | null> {
  const campaigns = await readCampaigns();
  return campaigns.filter((c) => c.applicantUserId === userId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
}

export async function getVotesForCampaign(campaignId: string): Promise<CoachVote[]> {
  const votes = await readVotes();
  return votes.filter((v) => v.campaignId === campaignId);
}

export async function hasVoted(campaignId: string, voterUserId: string): Promise<boolean> {
  const votes = await readVotes();
  return votes.some((v) => v.campaignId === campaignId && v.voterUserId === voterUserId);
}

export function isYesVote(vote: CoachVote['vote']): boolean {
  return vote === 'baddie' || vote === 'yes';
}

export async function guideCanVoteOnCampaign(
  voterUserId: string,
  campaign: CoachVoteCampaign
): Promise<boolean> {
  const { getGuideByUserId, matchesRegionFilter, matchesGeoFilter } = await import('./improvement.js');
  const { getUserById } = await import('./user.js');
  const guide = await getGuideByUserId(voterUserId);
  const voter = await getUserById(voterUserId);
  if (!guide || !voter?.qualifiedCoach || !guide.isActive) return false;

  const appCats = campaign.applicationCategories || [];
  if (appCats.length > 0 && !appCats.some((c) => guide.categories.includes(c))) return false;

  const appRegion = (campaign.applicationRegion || 'Global').trim();
  if (appRegion.toLowerCase() === 'global') return true;
  if (matchesRegionFilter(guide.region, appRegion)) return true;
  if (matchesGeoFilter(guide.region, campaign.applicantCountry, campaign.applicantCity)) return true;
  if (matchesGeoFilter(appRegion, voter.country, voter.city)) return true;
  return false;
}

export async function castCoachVote(params: {
  campaignId: string;
  voterUserId: string;
  vote: 'baddie' | 'not' | 'yes' | 'no';
  feedbackTags?: string[];
}): Promise<CoachVote> {
  const campaigns = await readCampaigns();
  const campaign = campaigns.find((c) => c.id === params.campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'voting') throw new Error('Voting has ended');
  if (new Date() > new Date(campaign.expiresAt)) throw new Error('Voting period expired');
  if (campaign.applicantUserId === params.voterUserId) throw new Error('You cannot vote on your own application');
  if (!(await guideCanVoteOnCampaign(params.voterUserId, campaign))) {
    throw new Error('Only hired guides in this category and region can vote');
  }

  const votes = await readVotes();
  if (votes.some((v) => v.campaignId === params.campaignId && v.voterUserId === params.voterUserId)) {
    throw new Error('You already voted');
  }

  const normalizedVote: CoachVote['vote'] =
    params.vote === 'yes' || params.vote === 'baddie' ? 'yes' : 'no';

  const entry: CoachVote = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    campaignId: params.campaignId,
    voterUserId: params.voterUserId,
    vote: normalizedVote,
    feedbackTags: params.feedbackTags || [],
    createdAt: new Date().toISOString(),
  };
  votes.push(entry);
  await writeVotes(votes);
  return entry;
}

export function computeVoteStats(votes: CoachVote[]): {
  total: number;
  baddie: number;
  yes: number;
  no: number;
  percent: number;
} {
  const total = votes.length;
  const yes = votes.filter((v) => isYesVote(v.vote)).length;
  const no = total - yes;
  const percent = total > 0 ? yes / total : 0;
  return { total, baddie: yes, yes, no, percent };
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CoachVoteCampaignStatus,
  improvementHints: string[] = []
): Promise<CoachVoteCampaign | null> {
  const campaigns = await readCampaigns();
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;
  campaign.status = status;
  campaign.resolvedAt = new Date().toISOString();
  campaign.improvementHints = improvementHints;
  await writeCampaigns(campaigns);
  return campaign;
}

export async function getPendingCampaignsForVoter(voterUserId: string): Promise<CoachVoteCampaign[]> {
  const campaigns = await readCampaigns();
  const votes = await readVotes();
  const now = new Date();
  const votedIds = new Set(votes.filter((v) => v.voterUserId === voterUserId).map((v) => v.campaignId));

  const pending: CoachVoteCampaign[] = [];
  for (const c of campaigns) {
    if (c.status !== 'voting') continue;
    if (now > new Date(c.expiresAt)) continue;
    if (c.applicantUserId === voterUserId) continue;
    if (votedIds.has(c.id)) continue;
    if (await guideCanVoteOnCampaign(voterUserId, c)) pending.push(c);
  }
  return pending;
}

export async function collectImprovementHints(votes: CoachVote[]): Promise<string[]> {
  const tags = votes.filter((v) => !isYesVote(v.vote)).flatMap((v) => v.feedbackTags);
  const counts = new Map<string, number>();
  for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tagToHint(tag));
}

/** One campaign for 15s swipe popup — prioritizes voter's region. */
export async function getPopupCampaignForVoter(
  voterUserId: string,
  country?: string | null,
  city?: string | null,
  skipIds: string[] = []
): Promise<(CoachVoteCampaign & { applicantCountry?: string | null; applicantCity?: string | null }) | null> {
  const pending = await getPendingCampaignsForVoter(voterUserId);
  const candidates = pending.filter((c) => !skipIds.includes(c.id));
  if (!candidates.length) return null;

  const { getUserById } = await import('./user.js');
  const scored: Array<{ c: CoachVoteCampaign; score: number; country?: string | null; city?: string | null }> = [];

  for (const c of candidates) {
    const u = await getUserById(c.applicantUserId);
    let score = 0;
    const vc = (country || '').trim().toLowerCase();
    const vci = (city || '').trim().toLowerCase();
    const uc = (u?.country || '').trim().toLowerCase();
    const uci = (u?.city || '').trim().toLowerCase();
    if (vc && uc && (uc === vc || uc.includes(vc) || vc.includes(uc))) score += 2;
    if (vci && uci && (uci === vci || uci.includes(vci) || vci.includes(uci))) score += 3;
    scored.push({ c, score, country: u?.country, city: u?.city });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return top ? { ...top.c, applicantCountry: top.country, applicantCity: top.city } : null;
}
