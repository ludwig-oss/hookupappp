# Storage: images & videos (CDN / object storage)

Right now the app stores images (and sometimes video) as **base64 data URLs** in the database or JSON. That works for development but doesn’t scale: it bloats the DB, slows responses, and doesn’t use a CDN.

**Goal:** Store files in **object storage**, serve them via **CDN**, and keep only **URLs** in your app (e.g. in `profilePicture`, post `content`, highlights).

**Already in the app:** When **Cloudinary** env vars are set (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`), profile picture, highlights, and disappearing-photo uploads go to Cloudinary and only the CDN URL is stored. No code change needed—just add the env vars on Render (or in `.env`).

---

## Options (beginner-friendly)

| Provider | What it gives you | Best for |
|----------|-------------------|----------|
| **Supabase Storage** | Buckets, public/private URLs, optional RLS | You already use or plan to use Supabase. |
| **Cloudinary** | Upload API, image/video transforms, CDN | Quick setup; client or server upload; good free tier. |
| **AWS S3** (+ CloudFront) | Object storage + CDN | Full control; more config (IAM, bucket, CORS). |

On a small scale, **Supabase Storage** or **Cloudinary** is usually enough.

---

## Pattern: store URLs, not base64

1. **Upload flow**
   - Client (or server) uploads the file to your chosen provider.
   - Provider returns a **public (or signed) URL**.
   - Your API accepts that URL and saves it in the DB (e.g. `profilePicture`, post `content`, highlight `imageUrl`).

2. **Where URLs go in this app**
   - **User:** `profilePicture`, `highlights[].items[].imageUrl`, `disappearingPhotos[].imageUrl`, dating `profiles[].photos[]`.
   - **Posts:** `content` when `contentType` is `image` or `video` (store the media URL, not base64).
   - **Verification:** optional for ID / public-figure images (sensitive; consider private buckets + signed URLs).

3. **Backward compatibility**
   - Keep accepting base64 from the client for a while if you want, but in the backend **convert base64 → upload to storage → save URL** so new data is URL-only. Or add a new “upload by URL” endpoint and move the client to upload to storage first, then send the URL.

---

## Option A: Supabase Storage

1. In Supabase: **Storage** → create a bucket (e.g. `avatars`, `posts`). Set **Public** if you want direct URLs.
2. Get your project URL and anon key (or service key for server-only uploads).
3. **Server:** Install `@supabase/supabase-js`. Use the **service role** key for uploads from the backend:
   - Receive base64 or multipart from the client (or a public URL to re-host).
   - Upload to the bucket with a path like `avatars/{userId}/{filename}`.
   - Get the public URL and save it in the user/post/highlight record.
4. **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY` if you do client-side upload with RLS).
5. **Client:** Either send file to your API and let the server upload to Supabase, or use Supabase client to upload and then send the returned URL to your API.

---

## Option B: Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com); get **Cloud name**, **API Key**, **API Secret**.
2. **Server:** Install `cloudinary`. On upload (from client or server):
   - Upload the file (buffer or base64) to Cloudinary.
   - Use the returned `secure_url` as the value for `profilePicture`, post `content`, etc.
3. **Env:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
4. Optional: use **client-side upload** with an unsigned preset so the browser uploads directly and only sends the resulting URL to your backend (reduces server load).

---

## Option C: AWS S3 (+ CloudFront)

1. Create an S3 bucket; set CORS and bucket policy so your app (and optionally browser) can upload.
2. **Server:** Install `@aws-sdk/client-s3`. Generate presigned URLs for upload (or upload from server with credentials).
3. Optionally put **CloudFront** in front of the bucket for CDN URLs; store the CloudFront URL in the DB.
4. **Env:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, and optionally `CDN_BASE_URL` (CloudFront domain).

---

## Minimal server change (example)

You can add a single **upload** endpoint that:

- Accepts a file (multipart) or base64 + filename.
- Uploads to your chosen provider (Supabase / Cloudinary / S3).
- Returns `{ url: "https://..." }`.

Then the client (or existing profile/post APIs) uses that URL when updating `profilePicture`, post `content`, or highlight URLs, instead of sending base64. Existing fields already support string URLs; you only change how those strings are produced (from storage instead of data URLs).

---

## Summary

- **Current:** Images/videos are stored as base64 in the DB.
- **Target:** Store files in **Supabase Storage**, **Cloudinary**, or **S3**; keep only **URLs** in the app.
- **Real-time** (3️⃣) is already covered by SSE (and optionally Supabase/Firebase Realtime); **storage** (4️⃣) is about moving media to CDN-backed object storage and storing URLs only.
