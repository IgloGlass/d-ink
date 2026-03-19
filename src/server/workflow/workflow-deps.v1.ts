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
import type { WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import type { Env } from "../../shared/types/env";
import type { AnnualReportProcessingRunStatusV1 } from "../../shared/contracts/annual-report-processing-run.v1";
import {
  ANNUAL_REPORT_CODES_SV_V1,
  getAnnualReportCodeDefinitionV1,
  getAnnualReportCodeOrderV1,
  isAnnualReportBalanceAssetCodeV1,
  isAnnualReportBalanceEquityLiabilityCodeV1,
  type AnnualReportCodeDefinitionV1,
} from "../../shared/contracts/annual-report-codes.v1";
import {
  type AnnualReportAmountUnitV1,
  type AnnualReportRuntimeMetadataV1,
  type AnnualReportTaxDeepExtractionV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../shared/contracts/annual-report-tax-analysis.v1";
import type {
  AnnualReportDownstreamTaxContextV1,
} from "../../shared/contracts/annual-report-tax-context.v1";
import type { AnnualReportSourceTextV1 } from "../../shared/contracts/annual-report-source-text.v1";
import type { AiRunMetadataV1 } from "../../shared/contracts/ai-run.v1";
import {
  getSilverfinTaxCategoryByCodeV1,
  parseGenerateMappingDecisionsRequestV2,
  type MappingDegradationReasonCodeV1,
  type SilverfinTaxCategoryCodeV1,
  parseMappingDecisionSetArtifactV1,
  parseMappingExecutionMetadataV1,
  resolveConfirmedAnnualReportMappingContextForRequestV1,
} from "../../shared/contracts/mapping.v1";
import type { ReconciliationResultPayloadV1 } from "../../shared/contracts/reconciliation.v1";
import type { TaxAdjustmentAiProposalDecisionV1 } from "../../shared/contracts/tax-adjustment-ai.v1";
import {
  buildTrialBalanceRowIdentityV1,
  buildTrialBalanceRowKeyV1,
  type TrialBalanceNormalizedArtifactV1,
} from "../../shared/contracts/trial-balance.v1";
import {
  generateTaxAdjustmentsFromAiProposalsV1,
  generateTaxAdjustmentsV1,
} from "../adjustments/tax-adjustments-engine.v1";
import { resolveConservativeFallbackCategoryCodeV1 } from "../mapping/conservative-fallback.v1";
import type { GenerateTaxAdjustmentsInputV1 } from "../adjustments/tax-adjustments-engine.v1";
import {
  projectAnnualReportMappingContextV1,
  projectAnnualReportTaxContextV1,
} from "../ai/context/annual-report-tax-context.v1";
import {
  prepareAnnualReportDocumentV1,
  type AnnualReportPreparedDocumentV1,
} from "../ai/document-prep/annual-report-document.v1";
import { executeAnnualReportAnalysisV1 } from "../ai/modules/annual-report-analysis/executor.v1";
import { loadAnnualReportAnalysisModuleConfigV1 } from "../ai/modules/annual-report-analysis/loader.v1";
import {
  executeAnnualReportTaxAnalysisV1,
  type AnnualReportTaxAnalysisRuntimeConfigV1,
} from "../ai/modules/annual-report-tax-analysis/executor.v1";
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
import { executeTaxAdjustmentSubmoduleV1 } from "../ai/modules/tax-adjustments-shared/executor.v1";
import {
  getAiApiKeyV1,
  getAiModelConfigV1,
} from "../ai/providers/ai-provider-config.v1";
import { toBase64V1 } from "../ai/providers/ai-provider-client.v1";
import {
  projectRoutedTaxAdjustmentCandidatesV1,
  projectTaxAdjustmentModuleContextV1,
} from "../adjustments/tax-adjustment-submodule-routing.v1";
import type { AnnualReportExtractionDepsV1 } from "./annual-report-extraction.v1";
import type { AnnualReportProcessingDepsV1 } from "./annual-report-processing.v1";
import type {
  AuthMagicLinkDepsV1,
  ResolveSessionPrincipalDepsV1,
} from "./auth-magic-link.v1";
import type { CollaborationDepsV1 } from "./collaboration.v1";
import type { CompanyLifecycleDepsV1 } from "./company-lifecycle.v1";
import type { MappingOverrideDepsV1 } from "./mapping-override.v1";
import type { MappingAiEnrichmentDepsV1 } from "./mapping-ai-enrichment.v1";
import type { MappingReviewDepsV1 } from "./mapping-review.v1";
import type { TaxCoreWorkflowDepsV1 } from "./tax-core-workflow.v1";
import type { TrialBalancePipelineRunDepsV1 } from "./trial-balance-pipeline-run.v1";
import type { WorkspaceLifecycleDepsV1 } from "./workspace-lifecycle.v1";
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

  const rawBypass = (env.DEV_AUTH_BYPASS_ENABLED ?? "").trim().toLowerCase();
  const devAuthBypassEnabled =
    rawBypass === "1" || rawBypass === "true" || rawBypass === "yes";

  const inlineFallbackEnabled = devAuthBypassEnabled;
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
  const modelConfig = getAiModelConfigV1(env);

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
}): Extract<
  Awaited<ReturnType<typeof parseAnnualReportExtractionV1>>,
  { ok: true }
