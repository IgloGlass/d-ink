import { createD1AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import { createD1AnnualReportProcessingRunRepositoryV1 } from "../../db/repositories/annual-report-processing-run.repository.v1";
import { createD1AnnualReportUploadSessionRepositoryV1 } from "../../db/repositories/annual-report-upload-session.repository.v1";
import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import { createD1CommentsRepositoryV1 } from "../../db/repositories/comments.repository.v1";
import { createD1CompanyRepositoryV1 } from "../../db/repositories/company.repository.v1";
import { createD1MappingPreferenceRepositoryV1 } from "../../db/repositories/mapping-preference.repository.v1";
import { createD1TasksRepositoryV1 } from "../../db/repositories/tasks.repository.v1";
import { createD1TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import { createD1WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import type { Env } from "../../shared/types/env";
import type { AnnualReportProcessingRunStatusV1 } from "../../shared/contracts/annual-report-processing-run.v1";
import {
  type AnnualReportAmountUnitV1,
  type AnnualReportRuntimeMetadataV1,
  type AnnualReportTaxDeepExtractionV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../shared/contracts/annual-report-tax-analysis.v1";
import type { AiRunMetadataV1 } from "../../shared/contracts/ai-run.v1";
import type { ReconciliationResultPayloadV1 } from "../../shared/contracts/reconciliation.v1";
import type { TaxAdjustmentAiProposalDecisionV1 } from "../../shared/contracts/tax-adjustment-ai.v1";
import type { TrialBalanceNormalizedV1 } from "../../shared/contracts/trial-balance.v1";
import { generateTaxAdjustmentsFromAiProposalsV1, generateTaxAdjustmentsV1 } from "../adjustments/tax-adjustments-engine.v1";
import type { GenerateTaxAdjustmentsInputV1 } from "../adjustments/tax-adjustments-engine.v1";
import {
  projectAnnualReportMappingContextV1,
  projectAnnualReportTaxContextV1,
} from "../ai/context/annual-report-tax-context.v1";
import {
  prepareAnnualReportDocumentV1,
} from "../ai/document-prep/annual-report-document.v1";
import { executeAnnualReportAnalysisV1 } from "../ai/modules/annual-report-analysis/executor.v1";
import { loadAnnualReportAnalysisModuleConfigV1 } from "../ai/modules/annual-report-analysis/loader.v1";
import { executeAnnualReportTaxAnalysisV1 } from "../ai/modules/annual-report-tax-analysis/executor.v1";
import { loadAnnualReportTaxAnalysisModuleConfigV1 } from "../ai/modules/annual-report-tax-analysis/loader.v1";
import { executeMappingDecisionsModelV1 } from "../ai/modules/mapping-decisions/executor.v1";
import { loadMappingDecisionsModuleConfigV1 } from "../ai/modules/mapping-decisions/loader.v1";
import { executeMappingReviewModelV1 } from "../ai/modules/mapping-review/executor.v1";
import { loadMappingReviewModuleConfigV1 } from "../ai/modules/mapping-review/loader.v1";
import { loadTaxAdjustmentsDepreciationDifferencesBasicModuleConfigV1 } from "../ai/modules/tax-adjustments-depreciation-differences-basic/loader.v1";
import {
  TAX_ADJUSTMENTS_DEPRECIATION_SYSTEM_PROMPT_V1,
  TAX_ADJUSTMENTS_DEPRECIATION_USER_PROMPT_V1,
} from "../ai/modules/tax-adjustments-depreciation-differences-basic/prompt-text.v1";
import { loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1 } from "../ai/modules/tax-adjustments-non-deductible-expenses/loader.v1";
import {
  TAX_ADJUSTMENTS_NON_DEDUCTIBLE_SYSTEM_PROMPT_V1,
  TAX_ADJUSTMENTS_NON_DEDUCTIBLE_USER_PROMPT_V1,
} from "../ai/modules/tax-adjustments-non-deductible-expenses/prompt-text.v1";
import { loadTaxAdjustmentsRepresentationEntertainmentModuleConfigV1 } from "../ai/modules/tax-adjustments-representation-entertainment/loader.v1";
import {
  TAX_ADJUSTMENTS_REPRESENTATION_SYSTEM_PROMPT_V1,
  TAX_ADJUSTMENTS_REPRESENTATION_USER_PROMPT_V1,
} from "../ai/modules/tax-adjustments-representation-entertainment/prompt-text.v1";
import {
  executeTaxAdjustmentSubmoduleV1,
  projectTaxAdjustmentCandidatesV1,
} from "../ai/modules/tax-adjustments-shared/executor.v1";
import { getGeminiApiKeyV1, getGeminiModelConfigV1 } from "../ai/providers/gemini-config.v1";
import {
  toBase64V1,
} from "../ai/providers/gemini-client.v1";
import type { AnnualReportExtractionDepsV1 } from "./annual-report-extraction.v1";
import type { AnnualReportProcessingDepsV1 } from "./annual-report-processing.v1";
import type {
  AuthMagicLinkDepsV1,
  ResolveSessionPrincipalDepsV1,
} from "./auth-magic-link.v1";
import type { CollaborationDepsV1 } from "./collaboration.v1";
import type { CompanyLifecycleDepsV1 } from "./company-lifecycle.v1";
import type { MappingOverrideDepsV1 } from "./mapping-override.v1";
import type { MappingReviewDepsV1 } from "./mapping-review.v1";
import type { TaxCoreWorkflowDepsV1 } from "./tax-core-workflow.v1";
import type { TrialBalancePipelineRunDepsV1 } from "./trial-balance-pipeline-run.v1";
import type { WorkspaceLifecycleDepsV1 } from "./workspace-lifecycle.v1";
import { generateDeterministicMappingDecisionsV1 } from "../mapping/deterministic-mapping.v1";
import { parseAnnualReportExtractionV1 } from "../parsing/annual-report-extractor.v1";
import { prepareAnnualReportPdfRoutingV1 } from "../parsing/annual-report-page-routing.v1";
import { parseAnnualReportSourceTextForAiV1 } from "../parsing/annual-report-source-text.v1";
import { parseAiRunMetadataV1 } from "../../shared/contracts/ai-run.v1";

const ANNUAL_REPORT_EXTRACTION_ENGINE_VERSION_V1 =
  "annual-report-deep-extraction.v3";
const ANNUAL_REPORT_SOURCE_PARSING_TIMEOUT_MS_V1 = 20_000;

export type AnnualReportProcessingRuntimeModeV1 =
  | "queued"
  | "inline_fallback"
  | "unavailable";

export function resolveAnnualReportProcessingRuntimeV1(env: Env): {
  available: boolean;
  inlineFallbackEnabled: boolean;
  missingBindings: Array<"ANNUAL_REPORT_FILES" | "ANNUAL_REPORT_QUEUE">;
  mode: AnnualReportProcessingRuntimeModeV1;
} {
  const missingBindings: Array<"ANNUAL_REPORT_FILES" | "ANNUAL_REPORT_QUEUE"> =
    [];
  if (!env.ANNUAL_REPORT_FILES) {
    missingBindings.push("ANNUAL_REPORT_FILES");
  }
  if (!env.ANNUAL_REPORT_QUEUE) {
    missingBindings.push("ANNUAL_REPORT_QUEUE");
  }

  const devAuthBypassEnabled =
    (env.DEV_AUTH_BYPASS_ENABLED ?? "").trim().toLowerCase() === "true";
  let localAppBaseUrl = false;
  try {
    const host = new URL(env.APP_BASE_URL).hostname.toLowerCase();
    localAppBaseUrl =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    localAppBaseUrl = false;
  }

  const inlineFallbackEnabled = devAuthBypassEnabled && localAppBaseUrl;
  const queuedAvailable = missingBindings.length === 0;
  const mode: AnnualReportProcessingRuntimeModeV1 = queuedAvailable
    ? "queued"
    : inlineFallbackEnabled
      ? "inline_fallback"
      : "unavailable";

  return {
    available: mode !== "unavailable",
    inlineFallbackEnabled,
    missingBindings,
    mode,
  };
}

export function buildAnnualReportRuntimeMetadataV1(
  env: Env,
): AnnualReportRuntimeMetadataV1 {
  const modelConfig = getGeminiModelConfigV1(env);

  return {
    extractionEngineVersion: ANNUAL_REPORT_EXTRACTION_ENGINE_VERSION_V1,
    runtimeFingerprint: [
      ANNUAL_REPORT_EXTRACTION_ENGINE_VERSION_V1,
      modelConfig.fastModel,
      modelConfig.thinkingModel,
    ].join("|"),
  };
}

function isEnvFlagEnabledV1(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function resolveAnnualReportAnalysisRuntimeModeV1(
  env: Env,
): "default" | "ai_overdrive" {
  return isEnvFlagEnabledV1(env.ANNUAL_REPORT_AI_OVERDRIVE_ENABLED)
    ? "ai_overdrive"
    : "default";
}

function stampAnnualReportEngineMetadataV1(input: {
  extraction: ReturnType<typeof parseAnnualReportExtractionPayloadV1>;
  runtimeMetadata: AnnualReportRuntimeMetadataV1;
}): ReturnType<typeof parseAnnualReportExtractionPayloadV1> {
  return parseAnnualReportExtractionPayloadV1({
    ...input.extraction,
    engineMetadata: input.runtimeMetadata,
  });
}

function buildAnnualReportFallbackExtractionV1(input: {
  diagnosticWarnings?: string[];
  extractionResult: Extract<
    Awaited<ReturnType<typeof parseAnnualReportExtractionV1>>,
    { ok: true }
  >;
  fallbackReason: string;
  generatedAt: string;
  modelTier: "fast" | "thinking";
  modelName: string;
  runtimeMetadata: AnnualReportRuntimeMetadataV1;
}): Extract<Awaited<ReturnType<typeof parseAnnualReportExtractionV1>>, { ok: true }> {
  const existingWarnings = input.extractionResult.extraction.documentWarnings ?? [];

  return {
    ok: true,
    extraction: stampAnnualReportEngineMetadataV1({
      runtimeMetadata: input.runtimeMetadata,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...input.extractionResult.extraction,
        documentWarnings: [
          ...(input.diagnosticWarnings ?? []),
          ...existingWarnings,
          `Gemini extraction fallback used: ${input.fallbackReason}`,
        ],
        aiRun: parseAiRunMetadataV1({
          runId: crypto.randomUUID(),
          moduleId: "annual-report-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-analysis.prompts.v1",
          policyVersion: input.extractionResult.extraction.policyVersion,
          activePatchVersions: [],
          provider: "gemini",
          model: input.modelName,
          modelTier: input.modelTier,
          generatedAt: input.generatedAt,
          usedFallback: true,
        }),
      }),
    }),
  };
}

function createNeedsReviewFieldV1(): {
  confidence: number;
  status: "needs_review";
} {
  return {
    status: "needs_review",
    confidence: 0,
  };
}

function createEmptyAnnualReportTaxDeepV1(): AnnualReportTaxDeepExtractionV1 {
  return {
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
    taxExpenseContext: {
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
  };
}

function buildAnnualReportPdfDegradedFallbackExtractionV1(input: {
  diagnosticWarnings?: string[];
  fallbackReason: string;
  fileName: string;
  fileType: "pdf";
  generatedAt: string;
  modelTier: "fast" | "thinking";
  modelName: string;
  policyVersion: string;
  runtimeMetadata: AnnualReportRuntimeMetadataV1;
}): Extract<Awaited<ReturnType<typeof parseAnnualReportExtractionV1>>, { ok: true }> {
  return {
    ok: true,
    extraction: stampAnnualReportEngineMetadataV1({
      runtimeMetadata: input.runtimeMetadata,
      extraction: parseAnnualReportExtractionPayloadV1({
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: input.fileName,
        sourceFileType: input.fileType,
        policyVersion: input.policyVersion,
        fields: {
          companyName: createNeedsReviewFieldV1(),
          organizationNumber: createNeedsReviewFieldV1(),
          fiscalYearStart: createNeedsReviewFieldV1(),
          fiscalYearEnd: createNeedsReviewFieldV1(),
          accountingStandard: createNeedsReviewFieldV1(),
          profitBeforeTax: createNeedsReviewFieldV1(),
        },
        summary: {
          autoDetectedFieldCount: 0,
          needsReviewFieldCount: 6,
        },
        taxSignals: [],
        documentWarnings: [
          ...(input.diagnosticWarnings ?? []),
          "AI extraction was unavailable for this PDF. Manual review is required before continuing.",
          `AI extraction fallback used for PDF upload: ${input.fallbackReason}`,
        ],
        taxDeep: createEmptyAnnualReportTaxDeepV1(),
        aiRun: parseAiRunMetadataV1({
          runId: crypto.randomUUID(),
          moduleId: "annual-report-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-analysis.prompts.v1",
          policyVersion: input.policyVersion,
          activePatchVersions: [],
          provider: "gemini",
          model: input.modelName,
          modelTier: input.modelTier,
          generatedAt: input.generatedAt,
          usedFallback: true,
        }),
        confirmation: {
          isConfirmed: false,
        },
      }),
    }),
  };
}

async function buildAnnualReportExtractionFallbackV1(input: {
  diagnosticWarnings?: string[];
  fallbackReason: string;
  fileBytes: Uint8Array;
  fileName: string;
  fileType: "pdf" | "docx";
  generatedAt: string;
  modelTier: "fast" | "thinking";
  modelName: string;
  policyVersion: string;
  runtimeMetadata: AnnualReportRuntimeMetadataV1;
}): Promise<ReturnType<typeof parseAnnualReportExtractionV1>> {
  if (input.fileType === "pdf") {
    return buildAnnualReportPdfDegradedFallbackExtractionV1({
      diagnosticWarnings: input.diagnosticWarnings,
      fallbackReason: input.fallbackReason,
      fileName: input.fileName,
      fileType: input.fileType,
      generatedAt: input.generatedAt,
      modelTier: input.modelTier,
      modelName: input.modelName,
      policyVersion: input.policyVersion,
      runtimeMetadata: input.runtimeMetadata,
    });
  }

  const fallbackResult = await parseAnnualReportExtractionV1({
    fileBytes: input.fileBytes,
    fileName: input.fileName,
    fileType: input.fileType,
    policyVersion: input.policyVersion,
  });
  if (!fallbackResult.ok) {
    return fallbackResult;
  }

  return buildAnnualReportFallbackExtractionV1({
    diagnosticWarnings: input.diagnosticWarnings,
    extractionResult: fallbackResult,
    fallbackReason: input.fallbackReason,
    generatedAt: input.generatedAt,
    modelTier: input.modelTier,
    modelName: input.modelName,
    runtimeMetadata: input.runtimeMetadata,
  });
}

type AnnualReportAiDateFieldV1 = {
  confidence: number;
  normalizedValue?: string;
  page?: number;
  snippet?: string;
  status: "extracted" | "needs_review";
  valueText?: string;
};

const SWEDISH_MONTH_INDEX_V1: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  mars: 3,
  mar: 3,
  april: 4,
  apr: 4,
  maj: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  augusti: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function isValidIsoCalendarDateV1(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function padTwoDigitsV1(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIsoDateV1(year: number, month: number, day: number): string | null {
  const isoValue = `${year}-${padTwoDigitsV1(month)}-${padTwoDigitsV1(day)}`;
  return isValidIsoCalendarDateV1(isoValue) ? isoValue : null;
}

function normalizeSingleAnnualReportDateTokenV1(value: string): string | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return null;
  }
  if (isValidIsoCalendarDateV1(normalized)) {
    return normalized;
  }

  const compactIsoMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactIsoMatch) {
    return toIsoDateV1(
      Number(compactIsoMatch[1]),
      Number(compactIsoMatch[2]),
      Number(compactIsoMatch[3]),
    );
  }

  const yearFirstMatch = normalized.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (yearFirstMatch) {
    return toIsoDateV1(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3]),
    );
  }

  const dayFirstMatch = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirstMatch) {
    return toIsoDateV1(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1]),
    );
  }

  const swedishMonthMatch = normalized.match(
    /^(\d{1,2})\s+([a-zåäö]+)\s+(\d{4})$/,
  );
  if (swedishMonthMatch) {
    const month = SWEDISH_MONTH_INDEX_V1[swedishMonthMatch[2]];
    if (!month) {
      return null;
    }

    return toIsoDateV1(
      Number(swedishMonthMatch[3]),
      month,
      Number(swedishMonthMatch[1]),
    );
  }

  return null;
}

