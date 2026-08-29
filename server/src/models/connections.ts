import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getUserById, getAllUsers } from './user.js';
import { getUserPreference } from './discover.js';
import { fetchNearbyVenues, fetchVenuesByType, OsmVenue } from '../utils/overpass.js';

export type BuzzStatus = 'pending' | 'accepted' | 'rejected' | 'talk_later';

export interface Buzz {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: BuzzStatus;
  createdAt: Date | string;
  respondedAt?: Date | string | null;
  location?: {
    lat: number;
    lon: number;
    venue?: string;
    venueType?: string;
  };
}

export interface VenueCount {
  venue: string;
  venueType: string;
  location: { lat: number; lon: number };
  count: number;
  users: Array<{
    id: string;
    profilePicture: string | null;
    name: string;
  }>;
}

export interface NearbyUser {
  id: string;
  name: string;
  profilePicture: string | null;
  distance: number; // in meters
  location: { lat: number; lon: number };
  orientation?: string;
  isOnline: boolean;
  lastActiveAt: Date | string;
}

const BUZZES_PATH = join(process.cwd(), 'server', 'data', 'buzzes.json');
const COMFORTING_MESSAGES = [
  "Your vibe attracts your tribe. Keep being you! ✨",
  "The right connection is worth waiting for. Your energy is magnetic! 💫",
  "Rejection is just redirection. Better things are coming your way! 🌟",
  "You're a catch, and the right person will see that. Stay positive! 💖",
  "Every 'no' brings you closer to your 'yes'. Keep shining! ⭐",
  "Your confidence is your superpower. Someone amazing will notice! 🦸",
  "The best connections happen when you least expect them. Stay open! 🌈",
  "You're too good to be someone's second choice. Keep moving forward! 🚀",
  "Your authentic self is your best self. The right match will appreciate that! 💎",
  "Timing is everything. Your perfect connection is on its way! ⏰",
  "You're not for everyone, and that's your superpower. Stay true! 🎯",
  "The universe is aligning something special for you. Trust the process! 🌌",
  "Your energy is too good to waste on the wrong connections. Keep going! ⚡",
  "Every closed door opens a better one. Stay optimistic! 🚪",
  "You're magnetic, and the right person will be drawn to you naturally! 🧲",
  "Your worth isn't determined by one person's choice. You're amazing! 💪",
  "The best is yet to come. Keep your heart open! ❤️",
  "You're a rare gem. The right person will recognize your value! 💎",
  "Stay positive! Your vibe attracts your tribe, and they're out there! 🌟",
  "Rejection is protection. Something better is waiting for you! 🛡️",
  "Your confidence is contagious. Keep being authentically you! 😊",
  "The right connection will appreciate everything about you. Stay patient! ⏳",
  "You're too amazing to settle. Keep your standards high! 👑",
  "Every experience teaches you something. You're growing beautifully! 🌱",
  "Your energy is powerful. The right person will match it perfectly! ⚡",
  "Stay true to yourself. Authenticity attracts authenticity! 🎭",
  "You're on your own timeline. The best connections happen naturally! 📅",
  "Your light is too bright to be dimmed. Keep shining! 💡",
  "The universe has your back. Trust that everything is working out! 🌠",
  "You're exactly where you need to be. Great things are coming! 🎁"
];

