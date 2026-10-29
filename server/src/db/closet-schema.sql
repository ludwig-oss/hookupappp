-- Closet configuration, category maps, custom sub-tags, ownership, itinerary sync.
-- Applied on API startup (runSchema) and safe to run in psql against DATABASE_URL.

CREATE TABLE IF NOT EXISTS closet_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO closet_categories (id, slug, label, sort_order) VALUES
  ('cat-top', 'top', 'Top', 10),
  ('cat-bottom', 'bottom', 'Bottom', 20),
  ('cat-outerwear', 'outerwear', 'Outerwear', 30),
  ('cat-shoes', 'shoes', 'Shoes', 40),
  ('cat-accessory', 'accessory', 'Accessory', 50)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

-- Global tags (user_id IS NULL) plus per-user custom tags (e.g. "plaid").
CREATE TABLE IF NOT EXISTS closet_sub_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT closet_sub_tags_slug_ok CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,47}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_closet_sub_tags_global_slug
  ON closet_sub_tags (slug) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_closet_sub_tags_user_slug
  ON closet_sub_tags (user_id, slug) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_closet_sub_tags_user ON closet_sub_tags (user_id);

INSERT INTO closet_sub_tags (id, user_id, slug, label) VALUES
  ('tag-plaid', NULL, 'plaid', 'Plaid'),
  ('tag-velvet', NULL, 'velvet', 'Velvet'),
  ('tag-shimmer', NULL, 'shimmer', 'Shimmer'),
  ('tag-solid', NULL, 'solid', 'Solid'),
  ('tag-stripe', NULL, 'stripe', 'Stripe'),
  ('tag-floral', NULL, 'floral', 'Floral'),
  ('tag-90s', NULL, '90s', '90s'),
  ('tag-preppy', NULL, 'preppy', 'Preppy'),
  ('tag-casual', NULL, 'casual', 'Casual')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, label = EXCLUDED.label;

