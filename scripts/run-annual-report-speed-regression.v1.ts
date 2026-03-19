import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

import { createAnnualReportExtractionDepsV1 } from "../src/server/workflow/workflow-deps.v1.ts";
import type {
  AnnualReportExtractionPayloadV1,
  AnnualReportTaxDeepExtractionV1,
} from "../src/shared/contracts/annual-report-extraction.v1.ts";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../src/shared/contracts/annual-report-tax-analysis.v1.ts";
import type { Env } from "../src/shared/types/env.ts";

type RuntimeModeV1 = "default" | "ai_overdrive";

type RegressionRunV1 = {
  durationMs: number;
  extraction: AnnualReportExtractionPayloadV1;
  metrics: ReturnType<typeof collectExtractionMetricsV1>;
  runtimeMode: RuntimeModeV1;
  taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
  taxMetrics: ReturnType<typeof collectTaxAnalysisMetricsV1>;
};

type RegressionConfigV1 = {
  baselineRuntimeMode: RuntimeModeV1;
  candidateRuntimeMode: RuntimeModeV1;
  outputDirectory: string;
  pdfPath: string;
};

const REGRESSION_THRESHOLDS_V1 = {
  allowedFindingAndActionDrop: 1,
  allowedNoteEvidenceDrop: 2,
  allowedNarrativeNoteDrop: 1,
  allowedStatementRowDrop: 2,
  allowedStatementValueDrop: 2,
} as const;

function parseDotEnvLikeFileV1(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const values: Record<string, string> = {};
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length === 0) {
      continue;
    }
    values[key] = value;
  }

  return values;
}

function resolveRuntimeModeV1(
  value: string | undefined,
  fallback: RuntimeModeV1,
): RuntimeModeV1 {
  return value === "default" || value === "ai_overdrive" ? value : fallback;
}

function resolveConfigV1(repoRoot: string): RegressionConfigV1 {
  const dotEnvValues = parseDotEnvLikeFileV1(path.join(repoRoot, ".dev.vars"));
  const readValue = (key: string): string | undefined =>
    process.env[key] ?? dotEnvValues[key];
  const pdfPath = readValue("DINK_ANNUAL_REPORT_PDF_PATH");
  if (!pdfPath) {
    throw new Error(
      "Missing DINK_ANNUAL_REPORT_PDF_PATH. Set it in the environment or .dev.vars before running the regression.",
    );
  }

  return {
    baselineRuntimeMode: resolveRuntimeModeV1(
      readValue("DINK_ANNUAL_REPORT_SPEED_BASELINE_MODE"),
      "ai_overdrive",
    ),
    candidateRuntimeMode: resolveRuntimeModeV1(
      readValue("DINK_ANNUAL_REPORT_SPEED_CANDIDATE_MODE"),
      "default",
    ),
    outputDirectory:
      readValue("DINK_ANNUAL_REPORT_SPEED_OUTPUT_DIR") ??
      path.join(repoRoot, "output", "annual-report-speed-regression"),
    pdfPath,
  };
}

