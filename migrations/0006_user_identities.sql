-- Sign-in identities from external providers (Google). One row per provider account, linked to a user.
-- Accounts created through a provider get an unusable password hash, so password sign-in stays closed for them
-- until they set a password with "Forgot password".
CREATE TABLE user_identities (
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX idx_user_identities_user ON user_identities(user_id);
