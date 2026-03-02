import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "90000000-0000-4000-8000-000000000001";
const OTHER_TENANT_ID = "90000000-0000-4000-8000-000000000010";
const WORKSPACE_ID = "90000000-0000-4000-8000-000000000002";
const EMPTY_WORKSPACE_ID = "90000000-0000-4000-8000-000000000003";
const COMPANY_ID = "90000000-0000-4000-8000-000000000004";
const USER_ID = "90000000-0000-4000-8000-000000000005";
const SESSION_TOKEN = "mapping-override-session";

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
}

function buildGetRequest(input: { cookie?: string; url: string }): Request {
  const headers = new Headers();
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  return new Request(input.url, {
    method: "GET",
    headers,
  });
}

function buildPostRequest(input: {
  body: unknown;
  cookie?: string;
  url: string;
}): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  return new Request(input.url, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
  });
}

function createWorkbookBase64V1(): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Account Name", "Account Number", "Opening Balance", "Closing Balance"],
    ["Representation external ej avdragsgill", "6072", "0", "1000"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");

  const bytes = new Uint8Array(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }),
  );

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function seedSession(): Promise<void> {
  const nowIso = "2026-03-02T14:00:00.000Z";
  const sessionTokenHash = await hashTokenWithHmacV1(
    AUTH_TOKEN_HMAC_SECRET,
    SESSION_TOKEN,
  );

  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(USER_ID, "mapping-override@example.com", nowIso)
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
    .bind(crypto.randomUUID(), TENANT_ID, USER_ID, "Editor", nowIso, nowIso)
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
      TENANT_ID,
      USER_ID,
      sessionTokenHash,
      nowIso,
      "2026-03-03T14:00:00.000Z",
    )
    .run();
}

async function seedWorkspace(input: {
  workspaceId: string;
  companyId: string;
}): Promise<void> {
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
      input.workspaceId,
      TENANT_ID,
      input.companyId,
      "2025-01-01",
      "2025-12-31",
      "draft",
      "2026-03-02T14:05:00.000Z",
      "2026-03-02T14:05:00.000Z",
    )
    .run();
}

async function runPipeline(workspaceId: string): Promise<{
  mappingArtifactId: string;
  mappingVersion: number;
}> {
  const response = await worker.fetch(
    buildPostRequest({
      url: `${APP_BASE_URL}/v1/workspaces/${workspaceId}/tb-pipeline-runs`,
      cookie: buildSessionCookie(SESSION_TOKEN),
      body: {
        tenantId: TENANT_ID,
        fileName: "tb.xlsx",
        fileBytesBase64: createWorkbookBase64V1(),
        policyVersion: "deterministic-bas.v1",
      },
    }),
    buildWorkerEnv(),
  );

  const payload = (await response.json()) as {
    ok: true;
    pipeline: {
      artifacts: {
        mapping: {
          artifactId: string;
          version: number;
        };
      };
    };
  };

  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);

  return {
    mappingArtifactId: payload.pipeline.artifacts.mapping.artifactId,
    mappingVersion: payload.pipeline.artifacts.mapping.version,
  };
}

describe("worker mapping override routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSession();
    await seedWorkspace({
      workspaceId: WORKSPACE_ID,
      companyId: COMPANY_ID,
    });
    await seedWorkspace({
      workspaceId: EMPTY_WORKSPACE_ID,
      companyId: "90000000-0000-4000-8000-000000000011",
    });
  });

  it("GET /mapping-decisions/active without session returns 401", async () => {
    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-decisions/active?tenantId=${TENANT_ID}`,
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: false;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("GET /mapping-decisions/active returns active mapping after pipeline run", async () => {
    await runPipeline(WORKSPACE_ID);

    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-decisions/active?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: true;
      active: {
        version: number;
      };
      mapping: {
        decisions: Array<{ selectedCategory: { code: string } }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.active.version).toBe(1);
    expect(payload.mapping.decisions[0]?.selectedCategory.code).toBe("607200");
  });

  it("GET /mapping-decisions/active returns 404 when mapping is missing", async () => {
    const response = await worker.fetch(
      buildGetRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${EMPTY_WORKSPACE_ID}/mapping-decisions/active?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: false;
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("MAPPING_NOT_FOUND");
  });

  it("POST /mapping-overrides applies override and returns new active version", async () => {
    const active = await runPipeline(WORKSPACE_ID);

    const response = await worker.fetch(
      buildPostRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-overrides`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId: active.mappingArtifactId,
            version: active.mappingVersion,
          },
          overrides: [
            {
              decisionId: "Trial Balance:2:6072",
              selectedCategoryCode: "607100",
              scope: "user",
              reason: "Mark this account as deductible.",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: true;
      active: { version: number };
      mapping: {
        decisions: Array<{
          selectedCategory: { code: string };
          status: string;
          source: string;
        }>;
      };
      appliedCount: number;
      savedPreferenceCount: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.active.version).toBe(2);
    expect(payload.mapping.decisions[0]?.selectedCategory.code).toBe("607100");
    expect(payload.mapping.decisions[0]?.status).toBe("overridden");
    expect(payload.mapping.decisions[0]?.source).toBe("manual");
    expect(payload.appliedCount).toBe(1);
    expect(payload.savedPreferenceCount).toBe(1);
  });

  it("POST /mapping-overrides returns 409 for stale expected version", async () => {
    const active = await runPipeline(WORKSPACE_ID);

    const response = await worker.fetch(
      buildPostRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-overrides`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId: `${active.mappingArtifactId}-stale`,
            version: active.mappingVersion,
          },
          overrides: [
            {
              decisionId: "Trial Balance:2:6072",
              selectedCategoryCode: "607100",
              scope: "return",
              reason: "Stale version test.",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: false;
      error: { code: string };
    };

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("STATE_CONFLICT");
  });

  it("POST /mapping-overrides returns 403 on tenant mismatch", async () => {
    await runPipeline(WORKSPACE_ID);

    const response = await worker.fetch(
      buildPostRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-overrides`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: OTHER_TENANT_ID,
          expectedActiveMapping: {
            artifactId: "x",
            version: 1,
          },
          overrides: [
            {
              decisionId: "Trial Balance:2:6072",
              selectedCategoryCode: "607100",
              scope: "user",
              reason: "Tenant mismatch test.",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: false;
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TENANT_MISMATCH");
  });
});