function buildEnvForRuntimeModeV1(input: {
  dotEnvValues: Record<string, string>;
  runtimeMode: RuntimeModeV1;
}): Env {
  const readValue = (key: string): string | undefined =>
    process.env[key] ?? input.dotEnvValues[key];
  return {
    AI_PROVIDER_API_KEY: readValue("AI_PROVIDER_API_KEY"),
    ANNUAL_REPORT_AI_OVERDRIVE_ENABLED:
      input.runtimeMode === "ai_overdrive" ? "true" : undefined,
    APP_BASE_URL: readValue("APP_BASE_URL") ?? "http://localhost:5173",
    AUTH_TOKEN_HMAC_SECRET:
      readValue("AUTH_TOKEN_HMAC_SECRET") ?? "local-annual-report-speed-regression",
    DB: {} as Env["DB"],
    DEV_AUTH_BYPASS_ENABLED: readValue("DEV_AUTH_BYPASS_ENABLED"),
    QWEN_API_KEY: readValue("QWEN_API_KEY"),
    QWEN_FAST_MODEL: readValue("QWEN_FAST_MODEL"),
    QWEN_THINKING_MODEL: readValue("QWEN_THINKING_MODEL"),
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

function sumEvidenceCountV1(
  ...evidenceCollections: Array<{ evidence: Array<unknown> } | undefined>
) {
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
  const comparableFields = [
    "companyName",
    "organizationNumber",
    "accountingStandard",
    "profitBeforeTax",
    "statementUnit",
  ] as const;

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
  const reportPath = path.join(input.outputDirectory, `${prefix}.summary.json`);

  const writeJson = (suffix: string, value: unknown) => {
    const targetPath = path.join(input.outputDirectory, `${prefix}.${suffix}.json`);
    writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return targetPath;
  };

  const baselineExtractionPath = writeJson(
    `${input.baseline.runtimeMode}.extraction`,
    input.baseline.extraction,
  );
  const candidateExtractionPath = writeJson(
    `${input.candidate.runtimeMode}.extraction`,
    input.candidate.extraction,
  );
  const baselineTaxPath = writeJson(
    `${input.baseline.runtimeMode}.tax-analysis`,
    input.baseline.taxAnalysis,
  );
  const candidateTaxPath = writeJson(
    `${input.candidate.runtimeMode}.tax-analysis`,
    input.candidate.taxAnalysis,
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
          candidateMinusBaselineNextActions:
            input.candidate.taxMetrics.nextActionCount -
            input.baseline.taxMetrics.nextActionCount,
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
  dotEnvValues: Record<string, string>;
  fileBytes: Uint8Array;
  fileName: string;
  runtimeMode: RuntimeModeV1;
}) {
  const env = buildEnvForRuntimeModeV1({
    dotEnvValues: input.dotEnvValues,
    runtimeMode: input.runtimeMode,
  });
  const deps = createAnnualReportExtractionDepsV1(env);
  if (!deps.extractAnnualReport || !deps.analyzeAnnualReportTax) {
    throw new Error("Annual-report extraction dependencies were not fully configured.");
  }

  const extractionStart = performance.now();
  const extractionResult = await deps.extractAnnualReport({
    fileBytes: input.fileBytes,
    fileName: input.fileName,
    fileType: "pdf",
    policyVersion: "annual-report-speed-regression.v1",
  });
  const extractionDurationMs = Math.round(performance.now() - extractionStart);
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

async function main() {
  const repoRoot = process.cwd();
  const dotEnvValues = parseDotEnvLikeFileV1(path.join(repoRoot, ".dev.vars"));
  const config = resolveConfigV1(repoRoot);
  const pdfPath = path.resolve(config.pdfPath);
  const fileBytes = Uint8Array.from(readFileSync(pdfPath));
  const fileName = path.basename(pdfPath);

  process.stdout.write(
    `Running annual-report speed regression on ${fileName} with baseline=${config.baselineRuntimeMode} and candidate=${config.candidateRuntimeMode}.\n`,
  );

  const baseline = await runWorkflowForModeV1({
    dotEnvValues,
    fileBytes,
    fileName,
    runtimeMode: config.baselineRuntimeMode,
  });
  const candidate = await runWorkflowForModeV1({
    dotEnvValues,
    fileBytes,
    fileName,
    runtimeMode: config.candidateRuntimeMode,
  });
  const reliabilityRegressions = collectReliabilityRegressionsV1({
    baseline,
    candidate,
  });
  const reportPath = writeRegressionArtifactsV1({
    baseline,
    candidate,
    outputDirectory: config.outputDirectory,
    pdfPath,
    reliabilityRegressions,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        baselineDurationMs: baseline.durationMs,
        candidateDurationMs: candidate.durationMs,
        regressions: reliabilityRegressions,
        reportPath,
      },
      null,
      2,
    )}\n`,
  );

  if (reliabilityRegressions.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
