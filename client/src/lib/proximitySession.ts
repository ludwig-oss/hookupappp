/** Proximity popups (walk nearby, incoming interest) — never show the same person again after you act. */

const PERMANENT_PREFIX = 'proximity:permanent:';

function permanentKey(kind: string, otherUserId: string): string {
  return `${PERMANENT_PREFIX}${kind}:${otherUserId}`;
}

/** True if we may show the banner for this user encounter. */
export function shouldShowProximityBanner(
  kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming',
  otherUserId: string
): boolean {
  if (!otherUserId) return true;
  try {
    if (localStorage.getItem(permanentKey(kind, otherUserId)) === '1') return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Mark this person as handled — they will not pop up again. */
export function markProximityBannerShown(
  kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming',
  otherUserId: string
): void {
  if (!otherUserId) return;
  try {
    localStorage.setItem(permanentKey(kind, otherUserId), '1');
  } catch {
    /* ignore */
  }
}
