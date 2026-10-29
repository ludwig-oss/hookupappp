import type { UserPreference } from '../models/discover.js';
import { areOrientationCompatible } from './orientationMatch.js';

/** Mutual preference match (straight M↔F, gay M↔M, lesbian F↔F, bi/pan with anyone). */
export function usersMatchPreferences(
  viewer: { gender?: string | null },
  other: { gender?: string | null },
  viewerPref: UserPreference | null,
  otherPref: UserPreference | null
): boolean {
  if (!viewerPref?.orientation || !otherPref?.orientation) return false;

  return areOrientationCompatible({
    aOrientation: viewerPref.orientation,
    aGender: viewer.gender,
    bOrientation: otherPref.orientation,
    bGender: other.gender,
  });
}
