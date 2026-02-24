import type { z } from "zod";

import type { AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  type AuthErrorCodeV1,
  type AuthFailureV1,
  AuthInviteV1Schema,
  AuthMagicLinkTokenV1Schema,
  AuthenticateSessionRequestV1Schema,
  type AuthenticateSessionResultV1,
  ConsumeMagicLinkTokenRequestV1Schema,
  type ConsumeMagicLinkTokenResultV1,
  CreateMagicLinkInviteRequestV1Schema,
  type CreateMagicLinkInviteResultV1,
  LogoutSessionRequestV1Schema,
  type LogoutSessionResultV1,
  normalizeEmailV1,
  parseAuthenticateSessionResultV1,
  parseConsumeMagicLinkTokenResultV1,
  parseCreateMagicLinkInviteResultV1,
  parseLogoutSessionResultV1,
} from "../../shared/contracts/auth-magic-link.v1";

const MAGIC_LINK_TOKEN_TTL_MS = 15 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Auth events are tenant-scoped and not tied to a workspace entity in V1.
const AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1 = "00000000-0000-4000-8000-000000000001";

const hmacKeyCacheBySecret = new Map<string, Promise<CryptoKey>>();

/**
 * Dependencies required by the V1 auth magic-link workflow service.
 */
export interface AuthMagicLinkDepsV1 {
  authRepository: AuthRepositoryV1;
  generateId: () => string;
  generateToken: () => string;
  hmacSecret: string;
  nowIsoUtc: () => string;
}

function addDurationToIsoUtc(
  isoUtc: string,
  durationMs: number,
): string | null {
  const baseTimeMs = Date.parse(isoUtc);
  if (Number.isNaN(baseTimeMs)) {
    return null;
  }

  return new Date(baseTimeMs + durationMs).toISOString();
}

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function buildFailure(
  code: AuthErrorCodeV1,
  message: string,
  userMessage: string,
  context: Record<string, unknown>,
): AuthFailureV1 {
  return {
    ok: false,
    error: {
      code,
      message,
      user_message: userMessage,
      context,
    },
  };
}

function isExpiredIso(expiresAtIsoUtc: string, nowIsoUtc: string): boolean {
  const expiresAtTimeMs = Date.parse(expiresAtIsoUtc);
  const nowTimeMs = Date.parse(nowIsoUtc);

  if (Number.isNaN(expiresAtTimeMs) || Number.isNaN(nowTimeMs)) {
    return true;
  }

  return expiresAtTimeMs <= nowTimeMs;
}

function toUnknownErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown auth workflow error.";
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}

/**
 * Hashes token material with HMAC-SHA256 and returns a lowercase hex digest.
 */
export async function hashTokenWithHmacV1(
  secret: string,
  rawToken: string,
): Promise<string> {
  if (secret.trim().length === 0) {
    throw new Error("AUTH_TOKEN_HMAC_SECRET must be non-empty.");
  }

  const encoder = new TextEncoder();
  let cryptoKeyPromise = hmacKeyCacheBySecret.get(secret);
  if (!cryptoKeyPromise) {
    cryptoKeyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    hmacKeyCacheBySecret.set(secret, cryptoKeyPromise);
  }
  const cryptoKey = await cryptoKeyPromise;

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(rawToken),
  );

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Creates a tenant invite and issues a one-time magic-link token.
 */
