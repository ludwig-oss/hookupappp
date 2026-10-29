-- Migration: user age segments + outfit feed partition labels
-- Teen (<20), Young Adult (20–39), Mature (40+).
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT).

CREATE TABLE IF NOT EXISTS age_segments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  min_age INT NOT NULL,
  max_age INT NOT NULL,
  CONSTRAINT age_segments_range CHECK (min_age >= 0 AND max_age >= min_age)
);

INSERT INTO age_segments (id, slug, label, min_age, max_age) VALUES
  ('seg-teen', 'teen', 'Teen', 13, 19),
  ('seg-young-adult', 'young_adult', 'Young Adult', 20, 39),
  ('seg-mature', 'mature', 'Mature', 40, 120)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  label = EXCLUDED.label,
  min_age = EXCLUDED.min_age,
  max_age = EXCLUDED.max_age;

CREATE TABLE IF NOT EXISTS user_age_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES age_segments(id),
  age INT,
  -- Personal style tags that can override default feed exclusions (e.g. teen + "classic").
  style_override_tags TEXT[] NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_age_profiles_segment ON user_age_profiles (segment_id);

CREATE TABLE IF NOT EXISTS outfit_feed_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'catalog',
  title TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  -- Partition flags used by ageSegmentFeed.
  is_scandalous BOOLEAN NOT NULL DEFAULT FALSE,
  is_ultra_fast_fashion BOOLEAN NOT NULL DEFAULT FALSE,
  is_traditional BOOLEAN NOT NULL DEFAULT FALSE,
  is_conservative BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfit_feed_scandalous ON outfit_feed_items (is_scandalous) WHERE is_scandalous;
CREATE INDEX IF NOT EXISTS idx_outfit_feed_fast ON outfit_feed_items (is_ultra_fast_fashion) WHERE is_ultra_fast_fashion;
CREATE INDEX IF NOT EXISTS idx_outfit_feed_traditional ON outfit_feed_items (is_traditional) WHERE is_traditional;
CREATE INDEX IF NOT EXISTS idx_outfit_feed_conservative ON outfit_feed_items (is_conservative) WHERE is_conservative;

CREATE TABLE IF NOT EXISTS outfit_feed_segment_allow (
  feed_item_id TEXT NOT NULL REFERENCES outfit_feed_items(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES age_segments(id) ON DELETE CASCADE,
  PRIMARY KEY (feed_item_id, segment_id)
);

ALTER TABLE user_age_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_age_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_age_profiles_own ON user_age_profiles;
CREATE POLICY user_age_profiles_own ON user_age_profiles FOR ALL USING (
  app_rls_bypass() OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass() OR user_id = app_current_user_id()
);

ALTER TABLE age_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_segments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS age_segments_read ON age_segments;
CREATE POLICY age_segments_read ON age_segments FOR SELECT USING (
  app_rls_bypass() OR app_current_user_id() IS NOT NULL
);
DROP POLICY IF EXISTS age_segments_write ON age_segments;
CREATE POLICY age_segments_write ON age_segments FOR ALL USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());

ALTER TABLE outfit_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_feed_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outfit_feed_items_read ON outfit_feed_items;
CREATE POLICY outfit_feed_items_read ON outfit_feed_items FOR SELECT USING (
  app_rls_bypass() OR app_current_user_id() IS NOT NULL
);
DROP POLICY IF EXISTS outfit_feed_items_write ON outfit_feed_items;
CREATE POLICY outfit_feed_items_write ON outfit_feed_items FOR ALL USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());

ALTER TABLE outfit_feed_segment_allow ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_feed_segment_allow FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outfit_feed_segment_allow_read ON outfit_feed_segment_allow;
CREATE POLICY outfit_feed_segment_allow_read ON outfit_feed_segment_allow FOR SELECT USING (
  app_rls_bypass() OR app_current_user_id() IS NOT NULL
);
DROP POLICY IF EXISTS outfit_feed_segment_allow_write ON outfit_feed_segment_allow;
CREATE POLICY outfit_feed_segment_allow_write ON outfit_feed_segment_allow FOR ALL USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
