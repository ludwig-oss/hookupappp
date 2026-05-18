import pg from 'pg';
import { getDbContext } from './context.js';
import { RLS_SQL } from './rls.js';

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

async function execQuery<T extends pg.QueryResultRow>(
  client: pg.Pool | pg.PoolClient,
  text: string,
  params?: unknown[],
  settings?: Record<string, string>
): Promise<pg.QueryResult<T>> {
  if (!settings || Object.keys(settings).length === 0) {
    return client.query<T>(text, params);
  }
  const entries = Object.entries(settings);
  const setParts = entries.map(([k], i) => `SET LOCAL app.${k} = $${i + 1}`);
  const values = entries.map(([, v]) => v);
  await client.query('BEGIN');
  try {
    for (let i = 0; i < setParts.length; i++) {
      await client.query(setParts[i], [values[i]]);
    }
    const result = await client.query<T>(text, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

function resolveRlsSettings(): Record<string, string> | undefined {
  const ctx = getDbContext();
  if (ctx?.mode === 'user' && ctx.userId) {
    return { current_user_id: ctx.userId, bypass_rls: 'false' };
  }
  if (ctx?.mode === 'system') {
    return { bypass_rls: 'true' };
  }
  // No middleware context (startup, legacy) — bypass so migrations/auth still work
  return { bypass_rls: 'true' };
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL not set');
  const settings = resolveRlsSettings();
  const client = await p.connect();
  try {
    return await execQuery<T>(client, text, params, settings);
  } finally {
    client.release();
  }
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
  await p.query(RLS_SQL);
}
