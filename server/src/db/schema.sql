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

-- Row Level Security is enabled at runtime via server/src/db/rls.ts (runSchema on startup).
-- Policies use session vars app.current_user_id and app.bypass_rls set per request.
