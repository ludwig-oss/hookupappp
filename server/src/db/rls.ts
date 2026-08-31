/** PostgreSQL RLS policies — applied on startup when DATABASE_URL is set. */

export const RLS_SQL = `
-- Session helpers (read by policies)
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'true';
$$ LANGUAGE sql STABLE;

-- ========== messages ==========
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  app_rls_bypass()
  OR from_user_id = app_current_user_id()
  OR to_user_id = app_current_user_id()
);

DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  app_rls_bypass()
  OR from_user_id = app_current_user_id()
);

DROP POLICY IF EXISTS messages_update ON messages;
CREATE POLICY messages_update ON messages FOR UPDATE USING (
  app_rls_bypass()
  OR from_user_id = app_current_user_id()
  OR to_user_id = app_current_user_id()
);

DROP POLICY IF EXISTS messages_delete ON messages;
CREATE POLICY messages_delete ON messages FOR DELETE USING (
  app_rls_bypass()
  OR from_user_id = app_current_user_id()
);

-- ========== dating_posts ==========
ALTER TABLE dating_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dating_posts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_select ON dating_posts;
CREATE POLICY posts_select ON dating_posts FOR SELECT USING (
  app_rls_bypass()
  OR app_current_user_id() IS NOT NULL
);

DROP POLICY IF EXISTS posts_insert ON dating_posts;
CREATE POLICY posts_insert ON dating_posts FOR INSERT WITH CHECK (
  app_rls_bypass()
  OR user_id = app_current_user_id()
);

DROP POLICY IF EXISTS posts_update ON dating_posts;
CREATE POLICY posts_update ON dating_posts FOR UPDATE USING (
  app_rls_bypass()
  OR user_id = app_current_user_id()
  OR app_current_user_id() IS NOT NULL
);

DROP POLICY IF EXISTS posts_delete ON dating_posts;
CREATE POLICY posts_delete ON dating_posts FOR DELETE USING (
  app_rls_bypass()
  OR user_id = app_current_user_id()
);

-- ========== users ==========
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT USING (
  app_rls_bypass()
  OR app_current_user_id() IS NOT NULL
);

DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE USING (
  app_rls_bypass()
  OR id = app_current_user_id()
);

DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_delete ON users FOR DELETE USING (
  app_rls_bypass()
  OR id = app_current_user_id()
);

-- ========== profile_stories ==========
ALTER TABLE profile_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_stories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_stories_select ON profile_stories;
CREATE POLICY profile_stories_select ON profile_stories FOR SELECT USING (
  app_rls_bypass()
  OR app_current_user_id() IS NOT NULL
);

DROP POLICY IF EXISTS profile_stories_write ON profile_stories;
CREATE POLICY profile_stories_write ON profile_stories FOR ALL USING (
  app_rls_bypass()
  OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass()
  OR user_id = app_current_user_id()
);

-- ========== profile_highlights ==========
ALTER TABLE profile_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_highlights FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_highlights_select ON profile_highlights;
CREATE POLICY profile_highlights_select ON profile_highlights FOR SELECT USING (
  app_rls_bypass()
  OR app_current_user_id() IS NOT NULL
);

DROP POLICY IF EXISTS profile_highlights_write ON profile_highlights;
CREATE POLICY profile_highlights_write ON profile_highlights FOR ALL USING (
  app_rls_bypass()
  OR user_id = app_current_user_id()
) WITH CHECK (
  app_rls_bypass()
  OR user_id = app_current_user_id()
);
`