CREATE TABLE IF NOT EXISTS closet_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES closet_categories(id),
  name TEXT NOT NULL,
  color TEXT,
  pattern TEXT,
  image_url TEXT,
  -- TRUE = owned closet piece; FALSE = shopping recommendation / unowned.
  is_owned BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'closet'
    CHECK (source IN ('closet', 'shop', 'upload', 'catalog')),
  shop_url TEXT,
  shop_price_eur NUMERIC(12,2),
  worn BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closet_items_user_cat ON closet_items (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_closet_items_owned ON closet_items (user_id, is_owned);
CREATE INDEX IF NOT EXISTS idx_closet_items_pattern ON closet_items (user_id, lower(pattern));

CREATE TABLE IF NOT EXISTS closet_item_tags (
  item_id TEXT NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES closet_sub_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_closet_item_tags_tag ON closet_item_tags (tag_id);

-- Named saved looks / current dressed state for a user.
CREATE TABLE IF NOT EXISTS closet_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Current look',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closet_configs_user ON closet_configs (user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_closet_configs_one_active
  ON closet_configs (user_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS closet_config_slots (
  config_id TEXT NOT NULL REFERENCES closet_configs(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES closet_categories(id),
  item_id TEXT NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
  PRIMARY KEY (config_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_closet_config_slots_item ON closet_config_slots (item_id);

-- Calendar dates the Clueless engine dresses for.
CREATE TABLE IF NOT EXISTS itinerary_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  starts_at TIMESTAMPTZ,
  occasion TEXT NOT NULL DEFAULT 'everyday'
    CHECK (occasion IN ('everyday', 'special_event', 'work', 'night_out')),
  title TEXT,
  destination TEXT,
  budget_for_shopping_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itinerary_events_user_date ON itinerary_events (user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_itinerary_events_occasion ON itinerary_events (user_id, occasion);

-- Sync pipeline: wardrobe inputs attached to a specific itinerary date.
CREATE TABLE IF NOT EXISTS itinerary_look_sync (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES closet_items(id) ON DELETE SET NULL,
  config_id TEXT REFERENCES closet_configs(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'piece'
    CHECK (role IN ('piece', 'look', 'shop_fill')),
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'running', 'synced', 'failed', 'skipped')),
  error TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, item_id, role)
);

CREATE INDEX IF NOT EXISTS idx_itinerary_look_sync_user_status
  ON itinerary_look_sync (user_id, sync_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_itinerary_look_sync_event
  ON itinerary_look_sync (event_id, sync_status);

CREATE TABLE IF NOT EXISTS closet_sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES itinerary_events(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'wardrobe_to_itinerary'
    CHECK (job_type IN ('wardrobe_to_itinerary', 'itinerary_to_wardrobe', 'monthly_check_in')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  items_seen INT NOT NULL DEFAULT 0,
  items_linked INT NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closet_sync_jobs_user ON closet_sync_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_closet_sync_jobs_open ON closet_sync_jobs (status) WHERE status IN ('pending', 'running');

-- RLS: owner-only rows; global category/tag catalogs are readable by any signed-in user.
ALTER TABLE closet_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_categories_read ON closet_categories;
CREATE POLICY closet_categories_read ON closet_categories FOR SELECT USING (
  app_rls_bypass() OR app_current_user_id() IS NOT NULL
);
DROP POLICY IF EXISTS closet_categories_write ON closet_categories;
CREATE POLICY closet_categories_write ON closet_categories FOR ALL USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());

ALTER TABLE closet_sub_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_sub_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_sub_tags_select ON closet_sub_tags;
CREATE POLICY closet_sub_tags_select ON closet_sub_tags FOR SELECT USING (
  app_rls_bypass()
  OR user_id IS NULL
  OR user_id = app_current_user_id()
);
DROP POLICY IF EXISTS closet_sub_tags_write ON closet_sub_tags;
CREATE POLICY closet_sub_tags_write ON closet_sub_tags FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE closet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_items_own ON closet_items;
CREATE POLICY closet_items_own ON closet_items FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE closet_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_item_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_item_tags_own ON closet_item_tags;
CREATE POLICY closet_item_tags_own ON closet_item_tags FOR ALL USING (
  app_rls_bypass()
  OR EXISTS (
    SELECT 1 FROM closet_items i
    WHERE i.id = closet_item_tags.item_id AND i.user_id = app_current_user_id()
  )
) WITH CHECK (
  app_rls_bypass()
  OR EXISTS (
    SELECT 1 FROM closet_items i
    WHERE i.id = closet_item_tags.item_id AND i.user_id = app_current_user_id()
  )
);

ALTER TABLE closet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_configs_own ON closet_configs;
CREATE POLICY closet_configs_own ON closet_configs FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE closet_config_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_config_slots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_config_slots_own ON closet_config_slots;
CREATE POLICY closet_config_slots_own ON closet_config_slots FOR ALL USING (
  app_rls_bypass()
  OR EXISTS (
    SELECT 1 FROM closet_configs c
    WHERE c.id = closet_config_slots.config_id AND c.user_id = app_current_user_id()
  )
) WITH CHECK (
  app_rls_bypass()
  OR EXISTS (
    SELECT 1 FROM closet_configs c
    WHERE c.id = closet_config_slots.config_id AND c.user_id = app_current_user_id()
  )
);

ALTER TABLE itinerary_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itinerary_events_own ON itinerary_events;
CREATE POLICY itinerary_events_own ON itinerary_events FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE itinerary_look_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_look_sync FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itinerary_look_sync_own ON itinerary_look_sync;
CREATE POLICY itinerary_look_sync_own ON itinerary_look_sync FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE closet_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_sync_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closet_sync_jobs_own ON closet_sync_jobs;
CREATE POLICY closet_sync_jobs_own ON closet_sync_jobs FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);
