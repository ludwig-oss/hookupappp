import type { UserPreference } from '../models/discover.js';

type Gender = 'male' | 'female' | 'other' | null;

function normGender(g?: string | null): Gender {
  if (!g) return null;
  const x = String(g).toLowerCase().trim();
  if (x === 'male' || x === 'm' || x === 'man') return 'male';
  if (x === 'female' || x === 'f' || x === 'woman') return 'female';
  return 'other';
}

function isAttractedTo(orientation: string, selfGender: Gender, otherGender: Gender): boolean {
  if (!selfGender || !otherGender || selfGender === 'other' || otherGender === 'other') return true;

  if (orientation === 'pansexual' || orientation === 'bisexual') return true;
  if (orientation === 'gay') return selfGender === 'male' && otherGender === 'male';
  if (orientation === 'lesbian') return selfGender === 'female' && otherGender === 'female';
  if (orientation === 'straight') return selfGender !== otherGender;
  return false;
}

/** Mutual preference match (straight M↔F, gay M↔M, lesbian F↔F, bi/pan with anyone). */
export function usersMatchPreferences(
  viewer: { gender?: string | null },
  other: { gender?: string | null },
  viewerPref: UserPreference | null,
  otherPref: UserPreference | null
): boolean {
  if (!viewerPref?.orientation || !otherPref?.orientation) return true;

  const vg = normGender(viewer.gender);
  const og = normGender(other.gender);
  const vo = viewerPref.orientation;
  const oo = otherPref.orientation;

  return isAttractedTo(vo, vg, og) && isAttractedTo(oo, og, vg);
}
