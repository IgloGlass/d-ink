import type { AnnualReportExtractionPayloadV1 } from "../../../../shared/contracts/annual-report-extraction.v1";
import {
  type AnnualReportAiSectionLocatorResultV1,
  AnnualReportAiSectionLocatorResultV1Schema,
  type AnnualReportAiCombinedTextExtractionResultV1,
  AnnualReportAiCombinedTextExtractionResultV1Schema,
  type AnnualReportAiCoreFactsResultV1,
  AnnualReportAiCoreFactsResultV1Schema,
  type AnnualReportAiStatementsOnlyResultV1,
  AnnualReportAiStatementsOnlyResultV1Schema,
  type AnnualReportAiTaxNotesAssetsAndReservesResultV1,
  AnnualReportAiTaxNotesAssetsAndReservesResultV1Schema,
  type AnnualReportAiTaxNotesFinanceAndOtherResultV1,
  AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema,
  AnnualReportAiExtractionResultV1Schema,
  type AnnualReportAiExtractionResultV1,
  type AnnualReportAiSectionLocatorRangeV1,
} from "../../../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportProcessingRunStatusV1 } from "../../../../shared/contracts/annual-report-processing-run.v1";
import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import {
  generateGeminiStructuredOutputV1,
  toBase64V1,
} from "../../providers/gemini-client.v1";
import type { GeminiModelConfigV1 } from "../../providers/gemini-client.v1";
import {
  extractAnnualReportPdfChunkDocumentsV1,
  normalizeAnnualReportPageRangesV1,
} from "../../document-prep/annual-report-pdf-chunk.v1";
import { extractAnnualReportTextChunkDocumentsV1 } from "../../document-prep/annual-report-text-chunk.v1";
import type { AnnualReportPreparedDocumentV1 } from "../../document-prep/annual-report-document.v1";
import { buildAnnualReportCoreFactsCompactTextV1 } from "../../../parsing/annual-report-core-facts-compact-text.v1";
import type { AnnualReportCoreFactsSeedV1 } from "../../../parsing/annual-report-core-facts-seed.v1";
import { resolveAnnualReportPdfLocatorSectionsV1 } from "../../../parsing/annual-report-page-routing.v1";
import type { loadAnnualReportAnalysisModuleConfigV1 } from "./loader.v1";
import {
  ANNUAL_REPORT_ANALYSIS_SYSTEM_PROMPT_V1,
  ANNUAL_REPORT_ANALYSIS_USER_PROMPT_V1,
} from "./prompt-text.v1";

export type AnnualReportAnalysisRuntimeConfigV1 =
  NonNullable<
    Extract<
      ReturnType<typeof loadAnnualReportAnalysisModuleConfigV1>,
      { ok: true }
    >["config"]
  >;

export type ExecuteAnnualReportAnalysisInputV1 = {
  apiKey?: string;
  config: AnnualReportAnalysisRuntimeConfigV1;
  document: AnnualReportPreparedDocumentV1;
  generateId: () => string;
  generatedAt: string;
  modelConfig: GeminiModelConfigV1;
  runtimeMode?: "default" | "ai_overdrive";
  onProgress?: (
    status: AnnualReportProcessingRunStatusV1,
    technicalDetails?: string[],
  ) => Promise<void>;
};

export type ExecuteAnnualReportAnalysisResultV1 =
  | {
      ok: true;
      extraction: AnnualReportAiExtractionResultV1;
      aiRun: AnnualReportExtractionPayloadV1["aiRun"];
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    };

const ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1 = {
  locator: `Stage: section locator.

Identify the page ranges for:
- Core facts / front matter
- Income statement (P&L)
- Balance sheet
- Tax expense note
- Depreciation / fixed assets note
- Reserves / untaxed reserves note
- Finance / interest note
- Pensions / leasing / group contributions / shareholdings notes

Return ONLY the page ranges and confidence scores.`,
  coreFacts: `Stage: core facts extraction.

Return only:
- the six core annual-report fields,
- taxSignals (from front matter/Director's report),
- documentWarnings.

Focus only on the identified core facts / front matter pages.`,
  statements: `Stage: financial statements extraction.

Return only:
- ink2rExtracted statementUnit,
- ink2rExtracted full income statement rows,
- ink2rExtracted full balance sheet rows,
- priorYearComparatives (from statements).

Focus only on the identified financial statement pages.`,
  taxNotesAssets: `Stage: tax notes (assets & reserves).

Return only:
- depreciationContext,
- assetMovements,
- reserveContext,
- taxExpenseContext (if found in these notes).

Focus only on the identified asset, reserve, and tax expense note pages.`,
  taxNotesFinance: `Stage: tax notes (finance & other).

Return only:
- netInterestContext,
- pensionContext,
- leasingContext,
- groupContributionContext,
- shareholdingContext,
- taxExpenseContext (if found in these notes).

Focus only on the identified finance, pension, leasing, group contribution, and shareholding note pages.`,
  combinedTextExtraction: `Stage: combined extractable-text annual-report extraction.

Return only:
- ink2rExtracted statementUnit,
- ink2rExtracted full income statement rows,
- ink2rExtracted full balance sheet rows,
- priorYearComparatives,
- depreciationContext,
- assetMovements,
- reserveContext,
- netInterestContext,
- pensionContext,
- leasingContext,
- groupContributionContext,
- shareholdingContext,
- taxExpenseContext (if found),
- documentWarnings.

Do not return core facts in this stage.
Focus only on the routed financial statement and note pages that are included in the provided text.`,
} as const;

const ANNUAL_REPORT_EXECUTION_FINGERPRINT_V1 =
  "annual-report-analysis-exec.v1.3";

type AnnualReportExecutionProfileKeyV1 =
  keyof typeof ANNUAL_REPORT_EXECUTION_PROFILES_MS_V1;

const ANNUAL_REPORT_EXECUTION_PROFILES_MS_V1 = {
  extractable_text_pdf: {
    locator: {
      primaryRequestTimeoutMs: 15_000,
      retryRequestTimeoutMs: 15_000,
      stageBudgetMs: 15_000,
    },
    coreFacts: {
      primaryRequestTimeoutMs: 30_000,
      retryRequestTimeoutMs: 35_000,
      stageBudgetMs: 60_000,
    },
    combined: {
      primaryRequestTimeoutMs: 30_000,
      retryRequestTimeoutMs: 45_000,
      stageBudgetMs: 120_000,
      minimumRetryBudgetMs: 16_000,
    },
    statements: {
      primaryRequestTimeoutMs: 40_000,
      retryRequestTimeoutMs: 65_000,
      stageBudgetMs: 135_000,
      minimumRetryBudgetMs: 20_000,
    },
    taxNotesAssets: {
      primaryRequestTimeoutMs: 30_000,
      retryRequestTimeoutMs: 45_000,
      stageBudgetMs: 90_000,
      minimumRetryBudgetMs: 18_000,
    },
    taxNotesFinance: {
      primaryRequestTimeoutMs: 30_000,
      retryRequestTimeoutMs: 45_000,
      stageBudgetMs: 90_000,
      minimumRetryBudgetMs: 18_000,
    },
    total: 420_000,
  },
  scanned_or_low_text_pdf: {
    locator: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 25_000,
      stageBudgetMs: 30_000,
    },
    coreFacts: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 25_000,
      stageBudgetMs: 35_000,
    },
    combined: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 25_000,
      stageBudgetMs: 40_000,
      minimumRetryBudgetMs: 10_000,
    },
    statements: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 25_000,
      stageBudgetMs: 40_000,
      minimumRetryBudgetMs: 8_000,
    },
    taxNotesAssets: {
      primaryRequestTimeoutMs: 15_000,
      retryRequestTimeoutMs: 20_000,
      stageBudgetMs: 25_000,
      minimumRetryBudgetMs: 8_000,
    },
    taxNotesFinance: {
      primaryRequestTimeoutMs: 15_000,
      retryRequestTimeoutMs: 20_000,
      stageBudgetMs: 25_000,
      minimumRetryBudgetMs: 8_000,
    },
    total: 150_000,
  },
  docx: {
    locator: {
      primaryRequestTimeoutMs: 15_000,
      retryRequestTimeoutMs: 15_000,
      stageBudgetMs: 15_000,
    },
    coreFacts: {
      primaryRequestTimeoutMs: 15_000,
      retryRequestTimeoutMs: 15_000,
      stageBudgetMs: 15_000,
    },
    combined: {
      primaryRequestTimeoutMs: 12_000,
      retryRequestTimeoutMs: 15_000,
      stageBudgetMs: 20_000,
      minimumRetryBudgetMs: 8_000,
    },
    statements: {
      primaryRequestTimeoutMs: 12_000,
      retryRequestTimeoutMs: 12_000,
      stageBudgetMs: 12_000,
      minimumRetryBudgetMs: 5_000,
    },
    taxNotesAssets: {
      primaryRequestTimeoutMs: 8_000,
      retryRequestTimeoutMs: 8_000,
      stageBudgetMs: 8_000,
      minimumRetryBudgetMs: 5_000,
    },
    taxNotesFinance: {
      primaryRequestTimeoutMs: 8_000,
      retryRequestTimeoutMs: 8_000,
      stageBudgetMs: 8_000,
      minimumRetryBudgetMs: 5_000,
    },
    total: 35_000,
  },
} as const;

const ANNUAL_REPORT_STAGE_CHUNKING_V1 = {
  coreFactsPrimary: 6,
  coreFactsFallback: 3,
  combinedTextPrimary: 3,
  combinedTextFallback: 2,
  statementsPrimary: 2,
  statementsFallback: 2,
  taxNotesPrimary: 2,
  taxNotesFallback: 2,
} as const;

const ANNUAL_REPORT_COMBINED_STAGE_GATES_V1 = {
  maxTextChunksBeforeSkip: 2,
  maxTextCharsBeforeSkip: 15_000,
} as const;

const ANNUAL_REPORT_STAGE_CHUNKING_OVERDRIVE_V1 = {
  coreFactsPrimary: 8,
  coreFactsFallback: 4,
  combinedTextPrimary: 6,
  combinedTextFallback: 4,
  statementsPrimary: 4,
  statementsFallback: 3,
  taxNotesPrimary: 4,
  taxNotesFallback: 3,
} as const;

const ANNUAL_REPORT_COMBINED_STAGE_GATES_OVERDRIVE_V1 = {
  maxTextChunksBeforeSkip: 99,
  maxTextCharsBeforeSkip: 250_000,
} as const;

const ANNUAL_REPORT_EXECUTION_PROFILES_OVERDRIVE_MS_V1 = {
  extractable_text_pdf: {
    locator: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 20_000,
      stageBudgetMs: 20_000,
    },
    coreFacts: {
      primaryRequestTimeoutMs: 90_000,
      retryRequestTimeoutMs: 120_000,
      stageBudgetMs: 180_000,
    },
    combined: {
      primaryRequestTimeoutMs: 120_000,
      retryRequestTimeoutMs: 180_000,
      stageBudgetMs: 360_000,
      minimumRetryBudgetMs: 45_000,
    },
    statements: {
      primaryRequestTimeoutMs: 90_000,
      retryRequestTimeoutMs: 120_000,
      stageBudgetMs: 240_000,
      minimumRetryBudgetMs: 30_000,
    },
    taxNotesAssets: {
      primaryRequestTimeoutMs: 75_000,
      retryRequestTimeoutMs: 120_000,
      stageBudgetMs: 210_000,
      minimumRetryBudgetMs: 30_000,
    },
    taxNotesFinance: {
      primaryRequestTimeoutMs: 75_000,
      retryRequestTimeoutMs: 120_000,
      stageBudgetMs: 210_000,
      minimumRetryBudgetMs: 30_000,
    },
    total: 900_000,
  },
  scanned_or_low_text_pdf: ANNUAL_REPORT_EXECUTION_PROFILES_MS_V1.scanned_or_low_text_pdf,
  docx: ANNUAL_REPORT_EXECUTION_PROFILES_MS_V1.docx,
} as const;

function resolveAnnualReportExecutionProfileV1(input: {
  executionProfile: AnnualReportExecutionProfileKeyV1;
  runtimeMode: "default" | "ai_overdrive";
}) {
  if (input.runtimeMode === "ai_overdrive") {
    return ANNUAL_REPORT_EXECUTION_PROFILES_OVERDRIVE_MS_V1[input.executionProfile];
  }

  return ANNUAL_REPORT_EXECUTION_PROFILES_MS_V1[input.executionProfile];
}

