import type {
  AnnualReportEvidenceReferenceV1,
  AnnualReportExtractionPayloadV1,
  AnnualReportRelevantNoteCategoryV1,
  AnnualReportRelevantNoteV1,
  AnnualReportTaxDeepExtractionV1,
  AnnualReportValueWithEvidenceV1,
} from "../../../../shared/contracts/annual-report-extraction.v1";
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
  type AnnualReportAiTaxExpenseNoteResultV1,
  AnnualReportAiTaxExpenseNoteResultV1Schema,
  type AnnualReportAiRelevantNoteLocatorResultV1,
  AnnualReportAiRelevantNoteLocatorResultV1Schema,
  AnnualReportAiExtractionResultV1Schema,
  type AnnualReportAiExtractionResultV1,
  type AnnualReportAiSectionLocatorRangeV1,
} from "../../../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportProcessingRunStatusV1 } from "../../../../shared/contracts/annual-report-processing-run.v1";
import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import {
  generateAiStructuredOutputV1,
  toBase64V1,
} from "../../providers/ai-provider-client.v1";
import type { AiModelConfigV1 } from "../../providers/ai-provider-client.v1";
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
  modelConfig: AiModelConfigV1;
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

Prefer keeping narrative note coverage, not just numeric tables:
- capture descriptive reserve and tax-note text in notes arrays whenever the document contains it,
- preserve noteReference/page evidence for those narrative snippets,
- include depreciation-policy evidence from fixed-asset notes when it is available.

Focus only on the identified asset, reserve, and tax expense note pages.`,
  taxNotesFinance: `Stage: tax notes (finance & other).

Return only:
- netInterestContext,
- pensionContext,
- leasingContext,
- groupContributionContext,
- shareholdingContext.

Prefer keeping narrative note coverage, not just numeric values:
- populate notes arrays with concise extracted note text when the note contains useful narrative disclosure,
- preserve noteReference/page evidence for those note snippets,
- keep flags for yes/no signals, but do not drop the underlying note wording if it is present.

Focus only on the identified finance, pension, leasing, group contribution, and shareholding note pages.`,
  relevantNotes: `Stage: relevant tax-note locator.

Review the isolated annual-report note blocks and return ONLY notes relevant for a Swedish corporate income-tax return.

Relevant categories:
- fixed_assets_depreciation
- interest
- pension
- tax_expense
- reserve
- leasing
- group_contributions
- shareholdings_dividends
- provisions_contingencies
- related_party_intragroup
- restructuring_mergers
- deferred_tax_loss_carryforwards
- impairments_write_downs

For each relevant note:
- return the provided blockId,
- classify it into one category,
- keep noteReference/title/pages when present,
- extract 1-3 concise note summaries grounded in the note text,
- keep supporting evidence snippets with noteReference/page when available.

Ignore unrelated revenue, customer, personnel, or generic accounting notes.`,
  taxExpenseNote: `Stage: tax expense note extraction.

Review only the isolated tax-expense note block(s).

Return only:
- taxExpenseContext
- evidence

