import { z } from "zod";

import {
  AnnualReportAssetMovementLineV1Schema,
  AnnualReportEvidenceReferenceV1Schema,
  AnnualReportNarrativeFlagV1Schema,
  AnnualReportPriorYearComparativeV1Schema,
  AnnualReportRelevantNoteV1Schema,
  AnnualReportReserveMovementLineV1Schema,
  AnnualReportStatementLineV1Schema,
  AnnualReportTaxExpenseContextV1Schema,
  AnnualReportValueWithEvidenceV1Schema,
} from "./annual-report-extraction.v1";

export const AnnualReportDownstreamRiskFindingV1Schema = z
  .object({
    area: z.string().trim().min(1),
    title: z.string().trim().min(1),
    severity: z.enum(["low", "medium", "high"]),
    rationale: z.string().trim().min(1),
    policyRuleReference: z.string().trim().min(1),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportDownstreamRiskFindingV1 = z.infer<
  typeof AnnualReportDownstreamRiskFindingV1Schema
>;

export const AnnualReportDownstreamTaxContextV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_tax_context_v1"),
    incomeStatementAnchors: z.array(AnnualReportStatementLineV1Schema).default([]),
    balanceSheetAnchors: z.array(AnnualReportStatementLineV1Schema).default([]),
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
    reserveContext: z
      .object({
        movements: z.array(AnnualReportReserveMovementLineV1Schema).default([]),
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
    selectedRiskFindings: z
      .array(AnnualReportDownstreamRiskFindingV1Schema)
      .default([]),
    missingInformation: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
export type AnnualReportDownstreamTaxContextV1 = z.infer<
  typeof AnnualReportDownstreamTaxContextV1Schema
>;

export const AnnualReportMappingContextV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_mapping_context_v1"),
    incomeStatementAnchors:
      AnnualReportDownstreamTaxContextV1Schema.shape.incomeStatementAnchors,
    balanceSheetAnchors:
      AnnualReportDownstreamTaxContextV1Schema.shape.balanceSheetAnchors,
    depreciationContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.depreciationContext,
    assetMovements:
      AnnualReportDownstreamTaxContextV1Schema.shape.assetMovements,
    taxExpenseContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.taxExpenseContext,
    pensionContext: AnnualReportDownstreamTaxContextV1Schema.shape.pensionContext,
    leasingContext: AnnualReportDownstreamTaxContextV1Schema.shape.leasingContext,
    reserveContext: AnnualReportDownstreamTaxContextV1Schema.shape.reserveContext,
    netInterestContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.netInterestContext,
    groupContributionContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.groupContributionContext,
    shareholdingContext:
      AnnualReportDownstreamTaxContextV1Schema.shape.shareholdingContext,
    relevantNotes: AnnualReportDownstreamTaxContextV1Schema.shape.relevantNotes,
    priorYearComparatives:
      AnnualReportDownstreamTaxContextV1Schema.shape.priorYearComparatives,
    selectedRiskFindings: z
      .array(AnnualReportDownstreamRiskFindingV1Schema)
      .default([]),
    missingInformation:
      AnnualReportDownstreamTaxContextV1Schema.shape.missingInformation,
  })
  .strict();
export type AnnualReportMappingContextV1 = z.infer<
  typeof AnnualReportMappingContextV1Schema
>;

export function parseAnnualReportDownstreamTaxContextV1(
  input: unknown,
): AnnualReportDownstreamTaxContextV1 {
  return AnnualReportDownstreamTaxContextV1Schema.parse(input);
}

export function parseAnnualReportMappingContextV1(
  input: unknown,
): AnnualReportMappingContextV1 {
  return AnnualReportMappingContextV1Schema.parse(input);
}
