import type {
  AnnualReportAiSectionLocatorRangeV1,
  AnnualReportAiSectionLocatorResultV1,
} from "../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportSourceTextV1 } from "../../shared/contracts/annual-report-source-text.v1";
import {
  extractAnnualReportCoreFactsSeedV1,
  type AnnualReportCoreFactsSeedV1,
} from "./annual-report-core-facts-seed.v1";

type AnnualReportLocatorSectionsV1 = AnnualReportAiSectionLocatorResultV1["sections"];
export type AnnualReportPdfRoutingConfidenceV1 = "low" | "medium" | "high";
export type AnnualReportPreparedPdfRoutingV1 = {
  confidence: AnnualReportPdfRoutingConfidenceV1;
  coreFactsSeed: AnnualReportCoreFactsSeedV1;
  executionRanges: {
    statements: AnnualReportAiSectionLocatorRangeV1[];
    taxNotesAssets: AnnualReportAiSectionLocatorRangeV1[];
    taxNotesFinance: AnnualReportAiSectionLocatorRangeV1[];
  };
  profile: "extractable_text_pdf";
  sections: AnnualReportLocatorSectionsV1;
  usableForDirectExtraction: boolean;
  warnings: string[];
};

type AnnualReportNormalizedPageRangeV1 = {
  endPage: number;
  startPage: number;
};

function normalizePageRangeV1(input: {
  maxPage: number;
  range: AnnualReportAiSectionLocatorRangeV1;
}): AnnualReportNormalizedPageRangeV1 | null {
  const startPage = Math.max(1, Math.min(input.maxPage, input.range.startPage));
  const endPage = Math.max(1, Math.min(input.maxPage, input.range.endPage));
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
    return null;
  }

  if (startPage <= endPage) {
    return {
      startPage,
      endPage,
    };
  }

  return {
    startPage: endPage,
    endPage: startPage,
  };
}

