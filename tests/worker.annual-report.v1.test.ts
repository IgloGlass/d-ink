import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { hashTokenWithHmacV1 } from "../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../src/shared/types/env";
import worker from "../src/worker";
import { applyWorkspaceAuditSchemaForTests } from "./db/test-schema";

const APP_BASE_URL = "https://app.dink.test";
const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";
const TENANT_ID = "9e000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9e000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9e000000-0000-4000-8000-000000000003";
const USER_ID = "9e000000-0000-4000-8000-000000000004";
const SESSION_TOKEN = "annual-report-session";

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

async function seedSession(): Promise<void> {
  const nowIso = "2026-03-03T13:00:00.000Z";
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
    .bind(USER_ID, "annual-report-user@example.com", nowIso)
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
      "2026-03-04T13:00:00.000Z",
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
      "2026-03-03T13:05:00.000Z",
      "2026-03-03T13:05:00.000Z",
    )
    .run();
}

function annualTextBase64V1(): string {
  return btoa(`
    Company Name: Acme AB
    Org nr: 556677-8899
    Fiscal year: 2025-01-01 to 2025-12-31
    K2
    Resultat före skatt: 1 000 000
  `);
}

describe("worker annual report routes v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedSession();
    await seedWorkspace();
  });

  it("runs extraction and returns active payload", async () => {
    const runResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: annualTextBase64V1(),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const runPayload = (await runResponse.json()) as {
      active: { artifactId: string; version: number };
      ok: true;
    };

    expect(runResponse.status).toBe(200);
    expect(runPayload.ok).toBe(true);
    expect(runPayload.active.version).toBe(1);

    const getResponse = await worker.fetch(
      buildJsonRequest({
        method: "GET",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/active?tenantId=${TENANT_ID}`,
        cookie: buildSessionCookie(SESSION_TOKEN),
      }),
      buildWorkerEnv(),
    );
    const getPayload = (await getResponse.json()) as {
      extraction: { schemaVersion: string };
      ok: true;
    };

    expect(getResponse.status).toBe(200);
    expect(getPayload.ok).toBe(true);
    expect(getPayload.extraction.schemaVersion).toBe(
      "annual_report_extraction_v1",
    );
  });

  it("applies overrides and confirms extraction", async () => {
    const runResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-runs`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          fileName: "annual-report.pdf",
          fileBytesBase64: annualTextBase64V1(),
          policyVersion: "annual-report-manual-first.v1",
        },
      }),
      buildWorkerEnv(),
    );
    const runPayload = (await runResponse.json()) as {
      active: { artifactId: string; version: number };
      ok: true;
    };

    const overrideResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/overrides`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveExtraction: runPayload.active,
          overrides: [
            {
              fieldKey: "profitBeforeTax",
              value: 1200000,
              reason: "Manual correction",
            },
          ],
        },
      }),
      buildWorkerEnv(),
    );
    const overridePayload = (await overrideResponse.json()) as {
      active: { artifactId: string; version: number };
      extraction: { confirmation: { isConfirmed: boolean } };
      ok: true;
    };

    expect(overrideResponse.status).toBe(200);
    expect(overridePayload.ok).toBe(true);
    expect(overridePayload.active.version).toBe(2);
    expect(overridePayload.extraction.confirmation.isConfirmed).toBe(false);

    const confirmResponse = await worker.fetch(
      buildJsonRequest({
        method: "POST",
        url: `${APP_BASE_URL}/v1/workspaces/${WORKSPACE_ID}/annual-report-extractions/confirm`,
        cookie: buildSessionCookie(SESSION_TOKEN),
        body: {
          tenantId: TENANT_ID,
          expectedActiveExtraction: overridePayload.active,
        },
      }),
      buildWorkerEnv(),
    );
    const confirmPayload = (await confirmResponse.json()) as {
      extraction: { confirmation: { isConfirmed: boolean } };
      ok: true;
    };

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.extraction.confirmation.isConfirmed).toBe(true);
  });
});
