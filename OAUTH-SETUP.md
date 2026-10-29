# Google, Apple & Facebook sign-in

OAuth must **never** redirect users to your Render URL directly — they would see Render’s “APPLICATION LOADING” splash. Redirect URIs must point at the **app** (localhost while developing, Vercel / hookupapp.dev in production). The app wakes the API, then finishes sign-in.

## Local (`server/.env`)

Copy from `server/env.example` if needed. For Google on this computer:

```
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Restart the API after saving. Confirm:

`GET http://localhost:5173/api/auth/oauth/status` → `{ "google": true, ... }`

## Render environment (live)

Set on **Render** → Environment:

- `FRONTEND_URL` = `https://hookupapp.dev` (or your Vercel URL, e.g. `https://hookupapppp.vercel.app`)
- **Do not** set `OAUTH_CALLBACK_BASE` to your Render URL. Leave it unset or set it to the same public app URL as `FRONTEND_URL`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` (optional)
- Apple: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (optional)

Redeploy Render after saving env vars.

## Vercel environment

- `BACKEND_URL` = your Render API URL (e.g. `https://hookupappp.onrender.com`) — **not** the Vercel site URL.

## 1. Google

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** → **Web application**
3. **Authorized JavaScript origins**

   - `http://localhost:5173`
   - `https://hookupapp.dev`
   - `https://hookupapppp.vercel.app`

4. **Authorized redirect URIs** (must match exactly — this path, not `/api/auth/google/callback`):

   - `http://localhost:5173/auth/oauth-return/google`
   - `https://hookupapp.dev/auth/oauth-return/google`
   - `https://hookupapppp.vercel.app/auth/oauth-return/google`

   Remove old Render-only URIs like `https://….onrender.com/api/auth/google/callback` if present.

5. Paste the client ID and secret into `server/.env` (local) **and** Render (live).

## 2. Apple

1. Apple Developer → Sign in with Apple → Services ID
2. **Return URLs**:

   - `http://localhost:5173/auth/oauth-return/apple`
   - `https://hookupapp.dev/auth/oauth-return/apple`
   - `https://YOUR_VERCEL_APP.vercel.app/auth/oauth-return/apple`

## 3. Facebook

1. [Facebook Developers](https://developers.facebook.com/apps) → Facebook Login
2. **Valid OAuth Redirect URIs**:

   - `http://localhost:5173/auth/oauth-return/facebook`
   - `https://hookupapp.dev/auth/oauth-return/facebook`
   - `https://YOUR_VERCEL_APP.vercel.app/auth/oauth-return/facebook`

## How it works

1. User taps Google/Apple → app pings `/api/health` until the API is awake.
2. Browser opens `/api/auth/google` (proxied to the API) → Google login.
3. Google redirects to `/auth/oauth-return/google` on the **app** (localhost or Vercel, not Render).
4. That page wakes the API again, then calls `/api/auth/google/callback` to finish login.

## Check

`GET https://hookupapp.dev/api/auth/oauth/status`  
→ `{ "google": true, "facebook": true, "apple": true }` when configured.