function extractAnnualReportDateCandidatesV1(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const candidates = new Set<string>();
  const normalizedValue = value
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-");

  const tokenPatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{4}[/.]\d{1,2}[/.]\d{1,2}\b/g,
    /\b\d{8}\b/g,
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/g,
    /\b\d{1,2}\s+[A-Za-zÅÄÖåäö]+\s+\d{4}\b/g,
  ];

  for (const pattern of tokenPatterns) {
    const matches = normalizedValue.match(pattern) ?? [];
    for (const match of matches) {
      const normalizedDate = normalizeSingleAnnualReportDateTokenV1(match);
      if (normalizedDate) {
        candidates.add(normalizedDate);
      }
    }
  }

  const directMatch = normalizeSingleAnnualReportDateTokenV1(normalizedValue);
  if (directMatch) {
    candidates.add(directMatch);
  }

  return [...candidates];
}

export function normalizeAnnualReportAiDateFieldV1(input: {
  field: AnnualReportAiDateFieldV1;
  fieldKey: "fiscalYearStart" | "fiscalYearEnd";
}): {
  field: {
    confidence: number;
    sourceSnippet?: {
      page?: number;
      snippet: string;
    };
    status: "extracted" | "needs_review";
    value?: string;
  };
  warning?: string;
} {
  const candidates = [
    ...extractAnnualReportDateCandidatesV1(input.field.normalizedValue),
    ...extractAnnualReportDateCandidatesV1(input.field.valueText),
    ...extractAnnualReportDateCandidatesV1(input.field.snippet),
  ];
  const resolvedValue =
    input.fieldKey === "fiscalYearStart"
      ? candidates[0]
      : candidates[candidates.length - 1];
  const sourceSnippet = input.field.snippet
    ? {
        snippet: input.field.snippet,
        page: input.field.page,
      }
    : undefined;

  if (resolvedValue) {
    return {
      field: {
        status: "extracted",
        confidence: input.field.confidence,
        value: resolvedValue,
        sourceSnippet,
      },
    };
  }

  if (!input.field.valueText && !input.field.snippet && !input.field.normalizedValue) {
    return {
      field: {
        status: "needs_review",
        confidence: 0,
        sourceSnippet,
      },
    };
  }

  return {
    field: {
      status: "needs_review",
      confidence: 0,
      sourceSnippet,
    },
    warning: `Gemini ${input.fieldKey} requires manual review: could not normalize "${input.field.valueText ?? input.field.normalizedValue ?? "unknown date"}" to ISO YYYY-MM-DD.`,
  };
}

