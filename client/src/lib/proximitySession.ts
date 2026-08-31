/** Proximity popups (walk nearby, incoming interest) — never show the same person again after you act. */

const PERMANENT_PREFIX = 'proximity:permanent:';

function permanentKey(kind: string, otherUserId: string): string {
  return `${PERMANENT_PREFIX}${kind}:${otherUserId}`;
}

/** True if we may show the banner for this user encounter. */
export function shouldShowProximityBanner(
  kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming' | 'nearby-match',
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

const CONNECTIONS_START_KEY = 'hookup:connectionsStartView';

export function setConnectionsStartView(view: 'nearby' | 'buzzes'): void {
  try {
    sessionStorage.setItem(CONNECTIONS_START_KEY, view);
  } catch {
    /* ignore */
  }
}

export function takeConnectionsStartView(): 'nearby' | 'buzzes' | null {
  try {
    const v = sessionStorage.getItem(CONNECTIONS_START_KEY);
    sessionStorage.removeItem(CONNECTIONS_START_KEY);
    if (v === 'nearby' || v === 'buzzes') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Mark this person as handled — they will not pop up again. */
export function markProximityBannerShown(
  kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming' | 'nearby-match',
  otherUserId: string
): void {
  if (!otherUserId) return;
  try {
    localStorage.setItem(permanentKey(kind, otherUserId), '1');
  } catch {
    /* ignore */
  }
}
