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

// On Vercel, same-origin `/api/...` is proxied by root `middleware.mjs` to BACKEND_URL.
// For local dev, Vite will forward `/api` to your backend.
export const API_BASE = import.meta.env.PROD
  ? normalizeApiBase(import.meta.env.VITE_API_URL) || ''
  : '';
