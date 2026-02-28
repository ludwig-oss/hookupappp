# Stack overview (database, storage, real-time, hosting)

One-page map of how this app fits the target stack and where to configure each part.

---

## Architecture (request flow)

Same pattern as a solid dating-app backend: **App → API Server → Database + separate Photos storage.**

```
Browser (React + Vite)
       ↓
Vercel Frontend (client/dist)
       ↓
Render Backend (Node + Express, REST API)
       ↓
Database: Supabase / PostgreSQL (users, matches, messages)
       ↓
Photos storage: Cloudinary / Supabase Storage (profile images, highlights)
```

- **Browser** runs the React + Vite app (build output: `client/dist`).
- **Vercel** serves that static frontend on a fast global CDN; all API calls go to your backend.
- **Render** hosts the Node + Express REST API (cloud-hosted, like early Tinder-style backend).
- **Database** = User table + matches (interests) + messages in **Supabase or PostgreSQL**. Set `DATABASE_URL` on Render.
- **Photos storage** = profile pictures and media in **Cloudinary** (or Supabase Storage), not in the DB. Set `CLOUDINARY_*` env vars so uploads go to CDN; otherwise base64 fallback for dev.

---

## Frontend rewrite for web (office, desktop, emerging markets, engagement)

The same architecture works as a **web-first product** to reach:

- **Office users** — use in the browser without installing an app  
- **Desktop users** — full experience on large screens  
- **Emerging markets** — web works on low-end devices and shared PCs; no app store required  
- **Increase engagement** — one codebase, one REST API; add PWA later for “install” and offline hints if you want  

**Tech:** React + Vite (SPA), same REST API as the backend. No separate “web API” — the same endpoints serve this web app and can serve a future native or hybrid mobile app.

**Flow (same as above):**

```
Browser (React App)
       ↓
API Server (Node + Express, REST)
       ↓
Database (PostgreSQL) + Storage (images)
```

So: **one React SPA in the browser**, talking to **one API server**, which talks to **database and storage**. Mobile can reuse the same API later.

**Key tasks (web):** Swipe UI in the browser (mouse drag + click, responsive, touch support), **Step 3: Authentication** (phone, SMS, email verification, JWT; optional: secure cookie sessions, CSRF), **Step 4: Web performance** (lazy load images, compress assets, CDN, minify JS), **Step 5: Security hardening** (XSS, rate limiting, bot detection, CAPTCHA, abuse monitoring), **Step 6: Real-time messaging** (WebSockets, fallback polling, message sync across devices), and **Step 7: Payment integration** (Stripe, subscriptions, upgrade flows) are described in **[FRONTEND-WEB.md](./FRONTEND-WEB.md)**.

---

## 1️⃣ JSON → real database

Replace JSON files with a proper database so the app can scale.

| Option | What it gives you | In this app |
|--------|-------------------|-------------|
| **Supabase** | PostgreSQL, Auth, Realtime, Storage | Set `DATABASE_URL` to your Supabase Postgres connection string → **no code change**. Users, posts, and chat use the DB. |
| **Render PostgreSQL** | Relational DB hosted with your backend | Set `DATABASE_URL` to Render’s **Internal Database URL**. Same as above. |
| **Firebase** | Firestore DB + Auth + Storage | Different data model; would need code changes (see [SCALING.md](./SCALING.md)). |

**Details:** [SCALING.md](./SCALING.md) — which data is already on PostgreSQL, which is still JSON, and how to use Supabase / Render / Firebase.

---

## 2️⃣ Storage for images / media

Store profile photos and other media in object storage (not base64 in the DB). Served via CDN for speed and safety.

| Option | What it gives you | In this app |
|--------|-------------------|-------------|
| **Cloudinary** | Image upload, CDN (free tier) | ✅ **Integrated.** Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` → profile pictures, highlights, and disappearing photos upload to Cloudinary; only URLs stored in DB. |
| **Supabase Storage** | Buckets, CDN-style URLs (free tier) | Add upload → save URL (see [STORAGE.md](./STORAGE.md)) if you prefer Supabase. |
| **Firebase Storage** | Object storage + CDN | Not integrated. Use if you go Firebase for DB/Auth. |

**Details:** [STORAGE.md](./STORAGE.md) — how to add one of these so users can upload profile photos and media safely; store only URLs in the app.

---

## 3️⃣ Real-time updates

Live chat, swipe/match updates, and notifications without refreshing.

| Option | What it gives you | In this app |
|--------|-------------------|-------------|
| **Supabase Realtime** | Subscribe to DB changes (e.g. new messages) | Not integrated. Good if you use Supabase for Postgres. |
| **WebSockets** | Bidirectional real-time | Not added. Can add Socket.io if you need it. |
| **Server-Sent Events (SSE)** | One-way server → client | ✅ **Included.** `GET /api/notifications/stream?token=<JWT>` for `new_message` and `new_match` events. |

So today you get **live chat and match notifications** via the built-in SSE stream. For more scale or a different stack, use **Supabase Realtime** or **WebSockets**.

**Details:** [ARCHITECTURE.md](./ARCHITECTURE.md) — real-time section and client usage.

---

## 4️⃣ Hosting / deployment

Frontend and backend on managed platforms; HTTPS handled for you.

| Layer | Recommended | In this app |
|-------|-------------|-------------|
| **Frontend** | **Vercel** (fast global CDN) | ✅ Supported. See [VERCEL-DEPLOY.md](./VERCEL-DEPLOY.md). Build from repo root or `client/`; output `client/dist`. |
| **Backend** | **Render** (Node + Express) | ✅ Supported. See [DEPLOYMENT.md](./DEPLOYMENT.md). Web Service + optional PostgreSQL on Render. |
| **HTTPS** | Automatic on both | Vercel and Render provide HTTPS by default. |

**Details:** [DEPLOYMENT.md](./DEPLOYMENT.md) (backend, Render, env vars), [VERCEL-DEPLOY.md](./VERCEL-DEPLOY.md) (frontend). For Netlify instead of Vercel: [NETLIFY-DEPLOY.md](./NETLIFY-DEPLOY.md).

---

**When usage grows:** Load balancing, horizontal scaling, CDN for images, and optimizing matching (location-based filtering, geo queries, DB indexing) are covered in **[SCALING-GUIDE.md](./SCALING-GUIDE.md)**. For **discover stack ranking** (ELO, desirability scoring, ML), see **[ARCHITECTURE.md](./ARCHITECTURE.md)** — matching & ranking section.

---

## Quick reference

| # | Topic | Doc | Status |
|---|--------|-----|--------|
| 1 | Database (Supabase / Render PG / Firebase) | [SCALING.md](./SCALING.md) | PostgreSQL for users, posts, chat when `DATABASE_URL` set |
| 2 | Storage (Supabase / Cloudinary / Firebase) | [STORAGE.md](./STORAGE.md) | Add one provider; store URLs only |
| 3 | Real-time (SSE / Supabase Realtime / WebSockets) | [ARCHITECTURE.md](./ARCHITECTURE.md) | SSE included; Realtime/WS optional |
| 4 | Matching & ranking (ELO, desirability, ML) | [ARCHITECTURE.md](./ARCHITECTURE.md) | Filter-based discover only; ELO/ML not implemented |
| 5 | Hosting (Vercel + Render) | [DEPLOYMENT.md](./DEPLOYMENT.md), [VERCEL-DEPLOY.md](./VERCEL-DEPLOY.md) | Both supported |
