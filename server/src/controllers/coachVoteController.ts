import { Request, Response } from 'express';
import { getUserById } from '../models/user.js';
import { approveApplication, getApplicationById, getApplicationByUserId } from '../models/improvement.js';
import {
  castCoachVote,
  collectImprovementHints,
  computeVoteStats,
  createCoachVoteCampaign,
  getCampaignByApplicant,
  getCampaignById,
  getPendingCampaignsForVoter,
  getVotesForCampaign,
  guideCanVoteOnCampaign,
  COACH_VOTE_MIN_VOTES,
  COACH_VOTE_THRESHOLD,
  updateCampaignStatus,
  getPopupCampaignForVoter,
} from '../models/coachVote.js';
import { notifyCoachVoteResult } from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

const FEEDBACK_TAGS = ['photos', 'style', 'confidence', 'communication', 'authenticity'] as const;

async function evaluateCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.status !== 'voting') return;

  const expired = new Date() > new Date(campaign.expiresAt);
  const votes = await getVotesForCampaign(campaignId);
  const stats = computeVoteStats(votes);

  if (!expired && stats.total < COACH_VOTE_MIN_VOTES) return;

  const passed = stats.total >= COACH_VOTE_MIN_VOTES && stats.yes > stats.no;

  const hints = passed ? [] : await collectImprovementHints(votes);

  if (passed) {
    await updateCampaignStatus(campaignId, 'passed', []);
    try {
      await approveApplication(campaign.applicationId, 'expert-guide-vote', Math.min(5, 3.5 + stats.percent));
    } catch (e) {
      console.error('Auto-approve coach after guide vote:', e);
    }
    notifyCoachVoteResult(campaign.applicantUserId, {
      passed: true,
      percent: Math.round(stats.percent * 100),
      totalVotes: stats.total,
      hints: [],
    });
    sendPushToUser(campaign.applicantUserId, {
      title: 'Guide application approved!',
      body: `${stats.yes} expert guides said yes (${stats.no} no). You can guide clients now.`,
      data: { url: '/home' },
    }).catch(() => {});
  } else {
    await updateCampaignStatus(campaignId, 'failed', hints);
    try {
      const { rejectApplication } = await import('../models/improvement.js');
      await rejectApplication(campaign.applicationId, 'expert-guide-vote');
    } catch (e) {
      console.error('Reject after failed guide vote:', e);
    }
    notifyCoachVoteResult(campaign.applicantUserId, {
      passed: false,
      percent: Math.round(stats.percent * 100),
      totalVotes: stats.total,
      hints,
    });
    sendPushToUser(campaign.applicantUserId, {
      title: 'Guide vote — not qualified',
      body: hints.length
        ? `More guides said no. Work on: ${hints.slice(0, 3).join(', ')}.`
        : `More expert guides said no than yes. Improve your proof and re-apply.`,
      data: { url: '/home' },
    }).catch(() => {});
  }
}

/** Called after guide application — expert guides in region vote for 48h */
export async function startVoteForApplication(applicationId: string, applicantUserId: string): Promise<void> {
  const user = await getUserById(applicantUserId);
  if (!user) return;
  const app = await getApplicationById(applicationId);

  await createCoachVoteCampaign({
    applicationId,
    applicantUserId,
    applicantGender: user.gender || 'unknown',
    profileName: user.name || user.username,
    profilePicture: user.profilePicture,
    profileBio: user.bio || null,
    profileAge: typeof user.age === 'number' ? user.age : null,
    applicationCategories: app?.categories || [],
    applicationRegion: app?.region || user.city || user.country || 'Global',
    applicantCountry: user.country || null,
    applicantCity: user.city || null,
  });
}

export async function getPendingVotes(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const campaigns = await getPendingCampaignsForVoter(userId);
    res.json({ campaigns, feedbackTags: FEEDBACK_TAGS });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

function normalizeVoteInput(raw: unknown): 'yes' | 'no' | null {
  if (raw === 'yes' || raw === 'baddie') return 'yes';
  if (raw === 'no' || raw === 'not') return 'no';
  return null;
}

/** POST vote — body: { vote: 'yes'|'no', feedbackTags?: string[] } */
export async function submitVote(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { campaignId } = req.params;
    const { vote, feedbackTags } = req.body as { vote?: string; feedbackTags?: string[] };

    const normalized = normalizeVoteInput(vote);
    if (!normalized) {
      return res.status(400).json({ error: 'vote must be "yes" or "no"' });
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    if (!(await guideCanVoteOnCampaign(userId, campaign))) {
      return res.status(403).json({ error: 'Only hired guides in this category and region can vote' });
    }

    await castCoachVote({
      campaignId,
      voterUserId: userId,
      vote: normalized,
      feedbackTags: Array.isArray(feedbackTags) ? feedbackTags.filter((t) => FEEDBACK_TAGS.includes(t as any)) : [],
    });

    await evaluateCampaign(campaignId);

    const votes = await getVotesForCampaign(campaignId);
    const stats = computeVoteStats(votes);
    res.json({
      message: 'Vote recorded',
      stats: {
        total: stats.total,
        yes: stats.yes,
        no: stats.no,
        yesPercent: Math.round(stats.percent * 100),
        needed: COACH_VOTE_MIN_VOTES,
        thresholdPercent: COACH_VOTE_THRESHOLD * 100,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Vote failed' });
  }
}

export async function getMyVoteStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    let campaign = await getCampaignByApplicant(userId);

    if (campaign?.status === 'voting') {
      await evaluateCampaign(campaign.id);
      campaign = await getCampaignByApplicant(userId);
    }

    if (!campaign) {
      const app = await getApplicationByUserId(userId);
      return res.json({ campaign: null, application: app });
    }

    const votes = await getVotesForCampaign(campaign.id);
    const stats = computeVoteStats(votes);
    const msLeft = new Date(campaign.expiresAt).getTime() - Date.now();

    res.json({
      campaign,
      stats: {
        total: stats.total,
        yes: stats.yes,
        no: stats.no,
        baddie: stats.yes,
        baddiePercent: Math.round(stats.percent * 100),
        minVotes: COACH_VOTE_MIN_VOTES,
        thresholdPercent: COACH_VOTE_THRESHOLD * 100,
        hoursLeft: Math.max(0, Math.round(msLeft / (60 * 60 * 1000))),
      },
      improvementHints: campaign.improvementHints,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export { evaluateCampaign, FEEDBACK_TAGS };

export async function getCoachVotePopup(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { getGuideByUserId } = await import('../models/improvement.js');
    const guide = await getGuideByUserId(userId);
    if (!guide?.isActive || !user.qualifiedCoach) {
      return res.json({ campaign: null });
    }

    const skip = typeof req.query.skip === 'string' ? req.query.skip.split(',').filter(Boolean) : [];
    const country = (req.query.country as string) || user.country;
    const city = (req.query.city as string) || user.city;

    const campaign = await getPopupCampaignForVoter(userId, country, city, skip);
    if (!campaign) return res.json({ campaign: null });

    res.json({
      campaign,
      popupSeconds: 15,
      swipeLabel: 'Does this applicant qualify as a guide in your area?',
      helpText:
        'You are a hired guide — vote yes or no on their proof. More yes than no = they qualify.',
      regionalMatch: Boolean(country && campaign.applicantCountry),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function submitPopupSwipe(req: Request, res: Response) {
  return submitVote(req, res);
}
