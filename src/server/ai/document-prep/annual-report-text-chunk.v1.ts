import type { AnnualReportAiSectionLocatorRangeV1 } from "../../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportPreparedDocumentV1 } from "./annual-report-document.v1";
import { normalizeAnnualReportPageRangesV1 } from "./annual-report-pdf-chunk.v1";

export type AnnualReportTextChunkDocumentV1 = {
  pageRanges: Array<{
    startPage: number;
    endPage: number;
  }>;
  text: string;
};

function formatPagePrefixV1(startPage: number, endPage: number): string {
  return startPage === endPage
    ? `[Page ${startPage}]`
    : `[Pages ${startPage}-${endPage}]`;
}

export function extractAnnualReportTextChunkDocumentsV1(input: {
  document: AnnualReportPreparedDocumentV1;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
  maxCharsPerChunk: number;
  maxPagesPerChunk: number;
}): AnnualReportTextChunkDocumentV1[] {
  if (
    input.document.fileType !== "pdf" ||
    !input.document.sourceText ||
    input.document.sourceText.fileType !== "pdf" ||
    input.document.sourceText.pageTexts.length === 0
  ) {
    return [];
  }

  const normalizedRanges = normalizeAnnualReportPageRangesV1({
    maxPage: input.document.sourceText.pageTexts.length,
    ranges: input.ranges,
  });
  if (normalizedRanges.length === 0) {
    return [];
  }

  const maxPagesPerChunk = Math.max(1, Math.floor(input.maxPagesPerChunk));
  const maxCharsPerChunk = Math.max(1_500, Math.floor(input.maxCharsPerChunk));
  const chunks: AnnualReportTextChunkDocumentV1[] = [];
  let currentChunk: AnnualReportTextChunkDocumentV1 = {
    pageRanges: [],
    text: "",
  };

  const flushCurrentChunk = () => {
    if (currentChunk.pageRanges.length === 0 || currentChunk.text.trim().length === 0) {
      currentChunk = {
        pageRanges: [],
        text: "",
      };
      return;
    }

    chunks.push(currentChunk);
    currentChunk = {
      pageRanges: [],
      text: "",
    };
  };

  for (const range of normalizedRanges) {
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      const pageText = input.document.sourceText.pageTexts[page - 1]?.trim() ?? "";
      if (pageText.length === 0) {
        continue;
      }

      const pageBlock = `${formatPagePrefixV1(page, page)}\n${pageText}`;
      const nextRange = {
        startPage: page,
        endPage: page,
      };
      const currentPageCount = currentChunk.pageRanges.reduce(
        (sum, chunkRange) => sum + (chunkRange.endPage - chunkRange.startPage + 1),
        0,
      );
      const shouldFlushBeforeAdd =
        currentChunk.pageRanges.length > 0 &&
        (currentPageCount >= maxPagesPerChunk ||
          currentChunk.text.length + pageBlock.length + 2 > maxCharsPerChunk);

      if (shouldFlushBeforeAdd) {
        flushCurrentChunk();
      }

      currentChunk.pageRanges.push(nextRange);
      currentChunk.text = currentChunk.text.length > 0
        ? `${currentChunk.text}\n\n${pageBlock}`
        : pageBlock;
    }
  }

  flushCurrentChunk();
  return chunks;
}
