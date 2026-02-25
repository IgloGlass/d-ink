import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../shared/contracts/audit-event.v2";
import {
  AuthInviteV1Schema,
  AuthMagicLinkTokenV1Schema,
} from "../../shared/contracts/auth-magic-link.v1";
import type { D1Database } from "../../shared/types/d1";
import {
  INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL,
  INSERT_AUDIT_EVENT_IF_SESSION_REVOKE_APPLIED_SQL,
  INSERT_AUDIT_EVENT_SQL,
  INSERT_AUTH_INVITE_SQL,
  INSERT_AUTH_MAGIC_LINK_TOKEN_SQL,
  INSERT_MEMBERSHIP_IF_TOKEN_AND_INVITE_ACTIVE_SQL,
  INSERT_SESSION_IF_TOKEN_AND_INVITE_ACTIVE_SQL,
  INSERT_USER_IF_TOKEN_AND_INVITE_ACTIVE_SQL,
  REVOKE_ACTIVE_MAGIC_LINK_TOKENS_BY_TENANT_AND_EMAIL_SQL,
  REVOKE_PENDING_INVITES_BY_TENANT_AND_EMAIL_SQL,
  UPDATE_ACTIVE_SESSION_TO_REVOKED_SQL,
  UPDATE_INVITE_TO_ACCEPTED_SQL,
  UPDATE_MAGIC_LINK_TOKEN_TO_CONSUMED_SQL,
  UPDATE_MEMBERSHIP_ROLE_IF_TOKEN_AND_INVITE_ACTIVE_SQL,
} from "./auth.repository.queries.v1";
import type {
  AuthRepositoryConsumeTokenResultV1,
  AuthRepositoryCreateInviteResultV1,
  AuthRepositoryFailureV1,
  AuthRepositoryRevokeSessionWithAuditResultV1,
  AuthRepositorySessionLookupResultV1,
  ConsumeTokenAndCreateSessionWithAuditAtomicInputV1,
  CreateInviteAndIssueTokenWithAuditAtomicInputV1,
} from "./auth.repository.v1";