function normalizePageRangesV1(input: {
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportNormalizedPageRangeV1[] {
  const normalized = input.ranges
    .map((range) => normalizePageRangeV1({ maxPage: input.maxPage, range }))
    .filter(
      (range): range is AnnualReportNormalizedPageRangeV1 => range !== null,
    )
    .sort((left, right) => left.startPage - right.startPage);

  if (normalized.length === 0) {
    return [];
  }

  const merged: AnnualReportNormalizedPageRangeV1[] = [normalized[0]];
  for (const next of normalized.slice(1)) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(next);
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

function createPageRangeV1(
  startPage: number,
  endPage: number = startPage,
  confidence = 0.7,
): AnnualReportAiSectionLocatorRangeV1 {
  return {
    startPage,
    endPage,
    confidence,
  };
}

function toLocatorRangesV1(input: {
  confidence?: number;
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  return normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.ranges,
  }).map((range) =>
    createPageRangeV1(
      range.startPage,
      range.endPage,
      input.confidence ?? 0.85,
    ),
  );
}

function formatPageRangesV1(ranges: AnnualReportAiSectionLocatorRangeV1[]): string {
  if (!ranges || ranges.length === 0) {
    return "none";
  }

  const sorted = [...ranges].sort((left, right) => left.startPage - right.startPage);
  return sorted
    .map((range) =>
      range.startPage === range.endPage
        ? `${range.startPage}`
        : `${range.startPage}-${range.endPage}`,
    )
    .join(", ");
}

function linesFromPageTextV1(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

function mergePagesToRangesV1(
  pages: number[],
  confidence = 0.75,
): AnnualReportAiSectionLocatorRangeV1[] {
  const sorted = [...new Set(pages)]
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return [];
  }

  const ranges: AnnualReportAiSectionLocatorRangeV1[] = [];
  let startPage = sorted[0];
  let endPage = sorted[0];

  for (const page of sorted.slice(1)) {
    if (page <= endPage + 1) {
      endPage = page;
      continue;
    }
    ranges.push(createPageRangeV1(startPage, endPage, confidence));
    startPage = page;
    endPage = page;
  }

  ranges.push(createPageRangeV1(startPage, endPage, confidence));
  return ranges;
}

function countCoveredPagesV1(ranges: AnnualReportNormalizedPageRangeV1[]): number {
  return ranges.reduce(
    (sum, range) => sum + (range.endPage - range.startPage + 1),
    0,
  );
}

function rangesOverlapV1(
  left: AnnualReportNormalizedPageRangeV1[],
  right: AnnualReportNormalizedPageRangeV1[],
): boolean {
  return left.some((leftRange) =>
    right.some(
      (rightRange) =>
        leftRange.startPage <= rightRange.endPage &&
        rightRange.startPage <= leftRange.endPage,
    ),
  );
}

function shouldOverrideAiStatementRangesV1(input: {
  aiBalanceSheet: AnnualReportAiSectionLocatorRangeV1[];
  aiIncomeStatement: AnnualReportAiSectionLocatorRangeV1[];
  deterministicBalanceSheet: AnnualReportAiSectionLocatorRangeV1[];
  deterministicIncomeStatement: AnnualReportAiSectionLocatorRangeV1[];
  maxPage: number;
  noteWindow: AnnualReportAiSectionLocatorRangeV1[];
}): boolean {
  const aiRanges = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: [...input.aiIncomeStatement, ...input.aiBalanceSheet],
  });
  const deterministicRanges = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: [...input.deterministicIncomeStatement, ...input.deterministicBalanceSheet],
  });
  const normalizedNoteWindow = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.noteWindow,
  });

  if (aiRanges.length === 0 || deterministicRanges.length === 0) {
    return false;
  }

  const coveredPages = countCoveredPagesV1(aiRanges);
  if (coveredPages > 6) {
    return true;
  }

  if (normalizedNoteWindow.length > 0 && rangesOverlapV1(aiRanges, normalizedNoteWindow)) {
    return true;
  }

  const firstAiPage = aiRanges[0]?.startPage ?? 0;
  const lastAiPage = aiRanges[aiRanges.length - 1]?.endPage ?? 0;
  const firstDeterministicPage = deterministicRanges[0]?.startPage ?? 0;
  const lastDeterministicPage =
    deterministicRanges[deterministicRanges.length - 1]?.endPage ?? 0;

  return (
    Math.abs(firstAiPage - firstDeterministicPage) > 4 ||
    Math.abs(lastAiPage - lastDeterministicPage) > 4
  );
}