export async function createMagicLinkInviteV1(
  input: unknown,
  deps: AuthMagicLinkDepsV1,
): Promise<CreateMagicLinkInviteResultV1> {
  const parsed = CreateMagicLinkInviteRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseCreateMagicLinkInviteResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Create magic-link invite payload is invalid.",
        "The invite request is invalid. Please review inputs and try again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const normalizedEmail = normalizeEmailV1(parsed.data.inviteeEmail);
    const actorMembershipResult =
      await deps.authRepository.getMembershipByTenantAndUser({
        tenantId: parsed.data.tenantId,
        userId: parsed.data.actorUserId,
      });

    if (!actorMembershipResult.ok) {
      return parseCreateMagicLinkInviteResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          actorMembershipResult.message,
          "The invite could not be created due to a storage error.",
          {
            operation: "auth.getMembershipByTenantAndUser",
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    if (!actorMembershipResult.membership) {
      return parseCreateMagicLinkInviteResultV1(
        buildFailure(
          "MEMBERSHIP_NOT_FOUND",
          "Actor does not have tenant membership.",
          "You do not have access to this tenant.",
          {
            actorUserId: parsed.data.actorUserId,
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    if (actorMembershipResult.membership.role !== "Admin") {
      return parseCreateMagicLinkInviteResultV1(
        buildFailure(
          "ROLE_FORBIDDEN",
          "Only Admin can create auth invites in V1.",
          "Only Admin users can invite members.",
          {
            actorRole: actorMembershipResult.membership.role,
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    const nowIsoUtc = deps.nowIsoUtc();
    const inviteExpiresAt = addDurationToIsoUtc(nowIsoUtc, INVITE_TTL_MS);
    const magicLinkExpiresAt = addDurationToIsoUtc(
      nowIsoUtc,
      MAGIC_LINK_TOKEN_TTL_MS,
    );

    if (!inviteExpiresAt || !magicLinkExpiresAt) {
      return parseCreateMagicLinkInviteResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          "Failed to compute auth token expiry timestamps from nowIsoUtc.",
          "The invite could not be created right now. Please try again.",
          {
            nowIsoUtc,
          },
        ),
      );
    }

    const rawMagicLinkToken = deps.generateToken();
    const magicLinkTokenHash = await hashTokenWithHmacV1(
      deps.hmacSecret,
      rawMagicLinkToken,
    );

    const invite = AuthInviteV1Schema.parse({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      emailNormalized: normalizedEmail,
      role: parsed.data.inviteeRole,
      status: "pending",
      invitedByUserId: parsed.data.actorUserId,
      createdAt: nowIsoUtc,
      expiresAt: inviteExpiresAt,
    });

    const token = AuthMagicLinkTokenV1Schema.parse({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      inviteId: invite.id,
      emailNormalized: normalizedEmail,
      tokenHash: magicLinkTokenHash,
      status: "active",
      issuedAt: nowIsoUtc,
      expiresAt: magicLinkExpiresAt,
    });

    const inviteCreatedAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1,
      actorType: "user",
      actorUserId: parsed.data.actorUserId,
      eventType: "auth.invite_created",
      targetType: "invite",
      targetId: invite.id,
      after: {
        emailNormalized: invite.emailNormalized,
        role: invite.role,
        status: invite.status,
      },
      timestamp: deps.nowIsoUtc(),
      context: {
        invitedByUserId: parsed.data.actorUserId,
      },
    });

    const magicLinkIssuedAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1,
      actorType: "user",
      actorUserId: parsed.data.actorUserId,
      eventType: "auth.magic_link_issued",
      targetType: "magic_link_token",
      targetId: token.id,
      after: {
        expiresAt: token.expiresAt,
        inviteId: token.inviteId,
        status: token.status,
      },
      timestamp: deps.nowIsoUtc(),
      context: {
        inviteId: invite.id,
      },
    });

    const persistResult =
      await deps.authRepository.createInviteAndIssueTokenWithAuditAtomic({
        invite,
        token,
        inviteCreatedAuditEvent,
        magicLinkIssuedAuditEvent,
        revokedAt: nowIsoUtc,
      });

    if (!persistResult.ok) {
      return parseCreateMagicLinkInviteResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          persistResult.message,
          "The invite could not be created due to a storage error.",
          {
            operation: "auth.createInviteAndIssueTokenWithAuditAtomic",
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    return parseCreateMagicLinkInviteResultV1({
      ok: true,
      invite: persistResult.invite,
      magicLinkToken: rawMagicLinkToken,
      magicLinkExpiresAt: token.expiresAt,
    });
  } catch (error) {
    return parseCreateMagicLinkInviteResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "The invite could not be created due to an unexpected error.",
        {
          operation: "auth.createMagicLinkInviteV1",
        },
      ),
    );
  }
}

/**
 * Consumes a one-time magic-link token and creates a stateful tenant session.
 */
export async function consumeMagicLinkTokenV1(
  input: unknown,
  deps: AuthMagicLinkDepsV1,
): Promise<ConsumeMagicLinkTokenResultV1> {
  const parsed = ConsumeMagicLinkTokenRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseConsumeMagicLinkTokenResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Consume magic-link token payload is invalid.",
        "The sign-in link request is invalid. Please try again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const nowIsoUtc = deps.nowIsoUtc();
    const tokenHash = await hashTokenWithHmacV1(
      deps.hmacSecret,
      parsed.data.magicLinkToken,
    );

    const tokenLookupResult = await deps.authRepository.findActiveTokenByHash({
      tenantId: parsed.data.tenantId,
      tokenHash,
    });

    if (!tokenLookupResult.ok) {
      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          tokenLookupResult.message,
          "Sign-in could not be completed due to a storage error.",
          {
            operation: "auth.findActiveTokenByHash",
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    if (!tokenLookupResult.tokenLookup) {
      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(
          "TOKEN_INVALID_OR_EXPIRED",
          "Magic-link token is invalid or not active.",
          "This sign-in link is invalid or has expired.",
          {
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    const { invite, token, user } = tokenLookupResult.tokenLookup;

    if (isExpiredIso(token.expiresAt, nowIsoUtc)) {
      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(
          "TOKEN_INVALID_OR_EXPIRED",
          "Magic-link token has expired.",
          "This sign-in link has expired. Request a new link.",
          {
            expiresAt: token.expiresAt,
            tokenId: token.id,
          },
        ),
      );
    }

    if (
      invite.status !== "pending" ||
      isExpiredIso(invite.expiresAt, nowIsoUtc)
    ) {
      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(
          "INVITE_NOT_ACTIVE",
          "Invite is not pending or has expired.",
          "This invite is no longer active. Ask an Admin for a new invite.",
          {
            inviteExpiresAt: invite.expiresAt,
            inviteId: invite.id,
            inviteStatus: invite.status,
          },
        ),
      );
    }

    const rawSessionToken = deps.generateToken();
    const sessionTokenHash = await hashTokenWithHmacV1(
      deps.hmacSecret,
      rawSessionToken,
    );
    const sessionCreatedAt = deps.nowIsoUtc();
    const sessionExpiresAt = addDurationToIsoUtc(
      sessionCreatedAt,
      SESSION_TTL_MS,
    );

    if (!sessionExpiresAt) {
      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          "Failed to compute auth session expiry timestamp from nowIsoUtc.",
          "Sign-in could not be completed right now. Please try again.",
          {
            sessionCreatedAt,
          },
        ),
      );
    }

    const userId = user?.id ?? deps.generateId();
    const membershipId =
      tokenLookupResult.tokenLookup.membership?.id ?? deps.generateId();

    const consumeAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1,
      actorType: "user",
      actorUserId: userId,
      eventType: "auth.magic_link_consumed",
      targetType: "magic_link_token",
      targetId: token.id,
      before: {
        status: "active",
      },
      after: {
        status: "consumed",
      },
      timestamp: deps.nowIsoUtc(),
      context: {
        inviteId: invite.id,
      },
    });

    const sessionCreatedAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1,
      actorType: "user",
      actorUserId: userId,
      eventType: "auth.session_created",
      targetType: "session",
      targetId: deps.generateId(),
      after: {
        expiresAt: sessionExpiresAt,
      },
      timestamp: deps.nowIsoUtc(),
      context: {
        inviteId: invite.id,
      },
    });

    const consumeResult =
      await deps.authRepository.consumeTokenAndCreateSessionWithAuditAtomic({
        consumedAt: nowIsoUtc,
        tenantId: parsed.data.tenantId,
        tokenId: token.id,
        inviteId: invite.id,
        emailNormalized: invite.emailNormalized,
        invitedRole: invite.role,
        userId,
        membershipId,
        session: {
          id: sessionCreatedAuditEvent.targetId,
          tokenHash: sessionTokenHash,
          createdAt: sessionCreatedAt,
          expiresAt: sessionExpiresAt,
        },
        consumeAuditEvent,
        sessionCreatedAuditEvent,
      });

    if (!consumeResult.ok) {
      const failureCode =
        consumeResult.code === "TOKEN_NOT_ACTIVE"
          ? "TOKEN_INVALID_OR_EXPIRED"
          : "PERSISTENCE_ERROR";
      const userMessage =
        failureCode === "TOKEN_INVALID_OR_EXPIRED"
          ? "This sign-in link is invalid or has expired."
          : "Sign-in could not be completed due to a storage error.";

      return parseConsumeMagicLinkTokenResultV1(
        buildFailure(failureCode, consumeResult.message, userMessage, {
          operation: "auth.consumeTokenAndCreateSessionWithAuditAtomic",
          tenantId: parsed.data.tenantId,
          tokenId: token.id,
        }),
      );
    }

    return parseConsumeMagicLinkTokenResultV1({
      ok: true,
      principal: consumeResult.principal,
      session: consumeResult.session,
      sessionToken: rawSessionToken,
    });
  } catch (error) {
    return parseConsumeMagicLinkTokenResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Sign-in could not be completed due to an unexpected error.",
        {
          operation: "auth.consumeMagicLinkTokenV1",
        },
      ),
    );
  }
}

