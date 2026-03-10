import type { AnnualReportAiSectionLocatorRangeV1 } from "../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportSourceTextV1 } from "../../shared/contracts/annual-report-source-text.v1";
import type { AnnualReportCoreFactsSeedV1 } from "./annual-report-core-facts-seed.v1";

const CORE_FACTS_COMPACT_MAX_LINES_V1 = 24;
const CORE_FACTS_COMPACT_MAX_CHARS_V1 = 2_400;
const CORE_FACTS_CONTEXT_RADIUS_V1 = 1;

export type AnnualReportCoreFactsCompactTextV1 = {
  diagnostics: string[];
  lineCount: number;
  seedFieldCount: number;
  text: string;
};

function uniquePagesFromRangesV1(
  ranges: AnnualReportAiSectionLocatorRangeV1[],
  maxPage: number,
): number[] {
  const pages = new Set<number>();
  for (const range of ranges) {
    const startPage = Math.max(1, Math.min(maxPage, range.startPage));
    const endPage = Math.max(1, Math.min(maxPage, range.endPage));
    for (let page = Math.min(startPage, endPage); page <= Math.max(startPage, endPage); page += 1) {
      pages.add(page);
    }
  }
  return [...pages].sort((left, right) => left - right);
}

function isHighSignalLineV1(line: string): boolean {
  return /årsredovisning|förvaltningsberättelse|org\.?\s*nr|organisationsnummer|räkenskapsår|\bk2\b|\bk3\b|resultat\s+f[oö]re\s+skatt|aktiebolag|\bab\b/i.test(
    line,
  );
}

function trimToMaxCharsV1(lines: string[], maxChars: number): string[] {
  const selected: string[] = [];
  let totalChars = 0;
  for (const line of lines) {
    const nextChars = totalChars + line.length + (selected.length > 0 ? 2 : 0);
    if (nextChars > maxChars) {
      break;
    }
    selected.push(line);
    totalChars = nextChars;
  }
  return selected;
}

export function buildAnnualReportCoreFactsCompactTextV1(input: {
  coreFactsRanges: AnnualReportAiSectionLocatorRangeV1[];
  seed: AnnualReportCoreFactsSeedV1;
  sourceText: AnnualReportSourceTextV1;
}): AnnualReportCoreFactsCompactTextV1 {
  if (input.sourceText.fileType !== "pdf" || input.sourceText.pageTexts.length === 0) {
    return {
      diagnostics: [
        "core_facts.compact_lines=0",
        "core_facts.compact_chars=0",
        "core_facts.seed_fields=0",
      ],
      lineCount: 0,
      seedFieldCount: 0,
      text: "",
    };
  }

  const pages = uniquePagesFromRangesV1(
    input.coreFactsRanges,
    input.sourceText.pageTexts.length,
  );
  const included = new Set<string>();
  const orderedLines: string[] = [];

  for (const page of pages) {
    const lines = (input.sourceText.pageTexts[page - 1] ?? "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0);

    lines.forEach((line, lineIndex) => {
      if (!isHighSignalLineV1(line)) {
        return;
      }

      const start = Math.max(0, lineIndex - CORE_FACTS_CONTEXT_RADIUS_V1);
      const end = Math.min(lines.length - 1, lineIndex + CORE_FACTS_CONTEXT_RADIUS_V1);
      for (let index = start; index <= end; index += 1) {
        const candidate = lines[index];
        const key = `${page}:${candidate}`;
        if (included.has(key)) {
          continue;
        }
        included.add(key);
        orderedLines.push(candidate);
      }
    });
  }

  const seededValues = new Set(
    Object.values(input.seed.fields)
      .map((field) => field?.valueText?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  for (const seededValue of seededValues) {
    if (!orderedLines.some((line) => line.includes(seededValue))) {
      orderedLines.unshift(seededValue);
    }
  }

  const dedupedLines = [...new Set(orderedLines)].slice(0, CORE_FACTS_COMPACT_MAX_LINES_V1);
  const trimmedLines = trimToMaxCharsV1(dedupedLines, CORE_FACTS_COMPACT_MAX_CHARS_V1);
  const text = trimmedLines.join("\n");
  const seedFieldCount = Object.values(input.seed.fields).filter(Boolean).length;

  return {
    diagnostics: [
      `core_facts.compact_lines=${trimmedLines.length}`,
      `core_facts.compact_chars=${text.length}`,
      `core_facts.seed_fields=${seedFieldCount}`,
    ],
    lineCount: trimmedLines.length,
    seedFieldCount,
    text,
  };
}
