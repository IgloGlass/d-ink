export const SELECT_MEMBERSHIP_BY_TENANT_AND_USER_SQL = `
SELECT
  id,
  tenant_id,
  user_id,
  role,
  created_at,
  updated_at
FROM tenant_memberships
WHERE tenant_id = ?1 AND user_id = ?2
`;

export const REVOKE_PENDING_INVITES_BY_TENANT_AND_EMAIL_SQL = `
UPDATE auth_invites
SET
  status = 'revoked',
  revoked_at = ?3
WHERE tenant_id = ?1
  AND email_normalized = ?2
  AND status = 'pending'
`;

export const REVOKE_ACTIVE_MAGIC_LINK_TOKENS_BY_TENANT_AND_EMAIL_SQL = `
UPDATE auth_magic_link_tokens
SET
  status = 'revoked',
  revoked_at = ?3
WHERE tenant_id = ?1
  AND email_normalized = ?2
  AND status = 'active'
`;

export const INSERT_AUTH_INVITE_SQL = `
INSERT INTO auth_invites (
  id,
  tenant_id,
  email_normalized,
  role,
  status,
  invited_by_user_id,
  created_at,
  expires_at,
  accepted_at,
  accepted_by_user_id,
  revoked_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
`;

export const INSERT_AUTH_MAGIC_LINK_TOKEN_SQL = `
INSERT INTO auth_magic_link_tokens (
  id,
  tenant_id,
  invite_id,
  email_normalized,
  token_hash,
  status,
  issued_at,
  expires_at,
  consumed_at,
  consumed_by_user_id,
  revoked_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
`;

export const INSERT_AUDIT_EVENT_SQL = `
INSERT INTO audit_events (
  id,
  tenant_id,
  workspace_id,
  actor_type,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  before_json,
  after_json,
  policy_run_id,
  model_run_id,
  timestamp,
  context_json
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
`;

export const INSERT_USER_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
INSERT OR IGNORE INTO users (
  id,
  email_normalized,
  created_at
)
SELECT
  ?1, ?2, ?3
WHERE EXISTS (
  SELECT 1
  FROM auth_magic_link_tokens token
  JOIN auth_invites invite
    ON invite.id = token.invite_id
  WHERE token.id = ?4
    AND token.tenant_id = ?5
    AND token.email_normalized = ?2
    AND token.invite_id = ?6
    AND token.status = 'active'
    AND token.revoked_at IS NULL
    AND token.expires_at > ?3
    AND invite.id = ?6
    AND invite.tenant_id = ?5
    AND invite.status = 'pending'
    AND invite.revoked_at IS NULL
    AND invite.expires_at > ?3
)
`;

export const INSERT_MEMBERSHIP_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
INSERT OR IGNORE INTO tenant_memberships (
  id,
  tenant_id,
  user_id,
  role,
  created_at,
  updated_at
)
SELECT
  ?1, ?2, users.id, ?3, ?4, ?4
FROM users
WHERE users.email_normalized = ?5
  AND EXISTS (
    SELECT 1
    FROM auth_magic_link_tokens token
    JOIN auth_invites invite
      ON invite.id = token.invite_id
    WHERE token.id = ?6
      AND token.tenant_id = ?2
      AND token.email_normalized = ?5
      AND token.invite_id = ?7
      AND token.status = 'active'
      AND token.revoked_at IS NULL
      AND token.expires_at > ?4
      AND invite.id = ?7
      AND invite.tenant_id = ?2
      AND invite.status = 'pending'
      AND invite.revoked_at IS NULL
      AND invite.expires_at > ?4
  )
`;

export const UPDATE_MEMBERSHIP_ROLE_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
UPDATE tenant_memberships
SET
  role = ?1,
  updated_at = ?2
WHERE tenant_id = ?3
  AND user_id = (
    SELECT id
    FROM users
    WHERE email_normalized = ?4
  )
  AND EXISTS (
    SELECT 1
    FROM auth_magic_link_tokens token
    JOIN auth_invites invite
      ON invite.id = token.invite_id
    WHERE token.id = ?5
      AND token.tenant_id = ?3
      AND token.email_normalized = ?4
      AND token.invite_id = ?6
      AND token.status = 'active'
      AND token.revoked_at IS NULL
      AND token.expires_at > ?2
      AND invite.id = ?6
      AND invite.tenant_id = ?3
      AND invite.status = 'pending'
      AND invite.revoked_at IS NULL
      AND invite.expires_at > ?2
  )
`;

export const INSERT_SESSION_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
INSERT INTO auth_sessions (
  id,
  tenant_id,
  user_id,
  token_hash,
  created_at,
  expires_at,
  revoked_at,
  last_seen_at
)
SELECT
  ?1, ?2, users.id, ?3, ?4, ?5, NULL, ?4
FROM users
WHERE users.email_normalized = ?6
  AND EXISTS (
    SELECT 1
    FROM auth_magic_link_tokens token
    JOIN auth_invites invite
      ON invite.id = token.invite_id
    WHERE token.id = ?7
      AND token.tenant_id = ?2
      AND token.email_normalized = ?6
      AND token.invite_id = ?8
      AND token.status = 'active'
      AND token.revoked_at IS NULL
      AND token.expires_at > ?4
      AND invite.id = ?8
      AND invite.tenant_id = ?2
      AND invite.status = 'pending'
      AND invite.revoked_at IS NULL
      AND invite.expires_at > ?4
  )
`;

