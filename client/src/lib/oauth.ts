import { warmBackend } from './warmBackend';

export type OAuthProvider = 'google' | 'facebook' | 'apple';

/** Start OAuth through the Vercel /api proxy (never open Render directly). */
export async function redirectToOAuth(provider: OAuthProvider): Promise<void> {
  const ready = await warmBackend(60000);
  if (!ready) {
    throw new Error('Server is waking up — please try again in a moment.');
  }
  window.location.href = `${window.location.origin}/api/auth/${provider}`;
}
