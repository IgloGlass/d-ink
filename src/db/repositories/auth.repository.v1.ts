import type { AuditEventV2 } from "../../shared/contracts/audit-event.v2";
import type {
  AuthInviteV1,
  AuthMagicLinkTokenV1,
  AuthPrincipalV1,
  AuthSessionV1,
  AuthUserV1,
  TenantMembershipV1,
} from "../../shared/contracts/auth-magic-link.v1";
import type { D1Database } from "../../shared/types/d1";
import { createAuthRepositoryReadsV1 } from "./auth.repository.reads.v1";
import { createAuthRepositoryWritesV1 } from "./auth.repository.writes.v1";

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

/**
 * Creates a D1-backed V1 auth repository.
 */
export function createD1AuthRepositoryV1(db: D1Database): AuthRepositoryV1 {
  const reads = createAuthRepositoryReadsV1(db);
  const writes = createAuthRepositoryWritesV1({
    db,
    findActiveSessionByHash: reads.findActiveSessionByHash,
  });

  return {
    consumeTokenAndCreateSessionWithAuditAtomic:
      writes.consumeTokenAndCreateSessionWithAuditAtomic,
    createInviteAndIssueTokenWithAuditAtomic:
      writes.createInviteAndIssueTokenWithAuditAtomic,
    findActiveSessionByHash: reads.findActiveSessionByHash,
    findActiveSessionByHashAnyTenant: reads.findActiveSessionByHashAnyTenant,
    findActiveTokenByHash: reads.findActiveTokenByHash,
    getMembershipByTenantAndUser: reads.getMembershipByTenantAndUser,
    revokeSessionWithAuditAtomic: writes.revokeSessionWithAuditAtomic,
  };
}
