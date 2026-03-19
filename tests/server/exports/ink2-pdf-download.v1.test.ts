import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { populateInk2PdfFormV1 } from "../../../src/client/features/modules/ink2-pdf-download.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseInk2FormDraftPayloadV1 } from "../../../src/shared/contracts/ink2-form.v1";

describe("ink2 pdf download helper v1", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes 4.15 to its own PDF slot instead of the 4.14c field", async () => {
    const fieldValues = new Map<string, string>();
    const mockForm = {
      flatten: vi.fn(),
      getTextField: (fieldName: string) => ({
        setText: (value: string) => {
          fieldValues.set(fieldName, value);
        },
      }),
    };

    const extraction = parseAnnualReportExtractionPayloadV1({
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
        fiscalYearStart: {
          status: "manual",
          confidence: 1,
          value: "2025-01-01",
        },
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
          incomeStatement: [],
          balanceSheet: [],
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

    const formDraft = parseInk2FormDraftPayloadV1({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
      summaryArtifactId: "a3000000-0000-4000-8000-000000000103",
      fields: [
        {
          fieldId: "1.1",
          amount: 1006000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:1.1"],
        },
        {
          fieldId: "2.26",
          amount: 250000,
          provenance: "extracted",
          sourceReferences: ["annual_report_statement:2.26"],
        },
        {
          fieldId: "3.26",
          amount: 20000,
          provenance: "extracted",
          sourceReferences: ["annual_report_statement:3.25"],
        },
        {
          fieldId: "4.1",
          amount: 1000000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.1"],
        },
        {
          fieldId: "4.14c",
          amount: 5000,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:adj-1"],
        },
        {
          fieldId: "4.3c",
          amount: 5000,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:adj-1"],
        },
        {
          fieldId: "4.9",
          amount: -4000,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:adj-2"],
        },
        {
          fieldId: "4.15",
          amount: 1006000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.15"],
        },
        {
          fieldId: "4.16",
          amount: 0,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.16"],
        },
      ],
      validation: {
        status: "valid",
        issues: [],
      },
    });

    populateInk2PdfFormV1({
      pdfForm: mockForm as unknown as ReturnType<PDFDocument["getForm"]>,
      extraction,
      formDraft,
    });

    expect(fieldValues.get("20020434")).toBe("5000");
    expect(fieldValues.get("20020435")).toBe("1006000");
    expect(fieldValues.get("20020434")).not.toBe(fieldValues.get("20020435"));
    expect(fieldValues.get("20020436")).toBe("");
  });
});
