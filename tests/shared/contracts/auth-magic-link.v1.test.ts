import { describe, expect, it } from "vitest";

import {
  safeParseAuthenticateSessionRequestV1,
  safeParseAuthenticateSessionResultV1,
  safeParseConsumeMagicLinkTokenRequestV1,
  safeParseConsumeMagicLinkTokenResultV1,
  safeParseCreateMagicLinkInviteRequestV1,
  safeParseCreateMagicLinkInviteResultV1,
  safeParseLogoutSessionRequestV1,
  safeParseLogoutSessionResultV1,
} from "../../../src/shared/contracts/auth-magic-link.v1";

describe("Auth magic-link shared contracts", () => {
  const validInvite = {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    emailNormalized: "invitee@example.com",
    role: "Editor",
    status: "pending",
    invitedByUserId: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-02-24T10:00:00.000Z",
    expiresAt: "2026-03-03T10:00:00.000Z",
  } as const;

  const validPrincipal = {
    tenantId: "22222222-2222-4222-8222-222222222222",
    userId: "44444444-4444-4444-8444-444444444444",
    emailNormalized: "invitee@example.com",
    role: "Editor",
  } as const;

  const validSession = {
    id: "55555555-5555-4555-8555-555555555555",
    tenantId: "22222222-2222-4222-8222-222222222222",
    userId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-02-24T10:10:00.000Z",
    expiresAt: "2026-02-25T10:10:00.000Z",
    lastSeenAt: "2026-02-24T10:10:00.000Z",
  } as const;

  it("accepts valid create invite request", () => {
    const result = safeParseCreateMagicLinkInviteRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      inviteeEmail: "Invitee@Example.com",
      inviteeRole: "Editor",
      actorUserId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.success).toBe(true);
  });

  it("accepts create invite success and failure result payloads", () => {
    const successResult = safeParseCreateMagicLinkInviteResultV1({
      ok: true,
      invite: validInvite,
      magicLinkToken: "raw-token-value",
      magicLinkExpiresAt: "2026-02-24T10:15:00.000Z",
    });

    const failureResult = safeParseCreateMagicLinkInviteResultV1({
      ok: false,
      error: {
        code: "ROLE_FORBIDDEN",
        message: "Only Admin may invite.",
        user_message: "Only Admin users can invite members.",
        context: {
          actorRole: "Editor",
        },
      },
    });

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(true);
  });

  it("accepts consume and authenticate request/result payloads", () => {
    const consumeRequest = safeParseConsumeMagicLinkTokenRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      magicLinkToken: "magic-link-token",
    });

    const consumeResult = safeParseConsumeMagicLinkTokenResultV1({
      ok: true,
      principal: validPrincipal,
      session: validSession,
      sessionToken: "session-token",
    });

    const authenticateRequest = safeParseAuthenticateSessionRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      sessionToken: "session-token",
    });

    const authenticateResult = safeParseAuthenticateSessionResultV1({
      ok: false,
      error: {
        code: "SESSION_INVALID_OR_EXPIRED",
        message: "Session invalid.",
        user_message: "Please sign in again.",
        context: {
          reason: "expired",
        },
      },
    });

    const logoutRequest = safeParseLogoutSessionRequestV1({
      sessionToken: "session-token",
    });
    const logoutResult = safeParseLogoutSessionResultV1({
      ok: true,
    });
    const logoutFailureResult = safeParseLogoutSessionResultV1({
      ok: false,
      error: {
        code: "PERSISTENCE_ERROR",
        message: "Storage failure.",
        user_message: "Please try again.",
        context: {
          operation: "auth.logoutSessionV1",
        },
      },
    });

    expect(consumeRequest.success).toBe(true);
    expect(consumeResult.success).toBe(true);
    expect(authenticateRequest.success).toBe(true);
    expect(authenticateResult.success).toBe(true);
    expect(logoutRequest.success).toBe(true);
    expect(logoutResult.success).toBe(true);
    expect(logoutFailureResult.success).toBe(true);
  });

  it("rejects unknown top-level fields via strict schemas", () => {
    const createInviteResult = safeParseCreateMagicLinkInviteRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      inviteeEmail: "invitee@example.com",
      inviteeRole: "Editor",
      actorUserId: "33333333-3333-4333-8333-333333333333",
      unexpected: true,
    });

    const consumeResult = safeParseConsumeMagicLinkTokenRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      magicLinkToken: "magic-link-token",
      unexpected: true,
    });
    const logoutResult = safeParseLogoutSessionRequestV1({
      sessionToken: "session-token",
      unexpected: true,
    });

    expect(createInviteResult.success).toBe(false);
    expect(consumeResult.success).toBe(false);
    expect(logoutResult.success).toBe(false);
  });

  it("rejects invalid role/status/error-code values", () => {
    const invalidRole = safeParseCreateMagicLinkInviteRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      inviteeEmail: "invitee@example.com",
      inviteeRole: "Reviewer",
      actorUserId: "33333333-3333-4333-8333-333333333333",
    });

    const invalidStatus = safeParseCreateMagicLinkInviteResultV1({
      ok: true,
      invite: {
        ...validInvite,
        status: "processing",
      },
      magicLinkToken: "raw-token-value",
      magicLinkExpiresAt: "2026-02-24T10:15:00.000Z",
    });

    const invalidErrorCode = safeParseAuthenticateSessionResultV1({
      ok: false,
      error: {
        code: "NOT_ALLOWED",
        message: "Invalid code.",
        user_message: "Invalid code.",
        context: {},
      },
    });

    expect(invalidRole.success).toBe(false);
    expect(invalidStatus.success).toBe(false);
    expect(invalidErrorCode.success).toBe(false);
  });

  it("rejects oversized token payloads", () => {
    const oversizedToken = "a".repeat(513);

    const consumeRequest = safeParseConsumeMagicLinkTokenRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      magicLinkToken: oversizedToken,
    });
    const authenticateRequest = safeParseAuthenticateSessionRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      sessionToken: oversizedToken,
    });
    const logoutRequest = safeParseLogoutSessionRequestV1({
      sessionToken: oversizedToken,
    });

    expect(consumeRequest.success).toBe(false);
    expect(authenticateRequest.success).toBe(false);
    expect(logoutRequest.success).toBe(false);
  });

  it("rejects empty logout token payloads", () => {
    const logoutRequest = safeParseLogoutSessionRequestV1({
      sessionToken: "   ",
    });

    expect(logoutRequest.success).toBe(false);
  });
});
