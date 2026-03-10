import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import {
  type AnnualReportProcessingRunRecordV1,
  createD1AnnualReportProcessingRunRepositoryV1,
} from "../../../src/db/repositories/annual-report-processing-run.repository.v1";
import { createD1AnnualReportUploadSessionRepositoryV1 } from "../../../src/db/repositories/annual-report-upload-session.repository.v1";
import { createD1WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../../src/db/repositories/workspace.repository.v1";
import {
  getLatestAnnualReportProcessingRunV1,
  processAnnualReportProcessingRunV1,
  type AnnualReportProcessingDepsV1,
} from "../../../src/server/workflow/annual-report-processing.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseAnnualReportTaxAnalysisPayloadV1 } from "../../../src/shared/contracts/annual-report-tax-analysis.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "9d100000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9d100000-0000-4000-8000-000000000002";
const COMPANY_ID = "9d100000-0000-4000-8000-000000000003";
const RUN_ID = "9d100000-0000-4000-8000-000000000004";

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

function createBaseDeps(): AnnualReportProcessingDepsV1 {
  return {
    artifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    processingRunRepository: createD1AnnualReportProcessingRunRepositoryV1(
      env.DB,
    ),
    uploadSessionRepository: createD1AnnualReportUploadSessionRepositoryV1(
      env.DB,
    ),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => "2026-03-03T12:10:00.000Z",
  };
}

async function createQueuedRun(): Promise<AnnualReportProcessingRunRecordV1> {
  const repository = createD1AnnualReportProcessingRunRepositoryV1(env.DB);
  const run: AnnualReportProcessingRunRecordV1 = {
    id: RUN_ID,
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    sourceStorageKey: "annual-report-source/test.pdf",
    sourceSizeBytes: 128,
    policyVersion: "annual-report-manual-first.v1",
    status: "queued",
    hasPreviousActiveResult: false,
    technicalDetails: [],
    createdAt: "2026-03-03T12:00:00.000Z",
    updatedAt: "2026-03-03T12:00:00.000Z",
  };
  const result = await repository.create(run);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

function createCompleteExtractionPayloadV1() {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
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
        value: "K3",
      },
      profitBeforeTax: {
        status: "extracted",
        confidence: 0.99,
        value: 250000,
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
            currentYearValue: 250000,
            evidence: [],
          },
        ],
        balanceSheet: [
          {
            code: "total-assets",
            label: "Summa tillgangar",
            currentYearValue: 1000000,
            evidence: [],
          },
        ],
      },
      depreciationContext: { assetAreas: [], evidence: [] },
      assetMovements: { lines: [], evidence: [] },
      reserveContext: { movements: [], notes: [], evidence: [] },
      netInterestContext: { notes: [], evidence: [] },
      pensionContext: { flags: [], notes: [], evidence: [] },
      taxExpenseContext: { notes: [], evidence: [] },
      leasingContext: { flags: [], notes: [], evidence: [] },
      groupContributionContext: { flags: [], notes: [], evidence: [] },
      shareholdingContext: { flags: [], notes: [], evidence: [] },
      priorYearComparatives: [],
    },
    confirmation: {
      isConfirmed: false,
    },
  });
}

