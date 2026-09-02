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
  await client.query('BEGIN');
  try {
    // SET LOCAL does not accept $1 binds — use set_config so login/signup RLS bypass actually applies.
    for (const [key, value] of entries) {
      await client.query('SELECT set_config($1, $2, true)', [`app.${key}`, String(value)]);
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

export async function query<T extends pg.QueryResultRow = Record<string, any>>(
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
CREATE TABLE IF NOT EXISTS reserved_usernames (
  username TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_username_lower') THEN
    BEGIN
      CREATE UNIQUE INDEX idx_users_username_lower ON users (lower(btrim(username)));
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email_lower') THEN
    BEGIN
      CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(btrim(email)));
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
END $$;
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

CREATE TABLE IF NOT EXISTS activity_interests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_activity_interests_to ON activity_interests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_interests_from ON activity_interests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_interests_pair ON activity_interests(from_user_id, to_user_id);

CREATE TABLE IF NOT EXISTS connection_buzzes (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_buzzes_to ON connection_buzzes(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_buzzes_from ON connection_buzzes(from_user_id);

CREATE TABLE IF NOT EXISTS profile_stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_stories_user ON profile_stories(user_id, expires_at);

CREATE TABLE IF NOT EXISTS profile_highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_profile_highlights_user ON profile_highlights(user_id, sort_order);

CREATE TABLE IF NOT EXISTS guide_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  categories JSONB NOT NULL DEFAULT '[]',
  region TEXT,
  experience TEXT,
  qualifications TEXT,
  identification_url TEXT,
  widget_answers JSONB NOT NULL DEFAULT '[]',
  proof_per_category JSONB NOT NULL DEFAULT '{}',
  auto_approved BOOLEAN NOT NULL DEFAULT false,
  decision_due_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guide_applications_user ON guide_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_applications_status ON guide_applications(status);
ALTER TABLE guide_applications ADD COLUMN IF NOT EXISTS widget_answers JSONB NOT NULL DEFAULT '[]';
ALTER TABLE guide_applications ADD COLUMN IF NOT EXISTS proof_per_category JSONB NOT NULL DEFAULT '{}';
ALTER TABLE guide_applications ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE guide_applications ADD COLUMN IF NOT EXISTS decision_due_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS guide_wallets (
  user_id TEXT PRIMARY KEY,
  available_balance_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  held_balance_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawn_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  paypal_email TEXT,
  paypal_merchant_id TEXT,
  paypal_onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  paypal_tracking_id TEXT,
  bank_account_label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guide_wallets_merchant ON guide_wallets(paypal_merchant_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_eur NUMERIC(12,2) NOT NULL,
  net_to_guide_eur NUMERIC(12,2),
  platform_fee_eur NUMERIC(12,2),
  request_id TEXT,
  booking_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_eur NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'paypal',
  paypal_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  admin_note TEXT,
  captured_authorization_ids JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user ON wallet_withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_status ON wallet_withdrawals(status);

CREATE TABLE IF NOT EXISTS paypal_authorizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  authorization_id TEXT NOT NULL UNIQUE,
  request_id TEXT,
  session_id TEXT,
  payer_user_id TEXT,
  gross_eur NUMERIC(12,2) NOT NULL,
  platform_fee_eur NUMERIC(12,2) NOT NULL,
  guide_share_eur NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  merchant_id TEXT,
  status TEXT NOT NULL DEFAULT 'authorized',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  capture_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_paypal_auth_user ON paypal_authorizations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_paypal_auth_request ON paypal_authorizations(request_id);
`

/** Run schema to create tables if they don't exist. Safe to call on startup. */
export async function runSchema(): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.query(SCHEMA_SQL);
  await p.query(RLS_SQL);
}
