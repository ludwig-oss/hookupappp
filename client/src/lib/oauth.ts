import { warmBackend } from './warmBackend';

export type OAuthProvider = 'google' | 'facebook' | 'apple';
export type OAuthIntent = 'login' | 'signup';

function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
}

function allowedProviderHost(hostname: string, provider: OAuthProvider): boolean {
  const host = hostname.toLowerCase();
  if (provider === 'google') return host === 'accounts.google.com';
  if (provider === 'facebook') return host === 'www.facebook.com' || host === 'facebook.com' || host.endsWith('.facebook.com');
  return host === 'appleid.apple.com';
}

/**
 * Ask our API for the provider URL, then open that URL.
 * The browser never loads the API host itself, so a cold-start HTML page cannot flash on screen.
 */
export async function redirectToOAuth(provider: OAuthProvider, intent: OAuthIntent = 'signup'): Promise<void> {
  const firefox = isFirefox();
  const ready = await warmBackend(firefox ? 8000 : 60000);
  if (!ready && !firefox) {
    throw new Error('Server is waking up — please try again in a moment.');
  }
  const origin = window.location.origin;
  const url = `${origin}/api/auth/${provider}?return_origin=${encodeURIComponent(origin)}&intent=${intent}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const raw = await res.text();
  if (!res.headers.get('content-type')?.includes('json') || /<html|onrender\.com/i.test(raw)) {
    throw new Error('Server is waking up — please try again in a moment.');
  }
  let data: { url?: string; error?: string };
  try {
    data = JSON.parse(raw) as { url?: string; error?: string };
  } catch {
    throw new Error('Server is waking up — please try again in a moment.');
  }
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Could not start sign-in. Try again.');
  }
  let dest: URL;
  try {
    dest = new URL(data.url);
  } catch {
    throw new Error('Could not start sign-in. Try again.');
  }
  if (!allowedProviderHost(dest.hostname, provider)) {
    throw new Error('Could not start sign-in. Try again.');
  }
  window.location.assign(data.url);
}