/**
 * Authenticates an existing session token for tenant-scoped access.
 */
export async function authenticateSessionV1(
  input: unknown,
  deps: AuthMagicLinkDepsV1,
): Promise<AuthenticateSessionResultV1> {
  const parsed = AuthenticateSessionRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseAuthenticateSessionResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Authenticate session payload is invalid.",
        "The session request is invalid. Please sign in again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const nowIsoUtc = deps.nowIsoUtc();
    const sessionTokenHash = await hashTokenWithHmacV1(
      deps.hmacSecret,
      parsed.data.sessionToken,
    );

    const sessionLookupResult =
      await deps.authRepository.findActiveSessionByHash({
        tenantId: parsed.data.tenantId,
        tokenHash: sessionTokenHash,
        nowIsoUtc,
      });

    if (!sessionLookupResult.ok) {
      return parseAuthenticateSessionResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          sessionLookupResult.message,
          "Session validation failed due to a storage error.",
          {
            operation: "auth.findActiveSessionByHash",
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    if (!sessionLookupResult.sessionLookup) {
      return parseAuthenticateSessionResultV1(
        buildFailure(
          "SESSION_INVALID_OR_EXPIRED",
          "Session token is invalid, expired, or revoked.",
          "Your session is no longer valid. Please sign in again.",
          {
            tenantId: parsed.data.tenantId,
          },
        ),
      );
    }

    return parseAuthenticateSessionResultV1({
      ok: true,
      principal: sessionLookupResult.sessionLookup.principal,
      session: sessionLookupResult.sessionLookup.session,
    });
  } catch (error) {
    return parseAuthenticateSessionResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Session validation failed due to an unexpected error.",
        {
          operation: "auth.authenticateSessionV1",
        },
      ),
    );
  }
}

