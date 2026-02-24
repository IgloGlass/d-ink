import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type WorkspaceRepositoryV1,
  createD1WorkspaceRepositoryV1,
} from "../../../src/db/repositories/workspace.repository.v1";
import {
  type WorkspaceLifecycleDepsV1,
  applyWorkspaceTransitionV1,
  createWorkspaceV1,
  getWorkspaceByIdV1,
  listWorkspacesByTenantV1,
} from "../../../src/server/workflow/workspace-lifecycle.v1";
import { parseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_ID = "20000000-0000-4000-8000-000000000002";

function buildDepsForTest(input: {
  ids: string[];
  timestamps: string[];
  workspaceRepository?: WorkspaceRepositoryV1;
}): WorkspaceLifecycleDepsV1 {
  let idIndex = 0;
  let timestampIndex = 0;

  return {
    workspaceRepository:
      input.workspaceRepository ?? createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => {
      const value = input.ids[idIndex];
      idIndex += 1;

      if (!value) {
        throw new Error("No remaining deterministic IDs for test.");
      }

      return value;
    },
    nowIsoUtc: () => {
      const value = input.timestamps[timestampIndex];
      timestampIndex += 1;

      if (!value) {
        throw new Error("No remaining deterministic timestamps for test.");
      }

      return value;
    },
  };
}

async function countAuditEventsByType(eventType: string): Promise<number> {
  const row = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM audit_events
      WHERE event_type = ?1
      `,
  )
    .bind(eventType)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

describe("workspace lifecycle workflow service", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates workspace and emits workspace.created", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000003",
        "40000000-0000-4000-8000-000000000004",
      ],
      timestamps: ["2026-02-24T10:00:00.000Z", "2026-02-24T10:00:01.000Z"],
    });

    const result = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000005",
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.workspace.status).toBe("draft");
    expect(result.auditEvent.eventType).toBe("workspace.created");
    expect(await countAuditEventsByType("workspace.created")).toBe(1);
  });

  it("gets workspace by tenant and workspace id through lifecycle service", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000103",
        "40000000-0000-4000-8000-000000000104",
      ],
      timestamps: ["2026-02-24T10:03:00.000Z", "2026-02-24T10:03:01.000Z"],
    });

    const createResult = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000105",
        },
      },
      deps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const getResult = await getWorkspaceByIdV1(
      {
        tenantId: TENANT_ID,
        workspaceId: createResult.workspace.id,
      },
      deps,
    );

    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.workspace?.id).toBe(createResult.workspace.id);
      expect(getResult.workspace?.status).toBe("draft");
    }
  });

  it("lists workspaces by tenant through lifecycle service", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000106",
        "40000000-0000-4000-8000-000000000106",
        "30000000-0000-4000-8000-000000000107",
        "40000000-0000-4000-8000-000000000107",
      ],
      timestamps: [
        "2026-02-24T10:04:00.000Z",
        "2026-02-24T10:04:01.000Z",
        "2026-02-24T10:05:00.000Z",
        "2026-02-24T10:05:01.000Z",
      ],
    });

    const firstCreate = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: "20000000-0000-4000-8000-000000000106",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000106",
        },
      },
      deps,
    );
    expect(firstCreate.ok).toBe(true);

    const secondCreate = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: "20000000-0000-4000-8000-000000000107",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000107",
        },
      },
      deps,
    );
    expect(secondCreate.ok).toBe(true);

    const listResult = await listWorkspacesByTenantV1(
      { tenantId: TENANT_ID },
      deps,
    );

    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.workspaces).toHaveLength(2);
      expect(listResult.workspaces[0]?.updatedAt).toBe(
        "2026-02-24T10:05:00.000Z",
      );
      expect(listResult.workspaces[1]?.updatedAt).toBe(
        "2026-02-24T10:04:00.000Z",
      );
    }
  });

  it("returns INPUT_INVALID for malformed list request", async () => {
    const deps = buildDepsForTest({
      ids: [],
      timestamps: [],
    });

    const result = await listWorkspacesByTenantV1(
      { tenantId: "not-a-uuid" },
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
    }
  });

  it("returns PERSISTENCE_ERROR when list repository throws", async () => {
    const workspaceRepository = createD1WorkspaceRepositoryV1(env.DB);
    const throwingRepository: WorkspaceRepositoryV1 = {
      ...workspaceRepository,
      async listByTenant() {
        throw new Error("Simulated list failure.");
      },
    };

    const deps = buildDepsForTest({
      ids: [],
      timestamps: [],
      workspaceRepository: throwingRepository,
    });

    const result = await listWorkspacesByTenantV1(
      { tenantId: TENANT_ID },
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PERSISTENCE_ERROR");
    }
  });

  it("applies valid transition and emits workspace.status_changed", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000013",
        "40000000-0000-4000-8000-000000000014",
        "60000000-0000-4000-8000-000000000016",
      ],
      timestamps: [
        "2026-02-24T10:05:00.000Z",
        "2026-02-24T10:05:01.000Z",
        "2026-02-24T10:10:00.000Z",
        "2026-02-24T10:10:01.000Z",
      ],
    });

    const createResult = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000015",
        },
      },
      deps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: createResult.workspace.id,
        toStatus: "in_review",
        actor: {
          actorType: "user",
          actorRole: "Editor",
          actorUserId: "50000000-0000-4000-8000-000000000015",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(true);
    if (!transitionResult.ok) {
      return;
    }

    expect(transitionResult.workspace.status).toBe("in_review");
    expect(transitionResult.auditEvent.eventType).toBe(
      "workspace.status_changed",
    );
    expect(await countAuditEventsByType("workspace.status_changed")).toBe(1);
  });

  it("returns TRANSITION_REJECTED for invalid matrix transitions", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000023",
        "40000000-0000-4000-8000-000000000024",
      ],
      timestamps: ["2026-02-24T10:20:00.000Z", "2026-02-24T10:20:01.000Z"],
    });

    const createResult = await createWorkspaceV1(
      {
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000025",
        },
      },
      deps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: createResult.workspace.id,
        toStatus: "exported",
        actor: {
          actorType: "user",
          actorRole: "Editor",
          actorUserId: "50000000-0000-4000-8000-000000000025",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.error.code).toBe("TRANSITION_REJECTED");
      expect(transitionResult.error.context.transitionError).toBeDefined();
    }
  });

  it("returns TRANSITION_REJECTED for filed to draft without reason", async () => {
    const workspaceRepository = createD1WorkspaceRepositoryV1(env.DB);
    await workspaceRepository.create(
      parseWorkspaceV1({
        id: "30000000-0000-4000-8000-000000000033",
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        status: "filed",
        createdAt: "2026-02-24T10:30:00.000Z",
        updatedAt: "2026-02-24T10:30:00.000Z",
      }),
    );

    const deps = buildDepsForTest({
      ids: ["40000000-0000-4000-8000-000000000034"],
      timestamps: ["2026-02-24T10:31:00.000Z"],
      workspaceRepository,
    });

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: "30000000-0000-4000-8000-000000000033",
        toStatus: "draft",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000035",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.error.code).toBe("TRANSITION_REJECTED");
    }
  });

  it("allows filed to draft for Admin when reason is present", async () => {
    const workspaceRepository = createD1WorkspaceRepositoryV1(env.DB);
    await workspaceRepository.create(
      parseWorkspaceV1({
        id: "30000000-0000-4000-8000-000000000043",
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        status: "filed",
        createdAt: "2026-02-24T10:40:00.000Z",
        updatedAt: "2026-02-24T10:40:00.000Z",
      }),
    );

    const deps = buildDepsForTest({
      ids: ["40000000-0000-4000-8000-000000000044"],
      timestamps: ["2026-02-24T10:41:00.000Z", "2026-02-24T10:41:01.000Z"],
      workspaceRepository,
    });

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: "30000000-0000-4000-8000-000000000043",
        toStatus: "draft",
        reason: "Correction required after final review.",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: "50000000-0000-4000-8000-000000000045",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(true);
    if (transitionResult.ok) {
      expect(transitionResult.workspace.status).toBe("draft");
    }
  });

  it("returns WORKSPACE_NOT_FOUND when transition target does not exist", async () => {
    const deps = buildDepsForTest({
      ids: ["40000000-0000-4000-8000-000000000054"],
      timestamps: ["2026-02-24T10:50:00.000Z"],
    });

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: "30000000-0000-4000-8000-000000000053",
        toStatus: "in_review",
        actor: {
          actorType: "user",
          actorRole: "Editor",
          actorUserId: "50000000-0000-4000-8000-000000000055",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.error.code).toBe("WORKSPACE_NOT_FOUND");
    }
  });

  it("returns STATE_CONFLICT when repository compare-and-set reports stale state", async () => {
    const realWorkspaceRepository = createD1WorkspaceRepositoryV1(env.DB);
    const createResult = await realWorkspaceRepository.create(
      parseWorkspaceV1({
        id: "30000000-0000-4000-8000-000000000063",
        tenantId: TENANT_ID,
        companyId: COMPANY_ID,
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        status: "draft",
        createdAt: "2026-02-24T11:00:00.000Z",
        updatedAt: "2026-02-24T11:00:00.000Z",
      }),
    );
    expect(createResult.ok).toBe(true);

    const staleWorkspaceRepository: WorkspaceRepositoryV1 = {
      ...realWorkspaceRepository,
      async updateStatusCompareAndSetWithAudit() {
        return {
          ok: false,
          code: "STATE_CONFLICT",
          message: "Simulated compare-and-set conflict for service test.",
        };
      },
    };

    const deps = buildDepsForTest({
      ids: ["40000000-0000-4000-8000-000000000064"],
      timestamps: ["2026-02-24T11:00:01.000Z", "2026-02-24T11:00:02.000Z"],
      workspaceRepository: staleWorkspaceRepository,
    });

    const transitionResult = await applyWorkspaceTransitionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: "30000000-0000-4000-8000-000000000063",
        toStatus: "in_review",
        actor: {
          actorType: "user",
          actorRole: "Editor",
          actorUserId: "50000000-0000-4000-8000-000000000065",
        },
      },
      deps,
    );

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.error.code).toBe("STATE_CONFLICT");
    }
  });

  it("returns INPUT_INVALID and does not throw on malformed input", async () => {
    const deps = buildDepsForTest({
      ids: ["40000000-0000-4000-8000-000000000074"],
      timestamps: ["2026-02-24T11:10:00.000Z"],
    });

    await expect(
      createWorkspaceV1({ tenantId: "invalid" }, deps),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "INPUT_INVALID",
      },
    });
  });
});