> {
  const existingWarnings =
    input.extractionResult.extraction.documentWarnings ?? [];

  return {
    ok: true,
    extraction: stampAnnualReportEngineMetadataV1({
      runtimeMetadata: input.runtimeMetadata,
      extraction: parseAnnualReportExtractionPayloadV1({
        ...input.extractionResult.extraction,
        documentWarnings: [
          ...(input.diagnosticWarnings ?? []),
          ...existingWarnings,
          `Qwen extraction fallback used: ${input.fallbackReason}`,
        ],
        aiRun: parseAiRunMetadataV1({
          runId: crypto.randomUUID(),
          moduleId: "annual-report-analysis",
          moduleVersion: "v1",
          promptVersion: "annual-report-analysis.prompts.v1",
          policyVersion: input.extractionResult.extraction.policyVersion,
          activePatchVersions: [],
          provider: "qwen",
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
    relevantNotes: [],
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
}): Extract<
  Awaited<ReturnType<typeof parseAnnualReportExtractionV1>>,
  { ok: true }
> {
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
          provider: "qwen",
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

  const yearFirstMatch = normalized.match(
    /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/,
  );
  if (yearFirstMatch) {
    return toIsoDateV1(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3]),
    );
  }

  const dayFirstMatch = normalized.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/,
  );
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

function extractAnnualReportDateCandidatesV1(
  value: string | undefined,
): string[] {
  if (!value) {
    return [];
  }

  const candidates = new Set<string>();
  const normalizedValue = value.replace(/\u00a0/g, " ").replace(/[–—]/g, "-");

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

  if (
    !input.field.valueText &&
    !input.field.snippet &&
    !input.field.normalizedValue
  ) {
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
    warning: `Qwen ${input.fieldKey} requires manual review: could not normalize "${input.field.valueText ?? input.field.normalizedValue ?? "unknown date"}" to ISO YYYY-MM-DD.`,
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

export function normalizeAnnualReportNumericFieldValueV1(
  value: number | undefined,
  unit: AnnualReportAmountUnitV1 | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value * resolveAnnualReportAmountMultiplierV1(unit);
}

export function normalizeAnnualReportOrganizationNumberV1(
  value: string | undefined,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/[–—]/g, "-").replace(/\s+/g, "");
  return /^\d{6}-\d{4}$/.test(normalized) ? normalized : value.trim();
}

function normalizeAnnualReportStatementMatchTextV1(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type AnnualReportStatementContextV1 = {
  groupSv?: string;
  sectionSv?: string;
  subgroupSv?: string;
};

type AnnualReportStatementNameSvV1 =
  AnnualReportCodeDefinitionV1["statementSv"];

const ANNUAL_REPORT_CODE_CANDIDATES_BY_LABEL_V1 = (() => {
  const grouped = {
    Balansräkning: new Map<string, AnnualReportCodeDefinitionV1[]>(),
    Resultaträkning: new Map<string, AnnualReportCodeDefinitionV1[]>(),
  } satisfies Record<
    AnnualReportStatementNameSvV1,
    Map<string, AnnualReportCodeDefinitionV1[]>
  >;

  for (const definition of ANNUAL_REPORT_CODES_SV_V1) {
    const key = normalizeAnnualReportStatementMatchTextV1(definition.labelSv);
    const candidates = grouped[definition.statementSv].get(key) ?? [];
    candidates.push(definition);
    grouped[definition.statementSv].set(key, candidates);
  }

  return grouped;
})();

const ANNUAL_REPORT_CONTEXT_MARKERS_V1 = (() => {
  const markers = new Map<
    string,
    Array<{
      level: "groupSv" | "sectionSv" | "subgroupSv";
      value: string;
    }>
  >();
  const addMarker = (
    level: "groupSv" | "sectionSv" | "subgroupSv",
    value: string | null,
  ) => {
    if (!value) {
      return;
    }
    const normalized = normalizeAnnualReportStatementMatchTextV1(value);
    if (normalized.length === 0) {
      return;
    }
    const existing = markers.get(normalized) ?? [];
    existing.push({ level, value });
    markers.set(normalized, existing);
  };

  for (const definition of ANNUAL_REPORT_CODES_SV_V1) {
    addMarker("sectionSv", definition.sectionSv);
    addMarker("groupSv", definition.groupSv);
    addMarker("subgroupSv", definition.subgroupSv);
  }

  return markers;
})();

const ANNUAL_REPORT_SUMMARY_LABELS_V1 = new Set<string>([
  "summa tillgangar",
  "summa eget kapital och skulder",
  "rorelseresultat",
  "resultat efter finansiella poster",
  "resultat fore skatt",
  "i ny rakning balanseras",
  "balansrakning",
  "resultatrakning",
  "rorelsens intakter",
  "rorelsens kostnader",
  "finansiella poster",
  "bokslutsdispositioner",
  "skatt",
  "tillgangar",
  "eget kapital och skulder",
  "anlaggningstillgangar",
  "immateriella anlaggningstillgangar",
  "materiella anlaggningstillgangar",
  "finansiella anlaggningstillgangar",
  "omsattningstillgangar",
  "kortfristiga fordringar",
  "kortfristiga skulder",
  "langfristiga skulder",
  "bundet eget kapital",
  "fritt eget kapital",
]);

function dedupeAnnualReportEvidenceV1<
  TEvidence extends { page?: number; snippet: string },
>(evidence: TEvidence[]): TEvidence[] {
  const seen = new Set<string>();
  const deduped: TEvidence[] = [];
  for (const item of evidence) {
    const key = `${item.page ?? "na"}:${item.snippet}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function sumOptionalAnnualReportAmountsV1(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  return (left ?? 0) + (right ?? 0);
}

function isAnnualReportContextHeadingV1(normalizedLabel: string): boolean {
  return ANNUAL_REPORT_CONTEXT_MARKERS_V1.has(normalizedLabel);
}

function isAnnualReportSummaryLineV1(input: {
  currentYearValue?: number;
  label: string;
  statementSv: AnnualReportStatementNameSvV1;
}): boolean {
  const normalizedLabel = normalizeAnnualReportStatementMatchTextV1(
    input.label,
  );
  if (normalizedLabel.length === 0) {
    return true;
  }

  if (normalizedLabel.startsWith("summa ")) {
    return true;
  }
  if (ANNUAL_REPORT_SUMMARY_LABELS_V1.has(normalizedLabel)) {
    return true;
  }
  if (
    input.statementSv === "Resultaträkning" &&
    (normalizedLabel.includes("resultat fore skatt") ||
      normalizedLabel.includes("resultat efter finansiella poster"))
  ) {
    return true;
  }
  if (
    input.statementSv === "Balansräkning" &&
    (normalizedLabel.includes("summa tillgangar") ||
      normalizedLabel.includes("summa eget kapital och skulder"))
  ) {
    return true;
  }

  return (
    input.currentYearValue === undefined &&
    input.statementSv === "Balansräkning" &&
    isAnnualReportContextHeadingV1(normalizedLabel)
  );
}

function findAnnualReportStatementLineIndexOnPageV1(input: {
  evidence: Array<{ page?: number; snippet: string }>;
  label: string;
  pageText: string;
}): number {
  const pageLines = input.pageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const normalizedLabel = normalizeAnnualReportStatementMatchTextV1(
    input.label,
  );
  const normalizedEvidenceSnippets = input.evidence
    .map((entry) => normalizeAnnualReportStatementMatchTextV1(entry.snippet))
    .filter((entry) => entry.length > 0);

  for (let index = 0; index < pageLines.length; index += 1) {
    const normalizedLine = normalizeAnnualReportStatementMatchTextV1(
      pageLines[index]!,
    );
    if (
      normalizedEvidenceSnippets.some(
        (snippet) =>
          snippet.includes(normalizedLine) || normalizedLine.includes(snippet),
      )
    ) {
      return index;
    }
    if (
      normalizedLabel.length > 0 &&
      (normalizedLine.includes(normalizedLabel) ||
        normalizedLabel.includes(normalizedLine))
    ) {
      return index;
    }
  }

  return -1;
}

function resolveAnnualReportStatementContextFromPageTextV1(input: {
  evidence: Array<{ page?: number; snippet: string }>;
  label: string;
  pageTexts: string[];
}): AnnualReportStatementContextV1 {
  for (const evidence of input.evidence) {
    if (
      !evidence.page ||
      evidence.page < 1 ||
      evidence.page > input.pageTexts.length
    ) {
      continue;
    }
    const pageText = input.pageTexts[evidence.page - 1] ?? "";
    if (pageText.trim().length === 0) {
      continue;
    }
    const pageLines = pageText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const targetIndex = findAnnualReportStatementLineIndexOnPageV1({
      evidence: input.evidence,
      label: input.label,
      pageText,
    });
    if (targetIndex < 0) {
      continue;
    }

    const context: AnnualReportStatementContextV1 = {};
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      const normalizedLine = normalizeAnnualReportStatementMatchTextV1(
        pageLines[index]!,
      );
      const markers = ANNUAL_REPORT_CONTEXT_MARKERS_V1.get(normalizedLine);
      if (!markers) {
        continue;
      }
      for (const marker of markers) {
        if (!context[marker.level]) {
          context[marker.level] = marker.value;
        }
      }
      if (context.sectionSv && context.groupSv && context.subgroupSv) {
        return context;
      }
    }

    if (context.sectionSv || context.groupSv || context.subgroupSv) {
      return context;
    }
  }

  return {};
}

function resolveAnnualReportCodeCandidatesByLabelV1(input: {
  label: string;
  statementSv: AnnualReportStatementNameSvV1;
}): AnnualReportCodeDefinitionV1[] {
  const normalizedLabel = normalizeAnnualReportStatementMatchTextV1(
    input.label,
  );
  return (
    ANNUAL_REPORT_CODE_CANDIDATES_BY_LABEL_V1[input.statementSv].get(
      normalizedLabel,
    ) ?? []
  );
}

function selectAnnualReportCodeByContextV1(input: {
  candidates: AnnualReportCodeDefinitionV1[];
  context: AnnualReportStatementContextV1;
}): AnnualReportCodeDefinitionV1 | undefined {
  if (input.candidates.length <= 1) {
    return input.candidates[0];
  }

  const normalizedSection = input.context.sectionSv
    ? normalizeAnnualReportStatementMatchTextV1(input.context.sectionSv)
    : undefined;
  const normalizedGroup = input.context.groupSv
    ? normalizeAnnualReportStatementMatchTextV1(input.context.groupSv)
    : undefined;
  const normalizedSubgroup = input.context.subgroupSv
    ? normalizeAnnualReportStatementMatchTextV1(input.context.subgroupSv)
    : undefined;

  const exactSubgroupMatch = normalizedSubgroup
    ? input.candidates.filter(
        (candidate) =>
          normalizeAnnualReportStatementMatchTextV1(
            candidate.subgroupSv ?? "",
          ) === normalizedSubgroup,
      )
    : [];
  if (exactSubgroupMatch.length === 1) {
    return exactSubgroupMatch[0];
  }

  const exactGroupMatch = normalizedGroup
    ? input.candidates.filter(
        (candidate) =>
          normalizeAnnualReportStatementMatchTextV1(candidate.groupSv ?? "") ===
          normalizedGroup,
      )
    : [];
  if (exactGroupMatch.length === 1) {
    return exactGroupMatch[0];
  }

  const exactSectionMatch = normalizedSection
    ? input.candidates.filter(
        (candidate) =>
          normalizeAnnualReportStatementMatchTextV1(candidate.sectionSv) ===
          normalizedSection,
      )
    : [];
  if (exactSectionMatch.length === 1) {
    return exactSectionMatch[0];
  }

  return input.candidates[0];
}

function resolveAnnualReportCodeByHeuristicV1(input: {
  context: AnnualReportStatementContextV1;
  currentYearValue?: number;
  label: string;
  statementSv: AnnualReportStatementNameSvV1;
}): string | undefined {
  const normalizedLabel = normalizeAnnualReportStatementMatchTextV1(
    input.label,
  );
  const normalizedGroup = normalizeAnnualReportStatementMatchTextV1(
    input.context.groupSv ?? "",
  );
  const normalizedSection = normalizeAnnualReportStatementMatchTextV1(
    input.context.sectionSv ?? "",
  );
  const isLongTermAssetContext =
    normalizedSection ===
      normalizeAnnualReportStatementMatchTextV1("Tillgångar") &&
    normalizedGroup.includes("anlaggningstillgang");
  const isShortTermReceivableContext = normalizedGroup.includes(
    "kortfristiga fordringar",
  );
  const isShortTermPlacementContext = normalizedGroup.includes(
    "kortfristiga placeringar",
  );
  const isLongTermDebtContext = normalizedGroup.includes(
    "langfristiga skulder",
  );
  const isShortTermDebtContext =
    normalizedGroup.includes("kortfristiga skulder") ||
    normalizedSection === normalizeAnnualReportStatementMatchTextV1("Skulder");

  if (input.statementSv === "Resultaträkning") {
    if (normalizedLabel.includes("nettoomsattning")) {
      return "3.1";
    }
    if (
      normalizedLabel.includes("forandring av lager") ||
      (normalizedLabel.includes("lager") &&
        normalizedLabel.includes("pagaende arbete"))
    ) {
      return "3.2";
    }
    if (normalizedLabel.includes("aktiverat arbete")) {
      return "3.3";
    }
    if (normalizedLabel.includes("ovriga rorelseintakter")) {
      return "3.4";
    }
    if (
      normalizedLabel.includes("ravaror") ||
      normalizedLabel.includes("fornodenheter")
    ) {
      return "3.5";
    }
    if (normalizedLabel.includes("handelsvaror")) {
      return "3.6";
    }
    if (normalizedLabel.includes("ovriga externa kostnader")) {
      return "3.7";
    }
    if (normalizedLabel.includes("personalkostnader")) {
      return "3.8";
    }
    if (
      normalizedLabel.includes("av och nedskrivningar") ||
      normalizedLabel.includes("avskrivningar av materiella") ||
      normalizedLabel.includes("avskrivningar av immateriella")
    ) {
      return "3.9";
    }
    if (normalizedLabel.includes("nedskrivningar av omsattningstillgangar")) {
      return "3.10";
    }
    if (normalizedLabel.includes("ovriga rorelsekostnader")) {
      return "3.11";
    }
    if (
      normalizedLabel.includes("andelar i koncernforetag") &&
      normalizedLabel.includes("resultat")
    ) {
      return "3.12";
    }
    if (
      normalizedLabel.includes("andelar i intresseforetag") &&
      normalizedLabel.includes("resultat")
    ) {
      return "3.13";
    }
    if (
      normalizedLabel.includes("ovriga foretag") &&
      normalizedLabel.includes("agarintresse")
    ) {
      return "3.14";
    }
    if (
      normalizedLabel.includes("ovriga finansiella anlaggningstillgangar") &&
      normalizedLabel.includes("resultat")
    ) {
      return "3.15";
    }
    if (normalizedLabel.includes("ranteintakt")) {
      return "3.16";
    }
    if (normalizedLabel.includes("nedskrivningar av finansiella")) {
      return "3.17";
    }
    if (normalizedLabel.includes("rantekostnad")) {
      return "3.18";
    }
    if (normalizedLabel.includes("lamnade koncernbidrag")) {
      return "3.19";
    }
    if (normalizedLabel.includes("mottagna koncernbidrag")) {
      return "3.20";
    }
    if (normalizedLabel.includes("aterforing av periodiseringsfond")) {
      return "3.21";
    }
    if (normalizedLabel.includes("avsattning till periodiseringsfond")) {
      return "3.22";
    }
    if (normalizedLabel.includes("overavskrivningar")) {
      return "3.23";
    }
    if (normalizedLabel.includes("ovriga bokslutsdispositioner")) {
      return "3.24";
    }
    if (normalizedLabel.includes("skatt pa arets resultat")) {
      return "3.25";
    }
    if (normalizedLabel.includes("arets resultat")) {
      return input.currentYearValue !== undefined && input.currentYearValue < 0
        ? "3.27"
        : "3.26";
    }

    return undefined;
  }

  if (
    normalizedLabel.includes("koncessioner") ||
    normalizedLabel.includes("goodwill") ||
    normalizedLabel.includes("hyresratter") ||
    normalizedLabel.includes("programvaror")
  ) {
    return "2.1";
  }
  if (
    normalizedLabel.includes("forskott") &&
    normalizedLabel.includes("immateriella")
  ) {
    return "2.2";
  }
  if (
    normalizedLabel.includes("byggnader") ||
    normalizedLabel.includes("mark")
  ) {
    return "2.3";
  }
  if (
    normalizedLabel.includes("maskiner") ||
    normalizedLabel.includes("inventarier") ||
    normalizedLabel.includes("datorer")
  ) {
    return "2.4";
  }
  if (normalizedLabel.includes("forbattringsutgifter")) {
    return "2.5";
  }
  if (normalizedLabel.includes("pagaende nyanlaggningar")) {
    return "2.6";
  }
  if (normalizedLabel.includes("andelar i koncernforetag")) {
    return isShortTermPlacementContext ? "2.24" : "2.7";
  }
  if (
    normalizedLabel.includes("andelar i intresseforetag") ||
    normalizedLabel.includes("gemensamt styrda")
  ) {
    return "2.8";
  }
  if (
    normalizedLabel.includes("vardepappersinnehav") ||
    normalizedLabel.includes("agarintressen i ovriga foretag")
  ) {
    return isShortTermPlacementContext ? "2.25" : "2.9";
  }
  if (
    normalizedLabel.includes("fordringar hos koncern") ||
    normalizedLabel.includes("fordringar hos intresse")
  ) {
    return isLongTermAssetContext ? "2.10" : "2.20";
  }
  if (normalizedLabel.includes("lan till delagare")) {
    return "2.11";
  }
  if (
    normalizedLabel.includes("ovriga langfristiga fordringar") ||
    normalizedLabel.includes("andra langfristiga fordringar")
  ) {
    return "2.12";
  }
  if (
    normalizedLabel.includes("ovriga fordringar") ||
    normalizedLabel.includes("fordringar hos ovriga")
  ) {
    return isLongTermAssetContext ? "2.12" : "2.21";
  }
  if (
    normalizedLabel.includes("ravaror") ||
    normalizedLabel.includes("fornodenheter")
  ) {
    return "2.13";
  }
  if (normalizedLabel.includes("varor under tillverkning")) {
    return "2.14";
  }
  if (
    normalizedLabel.includes("fardiga varor") ||
    normalizedLabel.includes("handelsvaror")
  ) {
    return "2.15";
  }
  if (normalizedLabel.includes("ovriga lagertillgangar")) {
    return "2.16";
  }
  if (
    normalizedLabel.includes("pagaende arbeten for annans rakning") &&
    !isShortTermDebtContext
  ) {
    return "2.17";
  }
  if (normalizedLabel.includes("forskott till leverantorer")) {
    return "2.18";
  }
  if (normalizedLabel.includes("kundfordringar")) {
    return "2.19";
  }
  if (normalizedLabel.includes("skattefordran")) {
    return "2.21";
  }
  if (normalizedLabel.includes("upparbetad men ej fakturerad")) {
    return "2.22";
  }
  if (normalizedLabel.includes("upparbetade ej fakturerade")) {
    return "2.22";
  }
  if (
    normalizedLabel.includes("forutbetalda kostnader") ||
    normalizedLabel.includes("upplupna intakter")
  ) {
    return "2.23";
  }
  if (normalizedLabel.includes("ovriga kortfristiga placeringar")) {
    return "2.25";
  }
  if (
    normalizedLabel.includes("kassa") ||
    normalizedLabel.includes("bank") ||
    normalizedLabel.includes("redovisningsmedel")
  ) {
    return "2.26";
  }
  if (
    normalizedLabel.includes("bundet eget kapital") ||
    normalizedLabel.includes("aktiekapital") ||
    normalizedLabel.includes("reservfond")
  ) {
    return "2.27";
  }
  if (
    normalizedLabel.includes("fritt eget kapital") ||
    normalizedLabel.includes("balanserat resultat") ||
    normalizedLabel.includes("balanserad vinst") ||
    normalizedLabel.includes("arets resultat")
  ) {
    return "2.28";
  }
  if (normalizedLabel.includes("periodiseringsfond")) {
    return "2.29";
  }
  if (normalizedLabel.includes("overavskrivningar")) {
    return "2.30";
  }
  if (normalizedLabel.includes("obeskattade reserver")) {
    return "2.31";
  }
  if (normalizedLabel.includes("ovriga obeskattade reserver")) {
    return "2.31";
  }
  if (
    normalizedLabel.includes("pensioner") &&
    normalizedLabel.includes("1967 531")
  ) {
    return "2.32";
  }
  if (
    normalizedLabel.includes("pensioner") ||
    normalizedLabel.includes("pensionsforpliktelser")
  ) {
    return "2.33";
  }
  if (normalizedLabel.includes("ovriga avsattningar")) {
    return "2.34";
  }
  if (normalizedLabel.includes("obligationslan")) {
    return "2.35";
  }
  if (normalizedLabel.includes("checkrakningskredit")) {
    return isLongTermDebtContext ? "2.36" : "2.40";
  }
  if (normalizedLabel.includes("skulder till kreditinstitut")) {
    return isLongTermDebtContext ? "2.37" : "2.41";
  }
  if (normalizedLabel.includes("ovriga langfristiga skulder")) {
    return "2.39";
  }
  if (normalizedLabel.includes("ovriga kortfristiga skulder")) {
    return "2.48";
  }
  if (
    normalizedLabel.includes("skulder till koncern") ||
    normalizedLabel.includes("skulder till intresse")
  ) {
    return isLongTermDebtContext ? "2.38" : "2.47";
  }
  if (
    normalizedLabel.includes("skulder till ovriga") ||
    normalizedLabel.includes("ovriga skulder")
  ) {
    return isLongTermDebtContext ? "2.39" : "2.48";
  }
  if (normalizedLabel.includes("forskott fran kunder")) {
    return "2.42";
  }
  if (
    normalizedLabel.includes("pagaende arbeten for annans rakning") &&
    isShortTermDebtContext
  ) {
    return "2.43";
  }
  if (normalizedLabel.includes("fakturerad men ej upparbetad")) {
    return "2.44";
  }
  if (normalizedLabel.includes("leverantorsskulder")) {
    return "2.45";
  }
  if (normalizedLabel.includes("vaxelskulder")) {
    return "2.46";
  }
  if (normalizedLabel.includes("skatteskulder")) {
    return "2.49";
  }
  if (
    normalizedLabel.includes("upplupna kostnader") ||
    normalizedLabel.includes("forutbetalda intakter")
  ) {
    return "2.50";
  }

  if (isShortTermReceivableContext && normalizedLabel.includes("fordringar")) {
    return "2.21";
  }

  return undefined;
}

function hasAnnualReportLineNumericValuesV1(
  line:
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"][number]
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["balanceSheet"][number],
): boolean {
  if (
    typeof line.currentYearValue === "number" ||
    typeof line.priorYearValue === "number"
  ) {
    return true;
  }

  return line.evidence.some((evidence) =>
    extractAnnualReportStatementSnippetAmountsV1(evidence.snippet).some(
      (value) => typeof value === "number",
    ),
  );
}

export function alignAnnualReportStatementsToInk2CodesV1(input: {
  pageTexts: string[];
  taxDeep: AnnualReportTaxDeepExtractionV1;
}): {
  taxDeep: AnnualReportTaxDeepExtractionV1;
  warnings: string[];
} {
  const alignLines = <
    TLine extends
      AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"][number],
  >(
    lines: TLine[],
    statementSv: AnnualReportStatementNameSvV1,
  ) => {
    const aligned = new Map<string, TLine>();
    const unmappedLabels = new Set<string>();

    for (const line of lines) {
      const label = line.label.trim();
      if (
        label.length === 0 ||
        isAnnualReportSummaryLineV1({
          label,
          statementSv,
          currentYearValue: line.currentYearValue,
        })
      ) {
        continue;
      }
      // Ignore valueless placeholder rows so dash-only statement labels do not
      // masquerade as real unmapped findings in the balance rebuild.
      if (!hasAnnualReportLineNumericValuesV1(line)) {
        continue;
      }
      const context = resolveAnnualReportStatementContextFromPageTextV1({
        evidence: line.evidence,
        label,
        pageTexts: input.pageTexts,
      });
      const exactCandidates = resolveAnnualReportCodeCandidatesByLabelV1({
        label,
        statementSv,
      });
      const exactMatch = selectAnnualReportCodeByContextV1({
        candidates: exactCandidates,
        context,
      });
      const resolvedCode =
        exactMatch?.code ??
        resolveAnnualReportCodeByHeuristicV1({
          context,
          currentYearValue: line.currentYearValue,
          label,
          statementSv,
        });

      if (!resolvedCode) {
        unmappedLabels.add(label);
        continue;
      }

      const codeDefinition = getAnnualReportCodeDefinitionV1(resolvedCode);
      if (!codeDefinition) {
        unmappedLabels.add(label);
        continue;
      }

      const existing = aligned.get(resolvedCode);
      const nextLine = {
        ...line,
        code: resolvedCode,
        label: codeDefinition.labelSv,
        evidence: dedupeAnnualReportEvidenceV1(line.evidence),
      } satisfies TLine;

      if (!existing) {
        aligned.set(resolvedCode, nextLine);
        continue;
      }

      aligned.set(resolvedCode, {
        ...existing,
        currentYearValue: sumOptionalAnnualReportAmountsV1(
          existing.currentYearValue,
          nextLine.currentYearValue,
        ),
        priorYearValue: sumOptionalAnnualReportAmountsV1(
          existing.priorYearValue,
          nextLine.priorYearValue,
        ),
        evidence: dedupeAnnualReportEvidenceV1([
          ...existing.evidence,
          ...nextLine.evidence,
        ]),
      } satisfies TLine);
    }

    const alignedLines = [...aligned.values()].sort(
      (left, right) =>
        getAnnualReportCodeOrderV1(left.code) -
        getAnnualReportCodeOrderV1(right.code),
    );
    const warnings =
      alignedLines.length > 0 && unmappedLabels.size > 0
        ? [
            `statement_alignment.${statementSv === "Balansräkning" ? "balance_sheet" : "income_statement"}.unmapped=${[
              ...unmappedLabels,
            ]
              .slice(0, 8)
              .join(" | ")}`,
          ]
        : [];

    return {
      lines: alignedLines.length > 0 ? alignedLines : lines,
      warnings,
    };
  };

  const incomeStatement = alignLines(
    input.taxDeep.ink2rExtracted.incomeStatement,
    "Resultaträkning",
  );
  const balanceSheet = alignLines(
    input.taxDeep.ink2rExtracted.balanceSheet,
    "Balansräkning",
  );

  return {
    taxDeep: {
      ...input.taxDeep,
      ink2rExtracted: {
        ...input.taxDeep.ink2rExtracted,
        incomeStatement: incomeStatement.lines,
        balanceSheet: balanceSheet.lines,
      },
    },
    warnings: [...incomeStatement.warnings, ...balanceSheet.warnings],
  };
}

function normalizeAnnualReportValueWithEvidenceV1<
  TValue extends {
    currency?: string;
    evidence: Array<unknown>;
    value?: number;
  },
>(value: TValue | undefined, multiplier: number): TValue | undefined {
  if (!value || value.value === undefined || multiplier === 1) {
    return value;
  }

  return {
    ...value,
    currency: "SEK",
    value: value.value * multiplier,
  };
}

function extractAnnualReportStatementSnippetAmountsV1(
  snippet: string | undefined,
): Array<number | undefined> {
  if (typeof snippet !== "string" || snippet.trim().length === 0) {
    return [];
  }

  const normalized = snippet.replace(/\u00a0/g, " ").replace(/[−–—]/g, "-");
  const groupMatches = normalized.match(/-?\d{1,3}/g) ?? [];
  const parseAmountTokens = (tokens: string[]): number | undefined => {
    if (tokens.length === 0) {
      return undefined;
    }
    if (
      !tokens.slice(1).every((token) => token.replace("-", "").length === 3)
    ) {
      return undefined;
    }

    const parsed = Number(tokens.join(""));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const prefixLooksLikeNoteRefs = (tokens: string[]): boolean =>
    tokens.every((token) => {
      const digits = token.replace("-", "");
      return !token.startsWith("-") && digits.length <= 2;
    });
  const hasTrailingDash = /(?:^|\s)-\s*$/.test(normalized);
  const hasLeadingStandaloneDashBeforeSuffix =
    !hasTrailingDash && /(?:^|\s)-\s+\d{1,3}(?:\s\d{3})+\s*$/.test(normalized);

  if (hasTrailingDash && groupMatches.length >= 2) {
    for (
      let amountGroupCount = Math.min(3, groupMatches.length);
      amountGroupCount >= 1;
      amountGroupCount -= 1
    ) {
      const amountTokens = groupMatches.slice(
        groupMatches.length - amountGroupCount,
      );
      const prefixTokens = groupMatches.slice(
        0,
        groupMatches.length - amountGroupCount,
      );
      const parsed = parseAmountTokens(amountTokens);
      if (
        parsed !== undefined &&
        (prefixTokens.length === 0 || prefixLooksLikeNoteRefs(prefixTokens))
      ) {
        return [parsed];
      }
    }
  }

  const parseRemainingTokens = (
    remainingTokens: string[],
  ): Array<number | undefined> | undefined => {
    if (remainingTokens.length === 0 || remainingTokens.length > 6) {
      return undefined;
    }

    if (hasLeadingStandaloneDashBeforeSuffix && remainingTokens.length >= 2) {
      const priorOnlyAmount = parseAmountTokens(remainingTokens);
      if (priorOnlyAmount !== undefined) {
        return [undefined, priorOnlyAmount];
      }
    }

    if (remainingTokens.length === 1) {
      const parsed = parseAmountTokens(remainingTokens);
      return parsed === undefined ? undefined : [parsed];
    }

    if (remainingTokens.length === 2) {
      const currentAmount = parseAmountTokens([remainingTokens[0]!]);
      const priorAmount = parseAmountTokens([remainingTokens[1]!]);
      if (currentAmount === undefined || priorAmount === undefined) {
        return undefined;
      }
      return [currentAmount, priorAmount];
    }

    const currentGroupCount =
      remainingTokens.length === 3
        ? 2
        : remainingTokens.length === 4
          ? 2
          : remainingTokens.length === 5
            ? 3
            : 3;
    const priorGroupCount = remainingTokens.length - currentGroupCount;
    const currentAmount = parseAmountTokens(
      remainingTokens.slice(0, currentGroupCount),
    );
    const priorAmount = parseAmountTokens(
      remainingTokens.slice(currentGroupCount),
    );
    if (currentAmount === undefined || priorAmount === undefined) {
      return undefined;
    }
    return [currentAmount, priorAmount];
  };

  let bestCandidate:
    | {
        amounts: Array<number | undefined>;
        score: number;
      }
    | undefined;
  const maxPrefixLength = Math.min(3, Math.max(0, groupMatches.length - 1));
  for (
    let prefixLength = 0;
    prefixLength <= maxPrefixLength;
    prefixLength += 1
  ) {
    const prefixTokens = groupMatches.slice(0, prefixLength);
    if (prefixTokens.length > 0 && !prefixLooksLikeNoteRefs(prefixTokens)) {
      continue;
    }

    const candidate = parseRemainingTokens(groupMatches.slice(prefixLength));
    if (!candidate || candidate.length === 0) {
      continue;
    }

    const score =
      (prefixTokens.length > 0 ? 40 - prefixTokens.length * 8 : 18) +
      candidate.filter((value) => typeof value === "number").length * 14 -
      Math.abs(
        (candidate[0] === undefined ? 0 : 1) -
          (candidate[1] === undefined ? 0 : 1),
      );
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = {
        amounts: candidate,
        score,
      };
    }
  }

  if (bestCandidate) {
    return bestCandidate.amounts;
  }

  if (groupMatches.length === 2) {
    const parsed = parseAmountTokens(groupMatches);
    return parsed === undefined ? [] : [parsed];
  }
  if (
    groupMatches.length === 3 &&
    groupMatches[0]?.replace("-", "").length === 2
  ) {
    const parsed = parseAmountTokens(groupMatches.slice(1));
    return parsed === undefined ? [] : [parsed];
  }
  if (
    groupMatches.length === 4 &&
    groupMatches[0]?.replace("-", "").length === 2 &&
    groupMatches[1]?.replace("-", "").length === 1
  ) {
    const parsed = parseAmountTokens(groupMatches.slice(1));
    return parsed === undefined ? [] : [parsed];
  }

  return [];
}

function cleanAnnualReportStatementLabelV1(value: string): string {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  while (
    tokens.length > 0 &&
    /^\d+(?:,\d+)?(?:-\d+)?$/.test(tokens[tokens.length - 1] ?? "")
  ) {
    tokens.pop();
  }

  return tokens
    .join(" ")
    .replace(/[-,:;]+$/g, "")
    .trim();
}

function listNormalizedAnnualReportPageLinesV1(pageText: string): string[] {
  return pageText
    .split(/\r?\n/)
    .map((line) => normalizeAnnualReportStatementMatchTextV1(line))
    .filter((line) => line.length > 0);
}

function refineAnnualReportStatementPagesV1(input: {
  pageTexts: string[];
  pages: number[];
  statement: "income" | "balance";
}): number[] {
  if (input.pages.length <= 1) {
    return input.pages;
  }

  const anchorMatchers =
    input.statement === "income"
      ? [
          /^resultatrakning\b/i,
          /^rorelsens intakter\b/i,
          /^rorelsens kostnader\b/i,
          /^finansiella poster\b/i,
        ]
      : [
          /^balansrakning\b/i,
          /^tillgangar\b/i,
          /^eget kapital och skulder\b/i,
          /^kortfristiga skulder\b/i,
        ];
  const stopMatchers =
    input.statement === "income"
      ? [/^balansrakning\b/i, /^tillgangar\b/i, /^eget kapital och skulder\b/i]
      : [/^not\s+\d+\b/i, /^noter\b/i];

  const normalizedPages = [...new Set(input.pages)].sort(
    (left, right) => left - right,
  );
  let anchorIndex = -1;
  for (let index = 0; index < normalizedPages.length; index += 1) {
    const page = normalizedPages[index]!;
    const lines = listNormalizedAnnualReportPageLinesV1(
      input.pageTexts[page - 1] ?? "",
    );
    if (
      lines.some((line) => anchorMatchers.some((matcher) => matcher.test(line)))
    ) {
      anchorIndex = index;
      break;
    }
  }

  if (anchorIndex === -1) {
    return normalizedPages;
  }

  const refined: number[] = [];
  for (let index = anchorIndex; index < normalizedPages.length; index += 1) {
    const page = normalizedPages[index]!;
    const lines = listNormalizedAnnualReportPageLinesV1(
      input.pageTexts[page - 1] ?? "",
    );
    if (
      index > anchorIndex &&
      lines.some((line) => stopMatchers.some((matcher) => matcher.test(line)))
    ) {
      break;
    }
    refined.push(page);
  }

  return refined.length > 0 ? refined : normalizedPages;
}

function formatAnnualReportSelectedPagesV1(pages: number[]): string {
  const normalizedPages = [...new Set(pages)].sort(
    (left, right) => left - right,
  );
  if (normalizedPages.length === 0) {
    return "none";
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let start = normalizedPages[0]!;
  let end = normalizedPages[0]!;
  for (const page of normalizedPages.slice(1)) {
    if (page === end + 1) {
      end = page;
      continue;
    }
    ranges.push({ start, end });
    start = page;
    end = page;
  }
  ranges.push({ start, end });

  return ranges
    .map((range) =>
      range.start === range.end
        ? `${range.start}`
        : `${range.start}-${range.end}`,
    )
    .join(", ");
}

function buildDeterministicStatementLinesFromPageTextV1(input: {
  pageTexts: string[];
  pages: number[];
  statement: "income" | "balance";
}): AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"] {
  const lines: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"] =
    [];
  let currentSectionLabel: string | undefined;

  for (const page of input.pages) {
    const pageLines = (input.pageTexts[page - 1] ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    let statementRegionStarted = input.statement === "income";

    for (const line of pageLines) {
      const normalizedLine = normalizeAnnualReportStatementMatchTextV1(line);
      // Proposal/disposition pages can appear adjacent to the statements in some
      // PDFs; keep the rebuild scoped to the actual statement body even if an
      // upstream page window is broader than intended.
      if (
        normalizedLine.includes("forslag till vinstdisposition") ||
        normalizedLine.includes("arsstammans forfogande star") ||
        normalizedLine.includes("styrelsen foreslar att") ||
        normalizedLine.includes("till aktieagarna utdelas") ||
        normalizedLine.includes("i ny rakning balanseras")
      ) {
        continue;
      }

      if (input.statement === "balance" && !statementRegionStarted) {
        if (
          normalizedLine === "tillgangar" ||
          normalizedLine.startsWith("eget kapital och skulder")
        ) {
          statementRegionStarted = true;
          currentSectionLabel = undefined;
          continue;
        }

        continue;
      }

      if (
        normalizedLine.length === 0 ||
        normalizedLine.startsWith("resultatrakning") ||
        normalizedLine.startsWith("balansrakning") ||
        normalizedLine.startsWith("belopp i ") ||
        normalizedLine.startsWith("deloitte ab") ||
        normalizedLine.startsWith("org nr") ||
        /^\d{4}-\d{2}-\d{2}\b/.test(line) ||
        normalizedLine.startsWith("not 20") ||
        normalizedLine === "tillgangar" ||
        normalizedLine === "eget kapital och skulder"
      ) {
        continue;
      }

      const amounts = extractAnnualReportStatementSnippetAmountsV1(line);
      if (amounts.length === 0) {
        currentSectionLabel = cleanAnnualReportStatementLabelV1(line);
        continue;
      }

      const amountSuffixMatch = line.match(
        /(-?\d{1,3}(?:\s\d{3})+?(?:\s+-?\d{1,3}(?:\s\d{3})+?)?)$/,
      );
      const labelRaw = amountSuffixMatch
        ? line.slice(0, amountSuffixMatch.index).trim()
        : line;
      const cleanedLabel = cleanAnnualReportStatementLabelV1(labelRaw);
      const label =
        cleanedLabel.length > 0
          ? cleanedLabel
          : labelRaw.length === 0 && currentSectionLabel
            ? currentSectionLabel.startsWith("Summa ")
              ? currentSectionLabel
              : `Summa ${currentSectionLabel}`
            : "";
      if (label.length === 0) {
        continue;
      }

      lines.push({
        code: label,
        label,
        currentYearValue: amounts[0],
        priorYearValue: amounts[1],
        evidence: [{ snippet: line, page }],
      });
    }
  }

  return lines;
}

function resolveAnnualReportStatementUnitFromPageTextsV1(input: {
  pageTexts: string[];
  pages: number[];
}): AnnualReportAmountUnitV1 | undefined {
  for (const page of input.pages) {
    const text = (input.pageTexts[page - 1] ?? "").toLowerCase();
    if (text.includes("belopp i msek") || text.includes("amounts in msek")) {
      return "msek";
    }
    if (text.includes("belopp i ksek") || text.includes("amounts in ksek")) {
      return "ksek";
    }
    if (text.includes("belopp i sek") || text.includes("amounts in sek")) {
      return "sek";
    }
  }

  return undefined;
}

function buildAnnualReportStatementEvidenceFromPagesV1(input: {
  label: string;
  pageTexts: string[];
  pages: number[];
}): Array<{ snippet: string; page?: number }> {
  const normalizedLabel = normalizeAnnualReportStatementMatchTextV1(
    input.label,
  );
  if (normalizedLabel.length === 0) {
    return [];
  }

  for (const page of input.pages) {
    const lines = (input.pageTexts[page - 1] ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const normalizedLine = normalizeAnnualReportStatementMatchTextV1(line);
      if (
        !normalizedLine.includes(normalizedLabel) &&
        !normalizedLabel.includes(normalizedLine)
      ) {
        continue;
      }

      const nextLine = lines[index + 1];
      const shouldAvoidConcatenation =
        isAnnualReportContextHeadingV1(normalizedLabel) ||
        normalizedLabel.startsWith("summa ");
      const snippet =
        extractAnnualReportStatementSnippetAmountsV1(line).length > 0 ||
        !nextLine ||
        shouldAvoidConcatenation
          ? line
          : `${line} ${nextLine}`;
      return [{ snippet, page }];
    }
  }

  return [];
}

export function hydrateAnnualReportStatementEvidenceFromPageTextV1(input: {
  taxDeep: AnnualReportTaxDeepExtractionV1;
  pageTexts: string[];
  incomeStatementRanges: Array<{ startPage: number; endPage: number }>;
  balanceSheetRanges: Array<{ startPage: number; endPage: number }>;
}): AnnualReportTaxDeepExtractionV1 {
  if (input.pageTexts.length === 0) {
    return input.taxDeep;
  }

  const toPages = (ranges: Array<{ startPage: number; endPage: number }>) => {
    const pages: number[] = [];
    for (const range of ranges) {
      for (let page = range.startPage; page <= range.endPage; page += 1) {
        if (page >= 1 && page <= input.pageTexts.length) {
          pages.push(page);
        }
      }
    }
    return [...new Set(pages)];
  };

  const incomeStatementPages = toPages(input.incomeStatementRanges);
  const balanceSheetPages = toPages(input.balanceSheetRanges);
  const refinedIncomeStatementPages = refineAnnualReportStatementPagesV1({
    pageTexts: input.pageTexts,
    pages: incomeStatementPages,
    statement: "income",
  });
  const refinedBalanceSheetPages = refineAnnualReportStatementPagesV1({
    pageTexts: input.pageTexts,
    pages: balanceSheetPages,
    statement: "balance",
  });
  const statementPages = [
    ...new Set([...incomeStatementPages, ...balanceSheetPages]),
  ];
  const shouldReplaceWithDeterministicIncome =
    input.taxDeep.ink2rExtracted.incomeStatement.length === 0 ||
    input.taxDeep.ink2rExtracted.incomeStatement.every(
      (line) =>
        line.code === "unclassified_line" || line.label === "Unknown line",
    );
  const shouldReplaceWithDeterministicBalance =
    input.taxDeep.ink2rExtracted.balanceSheet.length === 0 ||
    input.taxDeep.ink2rExtracted.balanceSheet.every(
      (line) =>
        line.code === "unclassified_line" || line.label === "Unknown line",
    );

  const hydrateLines = <
    TLine extends {
      label: string;
      currentYearValue?: number;
      priorYearValue?: number;
      evidence: Array<{ snippet: string; page?: number }>;
    },
  >(
    lines: TLine[],
    pages: number[],
  ): TLine[] =>
    lines.map((line) => {
      const scopedEvidence =
        pages.length === 0
          ? line.evidence
          : line.evidence.filter(
              (evidence) =>
                evidence.page === undefined || pages.includes(evidence.page),
            );
      const hasRecoverableEvidence = scopedEvidence.some(
        (evidence) =>
          extractAnnualReportStatementSnippetAmountsV1(evidence.snippet)
            .length > 0,
      );
      const shouldHydrate =
        scopedEvidence.length === 0 ||
        scopedEvidence.length !== line.evidence.length ||
        ((!hasRecoverableEvidence ||
          line.currentYearValue === undefined ||
          line.priorYearValue === undefined) &&
          pages.length > 0);
      const hydratedEvidence = buildAnnualReportStatementEvidenceFromPagesV1({
        label: line.label,
        pageTexts: input.pageTexts,
        pages,
      });
      const preferredEvidence =
        hydratedEvidence.length > 0 ? hydratedEvidence : scopedEvidence;

      if (!shouldHydrate && preferredEvidence.length === line.evidence.length) {
        return line;
      }

      return recoverAnnualReportStatementLineValuesV1(
        {
          ...line,
          evidence: preferredEvidence,
        },
        {
          preferEvidenceValues: hydratedEvidence.length > 0,
        },
      );
    });

  return {
    ...input.taxDeep,
    ink2rExtracted: {
      ...input.taxDeep.ink2rExtracted,
      statementUnit:
        input.taxDeep.ink2rExtracted.statementUnit ??
        resolveAnnualReportStatementUnitFromPageTextsV1({
          pageTexts: input.pageTexts,
          pages: statementPages,
        }),
      incomeStatement: shouldReplaceWithDeterministicIncome
        ? buildDeterministicStatementLinesFromPageTextV1({
            pageTexts: input.pageTexts,
            pages: refinedIncomeStatementPages,
            statement: "income",
          })
        : hydrateLines(
            input.taxDeep.ink2rExtracted.incomeStatement,
            refinedIncomeStatementPages,
          ),
      balanceSheet: shouldReplaceWithDeterministicBalance
        ? buildDeterministicStatementLinesFromPageTextV1({
            pageTexts: input.pageTexts,
            pages: refinedBalanceSheetPages,
            statement: "balance",
          })
        : hydrateLines(
            input.taxDeep.ink2rExtracted.balanceSheet,
            refinedBalanceSheetPages,
          ),
    },
  };
}

function recoverAnnualReportStatementLineValuesV1<
  TLine extends {
    currentYearValue?: number;
    priorYearValue?: number;
    evidence?: Array<{ snippet: string }>;
  },
>(
  line: TLine,
  options?: {
    preferEvidenceValues?: boolean;
  },
): TLine {
  const evidenceWithAmounts = (line.evidence ?? [])
    .map((evidence) => ({
      snippet: evidence.snippet,
      amounts: extractAnnualReportStatementSnippetAmountsV1(evidence.snippet),
    }))
    .find((entry) => entry.amounts.length > 0);
  const snippetAmounts = evidenceWithAmounts?.amounts;

  if (
    options?.preferEvidenceValues &&
    snippetAmounts &&
    snippetAmounts.length > 0
  ) {
    return {
      ...line,
      currentYearValue: snippetAmounts[0],
      priorYearValue: snippetAmounts[1],
    };
  }

  if (
    typeof line.currentYearValue === "number" &&
    typeof line.priorYearValue === "number" &&
    (!evidenceWithAmounts ||
      evidenceWithAmounts.amounts.length !== 1 ||
      !/(?:^|\s)-\s*$/.test(
        evidenceWithAmounts.snippet
          .replace(/\u00a0/g, " ")
          .replace(/[−–—]/g, "-"),
      ))
  ) {
    return line;
  }

  if (!snippetAmounts || snippetAmounts.length === 0) {
    return line;
  }

  if (snippetAmounts.length === 1) {
    return {
      ...line,
      currentYearValue: snippetAmounts[0],
      priorYearValue: undefined,
    };
  }

  const currentYearValue =
    line.currentYearValue ??
    (snippetAmounts.length >= 2
      ? snippetAmounts[snippetAmounts.length - 2]
      : snippetAmounts[0]);
  const priorYearValue =
    line.priorYearValue ??
    (snippetAmounts.length >= 2
      ? snippetAmounts[snippetAmounts.length - 1]
      : undefined);

  return {
    ...line,
    currentYearValue,
    priorYearValue,
  };
}

function normalizeAnnualReportStatementLinesV1<
  TLine extends {
    currentYearValue?: number;
    priorYearValue?: number;
    evidence?: Array<{ snippet: string }>;
  },
>(lines: TLine[], multiplier: number): TLine[] {
  return lines.map((line) => {
    const recoveredLine = recoverAnnualReportStatementLineValuesV1(line);
    if (multiplier === 1) {
      return recoveredLine;
    }

    return {
      ...recoveredLine,
      currentYearValue:
        recoveredLine.currentYearValue === undefined
          ? undefined
          : recoveredLine.currentYearValue * multiplier,
      priorYearValue:
        recoveredLine.priorYearValue === undefined
          ? undefined
          : recoveredLine.priorYearValue * multiplier,
    };
  });
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
      line.openingBalance === undefined
        ? undefined
        : line.openingBalance * multiplier,
    movementForYear:
      line.movementForYear === undefined
        ? undefined
        : line.movementForYear * multiplier,
    closingBalance:
      line.closingBalance === undefined
        ? undefined
        : line.closingBalance * multiplier,
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
        typeof candidate.page === "number" &&
        Number.isInteger(candidate.page) &&
        candidate.page > 0
          ? candidate.page
          : undefined,
      section:
        typeof candidate.section === "string" &&
        candidate.section.trim().length > 0
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
    ? candidate.evidence.flatMap((entry) =>
        sanitizeAnnualReportEvidenceReferenceV1(entry),
      )
    : sanitizeAnnualReportEvidenceReferenceV1(candidate);

  if (
    numericValue === undefined &&
    evidence.length === 0 &&
    !(
      typeof candidate.currency === "string" &&
      candidate.currency.trim().length > 0
    )
  ) {
    return undefined;
  }

  return {
    value: numericValue,
    currency:
      typeof candidate.currency === "string" &&
      candidate.currency.trim().length > 0
        ? candidate.currency.trim()
        : undefined,
    evidence,
  };
}

function sanitizeAnnualReportNotesV1(values: unknown[]): string[] {
  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

function sanitizeAnnualReportAssetLinesV1(
  values: unknown[],
): AnnualReportTaxDeepExtractionV1["assetMovements"]["lines"] {
  return values
    .filter(
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    )
    .map((line) => ({
      assetArea:
        typeof line.assetArea === "string" && line.assetArea.trim().length > 0
          ? line.assetArea.trim()
          : "Unspecified asset area",
      openingCarryingAmount:
        typeof line.openingCarryingAmount === "number" &&
        Number.isFinite(line.openingCarryingAmount)
          ? line.openingCarryingAmount
          : undefined,
      acquisitions:
        typeof line.acquisitions === "number" &&
        Number.isFinite(line.acquisitions)
          ? line.acquisitions
          : undefined,
      disposals:
        typeof line.disposals === "number" && Number.isFinite(line.disposals)
          ? line.disposals
          : undefined,
      depreciationForYear:
        typeof line.depreciationForYear === "number" &&
        Number.isFinite(line.depreciationForYear)
          ? line.depreciationForYear
          : undefined,
      impairmentForYear:
        typeof line.impairmentForYear === "number" &&
        Number.isFinite(line.impairmentForYear)
          ? line.impairmentForYear
          : undefined,
      closingCarryingAmount:
        typeof line.closingCarryingAmount === "number" &&
        Number.isFinite(line.closingCarryingAmount)
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
        ? line.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    }));
}

function sanitizeAnnualReportReserveLinesV1(
  values: unknown[],
): AnnualReportTaxDeepExtractionV1["reserveContext"]["movements"] {
  return values
    .filter(
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    )
    .map((line) => ({
      reserveType:
        typeof line.reserveType === "string" &&
        line.reserveType.trim().length > 0
          ? line.reserveType.trim()
          : "Unspecified reserve",
      openingBalance:
        typeof line.openingBalance === "number" &&
        Number.isFinite(line.openingBalance)
          ? line.openingBalance
          : undefined,
      movementForYear:
        typeof line.movementForYear === "number" &&
        Number.isFinite(line.movementForYear)
          ? line.movementForYear
          : undefined,
      closingBalance:
        typeof line.closingBalance === "number" &&
        Number.isFinite(line.closingBalance)
          ? line.closingBalance
          : undefined,
      priorYearClosingBalance:
        typeof line.priorYearClosingBalance === "number" &&
        Number.isFinite(line.priorYearClosingBalance)
          ? line.priorYearClosingBalance
          : undefined,
      evidence: Array.isArray(line.evidence)
        ? line.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    }));
}

export function sanitizeAnnualReportTaxDeepV1(
  taxDeep: AnnualReportTaxDeepExtractionV1,
): AnnualReportTaxDeepExtractionV1 {
  const raw = taxDeep as unknown as Record<string, unknown>;
  const depreciationContext =
    typeof raw.depreciationContext === "object" &&
    raw.depreciationContext !== null
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
    typeof raw.netInterestContext === "object" &&
    raw.netInterestContext !== null
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
    typeof raw.shareholdingContext === "object" &&
    raw.shareholdingContext !== null
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
        ...(Array.isArray(
          depreciationContext.depreciationOnTangibleAndIntangibleAssets,
        )
          ? depreciationContext.depreciationOnTangibleAndIntangibleAssets
          : []),
      ]),
      evidence: Array.isArray(depreciationContext.evidence)
        ? depreciationContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    },
    assetMovements: {
      lines: sanitizeAnnualReportAssetLinesV1([
        ...(Array.isArray(assetMovements.lines) ? assetMovements.lines : []),
        ...(Array.isArray(assetMovements.tangibleAssets)
          ? assetMovements.tangibleAssets
          : []),
        ...(Array.isArray(assetMovements.intangibleAssets)
          ? assetMovements.intangibleAssets
          : []),
      ]),
      evidence: Array.isArray(assetMovements.evidence)
        ? assetMovements.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    },
    reserveContext: {
      movements: sanitizeAnnualReportReserveLinesV1([
        ...(Array.isArray(reserveContext.movements)
          ? reserveContext.movements
          : []),
        ...(Array.isArray(reserveContext.untaxedReserves)
          ? reserveContext.untaxedReserves
          : []),
      ]),
      notes: sanitizeAnnualReportNotesV1([
        ...(Array.isArray(reserveContext.notes) ? reserveContext.notes : []),
        ...(Array.isArray(reserveContext.appropriations)
          ? reserveContext.appropriations
          : []),
      ]),
      evidence: Array.isArray(reserveContext.evidence)
        ? reserveContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    },
    netInterestContext: {
      financeIncome:
        sanitizeAnnualReportValueWithEvidenceV1(
          netInterestContext.financeIncome,
        ) ??
        sanitizeAnnualReportValueWithEvidenceV1(
          netInterestContext.otherFinancialIncome,
        ),
      financeExpense:
        sanitizeAnnualReportValueWithEvidenceV1(
          netInterestContext.financeExpense,
        ) ??
        sanitizeAnnualReportValueWithEvidenceV1(
          netInterestContext.otherFinancialExpense,
        ),
      interestIncome: sanitizeAnnualReportValueWithEvidenceV1(
        netInterestContext.interestIncome,
      ),
      interestExpense: sanitizeAnnualReportValueWithEvidenceV1(
        netInterestContext.interestExpense,
      ),
      netInterest: sanitizeAnnualReportValueWithEvidenceV1(
        netInterestContext.netInterest,
      ),
      notes: sanitizeAnnualReportNotesV1(
        Array.isArray(netInterestContext.notes) ? netInterestContext.notes : [],
      ),
      evidence: Array.isArray(netInterestContext.evidence)
        ? netInterestContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : [],
    },
    pensionContext: {
      specialPayrollTax: sanitizeAnnualReportValueWithEvidenceV1(
        pensionContext.specialPayrollTax,
      ),
      flags: taxDeep.pensionContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.pensionContext.notes,
        ...(Array.isArray(pensionContext.pensionCosts)
          ? pensionContext.pensionCosts
          : []),
        ...(Array.isArray(pensionContext.pensionObligations)
          ? pensionContext.pensionObligations
          : []),
      ]),
      evidence: Array.isArray(pensionContext.evidence)
        ? pensionContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : taxDeep.pensionContext.evidence,
    },
    taxExpenseContext: taxExpenseContext
      ? {
          currentTax:
            sanitizeAnnualReportValueWithEvidenceV1(
              taxExpenseContext.currentTax,
            ) ??
            sanitizeAnnualReportValueWithEvidenceV1(
              taxExpenseContext.recognizedTax,
            ),
          deferredTax: sanitizeAnnualReportValueWithEvidenceV1(
            taxExpenseContext.deferredTax,
          ),
          totalTaxExpense: sanitizeAnnualReportValueWithEvidenceV1(
            taxExpenseContext.totalTaxExpense,
          ),
          notes: sanitizeAnnualReportNotesV1([
            ...(Array.isArray(taxExpenseContext.notes)
              ? taxExpenseContext.notes
              : []),
            ...(Array.isArray(taxExpenseContext.reconciliation)
              ? taxExpenseContext.reconciliation
              : []),
          ]),
          evidence: [
            ...(Array.isArray(taxExpenseContext.evidence)
              ? taxExpenseContext.evidence.flatMap((entry) =>
                  sanitizeAnnualReportEvidenceReferenceV1(entry),
                )
              : []),
            ...sanitizeAnnualReportEvidenceReferenceV1(
              taxExpenseContext.recognizedTax,
            ),
            ...sanitizeAnnualReportEvidenceReferenceV1(
              taxExpenseContext.totalTaxExpense,
            ),
          ],
        }
      : undefined,
    leasingContext: {
      flags: taxDeep.leasingContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.leasingContext.notes,
        ...(Array.isArray(leasingContext.leasingCosts)
          ? leasingContext.leasingCosts
          : []),
        ...(Array.isArray(leasingContext.leasingExpenses)
          ? leasingContext.leasingExpenses
          : []),
        ...(Array.isArray(leasingContext.futureLeasingCommitments)
          ? leasingContext.futureLeasingCommitments
          : []),
        ...(Array.isArray(leasingContext.leasingObligations)
          ? leasingContext.leasingObligations
          : []),
      ]),
      evidence: Array.isArray(leasingContext.evidence)
        ? leasingContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
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
        ? groupContributionContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : taxDeep.groupContributionContext.evidence,
    },
    shareholdingContext: {
      dividendsReceived: sanitizeAnnualReportValueWithEvidenceV1(
        shareholdingContext.dividendsReceived,
      ),
      dividendsPaid: sanitizeAnnualReportValueWithEvidenceV1(
        shareholdingContext.dividendsPaid,
      ),
      flags: taxDeep.shareholdingContext.flags,
      notes: sanitizeAnnualReportNotesV1([
        ...taxDeep.shareholdingContext.notes,
        ...(Array.isArray(shareholdingContext.dividends)
          ? shareholdingContext.dividends
          : []),
        ...(Array.isArray(shareholdingContext.proposedDividend)
          ? shareholdingContext.proposedDividend
          : []),
        ...(Array.isArray(shareholdingContext.financialAssets)
          ? shareholdingContext.financialAssets
          : []),
        ...(Array.isArray(shareholdingContext.participationsInGroupCompanies)
          ? shareholdingContext.participationsInGroupCompanies
          : []),
        ...(Array.isArray(
          shareholdingContext.participationsInAssociatedCompanies,
        )
          ? shareholdingContext.participationsInAssociatedCompanies
          : []),
        ...(Array.isArray(shareholdingContext.otherLongTermSecurities)
          ? shareholdingContext.otherLongTermSecurities
          : []),
      ]),
      evidence: Array.isArray(shareholdingContext.evidence)
        ? shareholdingContext.evidence.flatMap((entry) =>
            sanitizeAnnualReportEvidenceReferenceV1(entry),
          )
        : taxDeep.shareholdingContext.evidence,
    },
    relevantNotes: Array.isArray(raw.relevantNotes)
      ? raw.relevantNotes
          .filter(
            (
              value,
            ): value is NonNullable<AnnualReportTaxDeepExtractionV1["relevantNotes"]>[number] =>
              typeof value === "object" && value !== null,
          )
          .map((note) => ({
            category: note.category,
            title: typeof note.title === "string" ? note.title : undefined,
            noteReference:
              typeof note.noteReference === "string"
                ? note.noteReference
                : undefined,
            pages: Array.isArray(note.pages)
              ? note.pages.filter(
                  (page): page is number =>
                    typeof page === "number" &&
                    Number.isInteger(page) &&
                    page > 0,
                )
              : [],
            notes: sanitizeAnnualReportNotesV1(
              Array.isArray(note.notes) ? note.notes : [],
            ),
            evidence: Array.isArray(note.evidence)
              ? note.evidence.flatMap((entry) =>
                  sanitizeAnnualReportEvidenceReferenceV1(entry),
                )
              : [],
          }))
      : taxDeep.relevantNotes,
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

function collectAnnualReportPagesFromRangesV1(input: {
  maxPage: number;
  ranges: Array<{ startPage: number; endPage: number }>;
}): number[] {
  const pages = new Set<number>();
  for (const range of input.ranges) {
    const startPage = Math.max(1, Math.min(input.maxPage, range.startPage));
    const endPage = Math.max(1, Math.min(input.maxPage, range.endPage));
    for (
      let page = Math.min(startPage, endPage);
      page <= Math.max(startPage, endPage);
      page += 1
    ) {
      pages.add(page);
    }
  }
  return [...pages].sort((left, right) => left - right);
}

function calculateAnnualReportBalanceControlFromLinesV1(
  lines: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["balanceSheet"],
): {
  currentAssets: number;
  currentDifference: number;
  currentEquityAndLiabilities: number;
} {
  let currentAssets = 0;
  let currentEquityAndLiabilities = 0;
  for (const line of lines) {
    if (isAnnualReportBalanceAssetCodeV1(line.code)) {
      currentAssets += line.currentYearValue ?? 0;
    }
    if (isAnnualReportBalanceEquityLiabilityCodeV1(line.code)) {
      currentEquityAndLiabilities += line.currentYearValue ?? 0;
    }
  }

  return {
    currentAssets,
    currentDifference: currentAssets - currentEquityAndLiabilities,
    currentEquityAndLiabilities,
  };
}

function countAnnualReportStatementPopulatedValuesV1(
  lines:
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"]
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["balanceSheet"],
): number {
  return lines.reduce((count, line) => {
    let nextCount = count;
    if (typeof line.currentYearValue === "number") {
      nextCount += 1;
    }
    if (typeof line.priorYearValue === "number") {
      nextCount += 1;
    }
    return nextCount;
  }, 0);
}

function hasAnnualReportEvidenceOutsidePagesV1(
  lines:
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"]
    | AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["balanceSheet"],
  pages: number[],
): boolean {
  if (pages.length === 0) {
    return false;
  }

  return lines.some((line) =>
    line.evidence.some(
      (evidence) =>
        typeof evidence.page === "number" && !pages.includes(evidence.page),
    ),
  );
}

function extractProfitBeforeTaxFromStatementLinesV1(input: {
  statementUnit?: AnnualReportAmountUnitV1;
  lines: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"];
}): number | undefined {
  const line = input.lines.find((candidate) =>
    normalizeAnnualReportStatementMatchTextV1(candidate.label).includes(
      "resultat fore skatt",
    ),
  );
  if (!line || typeof line.currentYearValue !== "number") {
    return undefined;
  }

  return normalizeAnnualReportNumericFieldValueV1(
    line.currentYearValue,
    input.statementUnit,
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
    if (
      !isRetryableAnnualReportAiErrorV1(result.error) ||
      attempt >= input.maxAttempts
    ) {
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
  sourceText: AnnualReportSourceTextV1;
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

async function prepareAnnualReportSourceDocumentForAiV1(input: {
  fileBytes: Uint8Array;
  fileType: "pdf" | "docx";
}): Promise<
  | {
      ok: true;
      preparedDocument: AnnualReportPreparedDocumentV1;
      sourceDiagnostics: string[];
    }
  | {
      ok: false;
      error: {
        code: "INPUT_INVALID" | "PARSE_FAILED";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
    }
> {
  const sourceTextResult = await withTimeoutV1({
    label: "Annual-report source parsing",
    timeoutMs: ANNUAL_REPORT_SOURCE_PARSING_TIMEOUT_MS_V1,
    operation: () =>
      parseAnnualReportSourceTextForAiV1({
        fileBytes: input.fileBytes,
        fileType: input.fileType,
      }),
  });
  if (!sourceTextResult.ok) {
    return sourceTextResult;
  }

  const pdfRouting =
    sourceTextResult.sourceText.fileType === "pdf" &&
    sourceTextResult.sourceText.pdfAnalysis?.classification ===
      "extractable_text_pdf"
      ? prepareAnnualReportPdfRoutingV1({
          sourceText: sourceTextResult.sourceText,
        })
      : undefined;

  return {
    ok: true,
    preparedDocument: prepareAnnualReportDocumentV1({
      fileBytes: input.fileBytes,
      pdfRouting,
      sourceText: sourceTextResult.sourceText,
      toBase64: toBase64V1,
    }),
    sourceDiagnostics: buildAnnualReportSourceDiagnosticsV1({
      sourceText: sourceTextResult.sourceText,
    }),
  };
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
  const apiKey = getAiApiKeyV1(input.env);
  const generatedAt = new Date().toISOString();
  const modelConfig = getAiModelConfigV1(input.env);
  const runtimeMetadata = buildAnnualReportRuntimeMetadataV1(input.env);
  const fallbackModelName = modelConfig.fastModel;
  const resolvedFileType =
    input.fileType ??
    (input.fileName.toLowerCase().endsWith(".docx") ? "docx" : "pdf");
  if (!apiKey) {
    return buildAnnualReportExtractionFallbackV1({
      fallbackReason: "Qwen API key is not configured.",
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
    const preparedDocumentResult =
      await prepareAnnualReportSourceDocumentForAiV1({
        fileBytes: input.fileBytes,
        fileType: resolvedFileType,
      });
    if (!preparedDocumentResult.ok) {
      return {
        ok: false,
        error: {
          code: preparedDocumentResult.error.code,
          message: `Annual-report source parsing failed: ${preparedDocumentResult.error.message}`,
          user_message: preparedDocumentResult.error.user_message,
          context: {
            ...preparedDocumentResult.error.context,
            fileType: resolvedFileType,
            stage: "source_parsing",
          },
        },
      };
    }

    const preparedDocument = preparedDocumentResult.preparedDocument;
    const sourceDiagnostics = preparedDocumentResult.sourceDiagnostics;
    const aiResultWithRetry = await withAnnualReportAiRetryV1({
      maxAttempts: 2,
      execute: async () => {
        const result = await executeAnnualReportAnalysisV1({
          apiKey,
          env: input.env,
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

    const aiResult = aiResultWithRetry.value;

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
    const sanitizedTaxDeep = sanitizeAnnualReportTaxDeepV1(
      aiResult.extraction.taxDeep,
    );
    const incomeStatementPages = collectAnnualReportPagesFromRangesV1({
      maxPage: preparedDocument.sourceText?.pageTexts.length ?? 0,
      ranges: preparedDocument.pdfRouting?.sections.incomeStatement ?? [],
    });
    const balanceSheetPages = collectAnnualReportPagesFromRangesV1({
      maxPage: preparedDocument.sourceText?.pageTexts.length ?? 0,
      ranges: preparedDocument.pdfRouting?.sections.balanceSheet ?? [],
    });
    const refinedIncomeStatementPages = refineAnnualReportStatementPagesV1({
      pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
      pages: incomeStatementPages,
      statement: "income",
    });
    const refinedBalanceSheetPages = refineAnnualReportStatementPagesV1({
      pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
      pages: balanceSheetPages,
      statement: "balance",
    });
    const hydratedTaxDeep = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: sanitizedTaxDeep,
      pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
      incomeStatementRanges:
        preparedDocument.pdfRouting?.sections.incomeStatement ?? [],
      balanceSheetRanges:
        preparedDocument.pdfRouting?.sections.balanceSheet ?? [],
    });
    const normalizedTaxDeep = normalizeAnnualReportTaxDeepV1(hydratedTaxDeep);
    const alignedHydratedTaxDeepResult =
      alignAnnualReportStatementsToInk2CodesV1({
        taxDeep: normalizedTaxDeep,
        pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
      });
    const deterministicStatementTaxDeep = normalizeAnnualReportTaxDeepV1({
      ...sanitizedTaxDeep,
      ink2rExtracted: {
        ...sanitizedTaxDeep.ink2rExtracted,
        statementUnit:
          sanitizedTaxDeep.ink2rExtracted.statementUnit ??
          resolveAnnualReportStatementUnitFromPageTextsV1({
            pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
            pages: [
              ...new Set([
                ...refinedIncomeStatementPages,
                ...refinedBalanceSheetPages,
              ]),
            ],
          }),
        incomeStatement: buildDeterministicStatementLinesFromPageTextV1({
          pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
          pages: refinedIncomeStatementPages,
          statement: "income",
        }),
        balanceSheet: buildDeterministicStatementLinesFromPageTextV1({
          pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
          pages: refinedBalanceSheetPages,
          statement: "balance",
        }),
      },
    });
    const alignedDeterministicTaxDeepResult =
      alignAnnualReportStatementsToInk2CodesV1({
        taxDeep: deterministicStatementTaxDeep,
        pageTexts: preparedDocument.sourceText?.pageTexts ?? [],
      });
    const hydratedBalanceControl =
      calculateAnnualReportBalanceControlFromLinesV1(
        alignedHydratedTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet,
      );
    const deterministicBalanceControl =
      calculateAnnualReportBalanceControlFromLinesV1(
        alignedDeterministicTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet,
      );
    const hydratedStatementValueCount =
      countAnnualReportStatementPopulatedValuesV1(
        alignedHydratedTaxDeepResult.taxDeep.ink2rExtracted.incomeStatement,
      ) +
      countAnnualReportStatementPopulatedValuesV1(
        alignedHydratedTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet,
      );
    const deterministicStatementValueCount =
      countAnnualReportStatementPopulatedValuesV1(
        alignedDeterministicTaxDeepResult.taxDeep.ink2rExtracted
          .incomeStatement,
      ) +
      countAnnualReportStatementPopulatedValuesV1(
        alignedDeterministicTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet,
      );
    const hydratedStatementPageLeak =
      hasAnnualReportEvidenceOutsidePagesV1(
        alignedHydratedTaxDeepResult.taxDeep.ink2rExtracted.incomeStatement,
        refinedIncomeStatementPages,
      ) ||
      hasAnnualReportEvidenceOutsidePagesV1(
        alignedHydratedTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet,
        refinedBalanceSheetPages,
      );
    const shouldDefaultToDeterministicStatements =
      preparedDocument.sourceText?.fileType === "pdf" &&
      preparedDocument.sourceText.pdfAnalysis?.classification ===
        "extractable_text_pdf" &&
      deterministicStatementValueCount > 0;
    const shouldPreferDeterministicStatements =
      alignedDeterministicTaxDeepResult.taxDeep.ink2rExtracted.incomeStatement
        .length > 0 &&
      alignedDeterministicTaxDeepResult.taxDeep.ink2rExtracted.balanceSheet
        .length > 0 &&
      (shouldDefaultToDeterministicStatements ||
        Math.abs(deterministicBalanceControl.currentDifference) <
          Math.abs(hydratedBalanceControl.currentDifference) ||
        hydratedStatementPageLeak ||
        deterministicStatementValueCount > hydratedStatementValueCount);
    const preferredStatementsTaxDeepResult = shouldPreferDeterministicStatements
      ? alignedDeterministicTaxDeepResult
      : alignedHydratedTaxDeepResult;
    const alignedTaxDeep = preferredStatementsTaxDeepResult.taxDeep;
    const fullExtractionMissing =
      !hasAnnualReportFullExtractionV1(alignedTaxDeep) &&
      aiResult.extraction.documentWarnings.some(
        (warning) =>
          warning.includes("statements extraction skipped") ||
          warning.includes("maximum allowed nesting depth"),
      );
    const extractionWarnings = [
      ...sourceDiagnostics,
      ...aiResult.extraction.documentWarnings,
      ...preferredStatementsTaxDeepResult.warnings,
      `statement_pages.income=pages ${formatAnnualReportSelectedPagesV1(
        refinedIncomeStatementPages,
      )}`,
      `statement_pages.balance=pages ${formatAnnualReportSelectedPagesV1(
        refinedBalanceSheetPages,
      )}`,
      ...(shouldPreferDeterministicStatements
        ? [
            `fallback.statements=deterministic_page_rebuild(profile=${shouldDefaultToDeterministicStatements ? "extractable_text_pdf" : "comparison"},current_difference=${hydratedBalanceControl.currentDifference},rebuilt_difference=${deterministicBalanceControl.currentDifference},page_leak=${hydratedStatementPageLeak ? 1 : 0},current_values=${hydratedStatementValueCount},rebuilt_values=${deterministicStatementValueCount})`,
          ]
        : []),
      ...[fiscalYearStartResult.warning, fiscalYearEndResult.warning].filter(
        (warning): warning is string => typeof warning === "string",
      ),
      ...(fullExtractionMissing
        ? [
            "Full financial extraction is missing on this artifact. Re-run the annual report analysis to populate the income statement and balance sheet.",
          ]
        : []),
    ];
    const deterministicStatementProfitBeforeTax =
      extractProfitBeforeTaxFromStatementLinesV1({
        statementUnit:
          deterministicStatementTaxDeep.ink2rExtracted.statementUnit,
        lines: deterministicStatementTaxDeep.ink2rExtracted.incomeStatement,
      });
    const extractedProfitBeforeTax = normalizeAnnualReportNumericFieldValueV1(
      fields.profitBeforeTax.normalizedValue,
      hydratedTaxDeep.ink2rExtracted.statementUnit,
    );
    const normalizedProfitBeforeTax =
      typeof deterministicStatementProfitBeforeTax === "number"
        ? deterministicStatementProfitBeforeTax
        : extractedProfitBeforeTax;
    if (
      typeof extractedProfitBeforeTax === "number" &&
      typeof deterministicStatementProfitBeforeTax === "number" &&
      extractedProfitBeforeTax !== deterministicStatementProfitBeforeTax
    ) {
      extractionWarnings.push(
        `validation.profit_before_tax.statement_mismatch=field:${extractedProfitBeforeTax},statement:${deterministicStatementProfitBeforeTax}`,
      );
    }
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
        value: normalizeAnnualReportOrganizationNumberV1(
          fields.organizationNumber.valueText,
        ),
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
        value: normalizedProfitBeforeTax,
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
        taxDeep: alignedTaxDeep,
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

function buildAnnualReportTaxAnalysisFallbackFindingV1(input: {
  area: string;
  evidence?: Array<{ page?: number; snippet: string }>;
  policyRuleReference: string;
  rationale: string;
  recommendedFollowUp?: string;
  severity: "low" | "medium" | "high";
  title: string;
}) {
  return {
    id: crypto.randomUUID(),
    area: input.area,
    title: input.title,
    severity: input.severity,
    rationale: input.rationale,
    recommendedFollowUp: input.recommendedFollowUp,
    missingInformation: [],
    policyRuleReference: input.policyRuleReference,
    evidence: dedupeAnnualReportEvidenceV1(input.evidence ?? []),
  };
}

function mergeAnnualReportTaxReviewStateV1(input: {
  taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
  patch: Partial<NonNullable<AnnualReportTaxAnalysisPayloadV1["reviewState"]>> &
    Pick<NonNullable<AnnualReportTaxAnalysisPayloadV1["reviewState"]>, "mode">;
}): AnnualReportTaxAnalysisPayloadV1 {
  const currentReasons = input.taxAnalysis.reviewState?.reasons ?? [];
  const patchReasons = input.patch.reasons ?? [];
  const mergedReasons = [...currentReasons];
  for (const reason of patchReasons) {
    if (!mergedReasons.includes(reason)) {
      mergedReasons.push(reason);
    }
  }

  return {
    ...input.taxAnalysis,
    reviewState: {
      mode: input.patch.mode,
      sourceDocumentAvailable:
        input.patch.sourceDocumentAvailable ??
        input.taxAnalysis.reviewState?.sourceDocumentAvailable ??
        false,
      sourceDocumentUsed:
        input.patch.sourceDocumentUsed ??
        input.taxAnalysis.reviewState?.sourceDocumentUsed ??
        false,
      reasons: mergedReasons,
    },
  };
}

export function buildDeterministicAnnualReportTaxAnalysisFallbackV1(input: {
  config: AnnualReportTaxAnalysisRuntimeConfigV1 | null;
  extraction: ReturnType<typeof parseAnnualReportExtractionPayloadV1>;
  extractionArtifactId: string;
  fallbackReason: string;
  modelName: string;
  policyVersion: string;
  sourceDocumentAvailable?: boolean;
  sourceDocumentUsed?: boolean;
  degradedReasons?: string[];
}): AnnualReportTaxAnalysisPayloadV1 {
  const taxDeep =
    input.extraction.taxDeep ?? createEmptyAnnualReportTaxDeepV1();
  const findings: AnnualReportTaxAnalysisPayloadV1["findings"] = [];
  const recommendedNextActions = new Set<string>();
  const missingInformation = new Set<string>();
  const degradedWarning = input.extraction.documentWarnings.find(
    (warning) =>
      warning.includes("degraded.tax_notes") ||
      warning.includes("statement_alignment") ||
      warning.includes("limited page range"),
  );

  if (degradedWarning) {
    missingInformation.add(
      "Detailed note extraction was limited, so some tax-sensitive disclosures still need manual review.",
    );
    recommendedNextActions.add(
      "Review note disclosures manually where the technical details show degraded extraction.",
    );
  }

  if (
    taxDeep.depreciationContext.assetAreas.length > 0 ||
    taxDeep.assetMovements.lines.length > 0
  ) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "depreciation_differences",
        evidence: [
          ...taxDeep.depreciationContext.evidence,
          ...taxDeep.assetMovements.evidence,
        ],
        policyRuleReference:
          "annual-report-tax-analysis.fallback.depreciation.v1",
        rationale:
          "The annual report contains fixed-asset movements or depreciation disclosures that should be reconciled to the tax depreciation schedule.",
        recommendedFollowUp:
          "Compare the reported asset movements to the fixed-asset register and tax depreciation base.",
        severity: "medium",
        title: "Depreciation disclosures require reconciliation",
      }),
    );
    recommendedNextActions.add(
      "Reconcile the fixed-asset note to the tax depreciation schedule.",
    );
  }

  if (taxDeep.reserveContext.movements.length > 0) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "untaxed_reserves",
        evidence: taxDeep.reserveContext.evidence,
        policyRuleReference:
          "annual-report-tax-analysis.fallback.untaxed-reserves.v1",
        rationale:
          "Untaxed reserves are present and should be matched to the tax return and prior-year workpapers.",
        recommendedFollowUp:
          "Verify periodiseringsfonder and over-depreciation balances against the tax workpapers.",
        severity: "medium",
        title: "Untaxed reserves should be traced into the tax return",
      }),
    );
    recommendedNextActions.add(
      "Trace untaxed reserve balances to the prior-year tax files.",
    );
  }

  if (
    taxDeep.netInterestContext.interestIncome?.value !== undefined ||
    taxDeep.netInterestContext.interestExpense?.value !== undefined ||
    taxDeep.netInterestContext.netInterest?.value !== undefined ||
    taxDeep.netInterestContext.notes.length > 0
  ) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "net_interest",
        evidence: taxDeep.netInterestContext.evidence,
        policyRuleReference:
          "annual-report-tax-analysis.fallback.net-interest.v1",
        rationale:
          "Finance income or expense is present in the report and should be reviewed for interest limitation and non-deductibility issues.",
        recommendedFollowUp:
          "Review the finance note and assess whether any interest limitation analysis is needed.",
        severity: "medium",
        title: "Finance items require tax review",
      }),
    );
    recommendedNextActions.add(
      "Review finance income and expense against any group debt or tax-account interest.",
    );
  }

  if (taxDeep.groupContributionContext.notes.length > 0) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "group_contributions",
        evidence: taxDeep.groupContributionContext.evidence,
        policyRuleReference:
          "annual-report-tax-analysis.fallback.group-contributions.v1",
        rationale:
          "Group contribution references are present and should be matched to the group contribution treatment in the tax return.",
        recommendedFollowUp:
          "Confirm whether received or paid group contributions affect the return.",
        severity: "medium",
        title: "Group contribution disclosures are present",
      }),
    );
    recommendedNextActions.add(
      "Confirm the tax treatment of any disclosed group contributions.",
    );
  }

  if (
    taxDeep.taxExpenseContext?.currentTax?.value !== undefined ||
    taxDeep.taxExpenseContext?.deferredTax?.value !== undefined ||
    taxDeep.taxExpenseContext?.totalTaxExpense?.value !== undefined ||
    (taxDeep.taxExpenseContext?.notes.length ?? 0) > 0
  ) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "tax_expense",
        evidence: taxDeep.taxExpenseContext?.evidence ?? [],
        policyRuleReference:
          "annual-report-tax-analysis.fallback.tax-expense.v1",
        rationale:
          "The report contains a tax-expense note that should be reconciled to the return and any deferred-tax positions.",
        recommendedFollowUp:
          "Tie the tax-expense note to the draft tax computation and deferred-tax workpapers.",
        severity: "low",
        title: "Tax-expense note is available for reconciliation",
      }),
    );
    recommendedNextActions.add(
      "Reconcile the tax-expense note to the draft tax calculation.",
    );
  }

  if (
    taxDeep.shareholdingContext.dividendsPaid?.value !== undefined ||
    taxDeep.shareholdingContext.dividendsReceived?.value !== undefined ||
    taxDeep.shareholdingContext.notes.length > 0
  ) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "shareholdings_dividends",
        evidence: taxDeep.shareholdingContext.evidence,
        policyRuleReference:
          "annual-report-tax-analysis.fallback.shareholdings.v1",
        rationale:
          "Dividend or shareholding disclosures are present and may require a tax classification review.",
        recommendedFollowUp:
          "Review dividends and participations for tax-exempt income or withholding considerations.",
        severity: "low",
        title: "Dividend and shareholding disclosures are present",
      }),
    );
    recommendedNextActions.add(
      "Review dividends and shareholding notes for tax treatment.",
    );
  }

  if (findings.length === 0) {
    findings.push(
      buildAnnualReportTaxAnalysisFallbackFindingV1({
        area: "manual_review",
        policyRuleReference:
          "annual-report-tax-analysis.fallback.manual-review.v1",
        rationale:
          "The extracted annual report data is usable, but the AI forensic review could not produce a richer structured assessment for this run.",
        recommendedFollowUp:
          "Review the annual report manually before relying on the forensic summary.",
        severity: "low",
        title: "Manual forensic review is still recommended",
      }),
    );
    recommendedNextActions.add(
      "Review the annual report manually before finalizing the tax position.",
    );
  }

  const accountingStandardValue =
    input.extraction.fields.accountingStandard.value;
  if (!accountingStandardValue) {
    missingInformation.add(
      "The accounting standard needs confirmation before relying on the forensic review.",
    );
  }

  return {
    schemaVersion: "annual_report_tax_analysis_v1",
    sourceExtractionArtifactId: input.extractionArtifactId as `${string}`,
    policyVersion: input.policyVersion,
    basedOn: taxDeep,
    executiveSummary:
      "Forensic review completed using deterministic fallback signals because the AI review did not return a usable structured result.",
    accountingStandardAssessment: {
      status: accountingStandardValue ? "aligned" : "needs_review",
      rationale: accountingStandardValue
        ? `${accountingStandardValue} is available in the extracted core facts and can be used for the initial tax review.`
        : "The accounting standard was not available in the extracted core facts and should be confirmed manually.",
    },
    reviewState: {
      mode: "deterministic_fallback",
      reasons: [
        ...new Set([
          ...(input.degradedReasons ?? []),
          `AI fallback reason: ${input.fallbackReason.slice(0, 180)}`,
        ]),
      ],
      sourceDocumentAvailable: input.sourceDocumentAvailable ?? false,
      sourceDocumentUsed: input.sourceDocumentUsed ?? false,
    },
    findings,
    missingInformation: [...missingInformation],
    recommendedNextActions: [...recommendedNextActions],
    aiRun: input.config
      ? parseAiRunMetadataV1({
          runId: crypto.randomUUID(),
          moduleId: input.config.moduleSpec.moduleId,
          moduleVersion: input.config.moduleSpec.moduleVersion,
          promptVersion: input.config.moduleSpec.promptVersion,
          policyVersion: input.config.policyPack.policyVersion,
          activePatchVersions:
            input.config.moduleSpec.policy.activePatchVersions,
          provider: "qwen",
          model: input.modelName,
          modelTier: input.config.moduleSpec.runtime.modelTier,
          generatedAt: new Date().toISOString(),
          usedFallback: true,
        })
      : undefined,
  };
}

async function analyzeAnnualReportTaxWithPrimaryAiV1(input: {
  env: Env;
  extraction: ReturnType<typeof parseAnnualReportExtractionPayloadV1>;
  extractionArtifactId: string;
  policyVersion: string;
  sourceDocument?: {
    fileBytes: Uint8Array;
    fileName: string;
    fileType: "pdf" | "docx";
  };
}): Promise<
  | { ok: true; taxAnalysis: AnnualReportTaxAnalysisPayloadV1 }
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
  const apiKey = getAiApiKeyV1(input.env);
  const configResult = loadAnnualReportTaxAnalysisModuleConfigV1();
  const config = configResult.ok ? configResult.config : null;
  const modelConfig = getAiModelConfigV1(input.env);
  const fallbackModelName = modelConfig.fastModel;
  const configFailureMessage = configResult.ok
    ? undefined
    : configResult.error.message;
  const preparedSourceDocumentResult = input.sourceDocument
    ? await prepareAnnualReportSourceDocumentForAiV1({
        fileBytes: input.sourceDocument.fileBytes,
        fileType: input.sourceDocument.fileType,
      })
    : undefined;
  const preparedSourceDocument =
    preparedSourceDocumentResult?.ok === true
      ? preparedSourceDocumentResult.preparedDocument
      : undefined;
  const sourceDiagnostics =
    preparedSourceDocumentResult?.ok === true
      ? preparedSourceDocumentResult.sourceDiagnostics
      : undefined;
  const sourcePreparationWarning =
    preparedSourceDocumentResult && !preparedSourceDocumentResult.ok
      ? preparedSourceDocumentResult.error.message
      : undefined;
  const sourceDocumentAvailable = Boolean(input.sourceDocument);
  const sourceDocumentUsed = Boolean(preparedSourceDocument);
  const degradedSourceReasons = sourcePreparationWarning
    ? [`Source document preparation failed: ${sourcePreparationWarning}`]
    : !input.sourceDocument
      ? ["Source document unavailable for the active extraction."]
      : [];

  if (!apiKey || !config) {
    return {
      ok: true,
      taxAnalysis: buildDeterministicAnnualReportTaxAnalysisFallbackV1({
        config,
        degradedReasons: degradedSourceReasons,
        extraction: input.extraction,
        extractionArtifactId: input.extractionArtifactId,
        fallbackReason: !apiKey
          ? "Qwen API key is not configured."
          : (configFailureMessage ??
            "Annual-report tax-analysis config failed."),
        modelName: fallbackModelName,
        policyVersion: input.policyVersion,
        sourceDocumentAvailable,
        sourceDocumentUsed,
      }),
    };
  }

  const result = await withAnnualReportAiRetryV1({
    maxAttempts: 3,
    execute: async () => {
      const analysisResult = await executeAnnualReportTaxAnalysisV1({
        apiKey,
        env: input.env,
        config,
        document: preparedSourceDocument,
        extraction: input.extraction,
        extractionArtifactId: input.extractionArtifactId,
        generateId: () => crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        modelConfig,
        policyVersion: input.policyVersion,
        sourceDiagnostics,
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
    return {
      ok: true,
      taxAnalysis: buildDeterministicAnnualReportTaxAnalysisFallbackV1({
        config,
        degradedReasons: degradedSourceReasons,
        extraction: input.extraction,
        extractionArtifactId: input.extractionArtifactId,
        fallbackReason: sourcePreparationWarning
          ? `${result.error.message} Source document preparation warning: ${sourcePreparationWarning}`
          : result.error.message,
        modelName: fallbackModelName,
        policyVersion: input.policyVersion,
        sourceDocumentAvailable,
        sourceDocumentUsed,
      }),
    };
  }

  return {
    ok: true,
    taxAnalysis: mergeAnnualReportTaxReviewStateV1({
      taxAnalysis: result.value,
      patch: {
        mode: sourceDocumentUsed ? "full_ai" : "extraction_only",
        reasons: degradedSourceReasons,
        sourceDocumentAvailable,
        sourceDocumentUsed,
      },
    }),
  };
}

async function generateMappingDecisionsWithPrimaryAiV1(input: {
  executionBudgetMs?: number;
  env: Env;
  request: ReturnType<typeof parseGenerateMappingDecisionsRequestV2>;
}) {
  const annualReportContext =
    resolveConfirmedAnnualReportMappingContextForRequestV1(input.request);
  const annualReportLineage =
    input.request.annualReportInput.status === "confirmed"
      ? {
          sourceExtractionArtifactId:
            input.request.annualReportInput.extractionArtifactId ?? "",
          sourceTaxAnalysisArtifactId:
            input.request.annualReportInput.taxAnalysisArtifactId,
        }
      : undefined;
  const modelConfig = getAiModelConfigV1(input.env);
  const stampConservativeFallbackMappingV1 = (fallbackReason: {
    code: MappingDegradationReasonCodeV1;
    message: string;
  }) => {
    const generatedAt = new Date().toISOString();
    const decisions = input.request.trialBalance.rows.map((row) => {
      const rowKey = buildTrialBalanceRowKeyV1(row.source);
      const fallbackCategory = getSilverfinTaxCategoryByCodeV1(
        resolveConservativeFallbackCategoryCodeV1({
          accountName: row.accountName,
          openingBalance: row.openingBalance,
          closingBalance: row.closingBalance,
        }),
      );
      return {
        id: rowKey,
        trialBalanceRowIdentity: buildTrialBalanceRowIdentityV1(row.source),
        accountNumber: row.accountNumber,
        sourceAccountNumber: row.sourceAccountNumber,
        accountName: row.accountName,
        openingBalance: row.openingBalance ?? undefined,
        closingBalance: row.closingBalance ?? undefined,
        proposedCategory: fallbackCategory,
        selectedCategory: fallbackCategory,
        confidence: 0.25,
        evidence: [
          {
            type: "tb_row" as const,
            reference: rowKey,
            snippet: `${row.sourceAccountNumber} ${row.accountName}`,
            source: row.source,
          },
        ],
        policyRuleReference: "mapping.ai.fallback.module_unavailable.v1",
        reviewFlag: true,
        status: "proposed" as const,
        source: "ai" as const,
        aiTrace: {
          rationale:
            "AI-primary mapping fallback assigned a conservative non-tax-sensitive category because live model execution was unavailable.",
          annualReportContextReferences: [],
          sourceExtractionArtifactId:
            annualReportLineage?.sourceExtractionArtifactId,
          sourceTaxAnalysisArtifactId:
            annualReportLineage?.sourceTaxAnalysisArtifactId,
        },
      };
    });

    return {
      ok: true as const,
      mapping: parseMappingDecisionSetArtifactV1({
        schemaVersion: "mapping_decisions_v2",
        policyVersion: input.request.policyVersion,
        aiRun: parseAiRunMetadataV1({
          runId: crypto.randomUUID(),
          moduleId: "mapping-decisions",
          moduleVersion: "v1",
          promptVersion: "mapping-decisions.prompts.v1",
          policyVersion: input.request.policyVersion,
          activePatchVersions: [],
          provider: input.env.AI_PROVIDER === "openai" ? "openai" : "qwen",
          model: modelConfig.fastModel,
          modelTier: "fast",
          generatedAt,
          usedFallback: true,
        }),
        executionMetadata: parseMappingExecutionMetadataV1({
          requestedStrategy: "ai_primary",
          actualStrategy: "ai",
          degraded: true,
          degradedReasonCode: fallbackReason.code,
          degradedReason: fallbackReason.message,
          annualReportContextAvailable: annualReportContext !== undefined,
          usedAiRunFallback: true,
        }),
        summary: {
          totalRows: decisions.length,
          deterministicDecisions: 0,
          manualReviewRequired: decisions.length,
          fallbackDecisions: decisions.length,
          matchedByAccountNumber: 0,
          matchedByAccountName: 0,
          unmatchedRows: 0,
        },
        decisions,
      }),
    };
  };
  const apiKey = getAiApiKeyV1(input.env);
  if (!apiKey) {
    console.warn("mapping-decisions.ai.unavailable", {
      reason: "missing_api_key",
      policyVersion: input.request.policyVersion,
    });
    return stampConservativeFallbackMappingV1({
      code: "missing_api_key",
      message: `AI provider API key is not configured for AI-primary mapping (provider: ${input.env.AI_PROVIDER ?? "qwen"}).`,
    });
  }

  const configResult = loadMappingDecisionsModuleConfigV1();
  if (!configResult.ok) {
    console.warn("mapping-decisions.ai.config_invalid", {
      reason: configResult.error.message,
      policyVersion: input.request.policyVersion,
    });
    return stampConservativeFallbackMappingV1({
      code: "config_invalid",
      message: configResult.error.message,
    });
  }

  const aiResult = await executeMappingDecisionsModelV1({
    apiKey,
    env: input.env,
    annualReportContext,
    annualReportLineage,
    config: configResult.config,
    executionBudgetMs: input.executionBudgetMs,
    generateId: () => crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    modelConfig,
    policyVersion: input.request.policyVersion,
    trialBalance: input.request.trialBalance,
  });
  if (!aiResult.ok) {
    console.warn("mapping-decisions.ai.execution_failed", {
      policyVersion: input.request.policyVersion,
      reason: aiResult.error.message,
      executionBudgetMs: input.executionBudgetMs,
    });
    return stampConservativeFallbackMappingV1({
      code: "model_execution_failed",
      message: aiResult.error.message,
    });
  }
  if (aiResult.mapping.aiRun?.usedFallback) {
    console.warn("mapping-decisions.ai.degraded", {
      policyVersion: aiResult.mapping.policyVersion,
      totalRows: aiResult.mapping.summary.totalRows,
      fallbackDecisions: aiResult.mapping.summary.fallbackDecisions,
      annualReportContextAvailable: annualReportContext !== undefined,
    });
  }

  return {
    ok: true as const,
    mapping: aiResult.mapping,
  };
}

async function buildGenerateMappingDecisionsRequestV2FromWorkspaceV1(input: {
  policyVersion: string;
  reconciliation: ReconciliationResultPayloadV1;
  tenantId: string;
  trialBalance: TrialBalanceNormalizedArtifactV1;
  workspaceArtifactRepository: WorkspaceArtifactRepositoryV1;
  workspaceId: string;
}) {
  const extraction =
    await input.workspaceArtifactRepository.getActiveAnnualReportExtraction({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
  const taxAnalysis =
    await input.workspaceArtifactRepository.getActiveAnnualReportTaxAnalysis({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });

  if (!extraction) {
    return parseGenerateMappingDecisionsRequestV2({
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
    });
  }

  if (!extraction.payload.confirmation.isConfirmed) {
    return parseGenerateMappingDecisionsRequestV2({
      schemaVersion: "generate_mapping_decisions_request_v2",
      policyVersion: input.policyVersion,
      trialBalance: input.trialBalance,
      reconciliation: input.reconciliation,
      annualReportInput: {
        status: "unconfirmed_omitted",
        extractionArtifactId: extraction.id,
        extractionSchemaVersion: extraction.schemaVersion,
        extractionConfirmed: false,
        taxAnalysisArtifactId: taxAnalysis?.id,
        taxAnalysisSchemaVersion: taxAnalysis?.schemaVersion,
        degraded: true,
        degradedReasons: [
          "Active annual-report extraction is not confirmed, so mapper context was omitted.",
        ],
      },
    });
  }

  return parseGenerateMappingDecisionsRequestV2({
    schemaVersion: "generate_mapping_decisions_request_v2",
    policyVersion: input.policyVersion,
    trialBalance: input.trialBalance,
    reconciliation: input.reconciliation,
    annualReportInput: {
      status: "confirmed",
      extractionArtifactId: extraction.id,
      extractionSchemaVersion: extraction.schemaVersion,
      extractionConfirmed: true,
      taxAnalysisArtifactId: taxAnalysis?.id,
      taxAnalysisSchemaVersion: taxAnalysis?.schemaVersion,
      degraded: false,
      degradedReasons: [],
      mappingContext: projectAnnualReportMappingContextV1({
        annualReportTaxContext: projectAnnualReportTaxContextV1({
          extraction: extraction.payload,
          taxAnalysis: taxAnalysis?.payload,
        }),
      }),
    },
  });
}

async function generateTaxAdjustmentsWithPrimaryAiV1(input: {
  annualReportTaxContext?: AnnualReportDownstreamTaxContextV1;
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
  const apiKey = getAiApiKeyV1(input.env);
  if (!apiKey) {
    return generateTaxAdjustmentsV1(deterministicInput);
  }

  const modelConfig = getAiModelConfigV1(input.env);
  const annualReportTaxContext =
    input.annualReportTaxContext ??
    projectAnnualReportTaxContextV1({
      extraction: input.annualReportExtraction,
    });
  const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
    mapping: input.mapping,
    trialBalance: input.trialBalance,
  }).filter(
    (candidate) => candidate.bridgeAiModule !== null,
  );
  if (routedCandidates.length === 0) {
    return generateTaxAdjustmentsV1(deterministicInput);
  }

  const groupedCandidates = new Map<string, typeof routedCandidates>();
  for (const candidate of routedCandidates) {
    const groupKey = `${candidate.moduleCode}|${candidate.bridgeAiModule}`;
    const existing = groupedCandidates.get(groupKey);
    if (existing) {
      existing.push(candidate);
      continue;
    }

    groupedCandidates.set(groupKey, [candidate]);
  }

  const routedCandidateByDecisionId = new Map(
    routedCandidates.map((candidate) => [candidate.mappingDecisionId, candidate]),
  );

  type ModuleGroupResult = {
    decisions: TaxAdjustmentAiProposalDecisionV1[];
    aiRun?: AiRunMetadataV1;
  };

  const processModuleGroup = async (
    candidates: (typeof routedCandidates),
  ): Promise<ModuleGroupResult> => {
    const groupDecisions: TaxAdjustmentAiProposalDecisionV1[] = [];
    const bridgeAiModule = candidates[0]?.bridgeAiModule;
    if (!bridgeAiModule) {
      return { decisions: groupDecisions };
    }

    let configResult:
      | ReturnType<typeof loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1>
      | ReturnType<
          typeof loadTaxAdjustmentsRepresentationEntertainmentModuleConfigV1
        >
      | ReturnType<
          typeof loadTaxAdjustmentsDepreciationDifferencesBasicModuleConfigV1
        >;
    let systemPrompt: string;
    let userPrompt: string;

    switch (bridgeAiModule) {
      case "non_deductible_expenses":
        configResult = loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1();
        systemPrompt = TAX_ADJUSTMENTS_NON_DEDUCTIBLE_SYSTEM_PROMPT_V1;
        userPrompt = TAX_ADJUSTMENTS_NON_DEDUCTIBLE_USER_PROMPT_V1;
        break;
      case "representation_entertainment":
        configResult =
          loadTaxAdjustmentsRepresentationEntertainmentModuleConfigV1();
        systemPrompt = TAX_ADJUSTMENTS_REPRESENTATION_SYSTEM_PROMPT_V1;
        userPrompt = TAX_ADJUSTMENTS_REPRESENTATION_USER_PROMPT_V1;
        break;
      case "depreciation_differences_basic":
        configResult =
          loadTaxAdjustmentsDepreciationDifferencesBasicModuleConfigV1();
        systemPrompt = TAX_ADJUSTMENTS_DEPRECIATION_SYSTEM_PROMPT_V1;
        userPrompt = TAX_ADJUSTMENTS_DEPRECIATION_USER_PROMPT_V1;
        break;
      default:
        return { decisions: groupDecisions };
    }

    if (!configResult.ok) {
      console.warn("tax-adjustments.ai.config_invalid", {
        bridgeAiModule,
        moduleCode: candidates[0]?.moduleCode,
        mappingArtifactId: input.mappingArtifactId,
      });
      return { decisions: groupDecisions };
    }

    const moduleResult = await executeTaxAdjustmentSubmoduleV1({
      apiKey,
      env: input.env,
      annualReportTaxContext: projectTaxAdjustmentModuleContextV1({
        annualReportTaxContext,
        moduleCode: candidates[0]!.moduleCode,
      }),
      candidates,
      config: configResult.config as never,
      generateId: () => crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      modelConfig,
      systemPrompt,
      userPrompt,
    });
    if (!moduleResult.ok) {
      for (const candidate of candidates) {
        groupDecisions.push({
          decisionId: `adj-fallback-${candidate.moduleCode}-${candidate.mappingDecisionId}`,
          module: candidate.moduleCode,
          sourceMappingDecisionId: candidate.mappingDecisionId,
          direction: candidate.direction,
          targetField: candidate.targetField,
          reviewFlag: true,
          confidence: 0.25,
          policyRuleReference: `adj.ai.fallback.${candidate.moduleCode}.${bridgeAiModule}.execution_failed.v1`,
          rationale:
            "AI submodule failed; deterministic fallback proposal applied for this candidate.",
        });
      }
      return { decisions: groupDecisions };
    }

    groupDecisions.push(
      ...moduleResult.decisions.flatMap((decision) => {
        const routedCandidate = routedCandidateByDecisionId.get(
          decision.sourceMappingDecisionId,
        );
        if (!routedCandidate) {
          console.warn("tax-adjustments.ai.unknown_candidate", {
            bridgeAiModule,
            sourceMappingDecisionId: decision.sourceMappingDecisionId,
            mappingArtifactId: input.mappingArtifactId,
          });
          return [];
        }

        if (decision.module !== routedCandidate.moduleCode) {
          console.warn("tax-adjustments.ai.module_mismatch", {
            bridgeAiModule,
            sourceMappingDecisionId: decision.sourceMappingDecisionId,
            expectedModuleCode: routedCandidate.moduleCode,
            receivedModuleCode: decision.module,
            mappingArtifactId: input.mappingArtifactId,
          });
          return [
            {
              decisionId: `adj-fallback-${routedCandidate.moduleCode}-${decision.sourceMappingDecisionId}`,
              module: routedCandidate.moduleCode,
              sourceMappingDecisionId: decision.sourceMappingDecisionId,
              direction: routedCandidate.direction,
              targetField: routedCandidate.targetField,
              reviewFlag: true,
              confidence: 0.25,
              policyRuleReference: `adj.ai.fallback.${routedCandidate.moduleCode}.${bridgeAiModule}.module_mismatch.v1`,
              rationale:
                "AI submodule returned a decision for the wrong module, so a conservative fallback was applied instead.",
            },
          ];
        }

        return [{ ...decision }];
      }),
    );

    if (moduleResult.failedCandidates.length > 0) {
      for (const candidate of moduleResult.failedCandidates) {
        const routedCandidate = routedCandidateByDecisionId.get(
          candidate.mappingDecisionId,
        );
        if (!routedCandidate) {
          continue;
        }

        groupDecisions.push({
          decisionId: `adj-fallback-${routedCandidate.moduleCode}-${candidate.mappingDecisionId}`,
          module: routedCandidate.moduleCode,
          sourceMappingDecisionId: candidate.mappingDecisionId,
          direction: routedCandidate.direction,
          targetField: routedCandidate.targetField,
          reviewFlag: true,
          confidence: 0.25,
          policyRuleReference: `adj.ai.fallback.${routedCandidate.moduleCode}.${bridgeAiModule}.chunk_retry_exhausted.v1`,
          rationale:
            "AI submodule chunk failed after retries; deterministic fallback proposal applied for this candidate.",
        });
      }
    }

    if (
      moduleResult.telemetry.splitCount > 0 ||
      moduleResult.failedCandidates.length > 0
    ) {
      console.warn("tax-adjustments.ai.degraded", {
        bridgeAiModule,
        moduleCode: candidates[0]?.moduleCode,
        failedCandidates: moduleResult.failedCandidates.length,
        splitCount: moduleResult.telemetry.splitCount,
        totalAttempts: moduleResult.telemetry.totalAttempts,
        mappingArtifactId: input.mappingArtifactId,
      });
    }

    return { decisions: groupDecisions, aiRun: moduleResult.aiRun };
  };

  const groupResults = await Promise.all(
    [...groupedCandidates.values()].map(processModuleGroup),
  );

  const allDecisions: TaxAdjustmentAiProposalDecisionV1[] = [];
  const aiRuns: AiRunMetadataV1[] = [];
  for (const groupResult of groupResults) {
    allDecisions.push(...groupResult.decisions);
    if (groupResult.aiRun) {
      aiRuns.push(groupResult.aiRun);
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
 * Creates environment-backed dependencies for TB pipeline runs with AI-primary mapping.
 */
export function createTrialBalancePipelineRunDepsV1(
  env: Env,
): TrialBalancePipelineRunDepsV1 {
  // Budget accounts for: initial fast-model pass + thinking-model escalation
  // pass, both running in parallel. Thinking model (qwen-max) can take up to
  // 90s per request; 300s gives two full retry cycles with headroom.
  const trialBalanceImportAiExecutionBudgetMs = 300_000;

  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    workspaceArtifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    generateMappingDecisions: async (input) => {
      const workspaceArtifactRepository = createD1WorkspaceArtifactRepositoryV1(
        env.DB,
      );
      const mappingRequest =
        await buildGenerateMappingDecisionsRequestV2FromWorkspaceV1({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          policyVersion: input.policyVersion,
          trialBalance: input.trialBalance,
          reconciliation: input.reconciliation,
          workspaceArtifactRepository,
        });

      return generateMappingDecisionsWithPrimaryAiV1({
        executionBudgetMs: trialBalanceImportAiExecutionBudgetMs,
        env,
        request: mappingRequest,
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
 * Creates environment-backed dependencies for follow-up mapping AI enrichment.
 */
export function createMappingAiEnrichmentDepsV1(
  env: Env,
  options?: {
    executionBudgetMs?: number;
  },
): MappingAiEnrichmentDepsV1 {
  return {
    artifactRepository: createD1TbPipelineArtifactRepositoryV1(env.DB),
    auditRepository: createD1AuditRepositoryV1(env.DB),
    mappingPreferenceRepository: createD1MappingPreferenceRepositoryV1(env.DB),
    workspaceArtifactRepository: createD1WorkspaceArtifactRepositoryV1(env.DB),
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    buildMappingRequest: (input) =>
      buildGenerateMappingDecisionsRequestV2FromWorkspaceV1({
        policyVersion: input.policyVersion,
        reconciliation: input.reconciliation,
        tenantId: input.tenantId,
        trialBalance: input.trialBalance,
        workspaceArtifactRepository: createD1WorkspaceArtifactRepositoryV1(
          env.DB,
        ),
        workspaceId: input.workspaceId,
      }),
    generateAiMapping: ({ request }) =>
      generateMappingDecisionsWithPrimaryAiV1({
        env,
        request,
        executionBudgetMs: options?.executionBudgetMs,
      }),
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
    sourceStore: env.ANNUAL_REPORT_FILES,
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
  options?: { scheduleBackgroundTask?: (promise: Promise<unknown>) => void },
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
    scheduleBackgroundTask: options?.scheduleBackgroundTask,
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
