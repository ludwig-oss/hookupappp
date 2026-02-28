# App architecture (backend & real-time)

This doc maps the stack to a typical dating-app backend (auth, matches, messaging, payments, real-time).

---

## 1️⃣ Matching & ranking (discover stack)

How profiles are **ordered** in discover (who you see first) affects engagement and perceived quality. Common approaches:

| Approach | Description | In this app |
|----------|-------------|-------------|
| **ELO-style score (rumored early system)** | Like chess: each user has a rating; swiping right on you boosts your score when the rater’s score is high, and vice versa. Who you see is influenced by your own rating band. Rumored in early Tinder; keeps “desirable” users seeing each other and reduces spam visibility. | ❌ Not implemented. Discover is **filter-based** (city, age, gender, orientation) with **no numeric ranking**. To add: store per-user ELO (or similar); on each swipe/interest, update both users’ scores with a formula (e.g. expected vs actual outcome); sort discover stack by score band or score-weighted sampling. |
| **Desirability scoring** | A single “desirability” or attractiveness score per user, inferred from likes/matches/replies and optionally profile completeness or verification. Show “more desirable” users to more people, or mix by score so everyone sees a range. | ❌ Not implemented. You have **user ratings** (`/api/ratings`: overall 0–100, characteristics) and unmatch reasons; these could feed a desirability metric but are not used to order discover. Optional: aggregate ratings + match/like/reply rates into a desirability score; use it to rank or sample discover. |
| **Machine learning ranking** | A model predicts “probability of mutual match” or “engagement” per (viewer, profile) pair using features: demographics, preferences, past swipes, photo/profile signals, timing. Discover order = model score. Industry standard at scale. | ❌ Not implemented. No ML pipeline or ranking model. To add later: feature store (user + candidate features), training pipeline (labels from matches/replies/session length), inference at request time to sort or filter the discover stack. |

**Summary:** Discover today is **filter-only** (preferences + city/place); **order is unspecified** (no ELO, desirability, or ML). For a more “Tinder-like” feel, introduce **ELO or desirability** first (simpler), then consider **ML ranking** when you have enough engagement data.

---

## 2️⃣ Backend

| Layer | What it does | In this app |
|-------|----------------|-------------|
| **Runtime** | Node.js + Express | ✅ `server/` – Express REST API (no GraphQL; can add later if needed). |
| **Authentication** | Login, signup, sessions | ✅ JWT in `Authorization: Bearer <token>`. Controllers: `authController`, middleware `auth.ts`. |
| **Business logic** | Likes, matches, messaging | ✅ Likes: `posts` (like, comment, share). Matches: `discover` (interests, preferences, respond). Messaging: `chat` (send, conversations, read). |
| **Email verification** | Verify email/phone | ✅ `verifyEmail`, `resendVerificationEmail`; SMTP (nodemailer) + Twilio SMS. |
| **Push / SMS** | Notifications | ✅ Twilio for SMS (verification, password reset). Push: not implemented (could add FCM/OneSignal). |
| **Database** | Users, swipes, chats, payments | ✅ With `DATABASE_URL`: PostgreSQL for **users**, **dating_posts**, **messages**. Rest still JSON (see [SCALING.md](./SCALING.md)). |
| **Payment gateway** | Premium / subscriptions | ✅ Stripe (premium), PayPal (expert sessions). Env: `STRIPE_*`, `PAYPAL_*`. |

So the backend already covers: Node + Express, auth (JWTs), email/SMS verification, likes/matches/messaging, DB (PostgreSQL when configured), and payments (Stripe/PayPal).

---

## 3️⃣ Real-time features

Messaging and “swipe” (match) updates can be real-time so users see new messages and new matches without refreshing.

| Approach | Scale | In this app |
|----------|--------|-------------|
| **REST only** | Any | ✅ Current default: client polls or refetches on focus/navigation. |
| **Server-Sent Events (SSE)** | Small/medium | ✅ Optional: `GET /api/notifications/stream` – subscribe for new-message (and optionally new-match) events. |
| **WebSockets (e.g. Socket.io)** | Medium | ❌ Not added; can add if you need bidirectional real-time. |
| **Supabase / Firebase Realtime** | Small scale | ❌ Not integrated; good option if you move more to Supabase/Firebase (see [SCALING.md](./SCALING.md)). |

