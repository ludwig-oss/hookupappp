-- Users: id, email, password, name, username + JSONB for the rest
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Love Life feed posts
CREATE TABLE IF NOT EXISTS dating_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  tags JSONB DEFAULT '[]',
  likes INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  comments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dating_posts_created_at ON dating_posts(created_at DESC);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Row Level Security is enabled at runtime via server/src/db/rls.ts (runSchema on startup).
-- Policies use session vars app.current_user_id and app.bypass_rls set per request.
