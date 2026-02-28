import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (process.env.DATABASE_URL) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      });
    }
    return pool;
  }
  return null;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL not set');
  return p.query<T>(text, params);
}

export function usePostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const SCHEMA_SQL = `
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
-- Matching: location-based filtering and discover (city, age, gender)
CREATE INDEX IF NOT EXISTS idx_users_data_city ON users ((data->>'city')) WHERE data->>'city' IS NOT NULL AND data->>'city' != '';
CREATE INDEX IF NOT EXISTS idx_users_data_age ON users ((data->>'age')) WHERE data->>'age' IS NOT NULL AND data->>'age' != '';
CREATE INDEX IF NOT EXISTS idx_users_data_gender ON users ((data->>'gender')) WHERE data->>'gender' IS NOT NULL AND data->>'gender' != '';
-- Geo: users with location for nearby / geo queries (index on presence of lat/lon)
CREATE INDEX IF NOT EXISTS idx_users_data_has_location ON users ((data->'location')) WHERE data->'location' IS NOT NULL;

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
`;

/** Run schema to create tables if they don't exist. Safe to call on startup. */
export async function runSchema(): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.query(SCHEMA_SQL);
}
