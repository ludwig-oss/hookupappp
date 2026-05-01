import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  city?: string;
  placeId?: string;
  placeType?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: Date | string;
  expiresAt: Date | string;
  responseMessage?: string;
}

export interface Place {
  id: string;
  name: string;
  type: 'bar' | 'gym' | 'restaurant' | 'park' | 'cafe' | 'club' | 'other';
  lat: number;
  lon: number;
  city: string;
  country: string;
  address?: string;
}

export const LOOKING_FOR_OPTIONS = ['dating', 'casual', 'friends', 'serious'] as const;
export type LookingForOption = typeof LOOKING_FOR_OPTIONS[number];

export interface UserPreference {
  userId: string;
  orientation: 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual';
  /** User can select two or more (e.g. casual and dating). Stored as array. */
  lookingFor: LookingForOption[];
  city?: string;
  lastActiveAt: Date | string;
}

const INTERESTS_PATH = join(process.cwd(), 'server', 'data', 'interests.json');
const PLACES_PATH = join(process.cwd(), 'server', 'data', 'places.json');
const PREFERENCES_PATH = join(process.cwd(), 'server', 'data', 'preferences.json');

async function readInterests(): Promise<Interest[]> {
  try {
    const data = await readFile(INTERESTS_PATH, 'utf-8');
    const interests = JSON.parse(data);
    return interests.map((i: Interest) => ({
      ...i,
      createdAt: new Date(i.createdAt),
      expiresAt: new Date(i.expiresAt),
    }));
  } catch {
    return [];
  }
}

async function writeInterests(interests: Interest[]): Promise<void> {
  await writeFile(INTERESTS_PATH, JSON.stringify(interests, null, 2));
}

