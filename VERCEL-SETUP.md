# Get Your Dating App Online (Vercel + Render) — Do This Today

Your app has two parts: **frontend** (Vercel) and **backend API** (Render). Both must be deployed and connected.

---

## Step 1: Push code to GitHub (if not done)

In terminal (folder: `c:\Users\luigr\aswp`):

```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Use the **exact** URL from GitHub: repo page → green **Code** → copy **HTTPS** link.

---

## Step 2: Deploy the backend (Render)

1. Go to [render.com](https://render.com) and sign in (or use GitHub).
2. **New** → **Web Service**.
3. Connect your **GitHub repo** (the one you pushed).
4. Render will see `render.yaml`. Use:
   - **Build Command:** `npm run install:all && npm run build`
   - **Start Command:** `npm run start` or `node server/dist/index.js`
   - **Root Directory:** leave empty (repo root).
5. **Environment** (in Render dashboard):
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = create a long random string (e.g. 32+ characters).
   - `FRONTEND_URL` = leave empty for now (you’ll set it after Vercel).
6. Click **Create Web Service**. Wait for the first deploy.
7. Copy your **backend URL** (e.g. `https://aswp-xxxx.onrender.com`). You need it for Step 3.

---

## Step 3: Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in with **GitHub**.
2. **Add New** → **Project** → import the **same GitHub repo**.
3. Vercel will use the repo root and `vercel.json`. Do **not** set Root to `client`.
4. **Environment Variables** (before deploying):
   - **Name:** `VITE_API_URL`  
   - **Value:** your Render backend URL from Step 2 (e.g. `https://aswp-xxxx.onrender.com`)  
   - No trailing slash.
5. Click **Deploy**. Wait for the build to finish.
6. Copy your **frontend URL** (e.g. `https://aswp.vercel.app`).

---

## Step 4: Connect frontend and backend

1. **Render** → your Web Service → **Environment**.
2. Set **FRONTEND_URL** = your Vercel URL (e.g. `https://aswp.vercel.app`).
3. Save. Render will redeploy so CORS allows your Vercel domain.

---

## Step 5: Test the app online

1. Open your **Vercel URL** in the browser.
2. Sign up / log in. All requests go to Render; the app should work like a normal dating app.

---

## If something breaks

- **“Network Error” or API fails:** Check **VITE_API_URL** on Vercel = exact Render URL (https, no slash at end). Check **FRONTEND_URL** on Render = exact Vercel URL.
- **CORS error:** Backend must have **FRONTEND_URL** set to your Vercel domain.
- **Build fails on Vercel:** Ensure repo has `vercel.json` at root and `package.json` at root. No need for `next.config.js` (this is Vite).

---

## Quick reference

| Where   | What to set        | Example                          |
|--------|--------------------|-----------------------------------|
| Vercel | `VITE_API_URL`     | `https://aswp-xxxx.onrender.com` |
| Render | `FRONTEND_URL`     | `https://aswp.vercel.app`       |
| Render | `JWT_SECRET`       | long random string               |
| Render | `NODE_ENV`         | `production`                     |

Frontend (Vercel) and backend (Render) must both be deployed and point at each other like this.
