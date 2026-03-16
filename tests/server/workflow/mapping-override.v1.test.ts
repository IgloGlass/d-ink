import { describe, expect, it } from "vitest";

import type { AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import type {
  MappingPreferenceFindApplicableResultV1,
  MappingPreferenceRepositoryV1,
  MappingPreferenceUpsertBatchResultV1,
  MappingPreferenceUpsertEntryV1,
} from "../../../src/db/repositories/mapping-preference.repository.v1";
import type {
  TbPipelineArtifactRepositoryV1,
  TbPipelineArtifactVersionRecordV1,
  TbPipelineArtifactWriteResultV1,
} from "../../../src/db/repositories/tb-pipeline-artifact.repository.v1";
import type {
  WorkspaceRepositoryCreateResultV1,
  WorkspaceRepositoryUpdateResultV1,
  WorkspaceRepositoryUpdateWithAuditResultV1,
  WorkspaceRepositoryV1,
} from "../../../src/db/repositories/workspace.repository.v1";
import {
  applyMappingPreferencesToDecisionSetV1,
  applyMappingOverridesV1,
  getActiveMappingDecisionsV1,
} from "../../../src/server/workflow/mapping-override.v1";
import type { AuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";
import { MappingDecisionSetPayloadV1Schema } from "../../../src/shared/contracts/mapping.v1";
import { parseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";

const TENANT_ID = "89000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "89000000-0000-4000-8000-000000000002";
const USER_ID = "89000000-0000-4000-8000-000000000003";

function createBaseMappingPayloadV1() {
  return MappingDecisionSetPayloadV1Schema.parse({
    schemaVersion: "mapping_decisions_v1",
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 2,
      deterministicDecisions: 2,
      manualReviewRequired: 1,
      fallbackDecisions: 1,
      matchedByAccountNumber: 1,
      matchedByAccountName: 0,
      unmatchedRows: 1,
    },
    decisions: [
      {
        id: "decision-6072",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        accountName: "Representation external ej avdragsgill",
        proposedCategory: {
          code: "607200",
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "607200",
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement",
        },
        confidence: 0.92,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:2",
          },
          {
            type: "account_number_prefix",
            reference: "map.is.entertainment.non-deductible.v1",
            matchedValue: "6072",
          },
        ],
        policyRuleReference: "map.is.entertainment.non-deductible.v1",
        reviewFlag: false,
        status: "proposed",
        source: "deterministic",
      },
      {
        id: "decision-3000",
        accountNumber: "3000",
        sourceAccountNumber: "3000",
        accountName: "Sales",
        proposedCategory: {
          code: "950000",
          name: "Non-tax sensitive - Profit and loss statement",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "950000",
          name: "Non-tax sensitive - Profit and loss statement",
          statementType: "income_statement",
        },
        confidence: 0.4,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:3",
          },
          {
            type: "fallback_category",
            reference: "map.fallback.950000.v1",
            matchedValue: "950000",
          },
        ],
        policyRuleReference: "map.fallback.950000.v1",
        reviewFlag: true,
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
}

class InMemoryArtifactRepositoryV1 implements TbPipelineArtifactRepositoryV1 {
  private readonly mappingVersions: TbPipelineArtifactVersionRecordV1<"mapping">[] =
    [];

  constructor(activeMapping: TbPipelineArtifactVersionRecordV1<"mapping">) {
    this.mappingVersions.push(activeMapping);
  }

  async appendMappingAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    mapping: TbPipelineArtifactVersionRecordV1<"mapping">["payload"];
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactWriteResultV1<"mapping">> {
    const latestVersion =
      this.mappingVersions[this.mappingVersions.length - 1]?.version ?? 0;
    const artifact: TbPipelineArtifactVersionRecordV1<"mapping"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "mapping",
      version: latestVersion + 1,
      schemaVersion: input.mapping.schemaVersion,
      payload: input.mapping,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };
    this.mappingVersions.push(artifact);

    return {
      ok: true,
      artifact,
    };
  }

  async appendReconciliationAndSetActive(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["appendReconciliationAndSetActive"]
    >[0],
  ): Promise<TbPipelineArtifactWriteResultV1<"reconciliation">> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async appendTrialBalanceAndSetActive(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["appendTrialBalanceAndSetActive"]
    >[0],
  ): Promise<TbPipelineArtifactWriteResultV1<"trial_balance">> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async getActiveMapping(
    input: Parameters<TbPipelineArtifactRepositoryV1["getActiveMapping"]>[0],
  ): Promise<TbPipelineArtifactVersionRecordV1<"mapping"> | null> {
    void input;
    return this.mappingVersions[this.mappingVersions.length - 1] ?? null;
  }

  async getActiveReconciliation(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["getActiveReconciliation"]
    >[0],
  ): Promise<null> {
    void input;
    return null;
  }

  async getActiveTrialBalance(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["getActiveTrialBalance"]
    >[0],
  ): Promise<null> {
    void input;
    return null;
  }

  async clearActiveArtifacts(
    input: Parameters<TbPipelineArtifactRepositoryV1["clearActiveArtifacts"]>[0],
  ) {
    void input;
    return {
      ok: true as const,
      clearedArtifactTypes: [],
    };
  }

  async listMappingVersions(
    input: Parameters<TbPipelineArtifactRepositoryV1["listMappingVersions"]>[0],
  ) {
    void input;
    return [...this.mappingVersions].sort((a, b) => b.version - a.version);
  }

  async listReconciliationVersions(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["listReconciliationVersions"]
    >[0],
  ): Promise<TbPipelineArtifactVersionRecordV1<"reconciliation">[]> {
    void input;
    return [];
  }

  async listTrialBalanceVersions(
    input: Parameters<
      TbPipelineArtifactRepositoryV1["listTrialBalanceVersions"]
    >[0],
  ): Promise<TbPipelineArtifactVersionRecordV1<"trial_balance">[]> {
    void input;
    return [];
  }
}

class InMemoryPreferenceRepositoryV1 implements MappingPreferenceRepositoryV1 {
  constructor(private readonly failUpsert = false) {}

  public upsertedEntries: Array<{
    scope: "return" | "user";
    sourceAccountNumber: string;
    statementType: "balance_sheet" | "income_statement";
    selectedCategoryCode: string;
  }> = [];

  async findApplicableForRows(
    input: Parameters<
      MappingPreferenceRepositoryV1["findApplicableForRows"]
    >[0],
  ): Promise<MappingPreferenceFindApplicableResultV1> {
    void input;
    return {
      ok: true,
      preferences: [],
    };
  }

  async upsertBatch(
    input: Parameters<MappingPreferenceRepositoryV1["upsertBatch"]>[0],
  ): Promise<MappingPreferenceUpsertBatchResultV1> {
    if (this.failUpsert) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Simulated preference persistence failure.",
      };
    }

    this.upsertedEntries.push(
      ...input.entries.map((entry) => ({
        scope: entry.scope,
        sourceAccountNumber: entry.sourceAccountNumber,
        statementType: entry.statementType,
        selectedCategoryCode: entry.selectedCategoryCode,
      })),
    );

    return {
      ok: true,
      savedCount: input.entries.length,
    };
  }
}

