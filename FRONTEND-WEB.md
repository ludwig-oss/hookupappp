# Frontend for web: key tasks & authentication

This doc covers **key tasks for the web app** (swipe UI, responsive, touch), **Step 3: authentication** (phone, SMS, email, JWT, secure cookies, CSRF), **Step 4: web performance** (lazy load, compress, CDN, minify), **Step 5: security hardening** (XSS, rate limiting, bot detection, CAPTCHA, abuse monitoring), **Step 6: real-time messaging on web** (WebSockets, fallback polling, sync across devices), and **Step 7: payment integration** (Stripe, subscriptions, upgrade flows) so the same product works for office, desktop, and emerging markets.

---

## Key tasks: swipe UI in the browser

Recreate a swipe-style experience in the browser so desktop and mobile-web users get the same flow.

| Task | What to do | Status |
|------|------------|--------|
| **Mouse drag + click** | Card stack: drag left = pass, drag right = like/interest; or click buttons (Like / Pass). Use `pointerdown` / `pointermove` / `pointerup` (and `mousedown`/`mouseup` for fallback) to track drag delta and animate the card; on release, commit action and show next card. | Implement in discover/wheel card UI (e.g. drag threshold → API call, then remove card). |
| **Responsive design** | Layout and card size adapt to viewport (breakpoints or clamp). Nav and modals work on small and large screens. | Use existing responsive layout; ensure card stack and buttons are usable on all widths. |
| **Touch support** | Same pointer events work for touch: `pointermove`/`pointerup` and touch events so swipe left/right on mobile web works. Prevent `touch-action: none` on the card container to avoid scroll steal. | Use Pointer Events (or touch + mouse) so one implementation covers both. |

**Suggested implementation:** A single “swipeable card” component that:

- Renders one card (user/vibe) with image and actions.
- Listens for `pointerdown` → `pointermove` (track dx) → `pointerup` (if `|dx| > threshold`, treat as swipe left/right; else if click on button, use button action).
- Calls the same API you use for “Show interest” / “Pass” (e.g. `POST /api/discover/interest` or equivalent).
- Is responsive (card max-width, padding) and touch-friendly (no accidental scroll when swiping the card).

---

## Step 3: authentication update

Originally many apps were **Facebook-only**. Later they added **phone number login**, **SMS verification**, and **email login**. For **web**, they needed **secure cookie sessions**, **JWT authentication**, and **CSRF protection**.

### What this app has today

| Method | In this app |
|--------|-------------|
| **Phone number** | ✅ Signup and forgot-password can use phone; phone is stored and used for lookup. Login is **username + password** (not phone as login identifier). |
| **SMS verification** | ✅ Twilio: verification codes and password reset can be sent by SMS. |
| **Email verification** | ✅ SMTP (nodemailer): verification by token or 6-digit code; `verifyEmail`, `resendVerificationEmail`. |
| **Username + password** | ✅ Primary login: `POST /api/auth/login` with `username` and `password`; returns JWT. |
| **JWT authentication** | ✅ Token in `Authorization: Bearer <token>`. All protected APIs read the token from the header. No session store on server. |

So you already have: **username login**, **phone** (signup/forgot + SMS), and **email verification**. JWT is the main auth mechanism for the API.

### For web: secure cookie sessions

- **Current:** The client stores the JWT in memory (e.g. React state/context) or `localStorage` and sends it in the `Authorization` header. No HTTP-only cookie.
- **Optional upgrade:** To reduce XSS exposure of the token, you can have the server set an **HTTP-only, Secure, SameSite** cookie with the JWT (or a session id) on login, and the browser will send it automatically. The API would then accept either `Authorization: Bearer` or the cookie (e.g. `req.cookies.token`). Frontend would not read the token; it would just call APIs (same-origin or with `credentials: 'include'`). This is a design choice; many SPAs keep using the header with token from memory/localStorage.

### For web: CSRF protection

