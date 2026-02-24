import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";

const TENANT_A = "70000000-0000-4000-8000-000000000001";
const TENANT_B = "70000000-0000-4000-8000-000000000002";
const ADMIN_USER_ID = "70000000-0000-4000-8000-000000000003";
const EDITOR_USER_ID = "70000000-0000-4000-8000-000000000004";

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

function buildJsonRequest(input: {
  body: unknown;
  cookie?: string;
  origin?: string;
  method: "POST";
  url: string;
}): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }
  if (input.origin) {
    headers.set("Origin", input.origin);
  }

  return new Request(input.url, {
    method: input.method,
    headers,
    body: JSON.stringify(input.body),
  });
}

function getSetCookieValues(response: Response): string[] {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    return headersWithGetSetCookie.getSetCookie();
  }

  const rawValue = response.headers.get("Set-Cookie");
  if (!rawValue) {
    return [];
  }

  return rawValue.split(",").map((value) => value.trim());
}

function buildSessionCookie(token: string, tenantId?: string): string {
  const parts = [`dink_session_v1=${token}`];
  if (tenantId) {
    parts.push(`dink_tenant_v1=${tenantId}`);
  }

  return parts.join("; ");
}

async function seedSession(input: {
  emailNormalized: string;
  role: "Admin" | "Editor";
  sessionToken: string;
  tenantId: string;
  userId: string;
}): Promise<void> {
  const nowTimeMs = Date.now();
  const nowIso = new Date(nowTimeMs).toISOString();
  const expiresAt = new Date(nowTimeMs + 24 * 60 * 60 * 1000).toISOString();
  const sessionTokenHash = await hashTokenWithHmacV1(
    AUTH_TOKEN_HMAC_SECRET,
    input.sessionToken,
  );

  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(input.userId, input.emailNormalized, nowIso)
    .run();

  await env.DB.prepare(
    `
      INSERT INTO tenant_memberships (
        id,
        tenant_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      input.role,
      nowIso,
      nowIso,
    )
    .run();

  await env.DB.prepare(
    `
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
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?5)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      sessionTokenHash,
      nowIso,
      expiresAt,
    )
    .run();
}

async function createInviteAsAdmin(input: {
  adminSessionToken: string;
  tenantId: string;
}): Promise<{
  magicLinkUrl: string;
}> {
  const inviteRequest = buildJsonRequest({
    method: "POST",
    url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
    cookie: buildSessionCookie(input.adminSessionToken, input.tenantId),
    body: {
      tenantId: input.tenantId,
      inviteeEmail: "invitee@example.com",
      inviteeRole: "Editor",
    },
  });

  const response = await worker.fetch(inviteRequest, buildWorkerEnv());
  expect(response.status).toBe(201);

  const payload = (await response.json()) as {
    magicLinkUrl: string;
    ok: boolean;
  };
  expect(payload.ok).toBe(true);

  return {
    magicLinkUrl: payload.magicLinkUrl,
  };
}

