import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1AnnualReportProcessingRunRepositoryV1 } from "../../../src/db/repositories/annual-report-processing-run.repository.v1";
import { createD1AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import { createD1WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../../src/db/repositories/workspace.repository.v1";
import { MAX_ANNUAL_REPORT_FILE_BYTES_V1 } from "../../../src/server/security/payload-limits.v1";
import {
  type AnnualReportExtractionDepsV1,
  applyAnnualReportExtractionOverridesV1,
  clearAnnualReportDataV1,
  computeSourceContentSha256V1,
  confirmAnnualReportExtractionV1,
  getActiveAnnualReportExtractionV1,
  getActiveAnnualReportTaxAnalysisV1,
  runAnnualReportExtractionV1,
  runAnnualReportTaxAnalysisV1,
} from "../../../src/server/workflow/annual-report-extraction.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseAnnualReportTaxAnalysisPayloadV1 } from "../../../src/shared/contracts/annual-report-tax-analysis.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "9d000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9d000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9d000000-0000-4000-8000-000000000003";
const USER_ID = "9d000000-0000-4000-8000-000000000004";

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
      "2026-03-03T12:00:00.000Z",
      "2026-03-03T12:00:00.000Z",
    )
    .run();
}

function toBase64(input: string): string {
  return btoa(input);
}

async function buildSourceLineageForTestV1(input: {
  fileBytes: Uint8Array;
  processingRunId?: string;
  sourceStorageKey?: string;
}) {
  return {
    processingRunId: input.processingRunId,
    sourceStorageKey: input.sourceStorageKey,
    sourceContentSha256: await computeSourceContentSha256V1(input.fileBytes),
  };
}

async function saveActiveExtractionForTestV1(input: {
  deps: AnnualReportExtractionDepsV1;
  extraction: ReturnType<typeof parseAnnualReportExtractionPayloadV1>;
}) {
  const writeResult =
    await input.deps.artifactRepository.appendAnnualReportExtractionAndSetActive(
      {
        artifactId: crypto.randomUUID(),
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        createdAt: "2026-03-03T12:09:00.000Z",
        extraction: input.extraction,
      },
    );
  expect(writeResult.ok).toBe(true);
  if (!writeResult.ok) {
    throw new Error(writeResult.message);
  }

  return writeResult.artifact;
}

function createDeps(): AnnualReportExtractionDepsV1 {
  return {
    artifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    processingRunRepository: createD1AnnualReportProcessingRunRepositoryV1(
      env.DB,
    ),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    getRuntimeMetadata: () => ({
      extractionEngineVersion: "annual-report-deep-extraction.v2",
      runtimeFingerprint:
        "annual-report-deep-extraction.v2|qwen-plus|qwen-max",
    }),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => "2026-03-03T12:10:00.000Z",
  };
}

function createCompleteExtractionPayloadV1(input: {
  fileName: string;
  policyVersion: string;
}) {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: input.fileName,
    sourceFileType: "pdf",
    policyVersion: input.policyVersion,
    fields: {
      companyName: { status: "extracted", confidence: 0.99, value: "Acme AB" },
      organizationNumber: {
        status: "extracted",
        confidence: 0.99,
        value: "556677-8899",
      },
      fiscalYearStart: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-01-01",
      },
      fiscalYearEnd: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-12-31",
      },
      accountingStandard: {
        status: "extracted",
        confidence: 0.99,
        value: "K2",
      },
      profitBeforeTax: {
        status: "extracted",
        confidence: 0.99,
        value: 1000000,
      },
    },
    summary: {
      autoDetectedFieldCount: 6,
      needsReviewFieldCount: 0,
    },
    taxSignals: [],
    documentWarnings: [],
    taxDeep: {
      ink2rExtracted: {
        incomeStatement: [
          {
            code: "profit-before-tax",
            label: "Resultat fore skatt",
            currentYearValue: 1000000,
            evidence: [],
          },
        ],
        balanceSheet: [
          {
            code: "total-assets",
            label: "Summa tillgangar",
            currentYearValue: 5000000,
            evidence: [],
          },
        ],
      },
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      priorYearComparatives: [],
    },
    confirmation: {
      isConfirmed: false,
    },
  });
}