function resolveAnnualReportStageChunkingV1(input: {
  runtimeMode: "default" | "ai_overdrive";
}) {
  return input.runtimeMode === "ai_overdrive"
    ? ANNUAL_REPORT_STAGE_CHUNKING_OVERDRIVE_V1
    : ANNUAL_REPORT_STAGE_CHUNKING_V1;
}

function resolveAnnualReportCombinedStageGatesV1(input: {
  runtimeMode: "default" | "ai_overdrive";
}) {
  return input.runtimeMode === "ai_overdrive"
    ? ANNUAL_REPORT_COMBINED_STAGE_GATES_OVERDRIVE_V1
    : ANNUAL_REPORT_COMBINED_STAGE_GATES_V1;
}

function resolveAnnualReportModelTierV1(input: {
  preferred: "fast" | "thinking";
  runtimeMode: "default" | "ai_overdrive";
}): "fast" | "thinking" {
  return input.runtimeMode === "ai_overdrive" ? "thinking" : input.preferred;
}

type AnnualReportStageErrorV1 = {
  code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
  message: string;
};

const ANNUAL_REPORT_STAGE_LABELS_V1 = {
  locator: "locator",
  coreFacts: "core facts",
  combinedTextExtraction: "combined text extraction",
  statements: "statements",
  taxNotesAssets: "tax notes assets/reserves",
  taxNotesFinance: "tax notes finance/other",
} as const;

function formatAnnualReportStageErrorV1(input: {
  stage: string;
  error: {
    code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
    message: string;
    context: Record<string, unknown>;
  };
}) {
  return {
    ...input.error,
    message: `[${input.stage}] ${input.error.message}`,
    context: {
      ...input.error.context,
      stage: input.stage,
    },
  };
}

function isRetryableAnnualReportStageErrorV1(
  error: AnnualReportStageErrorV1,
): boolean {
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

function formatPageRanges(ranges: AnnualReportAiSectionLocatorRangeV1[]): string {
  if (!ranges || ranges.length === 0) return "the entire document";

  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage);
  const parts = sorted.map((range) =>
    range.startPage === range.endPage
      ? `${range.startPage}`
      : `${range.startPage}-${range.endPage}`,
  );

  return `pages ${parts.join(", ")}`;
}

