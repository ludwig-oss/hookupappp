import { Request, Response } from 'express';
import { getUserById } from '../models/user.js';
import { approveApplication, getApplicationByUserId } from '../models/improvement.js';
import {
  castCoachVote,
  collectImprovementHints,
  computeVoteStats,
  createCoachVoteCampaign,
  getCampaignByApplicant,
  getCampaignById,
  getPendingCampaignsForVoter,
  getVotesForCampaign,
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

  const passed = stats.total >= COACH_VOTE_MIN_VOTES && stats.percent >= COACH_VOTE_THRESHOLD;
  const hints = passed ? [] : await collectImprovementHints(votes);

  if (passed) {
    await updateCampaignStatus(campaignId, 'passed', []);
    try {
      await approveApplication(campaign.applicationId, 'peer-vote-system', Math.min(5, 3.5 + stats.percent));
    } catch (e) {
      console.error('Auto-approve coach after peer vote:', e);
    }
    notifyCoachVoteResult(campaign.applicantUserId, {
      passed: true,
      percent: Math.round(stats.percent * 100),
      totalVotes: stats.total,
      hints: [],
    });
    sendPushToUser(campaign.applicantUserId, {
      title: 'Coach application approved!',
      body: `You got ${Math.round(stats.percent * 100)}% "baddie" votes. You can now guide clients in the Guiding section.`,
      data: { url: '/home' },
    }).catch(() => {});
  } else {
    await updateCampaignStatus(campaignId, 'failed', hints);
    try {
      const { rejectApplication } = await import('../models/improvement.js');
      await rejectApplication(campaign.applicationId, 'peer-vote-system');
    } catch (e) {
      console.error('Reject after failed peer vote:', e);
    }
    notifyCoachVoteResult(campaign.applicantUserId, {
      passed: false,
      percent: Math.round(stats.percent * 100),
      totalVotes: stats.total,
      hints,
    });
    sendPushToUser(campaign.applicantUserId, {
      title: 'Coach vote — try again',
      body: hints.length
        ? `You didn't reach 80% in 48h. Work on: ${hints.slice(0, 3).join(', ')}.`
        : `You didn't reach 80% in 48h. Improve your profile and re-apply.`,
      data: { url: '/home' },
    }).catch(() => {});
  }
}

/** Called after guide application — starts 48h peer vote */
export async function startVoteForApplication(applicationId: string, applicantUserId: string): Promise<void> {
  const user = await getUserById(applicantUserId);
  if (!user) return;

  await createCoachVoteCampaign({
    applicationId,
    applicantUserId,
    applicantGender: user.gender || 'unknown',
    profileName: user.name || user.username,
    profilePicture: user.profilePicture,
    profileBio: user.bio || null,
    profileAge: typeof user.age === 'number' ? user.age : null,
  });
}

/** GET campaigns the voter can review */
export async function getPendingVotes(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const campaigns = await getPendingCampaignsForVoter(userId, user.gender || '');
    res.json({ campaigns, feedbackTags: FEEDBACK_TAGS });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

/** POST vote — body: { vote: 'baddie'|'not', feedbackTags?: string[] } */
export async function submitVote(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { campaignId } = req.params;
    const { vote, feedbackTags } = req.body as { vote?: string; feedbackTags?: string[] };

    if (vote !== 'baddie' && vote !== 'not') {
      return res.status(400).json({ error: 'vote must be "baddie" or "not"' });
    }

    const user = await getUserById(userId);
    const campaign = await getCampaignById(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!user?.gender) {
      return res.status(400).json({ error: 'Set your gender in profile settings to vote' });
    }

    const { isOppositeGender } = await import('../models/coachVote.js');
    if (!isOppositeGender(campaign.applicantGender, user.gender)) {
      return res.status(403).json({ error: 'Only opposite-gender members can vote on coach applicants' });
    }

    await castCoachVote({
      campaignId,
      voterUserId: userId,
      vote,
      feedbackTags: Array.isArray(feedbackTags) ? feedbackTags.filter((t) => FEEDBACK_TAGS.includes(t as any)) : [],
    });

    await evaluateCampaign(campaignId);

    const votes = await getVotesForCampaign(campaignId);
    const stats = computeVoteStats(votes);
    res.json({
      message: 'Vote recorded',
      stats: {
        total: stats.total,
        baddiePercent: Math.round(stats.percent * 100),
        needed: COACH_VOTE_MIN_VOTES,
        thresholdPercent: COACH_VOTE_THRESHOLD * 100,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Vote failed' });
  }
}

/** GET applicant's own vote campaign status */
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
        baddie: stats.baddie,
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

/** GET next coach candidate for 15s swipe popup (regional priority) */
export async function getCoachVotePopup(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.gender) {
      return res.json({ campaign: null, message: 'Set gender in profile to help review coach applicants' });
    }

    const skip = typeof req.query.skip === 'string' ? req.query.skip.split(',').filter(Boolean) : [];
    const country = (req.query.country as string) || user.country;
    const city = (req.query.city as string) || user.city;

    const campaign = await getPopupCampaignForVoter(userId, user.gender, country, city, skip);
    if (!campaign) return res.json({ campaign: null });

    const voterGender = user.gender;
    const label =
      voterGender === 'female' || voterGender === 'f'
        ? 'Swipe right if she\'s a baddie coach — left if not'
        : voterGender === 'male' || voterGender === 'm'
          ? 'Swipe right if he\'s a bad boy coach — left if not'
          : 'Swipe right = yes, left = not yet';

    res.json({
      campaign,
      popupSeconds: 15,
      swipeLabel: label,
      helpText:
        'Your vote helps pick quality guides in your area. You have 15 seconds — swipe or it skips.',
      regionalMatch: Boolean(country && campaign.applicantCountry),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

/** POST swipe vote from popup — body: { vote: 'baddie'|'not', feedbackTags? } */
export async function submitPopupSwipe(req: Request, res: Response) {
  return submitVote(req, res);
}
