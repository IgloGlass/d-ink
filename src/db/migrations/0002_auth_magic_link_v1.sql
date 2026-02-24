CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Editor')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_user
  ON tenant_memberships (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS auth_invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Editor')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_invites_tenant_email_status
  ON auth_invites (tenant_id, email_normalized, status);

CREATE TABLE IF NOT EXISTS auth_magic_link_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'revoked', 'expired')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_user_id TEXT,
  revoked_at TEXT,
  FOREIGN KEY (invite_id) REFERENCES auth_invites (id)
);

CREATE INDEX IF NOT EXISTS idx_auth_magic_link_tokens_tenant_email_status
  ON auth_magic_link_tokens (tenant_id, email_normalized, status);

CREATE INDEX IF NOT EXISTS idx_auth_magic_link_tokens_tenant_hash
  ON auth_magic_link_tokens (tenant_id, token_hash);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant_user
  ON auth_sessions (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant_token_hash
  ON auth_sessions (tenant_id, token_hash);
