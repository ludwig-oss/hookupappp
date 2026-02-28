# When usage explodes: scaling servers & optimizing matching

This doc covers what to do when traffic and data grow: **scale the servers** and **optimize matching** (location-based filtering, geo queries, database indexing).

---

## 1. Scale servers

### Load balancing

- **Single region:** Put a **load balancer** in front of multiple instances of your Node app so traffic is spread across replicas. On **Render**, you can increase **instance count** (e.g. 2–3); Render’s load balancer will distribute requests.
- **Multiple regions:** Use a global load balancer (e.g. **Cloudflare**, **AWS Global Accelerator**) and run your backend in more than one region, with the DB in one primary region (or multi-region if you adopt that later).

### Horizontal scaling

- Your backend is **stateless** (JWT in the request, no in-memory session store), so you can run **multiple instances** behind one load balancer without sticky sessions.
- **Render:** In the Web Service dashboard, set **Instance count** to 2 or more.
- **Database:** Keep a single PostgreSQL (or read replicas later). Connection pooling (e.g. **PgBouncer** or Supabase/Render pooling) helps when many Node instances connect.

### CDN for images

- **Profile and feed images** should be served from a CDN, not from your app server. You already support this:
  - **Cloudinary** (when `CLOUDINARY_*` is set): uploads go to Cloudinary and you store only the CDN URL. Cloudinary serves images from its global CDN.
  - **Supabase Storage** or **S3 + CloudFront**: same idea—store files in object storage and serve via CDN URLs.
- So “CDN for images” is already in place once you use **Cloudinary** (or Supabase/S3) for storage; no extra step beyond what’s in [STORAGE.md](./STORAGE.md).

---

## 2. Optimize matching

### Location-based filtering

- The app already does **location-based filtering**:
  - **Discover by city:** `GET /api/discover/city?city=...` and preferences by `city`.
  - **Nearby users:** `GET /api/connections/nearby?lat=...&lon=...&radius=...` (haversine distance on `user.location`).
  - **Places / venues:** `getPlacesNearby`, Overpass API for real places, etc.
- With **PostgreSQL**, user location is in `users.data` (JSONB). The schema includes indexes so queries that filter by city, age, gender, or “has location” can use the index (see below).

### Geo queries

- **Current approach:** In-app **haversine** distance (e.g. in `discoverController`, `connections`) over users who have `location` set. Works well for moderate user counts; all matching users are loaded and filtered in memory or with a simple DB filter.
- **When you outgrow that:** Move to **geo-aware queries** in the database:
  - **Option A – Bounding box:** Filter with `(data->'location'->>'lat')::float BETWEEN lat1 AND lat2` and same for `lon`, then refine with haversine in app or in SQL. The indexes on `data->>'city'` and “has location” help.
  - **Option B – PostGIS:** Add the **PostGIS** extension to PostgreSQL, store `lat/lon` in a `geography` or `geometry` column, and use `ST_DWithin`, `ST_Distance` for “users within X km”. This is the right long-term approach for large-scale geo matching.

### Database indexing (for matching)

- With **`DATABASE_URL`** set, the server applies a schema that includes indexes aimed at **matching** and **location**:
  - **users:** `email`, `username` (already there); **matching:** `(data->>'city')`, `(data->>'age')`, `(data->>'gender')` (partial indexes when not null); **geo:** partial index on `(data->'location')` when present so “users with location” queries are fast.
  - **dating_posts:** `created_at DESC` for feed ordering.
  - **messages:** `(from_user_id, to_user_id)` and `created_at` for conversation and ordering.
- So **indexing the database for matching** is already in place when you use PostgreSQL; run the app once so the schema (and indexes) are created. For much larger scale, add PostGIS and possibly dedicated tables for “active users by region” or materialized views, depending on your query patterns.

---

## Summary

| Area | What you have / what to do |
|------|----------------------------|
| **Load balancing** | Increase instance count on Render (or put a LB in front of multiple Node instances). |
| **Horizontal scaling** | Stateless app → add more instances; use connection pooling for the DB. |
| **CDN for images** | Use Cloudinary (or Supabase Storage / S3) and store only URLs → images are served from their CDN. |
| **Location-based filtering** | Already in place (city, nearby, places). |
| **Geo queries** | Haversine in app now; for scale add bounding-box filters or PostGIS. |
| **Indexing database** | Schema includes indexes on users (city, age, gender, has location), posts, messages. |

When usage explodes, turn up instances and CDN-backed storage first; then refine matching with geo indexes or PostGIS as data and query load grow.
