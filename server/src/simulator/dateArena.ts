import { isSimulatorEnabled, isSimulatorUserId, getSimulatorUsers } from './runtime.js';
import type { User } from '../models/user.js';

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
export function pickSimulatorDatePartner(params: {
  seekerId: string;
  lookingFor: string[];
  cityScope: 'city' | 'country';
  seeker: Pick<User, 'city' | 'country' | 'gender' | 'blockedUsers' | 'unmatchedUsers'>;
}): User | null {
  if (!isSimulatorEnabled()) return null;
  const mocks = getSimulatorUsers().filter((m) => m.id !== params.seekerId && !isSimulatorUserId(params.seekerId));
  if (!mocks.length) return null;

  const blocked = new Set([
    ...(params.seeker.blockedUsers || []),
    ...(params.seeker.unmatchedUsers || []),
  ]);

  const country = norm(params.seeker.country) || 'germany';
  const city = norm(params.seeker.city) || 'berlin';

  const pool = mocks.filter((m) => {
    if (blocked.has(m.id)) return false;
    if ((m.blockedUsers || []).includes(params.seekerId)) return false;
    const looking = (m as { dateLookingFor?: string[] }).dateLookingFor || [];
    return overlapLooking(params.lookingFor, looking);
  });

  if (!pool.length) return null;

  // Prefer opposite gender when seeker gender is known (straight-ish default for testing)
  const g = norm(params.seeker.gender);
  let ranked = [...pool];
  if (g.startsWith('m')) {
    ranked.sort((a, b) => (norm(a.gender).startsWith('f') ? -1 : 1) - (norm(b.gender).startsWith('f') ? -1 : 1));
  } else if (g.startsWith('f')) {
    ranked.sort((a, b) => (norm(a.gender).startsWith('m') ? -1 : 1) - (norm(b.gender).startsWith('m') ? -1 : 1));
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
