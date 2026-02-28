# Deploy to Netlify (frontend + API redirect) and Render (backend)

Your app has **two parts**: the **frontend** (React) on Netlify and the **backend** (Node API) on Render. Netlify proxies `/api/*` to your backend so login, signup, posts, chat, and all API features work.

---

## 1. Deploy the backend (API) on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**.
2. Connect **this GitHub repo**.
3. Render will use **`render.yaml`** in the repo. If not, set:
   - **Build command:** `npm run install:all && npm run build`
   - **Start command:** `node server/dist/index.js`
   - **Environment variables:**  
     - **JWT_SECRET** – generate or set (min 32 characters).  
     - **FRONTEND_URL** – your Netlify site URL (e.g. `https://your-app.netlify.app`). Set this after you deploy the frontend.
4. Deploy. Copy your **backend URL** (e.g. `https://aswp-api.onrender.com`).

---

## 2. Add the API redirect and deploy the frontend on Netlify

1. **Set the backend URL for the redirect**  
   In **`netlify.toml`**, find the line:
   ```toml
   to = "https://YOUR-BACKEND-URL/api/:splat"
   ```  
   Replace **`YOUR-BACKEND-URL`** with your Render backend URL **without** `https://` (e.g. `aswp-api.onrender.com`), so it becomes:
   ```toml
   to = "https://aswp-api.onrender.com/api/:splat"
   ```  
   Commit and push.

2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project** → connect this repo.
3. Netlify will use **`netlify.toml`**:
   - **Build:** `npm run install:all && cd client && npm run build:skip-typecheck`
   - **Publish:** `client/dist`
   - **Redirect:** `/api/*` → your backend (from step 1).
4. Deploy. Your app will be at `https://your-site.netlify.app`. All API features (login, signup, posts, chat, etc.) will work because `/api` is proxied to Render.

---

## 3. Set FRONTEND_URL on the backend

On **Render** → your Web Service → **Environment**:

- **FRONTEND_URL** = `https://your-site.netlify.app` (your real Netlify URL)

This is used for login emails and CORS.

---

## Scaling to very large numbers of users (millions / billions)

The current app stores data in **JSON files** on the server. That is fine for small/medium use but **does not scale** to millions or billions of users (single server, no real database).

To scale to very high traffic you would:

1. **Move to a real database** (e.g. PostgreSQL, MongoDB) instead of JSON files.
2. **Run the backend on a scalable platform** (e.g. multiple instances, Kubernetes, or a managed backend like Supabase/Firebase).
3. **Use a CDN** (Netlify already serves the frontend from a CDN).
4. **Add caching, rate limiting, and horizontal scaling** for the API.

For now, Netlify + Render gives you a working deploy that can handle a lot of users; when you need more, you’ll need to replace file storage with a database and scale the backend.
