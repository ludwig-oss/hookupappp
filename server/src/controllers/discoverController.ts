import { Request, Response } from 'express';
import {
  createInterest,
  getInterestsForUser,
  respondToInterest,
  getMutualMatches,
  getUsersByCity,
  setUserPreference,
  getUserPreference,
  getPlacesNearby,
  addPlace,
} from '../models/discover.js';
import { notifyNewMatch, notifyNewInterest } from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';
import { getAllUsers, getUserById } from '../models/user.js';
import { getUserSettings } from '../models/settings.js';
import { maskUserForViewer } from '../lib/celebMask.js';
import { sanitizeForStorage, sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';
import { ensureMatchConversation } from '../models/chat.js';

export async function getAllCities(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { readPreferences, getUserPreference } = await import('../models/discover.js');
    const preferences = await readPreferences();
    const users = await getAllUsers();
    
    // Get all unique cities with active users
    const cityMap = new Map<string, { count: number; users: any[] }>();
    
    for (const pref of preferences) {
      if (pref.city) {
        const cityLower = pref.city.toLowerCase().trim();
        if (!cityMap.has(cityLower)) {
          const user = users.find(u => u.id === pref.userId);
          if (user) {
            cityMap.set(cityLower, {
              count: 1,
              users: [{
                id: user.id,
                name: user.name,
                username: user.username,
                profilePicture: user.profilePicture,
              }]
            });
          }
        } else {
          const existing = cityMap.get(cityLower)!;
          const user = users.find(u => u.id === pref.userId);
          if (user) {
            existing.count++;
            existing.users.push({
              id: user.id,
              name: user.name,
              username: user.username,
              profilePicture: user.profilePicture,
            });
          }
        }
      }
    }

    // Convert to array
    const userPref = userId ? await getUserPreference(userId) : null;
    const cities = Array.from(cityMap.entries()).map(([city, data]) => {
      // Count active users in this city
      const activeUsers = data.users.filter(u => {
        const user = users.find(usr => usr.id === u.id);
        return user && user.location && 
          new Date(user.location.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000; // Active in last 24 hours
      });

      return {
        city: city.charAt(0).toUpperCase() + city.slice(1),
        userCount: data.count,
        hasActiveUsers: activeUsers.length > 0,
      };
    }).sort((a, b) => b.userCount - a.userCount);

    res.json({ cities });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function searchByCity(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { city } = req.query;
    if (!city || typeof city !== 'string') {
      return res.status(400).json({ error: 'City name is required' });
    }

    // Normalize city name (trim and lowercase for matching)
    const cityNormalized = city.trim().toLowerCase();
    
    // Try to find users in this city
    const userPref = await getUserPreference(userId);
    const userIds = await getUsersByCity(cityNormalized);
    const users = await getAllUsers();
    
    // Filter by user preferences (masked user shape for response)
    let cityUsers: Array<ReturnType<typeof maskUserForViewer> & { preference?: any }> = users.filter(u => userIds.includes(u.id)).map(u => {
      const base = { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture ?? null, publicFigureVerified: !!(u.publicFigureVerified), revealToUserIds: u.revealToUserIds || [] };
      return maskUserForViewer(base, userId);
    });
    
    if (userPref) {
      // Filter by orientation/preference matching (re-fetch full users for preference check)
      const fullCityUsers = users.filter(u => userIds.includes(u.id));
      const matchingUsers = await Promise.all(
        fullCityUsers.map(async (u) => {
          const otherPref = await getUserPreference(u.id);
          if (!otherPref) return null;
          if (matchesPreference(userPref, otherPref)) {
            const base = { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture ?? null, publicFigureVerified: !!(u.publicFigureVerified), revealToUserIds: u.revealToUserIds || [] };
            return maskUserForViewer(base, userId);
          }
          return null;
        })
      );
      cityUsers = matchingUsers.filter((u): u is NonNullable<typeof u> => u !== null);
    }

    // Always return success, even if no users found
    // This allows searching for any city worldwide
    res.json({ 
      users: cityUsers, 
      city: city.trim(),
      hasUsers: cityUsers.length > 0,
      message: cityUsers.length === 0 ? `No users found in ${city.trim()} yet. Be the first!` : undefined
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function showInterest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { toUserId, city, placeId, placeType } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'toUserId is required' });
    }

    const interest = await createInterest({
      fromUserId: userId,
      toUserId,
      city: city != null ? sanitizeForStorage(city, LIMITS.CITY) : undefined,
      placeId: placeId != null ? sanitizeForStorage(placeId, 80) : undefined,
      placeType: placeType != null ? sanitizeForStorage(placeType, LIMITS.SHORT_LABEL) : undefined,
    });

    notifyNewInterest(toUserId, { fromUserId: userId, interestId: interest.id });

    try {
      const toSettings = await getUserSettings(toUserId);
      const fromUser = await getUserById(userId);
      if (toSettings.notifications.push && toSettings.notifications.interestAlerts) {
        const vibrateOn = toSettings.notifications.interestVibrate !== false;
        await sendPushToUser(toUserId, {
          title: 'Someone is interested in you',
          body: fromUser
            ? `${fromUser.name} sent you an interest — you have 24 hours to respond`
            : 'Open the app to accept or decline (24 hours)',
          data: {
            type: 'new_interest',
            interestId: interest.id,
            fromUserId: userId,
            vibrate: vibrateOn ? '1' : '0',
          },
        });
      }
    } catch {
      /* push optional */
    }

    res.json({ interest });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMyInterests(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const interests = await getInterestsForUser(userId);
    res.json(interests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMatches(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const partnerIds = await getMutualMatches(userId);
    const users = await getAllUsers();
    const matches = partnerIds.map((id) => {
      const u = users.find((x) => x.id === id);
      if (!u) return null;
      const base = { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture ?? null, publicFigureVerified: !!(u.publicFigureVerified), revealToUserIds: (u as any).revealToUserIds || [] };
      return maskUserForViewer(base, userId);
    }).filter(Boolean);
    res.json({ matches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function respondInterest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { interestId, response, message } = req.body;

    if (!interestId || !response) {
      return res.status(400).json({ error: 'interestId and response are required' });
    }

    const safeMessage = message != null ? sanitizeMessageContent(message, 500) : undefined;
    const interest = await respondToInterest(interestId, userId, response, safeMessage);

    if (!interest) {
      return res.status(404).json({ error: 'Interest not found, already handled, or expired (24h)' });
    }

    if (response === 'accepted') {
      notifyNewMatch(interest.fromUserId, { fromUserId: userId, interestId: interest.id });
      const accepter = await getUserById(userId);
      sendPushToUser(interest.fromUserId, {
        title: 'New match!',
        body: accepter ? `${accepter.name} accepted your interest` : 'Someone accepted your interest',
        data: { fromUserId: userId, interestId: interest.id },
      }).catch(() => {});
    }

    // If accepted, seed chat thread so both appear in Communications
    if (response === 'accepted') {
      await ensureMatchConversation(userId, interest.fromUserId);
      res.json({ interest, openChat: true, chatUserId: interest.fromUserId });
    } else {
      res.json({ interest });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function setPreference(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { orientation, lookingFor, city } = req.body;

    const orientations = ['straight', 'gay', 'lesbian', 'bisexual', 'pansexual'] as const;
    const safeOrientation =
      typeof orientation === 'string' && orientations.includes(orientation as (typeof orientations)[number])
        ? (orientation as (typeof orientations)[number])
        : undefined;
    const lookingOptions = ['dating', 'casual', 'friends', 'serious'] as const;
    const safeLookingFor = Array.isArray(lookingFor)
      ? lookingFor.filter((v): v is (typeof lookingOptions)[number] =>
          typeof v === 'string' && lookingOptions.includes(v as (typeof lookingOptions)[number])
        )
      : undefined;

    const preference = await setUserPreference(userId, {
      ...(safeOrientation ? { orientation: safeOrientation } : {}),
      ...(safeLookingFor?.length ? { lookingFor: safeLookingFor } : {}),
      city: sanitizeForStorage(city, LIMITS.CITY) || undefined,
    });

    res.json({ preference });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMyPreference(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const preference = await getUserPreference(userId);
    res.json({ preference });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function searchPlaces(req: Request, res: Response) {
  try {
    const { lat, lon, radius, type } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const places = await getPlacesNearby(
      Number(lat),
      Number(lon),
      radius ? Number(radius) : 1000,
      type as any
    );

    res.json({ places });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPlaceUsers(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const { placeId } = req.params;
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    const userPref = await getUserPreference(userId);
    if (!userPref) {
      return res.status(400).json({ error: 'User preferences not set' });
    }

    // Get users within 50m of place
    const users = await getAllUsers();
    const place = (await getPlacesNearby(Number(lat), Number(lon), 50)).find(p => p.id === placeId);
    
    if (!place) {
      return res.json({ users: [], count: 0 });
    }

    const nearbyUsers = users.filter(u => {
      if (!u.location) return false;
      const distance = haversineMeters(place.lat, place.lon, u.location.lat, u.location.lon);
      return distance <= 50;
    });

    // Filter by orientation/preference
    const matchingUsers = await Promise.all(
      nearbyUsers.map(async (u) => {
        const pref = await getUserPreference(u.id);
        if (!pref) return null;
        if (matchesPreference(userPref, pref)) {
          const base = { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture ?? null, publicFigureVerified: !!(u.publicFigureVerified), revealToUserIds: u.revealToUserIds || [] };
          return { ...maskUserForViewer(base, userId), preference: pref };
        }
        return null;
      })
    );

    const filtered = matchingUsers.filter(u => u !== null) as any;

    res.json({ users: filtered, count: filtered.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function matchesPreference(user1: any, user2: any): boolean {
  // Match based on orientation
  if (user1.orientation === 'straight' && user2.orientation === 'straight') {
    return true; // Would need gender check in real app
  }
  if (user1.orientation === 'gay' && user2.orientation === 'gay') {
    return true;
  }
  if (user1.orientation === 'lesbian' && user2.orientation === 'lesbian') {
    return true;
  }
  if (user1.orientation === 'bisexual' || user2.orientation === 'bisexual') {
    return true; // Bisexual matches with anyone
  }
  if (user1.orientation === 'pansexual' || user2.orientation === 'pansexual') {
    return true; // Pansexual matches with anyone
  }
  return false;
}

