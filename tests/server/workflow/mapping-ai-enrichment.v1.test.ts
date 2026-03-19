import { describe, expect, it } from "vitest";

import type { AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import type { MappingPreferenceRepositoryV1 } from "../../../src/db/repositories/mapping-preference.repository.v1";
import type {
  TbPipelineArtifactRepositoryV1,
  TbPipelineArtifactVersionRecordV1,
} from "../../../src/db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../../src/db/repositories/workspace.repository.v1";
import { runMappingAiEnrichmentV1 } from "../../../src/server/workflow/mapping-ai-enrichment.v1";
import type { AuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";
import {
  getSilverfinTaxCategoryByCodeV1,
  parseGenerateMappingDecisionsRequestV2,
  parseMappingDecisionSetArtifactV1,
} from "../../../src/shared/contracts/mapping.v1";
import { parseReconciliationResultPayloadV1 } from "../../../src/shared/contracts/reconciliation.v1";
import {
  buildTrialBalanceRowKeyV1,
  parseTrialBalanceNormalizedV1,
} from "../../../src/shared/contracts/trial-balance.v1";
import { parseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";

function createWorkspaceV1() {
  return parseWorkspaceV1({
    id: "85000000-0000-4000-8000-000000000002",
    tenantId: "85000000-0000-4000-8000-000000000001",
    companyId: "85000000-0000-4000-8000-000000000004",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
    status: "draft",
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
  });
}

function createTrialBalanceV1() {
  return parseTrialBalanceNormalizedV1({
    schemaVersion: "trial_balance_normalized_v2",
    fileType: "xlsx",
    selectedSheetName: "Sheet1",
    headerRowNumber: 1,
    columnMappings: [
      {
        key: "account_number",
        required: true,
        sourceHeader: "Konto",
        normalizedSourceHeader: "konto",
        sourceColumnIndex: 0,
        sourceColumnLetter: "A",
        matchType: "exact_synonym",
      },
      {
        key: "account_name",
        required: true,
        sourceHeader: "Benamning",
        normalizedSourceHeader: "benamning",
        sourceColumnIndex: 1,
        sourceColumnLetter: "B",
        matchType: "exact_synonym",
      },
      {
        key: "closing_balance",
        required: true,
        sourceHeader: "Utgaende balans",
        normalizedSourceHeader: "utgaende balans",
        sourceColumnIndex: 2,
        sourceColumnLetter: "C",
        matchType: "exact_synonym",
      },
    ],
    availableBalanceColumns: ["closing_balance"],
    rows: [
      {
        accountNumber: "1030",
        sourceAccountNumber: "1030",
        accountName: "Programvaror, anskaffningsvarde",
        openingBalance: null,
        closingBalance: 100000,
        source: { sheetName: "Sheet1", rowNumber: 2 },
        rawValues: {
          account_number: "1030",
          account_name: "Programvaror, anskaffningsvarde",
          closing_balance: "100000",
        },
      },
      {
        accountNumber: "1270",
        sourceAccountNumber: "1270",
        accountName: "Forbattringsutgifter pa annans fastighet",
        openingBalance: null,
        closingBalance: 75000,
        source: { sheetName: "Sheet1", rowNumber: 3 },
        rawValues: {
          account_number: "1270",
          account_name: "Forbattringsutgifter pa annans fastighet",
          closing_balance: "75000",
        },
      },
    ],
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "Sheet1",
        headerRowNumber: 1,
        requiredColumnsMatched: 3,
        candidateDataRows: 2,
        score: 4000,
      },
    ],
    verification: {
      totalRowsRead: 3,
      candidateRows: 2,
      normalizedRows: 2,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      availableBalanceColumns: ["closing_balance"],
      openingBalanceTotal: null,
      closingBalanceTotal: 175000,
      checks: [
        {
          code: "required_columns_present",
          status: "pass",
          message: "ok",
          context: {},
        },
      ],
    },
  });
}

function createReconciliationV1() {
  return parseReconciliationResultPayloadV1({
    schemaVersion: "reconciliation_result_v1",
    status: "pass",
    canProceedToMapping: true,
    blockingReasonCodes: [],
    summary: {
      candidateRows: 2,
      normalizedRows: 2,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      availableBalanceColumns: ["closing_balance"],
      openingBalanceTotal: 0,
      closingBalanceTotal: 175000,
    },
    checks: [
      {
        code: "normalized_rows_present",
        status: "pass",
        blocking: false,
        message: "ok",
        context: {},
      },
    ],
  });
}

function createDeterministicMappingV1() {
  return parseMappingDecisionSetArtifactV1({
    schemaVersion: "mapping_decisions_v2",
    policyVersion: "deterministic-bas.v1",
    executionMetadata: {
      requestedStrategy: "ai_primary",
      actualStrategy: "deterministic",
      degraded: true,
      degradedReasonCode: "model_execution_failed",
      degradedReason: "Import budget exceeded.",
      annualReportContextAvailable: true,
      usedAiRunFallback: false,
    },
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
        id: "Sheet1:2",
        trialBalanceRowIdentity: {
          rowKey: "Sheet1:2",
          source: { sheetName: "Sheet1", rowNumber: 2 },
        },
        accountNumber: "1030",
        sourceAccountNumber: "1030",
        accountName: "Programvaror, anskaffningsvarde",
        closingBalance: 100000,
        proposedCategory: getSilverfinTaxCategoryByCodeV1("102000"),
        selectedCategory: getSilverfinTaxCategoryByCodeV1("102000"),
        confidence: 0.88,
        evidence: [
          {
            type: "tb_row",
            reference: "Sheet1:2",
            snippet: "1030 Programvaror, anskaffningsvarde",
            source: { sheetName: "Sheet1", rowNumber: 2 },
          },
        ],
        policyRuleReference: "map.bs.tangible-intangible-opening-closing.v1",
        reviewFlag: false,
        status: "proposed",
        source: "deterministic",
      },
      {
        id: "Sheet1:3",
        trialBalanceRowIdentity: {
          rowKey: "Sheet1:3",
          source: { sheetName: "Sheet1", rowNumber: 3 },
        },
        accountNumber: "1270",
        sourceAccountNumber: "1270",
        accountName: "Forbattringsutgifter pa annans fastighet",
        closingBalance: 75000,
        proposedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
        selectedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
        confidence: 0.4,
        evidence: [
          {
            type: "tb_row",
            reference: "Sheet1:3",
            snippet: "1270 Forbattringsutgifter pa annans fastighet",
            source: { sheetName: "Sheet1", rowNumber: 3 },
          },
          {
            type: "fallback_category",
            reference: "map.fallback.100000.v1",
            snippet: "Fallback used",
          },
        ],
        policyRuleReference: "map.fallback.100000.v1",
        reviewFlag: true,
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
}

function createAiSubsetMappingV1() {
  return parseMappingDecisionSetArtifactV1({
    schemaVersion: "mapping_decisions_v2",
    policyVersion: "mapping-decisions.v1",
    executionMetadata: {
      requestedStrategy: "ai_primary",
      actualStrategy: "ai",
      degraded: false,
      annualReportContextAvailable: true,
      usedAiRunFallback: false,
    },
    aiRun: {
      runId: "85000000-0000-4000-8000-000000000099",
      moduleId: "mapping-decisions",
      moduleVersion: "1.0.0",
      promptVersion: "mapping-decisions.prompts.v1",
      policyVersion: "mapping-decisions.v1",
      activePatchVersions: [],
      provider: "qwen",
      model: "qwen-test",
      modelTier: "fast",
      generatedAt: "2026-03-13T10:05:00.000Z",
      usedFallback: false,
    },
    summary: {
      totalRows: 2,
      deterministicDecisions: 0,
      manualReviewRequired: 0,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 1,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "Sheet1:2",
        trialBalanceRowIdentity: {
          rowKey: "Sheet1:2",
          source: { sheetName: "Sheet1", rowNumber: 2 },
        },
        accountNumber: "1030",
        sourceAccountNumber: "1030",
        accountName: "Programvaror, anskaffningsvarde",
        closingBalance: 100000,
        proposedCategory: getSilverfinTaxCategoryByCodeV1("102000"),
        selectedCategory: getSilverfinTaxCategoryByCodeV1("102000"),
        confidence: 0.91,
        evidence: [
          {
            type: "tb_row",
            reference: "Sheet1:2",
            snippet: "1030 Programvaror, anskaffningsvarde",
            source: { sheetName: "Sheet1", rowNumber: 2 },
          },
        ],
        policyRuleReference: "mapping.ai.rule.software.v1",
        reviewFlag: false,
        status: "proposed",
        source: "ai",
        aiTrace: {
          rationale:
            "Software balances should be treated as intangible assets.",
          annualReportContextReferences: [],
        },
      },
      {
        id: "Sheet1:3",
        trialBalanceRowIdentity: {
          rowKey: "Sheet1:3",
          source: { sheetName: "Sheet1", rowNumber: 3 },
        },
        accountNumber: "1270",
        sourceAccountNumber: "1270",
        accountName: "Forbattringsutgifter pa annans fastighet",
        closingBalance: 75000,
        proposedCategory: getSilverfinTaxCategoryByCodeV1("123200"),
        selectedCategory: getSilverfinTaxCategoryByCodeV1("123200"),
        confidence: 0.93,
        evidence: [
          {
            type: "tb_row",
            reference: "Sheet1:3",
            snippet: "1270 Forbattringsutgifter pa annans fastighet",
            source: { sheetName: "Sheet1", rowNumber: 3 },
          },
          {
            type: "annual_report_context",
            reference: "asset_movements:leasehold improvements",
            snippet: "leasehold improvements",
          },
        ],
        policyRuleReference: "mapping.ai.rule.leasehold.v1",
        reviewFlag: false,
        status: "proposed",
        source: "ai",
        aiTrace: {
          rationale: "Annual report context indicates leasehold improvements.",
          annualReportContextReferences: [
            {
              area: "asset_movements",
              reference: "leasehold improvements",
            },
          ],
        },
      },
    ],
  });
}

describe("mapping AI enrichment workflow v1", () => {
  const workspace = createWorkspaceV1();
  const trialBalance = createTrialBalanceV1();
  const reconciliation = createReconciliationV1();
  const actorUserId = "85000000-0000-4000-8000-000000000003";

  function createArtifactRepository(input?: {
    activeMappingId?: string;
    activeMappingVersion?: number;
  }): TbPipelineArtifactRepositoryV1 {
    const trialBalanceRecord = {
      id: "tb-artifact-1",
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      artifactType: "trial_balance" as const,
      version: 1,
      schemaVersion: trialBalance.schemaVersion,
      payload: trialBalance,
      createdAt: "2026-03-13T10:00:00.000Z",
    };
    const reconciliationRecord = {
      id: "recon-artifact-1",
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      artifactType: "reconciliation" as const,
      version: 1,
      schemaVersion: reconciliation.schemaVersion,
      payload: reconciliation,
      createdAt: "2026-03-13T10:00:01.000Z",
    };
    let activeMappingRecord: TbPipelineArtifactVersionRecordV1<"mapping"> = {
      id: input?.activeMappingId ?? "mapping-artifact-1",
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      artifactType: "mapping" as const,
      version: input?.activeMappingVersion ?? 1,
      schemaVersion: "mapping_decisions_v2" as const,
      payload: createDeterministicMappingV1(),
      createdAt: "2026-03-13T10:00:02.000Z",
      createdByUserId: actorUserId,
    };
    const versions: TbPipelineArtifactVersionRecordV1<"mapping">[] = [
      activeMappingRecord,
    ];

    return {
      appendTrialBalanceAndSetActive: async () => {
        throw new Error("not used");
      },
      appendReconciliationAndSetActive: async () => {
        throw new Error("not used");
      },
      appendMappingAndSetActive: async (appendInput) => {
        activeMappingRecord = {
          id: appendInput.artifactId,
          tenantId: appendInput.tenantId,
          workspaceId: appendInput.workspaceId,
          artifactType: "mapping",
          version: activeMappingRecord.version + 1,
          schemaVersion: appendInput.mapping.schemaVersion,
          payload: appendInput.mapping,
          createdAt: appendInput.createdAt,
          createdByUserId: appendInput.createdByUserId,
        };
        versions.push(activeMappingRecord);
        return {
          ok: true as const,
          artifact: activeMappingRecord,
        };
      },
      getActiveTrialBalance: async () => trialBalanceRecord,
      getActiveReconciliation: async () => reconciliationRecord,
      getActiveMapping: async () => activeMappingRecord,
      clearActiveArtifacts: async () => ({
        ok: true as const,
        clearedArtifactTypes: [],
      }),
      listTrialBalanceVersions: async () => [trialBalanceRecord],
      listReconciliationVersions: async () => [reconciliationRecord],
      listMappingVersions: async () => [...versions],
    };
  }

  function createWorkspaceRepository(): WorkspaceRepositoryV1 {
    return {
      create: async () => {
        throw new Error("not used");
      },
      createWithAudit: async () => {
        throw new Error("not used");
      },
      getById: async () => workspace,
      listByTenant: async () => [workspace],
      updateStatusCompareAndSet: async () => {
        throw new Error("not used");
      },
      updateStatusCompareAndSetWithAudit: async () => {
        throw new Error("not used");
      },
    };
  }

  function createAuditRepository(): AuditRepositoryV1 {
    const events: AuditEventV2[] = [];
    return {
      append: async (event) => {
        events.push(event);
        return {
          ok: true as const,
          event,
        };
      },
    };
  }

  function createPreferenceRepository(): MappingPreferenceRepositoryV1 {
    return {
      upsertBatch: async () => ({
        ok: true as const,
        savedCount: 0,
      }),
      findApplicableForRows: async () => ({
        ok: true as const,
        preferences: [],
      }),
    };
  }

  function createWorkspaceArtifactRepository(): WorkspaceArtifactRepositoryV1 {
    return {
      appendAnnualReportExtractionAndSetActive: async () => {
        throw new Error("not used");
      },
      appendAnnualReportTaxAnalysisAndSetActive: async () => {
        throw new Error("not used");
      },
      appendTaxAdjustmentsAndSetActive: async () => {
        throw new Error("not used");
      },
      appendTaxSummaryAndSetActive: async () => {
        throw new Error("not used");
      },
      appendInk2FormAndSetActive: async () => {
        throw new Error("not used");
      },
      appendExportPackageAndSetActive: async () => {
        throw new Error("not used");
      },
      getActiveAnnualReportExtraction: async () => null,
      getActiveAnnualReportTaxAnalysis: async () => null,
      getActiveTaxAdjustments: async () => null,
      getActiveTaxSummary: async () => null,
      getActiveInk2Form: async () => null,
      getActiveExportPackage: async () => null,
      listExportPackages: async () => [],
      clearActiveArtifacts: async () => ({
        ok: true as const,
        clearedArtifactTypes: [],
      }),
    };
  }

  it("reruns AI mapping across the full active trial balance and replaces the mapping", async () => {
    const artifactRepository = createArtifactRepository();
    let requestedRowIds: string[] = [];

    const result = await runMappingAiEnrichmentV1(
      {
        tenantId: workspace.tenantId,
        workspaceId: workspace.id,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-1",
          version: 1,
        },
      },
      {
        actorUserId,
      },
      {
        artifactRepository,
        auditRepository: createAuditRepository(),
        mappingPreferenceRepository: createPreferenceRepository(),
        workspaceArtifactRepository: createWorkspaceArtifactRepository(),
        workspaceRepository: createWorkspaceRepository(),
        buildMappingRequest: async (input) =>
          parseGenerateMappingDecisionsRequestV2({
            schemaVersion: "generate_mapping_decisions_request_v2",
            policyVersion: input.policyVersion,
            trialBalance: input.trialBalance,
            reconciliation: input.reconciliation,
            annualReportInput: {
              status: "unavailable",
              extractionConfirmed: false,
              degraded: false,
              degradedReasons: [],
            },
          }),
        generateAiMapping: async ({ request }) => {
          requestedRowIds = request.trialBalance.rows.map((row) =>
            buildTrialBalanceRowKeyV1(row.source),
          );
          return {
            ok: true as const,
            mapping: createAiSubsetMappingV1(),
          };
        },
        generateId: (() => {
          let counter = 10;
          return () => {
            counter += 1;
            return `85000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
          };
        })(),
        nowIsoUtc: () => "2026-03-13T10:10:00.000Z",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.status).toBe("updated");
    expect(requestedRowIds).toEqual(["Sheet1:2", "Sheet1:3"]);
    expect(result.activeAfter.version).toBe(2);
    expect(result.mapping?.decisions).toHaveLength(2);
    expect(
      result.mapping?.decisions.find((decision) => decision.id === "Sheet1:2")
        ?.source,
    ).toBe("ai");
    expect(
      result.mapping?.decisions.find((decision) => decision.id === "Sheet1:2")
        ?.closingBalance,
    ).toBe(100000);
    expect(
      result.mapping?.decisions.find((decision) => decision.id === "Sheet1:3")
        ?.source,
    ).toBe("ai");
    expect(
      result.mapping?.decisions.find((decision) => decision.id === "Sheet1:3")
        ?.closingBalance,
    ).toBe(75000);
    expect(
      result.mapping?.decisions.find((decision) => decision.id === "Sheet1:3")
        ?.selectedCategory.code,
    ).toBe("123200");
  });

  it("skips the save when the active mapping no longer matches the expected artifact", async () => {
    const result = await runMappingAiEnrichmentV1(
      {
        tenantId: workspace.tenantId,
        workspaceId: workspace.id,
        expectedActiveMapping: {
          artifactId: "mapping-artifact-1",
          version: 1,
        },
      },
      {
        actorUserId,
      },
      {
        artifactRepository: createArtifactRepository({
          activeMappingId: "mapping-artifact-2",
          activeMappingVersion: 2,
        }),
        auditRepository: createAuditRepository(),
        mappingPreferenceRepository: createPreferenceRepository(),
        workspaceArtifactRepository: createWorkspaceArtifactRepository(),
        workspaceRepository: createWorkspaceRepository(),
        buildMappingRequest: async (input) =>
          parseGenerateMappingDecisionsRequestV2({
            schemaVersion: "generate_mapping_decisions_request_v2",
            policyVersion: input.policyVersion,
            trialBalance: input.trialBalance,
            reconciliation: input.reconciliation,
            annualReportInput: {
              status: "unavailable",
              extractionConfirmed: false,
              degraded: false,
              degradedReasons: [],
            },
          }),
        generateAiMapping: async () => ({
          ok: true as const,
          mapping: createAiSubsetMappingV1(),
        }),
        generateId: () => "unused",
        nowIsoUtc: () => "2026-03-13T10:10:00.000Z",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.status).toBe("stale_skipped");
    expect(result.activeAfter.artifactId).toBe("mapping-artifact-2");
    expect(result.mapping).toBeUndefined();
  });
});