/**
 * Revokes the current active session token in an idempotent way.
 */
export async function logoutSessionV1(
  input: unknown,
  deps: AuthMagicLinkDepsV1,
): Promise<LogoutSessionResultV1> {
  const parsed = LogoutSessionRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseLogoutSessionResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Logout session payload is invalid.",
        "The logout request is invalid. Please try again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const nowIsoUtc = deps.nowIsoUtc();
    const sessionTokenHash = await hashTokenWithHmacV1(
      deps.hmacSecret,
      parsed.data.sessionToken,
    );

    const sessionLookupResult =
      await deps.authRepository.findActiveSessionByHashAnyTenant({
        tokenHash: sessionTokenHash,
        nowIsoUtc,
      });

    if (!sessionLookupResult.ok) {
      return parseLogoutSessionResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          sessionLookupResult.message,
          "Logout failed due to a storage error.",
          {
            operation: "auth.findActiveSessionByHashAnyTenant",
          },
        ),
      );
    }

    if (!sessionLookupResult.sessionLookup) {
      return parseLogoutSessionResultV1({
        ok: true,
      });
    }

    const { principal, session } = sessionLookupResult.sessionLookup;

    const sessionRevokedAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: principal.tenantId,
      workspaceId: AUTH_AUDIT_SCOPE_WORKSPACE_ID_V1,
      actorType: "user",
      actorUserId: principal.userId,
      eventType: "auth.session_revoked",
      targetType: "session",
      targetId: session.id,
      before: {
        revokedAt: session.revokedAt ?? null,
      },
      after: {
        revokedAt: nowIsoUtc,
      },
      timestamp: nowIsoUtc,
      context: {
        source: "logout",
      },
    });

    const revokeResult = await deps.authRepository.revokeSessionWithAuditAtomic(
      {
        tenantId: principal.tenantId,
        sessionId: session.id,
        revokedAt: nowIsoUtc,
        auditEvent: sessionRevokedAuditEvent,
      },
    );

    if (!revokeResult.ok) {
      return parseLogoutSessionResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          revokeResult.message,
          "Logout failed due to a storage error.",
          {
            operation: "auth.revokeSessionWithAuditAtomic",
            tenantId: principal.tenantId,
            sessionId: session.id,
          },
        ),
      );
    }

    return parseLogoutSessionResultV1({
      ok: true,
    });
  } catch (error) {
    return parseLogoutSessionResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Logout failed due to an unexpected error.",
        {
          operation: "auth.logoutSessionV1",
        },
      ),
    );
  }
}