function normalizeAiRangesV1(input: {
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  return normalizeAnnualReportPageRangesV1({
    maxPage: input.maxPage,
    ranges: input.ranges,
  }).map((range) => ({
    ...range,
    confidence: 1,
  }));
}

function summarizeStageIssueV1(error: {
  code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
  context: Record<string, unknown>;
  message: string;
}): string {
  const issueSummary = error.context.issueSummary;
  if (typeof issueSummary === "string" && issueSummary.trim().length > 0) {
    return issueSummary.trim();
  }

  return error.message.slice(0, 180);
}

function createStageTimeoutErrorV1(input: {
  budgetMs: number;
  elapsedMs: number;
  remainingBudgetMs?: number;
  reason?: "stage_budget_exceeded" | "total_deadline_exhausted" | "attempt_budget_below_floor";
  stageLabel: string;
}): {
  code: "MODEL_EXECUTION_FAILED";
  context: Record<string, unknown>;
  message: string;
} {
  const reason = input.reason ?? "stage_budget_exceeded";
  const message =
    reason === "total_deadline_exhausted"
      ? `Total extraction deadline was exhausted after ${input.elapsedMs}ms.`
      : reason === "attempt_budget_below_floor"
        ? `Remaining budget ${input.remainingBudgetMs ?? 0}ms is below the minimum retry floor for ${input.stageLabel}.`
        : `Stage timed out after ${input.elapsedMs}ms (budget ${input.budgetMs}ms).`;
  return {
    code: "MODEL_EXECUTION_FAILED",
    message,
    context: {
      budgetMs: input.budgetMs,
      elapsedMs: input.elapsedMs,
      remainingBudgetMs: input.remainingBudgetMs,
      reason,
      stage: input.stageLabel,
    },
  };
}

function buildCoreFactsSeedHintsV1(
  fields: Partial<{
    accountingStandard: { valueText: string };
    companyName: { valueText: string };
    fiscalYearEnd: { valueText: string };
    fiscalYearStart: { valueText: string };
    organizationNumber: { valueText: string };
    profitBeforeTax: { valueText: string };
  }>,
): string | undefined {
  const hints: string[] = [];
  if (fields.companyName?.valueText) {
    hints.push(`companyName=${fields.companyName.valueText}`);
  }
  if (fields.organizationNumber?.valueText) {
    hints.push(`organizationNumber=${fields.organizationNumber.valueText}`);
  }
  if (fields.fiscalYearStart?.valueText && fields.fiscalYearEnd?.valueText) {
    hints.push(
      `fiscalYear=${fields.fiscalYearStart.valueText} to ${fields.fiscalYearEnd.valueText}`,
    );
  }
  if (fields.accountingStandard?.valueText) {
    hints.push(`accountingStandard=${fields.accountingStandard.valueText}`);
  }
  if (fields.profitBeforeTax?.valueText) {
    hints.push(`profitBeforeTax=${fields.profitBeforeTax.valueText}`);
  }

  if (hints.length === 0) {
    return undefined;
  }

  return `Deterministic hints from parsed text:\n- ${hints.join("\n- ")}\nValidate these hints against the document and keep unsupported fields as needs_review.`;
}

function applyCoreFactsSeedFallbackV1(input: {
  coreFacts: AnnualReportAiCoreFactsResultV1;
  seed: AnnualReportCoreFactsSeedV1;
  warnings: string[];
}): AnnualReportAiCoreFactsResultV1 {
  const fields = { ...input.coreFacts.fields };

  const applyBasicSeedField = (
    fieldName: "companyName" | "organizationNumber",
    seedFieldName: "companyName" | "organizationNumber",
  ) => {
    const currentField = fields[fieldName];
    const seedField = input.seed.fields[seedFieldName];
    if (!seedField) {
      return;
    }
    if (currentField.status === "extracted" && currentField.valueText !== undefined) {
      return;
    }

    fields[fieldName] = {
      ...currentField,
      status: "extracted",
      confidence: Math.max(currentField.confidence ?? 0, 0.7),
      valueText: currentField.valueText ?? seedField.valueText,
      page: currentField.page ?? seedField.page,
    };
    input.warnings.push(`fallback.core_facts.${fieldName}=seeded_from_deterministic_text`);
  };

  applyBasicSeedField("companyName", "companyName");
  applyBasicSeedField("organizationNumber", "organizationNumber");

  const fiscalYearStartSeed = input.seed.fields.fiscalYearStart;
  if (fiscalYearStartSeed) {
    const currentField = fields.fiscalYearStart;
    if (
      currentField.status !== "extracted" ||
      (currentField.normalizedValue === undefined && currentField.valueText === undefined)
    ) {
      fields.fiscalYearStart = {
        ...currentField,
        status: "extracted",
        confidence: Math.max(currentField.confidence ?? 0, 0.7),
        valueText: currentField.valueText ?? fiscalYearStartSeed.valueText,
        page: currentField.page ?? fiscalYearStartSeed.page,
        normalizedValue:
          currentField.normalizedValue ??
          (typeof fiscalYearStartSeed.normalizedValue === "string"
            ? fiscalYearStartSeed.normalizedValue
            : undefined),
      };
      input.warnings.push("fallback.core_facts.fiscalYearStart=seeded_from_deterministic_text");
    }
  }

  const fiscalYearEndSeed = input.seed.fields.fiscalYearEnd;
  if (fiscalYearEndSeed) {
    const currentField = fields.fiscalYearEnd;
    if (
      currentField.status !== "extracted" ||
      (currentField.normalizedValue === undefined && currentField.valueText === undefined)
    ) {
      fields.fiscalYearEnd = {
        ...currentField,
        status: "extracted",
        confidence: Math.max(currentField.confidence ?? 0, 0.7),
        valueText: currentField.valueText ?? fiscalYearEndSeed.valueText,
        page: currentField.page ?? fiscalYearEndSeed.page,
        normalizedValue:
          currentField.normalizedValue ??
          (typeof fiscalYearEndSeed.normalizedValue === "string"
            ? fiscalYearEndSeed.normalizedValue
            : undefined),
      };
      input.warnings.push("fallback.core_facts.fiscalYearEnd=seeded_from_deterministic_text");
    }
  }

  const accountingStandardSeed = input.seed.fields.accountingStandard;
  if (accountingStandardSeed) {
    const currentField = fields.accountingStandard;
    if (
      currentField.status !== "extracted" ||
      (currentField.normalizedValue === undefined && currentField.valueText === undefined)
    ) {
      fields.accountingStandard = {
        ...currentField,
        status: "extracted",
        confidence: Math.max(currentField.confidence ?? 0, 0.7),
        valueText: currentField.valueText ?? accountingStandardSeed.valueText,
        page: currentField.page ?? accountingStandardSeed.page,
        normalizedValue:
          currentField.normalizedValue ??
          (accountingStandardSeed.normalizedValue === "K2" ||
          accountingStandardSeed.normalizedValue === "K3"
            ? accountingStandardSeed.normalizedValue
            : undefined),
      };
      input.warnings.push("fallback.core_facts.accountingStandard=seeded_from_deterministic_text");
    }
  }

  const profitBeforeTaxSeed = input.seed.fields.profitBeforeTax;
  if (profitBeforeTaxSeed) {
    const currentField = fields.profitBeforeTax;
    if (
      currentField.status !== "extracted" ||
      (currentField.normalizedValue === undefined && currentField.valueText === undefined)
    ) {
      fields.profitBeforeTax = {
        ...currentField,
        status: "extracted",
        confidence: Math.max(currentField.confidence ?? 0, 0.7),
        valueText: currentField.valueText ?? profitBeforeTaxSeed.valueText,
        page: currentField.page ?? profitBeforeTaxSeed.page,
        normalizedValue:
          currentField.normalizedValue ??
          (typeof profitBeforeTaxSeed.normalizedValue === "number"
            ? profitBeforeTaxSeed.normalizedValue
            : undefined),
      };
      input.warnings.push("fallback.core_facts.profitBeforeTax=seeded_from_deterministic_text");
    }
  }

  return {
    ...input.coreFacts,
    fields,
  };
}

function buildUserInstructionV1(input: {
  document: AnnualReportPreparedDocumentV1;
  stageInstruction: string;
  focusContext?: string;
  deterministicHints?: string;
}): string {
  const textSection =
    input.document.inlineDataBase64 || input.document.uri
      ? "The uploaded PDF is attached as a document part. Use it directly."
      : input.document.text.length > 0
      ? `Document text:\n${input.document.text}`
      : "The uploaded PDF is attached as a document part. Use it directly.";

  const focus = input.focusContext
    ? `\n\nCRITICAL: Analyze ONLY ${input.focusContext}. Ignore all other pages for this task.`
    : "";

  return [
    ANNUAL_REPORT_ANALYSIS_USER_PROMPT_V1,
    input.stageInstruction,
    input.deterministicHints,
    focus,
    textSection,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function createEmptyTaxDeepV1(): AnnualReportAiExtractionResultV1["taxDeep"] {
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

async function executeAnnualReportStageV1<TOutput>(input: {
  apiKey?: string;
  modelConfig: GeminiModelConfigV1;
  modelTier: "fast" | "thinking";
  document: AnnualReportPreparedDocumentV1;
  responseSchema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: TOutput }
      | {
          success: false;
          error: {
            issues: Array<{
              code: string;
              message: string;
              path: Array<string | number>;
            }>;
          };
        };
  };
  stageInstruction: string;
  focusContext?: string;
  deterministicHints?: string;
  timeoutMs?: number;
  useResponseJsonSchema?: boolean;
}) {
  return generateGeminiStructuredOutputV1<TOutput>({
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    request: {
      modelTier: input.modelTier,
      responseSchema: input.responseSchema as never,
      timeoutMs: input.timeoutMs,
      useResponseJsonSchema: input.useResponseJsonSchema,
      systemInstruction: ANNUAL_REPORT_ANALYSIS_SYSTEM_PROMPT_V1,
      userInstruction: buildUserInstructionV1({
        document: input.document,
        stageInstruction: input.stageInstruction,
        focusContext: input.focusContext,
        deterministicHints: input.deterministicHints,
      }),
      documents: input.document.inlineDataBase64
        ? [
            {
              dataBase64: input.document.inlineDataBase64,
              mimeType: input.document.mimeType,
            },
          ]
        : input.document.uri
          ? [
              {
                kind: "uri",
                uri: input.document.uri,
                mimeType: input.document.mimeType,
              },
            ]
          : undefined,
    },
  });
}

function makeChunkDocumentV1(input: {
  pdfBytes: Uint8Array;
}): AnnualReportPreparedDocumentV1 {
  return {
    executionProfile: "scanned_or_low_text_pdf",
    fileType: "pdf",
    mimeType: "application/pdf",
    inlineDataBase64: toBase64V1(input.pdfBytes),
    sourcePdfBytes: input.pdfBytes,
    text: "",
  };
}

function makeTextDocumentFromRangesV1(input: {
  document: AnnualReportPreparedDocumentV1;
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportPreparedDocumentV1 | null {
  if (
    input.document.fileType !== "pdf" ||
    !input.document.sourceText ||
    input.document.sourceText.fileType !== "pdf" ||
    input.document.sourceText.pageTexts.length === 0 ||
    input.focusRanges.length === 0
  ) {
    return null;
  }

  const pages = normalizeAnnualReportPageRangesV1({
    maxPage: input.document.sourceText.pageTexts.length,
    ranges: input.focusRanges,
  }).flatMap((range) => {
    const pageNumbers: number[] = [];
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      pageNumbers.push(page);
    }
    return pageNumbers;
  });
  const selectedTexts = [...new Set(pages)]
    .map((page) => input.document.sourceText?.pageTexts[page - 1] ?? "")
    .filter((text) => text.trim().length > 0);
  if (selectedTexts.length === 0) {
    return null;
  }

  return {
    ...input.document,
    inlineDataBase64: undefined,
    mimeType: "text/plain",
    sourcePdfBytes: undefined,
    text: selectedTexts.join("\n\n"),
  };
}

function buildStageDocumentV1(input: {
  document: AnnualReportPreparedDocumentV1;
  executionProfile: "extractable_text_pdf" | "scanned_or_low_text_pdf" | "docx";
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
  preferTextForExtractablePdf?: boolean;
}): {
  document: AnnualReportPreparedDocumentV1;
  inputType: "compact_text" | "text" | "pdf";
} {
  if (
    input.executionProfile === "extractable_text_pdf" &&
    input.preferTextForExtractablePdf
  ) {
    const textDocument = makeTextDocumentFromRangesV1({
      document: input.document,
      focusRanges: input.focusRanges,
    });
    if (textDocument) {
      return {
        document: textDocument,
        inputType: "text",
      };
    }
  }

  return {
    document: input.document,
    inputType:
      input.document.inlineDataBase64 || input.document.uri ? "pdf" : "text",
  };
}

function makeCompactCoreFactsDocumentV1(input: {
  document: AnnualReportPreparedDocumentV1;
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
  seed: {
    diagnostics: string[];
    fields: Partial<{
      accountingStandard: { valueText: string };
      companyName: { valueText: string };
      fiscalYearEnd: { valueText: string };
      fiscalYearStart: { valueText: string };
      organizationNumber: { valueText: string };
      profitBeforeTax: { valueText: string };
    }>;
  };
}): {
  diagnostics: string[];
  document: AnnualReportPreparedDocumentV1 | null;
} {
  if (!input.document.sourceText || input.document.sourceText.fileType !== "pdf") {
    return {
      diagnostics: [
        "core_facts.compact_lines=0",
        "core_facts.compact_chars=0",
        "core_facts.seed_fields=0",
      ],
      document: null,
    };
  }

  const compact = buildAnnualReportCoreFactsCompactTextV1({
    sourceText: input.document.sourceText,
    coreFactsRanges: input.focusRanges,
    seed: input.seed,
  });
  if (compact.text.trim().length === 0) {
    return {
      diagnostics: compact.diagnostics,
      document: null,
    };
  }

  return {
    diagnostics: compact.diagnostics,
    document: {
      ...input.document,
      inlineDataBase64: undefined,
      mimeType: "text/plain",
      sourcePdfBytes: undefined,
      text: compact.text,
    },
  };
}

async function executeAnnualReportStageWithChunkFallbackV1<TOutput>(input: {
  apiKey?: string;
  currentStatus: AnnualReportProcessingRunStatusV1;
  chunkLabel: string;
  document: AnnualReportPreparedDocumentV1;
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
  modelConfig: GeminiModelConfigV1;
  onProgress?: (
    status: AnnualReportProcessingRunStatusV1,
    technicalDetails?: string[],
  ) => Promise<void>;
  responseSchema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: TOutput }
      | {
          success: false;
          error: {
            issues: Array<{
              code: string;
              message: string;
              path: Array<string | number>;
            }>;
          };
        };
  };
  stageInstruction: string;
  deterministicHints?: string;
  primaryModelTier?: "fast" | "thinking";
  fallbackModelTier?: "fast" | "thinking";
  primaryRequestTimeoutMs: number;
  retryRequestTimeoutMs: number;
  stageBudgetMs: number;
  totalDeadlineMs: number;
  minimumRetryBudgetMs?: number;
  primaryMaxCharsPerChunk?: number;
  fallbackMaxCharsPerChunk?: number;
  allowTextChunking?: boolean;
  useResponseJsonSchema?: boolean;
  warnings: string[];
  primaryChunkPages: number;
  fallbackChunkPages: number;
  skipWhenMissingRanges?: boolean;
}): Promise<
  | {
      ok: true;
      outputs: TOutput[];
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    }
> {
  const normalizedFocusContext = formatPageRanges(input.focusRanges);
  const stageStartedAt = Date.now();

  const getRemainingBudgetMs = (): number => {
    const stageRemaining = input.stageBudgetMs - (Date.now() - stageStartedAt);
    const totalRemaining = input.totalDeadlineMs - Date.now();
    return Math.min(stageRemaining, totalRemaining);
  };

  const ensureBudgetRemaining = () => {
    const remainingBudgetMs = getRemainingBudgetMs();
    if (remainingBudgetMs > 0) {
      return {
        ok: true as const,
        remainingBudgetMs,
      };
    }

    return {
      ok: false as const,
      error: createStageTimeoutErrorV1({
        budgetMs: input.stageBudgetMs,
        elapsedMs: Date.now() - stageStartedAt,
        reason:
          input.totalDeadlineMs - Date.now() <= 0
            ? "total_deadline_exhausted"
            : "stage_budget_exceeded",
        stageLabel: input.chunkLabel,
      }),
    };
  };

  const resolveAttemptTimeoutMs = (inputAttempt: {
    attemptKind: "primary" | "retry";
    configuredTimeoutMs: number;
  }) => {
    const remainingBudget = ensureBudgetRemaining();
    if (!remainingBudget.ok) {
      return remainingBudget;
    }

    const minimumBudgetFloorMs =
      inputAttempt.attemptKind === "retry"
        ? input.minimumRetryBudgetMs ?? 8_000
        : Math.min(input.minimumRetryBudgetMs ?? 8_000, inputAttempt.configuredTimeoutMs);
    if (remainingBudget.remainingBudgetMs < minimumBudgetFloorMs) {
      input.warnings.push(
        `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.remaining_ms=${remainingBudget.remainingBudgetMs}`,
        `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.minimum_floor_ms=${minimumBudgetFloorMs}`,
      );
      return {
        ok: false as const,
        error: createStageTimeoutErrorV1({
          budgetMs: input.stageBudgetMs,
          elapsedMs: Date.now() - stageStartedAt,
          remainingBudgetMs: remainingBudget.remainingBudgetMs,
          reason: "attempt_budget_below_floor",
          stageLabel: input.chunkLabel,
        }),
      };
    }

    const effectiveTimeoutMs = Math.min(
      inputAttempt.configuredTimeoutMs,
      remainingBudget.remainingBudgetMs,
    );
    input.warnings.push(
      `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.configured_timeout_ms=${inputAttempt.configuredTimeoutMs}`,
      `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.effective_timeout_ms=${effectiveTimeoutMs}`,
      `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.remaining_ms=${remainingBudget.remainingBudgetMs}`,
    );
    if (effectiveTimeoutMs < inputAttempt.configuredTimeoutMs) {
      input.warnings.push(
        `budget.${input.chunkLabel}.${inputAttempt.attemptKind}.timeout_clamped=1`,
      );
    }

    return {
      ok: true as const,
      effectiveTimeoutMs,
    };
  };

  if (
    input.document.fileType === "pdf" &&
    input.document.sourcePdfBytes &&
    input.focusRanges.length === 0 &&
    input.skipWhenMissingRanges
  ) {
    input.warnings.push(`locator.${input.chunkLabel}.missing_ranges`);
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: `No focused PDF page ranges were available for ${input.chunkLabel}.`,
        context: {
          reason: "missing_ranges",
          chunkLabel: input.chunkLabel,
        },
      },
    };
  }

  const runWithChunks = async (
    maxPagesPerChunk: number,
    maxCharsPerChunk: number | undefined,
    modelTier: "fast" | "thinking",
    requestTimeoutMs: number,
    attemptKind: "primary" | "retry",
  ): Promise<
    | {
        ok: true;
        outputs: TOutput[];
      }
    | {
        ok: false;
        error: {
          code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
          message: string;
          context: Record<string, unknown>;
        };
      }
  > => {
    const textChunkDocuments =
      input.allowTextChunking !== false &&
      input.document.sourcePdfBytes === undefined
        ? extractAnnualReportTextChunkDocumentsV1({
            document: input.document,
            ranges: input.focusRanges,
            maxPagesPerChunk,
            maxCharsPerChunk: maxCharsPerChunk ?? 12_000,
          })
        : [];
    if (textChunkDocuments.length > 0) {
      input.warnings.push(
        `chunking.${input.chunkLabel}.text_chunks=${textChunkDocuments.length}`,
      );
      await input.onProgress?.(input.currentStatus, [
        `progress.${input.chunkLabel}.text_chunks=${textChunkDocuments.length}`,
        `progress.${input.chunkLabel}.max_pages_per_chunk=${maxPagesPerChunk}`,
        `progress.${input.chunkLabel}.max_chars_per_chunk=${maxCharsPerChunk ?? 12_000}`,
      ]);
      const outputs: TOutput[] = [];
      for (const [chunkIndex, chunk] of textChunkDocuments.entries()) {
        const timeoutResolution = resolveAttemptTimeoutMs({
          attemptKind,
          configuredTimeoutMs: requestTimeoutMs,
        });
        if (!timeoutResolution.ok) {
          return timeoutResolution;
        }
        await input.onProgress?.(input.currentStatus, [
          `progress.${input.chunkLabel}.chunk=${chunkIndex + 1}/${textChunkDocuments.length}`,
          `progress.${input.chunkLabel}.elapsed_ms=${Date.now() - stageStartedAt}`,
        ]);
        const stageResult = await executeAnnualReportStageV1<TOutput>({
          apiKey: input.apiKey,
          modelConfig: input.modelConfig,
          modelTier,
          document: {
            ...input.document,
            inlineDataBase64: undefined,
            mimeType: "text/plain",
            sourcePdfBytes: undefined,
            text: chunk.text,
          },
          responseSchema: input.responseSchema,
          stageInstruction: input.stageInstruction,
          focusContext: formatPageRanges(
            chunk.pageRanges.map((range) => ({
              startPage: range.startPage,
              endPage: range.endPage,
              confidence: 1,
            })),
          ),
          deterministicHints: input.deterministicHints,
          timeoutMs: timeoutResolution.effectiveTimeoutMs,
          useResponseJsonSchema: input.useResponseJsonSchema,
        });
        if (!stageResult.ok) {
          return stageResult;
        }
        outputs.push(stageResult.output);
      }

      input.warnings.push(
        `chunking.${input.chunkLabel}.applied_text_chunks=${textChunkDocuments.length} maxPagesPerChunk=${maxPagesPerChunk}`,
      );
      return {
        ok: true,
        outputs,
      };
    }

    if (
      input.document.fileType !== "pdf" ||
      !input.document.sourcePdfBytes
    ) {
      const timeoutResolution = resolveAttemptTimeoutMs({
        attemptKind,
        configuredTimeoutMs: requestTimeoutMs,
      });
      if (!timeoutResolution.ok) {
        return timeoutResolution;
      }
      const stageResult = await executeAnnualReportStageV1<TOutput>({
        apiKey: input.apiKey,
        modelConfig: input.modelConfig,
        modelTier,
        document: input.document,
        responseSchema: input.responseSchema,
        stageInstruction: input.stageInstruction,
        focusContext: normalizedFocusContext,
        deterministicHints: input.deterministicHints,
        timeoutMs: timeoutResolution.effectiveTimeoutMs,
        useResponseJsonSchema: input.useResponseJsonSchema,
      });
      if (!stageResult.ok) {
        return stageResult;
      }
      return {
        ok: true,
        outputs: [stageResult.output],
      };
    }

    const chunkDocuments = await extractAnnualReportPdfChunkDocumentsV1({
      pdfBytes: input.document.sourcePdfBytes,
      ranges: input.focusRanges,
      maxPagesPerChunk,
    });
    if (chunkDocuments.length > 0) {
      input.warnings.push(
        `progress.${input.chunkLabel}.chunks=${chunkDocuments.length}`,
      );
      await input.onProgress?.(input.currentStatus, [
        `progress.${input.chunkLabel}.chunks=${chunkDocuments.length}`,
        `progress.${input.chunkLabel}.max_pages_per_chunk=${maxPagesPerChunk}`,
      ]);
    }

    if (chunkDocuments.length === 0) {
      const timeoutResolution = resolveAttemptTimeoutMs({
        attemptKind,
        configuredTimeoutMs: requestTimeoutMs,
      });
      if (!timeoutResolution.ok) {
        return timeoutResolution;
      }
      const stageResult = await executeAnnualReportStageV1<TOutput>({
        apiKey: input.apiKey,
        modelConfig: input.modelConfig,
        modelTier,
        document: input.document,
        responseSchema: input.responseSchema,
        stageInstruction: input.stageInstruction,
        focusContext: normalizedFocusContext,
        deterministicHints: input.deterministicHints,
        timeoutMs: timeoutResolution.effectiveTimeoutMs,
        useResponseJsonSchema: input.useResponseJsonSchema,
      });
      if (!stageResult.ok) {
        return stageResult;
      }
      return {
        ok: true,
        outputs: [stageResult.output],
      };
    }

    const outputs: TOutput[] = [];
    for (const [chunkIndex, chunk] of chunkDocuments.entries()) {
      const timeoutResolution = resolveAttemptTimeoutMs({
        attemptKind,
        configuredTimeoutMs: requestTimeoutMs,
      });
      if (!timeoutResolution.ok) {
        return timeoutResolution;
      }
      await input.onProgress?.(input.currentStatus, [
        `progress.${input.chunkLabel}.chunk=${chunkIndex + 1}/${chunkDocuments.length}`,
        `progress.${input.chunkLabel}.elapsed_ms=${Date.now() - stageStartedAt}`,
      ]);
      const stageResult = await executeAnnualReportStageV1<TOutput>({
        apiKey: input.apiKey,
        modelConfig: input.modelConfig,
        modelTier,
        document: makeChunkDocumentV1({ pdfBytes: chunk.pdfBytes }),
        responseSchema: input.responseSchema,
        stageInstruction: input.stageInstruction,
        focusContext: formatPageRanges(
          chunk.pageRanges.map((range) => ({
            startPage: range.startPage,
            endPage: range.endPage,
            confidence: 1,
          })),
        ),
        deterministicHints: input.deterministicHints,
        timeoutMs: timeoutResolution.effectiveTimeoutMs,
        useResponseJsonSchema: input.useResponseJsonSchema,
      });

      if (!stageResult.ok) {
        return stageResult;
      }
      outputs.push(stageResult.output);
    }

    input.warnings.push(
      `chunking.${input.chunkLabel}.applied chunks=${chunkDocuments.length} maxPagesPerChunk=${maxPagesPerChunk}`,
    );

    return {
      ok: true,
      outputs,
    };
  };

  const primaryResult = await runWithChunks(
    input.primaryChunkPages,
    input.primaryMaxCharsPerChunk,
    input.primaryModelTier ?? "fast",
    input.primaryRequestTimeoutMs,
    "primary",
  );
  if (primaryResult.ok) {
    return primaryResult;
  }

  const primaryError = primaryResult.error;
  if (!isRetryableAnnualReportStageErrorV1(primaryError)) {
    return primaryResult;
  }

  input.warnings.push(
    `chunking.${input.chunkLabel}.retry reason=${primaryError.code}:${primaryError.message.slice(0, 180)}`,
    `chunking.${input.chunkLabel}.primary_request_timeout_ms=${input.primaryRequestTimeoutMs}`,
    `chunking.${input.chunkLabel}.retry_request_timeout_ms=${input.retryRequestTimeoutMs}`,
    `chunking.${input.chunkLabel}.stage_budget_ms=${input.stageBudgetMs}`,
    `chunking.${input.chunkLabel}.retry_model_tier=${
      input.fallbackModelTier ?? input.primaryModelTier ?? "fast"
    }`,
  );
  await input.onProgress?.(input.currentStatus, [
    `progress.${input.chunkLabel}.retry=1`,
    `progress.${input.chunkLabel}.retry_reason=${summarizeStageIssueV1(primaryError)}`,
  ]);

  const fallbackResult = await runWithChunks(
    input.fallbackChunkPages,
    input.fallbackMaxCharsPerChunk,
    input.fallbackModelTier ?? input.primaryModelTier ?? "fast",
    input.retryRequestTimeoutMs,
    "retry",
  );
  if (fallbackResult.ok) {
    input.warnings.push(
      `chunking.${input.chunkLabel}.fallback_chunks_succeeded maxPagesPerChunk=${input.fallbackChunkPages}`,
    );
    return fallbackResult;
  }

  if (!isRetryableAnnualReportStageErrorV1(fallbackResult.error)) {
    return fallbackResult;
  }

  if (input.document.fileType === "pdf" && input.document.sourcePdfBytes) {
    return fallbackResult;
  }

  const timeoutResolution = resolveAttemptTimeoutMs({
    attemptKind: "retry",
    configuredTimeoutMs: input.retryRequestTimeoutMs,
  });
  if (!timeoutResolution.ok) {
    return timeoutResolution;
  }

  const fullDocumentResult = await executeAnnualReportStageV1<TOutput>({
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    modelTier: input.fallbackModelTier ?? input.primaryModelTier ?? "fast",
    document: input.document,
    responseSchema: input.responseSchema,
    stageInstruction: input.stageInstruction,
    focusContext: normalizedFocusContext,
    deterministicHints: input.deterministicHints,
    timeoutMs: timeoutResolution.effectiveTimeoutMs,
    useResponseJsonSchema: input.useResponseJsonSchema,
  });

  if (!fullDocumentResult.ok) {
    return fullDocumentResult;
  }

  input.warnings.push(
    `chunking.${input.chunkLabel}.full_document_fallback_succeeded`,
  );

  return {
    ok: true,
    outputs: [fullDocumentResult.output],
  };
}