- **Why it matters:** If you later use **cookie-based sessions** (or cookies for JWT), cross-site request forgery (CSRF) becomes a risk: a malicious site can trigger a request that includes the user’s cookie. With **JWT only in the `Authorization` header** and no cookies for auth, CSRF is less of an issue because the attacker’s page cannot set that header (same-origin policy).
- **If you add cookies for auth:** Protect state-changing requests (POST/PUT/DELETE) with a **CSRF token**: server sends a token in a cookie (e.g. `XSRF-TOKEN`) or in the response body; client sends it back in a header (e.g. `X-CSRF-Token`). Server validates that the header matches the cookie. You can use the same pattern as many frameworks (double-submit cookie).
- **Summary:** With **JWT in header only**, you’re in good shape for web. If you move to **secure cookie sessions**, add **CSRF protection** (e.g. CSRF token in cookie + header) for non-GET requests.

---

## Step 4: web performance optimization

Browser users expect fast load. Typical requirements:

| Task | What to do | In this app |
|------|------------|-------------|
| **Lazy load images** | Load images only when in or near viewport (e.g. `loading="lazy"`, Intersection Observer, or React lazy image components). Reduces initial payload and bandwidth. | Add on feed, discover cards, and profile galleries: `loading="lazy"` on `<img>` or use a lazy-image component. |
| **Compress assets** | Serve images in modern formats (WebP/AVIF) and compressed; enable gzip/Brotli for HTML/CSS/JS. | Cloudinary can serve WebP/AVIF via URL params. Enable Brotli/gzip on Vercel (usually on by default) and on the API server for static/JSON. |
| **Use CDN** | Serve static assets and images from a CDN so users get low latency and caching. | ✅ **Frontend:** Vercel serves the SPA from a global CDN. ✅ **Images:** Cloudinary (when `CLOUDINARY_*` is set) stores and serves profile/feed images from its CDN; only URLs stored in DB. |
| **Minify JS bundles** | Production build should minify and tree-shake JS (and CSS). | ✅ **Vite** production build minifies and bundles JS/CSS; output in `client/dist` is minified. |

**Summary:** CDN and minified bundles are in place. Add **lazy loading** for images (feed, discover, profiles) and ensure **compression** (Brotli/gzip) is enabled on hosting; Cloudinary can handle image format/quality via transforms.

---

## Step 5: security hardening

Web adds new risks; dating apps are especially attractive to bots and abuse.

| Area | What to do | In this app |
|------|------------|-------------|
| **XSS protection** | Never render unsanitized user input as HTML. Sanitize/escape on input and when outputting (e.g. text content only, or a safe HTML subset). Use CSP headers to restrict script sources. | ✅ **Server:** `server/src/utils/sanitize.ts` — sanitize name, username, and text (trim, length, strip control chars); `sanitizeForDisplay` escapes for safe HTML. Auth and profile use these. Frontend should render user content as text or use a safe renderer; set **Content-Security-Policy** in production. |
| **Rate limiting** | Limit signup, login, and API calls per IP (and optionally per user) to slow brute force and scraping. | ✅ **Server:** `express-rate-limit` on signup, login, and general `/api` (see `server/src/middleware/rateLimit.ts` and auth routes). |
| **Bot detection** | Use signals (e.g. velocity of actions, headless fingerprints, too-perfect timing) or a third-party service to flag or block likely bots. | Not integrated. Consider: rate limits per endpoint, honeypot fields on signup, or a provider (e.g. Fingerprint, DataDome) for high-risk actions (signup, discover, messaging). |
| **CAPTCHA** | Challenge suspicious or high-risk requests (signup, login, password reset, or first message) to block automated abuse. | Not integrated. Add reCAPTCHA v3 / hCaptcha / Turnstile on signup and optionally login or sensitive actions; verify server-side. |
| **Abuse monitoring** | Log and alert on patterns: mass signups, spam messages, fake profiles, report spikes. Optionally auto-flag or throttle. | Not integrated. Add: structured logging for auth and messaging; metrics on signups/messages per IP or per user; alerts and manual review; optional auto-moderation (e.g. profile photo moderation status you have) and report flows. |

