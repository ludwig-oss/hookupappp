# Google sign-in — baby steps (click here, then here)

You are creating a **Google “Web application” key** so Hook Up can open the Google account picker, read Gmail + name + photo, and send the user back to the app. No Firebase. No extra Google button library.

Do **Part A** once in Google. Then **Part B** on this computer. Then **Part C** on Render for the live site.

---

## Part A — Google Cloud (the keys)

### A1. Open the right Google page

1. In Chrome, open [https://console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients)
2. Sign in with the **Gmail you want to own the app** (your developer account).
3. Look at the **top bar**, next to the Google Cloud logo. There is a project picker (it may say **Select a project** or an old project name).
   - Click that name / **Select a project**.
   - If you already have a project for Hook Up, click it.
   - If the list is empty: click **New project** (top right of that dialog) → Project name: `Hook Up` → **Create**. Wait a few seconds, then open the picker again and select `Hook Up`.

### A2. First-time branding (only if Google asks)

If the page says **Google Auth platform not configured yet** (or **Get started**):

1. Click the blue **Get started** button.
2. **App information**
   - **App name:** `Hook Up` (this is what people see on Google’s permission screen).
   - **User support email:** click the dropdown and pick **your Gmail**.
   - Click **Next** (bottom).
3. **Audience**
   - Click **External** (so any Gmail can sign in later).
   - Click **Next**.
4. **Contact information**
   - Type the **same Gmail** again.
   - Click **Next**.
5. **Finish**
   - Tick **I agree to the Google API Services: User Data Policy**.
   - Click **Continue**, then **Create**.

If branding is already done, skip to A3.

### A3. Let yourself test while the app is in “Testing”

Google will block random Gmails until the app is published. Add yourself:

1. Left sidebar: click **Google Auth platform** (sometimes under the hamburger ☰ at the far left).
2. Click **Audience** (under Google Auth platform).
3. Scroll to **Test users**.
4. Click **Add users**.
5. Type **your Gmail** → **Save**.

Until you click **Publish app** later, only these test users can use Continue with Google.

### A4. Create the Web client (this is the actual ID + secret)

1. Left sidebar: **Google Auth platform** → **Clients**.  
   (If you do not see that: top search bar, type `clients`, click **Clients** / **Google Auth platform**.)
2. Near the **top**, click **Create client** (or **CREATE CLIENT**).
3. **Application type:** click the dropdown → choose **Web application**.  
   (Not Android, not iOS, not Desktop.)
4. **Name:** `Hook Up web` (only you see this name in Google).
5. Find the box **Authorized JavaScript origins**.  
   Next to it click **Add URI**. Paste, one per line (click **Add URI** again for each extra row):

   ```
   http://localhost:5173
   https://hookupapp.dev
   https://hookupapppp.vercel.app
   ```

   No slash at the end. No `/login`. Just the origin.

6. Find the box **Authorized redirect URIs** (directly under the origins box).  
   Click **Add URI** for each of these. Copy them **exactly**:

   ```
   http://localhost:5173/auth/oauth-return/google
   https://hookupapp.dev/auth/oauth-return/google
   https://hookupapppp.vercel.app/auth/oauth-return/google
   ```

   Wrong path (this will fail): anything with `onrender.com` or `/api/auth/google/callback`.

7. Scroll to the bottom of that form → click **Create**.

### A5. Copy the two values (do this immediately)

A popup appears with **Your Client ID** and **Your Client Secret**.

- **Client ID** looks like `123456789-abcdef.apps.googleusercontent.com`
- **Client Secret** looks like a random string (treat it like a password)

**Copy both now.** New Google clients often show the secret **only this once**. You can also click **Download JSON** on that popup and keep the file off git.

Then click **OK**.

If you already closed the popup: open the client in the list (click the name `Hook Up web`). The **Client ID** is still visible. If the secret is hidden, click **Add secret** / reset secret, copy the new one, and use that.

---

## Part B — this computer (localhost)

### B1. Paste into `server/.env`

1. In Cursor, left file tree, open the **`server`** folder.
2. Open the file **`.env`** (same folder as `env.example`).  
   If you do not see it: it may be hidden; use File → Open File and pick `C:\Users\luigr\aswp\server\.env`.
3. Find these two lines (they were added empty). If they are missing, add them at the bottom:

   ```
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```

4. Paste **with no quotes and no spaces** after the `=`:

   ```
   GOOGLE_CLIENT_ID=paste-the-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=paste-the-client-secret-here
   ```

5. Confirm this line exists too (local app URL):

   ```
   FRONTEND_URL=http://localhost:5173
   ```

6. Save the file (`Ctrl+S`). **Do not commit `.env`.**

### B2. Restart the API

The running Node server only reads `.env` at startup.

1. In the terminal that is running the backend (the one that printed something like `listening on 5000`).
2. Click that terminal → `Ctrl+C` to stop it.
3. Start it again the same way you usually do (`npm run dev` in `server`, or your root script).
4. Wait until it says it is listening.

### B3. Check, then click Google

1. In the browser open [http://localhost:5173/api/auth/oauth/status](http://localhost:5173/api/auth/oauth/status)  
   You want `"google": true`. If it is still `false`, `.env` was not saved or the API was not restarted.
2. Open [http://localhost:5173/login](http://localhost:5173/login)
3. Click **Sign in with Google**.
4. Pick **the Gmail you added as a test user**.
5. You should land back in Hook Up, not on the red “not configured” banner.

---

## Part C — live site (Render)

Same two Google values, on the API host.

1. Open [https://dashboard.render.com](https://dashboard.render.com) and sign in.
2. Click the **Hook Up API** service (the one whose URL is like `hookupappp.onrender.com` — **not** a static site).
3. Near the **top tabs** of that service, click **Environment**.
4. Click **Add Environment Variable** (or edit if the name already exists).
5. Add / set:

   | Key | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | the same Client ID as in `.env` |
   | `GOOGLE_CLIENT_SECRET` | the same Client Secret as in `.env` |
   | `FRONTEND_URL` | `https://hookupapp.dev` |

6. **Save**. Render will redeploy (wait until the deploy is Live).
7. Check [https://hookupapp.dev/api/auth/oauth/status](https://hookupapp.dev/api/auth/oauth/status) → `"google": true`.
8. On [https://hookupapp.dev/login](https://hookupapp.dev/login) click **Sign in with Google**.

Do **not** put the Google secret in Vercel. Vercel only needs `BACKEND_URL` pointing at Render.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Red banner: not configured / add to `server/.env` | Part B: keys empty, or API not restarted |
| Google error `redirect_uri_mismatch` | Part A4: redirect URI must be exactly `…/auth/oauth-return/google` |
| Google: app is in testing / access denied | Part A3: add that Gmail as a test user |
| Render splash / APPLICATION LOADING | Redirect URI was set to `onrender.com` — remove it, use hookupapp.dev / localhost as above |

---

## Leftover: Apple / Facebook (optional)

Same redirect shape: `{app}/auth/oauth-return/apple` and `{app}/auth/oauth-return/facebook`. Set `FACEBOOK_*` / `APPLE_*` on Render the same way as Google.

## How the Google click works

1. User taps Google → app pings `/api/health` until the API is awake.
2. Browser opens `/api/auth/google` (proxied to the API) → Google login.
3. Google redirects to `/auth/oauth-return/google` on the **app** (localhost or Vercel, not Render).
4. That page wakes the API again, then calls `/api/auth/google/callback` to finish login.
