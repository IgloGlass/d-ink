import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "94000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "94000000-0000-4000-8000-000000000002";
const COMPANY_ID = "94000000-0000-4000-8000-000000000003";
const USER_ID = "94000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "mapping-ai-enrichment-session";
const queuedMappingMessages: Array<unknown> = [];

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

function buildWorkerEnvWithQueue(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
    ANNUAL_REPORT_QUEUE: {
      async send(message) {
        queuedMappingMessages.push(message);
      },
    },
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

function createWorkbookBase64V1(): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Account Name", "Account Number", "Opening Balance", "Closing Balance"],
    ["Building", "1270", "0", "1000"],
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

async function seedSessionAndWorkspace(): Promise<void> {
  const nowIso = "2026-03-02T18:00:00.000Z";
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
    .bind(USER_ID, "mapping-ai-enrichment@example.com", nowIso)
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
      "2099-03-03T18:00:00.000Z",
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

describe("worker mapping AI enrichment route v1", () => {
  beforeEach(async () => {
    queuedMappingMessages.length = 0;
    await applyWorkspaceAuditSchemaForTests();
    await seedSessionAndWorkspace();
  });

  it("POST /mapping-decisions/ai-enrichment returns accepted and schedules background work", async () => {
    const runPipelineResponse = await worker.fetch(
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

    const scheduledPromises: Promise<unknown>[] = [];
    const enrichmentResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-decisions/ai-enrichment`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId:
              runPipelinePayload.pipeline.artifacts.mapping.artifactId,
            version: runPipelinePayload.pipeline.artifacts.mapping.version,
          },
        },
      }),
      buildWorkerEnv(),
      {
        waitUntil(promise: Promise<unknown>) {
          scheduledPromises.push(promise);
        },
      },
    );
    const enrichmentPayload = (await enrichmentResponse.json()) as {
      ok: true;
      status: string;
      message: string;
    };

    expect(enrichmentResponse.status).toBe(202);
    expect(enrichmentPayload.ok).toBe(true);
    expect(enrichmentPayload.status).toBe("accepted");
    expect(enrichmentPayload.message).toContain(
      "AI account mapping started in the background",
    );
    expect(scheduledPromises).toHaveLength(1);

    await Promise.allSettled(scheduledPromises);
  });

  it("enqueues mapping enrichment work when the queue binding is available", async () => {
    const runPipelineResponse = await worker.fetch(
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
      buildWorkerEnvWithQueue(),
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

    const enrichmentResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-decisions/ai-enrichment`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId:
              runPipelinePayload.pipeline.artifacts.mapping.artifactId,
            version: runPipelinePayload.pipeline.artifacts.mapping.version,
          },
        },
      }),
      buildWorkerEnvWithQueue(),
    );
    const enrichmentPayload = (await enrichmentResponse.json()) as {
      ok: true;
      status: string;
      message: string;
    };

    expect(enrichmentResponse.status).toBe(202);
    expect(enrichmentPayload.ok).toBe(true);
    expect(enrichmentPayload.status).toBe("accepted");
    expect(queuedMappingMessages).toHaveLength(1);
    expect(queuedMappingMessages[0]).toMatchObject({
      taskType: "mapping_ai_enrichment",
      actorUserId: USER_ID,
      request: {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId:
            runPipelinePayload.pipeline.artifacts.mapping.artifactId,
          version: runPipelinePayload.pipeline.artifacts.mapping.version,
        },
      },
    });
  });
});
