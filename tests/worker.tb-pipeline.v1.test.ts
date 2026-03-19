import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";
import { ACCOUNT_MAPPER_REFERENCE_TRIAL_BALANCE_BASE64 } from "./fixtures/account-mapper-reference-trial-balance.fixture";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "86000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "86000000-0000-4000-8000-000000000002";
const COMPANY_ID = "86000000-0000-4000-8000-000000000003";
const USER_ID = "86000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "tb-pipeline-session";

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
  url: string;
}): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  return new Request(input.url, {
    method: input.method,
    headers,
    body: JSON.stringify(input.body),
  });
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
}

async function seedSession(): Promise<void> {
  const nowIso = "2026-03-02T13:00:00.000Z";
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
    .bind(USER_ID, "tb-pipeline-user@example.com", nowIso)
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
      "2027-03-03T13:00:00.000Z",
    )
    .run();
}

async function seedWorkspace(): Promise<void> {
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
      WORKSPACE_ID,
      TENANT_ID,
      COMPANY_ID,
      "2025-01-01",
      "2025-12-31",
      "draft",
      "2026-03-02T13:05:00.000Z",
      "2026-03-02T13:05:00.000Z",
    )
    .run();
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

function createBalanceSheetWorkbookBase64V1(): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Account Name", "Account Number", "Opening Balance", "Closing Balance"],
    ["Software platform", "1012", "1000", "1500"],
    ["Consulting revenue", "3010", "0", "400"],
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

describe("worker TB pipeline route v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSession();
    await seedWorkspace();
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs without session returns 401", async () => {
    const response = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
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
      error: { code: string };
      ok: false;
    };

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("SESSION_MISSING");
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs executes full pipeline and persists artifacts", async () => {
    const response = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
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
          mapping: { version: number };
          reconciliation: { version: number };
          trialBalance: { version: number };
        };
        mapping: {
          decisions: Array<{
            reviewFlag: boolean;
            selectedCategory: { code: string };
            source: string;
          }>;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.pipeline.artifacts.trialBalance.version).toBe(1);
    expect(payload.pipeline.artifacts.reconciliation.version).toBe(1);
    expect(payload.pipeline.artifacts.mapping.version).toBe(1);
    expect(payload.pipeline.mapping.decisions[0]?.selectedCategory.code).toBe(
      "950000",
    );
    expect(payload.pipeline.mapping.decisions[0]?.source).toBe("ai");
    expect(payload.pipeline.mapping.decisions[0]?.reviewFlag).toBe(true);

    const versionsCount = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count
        FROM tb_pipeline_artifact_versions
        WHERE tenant_id = ?1 AND workspace_id = ?2
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .first<{ count: number }>();
    const activeCount = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count
        FROM tb_pipeline_active_artifacts
        WHERE tenant_id = ?1 AND workspace_id = ?2
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .first<{ count: number }>();

    expect(versionsCount?.count).toBe(3);
    expect(activeCount?.count).toBe(3);
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs returns a parseable degraded success for large workbooks", async () => {
    const response = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "mock_trial_balance_sek_random.xlsx",
          fileBytesBase64: ACCOUNT_MAPPER_REFERENCE_TRIAL_BALANCE_BASE64,
          policyVersion: "mapping-ai.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: true;
      pipeline: {
        mapping: {
          decisions: Array<{
            selectedCategory: { code: string };
            source: string;
          }>;
          executionMetadata: {
            actualStrategy: "deterministic";
            degraded: true;
            degradedReason: string;
            requestedStrategy: "ai_primary";
          };
          summary: { totalRows: number };
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.pipeline.mapping.summary.totalRows).toBe(201);
    expect(payload.pipeline.mapping.decisions).toHaveLength(201);
    expect(payload.pipeline.mapping.executionMetadata).toMatchObject({
      requestedStrategy: "ai_primary",
      actualStrategy: "deterministic",
      degraded: true,
    });
    expect(payload.pipeline.mapping.executionMetadata.degradedReason).toContain(
      "synchronous import budget",
    );
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs keeps balance-sheet rows in balance-sheet fallback categories", async () => {
    const response = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "tb-balance-sheet.xlsx",
          fileBytesBase64: createBalanceSheetWorkbookBase64V1(),
          policyVersion: "mapping-ai.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const payload = (await response.json()) as {
      ok: true;
      pipeline: {
        mapping: {
          decisions: Array<{
            sourceAccountNumber: string;
            selectedCategory: { code: string; statementType: string };
          }>;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const balanceSheetDecision = payload.pipeline.mapping.decisions.find(
      (decision) => decision.sourceAccountNumber === "1012",
    );

    expect(balanceSheetDecision?.selectedCategory.code).toBe("100000");
    expect(balanceSheetDecision?.selectedCategory.statementType).toBe(
      "balance_sheet",
    );
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs increments artifact versions across reruns", async () => {
    const requestBody = {
      tenantId: TENANT_ID,
      fileName: "tb.xlsx",
      fileBytesBase64: createWorkbookBase64V1(),
      policyVersion: "deterministic-bas.v1",
    };

    const firstResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: requestBody,
      }),
      buildWorkerEnv(),
    );
    expect(firstResponse.status).toBe(200);

    const secondResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: requestBody,
      }),
      buildWorkerEnv(),
    );
    const secondPayload = (await secondResponse.json()) as {
      ok: true;
      pipeline: {
        artifacts: {
          mapping: { version: number };
          reconciliation: { version: number };
          trialBalance: { version: number };
        };
      };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.pipeline.artifacts.trialBalance.version).toBe(2);
    expect(secondPayload.pipeline.artifacts.reconciliation.version).toBe(2);
    expect(secondPayload.pipeline.artifacts.mapping.version).toBe(2);
  });

  it("POST /v1/workspaces/:id/tb-pipeline-runs with invalid body returns 400", async () => {
    const response = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "tb.xlsx",
          fileBytesBase64: createWorkbookBase64V1(),
        },
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
});
