import { z } from "zod";

import { AnnualReportDownstreamTaxContextV1Schema } from "./annual-report-tax-context.v1";
import {
  SilverfinTaxCategoryCodeV1Schema,
  SilverfinTaxCategoryReferenceV1Schema,
} from "./mapping.v1";
import {
  TaxAdjustmentDirectionV1Schema,
  TaxAdjustmentModuleCodeV1Schema,
  TaxAdjustmentTargetFieldV1Schema,
} from "./tax-adjustments.v1";
import {
  TrialBalanceRowIdentityV1Schema,
  type TrialBalanceSourceLocationV1,
  buildTrialBalanceRowIdentityV1,
} from "./trial-balance.v1";

export const TaxAdjustmentBridgeAiModuleV1Schema = z.enum([
  "non_deductible_expenses",
  "representation_entertainment",
  "depreciation_differences_basic",
]);
export type TaxAdjustmentBridgeAiModuleV1 = z.infer<
  typeof TaxAdjustmentBridgeAiModuleV1Schema
>;

export const TaxAdjustmentCategoryDecisionModeV1Schema = z.enum([
  "full_amount",
  "representation_10_percent",
  "manual_review",
]);
export type TaxAdjustmentCategoryDecisionModeV1 = z.infer<
  typeof TaxAdjustmentCategoryDecisionModeV1Schema
>;

export const TaxAdjustmentModuleContextAreaV1Schema = z.enum([
  "incomeStatementAnchors",
  "balanceSheetAnchors",
  "depreciationContext",
  "assetMovements",
  "netInterestContext",
  "reserveContext",
  "pensionContext",
  "taxExpenseContext",
  "leasingContext",
  "groupContributionContext",
  "shareholdingContext",
]);
export type TaxAdjustmentModuleContextAreaV1 = z.infer<
  typeof TaxAdjustmentModuleContextAreaV1Schema
>;

export const TaxAdjustmentModuleContextSharedAreaV1Schema = z.enum([
  "relevantNotes",
  "priorYearComparatives",
  "selectedRiskFindings",
  "missingInformation",
]);
export type TaxAdjustmentModuleContextSharedAreaV1 = z.infer<
  typeof TaxAdjustmentModuleContextSharedAreaV1Schema
>;

export const TaxAdjustmentCategoryDispositionStatusV1Schema = z.enum([
  "routed_to_submodule",
  "deterministically_informational",
  "manual_review_required",
  "unsupported_in_v1",
]);
export type TaxAdjustmentCategoryDispositionStatusV1 = z.infer<
  typeof TaxAdjustmentCategoryDispositionStatusV1Schema
>;

export const TaxAdjustmentCandidateRowResolutionStatusV1Schema = z.enum([
  "matched",
  "missing",
]);
export type TaxAdjustmentCandidateRowResolutionStatusV1 = z.infer<
  typeof TaxAdjustmentCandidateRowResolutionStatusV1Schema
>;

export const TaxAdjustmentCategoryRouteV1Schema = z
  .object({
    categoryCode: SilverfinTaxCategoryCodeV1Schema,
    moduleCode: TaxAdjustmentModuleCodeV1Schema,
    bridgeAiModule: TaxAdjustmentBridgeAiModuleV1Schema.nullable(),
    decisionMode: TaxAdjustmentCategoryDecisionModeV1Schema,
    direction: TaxAdjustmentDirectionV1Schema,
    targetField: TaxAdjustmentTargetFieldV1Schema,
    contextAreas: z.array(TaxAdjustmentModuleContextAreaV1Schema).default([]),
  })
  .strict();
export type TaxAdjustmentCategoryRouteV1 = z.infer<
  typeof TaxAdjustmentCategoryRouteV1Schema
>;

export const TaxAdjustmentAnnualReportContextLineageV1Schema = z
  .object({
    sourceContextSchemaVersion: z.literal("annual_report_tax_context_v1"),
    moduleContextSchemaVersion: z.literal("tax_adjustment_module_context_v1"),
    includedAreas: z.array(TaxAdjustmentModuleContextAreaV1Schema).default([]),
    sharedAreas: z
      .array(TaxAdjustmentModuleContextSharedAreaV1Schema)
      .default([]),
  })
  .strict();
export type TaxAdjustmentAnnualReportContextLineageV1 = z.infer<
  typeof TaxAdjustmentAnnualReportContextLineageV1Schema
>;

export const MappedAdjustmentCandidateV1Schema = z
  .object({
    schemaVersion: z.literal("mapped_adjustment_candidate_v1"),
    mappingDecisionId: z.string().trim().min(1),
    trialBalanceRowIdentity: TrialBalanceRowIdentityV1Schema.nullable(),
    rowResolutionStatus: TaxAdjustmentCandidateRowResolutionStatusV1Schema,
    rowResolutionReason: z.string().trim().min(1).optional(),
    sourceAccountNumber: z.string().trim().min(1),
    accountNumber: z.string().trim().min(1),
    accountName: z.string().trim().min(1),
    openingBalance: z.number().finite(),
    closingBalance: z.number().finite(),
    selectedCategory: SilverfinTaxCategoryReferenceV1Schema,
    mappingConfidence: z.number().min(0).max(1),
    mappingReviewFlag: z.boolean(),
    mappingPolicyRuleReference: z.string().trim().min(1),
    moduleCode: TaxAdjustmentModuleCodeV1Schema,
    bridgeAiModule: TaxAdjustmentBridgeAiModuleV1Schema.nullable(),
    dispositionStatus: TaxAdjustmentCategoryDispositionStatusV1Schema,
    decisionMode: TaxAdjustmentCategoryDecisionModeV1Schema,
    direction: TaxAdjustmentDirectionV1Schema,
    targetField: TaxAdjustmentTargetFieldV1Schema,
    annualReportContextLineage: TaxAdjustmentAnnualReportContextLineageV1Schema,
  })
  .strict();
