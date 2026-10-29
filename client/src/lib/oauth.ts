import { warmBackend } from './warmBackend';

export type OAuthProvider = 'google' | 'facebook' | 'apple';

function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
}

/** Start OAuth through the Vercel /api proxy (never open Render directly). */
export async function redirectToOAuth(provider: OAuthProvider): Promise<void> {
  const firefox = isFirefox();
  const ready = await warmBackend(firefox ? 8000 : 60000);
  if (!ready && !firefox) {
    throw new Error('Server is waking up — please try again in a moment.');
  }
  const origin = window.location.origin;
  const url = `${origin}/api/auth/${provider}?return_origin=${encodeURIComponent(origin)}`;
  window.location.replace(url);
}