async function readPlaces(): Promise<Place[]> {
  try {
    const data = await readFile(PLACES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writePlaces(places: Place[]): Promise<void> {
  await writeFile(PLACES_PATH, JSON.stringify(places, null, 2));
}

export async function readPreferences(): Promise<UserPreference[]> {
  try {
    const data = await readFile(PREFERENCES_PATH, 'utf-8');
    const prefs = JSON.parse(data);
    return prefs.map((p: UserPreference & { lookingFor?: string[] | string }) => {
      const lookingFor = Array.isArray(p.lookingFor)
        ? p.lookingFor.filter((v): v is LookingForOption => LOOKING_FOR_OPTIONS.includes(v as any))
        : typeof p.lookingFor === 'string' && LOOKING_FOR_OPTIONS.includes(p.lookingFor as any)
          ? [p.lookingFor as LookingForOption]
          : ['dating'];
      return {
        ...p,
        lookingFor: lookingFor.length ? lookingFor : ['dating'],
        lastActiveAt: new Date(p.lastActiveAt),
      };
    });
  } catch {
    return [];
  }
}

async function writePreferences(prefs: UserPreference[]): Promise<void> {
  await writeFile(PREFERENCES_PATH, JSON.stringify(prefs, null, 2));
}

export async function createInterest(interest: Omit<Interest, 'id' | 'createdAt' | 'expiresAt' | 'status'>): Promise<Interest> {
  const interests = await readInterests();
  const newInterest: Interest = {
    ...interest,
    id: Date.now().toString(),
    status: 'pending',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours to accept or decline
  };
  interests.push(newInterest);
  await writeInterests(interests);
  return newInterest;
}

export async function getInterestsForUser(userId: string): Promise<{ sent: Interest[]; received: Interest[] }> {
  const interests = await readInterests();
  const now = new Date();
  
  // Update expired interests
  const updated = interests.map(i => {
    if (i.status === 'pending' && new Date(i.expiresAt) < now) {
      return { ...i, status: 'expired' as const };
    }
    return i;
  });
  await writeInterests(updated);
  
  return {
    sent: updated.filter(i => i.fromUserId === userId),
    received: updated.filter(i => i.toUserId === userId && i.status === 'pending'),
  };
}

export async function respondToInterest(interestId: string, userId: string, response: 'accepted' | 'rejected', message?: string): Promise<Interest | null> {
  const interests = await readInterests();
  const now = new Date();
  const interest = interests.find(i => i.id === interestId && i.toUserId === userId);
  
  if (!interest || interest.status !== 'pending') {
    return null;
  }

  if (new Date(interest.expiresAt) < now) {
    interest.status = 'expired';
    await writeInterests(interests);
    return null;
  }
  
  interest.status = response;
  if (message) {
    interest.responseMessage = message;
  }
  
  await writeInterests(interests);
  return interest;
}

/** Mutual matches: users with at least one accepted interest in either direction (you accepted them or they accepted you). */
export async function getMutualMatches(userId: string): Promise<string[]> {
  const interests = await readInterests();
  const accepted = interests.filter(i => i.status === 'accepted');
  const partnerIds = new Set<string>();
  for (const i of accepted) {
    if (i.fromUserId === userId) partnerIds.add(i.toUserId);
    else if (i.toUserId === userId) partnerIds.add(i.fromUserId);
  }
  return Array.from(partnerIds);
}

export async function getUsersByCity(city: string): Promise<string[]> {
  const preferences = await readPreferences();
  const cityLower = city.toLowerCase().trim();
  // Support partial matching for better search results (e.g., "new york" matches "New York", "New York City")
  return preferences
    .filter(p => {
      if (!p.city) return false;
      const prefCityLower = p.city.toLowerCase().trim();
      // Exact match or contains the search term
      return prefCityLower === cityLower || 
             prefCityLower.includes(cityLower) || 
             cityLower.includes(prefCityLower);
    })
    .map(p => p.userId);
}

export async function setUserPreference(userId: string, preference: Partial<UserPreference>): Promise<UserPreference> {
  const prefs = await readPreferences();
  const existing = prefs.find(p => p.userId === userId);
  
  const normalizeLookingFor = (lf: string[] | string | undefined): LookingForOption[] => {
    if (Array.isArray(lf)) {
      const filtered = lf.filter((v): v is LookingForOption => LOOKING_FOR_OPTIONS.includes(v as any));
      return filtered.length ? filtered : ['dating'];
    }
    if (typeof lf === 'string' && LOOKING_FOR_OPTIONS.includes(lf as any)) return [lf as LookingForOption];
    return ['dating'];
  };

  if (existing) {
    if (preference.orientation !== undefined) existing.orientation = preference.orientation;
    if (preference.lookingFor !== undefined) existing.lookingFor = normalizeLookingFor(preference.lookingFor as any);
    if (preference.city !== undefined) existing.city = preference.city;
    existing.lastActiveAt = new Date();
    await writePreferences(prefs);
    return existing;
  } else {
    const newPref: UserPreference = {
      userId,
      orientation: preference.orientation || 'straight',
      lookingFor: normalizeLookingFor(preference.lookingFor as any),
      city: preference.city,
      lastActiveAt: new Date(),
    };
    prefs.push(newPref);
    await writePreferences(prefs);
    return newPref;
  }
}

export async function getUserPreference(userId: string): Promise<UserPreference | null> {
  const prefs = await readPreferences();
  return prefs.find(p => p.userId === userId) || null;
}

export async function getPlacesNearby(lat: number, lon: number, radiusMeters: number = 1000, type?: Place['type']): Promise<Place[]> {
  const places = await readPlaces();
  const filtered = type ? places.filter(p => p.type === type) : places;
  
  return filtered.filter(place => {
    const distance = haversineMeters(lat, lon, place.lat, place.lon);
    return distance <= radiusMeters;
  });
}

export async function addPlace(place: Omit<Place, 'id'>): Promise<Place> {
  const places = await readPlaces();
  const newPlace: Place = {
    ...place,
    id: Date.now().toString(),
  };
  places.push(newPlace);
  await writePlaces(places);
  return newPlace;
}

export interface VideoVerification {
  id: string;
  fromUserId: string;
  toUserId: string;
  interestId: string;
  status: 'pending' | 'completed' | 'rejected';
  videoUrl?: string;
  requestedAt: Date | string;
  completedAt?: Date | string;
}

const VERIFICATIONS_PATH = join(process.cwd(), 'server', 'data', 'verifications.json');

async function readVerifications(): Promise<VideoVerification[]> {
  try {
    const data = await readFile(VERIFICATIONS_PATH, 'utf-8');
    const verifications = JSON.parse(data);
    return verifications.map((v: VideoVerification) => ({
      ...v,
      requestedAt: new Date(v.requestedAt),
      completedAt: v.completedAt ? new Date(v.completedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

async function writeVerifications(verifications: VideoVerification[]): Promise<void> {
  await writeFile(VERIFICATIONS_PATH, JSON.stringify(verifications, null, 2));
}

export async function createVerificationRequest(interestId: string, fromUserId: string, toUserId: string): Promise<VideoVerification> {
  const verifications = await readVerifications();
  const newVerification: VideoVerification = {
    id: Date.now().toString(),
    fromUserId,
    toUserId,
    interestId,
    status: 'pending',
    requestedAt: new Date(),
  };
  verifications.push(newVerification);
  await writeVerifications(verifications);
  return newVerification;
}

export async function getVerificationRequests(userId: string): Promise<VideoVerification[]> {
  const verifications = await readVerifications();
  return verifications.filter(v => v.toUserId === userId && v.status === 'pending');
}

export async function completeVerification(verificationId: string, userId: string, videoUrl: string): Promise<VideoVerification | null> {
  const verifications = await readVerifications();
  const verification = verifications.find(v => v.id === verificationId && v.toUserId === userId);
  
  if (!verification || verification.status !== 'pending') {
    return null;
  }
  
  verification.status = 'completed';
  verification.videoUrl = videoUrl;
  verification.completedAt = new Date();
  
  await writeVerifications(verifications);
  return verification;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
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

