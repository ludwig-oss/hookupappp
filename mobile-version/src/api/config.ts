/**
 * Mobile talks to the same backend as the web app.
 * Override with EXPO_PUBLIC_API_URL when you point at a local server.
 */
function normalizeApiBase(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}

/** Production Render API used by the web client for direct media calls. */
const PRODUCTION_RENDER_API = 'https://hookupappp.onrender.com';

const configured = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL);

export const API_BASE = configured || PRODUCTION_RENDER_API;
export const MEDIA_API_BASE = configured || PRODUCTION_RENDER_API;