function detectTocRangesByLabelV1(input: {
  labels: string[];
  maxPagesToScan?: number;
  pageTexts: string[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  const labelPattern = input.labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const rangePattern = new RegExp(
    `(?:${labelPattern})\\s+(\\d{1,3})(?:\\s*[\\-–]\\s*(\\d{1,3}))?`,
    "i",
  );
  const matches: AnnualReportAiSectionLocatorRangeV1[] = [];
  const maxPagesToScan = Math.min(input.pageTexts.length, input.maxPagesToScan ?? 6);

  for (let pageIndex = 0; pageIndex < maxPagesToScan; pageIndex += 1) {
    for (const line of linesFromPageTextV1(input.pageTexts[pageIndex] ?? "")) {
      const match = line.match(rangePattern);
      if (!match) {
        continue;
      }

      const startPage = Number(match[1]);
      const endPage = Number(match[2] ?? match[1]);
      if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
        continue;
      }

      matches.push(createPageRangeV1(startPage, endPage, 0.95));
    }
  }

  return matches;
}

function detectPagesByHeadingV1(input: {
  pageTexts: string[];
  patterns: RegExp[];
}): number[] {
  const matches: number[] = [];
  input.pageTexts.forEach((text, index) => {
    const normalizedText = text.toLowerCase();
    if (normalizedText.includes("innehåll")) {
      return;
    }
    if (input.patterns.some((pattern) => pattern.test(normalizedText))) {
      matches.push(index + 1);
    }
  });
  return matches;
}

function buildDeterministicCoreFactsRangesV1(
  pageTexts: string[],
): AnnualReportAiSectionLocatorRangeV1[] {
  const pages = [1, 2, 3, 4].filter((page) => page <= pageTexts.length);
  const metadataPattern =
    /(förvaltningsberättelse|årsredovisning|org\.?\s*nr|organisationsnummer|räkenskapsår|\bK2\b|\bK3\b|\d{4}-\d{2}-\d{2})/i;
  if (pageTexts.length >= 5 && metadataPattern.test(pageTexts[4] ?? "")) {
    pages.push(5);
  }
  return mergePagesToRangesV1(pages, 0.9);
}

function detectPagesWithinRangesV1(input: {
  pageTexts: string[];
  patterns: RegExp[];
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): number[] {
  const normalizedRanges = normalizePageRangesV1({
    maxPage: input.pageTexts.length,
    ranges: input.ranges,
  });
  const pages: number[] = [];

  for (const range of normalizedRanges) {
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      const text = (input.pageTexts[page - 1] ?? "").toLowerCase();
      if (input.patterns.some((pattern) => pattern.test(text))) {
        pages.push(page);
      }
    }
  }

  return pages;
}

function preferExistingRangesV1(
  existing: AnnualReportAiSectionLocatorRangeV1[],
  fallback: AnnualReportAiSectionLocatorRangeV1[],
): AnnualReportAiSectionLocatorRangeV1[] {
  return existing.length > 0 ? existing : fallback;
}

function collectPagesFromRangesV1(
  ranges: AnnualReportAiSectionLocatorRangeV1[],
  maxPage: number,
): number[] {
  const pages: number[] = [];
  for (const range of normalizePageRangesV1({ maxPage, ranges })) {
    for (let page = range.startPage; page <= range.endPage; page += 1) {
      pages.push(page);
    }
  }
  return [...new Set(pages)].sort((left, right) => left - right);
}

function excludePagesV1(input: {
  excluded: AnnualReportAiSectionLocatorRangeV1[];
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  const excludedPages = new Set(
    collectPagesFromRangesV1(input.excluded, input.maxPage),
  );
  const keptPages = collectPagesFromRangesV1(input.ranges, input.maxPage).filter(
    (page) => !excludedPages.has(page),
  );
  return mergePagesToRangesV1(keptPages, 0.9);
}

function limitRangesV1(input: {
  maxChunks: number;
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  const normalized = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.ranges,
  });
  return normalized
    .slice(0, input.maxChunks)
    .map((range) => createPageRangeV1(range.startPage, range.endPage, 0.9));
}

function buildExecutionRangesV1(input: {
  maxChunks: number;
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  return limitRangesV1(input);
}

function buildDeterministicStatementRangesV1(input: {
  noteWindow: AnnualReportAiSectionLocatorRangeV1[];
  pageTexts: string[];
}): {
  balanceSheet: AnnualReportAiSectionLocatorRangeV1[];
  combined: AnnualReportAiSectionLocatorRangeV1[];
  excludedNotePages: AnnualReportAiSectionLocatorRangeV1[];
  incomeStatement: AnnualReportAiSectionLocatorRangeV1[];
} {
  const maxPage = input.pageTexts.length;
  const income = [
    ...detectTocRangesByLabelV1({
      pageTexts: input.pageTexts,
      labels: ["Resultaträkning"],
    }),
    ...mergePagesToRangesV1(
      detectPagesByHeadingV1({
        pageTexts: input.pageTexts,
        patterns: [/resultaträkning/i],
      }),
      0.9,
    ),
  ];
  const balance = [
    ...detectTocRangesByLabelV1({
      pageTexts: input.pageTexts,
      labels: ["Balansräkning"],
    }),
    ...mergePagesToRangesV1(
      detectPagesByHeadingV1({
        pageTexts: input.pageTexts,
        patterns: [/balansräkning/i],
      }),
      0.9,
    ),
  ];
  const incomeStatement = excludePagesV1({
    maxPage,
    ranges: income,
    excluded: input.noteWindow,
  });
  const balanceSheet = excludePagesV1({
    maxPage,
    ranges: balance,
    excluded: input.noteWindow,
  });
  const combined = toLocatorRangesV1({
    maxPage,
    ranges: [...incomeStatement, ...balanceSheet],
    confidence: 0.9,
  });
  const excludedNotePages = toLocatorRangesV1({
    maxPage,
    ranges: [...income, ...balance],
    confidence: 0.8,
  }).filter((range) =>
    rangesOverlapV1(
      normalizePageRangesV1({ maxPage, ranges: [range] }),
      normalizePageRangesV1({ maxPage, ranges: input.noteWindow }),
    ),
  );

  return {
    incomeStatement: limitRangesV1({
      maxChunks: 2,
      maxPage,
      ranges: incomeStatement,
    }),
    balanceSheet: limitRangesV1({
      maxChunks: 2,
      maxPage,
      ranges: balanceSheet,
    }),
    combined: limitRangesV1({
      maxChunks: 2,
      maxPage,
      ranges: combined,
    }),
    excludedNotePages,
  };
}

function buildLimitedNoteRangesV1(input: {
  confidence?: number;
  maxChunks?: number;
  pageTexts: string[];
  patterns: RegExp[];
  ranges: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportAiSectionLocatorRangeV1[] {
  return limitRangesV1({
    maxChunks: input.maxChunks ?? 2,
    maxPage: input.pageTexts.length,
    ranges: mergePagesToRangesV1(
      detectPagesWithinRangesV1({
        pageTexts: input.pageTexts,
        ranges: input.ranges,
        patterns: input.patterns,
      }),
      input.confidence ?? 0.8,
    ),
  });
}

function rangesMostlyOutsideWindowV1(input: {
  maxPage: number;
  ranges: AnnualReportAiSectionLocatorRangeV1[];
  window: AnnualReportAiSectionLocatorRangeV1[];
}): boolean {
  const windowPages = new Set(collectPagesFromRangesV1(input.window, input.maxPage));
  if (windowPages.size === 0) {
    return false;
  }
  const rangePages = collectPagesFromRangesV1(input.ranges, input.maxPage);
  const outsidePages = rangePages.filter((page) => !windowPages.has(page));
  return outsidePages.length > 2;
}

function shouldOverrideAiNoteRangesV1(input: {
  aiRanges: AnnualReportAiSectionLocatorRangeV1[];
  deterministicRanges: AnnualReportAiSectionLocatorRangeV1[];
  maxPage: number;
  noteWindow: AnnualReportAiSectionLocatorRangeV1[];
}): boolean {
  const aiNormalized = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.aiRanges,
  });
  const deterministicNormalized = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.deterministicRanges,
  });

  if (aiNormalized.length === 0 || deterministicNormalized.length === 0) {
    return false;
  }

  const aiCoveredPages = countCoveredPagesV1(aiNormalized);
  const deterministicCoveredPages = countCoveredPagesV1(deterministicNormalized);

  if (aiCoveredPages > 8) {
    return true;
  }

  if (
    rangesMostlyOutsideWindowV1({
      maxPage: input.maxPage,
      ranges: input.aiRanges,
      window: input.noteWindow,
    })
  ) {
    return true;
  }

  if (aiNormalized.length > 2) {
    return true;
  }

  return aiCoveredPages > deterministicCoveredPages + 3;
}