function resolveAnnualReportAmountMultiplierV1(
  unit: AnnualReportAmountUnitV1 | undefined,
): number {
  if (unit === "msek") {
    return 1_000_000;
  }
  if (unit === "ksek") {
    return 1_000;
  }
  return 1;
}

function normalizeAnnualReportValueWithEvidenceV1<TValue extends {
  currency?: string;
  evidence: Array<unknown>;
  value?: number;
}>(value: TValue | undefined, multiplier: number): TValue | undefined {
  if (!value || value.value === undefined || multiplier === 1) {
    return value;
  }

  return {
    ...value,
    currency: "SEK",
    value: value.value * multiplier,
  };
}

function normalizeAnnualReportStatementLinesV1<
  TLine extends {
    currentYearValue?: number;
    priorYearValue?: number;
  },
>(lines: TLine[], multiplier: number): TLine[] {
  if (multiplier === 1) {
    return lines;
  }

  return lines.map((line) => ({
    ...line,
    currentYearValue:
      line.currentYearValue === undefined
        ? undefined
        : line.currentYearValue * multiplier,
    priorYearValue:
      line.priorYearValue === undefined
        ? undefined
        : line.priorYearValue * multiplier,
  }));
}

function normalizeAnnualReportAssetMovementLinesV1<
  TLine extends {
    acquisitions?: number;
    closingCarryingAmount?: number;
    depreciationForYear?: number;
    disposals?: number;
    impairmentForYear?: number;
    openingCarryingAmount?: number;
    priorYearClosingCarryingAmount?: number;
    priorYearOpeningCarryingAmount?: number;
  },
>(lines: TLine[], multiplier: number): TLine[] {
  if (multiplier === 1) {
    return lines;
  }

  return lines.map((line) => ({
    ...line,
    openingCarryingAmount:
      line.openingCarryingAmount === undefined
        ? undefined
        : line.openingCarryingAmount * multiplier,
    acquisitions:
      line.acquisitions === undefined
        ? undefined
        : line.acquisitions * multiplier,
    disposals:
      line.disposals === undefined ? undefined : line.disposals * multiplier,
    depreciationForYear:
      line.depreciationForYear === undefined
        ? undefined
        : line.depreciationForYear * multiplier,
    impairmentForYear:
      line.impairmentForYear === undefined
        ? undefined
        : line.impairmentForYear * multiplier,
    closingCarryingAmount:
      line.closingCarryingAmount === undefined
        ? undefined
        : line.closingCarryingAmount * multiplier,
    priorYearOpeningCarryingAmount:
      line.priorYearOpeningCarryingAmount === undefined
        ? undefined
        : line.priorYearOpeningCarryingAmount * multiplier,
    priorYearClosingCarryingAmount:
      line.priorYearClosingCarryingAmount === undefined
        ? undefined
        : line.priorYearClosingCarryingAmount * multiplier,
  }));
}

function normalizeAnnualReportReserveMovementLinesV1<
  TLine extends {
    closingBalance?: number;
    movementForYear?: number;
    openingBalance?: number;
    priorYearClosingBalance?: number;
  },
>(lines: TLine[], multiplier: number): TLine[] {
  if (multiplier === 1) {
    return lines;
  }

  return lines.map((line) => ({
    ...line,
    openingBalance:
      line.openingBalance === undefined ? undefined : line.openingBalance * multiplier,
    movementForYear:
      line.movementForYear === undefined
        ? undefined
        : line.movementForYear * multiplier,
    closingBalance:
      line.closingBalance === undefined ? undefined : line.closingBalance * multiplier,
    priorYearClosingBalance:
      line.priorYearClosingBalance === undefined
        ? undefined
        : line.priorYearClosingBalance * multiplier,
  }));
}

function sanitizeAnnualReportEvidenceReferenceV1(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }

  const candidate = value as {
    noteReference?: unknown;
    page?: unknown;
    section?: unknown;
    snippet?: unknown;
  };
  const snippet =
    typeof candidate.snippet === "string" && candidate.snippet.trim().length > 0
      ? candidate.snippet.trim()
      : undefined;
  if (!snippet) {
    return [];
  }

  return [
    {
      snippet,
      page:
        typeof candidate.page === "number" && Number.isInteger(candidate.page) && candidate.page > 0
          ? candidate.page
          : undefined,
      section:
        typeof candidate.section === "string" && candidate.section.trim().length > 0
          ? candidate.section.trim()
          : undefined,
      noteReference:
        typeof candidate.noteReference === "string" &&
        candidate.noteReference.trim().length > 0
          ? candidate.noteReference.trim()
          : undefined,
    },
  ];
}

function sanitizeAnnualReportValueWithEvidenceV1(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as {
    currency?: unknown;
    evidence?: unknown;
    page?: unknown;
    snippet?: unknown;
    value?: unknown;
  };
  const numericValue =
    typeof candidate.value === "number" && Number.isFinite(candidate.value)
      ? candidate.value
      : undefined;
  const evidence = Array.isArray(candidate.evidence)
    ? candidate.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
    : sanitizeAnnualReportEvidenceReferenceV1(candidate);

  if (
    numericValue === undefined &&
    evidence.length === 0 &&
    !(typeof candidate.currency === "string" && candidate.currency.trim().length > 0)
  ) {
    return undefined;
  }

  return {
    value: numericValue,
    currency:
      typeof candidate.currency === "string" && candidate.currency.trim().length > 0
        ? candidate.currency.trim()
        : undefined,
    evidence,
  };
}

