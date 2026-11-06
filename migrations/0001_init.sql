-- Opportunity Radar core schema (Cloudflare D1 / SQLite).
-- All timestamps are ISO-8601 UTC strings. JSON columns hold validated JSON text.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',
  onboarded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- SHA-256 hash of the session token (token itself is never stored)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('career', 'academic', 'business')),
  title TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  completeness INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX uq_profiles_user_type_active ON profiles(user_id, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_type ON profiles(type) WHERE deleted_at IS NULL;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cv', 'company_profile', 'transcript', 'certificate', 'cover_letter', 'other')),
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_documents_user ON documents(user_id) WHERE deleted_at IS NULL;

CREATE TABLE cvs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'modern',
  data TEXT NOT NULL,
  target_opportunity_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_cvs_user ON cvs(user_id) WHERE deleted_at IS NULL;

CREATE TABLE cv_versions (
  id TEXT PRIMARY KEY,
  cv_id TEXT NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  data TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (cv_id, version)
);

CREATE TABLE cover_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_id TEXT REFERENCES cvs(id) ON DELETE SET NULL,
  opportunity_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_cover_letters_user ON cover_letters(user_id) WHERE deleted_at IS NULL;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  website TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('official', 'ats', 'aggregator', 'partner', 'curated')),
  connector TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  categories TEXT NOT NULL DEFAULT '[]',
  geography TEXT NOT NULL DEFAULT '[]',
  access_method TEXT NOT NULL,
  terms_url TEXT,
  automation TEXT NOT NULL CHECK (automation IN ('automated', 'partial', 'curated')),
  enabled INTEGER NOT NULL DEFAULT 0,
  refresh_minutes INTEGER NOT NULL DEFAULT 360,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 4,
  verification_policy TEXT NOT NULL,
  notes TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_item_at TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ingestion_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'admin', 'test')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed', 'skipped')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  sources_total INTEGER NOT NULL DEFAULT 0,
  sources_done INTEGER NOT NULL DEFAULT 0,
  sources_failed INTEGER NOT NULL DEFAULT 0,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX idx_runs_started ON ingestion_runs(started_at);
CREATE INDEX idx_runs_status ON ingestion_runs(status);

CREATE TABLE ingestion_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  last_error TEXT,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (run_id, source_id)
);
CREATE INDEX idx_tasks_status_next ON ingestion_tasks(status, next_attempt_at);

CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  country TEXT,
  countries TEXT NOT NULL DEFAULT '[]',
  location TEXT,
  remote TEXT NOT NULL DEFAULT 'unknown' CHECK (remote IN ('onsite', 'remote', 'hybrid', 'unknown')),
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  application_url TEXT,
  official_url TEXT,
  reference_no TEXT,
  published_at TEXT,
  deadline_at TEXT,
  deadline_tz TEXT,
  deadline_note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired', 'cancelled', 'status_uncertain')),
  verification TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification IN ('verified_official', 'verified_ats', 'aggregator_only', 'admin_verified', 'unverified')),
  verified_by TEXT,
  verified_at TEXT,
  moderation TEXT NOT NULL DEFAULT 'approved' CHECK (moderation IN ('pending', 'approved', 'rejected')),
  meta TEXT NOT NULL DEFAULT '{}',
  requirements TEXT NOT NULL DEFAULT '{}',
  requirements_source TEXT NOT NULL DEFAULT 'heuristic' CHECK (requirements_source IN ('structured', 'heuristic', 'admin', 'none')),
  content_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_opps_category_status ON opportunities(category, status);
CREATE INDEX idx_opps_deadline ON opportunities(deadline_at);
CREATE INDEX idx_opps_first_seen ON opportunities(first_seen_at);
CREATE INDEX idx_opps_country ON opportunities(country);
CREATE INDEX idx_opps_source ON opportunities(source_id);

CREATE TABLE source_records (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_run_id TEXT,
  missing_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_id, external_id)
);
CREATE INDEX idx_source_records_opp ON source_records(opportunity_id);

CREATE TABLE opportunity_events (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_opp_events_opp ON opportunity_events(opportunity_id, created_at);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  score INTEGER,
  eligibility TEXT NOT NULL CHECK (eligibility IN ('eligible', 'potential', 'not_eligible', 'insufficient')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  explanation TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  UNIQUE (profile_id, opportunity_id)
);
CREATE INDEX idx_matches_user_score ON matches(user_id, score);

CREATE TABLE user_opportunity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('saved', 'dismissed')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('application', 'bid')),
  title TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  applied_at TEXT,
  follow_up_at TEXT,
  deadline_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  cv_id TEXT REFERENCES cvs(id) ON DELETE SET NULL,
  document_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_applications_user ON applications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_follow_up ON applications(follow_up_at) WHERE deleted_at IS NULL;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('new_match', 'deadline', 'follow_up', 'status_change', 'system', 'digest')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider TEXT,
  provider_message_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  send_after TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (notification_id, channel)
);
CREATE INDEX idx_deliveries_status ON notification_deliveries(status, send_after);

CREATE TABLE notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  in_app_enabled INTEGER NOT NULL DEFAULT 1,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('instant', 'daily', 'weekly', 'off')),
  categories TEXT NOT NULL DEFAULT '["new_match","deadline","follow_up","status_change"]',
  min_score INTEGER NOT NULL DEFAULT 60,
  quiet_start INTEGER,
  quiet_end INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_ugx INTEGER NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month')),
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  entitlements TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'revoked')),
  payment_id TEXT,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  provider TEXT NOT NULL,
  merchant_reference TEXT NOT NULL UNIQUE,
  provider_tracking_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired', 'refunded')),
  status_detail TEXT,
  confirmation_code TEXT,
  payment_method TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status, created_at);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT REFERENCES payments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- Development-only payment simulator state. Never used when ENVIRONMENT=production.
CREATE TABLE mock_payments (
  tracking_id TEXT PRIMARY KEY,
  merchant_reference TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE usage_counters (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, metric, period)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);

CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE scheduler_locks (
  name TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
