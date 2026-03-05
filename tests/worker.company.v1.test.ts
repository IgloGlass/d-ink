import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_A = "71000000-0000-4000-8000-000000000001";
const TENANT_B = "71000000-0000-4000-8000-000000000002";
const ADMIN_USER_ID = "71000000-0000-4000-8000-000000000003";

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
  method: "POST";
  origin?: string;
  url: string;
}): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (input.cookie) headers.set("Cookie", input.cookie);
  if (input.origin) headers.set("Origin", input.origin);
  return new Request(input.url, {
    method: input.method,
    headers,
    body: JSON.stringify(input.body),
  });
}

function buildGetRequest(input: { cookie?: string; url: string }): Request {
  const headers = new Headers();
  if (input.cookie) headers.set("Cookie", input.cookie);
  return new Request(input.url, { method: "GET", headers });
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
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
      INSERT INTO tenant_memberships (id, tenant_id, user_id, role, created_at, updated_at)
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

describe("worker company routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("POST /v1/companies without session cookie returns 401", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/companies`,
      body: {
        tenantId: TENANT_A,
        legalName: "Example AB",
        organizationNumber: "556123-1234",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("POST /v1/companies with valid Admin session returns 201", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "company-admin@example.com",
      role: "Admin",
      sessionToken: "company-admin-session",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/companies`,
      cookie: buildSessionCookie("company-admin-session"),
      body: {
        tenantId: TENANT_A,
        legalName: "Example AB",
        organizationNumber: "556123-1234",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      company: { organizationNumber: string };
      ok: true;
    };

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.company.organizationNumber).toBe("5561231234");
  });

  it("GET /v1/companies lists tenant companies and returns 200", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "company-admin-list@example.com",
      role: "Admin",
      sessionToken: "company-admin-session-list",
    });

    for (const [name, orgNo] of [
      ["One AB", "556234-2345"],
      ["Two AB", "556345-3456"],
    ] as const) {
      await worker.fetch(
        buildJsonRequest({
          method: "POST",
          url: `${APP_BASE_URL}/v1/companies`,
          cookie: buildSessionCookie("company-admin-session-list"),
          body: {
            tenantId: TENANT_A,
            legalName: name,
            organizationNumber: orgNo,
            defaultFiscalYearStart: "2025-01-01",
            defaultFiscalYearEnd: "2025-12-31",
          },
        }),
        buildWorkerEnv(),
      );
    }

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/companies?tenantId=${TENANT_A}`,
        cookie: buildSessionCookie("company-admin-session-list"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      companies: Array<{ tenantId: string }>;
      ok: true;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.companies).toHaveLength(2);
    expect(
      payload.companies.every((company) => company.tenantId === TENANT_A),
    ).toBe(true);
  });

  it("GET /v1/companies returns 403 on tenant mismatch", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "company-admin-mismatch@example.com",
      role: "Admin",
      sessionToken: "company-admin-session-mismatch",
    });

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/companies?tenantId=${TENANT_B}`,
        cookie: buildSessionCookie("company-admin-session-mismatch"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("TENANT_MISMATCH");
  });
});
