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
    taxDeep: {
      ink2rExtracted: {
        statementUnit: "sek",
        incomeStatement: [
          {
            code: "3.7",
            label: "Ovriga externa kostnader",
            currentYearValue: 250000,
            evidence: [],
          },
          {
            code: "3.8",
            label: "Personalkostnader",
            currentYearValue: 180000,
            evidence: [],
          },
          {
            code: "3.25",
            label: "Skatt pa arets resultat",
            currentYearValue: 20000,
            evidence: [],
          },
          {
            code: "3.26",
            label: "Arets resultat, vinst",
            currentYearValue: 1000000,
            evidence: [],
          },
        ],
        balanceSheet: [
          {
            code: "2.26",
            label: "Kassa, bank och redovisningsmedel",
            currentYearValue: 250000,
            evidence: [],
          },
          {
            code: "2.45",
            label: "Leverantorsskulder",
            currentYearValue: 120000,
            evidence: [],
          },
        ],
      },
      depreciationContext: { assetAreas: [], evidence: [] },
      assetMovements: { lines: [], evidence: [] },
      reserveContext: { movements: [], notes: [], evidence: [] },
      netInterestContext: { notes: [], evidence: [] },
      pensionContext: { flags: [], notes: [], evidence: [] },
      leasingContext: { flags: [], notes: [], evidence: [] },
      groupContributionContext: { flags: [], notes: [], evidence: [] },
      shareholdingContext: { flags: [], notes: [], evidence: [] },
      priorYearComparatives: [],
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
      totalDecisions: 3,
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
        module: "depreciation_differences_basic",
        amount: -4000,
        direction: "decrease_taxable_income",
        targetField: "INK2S.depreciation_adjustment",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "2" }],
      },
      {
        id: "adj-3",
        module: "manual_review_bucket",
        amount: 5000,
        direction: "increase_taxable_income",
        targetField: "INK2S.other_manual_adjustments",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "rule",
        rationale: "fixture",
        evidence: [{ type: "fixture", reference: "3" }],
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
    taxableIncome: 1026000,
    corporateTax: 211356,
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
        amount: 1026000,
        sourceReference: "calc",
      },
      {
        code: "corporate_tax",
        amount: 211356,
        sourceReference: "calc",
      },
    ],
  });
}

describe("INK2 form populator v1", () => {
  it("maps official INK2 rows from statements and tax adjustments", () => {
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
    expect(fieldMap.get("2.26")?.provenance).toBe("extracted");
    expect(fieldMap.get("3.26")?.amount).toBe(20000);
    expect(fieldMap.get("4.1")?.amount).toBe(1000000);
    expect(fieldMap.get("4.3c")?.amount).toBe(5000);
    expect(fieldMap.get("4.9")?.amount).toBe(-4000);
    expect(fieldMap.get("4.13")?.amount).toBe(5000);
    expect(fieldMap.get("4.15")?.amount).toBe(1026000);
    expect(fieldMap.get("1.1")?.amount).toBe(1026000);
  });

  it("marks validation invalid when the tax summary and INK2 result diverge", () => {
    const result = populateInk2FormDraftV1({
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
      summaryArtifactId: "a3000000-0000-4000-8000-000000000103",
      extraction: extraction(),
      adjustments: adjustments(),
      summary: parseTaxSummaryPayloadV1({
        ...summary(),
        taxableIncome: 9999,
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.form.validation.status).toBe("invalid");
    expect(
      result.form.validation.issues.some((issue) =>
        issue.includes("taxable result"),
      ),
    ).toBe(true);
  });

  it("builds a provisional INK2 draft from annual-report statements alone", () => {
    const provisionalExtraction = extraction();
    provisionalExtraction.confirmation = { isConfirmed: false };

    const result = populateInk2FormDraftV1({
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      extraction: provisionalExtraction,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fieldMap = new Map(
      result.form.fields.map((field) => [field.fieldId, field]),
    );
    expect(fieldMap.get("2.26")?.amount).toBe(250000);
    expect(fieldMap.get("4.3c")?.amount).toBe(0);
    expect(fieldMap.get("4.15")?.amount).toBe(1020000);
    expect(result.form.validation.status).toBe("invalid");
    expect(
      result.form.validation.issues.some((issue) =>
        issue.includes("Tax adjustments have not been generated"),
      ),
    ).toBe(true);
    expect(
      result.form.validation.issues.some((issue) =>
        issue.includes("Tax summary has not been generated"),
      ),
    ).toBe(true);
  });
});