function createEmptySectionsV1(): AnnualReportLocatorSectionsV1 {
  return {
    coreFacts: [],
    incomeStatement: [],
    balanceSheet: [],
    taxExpense: [],
    depreciationAndAssets: [],
    reserves: [],
    financeAndInterest: [],
    pensionsAndLeasing: [],
    groupContributionsAndShareholdings: [],
  };
}

function determineRoutingConfidenceV1(input: {
  sections: AnnualReportLocatorSectionsV1;
}): AnnualReportPdfRoutingConfidenceV1 {
  const hasCoreFacts = input.sections.coreFacts.length > 0;
  const hasStatements =
    input.sections.incomeStatement.length + input.sections.balanceSheet.length > 0;
  const hasNotes =
    input.sections.taxExpense.length +
      input.sections.depreciationAndAssets.length +
      input.sections.reserves.length +
      input.sections.financeAndInterest.length +
      input.sections.pensionsAndLeasing.length +
      input.sections.groupContributionsAndShareholdings.length >
    0;

  if (hasCoreFacts && hasStatements && hasNotes) {
    return "high";
  }
  if (hasCoreFacts && hasStatements) {
    return "medium";
  }
  return "low";
}

function shouldOverrideAiCoreFactsRangesV1(input: {
  aiCoreFacts: AnnualReportAiSectionLocatorRangeV1[];
  deterministicCoreFacts: AnnualReportAiSectionLocatorRangeV1[];
  maxPage: number;
  noteWindow: AnnualReportAiSectionLocatorRangeV1[];
  statementRanges: AnnualReportAiSectionLocatorRangeV1[];
}): boolean {
  const aiRanges = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.aiCoreFacts,
  });
  if (aiRanges.length === 0 || input.deterministicCoreFacts.length === 0) {
    return false;
  }

  if (countCoveredPagesV1(aiRanges) > 5) {
    return true;
  }

  const normalizedNotes = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.noteWindow,
  });
  if (normalizedNotes.length > 0 && rangesOverlapV1(aiRanges, normalizedNotes)) {
    return true;
  }

  const normalizedStatements = normalizePageRangesV1({
    maxPage: input.maxPage,
    ranges: input.statementRanges,
  });
  const firstStatementPage = normalizedStatements[0]?.startPage;
  return firstStatementPage !== undefined && (aiRanges[0]?.startPage ?? 0) > firstStatementPage;
}