function sanitizeAnnualReportNotesV1(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function sanitizeAnnualReportAssetLinesV1(values: unknown[]): AnnualReportTaxDeepExtractionV1["assetMovements"]["lines"] {
  return values
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value))
    .map((line) => ({
      assetArea:
        typeof line.assetArea === "string" && line.assetArea.trim().length > 0
          ? line.assetArea.trim()
          : "Unspecified asset area",
      openingCarryingAmount:
        typeof line.openingCarryingAmount === "number" && Number.isFinite(line.openingCarryingAmount)
          ? line.openingCarryingAmount
          : undefined,
      acquisitions:
        typeof line.acquisitions === "number" && Number.isFinite(line.acquisitions)
          ? line.acquisitions
          : undefined,
      disposals:
        typeof line.disposals === "number" && Number.isFinite(line.disposals)
          ? line.disposals
          : undefined,
      depreciationForYear:
        typeof line.depreciationForYear === "number" && Number.isFinite(line.depreciationForYear)
          ? line.depreciationForYear
          : undefined,
      impairmentForYear:
        typeof line.impairmentForYear === "number" && Number.isFinite(line.impairmentForYear)
          ? line.impairmentForYear
          : undefined,
      closingCarryingAmount:
        typeof line.closingCarryingAmount === "number" && Number.isFinite(line.closingCarryingAmount)
          ? line.closingCarryingAmount
          : undefined,
      priorYearOpeningCarryingAmount:
        typeof line.priorYearOpeningCarryingAmount === "number" &&
        Number.isFinite(line.priorYearOpeningCarryingAmount)
          ? line.priorYearOpeningCarryingAmount
          : undefined,
      priorYearClosingCarryingAmount:
        typeof line.priorYearClosingCarryingAmount === "number" &&
        Number.isFinite(line.priorYearClosingCarryingAmount)
          ? line.priorYearClosingCarryingAmount
          : undefined,
      evidence: Array.isArray(line.evidence)
        ? line.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    }));
}

function sanitizeAnnualReportReserveLinesV1(values: unknown[]): AnnualReportTaxDeepExtractionV1["reserveContext"]["movements"] {
  return values
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value))
    .map((line) => ({
      reserveType:
        typeof line.reserveType === "string" && line.reserveType.trim().length > 0
          ? line.reserveType.trim()
          : "Unspecified reserve",
      openingBalance:
        typeof line.openingBalance === "number" && Number.isFinite(line.openingBalance)
          ? line.openingBalance
          : undefined,
      movementForYear:
        typeof line.movementForYear === "number" && Number.isFinite(line.movementForYear)
          ? line.movementForYear
          : undefined,
      closingBalance:
        typeof line.closingBalance === "number" && Number.isFinite(line.closingBalance)
          ? line.closingBalance
          : undefined,
      priorYearClosingBalance:
        typeof line.priorYearClosingBalance === "number" && Number.isFinite(line.priorYearClosingBalance)
          ? line.priorYearClosingBalance
          : undefined,
      evidence: Array.isArray(line.evidence)
        ? line.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    }));
}

export function sanitizeAnnualReportTaxDeepV1(
  taxDeep: AnnualReportTaxDeepExtractionV1,
): AnnualReportTaxDeepExtractionV1 {
  const raw = taxDeep as unknown as Record<string, unknown>;
  const depreciationContext =
    typeof raw.depreciationContext === "object" && raw.depreciationContext !== null
      ? (raw.depreciationContext as Record<string, unknown>)
      : {};
  const assetMovements =
    typeof raw.assetMovements === "object" && raw.assetMovements !== null
      ? (raw.assetMovements as Record<string, unknown>)
      : {};
  const reserveContext =
    typeof raw.reserveContext === "object" && raw.reserveContext !== null
      ? (raw.reserveContext as Record<string, unknown>)
      : {};
  const netInterestContext =
    typeof raw.netInterestContext === "object" && raw.netInterestContext !== null
      ? (raw.netInterestContext as Record<string, unknown>)
      : {};
  const pensionContext =
    typeof raw.pensionContext === "object" && raw.pensionContext !== null
      ? (raw.pensionContext as Record<string, unknown>)
      : {};
  const taxExpenseContext =
    typeof raw.taxExpenseContext === "object" && raw.taxExpenseContext !== null
      ? (raw.taxExpenseContext as Record<string, unknown>)
      : undefined;
  const leasingContext =
    typeof raw.leasingContext === "object" && raw.leasingContext !== null
      ? (raw.leasingContext as Record<string, unknown>)
      : {};
  const groupContributionContext =
    typeof raw.groupContributionContext === "object" &&
    raw.groupContributionContext !== null
      ? (raw.groupContributionContext as Record<string, unknown>)
      : {};
  const shareholdingContext =
    typeof raw.shareholdingContext === "object" && raw.shareholdingContext !== null
      ? (raw.shareholdingContext as Record<string, unknown>)
      : {};

  return {
    ink2rExtracted: {
      statementUnit: taxDeep.ink2rExtracted.statementUnit,
      incomeStatement: taxDeep.ink2rExtracted.incomeStatement,
      balanceSheet: taxDeep.ink2rExtracted.balanceSheet,
    },
    depreciationContext: {
      assetAreas: sanitizeAnnualReportAssetLinesV1([
        ...(Array.isArray(depreciationContext.assetAreas)
          ? depreciationContext.assetAreas
          : []),
        ...(Array.isArray(depreciationContext.depreciationOnTangibleAndIntangibleAssets)
          ? depreciationContext.depreciationOnTangibleAndIntangibleAssets
          : []),
      ]),
      evidence: Array.isArray(depreciationContext.evidence)
        ? depreciationContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    },
    assetMovements: {
      lines: sanitizeAnnualReportAssetLinesV1([
        ...(Array.isArray(assetMovements.lines) ? assetMovements.lines : []),
        ...(Array.isArray(assetMovements.tangibleAssets) ? assetMovements.tangibleAssets : []),
        ...(Array.isArray(assetMovements.intangibleAssets) ? assetMovements.intangibleAssets : []),
      ]),
      evidence: Array.isArray(assetMovements.evidence)
        ? assetMovements.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    },
    reserveContext: {
      movements: sanitizeAnnualReportReserveLinesV1([
        ...(Array.isArray(reserveContext.movements) ? reserveContext.movements : []),
        ...(Array.isArray(reserveContext.untaxedReserves) ? reserveContext.untaxedReserves : []),
      ]),
      notes: sanitizeAnnualReportNotesV1([
        ...(Array.isArray(reserveContext.notes) ? reserveContext.notes : []),
        ...(Array.isArray(reserveContext.appropriations) ? reserveContext.appropriations : []),
      ]),
      evidence: Array.isArray(reserveContext.evidence)
        ? reserveContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    },
    netInterestContext: {
      financeIncome:
        sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.financeIncome) ??
        sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.otherFinancialIncome),
      financeExpense:
        sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.financeExpense) ??
        sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.otherFinancialExpense),
      interestIncome: sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.interestIncome),
      interestExpense: sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.interestExpense),
      netInterest: sanitizeAnnualReportValueWithEvidenceV1(netInterestContext.netInterest),
      notes: sanitizeAnnualReportNotesV1(
        Array.isArray(netInterestContext.notes) ? netInterestContext.notes : [],
      ),
      evidence: Array.isArray(netInterestContext.evidence)
        ? netInterestContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : [],
    },
    pensionContext: {
      specialPayrollTax: sanitizeAnnualReportValueWithEvidenceV1(pensionContext.specialPayrollTax),
      flags: taxDeep.pensionContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.pensionContext.notes,
        ...(Array.isArray(pensionContext.pensionCosts) ? pensionContext.pensionCosts : []),
        ...(Array.isArray(pensionContext.pensionObligations) ? pensionContext.pensionObligations : []),
      ]),
      evidence: Array.isArray(pensionContext.evidence)
        ? pensionContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : taxDeep.pensionContext.evidence,
    },
    taxExpenseContext: taxExpenseContext
      ? {
          currentTax: sanitizeAnnualReportValueWithEvidenceV1(taxExpenseContext.currentTax),
          deferredTax: sanitizeAnnualReportValueWithEvidenceV1(taxExpenseContext.deferredTax),
          totalTaxExpense: sanitizeAnnualReportValueWithEvidenceV1(taxExpenseContext.totalTaxExpense),
          notes: sanitizeAnnualReportNotesV1(
            Array.isArray(taxExpenseContext.notes) ? taxExpenseContext.notes : [],
          ),
          evidence: Array.isArray(taxExpenseContext.evidence)
            ? taxExpenseContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
            : [],
        }
      : undefined,
    leasingContext: {
      flags: taxDeep.leasingContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.leasingContext.notes,
        ...(Array.isArray(leasingContext.leasingCosts) ? leasingContext.leasingCosts : []),
        ...(Array.isArray(leasingContext.futureLeasingCommitments)
          ? leasingContext.futureLeasingCommitments
          : []),
      ]),
      evidence: Array.isArray(leasingContext.evidence)
        ? leasingContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : taxDeep.leasingContext.evidence,
    },
    groupContributionContext: {
      flags: taxDeep.groupContributionContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.groupContributionContext.notes,
        ...(Array.isArray(groupContributionContext.groupContributionsReceived)
          ? groupContributionContext.groupContributionsReceived
          : []),
        ...(Array.isArray(groupContributionContext.groupContributionsPaid)
          ? groupContributionContext.groupContributionsPaid
          : []),
      ]),
      evidence: Array.isArray(groupContributionContext.evidence)
        ? groupContributionContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : taxDeep.groupContributionContext.evidence,
    },
    shareholdingContext: {
      dividendsReceived: sanitizeAnnualReportValueWithEvidenceV1(shareholdingContext.dividendsReceived),
      dividendsPaid: sanitizeAnnualReportValueWithEvidenceV1(shareholdingContext.dividendsPaid),
      flags: taxDeep.shareholdingContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.shareholdingContext.notes,
        ...(Array.isArray(shareholdingContext.proposedDividend)
          ? shareholdingContext.proposedDividend
          : []),
        ...(Array.isArray(shareholdingContext.financialAssets)
          ? shareholdingContext.financialAssets
          : []),
      ]),
      evidence: Array.isArray(shareholdingContext.evidence)
        ? shareholdingContext.evidence.flatMap((entry) => sanitizeAnnualReportEvidenceReferenceV1(entry))
        : taxDeep.shareholdingContext.evidence,
    },
    priorYearComparatives: taxDeep.priorYearComparatives,
  };
}