export type MappedAdjustmentCandidateV1 = z.infer<
  typeof MappedAdjustmentCandidateV1Schema
>;

export const TaxAdjustmentCategoryDispositionRecordV1Schema = z
  .object({
    category: SilverfinTaxCategoryReferenceV1Schema,
    moduleCode: TaxAdjustmentModuleCodeV1Schema.nullable(),
    bridgeAiModule: TaxAdjustmentBridgeAiModuleV1Schema.nullable(),
    dispositionStatus: TaxAdjustmentCategoryDispositionStatusV1Schema,
    decisionMode: TaxAdjustmentCategoryDecisionModeV1Schema.nullable(),
    direction: TaxAdjustmentDirectionV1Schema.nullable(),
    targetField: TaxAdjustmentTargetFieldV1Schema.nullable(),
    contextAreas: z.array(TaxAdjustmentModuleContextAreaV1Schema).default([]),
  })
  .strict();
export type TaxAdjustmentCategoryDispositionRecordV1 = z.infer<
  typeof TaxAdjustmentCategoryDispositionRecordV1Schema
>;

export const TaxAdjustmentModuleContextV1Schema = z
  .object({
    schemaVersion: z.literal("tax_adjustment_module_context_v1"),
    moduleCode: TaxAdjustmentModuleCodeV1Schema,
    shared: z
      .object({
        relevantNotes:
          AnnualReportDownstreamTaxContextV1Schema.shape.relevantNotes,
        priorYearComparatives:
          AnnualReportDownstreamTaxContextV1Schema.shape.priorYearComparatives,
        selectedRiskFindings:
          AnnualReportDownstreamTaxContextV1Schema.shape.selectedRiskFindings,
        missingInformation:
          AnnualReportDownstreamTaxContextV1Schema.shape.missingInformation,
      })
      .strict(),
    incomeStatementAnchors:
      AnnualReportDownstreamTaxContextV1Schema.shape.incomeStatementAnchors.optional(),
    balanceSheetAnchors:
      AnnualReportDownstreamTaxContextV1Schema.shape.balanceSheetAnchors.optional(),
    depreciationContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.depreciationContext.optional(),
    assetMovements:
      AnnualReportDownstreamTaxContextV1Schema.shape.assetMovements.optional(),
    netInterestContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.netInterestContext.optional(),
    reserveContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.reserveContext.optional(),
    pensionContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.pensionContext.optional(),
    taxExpenseContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.taxExpenseContext.optional(),
    leasingContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.leasingContext.optional(),
    groupContributionContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.groupContributionContext.optional(),
    shareholdingContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.shareholdingContext.optional(),
  })
  .strict();
export type TaxAdjustmentModuleContextV1 = z.infer<
  typeof TaxAdjustmentModuleContextV1Schema
>;

export function parseMappedAdjustmentCandidateV1(
  input: unknown,
): MappedAdjustmentCandidateV1 {
  return MappedAdjustmentCandidateV1Schema.parse(input);
}

export function parseTaxAdjustmentCategoryDispositionRecordV1(
  input: unknown,
): TaxAdjustmentCategoryDispositionRecordV1 {
  return TaxAdjustmentCategoryDispositionRecordV1Schema.parse(input);
}

export function parseTaxAdjustmentModuleContextV1(
  input: unknown,
): TaxAdjustmentModuleContextV1 {
  return TaxAdjustmentModuleContextV1Schema.parse(input);
}

export function buildMappedAdjustmentRowIdentityV1(
  source: TrialBalanceSourceLocationV1 | null | undefined,
) {
  return source ? buildTrialBalanceRowIdentityV1(source) : null;
}

export function buildAnnualReportContextLineageV1(input: {
  includedAreas: TaxAdjustmentModuleContextAreaV1[];
}): TaxAdjustmentAnnualReportContextLineageV1 {
  return {
    sourceContextSchemaVersion: "annual_report_tax_context_v1",
    moduleContextSchemaVersion: "tax_adjustment_module_context_v1",
    includedAreas: [...input.includedAreas],
    sharedAreas: [
      "relevantNotes",
      "priorYearComparatives",
      "selectedRiskFindings",
      "missingInformation",
    ],
  };
}

export function isRoutedDispositionStatusV1(
  status: TaxAdjustmentCategoryDispositionStatusV1,
): boolean {
  return status === "routed_to_submodule";
}

export function isExplicitlyUnsupportedDispositionStatusV1(
  status: TaxAdjustmentCategoryDispositionStatusV1,
): boolean {
  return status === "unsupported_in_v1";
}