function toErrorMessage(_error: unknown): string {
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

export function createAuthRepositoryWritesV1(input: {
  db: D1Database;
  findActiveSessionByHash: (input: {
    nowIsoUtc: string;
    tenantId: string;
    tokenHash: string;
  }) => Promise<AuthRepositorySessionLookupResultV1>;
}) {
  async function createInviteAndIssueTokenWithAuditAtomic(
    payload: CreateInviteAndIssueTokenWithAuditAtomicInputV1,
  ): Promise<AuthRepositoryCreateInviteResultV1> {
    try {
      const invite = AuthInviteV1Schema.parse(payload.invite);
      const token = AuthMagicLinkTokenV1Schema.parse(payload.token);
      const inviteCreatedAuditEvent = parseAuditEventV2(
        payload.inviteCreatedAuditEvent,
      );
      const magicLinkIssuedAuditEvent = parseAuditEventV2(
        payload.magicLinkIssuedAuditEvent,
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
        input.db
          .prepare(REVOKE_PENDING_INVITES_BY_TENANT_AND_EMAIL_SQL)
          .bind(invite.tenantId, invite.emailNormalized, payload.revokedAt),
        input.db
          .prepare(REVOKE_ACTIVE_MAGIC_LINK_TOKENS_BY_TENANT_AND_EMAIL_SQL)
          .bind(invite.tenantId, invite.emailNormalized, payload.revokedAt),
        input.db
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
        input.db
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
        input.db
          .prepare(INSERT_AUDIT_EVENT_SQL)
          .bind(...toAuditDbValues(inviteCreatedAuditEvent)),
        input.db
          .prepare(INSERT_AUDIT_EVENT_SQL)
          .bind(...toAuditDbValues(magicLinkIssuedAuditEvent)),
      ];

      const batchResult = await input.db.batch(statements);
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
  }

  async function consumeTokenAndCreateSessionWithAuditAtomic(
    payload: ConsumeTokenAndCreateSessionWithAuditAtomicInputV1,
  ): Promise<AuthRepositoryConsumeTokenResultV1> {
    try {
      const consumeAuditEvent = parseAuditEventV2(payload.consumeAuditEvent);
      const sessionCreatedAuditEvent = parseAuditEventV2(
        payload.sessionCreatedAuditEvent,
      );

      if (
        consumeAuditEvent.tenantId !== payload.tenantId ||
        sessionCreatedAuditEvent.tenantId !== payload.tenantId
      ) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Audit event tenant identifiers must match consume request tenant identifier.",
        };
      }

      const batchResult = await input.db.batch([
        input.db
          .prepare(INSERT_USER_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
          .bind(
            payload.userId,
            payload.emailNormalized,
            payload.consumedAt,
            payload.tokenId,
            payload.tenantId,
            payload.inviteId,
          ),
        input.db
          .prepare(INSERT_MEMBERSHIP_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
          .bind(
            payload.membershipId,
            payload.tenantId,
            payload.invitedRole,
            payload.consumedAt,
            payload.emailNormalized,
            payload.tokenId,
            payload.inviteId,
          ),
        input.db
          .prepare(UPDATE_MEMBERSHIP_ROLE_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
          .bind(
            payload.invitedRole,
            payload.consumedAt,
            payload.tenantId,
            payload.emailNormalized,
            payload.tokenId,
            payload.inviteId,
          ),
        input.db
          .prepare(INSERT_SESSION_IF_TOKEN_AND_INVITE_ACTIVE_SQL)
          .bind(
            payload.session.id,
            payload.tenantId,
            payload.session.tokenHash,
            payload.session.createdAt,
            payload.session.expiresAt,
            payload.emailNormalized,
            payload.tokenId,
            payload.inviteId,
          ),
        input.db
          .prepare(UPDATE_MAGIC_LINK_TOKEN_TO_CONSUMED_SQL)
          .bind(
            payload.consumedAt,
            payload.emailNormalized,
            payload.tokenId,
            payload.tenantId,
            payload.inviteId,
          ),
        input.db
          .prepare(UPDATE_INVITE_TO_ACCEPTED_SQL)
          .bind(
            payload.consumedAt,
            payload.emailNormalized,
            payload.inviteId,
            payload.tenantId,
          ),
        input.db
          .prepare(INSERT_AUDIT_EVENT_IF_CONSUME_APPLIED_SQL)
          .bind(...toAuditDbValues(consumeAuditEvent)),
        input.db
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

      const sessionRowsInserted = Number(sessionInsertResult.meta.changes ?? 0);
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

      const sessionLookupResult = await input.findActiveSessionByHash({
        tenantId: payload.tenantId,
        tokenHash: payload.session.tokenHash,
        nowIsoUtc: payload.consumedAt,
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
  }

  async function revokeSessionWithAuditAtomic(inputPayload: {
    auditEvent: AuditEventV2;
    revokedAt: string;
    sessionId: string;
    tenantId: string;
  }): Promise<AuthRepositoryRevokeSessionWithAuditResultV1> {
    try {
      const validatedAuditEvent = parseAuditEventV2(inputPayload.auditEvent);

      if (
        validatedAuditEvent.tenantId !== inputPayload.tenantId ||
        validatedAuditEvent.targetType !== "session" ||
        validatedAuditEvent.targetId !== inputPayload.sessionId
      ) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Audit event tenant/session identifiers must match revoke input identifiers.",
        };
      }

      const [revokeResult, auditInsertResult] = await input.db.batch([
        input.db
          .prepare(UPDATE_ACTIVE_SESSION_TO_REVOKED_SQL)
          .bind(
            inputPayload.revokedAt,
            inputPayload.sessionId,
            inputPayload.tenantId,
          ),
        input.db
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
  }

  return {
    createInviteAndIssueTokenWithAuditAtomic,
    consumeTokenAndCreateSessionWithAuditAtomic,
    revokeSessionWithAuditAtomic,
  };
}