export function normalizeAnnualReportTaxDeepV1(
  taxDeep: AnnualReportTaxDeepExtractionV1,
): AnnualReportTaxDeepExtractionV1 {
  const sanitizedTaxDeep = sanitizeAnnualReportTaxDeepV1(taxDeep);
  const multiplier = resolveAnnualReportAmountMultiplierV1(
    sanitizedTaxDeep.ink2rExtracted.statementUnit,
  );
  if (multiplier === 1) {
    return sanitizedTaxDeep;
  }

    return {
      ...sanitizedTaxDeep,
      ink2rExtracted: {
        ...sanitizedTaxDeep.ink2rExtracted,
        // After normalization every amount in taxDeep is expressed in SEK.
        statementUnit: "sek",
        incomeStatement: normalizeAnnualReportStatementLinesV1(
          sanitizedTaxDeep.ink2rExtracted.incomeStatement,
          multiplier,
        ),
        balanceSheet: normalizeAnnualReportStatementLinesV1(
        sanitizedTaxDeep.ink2rExtracted.balanceSheet,
        multiplier,
      ),
    },
    depreciationContext: {
      ...sanitizedTaxDeep.depreciationContext,
      assetAreas: normalizeAnnualReportAssetMovementLinesV1(
        sanitizedTaxDeep.depreciationContext.assetAreas,
        multiplier,
      ),
    },
    assetMovements: {
      ...sanitizedTaxDeep.assetMovements,
      lines: normalizeAnnualReportAssetMovementLinesV1(
        sanitizedTaxDeep.assetMovements.lines,
        multiplier,
      ),
    },
    reserveContext: {
      ...sanitizedTaxDeep.reserveContext,
      movements: normalizeAnnualReportReserveMovementLinesV1(
        sanitizedTaxDeep.reserveContext.movements,
        multiplier,
      ),
    },
    netInterestContext: {
      ...sanitizedTaxDeep.netInterestContext,
      financeIncome: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.netInterestContext.financeIncome,
        multiplier,
      ),
      financeExpense: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.netInterestContext.financeExpense,
        multiplier,
      ),
      interestIncome: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.netInterestContext.interestIncome,
        multiplier,
      ),
      interestExpense: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.netInterestContext.interestExpense,
        multiplier,
      ),
      netInterest: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.netInterestContext.netInterest,
        multiplier,
      ),
    },
    pensionContext: {
      ...sanitizedTaxDeep.pensionContext,
      specialPayrollTax: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.pensionContext.specialPayrollTax,
        multiplier,
      ),
    },
    taxExpenseContext: sanitizedTaxDeep.taxExpenseContext
      ? {
          ...sanitizedTaxDeep.taxExpenseContext,
          currentTax: normalizeAnnualReportValueWithEvidenceV1(
            sanitizedTaxDeep.taxExpenseContext.currentTax,
            multiplier,
          ),
          deferredTax: normalizeAnnualReportValueWithEvidenceV1(
            sanitizedTaxDeep.taxExpenseContext.deferredTax,
            multiplier,
          ),
          totalTaxExpense: normalizeAnnualReportValueWithEvidenceV1(
            sanitizedTaxDeep.taxExpenseContext.totalTaxExpense,
            multiplier,
          ),
        }
      : undefined,
    shareholdingContext: {
      ...sanitizedTaxDeep.shareholdingContext,
      dividendsReceived: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.shareholdingContext.dividendsReceived,
        multiplier,
      ),
      dividendsPaid: normalizeAnnualReportValueWithEvidenceV1(
        sanitizedTaxDeep.shareholdingContext.dividendsPaid,
        multiplier,
      ),
    },
    priorYearComparatives: normalizeAnnualReportStatementLinesV1(
      sanitizedTaxDeep.priorYearComparatives,
      multiplier,
    ),
  };
}

function hasAnnualReportFullExtractionV1(
  taxDeep: AnnualReportTaxDeepExtractionV1 | undefined,
): boolean {
  if (!taxDeep) {
    return false;
  }

  return (
    taxDeep.ink2rExtracted.incomeStatement.length > 0 &&
    taxDeep.ink2rExtracted.balanceSheet.length > 0
  );
}

