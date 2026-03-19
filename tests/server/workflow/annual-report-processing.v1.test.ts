import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  startAnnualReportTaxAnalysisProcessingRunV1,
  type AnnualReportProcessingDepsV1,
} from "../../../src/server/workflow/annual-report-processing.v1";
import { computeSourceContentSha256V1 } from "../../../src/server/workflow/annual-report-extraction.v1";
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

async function saveActiveExtractionForTestV1(input?: {
  extraction?: ReturnType<typeof createCompleteExtractionPayloadV1>;
}) {
  const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);
  const writeResult = await repository.appendAnnualReportExtractionAndSetActive({
    artifactId: "9d100000-0000-4000-8000-000000000099",
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    createdAt: "2026-03-03T12:05:00.000Z",
    extraction: input?.extraction ?? createCompleteExtractionPayloadV1(),
  });
  if (!writeResult.ok) {
    throw new Error(writeResult.message);
  }

  return writeResult.artifact;
}

describe("annual report processing workflow v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
    await seedWorkspace();
  });

  it("starts manual forensic review as a durable running processing run", async () => {
    const activeExtraction = await saveActiveExtractionForTestV1();
    const deps = createBaseDeps();
    const queuedMessages: Array<{
      runId: string;
      tenantId: string;
      workspaceId: string;
    }> = [];
    deps.analyzeAnnualReportTax = async () => {
      throw new Error("manual tax analysis should not execute during run creation");
    };
    deps.enqueueProcessingRun = async (message) => {
      queuedMessages.push(message);
      return { ok: true as const };
    };

    const result = await startAnnualReportTaxAnalysisProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.run).toBeDefined();
    if (!result.run) {
      return;
    }

    expect(result.run.status).toBe("running_tax_analysis");
    expect(result.run.result?.extractionArtifactId).toBe(activeExtraction.id);
    expect(result.run.result?.taxAnalysisArtifactId).toBeUndefined();
    expect(result.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "processing.operation=tax_analysis",
        `tax_analysis.expected_extraction_artifact_id=${activeExtraction.id}`,
        `tax_analysis.expected_extraction_version=${activeExtraction.version}`,
      ]),
    );
    expect(queuedMessages).toEqual([
      {
        runId: result.run.runId,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
    ]);
  });

  it("blocks starting a second forensic review while one is already open", async () => {
    const activeExtraction = await saveActiveExtractionForTestV1();
    const deps = createBaseDeps();
    deps.analyzeAnnualReportTax = async () => {
      throw new Error("manual tax analysis should not execute during run creation");
    };
    deps.enqueueProcessingRun = async () => ({ ok: true as const });

    const firstRun = await startAnnualReportTaxAnalysisProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
      },
      deps,
    );
    expect(firstRun.ok).toBe(true);
    if (!firstRun.ok || !firstRun.run) {
      return;
    }

    const secondRun = await startAnnualReportTaxAnalysisProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
      },
      deps,
    );

    expect(secondRun.ok).toBe(false);
    if (secondRun.ok) {
      return;
    }

    expect(secondRun.error.code).toBe("STATE_CONFLICT");
  });

  it("processes queued forensic-review runs and persists the completed tax analysis", async () => {
    const activeExtraction = await saveActiveExtractionForTestV1();
    const deps = createBaseDeps();
    deps.enqueueProcessingRun = async () => ({ ok: true as const });
    deps.analyzeAnnualReportTax = async (input) => ({
      ok: true as const,
      taxAnalysis: parseAnnualReportTaxAnalysisPayloadV1({
        schemaVersion: "annual_report_tax_analysis_v1",
        sourceExtractionArtifactId: input.extractionArtifactId,
        policyVersion: input.policyVersion,
        basedOn: input.extraction.taxDeep ?? createCompleteExtractionPayloadV1().taxDeep,
        executiveSummary: "Queued forensic review finished.",
        accountingStandardAssessment: {
          status: "aligned",
          rationale: "K3 is explicit in the saved extraction.",
        },
        reviewState: {
          mode: "full_ai",
          reasons: [],
          sourceDocumentAvailable: false,
          sourceDocumentUsed: false,
        },
        findings: [],
        missingInformation: [],
        recommendedNextActions: [],
      }),
    });

    const startResult = await startAnnualReportTaxAnalysisProcessingRunV1(
      {
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        expectedActiveExtraction: {
          artifactId: activeExtraction.id,
          version: activeExtraction.version,
        },
      },
      deps,
    );
    expect(startResult.ok).toBe(true);
    if (!startResult.ok || !startResult.run) {
      return;
    }

    await processAnnualReportProcessingRunV1(
      {
        runId: startResult.run.runId,
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
    expect(latest.run.result?.extractionArtifactId).toBe(activeExtraction.id);
    expect(latest.run.result?.taxAnalysisArtifactId).toBeTruthy();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "processing.tax_analysis.review_mode=extraction_only",
        "processing.tax_analysis.source_document_available=0",
        "processing.tax_analysis.source_document_used=0",
      ]),
    );

    const activeTaxAnalysis =
      await deps.artifactRepository.getActiveAnnualReportTaxAnalysis({
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      });
    expect(activeTaxAnalysis?.payload.executiveSummary).toBe(
      "Queued forensic review finished.",
    );
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
        message: "Annual-report source parsing failed: Invalid PDF structure.",
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

  it("does not auto-run forensic tax analysis after a successful extraction", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    let analyzeCallCount = 0;
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
    deps.analyzeAnnualReportTax = async () => {
      analyzeCallCount += 1;
      return {
        ok: false as const,
        error: {
          code: "MODEL_EXECUTION_FAILED" as const,
          message: "Gemini statements timeout",
          context: {},
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

    expect(analyzeCallCount).toBe(0);
    expect(latest.run.status).toBe("completed");
    expect(latest.run.result?.extractionArtifactId).toBeTruthy();
    expect(latest.run.result?.taxAnalysisArtifactId).toBeUndefined();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "tax_analysis.execution_mode=manual_trigger",
        "tax_analysis.manual_run_available=1",
      ]),
    );
  });

  it("persists source lineage on queued extraction artifacts", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    const sourceBytes = new Uint8Array([37, 80, 68, 70, 45, 54]);
    deps.sourceStore = {
      async delete() {
        return;
      },
      async get() {
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
    deps.extractAnnualReport = async () => ({
      ok: true as const,
      extraction: createCompleteExtractionPayloadV1(),
    });

    await processAnnualReportProcessingRunV1(
      {
        runId: RUN_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      },
      deps,
    );

    const activeExtraction =
      await deps.artifactRepository.getActiveAnnualReportExtraction({
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      });
    expect(activeExtraction).toBeTruthy();
    expect(activeExtraction?.payload.sourceLineage).toEqual({
      processingRunId: RUN_ID,
      sourceStorageKey: "annual-report-source/test.pdf",
      sourceContentSha256: await computeSourceContentSha256V1(sourceBytes),
    });
  });

  it("marks manual forensic review as blocked when extraction is incomplete", async () => {
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
        taxDeep: {
          ...createCompleteExtractionPayloadV1().taxDeep,
          ink2rExtracted: {
            incomeStatement: [],
            balanceSheet: [],
          },
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
    expect(latest.run.result?.taxAnalysisArtifactId).toBeUndefined();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "tax_analysis.execution_mode=manual_trigger",
        "tax_analysis.manual_run_blocked=extraction_incomplete",
      ]),
    );
  });

  it("keeps manual tax-analysis mode even when an analyzer dependency is injected", async () => {
    await createQueuedRun();
    const deps = createBaseDeps();
    let analyzeCallCount = 0;
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
    deps.analyzeAnnualReportTax = async () => {
      analyzeCallCount += 1;
      return {
        ok: false as const,
        error: {
          code: "MODEL_EXECUTION_FAILED" as const,
          message: "Should not be called during upload processing",
          context: {},
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

    expect(analyzeCallCount).toBe(0);
    expect(latest.run.result?.taxAnalysisArtifactId).toBeUndefined();
    expect(latest.run.technicalDetails).toEqual(
      expect.arrayContaining([
        "tax_analysis.execution_mode=manual_trigger",
        "tax_analysis.manual_run_available=1",
      ]),
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

  it("does not mark an open run as stuck before the timeout window elapses", async () => {
    await createQueuedRun();
    await env.DB.prepare(
      `
        UPDATE annual_report_processing_runs_v1
        SET updated_at = ?1
        WHERE id = ?2
      `,
    )
      .bind("2026-03-03T12:03:00.000Z", RUN_ID)
      .run();

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );
    try {
      const latest = await getLatestAnnualReportProcessingRunV1(
        {
          tenantId: TENANT_ID,
          workspaceId: WORKSPACE_ID,
        },
        createBaseDeps(),
      );
      expect(latest.ok).toBe(true);
      if (!latest.ok) {
        return;
      }

      expect(latest.run.status).toBe("queued");
      expect(latest.run.technicalDetails).not.toContain(
        "processing.runtime.stuck_run_detected_on_poll",
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("marks an open run as failed after the stuck timeout elapses", async () => {
    await createQueuedRun();
    await env.DB.prepare(
      `
        UPDATE annual_report_processing_runs_v1
        SET updated_at = ?1
        WHERE id = ?2
      `,
    )
      .bind("2026-03-03T12:01:00.000Z", RUN_ID)
      .run();

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );
    try {
      const latest = await getLatestAnnualReportProcessingRunV1(
        {
          tenantId: TENANT_ID,
          workspaceId: WORKSPACE_ID,
        },
        createBaseDeps(),
      );
      expect(latest.ok).toBe(true);
      if (!latest.ok) {
        return;
      }

      expect(latest.run.status).toBe("failed");
      expect(latest.run.technicalDetails).toEqual(
        expect.arrayContaining([
          "processing.runtime.stuck_run_detected_on_poll",
        ]),
      );
      expect(latest.run.error?.code).toBe("PROCESSING_RUN_UNAVAILABLE");
    } finally {
      nowSpy.mockRestore();
    }
  });
});
