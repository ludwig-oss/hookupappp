# Google, Apple & Facebook sign-in (Render + Vercel)

OAuth must **never** redirect users to your Render URL directly — they would see Render’s “APPLICATION LOADING” splash. Redirect URIs must point at your **Vercel app**; the app wakes the API, then finishes sign-in.

## Render environment (required)

Set on **Render** → Environment:

- `FRONTEND_URL` = `https://YOUR_VERCEL_APP.vercel.app` (e.g. `https://hookupapppp.vercel.app`)
- **Do not** set `OAUTH_CALLBACK_BASE` to your Render URL. Leave it unset or set it to the same Vercel URL as `FRONTEND_URL`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` (optional)
- Apple: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (optional)

Redeploy Render after saving env vars.

## Vercel environment

- `BACKEND_URL` = your Render API URL (e.g. `https://hookupappp.onrender.com`) — **not** the Vercel site URL.

## 1. Google

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. OAuth 2.0 Client ID (Web application)
3. **Authorized redirect URIs** (use your real Vercel domain):

   - `https://YOUR_VERCEL_APP.vercel.app/auth/oauth-return/google`

   Remove old Render-only URIs like `https://….onrender.com/api/auth/google/callback` if present.

## 2. Apple

1. Apple Developer → Sign in with Apple → Services ID
2. **Return URLs**:

   - `https://YOUR_VERCEL_APP.vercel.app/auth/oauth-return/apple`

## 3. Facebook

1. [Facebook Developers](https://developers.facebook.com/apps) → Facebook Login
2. **Valid OAuth Redirect URIs**:

   - `https://YOUR_VERCEL_APP.vercel.app/auth/oauth-return/facebook`

## How it works

1. User taps Google/Apple on Vercel → app pings `/api/health` until Render is awake.
2. Browser opens `/api/auth/google` (proxied to Render) → Google login.
3. Google redirects to `/auth/oauth-return/google` on **Vercel** (not Render).
4. That page wakes the API again, then calls `/api/auth/google/callback` to finish login.

## Check

`GET https://YOUR_VERCEL_APP.vercel.app/api/auth/oauth/status`  
→ `{ "google": true, "facebook": true, "apple": true }` when configured.
