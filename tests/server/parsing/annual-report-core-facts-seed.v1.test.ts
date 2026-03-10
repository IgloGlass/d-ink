import { describe, expect, it } from "vitest";

import { extractAnnualReportCoreFactsSeedV1 } from "../../../src/server/parsing/annual-report-core-facts-seed.v1";
import { parseAnnualReportSourceTextV1 } from "../../../src/shared/contracts/annual-report-source-text.v1";

describe("annual report core facts seed v1", () => {
  it("extracts broader fiscal-year/accounting-standard formats and seeds profit before tax across four statement pages", () => {
    const pageTexts = [
      "Acme AB\norg.nr 556677-8899\nÅrsredovisning",
      "Räkenskapsår: 2024.06.01 - 2025.05.31\nUpprättad enligt regelverk: K3",
      "Förvaltningsberättelse",
      "Resultaträkning\nNettoomsättning 1000",
      "Resultat före skatt 545286",
      "Balansräkning",
    ];
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: pageTexts.join("\n\n"),
      pageTexts,
      pageCount: pageTexts.length,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 80,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const seed = extractAnnualReportCoreFactsSeedV1({
      sourceText,
      coreFactsRanges: [{ startPage: 1, endPage: 3, confidence: 0.9 }],
      statementRanges: [{ startPage: 3, endPage: 6, confidence: 0.9 }],
    });

    expect(seed.fields.organizationNumber?.valueText).toBe("556677-8899");
    expect(seed.fields.accountingStandard?.normalizedValue).toBe("K3");
    expect(seed.fields.fiscalYearStart?.normalizedValue).toBe("2024-06-01");
    expect(seed.fields.fiscalYearEnd?.normalizedValue).toBe("2025-05-31");
    expect(seed.fields.profitBeforeTax?.normalizedValue).toBe(545286);
    expect(seed.diagnostics).toEqual(
      expect.arrayContaining([
        "seed.organization_number=hit",
        "seed.accounting_standard=hit",
        "seed.fiscal_year=hit",
        "seed.profit_before_tax=hit",
      ]),
    );
  });

  it("detects framework and fiscal year from BFNAR-style wording and verksamhetsar labels", () => {
    const pageTexts = [
      "Deloitte AB\norganisationsnummer 556271-5309",
      "Arsredovisningen har upprattats enligt BFNAR 2016:10 (K2)\nVerksamhetsar 2024-06-01 - 2025-05-31",
      "Forvaltningsberattelse",
    ];
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: pageTexts.join("\n\n"),
      pageTexts,
      pageCount: pageTexts.length,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 90,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const seed = extractAnnualReportCoreFactsSeedV1({
      sourceText,
      coreFactsRanges: [{ startPage: 1, endPage: 3, confidence: 0.9 }],
      statementRanges: [],
    });

    expect(seed.fields.accountingStandard?.normalizedValue).toBe("K2");
    expect(seed.fields.fiscalYearStart?.normalizedValue).toBe("2024-06-01");
    expect(seed.fields.fiscalYearEnd?.normalizedValue).toBe("2025-05-31");
  });

  it("detects long-form Swedish fiscal years on the cover page and framework from later accounting-principles pages", () => {
    const pageTexts = [
      "Deloitte AB\nOrg. nr 556271-5309\nÅrsredovisning för räkenskapsåret 1 juni 2024 – 31 maj 2025",
      "Innehåll\nResultaträkning 15\nBalansräkning 16-17",
      "Förvaltningsberättelse",
      "Övrig text",
      "Redovisningsprinciper\nBokföringsnämndens allmänna råd BFNAR 2012:1 Årsredovisning och koncernredovisning (K3).",
    ];
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: pageTexts.join("\n\n"),
      pageTexts,
      pageCount: pageTexts.length,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 100,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const seed = extractAnnualReportCoreFactsSeedV1({
      sourceText,
      coreFactsRanges: [{ startPage: 1, endPage: 4, confidence: 0.9 }],
      statementRanges: [{ startPage: 15, endPage: 17, confidence: 0.9 }],
    });

    expect(seed.fields.fiscalYearStart?.normalizedValue).toBe("2024-06-01");
    expect(seed.fields.fiscalYearEnd?.normalizedValue).toBe("2025-05-31");
    expect(seed.fields.accountingStandard?.normalizedValue).toBe("K3");
  });

  it("takes the current-year profit before tax from two-column statement rows", () => {
    const pageTexts = [
      "Deloitte AB\nOrg. nr 556271-5309",
      "Årsredovisning för räkenskapsåret 1 juni 2024 – 31 maj 2025",
      "Resultaträkning\nResultat före skatt 545 286 771 473\nBelopp i KSEK",
    ];
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: pageTexts.join("\n\n"),
      pageTexts,
      pageCount: pageTexts.length,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 100,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const seed = extractAnnualReportCoreFactsSeedV1({
      sourceText,
      coreFactsRanges: [{ startPage: 1, endPage: 2, confidence: 0.9 }],
      statementRanges: [{ startPage: 3, endPage: 3, confidence: 0.9 }],
    });

    expect(seed.fields.profitBeforeTax?.normalizedValue).toBe(545286);
  });
});
