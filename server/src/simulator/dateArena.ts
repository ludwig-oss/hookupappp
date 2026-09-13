import { isSimulatorEnabled, isSimulatorUserId, getSimulatorUsers } from './runtime.js';
import type { User } from '../models/user.js';
import { genderBucket, areOrientationCompatible } from '../utils/orientationMatch.js';
import { getUserPreference } from '../models/discover.js';

function norm(s?: string | null): string {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function overlapLooking(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return true;
  return a.some((x) => b.includes(x));
}

/**
 * Pick a simulator mock for Date Arena when the live queue is empty.
 * Relocates the mock into the seeker's city/country so "My city only" works in local tests.
 */
export async function pickSimulatorDatePartner(params: {
  seekerId: string;
  lookingFor: string[];
  cityScope: 'city' | 'country';
  seeker: Pick<User, 'city' | 'country' | 'gender' | 'blockedUsers' | 'unmatchedUsers'>;
}): Promise<User | null> {
  if (!isSimulatorEnabled()) return null;
  const mocks = getSimulatorUsers().filter((m) => m.id !== params.seekerId && !isSimulatorUserId(params.seekerId));
  if (!mocks.length) return null;

  const blocked = new Set([
    ...(params.seeker.blockedUsers || []),
    ...(params.seeker.unmatchedUsers || []),
  ]);

  const seekerPref = await getUserPreference(params.seekerId);
  const orientation = seekerPref?.orientation || 'straight';

  const pool: typeof mocks = [];
  for (const m of mocks) {
    if (blocked.has(m.id)) continue;
    if ((m.blockedUsers || []).includes(params.seekerId)) continue;
    const looking = (m as { dateLookingFor?: string[] }).dateLookingFor || [];
    if (!overlapLooking(params.lookingFor, looking)) continue;
    const mockPref = await getUserPreference(m.id);
    if (
      !areOrientationCompatible({
        aOrientation: orientation,
        aGender: params.seeker.gender,
        bOrientation: mockPref?.orientation || 'straight',
        bGender: m.gender,
      })
    ) {
      continue;
    }
    pool.push(m);
  }

  if (!pool.length) return null;

  // Prefer opposite gender first for straight seekers
  const me = genderBucket(params.seeker.gender);
  let ranked = [...pool];
  if (me === 'male') {
    ranked.sort((a, b) => (genderBucket(a.gender) === 'female' ? -1 : 1) - (genderBucket(b.gender) === 'female' ? -1 : 1));
  } else if (me === 'female') {
    ranked.sort((a, b) => (genderBucket(a.gender) === 'male' ? -1 : 1) - (genderBucket(b.gender) === 'male' ? -1 : 1));
  }

  const pick = ranked[Math.floor(Math.random() * Math.min(5, ranked.length))] || ranked[0];
  if (!pick) return null;

  // Place them where the seeker is searching so location filters pass
  const displayCountry = params.seeker.country?.trim() || 'Germany';
  const displayCity = params.seeker.city?.trim() || 'Berlin';
  return {
    ...pick,
    country: displayCountry,
    city: params.cityScope === 'city' ? displayCity : pick.city || displayCity,
    location: pick.location
      ? {
          ...pick.location,
          lat: (pick.location.lat || 52.52) + (Math.random() - 0.5) * 0.02,
          lon: (pick.location.lon || 13.4) + (Math.random() - 0.5) * 0.02,
          updatedAt: new Date(),
        }
      : pick.location,
  };
}

/** Suggest country/city for Date Arena when Profile is blank (simulator / local only). */
export function suggestSimGeoFallback(user: Pick<User, 'country' | 'city' | 'location'>): {
  country: string;
  city: string;
} | null {
  if (!isSimulatorEnabled()) return null;
  if (norm(user.country) && norm(user.city)) return null;
  return {
    country: user.country?.trim() || 'Germany',
    city: user.city?.trim() || 'Berlin',
  };
}
