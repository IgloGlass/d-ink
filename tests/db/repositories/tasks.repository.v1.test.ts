import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1TasksRepositoryV1 } from "../../../src/db/repositories/tasks.repository.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "9c000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9c000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9c000000-0000-4000-8000-000000000003";

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
      "2026-03-03T11:30:00.000Z",
      "2026-03-03T11:30:00.000Z",
    )
    .run();
}

describe("D1 tasks repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates tasks and marks task complete", async () => {
    await seedWorkspace();
    const repository = createD1TasksRepositoryV1(env.DB);

    const created = await repository.create({
      taskId: "9c000000-0000-4000-8000-000000000010",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      title: "Review extraction",
      description: "Check org number",
      createdByUserId: "9c000000-0000-4000-8000-000000000020",
      assignedToUserId: "9c000000-0000-4000-8000-000000000021",
      createdAt: "2026-03-03T11:31:00.000Z",
    });
    expect(created.ok).toBe(true);

    const completed = await repository.complete({
      taskId: "9c000000-0000-4000-8000-000000000010",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      completedByUserId: "9c000000-0000-4000-8000-000000000020",
      completedAt: "2026-03-03T11:32:00.000Z",
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }
    expect(completed.task.status).toBe("completed");
  });

  it("returns STATE_CONFLICT when completing an already completed task", async () => {
    await seedWorkspace();
    const repository = createD1TasksRepositoryV1(env.DB);

    await repository.create({
      taskId: "9c000000-0000-4000-8000-000000000011",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      title: "Review mapping",
      createdByUserId: "9c000000-0000-4000-8000-000000000020",
      createdAt: "2026-03-03T11:33:00.000Z",
    });
    await repository.complete({
      taskId: "9c000000-0000-4000-8000-000000000011",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      completedByUserId: "9c000000-0000-4000-8000-000000000020",
      completedAt: "2026-03-03T11:34:00.000Z",
    });

    const secondComplete = await repository.complete({
      taskId: "9c000000-0000-4000-8000-000000000011",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      completedByUserId: "9c000000-0000-4000-8000-000000000020",
      completedAt: "2026-03-03T11:35:00.000Z",
    });

    expect(secondComplete.ok).toBe(false);
    if (!secondComplete.ok) {
      expect(secondComplete.code).toBe("STATE_CONFLICT");
    }
  });

  it("lists tasks scoped by tenant/workspace", async () => {
    await seedWorkspace();
    const repository = createD1TasksRepositoryV1(env.DB);

    await repository.create({
      taskId: "9c000000-0000-4000-8000-000000000012",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      title: "Open task",
      createdByUserId: "9c000000-0000-4000-8000-000000000020",
      createdAt: "2026-03-03T11:36:00.000Z",
    });

    const listed = await repository.listByWorkspace({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.tasks).toHaveLength(1);
    expect(listed.tasks[0]?.title).toBe("Open task");
  });
});
