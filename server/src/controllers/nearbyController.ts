import { Request, Response } from 'express';
import { getAllUsers, updateUserLocation } from '../models/user.js';
import { createBuzz, getIncomingBuzz, getOutgoingBuzz, respondToBuzz } from '../models/nearby.js';
import { ensureMatchConversation } from '../models/chat.js';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const ACTIVE_MS = 2 * 60 * 1000; // 2 minutes window for "active"
const NEARBY_METERS = 50;

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    const { lat, lon, accuracy } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon must be numbers' });
    }

    const user = await updateUserLocation(userId, { lat, lon, accuracy });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNearbyUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req.query.userId as string);
    const lat = typeof req.query.lat === 'string' ? Number(req.query.lat) : undefined;
    const lon = typeof req.query.lon === 'string' ? Number(req.query.lon) : undefined;

    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'lat/lon query params are required' });
    }

    const now = Date.now();
    const users = await getAllUsers();

    const nearby = users
      .filter(u => u.id !== userId)
      .filter(u => u.location && (now - new Date(u.location.updatedAt as any).getTime()) <= ACTIVE_MS)
      .map(u => {
        const distance = haversineMeters(lat, lon, u.location!.lat, u.location!.lon);
        return {
          id: u.id,
          name: u.name,
          username: u.username,
          profilePicture: u.profilePicture,
          distanceMeters: Math.round(distance),
          accuracy: u.location?.accuracy,
          lastSeenAt: u.location?.updatedAt,
        };
      })
      .filter(u => u.distanceMeters <= NEARBY_METERS)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({ nearby, radiusMeters: NEARBY_METERS, activeWindowMs: ACTIVE_MS });
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendBuzz = async (req: Request, res: Response) => {
  try {
    const fromUserId = (req as any).userId || req.body.fromUserId;
    const { toUserId } = req.body;
    if (!fromUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
    if (toUserId === fromUserId) return res.status(400).json({ error: 'Cannot buzz yourself' });

    const buzz = await createBuzz(fromUserId, toUserId);
    res.json({ buzz });
  } catch (error) {
    console.error('Send buzz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBuzzInbox = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || (req.query.userId as string);
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    const incoming = await getIncomingBuzz(userId);
    const outgoing = await getOutgoingBuzz(userId);
    res.json({ incoming, outgoing });
  } catch (error) {
    console.error('Get buzz inbox error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondBuzz = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    const { buzzId, response } = req.body as { buzzId: string; response: 'yes' | 'no' | 'later' };
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!buzzId || !response) return res.status(400).json({ error: 'buzzId and response are required' });

    const uplifting = [
      'Keep your head up — the right connection is coming.',
      'Rejection is redirection. You’re doing great.',
      'Proud of you for putting yourself out there.',
      'Every “no” gets you closer to the perfect “yes”.',
      'Confidence looks good on you — keep going.',
    ];

    const status = response === 'yes' ? 'accepted' : response === 'later' ? 'later' : 'rejected';
    const responseMessage = status === 'rejected'
      ? uplifting[Math.floor(Math.random() * uplifting.length)]
      : status === 'later'
        ? 'They’re interested too — they’ll talk later.'
        : 'It’s a match — you can start chatting now!';

    const updated = await respondToBuzz(buzzId, userId, status, responseMessage);
    if (!updated) return res.status(404).json({ error: 'Buzz request not found' });

    if (status === 'accepted' || status === 'later') {
      await ensureMatchConversation(userId, updated.fromUserId);
      return res.json({ buzz: updated, openChat: true, chatUserId: updated.fromUserId });
    }

    res.json({ buzz: updated });
  } catch (error) {
    console.error('Respond buzz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};