describe("annual report extraction workflow v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("auto-confirms full extractions and keeps confirm as a compatibility route", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: createCompleteExtractionPayloadV1({
        fileName: input.fileName,
        policyVersion: input.policyVersion,
      }),
    });
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64(`
          Company Name: Acme AB
          Org nr: 556677-8899
          Fiscal year: 2025-01-01 to 2025-12-31
          K2
          Resultat före skatt: 1 000 000
        `),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );

    expect(runResult.ok).toBe(true);
    if (!runResult.ok) {
      return;
    }
    expect(runResult.active.version).toBe(1);
    expect(runResult.runtime?.extractionEngineVersion).toBe(
      "annual-report-deep-extraction.v2",
    );
    expect(runResult.extraction.engineMetadata?.runtimeFingerprint).toBe(
      "annual-report-deep-extraction.v2|qwen-plus|qwen-max",
    );

    const overrideResult = await applyAnnualReportExtractionOverridesV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        overrides: [
          {
            fieldKey: "profitBeforeTax",
            value: 1200000,
            reason: "Corrected based on signed report",
          },
        ],
        authorUserId: USER_ID,
      },
      deps,
    );

    expect(overrideResult.ok).toBe(true);
    if (!overrideResult.ok) {
      return;
    }
    expect(overrideResult.active.version).toBe(2);
    expect(overrideResult.extraction.confirmation.isConfirmed).toBe(true);

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: overrideResult.active.artifactId,
          version: overrideResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );
    expect(confirmResult.ok).toBe(true);
    if (!confirmResult.ok) {
      return;
    }
    expect(confirmResult.active.version).toBe(3);
    expect(confirmResult.extraction.confirmation.isConfirmed).toBe(true);

    const rerunResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report-refresh.pdf",
        fileBytesBase64: toBase64(`
          Company Name: Acme AB
          Org nr: 556677-8899
          Fiscal year: 2025-01-01 to 2025-12-31
          K2
          Resultat före skatt: 1 100 000
        `),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );

    expect(rerunResult.ok).toBe(true);
    if (!rerunResult.ok) {
      return;
    }
    expect(rerunResult.active.version).toBe(4);
    expect(rerunResult.extraction.confirmation.isConfirmed).toBe(true);
  });

  it("fails confirmation if required fields are missing", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("Company Name: Acme AB"),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );
    expect(confirmResult.ok).toBe(false);
    if (!confirmResult.ok) {
      expect(confirmResult.error.code).toBe("INPUT_INVALID");
    }
  });

  it("fails confirmation when full financial statements are missing", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: parseAnnualReportExtractionPayloadV1({
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: input.fileName,
        sourceFileType: "pdf",
        policyVersion: input.policyVersion,
        fields: {
          companyName: {
            status: "extracted",
            confidence: 0.99,
            value: "Acme AB",
          },
          organizationNumber: {
            status: "extracted",
            confidence: 0.99,
            value: "556677-8899",
          },
          fiscalYearStart: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-12-31",
          },
          accountingStandard: {
            status: "extracted",
            confidence: 0.99,
            value: "K3",
          },
          profitBeforeTax: {
            status: "extracted",
            confidence: 0.99,
            value: 1000,
          },
        },
        summary: {
          autoDetectedFieldCount: 6,
          needsReviewFieldCount: 0,
        },
        taxSignals: [],
        documentWarnings: [],
        taxDeep: {
          ink2rExtracted: {
            incomeStatement: [],
            balanceSheet: [],
          },
          depreciationContext: {
            assetAreas: [],
            evidence: [],
          },
          assetMovements: {
            lines: [],
            evidence: [],
          },
          reserveContext: {
            movements: [],
            notes: [],
            evidence: [],
          },
          netInterestContext: {
            notes: [],
            evidence: [],
          },
          pensionContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          leasingContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          groupContributionContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          shareholdingContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          priorYearComparatives: [],
        },
        confirmation: {
          isConfirmed: false,
        },
      }),
    });

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("fake pdf text"),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );

    expect(confirmResult.ok).toBe(false);
    if (!confirmResult.ok) {
      expect(confirmResult.error.code).toBe("INPUT_INVALID");
      expect(confirmResult.error.context.missingFinancialStatements).toBe(true);
      expect(confirmResult.error.user_message).toContain(
        "income statement or balance sheet is incomplete",
      );
    }
  });

  it("allows confirmation with empty tax-note contexts when required fields and statements are present", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: createCompleteExtractionPayloadV1({
        fileName: input.fileName,
        policyVersion: input.policyVersion,
      }),
    });

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("fake pdf text"),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const confirmResult = await confirmAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        confirmedByUserId: USER_ID,
      },
      deps,
    );

    expect(confirmResult.ok).toBe(true);
    if (!confirmResult.ok) {
      return;
    }
    expect(confirmResult.extraction.confirmation.isConfirmed).toBe(true);
  });

  it("clears active annual-report data without deleting history", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: createCompleteExtractionPayloadV1({
        fileName: input.fileName,
        policyVersion: input.policyVersion,
      }),
    });

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("Annual report"),
        policyVersion: "annual-report-manual-first.v1",
        createdByUserId: USER_ID,
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected annual-report run success");
    }

    const clearResult = await clearAnnualReportDataV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        clearedByUserId: USER_ID,
      },
      deps,
    );

    expect(clearResult.ok).toBe(true);
    if (!clearResult.ok) {
      return;
    }
    expect(clearResult.clearedArtifactTypes).toEqual([
      "annual_report_extraction",
    ]);

    const activeExtraction = await getActiveAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(activeExtraction.ok).toBe(false);
    if (!activeExtraction.ok) {
      expect(activeExtraction.error.code).toBe("EXTRACTION_NOT_FOUND");
    }
  });

  it("loads active extraction payload", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("Company Name: Acme AB"),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );
    if (!runResult.ok) {
      throw new Error("Expected run success");
    }

    const active = await getActiveAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(active.ok).toBe(true);
  });

  it("persists Gemini-backed annual report extraction metadata when AI extractor is injected", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: parseAnnualReportExtractionPayloadV1({
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: input.fileName,
        sourceFileType: "pdf",
        policyVersion: input.policyVersion,
        fields: {
          companyName: {
            status: "extracted",
            confidence: 0.99,
            value: "Acme AB",
          },
          organizationNumber: {
            status: "extracted",
            confidence: 0.99,
            value: "556677-8899",
          },
          fiscalYearStart: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-12-31",
          },
          accountingStandard: {
            status: "extracted",
            confidence: 0.99,
            value: "K2",
          },
          profitBeforeTax: {
            status: "extracted",
            confidence: 0.99,
            value: 1000,
          },
        },
        summary: {
          autoDetectedFieldCount: 6,
          needsReviewFieldCount: 0,
        },
        taxSignals: [
          {
            code: "group_contribution_reference",
            label: "Possible group contribution disclosure",
            confidence: 0.84,
            reviewFlag: true,
            policyRuleReference: "signal.group_contribution.v1",
          },
        ],
        aiRun: {
          runId: "ai-run-1",
          moduleId: "annual-report-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-analysis.prompts.v1",
          policyVersion: "annual-report-analysis.v1",
          activePatchVersions: [],
          provider: "qwen",
          model: "qwen-plus",
          modelTier: "fast",
          generatedAt: "2026-03-03T12:10:00.000Z",
          usedFallback: false,
        },
        confirmation: {
          isConfirmed: false,
        },
      }),
    });

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("fake pdf text"),
        policyVersion: "annual-report-ai.v1",
      },
      deps,
    );

    expect(runResult.ok).toBe(true);
    if (!runResult.ok) {
      return;
    }

    expect(runResult.extraction.aiRun?.provider).toBe("qwen");
    expect(runResult.extraction.taxSignals).toHaveLength(1);
  });

  it("persists annual-report tax analysis when the manual forensic run succeeds", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: parseAnnualReportExtractionPayloadV1({
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: input.fileName,
        sourceFileType: "pdf",
        policyVersion: input.policyVersion,
        fields: {
          companyName: {
            status: "extracted",
            confidence: 0.99,
            value: "Acme AB",
          },
          organizationNumber: {
            status: "extracted",
            confidence: 0.99,
            value: "556677-8899",
          },
          fiscalYearStart: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "extracted",
            confidence: 0.99,
            value: "2025-12-31",
          },
          accountingStandard: {
            status: "extracted",
            confidence: 0.99,
            value: "K3",
          },
          profitBeforeTax: {
            status: "extracted",
            confidence: 0.99,
            value: 1000,
          },
        },
        summary: {
          autoDetectedFieldCount: 6,
          needsReviewFieldCount: 0,
        },
        taxSignals: [],
        documentWarnings: [],
        taxDeep: {
          ink2rExtracted: {
            incomeStatement: [
              {
                code: "3.1",
                label: "Nettoomsättning",
                currentYearValue: 1000000,
                evidence: [],
              },
            ],
            balanceSheet: [
              {
                code: "2.26",
                label: "Kassa, bank och redovisningsmedel",
                currentYearValue: 250000,
                evidence: [],
              },
            ],
          },
          depreciationContext: {
            assetAreas: [
              {
                assetArea: "Machinery",
                acquisitions: 250000,
                depreciationForYear: 50000,
                closingCarryingAmount: 750000,
                evidence: [{ snippet: "Note 8", page: 12 }],
              },
            ],
            evidence: [],
          },
          assetMovements: {
            lines: [],
            evidence: [],
          },
          reserveContext: {
            movements: [],
            notes: [],
            evidence: [],
          },
          netInterestContext: {
            notes: ["Finance note disclosure."],
            evidence: [],
          },
          pensionContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          leasingContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          groupContributionContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          shareholdingContext: {
            flags: [],
            notes: [],
            evidence: [],
          },
          priorYearComparatives: [],
        },
        confirmation: {
          isConfirmed: false,
        },
      }),
    });
    deps.analyzeAnnualReportTax = async (input) => ({
      ok: true,
      taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
        schemaVersion: "annual_report_tax_analysis_v1",
        sourceExtractionArtifactId: input.extractionArtifactId,
        policyVersion: input.policyVersion,
        basedOn:
          input.extraction.taxDeep ??
          createCompleteExtractionPayloadV1({
            fileName: input.extraction.sourceFileName,
            policyVersion: input.policyVersion,
          }).taxDeep,
        executiveSummary: "Depreciation note needs follow-up.",
        accountingStandardAssessment: {
          status: "aligned",
          rationale: "K3 disclosed in report.",
        },
        findings: [
          {
            id: "finding-1",
            area: "depreciation_differences",
            title: "Movement schedule should be compared to tax register",
            severity: "high",
            rationale: "Large acquisitions and depreciation were disclosed.",
            missingInformation: ["Tax depreciation base"],
            policyRuleReference: "annual-report-tax-analysis.depreciation.v1",
            evidence: [{ snippet: "Note 8", page: 12 }],
          },
        ],
        missingInformation: ["Tax depreciation base"],
        recommendedNextActions: ["Compare with fixed-asset register."],
      }),
    });

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64("fake pdf text"),
        policyVersion: "annual-report-ai.v1",
      },
      deps,
    );

    expect(runResult.ok).toBe(true);
    if (!runResult.ok) {
      return;
    }

    const taxRunResult = await runAnnualReportTaxAnalysisV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: runResult.active.artifactId,
          version: runResult.active.version,
        },
        requestedByUserId: USER_ID,
      },
      deps,
    );
    expect(taxRunResult.ok).toBe(true);
    if (!taxRunResult.ok) {
      return;
    }

    const taxAnalysis = await getActiveAnnualReportTaxAnalysisV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(taxAnalysis.ok).toBe(true);
    if (!taxAnalysis.ok) {
      return;
    }
    expect(taxAnalysis.taxAnalysis.findings[0]?.area).toBe(
      "depreciation_differences",
    );
  });

  it("persists source lineage for direct annual-report extraction uploads", async () => {
    await seedWorkspace();
    const deps = createDeps();
    deps.extractAnnualReport = async (input) => ({
      ok: true,
      extraction: createCompleteExtractionPayloadV1({
        fileName: input.fileName,
        policyVersion: input.policyVersion,
      }),
    });
    const uploadedBytes = "fake pdf text";

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: toBase64(uploadedBytes),
        policyVersion: "annual-report-ai.v1",
      },
      deps,
    );
    expect(runResult.ok).toBe(true);
    if (!runResult.ok) {
      return;
    }

    expect(runResult.extraction.sourceLineage).toEqual({
      sourceContentSha256: await computeSourceContentSha256V1(
        new TextEncoder().encode(uploadedBytes),
      ),
    });
  });

  it("loads the exact stored source for manual forensic review even when a newer file shares the same name", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const originalSourceBytes = Uint8Array.from([37, 80, 68, 70, 45, 49]);
    const newerSourceBytes = Uint8Array.from([37, 80, 68, 70, 45, 50]);
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get(key) {
        if (key === "annual-report-source/original.pdf") {
          return {
            async arrayBuffer() {
              return Uint8Array.from(originalSourceBytes).buffer;
            },
          };
        }
        if (key === "annual-report-source/newer.pdf") {
          return {
            async arrayBuffer() {
              return Uint8Array.from(newerSourceBytes).buffer;
            },
          };
        }

        return null;
      },
      async put() {
        return;
      },
    };
    let receivedSourceDocument:
      | {
          fileBytes: Uint8Array;
          fileName: string;
          fileType: "pdf" | "docx";
        }
      | undefined;
    deps.analyzeAnnualReportTax = async (input) => {
      receivedSourceDocument = input.sourceDocument;
      return {
        ok: true,
        taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
          schemaVersion: "annual_report_tax_analysis_v1",
          sourceExtractionArtifactId: input.extractionArtifactId,
          policyVersion: input.policyVersion,
          basedOn:
            input.extraction.taxDeep ??
            createCompleteExtractionPayloadV1({
              fileName: input.extraction.sourceFileName,
              policyVersion: input.policyVersion,
            }).taxDeep,
          executiveSummary: "Review source document directly.",
          accountingStandardAssessment: {
            status: "aligned",
            rationale: "K2 disclosed in report.",
          },
          findings: [],
          missingInformation: [],
          recommendedNextActions: [],
        }),
      };
    };

    const originalRun = await deps.processingRunRepository?.create({
      id: "9d000000-0000-4000-8000-000000000098",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      sourceStorageKey: "annual-report-source/original.pdf",
      sourceSizeBytes: originalSourceBytes.byteLength,
      policyVersion: "annual-report-ai.v1",
      status: "completed",
      hasPreviousActiveResult: false,
      technicalDetails: [],
      createdAt: "2026-03-03T12:09:00.000Z",
      updatedAt: "2026-03-03T12:09:00.000Z",
    });
    expect(originalRun?.ok).toBe(true);

    const newerRun = await deps.processingRunRepository?.create({
      id: "9d000000-0000-4000-8000-000000000099",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      sourceStorageKey: "annual-report-source/newer.pdf",
      sourceSizeBytes: newerSourceBytes.byteLength,
      policyVersion: "annual-report-ai.v1",
      status: "completed",
      hasPreviousActiveResult: false,
      technicalDetails: [],
      createdAt: "2026-03-03T12:10:00.000Z",
      updatedAt: "2026-03-03T12:10:00.000Z",
    });
    expect(newerRun?.ok).toBe(true);

    const activeExtraction = await saveActiveExtractionForTestV1({
      deps,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...createCompleteExtractionPayloadV1({
          fileName: "annual-report.pdf",
          policyVersion: "annual-report-ai.v1",
        }),
        sourceLineage: await buildSourceLineageForTestV1({
          fileBytes: originalSourceBytes,
          processingRunId: "9d000000-0000-4000-8000-000000000098",
          sourceStorageKey: "annual-report-source/original.pdf",
        }),
      }),
    });

    const taxRunResult = await runAnnualReportTaxAnalysisV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
        requestedByUserId: USER_ID,
      },
      deps,
    );
    expect(taxRunResult.ok).toBe(true);
    if (!taxRunResult.ok) {
      return;
    }
    expect(taxRunResult.taxAnalysis).toBeDefined();
    if (!taxRunResult.taxAnalysis) {
      return;
    }
    expect(receivedSourceDocument).toEqual({
      fileBytes: originalSourceBytes,
      fileName: "annual-report.pdf",
      fileType: "pdf",
    });
    expect(taxRunResult.taxAnalysis.missingInformation).toEqual([]);
  });

  it("uses a legacy filename/type source lookup only for artifacts without source lineage", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const sourceBytes = Uint8Array.from([37, 80, 68, 70, 45, 51]);
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get(key) {
        if (key !== "annual-report-source/legacy.pdf") {
          return null;
        }

        return {
          async arrayBuffer() {
            return Uint8Array.from(sourceBytes).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    let receivedSourceDocument:
      | {
          fileBytes: Uint8Array;
          fileName: string;
          fileType: "pdf" | "docx";
        }
      | undefined;
    deps.analyzeAnnualReportTax = async (input) => {
      receivedSourceDocument = input.sourceDocument;
      return {
        ok: true,
        taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
          schemaVersion: "annual_report_tax_analysis_v1",
          sourceExtractionArtifactId: input.extractionArtifactId,
          policyVersion: input.policyVersion,
          basedOn:
            input.extraction.taxDeep ??
            createCompleteExtractionPayloadV1({
              fileName: input.extraction.sourceFileName,
              policyVersion: input.policyVersion,
            }).taxDeep,
          executiveSummary: "Legacy source lookup used.",
          accountingStandardAssessment: {
            status: "aligned",
            rationale: "K2 disclosed in report.",
          },
          findings: [],
          missingInformation: [],
          recommendedNextActions: [],
        }),
      };
    };

    const persistedRun = await deps.processingRunRepository?.create({
      id: "9d000000-0000-4000-8000-000000000097",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      sourceStorageKey: "annual-report-source/legacy.pdf",
      sourceSizeBytes: sourceBytes.byteLength,
      policyVersion: "annual-report-ai.v1",
      status: "completed",
      hasPreviousActiveResult: false,
      technicalDetails: [],
      createdAt: "2026-03-03T12:09:00.000Z",
      updatedAt: "2026-03-03T12:09:00.000Z",
    });
    expect(persistedRun?.ok).toBe(true);

    const activeExtraction = await saveActiveExtractionForTestV1({
      deps,
      extraction: createCompleteExtractionPayloadV1({
        fileName: "annual-report.pdf",
        policyVersion: "annual-report-ai.v1",
      }),
    });

    const taxRunResult = await runAnnualReportTaxAnalysisV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
        requestedByUserId: USER_ID,
      },
      deps,
    );
    expect(taxRunResult.ok).toBe(true);
    if (!taxRunResult.ok) {
      return;
    }
    expect(taxRunResult.taxAnalysis).toBeDefined();
    if (!taxRunResult.taxAnalysis) {
      return;
    }
    expect(receivedSourceDocument).toEqual({
      fileBytes: sourceBytes,
      fileName: "annual-report.pdf",
      fileType: "pdf",
    });
    expect(taxRunResult.taxAnalysis.reviewState).toEqual({
      mode: "full_ai",
      reasons: [
        "Source document was loaded via legacy filename/type matching because extraction source lineage was unavailable.",
      ],
      sourceDocumentAvailable: true,
      sourceDocumentUsed: true,
    });
  });

  it("does not substitute a newer same-name source when exact lineage points to a missing object", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const missingSourceBytes = Uint8Array.from([37, 80, 68, 70, 45, 52]);
    const newerSourceBytes = Uint8Array.from([37, 80, 68, 70, 45, 53]);
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get(key) {
        if (key === "annual-report-source/newer.pdf") {
          return {
            async arrayBuffer() {
              return Uint8Array.from(newerSourceBytes).buffer;
            },
          };
        }

        return null;
      },
      async put() {
        return;
      },
    };
    let receivedSourceDocument:
      | {
          fileBytes: Uint8Array;
          fileName: string;
          fileType: "pdf" | "docx";
        }
      | undefined;
    deps.analyzeAnnualReportTax = async (input) => {
      receivedSourceDocument = input.sourceDocument;
      return {
        ok: true,
        taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
          schemaVersion: "annual_report_tax_analysis_v1",
          sourceExtractionArtifactId: input.extractionArtifactId,
          policyVersion: input.policyVersion,
          basedOn:
            input.extraction.taxDeep ??
            createCompleteExtractionPayloadV1({
              fileName: input.extraction.sourceFileName,
              policyVersion: input.policyVersion,
            }).taxDeep,
          executiveSummary: "Extraction-only review.",
          accountingStandardAssessment: {
            status: "aligned",
            rationale: "K2 disclosed in report.",
          },
          findings: [],
          missingInformation: [],
          recommendedNextActions: [],
        }),
      };
    };

    const originalRun = await deps.processingRunRepository?.create({
      id: "9d000000-0000-4000-8000-000000000095",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      sourceStorageKey: "annual-report-source/missing.pdf",
      sourceSizeBytes: missingSourceBytes.byteLength,
      policyVersion: "annual-report-ai.v1",
      status: "completed",
      hasPreviousActiveResult: false,
      technicalDetails: [],
      createdAt: "2026-03-03T12:08:00.000Z",
      updatedAt: "2026-03-03T12:08:00.000Z",
    });
    expect(originalRun?.ok).toBe(true);

    const newerRun = await deps.processingRunRepository?.create({
      id: "9d000000-0000-4000-8000-000000000096",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      sourceStorageKey: "annual-report-source/newer.pdf",
      sourceSizeBytes: newerSourceBytes.byteLength,
      policyVersion: "annual-report-ai.v1",
      status: "completed",
      hasPreviousActiveResult: false,
      technicalDetails: [],
      createdAt: "2026-03-03T12:10:00.000Z",
      updatedAt: "2026-03-03T12:10:00.000Z",
    });
    expect(newerRun?.ok).toBe(true);

    const activeExtraction = await saveActiveExtractionForTestV1({
      deps,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...createCompleteExtractionPayloadV1({
          fileName: "annual-report.pdf",
          policyVersion: "annual-report-ai.v1",
        }),
        sourceLineage: await buildSourceLineageForTestV1({
          fileBytes: missingSourceBytes,
          processingRunId: "9d000000-0000-4000-8000-000000000095",
          sourceStorageKey: "annual-report-source/missing.pdf",
        }),
      }),
    });

    const taxRunResult = await runAnnualReportTaxAnalysisV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
        requestedByUserId: USER_ID,
      },
      deps,
    );
    expect(taxRunResult.ok).toBe(true);
    if (!taxRunResult.ok) {
      return;
    }
    expect(taxRunResult.taxAnalysis).toBeDefined();
    if (!taxRunResult.taxAnalysis) {
      return;
    }
    expect(receivedSourceDocument).toBeUndefined();
    expect(taxRunResult.taxAnalysis.reviewState).toEqual({
      mode: "extraction_only",
      reasons: [
        "Source document unavailable for active extraction; forensic review used extraction-only context.",
      ],
      sourceDocumentAvailable: false,
      sourceDocumentUsed: false,
    });
  });

  it("rejects oversized annual report payloads deterministically", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const oversizedBytes = "A".repeat(MAX_ANNUAL_REPORT_FILE_BYTES_V1 + 1);

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: btoa(oversizedBytes),
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );

    expect(runResult.ok).toBe(false);
    if (!runResult.ok) {
      expect(runResult.error.code).toBe("INPUT_INVALID");
      expect(runResult.error.context.reason).toBe("payload_too_large");
    }
  });

  it("rejects annual report file-type/content mismatches", async () => {
    await seedWorkspace();
    const deps = createDeps();
    const zipLikeBytes = btoa(String.fromCharCode(0x50, 0x4b, 0x03, 0x04));

    const runResult = await runAnnualReportExtractionV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        fileName: "annual-report.pdf",
        fileBytesBase64: zipLikeBytes,
        policyVersion: "annual-report-manual-first.v1",
      },
      deps,
    );

    expect(runResult.ok).toBe(false);
    if (!runResult.ok) {
      expect(runResult.error.code).toBe("INPUT_INVALID");
      expect(runResult.error.context.reason).toBe("file_type_content_mismatch");
    }
  });
});
