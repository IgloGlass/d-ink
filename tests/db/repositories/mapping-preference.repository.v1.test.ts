import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1MappingPreferenceRepositoryV1 } from "../../../src/db/repositories/mapping-preference.repository.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "88000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "88000000-0000-4000-8000-000000000002";
const COMPANY_ID = "88000000-0000-4000-8000-000000000003";
const USER_ID_A = "88000000-0000-4000-8000-000000000004";
const USER_ID_B = "88000000-0000-4000-8000-000000000005";

async function seedUsersAndWorkspace(): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3), (?4, ?5, ?6)
    `,
  )
    .bind(
      USER_ID_A,
      "mapping-pref-a@example.com",
      "2026-03-02T12:00:00.000Z",
      USER_ID_B,
      "mapping-pref-b@example.com",
      "2026-03-02T12:00:00.000Z",
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
      "2026-03-02T12:00:00.000Z",
      "2026-03-02T12:00:00.000Z",
    )
    .run();
}

describe("mapping preference repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedUsersAndWorkspace();
  });

  it("upserts unique return and user preferences (latest write wins)", async () => {
    const repository = createD1MappingPreferenceRepositoryV1(env.DB);

    const firstReturnWrite = await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_A,
      nowIsoUtc: "2026-03-02T12:10:00.000Z",
      entries: [
        {
          scope: "return",
          workspaceId: WORKSPACE_ID,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Initial return preference",
        },
      ],
    });
    expect(firstReturnWrite.ok).toBe(true);

    const secondReturnWrite = await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_A,
      nowIsoUtc: "2026-03-02T12:11:00.000Z",
      entries: [
        {
          scope: "return",
          workspaceId: WORKSPACE_ID,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607200",
          reason: "Updated return preference",
        },
      ],
    });
    expect(secondReturnWrite.ok).toBe(true);

    const firstUserWrite = await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_B,
      nowIsoUtc: "2026-03-02T12:12:00.000Z",
      entries: [
        {
          scope: "user",
          userId: USER_ID_B,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Initial user preference",
        },
      ],
    });
    expect(firstUserWrite.ok).toBe(true);

    const secondUserWrite = await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_B,
      nowIsoUtc: "2026-03-02T12:13:00.000Z",
      entries: [
        {
          scope: "user",
          userId: USER_ID_B,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "699300",
          reason: "Updated user preference",
        },
      ],
    });
    expect(secondUserWrite.ok).toBe(true);

    const returnRow = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count, MAX(selected_category_code) AS selected_category_code
        FROM mapping_preferences_v1
        WHERE tenant_id = ?1
          AND scope = 'return'
          AND workspace_id = ?2
          AND source_account_number = '6072'
          AND statement_type = 'income_statement'
      `,
    )
      .bind(TENANT_ID, WORKSPACE_ID)
      .first<{ count: number; selected_category_code: string }>();
    const userRow = await env.DB.prepare(
      `
        SELECT COUNT(*) AS count, MAX(selected_category_code) AS selected_category_code
        FROM mapping_preferences_v1
        WHERE tenant_id = ?1
          AND scope = 'user'
          AND user_id = ?2
          AND source_account_number = '6072'
          AND statement_type = 'income_statement'
      `,
    )
      .bind(TENANT_ID, USER_ID_B)
      .first<{ count: number; selected_category_code: string }>();

    expect(returnRow?.count).toBe(1);
    expect(returnRow?.selected_category_code).toBe("607200");
    expect(userRow?.count).toBe(1);
    expect(userRow?.selected_category_code).toBe("699300");
  });

  it("finds applicable preferences with exact key matching and return-over-user precedence", async () => {
    const repository = createD1MappingPreferenceRepositoryV1(env.DB);

    await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_B,
      nowIsoUtc: "2026-03-02T12:20:00.000Z",
      entries: [
        {
          scope: "user",
          userId: USER_ID_B,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "User preference for 6072",
        },
        {
          scope: "user",
          userId: USER_ID_B,
          sourceAccountNumber: "6993",
          statementType: "income_statement",
          selectedCategoryCode: "699300",
          reason: "User preference for 6993",
        },
      ],
    });

    await repository.upsertBatch({
      tenantId: TENANT_ID,
      actorUserId: USER_ID_A,
      nowIsoUtc: "2026-03-02T12:21:00.000Z",
      entries: [
        {
          scope: "return",
          workspaceId: WORKSPACE_ID,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607200",
          reason: "Return preference overrides user for 6072",
        },
      ],
    });

    const withUser = await repository.findApplicableForRows({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      userId: USER_ID_B,
      rows: [
        {
          sourceAccountNumber: "6072",
          statementType: "income_statement",
        },
        {
          sourceAccountNumber: "6993",
          statementType: "income_statement",
        },
      ],
    });
    expect(withUser.ok).toBe(true);
    if (!withUser.ok) {
      return;
    }

    const byAccountWithUser = new Map(
      withUser.preferences.map((preference) => [
        preference.sourceAccountNumber,
        preference,
      ]),
    );
    expect(byAccountWithUser.get("6072")?.scope).toBe("return");
    expect(byAccountWithUser.get("6072")?.selectedCategoryCode).toBe("607200");
    expect(byAccountWithUser.get("6993")?.scope).toBe("user");
    expect(byAccountWithUser.get("6993")?.selectedCategoryCode).toBe("699300");

    const returnOnly = await repository.findApplicableForRows({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      rows: [
        {
          sourceAccountNumber: "6072",
          statementType: "income_statement",
        },
        {
          sourceAccountNumber: "6993",
          statementType: "income_statement",
        },
      ],
    });
    expect(returnOnly.ok).toBe(true);
    if (!returnOnly.ok) {
      return;
    }

    expect(returnOnly.preferences).toHaveLength(1);
    expect(returnOnly.preferences[0]?.sourceAccountNumber).toBe("6072");
    expect(returnOnly.preferences[0]?.scope).toBe("return");
  });
});
