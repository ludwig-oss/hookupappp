export type OAuthProvider = 'google' | 'facebook' | 'apple';
export type OAuthIntent = 'login' | 'signup';

function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function allowedProviderHost(hostname: string, provider: OAuthProvider): boolean {
  const host = hostname.toLowerCase();
  if (provider === 'google') return host === 'accounts.google.com';
  if (provider === 'facebook') return host === 'www.facebook.com' || host === 'facebook.com' || host.endsWith('.facebook.com');
  return host === 'appleid.apple.com';
}

/**
 * Ask our API for the provider URL, then open that URL immediately.
 * No health-check wait first — that was holding the button for up to a minute.
 */
export async function redirectToOAuth(provider: OAuthProvider, intent: OAuthIntent = 'signup'): Promise<void> {
  const origin = window.location.origin;
  const url = `${origin}/api/auth/${provider}?return_origin=${encodeURIComponent(origin)}&intent=${intent}&format=json`;
  let lastMessage = 'Could not start. Try again.';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400));
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: abortAfter(8000),
      });
    } catch {
      lastMessage = 'Could not reach the server. Try again.';
      continue;
    }
    const raw = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('json') && !/<html|onrender\.com/i.test(raw);
    if (!isJson || res.status >= 500) {
      lastMessage = 'Server is waking up — please try again.';
      continue;
    }
    let data: { url?: string; error?: string };
    try {
      data = JSON.parse(raw) as { url?: string; error?: string };
    } catch {
      lastMessage = 'Could not start. Try again.';
      continue;
    }
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not start. Try again.');
    }
    let dest: URL;
    try {
      dest = new URL(data.url);
    } catch {
      throw new Error('Could not start. Try again.');
    }
    if (!allowedProviderHost(dest.hostname, provider)) {
      throw new Error('Could not start. Try again.');
    }
    window.location.assign(data.url);
    return;
  }
  throw new Error(lastMessage);
}
