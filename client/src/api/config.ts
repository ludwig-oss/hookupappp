/**
 * When the app is on Vercel, set VITE_API_URL to your backend URL (e.g. Render).
 * Leave empty for local dev (Vite proxy forwards /api to backend).
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
