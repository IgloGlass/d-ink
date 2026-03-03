import { describe, expect, it, vi } from "vitest";

import { resolveSessionGuardV1 } from "../../../src/server/http/session-guard.v1";
import type { D1Database } from "../../../src/shared/types/d1";

const TEST_OPERATION = "auth.findActiveSessionPrincipalByTokenV1";
const TEST_SECRET = "test-secret";
const TEST_DB = {} as D1Database;

describe("resolveSessionGuardV1", () => {
  it("returns SESSION_MISSING when session cookie is absent", async () => {
    const lookupPrincipalByToken = vi.fn();

    const result = await resolveSessionGuardV1({
      request: new Request("https://example.com/v1/auth/session/current"),
      db: TEST_DB,
      hmacSecret: TEST_SECRET,
      operation: TEST_OPERATION,
      lookupPrincipalByToken,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: {
        code: "SESSION_MISSING",
        context: {
          operation: TEST_OPERATION,
        },
        message: "A valid authenticated session is required.",
        user_message: "A valid authenticated session is required.",
      },
    });
    expect(lookupPrincipalByToken).not.toHaveBeenCalled();
  });

  it("maps invalid session lookup to a 401 failure", async () => {
    const lookupPrincipalByToken = vi.fn().mockResolvedValue({
      ok: false,
      code: "SESSION_INVALID_OR_EXPIRED",
      message: "Session token is invalid, expired, or revoked.",
      userMessage: "Your session is no longer valid. Please sign in again.",
      context: {
        operation: TEST_OPERATION,
      },
    });

    const result = await resolveSessionGuardV1({
      request: new Request("https://example.com/v1/auth/session/current", {
        headers: {
          Cookie: "dink_session_v1=invalid-session-token",
        },
      }),
      db: TEST_DB,
      hmacSecret: TEST_SECRET,
      operation: TEST_OPERATION,
      lookupPrincipalByToken,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: {
        code: "SESSION_INVALID_OR_EXPIRED",
        context: {
          operation: TEST_OPERATION,
        },
        message: "Session token is invalid, expired, or revoked.",
        user_message: "Your session is no longer valid. Please sign in again.",
      },
    });
    expect(lookupPrincipalByToken).toHaveBeenCalledWith({
      db: TEST_DB,
      hmacSecret: TEST_SECRET,
      operation: TEST_OPERATION,
      sessionToken: "invalid-session-token",
    });
  });

  it("returns TENANT_MISMATCH when request tenant differs from principal tenant", async () => {
    const lookupPrincipalByToken = vi.fn().mockResolvedValue({
      ok: true,
      principal: {
        tenantId: "30000000-0000-4000-8000-000000000001",
        userId: "30000000-0000-4000-8000-000000000002",
        emailNormalized: "user@example.com",
        role: "Admin",
      },
    });

    const result = await resolveSessionGuardV1({
      request: new Request("https://example.com/v1/workspaces", {
        headers: {
          Cookie: "dink_session_v1=valid-token",
        },
      }),
      db: TEST_DB,
      hmacSecret: TEST_SECRET,
      operation: "workspace.findActiveSessionPrincipalByTokenV1",
      requestTenantId: "30000000-0000-4000-8000-000000000099",
      tenantMismatchUserMessage:
        "You can only access workspace resources in the active tenant.",
      lookupPrincipalByToken,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: {
        code: "TENANT_MISMATCH",
        context: {
          operation: "workspace.findActiveSessionPrincipalByTokenV1",
          requestTenantId: "30000000-0000-4000-8000-000000000099",
          sessionTenantId: "30000000-0000-4000-8000-000000000001",
        },
        message: "Session tenant does not match requested tenant.",
        user_message:
          "You can only access workspace resources in the active tenant.",
      },
    });
  });

  it("returns principal and session token on success", async () => {
    const lookupPrincipalByToken = vi.fn().mockResolvedValue({
      ok: true,
      principal: {
        tenantId: "30000000-0000-4000-8000-000000000001",
        userId: "30000000-0000-4000-8000-000000000002",
        emailNormalized: "user@example.com",
        role: "Editor",
      },
    });

    const result = await resolveSessionGuardV1({
      request: new Request("https://example.com/v1/auth/session/current", {
        headers: {
          Cookie: "other=1; dink_session_v1=valid-session-token",
        },
      }),
      db: TEST_DB,
      hmacSecret: TEST_SECRET,
      operation: TEST_OPERATION,
      lookupPrincipalByToken,
    });

    expect(result).toEqual({
      ok: true,
      principal: {
        tenantId: "30000000-0000-4000-8000-000000000001",
        userId: "30000000-0000-4000-8000-000000000002",
        emailNormalized: "user@example.com",
        role: "Editor",
      },
      sessionToken: "valid-session-token",
    });
  });
});
