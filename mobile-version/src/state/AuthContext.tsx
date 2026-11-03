import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { axios } from '../api/http';
import { profileAPI } from '../api/profile';
import { settingsAPI } from '../api/settings';
import { consumeGoogleRedirect } from '../lib/googleAuth';
import {
  clearAuth,
  clearLoggedOutFlag,
  endSession,
  getAuthToken,
  getAuthUserRaw,
  hydrateAuth,
  isLoggedOutFlag,
  onSessionEnd,
  persistAuth,
  writeAuthUser,
} from '../session/authStorage';
import { isPlainObject, normalizeUserId, userForStorage } from '../session/userStorage';

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  profilePicture?: string | null;
  profileSetupComplete?: boolean;
  emailVerified?: boolean;
  gender?: string;
  age?: number | string;
  country?: string;
  city?: string;
  bio?: string;
  dateLookingFor?: string[];
  hasBackupPassword?: boolean;
  hasGoogleAuth?: boolean;
  photoVerifiedAt?: string | null;
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  entryError: string;
  clearEntryError: () => void;
  login: (userData: unknown, token: string, options?: { stayLoggedIn?: boolean }) => void;
  logout: () => void;
  updateUser: (updates: Partial<SessionUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toSessionUser(raw: Record<string, unknown>): SessionUser | null {
  const id = normalizeUserId(raw.id);
  if (!id) return null;
  return { ...userForStorage(raw), id } as SessionUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryError, setEntryError] = useState('');
  const hasRefreshedProfile = useRef(false);
  const refreshGen = useRef(0);

  useEffect(() => onSessionEnd(() => setUser(null)), []);

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    void (async () => {
      try {
        const google = await consumeGoogleRedirect();
        if (cancelled) return;
        if (google) {
          const session = toSessionUser(google.user);
          if (session) {
            clearLoggedOutFlag();
            persistAuth(session, google.token, true);
            axios.defaults.headers.common.Authorization = `Bearer ${google.token}`;
            setUser(session);
            finish();
            return;
          }
        }
      } catch (err) {
        if (!cancelled) setEntryError(err instanceof Error ? err.message : 'Google sign-in failed.');
        finish();
        return;
      }

      try {
        await hydrateAuth();
        if (cancelled) return;
        if (isLoggedOutFlag()) {
          clearAuth();
          finish();
          return;
        }
        const token = getAuthToken();
        const userData = getAuthUserRaw();
        if (token) {
          axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        }
        if (token && userData) {
          const parsed = JSON.parse(userData) as unknown;
          if (isPlainObject(parsed)) {
            const session = toSessionUser(parsed);
            if (session) {
              setUser(session);
              finish();
              return;
            }
          }
          clearAuth();
        }
        if (token) {
          try {
            const fullProfile = await profileAPI.getCurrentUser();
            if (!cancelled && isPlainObject(fullProfile)) {
              const session = toSessionUser(fullProfile as unknown as Record<string, unknown>);
              if (session) {
                setUser(session);
                writeAuthUser(session);
              }
            }
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 404) {
              clearAuth();
              if (!cancelled) setUser(null);
            }
          }
        }
      } catch {
        clearAuth();
      }
      finish();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !user?.id || hasRefreshedProfile.current || isLoggedOutFlag()) return;
    if (!getAuthToken()) return;
    hasRefreshedProfile.current = true;
    const gen = ++refreshGen.current;
    void Promise.all([profileAPI.getCurrentUser(), settingsAPI.getSettings().catch(() => null)])
      .then(([fullProfile, settingsRes]) => {
        if (gen !== refreshGen.current || !isPlainObject(fullProfile)) return;
        const session = toSessionUser(fullProfile as unknown as Record<string, unknown>);
        if (!session) return;
        setUser(session);
        writeAuthUser(session);
        void settingsRes;
      })
      .catch(() => {
        /* Keep the cached session when a cold /me fails. */
      });
  }, [loading, user?.id]);

  const login = useCallback((userData: unknown, token: string, options?: { stayLoggedIn?: boolean }) => {
    if (!isPlainObject(userData) || typeof token !== 'string' || !token) {
      throw new Error('Invalid login payload');
    }
    const session = toSessionUser(userData);
    if (!session) throw new Error('Invalid login payload');
    refreshGen.current += 1;
    hasRefreshedProfile.current = false;
    clearLoggedOutFlag();
    persistAuth(session, token, options?.stayLoggedIn !== false);
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    refreshGen.current += 1;
    hasRefreshedProfile.current = true;
    setUser(null);
    delete axios.defaults.headers.common.Authorization;
    endSession();
  }, []);

  const updateUser = useCallback((updates: Partial<SessionUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      writeAuthUser(next);
      return next;
    });
  }, []);

  const clearEntryError = useCallback(() => setEntryError(''), []);

  const value = useMemo(
    () => ({ user, loading, entryError, clearEntryError, login, logout, updateUser }),
    [user, loading, entryError, clearEntryError, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
