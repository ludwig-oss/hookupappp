import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const STAY_KEY = 'stayLoggedInDevice';
const LOGOUT_KEY = 'hookup_logged_out';

let memoryToken: string | null = null;
let memoryUser: string | null = null;
let stayLoggedIn = false;
let loggedOut = false;

const sessionEndListeners = new Set<() => void>();

export function onSessionEnd(listener: () => void): () => void {
  sessionEndListeners.add(listener);
  return () => {
    sessionEndListeners.delete(listener);
  };
}

export function getStayLoggedIn(): boolean {
  return stayLoggedIn;
}

export function isLoggedOutFlag(): boolean {
  return loggedOut;
}

export function clearLoggedOutFlag(): void {
  loggedOut = false;
  void AsyncStorage.removeItem(LOGOUT_KEY);
}

export function getAuthToken(): string | null {
  if (loggedOut) return null;
  return memoryToken;
}

export function getAuthUserRaw(): string | null {
  if (loggedOut) return null;
  return memoryUser;
}

/** Load the last session into memory before the first API call. */
export async function hydrateAuth(): Promise<void> {
  const pairs = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY, STAY_KEY, LOGOUT_KEY]);
  const map = Object.fromEntries(pairs);
  loggedOut = map[LOGOUT_KEY] === '1';
  stayLoggedIn = map[STAY_KEY] === '1';
  if (loggedOut || !stayLoggedIn) {
    memoryToken = null;
    memoryUser = null;
    return;
  }
  memoryToken = map[TOKEN_KEY] || null;
  memoryUser = map[USER_KEY] || null;
}

/**
 * Memory is updated immediately so the next request can send the JWT.
 * "Stay signed in" writes AsyncStorage; otherwise the session ends when the app process dies.
 */
export function persistAuth(user: unknown, token: string, nextStayLoggedIn: boolean): void {
  loggedOut = false;
  stayLoggedIn = nextStayLoggedIn;
  memoryToken = token;
  try {
    memoryUser = JSON.stringify(user);
  } catch {
    memoryUser = null;
  }
  void AsyncStorage.removeItem(LOGOUT_KEY);
  if (nextStayLoggedIn && memoryUser) {
    void AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, memoryUser],
      [STAY_KEY, '1'],
    ]);
    return;
  }
  void AsyncStorage.setItem(STAY_KEY, '0');
  void AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export function writeAuthUser(user: unknown): void {
  try {
    memoryUser = JSON.stringify(user);
  } catch {
    return;
  }
  if (stayLoggedIn) {
    void AsyncStorage.setItem(USER_KEY, memoryUser);
  }
}

export function clearAuth(): void {
  memoryToken = null;
  memoryUser = null;
  void AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

/** Drop the saved session. Auth state listens and returns to sign-in. */
export function endSession(): void {
  loggedOut = true;
  clearAuth();
  void AsyncStorage.setItem(LOGOUT_KEY, '1');
  sessionEndListeners.forEach((listener) => listener());
}