function sleepV1(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

function isRetryableAnnualReportAiErrorV1(error: {
  code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
  message: string;
}): boolean {
  if (error.code === "CONFIG_INVALID") {
    return false;
  }

  return (
    error.code === "MODEL_EXECUTION_FAILED" ||
    error.message.includes("429") ||
    error.message.includes("500") ||
    error.message.includes("503") ||
    error.message.includes("timed out")
  );
}

async function withAnnualReportAiRetryV1<TValue>(input: {
  execute: () => Promise<
    | { ok: true; value: TValue }
    | {
        ok: false;
        error: {
          code:
            | "MODEL_EXECUTION_FAILED"
            | "MODEL_RESPONSE_INVALID"
            | "CONFIG_INVALID";
          message: string;
          context: Record<string, unknown>;
        };
      }
  >;
  maxAttempts: number;
}): Promise<
  | { ok: true; value: TValue }
  | {
      ok: false;
      error: {
        code:
          | "MODEL_EXECUTION_FAILED"
          | "MODEL_RESPONSE_INVALID"
          | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    }
> {
  let attempt = 0;
  let lastFailure:
    | {
        ok: false;
        error: {
          code:
            | "MODEL_EXECUTION_FAILED"
            | "MODEL_RESPONSE_INVALID"
            | "CONFIG_INVALID";
          message: string;
          context: Record<string, unknown>;
        };
      }
    | undefined;

  while (attempt < input.maxAttempts) {
    attempt += 1;
    const result = await input.execute();
    if (result.ok) {
      return result;
    }

    lastFailure = result;
    if (!isRetryableAnnualReportAiErrorV1(result.error) || attempt >= input.maxAttempts) {
      break;
    }

    await sleepV1(500 * attempt);
  }

  return (
    lastFailure ?? {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: "Annual-report AI execution failed without a result.",
        context: {},
      },
    }
  );
}

function buildAnnualReportSourceDiagnosticsV1(input: {
  sourceText: import("../../shared/contracts/annual-report-source-text.v1").AnnualReportSourceTextV1;
}): string[] {
  const diagnostics = [
    `parsing.${input.sourceText.fileType}.parser=${input.sourceText.parserVersion}`,
    `parsing.${input.sourceText.fileType}.text_source=${input.sourceText.textSource}`,
    `parsing.${input.sourceText.fileType}.page_count=${input.sourceText.pageCount}`,
  ];

  if (input.sourceText.pageTexts.length > 0) {
    diagnostics.push(
      `parsing.${input.sourceText.fileType}.page_texts=${input.sourceText.pageTexts.length}`,
    );
  }
  if (input.sourceText.fileType === "pdf" && input.sourceText.pdfAnalysis) {
    diagnostics.push(
      `parsing.pdf.classification=${input.sourceText.pdfAnalysis.classification}`,
      `parsing.pdf.non_empty_pages=${input.sourceText.pdfAnalysis.nonEmptyPageCount}`,
      `parsing.pdf.avg_chars_per_page=${Math.round(input.sourceText.pdfAnalysis.averageCharsPerPage)}`,
    );
  }

  diagnostics.push(...input.sourceText.warnings);
  return diagnostics;
}

async function withTimeoutV1<TValue>(input: {
  label: string;
  operation: () => Promise<TValue>;
  timeoutMs: number;
}): Promise<TValue> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      input.operation(),
      new Promise<TValue>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`${input.label} timed out after ${input.timeoutMs}ms.`),
          );
        }, input.timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function extractAnnualReportWithPrimaryAiV1(input: {
  env: Env;
  fileBytes: Uint8Array;
  fileName: string;
  fileType?: "pdf" | "docx";
  policyVersion: string;
  onProgress?: (
    status: AnnualReportProcessingRunStatusV1,
    technicalDetails?: string[],
  ) => Promise<void>;
}): Promise<ReturnType<typeof parseAnnualReportExtractionV1>> {
  const apiKey = getGeminiApiKeyV1(input.env);
  const generatedAt = new Date().toISOString();
  const modelConfig = getGeminiModelConfigV1(input.env);
  const runtimeMetadata = buildAnnualReportRuntimeMetadataV1(input.env);
  const fallbackModelName = modelConfig.fastModel;
  const resolvedFileType =
    input.fileType ??
    (input.fileName.toLowerCase().endsWith(".docx") ? "docx" : "pdf");
  if (!apiKey) {
    return buildAnnualReportExtractionFallbackV1({
      fallbackReason: "Gemini API key is not configured.",
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      fileType: resolvedFileType,
      generatedAt,
      modelTier: "fast",
      modelName: fallbackModelName,
      policyVersion: input.policyVersion,
      runtimeMetadata,
    });
  }

  const configResult = loadAnnualReportAnalysisModuleConfigV1();
  if (!configResult.ok) {
    return buildAnnualReportExtractionFallbackV1({
      fallbackReason: configResult.error.message,
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      fileType: resolvedFileType,
      generatedAt,
      modelTier: "fast",
      modelName: fallbackModelName,
      policyVersion: input.policyVersion,
      runtimeMetadata,
    });
  }

  try {
    const sourceTextResult = await withTimeoutV1({
      label: "Annual-report source parsing",
      timeoutMs: ANNUAL_REPORT_SOURCE_PARSING_TIMEOUT_MS_V1,
      operation: () =>
        parseAnnualReportSourceTextForAiV1({
          fileBytes: input.fileBytes,
          fileType: resolvedFileType,
        }),
    });
    if (!sourceTextResult.ok) {
      return {
        ok: false,
        error: {
          code: sourceTextResult.error.code,
          message: `Annual-report source parsing failed: ${sourceTextResult.error.message}`,
          user_message: sourceTextResult.error.user_message,
          context: {
            ...sourceTextResult.error.context,
            fileType: resolvedFileType,
            stage: "source_parsing",
          },
        },
      };
    }

    const sourceDiagnostics = buildAnnualReportSourceDiagnosticsV1({
      sourceText: sourceTextResult.sourceText,
    });
    const pdfRouting =
      sourceTextResult.sourceText.fileType === "pdf" &&
      sourceTextResult.sourceText.pdfAnalysis?.classification ===
        "extractable_text_pdf"
        ? prepareAnnualReportPdfRoutingV1({
            sourceText: sourceTextResult.sourceText,
          })
        : undefined;
    let aiResult:
      | Awaited<ReturnType<typeof executeAnnualReportAnalysisV1>>
      | undefined;
    const preparedDocument = prepareAnnualReportDocumentV1({
      fileBytes: input.fileBytes,
      pdfRouting,
      sourceText: sourceTextResult.sourceText,
      toBase64: toBase64V1,
    });
    const aiResultWithRetry = await withAnnualReportAiRetryV1({
      maxAttempts: 2,
      execute: async () => {
        const result = await executeAnnualReportAnalysisV1({
          apiKey,
          config: configResult.config,
          document: preparedDocument,
          generateId: () => crypto.randomUUID(),
          generatedAt,
          modelConfig,
          runtimeMode: resolveAnnualReportAnalysisRuntimeModeV1(input.env),
          onProgress: input.onProgress,
        });
        if (!result.ok) {
          return result;
        }
        return {
          ok: true as const,
          value: result,
        };
      },
    });
    if (!aiResultWithRetry.ok) {
      return buildAnnualReportExtractionFallbackV1({
        diagnosticWarnings: sourceDiagnostics,
        fallbackReason: aiResultWithRetry.error.message,
        fileBytes: input.fileBytes,
        fileName: input.fileName,
        fileType: resolvedFileType,
        generatedAt,
        modelTier: configResult.config.moduleSpec.runtime.modelTier,
        modelName: fallbackModelName,
        policyVersion: input.policyVersion,
        runtimeMetadata,
      });
    }

    aiResult = aiResultWithRetry.value;

    if (!aiResult) {
      throw new Error("Annual-report AI extraction returned no result.");
    }

    const fields = aiResult.extraction.fields;
    const fiscalYearStartResult = normalizeAnnualReportAiDateFieldV1({
      field: fields.fiscalYearStart,
      fieldKey: "fiscalYearStart",
    });
    const fiscalYearEndResult = normalizeAnnualReportAiDateFieldV1({
      field: fields.fiscalYearEnd,
      fieldKey: "fiscalYearEnd",
    });
    const normalizedTaxDeep = normalizeAnnualReportTaxDeepV1(
      aiResult.extraction.taxDeep,
    );
    const statementValueMultiplier = resolveAnnualReportAmountMultiplierV1(
      normalizedTaxDeep.ink2rExtracted.statementUnit,
    );
    const fullExtractionMissing =
      !hasAnnualReportFullExtractionV1(normalizedTaxDeep) &&
      aiResult.extraction.documentWarnings.some(
        (warning) =>
          warning.includes("Gemini statements extraction skipped") ||
          warning.includes("maximum allowed nesting depth"),
      );
    const extractionWarnings = [
      ...sourceDiagnostics,
      ...aiResult.extraction.documentWarnings,
      ...[fiscalYearStartResult.warning, fiscalYearEndResult.warning].filter(
        (warning): warning is string => typeof warning === "string",
      ),
      ...(fullExtractionMissing
        ? [
            "Full financial extraction is missing on this artifact. Re-run the annual report analysis to populate the income statement and balance sheet.",
          ]
        : []),
    ];
    const normalizedFields = {
      companyName: {
        status: fields.companyName.status,
        confidence: fields.companyName.confidence,
        value: fields.companyName.valueText,
        sourceSnippet: fields.companyName.snippet
          ? {
              snippet: fields.companyName.snippet,
              page: fields.companyName.page,
            }
          : undefined,
      },
      organizationNumber: {
        status: fields.organizationNumber.status,
        confidence: fields.organizationNumber.confidence,
        value: fields.organizationNumber.valueText,
        sourceSnippet: fields.organizationNumber.snippet
          ? {
              snippet: fields.organizationNumber.snippet,
              page: fields.organizationNumber.page,
            }
          : undefined,
      },
      fiscalYearStart: fiscalYearStartResult.field,
      fiscalYearEnd: fiscalYearEndResult.field,
      accountingStandard: {
        status: fields.accountingStandard.status,
        confidence: fields.accountingStandard.confidence,
        value:
          fields.accountingStandard.normalizedValue ??
          (fields.accountingStandard.valueText === "K2" ||
          fields.accountingStandard.valueText === "K3"
            ? fields.accountingStandard.valueText
            : undefined),
        sourceSnippet: fields.accountingStandard.snippet
          ? {
              snippet: fields.accountingStandard.snippet,
              page: fields.accountingStandard.page,
            }
          : undefined,
      },
      profitBeforeTax: {
        status: fields.profitBeforeTax.status,
        confidence: fields.profitBeforeTax.confidence,
        value:
          fields.profitBeforeTax.normalizedValue === undefined
            ? undefined
            : fields.profitBeforeTax.normalizedValue * statementValueMultiplier,
        sourceSnippet: fields.profitBeforeTax.snippet
          ? {
              snippet: fields.profitBeforeTax.snippet,
              page: fields.profitBeforeTax.page,
            }
          : undefined,
      },
    };
    const payload = stampAnnualReportEngineMetadataV1({
      runtimeMetadata,
      extraction: parseAnnualReportExtractionPayloadV1({
      schemaVersion: "annual_report_extraction_v1",
      sourceFileName: input.fileName,
      sourceFileType: resolvedFileType,
      policyVersion: input.policyVersion,
      fields: normalizedFields,
      summary: {
        autoDetectedFieldCount: Object.values(normalizedFields).filter(
          (field) => field.status === "extracted",
        ).length,
        needsReviewFieldCount: Object.values(normalizedFields).filter(
          (field) => field.status === "needs_review",
        ).length,
      },
      taxSignals: aiResult.extraction.taxSignals,
      documentWarnings: extractionWarnings,
      taxDeep: normalizedTaxDeep,
      aiRun: aiResult.aiRun,
      confirmation: {
        isConfirmed: false,
      },
      }),
    });

    return {
      ok: true,
      extraction: payload,
    };
  } catch (error) {
    const fallbackReason =
      error instanceof Error
        ? error.message
        : "Unknown annual-report AI extraction failure.";
    const parserTimedOut =
      typeof fallbackReason === "string" &&
      fallbackReason.includes("Annual-report source parsing timed out");
    return buildAnnualReportExtractionFallbackV1({
      fallbackReason,
      diagnosticWarnings: [
        parserTimedOut
          ? `parsing.${resolvedFileType}.timeout=${ANNUAL_REPORT_SOURCE_PARSING_TIMEOUT_MS_V1}`
          : `parsing.${resolvedFileType}.unexpected_runtime_error`,
      ],
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      fileType: resolvedFileType,
      generatedAt,
      modelTier: configResult.config.moduleSpec.runtime.modelTier,
      modelName: fallbackModelName,
      policyVersion: input.policyVersion,
      runtimeMetadata,
    });
  }
}

