import { describe, expect, it } from "vitest";

import { buildAnnualReportCoreFactsCompactTextV1 } from "../../../src/server/parsing/annual-report-core-facts-compact-text.v1";
import { parseAnnualReportSourceTextV1 } from "../../../src/shared/contracts/annual-report-source-text.v1";

describe("annual report core-facts compact text v1", () => {
  it("selects high-signal Swedish front-matter lines and enforces compact size", () => {
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: [
        "Deloitte AB",
        "Org.nr 556271-5309",
        "Årsredovisning",
        "Räkenskapsår 2024-06-01 - 2025-05-31",
        "K3",
        "Förvaltningsberättelse",
        "Lorem ipsum dolor sit amet",
      ].join("\n"),
      pageTexts: [
        [
          "Deloitte AB",
          "Org.nr 556271-5309",
          "Årsredovisning",
          "Räkenskapsår 2024-06-01 - 2025-05-31",
          "K3",
          "Förvaltningsberättelse",
          "Lorem ipsum dolor sit amet",
        ].join("\n"),
      ],
      pageCount: 1,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 120,
        nonEmptyPageCount: 1,
        nonEmptyPageRatio: 1,
        totalExtractedChars: 120,
      },
      warnings: [],
    });

    const compact = buildAnnualReportCoreFactsCompactTextV1({
      sourceText,
      coreFactsRanges: [{ startPage: 1, endPage: 1, confidence: 0.9 }],
      seed: {
        diagnostics: [],
        fields: {
          companyName: { valueText: "Deloitte AB", page: 1 },
          organizationNumber: { valueText: "556271-5309", page: 1 },
          accountingStandard: { valueText: "K3", normalizedValue: "K3", page: 1 },
          fiscalYearStart: { valueText: "2024-06-01", normalizedValue: "2024-06-01", page: 1 },
          fiscalYearEnd: { valueText: "2025-05-31", normalizedValue: "2025-05-31", page: 1 },
        },
      },
    });

    expect(compact.text).toContain("Deloitte AB");
    expect(compact.text).toContain("Org.nr 556271-5309");
    expect(compact.text).toContain("Räkenskapsår 2024-06-01 - 2025-05-31");
    expect(compact.text.length).toBeLessThanOrEqual(2400);
    expect(compact.lineCount).toBeLessThanOrEqual(24);
    expect(compact.diagnostics).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^core_facts\.compact_lines=\d+$/),
        expect.stringMatching(/^core_facts\.compact_chars=\d+$/),
        expect.stringMatching(/^core_facts\.seed_fields=\d+$/),
      ]),
    );
  });
});