**Summary:** XSS mitigation (sanitization) and rate limiting are in place. For a dating app (“bot magnet”), next steps: **CAPTCHA** on signup (and optionally login/reset), **bot detection** (signals or vendor), and **abuse monitoring** (logs, metrics, alerts, reports).

---

## Step 6: real-time messaging on web

Mobile apps often use a **persistent connection** for chat. On web you need an equivalent so users see new messages and matches without refreshing.

| Requirement | Mobile (typical) | Web | In this app |
|-------------|------------------|-----|-------------|
| **Persistent connection** | Long-lived socket or push channel | **WebSockets** (bidirectional) or **SSE** (server → client) | ✅ **SSE:** `GET /api/notifications/stream?token=<JWT>` — server pushes `new_message` and `new_match` events. Client subscribes with `EventSource`. No WebSockets yet. |
| **Fallback polling** | — | If SSE/WS fails or isn’t supported, poll messages/conversations on an interval so chat still updates. | Not implemented. Add: when SSE disconnects or isn’t used, poll `GET /api/chat/conversations` or messages every N seconds and merge into UI. |
| **Message sync across devices** | Same account on phone + tablet: messages appear everywhere | Store messages in DB; each client gets updates via its own SSE/WS or polling. Web Push can notify other devices. | ✅ **DB:** Messages in PostgreSQL (when `DATABASE_URL` set). ✅ **Web Push:** Subscriptions stored per user; new message/match triggers push to all devices. ✅ **SSE:** One stream per tab; refetch or re-open stream to sync. Optional: add WebSockets for true bidirectional chat and less refetch. |

**Summary:** SSE notification stream and Web Push give web real-time *notifications*; chat UI can refetch on `new_message` or use the stream. Add **fallback polling** when SSE isn’t connected. For higher scale or lower latency, add **WebSockets** (e.g. Socket.io) for chat and keep SSE or push for notifications; then messages sync across devices via DB + per-device connections.

---

## Step 7: payment integration (later stage)

Apps like Tinder monetize with **Tinder Plus**, **Boost**, **Gold** (Match Group). A web version needs **Stripe integration**, **subscription handling**, and **upgrade flows**.

| Requirement | What to do | In this app |
|-------------|------------|-------------|
| **Stripe integration** | Accept cards and manage payment methods; create PaymentIntents or use Stripe Checkout / Customer Portal for subscriptions. | ✅ **Backend:** Stripe used for premium (env: `STRIPE_*`). **Client:** `premiumAPI` (plans, status, subscribe, cancel, history); `VITE_STRIPE_PUBLISHABLE_KEY` for Stripe.js. PayPal used for expert-session/guide payments (`PAYPAL_*`). |
| **Subscription handling** | Create subscription, track status (active/cancelled/expired), renewal, and webhooks for payment success/failure. | ✅ **Premium:** `GET /api/premium/plans`, `GET /api/premium/status`, `POST /api/premium/subscribe` (planId + paymentMethodId), `POST /api/premium/cancel`, `GET /api/premium/history`. Subscription state and payment history in backend (see `ARCHITECTURE.md`). |
| **Upgrade flows** | In-app surfaces to see plans, upgrade, manage subscription, cancel. | ✅ **Client:** Premium plans and status (e.g. `SettingsWidgetFull`, premium API); subscribe and cancel flows. Add or refine: dedicated upgrade/paywall screens, Boost/Gold-style one-off purchases if you add those products. |

**Summary:** Stripe (premium) and PayPal (expert sessions) are integrated; subscription handling and basic upgrade/cancel flows exist. For a “Tinder-style” web product, extend with **Boost**- or **Gold**-style one-off purchases and clear paywall/upgrade UI as needed.

---

## Architecture (unchanged)

```
Browser (React App)
       ↓
API Server (Node + Express, REST)
       ↓
Database + Storage
```

The same REST API serves the web app (and can serve a future mobile app). Auth is **JWT** in the `Authorization` header; optional later: cookie-based session + CSRF for web.
