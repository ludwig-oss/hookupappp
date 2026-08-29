# Google & Facebook sign-in (Render + Vercel)

The app supports Google and Facebook OAuth. Buttons always appear on Login; they work once keys are set on **Render**.

## 1. Google

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create **OAuth 2.0 Client ID** (Web application).
3. **Authorized redirect URIs** (add both if unsure):
   - `https://YOUR_VERCEL_APP.vercel.app/api/auth/google/callback`
   - `https://hookupappp.onrender.com/api/auth/google/callback`
4. On **Render** → Environment, set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `FRONTEND_URL` = `https://YOUR_VERCEL_APP.vercel.app`
   - `OAUTH_CALLBACK_BASE` = `https://YOUR_VERCEL_APP.vercel.app` (so redirects go through Vercel’s `/api` proxy)

## 2. Facebook

1. Open [Facebook Developers](https://developers.facebook.com/apps) → your app → Facebook Login.
2. **Valid OAuth Redirect URIs**:
   - `https://YOUR_VERCEL_APP.vercel.app/api/auth/facebook/callback`
3. On **Render**, set:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`

## 3. Redeploy Render

After saving env vars, **Manual Deploy** on Render so the API picks them up.

## Check

`GET https://YOUR_VERCEL_APP.vercel.app/api/auth/oauth/status`  
→ `{ "google": true, "facebook": true }` when configured.