async function analyzeAnnualReportTaxWithPrimaryAiV1(input: {
  env: Env;
  extraction: ReturnType<typeof parseAnnualReportExtractionPayloadV1>;
  extractionArtifactId: string;
  policyVersion: string;
}): Promise<
  | { ok: true; taxAnalysis: AnnualReportTaxAnalysisPayloadV1 }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    }
> {
  const apiKey = getGeminiApiKeyV1(input.env);
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Gemini API key is not configured.",
        context: {},
      },
    };
  }

  const configResult = loadAnnualReportTaxAnalysisModuleConfigV1();
  if (!configResult.ok) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: configResult.error.message,
        context: {},
      },
    };
  }

  const result = await withAnnualReportAiRetryV1({
    maxAttempts: 2,
    execute: async () => {
      const analysisResult = await executeAnnualReportTaxAnalysisV1({
        apiKey,
        config: configResult.config,
        extraction: input.extraction,
        extractionArtifactId: input.extractionArtifactId,
        generateId: () => crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        modelConfig: getGeminiModelConfigV1(input.env),
        policyVersion: input.policyVersion,
      });
      if (!analysisResult.ok) {
        return analysisResult;
      }

      return {
        ok: true as const,
        value: analysisResult.taxAnalysis,
      };
    },
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    taxAnalysis: result.value,
  };
}

async function generateMappingDecisionsWithPrimaryAiV1(input: {
  annualReportContext?: import("../../shared/contracts/annual-report-tax-context.v1").AnnualReportMappingContextV1;
  env: Env;
  policyVersion: string;
  trialBalance: TrialBalanceNormalizedV1;
  reconciliation: ReconciliationResultPayloadV1;
}) {
  const deterministicInput = {
    policyVersion: input.policyVersion,
    trialBalance: input.trialBalance,
    reconciliation: input.reconciliation,
  };
  const apiKey = getGeminiApiKeyV1(input.env);
  if (!apiKey) {
    return generateDeterministicMappingDecisionsV1(deterministicInput);
  }

  const configResult = loadMappingDecisionsModuleConfigV1();
  if (!configResult.ok) {
    return generateDeterministicMappingDecisionsV1(deterministicInput);
  }

  const aiResult = await executeMappingDecisionsModelV1({
    apiKey,
    annualReportContext: input.annualReportContext,
    config: configResult.config,
    generateId: () => crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    modelConfig: getGeminiModelConfigV1(input.env),
    policyVersion: input.policyVersion,
    trialBalance: input.trialBalance,
  });
  if (!aiResult.ok) {
    return generateDeterministicMappingDecisionsV1(deterministicInput);
  }
  if (aiResult.mapping.aiRun?.usedFallback) {
    console.warn("mapping-decisions.ai.degraded", {
      policyVersion: aiResult.mapping.policyVersion,
      totalRows: aiResult.mapping.summary.totalRows,
      fallbackDecisions: aiResult.mapping.summary.fallbackDecisions,
    });
  }

  return {
    ok: true as const,
    mapping: aiResult.mapping,
  };
}

async function generateTaxAdjustmentsWithPrimaryAiV1(input: {
  annualReportTaxContext?: import("../../shared/contracts/annual-report-tax-context.v1").AnnualReportDownstreamTaxContextV1;
  env: Env;
  annualReportExtraction: GenerateTaxAdjustmentsInputV1["annualReportExtraction"];
  annualReportExtractionArtifactId: string;
  mapping: GenerateTaxAdjustmentsInputV1["mapping"];
  mappingArtifactId: string;
  policyVersion: string;
  trialBalance: GenerateTaxAdjustmentsInputV1["trialBalance"];
}) {
  const deterministicInput = {
    annualReportExtraction: input.annualReportExtraction,
    annualReportExtractionArtifactId: input.annualReportExtractionArtifactId,
    mapping: input.mapping,
    mappingArtifactId: input.mappingArtifactId,
    policyVersion: input.policyVersion,
    trialBalance: input.trialBalance,
  };
  const apiKey = getGeminiApiKeyV1(input.env);
  if (!apiKey) {
    return generateTaxAdjustmentsV1(deterministicInput);
  }

  const modelConfig = getGeminiModelConfigV1(input.env);
  const closingBalanceBySourceAccount = new Map<string, number>();
  for (const row of input.trialBalance.rows) {
    closingBalanceBySourceAccount.set(
      row.sourceAccountNumber,
      (closingBalanceBySourceAccount.get(row.sourceAccountNumber) ?? 0) +
        row.closingBalance,
    );
  }

  const moduleLoaders = [
    {
      moduleCode: "non_deductible_expenses" as const,
      configResult: loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1(),
      systemPrompt: TAX_ADJUSTMENTS_NON_DEDUCTIBLE_SYSTEM_PROMPT_V1,
      userPrompt: TAX_ADJUSTMENTS_NON_DEDUCTIBLE_USER_PROMPT_V1,
    },
    {
      moduleCode: "representation_entertainment" as const,
      configResult: loadTaxAdjustmentsRepresentationEntertainmentModuleConfigV1(),
      systemPrompt: TAX_ADJUSTMENTS_REPRESENTATION_SYSTEM_PROMPT_V1,
      userPrompt: TAX_ADJUSTMENTS_REPRESENTATION_USER_PROMPT_V1,
    },
    {
      moduleCode: "depreciation_differences_basic" as const,
      configResult: loadTaxAdjustmentsDepreciationDifferencesBasicModuleConfigV1(),
      systemPrompt: TAX_ADJUSTMENTS_DEPRECIATION_SYSTEM_PROMPT_V1,
      userPrompt: TAX_ADJUSTMENTS_DEPRECIATION_USER_PROMPT_V1,
    },
  ] as const;

  const allDecisions: TaxAdjustmentAiProposalDecisionV1[] = [];
  const aiRuns: AiRunMetadataV1[] = [];

  for (const moduleLoader of moduleLoaders) {
    if (!moduleLoader.configResult.ok) {
      return generateTaxAdjustmentsV1(deterministicInput);
    }

    const candidates = projectTaxAdjustmentCandidatesV1({
      mapping: input.mapping,
      allowedCategoryCodes:
        moduleLoader.configResult.config.policyPack.candidateCategoryCodes,
      closingBalanceBySourceAccount,
    });
    if (candidates.length === 0) {
      continue;
    }

    const moduleResult = await executeTaxAdjustmentSubmoduleV1({
      apiKey,
      annualReportTaxContext:
        input.annualReportTaxContext ??
        projectAnnualReportTaxContextV1({
          extraction: input.annualReportExtraction,
        }),
      candidates,
      config: moduleLoader.configResult.config as never,
      generateId: () => crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      modelConfig,
      systemPrompt: moduleLoader.systemPrompt,
      userPrompt: moduleLoader.userPrompt,
    });
    if (!moduleResult.ok) {
      for (const candidate of candidates) {
        allDecisions.push({
          decisionId: `adj-fallback-${moduleLoader.moduleCode}-${candidate.sourceMappingDecisionId}`,
          module: moduleLoader.moduleCode,
          sourceMappingDecisionId: candidate.sourceMappingDecisionId,
          direction: moduleLoader.configResult.config.policyPack.direction,
          targetField: moduleLoader.configResult.config.policyPack.targetField,
          reviewFlag: true,
          confidence: 0.25,
          policyRuleReference: `adj.ai.fallback.${moduleLoader.moduleCode}.execution_failed.v1`,
          rationale:
            "AI submodule failed; deterministic fallback proposal applied for this candidate.",
        });
      }
      continue;
    }

    if (moduleResult.aiRun) {
      aiRuns.push(moduleResult.aiRun);
    }
    allDecisions.push(...moduleResult.decisions);
    if (moduleResult.failedCandidates.length > 0) {
      for (const candidate of moduleResult.failedCandidates) {
        allDecisions.push({
          decisionId: `adj-fallback-${moduleLoader.moduleCode}-${candidate.sourceMappingDecisionId}`,
          module: moduleLoader.moduleCode,
          sourceMappingDecisionId: candidate.sourceMappingDecisionId,
          direction: moduleLoader.configResult.config.policyPack.direction,
          targetField: moduleLoader.configResult.config.policyPack.targetField,
          reviewFlag: true,
          confidence: 0.25,
          policyRuleReference: `adj.ai.fallback.${moduleLoader.moduleCode}.chunk_retry_exhausted.v1`,
          rationale:
            "AI submodule chunk failed after retries; deterministic fallback proposal applied for this candidate.",
        });
      }
    }

    if (moduleResult.telemetry.splitCount > 0 || moduleResult.failedCandidates.length > 0) {
      console.warn("tax-adjustments.ai.degraded", {
        moduleCode: moduleLoader.moduleCode,
        failedCandidates: moduleResult.failedCandidates.length,
        splitCount: moduleResult.telemetry.splitCount,
        totalAttempts: moduleResult.telemetry.totalAttempts,
        mappingArtifactId: input.mappingArtifactId,
      });
    }
  }

  if (allDecisions.length === 0) {
    return generateTaxAdjustmentsV1(deterministicInput);
  }

  return generateTaxAdjustmentsFromAiProposalsV1({
    aiRuns,
    annualReportExtraction: input.annualReportExtraction,
    annualReportExtractionArtifactId: input.annualReportExtractionArtifactId,
    mapping: input.mapping,
    mappingArtifactId: input.mappingArtifactId,
    policyVersion: input.policyVersion,
    proposals: allDecisions,
    trialBalance: input.trialBalance,
  });
}

