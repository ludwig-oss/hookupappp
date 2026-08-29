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
  userIsAtHome,
} from '../models/walkMatch.js';
import { HOME_RADIUS_M } from '../models/walkMatchUtils.js';
import { getUserById } from '../models/user.js';
import { ensureMatchConversation } from '../models/chat.js';

export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseInt(req.query.radius as string, 10) || 120;

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

    res.json({
      suggestions,
      needsLifeQuiz: needsQuiz,
      outdoorWalkEnabled: viewer.outdoorWalkEnabled !== false,
      nearbyDiscoverable: viewer.nearbyDiscoverable === true,
      atHome: userIsAtHome(viewer as any),
      homeSet: Boolean(viewer.homeLocation),
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
    const opener = result.mutual
      ? "You're matched nearby! Say hi and start chatting 💬"
      : "I'm nearby and interested — say hi when you're ready 💬";
    try {
      await ensureMatchConversation(userId, toUserId, opener);
    } catch (chatErr) {
      console.error('Walk interest chat seed failed (interest still saved):', chatErr);
    }
    res.json({
      message: result.mutual ? "It's a match! Opening chat…" : 'Added to your chats — say hi!',
      ...result,
      chatUserId: toUserId,
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
        await ensureMatchConversation(userId, result.chatUserId);
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
      if (nearbyDiscoverable) {
        const home = (updates.homeLocation as { lat: number; lon: number } | undefined) || viewer.homeLocation;
        const loc = viewer.location;
        if (!home) {
          return res.status(400).json({ error: 'Set your home location first.' });
        }
        if (!loc) {
          return res.status(400).json({ error: 'Enable location so we know you are home.' });
        }
        const { calculateDistance } = await import('../models/walkMatchUtils.js');
        if (calculateDistance(loc.lat, loc.lon, home.lat, home.lon) > HOME_RADIUS_M) {
          return res.status(400).json({ error: 'You can only go visible when you are at home.' });
        }
      }
      updates.nearbyDiscoverable = nearbyDiscoverable;
    }

    const user = await updateUserProfile(userId, updates as any);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
