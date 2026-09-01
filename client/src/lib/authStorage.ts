const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const STAY_KEY = 'stayLoggedIn';

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
  const v = ls()?.getItem(STAY_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  if (ss()?.getItem(TOKEN_KEY) && !ls()?.getItem(TOKEN_KEY)) return false;
  return true;
}

export function setStayLoggedInFlag(on: boolean): void {
  ls()?.setItem(STAY_KEY, on ? '1' : '0');
}

export function getAuthToken(): string | null {
  return ls()?.getItem(TOKEN_KEY) || ss()?.getItem(TOKEN_KEY) || null;
}

export function getAuthUserRaw(): string | null {
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
  if (ls()?.getItem(TOKEN_KEY)) {
    try {
      ls()?.setItem(USER_KEY, json);
    } catch {
      /* quota */
    }
    return;
  }
  if (ss()?.getItem(TOKEN_KEY)) {
    try {
      ss()?.setItem(USER_KEY, json);
    } catch {
      /* quota */
    }
  }
}

export function clearAuth(): void {
  ls()?.removeItem(TOKEN_KEY);
  ls()?.removeItem(USER_KEY);
  ss()?.removeItem(TOKEN_KEY);
  ss()?.removeItem(USER_KEY);
}
