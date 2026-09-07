const TOKEN_KEY = 'token';
const USER_KEY = 'user';
/** Explicit opt-in. Old `stayLoggedIn` defaulted on, so it is ignored. */
const STAY_KEY = 'stayLoggedInDevice';

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function ss(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function getStayLoggedIn(): boolean {
  return ls()?.getItem(STAY_KEY) === '1';
}

export function setStayLoggedInFlag(on: boolean): void {
  ls()?.setItem(STAY_KEY, on ? '1' : '0');
}

/** Session-only unless they checked Stay logged in. Closing the tab logs them out. */
function migrateEphemeralSession(): void {
  if (getStayLoggedIn()) return;
  const l = ls();
  const s = ss();
  if (!l || !s) return;
  const token = l.getItem(TOKEN_KEY);
  if (!token) return;
  s.setItem(TOKEN_KEY, token);
  const user = l.getItem(USER_KEY);
  if (user) s.setItem(USER_KEY, user);
  l.removeItem(TOKEN_KEY);
  l.removeItem(USER_KEY);
}

export function getAuthToken(): string | null {
  migrateEphemeralSession();
  return ls()?.getItem(TOKEN_KEY) || ss()?.getItem(TOKEN_KEY) || null;
}

export function getAuthUserRaw(): string | null {
  migrateEphemeralSession();
  return ls()?.getItem(USER_KEY) || ss()?.getItem(USER_KEY) || null;
}

export function persistAuth(user: unknown, token: string, stayLoggedIn: boolean): void {
  setStayLoggedInFlag(stayLoggedIn);
  const primary = stayLoggedIn ? ls() : ss();
  const other = stayLoggedIn ? ss() : ls();
  if (!primary) return;
  primary.setItem(TOKEN_KEY, token);
  try {
    primary.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* quota */
  }
  other?.removeItem(TOKEN_KEY);
  other?.removeItem(USER_KEY);
}

export function applyStayLoggedIn(on: boolean): void {
  const token = getAuthToken();
  const raw = getAuthUserRaw();
  if (!token) {
    setStayLoggedInFlag(on);
    return;
  }
  let user: unknown = null;
  try {
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  persistAuth(user, token, on);
}

export function writeAuthUser(user: unknown): void {
  const json = JSON.stringify(user);
  const store = getStayLoggedIn() ? ls() : ss();
  try {
    store?.setItem(USER_KEY, json);
  } catch {
    /* quota */
  }
}

export function clearAuth(): void {
  ls()?.removeItem(TOKEN_KEY);
  ls()?.removeItem(USER_KEY);
  ss()?.removeItem(TOKEN_KEY);
  ss()?.removeItem(USER_KEY);
}