function shouldUseProviderJsonSchemaV1(input: {
  chunkLabel: string;
  executionProfile: "extractable_text_pdf" | "scanned_or_low_text_pdf" | "docx";
}) {
  if (input.executionProfile !== "extractable_text_pdf") {
    return false;
  }

  return false;
}

function shouldPreferRequiredStagesFirstV1(input: {
  executionProfile: "extractable_text_pdf" | "scanned_or_low_text_pdf" | "docx";
  runtimeMode: "default" | "ai_overdrive";
}): boolean {
  return (
    input.executionProfile === "extractable_text_pdf" &&
    input.runtimeMode !== "ai_overdrive"
  );
}

function shouldSkipCombinedExtractableStageV1(input: {
  document: AnnualReportPreparedDocumentV1;
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
  gates: {
    maxTextChunksBeforeSkip: number;
    maxTextCharsBeforeSkip: number;
  };
  chunking: {
    combinedTextPrimary: number;
  };
}): {
  skip: boolean;
  reason?: string;
  textChars?: number;
  textChunks?: number;
} {
  if (
    input.document.fileType !== "pdf" ||
    !input.document.sourceText ||
    input.document.sourceText.fileType !== "pdf"
  ) {
    return { skip: false };
  }

  const textChunks = extractAnnualReportTextChunkDocumentsV1({
    document: input.document,
    ranges: input.focusRanges,
    maxPagesPerChunk: input.chunking.combinedTextPrimary,
    maxCharsPerChunk: 12_000,
  });
  const textChars = textChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  if (textChunks.length > input.gates.maxTextChunksBeforeSkip) {
    return {
      skip: true,
      reason: "chunk_count_exceeded",
      textChunks: textChunks.length,
      textChars,
    };
  }

  if (textChars > input.gates.maxTextCharsBeforeSkip) {
    return {
      skip: true,
      reason: "text_chars_exceeded",
      textChunks: textChunks.length,
      textChars,
    };
  }

  return {
    skip: false,
    textChunks: textChunks.length,
    textChars,
  };
}

function dedupeStringsV1(values: Array<string | undefined | null>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  ];
}

