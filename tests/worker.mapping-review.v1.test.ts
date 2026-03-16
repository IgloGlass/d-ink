import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "93000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "93000000-0000-4000-8000-000000000002";
const COMPANY_ID = "93000000-0000-4000-8000-000000000003";
const USER_ID = "93000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "mapping-review-session";

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
    ["Representation partially deductible", "6073", "0", "1000"],
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

async function getActiveMappingDecision(workspaceId: string): Promise<{
  decisionId: string;
  selectedCategoryStatementType: "balance_sheet" | "income_statement";
}> {
  const response = await worker.fetch(
    new Request(
      `${APP_BASE_URL}/v1/workspaces/${workspaceId}/mapping-decisions/active?tenantId=${TENANT_ID}`,
      {
        method: "GET",
        headers: new Headers({
          Cookie: buildSessionCookie(SESSION_TOKEN),
        }),
      },
    ),
    buildWorkerEnv(),
  );
  const payload = (await response.json()) as {
    ok: true;
    mapping: {
      decisions: Array<{
        id: string;
        selectedCategory: {
          statementType: "balance_sheet" | "income_statement";
        };
      }>;
    };
  };

  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  expect(payload.mapping.decisions.length).toBeGreaterThan(0);

  const firstDecision = payload.mapping.decisions[0];
  expect(firstDecision).toBeDefined();

  return {
    decisionId: firstDecision!.id,
    selectedCategoryStatementType: firstDecision!.selectedCategory.statementType,
  };
}

async function seedSessionAndWorkspace(): Promise<void> {
  const nowIso = "2026-03-02T16:00:00.000Z";
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
    .bind(USER_ID, "mapping-review@example.com", nowIso)
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
      "2099-03-03T16:00:00.000Z",
    )
    .run();

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
      nowIso,
      nowIso,
    )
    .run();
}

describe("worker mapping review route v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSessionAndWorkspace();
  });

  it("POST /mapping-review-suggestions returns structured suggestions for active mapping", async () => {
    const runPipelineResponse = await worker.fetch(
      buildPostRequest({
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
    const runPipelinePayload = (await runPipelineResponse.json()) as {
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
    expect(runPipelineResponse.status).toBe(200);
    expect(runPipelinePayload.ok).toBe(true);
    const activeDecision = await getActiveMappingDecision(WORKSPACE_ID);
    const overrideCategoryCode =
      activeDecision.selectedCategoryStatementType === "income_statement"
        ? "607100"
        : "100000";

    const applyOverrideResponse = await worker.fetch(
      buildPostRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-overrides`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId:
              runPipelinePayload.pipeline.artifacts.mapping.artifactId,
            version: runPipelinePayload.pipeline.artifacts.mapping.version,
          },
          overrides: [
            {
              decisionId: activeDecision.decisionId,
              selectedCategoryCode: overrideCategoryCode,
              scope: "return",
              reason: "Intentional test override for mapping review.",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    expect(applyOverrideResponse.status).toBe(200);

    const reviewResponse = await worker.fetch(
      buildPostRequest({
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-review-suggestions`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          scope: "return",
          maxSuggestions: 10,
        },
      }),
      buildWorkerEnv(),
    );
    const reviewPayload = (await reviewResponse.json()) as {
      ok: true;
      suggestions: {
        schemaVersion: string;
        suggestions: Array<{
          decisionId: string;
          selectedCategoryCode: string;
          policyRuleReference: string;
        }>;
      };
    };

    expect(reviewResponse.status).toBe(200);
    expect(reviewPayload.ok).toBe(true);
    expect(reviewPayload.suggestions.schemaVersion).toBe(
      "mapping_review_suggestions_v1",
    );
    expect(reviewPayload.suggestions.suggestions.length).toBeGreaterThan(0);
    expect(reviewPayload.suggestions.suggestions[0]?.decisionId).toBe(
      activeDecision.decisionId,
    );
    expect(
      reviewPayload.suggestions.suggestions[0]?.policyRuleReference.length ?? 0,
    ).toBeGreaterThan(0);
  });
});