/**
 * Creates environment-backed dependencies for the auth magic-link workflow.
 */
export function createAuthMagicLinkDepsV1(env: Env): AuthMagicLinkDepsV1 {
  return {
    authRepository: createD1AuthRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    generateToken: () => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);

      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    },
    nowIsoUtc: () => new Date().toISOString(),
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
  };
}

/**
 * Creates dependencies for session-token principal lookups.
 */
export function createResolveSessionPrincipalDepsV1(
  env: Env,
): ResolveSessionPrincipalDepsV1 {
  return {
    authRepository: createD1AuthRepositoryV1(env.DB),
    nowIsoUtc: () => new Date().toISOString(),
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
  };
}

/**
 * Creates environment-backed dependencies for workspace lifecycle workflows.
 */
export function createWorkspaceLifecycleDepsV1(
  env: Env,
): WorkspaceLifecycleDepsV1 {
  return {
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for company lifecycle workflows.
 */
export function createCompanyLifecycleDepsV1(env: Env): CompanyLifecycleDepsV1 {
  return {
    companyRepository: createD1CompanyRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for deterministic TB pipeline runs.
 */
export function createTrialBalancePipelineRunDepsV1(
  env: Env,
): TrialBalancePipelineRunDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    workspaceArtifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    generateMappingDecisions: async (input) => {
      const workspaceArtifactRepository = createD1WorkspaceArtifactRepositoryV1(
        env.DB,
      );
      const extraction =
        await workspaceArtifactRepository.getActiveAnnualReportExtraction({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        });
      const taxAnalysis =
        await workspaceArtifactRepository.getActiveAnnualReportTaxAnalysis({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        });
      const annualReportContext = extraction
        ? projectAnnualReportMappingContextV1({
            annualReportTaxContext: projectAnnualReportTaxContextV1({
              extraction: extraction.payload,
              taxAnalysis: taxAnalysis?.payload,
            }),
          })
        : undefined;

      return generateMappingDecisionsWithPrimaryAiV1({
        env,
        annualReportContext,
        policyVersion: input.policyVersion,
        trialBalance: input.trialBalance,
        reconciliation: input.reconciliation,
      });
    },
    mappingPreferenceRepository: createD1MappingPreferenceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for mapping override workflows.
 */
export function createMappingOverrideDepsV1(env: Env): MappingOverrideDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    mappingPreferenceRepository: createD1MappingPreferenceRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for mapping-review suggestion workflows.
 */
export function createMappingReviewDepsV1(env: Env): MappingReviewDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    loadModuleConfig: loadMappingReviewModuleConfigV1,
    runModel: executeMappingReviewModelV1,
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for annual-report extraction workflows.
 */
export function createAnnualReportExtractionDepsV1(
  env: Env,
): AnnualReportExtractionDepsV1 {
  return {
    artifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    processingRunRepository: createD1AnnualReportProcessingRunRepositoryV1(
      env.DB,
    ),
    extractAnnualReport: (input) =>
      extractAnnualReportWithPrimaryAiV1({
        env,
        ...input,
      }),
    analyzeAnnualReportTax: (input) =>
      analyzeAnnualReportTaxWithPrimaryAiV1({
        env,
        ...input,
      }),
    getRuntimeMetadata: () => buildAnnualReportRuntimeMetadataV1(env),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

export function createAnnualReportProcessingDepsV1(
  env: Env,
): AnnualReportProcessingDepsV1 {
  const runtime = resolveAnnualReportProcessingRuntimeV1(env);
  const processingConfigError =
    runtime.missingBindings.length > 0
      ? `Annual-report processing bindings are missing: ${runtime.missingBindings.join(", ")}.`
      : undefined;

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
    sourceStore: env.ANNUAL_REPORT_FILES,
    processingConfigError,
    allowInlineFallbackInDev: runtime.mode === "inline_fallback",
    enqueueProcessingRun: async (message) => {
      if (!env.ANNUAL_REPORT_QUEUE) {
        return {
          ok: false as const,
          code: "PROCESSING_RUN_UNAVAILABLE" as const,
          message: "Annual-report processing queue binding is not configured.",
        };
      }

      try {
        await env.ANNUAL_REPORT_QUEUE.send(message);
        return {
          ok: true as const,
        };
      } catch (error) {
        return {
          ok: false as const,
          code: "PERSISTENCE_ERROR" as const,
          message:
            error instanceof Error
              ? error.message
              : "Unknown annual-report queue dispatch failure.",
        };
      }
    },
    extractAnnualReport: (input) =>
      extractAnnualReportWithPrimaryAiV1({
        env,
        ...input,
      }),
    analyzeAnnualReportTax: (input) =>
      analyzeAnnualReportTaxWithPrimaryAiV1({
        env,
        ...input,
      }),
    getRuntimeMetadata: () => buildAnnualReportRuntimeMetadataV1(env),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for deterministic tax-core workflows.
 */
export function createTaxCoreWorkflowDepsV1(env: Env): TaxCoreWorkflowDepsV1 {
  return {
    auditRepository: createD1AuditRepositoryV1(env.DB),
    tbArtifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    workspaceArtifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    generateTaxAdjustments: async (input) => {
      const workspaceArtifactRepository = createD1WorkspaceArtifactRepositoryV1(
        env.DB,
      );
      const taxAnalysis =
        await workspaceArtifactRepository.getActiveAnnualReportTaxAnalysis({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        });
      const annualReportTaxContext = projectAnnualReportTaxContextV1({
        extraction: input.annualReportExtraction,
        taxAnalysis: taxAnalysis?.payload,
      });

      return generateTaxAdjustmentsWithPrimaryAiV1({
        env,
        ...input,
        annualReportTaxContext,
      });
    },
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

/**
 * Creates environment-backed dependencies for collaboration workflows.
 */
export function createCollaborationDepsV1(env: Env): CollaborationDepsV1 {
  return {
    auditRepository: createD1AuditRepositoryV1(env.DB),
    commentsRepository: createD1CommentsRepositoryV1(env.DB),
    tasksRepository: createD1TasksRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}
