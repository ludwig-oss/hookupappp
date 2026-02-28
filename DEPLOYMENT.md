# Deployment guide

This app is ready for production with **no demo data** and **fresh state** for new users.

**Full stack map (database, storage, real-time, hosting):** see **[STACK.md](./STACK.md)**.

## Check these first

- **No secrets in logs** — Verification codes and reset links are only logged when `NODE_ENV !== 'production'`. In production, set SMTP/Twilio so real email/SMS are sent.
- **No hardcoded API keys** — All keys (Stripe, PayPal, JWT, etc.) come from environment variables. The client uses `VITE_STRIPE_PUBLISHABLE_KEY` only (no fallback key in code).
- **`.env` file** — Copy `server/env.example` to `server/.env` and set values. The server loads from several paths (see env loading in code).
- **`.env` in `.gitignore`** — Root `.gitignore` includes `.env` so secrets are never committed.
- **Run locally** — From repo root: `npm run build` then `npm run start`. The server serves the app from `client/dist/` when `NODE_ENV=production`.

## Pre-deploy checklist

Before deploying, run from the repo root:

- **`npm run build`** — Builds client (TypeScript + Vite) and server (TypeScript). Both must pass. Output: `client/dist/` and `server/dist/`.
- **`npm run install:all`** (or `npm install` in root, `server`, and `client`) — Ensures all dependencies (including `server`’s `pg`, etc.) are installed.

Set in production: **`NODE_ENV=production`**, **`JWT_SECRET`** (min 32 chars), and **`FRONTEND_URL`** (your app’s public URL). See **Environment** below.

---

## JSON → real database (scaling)

To stop using JSON files and scale properly, use a **PostgreSQL** or **Firebase** backend. See **[SCALING.md](./SCALING.md)** for:

| Option | What you get | Effort |
|--------|----------------|--------|
| **Supabase** | PostgreSQL, optional Auth/Realtime/Storage | Set `DATABASE_URL` to Supabase connection string (no code change) |
| **Render PostgreSQL** | PostgreSQL next to your backend | Set `DATABASE_URL` (see section below) |
| **Firebase** | Firestore DB + Auth + Storage | Code changes; different data model |

With **`DATABASE_URL`** set (Supabase or Render), the app already uses PostgreSQL for **users**, **Love Life posts**, and **chat**. Everything else is still JSON until you migrate it.

---

## Pack everything for upload (zip)

From the project root:

```bash
npm run build
npm run pack
```

Or use **`npm run pack:full`** to build then pack in one go (requires TypeScript build to pass). **`npm run pack`** alone copies the project into **`deploy/`** and creates **`aswp-deploy.zip`** (no `node_modules`, no `.git`, no `.env`). If you haven’t run `npm run build` yet, the zip will contain source only—then build on the server after unzip (see below). Upload the zip to your server, then:

1. Unzip `aswp-deploy.zip`
2. `cd deploy`
3. If the zip had no built files, build first: `npm run install:all` (use the root that has client + server; or `cd server && npm install && cd ../client && npm install`) then build client and server. If you used `pack:full`, skip to step 4.
4. `cd server && npm install --production && cd ..`
5. Set env and start:
   ```bash
   NODE_ENV=production JWT_SECRET=your-32-char-secret FRONTEND_URL=https://your-domain.com npm start
   ```

---

## Deploy with Docker

```bash
docker build -t aswp .
docker run -p 5000:5000 -e NODE_ENV=production -e JWT_SECRET=your-32-char-secret -e FRONTEND_URL=https://your-domain.com aswp
```

---

## Deploy on Render.com (Web Service + PostgreSQL)

1. Push this repo to GitHub.
2. Go to [Render](https://render.com):
   - **New → PostgreSQL** – create a free PostgreSQL instance. Copy its **Internal Database URL** (use Internal, not External, for same-datacenter access).
   - **New → Web Service** – connect the repo.
3. Render will use **`render.yaml`** (build: `npm run install:all && npm run build`, start: `NODE_ENV=production node server/dist/index.js`).
4. In the Web Service dashboard set:
   - **JWT_SECRET** (min 32 chars)
   - **FRONTEND_URL** (e.g. your Vercel/Netlify frontend URL)
   - **DATABASE_URL** – paste the Internal Database URL from the PostgreSQL instance. The server will create tables on startup (users, dating_posts, messages).

With **DATABASE_URL** set, the backend uses PostgreSQL for users, Love Life feed posts, and chat instead of JSON files. Other features (health, events, etc.) still use JSON storage until migrated.

---

## Prerequisites

- Node.js 18+
- Set **production** environment variables (see below).

## Build

From the project root:

```bash
npm run install:all   # if not already done
npm run build         # builds client + server
```

This outputs:

- **Client:** `client/dist/` (static assets + `index.html`)
- **Server:** `server/dist/` (Node app)

## Run in production

1. Set environment variables (see **Environment** below). **Required in production:**
   - `NODE_ENV=production`
   - `JWT_SECRET` (min 32 characters; e.g. a long random string)

2. Start the server from the project root:

   ```bash
   NODE_ENV=production FRONTEND_URL=https://your-domain.com node server/dist/index.js
   ```

   Or from the `server` folder:

   ```bash
   cd server
   NODE_ENV=production FRONTEND_URL=https://your-domain.com node dist/index.js
   ```

3. When `NODE_ENV=production`, the server:
   - Serves the **client build** from `client/dist/` (no separate static host needed).
   - Restricts **CORS** to `FRONTEND_URL` if set.
   - **Refuses to start** without `JWT_SECRET`.

## Environment

Copy `server/env.example` to `server/.env` and set values. For production:

| Variable        | Required in prod | Description |
|----------------|------------------|-------------|
| `NODE_ENV`     | Yes              | Set to `production`. |
| `JWT_SECRET`   | Yes              | Min 32 characters; use a long random string. |
| `FRONTEND_URL` | Recommended      | Public URL of the app (e.g. `https://yourdomain.com`). Used for CORS and password-reset/email links. |
| `PORT`         | No               | Default `5000`. |
| SMTP_*         | For email        | Required for verification/password-reset emails. |
| Stripe/PayPal  | For payments     | Optional; premium features if configured. |

## Data (fresh deploy)

- **No demo or seed data** is committed. The app uses `server/data/` (and `server/server/data/` for some paths); these folders are in `.gitignore`.
- On first run, the server creates `server/data/` and JSON files as needed (e.g. first signup creates `users.json`). Start with an empty data directory for a clean slate.

## Single-host deployment

With `NODE_ENV=production`:

1. Build once: `npm run build`
2. Run the server from the root with `NODE_ENV`, `JWT_SECRET`, and `FRONTEND_URL` set.
3. Point your domain at the server port (e.g. 5000). All traffic (API and app) goes to the same process; the server serves the SPA for non-API routes.

## Optional: separate front-end host

If you host the client elsewhere (e.g. Vercel/Netlify):

1. Set `FRONTEND_URL` to that URL.
2. Build the client: `npm run build:client`.
3. Deploy `client/dist/` to your static host.
4. Deploy the server (without serving `client/dist`) and ensure CORS allows `FRONTEND_URL`.
5. Configure your static host so API requests are proxied to the server or use the same origin.
