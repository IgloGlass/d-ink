import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1WorkspaceRepositoryV1 } from "../../../src/db/repositories/workspace.repository.v1";
import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../../src/shared/contracts/audit-event.v2";
import {
  type WorkspaceV1,
  parseWorkspaceV1,
} from "../../../src/shared/contracts/workspace.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

function buildWorkspace(overrides?: Partial<WorkspaceV1>): WorkspaceV1 {
  return parseWorkspaceV1({
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    companyId: "ccccccc1-cccc-4ccc-8ccc-ccccccccccc1",
    fiscalYearStart: "2025-01-01",
    fiscalYearEnd: "2025-12-31",
    status: "draft",
    createdAt: "2026-02-24T10:00:00.000Z",
    updatedAt: "2026-02-24T10:00:00.000Z",
    ...overrides,
  });
}

function buildAuditEvent(overrides?: Partial<AuditEventV2>): AuditEventV2 {
  return parseAuditEventV2({
    id: "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1",
    tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    workspaceId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    actorType: "user",
    actorUserId: "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
    eventType: "workspace.created",
    targetType: "workspace",
    targetId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    after: {
      status: "draft",
    },
    timestamp: "2026-02-24T10:00:01.000Z",
    context: {
      actorRole: "Admin",
    },
    ...overrides,
  });
}

