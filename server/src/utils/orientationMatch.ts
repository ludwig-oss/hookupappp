/**
 * Mutual orientation + gender matching for discover, simulator, and dating surfaces.
 */

export type GenderBucket = 'male' | 'female' | 'other';

export function genderBucket(gender?: string | null): GenderBucket {
  const g = String(gender || '')
    .toLowerCase()
    .trim();
  if (!g) return 'other';
  // Check woman/female first — "woman" contains "man"
  if (
    g === 'f' ||
    g === 'female' ||
    g === 'woman' ||
    g === 'women' ||
    g === 'girl' ||
    g.startsWith('fem') ||
    g.includes('woman')
  ) {
    return 'female';
  }
  if (
    g === 'm' ||
    g === 'male' ||
    g === 'man' ||
    g === 'men' ||
    g === 'boy' ||
    g.startsWith('masc') ||
    (g.includes('male') && !g.includes('female'))
  ) {
    return 'male';
  }
  return 'other';
}

/** Who this person is generally open to dating, based on orientation + their gender. */
export function seeksBuckets(
  orientation: string | null | undefined,
  gender: string | null | undefined
): GenderBucket[] | 'any' {
  const ori = String(orientation || 'straight').toLowerCase().trim();
  const me = genderBucket(gender);

  if (ori === 'pansexual' || ori === 'bisexual' || ori === 'bi') return 'any';

  if (ori === 'straight') {
    if (me === 'male') return ['female'];
    if (me === 'female') return ['male'];
    return 'any';
  }
  if (ori === 'gay') {
    if (me === 'male') return ['male'];
    // Mis-tagged profiles: still treat as seeking men
    return ['male'];
  }
  if (ori === 'lesbian') {
    if (me === 'female') return ['female'];
    return ['female'];
  }
  return 'any';
}

function attractedTo(
  orientation: string | null | undefined,
  myGender: string | null | undefined,
  theirGender: string | null | undefined
): boolean {
  const want = seeksBuckets(orientation, myGender);
  const them = genderBucket(theirGender);
  if (want === 'any') return true;
  if (them === 'other') return false;
  return want.includes(them);
}

/**
 * Mutual match: both sides must be open to the other's gender given orientation.
 * Example: straight man + straight woman ✓; straight man + straight man ✗.
 */
export function areOrientationCompatible(opts: {
  aOrientation?: string | null;
  aGender?: string | null;
  bOrientation?: string | null;
  bGender?: string | null;
}): boolean {
  return (
    attractedTo(opts.aOrientation, opts.aGender, opts.bGender) &&
    attractedTo(opts.bOrientation, opts.bGender, opts.aGender)
  );
}

/** Preferable pool for simulator outreach to a real user (mutual orientation + gender). */
export function filterCompatiblePeople<T extends { gender?: string | null }>(
  people: T[],
  viewer: { gender?: string | null; orientation?: string | null },
  otherOrientation: (person: T) => string | null | undefined
): T[] {
  return people.filter((p) =>
    areOrientationCompatible({
      aOrientation: viewer.orientation || 'straight',
      aGender: viewer.gender,
      bOrientation: otherOrientation(p) || 'straight',
      bGender: p.gender,
    })
  );
}