Prioritize:
- current tax
- deferred tax
- total tax expense
- concise note summaries grounded in the note
- reconciliation items such as non-deductible costs, non-taxable income, prior-year adjustments, temporary differences, and loss carryforwards when disclosed.`,
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
  "annual-report-analysis-exec.v1.5";

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
  // Overdrive is useful for small single-shot extracts, but multi-chunk combined
  // extraction has been materially slower and less stable than the narrower stages.
  maxTextChunksBeforeSkip: 1,
  maxTextCharsBeforeSkip: 18_000,
} as const;

const ANNUAL_REPORT_EXECUTION_PROFILES_OVERDRIVE_MS_V1 = {
  extractable_text_pdf: {
    locator: {
      primaryRequestTimeoutMs: 20_000,
      retryRequestTimeoutMs: 20_000,
      stageBudgetMs: 20_000,
    },
    coreFacts: {
      // Keep overdrive on the thinking model, but use materially tighter
      // budgets for machine-readable PDFs so the UI is not gated on minute-long
      // retries unless a later explicit deep run is needed.
      primaryRequestTimeoutMs: 45_000,
      retryRequestTimeoutMs: 60_000,
      stageBudgetMs: 90_000,
    },
    combined: {
      primaryRequestTimeoutMs: 60_000,
      retryRequestTimeoutMs: 90_000,
      stageBudgetMs: 180_000,
      minimumRetryBudgetMs: 20_000,
    },
    statements: {
      primaryRequestTimeoutMs: 45_000,
      retryRequestTimeoutMs: 60_000,
      stageBudgetMs: 120_000,
      minimumRetryBudgetMs: 15_000,
    },
    taxNotesAssets: {
      primaryRequestTimeoutMs: 35_000,
      retryRequestTimeoutMs: 50_000,
      stageBudgetMs: 90_000,
      minimumRetryBudgetMs: 15_000,
    },
    taxNotesFinance: {
      primaryRequestTimeoutMs: 35_000,
      retryRequestTimeoutMs: 50_000,
      stageBudgetMs: 90_000,
      minimumRetryBudgetMs: 15_000,
    },
    total: 420_000,
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
  relevantNotes: "relevant tax notes",
  taxExpenseNote: "tax expense note",
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
    relevantNotes: [],
    priorYearComparatives: [],
  };
}

async function executeAnnualReportStageV1<TOutput>(input: {
  apiKey?: string;
  modelConfig: AiModelConfigV1;
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
  return generateAiStructuredOutputV1<TOutput>({
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

type AnnualReportRelevantNoteBlockV1 = {
  blockId: string;
  noteReference?: string;
  pages: number[];
  text: string;
  title?: string;
};

type AnnualReportRelevantNoteCategoryRuleV1 = {
  bodyMatchers: RegExp[];
  category: AnnualReportRelevantNoteCategoryV1;
  titleMatchers: RegExp[];
};

const RELEVANT_NOTE_CANDIDATE_MATCHERS_V1 = [
  /\bskatt\b/i,
  /\bdeferred tax\b/i,
  /\bcurrent tax\b/i,
  /\breserve\b/i,
  /\breserv\b/i,
  /\bobeskatt/i,
  /\bprogramvar/i,
  /\bimmateri/i,
  /\bbyggnad/i,
  /\bmark\b/i,
  /\binventar/i,
  /\bdator/i,
  /\bforbattr/i,
  /\bavskriv/i,
  /\bdepreci/i,
  /\branta/i,
  /\binterest\b/i,
  /\bfinansi/i,
  /\bpension/i,
  /\bleasing/i,
  /\bkoncernbidrag/i,
  /\bgroup contribution\b/i,
  /\bandelar\b/i,
  /\bshareholding\b/i,
  /\butdel/i,
  /\bavsatt/i,
  /\bprovision/i,
  /\bansvarsf[öo]rbind/i,
  /\bn[äa]rst[åa]ende/i,
  /\bkoncernmellanhav/i,
  /\bfusion/i,
  /\bomstruktur/i,
  /\bf[öo]rv[äa]rv/i,
  /\buppskjuten/i,
  /\bunderskottsavdrag/i,
  /\bnedskriv/i,
  /\bimpair/i,
] as const;

const RELEVANT_NOTE_CATEGORY_RULES_V1 = [
  {
    category: "tax_expense",
    titleMatchers: [/\bskatt\b/i, /\bincome tax\b/i],
    bodyMatchers: [
      /\baktuell skatt\b/i,
      /\bcurrent tax\b/i,
      /\buppskjuten skatt\b/i,
      /\bdeferred tax\b/i,
      /\bej avdragsgilla\b/i,
      /\bej skattepliktiga\b/i,
      /\bskatt beraknad\b/i,
      /\bunderskottsavdrag/i,
    ],
  },
  {
    category: "fixed_assets_depreciation",
    titleMatchers: [
      /\bprogramvar/i,
      /\bimmateri/i,
      /\bbyggnad/i,
      /\bmark\b/i,
      /\binventar/i,
      /\bdator/i,
      /\bforbattr/i,
      /\banlaggningstillgang/i,
      /\bmaskiner\b/i,
    ],
    bodyMatchers: [
      /\bavskriv/i,
      /\bdepreci/i,
      /\bnyttjandeperiod/i,
      /\bskrivs av\b/i,
      /\brestvarde\b/i,
      /\banskaffningsvarden\b/i,
      /\backumulerade avskrivningar\b/i,
    ],
  },
  {
    category: "interest",
    titleMatchers: [/\branta/i, /\binterest\b/i, /\bfinansi/i],
    bodyMatchers: [
      /\branteint/i,
      /\brantekost/i,
      /\binterest income\b/i,
      /\binterest expense\b/i,
      /\bfinansiella\b/i,
    ],
  },
  {
    category: "pension",
    titleMatchers: [/\bpension/i],
    bodyMatchers: [/\bpension/i, /\bsarskild loneskatt\b/i, /\bspecial payroll tax\b/i],
  },
  {
    category: "reserve",
    titleMatchers: [/\breserv\b/i, /\bobeskatt/i, /\bprovision/i],
    bodyMatchers: [
      /\breserv\b/i,
      /\bobeskatt/i,
      /\bavsatt/i,
      /\bprovision/i,
      /\bansvarsf[öo]rbind/i,
    ],
  },
  {
    category: "leasing",
    titleMatchers: [/\bleasing/i, /\bhyres/i],
    bodyMatchers: [/\bleasing/i, /\blease\b/i, /\bhyra\b/i],
  },
  {
    category: "group_contributions",
    titleMatchers: [/\bkoncernbidrag/i, /\bgroup contribution\b/i],
    bodyMatchers: [/\bkoncernbidrag/i, /\bgroup contribution\b/i],
  },
  {
    category: "shareholdings_dividends",
    titleMatchers: [/\bandelar\b/i, /\baktier\b/i, /\butdel/i, /\bshareholding\b/i],
    bodyMatchers: [
      /\bandelar\b/i,
      /\baktier\b/i,
      /\butdel/i,
      /\bkoncernforetag\b/i,
      /\bintresseforetag\b/i,
      /\bdividend\b/i,
    ],
  },
  {
    category: "provisions_contingencies",
    titleMatchers: [/\bprovision/i, /\bansvarsf[öo]rbind/i],
    bodyMatchers: [/\bprovision/i, /\bansvarsf[öo]rbind/i, /\bgaranti\b/i, /\btvist\b/i],
  },
  {
    category: "related_party_intragroup",
    titleMatchers: [/\bn[äa]rst[åa]ende/i, /\bkoncernmellanhav/i],
    bodyMatchers: [
      /\bn[äa]rst[åa]ende/i,
      /\bkoncernmellanhav/i,
      /\btransaktioner med n[äa]rst[åa]ende/i,
      /\bfordringar hos koncernforetag\b/i,
      /\bskulder till koncernforetag\b/i,
    ],
  },
  {
    category: "restructuring_mergers",
    titleMatchers: [/\bfusion/i, /\bomstruktur/i, /\bf[öo]rv[äa]rv/i],
    bodyMatchers: [/\bfusion/i, /\bomstruktur/i, /\bf[öo]rv[äa]rv/i, /\bavyttring\b/i],
  },
  {
    category: "deferred_tax_loss_carryforwards",
    titleMatchers: [/\bunderskottsavdrag/i, /\buppskjuten skatt\b/i],
    bodyMatchers: [
      /\bunderskottsavdrag/i,
      /\buppskjuten skatt\b/i,
      /\bdeferred tax\b/i,
      /\btempor[äa]ra skillnader\b/i,
      /\btemporary differences\b/i,
    ],
  },
  {
    category: "impairments_write_downs",
    titleMatchers: [/\bnedskriv/i, /\bimpair/i],
    bodyMatchers: [/\bnedskriv/i, /\bimpair/i, /\bwrite-?down\b/i],
  },
] satisfies AnnualReportRelevantNoteCategoryRuleV1[];

const RELEVANT_NOTE_SUMMARY_MATCHERS_BY_CATEGORY_V1: Record<
  AnnualReportRelevantNoteCategoryV1,
  RegExp[]
> = {
  fixed_assets_depreciation: [
    /\bskrivs av\b/i,
    /\bnyttjandeperiod/i,
    /\bavskriv/i,
    /\brestvarde\b/i,
    /\bnedskriv/i,
  ],
  interest: [/\brante/i, /\binterest\b/i, /\bfinansi/i],
  pension: [/\bpension/i, /\bsarskild loneskatt\b/i, /\bspecial payroll tax\b/i],
  tax_expense: [
    /\baktuell skatt\b/i,
    /\bcurrent tax\b/i,
    /\buppskjuten skatt\b/i,
    /\bdeferred tax\b/i,
    /\bskatt beraknad\b/i,
    /\bsumma redovisad skatt\b/i,
    /\barets redovisade skattekostnad\b/i,
    /\bårets redovisade skattekostnad\b/i,
    /\bej avdragsgilla\b/i,
    /\bej skattepliktiga\b/i,
    /\bjustering avseende tidigare ar\b/i,
    /\bunderskottsavdrag/i,
  ],
  reserve: [/\breserv\b/i, /\bobeskatt/i, /\bprovision/i],
  leasing: [/\bleasing/i, /\bhyra\b/i, /\blease\b/i],
  group_contributions: [/\bkoncernbidrag/i, /\bgroup contribution\b/i],
  shareholdings_dividends: [/\butdel/i, /\bandelar\b/i, /\bkoncernforetag\b/i],
  provisions_contingencies: [/\bprovision/i, /\bansvarsf[öo]rbind/i, /\bgaranti\b/i],
  related_party_intragroup: [
    /\bn[äa]rst[åa]ende/i,
    /\bkoncernmellanhav/i,
    /\bfordringar hos koncernforetag\b/i,
    /\bskulder till koncernforetag\b/i,
  ],
  restructuring_mergers: [/\bfusion/i, /\bomstruktur/i, /\bf[öo]rv[äa]rv/i],
  deferred_tax_loss_carryforwards: [
    /\bunderskottsavdrag/i,
    /\buppskjuten skatt\b/i,
    /\btempor[äa]ra skillnader\b/i,
  ],
  impairments_write_downs: [/\bnedskriv/i, /\bimpair/i, /\bwrite-?down\b/i],
};

type AnnualReportRelevantNoteCategoryScoreV1 = {
  category: AnnualReportRelevantNoteCategoryV1;
  score: number;
};

function listRelevantNoteBlockLinesV1(block: AnnualReportRelevantNoteBlockV1): string[] {
  return block.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildRelevantNoteBlockMatchTextV1(block: AnnualReportRelevantNoteBlockV1): {
  body: string;
  title: string;
} {
  return {
    body: normalizeAnnualReportStatementMatchTextV1([
      block.noteReference,
      block.title,
      block.text.slice(0, 3_500),
    ]
      .filter(Boolean)
      .join("\n")),
    title: normalizeAnnualReportStatementMatchTextV1([
      block.noteReference,
      block.title,
    ]
      .filter(Boolean)
      .join("\n")),
  };
}

function classifyRelevantNoteBlockV1(
  block: AnnualReportRelevantNoteBlockV1,
): AnnualReportRelevantNoteCategoryScoreV1[] {
  const normalized = buildRelevantNoteBlockMatchTextV1(block);
  const scoredCategories = RELEVANT_NOTE_CATEGORY_RULES_V1.map((rule) => {
    const titleScore = rule.titleMatchers.reduce(
      (score, matcher) => score + (matcher.test(normalized.title) ? 5 : 0),
      0,
    );
    const bodyScore = rule.bodyMatchers.reduce(
      (score, matcher) => score + (matcher.test(normalized.body) ? 2 : 0),
      0,
    );
    return {
      category: rule.category,
      score: titleScore + Math.min(bodyScore, 8),
    };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredCategories;
}

function isLikelyIndexOnlyRelevantNoteBlockV1(block: AnnualReportRelevantNoteBlockV1): boolean {
  const lines = listRelevantNoteBlockLinesV1(block);
  const contentLines = lines.filter(
    (line) => !detectAnnualReportNoteHeadingV1({ line }),
  );
  if (contentLines.length === 0) {
    return true;
  }

  const amountLineCount = contentLines.filter((line) =>
    /-?\d{1,3}(?:\s\d{3})/.test(line),
  ).length;
  const pageReferenceLineCount = contentLines.filter((line) =>
    /\b\d{1,2}(?:\s*-\s*\d{1,2})?\s*$/.test(line) &&
    !/-?\d{1,3}(?:\s\d{3})/.test(line),
  ).length;
  const sentenceLikeCount = contentLines.filter(
    (line) =>
      /[.!?]$/.test(line) ||
      RELEVANT_NOTE_CANDIDATE_MATCHERS_V1.some((matcher) => matcher.test(line)),
  ).length;

  return (
    amountLineCount === 0 &&
    sentenceLikeCount === 0 &&
    (contentLines.length <= 2 || pageReferenceLineCount === contentLines.length) &&
    block.text.length < 220
  );
}

function buildRelevantNoteEvidenceFromLinesV1(input: {
  block: AnnualReportRelevantNoteBlockV1;
  lines: string[];
}): AnnualReportEvidenceReferenceV1[] {
  return dedupeByKeyV1(
    input.lines
      .map((snippet) => snippet.trim())
      .filter((snippet) => snippet.length > 0)
      .slice(0, 4)
      .map((snippet) => ({
        snippet,
        noteReference: input.block.noteReference,
        page: input.block.pages[0],
      })),
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
}

function buildRelevantNoteFallbackNotesV1(input: {
  block: AnnualReportRelevantNoteBlockV1;
  category: AnnualReportRelevantNoteCategoryV1;
}): { evidence: AnnualReportEvidenceReferenceV1[]; notes: string[] } {
  const lines = listRelevantNoteBlockLinesV1(input.block).filter(
    (line) => !detectAnnualReportNoteHeadingV1({ line }),
  );
  const summaryMatchers =
    RELEVANT_NOTE_SUMMARY_MATCHERS_BY_CATEGORY_V1[input.category];
  const matchedLines = dedupeStringsV1(
    lines.filter((line) =>
      summaryMatchers.some((matcher) => matcher.test(line)),
    ),
  );
  const noteLines = sanitizeFinalNotesV1(
    (
      matchedLines.length > 0 ? matchedLines : lines.filter((line) => line.length >= 24)
    ).slice(0, input.category === "tax_expense" ? 4 : 3),
  );

  return {
    evidence:
      matchedLines.length > 0
        ? buildRelevantNoteEvidenceFromLinesV1({
            block: input.block,
            lines: matchedLines,
          })
        : buildRelevantNoteFallbackEvidenceFromBlockV1({
            block: input.block,
          }),
    notes: noteLines,
  };
}

function buildDeterministicRelevantNotesFromBlocksV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
}): AnnualReportRelevantNoteV1[] {
  return dedupeRelevantNotesV1(
    input.blocks.flatMap((block) => {
      if (isLikelyIndexOnlyRelevantNoteBlockV1(block)) {
        return [];
      }

      const bestCategory = classifyRelevantNoteBlockV1(block)[0];
      if (!bestCategory || bestCategory.score < 4) {
        return [];
      }

      const fallback = buildRelevantNoteFallbackNotesV1({
        block,
        category: bestCategory.category,
      });
      return [
        {
          category: bestCategory.category,
          title: block.title,
          noteReference: block.noteReference,
          pages: block.pages,
          notes: fallback.notes,
          evidence: fallback.evidence,
        },
      ];
    }),
  );
}

function extractCurrentAmountFromRelevantNoteLineV1(line: string): number | undefined {
  const normalized = line.replace(/\u00a0/g, " ").replace(/[−–—]/g, "-");
  const amountMatches = normalized.match(/-?\d{1,3}(?:\s\d{3})*/g) ?? [];
  const currentAmountText = amountMatches[0]?.replace(/\s+/g, "");
  if (currentAmountText) {
    const currentAmount = Number(currentAmountText);
    if (Number.isFinite(currentAmount)) {
      return currentAmount;
    }
  }

  if (!/-/.test(line) || /-?\d{1,3}(?:\s\d{3})/.test(line)) {
    return undefined;
  }

  return 0;
}

function buildValueWithEvidenceFromRelevantNoteLineV1(input: {
  block: AnnualReportRelevantNoteBlockV1;
  line: string | undefined;
}): AnnualReportValueWithEvidenceV1 | undefined {
  if (!input.line) {
    return undefined;
  }

  const value = extractCurrentAmountFromRelevantNoteLineV1(input.line);
  if (value === undefined) {
    return undefined;
  }

  return {
    value,
    evidence: buildRelevantNoteEvidenceFromLinesV1({
      block: input.block,
      lines: [input.line],
    }),
  };
}

function buildDeterministicTaxExpenseContextFromBlocksV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
}): AnnualReportTaxDeepExtractionV1["taxExpenseContext"] | undefined {
  const scoredBlocks = input.blocks
    .filter((block) => !isLikelyIndexOnlyRelevantNoteBlockV1(block))
    .map((block) => ({
      block,
      taxScore:
        classifyRelevantNoteBlockV1(block).find(
          (candidate) => candidate.category === "tax_expense",
        )?.score ?? 0,
    }))
    .filter((candidate) => candidate.taxScore >= 4)
    .sort((left, right) => right.taxScore - left.taxScore);
  const bestBlock = scoredBlocks[0]?.block;
  if (!bestBlock) {
    return undefined;
  }

  const lines = listRelevantNoteBlockLinesV1(bestBlock).filter(
    (line) => !detectAnnualReportNoteHeadingV1({ line }),
  );
  const currentTaxLine = lines.find((line) =>
    /\baktuell skatt\b/i.test(line) || /\bcurrent tax\b/i.test(line),
  );
  const deferredTaxLine = lines.find((line) =>
    /\buppskjuten skatt\b/i.test(line) || /\bdeferred tax\b/i.test(line),
  );
  const totalTaxExpenseLine = lines.find((line) =>
    /\bsumma redovisad skatt\b/i.test(line) ||
    /\bårets redovisade skattekostnad\b/i.test(line) ||
    /\byear'?s recognized tax expense\b/i.test(line),
  );
  const fallback = buildRelevantNoteFallbackNotesV1({
    block: bestBlock,
    category: "tax_expense",
  });

  const context: AnnualReportTaxDeepExtractionV1["taxExpenseContext"] = {
    currentTax: buildValueWithEvidenceFromRelevantNoteLineV1({
      block: bestBlock,
      line: currentTaxLine,
    }),
    deferredTax: buildValueWithEvidenceFromRelevantNoteLineV1({
      block: bestBlock,
      line: deferredTaxLine,
    }),
    totalTaxExpense: buildValueWithEvidenceFromRelevantNoteLineV1({
      block: bestBlock,
      line: totalTaxExpenseLine,
    }),
    notes: fallback.notes,
    evidence: mergeEvidenceArraysV1(
      fallback.evidence,
      buildRelevantNoteEvidenceFromLinesV1({
        block: bestBlock,
        lines: [
          currentTaxLine,
          deferredTaxLine,
          totalTaxExpenseLine,
        ].filter((line): line is string => typeof line === "string"),
      }),
    ),
  };

  if (
    !context.currentTax &&
    !context.deferredTax &&
    !context.totalTaxExpense &&
    context.notes.length === 0 &&
    context.evidence.length === 0
  ) {
    return undefined;
  }

  return context;
}

function buildTaxExpenseValueFromSnippetV1(input: {
  evidence: AnnualReportEvidenceReferenceV1[];
  line: string | undefined;
}): AnnualReportValueWithEvidenceV1 | undefined {
  if (!input.line) {
    return undefined;
  }

  const value = extractCurrentAmountFromRelevantNoteLineV1(input.line);
  if (value === undefined) {
    return undefined;
  }

  const matchingEvidence = input.evidence.filter(
    (entry) => entry.snippet.trim() === input.line?.trim(),
  );
  return {
    value,
    evidence: matchingEvidence,
  };
}

function fillMissingTaxExpenseValuesFromContextV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
}): void {
  if (!input.taxDeep.taxExpenseContext) {
    return;
  }

  const taxRelevantNotes = (input.taxDeep.relevantNotes ?? []).filter(
    (note) => note.category === "tax_expense",
  );
  const lines = dedupeStringsV1([
    ...input.taxDeep.taxExpenseContext.notes,
    ...input.taxDeep.taxExpenseContext.evidence.map((entry) => entry.snippet),
    ...taxRelevantNotes.flatMap((note) => note.notes),
    ...taxRelevantNotes.flatMap((note) => note.evidence.map((entry) => entry.snippet)),
  ]);
  const evidence = dedupeByKeyV1(
    [
      ...input.taxDeep.taxExpenseContext.evidence,
      ...taxRelevantNotes.flatMap((note) => note.evidence),
    ],
    (entry) =>
      [
        entry.page ?? "",
        entry.section ?? "",
        entry.noteReference ?? "",
        entry.snippet,
      ].join("|"),
  );
  const findLine = (matchers: RegExp[]) =>
    lines.find((line) => matchers.some((matcher) => matcher.test(line)));

  input.taxDeep.taxExpenseContext.currentTax =
    input.taxDeep.taxExpenseContext.currentTax ??
    buildTaxExpenseValueFromSnippetV1({
      evidence,
      line: findLine([/\baktuell skatt\b/i, /\bcurrent tax\b/i]),
    });
  input.taxDeep.taxExpenseContext.deferredTax =
    input.taxDeep.taxExpenseContext.deferredTax ??
    buildTaxExpenseValueFromSnippetV1({
      evidence,
      line: findLine([/\buppskjuten skatt\b/i, /\bdeferred tax\b/i]),
    });
  input.taxDeep.taxExpenseContext.totalTaxExpense =
    input.taxDeep.taxExpenseContext.totalTaxExpense ??
    buildTaxExpenseValueFromSnippetV1({
      evidence,
      line: findLine([
        /\bsumma redovisad skatt\b/i,
        /\barets redovisade skattekostnad\b/i,
        /\bårets redovisade skattekostnad\b/i,
        /\byear'?s recognized tax expense\b/i,
      ]),
    });
}

function detectAnnualReportNoteHeadingV1(input: {
  line: string;
}): { noteNumber: string; title?: string } | null {
  const trimmedLine = input.line.trim();
  if (trimmedLine.length === 0) {
    return null;
  }

  const match = trimmedLine.match(
    /^(?:not|note)\s+(\d+[a-z]?)(?:[\s.:–-]+(.+))?$/i,
  );
  if (!match) {
    return null;
  }

  return {
    noteNumber: match[1] ?? "",
    title: match[2]?.trim() || undefined,
  };
}

function buildRelevantNoteBlocksV1(input: {
  document: AnnualReportPreparedDocumentV1;
  focusRanges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportRelevantNoteBlockV1[] {
  if (
    input.document.fileType !== "pdf" ||
    !input.document.sourceText ||
    input.document.sourceText.fileType !== "pdf" ||
    input.document.sourceText.pageTexts.length === 0 ||
    input.focusRanges.length === 0
  ) {
    return [];
  }

  const pages = normalizeAnnualReportPageRangesV1({
    maxPage: input.document.sourceText.pageTexts.length,
    ranges: input.focusRanges,
  }).flatMap((range) => {
    const nextPages: number[] = [];
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      nextPages.push(page);
    }
    return nextPages;
  });
  const uniquePages = [...new Set(pages)].sort((left, right) => left - right);
  const blocks: AnnualReportRelevantNoteBlockV1[] = [];
  let currentBlock:
    | {
        noteReference?: string;
        pages: number[];
        lines: string[];
        title?: string;
      }
    | null = null;

  const flushCurrentBlock = () => {
    if (!currentBlock) {
      return;
    }

    const text = currentBlock.lines
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
    if (text.length === 0) {
      currentBlock = null;
      return;
    }

    const pages = [...new Set(currentBlock.pages)].sort((left, right) => left - right);
    blocks.push({
      blockId: [
        currentBlock.noteReference?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ??
          "note",
        pages[0] ?? "page",
      ].join("-"),
      noteReference: currentBlock.noteReference,
      pages,
      text,
      title: currentBlock.title,
    });
    currentBlock = null;
  };

  for (const page of uniquePages) {
    const pageText = input.document.sourceText.pageTexts[page - 1] ?? "";
    if (pageText.trim().length === 0) {
      continue;
    }

    for (const rawLine of pageText.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      const heading = detectAnnualReportNoteHeadingV1({ line });
      if (heading) {
        flushCurrentBlock();
        currentBlock = {
          noteReference: `Not ${heading.noteNumber}`,
          pages: [page],
          lines: [line.trim()],
          title: heading.title,
        };
        continue;
      }

      if (!currentBlock) {
        continue;
      }

      if (currentBlock.pages[currentBlock.pages.length - 1] !== page) {
        currentBlock.pages.push(page);
      }
      currentBlock.lines.push(line);
    }
  }

  flushCurrentBlock();
  return blocks;
}

function buildRelevantNoteCatalogDocumentV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
  document: AnnualReportPreparedDocumentV1;
}): AnnualReportPreparedDocumentV1 | null {
  if (input.blocks.length === 0) {
    return null;
  }

  return {
    ...input.document,
    inlineDataBase64: undefined,
    mimeType: "text/plain",
    sourcePdfBytes: undefined,
    sourceText: undefined,
    uri: undefined,
    text: input.blocks
      .map((block) => {
        const excerptLines = block.text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        const excerpt = dedupeStringsV1([
          ...excerptLines.slice(0, 14),
          ...excerptLines.slice(Math.max(14, excerptLines.length - 6)),
        ])
          .join("\n")
          .slice(0, 1_200);
        const headerLines = [
          `[BlockId ${block.blockId}]`,
          `Reference: ${block.noteReference ?? "Unknown note"}`,
          block.title ? `Title: ${block.title}` : undefined,
          `Pages: ${block.pages.join(", ")}`,
          "Text:",
          excerpt,
        ].filter(Boolean);
        return headerLines.join("\n");
      })
      .join("\n\n---\n\n"),
  };
}

function selectRelevantNoteCandidateBlocksV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
}): AnnualReportRelevantNoteBlockV1[] {
  const candidates = input.blocks
    .map((block) => {
      const normalizedText = buildRelevantNoteBlockMatchTextV1(block).body;
      const classification = classifyRelevantNoteBlockV1(block)[0];
      const keywordScore = RELEVANT_NOTE_CANDIDATE_MATCHERS_V1.reduce(
        (score, matcher) => score + (matcher.test(normalizedText) ? 1 : 0),
        0,
      );
      return {
        block,
        classification,
        keywordScore,
      };
    })
    .filter(
      (candidate) =>
        !isLikelyIndexOnlyRelevantNoteBlockV1(candidate.block) &&
        candidate.keywordScore > 0 &&
        (candidate.classification?.score ?? 0) >= 4,
    )
    .sort((left, right) => {
      const scoreDelta =
        (right.classification?.score ?? 0) - (left.classification?.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return right.keywordScore - left.keywordScore;
    });
  const selected: AnnualReportRelevantNoteBlockV1[] = [];
  const perCategory = new Map<AnnualReportRelevantNoteCategoryV1, number>();

  for (const candidate of candidates) {
    const category = candidate.classification?.category;
    if (!category) {
      continue;
    }
    if ((perCategory.get(category) ?? 0) >= 2) {
      continue;
    }
    selected.push(candidate.block);
    perCategory.set(category, (perCategory.get(category) ?? 0) + 1);
    if (selected.length >= 10) {
      break;
    }
  }

  if (selected.length > 0) {
    return selected;
  }

  return input.blocks.filter((block) => !isLikelyIndexOnlyRelevantNoteBlockV1(block)).slice(0, 6);
}

function selectTaxExpenseNoteBlocksV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
}): AnnualReportRelevantNoteBlockV1[] {
  return input.blocks
    .filter((block) => !isLikelyIndexOnlyRelevantNoteBlockV1(block))
    .map((block) => ({
      block,
      score:
        classifyRelevantNoteBlockV1(block).find(
          (candidate) => candidate.category === "tax_expense",
        )?.score ?? 0,
    }))
    .filter((candidate) => candidate.score >= 4)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((candidate) => candidate.block);
}

function chunkRelevantNoteBlocksV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
  maxBlocksPerChunk: number;
  maxCharsPerChunk: number;
}): AnnualReportRelevantNoteBlockV1[][] {
  const chunks: AnnualReportRelevantNoteBlockV1[][] = [];
  let currentChunk: AnnualReportRelevantNoteBlockV1[] = [];
  let currentChars = 0;

  const flush = () => {
    if (currentChunk.length === 0) {
      return;
    }
    chunks.push(currentChunk);
    currentChunk = [];
    currentChars = 0;
  };

  for (const block of input.blocks) {
    const estimatedChars =
      (block.noteReference?.length ?? 0) +
      (block.title?.length ?? 0) +
      Math.min(block.text.length, 1_800);
    const shouldFlush =
      currentChunk.length > 0 &&
      (currentChunk.length >= input.maxBlocksPerChunk ||
        currentChars + estimatedChars > input.maxCharsPerChunk);
    if (shouldFlush) {
      flush();
    }

    currentChunk.push(block);
    currentChars += estimatedChars;
  }

  flush();
  return chunks;
}

function buildRelevantNoteFallbackEvidenceFromBlockV1(input: {
  block: AnnualReportRelevantNoteBlockV1;
}): AnnualReportEvidenceReferenceV1[] {
  const snippets = input.block.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);

  return dedupeByKeyV1(
    snippets.map((snippet) => ({
      snippet,
      noteReference: input.block.noteReference,
      page: input.block.pages[0],
    })),
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
}

function materializeRelevantNotesFromLocatorV1(input: {
  blocks: AnnualReportRelevantNoteBlockV1[];
  output: AnnualReportAiRelevantNoteLocatorResultV1;
  warnings: string[];
}): AnnualReportRelevantNoteV1[] {
  const blockById = new Map(
    input.blocks.map((block) => [block.blockId, block] as const),
  );
  const materializedNotes: AnnualReportRelevantNoteV1[] = [];
  for (const note of input.output.relevantNotes ?? []) {
    const block = blockById.get(note.blockId);
    if (!block) {
      continue;
    }
    if (!note.category) {
      input.warnings.push(
        `degraded.relevant_notes.invalid_category:block=${note.blockId}`,
      );
      continue;
    }

    materializedNotes.push({
      category: note.category,
      title: note.title ?? block.title,
      noteReference: note.noteReference ?? block.noteReference,
      pages:
        note.pages.length > 0
          ? [...new Set(note.pages)].sort((left, right) => left - right)
          : block.pages,
      notes: sanitizeFinalNotesV1(note.notes),
      evidence:
        note.evidence.length > 0
          ? note.evidence
          : buildRelevantNoteFallbackEvidenceFromBlockV1({
              block,
            }),
    });
  }

  return dedupeRelevantNotesV1(materializedNotes);
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
  modelConfig: AiModelConfigV1;
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

function normalizeAnnualReportStatementMatchTextV1(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
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

function expandAnnualReportRangesToPagesV1(input: {
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): number[] {
  const pages: number[] = [];
  for (const range of normalizeAiRangesV1({
    maxPage: input.maxPage,
    ranges: input.ranges,
  })) {
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      pages.push(page);
    }
  }
  return [...new Set(pages)];
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
        normalizedLine.startsWith("not ") ||
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
}): "sek" | "ksek" | "msek" | undefined {
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

function countStatementValuesV1(
  lines: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"],
): number {
  return lines.reduce((count, line) => {
    const currentYearValueCount = typeof line.currentYearValue === "number" ? 1 : 0;
    const priorYearValueCount = typeof line.priorYearValue === "number" ? 1 : 0;
    return count + currentYearValueCount + priorYearValueCount;
  }, 0);
}

function buildDeterministicStatementsFallbackV1(input: {
  document: AnnualReportPreparedDocumentV1;
  statementRanges: AnnualReportAiSectionLocatorRangeV1[];
}):
  | {
      ok: true;
      ink2rExtracted: AnnualReportTaxDeepExtractionV1["ink2rExtracted"];
      priorYearComparatives: AnnualReportTaxDeepExtractionV1["priorYearComparatives"];
      metrics: {
        balanceRows: number;
        balanceValues: number;
        incomeRows: number;
        incomeValues: number;
      };
    }
  | {
      ok: false;
    } {
  if (
    input.document.fileType !== "pdf" ||
    input.document.sourceText?.fileType !== "pdf" ||
    input.document.sourceText.pageTexts.length === 0
  ) {
    return { ok: false };
  }

  const pageTexts = input.document.sourceText.pageTexts;
  const statementPages = expandAnnualReportRangesToPagesV1({
    maxPage: pageTexts.length,
    ranges: input.statementRanges,
  });
  const incomePages = refineAnnualReportStatementPagesV1({
    pageTexts,
    pages: statementPages,
    statement: "income",
  });
  const balancePages = refineAnnualReportStatementPagesV1({
    pageTexts,
    pages: statementPages,
    statement: "balance",
  });

  if (incomePages.length === 0 || balancePages.length === 0) {
    return { ok: false };
  }

  const incomeStatement = buildDeterministicStatementLinesFromPageTextV1({
    pageTexts,
    pages: incomePages,
    statement: "income",
  });
  const balanceSheet = buildDeterministicStatementLinesFromPageTextV1({
    pageTexts,
    pages: balancePages,
    statement: "balance",
  });
  const incomeValues = countStatementValuesV1(incomeStatement);
  const balanceValues = countStatementValuesV1(balanceSheet);

  if (
    incomeStatement.length < 6 ||
    balanceSheet.length < 12 ||
    incomeValues + balanceValues < 30
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    ink2rExtracted: {
      statementUnit: resolveAnnualReportStatementUnitFromPageTextsV1({
        pageTexts,
        pages: [...new Set([...incomePages, ...balancePages])],
      }),
      incomeStatement,
      balanceSheet,
    },
    priorYearComparatives: [],
    metrics: {
      balanceRows: balanceSheet.length,
      balanceValues,
      incomeRows: incomeStatement.length,
      incomeValues,
    },
  };
}

function dedupeStringsV1(values: Array<string | undefined | null>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  ];
}

function sanitizeFinalEvidenceReferenceV1(
  value: unknown,
): AnnualReportEvidenceReferenceV1[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }

  const entry = value as Record<string, unknown>;
  if (typeof entry.snippet !== "string" || entry.snippet.trim().length === 0) {
    return [];
  }

  return [
    {
      snippet: entry.snippet.trim(),
      page:
        typeof entry.page === "number" && Number.isFinite(entry.page)
          ? entry.page
          : undefined,
      section:
        typeof entry.section === "string" && entry.section.trim().length > 0
          ? entry.section.trim()
          : undefined,
      noteReference:
        typeof entry.noteReference === "string" &&
        entry.noteReference.trim().length > 0
          ? entry.noteReference.trim()
          : undefined,
    },
  ];
}

function sanitizeFinalNotesV1(values: unknown[]): string[] {
  return dedupeStringsV1(
    values.map((value) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined,
    ),
  );
}

function sanitizeFinalValueWithEvidenceV1(
  value: unknown,
): AnnualReportValueWithEvidenceV1 | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entry = value as Record<string, unknown>;
  if (typeof entry.value !== "number" || !Number.isFinite(entry.value)) {
    return undefined;
  }

  return {
    value: entry.value,
    evidence: dedupeByKeyV1(
      [
        ...(Array.isArray(entry.evidence)
          ? entry.evidence.flatMap((item) => sanitizeFinalEvidenceReferenceV1(item))
          : []),
        ...sanitizeFinalEvidenceReferenceV1(value),
      ],
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

function mergeEvidenceArraysV1(
  existing: AnnualReportEvidenceReferenceV1[],
  next: AnnualReportEvidenceReferenceV1[],
): AnnualReportEvidenceReferenceV1[] {
  return dedupeByKeyV1(
    [...existing, ...next],
    (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
  );
}

function mergeValueWithEvidencePreferNextV1(input: {
  existing?: AnnualReportValueWithEvidenceV1;
  next?: AnnualReportValueWithEvidenceV1;
}): AnnualReportValueWithEvidenceV1 | undefined {
  const existing = input.existing
    ? sanitizeFinalValueWithEvidenceV1(input.existing)
    : undefined;
  const next = input.next ? sanitizeFinalValueWithEvidenceV1(input.next) : undefined;

  if (!existing && !next) {
    return undefined;
  }

  const mergedEvidence = mergeEvidenceArraysV1(
    existing?.evidence ?? [],
    next?.evidence ?? [],
  );
  const merged: AnnualReportValueWithEvidenceV1 = {
    value: next?.value ?? existing?.value,
    currency: next?.currency ?? existing?.currency,
    evidence: mergedEvidence,
  };

  if (
    merged.value === undefined &&
    merged.currency === undefined &&
    merged.evidence.length === 0
  ) {
    return undefined;
  }

  return merged;
}

function mergeTaxExpenseContextsV1(input: {
  existing?: AnnualReportTaxDeepExtractionV1["taxExpenseContext"];
  next?: AnnualReportTaxDeepExtractionV1["taxExpenseContext"];
}): AnnualReportTaxDeepExtractionV1["taxExpenseContext"] {
  const existingRaw =
    typeof input.existing === "object" && input.existing !== null
      ? (input.existing as Record<string, unknown>)
      : {};
  const nextRaw =
    typeof input.next === "object" && input.next !== null
      ? (input.next as Record<string, unknown>)
      : {};

  if (!input.existing && !input.next) {
    return undefined;
  }

  return {
    currentTax: mergeValueWithEvidencePreferNextV1({
      existing:
        input.existing?.currentTax ??
        sanitizeFinalValueWithEvidenceV1(existingRaw.recognizedTax),
      next:
        input.next?.currentTax ??
        sanitizeFinalValueWithEvidenceV1(nextRaw.recognizedTax),
    }),
    deferredTax: mergeValueWithEvidencePreferNextV1({
      existing: input.existing?.deferredTax,
      next: input.next?.deferredTax,
    }),
    totalTaxExpense: mergeValueWithEvidencePreferNextV1({
      existing: input.existing?.totalTaxExpense,
      next: input.next?.totalTaxExpense,
    }),
    notes: sanitizeFinalNotesV1([
      ...(input.existing?.notes ?? []),
      ...(Array.isArray(existingRaw.reconciliation)
        ? existingRaw.reconciliation
        : []),
      ...(input.next?.notes ?? []),
      ...(Array.isArray(nextRaw.reconciliation) ? nextRaw.reconciliation : []),
    ]),
    evidence: mergeEvidenceArraysV1(
      [
        ...(input.existing?.evidence ?? []),
        ...sanitizeFinalEvidenceReferenceV1(existingRaw.recognizedTax),
      ],
      [
        ...(input.next?.evidence ?? []),
        ...sanitizeFinalEvidenceReferenceV1(nextRaw.recognizedTax),
      ],
    ),
  };
}

function mergeAssetsContextIntoTaxDeepV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
  next: AnnualReportAiTaxNotesAssetsAndReservesResultV1;
}): void {
  input.taxDeep.depreciationContext.assetAreas = dedupeByKeyV1(
    [
      ...input.taxDeep.depreciationContext.assetAreas,
      ...input.next.depreciationContext.assetAreas,
    ],
    (line) =>
      [
        line.assetArea,
        line.openingCarryingAmount ?? "",
        line.closingCarryingAmount ?? "",
        line.depreciationForYear ?? "",
      ].join("|"),
  );
  input.taxDeep.depreciationContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.depreciationContext.evidence,
    input.next.depreciationContext.evidence,
  );
  input.taxDeep.assetMovements.lines = dedupeByKeyV1(
    [...input.taxDeep.assetMovements.lines, ...input.next.assetMovements.lines],
    (line) =>
      [
        line.assetArea,
        line.openingCarryingAmount ?? "",
        line.closingCarryingAmount ?? "",
        line.depreciationForYear ?? "",
      ].join("|"),
  );
  input.taxDeep.assetMovements.evidence = mergeEvidenceArraysV1(
    input.taxDeep.assetMovements.evidence,
    input.next.assetMovements.evidence,
  );
  input.taxDeep.reserveContext.movements = dedupeByKeyV1(
    [
      ...input.taxDeep.reserveContext.movements,
      ...input.next.reserveContext.movements,
    ],
    (line) =>
      [
        line.reserveType,
        line.openingBalance ?? "",
        line.closingBalance ?? "",
        line.movementForYear ?? "",
      ].join("|"),
  );
  input.taxDeep.reserveContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.reserveContext.notes,
    ...input.next.reserveContext.notes,
  ]);
  input.taxDeep.reserveContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.reserveContext.evidence,
    input.next.reserveContext.evidence,
  );
  input.taxDeep.taxExpenseContext = mergeTaxExpenseContextsV1({
    existing: input.taxDeep.taxExpenseContext,
    next: input.next.taxExpenseContext,
  });
}

function mergeFinanceContextIntoTaxDeepV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
  next: AnnualReportAiTaxNotesFinanceAndOtherResultV1;
}): void {
  const nextNetInterestRaw = input.next.netInterestContext as Record<string, unknown>;
  const nextPensionRaw = input.next.pensionContext as Record<string, unknown>;
  const nextLeasingRaw = input.next.leasingContext as Record<string, unknown>;
  const nextGroupContributionRaw =
    input.next.groupContributionContext as Record<string, unknown>;
  const nextShareholdingRaw =
    input.next.shareholdingContext as Record<string, unknown>;

  input.taxDeep.netInterestContext.financeIncome = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.netInterestContext.financeIncome,
    next:
      input.next.netInterestContext.financeIncome ??
      sanitizeFinalValueWithEvidenceV1(nextNetInterestRaw.otherFinancialIncome),
  });
  input.taxDeep.netInterestContext.financeExpense = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.netInterestContext.financeExpense,
    next:
      input.next.netInterestContext.financeExpense ??
      sanitizeFinalValueWithEvidenceV1(nextNetInterestRaw.otherFinancialExpense),
  });
  input.taxDeep.netInterestContext.interestIncome = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.netInterestContext.interestIncome,
    next: input.next.netInterestContext.interestIncome,
  });
  input.taxDeep.netInterestContext.interestExpense = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.netInterestContext.interestExpense,
    next: input.next.netInterestContext.interestExpense,
  });
  input.taxDeep.netInterestContext.netInterest = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.netInterestContext.netInterest,
    next: input.next.netInterestContext.netInterest,
  });
  input.taxDeep.netInterestContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.netInterestContext.notes,
    ...input.next.netInterestContext.notes,
  ]);
  input.taxDeep.netInterestContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.netInterestContext.evidence,
    input.next.netInterestContext.evidence,
  );
  input.taxDeep.pensionContext.specialPayrollTax = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.pensionContext.specialPayrollTax,
    next: input.next.pensionContext.specialPayrollTax,
  });
  input.taxDeep.pensionContext.flags = dedupeByKeyV1(
    [...input.taxDeep.pensionContext.flags, ...input.next.pensionContext.flags],
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  input.taxDeep.pensionContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.pensionContext.notes,
    ...input.next.pensionContext.notes,
    ...(Array.isArray(nextPensionRaw.pensionCosts)
      ? nextPensionRaw.pensionCosts
      : []),
    ...(Array.isArray(nextPensionRaw.pensionObligations)
      ? nextPensionRaw.pensionObligations
      : []),
  ]);
  input.taxDeep.pensionContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.pensionContext.evidence,
    input.next.pensionContext.evidence,
  );
  input.taxDeep.leasingContext.flags = dedupeByKeyV1(
    [...input.taxDeep.leasingContext.flags, ...input.next.leasingContext.flags],
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  input.taxDeep.leasingContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.leasingContext.notes,
    ...input.next.leasingContext.notes,
    ...(Array.isArray(nextLeasingRaw.leasingCosts)
      ? nextLeasingRaw.leasingCosts
      : []),
    ...(Array.isArray(nextLeasingRaw.leasingExpenses)
      ? nextLeasingRaw.leasingExpenses
      : []),
    ...(Array.isArray(nextLeasingRaw.futureLeasingCommitments)
      ? nextLeasingRaw.futureLeasingCommitments
      : []),
    ...(Array.isArray(nextLeasingRaw.leasingObligations)
      ? nextLeasingRaw.leasingObligations
      : []),
  ]);
  input.taxDeep.leasingContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.leasingContext.evidence,
    input.next.leasingContext.evidence,
  );
  input.taxDeep.groupContributionContext.flags = dedupeByKeyV1(
    [
      ...input.taxDeep.groupContributionContext.flags,
      ...input.next.groupContributionContext.flags,
    ],
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  input.taxDeep.groupContributionContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.groupContributionContext.notes,
    ...input.next.groupContributionContext.notes,
    ...(Array.isArray(nextGroupContributionRaw.groupContributionsReceived)
      ? nextGroupContributionRaw.groupContributionsReceived
      : []),
    ...(Array.isArray(nextGroupContributionRaw.groupContributionsPaid)
      ? nextGroupContributionRaw.groupContributionsPaid
      : []),
  ]);
  input.taxDeep.groupContributionContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.groupContributionContext.evidence,
    input.next.groupContributionContext.evidence,
  );
  input.taxDeep.shareholdingContext.dividendsReceived = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.shareholdingContext.dividendsReceived,
    next:
      input.next.shareholdingContext.dividendsReceived ??
      sanitizeFinalValueWithEvidenceV1(nextShareholdingRaw.dividends),
  });
  input.taxDeep.shareholdingContext.dividendsPaid = mergeValueWithEvidencePreferNextV1({
    existing: input.taxDeep.shareholdingContext.dividendsPaid,
    next: input.next.shareholdingContext.dividendsPaid,
  });
  input.taxDeep.shareholdingContext.flags = dedupeByKeyV1(
    [
      ...input.taxDeep.shareholdingContext.flags,
      ...input.next.shareholdingContext.flags,
    ],
    (flag) => `${flag.code}|${flag.label}|${flag.value ?? ""}`,
  );
  input.taxDeep.shareholdingContext.notes = sanitizeFinalNotesV1([
    ...input.taxDeep.shareholdingContext.notes,
    ...input.next.shareholdingContext.notes,
    ...(Array.isArray(nextShareholdingRaw.dividends)
      ? nextShareholdingRaw.dividends
      : []),
    ...(Array.isArray(nextShareholdingRaw.proposedDividend)
      ? nextShareholdingRaw.proposedDividend
      : []),
    ...(Array.isArray(nextShareholdingRaw.financialAssets)
      ? nextShareholdingRaw.financialAssets
      : []),
    ...(Array.isArray(nextShareholdingRaw.participationsInGroupCompanies)
      ? nextShareholdingRaw.participationsInGroupCompanies
      : []),
    ...(Array.isArray(nextShareholdingRaw.participationsInAssociatedCompanies)
      ? nextShareholdingRaw.participationsInAssociatedCompanies
      : []),
    ...(Array.isArray(nextShareholdingRaw.otherLongTermSecurities)
      ? nextShareholdingRaw.otherLongTermSecurities
      : []),
  ]);
  input.taxDeep.shareholdingContext.evidence = mergeEvidenceArraysV1(
    input.taxDeep.shareholdingContext.evidence,
    input.next.shareholdingContext.evidence,
  );
  input.taxDeep.taxExpenseContext = mergeTaxExpenseContextsV1({
    existing: input.taxDeep.taxExpenseContext,
    next: input.next.taxExpenseContext,
  });
}

function mergeTaxExpenseNoteIntoTaxDeepV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
  next: AnnualReportAiTaxExpenseNoteResultV1;
}): void {
  input.taxDeep.taxExpenseContext = mergeTaxExpenseContextsV1({
    existing: input.taxDeep.taxExpenseContext,
    next: input.next.taxExpenseContext,
  });
}

function buildRelevantNoteKeyV1(note: {
  category: AnnualReportRelevantNoteCategoryV1;
  title?: string;
  noteReference?: string;
  pages: number[];
}): string {
  return [
    note.category,
    note.noteReference ?? "",
    note.title ?? "",
    note.pages.join(","),
  ].join("|");
}

function dedupeRelevantNotesV1(
  notes: AnnualReportRelevantNoteV1[],
): AnnualReportRelevantNoteV1[] {
  return dedupeByKeyV1(notes, buildRelevantNoteKeyV1).map((note) => ({
    ...note,
    pages: [...new Set(note.pages)].sort((left, right) => left - right),
    notes: sanitizeFinalNotesV1(note.notes),
    evidence: dedupeByKeyV1(note.evidence, (evidence) =>
      [
        evidence.page ?? "",
        evidence.section ?? "",
        evidence.noteReference ?? "",
        evidence.snippet,
      ].join("|"),
    ),
  }));
}

function mergeRelevantNoteCollectionsV1(
  existingNotes: AnnualReportRelevantNoteV1[],
  nextNotes: AnnualReportRelevantNoteV1[],
): AnnualReportRelevantNoteV1[] {
  const merged = new Map<string, AnnualReportRelevantNoteV1>();

  for (const note of [...existingNotes, ...nextNotes]) {
    const key = buildRelevantNoteKeyV1(note);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...note,
        pages: [...note.pages],
        notes: [...note.notes],
        evidence: [...note.evidence],
      });
      continue;
    }

    merged.set(key, {
      category: current.category,
      noteReference: note.noteReference ?? current.noteReference,
      title: note.title ?? current.title,
      pages: [...new Set([...current.pages, ...note.pages])].sort(
        (left, right) => left - right,
      ),
      notes: sanitizeFinalNotesV1([...current.notes, ...note.notes]),
      evidence: dedupeByKeyV1(
        [...current.evidence, ...note.evidence],
        (evidence) =>
          [
            evidence.page ?? "",
            evidence.section ?? "",
            evidence.noteReference ?? "",
            evidence.snippet,
          ].join("|"),
      ),
    });
  }

  return dedupeRelevantNotesV1([...merged.values()]);
}

function mergeRelevantNotesIntoTaxDeepV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
  next: AnnualReportRelevantNoteV1[];
}): void {
  input.taxDeep.relevantNotes = mergeRelevantNoteCollectionsV1(
    input.taxDeep.relevantNotes ?? [],
    input.next,
  );
}

function backfillRelevantNoteContextsV1(input: {
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"];
}): void {
  const notesByCategory = new Map<
    AnnualReportRelevantNoteCategoryV1,
    AnnualReportRelevantNoteV1[]
  >();
  for (const relevantNote of input.taxDeep.relevantNotes ?? []) {
    const existing = notesByCategory.get(relevantNote.category) ?? [];
    existing.push(relevantNote);
    notesByCategory.set(relevantNote.category, existing);
  }

  const notesForCategory = (category: AnnualReportRelevantNoteCategoryV1) =>
    notesByCategory.get(category) ?? [];
  const mergeNoteEvidence = (existing: AnnualReportEvidenceReferenceV1[], category: AnnualReportRelevantNoteCategoryV1) =>
    mergeEvidenceArraysV1(
      existing,
      notesForCategory(category).flatMap((note) => note.evidence),
    );
  const mergeNoteTexts = (existing: string[], category: AnnualReportRelevantNoteCategoryV1) =>
    sanitizeFinalNotesV1([
      ...existing,
      ...notesForCategory(category).flatMap((note) => note.notes),
    ]);
  const shouldBackfillEvidence = (existing: AnnualReportEvidenceReferenceV1[]) =>
    existing.length === 0;
  const shouldBackfillNarrative = (existingNotes: string[]) =>
    existingNotes.length === 0;

  if (shouldBackfillEvidence(input.taxDeep.depreciationContext.evidence)) {
    input.taxDeep.depreciationContext.evidence = mergeNoteEvidence(
      input.taxDeep.depreciationContext.evidence,
      "fixed_assets_depreciation",
    );
  }
  if (shouldBackfillEvidence(input.taxDeep.assetMovements.evidence)) {
    input.taxDeep.assetMovements.evidence = mergeNoteEvidence(
      input.taxDeep.assetMovements.evidence,
      "fixed_assets_depreciation",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.netInterestContext.notes)) {
    input.taxDeep.netInterestContext.notes = mergeNoteTexts(
      input.taxDeep.netInterestContext.notes,
      "interest",
    );
    input.taxDeep.netInterestContext.evidence = mergeNoteEvidence(
      input.taxDeep.netInterestContext.evidence,
      "interest",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.pensionContext.notes)) {
    input.taxDeep.pensionContext.notes = mergeNoteTexts(
      input.taxDeep.pensionContext.notes,
      "pension",
    );
    input.taxDeep.pensionContext.evidence = mergeNoteEvidence(
      input.taxDeep.pensionContext.evidence,
      "pension",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.reserveContext.notes)) {
    input.taxDeep.reserveContext.notes = mergeNoteTexts(
      input.taxDeep.reserveContext.notes,
      "reserve",
    );
    input.taxDeep.reserveContext.evidence = mergeNoteEvidence(
      input.taxDeep.reserveContext.evidence,
      "reserve",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.leasingContext.notes)) {
    input.taxDeep.leasingContext.notes = mergeNoteTexts(
      input.taxDeep.leasingContext.notes,
      "leasing",
    );
    input.taxDeep.leasingContext.evidence = mergeNoteEvidence(
      input.taxDeep.leasingContext.evidence,
      "leasing",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.groupContributionContext.notes)) {
    input.taxDeep.groupContributionContext.notes = mergeNoteTexts(
      input.taxDeep.groupContributionContext.notes,
      "group_contributions",
    );
    input.taxDeep.groupContributionContext.evidence = mergeNoteEvidence(
      input.taxDeep.groupContributionContext.evidence,
      "group_contributions",
    );
  }
  if (shouldBackfillNarrative(input.taxDeep.shareholdingContext.notes)) {
    input.taxDeep.shareholdingContext.notes = mergeNoteTexts(
      input.taxDeep.shareholdingContext.notes,
      "shareholdings_dividends",
    );
    input.taxDeep.shareholdingContext.evidence = mergeNoteEvidence(
      input.taxDeep.shareholdingContext.evidence,
      "shareholdings_dividends",
    );
  }

  if (!input.taxDeep.taxExpenseContext) {
    const taxNotes = notesForCategory("tax_expense");
    if (taxNotes.length > 0) {
      input.taxDeep.taxExpenseContext = {
        notes: sanitizeFinalNotesV1(taxNotes.flatMap((note) => note.notes)),
        evidence: dedupeByKeyV1(
          taxNotes.flatMap((note) => note.evidence),
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
  } else if (shouldBackfillNarrative(input.taxDeep.taxExpenseContext.notes)) {
    input.taxDeep.taxExpenseContext.notes = mergeNoteTexts(
      input.taxDeep.taxExpenseContext.notes,
      "tax_expense",
    );
    input.taxDeep.taxExpenseContext.evidence = mergeNoteEvidence(
      input.taxDeep.taxExpenseContext.evidence,
      "tax_expense",
    );
  }
}

function sanitizeFinalStatementsExtractedV1(input: {
  statementUnit?: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["statementUnit"];
  incomeStatement?: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["incomeStatement"];
  balanceSheet?: AnnualReportTaxDeepExtractionV1["ink2rExtracted"]["balanceSheet"];
}): AnnualReportTaxDeepExtractionV1["ink2rExtracted"] {
  return {
    statementUnit: input.statementUnit,
    incomeStatement: input.incomeStatement ?? [],
    balanceSheet: input.balanceSheet ?? [],
  };
}

function sanitizeFinalTaxDeepForContractV1(
  taxDeep: AnnualReportAiExtractionResultV1["taxDeep"],
): AnnualReportTaxDeepExtractionV1 {
  const raw = taxDeep as unknown as Record<string, unknown>;
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
    ink2rExtracted: sanitizeFinalStatementsExtractedV1(taxDeep.ink2rExtracted),
    depreciationContext: {
      assetAreas: taxDeep.depreciationContext.assetAreas,
      evidence: taxDeep.depreciationContext.evidence,
    },
    assetMovements: {
      lines: taxDeep.assetMovements.lines,
      evidence: taxDeep.assetMovements.evidence,
    },
    reserveContext: {
      movements: taxDeep.reserveContext.movements,
      notes: sanitizeFinalNotesV1(taxDeep.reserveContext.notes),
      evidence: taxDeep.reserveContext.evidence,
    },
    netInterestContext: {
      financeIncome:
        sanitizeFinalValueWithEvidenceV1(netInterestContext.financeIncome) ??
        sanitizeFinalValueWithEvidenceV1(netInterestContext.otherFinancialIncome),
      financeExpense:
        sanitizeFinalValueWithEvidenceV1(netInterestContext.financeExpense) ??
        sanitizeFinalValueWithEvidenceV1(netInterestContext.otherFinancialExpense),
      interestIncome: sanitizeFinalValueWithEvidenceV1(netInterestContext.interestIncome),
      interestExpense: sanitizeFinalValueWithEvidenceV1(netInterestContext.interestExpense),
      netInterest: sanitizeFinalValueWithEvidenceV1(netInterestContext.netInterest),
      notes: sanitizeFinalNotesV1(taxDeep.netInterestContext.notes),
      evidence: taxDeep.netInterestContext.evidence,
    },
    pensionContext: {
      specialPayrollTax: sanitizeFinalValueWithEvidenceV1(pensionContext.specialPayrollTax),
      flags: taxDeep.pensionContext.flags,
      notes: sanitizeFinalNotesV1([
        ...taxDeep.pensionContext.notes,
        ...(Array.isArray(pensionContext.pensionCosts) ? pensionContext.pensionCosts : []),
        ...(Array.isArray(pensionContext.pensionObligations)
          ? pensionContext.pensionObligations
          : []),
      ]),
      evidence: dedupeByKeyV1(
        [
          ...taxDeep.pensionContext.evidence,
          ...(Array.isArray(pensionContext.evidence)
            ? pensionContext.evidence.flatMap((item) =>
                sanitizeFinalEvidenceReferenceV1(item),
              )
            : []),
        ],
        (evidence) =>
          [
            evidence.page ?? "",
            evidence.section ?? "",
            evidence.noteReference ?? "",
            evidence.snippet,
          ].join("|"),
      ),
    },
    taxExpenseContext: taxExpenseContext
      ? {
          currentTax:
            sanitizeFinalValueWithEvidenceV1(taxExpenseContext.currentTax) ??
            sanitizeFinalValueWithEvidenceV1(taxExpenseContext.recognizedTax),
          deferredTax: sanitizeFinalValueWithEvidenceV1(taxExpenseContext.deferredTax),
          totalTaxExpense: sanitizeFinalValueWithEvidenceV1(taxExpenseContext.totalTaxExpense),
          notes: sanitizeFinalNotesV1([
            ...(Array.isArray(taxExpenseContext.notes) ? taxExpenseContext.notes : []),
            ...(Array.isArray(taxExpenseContext.reconciliation)
              ? taxExpenseContext.reconciliation
              : []),
          ]),
          evidence: dedupeByKeyV1(
            [
              ...(Array.isArray(taxExpenseContext.evidence)
                ? taxExpenseContext.evidence.flatMap((item) =>
                    sanitizeFinalEvidenceReferenceV1(item),
                  )
                : []),
              ...sanitizeFinalEvidenceReferenceV1(taxExpenseContext.recognizedTax),
              ...sanitizeFinalEvidenceReferenceV1(taxExpenseContext.totalTaxExpense),
            ],
            (evidence) =>
              [
                evidence.page ?? "",
                evidence.section ?? "",
                evidence.noteReference ?? "",
                evidence.snippet,
              ].join("|"),
          ),
        }
      : undefined,
    leasingContext: {
      flags: taxDeep.leasingContext.flags,
      notes: sanitizeFinalNotesV1([
        ...taxDeep.leasingContext.notes,
        ...(Array.isArray(leasingContext.leasingCosts) ? leasingContext.leasingCosts : []),
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
      evidence: taxDeep.leasingContext.evidence,
    },
    groupContributionContext: {
      flags: taxDeep.groupContributionContext.flags,
      notes: sanitizeFinalNotesV1([
        ...taxDeep.groupContributionContext.notes,
        ...(Array.isArray(groupContributionContext.groupContributionsReceived)
          ? groupContributionContext.groupContributionsReceived
          : []),
        ...(Array.isArray(groupContributionContext.groupContributionsPaid)
          ? groupContributionContext.groupContributionsPaid
          : []),
      ]),
      evidence: taxDeep.groupContributionContext.evidence,
    },
    shareholdingContext: {
      dividendsReceived:
        sanitizeFinalValueWithEvidenceV1(shareholdingContext.dividendsReceived) ??
        sanitizeFinalValueWithEvidenceV1(shareholdingContext.dividends),
      dividendsPaid: sanitizeFinalValueWithEvidenceV1(shareholdingContext.dividendsPaid),
      flags: taxDeep.shareholdingContext.flags,
      notes: sanitizeFinalNotesV1([
        ...taxDeep.shareholdingContext.notes,
        ...(Array.isArray(shareholdingContext.dividends) ? shareholdingContext.dividends : []),
        ...(Array.isArray(shareholdingContext.proposedDividend)
          ? shareholdingContext.proposedDividend
          : []),
        ...(Array.isArray(shareholdingContext.financialAssets)
          ? shareholdingContext.financialAssets
          : []),
        ...(Array.isArray(shareholdingContext.participationsInGroupCompanies)
          ? shareholdingContext.participationsInGroupCompanies
          : []),
        ...(Array.isArray(shareholdingContext.participationsInAssociatedCompanies)
          ? shareholdingContext.participationsInAssociatedCompanies
          : []),
        ...(Array.isArray(shareholdingContext.otherLongTermSecurities)
          ? shareholdingContext.otherLongTermSecurities
          : []),
      ]),
      evidence: taxDeep.shareholdingContext.evidence,
    },
    relevantNotes: dedupeRelevantNotesV1(taxDeep.relevantNotes ?? []),
    priorYearComparatives: taxDeep.priorYearComparatives,
  };
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
  // Numeric movement tables alone are not enough to suppress the targeted
  // asset-note stage; we only skip follow-up when the combined stage already
  // produced the dedicated asset/reserve/tax-note coverage we need downstream.
  return (
    output.depreciationContext.assetAreas.length > 0 ||
    output.reserveContext.movements.length > 0 ||
    output.reserveContext.notes.length > 0 ||
    (output.taxExpenseContext?.notes.length ?? 0) > 0
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
    Boolean(output.netInterestContext.financeIncome) ||
    Boolean(output.netInterestContext.financeExpense) ||
    Boolean(output.netInterestContext.interestIncome) ||
    Boolean(output.netInterestContext.interestExpense) ||
    Boolean(output.netInterestContext.netInterest) ||
    output.netInterestContext.notes.length > 0 ||
    output.netInterestContext.evidence.length > 0 ||
    Boolean(output.pensionContext.specialPayrollTax) ||
    output.pensionContext.flags.length > 0 ||
    output.pensionContext.notes.length > 0 ||
    output.pensionContext.evidence.length > 0 ||
    output.leasingContext.flags.length > 0 ||
    output.leasingContext.notes.length > 0 ||
    output.leasingContext.evidence.length > 0 ||
    output.groupContributionContext.flags.length > 0 ||
    output.groupContributionContext.notes.length > 0 ||
    output.groupContributionContext.evidence.length > 0 ||
    output.shareholdingContext.flags.length > 0 ||
    output.shareholdingContext.notes.length > 0 ||
    output.shareholdingContext.evidence.length > 0 ||
    Boolean(output.shareholdingContext.dividendsReceived) ||
    Boolean(output.shareholdingContext.dividendsPaid)
  );
}

function hasMeaningfulFinanceStageOutputV1(
  output: AnnualReportAiTaxNotesFinanceAndOtherResultV1,
): boolean {
  return hasFinanceContentV1(output);
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
  const allRelevantNoteBlocks = buildRelevantNoteBlocksV1({
    document: input.document,
    focusRanges: [...taxNotesAssetsFocusRanges, ...taxNotesFinanceFocusRanges],
  });
  const taxExpenseNoteBlocks = selectTaxExpenseNoteBlocksV1({
    blocks: allRelevantNoteBlocks,
  });
  const relevantNoteBlocks = selectRelevantNoteCandidateBlocksV1({
    blocks: allRelevantNoteBlocks,
  });
  const deterministicRelevantNotes = buildDeterministicRelevantNotesFromBlocksV1({
    blocks: allRelevantNoteBlocks,
  });
  const deterministicTaxExpenseContext =
    buildDeterministicTaxExpenseContextFromBlocksV1({
      blocks:
        taxExpenseNoteBlocks.length > 0 ? taxExpenseNoteBlocks : allRelevantNoteBlocks,
    });
  const relevantNotesDocument = buildRelevantNoteCatalogDocumentV1({
    blocks: relevantNoteBlocks,
    document: input.document,
  });
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
    // Note pages often depend on visible table structure and note headings.
    // Keep these stages on routed PDF chunks even when the PDF text is extractable.
    preferTextForExtractablePdf: false,
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
    // For extractable PDFs, use routed text first to keep finance-note passes
    // small and cheap. Retry on routed PDF only when the text result is unusable.
    preferTextForExtractablePdf: true,
  });
  const taxNotesFinancePdfFallbackStageDocument =
    executionProfile === "extractable_text_pdf" &&
    taxNotesFinanceStageDocument.inputType === "text"
      ? buildStageDocumentV1({
          document: input.document,
          executionProfile,
          focusRanges: taxNotesFinanceFocusRanges,
          preferTextForExtractablePdf: false,
        })
      : null;
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
  if (
    taxNotesFinancePdfFallbackStageDocument &&
    taxNotesFinancePdfFallbackStageDocument.inputType !==
      taxNotesFinanceStageDocument.inputType
  ) {
    warnings.push(
      `tax_notes_finance.fallback_input=${taxNotesFinancePdfFallbackStageDocument.inputType}`,
    );
  }
  warnings.push(
    `tax_notes_finance.primary_request_timeout_ms=${stageTimeouts.taxNotesFinance.primaryRequestTimeoutMs}`,
    `tax_notes_finance.retry_request_timeout_ms=${stageTimeouts.taxNotesFinance.retryRequestTimeoutMs}`,
    `tax_notes_finance.stage_budget_ms=${stageTimeouts.taxNotesFinance.stageBudgetMs}`,
  );
  warnings.push(
    `relevant_notes.input=${relevantNotesDocument ? "text" : "skipped"}`,
    `relevant_notes.blocks=${relevantNoteBlocks.length}`,
    `relevant_notes.blocks_total=${allRelevantNoteBlocks.length}`,
    `tax_expense_note.blocks=${taxExpenseNoteBlocks.length}`,
    `relevant_notes.deterministic=${deterministicRelevantNotes.length}`,
    `tax_expense_note.deterministic=${
      deterministicTaxExpenseContext
        ? [
            deterministicTaxExpenseContext.currentTax ? "current" : "",
            deterministicTaxExpenseContext.deferredTax ? "deferred" : "",
            deterministicTaxExpenseContext.totalTaxExpense ? "total" : "",
            deterministicTaxExpenseContext.notes.length > 0 ? "notes" : "",
          ]
            .filter(Boolean)
            .join(",")
        : "none"
    }`,
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
  if (deterministicTaxExpenseContext) {
    taxDeep.taxExpenseContext = mergeTaxExpenseContextsV1({
      existing: taxDeep.taxExpenseContext,
      next: deterministicTaxExpenseContext,
    });
  }
  if (deterministicRelevantNotes.length > 0) {
    mergeRelevantNotesIntoTaxDeepV1({
      taxDeep,
      next: deterministicRelevantNotes,
    });
  }
  const runTaxExpenseNoteV1 = async () => {
    if (taxExpenseNoteBlocks.length === 0) {
      return;
    }

    const taxNoteChunks = chunkRelevantNoteBlocksV1({
      blocks: taxExpenseNoteBlocks,
      maxBlocksPerChunk: 1,
      maxCharsPerChunk: 2_200,
    });
    warnings.push(`tax_expense_note.chunks=${taxNoteChunks.length}`);

    for (const [chunkIndex, blockChunk] of taxNoteChunks.entries()) {
      const chunkDocument = buildRelevantNoteCatalogDocumentV1({
        blocks: blockChunk,
        document: input.document,
      });
      if (!chunkDocument) {
        continue;
      }

      await input.onProgress?.("extracting_tax_notes", [
        `progress.tax_expense_note.chunk=${chunkIndex + 1}/${taxNoteChunks.length}`,
      ]);
      const taxExpenseNoteResult =
        await executeAnnualReportStageV1<AnnualReportAiTaxExpenseNoteResultV1>({
          apiKey: input.apiKey,
          modelConfig: input.modelConfig,
          modelTier: "fast",
          document: chunkDocument,
          responseSchema: AnnualReportAiTaxExpenseNoteResultV1Schema,
          stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxExpenseNote,
          focusContext: formatPageRanges(
            blockChunk.map((block) => ({
              startPage: block.pages[0] ?? 1,
              endPage: block.pages[block.pages.length - 1] ?? block.pages[0] ?? 1,
              confidence: 1,
            })),
          ),
          timeoutMs: 15_000,
          useResponseJsonSchema: false,
        });

      if (!taxExpenseNoteResult.ok) {
        const stageError = formatAnnualReportStageErrorV1({
          stage: `${ANNUAL_REPORT_STAGE_LABELS_V1.taxExpenseNote} chunk ${chunkIndex + 1}`,
          error: taxExpenseNoteResult.error,
        });
        warnings.push(`degraded.tax_expense_note.unavailable:${stageError.message}`);
        continue;
      }

      mergeTaxExpenseNoteIntoTaxDeepV1({
        taxDeep,
        next: taxExpenseNoteResult.output,
      });
    }
  };
  const runRelevantNotesCatalogV1 = async () => {
    if (!relevantNotesDocument || relevantNoteBlocks.length === 0) {
      return;
    }

    const blockChunks = chunkRelevantNoteBlocksV1({
      blocks: relevantNoteBlocks,
      maxBlocksPerChunk: 3,
      maxCharsPerChunk: 2_800,
    });
    warnings.push(`relevant_notes.chunks=${blockChunks.length}`);
    const mergedRelevantNotes: AnnualReportRelevantNoteV1[] = [];

    for (const [chunkIndex, blockChunk] of blockChunks.entries()) {
      const chunkDocument = buildRelevantNoteCatalogDocumentV1({
        blocks: blockChunk,
        document: input.document,
      });
      if (!chunkDocument) {
        continue;
      }

      await input.onProgress?.("extracting_tax_notes", [
        `progress.relevant_notes.chunk=${chunkIndex + 1}/${blockChunks.length}`,
      ]);
      const relevantNotesResult =
        await executeAnnualReportStageV1<AnnualReportAiRelevantNoteLocatorResultV1>({
          apiKey: input.apiKey,
          modelConfig: input.modelConfig,
          modelTier: "fast",
          document: chunkDocument,
          responseSchema: AnnualReportAiRelevantNoteLocatorResultV1Schema,
          stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.relevantNotes,
          focusContext: formatPageRanges(
            blockChunk.map((block) => ({
              startPage: block.pages[0] ?? 1,
              endPage: block.pages[block.pages.length - 1] ?? block.pages[0] ?? 1,
              confidence: 1,
            })),
          ),
          timeoutMs: 15_000,
          useResponseJsonSchema: false,
        });

      if (!relevantNotesResult.ok) {
        const stageError = formatAnnualReportStageErrorV1({
          stage: `${ANNUAL_REPORT_STAGE_LABELS_V1.relevantNotes} chunk ${chunkIndex + 1}`,
          error: relevantNotesResult.error,
        });
        warnings.push(`degraded.relevant_notes.unavailable:${stageError.message}`);
        continue;
      }

      mergedRelevantNotes.push(
        ...materializeRelevantNotesFromLocatorV1({
          blocks: blockChunk,
          output: relevantNotesResult.output,
          warnings,
        }),
      );
    }

    if (mergedRelevantNotes.length > 0) {
      mergeRelevantNotesIntoTaxDeepV1({
        taxDeep,
        next: mergedRelevantNotes,
      });
    }
  };
  const executeFinanceNotesStageV1 = async (modelSelection: {
    fallbackModelTier: "fast" | "thinking";
    primaryModelTier: "fast" | "thinking";
  }): Promise<
    | {
        ok: true;
        output: AnnualReportAiTaxNotesFinanceAndOtherResultV1;
      }
    | {
        ok: false;
        error: {
          code:
            | "MODEL_EXECUTION_FAILED"
            | "MODEL_RESPONSE_INVALID"
            | "CONFIG_INVALID";
          context: Record<string, unknown>;
          message: string;
        };
      }
  > => {
    const runFinanceStageAttemptV1 = async (stageDocument: {
      document: AnnualReportPreparedDocumentV1;
      inputType: "compact_text" | "text" | "pdf";
    }) =>
      executeAnnualReportStageWithChunkFallbackV1<AnnualReportAiTaxNotesFinanceAndOtherResultV1>(
        {
          apiKey: input.apiKey,
          currentStatus: "extracting_tax_notes",
          chunkLabel: "tax_notes_finance",
          document: stageDocument.document,
          modelConfig: input.modelConfig,
          onProgress: input.onProgress,
          responseSchema: AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema,
          stageInstruction: ANNUAL_REPORT_STAGE_INSTRUCTIONS_V1.taxNotesFinance,
          focusRanges: taxNotesFinanceFocusRanges,
          primaryModelTier: modelSelection.primaryModelTier,
          fallbackModelTier: modelSelection.fallbackModelTier,
          useResponseJsonSchema: false,
          primaryRequestTimeoutMs:
            stageTimeouts.taxNotesFinance.primaryRequestTimeoutMs,
          retryRequestTimeoutMs:
            stageTimeouts.taxNotesFinance.retryRequestTimeoutMs,
          stageBudgetMs: stageTimeouts.taxNotesFinance.stageBudgetMs,
          totalDeadlineMs: extractionDeadlineMs,
          minimumRetryBudgetMs:
            stageTimeouts.taxNotesFinance.minimumRetryBudgetMs,
          primaryMaxCharsPerChunk: runtimeMode === "ai_overdrive" ? 12_000 : 6_000,
          fallbackMaxCharsPerChunk:
            runtimeMode === "ai_overdrive" ? 8_000 : 4_000,
          warnings,
          primaryChunkPages: stageChunking.taxNotesPrimary,
          fallbackChunkPages: stageChunking.taxNotesFallback,
          skipWhenMissingRanges: true,
        },
      );

    const primaryResult = await runFinanceStageAttemptV1(
      taxNotesFinanceStageDocument,
    );
    const canRetryOnPdf =
      taxNotesFinancePdfFallbackStageDocument !== null &&
      taxNotesFinancePdfFallbackStageDocument.inputType !==
        taxNotesFinanceStageDocument.inputType;

    if (!primaryResult.ok) {
      if (!canRetryOnPdf) {
        return primaryResult;
      }
      warnings.push(
        "tax_notes_finance.pdf_fallback reason=primary_attempt_unavailable",
      );
      const pdfFallbackResult = await runFinanceStageAttemptV1(
        taxNotesFinancePdfFallbackStageDocument,
      );
      if (!pdfFallbackResult.ok) {
        return pdfFallbackResult;
      }
      return {
        ok: true as const,
        output: mergeFinanceOutputsV1(pdfFallbackResult.outputs),
      };
    }

    const mergedPrimary = mergeFinanceOutputsV1(primaryResult.outputs);
    if (!canRetryOnPdf || hasMeaningfulFinanceStageOutputV1(mergedPrimary)) {
      return {
        ok: true as const,
        output: mergedPrimary,
      };
    }

    warnings.push("tax_notes_finance.pdf_fallback reason=text_output_unusable");
    const pdfFallbackResult = await runFinanceStageAttemptV1(
      taxNotesFinancePdfFallbackStageDocument,
    );
    if (!pdfFallbackResult.ok) {
      return pdfFallbackResult;
    }

    return {
      ok: true as const,
      output: mergeFinanceOutputsV1([
        mergedPrimary,
        ...pdfFallbackResult.outputs,
      ]),
    };
  };
  if (executionProfile === "extractable_text_pdf") {
    if (input.onProgress) {
      await input.onProgress("extracting_statements", [
        combinedStageGate.skip || prefersRequiredStagesFirst
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
    const deterministicStatementsFallback =
      runtimeMode === "ai_overdrive"
        ? buildDeterministicStatementsFallbackV1({
            document: input.document,
            statementRanges: statementsFocusRanges,
          })
        : { ok: false as const };
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
        useResponseJsonSchema: false,
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
        shouldRunAssetsFollowUp =
          taxNotesAssetsFocusRanges.length > 0 && !hasAssetsContentV1(merged);
        shouldRunFinanceFollowUp =
          taxNotesFinanceFocusRanges.length > 0 && !hasFinanceContentV1(merged);
        warnings.push(
          `combined_extractable.follow_up_required=${shouldRunStatementsFollowUp || shouldRunAssetsFollowUp || shouldRunFinanceFollowUp ? 1 : 0} statements=${shouldRunStatementsFollowUp ? 1 : 0} assets=${shouldRunAssetsFollowUp ? 1 : 0} finance=${shouldRunFinanceFollowUp ? 1 : 0}`,
        );
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
      if (deterministicStatementsFallback.ok) {
        taxDeep.ink2rExtracted = deterministicStatementsFallback.ink2rExtracted;
        taxDeep.priorYearComparatives =
          deterministicStatementsFallback.priorYearComparatives;
        warnings.push(
          `statements.skipped=deterministic_extractable_pdf_rebuild income_rows=${deterministicStatementsFallback.metrics.incomeRows} income_values=${deterministicStatementsFallback.metrics.incomeValues} balance_rows=${deterministicStatementsFallback.metrics.balanceRows} balance_values=${deterministicStatementsFallback.metrics.balanceValues}`,
        );
      } else {
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
          useResponseJsonSchema: false,
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
    }

    if (input.onProgress) {
      await input.onProgress("extracting_tax_notes", [
        "progress.stage=extracting_tax_notes",
      ]);
    }
    await runTaxExpenseNoteV1();
    await runRelevantNotesCatalogV1();

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
        useResponseJsonSchema: false,
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
        mergeAssetsContextIntoTaxDeepV1({
          taxDeep,
          next: merged,
        });
      } else {
        const stageError = formatAnnualReportStageErrorV1({
          stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesAssets,
          error: assetsResult.error,
        });
        warnings.push(`degraded.tax_notes_assets.unavailable:${stageError.message}`);
      }
    }

    if (shouldRunFinanceFollowUp) {
      const financeResult = await executeFinanceNotesStageV1({
        primaryModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
        fallbackModelTier: resolveAnnualReportModelTierV1({
          preferred: "fast",
          runtimeMode,
        }),
      });

      if (financeResult.ok) {
        mergeFinanceContextIntoTaxDeepV1({
          taxDeep,
          next: financeResult.output,
        });
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
    await runTaxExpenseNoteV1();
    await runRelevantNotesCatalogV1();

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

    const financeResult = await executeFinanceNotesStageV1({
      primaryModelTier: "fast",
      fallbackModelTier: resolveAnnualReportModelTierV1({
        preferred: "thinking",
        runtimeMode,
      }),
    });

    if (financeResult.ok) {
      taxDeep.netInterestContext = financeResult.output.netInterestContext;
      taxDeep.pensionContext = financeResult.output.pensionContext;
      taxDeep.leasingContext = financeResult.output.leasingContext;
      taxDeep.groupContributionContext =
        financeResult.output.groupContributionContext;
      taxDeep.shareholdingContext = financeResult.output.shareholdingContext;

      if (
        financeResult.output.taxExpenseContext &&
        (!taxDeep.taxExpenseContext || taxDeep.taxExpenseContext.notes.length === 0)
      ) {
        taxDeep.taxExpenseContext = financeResult.output.taxExpenseContext;
      }
    } else {
      const stageError = formatAnnualReportStageErrorV1({
        stage: ANNUAL_REPORT_STAGE_LABELS_V1.taxNotesFinance,
        error: financeResult.error,
      });
      warnings.push(`degraded.tax_notes_finance.unavailable:${stageError.message}`);
    }
  }
  backfillRelevantNoteContextsV1({
    taxDeep,
  });
  fillMissingTaxExpenseValuesFromContextV1({
    taxDeep,
  });

  const sanitizedTaxDeep = sanitizeFinalTaxDeepForContractV1(taxDeep);
  const finalCoreFacts = applyProfitBeforeTaxStatementFallbackV1({
    coreFacts,
    taxDeep: sanitizedTaxDeep,
    warnings,
  });
  const finalOutput = AnnualReportAiExtractionResultV1Schema.parse({
    schemaVersion: "annual_report_ai_extraction_v1",
    fields: finalCoreFacts.fields,
    taxSignals: finalCoreFacts.taxSignals,
    documentWarnings: [...new Set(warnings)],
    taxDeep: sanitizedTaxDeep,
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
      provider: "qwen",
      model: selectedModelName,
      modelTier: input.config.moduleSpec.runtime.modelTier,
      generatedAt: input.generatedAt,
      usedFallback: warnings.some((warning) =>
        warning.includes("fallback") || warning.startsWith("degraded."),
      ),
    }),
  };
}
