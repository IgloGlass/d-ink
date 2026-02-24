import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../shared/contracts/audit-event.v2";
import {
  type AuthInviteV1,
  AuthInviteV1Schema,
  type AuthMagicLinkTokenV1,
  AuthMagicLinkTokenV1Schema,
  type AuthPrincipalV1,
  AuthPrincipalV1Schema,
  type AuthSessionV1,
  AuthSessionV1Schema,
  type AuthUserV1,
  AuthUserV1Schema,
  type TenantMembershipV1,
  TenantMembershipV1Schema,
} from "../../shared/contracts/auth-magic-link.v1";
import type { D1Database } from "../../shared/types/d1";

type PersistenceFailureCodeV1 = "PERSISTENCE_ERROR";

/**
 * Shared failure payload for D1 auth repository operations.
 */
export type AuthRepositoryFailureV1 = {
  code: PersistenceFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success payload for membership lookup operations.
 */
export type AuthRepositoryMembershipLookupSuccessV1 = {
  membership: TenantMembershipV1 | null;
  ok: true;
};

/**
 * Result payload for membership lookup operations.
 */
export type AuthRepositoryMembershipLookupResultV1 =
  | AuthRepositoryMembershipLookupSuccessV1
  | AuthRepositoryFailureV1;

/**
 * Token lookup payload used by consume flow before one-time token redemption.
 */
export type AuthRepositoryActiveTokenLookupV1 = {
  invite: AuthInviteV1;
  membership: TenantMembershipV1 | null;
  token: AuthMagicLinkTokenV1;
  user: AuthUserV1 | null;
};

/**
 * Success payload for active token lookup operations.
 */
export type AuthRepositoryTokenLookupSuccessV1 = {
  ok: true;
  tokenLookup: AuthRepositoryActiveTokenLookupV1 | null;
};

/**
 * Result payload for active token lookup operations.
 */
export type AuthRepositoryTokenLookupResultV1 =
  | AuthRepositoryTokenLookupSuccessV1
  | AuthRepositoryFailureV1;

/**
 * Session lookup payload used by authenticate flow.
 */
export type AuthRepositoryActiveSessionLookupV1 = {
  principal: AuthPrincipalV1;
  session: AuthSessionV1;
};

/**
 * Success payload for active session lookup operations.
 */
export type AuthRepositorySessionLookupSuccessV1 = {
  ok: true;
  sessionLookup: AuthRepositoryActiveSessionLookupV1 | null;
};

/**
 * Result payload for active session lookup operations.
 */
export type AuthRepositorySessionLookupResultV1 =
  | AuthRepositorySessionLookupSuccessV1
  | AuthRepositoryFailureV1;

/**
 * Success payload for session revoke+audit atomic writes.
 */
export type AuthRepositoryRevokeSessionWithAuditSuccessV1 = {
  ok: true;
  revoked: boolean;
};

/**
 * Result payload for session revoke+audit atomic writes.
 */
export type AuthRepositoryRevokeSessionWithAuditResultV1 =
  | AuthRepositoryRevokeSessionWithAuditSuccessV1
  | AuthRepositoryFailureV1;

/**
 * Success payload for invite+token issuance atomic writes.
 */
export type AuthRepositoryCreateInviteSuccessV1 = {
  invite: AuthInviteV1;
  ok: true;
  token: AuthMagicLinkTokenV1;
};

/**
 * Result payload for invite+token issuance atomic writes.
 */
export type AuthRepositoryCreateInviteResultV1 =
  | AuthRepositoryCreateInviteSuccessV1
  | AuthRepositoryFailureV1;

/**
 * Failure code for one-time token consume atomic writes.
 */
export type AuthRepositoryConsumeTokenFailureCodeV1 =
  | "TOKEN_NOT_ACTIVE"
  | PersistenceFailureCodeV1;

/**
 * Failure payload for one-time token consume atomic writes.
 */
export type AuthRepositoryConsumeTokenFailureV1 = {
  code: AuthRepositoryConsumeTokenFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success payload for one-time token consume atomic writes.
 */
export type AuthRepositoryConsumeTokenSuccessV1 = {
  ok: true;
  principal: AuthPrincipalV1;
  session: AuthSessionV1;
};

/**
 * Result payload for one-time token consume atomic writes.
 */
export type AuthRepositoryConsumeTokenResultV1 =
  | AuthRepositoryConsumeTokenSuccessV1
  | AuthRepositoryConsumeTokenFailureV1;

/**
 * Input contract for invite+token+audit atomic writes.
 */
export type CreateInviteAndIssueTokenWithAuditAtomicInputV1 = {
  invite: AuthInviteV1;
  magicLinkIssuedAuditEvent: AuditEventV2;
  token: AuthMagicLinkTokenV1;
  inviteCreatedAuditEvent: AuditEventV2;
  revokedAt: string;
};

/**
 * Input contract for one-time token consume+session+audit atomic writes.
 */
export type ConsumeTokenAndCreateSessionWithAuditAtomicInputV1 = {
  consumedAt: string;
  consumeAuditEvent: AuditEventV2;
  emailNormalized: string;
  inviteId: string;
  invitedRole: "Admin" | "Editor";
  membershipId: string;
  session: {
    createdAt: string;
    expiresAt: string;
    id: string;
    tokenHash: string;
  };
  sessionCreatedAuditEvent: AuditEventV2;
  tenantId: string;
  tokenId: string;
  userId: string;
};

/**
 * Auth persistence contract for V1 invite-based magic-link workflows.
 */
export interface AuthRepositoryV1 {
  consumeTokenAndCreateSessionWithAuditAtomic(
    input: ConsumeTokenAndCreateSessionWithAuditAtomicInputV1,
  ): Promise<AuthRepositoryConsumeTokenResultV1>;
  createInviteAndIssueTokenWithAuditAtomic(
    input: CreateInviteAndIssueTokenWithAuditAtomicInputV1,
  ): Promise<AuthRepositoryCreateInviteResultV1>;
  findActiveSessionByHash(input: {
    nowIsoUtc: string;
    tenantId: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1>;
  findActiveSessionByHashAnyTenant(input: {
    nowIsoUtc: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1>;
  findActiveTokenByHash(input: {
    tenantId: string;
    tokenHash: string;
  }): Promise<AuthRepositoryTokenLookupResultV1>;
  getMembershipByTenantAndUser(input: {
    tenantId: string;
    userId: string;
  }): Promise<AuthRepositoryMembershipLookupResultV1>;
  revokeSessionWithAuditAtomic(input: {
    auditEvent: AuditEventV2;
    revokedAt: string;
    sessionId: string;
    tenantId: string;
  }): Promise<AuthRepositoryRevokeSessionWithAuditResultV1>;
}

type MembershipRow = {
  created_at: string;
  id: string;
  role: "Admin" | "Editor";
  tenant_id: string;
  updated_at: string;
  user_id: string;
};

type ActiveTokenLookupRow = {
  invite_accepted_at: string | null;
  invite_accepted_by_user_id: string | null;
  invite_created_at: string;
  invite_email_normalized: string;
  invite_expires_at: string;
  invite_id: string;
  invite_invited_by_user_id: string;
  invite_revoked_at: string | null;
  invite_role: "Admin" | "Editor";
  invite_status: "pending" | "accepted" | "revoked" | "expired";
  membership_created_at: string | null;
  membership_id: string | null;
  membership_role: "Admin" | "Editor" | null;
  membership_updated_at: string | null;
  token_consumed_at: string | null;
  token_consumed_by_user_id: string | null;
  token_email_normalized: string;
  token_expires_at: string;
  token_id: string;
  token_invite_id: string;
  token_issued_at: string;
  token_revoked_at: string | null;
  token_status: "active" | "consumed" | "revoked" | "expired";
  token_token_hash: string;
  token_tenant_id: string;
  user_created_at: string | null;
  user_email_normalized: string | null;
  user_id: string | null;
};

type ActiveSessionLookupRow = {
  membership_role: "Admin" | "Editor";
  session_created_at: string;
  session_expires_at: string;
  session_id: string;
  session_last_seen_at: string | null;
  session_revoked_at: string | null;
  tenant_id: string;
  user_email_normalized: string;
  user_id: string;
};

const SELECT_MEMBERSHIP_BY_TENANT_AND_USER_SQL = `
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

const REVOKE_PENDING_INVITES_BY_TENANT_AND_EMAIL_SQL = `
UPDATE auth_invites
SET
  status = 'revoked',
  revoked_at = ?3
WHERE tenant_id = ?1
  AND email_normalized = ?2
  AND status = 'pending'
`;

const REVOKE_ACTIVE_MAGIC_LINK_TOKENS_BY_TENANT_AND_EMAIL_SQL = `
UPDATE auth_magic_link_tokens
SET
  status = 'revoked',
  revoked_at = ?3
WHERE tenant_id = ?1
  AND email_normalized = ?2
  AND status = 'active'
`;

const INSERT_AUTH_INVITE_SQL = `
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

const INSERT_AUTH_MAGIC_LINK_TOKEN_SQL = `
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

const INSERT_AUDIT_EVENT_SQL = `
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

const INSERT_USER_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
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

const INSERT_MEMBERSHIP_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
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

const UPDATE_MEMBERSHIP_ROLE_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
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

const INSERT_SESSION_IF_TOKEN_AND_INVITE_ACTIVE_SQL = `
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

const UPDATE_MAGIC_LINK_TOKEN_TO_CONSUMED_SQL = `
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

const UPDATE_INVITE_TO_ACCEPTED_SQL = `
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

const INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL = `
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

const SELECT_ACTIVE_TOKEN_WITH_INVITE_AND_IDENTITY_CONTEXT_SQL = `
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

const SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_SQL = `
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

const SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_BY_HASH_ANY_TENANT_SQL = `
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

const UPDATE_ACTIVE_SESSION_TO_REVOKED_SQL = `
UPDATE auth_sessions
SET
  revoked_at = ?1
WHERE id = ?2
  AND tenant_id = ?3
  AND revoked_at IS NULL
  AND expires_at > ?1
`;

const INSERT_AUDIT_EVENT_IF_SESSION_REVOKE_APPLIED_SQL = `
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return "Persistence operation failed.";
  }

  return "Persistence operation failed.";
}

function toFailure(message: string): AuthRepositoryFailureV1 {
  return {
    ok: false,
    code: "PERSISTENCE_ERROR",
    message,
  };
}

function toAuditDbValues(event: AuditEventV2): Array<string | null> {
  return [
    event.id,
    event.tenantId,
    event.workspaceId,
    event.actorType,
    event.actorUserId ?? null,
    event.eventType,
    event.targetType,
    event.targetId,
    event.before === undefined ? null : JSON.stringify(event.before),
    event.after === undefined ? null : JSON.stringify(event.after),
    event.policyRunId ?? null,
    event.modelRunId ?? null,
    event.timestamp,
    JSON.stringify(event.context),
  ];
}

function mapMembershipRow(row: MembershipRow): TenantMembershipV1 {
  return TenantMembershipV1Schema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapTokenLookupRow(
  row: ActiveTokenLookupRow,
): AuthRepositoryActiveTokenLookupV1 {
  const token = AuthMagicLinkTokenV1Schema.parse({
    id: row.token_id,
    tenantId: row.token_tenant_id,
    inviteId: row.token_invite_id,
    emailNormalized: row.token_email_normalized,
    tokenHash: row.token_token_hash,
    status: row.token_status,
    issuedAt: row.token_issued_at,
    expiresAt: row.token_expires_at,
    consumedAt: row.token_consumed_at ?? undefined,
    consumedByUserId: row.token_consumed_by_user_id ?? undefined,
    revokedAt: row.token_revoked_at ?? undefined,
  });

  const invite = AuthInviteV1Schema.parse({
    id: row.invite_id,
    tenantId: token.tenantId,
    emailNormalized: row.invite_email_normalized,
    role: row.invite_role,
    status: row.invite_status,
    invitedByUserId: row.invite_invited_by_user_id,
    createdAt: row.invite_created_at,
    expiresAt: row.invite_expires_at,
    acceptedAt: row.invite_accepted_at ?? undefined,
    acceptedByUserId: row.invite_accepted_by_user_id ?? undefined,
    revokedAt: row.invite_revoked_at ?? undefined,
  });

  const user =
    row.user_id && row.user_email_normalized && row.user_created_at
      ? AuthUserV1Schema.parse({
          id: row.user_id,
          emailNormalized: row.user_email_normalized,
          createdAt: row.user_created_at,
        })
      : null;

  const membership =
    row.membership_id &&
    row.membership_role &&
    row.membership_created_at &&
    row.membership_updated_at &&
    user
      ? TenantMembershipV1Schema.parse({
          id: row.membership_id,
          tenantId: token.tenantId,
          userId: user.id,
          role: row.membership_role,
          createdAt: row.membership_created_at,
          updatedAt: row.membership_updated_at,
        })
      : null;

  return {
    token,
    invite,
    user,
    membership,
  };
}

function mapActiveSessionRow(
  row: ActiveSessionLookupRow,
): AuthRepositoryActiveSessionLookupV1 {
  const session = AuthSessionV1Schema.parse({
    id: row.session_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    createdAt: row.session_created_at,
    expiresAt: row.session_expires_at,
    revokedAt: row.session_revoked_at ?? undefined,
    lastSeenAt: row.session_last_seen_at ?? undefined,
  });

  const principal = AuthPrincipalV1Schema.parse({
    tenantId: row.tenant_id,
    userId: row.user_id,
    emailNormalized: row.user_email_normalized,
    role: row.membership_role,
  });

  return { principal, session };
}

/**
 * Creates a D1-backed V1 auth repository.
 */
export function createD1AuthRepositoryV1(db: D1Database): AuthRepositoryV1 {
  async function findActiveSessionByHashInternal(input: {
    nowIsoUtc: string;
    tenantId: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1> {
    try {
      const row = await db
        .prepare(SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_SQL)
        .bind(input.tenantId, input.tokenHash, input.nowIsoUtc)
        .first<ActiveSessionLookupRow>();

      return {
        ok: true,
        sessionLookup: row ? mapActiveSessionRow(row) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  async function findActiveSessionByHashAnyTenantInternal(input: {
    nowIsoUtc: string;
    tokenHash: string;
  }): Promise<AuthRepositorySessionLookupResultV1> {
    try {
      const row = await db
        .prepare(
          SELECT_ACTIVE_SESSION_WITH_PRINCIPAL_CONTEXT_BY_HASH_ANY_TENANT_SQL,
        )
        .bind(input.tokenHash, input.nowIsoUtc)
        .first<ActiveSessionLookupRow>();

      return {
        ok: true,
        sessionLookup: row ? mapActiveSessionRow(row) : null,
      };
    } catch (error) {
      return toFailure(toErrorMessage(error));
    }
  }

  return {
    async getMembershipByTenantAndUser(input: {
      tenantId: string;
      userId: string;
    }): Promise<AuthRepositoryMembershipLookupResultV1> {
      try {
        const membershipRow = await db
          .prepare(SELECT_MEMBERSHIP_BY_TENANT_AND_USER_SQL)
          .bind(input.tenantId, input.userId)
          .first<MembershipRow>();

        return {
          ok: true,
          membership: membershipRow ? mapMembershipRow(membershipRow) : null,
        };
      } catch (error) {
        return toFailure(toErrorMessage(error));
      }
    },

    async createInviteAndIssueTokenWithAuditAtomic(
      input: CreateInviteAndIssueTokenWithAuditAtomicInputV1,
    ): Promise<AuthRepositoryCreateInviteResultV1> {
      try {
        const invite = AuthInviteV1Schema.parse(input.invite);
        const token = AuthMagicLinkTokenV1Schema.parse(input.token);
        const inviteCreatedAuditEvent = parseAuditEventV2(
          input.inviteCreatedAuditEvent,
        );
        const magicLinkIssuedAuditEvent = parseAuditEventV2(
          input.magicLinkIssuedAuditEvent,
        );

        if (
          invite.tenantId !== token.tenantId ||
          invite.id !== token.inviteId ||
          invite.emailNormalized !== token.emailNormalized
        ) {
          return toFailure(
            "Invite and token identifiers must be consistent for atomic persistence.",
          );
        }

        if (
          inviteCreatedAuditEvent.tenantId !== invite.tenantId ||
          magicLinkIssuedAuditEvent.tenantId !== invite.tenantId
        ) {
          return toFailure(
            "Audit event tenant identifiers must match invite tenant identifier.",
          );
        }

        const statements = [
          db
            .prepare(REVOKE_PENDING_INVITES_BY_TENANT_AND_EMAIL_SQL)
            .bind(invite.tenantId, invite.emailNormalized, input.revokedAt),
          db
            .prepare(REVOKE_ACTIVE_MAGIC_LINK_TOKENS_BY_TENANT_AND_EMAIL_SQL)
            .bind(invite.tenantId, invite.emailNormalized, input.revokedAt),
          db
            .prepare(INSERT_AUTH_INVITE_SQL)
            .bind(
              invite.id,
              invite.tenantId,
              invite.emailNormalized,
              invite.role,
              invite.status,
              invite.invitedByUserId,
              invite.createdAt,
              invite.expiresAt,
              invite.acceptedAt ?? null,
              invite.acceptedByUserId ?? null,
              invite.revokedAt ?? null,
            ),
          db
            .prepare(INSERT_AUTH_MAGIC_LINK_TOKEN_SQL)
            .bind(
              token.id,
              token.tenantId,
              token.inviteId,
              token.emailNormalized,
              token.tokenHash,
              token.status,
              token.issuedAt,
              token.expiresAt,
              token.consumedAt ?? null,
              token.consumedByUserId ?? null,
              token.revokedAt ?? null,
            ),
          db
            .prepare(INSERT_AUDIT_EVENT_SQL)
            .bind(...toAuditDbValues(inviteCreatedAuditEvent)),
          db
            .prepare(INSERT_AUDIT_EVENT_SQL)
            .bind(...toAuditDbValues(magicLinkIssuedAuditEvent)),
        ];

        const batchResult = await db.batch(statements);
        const insertInviteResult = batchResult[2];
        const insertTokenResult = batchResult[3];
        const inviteAuditInsertResult = batchResult[4];
        const tokenAuditInsertResult = batchResult[5];

        if (
          !insertInviteResult?.success ||
          !insertTokenResult?.success ||
          !inviteAuditInsertResult?.success ||
          !tokenAuditInsertResult?.success
        ) {
          return toFailure(
            "Failed to persist invite, token, and audit events atomically.",
          );
        }

        return {
          ok: true,
          invite,
          token,
        };
      } catch (error) {
        return toFailure(toErrorMessage(error));
      }
    },

    async findActiveTokenByHash(input: {
      tenantId: string;
      tokenHash: string;
    }): Promise<AuthRepositoryTokenLookupResultV1> {
      try {
        const row = await db
          .prepare(SELECT_ACTIVE_TOKEN_WITH_INVITE_AND_IDENTITY_CONTEXT_SQL)
          .bind(input.tenantId, input.tokenHash)
          .first<ActiveTokenLookupRow>();

        return {
          ok: true,
          tokenLookup: row ? mapTokenLookupRow(row) : null,
        };
      } catch (error) {
        return toFailure(toErrorMessage(error));
      }
    },

    async consumeTokenAndCreateSessionWithAuditAtomic(
      input: ConsumeTokenAndCreateSessionWithAuditAtomicInputV1,
    ): Promise<AuthRepositoryConsumeTokenResultV1> {
      try {
        const consumeAuditEvent = parseAuditEventV2(input.consumeAuditEvent);
        const sessionCreatedAuditEvent = parseAuditEventV2(
          input.sessionCreatedAuditEvent,
        );

        if (
          consumeAuditEvent.tenantId !== input.tenantId ||
          sessionCreatedAuditEvent.tenantId !== input.tenantId
        ) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Audit event tenant identifiers must match consume request tenant identifier.",
          };
        }

        const batchResult = await db.batch([
          db
            .prepare(INSERT_USER_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
            .bind(
              input.userId,
              input.emailNormalized,
              input.consumedAt,
              input.tokenId,
              input.tenantId,
              input.inviteId,
            ),
          db
            .prepare(INSERT_MEMBERSHIP_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
            .bind(
              input.membershipId,
              input.tenantId,
              input.invitedRole,
              input.consumedAt,
              input.emailNormalized,
              input.tokenId,
              input.inviteId,
            ),
          db
            .prepare(UPDATE_MEMBERSHIP_ROLE_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
            .bind(
              input.invitedRole,
              input.consumedAt,
              input.tenantId,
              input.emailNormalized,
              input.tokenId,
              input.inviteId,
            ),
          db
            .prepare(INSERT_SESSION_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
            .bind(
              input.session.id,
              input.tenantId,
              input.session.tokenHash,
              input.session.createdAt,
              input.session.expiresAt,
              input.emailNormalized,
              input.tokenId,
              input.inviteId,
            ),
          db
            .prepare(UPDATE_MAGIC_LINK_TOKEN_TO_CONSUMED_SQL)
            .bind(
              input.consumedAt,
              input.emailNormalized,
              input.tokenId,
              input.tenantId,
              input.inviteId,
            ),
          db
            .prepare(UPDATE_INVITE_TO_ACCEPTED_SQL)
            .bind(
              input.consumedAt,
              input.emailNormalized,
              input.inviteId,
              input.tenantId,
            ),
          db
            .prepare(INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL)
            .bind(...toAuditDbValues(consumeAuditEvent)),
          db
            .prepare(INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL)
            .bind(...toAuditDbValues(sessionCreatedAuditEvent)),
        ]);

        const sessionInsertResult = batchResult[3];
        const tokenUpdateResult = batchResult[4];
        const inviteUpdateResult = batchResult[5];
        const consumeAuditInsertResult = batchResult[6];
        const sessionAuditInsertResult = batchResult[7];

        if (
          !sessionInsertResult?.success ||
          !tokenUpdateResult?.success ||
          !inviteUpdateResult?.success ||
          !consumeAuditInsertResult?.success ||
          !sessionAuditInsertResult?.success
        ) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Failed to atomically consume magic-link token and create session.",
          };
        }

        const sessionRowsInserted = Number(
          sessionInsertResult.meta.changes ?? 0,
        );
        const tokenRowsUpdated = Number(tokenUpdateResult.meta.changes ?? 0);
        const inviteRowsUpdated = Number(inviteUpdateResult.meta.changes ?? 0);
        const consumeAuditRowsInserted = Number(
          consumeAuditInsertResult.meta.changes ?? 0,
        );
        const sessionAuditRowsInserted = Number(
          sessionAuditInsertResult.meta.changes ?? 0,
        );

        if (
          sessionRowsInserted !== 1 ||
          tokenRowsUpdated !== 1 ||
          inviteRowsUpdated !== 1 ||
          consumeAuditRowsInserted !== 1 ||
          sessionAuditRowsInserted !== 1
        ) {
          return {
            ok: false,
            code: "TOKEN_NOT_ACTIVE",
            message:
              "Magic-link token is not active, is expired, or invite is no longer redeemable.",
          };
        }

        const sessionLookupResult = await findActiveSessionByHashInternal({
          tenantId: input.tenantId,
          tokenHash: input.session.tokenHash,
          nowIsoUtc: input.consumedAt,
        });

        if (!sessionLookupResult.ok) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: sessionLookupResult.message,
          };
        }

        if (!sessionLookupResult.sessionLookup) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Session was created but could not be reloaded from persistent storage.",
          };
        }

        return {
          ok: true,
          principal: sessionLookupResult.sessionLookup.principal,
          session: sessionLookupResult.sessionLookup.session,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async findActiveSessionByHash(input: {
      nowIsoUtc: string;
      tenantId: string;
      tokenHash: string;
    }): Promise<AuthRepositorySessionLookupResultV1> {
      return findActiveSessionByHashInternal(input);
    },

    async findActiveSessionByHashAnyTenant(input: {
      nowIsoUtc: string;
      tokenHash: string;
    }): Promise<AuthRepositorySessionLookupResultV1> {
      return findActiveSessionByHashAnyTenantInternal(input);
    },

    async revokeSessionWithAuditAtomic(input: {
      auditEvent: AuditEventV2;
      revokedAt: string;
      sessionId: string;
      tenantId: string;
    }): Promise<AuthRepositoryRevokeSessionWithAuditResultV1> {
      try {
        const validatedAuditEvent = parseAuditEventV2(input.auditEvent);

        if (
          validatedAuditEvent.tenantId !== input.tenantId ||
          validatedAuditEvent.targetType !== "session" ||
          validatedAuditEvent.targetId !== input.sessionId
        ) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Audit event tenant/session identifiers must match revoke input identifiers.",
          };
        }

        const [revokeResult, auditInsertResult] = await db.batch([
          db
            .prepare(UPDATE_ACTIVE_SESSION_TO_REVOKED_SQL)
            .bind(input.revokedAt, input.sessionId, input.tenantId),
          db
            .prepare(INSERT_AUDIT_EVENT_IF_SESSION_REVOKE_APPLIED_SQL)
            .bind(...toAuditDbValues(validatedAuditEvent)),
        ]);

        if (!revokeResult.success || !auditInsertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Failed to atomically revoke session and append audit event.",
          };
        }

        const revokedRows = Number(revokeResult.meta.changes ?? 0);
        const auditRows = Number(auditInsertResult.meta.changes ?? 0);

        if (revokedRows === 1 && auditRows === 1) {
          return {
            ok: true,
            revoked: true,
          };
        }

        if (revokedRows === 0 && auditRows === 0) {
          return {
            ok: true,
            revoked: false,
          };
        }

        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Session revoke and audit insertion results were inconsistent.",
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },
  };
}
