import { describe, expect, it } from "vitest";

import type { AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
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
import { executeMappingReviewModelV1 } from "../../../src/server/ai/modules/mapping-review/executor.v1";
import { loadMappingReviewModuleConfigV1 } from "../../../src/server/ai/modules/mapping-review/loader.v1";
import { generateMappingReviewSuggestionsV1 } from "../../../src/server/workflow/mapping-review.v1";
import {
  MappingDecisionSetPayloadV1Schema,
  type MappingDecisionSetPayloadV1,
} from "../../../src/shared/contracts/mapping.v1";
import { parseReconciliationResultPayloadV1 } from "../../../src/shared/contracts/reconciliation.v1";
import { parseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";
import type { AuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";

const TENANT_ID = "92000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "92000000-0000-4000-8000-000000000002";

function createMappingPayloadV1(): MappingDecisionSetPayloadV1 {
  return MappingDecisionSetPayloadV1Schema.parse({
    schemaVersion: "mapping_decisions_v1",
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 1,
      deterministicDecisions: 1,
      manualReviewRequired: 0,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 1,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "Trial Balance:2:6073",
        accountNumber: "6073",
        sourceAccountNumber: "6073",
        accountName: "Representation partially deductible",
        proposedCategory: {
          code: "607100",
          name: "Entertainment - internal and external - presumed deductible",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "607100",
          name: "Entertainment - internal and external - presumed deductible",
          statementType: "income_statement",
        },
        confidence: 0.76,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:2",
          },
        ],
        policyRuleReference: "map.is.entertainment.deductible.v1",
        reviewFlag: false,
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
}

function createReconciliationPayloadV1(input: { canProceedToMapping: boolean }) {
  return parseReconciliationResultPayloadV1({
    schemaVersion: "reconciliation_result_v1",
    status: input.canProceedToMapping ? "pass" : "fail",
    canProceedToMapping: input.canProceedToMapping,
    blockingReasonCodes: input.canProceedToMapping
      ? []
      : ["candidate_rows_present"],
    summary: {
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: 1000,
    },
    checks: [
      {
        code: "candidate_rows_present",
        status: input.canProceedToMapping ? "pass" : "fail",
        blocking: !input.canProceedToMapping,
        message: "ok",
        context: {},
      },
    ],
  });
}

class InMemoryArtifactRepositoryV1 implements TbPipelineArtifactRepositoryV1 {
  constructor(
    private readonly mapping: TbPipelineArtifactVersionRecordV1<"mapping"> | null,
    private readonly reconciliation: TbPipelineArtifactVersionRecordV1<"reconciliation"> | null,
  ) {}

  async appendMappingAndSetActive(
    input: Parameters<TbPipelineArtifactRepositoryV1["appendMappingAndSetActive"]>[0],
  ): Promise<TbPipelineArtifactWriteResultV1<"mapping">> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async appendReconciliationAndSetActive(
    input: Parameters<TbPipelineArtifactRepositoryV1["appendReconciliationAndSetActive"]>[0],
  ): Promise<TbPipelineArtifactWriteResultV1<"reconciliation">> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async appendTrialBalanceAndSetActive(
    input: Parameters<TbPipelineArtifactRepositoryV1["appendTrialBalanceAndSetActive"]>[0],
  ): Promise<TbPipelineArtifactWriteResultV1<"trial_balance">> {
    void input;
    throw new Error("Not implemented for this test.");
  }

  async getActiveMapping(
    input: Parameters<TbPipelineArtifactRepositoryV1["getActiveMapping"]>[0],
  ) {
    void input;
    return this.mapping;
  }

  async getActiveReconciliation(
    input: Parameters<TbPipelineArtifactRepositoryV1["getActiveReconciliation"]>[0],
  ) {
    void input;
    return this.reconciliation;
  }

  async getActiveTrialBalance(
    input: Parameters<TbPipelineArtifactRepositoryV1["getActiveTrialBalance"]>[0],
  ) {
    void input;
    return null;
  }

  async listMappingVersions(
    input: Parameters<TbPipelineArtifactRepositoryV1["listMappingVersions"]>[0],
  ) {
    void input;
    return this.mapping ? [this.mapping] : [];
  }

  async listReconciliationVersions(
    input: Parameters<TbPipelineArtifactRepositoryV1["listReconciliationVersions"]>[0],
  ) {
    void input;
    return this.reconciliation ? [this.reconciliation] : [];
  }

  async listTrialBalanceVersions(
    input: Parameters<TbPipelineArtifactRepositoryV1["listTrialBalanceVersions"]>[0],
  ) {
    void input;
    return [];
  }
}

class InMemoryWorkspaceRepositoryV1 implements WorkspaceRepositoryV1 {
  private readonly workspace = parseWorkspaceV1({
    id: WORKSPACE_ID,
    tenantId: TENANT_ID,
    companyId: "92000000-0000-4000-8000-000000000003",
    fiscalYearStart: "2025-01-01",
    fiscalYearEnd: "2025-12-31",
    status: "draft",
    createdAt: "2026-03-02T15:00:00.000Z",
    updatedAt: "2026-03-02T15:00:00.000Z",
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
    input: Parameters<WorkspaceRepositoryV1["updateStatusCompareAndSetWithAudit"]>[0],
  ): Promise<WorkspaceRepositoryUpdateWithAuditResultV1> {
    void input;
    throw new Error("Not implemented for this test.");
  }
}

class InMemoryAuditRepositoryV1 implements AuditRepositoryV1 {
  public readonly events: AuditEventV2[] = [];

  async append(event: AuditEventV2) {
    this.events.push(event);
    return {
      ok: true as const,
      event,
    };
  }
}

function createDeps(input: {
  canProceedToMapping: boolean;
  runModel?: typeof executeMappingReviewModelV1;
  loadModuleConfig?: typeof loadMappingReviewModuleConfigV1;
}) {
  const artifactRepository = new InMemoryArtifactRepositoryV1(
    {
      id: "mapping-artifact-v1",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      artifactType: "mapping",
      version: 1,
      schemaVersion: "mapping_decisions_v1",
      payload: createMappingPayloadV1(),
      createdAt: "2026-03-02T15:05:00.000Z",
      createdByUserId: "92000000-0000-4000-8000-000000000004",
    },
    {
      id: "reconciliation-artifact-v1",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      artifactType: "reconciliation",
      version: 1,
      schemaVersion: "reconciliation_result_v1",
      payload: createReconciliationPayloadV1({
        canProceedToMapping: input.canProceedToMapping,
      }),
      createdAt: "2026-03-02T15:04:00.000Z",
      createdByUserId: "92000000-0000-4000-8000-000000000004",
    },
  );
  const auditRepository = new InMemoryAuditRepositoryV1();

  return {
    auditRepository,
    artifactRepository,
    workspaceRepository: new InMemoryWorkspaceRepositoryV1(),
    loadModuleConfig: input.loadModuleConfig ?? loadMappingReviewModuleConfigV1,
    runModel: input.runModel ?? executeMappingReviewModelV1,
    generateId: () => "92000000-0000-4000-8000-000000000099",
    nowIsoUtc: () => "2026-03-02T15:10:00.000Z",
  };
}

describe("mapping review workflow v1", () => {
  it("returns structured suggestions for policy-supported misclassification", async () => {
    const deps = createDeps({
      canProceedToMapping: true,
    });
    const result = await generateMappingReviewSuggestionsV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        scope: "return",
        maxSuggestions: 10,
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.suggestions.suggestions).toHaveLength(1);
    expect(result.suggestions.suggestions[0]?.selectedCategoryCode).toBe(
      "607200",
    );
    expect(result.suggestions.suggestions[0]?.policyRuleReference).toBe(
      "guideline.is.partially-deductible-representation.prudent.v1",
    );
    expect(deps.auditRepository.events).toHaveLength(1);
    expect(deps.auditRepository.events[0]?.eventType).toBe(
      "mapping.review_suggestions_generated",
    );
  });

  it("returns RECONCILIATION_BLOCKED when gate is closed", async () => {
    const result = await generateMappingReviewSuggestionsV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      createDeps({
        canProceedToMapping: false,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RECONCILIATION_BLOCKED");
    }
  });

  it("returns AI_OUTPUT_INVALID when model suggests incompatible statement type", async () => {
    const result = await generateMappingReviewSuggestionsV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      createDeps({
        canProceedToMapping: true,
        runModel: async () => ({
          ok: true,
          suggestions: [
            {
              decisionId: "Trial Balance:2:6073",
              selectedCategoryCode: "100000",
              scope: "return",
              reason: "invalid statement type",
              policyRuleReference: "test.rule",
              confidence: 0.8,
              reviewFlag: false,
            },
          ],
        }),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AI_OUTPUT_INVALID");
    }
  });
});
