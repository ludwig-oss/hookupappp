# Replacing JSON with a real database (scaling)

JSON files in `server/data/` don’t scale: they’re single-file, not concurrent-safe, and hard to back up or query. This guide explains how to move to a real database using one of three beginner-friendly options.

---

## What’s already on a database

When **`DATABASE_URL`** is set (PostgreSQL connection string), the app already uses a real database for:

| Data            | Table / collection | Status   |
|-----------------|--------------------|----------|
| Users           | `users`            | PostgreSQL |
| Love Life posts | `dating_posts`     | PostgreSQL |
| Chat messages   | `messages`         | PostgreSQL |

So **users, feed, and chat scale** as soon as you connect any PostgreSQL (Render, Supabase, or another host).

---

## What’s still JSON (and blocks scaling at volume)

Everything else is still file-based. Migrating these to the same PostgreSQL (or another store) would remove the remaining scaling limits.

| Feature / area      | JSON files |
|---------------------|------------|
| Discover / matching | `interests.json`, `places.json`, `preferences.json`, `verifications.json` |
| Relationships       | `relationships.json` |
| Connections / buzz  | `buzzes.json`, `buzz.json` (nearby) |
| Settings            | `settings.json` |
| Health results      | `health-results.json`, `health-view-requests.json` |
| Events              | `events.json`, `event-requests.json`, `event-messages.json` |
| Improvement / guides| `guide-applications.json`, `guides.json`, `availability.json`, `bookings.json`, `guide-requests.json` |
| Safety              | `emergency-contacts.json`, `meetup-plans.json`, `date-shares.json`, etc. |
| Chat focus / NDA    | `chatFocus.json`, `nda-signatures.json` |
| Ratings, reviews    | `user-ratings.json`, `unmatch-reasons.json`, `reviews.json` |
| Compatibility       | `compatibility-questions.json`, `compatibility-results.json` |
| Premium / payments  | `premium.json`, `payments.json` |
| Reports / verification / gamification | `reports.json`, `verification.json`, `gamification.json`, `badges.json` |
| Activity / journey  | `activity-interests.json`, `connectionJourneys.json`, etc. |

---

## Option 1: Supabase (PostgreSQL + optional Auth, Realtime, Storage)

**What it gives you:** PostgreSQL, optional Auth, Realtime, Storage. Free tier is generous.

**Best for:** Same stack as now (Node + Express + Postgres) with minimal change; you can add Supabase Auth/Realtime/Storage later if you want.

### Use Supabase as your PostgreSQL (no code change)

The app already talks PostgreSQL when `DATABASE_URL` is set. Supabase is just hosted Postgres.

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In the project: **Settings → Database**.
3. Copy the **Connection string** (URI). Use **“Transaction”** or **“Session”** mode.  
   It looks like:  
   `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
4. If the URI has a placeholder password, replace it with your database password (or set one in Supabase dashboard).
5. In your server environment (e.g. Render, your VPS, or local `.env`), set:
   ```bash
   DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Restart the server. It will create `users`, `dating_posts`, and `messages` on first run (see `server/src/db/`).

No code changes are required: the existing `pg` client and `DATABASE_URL` work with Supabase.

### Optional: Supabase Auth, Realtime, Storage

- **Auth:** You could later replace or complement your JWT auth with Supabase Auth (email magic link, OAuth, etc.).
- **Realtime:** Useful for live chat or presence; you’d add Supabase Realtime subscriptions in the client.
- **Storage:** For profile pictures or uploads, you could store files in Supabase Storage instead of base64 in the DB.

Those are additive; the immediate scaling win is **Supabase = PostgreSQL = set `DATABASE_URL`**.

---

## Option 2: Render PostgreSQL (relational DB with your backend)

**What it gives you:** PostgreSQL hosted next to your backend on Render. Internal connection = fast and free of egress within the same region.

**Best for:** Keeping backend and DB on the same provider; you’re already set up for this.

### How to use it

1. On [Render](https://render.com): **New → PostgreSQL** and create a database.
2. In the PostgreSQL service, open **Info** and copy the **Internal Database URL** (not External).
3. Create or open your **Web Service** (Node/Express backend). In **Environment** add:
   ```bash
   DATABASE_URL=<paste Internal Database URL>
   ```
4. Deploy. The server runs the schema in `server/src/db/` and uses PostgreSQL for users, posts, and messages.

Full steps are in [DEPLOYMENT.md](./DEPLOYMENT.md#deploy-on-rendercom-web-service--postgresql).

---

## Option 3: Firebase (Firestore + Auth + Storage)

**What it gives you:** Firestore (NoSQL), Firebase Auth, Cloud Storage. Good free tier, very fast to prototype.

**Best for:** Apps that you want to drive heavily from the client (e.g. React + Firebase SDK), or when you prefer NoSQL and don’t need SQL.

### Trade-offs vs PostgreSQL

- **Different data model:** Firestore is document-based. You’d map each “JSON file” to a collection (e.g. `users`, `posts`, `messages`, `interests`, …).
- **Auth:** You can replace your current JWT signup/login with Firebase Auth (email link, Google, etc.) and keep or drop your Express auth.
- **Backend:** You can keep Express for some APIs and use Firebase for DB + Auth + Storage, or move more logic client-side with Firestore security rules.

### What you’d change in this repo

1. Add Firebase SDK (e.g. `firebase-admin` on server, `firebase` on client).
2. Replace JSON reads/writes with Firestore `getDoc`/`setDoc`/`collection().add()` etc. (or keep Express and use Firestore only from the server).
3. Optionally replace Express auth with Firebase Auth and verify ID tokens in middleware.
4. Optionally store profile pictures (and other files) in Firebase Storage instead of base64.

This is a larger migration than “set DATABASE_URL” but gives you one ecosystem (Auth, DB, Storage, optional Realtime).

---

## Quick comparison

| Option              | DB type    | Setup effort | Fits this repo        |
|---------------------|-----------|--------------|------------------------|
| **Supabase**        | PostgreSQL| Low          | Set `DATABASE_URL`     |
| **Render PostgreSQL** | PostgreSQL | Low        | Already documented     |
| **Firebase**        | Firestore | Higher       | Code changes required  |

**Recommendation:** To remove the main scaling limits with minimal change, use **Supabase** or **Render PostgreSQL**, set **`DATABASE_URL`**, and keep the existing code. Migrate the remaining JSON-backed features to the same PostgreSQL over time if you need them to scale.

**When usage explodes:** For scaling servers (load balancing, horizontal scaling, CDN) and optimizing matching (location-based filtering, geo queries, database indexing), see **[SCALING-GUIDE.md](./SCALING-GUIDE.md)**.
