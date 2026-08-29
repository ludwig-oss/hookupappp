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

/** Production Render API — used when VITE_API_URL is unset (avoids broken Vercel self-proxy). */
const PRODUCTION_API_FALLBACK = 'https://hookupappp.onrender.com';

// On Vercel, same-origin `/api/...` is proxied by `api/[...path].js` to BACKEND_URL.
// Direct Render calls are more reliable for auth (CORS allows *.vercel.app).
export const API_BASE = import.meta.env.PROD
  ? normalizeApiBase(import.meta.env.VITE_API_URL) || PRODUCTION_API_FALLBACK
  : '';
