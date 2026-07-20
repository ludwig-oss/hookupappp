import { Request, Response } from 'express';
import {
  createBuzz,
  getBuzzesForUser,
  getSentBuzzes,
  respondToBuzz,
  getNearbyUsers,
  getVenueCounts,
  getCountsForOsmVenues,
  getComfortingMessage,
} from '../models/connections.js';
import { updateUserLocation, getUserById } from '../models/user.js';
import { ensureMatchConversation } from '../models/chat.js';
import { fetchVenuesByType } from '../utils/overpass.js';
import { sanitizeBuzzLocation } from '../utils/sanitize.js';

export const sendBuzz = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { toUserId, location } = req.body;
    if (!toUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const buzz = await createBuzz({
      fromUserId: userId,
      toUserId,
      location: sanitizeBuzzLocation(location),
    });

    res.json({ message: 'Buzz sent successfully', buzz });
  } catch (error: any) {
    console.error('Send buzz error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMyBuzzes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const receivedRaw = await getBuzzesForUser(userId);
    let sent = await getSentBuzzes(userId);

    const received = await Promise.all(
      receivedRaw.map(async (b) => {
        const fromUser = await getUserById(b.fromUserId);
        return {
          ...b,
          fromUserProfilePicture: fromUser?.profilePicture ?? null,
        };
      })
    );

    sent = sent.map((b) => (b.status === 'rejected' ? { ...b, comfortingMessageForSender: getComfortingMessage() } : b));

    res.json({ received, sent });
  } catch (error) {
    console.error('Get buzzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondBuzz = async (req: Request, res: Response) => {
  try {
    const { buzzId, response } = req.body;
    const validResponses = ['accepted', 'rejected', 'talk_later'];
    if (!buzzId || !validResponses.includes(response)) {
      return res.status(400).json({ error: 'Buzz ID and response (accepted, rejected, or talk_later) are required' });
    }

    const result = await respondToBuzz(buzzId, response);
    if (response === 'accepted' && result.buzz) {
      const userId = (req as any).userId;
      const otherId = result.buzz.fromUserId === userId ? result.buzz.toUserId : result.buzz.fromUserId;
      if (userId && otherId) {
        await ensureMatchConversation(userId, otherId);
      }
      return res.json({ ...result, openChat: true, chatUserId: otherId || result.buzz.fromUserId });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Respond to buzz error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { lat, lon, accuracy, venue, venueType } = req.body;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await updateUserLocation(userId, {
      lat,
      lon,
      accuracy: accuracy || 50,
    });

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNearby = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseInt(req.query.radius as string) || 50;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const nearby = await getNearbyUsers(userId, lat, lon, radius);
    res.json({ users: nearby });
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVenues = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseInt(req.query.radius as string) || 1000;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const venues = await getVenueCounts(userId, lat, lon, radius);
    res.json({ venues });
  } catch (error) {
    console.error('Get venue counts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getComfortingMsg = async (req: Request, res: Response) => {
  try {
    const message = getComfortingMessage();
    res.json({ message });
  } catch (error) {
    console.error('Get comforting message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const SEARCH_PLACES_RADIUS_M = 2500;
const VALID_PLACE_TYPES = ['bar', 'supermarket', 'mall', 'park', 'amusement_park', 'cinema', 'club', 'cafe', 'restaurant', 'gym', 'museum', 'library', 'theatre', 'shopping'];

/** Search real places (bar, supermarket, park, etc.) in a location; returns only counts of preferences there */
export const searchPlaces = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const q = (req.query.q as string)?.trim();
    const type = ((req.query.type as string) || '').toLowerCase();
    if (!q) return res.status(400).json({ error: 'Query q (location or place name, e.g. Berlin) is required' });

    const placeType = VALID_PLACE_TYPES.includes(type) ? type : 'bar';
    const geoUrl = `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!geoRes.ok) return res.status(502).json({ error: 'Geocoding unavailable' });
    const geoData = await geoRes.json();
    const first = Array.isArray(geoData) ? geoData[0] : null;
    if (!first || first.lat == null || first.lon == null) {
      return res.json({ places: [], message: 'Location not found. Try a different city or place name.' });
    }
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);

    const osmVenues = await fetchVenuesByType(lat, lon, SEARCH_PLACES_RADIUS_M, placeType);
    const places = await getCountsForOsmVenues(userId, osmVenues);
    const mostConcentrated = places.length > 0 ? places[0] : null;
    res.json({ places, locationName: first.display_name || q, mostConcentrated });
  } catch (error) {
    console.error('Search places error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const NOMINATIM_REVERSE = `${NOMINATIM_URL}/reverse`;
const USER_AGENT = 'ASWP/1.0 (Connections live location)';

/** Forward geocode: place name (e.g. "Berlin") -> lat, lon, displayName */
export async function forwardGeocode(req: Request, res: Response) {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) {
      return res.status(400).json({ error: 'Query q (place name) is required' });
    }
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return res.status(502).json({ error: 'Geocoding unavailable' });
    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first || first.lat == null || first.lon == null) {
      return res.json({ lat: null, lon: null, displayName: null });
    }
    res.json({
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      displayName: first.display_name || q,
    });
  } catch (error) {
    console.error('Forward geocode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const reverseGeocode = async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Geocoding service unavailable' });
    }
    const data = (await response.json()) as { address?: Record<string, string>; display_name?: string };
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const country = addr.country || '';
    const displayName = data.display_name || [city, country].filter(Boolean).join(', ') || 'Unknown';
    res.json({ city, country, displayName });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
