import { Request, Response } from 'express';
import {
  getWalkSuggestions,
  sendWalkInterest,
  respondWalkInterest,
  getIncomingWalkInterests,
  submitLifeQuiz,
  recordProfileClick,
  recordProfileImpression,
  getUserAge,
  dismissWalkSuggestion,
  syncNearbyOnLocation,
} from '../models/walkMatch.js';
import { getUserById } from '../models/user.js';
import { ensureMatchConversation } from '../models/chat.js';
import { isHealthMatchingLimited } from './healthController.js';

export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseInt(req.query.radius as string, 10) || 500;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const viewer = await getUserById(userId);
    if (!viewer) return res.status(404).json({ error: 'User not found' });

    const needsQuiz =
      (viewer.gender || '').toLowerCase().startsWith('m') &&
      !viewer.lifeQuizCompleted &&
      getUserAge(viewer) != null &&
      getUserAge(viewer)! >= 20;

    const suggestions = await getWalkSuggestions(userId, lat, lon, radius);
    const viewerLimited = await isHealthMatchingLimited(userId);
    const filtered: typeof suggestions = [];
    for (const s of suggestions) {
      if (await isHealthMatchingLimited(s.id)) continue;
      filtered.push(s);
    }

    res.json({
      suggestions: filtered,
      needsLifeQuiz: needsQuiz,
      outdoorWalkEnabled: viewer.outdoorWalkEnabled !== false,
      nearbyDiscoverable: viewer.nearbyDiscoverable !== false,
      atHome: true,
      homeSet: Boolean(viewer.homeLocation),
      healthMatchingLimited: viewerLimited,
    });
  } catch (e) {
    console.error('Walk suggestions error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWalkLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { lat, lon, accuracy } = req.body;
    if (lat == null || lon == null) {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    await syncNearbyOnLocation(userId, Number(lat), Number(lon));
    res.json({ ok: true });
  } catch (e) {
    console.error('Walk location error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postInterest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { toUserId } = req.body;
    if (!userId || !toUserId) {
      return res.status(400).json({ error: 'toUserId required' });
    }
    const result = await sendWalkInterest(userId, toUserId);
    if (result.mutual) {
      const opener = "You're matched nearby! Reply within 24 hours or the match ends — say hi! 💬";
      try {
        await ensureMatchConversation(userId, toUserId, opener);
      } catch (chatErr) {
        console.error('Walk interest chat seed failed (interest still saved):', chatErr);
      }
    }
    res.json({
      message: result.mutual ? "It's a match! Opening chat…" : 'Interest sent — waiting for them to say yes.',
      ...result,
      chatUserId: result.mutual ? toUserId : undefined,
    });
  } catch (e: any) {
    console.error('Walk interest error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const postRespondInterest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { interestId, accept } = req.body;
    if (!userId || !interestId) {
      return res.status(400).json({ error: 'interestId required' });
    }
    const result = await respondWalkInterest(userId, interestId, accept !== false);
    if (result.mutual && result.chatUserId) {
      try {
        await ensureMatchConversation(
          userId,
          result.chatUserId,
          "You're matched nearby! Reply within 24 hours or the match ends — say hi! 💬"
        );
      } catch (chatErr) {
        console.error('Walk respond chat seed failed:', chatErr);
      }
    }
    res.json(result);
  } catch (e: any) {
    console.error('Walk respond error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const getIncoming = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const incoming = await getIncomingWalkInterests(userId);
    res.json({ incoming });
  } catch (e) {
    console.error('Walk incoming error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postLifeQuiz = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { lifeStage, financialSituation, datingGoals, isFamousOrInfluencer, styleRating } = req.body;
    if (!lifeStage || !financialSituation || !datingGoals) {
      return res.status(400).json({ error: 'lifeStage, financialSituation, and datingGoals are required' });
    }
    const user = await submitLifeQuiz(userId, {
      lifeStage: String(lifeStage),
      financialSituation: String(financialSituation),
      datingGoals: String(datingGoals),
      isFamousOrInfluencer: Boolean(isFamousOrInfluencer),
      styleRating: typeof styleRating === 'number' ? styleRating : undefined,
    });
    res.json({ message: 'Profile updated', user });
  } catch (e) {
    console.error('Life quiz error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postProfileClick = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'targetUserId required' });
    }
    const result = await recordProfileClick(targetUserId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const postProfileImpression = async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    await recordProfileImpression(targetUserId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const postDismissSuggestion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { toUserId } = req.body;
    if (!userId || !toUserId) {
      return res.status(400).json({ error: 'toUserId required' });
    }
    await dismissWalkSuggestion(userId, toUserId);
    res.json({ message: 'Dismissed — we will not suggest them again nearby.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};

export const patchWalkSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { outdoorWalkEnabled, gender, age, nearbyDiscoverable, setHome, lat, lon } = req.body;
    const { updateUserProfile } = await import('../models/user.js');
    const viewer = await getUserById(userId);
    if (!viewer) return res.status(404).json({ error: 'User not found' });

    const updates: Record<string, unknown> = {};
    if (typeof outdoorWalkEnabled === 'boolean') updates.outdoorWalkEnabled = outdoorWalkEnabled;
    if (gender) updates.gender = String(gender).slice(0, 20);
    if (typeof age === 'number' && age >= 18 && age <= 99) updates.age = age;

    if (setHome === true && lat != null && lon != null) {
      updates.homeLocation = { lat: Number(lat), lon: Number(lon) };
    }

    if (typeof nearbyDiscoverable === 'boolean') {
      updates.nearbyDiscoverable = nearbyDiscoverable;
    }

    const user = await updateUserProfile(userId, updates as any);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
