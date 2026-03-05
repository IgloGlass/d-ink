import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import {
  AUDIT_EVENT_TYPES_V1,
  REQUIRED_AUDIT_EVENT_TYPES_V1,
} from "../src/shared/audit/audit-event-catalog.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "af000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "af000000-0000-4000-8000-000000000002";
const COMPANY_ID = "af000000-0000-4000-8000-000000000003";
const USER_ID = "af000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "tax-core-session";

function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

function buildJsonRequest(input: {
  body?: unknown;
  cookie?: string;
  method: "GET" | "POST";
  url: string;
}): Request {
  const headers = new Headers();
  if (input.method === "POST") {
    headers.set("Content-Type", "application/json");
  }
  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }
  return new Request(input.url, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
}

function buildSessionCookie(token: string): string {
  return `dink_session_v1=${token}`;
}

async function seedSessionAndWorkspace(): Promise<void> {
  const nowIso = "2026-03-03T18:00:00.000Z";
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
    .bind(USER_ID, "tax-core-user@example.com", nowIso)
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
    .bind(crypto.randomUUID(), TENANT_ID, USER_ID, "Admin", nowIso, nowIso)
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
      "2099-03-04T18:00:00.000Z",
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

describe("worker tax core routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSessionAndWorkspace();
  });

  it("runs deterministic tax-core chain and collaboration endpoints", async () => {
    const cookie = buildSessionCookie(SESSION_TOKEN);

    const parseFailedAnnualRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: btoa("   "),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    expect(parseFailedAnnualRun.status).toBe(422);

    const annualRunInitial = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: btoa(`
            Company Name: Acme AB
            Org nr: 556677-8899
            Fiscal year: 2025-01-01 to 2025-12-31
            K2
            Resultat före skatt: 1 000 000
          `),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const annualRunInitialPayload = (await annualRunInitial.json()) as {
      active: { artifactId: string; version: number };
      ok: true;
    };
    expect(annualRunInitial.status).toBe(200);
    expect(annualRunInitialPayload.ok).toBe(true);

    const annualRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: btoa(`
            Company Name: Acme AB
            Org nr: 556677-8899
            Fiscal year: 2025-01-01 to 2025-12-31
            K2
            Resultat före skatt: 1 000 000
          `),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const annualRunPayload = (await annualRun.json()) as {
      active: { artifactId: string; version: number };
      ok: true;
    };
    expect(annualRun.status).toBe(200);
    expect(annualRunPayload.ok).toBe(true);

    const annualOverride = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/overrides`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          expectedActiveExtraction: annualRunPayload.active,
          overrides: [
            {
              fieldKey: "profitBeforeTax",
              value: 1000000,
              reason: "Manual completion for deterministic happy-path test",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    const annualOverridePayload = (await annualOverride.json()) as {
      active: { artifactId: string; version: number };
      ok: true;
    };
    expect(annualOverride.status).toBe(200);
    expect(annualOverridePayload.ok).toBe(true);

    const annualConfirm = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/confirm`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          expectedActiveExtraction: annualOverridePayload.active,
        },
      }),
      buildWorkerEnv(),
    );
    expect(annualConfirm.status).toBe(200);

    const tbRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tb-pipeline-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          fileName: "tb.xlsx",
          fileBytesBase64: createWorkbookBase64V1(),
          policyVersion: "deterministic-bas.v1",
        },
      }),
      buildWorkerEnv(),
    );
    if (tbRun.status !== 200) {
      throw new Error(`TB run failed: ${tbRun.status} ${await tbRun.text()}`);
    }
    const tbRunPayload = (await tbRun.json()) as {
      ok: true;
      pipeline: {
        artifacts: {
          mapping: {
            artifactId: string;
            version: number;
          };
        };
        mapping: {
          decisions: Array<{
            id: string;
            selectedCategory: { code: string };
          }>;
        };
      };
    };
    const firstMappingDecision = tbRunPayload.pipeline.mapping.decisions[0];
    if (!firstMappingDecision) {
      throw new Error("Expected at least one mapping decision.");
    }
    const selectedCategoryCode =
      firstMappingDecision.selectedCategory.code === "607200"
        ? "607100"
        : "607200";

    const mappingOverride = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/mapping-overrides`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          expectedActiveMapping: {
            artifactId: tbRunPayload.pipeline.artifacts.mapping.artifactId,
            version: tbRunPayload.pipeline.artifacts.mapping.version,
          },
          overrides: [
            {
              decisionId: firstMappingDecision.id,
              selectedCategoryCode,
              scope: "user",
              reason: "Audit matrix smoke override",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    expect(mappingOverride.status).toBe(200);

    const adjustmentsRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tax-adjustment-runs`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          policyVersion: "tax-adjustments.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const adjustmentsPayload = (await adjustmentsRun.json()) as {
      active: { artifactId: string; version: number };
      adjustments: { decisions: Array<{ amount: number; id: string }> };
      ok: true;
    };
    expect(adjustmentsRun.status).toBe(200);
    const firstAdjustmentDecision = adjustmentsPayload.adjustments.decisions[0];
    if (!firstAdjustmentDecision) {
      throw new Error("Expected at least one tax adjustment decision.");
    }

    const adjustmentsOverride = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tax-adjustments/overrides`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          expectedActiveAdjustments: {
            artifactId: adjustmentsPayload.active.artifactId,
            version: adjustmentsPayload.active.version,
          },
          overrides: [
            {
              decisionId: firstAdjustmentDecision.id,
              amount: firstAdjustmentDecision.amount,
              reason: "Audit smoke override",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    expect(adjustmentsOverride.status).toBe(200);

    const summaryRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tax-summary-runs`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    expect(summaryRun.status).toBe(200);

    const ink2Run = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/ink2-form-runs`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    expect(ink2Run.status).toBe(200);
    const ink2Payload = (await ink2Run.json()) as {
      active: { artifactId: string; version: number };
      form: { fields: Array<{ amount: number; fieldId: string }> };
      ok: true;
    };
    const firstInk2Field = ink2Payload.form.fields[0];
    if (!firstInk2Field) {
      throw new Error("Expected at least one INK2 form field.");
    }

    const ink2Override = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/ink2-form/overrides`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          expectedActiveForm: {
            artifactId: ink2Payload.active.artifactId,
            version: ink2Payload.active.version,
          },
          overrides: [
            {
              fieldId: firstInk2Field.fieldId,
              amount: firstInk2Field.amount,
              reason: "Audit smoke override",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    expect(ink2Override.status).toBe(200);

    const transitionTo = async (
      toStatus: "approved_for_export" | "in_review" | "ready_for_approval",
    ): Promise<void> => {
      const transitionResponse = await worker.fetch(
        buildJsonRequest({
          method: "POST",
          url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/transitions`,
          cookie,
          body: {
            tenantId: TENANT_ID,
            toStatus,
          },
        }),
        buildWorkerEnv(),
      );
      expect(transitionResponse.status).toBe(200);
    };
    await transitionTo("in_review");
    await transitionTo("ready_for_approval");
    await transitionTo("approved_for_export");

    const exportRun = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/exports/pdf`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    expect(exportRun.status).toBe(200);

    const commentCreate = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/comments`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          body: "Please review final tax summary",
        },
      }),
      buildWorkerEnv(),
    );
    expect(commentCreate.status).toBe(201);

    const taskCreate = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tasks`,
        cookie,
        body: {
          tenantId: TENANT_ID,
          title: "Approve export",
        },
      }),
      buildWorkerEnv(),
    );
    expect(taskCreate.status).toBe(201);
    const taskCreatePayload = (await taskCreate.json()) as {
      ok: true;
      task: { id: string };
    };

    const completeTask = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/tasks/${taskCreatePayload.task.id}/complete`,
        cookie,
        body: { tenantId: TENANT_ID },
      }),
      buildWorkerEnv(),
    );
    expect(completeTask.status).toBe(200);

    const auditRows = await env.DB.prepare(
      `
        SELECT event_type, before_json, after_json
        FROM audit_events
        WHERE tenant_id = ?1 AND workspace_id = ?2
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .all<{
        after_json: string | null;
        before_json: string | null;
        event_type: string;
      }>();
    const eventTypes = (auditRows.results ?? []).map((row) => row.event_type);

    for (const requiredEventType of REQUIRED_AUDIT_EVENT_TYPES_V1) {
      expect(eventTypes).toContain(requiredEventType);
    }
    expect(eventTypes).toContain(AUDIT_EVENT_TYPES_V1.SUMMARY_GENERATED);

    const completedTaskAudit = (auditRows.results ?? []).find(
      (row) => row.event_type === AUDIT_EVENT_TYPES_V1.TASK_COMPLETED,
    );
    expect(completedTaskAudit?.before_json).not.toBeNull();
    expect(completedTaskAudit?.after_json).not.toBeNull();
  });
});
