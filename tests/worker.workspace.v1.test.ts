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
const EDITOR_USER_ID = "71000000-0000-4000-8000-000000000004";

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

function buildGetRequest(input: {
  cookie?: string;
  url: string;
}): Request {
  const headers = new Headers();
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  return new Request(input.url, {
    method: "GET",
    headers,
  });
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

async function createWorkspaceByRoute(input: {
  companyId: string;
  fiscalYearEnd?: string;
  fiscalYearStart?: string;
  sessionToken: string;
  tenantId: string;
}): Promise<{
  response: Response;
  workspaceId?: string;
}> {
  const request = buildJsonRequest({
    method: "POST",
    url: `${APP_BASE_URL}/v1/workspaces`,
    cookie: buildSessionCookie(input.sessionToken),
    body: {
      tenantId: input.tenantId,
      companyId: input.companyId,
      fiscalYearStart: input.fiscalYearStart ?? "2025-01-01",
      fiscalYearEnd: input.fiscalYearEnd ?? "2025-12-31",
    },
  });

  const response = await worker.fetch(request, buildWorkerEnv());
  if (response.status !== 201) {
    return { response };
  }

  const payload = (await response.clone().json()) as {
    workspace: { id: string };
  };

  return {
    response,
    workspaceId: payload.workspace.id,
  };
}

describe("worker workspace routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("POST /v1/workspaces without session cookie returns 401", async () => {
    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces`,
      body: {
        tenantId: TENANT_A,
        companyId: "71000000-0000-4000-8000-000000000101",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
      },
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

  it("POST /v1/workspaces with valid Editor session returns 201", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "workspace-editor@example.com",
      role: "Editor",
      sessionToken: "workspace-editor-session",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-editor-session",
      companyId: "71000000-0000-4000-8000-000000000102",
    });
    const payload = (await createResult.response.json()) as {
      auditEvent: { eventType: string };
      ok: true;
      workspace: { status: string };
    };

    expect(createResult.response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.workspace.status).toBe("draft");
    expect(payload.auditEvent.eventType).toBe("workspace.created");
  });

  it("POST /v1/workspaces with valid Admin session returns 201", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session",
      companyId: "71000000-0000-4000-8000-000000000103",
    });

    expect(createResult.response.status).toBe(201);
    expect(createResult.workspaceId).toBeTruthy();
  });

  it("POST /v1/workspaces returns 403 on tenant mismatch", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-mismatch@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-mismatch",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces`,
      cookie: buildSessionCookie("workspace-admin-session-mismatch"),
      body: {
        tenantId: TENANT_B,
        companyId: "71000000-0000-4000-8000-000000000104",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
      },
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TENANT_MISMATCH");
  });

  it("POST /v1/workspaces duplicate company/fiscal-year returns 409", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-duplicate@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-duplicate",
    });

    const companyId = "71000000-0000-4000-8000-000000000105";
    const firstCreate = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session-duplicate",
      companyId,
    });
    expect(firstCreate.response.status).toBe(201);

    const secondCreate = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session-duplicate",
      companyId,
    });
    const payload = (await secondCreate.response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(secondCreate.response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("DUPLICATE_WORKSPACE");
  });

  it("GET /v1/workspaces/:id returns 200 for existing workspace", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-get@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-get",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session-get",
      companyId: "71000000-0000-4000-8000-000000000106",
    });
    expect(createResult.response.status).toBe(201);

    const getResponse = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${createResult.workspaceId}?tenantId=${TENANT_A}`,
        cookie: buildSessionCookie("workspace-admin-session-get"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await getResponse.json()) as {
      ok: true;
      workspace: { id: string; tenantId: string };
    };

    expect(getResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.workspace.id).toBe(createResult.workspaceId);
    expect(payload.workspace.tenantId).toBe(TENANT_A);
  });

  it("GET /v1/workspaces/:id includes actor-specific allowedNextStatuses", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "workspace-editor-get-allowed@example.com",
      role: "Editor",
      sessionToken: "workspace-editor-session-get-allowed",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-editor-session-get-allowed",
      companyId: "71000000-0000-4000-8000-000000000160",
    });
    expect(createResult.response.status).toBe(201);

    const transitionResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${createResult.workspaceId}/transitions`,
        cookie: buildSessionCookie("workspace-editor-session-get-allowed"),
        origin: APP_BASE_URL,
        body: {
          tenantId: TENANT_A,
          toStatus: "in_review",
        },
      }),
      buildWorkerEnv(),
    );
    expect(transitionResponse.status).toBe(200);

    const getResponse = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${createResult.workspaceId}?tenantId=${TENANT_A}`,
        cookie: buildSessionCookie("workspace-editor-session-get-allowed"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await getResponse.json()) as {
      ok: true;
      allowedNextStatuses: string[];
      workspace: { status: string };
    };

    expect(getResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.workspace.status).toBe("in_review");
    expect(payload.allowedNextStatuses).toEqual([
      "changes_requested",
      "ready_for_approval",
    ]);
  });

  it("GET /v1/workspaces/:id returns 404 when workspace is missing", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-get-missing@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-get-missing",
    });

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/71000000-0000-4000-8000-000000000107?tenantId=${TENANT_A}`,
        cookie: buildSessionCookie("workspace-admin-session-get-missing"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("GET /v1/workspaces without session cookie returns 401", async () => {
    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces?tenantId=${TENANT_A}`,
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("GET /v1/workspaces lists tenant workspaces and returns 200", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-list@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-list",
    });

    await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session-list",
      companyId: "71000000-0000-4000-8000-000000000201",
    });
    await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-admin-session-list",
      companyId: "71000000-0000-4000-8000-000000000202",
      fiscalYearStart: "2024-01-01",
      fiscalYearEnd: "2024-12-31",
    });

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces?tenantId=${TENANT_A}`,
        cookie: buildSessionCookie("workspace-admin-session-list"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: true;
      workspaces: Array<{ id: string; tenantId: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.workspaces.length).toBe(2);
    expect(
      payload.workspaces.every((workspace) => workspace.tenantId === TENANT_A),
    ).toBe(true);
  });

  it("GET /v1/workspaces returns 400 for malformed tenantId query", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-list-invalid-query@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-list-invalid-query",
    });

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces?tenantId=not-a-uuid`,
        cookie: buildSessionCookie(
          "workspace-admin-session-list-invalid-query",
        ),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INPUT_INVALID");
  });

  it("GET /v1/workspaces returns 403 on tenant mismatch", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-list-mismatch@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-list-mismatch",
    });

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces?tenantId=${TENANT_B}`,
        cookie: buildSessionCookie("workspace-admin-session-list-mismatch"),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TENANT_MISMATCH");
  });

  it("POST /v1/workspaces/:id/transitions applies draft to in_review and returns 200", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "workspace-editor-transition@example.com",
      role: "Editor",
      sessionToken: "workspace-editor-session-transition",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-editor-session-transition",
      companyId: "71000000-0000-4000-8000-000000000108",
    });
    expect(createResult.response.status).toBe(201);

    const transitionRequest = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces/${createResult.workspaceId}/transitions`,
      cookie: buildSessionCookie("workspace-editor-session-transition"),
      body: {
        tenantId: TENANT_A,
        toStatus: "in_review",
      },
    });

    const response = await worker.fetch(transitionRequest, buildWorkerEnv());
    const payload = (await response.json()) as {
      auditEvent: { eventType: string };
      ok: true;
      workspace: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.workspace.status).toBe("in_review");
    expect(payload.auditEvent.eventType).toBe("workspace.status_changed");
  });

  it("POST /v1/workspaces/:id/transitions maps ROLE_FORBIDDEN rejection to 403", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "workspace-editor-role-forbidden@example.com",
      role: "Editor",
      sessionToken: "workspace-editor-session-role-forbidden",
    });

    const nowIso = new Date().toISOString();
    const filedWorkspaceId = "71000000-0000-4000-8000-000000000109";
    await env.DB.prepare(
      `
        INSERT INTO workspaces (
          id,
          tenant_id,
          company_id,
          fiscal_year_start,
          fiscal_year_end,
          status,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
      .bind(
        filedWorkspaceId,
        TENANT_A,
        "71000000-0000-4000-8000-000000000110",
        "2025-01-01",
        "2025-12-31",
        "filed",
        nowIso,
        nowIso,
      )
      .run();

    const transitionRequest = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces/${filedWorkspaceId}/transitions`,
      cookie: buildSessionCookie("workspace-editor-session-role-forbidden"),
      body: {
        tenantId: TENANT_A,
        toStatus: "draft",
      },
    });

    const response = await worker.fetch(transitionRequest, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: {
        code: string;
        context: {
          transitionError?: { code?: string };
        };
      };
      ok: false;
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TRANSITION_REJECTED");
    expect(payload.error.context.transitionError?.code).toBe("ROLE_FORBIDDEN");
  });

  it("POST /v1/workspaces/:id/transitions maps invalid transition rejection to 409", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: EDITOR_USER_ID,
      emailNormalized: "workspace-editor-invalid-transition@example.com",
      role: "Editor",
      sessionToken: "workspace-editor-session-invalid-transition",
    });

    const createResult = await createWorkspaceByRoute({
      tenantId: TENANT_A,
      sessionToken: "workspace-editor-session-invalid-transition",
      companyId: "71000000-0000-4000-8000-000000000111",
    });
    expect(createResult.response.status).toBe(201);

    const transitionRequest = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces/${createResult.workspaceId}/transitions`,
      cookie: buildSessionCookie("workspace-editor-session-invalid-transition"),
      body: {
        tenantId: TENANT_A,
        toStatus: "exported",
      },
    });

    const response = await worker.fetch(transitionRequest, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: {
        code: string;
        context: {
          transitionError?: { code?: string };
        };
      };
      ok: false;
    };

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TRANSITION_REJECTED");
    expect(payload.error.context.transitionError?.code).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("POST workspace routes reject foreign Origin with 403", async () => {
    await seedSession({
      tenantId: TENANT_A,
      userId: ADMIN_USER_ID,
      emailNormalized: "workspace-admin-origin@example.com",
      role: "Admin",
      sessionToken: "workspace-admin-session-origin",
    });

    const request = buildJsonRequest({
      method: "POST",
      url: `${APP_BASE_URL}/v1/workspaces`,
      cookie: buildSessionCookie("workspace-admin-session-origin"),
      origin: "https://evil.example",
      body: {
        tenantId: TENANT_A,
        companyId: "71000000-0000-4000-8000-000000000112",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
      },
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

  it("method mismatch on /v1/workspaces returns 405 with Allow GET, POST", async () => {
    const request = new Request(`${APP_BASE_URL}/v1/workspaces`, {
      method: "DELETE",
    });

    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("non-workspace routes still return scaffold 501 response", async () => {
    const request = new Request(`${APP_BASE_URL}/`, { method: "GET" });
    const response = await worker.fetch(request, buildWorkerEnv());
    const payload = (await response.json()) as {
      marker: string;
    };

    expect(response.status).toBe(501);
    expect(payload.marker).toBe("dink_scaffold_ready");
  });
});