describe("worker auth magic-link routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("POST invites without session cookie returns 401", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
      body: {
        tenantId: TENANT_A,
        inviteeEmail: "invitee@example.com",
        inviteeRole: "Editor",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: {
        code: string;
      };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("POST invites with editor session returns 403", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "editor@example.com",
      role: "Editor",
      sessionToken: "editor-session-token",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
      cookie: buildSessionCookie("editor-session-token", TENANT_A),
      body: {
        tenantId: TENANT_A,
        inviteeEmail: "invitee@example.com",
        inviteeRole: "Editor",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: {
        code: string;
      };
    };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("ROLE_FORBIDDEN");
  });

  it("POST invites with admin session returns 201 and ready magic link URL", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin@example.com",
      role: "Admin",
      sessionToken: "admin-session-token",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
      cookie: buildSessionCookie("admin-session-token", TENANT_A),
      body: {
        tenantId: TENANT_A,
        inviteeEmail: "invitee@example.com",
        inviteeRole: "Editor",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      invite: { id: string };
      magicLinkExpiresAt: string;
      magicLinkUrl: string;
      ok: true;
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.invite.id).toBeTruthy();
    expect(payload.magicLinkExpiresAt).toBeTruthy();
    expect(payload.magicLinkUrl).toBeTruthy();
    expect(
      Object.prototype.hasOwnProperty.call(payload, "magicLinkToken"),
    ).toBe(false);
  });

  it("generated magicLinkUrl uses APP_BASE_URL and encodes query params", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin2@example.com",
      role: "Admin",
      sessionToken: "admin-session-token-url",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
      cookie: buildSessionCookie("admin-session-token-url", TENANT_A),
      body: {
        tenantId: TENANT_A,
        inviteeEmail: "invitee+filter@example.com",
        inviteeRole: "Editor",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      magicLinkUrl: string;
    };

    const magicLinkUrl = new URL(payload.magicLinkUrl);
    expect(magicLinkUrl.origin).toBe(new URL(APP_BASE_URL).origin);
    expect(magicLinkUrl.pathname).toBe("/v1/auth/magic-link/consume");
    expect(magicLinkUrl.searchParams.get("tenantId")).toBe(TENANT_A);
    expect(magicLinkUrl.searchParams.get("token")).toBeTruthy();
  });

  it("GET consume valid token returns 303, sets cookie, and redirects success", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin3@example.com",
      role: "Admin",
      sessionToken: "admin-session-token-consume",
    });

    const invite = await createInviteAsAdmin({
      adminSessionToken: "admin-session-token-consume",
      tenantId: TENANT_A,
    });

    const consumeResponse = await worker.fetch(
      new Request(invite.magicLinkUrl, { method: "GET" }),
      buildWorkerEnv(),
    );

    expect(consumeResponse.status).toBe(303);
    expect(consumeResponse.headers.get("Location")).toBe(
      `${APP_BASE_URL}/?auth=success`,
    );

    const setCookie = consumeResponse.headers.get("Set-Cookie");
    expect(setCookie).toContain("dink_session_v1=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=86400");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Secure");
  });

  it("GET consume invalid token redirects error and sets no cookie", async () => {
    const request = new Request(
      `${APP_BASE_URL}/v1/auth/magic-link/consume?tenantId=${TENANT_A}&token=invalid-token`,
      { method: "GET" },
    );

    const response = await worker.fetch(request, buildWorkerEnv());
    const location = response.headers.get("Location") ?? "";

    expect(response.status).toBe(303);
    expect(location).toContain(`${APP_BASE_URL}/?auth=error`);
    expect(location).toContain("code=TOKEN_INVALID_OR_EXPIRED");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("POST session authenticate valid cookie returns 200 with principal and session", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin4@example.com",
      role: "Admin",
      sessionToken: "admin-session-token-authenticate",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/authenticate`,
      cookie: buildSessionCookie("admin-session-token-authenticate"),
      body: {
        tenantId: TENANT_A,
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      ok: true;
      principal: { tenantId: string; userId: string };
      session: { tenantId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.principal.tenantId).toBe(TENANT_A);
    expect(payload.principal.userId).toBe(ADMIN_USER_ID);
    expect(payload.session.tenantId).toBe(TENANT_A);
  });

  it("POST session authenticate with missing/invalid cookie returns 401", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/authenticate`,
      cookie: buildSessionCookie("non-existent-session-token"),
      body: {
        tenantId: TENANT_A,
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
  });

  it("GET session current with valid cookie returns 200 with principal", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin-current@example.com",
      role: "Admin",
      sessionToken: "admin-session-token-current",
    });

    const request = new Request(`${APP_BASE_URL}/v1/auth/session/current`, {
      method: "GET",
      headers: {
        Cookie: buildSessionCookie("admin-session-token-current"),
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      ok: true;
      principal: { tenantId: string; userId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.principal.tenantId).toBe(TENANT_A);
    expect(payload.principal.userId).toBe(ADMIN_USER_ID);
  });

  it("GET session current missing cookie returns 401", async () => {
    const request = new Request(`${APP_BASE_URL}/v1/auth/session/current`, {
      method: "GET",
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("GET session current invalid cookie returns 401", async () => {
    const request = new Request(`${APP_BASE_URL}/v1/auth/session/current`, {
      method: "GET",
      headers: {
        Cookie: buildSessionCookie("session-current-invalid"),
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
  });

  it("method mismatch on /v1/auth/session/current returns 405 with Allow GET", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/current`,
      body: {},
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("tenant mismatch between session context and invite body returns 403", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin5@example.com",
      role: "Admin",
      sessionToken: "admin-session-token-mismatch",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/magic-link/invites`,
      cookie: buildSessionCookie("admin-session-token-mismatch"),
      body: {
        tenantId: TENANT_B,
        inviteeEmail: "invitee@example.com",
        inviteeRole: "Editor",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("TENANT_MISMATCH");
  });

  it("POST logout without session cookie returns 200 and clears auth cookies", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/logout`,
      body: {},
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      ok: true;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const setCookies = getSetCookieValues(response);
    expect(
      setCookies.some((value) => value.startsWith("dink_session_v1=")),
    ).toBe(true);
    expect(
      setCookies.some((value) => value.startsWith("dink_tenant_v1=")),
    ).toBe(true);
    expect(setCookies.every((value) => value.includes("Max-Age=0"))).toBe(true);
  });

  it("POST logout with valid cookie revokes session, clears cookies, and authenticate fails after", async () => {
    const sessionToken = "logout-valid-session-token";

    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin-logout@example.com",
      role: "Admin",
      sessionToken,
    });

    const logoutRequest = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/logout`,
      cookie: buildSessionCookie(sessionToken, TENANT_A),
      body: {},
    });

    const logoutResponse = await worker.fetch(logoutRequest, buildWorkerEnv());
    const logoutPayload = (await logoutResponse.json()) as {
      ok: true;
    };

    expect(logoutResponse.status).toBe(200);
    expect(logoutPayload.ok).toBe(true);

    const setCookies = getSetCookieValues(logoutResponse);
    expect(
      setCookies.some((value) => value.startsWith("dink_session_v1=")),
    ).toBe(true);
    expect(
      setCookies.some((value) => value.startsWith("dink_tenant_v1=")),
    ).toBe(true);

    const authenticateRequest = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/authenticate`,
      cookie: buildSessionCookie(sessionToken, TENANT_A),
      body: {
        tenantId: TENANT_A,
      },
    });

    const authenticateResponse = await worker.fetch(
      authenticateRequest,
      buildWorkerEnv(),
    );
    const authenticatePayload = (await authenticateResponse.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(authenticateResponse.status).toBe(401);
    expect(authenticatePayload.ok).toBe(false);
    expect(authenticatePayload.error.code).toBe("SESSION_INVALID_OR_EXPIRED");
  });

  it("POST logout with invalid or expired cookie returns 200 no-op and clears cookies", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/logout`,
      cookie: buildSessionCookie("invalid-or-expired-token", TENANT_A),
      body: {},
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      ok: true;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const setCookies = getSetCookieValues(response);
    expect(
      setCookies.some((value) => value.startsWith("dink_session_v1=")),
    ).toBe(true);
    expect(
      setCookies.some((value) => value.startsWith("dink_tenant_v1=")),
    ).toBe(true);
  });

  it("POST logout with foreign Origin returns 403 ORIGIN_FORBIDDEN", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/logout`,
      origin: "https://evil.example",
      body: {},
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("ORIGIN_FORBIDDEN");
  });

  it("POST logout persistence failure returns 500 and does not clear cookies", async () => {
    const sessionToken = "logout-failure-session-token";
    const duplicateAuditId = "70000000-0000-4000-8000-000000009999";

    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "admin-logout-failure@example.com",
      role: "Admin",
      sessionToken,
    });

    await env.DB.prepare(
      `
        INSERT INTO audit_events (
          id,
          tenant_id,
          workspace_id,
          actor_type,
          actor_user_id,
          event_type,
          target_type,
          target_id,
          timestamp,
          context_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `,
    )
      .bind(
        duplicateAuditId,
        TENANT_A,
        TENANT_A,
        "user",
        ADMIN_USER_ID,
        "auth.seed",
        "session",
        "70000000-0000-4000-8000-000000009998",
        new Date().toISOString(),
        JSON.stringify({ seed: true }),
      )
      .run();

    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(duplicateAuditId);

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/auth/session/logout`,
      cookie: buildSessionCookie(sessionToken, TENANT_A),
      body: {},
    });

    let response: Response;
    try {
      response = await worker.fetch(request, buildWorkerEnv());
    } finally {
      randomUuidSpy.mockRestore();
    }

    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("PERSISTENCE_ERROR");
    expect(getSetCookieValues(response).length).toBe(0);
  });

  it("non-auth routes still return scaffold 501 response", async () => {
    const request = new Request(`${APP_BASE_URL}/`, { method: "GET" });
    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      marker: string;
    };

    expect(response.status).toBe(501);
    expect(payload.marker).toBe("dink_scaffold_ready");
  });
});
