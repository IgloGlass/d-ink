import { describe, expect, it } from "vitest";

import { populateInk2FormDraftV1 } from "../../../src/server/forms/ink2-form-populator.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseTaxAdjustmentDecisionSetPayloadV1 } from "../../../src/shared/contracts/tax-adjustments.v1";
import { parseTaxSummaryPayloadV1 } from "../../../src/shared/contracts/tax-summary.v1";

function extraction() {
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
      fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
      accountingStandard: { status: "manual", confidence: 1, value: "K2" },
      profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
    },
    summary: {
      autoDetectedFieldCount: 0,
      needsReviewFieldCount: 0,
    },
    confirmation: {
      isConfirmed: true,
      confirmedAt: "2026-03-03T15:00:00.000Z",
      confirmedByUserId: "a3000000-0000-4000-8000-000000000010",
    },
  });
}

function adjustments() {
  return parseTaxAdjustmentDecisionSetPayloadV1({
    schemaVersion: "tax_adjustments_v1",
    policyVersion: "tax-adjustments.v1",
    generatedFrom: {
      mappingArtifactId: "a3000000-0000-4000-8000-000000000001",
      annualReportExtractionArtifactId: "a3000000-0000-4000-8000-000000000002",
    },
    summary: {
      totalDecisions: 4,
      manualReviewRequired: 0,
      totalPositiveAdjustments: 6000,
      totalNegativeAdjustments: 0,
      totalNetAdjustments: 6000,
    },
    decisions: [
      {
        id: "adj-1",
        module: "non_deductible_expenses",
        amount: 5000,
        direction: "increase_taxable_income",
        targetField: "INK2S.non_deductible_expenses",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "1" }],
      },
      {
        id: "adj-2",
        module: "representation_entertainment",
        amount: 1000,
        direction: "increase_taxable_income",
        targetField: "INK2S.representation_non_deductible",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "2" }],
      },
      {
        id: "adj-3",
        module: "depreciation_differences_basic",
        amount: 0,
        direction: "informational",
        targetField: "INK2S.depreciation_adjustment",
        status: "manual_review_required",
        confidence: 0.7,
        reviewFlag: true,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "3" }],
      },
      {
        id: "adj-4",
        module: "manual_review_bucket",
        amount: 0,
        direction: "informational",
        targetField: "INK2S.other_manual_adjustments",
        status: "manual_review_required",
        confidence: 1,
        reviewFlag: true,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "4" }],
      },
    ],
  });
}

function summary() {
  return parseTaxSummaryPayloadV1({
    schemaVersion: "tax_summary_v1",
    extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
    adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
    fiscalYearEnd: "2025-12-31",
    taxRatePercent: 20.6,
    profitBeforeTax: 1000000,
    totalAdjustments: 6000,
    taxableIncome: 1006000,
    corporateTax: 207236,
    lineItems: [
      {
        code: "profit_before_tax",
        amount: 1000000,
        sourceReference: "annual_report_extraction",
      },
      {
        code: "total_adjustments",
        amount: 6000,
        sourceReference: "tax_adjustments",
      },
      {
        code: "taxable_income",
        amount: 1006000,
        sourceReference: "calc",
      },
      {
        code: "corporate_tax",
        amount: 207236,
        sourceReference: "calc",
      },
    ],
  });
}

describe("INK2 form populator v1", () => {
  it("maps all locked V1 fields with provenance", () => {
    const result = populateInk2FormDraftV1({
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
      summaryArtifactId: "a3000000-0000-4000-8000-000000000103",
      extraction: extraction(),
      adjustments: adjustments(),
      summary: summary(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fieldMap = new Map(
      result.form.fields.map((field) => [field.fieldId, field]),
    );
    expect(fieldMap.get("INK2R.profit_before_tax")?.provenance).toBe(
      "extracted",
    );
    expect(fieldMap.get("INK2S.non_deductible_expenses")?.amount).toBe(5000);
    expect(fieldMap.get("INK2S.representation_non_deductible")?.amount).toBe(
      1000,
    );
    expect(fieldMap.get("INK2S.total_adjustments")?.amount).toBe(6000);
    expect(fieldMap.get("INK2S.corporate_tax")?.amount).toBe(207236);
  });

  it("marks validation invalid when summary total mismatches adjustment sums", () => {
    const result = populateInk2FormDraftV1({
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
      summaryArtifactId: "a3000000-0000-4000-8000-000000000103",
      extraction: extraction(),
      adjustments: adjustments(),
      summary: parseTaxSummaryPayloadV1({
        ...summary(),
        totalAdjustments: 9999,
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.form.validation.status).toBe("invalid");
    expect(result.form.validation.issues).toHaveLength(1);
  });
});
