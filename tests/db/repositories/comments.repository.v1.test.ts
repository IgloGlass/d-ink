import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1CommentsRepositoryV1 } from "../../../src/db/repositories/comments.repository.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "9b000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9b000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9b000000-0000-4000-8000-000000000003";

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
      "2026-03-03T11:00:00.000Z",
      "2026-03-03T11:00:00.000Z",
    )
    .run();
}

describe("D1 comments repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates and lists comments in descending createdAt order", async () => {
    await seedWorkspace();
    const repository = createD1CommentsRepositoryV1(env.DB);

    await repository.create({
      commentId: "9b000000-0000-4000-8000-000000000010",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      body: "First comment",
      createdByUserId: "9b000000-0000-4000-8000-000000000020",
      createdAt: "2026-03-03T11:01:00.000Z",
    });
    await repository.create({
      commentId: "9b000000-0000-4000-8000-000000000011",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      body: "Second comment",
      createdByUserId: "9b000000-0000-4000-8000-000000000021",
      createdAt: "2026-03-03T11:02:00.000Z",
    });

    const listed = await repository.listByWorkspace({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.comments).toHaveLength(2);
    expect(listed.comments[0]?.id).toBe("9b000000-0000-4000-8000-000000000011");
  });

  it("returns WORKSPACE_NOT_FOUND on create when workspace is missing", async () => {
    const repository = createD1CommentsRepositoryV1(env.DB);
    const created = await repository.create({
      commentId: "9b000000-0000-4000-8000-000000000012",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      body: "Comment",
      createdByUserId: "9b000000-0000-4000-8000-000000000020",
      createdAt: "2026-03-03T11:01:00.000Z",
    });

    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.code).toBe("WORKSPACE_NOT_FOUND");
    }
  });
});
