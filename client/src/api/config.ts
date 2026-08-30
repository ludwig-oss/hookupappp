/**
 * Local dev: leave empty — Vite proxy forwards /api to the server.
 * Vercel: leave empty if you set BACKEND_URL (API is proxied via /api → serverless).
 * Or set VITE_API_URL to call the backend directly (must match CORS on the server).
 */
function normalizeApiBase(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}

/** Production Render API for large media uploads (bypasses Vercel ~4.5MB proxy limit). */
const PRODUCTION_RENDER_API = 'https://hookupappp.onrender.com';

// On Vercel, same-origin `/api/...` is proxied by `api/[...path].js` to BACKEND_URL (no CORS issues on custom domains).
// Set VITE_API_URL only if you need direct Render calls (must allow your domain in server CORS).
export const API_BASE = import.meta.env.PROD
  ? normalizeApiBase(import.meta.env.VITE_API_URL)
  : '';

/** Profile stories/highlights/avatars — call Render directly in prod when not using VITE_API_URL. */
export const MEDIA_API_BASE = import.meta.env.PROD
  ? normalizeApiBase(import.meta.env.VITE_API_URL) || PRODUCTION_RENDER_API
  : '';
