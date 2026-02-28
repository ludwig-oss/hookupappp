# Deploy your Vite app to Vercel

Vercel auto-detects Vite, uses Node 18+, and sets the correct production environment.

## Option 1: Use repo root (recommended)

With the included **`vercel.json`**, you don’t need to change any settings. Just connect the repo and deploy.

- **Build Command:** set by `vercel.json` (installs deps, then builds the client)
- **Output Directory:** `client/dist` (because the Vite app lives in `client/`)

## Option 2: Set Root Directory to `client`

In Vercel → Project Settings → General:

- **Root Directory:** `client`
- **Build Command:** `npm run build:skip-typecheck` (or `npm run build` if TypeScript passes)
- **Output Directory:** `dist`

Then you can leave **Build Command** and **Output Directory** empty in the dashboard and Vercel will use the defaults for a Vite app in that root.

---

**Backend (API):** This repo also has a Node server in `server/`. Deploy that to Render, Railway, or another host and point your frontend’s API requests to it (e.g. via env or proxy).
