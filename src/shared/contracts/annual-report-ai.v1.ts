import { z } from "zod";

import {
  AnnualReportAccountingStandardV1Schema,
  AnnualReportAmountUnitV1Schema,
  AnnualReportTaxDeepExtractionV1Schema,
} from "./annual-report-extraction.v1";

function createAiSchemaVersionV1<TSchemaVersion extends string>(
  schemaVersion: TSchemaVersion,
) {
  return z.literal(schemaVersion).catch(schemaVersion);
}

function normalizeOptionalTextV1(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNumberV1(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const normalized = trimmed.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalPositiveIntegerV1(value: unknown): number | undefined {
  const parsed = normalizeOptionalNumberV1(value);
  if (parsed === undefined || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function normalizeBooleanV1(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function normalizeArrayInputV1(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function normalizeObjectInputV1(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeAccountingStandardV1(value: unknown): "K2" | "K3" | undefined {
  const normalized = normalizeOptionalTextV1(value)?.toUpperCase();
  if (normalized === "K2" || normalized === "K3") {
    return normalized;
  }

  return undefined;
}

function normalizeAmountUnitV1(value: unknown): "sek" | "ksek" | "msek" | undefined {
  const normalized = normalizeOptionalTextV1(value)?.toLowerCase();
  if (normalized === "sek" || normalized === "ksek" || normalized === "msek") {
    return normalized;
  }

  return undefined;
}

function createLooseArraySchemaV1<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.preprocess(
    normalizeArrayInputV1,
    z.array(schema).default([]),
  );
}

function createLooseObjectSchemaV1<TShape extends z.ZodRawShape>(shape: TShape) {
  return z.preprocess(
    normalizeObjectInputV1,
    z.object(shape).passthrough(),
  );
}

const AnnualReportAiFieldCandidateShapeV1 = {
  status: z.enum(["extracted", "needs_review"]).catch("needs_review"),
  confidence: z.preprocess(
    normalizeOptionalNumberV1,
    z.number().min(0).max(1).optional(),
  ),
  valueText: z.preprocess(
    normalizeOptionalTextV1,
    z.string().trim().min(1).optional(),
  ),
  snippet: z.preprocess(
    normalizeOptionalTextV1,
    z.string().trim().min(1).optional(),
  ),
  page: z.preprocess(
    normalizeOptionalPositiveIntegerV1,
    z.number().int().positive().optional(),
  ),
} satisfies z.ZodRawShape;

function createAiFieldCandidateSchemaV1<TShape extends z.ZodRawShape = {}>(
  extraShape?: TShape,
) {
  return createLooseObjectSchemaV1({
    ...AnnualReportAiFieldCandidateShapeV1,
    ...(extraShape ?? {}),
  }).transform((value) => ({
    status: value.status,
    confidence: value.confidence ?? 0,
    valueText: value.valueText,
    snippet: value.snippet,
    page: value.page,
  }));
}

function normalizeFieldCandidateBaseV1(value: {
  status: "extracted" | "needs_review";
  confidence?: number;
  valueText?: string;
  snippet?: string;
  page?: number;
}) {
  return {
    status: value.status,
    confidence: value.confidence ?? 0,
    valueText: value.valueText,
    snippet: value.snippet,
    page: value.page,
  };
}

const AnnualReportAiEvidenceReferenceV1Schema = createLooseObjectSchemaV1({
    snippet: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    section: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    noteReference: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    page: z.preprocess(
      normalizeOptionalPositiveIntegerV1,
      z.number().int().positive().optional(),
    ),
  })
  .transform((value) => ({
    snippet: value.snippet ?? "Source evidence unavailable.",
    section: value.section,
    noteReference: value.noteReference,
    page: value.page,
  }));

const AnnualReportAiStatementLineV1Schema = createLooseObjectSchemaV1({
    code: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    label: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    currentYearValue: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    priorYearValue: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  })
  .transform((value) => ({
    code:
      value.code ??
      value.label ??
      "unclassified_line",
    label: value.label ?? value.code ?? "Unknown line",
    currentYearValue: value.currentYearValue,
    priorYearValue: value.priorYearValue,
    evidence: value.evidence,
  }));

const AnnualReportAiValueWithEvidenceV1Schema = createLooseObjectSchemaV1({
    value: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    currency: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });

const AnnualReportAiTaxExpenseContextV1Schema = createLooseObjectSchemaV1({
    currentTax: AnnualReportAiValueWithEvidenceV1Schema.optional(),
    deferredTax: AnnualReportAiValueWithEvidenceV1Schema.optional(),
    totalTaxExpense: AnnualReportAiValueWithEvidenceV1Schema.optional(),
    notes: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });

const AnnualReportAiNarrativeFlagV1Schema = createLooseObjectSchemaV1({
    code: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    label: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    value: z.preprocess(normalizeBooleanV1, z.boolean().optional()),
    notes: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  })
  .transform((value) => ({
    code: value.code ?? value.label ?? "unspecified_flag",
    label: value.label ?? value.code ?? "Unspecified flag",
    value: value.value,
    notes: value.notes,
    evidence: value.evidence,
  }));

const AnnualReportAiAssetMovementLineV1Schema = createLooseObjectSchemaV1({
    assetArea: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    openingCarryingAmount: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    acquisitions: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    disposals: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    depreciationForYear: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    impairmentForYear: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    closingCarryingAmount: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    priorYearOpeningCarryingAmount: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    priorYearClosingCarryingAmount: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  })
  .transform((value) => ({
    assetArea: value.assetArea ?? "Unspecified asset area",
    openingCarryingAmount: value.openingCarryingAmount,
    acquisitions: value.acquisitions,
    disposals: value.disposals,
    depreciationForYear: value.depreciationForYear,
    impairmentForYear: value.impairmentForYear,
    closingCarryingAmount: value.closingCarryingAmount,
    priorYearOpeningCarryingAmount: value.priorYearOpeningCarryingAmount,
    priorYearClosingCarryingAmount: value.priorYearClosingCarryingAmount,
    evidence: value.evidence,
  }));

const AnnualReportAiReserveMovementLineV1Schema = createLooseObjectSchemaV1({
    reserveType: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    openingBalance: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    movementForYear: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    closingBalance: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    priorYearClosingBalance: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  })
  .transform((value) => ({
    reserveType: value.reserveType ?? "Unspecified reserve",
    openingBalance: value.openingBalance,
    movementForYear: value.movementForYear,
    closingBalance: value.closingBalance,
    priorYearClosingBalance: value.priorYearClosingBalance,
    evidence: value.evidence,
  }));

const AnnualReportAiPriorYearComparativeV1Schema = createLooseObjectSchemaV1({
    area: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    code: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    label: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    currentYearValue: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    priorYearValue: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  })
  .transform((value) => ({
    area: value.area ?? "unspecified_area",
    code: value.code ?? value.label ?? "unclassified_line",
    label: value.label ?? value.code ?? "Unknown line",
    currentYearValue: value.currentYearValue,
    priorYearValue: value.priorYearValue,
    evidence: value.evidence,
  }));

export const AnnualReportAiFieldKeyV1Schema = z.enum([
  "companyName",
  "organizationNumber",
  "fiscalYearStart",
  "fiscalYearEnd",
  "accountingStandard",
  "profitBeforeTax",
]);
export type AnnualReportAiFieldKeyV1 = z.infer<
  typeof AnnualReportAiFieldKeyV1Schema
>;

export const AnnualReportAiFieldCandidateV1Schema =
  createAiFieldCandidateSchemaV1();
export type AnnualReportAiFieldCandidateV1 = z.infer<
  typeof AnnualReportAiFieldCandidateV1Schema
>;

export const AnnualReportTaxSignalV1Schema = z
  .object({
    code: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    label: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    confidence: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().min(0).max(1).optional(),
    ),
    snippet: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    section: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    noteReference: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
    page: z.preprocess(
      normalizeOptionalPositiveIntegerV1,
      z.number().int().positive().optional(),
    ),
    reviewFlag: z.preprocess(normalizeBooleanV1, z.boolean().optional()),
    policyRuleReference: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  })
  .passthrough()
  .transform((value) => ({
    code: value.code ?? "unspecified_signal",
    label: value.label ?? value.code ?? "Unspecified signal",
    confidence: value.confidence ?? 0,
    snippet: value.snippet,
    section: value.section,
    noteReference: value.noteReference,
    page: value.page,
    reviewFlag: value.reviewFlag ?? true,
    policyRuleReference:
      value.policyRuleReference ?? "annual-report-ai.unspecified-signal.v1",
  }));
export type AnnualReportTaxSignalV1 = z.infer<
  typeof AnnualReportTaxSignalV1Schema
>;

export const AnnualReportAiSectionLocatorRangeV1Schema = createLooseObjectSchemaV1({
    startPage: z.preprocess(
      normalizeOptionalPositiveIntegerV1,
      z.number().int().positive().optional(),
    ),
    endPage: z.preprocess(
      normalizeOptionalPositiveIntegerV1,
      z.number().int().positive().optional(),
    ),
    confidence: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().min(0).max(1).optional(),
    ),
  })
  .transform((value) => {
    const startPage = value.startPage ?? value.endPage ?? 1;
    const endPage = value.endPage ?? value.startPage ?? startPage;
    return {
      startPage,
      endPage: endPage >= startPage ? endPage : startPage,
      confidence: value.confidence ?? 0,
    };
  });
export type AnnualReportAiSectionLocatorRangeV1 = z.infer<
  typeof AnnualReportAiSectionLocatorRangeV1Schema
>;

export const AnnualReportAiSectionLocatorResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_section_locator_v1"),
    sections: createLooseObjectSchemaV1({
        coreFacts: createLooseArraySchemaV1(AnnualReportAiSectionLocatorRangeV1Schema),
        incomeStatement: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
        balanceSheet: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
        taxExpense: createLooseArraySchemaV1(AnnualReportAiSectionLocatorRangeV1Schema),
        depreciationAndAssets: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
        reserves: createLooseArraySchemaV1(AnnualReportAiSectionLocatorRangeV1Schema),
        financeAndInterest: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
        pensionsAndLeasing: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
        groupContributionsAndShareholdings: createLooseArraySchemaV1(
          AnnualReportAiSectionLocatorRangeV1Schema,
        ),
      }),
    documentWarnings: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiSectionLocatorResultV1 = z.infer<
  typeof AnnualReportAiSectionLocatorResultV1Schema
>;

const AnnualReportAiCoreFieldsV1Schema = createLooseObjectSchemaV1({
  companyName: createAiFieldCandidateSchemaV1(),
  organizationNumber: createAiFieldCandidateSchemaV1(),
  fiscalYearStart: createLooseObjectSchemaV1({
    ...AnnualReportAiFieldCandidateShapeV1,
    normalizedValue: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  }).transform((value) => ({
    ...normalizeFieldCandidateBaseV1(value),
    normalizedValue: value.normalizedValue,
  })),
  fiscalYearEnd: createLooseObjectSchemaV1({
    ...AnnualReportAiFieldCandidateShapeV1,
    normalizedValue: z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  }).transform((value) => ({
    ...normalizeFieldCandidateBaseV1(value),
    normalizedValue: value.normalizedValue,
  })),
  accountingStandard: createLooseObjectSchemaV1({
    ...AnnualReportAiFieldCandidateShapeV1,
    normalizedValue: z.preprocess(
      normalizeAccountingStandardV1,
      AnnualReportAccountingStandardV1Schema.optional(),
    ),
  }).transform((value) => ({
    ...normalizeFieldCandidateBaseV1(value),
    normalizedValue: value.normalizedValue,
  })),
  profitBeforeTax: createLooseObjectSchemaV1({
    ...AnnualReportAiFieldCandidateShapeV1,
    normalizedValue: z.preprocess(
      normalizeOptionalNumberV1,
      z.number().finite().optional(),
    ),
  }).transform((value) => ({
    ...normalizeFieldCandidateBaseV1(value),
    normalizedValue: value.normalizedValue,
  })),
});

const AnnualReportAiStatementsExtractedV1Schema = createLooseObjectSchemaV1({
  statementUnit: z.preprocess(
    normalizeAmountUnitV1,
    AnnualReportAmountUnitV1Schema.optional(),
  ),
  incomeStatement: createLooseArraySchemaV1(AnnualReportAiStatementLineV1Schema),
  balanceSheet: createLooseArraySchemaV1(AnnualReportAiStatementLineV1Schema),
});

const AnnualReportAiDepreciationContextV1Schema = createLooseObjectSchemaV1({
  assetAreas: createLooseArraySchemaV1(AnnualReportAiAssetMovementLineV1Schema),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiAssetMovementsContextV1Schema = createLooseObjectSchemaV1({
  lines: createLooseArraySchemaV1(AnnualReportAiAssetMovementLineV1Schema),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiReserveContextV1Schema = createLooseObjectSchemaV1({
  movements: createLooseArraySchemaV1(AnnualReportAiReserveMovementLineV1Schema),
  notes: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiNetInterestContextV1Schema = createLooseObjectSchemaV1({
  financeIncome: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  financeExpense: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  interestIncome: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  interestExpense: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  netInterest: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  notes: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiPensionContextV1Schema = createLooseObjectSchemaV1({
  specialPayrollTax: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  flags: createLooseArraySchemaV1(AnnualReportAiNarrativeFlagV1Schema),
  notes: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiFlaggedNarrativeContextV1Schema = createLooseObjectSchemaV1({
  flags: createLooseArraySchemaV1(AnnualReportAiNarrativeFlagV1Schema),
  notes: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

const AnnualReportAiShareholdingContextV1Schema = createLooseObjectSchemaV1({
  dividendsReceived: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  dividendsPaid: AnnualReportAiValueWithEvidenceV1Schema.optional(),
  flags: createLooseArraySchemaV1(AnnualReportAiNarrativeFlagV1Schema),
  notes: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});

export const AnnualReportAiCoreExtractionResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_core_extraction_v1",
    ),
    fields: AnnualReportAiCoreFieldsV1Schema,
    taxSignals: createLooseArraySchemaV1(AnnualReportTaxSignalV1Schema),
    documentWarnings: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
  });
export type AnnualReportAiCoreExtractionResultV1 = z.infer<
  typeof AnnualReportAiCoreExtractionResultV1Schema
>;

export const AnnualReportAiCoreFactsResultV1Schema = createLooseObjectSchemaV1({
  schemaVersion: createAiSchemaVersionV1("annual_report_ai_core_facts_v1"),
  fields: AnnualReportAiCoreFieldsV1Schema,
  taxSignals: createLooseArraySchemaV1(AnnualReportTaxSignalV1Schema),
  documentWarnings: createLooseArraySchemaV1(
    z.preprocess(
      normalizeOptionalTextV1,
      z.string().trim().min(1).optional(),
    ),
  ).transform((values) =>
    values.filter((value): value is string => typeof value === "string"),
  ),
});
export type AnnualReportAiCoreFactsResultV1 = z.infer<
  typeof AnnualReportAiCoreFactsResultV1Schema
>;

export const AnnualReportAiCoreFinancialsResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_core_financials_v1",
    ),
    fields: AnnualReportAiCoreFieldsV1Schema,
    taxSignals: createLooseArraySchemaV1(AnnualReportTaxSignalV1Schema),
    documentWarnings: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    ink2rExtracted: AnnualReportAiStatementsExtractedV1Schema,
    priorYearComparatives: createLooseArraySchemaV1(
      AnnualReportAiPriorYearComparativeV1Schema,
    ),
    taxExpenseContext: AnnualReportAiTaxExpenseContextV1Schema.optional(),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiCoreFinancialsResultV1 = z.infer<
  typeof AnnualReportAiCoreFinancialsResultV1Schema
>;

export const AnnualReportAiStatementsResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_statements_v1"),
    ink2rExtracted: AnnualReportAiStatementsExtractedV1Schema,
    priorYearComparatives: createLooseArraySchemaV1(
      AnnualReportAiPriorYearComparativeV1Schema,
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiStatementsResultV1 = z.infer<
  typeof AnnualReportAiStatementsResultV1Schema
>;

export const AnnualReportAiStatementsOnlyResultV1Schema =
  createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_statements_only_v1",
    ),
    ink2rExtracted: AnnualReportAiStatementsExtractedV1Schema,
    priorYearComparatives: createLooseArraySchemaV1(
      AnnualReportAiPriorYearComparativeV1Schema,
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiStatementsOnlyResultV1 = z.infer<
  typeof AnnualReportAiStatementsOnlyResultV1Schema
>;

export const AnnualReportAiMovementsResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_movements_v1"),
    depreciationContext: AnnualReportAiDepreciationContextV1Schema,
    assetMovements: AnnualReportAiAssetMovementsContextV1Schema,
    reserveContext: AnnualReportAiReserveContextV1Schema,
  });
export type AnnualReportAiMovementsResultV1 = z.infer<
  typeof AnnualReportAiMovementsResultV1Schema
>;

export const AnnualReportAiNarrativeResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_narrative_v1"),
    netInterestContext: AnnualReportAiNetInterestContextV1Schema,
    pensionContext: AnnualReportAiPensionContextV1Schema,
    taxExpenseContext: AnnualReportAiTaxExpenseContextV1Schema.optional(),
    leasingContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    groupContributionContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    shareholdingContext: AnnualReportAiShareholdingContextV1Schema,
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiNarrativeResultV1 = z.infer<
  typeof AnnualReportAiNarrativeResultV1Schema
>;

export const AnnualReportAiNoteContextResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_note_context_v1"),
    depreciationContext: AnnualReportAiDepreciationContextV1Schema,
    assetMovements: AnnualReportAiAssetMovementsContextV1Schema,
    reserveContext: AnnualReportAiReserveContextV1Schema,
    netInterestContext: AnnualReportAiNetInterestContextV1Schema,
    pensionContext: AnnualReportAiPensionContextV1Schema,
    leasingContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    groupContributionContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    shareholdingContext: AnnualReportAiShareholdingContextV1Schema,
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiNoteContextResultV1 = z.infer<
  typeof AnnualReportAiNoteContextResultV1Schema
>;

export const AnnualReportAiTaxNotesAssetsAndReservesResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_tax_notes_assets_reserves_v1",
    ),
    depreciationContext: AnnualReportAiDepreciationContextV1Schema,
    assetMovements: AnnualReportAiAssetMovementsContextV1Schema,
    reserveContext: AnnualReportAiReserveContextV1Schema,
    taxExpenseContext: AnnualReportAiTaxExpenseContextV1Schema.optional(),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiTaxNotesAssetsAndReservesResultV1 = z.infer<
  typeof AnnualReportAiTaxNotesAssetsAndReservesResultV1Schema
>;

export const AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_tax_notes_finance_other_v1",
    ),
    netInterestContext: AnnualReportAiNetInterestContextV1Schema,
    pensionContext: AnnualReportAiPensionContextV1Schema,
    leasingContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    groupContributionContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    shareholdingContext: AnnualReportAiShareholdingContextV1Schema,
    taxExpenseContext: AnnualReportAiTaxExpenseContextV1Schema.optional(),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiTaxNotesFinanceAndOtherResultV1 = z.infer<
  typeof AnnualReportAiTaxNotesFinanceAndOtherResultV1Schema
>;

export const AnnualReportAiCombinedTextExtractionResultV1Schema =
  createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1(
      "annual_report_ai_combined_text_extraction_v1",
    ),
    documentWarnings: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    ink2rExtracted: AnnualReportAiStatementsExtractedV1Schema,
    priorYearComparatives: createLooseArraySchemaV1(
      AnnualReportAiPriorYearComparativeV1Schema,
    ),
    depreciationContext: AnnualReportAiDepreciationContextV1Schema,
    assetMovements: AnnualReportAiAssetMovementsContextV1Schema,
    reserveContext: AnnualReportAiReserveContextV1Schema,
    netInterestContext: AnnualReportAiNetInterestContextV1Schema,
    pensionContext: AnnualReportAiPensionContextV1Schema,
    leasingContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    groupContributionContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
    shareholdingContext: AnnualReportAiShareholdingContextV1Schema,
    taxExpenseContext: AnnualReportAiTaxExpenseContextV1Schema.optional(),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
  });
export type AnnualReportAiCombinedTextExtractionResultV1 = z.infer<
  typeof AnnualReportAiCombinedTextExtractionResultV1Schema
>;

export const AnnualReportAiTaxNotesResultV1Schema = createLooseObjectSchemaV1({
  schemaVersion: createAiSchemaVersionV1("annual_report_ai_tax_notes_v1"),
  depreciationContext: AnnualReportAiDepreciationContextV1Schema,
  assetMovements: AnnualReportAiAssetMovementsContextV1Schema,
  reserveContext: AnnualReportAiReserveContextV1Schema,
  netInterestContext: AnnualReportAiNetInterestContextV1Schema,
  pensionContext: AnnualReportAiPensionContextV1Schema,
  leasingContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
  groupContributionContext: AnnualReportAiFlaggedNarrativeContextV1Schema,
  shareholdingContext: AnnualReportAiShareholdingContextV1Schema,
  evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
});
export type AnnualReportAiTaxNotesResultV1 = z.infer<
  typeof AnnualReportAiTaxNotesResultV1Schema
>;

export const AnnualReportAiExtractionResultV1Schema = createLooseObjectSchemaV1({
    schemaVersion: createAiSchemaVersionV1("annual_report_ai_extraction_v1"),
    fields: AnnualReportAiCoreFieldsV1Schema,
    taxSignals: createLooseArraySchemaV1(AnnualReportTaxSignalV1Schema),
    documentWarnings: createLooseArraySchemaV1(
      z.preprocess(
        normalizeOptionalTextV1,
        z.string().trim().min(1).optional(),
      ),
    ).transform((values) =>
      values.filter((value): value is string => typeof value === "string"),
    ),
    evidence: createLooseArraySchemaV1(AnnualReportAiEvidenceReferenceV1Schema),
    taxDeep: AnnualReportTaxDeepExtractionV1Schema,
  });
export type AnnualReportAiExtractionResultV1 = z.infer<
  typeof AnnualReportAiExtractionResultV1Schema
>;

export function parseAnnualReportAiExtractionResultV1(
  input: unknown,
): AnnualReportAiExtractionResultV1 {
  return AnnualReportAiExtractionResultV1Schema.parse(input);
}