describe("annual report processing workflow v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedWorkspace();
  });

  it("marks queued run as failed when source storage binding is unavailable", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.extractAnnualReport = async () => {
      throw new Error("should not execute");
    };

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }
    expect(latest.run.status).toBe("failed");
    expect(latest.run.error?.code).toBe("PROCESSING_RUN_UNAVAILABLE");
    expect(latest.run.technicalDetails).toContain(
      "processing.runtime.unavailable source_store_binding_missing",
    );
  });

  it("marks queued run as failed when extractor dependency is unavailable", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([1, 2, 3]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }
    expect(latest.run.status).toBe("failed");
    expect(latest.run.error?.code).toBe("PROCESSING_RUN_UNAVAILABLE");
    expect(latest.run.technicalDetails).toContain(
      "processing.runtime.unavailable extractor_dependency_missing",
    );
  });

  it("marks queued run as failed when stored source bytes cannot be loaded", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return null;
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => {
      throw new Error("should not execute");
    };

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }
    expect(latest.run.status).toBe("failed");
    expect(latest.run.error?.code).toBe("PROCESSING_RUN_UNAVAILABLE");
    expect(latest.run.technicalDetails).toContain(
      "processing.source_load.failed stored_source_missing_or_unreadable",
    );
  });

  it("marks the run failed when parsing fails before AI extraction starts", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message:
          "Annual-report source parsing failed: Invalid PDF structure.",
        user_message:
          "The annual report could not be parsed for AI analysis. Upload the report again or contact your administrator.",
        context: {
          stage: "source_parsing",
        },
      },
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("failed");
    expect(latest.run.error?.code).toBe("PARSE_FAILED");
    expect(latest.run.error?.technicalMessage).toContain(
      "source parsing failed",
    );
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "processing.extraction.failed code=PARSE_FAILED",
        "processing.extraction.failed stage=source_parsing",
      ]),
    );
  });

  it("marks the run failed when source parsing times out", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        ok: false as const,
        error: {
          code: "PARSE_FAILED" as const,
          message:
            "Annual-report source parsing failed: Annual-report source parsing timed out after 20000ms.",
          user_message:
            "The annual report could not be parsed for AI analysis. Upload the report again or contact your administrator.",
          context: {
            stage: "source_parsing",
          },
        },
      };
    };

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("failed");
    expect(latest.run.error?.code).toBe("PARSE_FAILED");
    expect(latest.run.error?.technicalMessage).toContain("timed out");
  });

  it("terminalizes extraction before background tax analysis failure", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: createCompleteExtractionPayloadV1(),
    });
    deps.analyzeAnnualReportTax = async () => ({
      ok: false as const,
      error: {
        code: "MODEL_EXECUTION_FAILED" as const,
        message: "Gemini statements timeout",
        context: {},
      },
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("completed");
    expect(latest.run.result?.extractionArtifactId).toBeTruthy();
    expect(latest.run.result?.taxAnalysisArtifactId).toBeUndefined();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "tax_analysis.background.failed",
        "tax_analysis.background.error=MODEL_EXECUTION_FAILED",
      ]),
    );
  });

  it("records fallback tax-analysis completion when a usable fallback review is persisted", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: createCompleteExtractionPayloadV1(),
    });
    deps.analyzeAnnualReportTax = async (input) => ({
      ok: true as const,
      taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
        schemaVersion: "annual_report_tax_analysis_v1",
        sourceExtractionArtifactId: input.extractionArtifactId,
        policyVersion: input.policyVersion,
        basedOn: input.extraction.taxDeep!,
        executiveSummary: "Forensic review completed using deterministic fallback.",
        accountingStandardAssessment: {
          status: "aligned",
          rationale: "K3 is available in the extracted core facts.",
        },
        findings: [],
        missingInformation: [],
        recommendedNextActions: ["Review degraded note extraction manually."],
        aiRun: {
          runId: "fallback-run",
          moduleId: "annual-report-tax-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-tax-analysis.prompts.v1",
          policyVersion: input.policyVersion,
          activePatchVersions: [],
          provider: "gemini",
          model: "gemini-2.5-flash",
          modelTier: "fast",
          generatedAt: "2026-03-03T12:10:00.000Z",
          usedFallback: true,
        },
      }),
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("completed");
    expect(latest.run.result?.taxAnalysisArtifactId).toBeTruthy();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "tax_analysis.background.fallback_used",
        "tax_analysis.background.completed",
      ]),
    );
  });

  it("retries the active-extraction check before persisting tax analysis", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: createCompleteExtractionPayloadV1(),
    });
    deps.analyzeAnnualReportTax = async (input) => ({
      ok: true as const,
      taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
        schemaVersion: "annual_report_tax_analysis_v1",
        sourceExtractionArtifactId: input.extractionArtifactId,
        policyVersion: input.policyVersion,
        basedOn: input.extraction.taxDeep!,
        executiveSummary: "Forensic review completed after active-artifact retry.",
        accountingStandardAssessment: {
          status: "aligned",
          rationale: "K3 is available in the extracted core facts.",
        },
        findings: [],
        missingInformation: [],
        recommendedNextActions: [],
        aiRun: {
          runId: "retry-run",
          moduleId: "annual-report-tax-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-tax-analysis.prompts.v1",
          policyVersion: input.policyVersion,
          activePatchVersions: [],
          provider: "gemini",
          model: "gemini-2.5-flash",
          modelTier: "fast",
          generatedAt: "2026-03-03T12:10:00.000Z",
          usedFallback: false,
        },
      }),
    });

    const realArtifactRepository = deps.artifactRepository;
    let activeExtractionReads = 0;
    deps.artifactRepository = {
      ...realArtifactRepository,
      async getActiveAnnualReportExtraction(input) {
        activeExtractionReads += 1;
        if (activeExtractionReads === 1) {
          return null;
        }
        return realArtifactRepository.getActiveAnnualReportExtraction(input);
      },
    };

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(activeExtractionReads).toBeGreaterThan(1);
    expect(latest.run.result?.taxAnalysisArtifactId).toBeTruthy();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining(["tax_analysis.background.completed"]),
    );
  });

  it("keeps note-only extraction warnings non-blocking when statements and core facts are usable", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...createCompleteExtractionPayloadV1(),
        documentWarnings: [
          "degraded.tax_notes_assets.unavailable:[tax notes assets/reserves] Stage timed out.",
          "degraded.tax_notes_finance.unavailable:[tax notes finance/other] Stage timed out.",
        ],
      }),
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("completed");
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "degraded.tax_notes_assets.unavailable:[tax notes assets/reserves] Stage timed out.",
        "degraded.tax_notes_finance.unavailable:[tax notes finance/other] Stage timed out.",
      ]),
    );
  });

  it("marks the run partial when required core facts are missing even if statements exist", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
        return {
          async arrayBuffer() {
            return new Uint8Array([37, 80, 68, 70]).buffer;
          },
        };
      },
      async put() {
        return;
      },
    };
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...createCompleteExtractionPayloadV1(),
        fields: {
          ...createCompleteExtractionPayloadV1().fields,
          accountingStandard: { status: "needs_review", confidence: 0.2 },
        },
        summary: {
          autoDetectedFieldCount: 5,
          needsReviewFieldCount: 1,
        },
      }),
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const latest = await getLatestAnnualReportProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );
    expect(latest.ok).toBe(true);
    if (!latest.ok) {
      return;
    }

    expect(latest.run.status).toBe("partial");
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "degraded.extraction.partial Missing required core facts: accountingStandard.",
      ]),
    );
  });
});
