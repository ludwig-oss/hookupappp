# Deploy your Vite app to Vercel

Vercel auto-detects Vite, uses Node 18+, and sets the correct production environment.

## Important (this is not Next.js)

This frontend is a **Vite + React SPA** (React Router). It is **not** a Next.js App Router project, so there is no `app/api/*`.

- **Signup API used by the frontend:** `POST /api/auth/signup` (served by your backend)
- **Signup page route (SPA):** `/signup` (handled by React Router)

To avoid Vercel 404s on SPA routes like `/signup`, `vercel.json` includes an SPA rewrite to `index.html`.

## Option 1: Use repo root (recommended)

With the included **`vercel.json`**, you don’t need to change any settings. Just connect the repo and deploy.

- **Build Command:** set by `vercel.json` (installs deps, then builds the client)
- **Output Directory:** `client/dist` (because the Vite app lives in `client/`)

### Required env var for API calls

Because Vercel is hosting **only the frontend**, you must set:

- **`VITE_API_URL`** = your backend base URL (e.g. `https://your-app.onrender.com`)

Without this, your frontend will call same-origin `/api/...` on Vercel and get `404 NOT_FOUND`.

## Option 2: Set Root Directory to `client`

In Vercel → Project Settings → General:

- **Root Directory:** `client`
- **Build Command:** `npm run build:skip-typecheck` (or `npm run build` if TypeScript passes)
- **Output Directory:** `dist`

Then you can leave **Build Command** and **Output Directory** empty in the dashboard and Vercel will use the defaults for a Vite app in that root.

---

**Backend (API):** This repo also has a Node server in `server/`. Deploy that to Render, Railway, or another host and point your frontend’s API requests to it (e.g. via env or proxy).
