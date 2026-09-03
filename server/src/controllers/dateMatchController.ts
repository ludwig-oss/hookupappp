import { Request, Response } from 'express';
import {
  catalog,
  startSearch,
  cancelSearch,
  pollSearch,
  setAvailability,
  respondMatch,
  spinDateIdea,
  cancelScheduledDate,
  reportHowItsGoing,
  listMyMatches,
  getSearchQuota,
  computeInterestLevel,
  createPitchOffer,
  submitPitchText,
  respondPitch,
  pitchesForUser,
  summonLawyer,
  lawyerPickTarget,
  lawyerPickCandidates,
  lawyerMessage,
  respondLawyer,
  lawyerSessionsFor,
  directPitchCandidates,
} from '../models/dateMatch.js';
import { getUserTier, userHasFeature } from '../models/premium.js';
import { getAllGuides, getGuideByUserId } from '../models/improvement.js';
import { notifyDateMatch, notifyPitch, notifyLawyerRoom } from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

function uid(req: Request): string {
  return (req as any).userId;
}

export async function getCatalog(req: Request, res: Response) {
  try {
    const userId = uid(req);
    const [quota, tier, interestLevel, lawyer, plusPitch, plusCountries, gold, plat] = await Promise.all([
      getSearchQuota(userId),
      getUserTier(userId),
      computeInterestLevel(userId),
      userHasFeature(userId, 'guide_lawyer'),
      userHasFeature(userId, 'pitch_on_reject'),
      userHasFeature(userId, 'unlimited_countries'),
      userHasFeature(userId, 'guide_lawyer'),
      userHasFeature(userId, 'direct_pitch'),
    ]);
    res.json({
      ...catalog(),
      quota,
      tier,
      interestLevel,
      features: {
        unlimitedSearches: quota.unlimited,
        pitchOnReject: plusPitch,
        unlimitedCountries: plusCountries,
        guideLawyer: gold,
        directPitch: plat,
      },
      lawyer,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load Date Arena' });
  }
}

export async function postStartSearch(req: Request, res: Response) {
  try {
    const userId = uid(req);
    const lookingFor = Array.isArray(req.body?.lookingFor) ? req.body.lookingFor : [];
    const result = await startSearch(userId, lookingFor);
    if (result.match && result.other) {
      notifyDateMatch(result.other.id, { matchId: result.match.id, fromUserId: userId, status: result.match.status });
      sendPushToUser(result.other.id, {
        title: 'Date Arena match',
        body: 'Someone was paired with you. Open Date Arena to accept.',
        data: { type: 'date_match', matchId: result.match.id },
      }, 'matches').catch(() => {});
    }
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Search failed' });
  }
}

export async function postCancelSearch(req: Request, res: Response) {
  try {
    await cancelSearch(uid(req));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getPoll(req: Request, res: Response) {
  try {
    const result = await pollSearch(uid(req));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function getMine(req: Request, res: Response) {
  try {
    const lists = await listMyMatches(uid(req));
    res.json(lists);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function postAvailability(req: Request, res: Response) {
  try {
    const { matchId, slots } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await setAvailability(uid(req), matchId, Array.isArray(slots) ? slots : []);
    res.json({ match });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postRespond(req: Request, res: Response) {
  try {
    const { matchId, accept } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await respondMatch(uid(req), matchId, Boolean(accept));
    const other = match.userId1 === uid(req) ? match.userId2 : match.userId1;
    notifyDateMatch(other, { matchId: match.id, fromUserId: uid(req), status: match.status });
    res.json({ match });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postSpin(req: Request, res: Response) {
  try {
    const { matchId } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await spinDateIdea(uid(req), matchId);
    const other = match.userId1 === uid(req) ? match.userId2 : match.userId1;
    notifyDateMatch(other, { matchId: match.id, fromUserId: uid(req), status: match.status, ideaTitle: match.ideaTitle });
    res.json({ match });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postCancelDate(req: Request, res: Response) {
  try {
    const { matchId, reason, proofUrl } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await cancelScheduledDate(uid(req), matchId, String(reason || ''), proofUrl || undefined);
    res.json({ match });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postHowGoing(req: Request, res: Response) {
  try {
    const { matchId, goingWell, wantContinue } = req.body || {};
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const result = await reportHowItsGoing(uid(req), matchId, Boolean(goingWell), Boolean(wantContinue));
    const other = result.match.userId1 === uid(req) ? result.match.userId2 : result.match.userId1;
    if (result.removed) {
      sendPushToUser(other, {
        title: 'Date chat ended',
        body: 'They did not want to keep talking after the date. The chat was removed.',
        data: { type: 'date_continue_no', matchId: result.match.id },
      }, 'matches').catch(() => {});
    }
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getPitches(req: Request, res: Response) {
  try {
    const data = await pitchesForUser(uid(req));
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function postDirectPitch(req: Request, res: Response) {
  try {
    const { toUserId } = req.body || {};
    if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
    const pitch = await createPitchOffer({ fromUserId: uid(req), toUserId, source: 'direct' });
    res.json({ pitch });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postPitchText(req: Request, res: Response) {
  try {
    const { pitchId, text } = req.body || {};
    if (!pitchId) return res.status(400).json({ error: 'pitchId is required' });
    const pitch = await submitPitchText(uid(req), pitchId, String(text || ''));
    notifyPitch(pitch.toUserId, { pitchId: pitch.id, fromUserId: pitch.fromUserId, incoming: true });
    sendPushToUser(pitch.toUserId, {
      title: 'Someone pitched themselves',
      body: 'Read it and accept or reject the new offer.',
      data: { type: 'incoming_pitch', pitchId: pitch.id },
    }, 'interest').catch(() => {});
    res.json({ pitch });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postPitchRespond(req: Request, res: Response) {
  try {
    const { pitchId, accept } = req.body || {};
    if (!pitchId) return res.status(400).json({ error: 'pitchId is required' });
    const pitch = await respondPitch(uid(req), pitchId, Boolean(accept));
    notifyPitch(pitch.fromUserId, { pitchId: pitch.id, fromUserId: uid(req), incoming: false, accepted: pitch.status === 'accepted' });
    res.json({ pitch, openChat: pitch.status === 'accepted', chatUserId: pitch.status === 'accepted' ? pitch.fromUserId : null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getDirectCandidates(req: Request, res: Response) {
  try {
    const users = await directPitchCandidates(uid(req));
    res.json({ users });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getLawyerGuides(req: Request, res: Response) {
  try {
    const ok = await userHasFeature(uid(req), 'guide_lawyer');
    if (!ok) return res.status(403).json({ error: 'Guide hand-pick is a Gold feature' });
    const guides = await getAllGuides();
    const { getUserById } = await import('../models/user.js');
    const enriched = await Promise.all(
      guides.slice(0, 30).map(async (g) => {
        const u = await getUserById(g.userId);
        return {
          id: g.id,
          userId: g.userId,
          categories: g.categories,
          region: g.region,
          rating: g.rating,
          name: u?.name || 'Guide',
          profilePicture: u?.profilePicture ?? null,
        };
      })
    );
    res.json({ guides: enriched });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function postSummonLawyer(req: Request, res: Response) {
  try {
    const { guideUserId } = req.body || {};
    if (!guideUserId) return res.status(400).json({ error: 'guideUserId is required' });
    let guideUid = String(guideUserId);
    const byUser = await getGuideByUserId(guideUid);
    if (!byUser) {
      const all = await getAllGuides();
      const g = all.find((x) => x.id === guideUid);
      if (g) guideUid = g.userId;
    }
    const session = await summonLawyer(uid(req), guideUid);
    notifyLawyerRoom(session.guideUserId, { sessionId: session.id, role: 'guide' });
    sendPushToUser(session.guideUserId, {
      title: 'You were summoned as a date lawyer',
      body: 'Hand-pick a potential date, then pitch in the 3-person room.',
      data: { type: 'lawyer_summon', sessionId: session.id },
    }, 'safety').catch(() => {});
    res.json({ session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getLawyerCandidates(req: Request, res: Response) {
  try {
    const sessionId = String(req.query.sessionId || '');
    const sessions = await lawyerSessionsFor(uid(req));
    const s = sessions.find((x) => x.id === sessionId);
    if (!s || s.guideUserId !== uid(req)) return res.status(403).json({ error: 'Only the summoned guide can pick' });
    const users = await lawyerPickCandidates(s.guideUserId, s.clientUserId);
    res.json({ users, client: s.client });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postLawyerPick(req: Request, res: Response) {
  try {
    const { sessionId, targetUserId } = req.body || {};
    if (!sessionId || !targetUserId) return res.status(400).json({ error: 'sessionId and targetUserId are required' });
    const session = await lawyerPickTarget(uid(req), sessionId, String(targetUserId));
    notifyLawyerRoom(session.clientUserId, { sessionId: session.id, role: 'picked' });
    if (session.targetUserId) {
      notifyLawyerRoom(session.targetUserId, { sessionId: session.id, role: 'target' });
      sendPushToUser(session.targetUserId, {
        title: 'A guide wants to introduce someone',
        body: 'Join the small room — you can accept or decline.',
        data: { type: 'lawyer_intro', sessionId: session.id },
      }, 'matches').catch(() => {});
    }
    res.json({ session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getLawyerSessions(req: Request, res: Response) {
  try {
    const sessions = await lawyerSessionsFor(uid(req));
    res.json({ sessions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function postLawyerMessage(req: Request, res: Response) {
  try {
    const { sessionId, content } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await lawyerMessage(uid(req), sessionId, String(content || ''));
    for (const id of [session.clientUserId, session.targetUserId, session.guideUserId].filter((x): x is string => Boolean(x))) {
      if (id !== uid(req)) notifyLawyerRoom(id, { sessionId: session.id, role: 'message' });
    }
    res.json({ session });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function postLawyerRespond(req: Request, res: Response) {
  try {
    const { sessionId, accept } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await respondLawyer(uid(req), sessionId, Boolean(accept));
    notifyLawyerRoom(session.clientUserId, { sessionId: session.id, role: 'decision', accepted: accept });
    notifyLawyerRoom(session.guideUserId, { sessionId: session.id, role: 'decision', accepted: accept });
    res.json({
      session,
      openChat: session.status === 'accepted',
      chatUserId: session.status === 'accepted' ? session.clientUserId : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
