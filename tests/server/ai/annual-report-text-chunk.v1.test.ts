import { describe, expect, it } from "vitest";

import { extractAnnualReportTextChunkDocumentsV1 } from "../../../src/server/ai/document-prep/annual-report-text-chunk.v1";
import { parseAnnualReportSourceTextV1 } from "../../../src/shared/contracts/annual-report-source-text.v1";

describe("annual report text chunk documents v1", () => {
  it("splits routed extractable-text pages into deterministic text chunks", () => {
    const pageTexts = [
      "Page 1",
      "Resultaträkning\nNettoomsättning 1000",
      "Balansräkning\nKassa och bank 200",
      "Not 9 Skatt på årets resultat\nAktuell skatt 20",
      "Not 18 Andelar i koncernföretag\nInnehav 50",
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
        averageCharsPerPage: 60,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const chunks = extractAnnualReportTextChunkDocumentsV1({
      document: {
        fileType: "pdf",
        mimeType: "text/plain",
        executionProfile: "extractable_text_pdf",
        sourceText,
        text: pageTexts.join("\n\n"),
      },
      ranges: [
        { startPage: 2, endPage: 3, confidence: 0.9 },
        { startPage: 4, endPage: 5, confidence: 0.9 },
      ],
      maxPagesPerChunk: 2,
      maxCharsPerChunk: 80,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.pageRanges).toEqual([
      { startPage: 2, endPage: 2 },
      { startPage: 3, endPage: 3 },
    ]);
    expect(chunks[0]?.text).toContain("[Page 2]");
    expect(chunks[0]?.text).toContain("[Page 3]");
    expect(chunks[1]?.pageRanges).toEqual([
      { startPage: 4, endPage: 4 },
      { startPage: 5, endPage: 5 },
    ]);
    expect(chunks[1]?.text).toContain("[Page 4]");
    expect(chunks[1]?.text).toContain("[Page 5]");
  });
});