class InMemoryAuditRepositoryV1 implements AuditRepositoryV1 {
  constructor(private readonly failAppend = false) {}

  public readonly events: AuditEventV2[] = [];

  async append(event: AuditEventV2) {
    if (this.failAppend) {
      return {
        ok: false as const,
        code: "PERSISTENCE_ERROR" as const,
        message: "Simulated audit persistence failure.",
      };
    }

    this.events.push(event);
    return {
      ok: true as const,
      event,
    };
  }
}

class InMemoryWorkspaceRepositoryV1 implements WorkspaceRepositoryV1 {
  private readonly workspace = parseWorkspaceV1({
    id: WORKSPACE_ID,
    tenantId: TENANT_ID,
    companyId: "89000000-0000-4000-8000-000000000010",
    fiscalYearStart: "2025-01-01",
    fiscalYearEnd: "2025-12-31",
    status: "draft",
    createdAt: "2026-03-02T12:00:00.000Z",
    updatedAt: "2026-03-02T12:00:00.000Z",
  });

  async create(
    workspace: Parameters<WorkspaceRepositoryV1["create"]>[0],
  ): Promise<WorkspaceRepositoryCreateResultV1> {
    void workspace;
    throw new Error("Not implemented for this test.");
  }

  async createWithAudit(
    input: Parameters<WorkspaceRepositoryV1["createWithAudit"]>[0],
  ): Promise<WorkspaceRepositoryCreateResultV1> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async getById(input: { tenantId: string; workspaceId: string }) {
    if (
      input.tenantId === this.workspace.tenantId &&
      input.workspaceId === this.workspace.id
    ) {
      return this.workspace;
    }

    return null;
  }

