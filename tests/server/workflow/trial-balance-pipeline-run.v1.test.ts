import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

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
} from "../../../src/db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import { MAX_TRIAL_BALANCE_FILE_BYTES_V1 } from "../../../src/server/security/payload-limits.v1";
import {
  clearTrialBalancePipelineDataV1,
  executeTrialBalancePipelineRunV1,
  type TrialBalancePipelineRunDepsV1,
} from "../../../src/server/workflow/trial-balance-pipeline-run.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../../src/shared/audit/audit-event-catalog.v1";
import type { AuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";
import {
  getSilverfinTaxCategoryByCodeV1,
  parseGenerateMappingDecisionsResultV1,
} from "../../../src/shared/contracts/mapping.v1";
import { TRIAL_BALANCE_IMPORT_DETERMINISTIC_FALLBACK_REASON_V1 } from "../../../src/shared/contracts/tb-pipeline-run.v1";
import { ACCOUNT_MAPPER_REFERENCE_TRIAL_BALANCE_BASE64 } from "../../fixtures/account-mapper-reference-trial-balance.fixture";

type PersistedByTypeV1 = {
  mapping: TbPipelineArtifactVersionRecordV1<"mapping">[];
  reconciliation: TbPipelineArtifactVersionRecordV1<"reconciliation">[];
  trial_balance: TbPipelineArtifactVersionRecordV1<"trial_balance">[];
};

class InMemoryTbPipelineArtifactRepositoryV1
  implements TbPipelineArtifactRepositoryV1
{
  private readonly persisted: PersistedByTypeV1 = {
    trial_balance: [],
    reconciliation: [],
    mapping: [],
  };

  private readonly active = {
    trial_balance:
      null as TbPipelineArtifactVersionRecordV1<"trial_balance"> | null,
    reconciliation:
      null as TbPipelineArtifactVersionRecordV1<"reconciliation"> | null,
    mapping: null as TbPipelineArtifactVersionRecordV1<"mapping"> | null,
  };

  constructor(
    private readonly workspaces: Set<string>,
    private readonly tenantId: string,
  ) {}

  private getWorkspaceKey(workspaceId: string): string {
    return `${this.tenantId}:${workspaceId}`;
  }

  private nextVersion<TType extends keyof PersistedByTypeV1>(
    artifactType: TType,
  ): number {
    return this.persisted[artifactType].length + 1;
  }

  async appendTrialBalanceAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    tenantId: string;
    trialBalance: TbPipelineArtifactVersionRecordV1<"trial_balance">["payload"];
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("trial_balance");
    const artifact: TbPipelineArtifactVersionRecordV1<"trial_balance"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "trial_balance",
      version,
      schemaVersion: input.trialBalance.schemaVersion,
      payload: input.trialBalance,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.trial_balance.push(artifact);
    this.active.trial_balance = artifact;
    return { ok: true as const, artifact };
  }

  async appendReconciliationAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    reconciliation: TbPipelineArtifactVersionRecordV1<"reconciliation">["payload"];
    tenantId: string;
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("reconciliation");
    const artifact: TbPipelineArtifactVersionRecordV1<"reconciliation"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "reconciliation",
      version,
      schemaVersion: input.reconciliation.schemaVersion,
      payload: input.reconciliation,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.reconciliation.push(artifact);
    this.active.reconciliation = artifact;
    return { ok: true as const, artifact };
  }

  async appendMappingAndSetActive(input: {
    artifactId: string;
    createdAt: string;
    createdByUserId?: string;
    mapping: TbPipelineArtifactVersionRecordV1<"mapping">["payload"];
    tenantId: string;
    workspaceId: string;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const version = this.nextVersion("mapping");
    const artifact: TbPipelineArtifactVersionRecordV1<"mapping"> = {
      id: input.artifactId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactType: "mapping",
      version,
      schemaVersion: input.mapping.schemaVersion,
      payload: input.mapping,
      createdAt: input.createdAt,
      createdByUserId: input.createdByUserId,
    };

    this.persisted.mapping.push(artifact);
    this.active.mapping = artifact;
    return { ok: true as const, artifact };
  }

  async getActiveTrialBalance(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return this.active.trial_balance;
  }

  async getActiveReconciliation(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return this.active.reconciliation;
  }

  async getActiveMapping(input: { tenantId: string; workspaceId: string }) {
    void input;
    return this.active.mapping;
  }

  async clearActiveArtifacts(input: {
    tenantId: string;
    workspaceId: string;
    artifactTypes: Array<"trial_balance" | "reconciliation" | "mapping">;
  }) {
    if (!this.workspaces.has(this.getWorkspaceKey(input.workspaceId))) {
      return {
        ok: false as const,
        code: "WORKSPACE_NOT_FOUND" as const,
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    const clearedArtifactTypes: Array<
      "trial_balance" | "reconciliation" | "mapping"
    > = [];
    for (const artifactType of [...new Set(input.artifactTypes)]) {
      if (this.active[artifactType]) {
        this.active[artifactType] = null;
        clearedArtifactTypes.push(artifactType);
      }
    }

    return {
      ok: true as const,
      clearedArtifactTypes,
    };
  }

  async listTrialBalanceVersions(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return [...this.persisted.trial_balance].sort(
      (left, right) => right.version - left.version,
    );
  }

  async listReconciliationVersions(input: {
    tenantId: string;
    workspaceId: string;
  }) {
    void input;
    return [...this.persisted.reconciliation].sort(
      (left, right) => right.version - left.version,
    );
  }

  async listMappingVersions(input: { tenantId: string; workspaceId: string }) {
    void input;
    return [...this.persisted.mapping].sort(
      (left, right) => right.version - left.version,
    );
  }
}

type InMemoryPreferenceRecordV1 = MappingPreferenceUpsertEntryV1;

class InMemoryMappingPreferenceRepositoryV1
  implements MappingPreferenceRepositoryV1
{
  private readonly preferences: InMemoryPreferenceRecordV1[] = [];

  async upsertBatch(
    input: Parameters<MappingPreferenceRepositoryV1["upsertBatch"]>[0],
  ): Promise<MappingPreferenceUpsertBatchResultV1> {
    for (const entry of input.entries) {
      const existingIndex = this.preferences.findIndex((existing) => {
        if (
          existing.scope !== entry.scope ||
          existing.sourceAccountNumber !== entry.sourceAccountNumber ||
          existing.statementType !== entry.statementType
        ) {
          return false;
        }

        if (entry.scope === "return") {
          return (
            existing.scope === "return" &&
            existing.workspaceId === entry.workspaceId
          );
        }

        return existing.scope === "user" && existing.userId === entry.userId;
      });

      if (existingIndex >= 0) {
        this.preferences[existingIndex] = entry;
      } else {
        this.preferences.push(entry);
      }
    }

    return {
      ok: true,
      savedCount: input.entries.length,
    };
  }

  async findApplicableForRows(
    input: Parameters<
      MappingPreferenceRepositoryV1["findApplicableForRows"]
    >[0],
  ): Promise<MappingPreferenceFindApplicableResultV1> {
    const requestedKeys = new Set(
      input.rows.map(
        (row) => `${row.sourceAccountNumber.trim()}|${row.statementType}`,
      ),
    );

    const matched = this.preferences.filter((preference) => {
      const key = `${preference.sourceAccountNumber.trim()}|${preference.statementType}`;
      if (!requestedKeys.has(key)) {
        return false;
      }

      if (preference.scope === "return") {
        return preference.workspaceId === input.workspaceId;
      }

      return input.userId ? preference.userId === input.userId : false;
    });

    const selectedByKey = new Map<string, InMemoryPreferenceRecordV1>();
    for (const preference of matched) {
      const key = `${preference.sourceAccountNumber.trim()}|${preference.statementType}`;
      const existing = selectedByKey.get(key);
      if (!existing) {
        selectedByKey.set(key, preference);
        continue;
      }

      if (preference.scope === "return" && existing.scope === "user") {
        selectedByKey.set(key, preference);
      }
    }

    return {
      ok: true,
      preferences: [...selectedByKey.values()].map((preference, index) => ({
        id: `pref-${index + 1}`,
        tenantId: input.tenantId,
        scope: preference.scope,
        workspaceId:
          preference.scope === "return" ? preference.workspaceId : undefined,
        userId: preference.scope === "user" ? preference.userId : undefined,
        sourceAccountNumber: preference.sourceAccountNumber,
        statementType: preference.statementType,
        selectedCategoryCode: preference.selectedCategoryCode,
        reason: preference.reason,
        createdAt: "2026-03-02T12:00:00.000Z",
        updatedAt: "2026-03-02T12:00:00.000Z",
        createdByUserId: input.userId ?? "system",
        updatedByUserId: input.userId ?? "system",
      })),
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

function createWorkspaceArtifactRepositoryStubV1(input?: {
  activeArtifactTypes?: Array<
    "tax_adjustments" | "tax_summary" | "ink2_form" | "export_package"
  >;
}) {
  type MappingDependentArtifactTypeV1 =
    | "tax_adjustments"
    | "tax_summary"
    | "ink2_form"
    | "export_package";
  const activeArtifactTypes = new Set(input?.activeArtifactTypes ?? []);

  const repository: WorkspaceArtifactRepositoryV1 & {
    clearedArtifactTypes: Array<
      "tax_adjustments" | "tax_summary" | "ink2_form" | "export_package"
    >;
  } = {
    clearedArtifactTypes: [],
    appendAnnualReportExtractionAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    appendAnnualReportTaxAnalysisAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    appendTaxAdjustmentsAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    appendTaxSummaryAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    appendInk2FormAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    appendExportPackageAndSetActive: async () => {
      throw new Error("Not implemented for this test.");
    },
    getActiveAnnualReportExtraction: async () => null,
    getActiveAnnualReportTaxAnalysis: async () => null,
    getActiveTaxAdjustments: async () => null,
    getActiveTaxSummary: async () => null,
    getActiveInk2Form: async () => null,
    getActiveExportPackage: async () => null,
    listExportPackages: async () => [],
    clearActiveArtifacts: async ({ artifactTypes }) => {
      const clearedArtifactTypes = artifactTypes.filter(
        (artifactType): artifactType is MappingDependentArtifactTypeV1 => {
          if (
            artifactType !== "tax_adjustments" &&
            artifactType !== "tax_summary" &&
            artifactType !== "ink2_form" &&
            artifactType !== "export_package"
          ) {
            return false;
          }

          if (!activeArtifactTypes.has(artifactType)) {
            return false;
          }

          activeArtifactTypes.delete(artifactType);
          return true;
        },
      );
      repository.clearedArtifactTypes = clearedArtifactTypes;
      return {
        ok: true as const,
        clearedArtifactTypes,
      };
    },
  };

  return repository;
}

function createWorkbookBase64V1(input: { rows: unknown[][] }): string {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(input.rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");
  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

describe("trial-balance pipeline run workflow v1", () => {
  const tenantId = "85000000-0000-4000-8000-000000000001";
  const workspaceId = "85000000-0000-4000-8000-000000000002";
  const userId = "85000000-0000-4000-8000-000000000003";

  function createDeps(input: {
    artifactRepository: TbPipelineArtifactRepositoryV1;
    mappingPreferenceRepository: MappingPreferenceRepositoryV1;
    auditRepository: AuditRepositoryV1;
    workspaceArtifactRepository?: WorkspaceArtifactRepositoryV1;
  }): TrialBalancePipelineRunDepsV1 {
    let idCounter = 0;
    let secondCounter = 0;

    const generateMappingDecisions: TrialBalancePipelineRunDepsV1["generateMappingDecisions"] =
      async (mappingInput) => {
        if (!mappingInput.reconciliation.canProceedToMapping) {
          return parseGenerateMappingDecisionsResultV1({
            ok: false,
            error: {
              code: "RECONCILIATION_BLOCKED",
              message: "Reconciliation did not pass.",
              user_message:
                "Reconciliation is blocked. Resolve issues before mapping.",
              context: {},
            },
          });
        }

        const decisions = mappingInput.trialBalance.rows.map((row) => {
          const rowKey = `${row.source.sheetName}:${row.source.rowNumber}`;
          const selectedCategoryCode =
            row.sourceAccountNumber.trim() === "6072" ? "607200" : "950000";
          const selectedCategory =
            getSilverfinTaxCategoryByCodeV1(selectedCategoryCode);
          const isFallback = selectedCategoryCode === "950000";

          return {
            id: rowKey,
            trialBalanceRowIdentity: {
              rowKey,
              source: row.source,
            },
            accountNumber: row.accountNumber,
            sourceAccountNumber: row.sourceAccountNumber,
            accountName: row.accountName,
            proposedCategory: selectedCategory,
            selectedCategory,
            confidence: isFallback ? 0.25 : 0.92,
            evidence: [
              {
                type: "tb_row" as const,
                reference: rowKey,
                snippet: `${row.sourceAccountNumber} ${row.accountName}`,
                source: row.source,
              },
            ],
            policyRuleReference: isFallback
              ? "mapping.ai.fallback.test_default.v1"
              : "mapping.ai.rule.test_6072.v1",
            reviewFlag: isFallback,
            status: "proposed" as const,
            source: "ai" as const,
          };
        });

        const fallbackCount = decisions.filter((decision) => decision.reviewFlag)
          .length;
        return parseGenerateMappingDecisionsResultV1({
          ok: true,
          mapping: {
            schemaVersion: "mapping_decisions_v2",
            policyVersion: mappingInput.policyVersion,
            aiRun: {
              runId: "test-mapping-run",
              moduleId: "mapping-decisions",
              moduleVersion: "v1",
              promptVersion: "mapping-decisions.prompts.v1",
              policyVersion: mappingInput.policyVersion,
              activePatchVersions: [],
              provider: "qwen",
              model: "qwen-test",
              modelTier: "fast",
              generatedAt: "2026-03-02T12:00:00.000Z",
              usedFallback: fallbackCount > 0,
            },
            executionMetadata: {
              requestedStrategy: "ai_primary",
              actualStrategy: "ai",
              degraded: false,
              annualReportContextAvailable: false,
              usedAiRunFallback: fallbackCount > 0,
            },
            summary: {
              totalRows: decisions.length,
              deterministicDecisions: 0,
              manualReviewRequired: fallbackCount,
              fallbackDecisions: fallbackCount,
              matchedByAccountNumber: decisions.length - fallbackCount,
              matchedByAccountName: 0,
              unmatchedRows: 0,
            },
            decisions,
          },
        });
      };

    return {
      artifactRepository: input.artifactRepository,
      mappingPreferenceRepository: input.mappingPreferenceRepository,
      auditRepository: input.auditRepository,
      workspaceArtifactRepository: input.workspaceArtifactRepository,
      generateMappingDecisions,
      generateId: () => {
        idCounter += 1;
        return `85000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
      },
      nowIsoUtc: () => {
        secondCounter += 1;
        return `2026-03-02T12:00:${String(secondCounter).padStart(2, "0")}.000Z`;
      },
    };
  }

  it("returns INPUT_INVALID for malformed payloads", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );

    const result = await executeTrialBalancePipelineRunV1(
      {
        invalid: true,
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
    }
  });

  it("returns PARSE_FAILED for unsupported file format", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const auditRepository = new InMemoryAuditRepositoryV1();

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.txt",
        fileBytesBase64: "AQID",
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PARSE_FAILED");
    }
    expect(auditRepository.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        AUDIT_EVENT_TYPES_V1.FILE_UPLOADED,
        AUDIT_EVENT_TYPES_V1.PARSE_FAILED,
      ]),
    );
  });

  it("runs parser -> reconciliation -> mapping and persists versioned artifacts", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    const firstRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) {
      return;
    }

    expect(firstRun.pipeline.artifacts.trialBalance.version).toBe(1);
    expect(firstRun.pipeline.artifacts.reconciliation.version).toBe(1);
    expect(firstRun.pipeline.artifacts.mapping.version).toBe(1);
    expect(firstRun.pipeline.mapping.schemaVersion).toBe(
      "mapping_decisions_v2",
    );
    expect(firstRun.pipeline.mapping.executionMetadata).toMatchObject({
      requestedStrategy: "ai_primary",
      actualStrategy: "ai",
      degraded: false,
      annualReportContextAvailable: false,
      usedAiRunFallback: false,
    });
    expect(firstRun.pipeline.mapping.decisions[0]?.selectedCategory.code).toBe(
      "607200",
    );
    expect(
      "trialBalanceRowIdentity" in
        (firstRun.pipeline.mapping.decisions[0] ?? {}),
    ).toBe(true);

    const secondRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) {
      return;
    }

    expect(secondRun.pipeline.artifacts.trialBalance.version).toBe(2);
    expect(secondRun.pipeline.artifacts.reconciliation.version).toBe(2);
    expect(secondRun.pipeline.artifacts.mapping.version).toBe(2);
    expect(auditRepository.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        AUDIT_EVENT_TYPES_V1.PARSE_SUCCEEDED,
        AUDIT_EVENT_TYPES_V1.RECONCILIATION_RESULT_RECORDED,
        AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED,
        AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
      ]),
    );
    const mappingGeneratedEvent = auditRepository.events.find(
      (event) => event.eventType === AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED,
    );
    expect(mappingGeneratedEvent?.after).toMatchObject({
      executionMetadata: {
        requestedStrategy: "ai_primary",
        actualStrategy: "ai",
        degraded: false,
      },
      aiRun: {
        provider: "qwen",
      },
    });
  });

  it("queues a background AI rerun after saving a deterministic import fallback", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const queuedMessages: Array<{
      actorUserId: string;
      request: {
        expectedActiveMapping: {
          artifactId: string;
          version: number;
        };
        tenantId: string;
        workspaceId: string;
      };
      taskType: string;
    }> = [];

    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Software", "1030", "0", "1000"],
      ],
    });

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "mapping-ai.v1",
      },
      {
        ...createDeps({
          artifactRepository: repository,
          mappingPreferenceRepository:
            new InMemoryMappingPreferenceRepositoryV1(),
          auditRepository: new InMemoryAuditRepositoryV1(),
        }),
        generateMappingDecisions: async () =>
          parseGenerateMappingDecisionsResultV1({
            ok: true,
            mapping: {
              schemaVersion: "mapping_decisions_v2",
              policyVersion: "mapping-ai.v1",
              aiRun: {
                runId: "tb-import-fallback-run",
                moduleId: "mapping-decisions",
                moduleVersion: "v1",
                promptVersion: "mapping-decisions.prompts.v1",
                policyVersion: "mapping-ai.v1",
                activePatchVersions: [],
                provider: "qwen",
                model: "qwen-test",
                modelTier: "fast",
                generatedAt: "2026-03-02T12:00:00.000Z",
                usedFallback: true,
              },
              executionMetadata: {
                requestedStrategy: "ai_primary",
                actualStrategy: "deterministic",
                degraded: true,
                degradedReasonCode: "model_execution_failed",
                degradedReason:
                  TRIAL_BALANCE_IMPORT_DETERMINISTIC_FALLBACK_REASON_V1,
                annualReportContextAvailable: false,
                usedAiRunFallback: false,
              },
              summary: {
                totalRows: 1,
                deterministicDecisions: 1,
                manualReviewRequired: 1,
                fallbackDecisions: 1,
                matchedByAccountNumber: 0,
                matchedByAccountName: 0,
                unmatchedRows: 0,
              },
              decisions: [
                {
                  id: "Trial Balance:2",
                  trialBalanceRowIdentity: {
                    rowKey: "Trial Balance:2",
                    source: {
                      sheetName: "Trial Balance",
                      rowNumber: 2,
                    },
                  },
                  accountNumber: "1030",
                  sourceAccountNumber: "1030",
                  accountName: "Software",
                  openingBalance: 0,
                  closingBalance: 1000,
                  proposedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
                  selectedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
                  confidence: 0.25,
                  evidence: [
                    {
                      type: "tb_row",
                      reference: "Trial Balance:2",
                      snippet: "1030 Software",
                      source: {
                        sheetName: "Trial Balance",
                        rowNumber: 2,
                      },
                    },
                  ],
                  policyRuleReference: "mapping.ai.fallback.test.v1",
                  reviewFlag: true,
                  status: "proposed",
                  source: "deterministic",
                },
              ],
            },
          }),
        enqueueMappingAiEnrichment: async (message) => {
          queuedMessages.push(message);
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.mapping.executionMetadata).toMatchObject({
      requestedStrategy: "ai_primary",
      actualStrategy: "deterministic",
      degraded: true,
      degradedReason: TRIAL_BALANCE_IMPORT_DETERMINISTIC_FALLBACK_REASON_V1,
    });
    expect(result.pipeline.artifacts.mapping.version).toBe(1);
    expect(queuedMessages).toHaveLength(1);
    expect(queuedMessages[0]).toMatchObject({
      taskType: "mapping_ai_enrichment",
      actorUserId: userId,
      request: {
        tenantId,
        workspaceId,
        expectedActiveMapping: {
          artifactId: result.pipeline.artifacts.mapping.artifactId,
          version: result.pipeline.artifacts.mapping.version,
        },
      },
    });
  });

  it("accepts closing-balance-only uploads and prepares them for mapping", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        ["Account Number", "Account Name", "Closing Balance"],
        ["1930", "Bank", "1500"],
        ["6550", "Konsultarvoden IT", "500"],
      ],
    });

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "closing-only.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.trialBalance.schemaVersion).toBe(
      "trial_balance_normalized_v2",
    );
    if (
      result.pipeline.trialBalance.schemaVersion !==
      "trial_balance_normalized_v2"
    ) {
      return;
    }

    expect(result.pipeline.trialBalance.availableBalanceColumns).toEqual([
      "closing_balance",
    ]);
    expect(result.pipeline.trialBalance.rows).toHaveLength(2);
    expect(result.pipeline.reconciliation.canProceedToMapping).toBe(true);
    expect(result.pipeline.mapping.summary.totalRows).toBe(2);
  });

  it("imports the account-mapper reference workbook and prepares every row for mapping", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "mock_trial_balance_sek_random.xlsx",
        fileBytesBase64: ACCOUNT_MAPPER_REFERENCE_TRIAL_BALANCE_BASE64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.trialBalance.schemaVersion).toBe(
      "trial_balance_normalized_v2",
    );
    if (
      result.pipeline.trialBalance.schemaVersion !==
      "trial_balance_normalized_v2"
    ) {
      return;
    }

    expect(result.pipeline.trialBalance.availableBalanceColumns).toEqual([
      "closing_balance",
    ]);
    expect(result.pipeline.trialBalance.rows).toHaveLength(201);
    expect(result.pipeline.reconciliation.canProceedToMapping).toBe(true);
    expect(result.pipeline.mapping.summary.totalRows).toBe(201);
    expect(result.pipeline.mapping.decisions).toHaveLength(201);
  });

  it("auto-applies saved preferences on rerun and marks decisions overridden", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    const firstRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );
    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok) {
      return;
    }
    expect(firstRun.pipeline.mapping.decisions[0]?.selectedCategory.code).toBe(
      "607200",
    );
    expect(firstRun.pipeline.mapping.decisions[0]?.status).toBe("proposed");

    await preferenceRepository.upsertBatch({
      tenantId,
      actorUserId: userId,
      nowIsoUtc: "2026-03-02T12:30:00.000Z",
      entries: [
        {
          scope: "user",
          userId,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Reviewer preference",
        },
      ],
    });

    const secondRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );
    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) {
      return;
    }

    const decision = secondRun.pipeline.mapping.decisions[0];
    expect(decision?.selectedCategory.code).toBe("607100");
    expect(decision?.status).toBe("overridden");
    expect(decision?.source).toBe("manual");
    expect(decision?.reviewFlag).toBe(false);
    expect(secondRun.pipeline.artifacts.mapping.version).toBe(2);

    expect(
      auditRepository.events.some(
        (event) => event.eventType === "mapping.preferences_auto_applied",
      ),
    ).toBe(true);
  });

  it("persists AI-backed mapping decisions when an AI mapper is injected", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1();
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "mapping-ai.v1",
      },
      {
        ...createDeps({
          artifactRepository: repository,
          mappingPreferenceRepository: preferenceRepository,
          auditRepository,
        }),
        generateMappingDecisions: async () => ({
          ok: true,
          mapping: {
            schemaVersion: "mapping_decisions_v2",
            policyVersion: "mapping-ai.v1",
            aiRun: {
              runId: "ai-map-1",
              moduleId: "mapping-decisions",
              moduleVersion: "v1",
              promptVersion: "mapping-decisions.prompts.v1",
              policyVersion: "mapping-decisions.v1",
              activePatchVersions: [],
              provider: "qwen",
              model: "qwen-plus",
              modelTier: "fast",
              generatedAt: "2026-03-02T12:00:00.000Z",
              usedFallback: false,
            },
            executionMetadata: {
              requestedStrategy: "ai_primary",
              actualStrategy: "ai",
              degraded: false,
              annualReportContextAvailable: true,
              usedAiRunFallback: false,
            },
            summary: {
              totalRows: 1,
              deterministicDecisions: 0,
              manualReviewRequired: 0,
              fallbackDecisions: 0,
              matchedByAccountNumber: 0,
              matchedByAccountName: 1,
              unmatchedRows: 0,
            },
            decisions: [
              {
                id: "Trial Balance:2",
                trialBalanceRowIdentity: {
                  rowKey: "Trial Balance:2",
                  source: {
                    sheetName: "Trial Balance",
                    rowNumber: 2,
                  },
                },
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
                ],
                policyRuleReference: "mapping.ai.representation.v1",
                reviewFlag: false,
                status: "proposed",
                source: "ai",
              },
            ],
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.mapping.aiRun?.provider).toBe("qwen");
    expect(result.pipeline.mapping.executionMetadata).toMatchObject({
      requestedStrategy: "ai_primary",
      actualStrategy: "ai",
      degraded: false,
      annualReportContextAvailable: true,
    });
    expect(result.pipeline.mapping.decisions[0]?.source).toBe("ai");
  });

  it("returns success when auto-apply audit append fails after artifacts are committed", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const preferenceRepository = new InMemoryMappingPreferenceRepositoryV1();
    const auditRepository = new InMemoryAuditRepositoryV1(true);
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Representation external ej avdragsgill", "6072", "0", "1000"],
      ],
    });

    await preferenceRepository.upsertBatch({
      tenantId,
      actorUserId: userId,
      nowIsoUtc: "2026-03-02T12:30:00.000Z",
      entries: [
        {
          scope: "user",
          userId,
          sourceAccountNumber: "6072",
          statementType: "income_statement",
          selectedCategoryCode: "607100",
          reason: "Reviewer preference",
        },
      ],
    });

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository: preferenceRepository,
        auditRepository,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.pipeline.artifacts.mapping.version).toBe(1);
    expect(result.pipeline.mapping.decisions[0]?.status).toBe("overridden");
  });

  it("clears downstream workspace artifacts when a new trial-balance import replaces mapping", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Programvaror", "1030", "0", "1000"],
      ],
    });

    const firstRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );
    expect(firstRun.ok).toBe(true);

    const workspaceArtifactRepository = createWorkspaceArtifactRepositoryStubV1(
      {
        activeArtifactTypes: ["tax_adjustments", "tax_summary", "ink2_form"],
      },
    );
    const secondRun = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
        workspaceArtifactRepository,
      }),
    );

    expect(secondRun.ok).toBe(true);
    if (!secondRun.ok) {
      return;
    }

    expect(secondRun.pipeline.artifacts.mapping.version).toBe(2);
    expect(workspaceArtifactRepository.clearedArtifactTypes).toEqual([
      "tax_adjustments",
      "tax_summary",
      "ink2_form",
    ]);
  });

  it("clears active trial-balance pipeline data and downstream dependents on request", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );
    const workspaceArtifactRepository = createWorkspaceArtifactRepositoryStubV1(
      {
        activeArtifactTypes: ["tax_adjustments", "tax_summary"],
      },
    );
    const workbookBase64 = createWorkbookBase64V1({
      rows: [
        [
          "Account Name",
          "Account Number",
          "Opening Balance",
          "Closing Balance",
        ],
        ["Programvaror", "1030", "0", "1000"],
      ],
    });

    const runResult = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: workbookBase64,
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );
    expect(runResult.ok).toBe(true);

    const clearResult = await clearTrialBalancePipelineDataV1(
      {
        tenantId,
        workspaceId,
        clearedByUserId: userId,
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
        workspaceArtifactRepository,
      }),
    );

    expect(clearResult.ok).toBe(true);
    if (!clearResult.ok) {
      return;
    }

    expect(clearResult.clearedArtifactTypes).toEqual([
      "trial_balance",
      "reconciliation",
      "mapping",
    ]);
    expect(clearResult.clearedDependentArtifactTypes).toEqual([
      "tax_adjustments",
      "tax_summary",
    ]);
    await expect(
      repository.getActiveMapping({ tenantId, workspaceId }),
    ).resolves.toBeNull();
  });

  it("returns INPUT_INVALID when decoded payload exceeds configured size limit", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: btoa("A".repeat(MAX_TRIAL_BALANCE_FILE_BYTES_V1 + 1)),
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(result.error.context.reason).toBe("payload_too_large");
    }
  });

  it("returns INPUT_INVALID when trial-balance file type mismatches content", async () => {
    const repository = new InMemoryTbPipelineArtifactRepositoryV1(
      new Set([`${tenantId}:${workspaceId}`]),
      tenantId,
    );

    const result = await executeTrialBalancePipelineRunV1(
      {
        tenantId,
        workspaceId,
        createdByUserId: userId,
        fileName: "tb.xlsx",
        fileBytesBase64: btoa("%PDF-1.7"),
        policyVersion: "deterministic-bas.v1",
      },
      createDeps({
        artifactRepository: repository,
        mappingPreferenceRepository:
          new InMemoryMappingPreferenceRepositoryV1(),
        auditRepository: new InMemoryAuditRepositoryV1(),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(result.error.context.reason).toBe("file_type_content_mismatch");
    }
  });
});