describe("D1 workspace repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates a workspace successfully", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();

    const result = await repository.create(workspace);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace).toEqual(workspace);
    }
  });

  it("creates workspace and audit atomically", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();
    const auditEvent = buildAuditEvent();

    const result = await repository.createWithAudit({
      workspace,
      auditEvent,
    });

    expect(result.ok).toBe(true);

    const workspaceCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM workspaces WHERE id = ?1",
    )
      .bind(workspace.id)
      .first<{ count: number }>();
    const auditCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE id = ?1",
    )
      .bind(auditEvent.id)
      .first<{ count: number }>();

    expect(workspaceCount?.count).toBe(1);
    expect(auditCount?.count).toBe(1);
  });

  it("rolls back workspace create when audit insert fails in atomic create", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();
    const duplicateAuditId = "ddddddd9-dddd-4ddd-8ddd-ddddddddddd9";

    await env.DB.prepare(
      `
        INSERT INTO audit_events (
          id,
          tenant_id,
          workspace_id,
          actor_type,
          actor_user_id,
          event_type,
          target_type,
          target_id,
          timestamp,
          context_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `,
    )
      .bind(
        duplicateAuditId,
        workspace.tenantId,
        workspace.id,
        "user",
        "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
        "workspace.created",
        "workspace",
        workspace.id,
        "2026-02-24T09:59:59.000Z",
        JSON.stringify({ seed: true }),
      )
      .run();

    const result = await repository.createWithAudit({
      workspace,
      auditEvent: buildAuditEvent({
        id: duplicateAuditId,
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }

    const persistedWorkspace = await repository.getById({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
    });

    expect(persistedWorkspace).toBeNull();
  });

  it("rejects duplicate tenant/company/fiscal-year workspace creation", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);

    await repository.create(buildWorkspace());
    const duplicateResult = await repository.create(
      buildWorkspace({
        id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      }),
    );

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.code).toBe("DUPLICATE_WORKSPACE");
    }
  });

  it("gets workspace by tenant and workspace id", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();

    await repository.create(workspace);

    const found = await repository.getById({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
    });
    const missingWithWrongTenant = await repository.getById({
      tenantId: "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      workspaceId: workspace.id,
    });

    expect(found).toEqual(workspace);
    expect(missingWithWrongTenant).toBeNull();
  });

  it("lists workspaces by tenant in deterministic updatedAt-desc order", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);

    await repository.create(
      buildWorkspace({
        id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        updatedAt: "2026-02-24T10:01:00.000Z",
      }),
    );
    await repository.create(
      buildWorkspace({
        id: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
        companyId: "ccccccc2-cccc-4ccc-8ccc-ccccccccccc2",
        updatedAt: "2026-02-24T10:03:00.000Z",
      }),
    );
    await repository.create(
      buildWorkspace({
        id: "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
        tenantId: "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        companyId: "ccccccc3-cccc-4ccc-8ccc-ccccccccccc3",
        updatedAt: "2026-02-24T10:04:00.000Z",
      }),
    );

    const listed = await repository.listByTenant({
      tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3");
    expect(listed[1]?.id).toBe("aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
  });

  it("throws when persisted workspace row fails runtime contract parsing", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);

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
        "aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
        "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        "ccccccc4-cccc-4ccc-8ccc-ccccccccccc4",
        "2025-01-01",
        "2025-12-31",
        "draft",
        "invalid-datetime",
        "2026-02-24T10:02:00.000Z",
      )
      .run();

    await expect(
      repository.listByTenant({
        tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      }),
    ).rejects.toThrow();
  });

  it("updates status with compare-and-set when fromStatus matches", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();

    await repository.create(workspace);
    const updateResult = await repository.updateStatusCompareAndSet({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      fromStatus: "draft",
      toStatus: "in_review",
      updatedAt: "2026-02-24T10:05:00.000Z",
    });

    expect(updateResult.ok).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.workspace.status).toBe("in_review");
      expect(updateResult.workspace.updatedAt).toBe("2026-02-24T10:05:00.000Z");
    }
  });

  it("updates status and audit atomically with compare-and-set", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();
    await repository.create(workspace);

    const result = await repository.updateStatusCompareAndSetWithAudit({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      fromStatus: "draft",
      toStatus: "in_review",
      updatedAt: "2026-02-24T10:05:00.000Z",
      auditEvent: buildAuditEvent({
        id: "ddddddd2-dddd-4ddd-8ddd-ddddddddddd2",
        eventType: "workspace.status_changed",
        before: { status: "draft" },
        after: { status: "in_review" },
        timestamp: "2026-02-24T10:05:01.000Z",
      }),
    });

    expect(result.ok).toBe(true);

    const updatedWorkspace = await repository.getById({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
    });
    const auditCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE event_type = ?1",
    )
      .bind("workspace.status_changed")
      .first<{ count: number }>();

    expect(updatedWorkspace?.status).toBe("in_review");
    expect(auditCount?.count).toBe(1);
  });

  it("returns STATE_CONFLICT and does not insert audit when fromStatus is stale", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();
    await repository.create(workspace);

    await repository.updateStatusCompareAndSet({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      fromStatus: "draft",
      toStatus: "in_review",
      updatedAt: "2026-02-24T10:05:00.000Z",
    });

    const staleUpdateResult =
      await repository.updateStatusCompareAndSetWithAudit({
        tenantId: workspace.tenantId,
        workspaceId: workspace.id,
        fromStatus: "draft",
        toStatus: "ready_for_approval",
        updatedAt: "2026-02-24T10:06:00.000Z",
        auditEvent: buildAuditEvent({
          id: "ddddddd3-dddd-4ddd-8ddd-ddddddddddd3",
          eventType: "workspace.status_changed",
          before: { status: "draft" },
          after: { status: "ready_for_approval" },
          timestamp: "2026-02-24T10:06:01.000Z",
        }),
      });

    expect(staleUpdateResult.ok).toBe(false);
    if (!staleUpdateResult.ok) {
      expect(staleUpdateResult.code).toBe("STATE_CONFLICT");
    }

    const auditCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE id = ?1",
    )
      .bind("ddddddd3-dddd-4ddd-8ddd-ddddddddddd3")
      .first<{ count: number }>();

    expect(auditCount?.count).toBe(0);
  });

  it("rolls back status update when audit insert fails in atomic transition", async () => {
    const repository = createD1WorkspaceRepositoryV1(env.DB);
    const workspace = buildWorkspace();
    await repository.create(workspace);

    const duplicateAuditId = "ddddddd4-dddd-4ddd-8ddd-ddddddddddd4";
    await env.DB.prepare(
      `
        INSERT INTO audit_events (
          id,
          tenant_id,
          workspace_id,
          actor_type,
          actor_user_id,
          event_type,
          target_type,
          target_id,
          timestamp,
          context_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `,
    )
      .bind(
        duplicateAuditId,
        workspace.tenantId,
        workspace.id,
        "user",
        "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
        "workspace.status_changed",
        "workspace",
        workspace.id,
        "2026-02-24T10:06:30.000Z",
        JSON.stringify({ seed: true }),
      )
      .run();

    const result = await repository.updateStatusCompareAndSetWithAudit({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      fromStatus: "draft",
      toStatus: "in_review",
      updatedAt: "2026-02-24T10:07:00.000Z",
      auditEvent: buildAuditEvent({
        id: duplicateAuditId,
        eventType: "workspace.status_changed",
        before: { status: "draft" },
        after: { status: "in_review" },
        timestamp: "2026-02-24T10:07:01.000Z",
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }

    const unchangedWorkspace = await repository.getById({
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
    });
    expect(unchangedWorkspace?.status).toBe("draft");
  });
});
