import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import {
  extractAnnualReportPdfChunkDocumentsV1,
  normalizeAnnualReportPageRangesV1,
} from "../../../src/server/ai/document-prep/annual-report-pdf-chunk.v1";

async function createPdfBytesV1(pageCount: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([595, 842]);
  }
  return document.save();
}

describe("annual report pdf chunking v1", () => {
  it("normalizes and merges overlapping page ranges", () => {
    const ranges = normalizeAnnualReportPageRangesV1({
      maxPage: 12,
      ranges: [
        { startPage: 2, endPage: 4, confidence: 0.9 },
        { startPage: 4, endPage: 6, confidence: 0.8 },
        { startPage: 9, endPage: 10, confidence: 0.7 },
      ],
    });

    expect(ranges).toEqual([
      { startPage: 2, endPage: 6 },
      { startPage: 9, endPage: 10 },
    ]);
  });

  it("keeps disjoint ranges separate", () => {
    const ranges = normalizeAnnualReportPageRangesV1({
      maxPage: 12,
      ranges: [
        { startPage: 1, endPage: 1, confidence: 0.9 },
        { startPage: 3, endPage: 4, confidence: 0.8 },
      ],
    });

    expect(ranges).toEqual([
      { startPage: 1, endPage: 1 },
      { startPage: 3, endPage: 4 },
    ]);
  });

  it("clamps out-of-bounds ranges to valid pages", () => {
    const ranges = normalizeAnnualReportPageRangesV1({
      maxPage: 5,
      ranges: [{ startPage: -3, endPage: 999, confidence: 0.8 }],
    });

    expect(ranges).toEqual([{ startPage: 1, endPage: 5 }]);
  });

  it("extracts mini-pdf chunks with bounded page counts", async () => {
    const pdfBytes = await createPdfBytesV1(5);
    const chunks = await extractAnnualReportPdfChunkDocumentsV1({
      pdfBytes,
      maxPagesPerChunk: 2,
      ranges: [{ startPage: 1, endPage: 5, confidence: 0.9 }],
    });

    expect(chunks.map((chunk) => chunk.pageRanges)).toEqual([
      [{ startPage: 1, endPage: 2 }],
      [{ startPage: 3, endPage: 4 }],
      [{ startPage: 5, endPage: 5 }],
    ]);

    const chunkPageCounts: number[] = [];
    for (const chunk of chunks) {
      const parsed = await PDFDocument.load(chunk.pdfBytes);
      chunkPageCounts.push(parsed.getPageCount());
    }
    expect(chunkPageCounts).toEqual([2, 2, 1]);
  });
});