export const UPDATE_MAGIC_LINK_TOKEN_TO_CONSUMED_SQL = `
UPDATE auth_magic_link_tokens
SET
  status = 'consumed',
  consumed_at = ?1,
  consumed_by_user_id = (
    SELECT id
    FROM users
    WHERE email_normalized = ?2
  )
WHERE id = ?3
  AND tenant_id = ?4
  AND invite_id = ?5
  AND email_normalized = ?2
  AND status = 'active'
  AND revoked_at IS NULL
  AND expires_at > ?1
`;

export const UPDATE_INVITE_TO_ACCEPTED_SQL = `
UPDATE auth_invites
SET
  status = 'accepted',
  accepted_at = ?1,
  accepted_by_user_id = (
    SELECT id
    FROM users
    WHERE email_normalized = ?2
  )
WHERE id = ?3
  AND tenant_id = ?4
  AND email_normalized = ?2
  AND status = 'pending'
  AND revoked_at IS NULL
  AND expires_at > ?1
`;

export const INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL = `
INSERT INTO audit_events (
  id,
  tenant_id,
  workspace_id,
  actor_type,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  before_json,
  after_json,
  policy_run_id,
  model_run_id,
  timestamp,
  context_json
)
SELECT
  ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
WHERE changes() = 1
`;

export const SELECT_ACTIVE_TOKEN_WITH_INVITE_AND_IDENTITY_CONTEXT_SQL = `
SELECT
  token.id AS token_id,
  token.tenant_id AS token_tenant_id,
  token.invite_id AS token_invite_id,
  token.email_normalized AS token_email_normalized,
  token.token_hash AS token_token_hash,
  token.status AS token_status,
  token.issued_at AS token_issued_at,
  token.expires_at AS token_expires_at,
  token.consumed_at AS token_consumed_at,
  token.consumed_by_user_id AS token_consumed_by_user_id,
  token.revoked_at AS token_revoked_at,
  invite.id AS invite_id,
  invite.tenant_id AS invite_tenant_id,
  invite.email_normalized AS invite_email_normalized,
  invite.role AS invite_role,
  invite.status AS invite_status,
  invite.invited_by_user_id AS invite_invited_by_user_id,
  invite.created_at AS invite_created_at,
  invite.expires_at AS invite_expires_at,
  invite.accepted_at AS invite_accepted_at,
  invite.accepted_by_user_id AS invite_accepted_by_user_id,
  invite.revoked_at AS invite_revoked_at,
  users.id AS user_id,
  users.email_normalized AS user_email_normalized,
  users.created_at AS user_created_at,
  membership.id AS membership_id,
  membership.role AS membership_role,
  membership.created_at AS membership_created_at,
  membership.updated_at AS membership_updated_at
FROM auth_magic_link_tokens token
JOIN auth_invites invite
  ON invite.id = token.invite_id
LEFT JOIN users
  ON users.email_normalized = token.email_normalized
LEFT JOIN tenant_memberships membership
  ON membership.tenant_id = token.tenant_id
  AND membership.user_id = users.id
WHERE token.tenant_id = ?1
  AND token.token_hash = ?2
  AND token.status = 'active'
  AND token.revoked_at IS NULL
LIMIT 1
`;

export const SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_SQL = `
SELECT
  session.id AS session_id,
  session.created_at AS session_created_at,
  session.expires_at AS session_expires_at,
  session.revoked_at AS session_revoked_at,
  session.last_seen_at AS session_last_seen_at,
  session.tenant_id AS tenant_id,
  users.id AS user_id,
  users.email_normalized AS user_email_normalized,
  membership.role AS membership_role
FROM auth_sessions session
JOIN users
  ON users.id = session.user_id
JOIN tenant_memberships membership
  ON membership.tenant_id = session.tenant_id
  AND membership.user_id = session.user_id
WHERE session.tenant_id = ?1
  AND session.token_hash = ?2
  AND session.revoked_at IS NULL
  AND session.expires_at > ?3
LIMIT 1
`;

export const SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_BY_HASH_ANY_TENANT_SQL = `
SELECT
  session.id AS session_id,
  session.created_at AS session_created_at,
  session.expires_at AS session_expires_at,
  session.revoked_at AS session_revoked_at,
  session.last_seen_at AS session_last_seen_at,
  session.tenant_id AS tenant_id,
  users.id AS user_id,
  users.email_normalized AS user_email_normalized,
  membership.role AS membership_role
FROM auth_sessions session
JOIN users
  ON users.id = session.user_id
JOIN tenant_memberships membership
  ON membership.tenant_id = session.tenant_id
  AND membership.user_id = session.user_id
WHERE session.token_hash = ?1
  AND session.revoked_at IS NULL
  AND session.expires_at > ?2
LIMIT 1
`;

export const UPDATE_ACTIVE_SESSION_TO_REVOKED_SQL = `
UPDATE auth_sessions
SET
  revoked_at = ?1
WHERE id = ?2
  AND tenant_id = ?3
  AND revoked_at IS NULL
  AND expires_at > ?1
`;

export const INSERT_AUDIT_EVENT_IF_SESSION_REVOKE_APPLIED_SQL = `
INSERT INTO audit_events (
  id,
  tenant_id,
  workspace_id,
  actor_type,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  before_json,
  after_json,
  policy_run_id,
  model_run_id,
  timestamp,
  context_json
)
SELECT
  ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
WHERE changes() = 1
`;