function dedupeByKeyV1<TValue>(
  values: TValue[],
  buildKey: (value: TValue) => string,
): TValue[] {
  const seen = new Set<string>();
  const output: TValue[] = [];
  for (const value of values) {
    const key = buildKey(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
  }
  return output;
}

function buildStatementLineKeyV1(line: {
  code: string;
  label: string;
  currentYearValue?: number;
  priorYearValue?: number;
}) {
  return [
    line.code,
    line.label,
    line.currentYearValue ?? "",
    line.priorYearValue ?? "",
  ].join("|");
}

function resolveProfitBeforeTaxFromStatementsV1(input: {
  statementUnit?: AnnualReportAiExtractionResultV1["taxDeep"]["ink2rExtracted"]["statementUnit"];
  incomeStatement: AnnualReportAiExtractionResultV1["taxDeep"]["ink2rExtracted"]["incomeStatement"];
}): { normalizedValue: number; valueText: string } | null {
  const profitBeforeTaxLine = input.incomeStatement.find((line) => {
    if (typeof line.currentYearValue !== "number") {
      return false;
    }

    const normalizedCode = line.code.trim().toLowerCase();
    if (normalizedCode === "profit_before_tax") {
      return true;
    }

    const normalizedLabel = line.label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    return (
      normalizedLabel.includes("resultat fore skatt") ||
      normalizedLabel.includes("resultat före skatt") ||
      normalizedLabel.includes("profit before tax")
    );
  });

  if (!profitBeforeTaxLine || typeof profitBeforeTaxLine.currentYearValue !== "number") {
    return null;
  }

  const normalizedValue = profitBeforeTaxLine.currentYearValue;
  return {
    normalizedValue,
    valueText: String(Math.trunc(normalizedValue)),
  };
}

function applyProfitBeforeTaxStatementFallbackV1(input: {
  coreFacts: AnnualReportAiCoreFactsResultV1;
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
  warnings: string[];
}): AnnualReportAiCoreFactsResultV1 {
  const statementProfitBeforeTax = resolveProfitBeforeTaxFromStatementsV1({
    statementUnit: input.taxDeep.ink2rExtracted.statementUnit,
    incomeStatement: input.taxDeep.ink2rExtracted.incomeStatement,
  });
  if (!statementProfitBeforeTax) {
    return input.coreFacts;
  }

  const currentField = input.coreFacts.fields.profitBeforeTax;
  const nextField = {
    ...currentField,
    status: "extracted" as const,
    confidence:
      currentField.status === "extracted"
        ? Math.max(currentField.confidence ?? 0, 0.85)
        : Math.max(currentField.confidence ?? 0, 0.9),
    normalizedValue: statementProfitBeforeTax.normalizedValue,
    valueText: statementProfitBeforeTax.valueText,
  };
  const alreadyMatches =
    currentField.status === "extracted" &&
    currentField.normalizedValue === nextField.normalizedValue &&
    currentField.valueText === nextField.valueText;
  if (alreadyMatches) {
    return input.coreFacts;
  }

  input.warnings.push("fallback.core_facts.profitBeforeTax=ai_statement_row");
  return {
    ...input.coreFacts,
    fields: {
      ...input.coreFacts.fields,
      profitBeforeTax: nextField,
    },
  };
}

function sanitizeStatementsExtractedV1(input: {
  statementUnit?: AnnualReportAiStatementsOnlyResultV1["ink2rExtracted"]["statementUnit"];
  incomeStatement?: AnnualReportAiStatementsOnlyResultV1["ink2rExtracted"]["incomeStatement"];
  balanceSheet?: AnnualReportAiStatementsOnlyResultV1["ink2rExtracted"]["balanceSheet"];
}): AnnualReportAiStatementsOnlyResultV1["ink2rExtracted"] {
  return {
    statementUnit: input.statementUnit,
    incomeStatement: input.incomeStatement ?? [],
    balanceSheet: input.balanceSheet ?? [],
  };
}

function mergeStatementsOutputsV1(
  outputs: AnnualReportAiStatementsOnlyResultV1[],
): AnnualReportAiStatementsOnlyResultV1 {
  const first = outputs[0];
  const output: AnnualReportAiStatementsOnlyResultV1 = first
    ? {
        ...first,
        ink2rExtracted: sanitizeStatementsExtractedV1(first.ink2rExtracted),
      }
    : {
        schemaVersion: "annual_report_ai_statements_only_v1",
        ink2rExtracted: {
          statementUnit: undefined,
          incomeStatement: [],
          balanceSheet: [],
        },
        priorYearComparatives: [],
        evidence: [],
      };

  for (const next of outputs.slice(1)) {
    output.ink2rExtracted.incomeStatement = [
      ...output.ink2rExtracted.incomeStatement,
      ...next.ink2rExtracted.incomeStatement,
    ];
    output.ink2rExtracted.balanceSheet = [
      ...output.ink2rExtracted.balanceSheet,
      ...next.ink2rExtracted.balanceSheet,
    ];
    output.priorYearComparatives = [
      ...output.priorYearComparatives,
      ...next.priorYearComparatives,
    ];
    output.evidence = [...output.evidence, ...next.evidence];
    if (!output.ink2rExtracted.statementUnit && next.ink2rExtracted.statementUnit) {
      output.ink2rExtracted.statementUnit = next.ink2rExtracted.statementUnit;
    }
  }

  output.ink2rExtracted.incomeStatement = dedupeByKeyV1(
    output.ink2rExtracted.incomeStatement,
    buildStatementLineKeyV1,
  );
  output.ink2rExtracted.balanceSheet = dedupeByKeyV1(
    output.ink2rExtracted.balanceSheet,
    buildStatementLineKeyV1,
  );
  output.priorYearComparatives = dedupeByKeyV1(
    output.priorYearComparatives,
    (comparative) =>
      [
        comparative.area,
        comparative.code,
        comparative.label,
        comparative.currentYearValue ?? "",
        comparative.priorYearValue ?? "",
      ].join("|"),
  );
  output.evidence = dedupeByKeyV1(
    output.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );

  return output;
}

function mergeAssetsOutputsV1(
  outputs: AnnualReportAiTaxNotesAssetsAndReservesResultV1[],
): AnnualReportAiTaxNotesAssetsAndReservesResultV1 {
  const first = outputs[0] ?? {
    schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
    depreciationContext: { assetAreas: [], evidence: [] },
    assetMovements: { lines: [], evidence: [] },
    reserveContext: { movements: [], notes: [], evidence: [] },
    evidence: [],
  };

  for (const next of outputs.slice(1)) {
    first.depreciationContext.assetAreas.push(...next.depreciationContext.assetAreas);
    first.depreciationContext.evidence.push(...next.depreciationContext.evidence);
    first.assetMovements.lines.push(...next.assetMovements.lines);
    first.assetMovements.evidence.push(...next.assetMovements.evidence);
    first.reserveContext.movements.push(...next.reserveContext.movements);
    first.reserveContext.notes.push(...next.reserveContext.notes);
    first.reserveContext.evidence.push(...next.reserveContext.evidence);
    first.evidence.push(...next.evidence);

    if (!first.taxExpenseContext && next.taxExpenseContext) {
      first.taxExpenseContext = next.taxExpenseContext;
    }
  }

  first.depreciationContext.assetAreas = dedupeByKeyV1(
    first.depreciationContext.assetAreas,
    (line) =>
      [
        line.assetArea,
        line.openingCarryingAmount ?? "",
        line.closingCarryingAmount ?? "",
        line.depreciationForYear ?? "",
      ].join("|"),
  );
  first.assetMovements.lines = dedupeByKeyV1(
    first.assetMovements.lines,
    (line) =>
      [
        line.assetArea,
        line.openingCarryingAmount ?? "",
        line.closingCarryingAmount ?? "",
        line.depreciationForYear ?? "",
      ].join("|"),
  );
  first.reserveContext.movements = dedupeByKeyV1(
    first.reserveContext.movements,
    (line) =>
      [
        line.reserveType,
        line.openingBalance ?? "",
        line.closingBalance ?? "",
        line.movementForYear ?? "",
      ].join("|"),
  );
  first.reserveContext.notes = dedupeStringsV1(first.reserveContext.notes);
  first.depreciationContext.evidence = dedupeByKeyV1(
    first.depreciationContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.assetMovements.evidence = dedupeByKeyV1(
    first.assetMovements.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.reserveContext.evidence = dedupeByKeyV1(
    first.reserveContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.evidence = dedupeByKeyV1(
    first.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );

  return first;
}

function mergeFinanceOutputsV1(
  outputs: AnnualReportAiTaxNotesFinanceAndOtherResultV1[],
): AnnualReportAiTaxNotesFinanceAndOtherResultV1 {
  const first = outputs[0] ?? {
    schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
    netInterestContext: { notes: [], evidence: [] },
    pensionContext: { flags: [], notes: [], evidence: [] },
    leasingContext: { flags: [], notes: [], evidence: [] },
    groupContributionContext: { flags: [], notes: [], evidence: [] },
    shareholdingContext: { flags: [], notes: [], evidence: [] },
    evidence: [],
  };

  for (const next of outputs.slice(1)) {
    first.netInterestContext.notes.push(...next.netInterestContext.notes);
    first.netInterestContext.evidence.push(...next.netInterestContext.evidence);
    first.pensionContext.flags.push(...next.pensionContext.flags);
    first.pensionContext.notes.push(...next.pensionContext.notes);
    first.pensionContext.evidence.push(...next.pensionContext.evidence);
    first.leasingContext.flags.push(...next.leasingContext.flags);
    first.leasingContext.notes.push(...next.leasingContext.notes);
    first.leasingContext.evidence.push(...next.leasingContext.evidence);
    first.groupContributionContext.flags.push(...next.groupContributionContext.flags);
    first.groupContributionContext.notes.push(...next.groupContributionContext.notes);
    first.groupContributionContext.evidence.push(...next.groupContributionContext.evidence);
    first.shareholdingContext.flags.push(...next.shareholdingContext.flags);
    first.shareholdingContext.notes.push(...next.shareholdingContext.notes);
    first.shareholdingContext.evidence.push(...next.shareholdingContext.evidence);
    first.evidence.push(...next.evidence);

    if (!first.taxExpenseContext && next.taxExpenseContext) {
      first.taxExpenseContext = next.taxExpenseContext;
    }
  }

  first.netInterestContext.notes = dedupeStringsV1(first.netInterestContext.notes);
  first.pensionContext.notes = dedupeStringsV1(first.pensionContext.notes);
  first.leasingContext.notes = dedupeStringsV1(first.leasingContext.notes);
  first.groupContributionContext.notes = dedupeStringsV1(first.groupContributionContext.notes);
  first.shareholdingContext.notes = dedupeStringsV1(first.shareholdingContext.notes);
  first.pensionContext.flags = dedupeByKeyV1(
    first.pensionContext.flags,
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  first.leasingContext.flags = dedupeByKeyV1(
    first.leasingContext.flags,
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  first.groupContributionContext.flags = dedupeByKeyV1(
    first.groupContributionContext.flags,
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  first.shareholdingContext.flags = dedupeByKeyV1(
    first.shareholdingContext.flags,
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  first.netInterestContext.evidence = dedupeByKeyV1(
    first.netInterestContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.pensionContext.evidence = dedupeByKeyV1(
    first.pensionContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.leasingContext.evidence = dedupeByKeyV1(
    first.leasingContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.groupContributionContext.evidence = dedupeByKeyV1(
    first.groupContributionContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.shareholdingContext.evidence = dedupeByKeyV1(
    first.shareholdingContext.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
  first.evidence = dedupeByKeyV1(
    first.evidence,
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );

  return first;
}

function mergeCombinedOutputsV1(
  outputs: AnnualReportAiCombinedTextExtractionResultV1[],
): AnnualReportAiCombinedTextExtractionResultV1 {
  const statements = mergeStatementsOutputsV1(
    outputs.map((output) => ({
      schemaVersion: "annual_report_ai_statements_only_v1",
      ink2rExtracted: output.ink2rExtracted ?? {
        incomeStatement: [],
        balanceSheet: [],
      },
      priorYearComparatives: output.priorYearComparatives ?? [],
      evidence: output.evidence ?? [],
    })),
  );
  const assets = mergeAssetsOutputsV1(
    outputs.map((output) => ({
      schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
      depreciationContext: output.depreciationContext ?? {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: output.assetMovements ?? {
        lines: [],
        evidence: [],
      },
      reserveContext: output.reserveContext ?? {
        movements: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: output.taxExpenseContext,
      evidence: output.evidence ?? [],
    })),
  );
  const finance = mergeFinanceOutputsV1(
    outputs.map((output) => ({
      schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
      netInterestContext: output.netInterestContext ?? {
        notes: [],
        evidence: [],
      },
      pensionContext: output.pensionContext ?? {
        flags: [],
        notes: [],
        evidence: [],
      },
      leasingContext: output.leasingContext ?? {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: output.groupContributionContext ?? {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: output.shareholdingContext ?? {
        flags: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: output.taxExpenseContext,
      evidence: output.evidence ?? [],
    })),
  );

  return {
    schemaVersion: "annual_report_ai_combined_text_extraction_v1",
    documentWarnings: dedupeStringsV1(
      outputs.flatMap((output) => output.documentWarnings),
    ),
    ink2rExtracted: statements.ink2rExtracted,
    priorYearComparatives: statements.priorYearComparatives,
    depreciationContext: assets.depreciationContext,
    assetMovements: assets.assetMovements,
    reserveContext: assets.reserveContext,
    netInterestContext: finance.netInterestContext,
    pensionContext: finance.pensionContext,
    leasingContext: finance.leasingContext,
    groupContributionContext: finance.groupContributionContext,
    shareholdingContext: finance.shareholdingContext,
    taxExpenseContext:
      assets.taxExpenseContext ??
      finance.taxExpenseContext,
    evidence: dedupeByKeyV1(
      outputs.flatMap((output) => output.evidence),
      (evidence) =>
        [
          evidence.page ?? "",
          evidence.section ?? "",
          evidence.noteReference ?? "",
          evidence.snippet,
        ].join("|"),
    ),
  };
}

function hasStatementsContentV1(
  output: Pick<
    AnnualReportAiCombinedTextExtractionResultV1,
    "ink2rExtracted" | "priorYearComparatives"
  >,
) {
  return (
    output.ink2rExtracted.incomeStatement.length > 0 ||
    output.ink2rExtracted.balanceSheet.length > 0 ||
    output.priorYearComparatives.length > 0
  );
}

function hasAssetsContentV1(
  output: Pick<
    AnnualReportAiCombinedTextExtractionResultV1,
    "depreciationContext" | "assetMovements" | "reserveContext" | "taxExpenseContext"
  >,
) {
  return (
    output.depreciationContext.assetAreas.length > 0 ||
    output.assetMovements.lines.length > 0 ||
    output.reserveContext.movements.length > 0 ||
    output.reserveContext.notes.length > 0 ||
    (output.taxExpenseContext?.notes.length ?? 0) > 0 ||
    Boolean(output.taxExpenseContext?.currentTax) ||
    Boolean(output.taxExpenseContext?.deferredTax) ||
    Boolean(output.taxExpenseContext?.totalTaxExpense)
  );
}

function hasFinanceContentV1(
  output: Pick<
    AnnualReportAiCombinedTextExtractionResultV1,
    | "netInterestContext"
    | "pensionContext"
    | "leasingContext"
    | "groupContributionContext"
    | "shareholdingContext"
    | "taxExpenseContext"
  >,
) {
  return (
    output.netInterestContext.notes.length > 0 ||
    output.pensionContext.flags.length > 0 ||
    output.pensionContext.notes.length > 0 ||
    output.leasingContext.flags.length > 0 ||
    output.leasingContext.notes.length > 0 ||
    output.groupContributionContext.flags.length > 0 ||
    output.groupContributionContext.notes.length > 0 ||
    output.shareholdingContext.flags.length > 0 ||
    output.shareholdingContext.notes.length > 0 ||
    Boolean(output.shareholdingContext.dividendsReceived) ||
    Boolean(output.shareholdingContext.dividendsPaid) ||
    (output.taxExpenseContext?.notes.length ?? 0) > 0
  );
}

export async function executeAnnualReportAnalysisV1(
  input: ExecuteAnnualReportAnalysisInputV1,
): Promise<ExecuteAnnualReportAnalysisResultV1> {
  const warnings: string[] = [];
  const runtimeMode = input.runtimeMode ?? "default";
  const executionProfile =
    input.document.executionProfile ?? (input.document.fileType === "pdf"
      ? "extractable_text_pdf"
      : "docx");
  const stageTimeouts = resolveAnnualReportExecutionProfileV1({
    executionProfile,
    runtimeMode,
  });
  const stageChunking = resolveAnnualReportStageChunkingV1({
    runtimeMode,
  });
  const combinedStageGates = resolveAnnualReportCombinedStageGatesV1({
    runtimeMode,
  });
  const extractionDeadlineMs =
    Date.now() + stageTimeouts.total;
  const deterministicPdfRouting =
    input.document.fileType === "pdf" ? input.document.pdfRouting : undefined;
  let selectedModelName = input.modelConfig.fastModel;
  const shouldSkipAiLocator =
    deterministicPdfRouting?.usableForDirectExtraction === true &&
    deterministicPdfRouting.confidence !== "low";
  const routingMode =
    deterministicPdfRouting?.usableForDirectExtraction
      ? shouldSkipAiLocator
        ? "deterministic_only"
        : "deterministic_plus_ai_refinement"
      : deterministicPdfRouting
        ? "ai_fallback_only"
        : "ai_primary";

  if (input.onProgress) {
    await input.onProgress("locating_sections", [
      `progress.stage=${
        deterministicPdfRouting ? "routing_document" : "locating_sections"
      }`,
      `progress.total_budget_ms=${stageTimeouts.total}`,
      `progress.routing.mode=${routingMode}`,
      `progress.execution.profile=${executionProfile}`,
      ...(deterministicPdfRouting
        ? [
            `progress.routing.confidence=${deterministicPdfRouting.confidence}`,
            `progress.routing.core_facts_ranges=${formatPageRanges(
              deterministicPdfRouting.sections.coreFacts,
            )}`,
            `progress.routing.statement_ranges=${formatPageRanges([
              ...deterministicPdfRouting.sections.incomeStatement,
              ...deterministicPdfRouting.sections.balanceSheet,
            ])}`,
          ]
        : []),
    ]);
  }

  let sections: AnnualReportAiSectionLocatorResultV1["sections"];
  let executionRanges =
    deterministicPdfRouting?.executionRanges ?? {
      statements: [] as AnnualReportAiSectionLocatorRangeV1[],
      taxNotesAssets: [] as AnnualReportAiSectionLocatorRangeV1[],
      taxNotesFinance: [] as AnnualReportAiSectionLocatorRangeV1[],
    };
  if (shouldSkipAiLocator) {
    warnings.push(
      ...deterministicPdfRouting.warnings,
      `routing.mode=${routingMode}`,
      "locator.ai.skipped deterministic_routing_sufficient",
    );
    sections = deterministicPdfRouting.sections;
    executionRanges = deterministicPdfRouting.executionRanges;
  } else {
    const locatorResult = await executeAnnualReportStageV1<AnnualReportAiSectionLocatorResultV1>({
      apiKey: input.apiKey,
      modelConfig: input.modelConfig,
      modelTier: "fast",
      document: input.document,
      responseSchema: AnnualReportAiSectionLocatorResultV1Schema,
      stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.locator,
      timeoutMs: stageTimeouts.locator.primaryRequestTimeoutMs,
      useResponseJsonSchema: false,
    });

    if (!locatorResult.ok) {
      if (deterministicPdfRouting) {
        warnings.push(
          ...deterministicPdfRouting.warnings,
          `routing.mode=${routingMode}`,
          `locator.ai.failed_using_deterministic:${summarizeStageIssueV1(
            locatorResult.error,
          )}`,
        );
        sections = deterministicPdfRouting.sections;
        executionRanges = deterministicPdfRouting.executionRanges;
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.locator,
          error: locatorResult.error,
        });
        return {
          ok: false,
          error: stageError,
        };
      }
    } else {
      selectedModelName = locatorResult.model;
      const locatorFallback =
        input.document.sourceText && input.document.sourceText.fileType === "pdf"
          ? resolveAnnualReportPdfLocatorSectionsV1({
              aiSections: locatorResult.output.sections,
              sourceText: input.document.sourceText,
            })
          : {
              sections: locatorResult.output.sections,
              warnings: [] as string[],
              executionRanges: {
                statements: [] as AnnualReportAiSectionLocatorRangeV1[],
                taxNotesAssets: [] as AnnualReportAiSectionLocatorRangeV1[],
                taxNotesFinance: [] as AnnualReportAiSectionLocatorRangeV1[],
              },
            };
      warnings.push(
        ...locatorResult.output.documentWarnings,
        ...locatorFallback.warnings,
        ...(deterministicPdfRouting ? [`routing.mode=${routingMode}`] : []),
      );
      sections = locatorFallback.sections;
      executionRanges = locatorFallback.executionRanges;
    }
  }
  const coreFactsSeed =
    input.document.fileType === "pdf"
      ? (input.document.coreFactsSeed ??
        input.document.pdfRouting?.coreFactsSeed ?? {
          diagnostics: [] as string[],
          fields: {},
        })
      : {
          diagnostics: [] as string[],
          fields: {},
        };
  warnings.push(...coreFactsSeed.diagnostics);
  warnings.push(
    `execution.fingerprint=${ANNUAL_REPORT_EXECUTION_FINGERPRINT_V1}`,
    `execution.runtime_mode=${runtimeMode}`,
    `execution.profile=${executionProfile}`,
    `routing.strategy=${
      routingMode === "deterministic_only"
        ? "deterministic"
        : routingMode === "deterministic_plus_ai_refinement"
          ? "deterministic_plus_ai"
          : routingMode === "ai_fallback_only"
            ? "ai_first_scan"
            : "ai_primary"
    }`,
    `execution.chunking.combined_skip_thresholds=${combinedStageGates.maxTextChunksBeforeSkip}/${combinedStageGates.maxTextCharsBeforeSkip}`,
    `execution.chunking.primary_pages=${stageChunking.combinedTextPrimary}/${stageChunking.statementsPrimary}/${stageChunking.taxNotesPrimary}`,
  );

  if (input.document.fileType === "pdf" && input.document.sourcePdfBytes) {
    const mergedStatementRanges = normalizeAnnualReportPageRangesV1({
      maxPage:
        input.document.pageCount ??
        input.document.pageTexts?.length ??
        Number.MAX_SAFE_INTEGER,
      ranges: [...sections.incomeStatement, ...sections.balanceSheet],
    });
    warnings.push(`chunking.locator.statement_ranges=${mergedStatementRanges.length}`);
  }
  const statementsFocusRanges =
    input.document.fileType === "pdf" && executionRanges.statements.length > 0
      ? executionRanges.statements
      : [...sections.incomeStatement, ...sections.balanceSheet];
  const taxNotesAssetsFocusRanges =
    input.document.fileType === "pdf" && executionRanges.taxNotesAssets.length > 0
      ? executionRanges.taxNotesAssets
      : [
          ...sections.depreciationAndAssets,
          ...sections.reserves,
          ...sections.taxExpense,
        ];
  const taxNotesFinanceFocusRanges =
    input.document.fileType === "pdf" && executionRanges.taxNotesFinance.length > 0
      ? executionRanges.taxNotesFinance
      : [
          ...sections.financeAndInterest,
          ...sections.pensionsAndLeasing,
          ...sections.groupContributionsAndShareholdings,
          ...sections.taxExpense,
        ];
  const combinedExtractableFocusRanges = [
    ...statementsFocusRanges,
    ...taxNotesAssetsFocusRanges,
    ...taxNotesFinanceFocusRanges,
  ];
  const coreFactsFocusRanges =
    runtimeMode === "ai_overdrive" && executionProfile === "extractable_text_pdf"
      ? normalizeAiRangesV1({
          maxPage:
            input.document.pageCount ??
            input.document.pageTexts?.length ??
            Number.MAX_SAFE_INTEGER,
          ranges: [...sections.coreFacts, ...statementsFocusRanges],
        })
      : sections.coreFacts;
  const compactCoreFacts =
    executionProfile === "extractable_text_pdf" && runtimeMode !== "ai_overdrive"
      ? makeCompactCoreFactsDocumentV1({
          document: input.document,
          focusRanges: coreFactsFocusRanges,
          seed: coreFactsSeed,
        })
      : {
          diagnostics: [] as string[],
          document: null,
        };
  warnings.push(...compactCoreFacts.diagnostics);
  const coreFactsDocument =
    executionProfile === "extractable_text_pdf"
      ? compactCoreFacts.document ??
        makeTextDocumentFromRangesV1({
          document: input.document,
          focusRanges: coreFactsFocusRanges,
        }) ??
        input.document
      : input.document;
  warnings.push(
    `core_facts.input=${
      coreFactsDocument.inlineDataBase64 || coreFactsDocument.uri
        ? "pdf"
        : compactCoreFacts.document
          ? "compact_text"
          : "text"
    }`,
    `core_facts.primary_request_timeout_ms=${stageTimeouts.coreFacts.primaryRequestTimeoutMs}`,
    `core_facts.retry_request_timeout_ms=${stageTimeouts.coreFacts.retryRequestTimeoutMs}`,
    `core_facts.stage_budget_ms=${stageTimeouts.coreFacts.stageBudgetMs}`,
  );
  if (executionProfile === "extractable_text_pdf" && compactCoreFacts.document) {
    warnings.push("core_facts.chunking=disabled_compact_text_single_shot");
  } else if (runtimeMode === "ai_overdrive" && executionProfile === "extractable_text_pdf") {
    warnings.push("core_facts.chunking=ai_overdrive_statement_context");
  }
  const statementsStageDocument = buildStageDocumentV1({
    document: input.document,
    executionProfile,
    focusRanges: statementsFocusRanges,
    preferTextForExtractablePdf: true,
  });
  warnings.push(`statements.input=${statementsStageDocument.inputType}`);
  warnings.push(
    `statements.primary_request_timeout_ms=${stageTimeouts.statements.primaryRequestTimeoutMs}`,
    `statements.retry_request_timeout_ms=${stageTimeouts.statements.retryRequestTimeoutMs}`,
    `statements.stage_budget_ms=${stageTimeouts.statements.stageBudgetMs}`,
  );
  const taxNotesAssetsStageDocument = buildStageDocumentV1({
    document: input.document,
    executionProfile,
    focusRanges: taxNotesAssetsFocusRanges,
    preferTextForExtractablePdf: true,
  });
  warnings.push(`tax_notes_assets.input=${taxNotesAssetsStageDocument.inputType}`);
  warnings.push(
    `tax_notes_assets.primary_request_timeout_ms=${stageTimeouts.taxNotesAssets.primaryRequestTimeoutMs}`,
    `tax_notes_assets.retry_request_timeout_ms=${stageTimeouts.taxNotesAssets.retryRequestTimeoutMs}`,
    `tax_notes_assets.stage_budget_ms=${stageTimeouts.taxNotesAssets.stageBudgetMs}`,
  );
  const taxNotesFinanceStageDocument = buildStageDocumentV1({
    document: input.document,
    executionProfile,
    focusRanges: taxNotesFinanceFocusRanges,
    preferTextForExtractablePdf: true,
  });
  const combinedExtractableStageDocument = buildStageDocumentV1({
    document: input.document,
    executionProfile,
    focusRanges: combinedExtractableFocusRanges,
    preferTextForExtractablePdf: true,
  });
  const prefersRequiredStagesFirst = shouldPreferRequiredStagesFirstV1({
    executionProfile,
    runtimeMode,
  });
  const combinedStageDiagnostics =
    executionProfile === "extractable_text_pdf"
      ? shouldSkipCombinedExtractableStageV1({
          document: combinedExtractableStageDocument.document,
          focusRanges: combinedExtractableFocusRanges,
          gates: combinedStageGates,
          chunking: stageChunking,
        })
      : { skip: false as const };
  const combinedStageGate =
    prefersRequiredStagesFirst && executionProfile === "extractable_text_pdf"
      ? {
          ...combinedStageDiagnostics,
          skip: true,
          reason:
            combinedStageDiagnostics.reason ?? "required_stages_first_v1",
        }
      : combinedStageDiagnostics;
  warnings.push(`tax_notes_finance.input=${taxNotesFinanceStageDocument.inputType}`);
  warnings.push(
    `tax_notes_finance.primary_request_timeout_ms=${stageTimeouts.taxNotesFinance.primaryRequestTimeoutMs}`,
    `tax_notes_finance.retry_request_timeout_ms=${stageTimeouts.taxNotesFinance.retryRequestTimeoutMs}`,
    `tax_notes_finance.stage_budget_ms=${stageTimeouts.taxNotesFinance.stageBudgetMs}`,
  );
  warnings.push(`combined_extractable.input=${combinedExtractableStageDocument.inputType}`);
  warnings.push(
    `combined_extractable.primary_request_timeout_ms=${stageTimeouts.combined.primaryRequestTimeoutMs}`,
    `combined_extractable.retry_request_timeout_ms=${stageTimeouts.combined.retryRequestTimeoutMs}`,
    `combined_extractable.stage_budget_ms=${stageTimeouts.combined.stageBudgetMs}`,
    `combined_extractable.minimum_retry_budget_ms=${stageTimeouts.combined.minimumRetryBudgetMs}`,
    ...(combinedStageGate.textChunks !== undefined
      ? [`combined_extractable.estimated_text_chunks=${combinedStageGate.textChunks}`]
      : []),
    ...(combinedStageGate.textChars !== undefined
      ? [`combined_extractable.estimated_text_chars=${combinedStageGate.textChars}`]
      : []),
    `statements.minimum_retry_budget_ms=${stageTimeouts.statements.minimumRetryBudgetMs ?? 0}`,
    `tax_notes_assets.minimum_retry_budget_ms=${stageTimeouts.taxNotesAssets.minimumRetryBudgetMs ?? 0}`,
    `tax_notes_finance.minimum_retry_budget_ms=${stageTimeouts.taxNotesFinance.minimumRetryBudgetMs ?? 0}`,
  );
  if (executionProfile === "extractable_text_pdf") {
    warnings.push(
      "schema_mode.combined_extractable=json_text_validation",
      "schema_mode.statements=json_text_validation",
      "schema_mode.tax_notes_assets=json_text_validation",
      "schema_mode.tax_notes_finance=json_text_validation",
    );
  }

  if (input.onProgress) {
    await input.onProgress("extracting_core_facts", [
      "progress.stage=extracting_core_facts",
      `progress.routing.core_facts_ranges=${formatPageRanges(sections.coreFacts)}`,
      `progress.routing.statement_ranges=${formatPageRanges([
        ...sections.incomeStatement,
        ...sections.balanceSheet,
      ])}`,
      ...coreFactsSeed.diagnostics,
    ]);
  }
  const coreFactsResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiCoreFactsResultV1>({
    apiKey: input.apiKey,
    currentStatus: "extracting_core_facts",
    chunkLabel: "core_facts",
    document: coreFactsDocument,
    modelConfig: input.modelConfig,
    onProgress: input.onProgress,
    responseSchema: AnnualReportAiCoreFactsResultV1Schema,
    stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.coreFacts,
    deterministicHints: buildCoreFactsSeedHintsV1(coreFactsSeed.fields),
    focusRanges: coreFactsFocusRanges,
    primaryRequestTimeoutMs: stageTimeouts.coreFacts.primaryRequestTimeoutMs,
    retryRequestTimeoutMs: stageTimeouts.coreFacts.retryRequestTimeoutMs,
    stageBudgetMs: stageTimeouts.coreFacts.stageBudgetMs,
    totalDeadlineMs: extractionDeadlineMs,
    warnings,
    allowTextChunking: false,
    primaryModelTier: resolveAnnualReportModelTierV1({
      preferred: "fast",
      runtimeMode,
    }),
    fallbackModelTier: resolveAnnualReportModelTierV1({
      preferred: "thinking",
      runtimeMode,
    }),
    primaryChunkPages: stageChunking.coreFactsPrimary,
    fallbackChunkPages: stageChunking.coreFactsFallback,
    skipWhenMissingRanges: input.document.fileType === "pdf",
  });

  if (!coreFactsResult.ok) {
    const stageError = formatAnnualReportStageErrorV1({
      stage: ANNUAL_REPORT_STAGE_LABELS_V1.coreFacts,
      error: coreFactsResult.error,
    });
    if (coreFactsResult.error.context.reason === "stage_budget_exceeded") {
      warnings.push(
        `degraded.core_facts.timeout budget_ms=${stageTimeouts.coreFacts.stageBudgetMs} range=${formatPageRanges(sections.coreFacts)}`,
      );
    }
    return {
      ok: false,
      error: stageError,
    };
  }

  const rawCoreFacts = coreFactsResult.outputs[0];
  const coreFacts = rawCoreFacts
    ? applyCoreFactsSeedFallbackV1({
        coreFacts: rawCoreFacts,
        seed: coreFactsSeed,
        warnings,
      })
    : rawCoreFacts;
  if (!coreFacts) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: "Core facts stage returned no output.",
        context: {},
      },
    };
  }

  warnings.push(...coreFacts.documentWarnings);
  const taxDeep = createEmptyTaxDeepV1();
  if (executionProfile === "extractable_text_pdf") {
    if (input.onProgress) {
      await input.onProgress("extracting_statements", [
        prefersRequiredStagesFirst
          ? "progress.stage=extracting_required_financial_data"
          : "progress.stage=extracting_combined_text_extraction",
        `progress.routing.statement_ranges=${formatPageRanges(statementsFocusRanges)}`,
        `progress.routing.tax_note_ranges=${formatPageRanges([
          ...taxNotesAssetsFocusRanges,
          ...taxNotesFinanceFocusRanges,
        ])}`,
      ]);
    }

    let shouldRunStatementsFollowUp = statementsFocusRanges.length > 0;
    let shouldRunAssetsFollowUp = taxNotesAssetsFocusRanges.length > 0;
    let shouldRunFinanceFollowUp = taxNotesFinanceFocusRanges.length > 0;
    if (combinedStageGate.skip) {
      warnings.push(
        `combined_extractable.skipped reason=${combinedStageGate.reason ?? "unknown"} text_chunks=${combinedStageGate.textChunks ?? 0} text_chars=${combinedStageGate.textChars ?? 0}`,
      );
      warnings.push(
        `combined_extractable.follow_up_required=1 statements=${shouldRunStatementsFollowUp ? 1 : 0} assets=${shouldRunAssetsFollowUp ? 1 : 0} finance=${shouldRunFinanceFollowUp ? 1 : 0}`,
      );
    } else {
      const combinedResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiCombinedTextExtractionResultV1>({
        apiKey: input.apiKey,
        currentStatus: "extracting_statements",
        chunkLabel: "combined_extractable",
        document: combinedExtractableStageDocument.document,
        modelConfig: input.modelConfig,
        onProgress: input.onProgress,
        responseSchema: AnnualReportAiCombinedTextExtractionResultV1Schema,
        stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.combinedTextExtraction,
        focusRanges: combinedExtractableFocusRanges,
        primaryModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        fallbackModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        primaryRequestTimeoutMs: stageTimeouts.combined.primaryRequestTimeoutMs,
        retryRequestTimeoutMs: stageTimeouts.combined.retryRequestTimeoutMs,
        stageBudgetMs: stageTimeouts.combined.stageBudgetMs,
        totalDeadlineMs: extractionDeadlineMs,
        minimumRetryBudgetMs: stageTimeouts.combined.minimumRetryBudgetMs,
        primaryMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 18_000 : 10_000,
        fallbackMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 12_000 : 6_000,
        useResponseJsonSchema: shouldUseProviderJsonSchemaV1({
          chunkLabel: "combined_extractable",
          executionProfile,
        }),
        warnings,
        primaryChunkPages: stageChunking.combinedTextPrimary,
        fallbackChunkPages: stageChunking.combinedTextFallback,
        skipWhenMissingRanges: true,
      });

      if (combinedResult.ok) {
        const merged = mergeCombinedOutputsV1(combinedResult.outputs);
        warnings.push(...merged.documentWarnings);
        taxDeep.ink2rExtracted = merged.ink2rExtracted;
        taxDeep.priorYearComparatives = merged.priorYearComparatives;
        taxDeep.depreciationContext = merged.depreciationContext;
        taxDeep.assetMovements = merged.assetMovements;
        taxDeep.reserveContext = merged.reserveContext;
        taxDeep.netInterestContext = merged.netInterestContext;
        taxDeep.pensionContext = merged.pensionContext;
        taxDeep.leasingContext = merged.leasingContext;
        taxDeep.groupContributionContext = merged.groupContributionContext;
        taxDeep.shareholdingContext = merged.shareholdingContext;
        if (merged.taxExpenseContext) {
          taxDeep.taxExpenseContext = merged.taxExpenseContext;
        }

        shouldRunStatementsFollowUp = !hasStatementsContentV1(merged);
        shouldRunAssetsFollowUp = !hasAssetsContentV1(merged);
        shouldRunFinanceFollowUp = !hasFinanceContentV1(merged);
        if (
          shouldRunStatementsFollowUp ||
          shouldRunAssetsFollowUp ||
          shouldRunFinanceFollowUp
        ) {
          warnings.push(
            `combined_extractable.follow_up_required=1 statements=${shouldRunStatementsFollowUp ? 1 : 0} assets=${shouldRunAssetsFollowUp ? 1 : 0} finance=${shouldRunFinanceFollowUp ? 1 : 0}`,
          );
        }
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.combinedTextExtraction,
          error: combinedResult.error,
        });
        warnings.push(`degraded.combined_extractable.unavailable:${stageError.message}`);
        warnings.push("combined_extractable.follow_up_required=1 statements=1 assets=1 finance=1");
      }
    }

    if (shouldRunStatementsFollowUp) {
      const statementsResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiStatementsOnlyResultV1>({
        apiKey: input.apiKey,
        currentStatus: "extracting_statements",
        chunkLabel: "statements",
        document: statementsStageDocument.document,
        modelConfig: input.modelConfig,
        onProgress: input.onProgress,
        responseSchema: AnnualReportAiStatementsOnlyResultV1Schema,
        stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.statements,
        focusRanges: statementsFocusRanges,
        primaryModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        fallbackModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        useResponseJsonSchema: shouldUseProviderJsonSchemaV1({
          chunkLabel: "statements",
          executionProfile,
        }),
        primaryRequestTimeoutMs: stageTimeouts.statements.primaryRequestTimeoutMs,
        retryRequestTimeoutMs: stageTimeouts.statements.retryRequestTimeoutMs,
        stageBudgetMs: stageTimeouts.statements.stageBudgetMs,
        totalDeadlineMs: extractionDeadlineMs,
        minimumRetryBudgetMs: stageTimeouts.statements.minimumRetryBudgetMs,
        primaryMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 12_000 : 6_000,
        fallbackMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 8_000 : 4_000,
        warnings,
        primaryChunkPages: stageChunking.statementsPrimary,
        fallbackChunkPages: stageChunking.statementsFallback,
        skipWhenMissingRanges: true,
      });

      if (statementsResult.ok) {
        const merged = mergeStatementsOutputsV1(statementsResult.outputs);
        taxDeep.ink2rExtracted = merged.ink2rExtracted;
        taxDeep.priorYearComparatives = merged.priorYearComparatives;
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.statements,
          error: statementsResult.error,
        });
        warnings.push(`degraded.statements.unavailable:${stageError.message}`);
      }
    }

    if (input.onProgress) {
      await input.onProgress("extracting_tax_notes", [
        "progress.stage=extracting_tax_notes",
      ]);
    }

    if (shouldRunAssetsFollowUp) {
      const assetsResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiTaxNotesAssetsAndReservesResultV1>({
        apiKey: input.apiKey,
        currentStatus: "extracting_tax_notes",
        chunkLabel: "tax_notes_assets",
        document: taxNotesAssetsStageDocument.document,
        modelConfig: input.modelConfig,
        onProgress: input.onProgress,
        responseSchema: AnnualReportAiTaxNotesAssetsAndReservesResultV1Schema,
        stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxNotesAssets,
        focusRanges: taxNotesAssetsFocusRanges,
        primaryModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        fallbackModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        useResponseJsonSchema: shouldUseProviderJsonSchemaV1({
          chunkLabel: "tax_notes_assets",
          executionProfile,
        }),
        primaryRequestTimeoutMs: stageTimeouts.taxNotesAssets.primaryRequestTimeoutMs,
        retryRequestTimeoutMs: stageTimeouts.taxNotesAssets.retryRequestTimeoutMs,
        stageBudgetMs: stageTimeouts.taxNotesAssets.stageBudgetMs,
        totalDeadlineMs: extractionDeadlineMs,
        minimumRetryBudgetMs: stageTimeouts.taxNotesAssets.minimumRetryBudgetMs,
        primaryMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 12_000 : 6_000,
        fallbackMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 8_000 : 4_000,
        warnings,
        primaryChunkPages: stageChunking.taxNotesPrimary,
        fallbackChunkPages: stageChunking.taxNotesFallback,
        skipWhenMissingRanges: true,
      });

      if (assetsResult.ok) {
        const merged = mergeAssetsOutputsV1(assetsResult.outputs);
        taxDeep.depreciationContext = merged.depreciationContext;
        taxDeep.assetMovements = merged.assetMovements;
        taxDeep.reserveContext = merged.reserveContext;
        if (merged.taxExpenseContext) {
          taxDeep.taxExpenseContext = merged.taxExpenseContext;
        }
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesAssets,
          error: assetsResult.error,
        });
        warnings.push(`degraded.tax_notes_assets.unavailable:${stageError.message}`);
      }
    }

    if (shouldRunFinanceFollowUp) {
      const financeResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiTaxNotesFinanceAndOtherResultV1>({
        apiKey: input.apiKey,
        currentStatus: "extracting_tax_notes",
        chunkLabel: "tax_notes_finance",
        document: taxNotesFinanceStageDocument.document,
        modelConfig: input.modelConfig,
        onProgress: input.onProgress,
        responseSchema: AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema,
        stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxNotesFinance,
        focusRanges: taxNotesFinanceFocusRanges,
        primaryModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        fallbackModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        useResponseJsonSchema: shouldUseProviderJsonSchemaV1({
          chunkLabel: "tax_notes_finance",
          executionProfile,
        }),
        primaryRequestTimeoutMs: stageTimeouts.taxNotesFinance.primaryRequestTimeoutMs,
        retryRequestTimeoutMs: stageTimeouts.taxNotesFinance.retryRequestTimeoutMs,
        stageBudgetMs: stageTimeouts.taxNotesFinance.stageBudgetMs,
        totalDeadlineMs: extractionDeadlineMs,
        minimumRetryBudgetMs: stageTimeouts.taxNotesFinance.minimumRetryBudgetMs,
        primaryMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 12_000 : 6_000,
        fallbackMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 8_000 : 4_000,
        warnings,
        primaryChunkPages: stageChunking.taxNotesPrimary,
        fallbackChunkPages: stageChunking.taxNotesFallback,
        skipWhenMissingRanges: true,
      });

      if (financeResult.ok) {
        const merged = mergeFinanceOutputsV1(financeResult.outputs);
        taxDeep.netInterestContext = merged.netInterestContext;
        taxDeep.pensionContext = merged.pensionContext;
        taxDeep.leasingContext = merged.leasingContext;
        taxDeep.groupContributionContext = merged.groupContributionContext;
        taxDeep.shareholdingContext = merged.shareholdingContext;
        if (merged.taxExpenseContext && (!taxDeep.taxExpenseContext || taxDeep.taxExpenseContext.notes.length === 0)) {
          taxDeep.taxExpenseContext = merged.taxExpenseContext;
        }
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesFinance,
          error: financeResult.error,
        });
        warnings.push(`degraded.tax_notes_finance.unavailable:${stageError.message}`);
      }
    }
  } else {
    if (input.onProgress) {
      await input.onProgress("extracting_statements", [
        "progress.stage=extracting_statements",
        `progress.routing.statement_ranges=${formatPageRanges(statementsFocusRanges)}`,
      ]);
    }

    const statementsResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiStatementsOnlyResultV1>({
      apiKey: input.apiKey,
      currentStatus: "extracting_statements",
      chunkLabel: "statements",
      document: statementsStageDocument.document,
      modelConfig: input.modelConfig,
      onProgress: input.onProgress,
      responseSchema: AnnualReportAiStatementsOnlyResultV1Schema,
      stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.statements,
      focusRanges: statementsFocusRanges,
      primaryModelTier: "fast",
      fallbackModelTier: resolveAnnualReportModelTierV1({
        preferred: "thinking",
        runtimeMode,
      }),
      primaryRequestTimeoutMs: stageTimeouts.statements.primaryRequestTimeoutMs,
      retryRequestTimeoutMs: stageTimeouts.statements.retryRequestTimeoutMs,
      stageBudgetMs: stageTimeouts.statements.stageBudgetMs,
      totalDeadlineMs: extractionDeadlineMs,
      minimumRetryBudgetMs: stageTimeouts.statements.minimumRetryBudgetMs,
      warnings,
      primaryChunkPages: stageChunking.statementsPrimary,
      fallbackChunkPages: stageChunking.statementsFallback,
      skipWhenMissingRanges: true,
    });

    if (statementsResult.ok) {
      const merged = mergeStatementsOutputsV1(statementsResult.outputs);
      taxDeep.ink2rExtracted = merged.ink2rExtracted;
      taxDeep.priorYearComparatives = merged.priorYearComparatives;
    } else {
      const stageError = formatAnnualReportStageErrorV1({
        stage: ANNUAL_REPORT_STAGE_LABELS_V1.statements,
        error: statementsResult.error,
      });
      warnings.push(`degraded.statements.unavailable:${stageError.message}`);
    }

    if (input.onProgress) {
      await input.onProgress("extracting_tax_notes", [
        "progress.stage=extracting_tax_notes",
      ]);
    }

    const assetsResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiTaxNotesAssetsAndReservesResultV1>({
      apiKey: input.apiKey,
      currentStatus: "extracting_tax_notes",
      chunkLabel: "tax_notes_assets",
      document: taxNotesAssetsStageDocument.document,
      modelConfig: input.modelConfig,
      onProgress: input.onProgress,
      responseSchema: AnnualReportAiTaxNotesAssetsAndReservesResultV1Schema,
      stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxNotesAssets,
      focusRanges: taxNotesAssetsFocusRanges,
      primaryModelTier: "fast",
      fallbackModelTier: resolveAnnualReportModelTierV1({
        preferred: "thinking",
        runtimeMode,
      }),
      primaryRequestTimeoutMs: stageTimeouts.taxNotesAssets.primaryRequestTimeoutMs,
      retryRequestTimeoutMs: stageTimeouts.taxNotesAssets.retryRequestTimeoutMs,
      stageBudgetMs: stageTimeouts.taxNotesAssets.stageBudgetMs,
      totalDeadlineMs: extractionDeadlineMs,
      minimumRetryBudgetMs: stageTimeouts.taxNotesAssets.minimumRetryBudgetMs,
      warnings,
      primaryChunkPages: stageChunking.taxNotesPrimary,
      fallbackChunkPages: stageChunking.taxNotesFallback,
      skipWhenMissingRanges: true,
    });

    if (assetsResult.ok) {
      const merged = mergeAssetsOutputsV1(assetsResult.outputs);
      taxDeep.depreciationContext = merged.depreciationContext;
      taxDeep.assetMovements = merged.assetMovements;
      taxDeep.reserveContext = merged.reserveContext;
      if (merged.taxExpenseContext) {
        taxDeep.taxExpenseContext = merged.taxExpenseContext;
      }
    } else {
      const stageError = formatAnnualReportStageErrorV1({
        stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesAssets,
        error: assetsResult.error,
      });
      warnings.push(`degraded.tax_notes_assets.unavailable:${stageError.message}`);
    }

    const financeResult = await executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiTaxNotesFinanceAndOtherResultV1>({
      apiKey: input.apiKey,
      currentStatus: "extracting_tax_notes",
      chunkLabel: "tax_notes_finance",
      document: taxNotesFinanceStageDocument.document,
      modelConfig: input.modelConfig,
      onProgress: input.onProgress,
      responseSchema: AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema,
      stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxNotesFinance,
      focusRanges: taxNotesFinanceFocusRanges,
      primaryModelTier: "fast",
      fallbackModelTier: resolveAnnualReportModelTierV1({
        preferred: "thinking",
        runtimeMode,
      }),
      primaryRequestTimeoutMs: stageTimeouts.taxNotesFinance.primaryRequestTimeoutMs,
      retryRequestTimeoutMs: stageTimeouts.taxNotesFinance.retryRequestTimeoutMs,
      stageBudgetMs: stageTimeouts.taxNotesFinance.stageBudgetMs,
      totalDeadlineMs: extractionDeadlineMs,
      minimumRetryBudgetMs: stageTimeouts.taxNotesFinance.minimumRetryBudgetMs,
      warnings,
      primaryChunkPages: stageChunking.taxNotesPrimary,
      fallbackChunkPages: stageChunking.taxNotesFallback,
      skipWhenMissingRanges: true,
    });

    if (financeResult.ok) {
      const merged = mergeFinanceOutputsV1(financeResult.outputs);
      taxDeep.netInterestContext = merged.netInterestContext;
      taxDeep.pensionContext = merged.pensionContext;
      taxDeep.leasingContext = merged.leasingContext;
      taxDeep.groupContributionContext = merged.groupContributionContext;
      taxDeep.shareholdingContext = merged.shareholdingContext;

      if (merged.taxExpenseContext && (!taxDeep.taxExpenseContext || taxDeep.taxExpenseContext.notes.length === 0)) {
        taxDeep.taxExpenseContext = merged.taxExpenseContext;
      }
    } else {
      const stageError = formatAnnualReportStageErrorV1({
        stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesFinance,
        error: financeResult.error,
      });
      warnings.push(`degraded.tax_notes_finance.unavailable:${stageError.message}`);
    }
  }

  const finalCoreFacts = applyProfitBeforeTaxStatementFallbackV1({
    coreFacts,
    taxDeep,
    warnings,
  });
  const finalOutput = AnnualReportAiExtractionResultV1Schema.parse({
    schemaVersion: "annual_report_ai_extraction_v1",
    fields: finalCoreFacts.fields,
    taxSignals: finalCoreFacts.taxSignals,
    documentWarnings: [...new Set(warnings)],
    taxDeep,
    evidence: [],
  });

  return {
    ok: true,
    extraction: finalOutput,
    aiRun: parseAiRunMetadataV1({
      runId: input.generateId(),
      moduleId: input.config.moduleSpec.moduleId,
      moduleVersion: input.config.moduleSpec.moduleVersion,
      promptVersion: input.config.moduleSpec.promptVersion,
      policyVersion: input.config.policyPack.policyVersion,
      activePatchVersions: input.config.moduleSpec.policy.activePatchVersions,
      provider: "gemini",
      model: selectedModelName,
      modelTier: input.config.moduleSpec.runtime.modelTier,
      generatedAt: input.generatedAt,
      usedFallback: warnings.some((warning) =>
        warning.includes("fallback") || warning.startsWith("degraded."),
      ),
    }),
  };
}
