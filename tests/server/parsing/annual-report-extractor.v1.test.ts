import { describe, expect, it } from "vitest";

import { parseAnnualReportExtractionV1 } from "../../../src/server/parsing/annual-report-extractor.v1";

function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("annual report extractor v1", () => {
  it("extracts core fields from PDF-like text", () => {
    const result = parseAnnualReportExtractionV1({
      fileName: "annual-report.pdf",
      fileBytes: toBytes(`
        Company Name: Acme AB
        Org nr: 556677-8899
        Fiscal year: 2025-01-01 to 2025-12-31
        Framework: K2
        Resultat före skatt: 1 250 000
      `),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.extraction.fields.companyName.value).toBe("Acme AB");
    expect(result.extraction.fields.organizationNumber.value).toBe(
      "556677-8899",
    );
    expect(result.extraction.fields.accountingStandard.value).toBe("K2");
    expect(result.extraction.fields.profitBeforeTax.value).toBe(1250000);
  });

  it("supports DOCX file type and marks missing fields as needs_review", () => {
    const result = parseAnnualReportExtractionV1({
      fileName: "annual-report.docx",
      fileType: "docx",
      fileBytes: toBytes("Company Name: Acme AB"),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.extraction.sourceFileType).toBe("docx");
    expect(result.extraction.fields.companyName.status).toBe("extracted");
    expect(result.extraction.fields.profitBeforeTax.status).toBe(
      "needs_review",
    );
  });

  it("fails on unsupported extension", () => {
    const result = parseAnnualReportExtractionV1({
      fileName: "annual-report.txt",
      fileBytes: toBytes("hello"),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
    }
  });

  it("fails when declared file type mismatches file name extension", () => {
    const result = parseAnnualReportExtractionV1({
      fileName: "annual-report.pdf",
      fileType: "docx",
      fileBytes: toBytes("Company Name: Acme AB"),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(result.error.context.reason).toBe("declared_file_type_mismatch");
    }
  });

  it("fails on empty bytes", () => {
    const result = parseAnnualReportExtractionV1({
      fileName: "annual-report.pdf",
      fileBytes: new Uint8Array([]),
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(false);
  });
});
