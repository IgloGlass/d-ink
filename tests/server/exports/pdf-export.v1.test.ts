import { describe, expect, it } from "vitest";

import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseInk2FormDraftPayloadV1 } from "../../../src/shared/contracts/ink2-form.v1";
import { parseTaxAdjustmentDecisionSetPayloadV1 } from "../../../src/shared/contracts/tax-adjustments.v1";
import { parseTaxSummaryPayloadV1 } from "../../../src/shared/contracts/tax-summary.v1";
import { parseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";
import { generatePdfExportPackageV1 } from "../../../src/server/exports/pdf-export.v1";

function workspace(status: "approved_for_export" | "in_review") {
  return parseWorkspaceV1({
    id: "a4000000-0000-4000-8000-000000000001",
    tenantId: "a4000000-0000-4000-8000-000000000002",
    companyId: "a4000000-0000-4000-8000-000000000003",
    fiscalYearStart: "2025-01-01",
    fiscalYearEnd: "2025-12-31",
    status,
    createdAt: "2026-03-03T16:00:00.000Z",
    updatedAt: "2026-03-03T16:00:00.000Z",
  });
}

function extraction() {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
    fields: {
      companyName: { status: "manual", confidence: 1, value: "Acme AB" },
      organizationNumber: { status: "manual", confidence: 1, value: "556677-8899" },
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
      confirmedAt: "2026-03-03T16:01:00.000Z",
      confirmedByUserId: "a4000000-0000-4000-8000-000000000010",
    },
  });
}

function adjustments() {
  return parseTaxAdjustmentDecisionSetPayloadV1({
    schemaVersion: "tax_adjustments_v1",
    policyVersion: "tax-adjustments.v1",
    generatedFrom: {
      mappingArtifactId: "a4000000-0000-4000-8000-000000000011",
      annualReportExtractionArtifactId: "a4000000-0000-4000-8000-000000000012",
    },
    summary: {
      totalDecisions: 1,
      manualReviewRequired: 0,
      totalPositiveAdjustments: 5000,
      totalNegativeAdjustments: 0,
      totalNetAdjustments: 5000,
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
    ],
  });
}

function summary() {
  return parseTaxSummaryPayloadV1({
    schemaVersion: "tax_summary_v1",
    extractionArtifactId: "a4000000-0000-4000-8000-000000000021",
    adjustmentsArtifactId: "a4000000-0000-4000-8000-000000000022",
    fiscalYearEnd: "2025-12-31",
    taxRatePercent: 20.6,
    profitBeforeTax: 1000000,
    totalAdjustments: 5000,
    taxableIncome: 1005000,
    corporateTax: 207030,
    lineItems: [
      { code: "profit_before_tax", amount: 1000000, sourceReference: "src" },
      { code: "total_adjustments", amount: 5000, sourceReference: "src" },
      { code: "taxable_income", amount: 1005000, sourceReference: "src" },
      { code: "corporate_tax", amount: 207030, sourceReference: "src" },
    ],
  });
}

function form() {
  return parseInk2FormDraftPayloadV1({
    schemaVersion: "ink2_form_draft_v1",
    extractionArtifactId: "a4000000-0000-4000-8000-000000000031",
    adjustmentsArtifactId: "a4000000-0000-4000-8000-000000000032",
    summaryArtifactId: "a4000000-0000-4000-8000-000000000033",
    fields: [
      {
        fieldId: "INK2R.profit_before_tax",
        amount: 1000000,
        provenance: "extracted",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.non_deductible_expenses",
        amount: 5000,
        provenance: "adjustment",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.representation_non_deductible",
        amount: 0,
        provenance: "adjustment",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.depreciation_adjustment",
        amount: 0,
        provenance: "adjustment",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.other_manual_adjustments",
        amount: 0,
        provenance: "manual",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.total_adjustments",
        amount: 5000,
        provenance: "calculated",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.taxable_income",
        amount: 1005000,
        provenance: "calculated",
        sourceReferences: ["x"],
      },
      {
        fieldId: "INK2S.corporate_tax",
        amount: 207030,
        provenance: "calculated",
        sourceReferences: ["x"],
      },
    ],
    validation: {
      status: "valid",
      issues: [],
    },
  });
}

describe("pdf export module v1", () => {
  it("blocks export when workspace is not approved_for_export", () => {
    const result = generatePdfExportPackageV1({
      workspace: workspace("in_review"),
      extraction: extraction(),
      extractionArtifactId: "a4000000-0000-4000-8000-000000000101",
      adjustments: adjustments(),
      adjustmentsArtifactId: "a4000000-0000-4000-8000-000000000102",
      summary: summary(),
      summaryArtifactId: "a4000000-0000-4000-8000-000000000103",
      form: form(),
      formArtifactId: "a4000000-0000-4000-8000-000000000104",
      createdAt: "2026-03-03T16:05:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXPORT_NOT_ALLOWED");
    }
  });

  it("generates deterministic PDF-like content and metadata", () => {
    const result = generatePdfExportPackageV1({
      workspace: workspace("approved_for_export"),
      extraction: extraction(),
      extractionArtifactId: "a4000000-0000-4000-8000-000000000101",
      adjustments: adjustments(),
      adjustmentsArtifactId: "a4000000-0000-4000-8000-000000000102",
      summary: summary(),
      summaryArtifactId: "a4000000-0000-4000-8000-000000000103",
      form: form(),
      formArtifactId: "a4000000-0000-4000-8000-000000000104",
      createdAt: "2026-03-03T16:05:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.exportPackage.format).toBe("pdf");
    expect(result.exportPackage.mimeType).toBe("application/pdf");
    const decoded = atob(result.exportPackage.contentBase64);
    expect(decoded.startsWith("%PDF-1.4")).toBe(true);
    expect(decoded.includes("CorporateTax: 207030")).toBe(true);
  });
});
