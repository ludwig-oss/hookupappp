-- Ingested internet trends (Pinterest visual search / runway) with celebrity attribution.

CREATE TABLE IF NOT EXISTS ingested_trends (
  id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  source_platform TEXT NOT NULL
    CHECK (source_platform IN ('pinterest', 'fashion_show', 'celebrity_streetwear')),
  source_url TEXT,
  celebrity_name TEXT,
  board_or_show_name TEXT,
  extracted_tags TEXT[] NOT NULL DEFAULT '{}',
  tops JSONB NOT NULL DEFAULT '[]',
  bottoms JSONB NOT NULL DEFAULT '[]',
  styles JSONB NOT NULL DEFAULT '[]',
  accessories JSONB NOT NULL DEFAULT '[]',
  image_embedding_vector DOUBLE PRECISION[] NOT NULL DEFAULT '{}',
  target_age_groups TEXT[] NOT NULL DEFAULT '{}',
  attribution JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingested_trends_platform ON ingested_trends (source_platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingested_trends_celebrity ON ingested_trends (celebrity_name);
CREATE INDEX IF NOT EXISTS idx_ingested_trends_tags ON ingested_trends USING GIN (extracted_tags);

ALTER TABLE ingested_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingested_trends FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingested_trends_read ON ingested_trends;
CREATE POLICY ingested_trends_read ON ingested_trends FOR SELECT USING (
  app_rls_bypass() OR app_current_user_id() IS NOT NULL
);
DROP POLICY IF EXISTS ingested_trends_write ON ingested_trends;
CREATE POLICY ingested_trends_write ON ingested_trends FOR ALL USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
