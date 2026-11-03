import { API_BASE } from '../api/config';

export type OAuthIntent = 'login' | 'signup';

type GoogleSession = { user: Record<string, unknown>; token: string };

function origin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function clearAddress(): void {
  window.history.replaceState({}, '', '/');
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  if (!raw || raw.trim().startsWith('<')) {
    throw new Error('Server is waking up. Try again in a moment.');
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function googleStartUrl(intent: OAuthIntent, returnOrigin: string): string {
  return (
    `${API_BASE}/api/auth/google?return_origin=${encodeURIComponent(returnOrigin)}` +
    `&intent=${intent}&format=json`
  );
}

/** Warm the same Google start endpoint the website prefetches when the screen opens. */
export function prefetchGoogle(intent: OAuthIntent): void {
  const returnOrigin = origin();
  if (!returnOrigin) return;
  void fetch(googleStartUrl(intent, returnOrigin), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  }).catch(() => undefined);
}

/** Ask the same Google start endpoint the website uses, then open Google. */
export async function startGoogle(intent: OAuthIntent): Promise<void> {
  const returnOrigin = origin();
  if (!returnOrigin) throw new Error('Open this app in the browser to use Google.');
  const deadline = Date.now() + 20000;
  let last = 'Could not reach the server. Try again.';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(googleStartUrl(intent, returnOrigin), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await readJson(res);
      const next = typeof data.url === 'string' ? data.url : '';
      if (!res.ok || !next) throw new Error(typeof data.error === 'string' ? data.error : 'Could not start Google.');
      window.location.assign(next);
      return;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw new Error(last);
}

/** Finish a Google redirect that landed back on this app. */
export async function consumeGoogleRedirect(): Promise<GoogleSession | null> {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  if (search.get('oauth_error')) {
    const message = search.get('oauth_error') || 'Google sign-in failed.';
    clearAddress();
    throw new Error(message);
  }

  if (path.startsWith('/auth/callback')) {
    const token = search.get('token') || '';
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/profile/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    const user = await readJson(res);
    clearAddress();
    if (!res.ok) throw new Error(typeof user.error === 'string' ? user.error : 'Could not finish sign-in.');
    return { user, token };
  }

  if (!path.startsWith('/auth/oauth-return/google')) return null;

  const hashError = hash.get('error_description') || hash.get('error');
  if (hashError) {
    clearAddress();
    throw new Error(hashError);
  }

  const idToken = hash.get('id_token');
  if (idToken) {
    const res = await fetch(`${API_BASE}/api/auth/google/id-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ idToken, state: hash.get('state') || search.get('state') || '' }),
    });
    const data = await readJson(res);
    clearAddress();
    if (!res.ok || typeof data.token !== 'string') {
      throw new Error(typeof data.error === 'string' ? data.error : 'Google sign-in failed.');
    }
    return { user: (data.user as Record<string, unknown>) || {}, token: data.token };
  }

  const qs = new URLSearchParams(search);
  qs.set('format', 'json');
  const res = await fetch(`${API_BASE}/api/auth/google/callback?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await readJson(res);
  clearAddress();
  if (!res.ok || typeof data.token !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : 'Google sign-in failed.');
  }
  return { user: (data.user as Record<string, unknown>) || {}, token: data.token };
}
