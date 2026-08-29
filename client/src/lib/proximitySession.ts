/** Show „Someone is near“ style banners once per browser session per encounter. */

const SESSION_KEY = 'proximity:sessionId';

function sessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'default';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function storageKey(kind: string, otherUserId: string): string {
  return `proximity:shown:${sessionId()}:${kind}:${otherUserId}`;
}

/** True if we may show the banner for this user encounter. */
export function shouldShowProximityBanner(kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming', otherUserId: string): boolean {
  if (!otherUserId) return true;
  const key = storageKey(kind, otherUserId);
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === '1') return false;
  try {
    if (localStorage.getItem(key) === '1') return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Mark banner as shown for this session — persists across reloads in this tab. */
export function markProximityBannerShown(kind: 'walk-suggest' | 'walk-incoming' | 'buzz-incoming', otherUserId: string): void {
  if (!otherUserId || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(storageKey(kind, otherUserId), '1');
  try {
    localStorage.setItem(storageKey(kind, otherUserId), '1');
  } catch {
    /* ignore */
  }
}
