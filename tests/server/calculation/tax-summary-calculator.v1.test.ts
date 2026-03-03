import { describe, expect, it } from "vitest";

import { calculateTaxSummaryV1 } from "../../../src/server/calculation/tax-summary-calculator.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseTaxAdjustmentDecisionSetPayloadV1 } from "../../../src/shared/contracts/tax-adjustments.v1";

function confirmedExtraction(input?: {
  fiscalYearEnd?: string;
  profitBeforeTax?: number;
}) {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
    fields: {
      companyName: { status: "manual", confidence: 1, value: "Acme AB" },
      organizationNumber: {
        status: "manual",
        confidence: 1,
        value: "556677-8899",
      },
      fiscalYearStart: { status: "manual", confidence: 1, value: "2025-01-01" },
      fiscalYearEnd: {
        status: "manual",
        confidence: 1,
        value: input?.fiscalYearEnd ?? "2025-12-31",
      },
      accountingStandard: { status: "manual", confidence: 1, value: "K2" },
      profitBeforeTax: {
        status: "manual",
        confidence: 1,
        value: input?.profitBeforeTax ?? 1000000,
      },
    },
    summary: {
      autoDetectedFieldCount: 0,
      needsReviewFieldCount: 0,
    },
    confirmation: {
      isConfirmed: true,
      confirmedAt: "2026-03-03T14:30:00.000Z",
      confirmedByUserId: "a2000000-0000-4000-8000-000000000010",
    },
  });
}

function adjustments(totalNetAdjustments: number) {
  return parseTaxAdjustmentDecisionSetPayloadV1({
    schemaVersion: "tax_adjustments_v1",
    policyVersion: "tax-adjustments.v1",
    generatedFrom: {
      mappingArtifactId: "a2000000-0000-4000-8000-000000000001",
      annualReportExtractionArtifactId: "a2000000-0000-4000-8000-000000000002",
    },
    summary: {
      totalDecisions: 1,
      manualReviewRequired: 0,
      totalPositiveAdjustments:
        totalNetAdjustments > 0 ? totalNetAdjustments : 0,
      totalNegativeAdjustments:
        totalNetAdjustments < 0 ? -totalNetAdjustments : 0,
      totalNetAdjustments,
    },
    decisions: [
      {
        id: "adj-1",
        module: "manual_review_bucket",
        amount: totalNetAdjustments,
        direction:
          totalNetAdjustments > 0
            ? "increase_taxable_income"
            : totalNetAdjustments < 0
              ? "decrease_taxable_income"
              : "informational",
        targetField: "INK2S.other_manual_adjustments",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "adj.manual_review_bucket.v1",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "fixture" }],
      },
    ],
  });
}

describe("tax summary calculator v1", () => {
  it("computes deterministic taxable income and corporate tax", () => {
    const result = calculateTaxSummaryV1({
      extractionArtifactId: "a2000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a2000000-0000-4000-8000-000000000102",
      extraction: confirmedExtraction({ profitBeforeTax: 1000000 }),
      adjustments: adjustments(5000),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.summary.taxableIncome).toBe(1005000);
    expect(result.summary.corporateTax).toBe(207030);
  });

  it("handles negative net adjustments", () => {
    const result = calculateTaxSummaryV1({
      extractionArtifactId: "a2000000-0000-4000-8000-000000000103",
      adjustmentsArtifactId: "a2000000-0000-4000-8000-000000000104",
      extraction: confirmedExtraction({ profitBeforeTax: 1000000 }),
      adjustments: adjustments(-2500),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.summary.taxableIncome).toBe(997500);
    expect(result.summary.corporateTax).toBe(205485);
  });

  it("rejects out-of-range fiscal year", () => {
    const result = calculateTaxSummaryV1({
      extractionArtifactId: "a2000000-0000-4000-8000-000000000105",
      adjustmentsArtifactId: "a2000000-0000-4000-8000-000000000106",
      extraction: confirmedExtraction({ fiscalYearEnd: "2020-12-31" }),
      adjustments: adjustments(0),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID_FISCAL_YEAR");
    }
  });
});
