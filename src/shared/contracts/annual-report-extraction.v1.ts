import { z } from "zod";

import { AiRunMetadataV1Schema } from "./ai-run.v1";
import { IsoDateSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

export const AnnualReportFileTypeV1Schema = z.enum(["pdf", "docx"]);
export type AnnualReportFileTypeV1 = z.infer<
  typeof AnnualReportFileTypeV1Schema
>;

export const AnnualReportAccountingStandardV1Schema = z.enum(["K2", "K3"]);
export type AnnualReportAccountingStandardV1 = z.infer<
  typeof AnnualReportAccountingStandardV1Schema
>;

export const AnnualReportAmountUnitV1Schema = z.enum(["sek", "ksek", "msek"]);
export type AnnualReportAmountUnitV1 = z.infer<
  typeof AnnualReportAmountUnitV1Schema
>;

export const AnnualReportRuntimeMetadataV1Schema = z
  .object({
    extractionEngineVersion: z.string().trim().min(1),
    runtimeFingerprint: z.string().trim().min(1),
  })
  .strict();
export type AnnualReportRuntimeMetadataV1 = z.infer<
  typeof AnnualReportRuntimeMetadataV1Schema
>;

export const AnnualReportExtractionFieldStatusV1Schema = z.enum([
  "extracted",
  "needs_review",
  "manual",
]);
export type AnnualReportExtractionFieldStatusV1 = z.infer<
  typeof AnnualReportExtractionFieldStatusV1Schema
>;

export const AnnualReportExtractionFieldKeyV1Schema = z.enum([
  "companyName",
  "organizationNumber",
  "fiscalYearStart",
  "fiscalYearEnd",
  "accountingStandard",
  "profitBeforeTax",
]);
export type AnnualReportExtractionFieldKeyV1 = z.infer<
  typeof AnnualReportExtractionFieldKeyV1Schema
>;

export const AnnualReportFieldSourceSnippetV1Schema = z
  .object({
    snippet: z.string().trim().min(1),
    page: z.number().int().positive().optional(),
  })
  .strict();
export type AnnualReportFieldSourceSnippetV1 = z.infer<
  typeof AnnualReportFieldSourceSnippetV1Schema
>;

export const AnnualReportEvidenceReferenceV1Schema = z
  .object({
    snippet: z.string().trim().min(1),
    section: z.string().trim().min(1).optional(),
    noteReference: z.string().trim().min(1).optional(),
    page: z.number().int().positive().optional(),
  })
  .strict();
export type AnnualReportEvidenceReferenceV1 = z.infer<
  typeof AnnualReportEvidenceReferenceV1Schema
>;

export const AnnualReportRelevantNoteCategoryV1Schema = z.enum([
  "fixed_assets_depreciation",
  "interest",
  "pension",
  "tax_expense",
  "reserve",
  "leasing",
  "group_contributions",
  "shareholdings_dividends",
  "provisions_contingencies",
  "related_party_intragroup",
  "restructuring_mergers",
  "deferred_tax_loss_carryforwards",
  "impairments_write_downs",
]);
export type AnnualReportRelevantNoteCategoryV1 = z.infer<
  typeof AnnualReportRelevantNoteCategoryV1Schema
>;

export const AnnualReportRelevantNoteV1Schema = z
  .object({
    category: AnnualReportRelevantNoteCategoryV1Schema,
    title: z.string().trim().min(1).optional(),
    noteReference: z.string().trim().min(1).optional(),
    pages: z.array(z.number().int().positive()).default([]),
    notes: z.array(z.string().trim().min(1)).default([]),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportRelevantNoteV1 = z.infer<
  typeof AnnualReportRelevantNoteV1Schema
>;

export const AnnualReportStatementLineV1Schema = z
  .object({
    code: z.string().trim().min(1),
    label: z.string().trim().min(1),
    currentYearValue: z.number().finite().optional(),
    priorYearValue: z.number().finite().optional(),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportStatementLineV1 = z.infer<
  typeof AnnualReportStatementLineV1Schema
>;

export const AnnualReportValueWithEvidenceV1Schema = z
  .object({
    value: z.number().finite().optional(),
    currency: z.string().trim().min(1).optional(),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportValueWithEvidenceV1 = z.infer<
  typeof AnnualReportValueWithEvidenceV1Schema
>;

export const AnnualReportTaxExpenseContextV1Schema = z
  .object({
    currentTax: AnnualReportValueWithEvidenceV1Schema.optional(),
    deferredTax: AnnualReportValueWithEvidenceV1Schema.optional(),
    totalTaxExpense: AnnualReportValueWithEvidenceV1Schema.optional(),
    notes: z.array(z.string().trim().min(1)).default([]),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportTaxExpenseContextV1 = z.infer<
  typeof AnnualReportTaxExpenseContextV1Schema
>;

export const AnnualReportNarrativeFlagV1Schema = z
  .object({
    code: z.string().trim().min(1),
    label: z.string().trim().min(1),
    value: z.boolean().optional(),
    notes: z.array(z.string().trim().min(1)).default([]),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportNarrativeFlagV1 = z.infer<
  typeof AnnualReportNarrativeFlagV1Schema
>;

export const AnnualReportAssetMovementLineV1Schema = z
  .object({
    assetArea: z.string().trim().min(1),
    openingCarryingAmount: z.number().finite().optional(),
    acquisitions: z.number().finite().optional(),
    disposals: z.number().finite().optional(),
    depreciationForYear: z.number().finite().optional(),
    impairmentForYear: z.number().finite().optional(),
    closingCarryingAmount: z.number().finite().optional(),
    priorYearOpeningCarryingAmount: z.number().finite().optional(),
    priorYearClosingCarryingAmount: z.number().finite().optional(),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportAssetMovementLineV1 = z.infer<
  typeof AnnualReportAssetMovementLineV1Schema
>;

export const AnnualReportReserveMovementLineV1Schema = z
  .object({
    reserveType: z.string().trim().min(1),
    openingBalance: z.number().finite().optional(),
    movementForYear: z.number().finite().optional(),
    closingBalance: z.number().finite().optional(),
    priorYearClosingBalance: z.number().finite().optional(),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportReserveMovementLineV1 = z.infer<
  typeof AnnualReportReserveMovementLineV1Schema
>;

export const AnnualReportPriorYearComparativeV1Schema = z
  .object({
    area: z.string().trim().min(1),
    code: z.string().trim().min(1),
    label: z.string().trim().min(1),
    currentYearValue: z.number().finite().optional(),
    priorYearValue: z.number().finite().optional(),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportPriorYearComparativeV1 = z.infer<
  typeof AnnualReportPriorYearComparativeV1Schema
>;

export const AnnualReportTaxDeepExtractionV1Schema = z
  .object({
    ink2rExtracted: z
      .object({
        statementUnit: AnnualReportAmountUnitV1Schema.optional(),
        incomeStatement: z.array(AnnualReportStatementLineV1Schema).default([]),
        balanceSheet: z.array(AnnualReportStatementLineV1Schema).default([]),
      })
      .strict(),
    depreciationContext: z
      .object({
        assetAreas: z.array(AnnualReportAssetMovementLineV1Schema).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    assetMovements: z
      .object({
        lines: z.array(AnnualReportAssetMovementLineV1Schema).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    reserveContext: z
      .object({
        movements: z.array(AnnualReportReserveMovementLineV1Schema).default([]),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    netInterestContext: z
      .object({
        financeIncome: AnnualReportValueWithEvidenceV1Schema.optional(),
        financeExpense: AnnualReportValueWithEvidenceV1Schema.optional(),
        interestIncome: AnnualReportValueWithEvidenceV1Schema.optional(),
        interestExpense: AnnualReportValueWithEvidenceV1Schema.optional(),
        netInterest: AnnualReportValueWithEvidenceV1Schema.optional(),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    pensionContext: z
      .object({
        specialPayrollTax: AnnualReportValueWithEvidenceV1Schema.optional(),
        flags: z.array(AnnualReportNarrativeFlagV1Schema).default([]),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    taxExpenseContext: AnnualReportTaxExpenseContextV1Schema.optional(),
    leasingContext: z
      .object({
        flags: z.array(AnnualReportNarrativeFlagV1Schema).default([]),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    groupContributionContext: z
      .object({
        flags: z.array(AnnualReportNarrativeFlagV1Schema).default([]),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    shareholdingContext: z
      .object({
        dividendsReceived: AnnualReportValueWithEvidenceV1Schema.optional(),
        dividendsPaid: AnnualReportValueWithEvidenceV1Schema.optional(),
        flags: z.array(AnnualReportNarrativeFlagV1Schema).default([]),
        notes: z.array(z.string().trim().min(1)).default([]),
        evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
      })
      .strict(),
    relevantNotes: z.array(AnnualReportRelevantNoteV1Schema).optional(),
    priorYearComparatives: z
      .array(AnnualReportPriorYearComparativeV1Schema)
      .default([]),
  })
  .strict();
export type AnnualReportTaxDeepExtractionV1 = z.infer<
  typeof AnnualReportTaxDeepExtractionV1Schema
>;

const AnnualReportFieldMetaV1Schema = z
  .object({
    status: AnnualReportExtractionFieldStatusV1Schema,
    confidence: z.number().min(0).max(1),
    sourceSnippet: AnnualReportFieldSourceSnippetV1Schema.optional(),
  })
  .strict();

export const AnnualReportStringFieldV1Schema = z
  .object({
    value: z.string().trim().min(1).optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportStringFieldV1 = z.infer<
  typeof AnnualReportStringFieldV1Schema
>;

export const AnnualReportDateFieldV1Schema = z
  .object({
    value: IsoDateSchema.optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportDateFieldV1 = z.infer<
  typeof AnnualReportDateFieldV1Schema
>;

export const AnnualReportEnumFieldV1Schema = z
  .object({
    value: AnnualReportAccountingStandardV1Schema.optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportEnumFieldV1 = z.infer<
  typeof AnnualReportEnumFieldV1Schema
>;

export const AnnualReportNumberFieldV1Schema = z
  .object({
    value: z.number().finite().optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportNumberFieldV1 = z.infer<
  typeof AnnualReportNumberFieldV1Schema
>;

export const AnnualReportExtractionPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_extraction_v1"),
    sourceFileName: z.string().trim().min(1),
    sourceFileType: AnnualReportFileTypeV1Schema,
    policyVersion: z.string().trim().min(1),
    fields: z
      .object({
        companyName: AnnualReportStringFieldV1Schema,
        organizationNumber: AnnualReportStringFieldV1Schema,
        fiscalYearStart: AnnualReportDateFieldV1Schema,
        fiscalYearEnd: AnnualReportDateFieldV1Schema,
        accountingStandard: AnnualReportEnumFieldV1Schema,
        profitBeforeTax: AnnualReportNumberFieldV1Schema,
      })
      .strict(),
    summary: z
      .object({
        autoDetectedFieldCount: z.number().int().nonnegative(),
        needsReviewFieldCount: z.number().int().nonnegative(),
      })
      .strict(),
    taxSignals: z
      .array(
        z
          .object({
            code: z.string().trim().min(1),
            label: z.string().trim().min(1),
            confidence: z.number().min(0).max(1),
            snippet: z.string().trim().min(1).optional(),
            section: z.string().trim().min(1).optional(),
            noteReference: z.string().trim().min(1).optional(),
            page: z.number().int().positive().optional(),
            reviewFlag: z.boolean(),
            policyRuleReference: z.string().trim().min(1),
          })
          .strict(),
      )
      .default([]),
    documentWarnings: z.array(z.string().trim().min(1)).default([]),
    taxDeep: AnnualReportTaxDeepExtractionV1Schema.optional(),
    engineMetadata: AnnualReportRuntimeMetadataV1Schema.optional(),
    aiRun: AiRunMetadataV1Schema.optional(),
    confirmation: z
      .object({
        isConfirmed: z.boolean(),
        confirmedAt: IsoDateTimeSchema.optional(),
        confirmedByUserId: UuidV4Schema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.confirmation.isConfirmed) {
      return;
    }

    if (!value.confirmation.confirmedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmedAt is required when extraction is confirmed.",
        path: ["confirmation", "confirmedAt"],
      });
    }
    if (!value.confirmation.confirmedByUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmedByUserId is required when extraction is confirmed.",
        path: ["confirmation", "confirmedByUserId"],
      });
    }
  });
export type AnnualReportExtractionPayloadV1 = z.infer<
  typeof AnnualReportExtractionPayloadV1Schema
>;

export const ActiveAnnualReportExtractionRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("annual_report_extraction_v1"),
  })
  .strict();
export type ActiveAnnualReportExtractionRefV1 = z.infer<
  typeof ActiveAnnualReportExtractionRefV1Schema
>;

export const RunAnnualReportExtractionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileType: AnnualReportFileTypeV1Schema.optional(),
    fileBytesBase64: z.string().trim().min(1),
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type RunAnnualReportExtractionRequestV1 = z.infer<
  typeof RunAnnualReportExtractionRequestV1Schema
>;

export const AnnualReportExtractionOverrideInstructionV1Schema = z
  .object({
    fieldKey: AnnualReportExtractionFieldKeyV1Schema,
    value: z.union([z.string().trim().min(1), z.number().finite()]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type AnnualReportExtractionOverrideInstructionV1 = z.infer<
  typeof AnnualReportExtractionOverrideInstructionV1Schema
>;

export const ApplyAnnualReportExtractionOverridesRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveExtraction: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
        schemaVersion: z.literal("annual_report_extraction_v1").optional(),
      })
      .strict(),
    overrides: z
      .array(AnnualReportExtractionOverrideInstructionV1Schema)
      .min(1),
    authorUserId: UuidV4Schema.optional(),
  })
  .strict();
export type ApplyAnnualReportExtractionOverridesRequestV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesRequestV1Schema
>;

export const ConfirmAnnualReportExtractionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveExtraction: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
        schemaVersion: z.literal("annual_report_extraction_v1").optional(),
      })
      .strict(),
    confirmedByUserId: UuidV4Schema,
  })
  .strict();
export type ConfirmAnnualReportExtractionRequestV1 = z.infer<
  typeof ConfirmAnnualReportExtractionRequestV1Schema
>;

export const ClearAnnualReportDataRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    clearedByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type ClearAnnualReportDataRequestV1 = z.infer<
  typeof ClearAnnualReportDataRequestV1Schema
>;

export const AnnualReportExtractionErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXTRACTION_NOT_FOUND",
  "STATE_CONFLICT",
  "PARSE_FAILED",
  "PERSISTENCE_ERROR",
]);
export type AnnualReportExtractionErrorCodeV1 = z.infer<
  typeof AnnualReportExtractionErrorCodeV1Schema
>;

export const AnnualReportExtractionFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: AnnualReportExtractionErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type AnnualReportExtractionFailureV1 = z.infer<
  typeof AnnualReportExtractionFailureV1Schema
>;

export const RunAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
  })
  .strict();
export type RunAnnualReportExtractionSuccessV1 = z.infer<
  typeof RunAnnualReportExtractionSuccessV1Schema
>;

export const RunAnnualReportExtractionResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    RunAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ],
);
export type RunAnnualReportExtractionResultV1 = z.infer<
  typeof RunAnnualReportExtractionResultV1Schema
>;

export const GetActiveAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
  })
  .strict();
export type GetActiveAnnualReportExtractionSuccessV1 = z.infer<
  typeof GetActiveAnnualReportExtractionSuccessV1Schema
>;

export const GetActiveAnnualReportExtractionResultV1Schema =
  z.discriminatedUnion("ok", [
    GetActiveAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ]);
export type GetActiveAnnualReportExtractionResultV1 = z.infer<
  typeof GetActiveAnnualReportExtractionResultV1Schema
>;

export const ClearAnnualReportDataSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    clearedArtifactTypes: z
      .array(
        z.enum([
          "annual_report_extraction",
          "annual_report_tax_analysis",
          "tax_adjustments",
          "tax_summary",
          "ink2_form",
          "export_package",
        ]),
      )
      .default([]),
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
  })
  .strict();
export type ClearAnnualReportDataSuccessV1 = z.infer<
  typeof ClearAnnualReportDataSuccessV1Schema
>;

export const ClearAnnualReportDataResultV1Schema = z.discriminatedUnion("ok", [
  ClearAnnualReportDataSuccessV1Schema,
  AnnualReportExtractionFailureV1Schema,
]);
export type ClearAnnualReportDataResultV1 = z.infer<
  typeof ClearAnnualReportDataResultV1Schema
>;

export const ApplyAnnualReportExtractionOverridesSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
    appliedCount: z.number().int().nonnegative(),
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
  })
  .strict();
export type ApplyAnnualReportExtractionOverridesSuccessV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesSuccessV1Schema
>;

export const ApplyAnnualReportExtractionOverridesResultV1Schema =
  z.discriminatedUnion("ok", [
    ApplyAnnualReportExtractionOverridesSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ]);
export type ApplyAnnualReportExtractionOverridesResultV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesResultV1Schema
>;

export const ConfirmAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
  })
  .strict();
export type ConfirmAnnualReportExtractionSuccessV1 = z.infer<
  typeof ConfirmAnnualReportExtractionSuccessV1Schema
>;

export const ConfirmAnnualReportExtractionResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    ConfirmAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ],
);
export type ConfirmAnnualReportExtractionResultV1 = z.infer<
  typeof ConfirmAnnualReportExtractionResultV1Schema
>;

export function parseAnnualReportExtractionPayloadV1(
  input: unknown,
): AnnualReportExtractionPayloadV1 {
  return AnnualReportExtractionPayloadV1Schema.parse(input);
}

export function parseRunAnnualReportExtractionResultV1(
  input: unknown,
): RunAnnualReportExtractionResultV1 {
  return RunAnnualReportExtractionResultV1Schema.parse(input);
}

export function parseGetActiveAnnualReportExtractionResultV1(
  input: unknown,
): GetActiveAnnualReportExtractionResultV1 {
  return GetActiveAnnualReportExtractionResultV1Schema.parse(input);
}

export function parseClearAnnualReportDataResultV1(
  input: unknown,
): ClearAnnualReportDataResultV1 {
  return ClearAnnualReportDataResultV1Schema.parse(input);
}

export function parseApplyAnnualReportExtractionOverridesResultV1(
  input: unknown,
): ApplyAnnualReportExtractionOverridesResultV1 {
  return ApplyAnnualReportExtractionOverridesResultV1Schema.parse(input);
}

export function parseConfirmAnnualReportExtractionResultV1(
  input: unknown,
): ConfirmAnnualReportExtractionResultV1 {
  return ConfirmAnnualReportExtractionResultV1Schema.parse(input);
}
