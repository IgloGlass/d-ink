import { PDFDocument } from "pdf-lib";

import type { AnnualReportAiSectionLocatorRangeV1 } from "../../../shared/contracts/annual-report-ai.v1";

export type AnnualReportNormalizedPageRangeV1 = {
  endPage: number;
  startPage: number;
};

export type AnnualReportPdfChunkDocumentV1 = {
  pageRanges: AnnualReportNormalizedPageRangeV1[];
  pdfBytes: Uint8Array;
};

function normalizeRangeV1(input: {
  maxPage: number;
  range: AnnualReportAiSectionLocatorRangeV1;
}): AnnualReportNormalizedPageRangeV1 | null {
  const start = Math.max(1, Math.min(input.maxPage, input.range.startPage));
  const end = Math.max(1, Math.min(input.maxPage, input.range.endPage));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  if (start <= end) {
    return { startPage: start, endPage: end };
  }
  return { startPage: end, endPage: start };
}

export function normalizeAnnualReportPageRangesV1(input: {
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportNormalizedPageRangeV1[] {
  const normalized = input.ranges
    .map((range) => normalizeRangeV1({ range, maxPage: input.maxPage }))
    .filter(
      (range): range is AnnualReportNormalizedPageRangeV1 => range !== null,
    )
    .sort((left, right) => left.startPage - right.startPage);

  if (normalized.length === 0) {
    return [];
  }

  const merged: AnnualReportNormalizedPageRangeV1[] = [normalized[0]];
  for (let index = 1; index < normalized.length; index += 1) {
    const next = normalized[index];
    const previous = merged[merged.length - 1];
    if (!previous || !next) {
      continue;
    }

    if (next.startPage <= previous.endPage + 1) {
      previous.endPage = Math.max(previous.endPage, next.endPage);
      continue;
    }

    merged.push(next);
  }

  return merged;
}

function rangePageCountV1(range: AnnualReportNormalizedPageRangeV1): number {
  return range.endPage - range.startPage + 1;
}

export function splitAnnualReportPageRangesForRetryV1(input: {
  maxPagesPerChunk: number;
  ranges: AnnualReportNormalizedPageRangeV1[];
}): AnnualReportNormalizedPageRangeV1[] {
  const maxPages = Math.max(1, Math.floor(input.maxPagesPerChunk));
  const output: AnnualReportNormalizedPageRangeV1[] = [];
  for (const range of input.ranges) {
    let cursor = range.startPage;
    while (cursor <= range.endPage) {
      const endPage = Math.min(range.endPage, cursor + maxPages - 1);
      output.push({
        startPage: cursor,
        endPage,
      });
      cursor = endPage + 1;
    }
  }
  return output;
}

function chunkRangesByPageCountV1(input: {
  maxPagesPerChunk: number;
  ranges: AnnualReportNormalizedPageRangeV1[];
}): AnnualReportNormalizedPageRangeV1[][] {
  const chunks: AnnualReportNormalizedPageRangeV1[][] = [];
  const maxPages = Math.max(1, Math.floor(input.maxPagesPerChunk));
  let current: AnnualReportNormalizedPageRangeV1[] = [];
  let currentPages = 0;

  for (const range of input.ranges) {
    const rangePages = rangePageCountV1(range);
    if (currentPages > 0 && currentPages + rangePages > maxPages) {
      chunks.push(current);
      current = [];
      currentPages = 0;
    }
    current.push(range);
    currentPages += rangePages;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export async function extractAnnualReportPdfChunkDocumentsV1(input: {
  maxPagesPerChunk: number;
  pdfBytes: Uint8Array;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): Promise<AnnualReportPdfChunkDocumentV1[]> {
  const sourceDocument = await PDFDocument.load(input.pdfBytes);
  const pageCount = sourceDocument.getPageCount();
  const normalizedRanges = normalizeAnnualReportPageRangesV1({
    maxPage: pageCount,
    ranges: input.ranges,
  });
  if (normalizedRanges.length === 0) {
    return [];
  }

  const splitRanges = splitAnnualReportPageRangesForRetryV1({
    ranges: normalizedRanges,
    maxPagesPerChunk: Math.max(1, Math.floor(input.maxPagesPerChunk)),
  });
  const chunkedRanges = chunkRangesByPageCountV1({
    ranges: splitRanges,
    maxPagesPerChunk: Math.max(1, Math.floor(input.maxPagesPerChunk)),
  });
  const output: AnnualReportPdfChunkDocumentV1[] = [];

  for (const chunkRanges of chunkedRanges) {
    const chunkDocument = await PDFDocument.create();
    for (const range of chunkRanges) {
      const pageIndexes: number[] = [];
      for (let page = range.startPage; page <= range.endPage; page += 1) {
        pageIndexes.push(page - 1);
      }
      const pages = await chunkDocument.copyPages(sourceDocument, pageIndexes);
      for (const page of pages) {
        chunkDocument.addPage(page);
      }
    }
    output.push({
      pageRanges: chunkRanges,
      pdfBytes: await chunkDocument.save(),
    });
  }

  return output;
}
