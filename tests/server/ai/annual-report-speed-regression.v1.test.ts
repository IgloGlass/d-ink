import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { createAnnualReportExtractionDepsV1 } from "../../../src/server/workflow/workflow-deps.v1";
import type { AnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import type { AnnualReportTaxDeepExtractionV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../../src/shared/contracts/annual-report-tax-analysis.v1";
import type { Env } from "../../../src/shared/types/env";

type RuntimeModeV1 = "default" | "ai_overdrive";

type RegressionConfigFileV1 = {
  baselineRuntimeMode?: RuntimeModeV1;
  candidateRuntimeMode?: RuntimeModeV1;
  enabled?: boolean;
  outputDirectory?: string;
  pdfPath?: string;
};

type RegressionRunV1 = {
  durationMs: number;
  extraction: AnnualReportExtractionPayloadV1;
  metrics: ReturnType<typeof collectExtractionMetricsV1>;
  runtimeMode: RuntimeModeV1;
  taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
  taxMetrics: ReturnType<typeof collectTaxAnalysisMetricsV1>;
};

const REGRESSION_THRESHOLDS_V1 = {
  allowedFindingAndActionDrop: 1,
  allowedNoteEvidenceDrop: 2,
  allowedNarrativeNoteDrop: 1,
  allowedStatementRowDrop: 2,
  allowedStatementValueDrop: 2,
} as const;

const REPO_ROOT_DIRECTORY_V1 = process.cwd();
const REGRESSION_CONFIG_FILE_PATH_V1 = path.join(
  REPO_ROOT_DIRECTORY_V1,
  "output",
  "annual-report-speed-regression",
  "run-config.json",
);

function isRegressionEnabledV1(): boolean {
  const flag = process.env.DINK_RUN_ANNUAL_REPORT_SPEED_REGRESSION?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function resolveRuntimeModeEnvV1(
  value: string | undefined,
  fallback: RuntimeModeV1,
): RuntimeModeV1 {
  if (value === "default" || value === "ai_overdrive") {
    return value;
  }

  return fallback;
}

function resolveRegressionConfigV1() {
  const fileConfig = readRegressionConfigFileV1();
  return {
    baselineRuntimeMode: resolveRuntimeModeEnvV1(
      process.env.DINK_ANNUAL_REPORT_SPEED_BASELINE_MODE ??
        fileConfig?.baselineRuntimeMode,
      "ai_overdrive",
    ),
    candidateRuntimeMode: resolveRuntimeModeEnvV1(
      process.env.DINK_ANNUAL_REPORT_SPEED_CANDIDATE_MODE ??
        fileConfig?.candidateRuntimeMode,
      "default",
    ),
    enabled: fileConfig?.enabled ?? isRegressionEnabledV1(),
    outputDirectory:
      process.env.DINK_ANNUAL_REPORT_SPEED_OUTPUT_DIR ??
      fileConfig?.outputDirectory ??
      path.join(REPO_ROOT_DIRECTORY_V1, "output", "annual-report-speed-regression"),
    pdfPath: process.env.DINK_ANNUAL_REPORT_PDF_PATH ?? fileConfig?.pdfPath,
  };
}

function readRegressionConfigFileV1(): RegressionConfigFileV1 | null {
  if (!existsSync(REGRESSION_CONFIG_FILE_PATH_V1)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      readFileSync(REGRESSION_CONFIG_FILE_PATH_V1, "utf8"),
    ) as RegressionConfigFileV1;
    return parsed;
  } catch {
    return null;
  }
}

function buildEnvForRuntimeModeV1(runtimeMode: RuntimeModeV1): Env {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.AI_PROVIDER_API_KEY;
  return {
    AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY,
    ANNUAL_REPORT_AI_OVERDRIVE_ENABLED:
      runtimeMode === "ai_overdrive" ? "true" : undefined,
    APP_BASE_URL: "http://localhost:5173",
    AUTH_TOKEN_HMAC_SECRET: "local-annual-report-speed-regression",
    DB: {} as Env["DB"],
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? apiKey,
    GEMINI_FAST_MODEL: process.env.GEMINI_FAST_MODEL,
    GEMINI_THINKING_MODEL: process.env.GEMINI_THINKING_MODEL,
  };
}

function countStatementValuesV1(
  lines: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"],
) {
  return lines.reduce((count: number, line) => {
    const hasCurrent = typeof line.currentYearValue === "number";
    const hasPrior = typeof line.priorYearValue === "number";
    return count + (hasCurrent ? 1 : 0) + (hasPrior ? 1 : 0);
  }, 0);
}

function sumEvidenceCountV1(...evidenceCollections: Array<{ evidence: Array<unknown> } | undefined>) {
  return evidenceCollections.reduce(
    (count, collection) => count + (collection?.evidence.length ?? 0),
    0,
  );
}

function collectExtractionMetricsV1(extraction: AnnualReportExtractionPayloadV1) {
  const taxDeep = extraction.taxDeep;
  if (!taxDeep) {
    return {
      accountingStandard: extraction.fields.accountingStandard.value,
      autoDetectedFieldCount: extraction.summary.autoDetectedFieldCount,
      balanceRowCount: 0,
      balanceValueCount: 0,
      companyName: extraction.fields.companyName.value,
      depreciationAssetAreas: 0,
      documentWarningCount: extraction.documentWarnings.length,
      groupContributionNotes: 0,
      incomeRowCount: 0,
      incomeValueCount: 0,
      interestNotes: 0,
      leasingNotes: 0,
      noteEvidenceCount: 0,
      organizationNumber: extraction.fields.organizationNumber.value,
      pensionNotes: 0,
      priorYearComparatives: 0,
      profitBeforeTax: extraction.fields.profitBeforeTax.value,
      reserveMovementCount: 0,
      reserveNotes: 0,
      shareholdingNotes: 0,
      statementUnit: undefined,
      taxExpenseNotes: 0,
      totalNarrativeNotes: 0,
      totalStatementRows: 0,
      totalStatementValues: 0,
    };
  }
  const totalNarrativeNotes =
    taxDeep.reserveContext.notes.length +
    taxDeep.netInterestContext.notes.length +
    taxDeep.pensionContext.notes.length +
    (taxDeep.taxExpenseContext?.notes.length ?? 0) +
    taxDeep.leasingContext.notes.length +
    taxDeep.groupContributionContext.notes.length +
    taxDeep.shareholdingContext.notes.length;
  const totalNoteEvidence = sumEvidenceCountV1(
    taxDeep.depreciationContext,
    taxDeep.assetMovements,
    taxDeep.reserveContext,
    taxDeep.netInterestContext,
    taxDeep.pensionContext,
    taxDeep.taxExpenseContext,
    taxDeep.leasingContext,
    taxDeep.groupContributionContext,
    taxDeep.shareholdingContext,
  );

  return {
    accountingStandard: extraction.fields.accountingStandard.value,
    autoDetectedFieldCount: extraction.summary.autoDetectedFieldCount,
    balanceRowCount: taxDeep.ink2rExtracted.balanceSheet.length,
    balanceValueCount: countStatementValuesV1(taxDeep.ink2rExtracted.balanceSheet),
    companyName: extraction.fields.companyName.value,
    depreciationAssetAreas: taxDeep.depreciationContext.assetAreas.length,
    documentWarningCount: extraction.documentWarnings.length,
    groupContributionNotes: taxDeep.groupContributionContext.notes.length,
    incomeRowCount: taxDeep.ink2rExtracted.incomeStatement.length,
    incomeValueCount: countStatementValuesV1(taxDeep.ink2rExtracted.incomeStatement),
    interestNotes: taxDeep.netInterestContext.notes.length,
    leasingNotes: taxDeep.leasingContext.notes.length,
    noteEvidenceCount: totalNoteEvidence,
    organizationNumber: extraction.fields.organizationNumber.value,
    pensionNotes: taxDeep.pensionContext.notes.length,
    priorYearComparatives: taxDeep.priorYearComparatives.length,
    profitBeforeTax: extraction.fields.profitBeforeTax.value,
    reserveMovementCount: taxDeep.reserveContext.movements.length,
    reserveNotes: taxDeep.reserveContext.notes.length,
    shareholdingNotes: taxDeep.shareholdingContext.notes.length,
    statementUnit: taxDeep.ink2rExtracted.statementUnit,
    taxExpenseNotes: taxDeep.taxExpenseContext?.notes.length ?? 0,
    totalNarrativeNotes,
    totalStatementRows:
      taxDeep.ink2rExtracted.incomeStatement.length +
      taxDeep.ink2rExtracted.balanceSheet.length,
    totalStatementValues:
      countStatementValuesV1(taxDeep.ink2rExtracted.incomeStatement) +
      countStatementValuesV1(taxDeep.ink2rExtracted.balanceSheet),
  };
}

function collectTaxAnalysisMetricsV1(taxAnalysis: AnnualReportTaxAnalysisPayloadV1) {
  return {
    accountingStandardStatus: taxAnalysis.accountingStandardAssessment.status,
    findingCount: taxAnalysis.findings.length,
    highSeverityFindingCount: taxAnalysis.findings.filter(
      (finding) => finding.severity === "high",
    ).length,
    missingInformationCount: taxAnalysis.missingInformation.length,
    nextActionCount: taxAnalysis.recommendedNextActions.length,
    usedFallback: taxAnalysis.aiRun?.usedFallback ?? false,
  };
}

function collectCoreFactDifferencesV1(input: {
  baseline: RegressionRunV1;
  candidate: RegressionRunV1;
}) {
  const differences: string[] = [];
  const comparableFields: Array<
    keyof Pick<
      ReturnType<typeof collectExtractionMetricsV1>,
      | "companyName"
      | "organizationNumber"
      | "accountingStandard"
      | "profitBeforeTax"
      | "statementUnit"
    >
  > = [
    "companyName",
    "organizationNumber",
    "accountingStandard",
    "profitBeforeTax",
    "statementUnit",
  ];

  for (const field of comparableFields) {
    const baselineValue = input.baseline.metrics[field];
    const candidateValue = input.candidate.metrics[field];
    if (baselineValue === undefined || baselineValue === null) {
      continue;
    }
    if (candidateValue !== baselineValue) {
      differences.push(
        `${field} changed from ${String(baselineValue)} to ${String(candidateValue)}`,
      );
    }
  }

  return differences;
}

function collectReliabilityRegressionsV1(input: {
  baseline: RegressionRunV1;
  candidate: RegressionRunV1;
}) {
  const regressions = collectCoreFactDifferencesV1(input);
  const baselineCoverageScore =
    input.baseline.taxMetrics.findingCount + input.baseline.taxMetrics.nextActionCount;
  const candidateCoverageScore =
    input.candidate.taxMetrics.findingCount + input.candidate.taxMetrics.nextActionCount;

  if (
    input.candidate.metrics.totalStatementValues <
    input.baseline.metrics.totalStatementValues -
      REGRESSION_THRESHOLDS_V1.allowedStatementValueDrop
  ) {
    regressions.push(
      `statement values dropped from ${input.baseline.metrics.totalStatementValues} to ${input.candidate.metrics.totalStatementValues}`,
    );
  }

  if (
    input.candidate.metrics.totalStatementRows <
    input.baseline.metrics.totalStatementRows -
      REGRESSION_THRESHOLDS_V1.allowedStatementRowDrop
  ) {
    regressions.push(
      `statement rows dropped from ${input.baseline.metrics.totalStatementRows} to ${input.candidate.metrics.totalStatementRows}`,
    );
  }

  if (
    input.candidate.metrics.totalNarrativeNotes <
    input.baseline.metrics.totalNarrativeNotes -
      REGRESSION_THRESHOLDS_V1.allowedNarrativeNoteDrop
  ) {
    regressions.push(
      `narrative note coverage dropped from ${input.baseline.metrics.totalNarrativeNotes} to ${input.candidate.metrics.totalNarrativeNotes}`,
    );
  }

  if (
    input.candidate.metrics.noteEvidenceCount <
    input.baseline.metrics.noteEvidenceCount -
      REGRESSION_THRESHOLDS_V1.allowedNoteEvidenceDrop
  ) {
    regressions.push(
      `note evidence coverage dropped from ${input.baseline.metrics.noteEvidenceCount} to ${input.candidate.metrics.noteEvidenceCount}`,
    );
  }

  if (
    candidateCoverageScore <
    baselineCoverageScore - REGRESSION_THRESHOLDS_V1.allowedFindingAndActionDrop
  ) {
    regressions.push(
      `forensic coverage score dropped from ${baselineCoverageScore} to ${candidateCoverageScore}`,
    );
  }

  if (
    input.baseline.taxMetrics.accountingStandardStatus === "aligned" &&
    input.candidate.taxMetrics.accountingStandardStatus !== "aligned"
  ) {
    regressions.push(
      `accounting standard assessment regressed from aligned to ${input.candidate.taxMetrics.accountingStandardStatus}`,
    );
  }

  return regressions;
}

function writeRegressionArtifactsV1(input: {
  baseline: RegressionRunV1;
  candidate: RegressionRunV1;
  outputDirectory: string;
  pdfPath: string;
  reliabilityRegressions: string[];
}) {
  mkdirSync(input.outputDirectory, { recursive: true });
  const baseName = path.basename(input.pdfPath, path.extname(input.pdfPath));
  const timeStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = `${baseName}-${timeStamp}`;
  const baselineExtractionPath = path.join(
    input.outputDirectory,
    `${prefix}.${input.baseline.runtimeMode}.extraction.json`,
  );
  const candidateExtractionPath = path.join(
    input.outputDirectory,
    `${prefix}.${input.candidate.runtimeMode}.extraction.json`,
  );
  const baselineTaxPath = path.join(
    input.outputDirectory,
    `${prefix}.${input.baseline.runtimeMode}.tax-analysis.json`,
  );
  const candidateTaxPath = path.join(
    input.outputDirectory,
    `${prefix}.${input.candidate.runtimeMode}.tax-analysis.json`,
  );
  const reportPath = path.join(input.outputDirectory, `${prefix}.summary.json`);

  writeFileSync(
    baselineExtractionPath,
    `${JSON.stringify(input.baseline.extraction, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    candidateExtractionPath,
    `${JSON.stringify(input.candidate.extraction, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    baselineTaxPath,
    `${JSON.stringify(input.baseline.taxAnalysis, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    candidateTaxPath,
    `${JSON.stringify(input.candidate.taxAnalysis, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        candidateRuntimeMode: input.candidate.runtimeMode,
        baselineRuntimeMode: input.baseline.runtimeMode,
        comparison: {
          candidateMinusBaselineDurationMs:
            input.candidate.durationMs - input.baseline.durationMs,
          candidateMinusBaselineFindingCount:
            input.candidate.taxMetrics.findingCount -
            input.baseline.taxMetrics.findingCount,
          candidateMinusBaselineNoteEvidence:
            input.candidate.metrics.noteEvidenceCount -
            input.baseline.metrics.noteEvidenceCount,
          candidateMinusBaselineNoteTexts:
            input.candidate.metrics.totalNarrativeNotes -
            input.baseline.metrics.totalNarrativeNotes,
          candidateMinusBaselineStatementRows:
            input.candidate.metrics.totalStatementRows -
            input.baseline.metrics.totalStatementRows,
          candidateMinusBaselineStatementValues:
            input.candidate.metrics.totalStatementValues -
            input.baseline.metrics.totalStatementValues,
          candidateMinusBaselineNextActions:
            input.candidate.taxMetrics.nextActionCount -
            input.baseline.taxMetrics.nextActionCount,
          reliabilityRegressions: input.reliabilityRegressions,
        },
        outputFiles: {
          baselineExtractionPath,
          baselineTaxPath,
          candidateExtractionPath,
          candidateTaxPath,
        },
        pdfPath: input.pdfPath,
        runs: {
          baseline: {
            durationMs: input.baseline.durationMs,
            extractionMetrics: input.baseline.metrics,
            taxAnalysisMetrics: input.baseline.taxMetrics,
          },
          candidate: {
            durationMs: input.candidate.durationMs,
            extractionMetrics: input.candidate.metrics,
            taxAnalysisMetrics: input.candidate.taxMetrics,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return reportPath;
}

async function runWorkflowForModeV1(input: {
  fileBytes: Uint8Array;
  fileName: string;
  runtimeMode: RuntimeModeV1;
}) {
  const env = buildEnvForRuntimeModeV1(input.runtimeMode);
  const deps = createAnnualReportExtractionDepsV1(env);
  if (!deps.extractAnnualReport || !deps.analyzeAnnualReportTax) {
    throw new Error("Annual-report extraction dependencies were not fully configured.");
  }
  const start = performance.now();
  const extractionResult = await deps.extractAnnualReport({
    fileBytes: input.fileBytes,
    fileName: input.fileName,
    fileType: "pdf",
    policyVersion: "annual-report-speed-regression.v1",
  });
  const extractionDurationMs = Math.round(performance.now() - start);

  if (!extractionResult.ok) {
    throw new Error(
      `[${input.runtimeMode}] extraction failed: ${extractionResult.error.message}`,
    );
  }

  const taxStart = performance.now();
  const taxAnalysisResult = await deps.analyzeAnnualReportTax({
    extraction: extractionResult.extraction,
    extractionArtifactId: `local-${input.runtimeMode}-${Date.now()}`,
    policyVersion: "annual-report-tax-analysis.v1",
    sourceDocument: {
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      fileType: "pdf",
    },
  });
  const taxDurationMs = Math.round(performance.now() - taxStart);

  if (!taxAnalysisResult.ok) {
    throw new Error(
      `[${input.runtimeMode}] forensic analysis failed: ${taxAnalysisResult.error.message}`,
    );
  }

  return {
    durationMs: extractionDurationMs + taxDurationMs,
    extraction: extractionResult.extraction,
    metrics: collectExtractionMetricsV1(extractionResult.extraction),
    runtimeMode: input.runtimeMode,
    taxAnalysis: taxAnalysisResult.taxAnalysis,
    taxMetrics: collectTaxAnalysisMetricsV1(taxAnalysisResult.taxAnalysis),
  } satisfies RegressionRunV1;
}

describe("annual report speed regression", () => {
  const regressionConfig = resolveRegressionConfigV1();
  const regressionTest = regressionConfig.enabled ? it : it.skip;

  regressionTest(
    "keeps reliability while measuring a faster annual-report runtime on a real PDF",
    async () => {
      expect(regressionConfig.pdfPath).toBeTruthy();
      const pdfPath = path.resolve(regressionConfig.pdfPath as string);
      const fileBytes = Uint8Array.from(readFileSync(pdfPath));
      const baseline = await runWorkflowForModeV1({
        fileBytes,
        fileName: path.basename(pdfPath),
        runtimeMode: regressionConfig.baselineRuntimeMode,
      });
      const candidate = await runWorkflowForModeV1({
        fileBytes,
        fileName: path.basename(pdfPath),
        runtimeMode: regressionConfig.candidateRuntimeMode,
      });
      const reliabilityRegressions = collectReliabilityRegressionsV1({
        baseline,
        candidate,
      });
      const reportPath = writeRegressionArtifactsV1({
        baseline,
        candidate,
        outputDirectory: regressionConfig.outputDirectory,
        pdfPath,
        reliabilityRegressions,
      });

      expect(
        reliabilityRegressions,
        `Reliability regression report written to ${reportPath}`,
      ).toEqual([]);
    },
    10 * 60 * 1000,
  );
});