### Using real-time in the client

- **SSE (included):** Subscribe to `GET /api/notifications/stream?token=<JWT>`. Listen for events:
  - `connected` – stream ready
  - `new_message` – data: `{ type, fromUserId, conversationId, messageId }` → refresh conversation or show in-app notification
  - `new_match` – data: `{ type, fromUserId, interestId }` → refresh interests list or show “New match!”  
  Example: `const es = new EventSource(API_URL + '/api/notifications/stream?token=' + token); es.addEventListener('new_message', () => refreshConversations());`
- **Supabase Realtime:** If you use Supabase for Postgres, you can subscribe to table changes (e.g. `messages`, `interests`) from the client for true real-time without polling.
- **Firebase:** Same idea with Firestore listeners.

So: for a **small scale**, the app’s SSE stream or Supabase/Firebase Realtime is enough for real-time messaging and match updates.

### Mutual matches

- **GET /api/discover/matches** — Returns your **mutual matches**: users with an accepted interest in either direction (you accepted them or they accepted you). Response: `{ matches: Array<{ id, name, username, profilePicture, ... }> }` (respects celebrity masking).

### Push notifications

- **Server:** When a new message is sent or an interest is accepted, the server sends a **Web Push** to the recipient’s registered subscriptions (if VAPID keys and a subscription are present). Subscriptions are stored per user.
- **Register subscription:** **POST /api/notifications/push-subscribe** with `Authorization: Bearer <token>` and body `{ subscription: { endpoint, keys: { p256dh, auth } } }` (the object from `PushManager.subscribe()` in the browser).
- **Client:** Request notification permission, create a service worker that calls `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`, then POST the resulting subscription to `/api/notifications/push-subscribe`. Generate VAPID keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optionally `VAPID_MAILTO` in the server env.

---

## 4️⃣ Storage (images & videos)

Images and videos should be stored separately from the database and served via a CDN for performance and scaling.

| Approach | Use case | In this app |
|----------|----------|-------------|
| **Inline / base64** | Prototype, tiny images | ✅ Current: profile pictures, highlights, post media, and some verification images are stored as base64 data URLs in the DB or JSON. Fine for dev; not ideal for production at scale. |
| **CDN object storage** | Production media | ❌ Not integrated. Use **AWS S3**, **Supabase Storage**, or **Cloudinary** and store only URLs in the DB. |

### What to move to object storage

- **Profile pictures** – `profilePicture`, highlights, disappearing photos
- **Love Life feed** – post images/videos (`content` when `contentType` is `image` or `video`)
- **Verification / IDs** – public figure images, ID uploads (optional, sensitive)

### Options (beginner-friendly)

| Provider | What you get | Notes |
|----------|----------------|-------|
| **Supabase Storage** | Buckets, CDN-style URLs, optional RLS | Fits if you already use Supabase Postgres; same dashboard. |
| **Cloudinary** | Image/video upload, transforms, CDN | Simple API; good free tier; client or server upload. |
| **AWS S3** | Object storage; use with CloudFront for CDN | Industry standard; more setup (IAM, bucket, CORS). |

See **[STORAGE.md](./STORAGE.md)** for how to add one of these and store only URLs in the app (no base64 in DB).

---

## Summary

- **Backend:** Node.js + Express handles auth (JWTs), email/SMS verification, likes, matches, messaging, business logic, and talks to PostgreSQL (when `DATABASE_URL` is set) and Stripe/PayPal.
- **Database:** PostgreSQL stores users, Love Life posts, and chat; remaining data is still JSON until migrated.
- **Real-time:** Optional SSE endpoint for notifications; for more scale, use WebSockets or Supabase/Firebase Realtime.
- **Storage:** Images/videos are currently base64 inline; for scale, use S3 / Supabase Storage / Cloudinary and store only URLs (see [STORAGE.md](./STORAGE.md)).