async function readBuzzes(): Promise<Buzz[]> {
  try {
    const data = await readFile(BUZZES_PATH, 'utf-8');
    return JSON.parse(data).map((buzz: Buzz) => ({
      ...buzz,
      createdAt: new Date(buzz.createdAt),
      respondedAt: buzz.respondedAt ? new Date(buzz.respondedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function writeBuzzes(buzzes: Buzz[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(BUZZES_PATH, JSON.stringify(buzzes, null, 2));
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function createBuzz(buzzData: Omit<Buzz, 'id' | 'status' | 'createdAt' | 'respondedAt'>): Promise<Buzz> {
  const buzzes = await readBuzzes();
  
  // Check if buzz already exists
  const existing = buzzes.find(
    b => b.fromUserId === buzzData.fromUserId && 
    b.toUserId === buzzData.toUserId && 
    b.status === 'pending'
  );
  if (existing) {
    throw new Error('Buzz already sent to this user');
  }

  const buzz: Buzz = {
    ...buzzData,
    id: Date.now().toString(),
    status: 'pending',
    createdAt: new Date(),
  };
  buzzes.push(buzz);
  await writeBuzzes(buzzes);
  return buzz;
}

export async function getBuzzesForUser(userId: string): Promise<Buzz[]> {
  const buzzes = await readBuzzes();
  return buzzes.filter(b => b.toUserId === userId && b.status === 'pending');
}

export async function getSentBuzzes(userId: string): Promise<Buzz[]> {
  const buzzes = await readBuzzes();
  return buzzes.filter(b => b.fromUserId === userId);
}

export type RespondBuzzResponse = 'accepted' | 'rejected' | 'talk_later';

export async function respondToBuzz(buzzId: string, response: RespondBuzzResponse): Promise<{ buzz: Buzz; comfortingMessage?: string }> {
  const buzzes = await readBuzzes();
  const buzz = buzzes.find(b => b.id === buzzId);
  if (!buzz) {
    throw new Error('Buzz not found');
  }

  buzz.status = response === 'rejected' ? 'rejected' : response === 'talk_later' ? 'talk_later' : 'accepted';
  buzz.respondedAt = new Date();
  await writeBuzzes(buzzes);

  let comfortingMessage: string | undefined;
  if (response === 'rejected') {
    const randomIndex = Math.floor(Math.random() * COMFORTING_MESSAGES.length);
    comfortingMessage = COMFORTING_MESSAGES[randomIndex];
  }

  return { buzz, comfortingMessage };
}

/** If they already sent you a pending buzz, accept both sides (mutual interest). */
export async function tryMutualBuzzMatch(
  fromUserId: string,
  toUserId: string
): Promise<{ matched: boolean; chatUserId?: string }> {
  const buzzes = await readBuzzes();
  const reverse = buzzes.find(
    (b) => b.fromUserId === toUserId && b.toUserId === fromUserId && b.status === 'pending'
  );
  if (!reverse) return { matched: false };

  reverse.status = 'accepted';
  reverse.respondedAt = new Date();
  const forward = buzzes.find(
    (b) => b.fromUserId === fromUserId && b.toUserId === toUserId && b.status === 'pending'
  );
  if (forward) {
    forward.status = 'accepted';
    forward.respondedAt = new Date();
  }
  await writeBuzzes(buzzes);
  return { matched: true, chatUserId: toUserId };
}

export async function getNearbyUsers(
  userId: string,
  lat: number,
  lon: number,
  radius: number = 50
): Promise<NearbyUser[]> {
  const users = await getAllUsers();
  const user = await getUserById(userId);
  if (!user) return [];

  const userPref = await getUserPreference(userId);
  const nearby: NearbyUser[] = [];

  for (const otherUser of users) {
    if (otherUser.id === userId) continue;
    if (user.blockedUsers?.includes(otherUser.id)) continue;
    if (user.unmatchedUsers?.includes(otherUser.id)) continue;
    if (!otherUser.location) continue;

    const distance = calculateDistance(
      lat, lon,
      otherUser.location.lat, otherUser.location.lon
    );

    if (distance <= radius) {
      const otherPref = await getUserPreference(otherUser.id);
      
      // Check orientation compatibility - if no preference set, show all
      if (userPref && otherPref) {
        const compatible = matchesOrientation(userPref.orientation, otherPref.orientation);
        if (!compatible) continue;
      }

      const lastActive = otherUser.location.updatedAt 
        ? new Date(otherUser.location.updatedAt).getTime()
        : 0;
      const isOnline = Date.now() - lastActive < 5 * 60 * 1000; // 5 minutes

      nearby.push({
        id: otherUser.id,
        name: otherUser.name,
        profilePicture: otherUser.profilePicture,
        distance: Math.round(distance),
        location: { lat: otherUser.location.lat, lon: otherUser.location.lon },
        orientation: otherPref?.orientation,
        isOnline,
        lastActiveAt: otherUser.location.updatedAt || new Date(),
      });
    }
  }

  return nearby.sort((a, b) => a.distance - b.distance);
}

function matchesOrientation(orientation1: string, orientation2: string): boolean {
  if (orientation1 === 'bisexual' || orientation1 === 'pansexual') return true;
  if (orientation2 === 'bisexual' || orientation2 === 'pansexual') return true;
  if (orientation1 === orientation2) return true;
  if (orientation1 === 'gay' && orientation2 === 'gay') return true;
  if (orientation1 === 'lesbian' && orientation2 === 'lesbian') return true;
  if (orientation1 === 'straight' && orientation2 === 'straight') return true;
  return false;
}

/** Radius in meters around a real-world venue to count app users as "at" that venue */
const VENUE_USER_RADIUS_M = 150;

export async function getVenueCounts(
  userId: string,
  lat: number,
  lon: number,
  radius: number = 1000
): Promise<VenueCount[]> {
  const user = await getUserById(userId);
  if (!user) return [];

  const userPref = await getUserPreference(userId);
  if (!userPref) return [];

  // Fetch real-world venues from OpenStreetMap (worldwide, live)
  const osmVenues = await fetchNearbyVenues(lat, lon, radius);
  const allUsers = await getAllUsers();

  const result: VenueCount[] = [];

  for (const poi of osmVenues) {
    const usersAtVenue: Array<{ id: string; profilePicture: string | null; name: string }> = [];

    for (const otherUser of allUsers) {
      if (otherUser.id === userId) continue;
      if (user.blockedUsers?.includes(otherUser.id)) continue;
      if (!otherUser.location) continue;

      const distance = calculateDistance(
        poi.lat, poi.lon,
        otherUser.location.lat, otherUser.location.lon
      );
      if (distance > VENUE_USER_RADIUS_M) continue;

      const otherPref = await getUserPreference(otherUser.id);
      if (!otherPref) continue;
      if (!matchesOrientation(userPref.orientation, otherPref.orientation)) continue;

      usersAtVenue.push({
        id: otherUser.id,
        profilePicture: otherUser.profilePicture,
        name: otherUser.name,
      });
    }

    result.push({
      venue: poi.name,
      venueType: poi.venueType,
      location: { lat: poi.lat, lon: poi.lon },
      count: usersAtVenue.length,
      users: usersAtVenue,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

/** Return only venue name, type, location and count (no user list). For search-places. */
export interface VenueCountOnly {
  venue: string;
  venueType: string;
  location: { lat: number; lon: number };
  count: number;
}

export async function getCountsForOsmVenues(
  userId: string,
  osmVenues: OsmVenue[]
): Promise<VenueCountOnly[]> {
  const user = await getUserById(userId);
  if (!user) return [];
  const userPref = await getUserPreference(userId);
  if (!userPref) return [];
  const allUsers = await getAllUsers();
  const result: VenueCountOnly[] = [];

  for (const poi of osmVenues) {
    let count = 0;
    for (const otherUser of allUsers) {
      if (otherUser.id === userId) continue;
      if (user.blockedUsers?.includes(otherUser.id)) continue;
      if (!otherUser.location) continue;
      const distance = calculateDistance(poi.lat, poi.lon, otherUser.location.lat, otherUser.location.lon);
      if (distance > VENUE_USER_RADIUS_M) continue;
      const otherPref = await getUserPreference(otherUser.id);
      if (!otherPref) continue;
      if (!matchesOrientation(userPref.orientation, otherPref.orientation)) continue;
      count++;
    }
    result.push({
      venue: poi.name,
      venueType: poi.venueType,
      location: { lat: poi.lat, lon: poi.lon },
      count,
    });
  }
  return result.sort((a, b) => b.count - a.count);
}

export function getComfortingMessage(): string {
  const randomIndex = Math.floor(Math.random() * COMFORTING_MESSAGES.length);
  return COMFORTING_MESSAGES[randomIndex];
}