  async listByTenant(
    input: Parameters<WorkspaceRepositoryV1["listByTenant"]>[0],
  ) {
    void input;
    return [this.workspace];
  }

  async updateStatusCompareAndSet(
    input: Parameters<WorkspaceRepositoryV1["updateStatusCompareAndSet"]>[0],
  ): Promise<WorkspaceRepositoryUpdateResultV1> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async updateStatusCompareAndSetWithAudit(
    input: Parameters<
      WorkspaceRepositoryV1["updateStatusCompareAndSetWithAudit"]
    >[0],
  ): Promise<WorkspaceRepositoryUpdateWithAuditResultV1> {
    void input;
    throw new Error("Not implemented for this test.");
  }
}

function createDeps(input?: {
  activeArtifactId?: string;
  activeVersion?: number;
  failPreferenceUpsert?: boolean;
  failAuditAppend?: boolean;
}) {
  const artifactRepository = new InMemoryArtifactRepositoryV1({
    id: input?.activeArtifactId ?? "mapping-artifact-v1",
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    artifactType: "mapping",
    version: input?.activeVersion ?? 1,
    schemaVersion: "mapping_decisions_v1",
    payload: createBaseMappingPayloadV1(),
    createdAt: "2026-03-02T12:05:00.000Z",
    createdByUserId: USER_ID,
  });
  const preferenceRepository = new InMemoryPreferenceRepositoryV1(
    input?.failPreferenceUpsert ?? false,
  );
  const auditRepository = new InMemoryAuditRepositoryV1(
    input?.failAuditAppend ?? false,
  );

  let idCounter = 0;
  return {
    deps: {
      artifactRepository,
      mappingPreferenceRepository: preferenceRepository,
      auditRepository,
      workspaceRepository: new InMemoryWorkspaceRepositoryV1(),
      generateId: () => {
        idCounter += 1;
        return `89000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
      },
      nowIsoUtc: () => "2026-03-02T12:15:00.000Z",
    },
    artifactRepository,
    preferenceRepository,
    auditRepository,
  };
}

describe("mapping override workflow v1", () => {
  it("recomputes fallback summary counts from AI fallback policy references", () => {
    const mapping = MappingDecisionSetPayloadV1Schema.parse({
      schemaVersion: "mapping_decisions_v1",
      policyVersion: "mapping-ai.v1",
      summary: {
        totalRows: 1,
        deterministicDecisions: 0,
        manualReviewRequired: 0,
        fallbackDecisions: 0,
        matchedByAccountNumber: 0,
        matchedByAccountName: 0,
        unmatchedRows: 0,
      },
      decisions: [
        {
          id: "decision-ai-fallback",
          accountNumber: "3010",
          sourceAccountNumber: "3010",
          accountName: "Consulting revenue",
          proposedCategory: {
            code: "950000",
            name: "Non-tax sensitive - Profit and loss statement",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "950000",
            name: "Non-tax sensitive - Profit and loss statement",
            statementType: "income_statement",
          },
          confidence: 0.25,
          evidence: [
            {
              type: "tb_row",
              reference: "TB:2",
            },
          ],
          policyRuleReference: "mapping.ai.fallback.chunk_retry_exhausted.v1",
          reviewFlag: true,
          status: "proposed",
          source: "ai",
        },
      ],
    });

    const { mapping: recomputed } = applyMappingPreferencesToDecisionSetV1({
      mapping,
      preferences: [],
    });

    expect(recomputed.summary.fallbackDecisions).toBe(1);
    expect(recomputed.summary.manualReviewRequired).toBe(1);
    expect(recomputed.summary.unmatchedRows).toBe(1);
  });

  it("applies batch overrides, writes new mapping artifact version, and saves preferences", async () => {
    const { deps, artifactRepository, preferenceRepository, auditRepository } =
      createDeps();

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "decision-6072",
            selectedCategoryCode: "607100",
            scope: "return",
            reason: "Treat this as deductible entertainment.",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.active.version).toBe(2);
    const overriddenDecision = result.mapping.decisions.find(
      (decision) => decision.id === "decision-6072",
    );
    expect(overriddenDecision?.selectedCategory.code).toBe("607100");
    expect(overriddenDecision?.status).toBe("overridden");
    expect(overriddenDecision?.source).toBe("manual");
    expect(overriddenDecision?.reviewFlag).toBe(false);
    expect(overriddenDecision?.override?.scope).toBe("return");

    expect(result.mapping.summary.deterministicDecisions).toBe(1);
    expect(result.mapping.summary.manualReviewRequired).toBe(1);
    expect(result.appliedCount).toBe(1);
    expect(result.savedPreferenceCount).toBe(1);

    const mappingVersions = await artifactRepository.listMappingVersions({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(mappingVersions).toHaveLength(2);
    expect(preferenceRepository.upsertedEntries).toHaveLength(1);
    expect(auditRepository.events.map((event) => event.eventType)).toEqual([
      "mapping.overrides_applied",
      "mapping.preference_saved",
    ]);
  });

  it("returns STATE_CONFLICT when expected active version is stale", async () => {
    const { deps } = createDeps({
      activeArtifactId: "mapping-artifact-v2",
      activeVersion: 2,
    });

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "decision-6072",
            selectedCategoryCode: "607100",
            scope: "user",
            reason: "Stale compare-and-set test.",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STATE_CONFLICT");
    }
  });

  it("returns INPUT_INVALID when override references unknown decision", async () => {
    const { deps } = createDeps();

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "missing-decision-id",
            selectedCategoryCode: "607100",
            scope: "user",
            reason: "Unknown decision test.",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(result.error.context.unknownDecisionIds).toEqual([
        "missing-decision-id",
      ]);
    }
  });

  it("returns INPUT_INVALID when override category statement type is incompatible", async () => {
    const { deps } = createDeps();

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "decision-6072",
            selectedCategoryCode: "100000",
            scope: "return",
            reason: "Invalid cross-statement override",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(Array.isArray(result.error.context.statementTypeMismatches)).toBe(
        true,
      );
    }
  });

  it("returns success when preference persistence fails after mapping artifact commit", async () => {
    const { deps, artifactRepository, preferenceRepository } = createDeps({
      failPreferenceUpsert: true,
    });

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "decision-6072",
            selectedCategoryCode: "607100",
            scope: "return",
            reason: "Treat this as deductible entertainment.",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.active.version).toBe(2);
    expect(result.savedPreferenceCount).toBe(0);
    expect(preferenceRepository.upsertedEntries).toHaveLength(0);
    const mappingVersions = await artifactRepository.listMappingVersions({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(mappingVersions).toHaveLength(2);
  });

  it("returns success when override/preference audit append fails after commit", async () => {
    const { deps } = createDeps({
      failAuditAppend: true,
    });

    const result = await applyMappingOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-v1",
          version: 1,
        },
        overrides: [
          {
            decisionId: "decision-6072",
            selectedCategoryCode: "607100",
            scope: "return",
            reason: "Treat this as deductible entertainment.",
          },
        ],
      },
      {
        actorUserId: USER_ID,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.active.version).toBe(2);
  });

  it("returns active mapping from workflow read API", async () => {
    const { deps } = createDeps();

    const result = await getActiveMappingDecisionsV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.active.version).toBe(1);
    expect(result.mapping.decisions).toHaveLength(2);
  });
});