export function resolveAnnualReportPdfLocatorSectionsV1(input: {
  aiSections: AnnualReportLocatorSectionsV1;
  sourceText: AnnualReportSourceTextV1;
}): {
  executionRanges: AnnualReportPreparedPdfRoutingV1["executionRanges"];
  sections: AnnualReportLocatorSectionsV1;
  warnings: string[];
} {
  if (input.sourceText.fileType !== "pdf" || input.sourceText.pageTexts.length === 0) {
    return {
      executionRanges: {
        statements: [],
        taxNotesAssets: [],
        taxNotesFinance: [],
      },
      sections: input.aiSections,
      warnings: [],
    };
  }

  const pageTexts = input.sourceText.pageTexts;
  const warnings: string[] = [
    `parsing.pdf.parser=${input.sourceText.parserVersion}`,
    `parsing.pdf.text_source=${input.sourceText.textSource}`,
    `parsing.pdf.page_count=${input.sourceText.pageCount}`,
    `parsing.pdf.page_texts=${input.sourceText.pageTexts.length}`,
    ...input.sourceText.warnings,
  ];

  const statementTocRanges = [
    ...detectTocRangesByLabelV1({
      pageTexts,
      labels: ["Resultaträkning"],
    }),
    ...detectTocRangesByLabelV1({
      pageTexts,
      labels: ["Balansräkning"],
    }),
  ];
  const notesWindow = [
    ...detectTocRangesByLabelV1({
      pageTexts,
      labels: ["Bokslutskommentarer"],
    }),
    ...detectTocRangesByLabelV1({
      pageTexts,
      labels: ["Upplysningar till enskilda poster"],
    }),
  ];
  const noteWindowRanges = toLocatorRangesV1({
    maxPage: pageTexts.length,
    ranges: notesWindow,
    confidence: 0.95,
  });
  const deterministicCoreFacts = toLocatorRangesV1({
    maxPage: pageTexts.length,
    ranges: buildDeterministicCoreFactsRangesV1(pageTexts),
    confidence: 0.9,
  });
  const deterministicStatements = buildDeterministicStatementRangesV1({
    pageTexts,
    noteWindow: noteWindowRanges,
  });
  const deterministicIncomeStatement = deterministicStatements.incomeStatement;
  const deterministicBalanceSheet = deterministicStatements.balanceSheet;
  const deterministicTaxExpense = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [/not\s+9\b/i, /skatt på årets resultat/i],
  });
  const deterministicDepreciationAndAssets = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [
      /not\s+8\b/i,
      /not\s+1[0-7]\b/i,
      /utgående planenligt restvärde/i,
    ],
  });
  const deterministicReserves = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [/not\s+8\b/i, /obeskattade reserver/i, /överavskrivningar/i],
  });
  const deterministicFinanceAndInterest = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [
      /not\s+6\b/i,
      /not\s+7\b/i,
      /not\s+1[89]\b/i,
      /not\s+20\b/i,
      /not\s+22\b/i,
      /not\s+24\b/i,
      /not\s+28\b/i,
    ],
  });
  const deterministicPensionsAndLeasing = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [/not\s+[35]\b/i],
  });
  const deterministicGroupContributionsAndShareholdings = buildLimitedNoteRangesV1({
    pageTexts,
    ranges: noteWindowRanges,
    patterns: [
      /not\s+1[89]\b/i,
      /not\s+20\b/i,
    ],
  });
  const overrideAiStatements = shouldOverrideAiStatementRangesV1({
    aiBalanceSheet: input.aiSections.balanceSheet,
    aiIncomeStatement: input.aiSections.incomeStatement,
    deterministicBalanceSheet,
    deterministicIncomeStatement,
    maxPage: pageTexts.length,
    noteWindow: noteWindowRanges,
  });
  const overrideAiCoreFacts = shouldOverrideAiCoreFactsRangesV1({
    aiCoreFacts: input.aiSections.coreFacts,
    deterministicCoreFacts,
    maxPage: pageTexts.length,
    noteWindow: noteWindowRanges,
    statementRanges: [...deterministicIncomeStatement, ...deterministicBalanceSheet],
  });
  const deterministicAssetsRanges = buildExecutionRangesV1({
    maxChunks: 2,
    maxPage: pageTexts.length,
    ranges: [
      ...deterministicTaxExpense,
      ...deterministicDepreciationAndAssets,
      ...deterministicReserves,
    ],
  });
  const deterministicFinanceRanges = buildExecutionRangesV1({
    maxChunks: 2,
    maxPage: pageTexts.length,
    ranges: [
      ...deterministicFinanceAndInterest,
      ...deterministicPensionsAndLeasing,
      ...deterministicGroupContributionsAndShareholdings,
      ...deterministicTaxExpense,
    ],
  });
  const overrideAiAssetsRanges = shouldOverrideAiNoteRangesV1({
    aiRanges: [
      ...input.aiSections.taxExpense,
      ...input.aiSections.depreciationAndAssets,
      ...input.aiSections.reserves,
    ],
    deterministicRanges: deterministicAssetsRanges,
    maxPage: pageTexts.length,
    noteWindow: noteWindowRanges,
  });
  const overrideAiFinanceRanges = shouldOverrideAiNoteRangesV1({
    aiRanges: [
      ...input.aiSections.financeAndInterest,
      ...input.aiSections.pensionsAndLeasing,
      ...input.aiSections.groupContributionsAndShareholdings,
      ...input.aiSections.taxExpense,
    ],
    deterministicRanges: deterministicFinanceRanges,
    maxPage: pageTexts.length,
    noteWindow: noteWindowRanges,
  });

  const sections: AnnualReportLocatorSectionsV1 = {
    ...input.aiSections,
    coreFacts:
      overrideAiCoreFacts
        ? deterministicCoreFacts
        : preferExistingRangesV1(input.aiSections.coreFacts, deterministicCoreFacts),
    incomeStatement:
      overrideAiStatements
        ? deterministicIncomeStatement
        : preferExistingRangesV1(
            input.aiSections.incomeStatement,
            deterministicIncomeStatement,
          ),
    balanceSheet:
      overrideAiStatements
        ? deterministicBalanceSheet
        : preferExistingRangesV1(
            input.aiSections.balanceSheet,
            deterministicBalanceSheet,
          ),
    taxExpense: preferExistingRangesV1(
      overrideAiAssetsRanges || overrideAiFinanceRanges
        ? []
        : input.aiSections.taxExpense,
      deterministicTaxExpense,
    ),
    depreciationAndAssets: preferExistingRangesV1(
      overrideAiAssetsRanges ? [] : input.aiSections.depreciationAndAssets,
      deterministicDepreciationAndAssets,
    ),
    reserves: preferExistingRangesV1(
      overrideAiAssetsRanges ? [] : input.aiSections.reserves,
      deterministicReserves,
    ),
    financeAndInterest: preferExistingRangesV1(
      overrideAiFinanceRanges ? [] : input.aiSections.financeAndInterest,
      deterministicFinanceAndInterest,
    ),
    pensionsAndLeasing: preferExistingRangesV1(
      overrideAiFinanceRanges ? [] : input.aiSections.pensionsAndLeasing,
      deterministicPensionsAndLeasing,
    ),
    groupContributionsAndShareholdings: preferExistingRangesV1(
      overrideAiFinanceRanges
        ? []
        : input.aiSections.groupContributionsAndShareholdings,
      deterministicGroupContributionsAndShareholdings,
    ),
  };

  const aiStatementRangeCount =
    input.aiSections.incomeStatement.length + input.aiSections.balanceSheet.length;
  if (input.aiSections.coreFacts.length === 0) {
    warnings.push("locator.ai.core_facts_ranges=0");
  }
  if (aiStatementRangeCount === 0) {
    warnings.push("locator.ai.statement_ranges=0");
  }
  if (overrideAiCoreFacts) {
    warnings.push(
      `routing.core_facts.ai_implausible=pages ${formatPageRangesV1(
        toLocatorRangesV1({
          maxPage: pageTexts.length,
          ranges: input.aiSections.coreFacts,
          confidence: 0.8,
        }),
      )}`,
    );
  }
  if ((input.aiSections.coreFacts.length === 0 || overrideAiCoreFacts) && sections.coreFacts.length > 0) {
    warnings.push(
      `locator.fallback.core_facts_ranges=pages ${formatPageRangesV1(sections.coreFacts)}`,
    );
  }
  if (sections.coreFacts.length > 0) {
    warnings.push(
      `routing.core_facts.selected=pages ${formatPageRangesV1(sections.coreFacts)} source=${
        input.aiSections.coreFacts.length > 0 && !overrideAiCoreFacts ? "ai" : "deterministic"
      }`,
    );
  }
  if (overrideAiStatements) {
    warnings.push(
      `routing.statements.ai_implausible=pages ${formatPageRangesV1([
        ...input.aiSections.incomeStatement,
        ...input.aiSections.balanceSheet,
      ])}`,
    );
  }
  if (overrideAiAssetsRanges || overrideAiFinanceRanges) {
    warnings.push(
      `routing.tax_notes.ai_implausible=pages ${formatPageRangesV1(
        toLocatorRangesV1({
          maxPage: pageTexts.length,
          ranges: [
            ...(overrideAiAssetsRanges
              ? [
                  ...input.aiSections.taxExpense,
                  ...input.aiSections.depreciationAndAssets,
                  ...input.aiSections.reserves,
                ]
              : []),
            ...(overrideAiFinanceRanges
              ? [
                  ...input.aiSections.financeAndInterest,
                  ...input.aiSections.pensionsAndLeasing,
                  ...input.aiSections.groupContributionsAndShareholdings,
                  ...input.aiSections.taxExpense,
                ]
              : []),
          ],
          confidence: 0.8,
        }),
      )}`,
    );
  }

  const finalStatementRanges = deterministicStatements.combined.length > 0 &&
    (aiStatementRangeCount === 0 || overrideAiStatements)
      ? deterministicStatements.combined
      : toLocatorRangesV1({
          maxPage: pageTexts.length,
          ranges: [...sections.incomeStatement, ...sections.balanceSheet],
          confidence: 0.9,
        });
  if ((aiStatementRangeCount === 0 || overrideAiStatements) && finalStatementRanges.length > 0) {
    warnings.push(`locator.fallback.statement_ranges=pages ${formatPageRangesV1(finalStatementRanges)}`);
    warnings.push(`routing.statements.selected=pages ${formatPageRangesV1(finalStatementRanges)} source=deterministic`);
  }
  if (deterministicStatements.excludedNotePages.length > 0) {
    warnings.push(
      `routing.statements.excluded_note_pages=${formatPageRangesV1(
        deterministicStatements.excludedNotePages,
      )}`,
    );
  }

  const aiNoteRangeCount =
    input.aiSections.taxExpense.length +
    input.aiSections.depreciationAndAssets.length +
    input.aiSections.reserves.length +
    input.aiSections.financeAndInterest.length +
    input.aiSections.pensionsAndLeasing.length +
    input.aiSections.groupContributionsAndShareholdings.length;

  if (aiNoteRangeCount === 0 && noteWindowRanges.length > 0) {
    warnings.push(`locator.fallback.note_window=pages ${formatPageRangesV1(noteWindowRanges)}`);
  }
  if (statementTocRanges.length > 0) {
    warnings.push(
      `locator.fallback.statement_toc=pages ${formatPageRangesV1(
        toLocatorRangesV1({
          maxPage: pageTexts.length,
          ranges: statementTocRanges,
          confidence: 0.95,
        }),
      )}`,
    );
  }

  const finalAssetsRanges = buildExecutionRangesV1({
    maxChunks: 2,
    maxPage: pageTexts.length,
    ranges: [
      ...sections.taxExpense,
      ...sections.depreciationAndAssets,
      ...sections.reserves,
    ],
  });
  const finalFinanceRanges = buildExecutionRangesV1({
    maxChunks: 2,
    maxPage: pageTexts.length,
    ranges: [
      ...sections.financeAndInterest,
      ...sections.pensionsAndLeasing,
      ...sections.groupContributionsAndShareholdings,
      ...sections.taxExpense,
    ],
  });
  if (finalAssetsRanges.length > 0) {
    warnings.push(
      `routing.tax_notes_assets.final=pages ${formatPageRangesV1(finalAssetsRanges)}`,
      `routing.tax_notes_assets.selected=pages ${formatPageRangesV1(finalAssetsRanges)} source=${
        overrideAiAssetsRanges || aiNoteRangeCount === 0 ? "deterministic" : "ai"
      }`,
    );
  }
  if (finalFinanceRanges.length > 0) {
    warnings.push(
      `routing.tax_notes_finance.final=pages ${formatPageRangesV1(finalFinanceRanges)}`,
      `routing.tax_notes_finance.selected=pages ${formatPageRangesV1(finalFinanceRanges)} source=${
        overrideAiFinanceRanges || aiNoteRangeCount === 0 ? "deterministic" : "ai"
      }`,
    );
  }

  return {
    executionRanges: {
      statements: finalStatementRanges,
      taxNotesAssets: finalAssetsRanges,
      taxNotesFinance: finalFinanceRanges,
    },
    sections,
    warnings,
  };
}

export function prepareAnnualReportPdfRoutingV1(input: {
  sourceText: AnnualReportSourceTextV1;
}): AnnualReportPreparedPdfRoutingV1 {
  const resolved = resolveAnnualReportPdfLocatorSectionsV1({
    aiSections: createEmptySectionsV1(),
    sourceText: input.sourceText,
  });
  const confidence = determineRoutingConfidenceV1({
    sections: resolved.sections,
  });
  const coreFactsSeed = extractAnnualReportCoreFactsSeedV1({
    sourceText: input.sourceText,
    coreFactsRanges: resolved.sections.coreFacts,
    statementRanges: [
      ...resolved.sections.incomeStatement,
      ...resolved.sections.balanceSheet,
    ],
  });
  const usableForDirectExtraction =
    resolved.sections.coreFacts.length > 0 &&
    (resolved.sections.incomeStatement.length > 0 ||
      resolved.sections.balanceSheet.length > 0);

  return {
    confidence,
    coreFactsSeed,
    executionRanges: resolved.executionRanges,
    profile: "extractable_text_pdf",
    sections: resolved.sections,
    usableForDirectExtraction,
    warnings: [
      ...resolved.warnings,
      `routing.confidence=${confidence}`,
      usableForDirectExtraction
        ? "routing.usable_for_direct_extraction=true"
        : "routing.usable_for_direct_extraction=false",
    ],
  };
}
