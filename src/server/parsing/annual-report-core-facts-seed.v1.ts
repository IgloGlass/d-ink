import type { AnnualReportAiSectionLocatorRangeV1 } from "../../shared/contracts/annual-report-ai.v1";
import type { AnnualReportSourceTextV1 } from "../../shared/contracts/annual-report-source-text.v1";

export type AnnualReportCoreFactSeedFieldV1 = {
  normalizedValue?: "K2" | "K3" | number | string;
  page?: number;
  valueText: string;
};

export type AnnualReportCoreFactsSeedV1 = {
  diagnostics: string[];
  fields: Partial<{
    accountingStandard: AnnualReportCoreFactSeedFieldV1;
    companyName: AnnualReportCoreFactSeedFieldV1;
    fiscalYearEnd: AnnualReportCoreFactSeedFieldV1;
    fiscalYearStart: AnnualReportCoreFactSeedFieldV1;
    organizationNumber: AnnualReportCoreFactSeedFieldV1;
    profitBeforeTax: AnnualReportCoreFactSeedFieldV1;
  }>;
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

function extractOrganizationNumberV1(text: string): string | undefined {
  const explicitMatch = text.match(
    /(?:org\.?\s*nr|organisationsnummer)\s*[:.]?\s*(\d{6}-\d{4})/i,
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1];
  }
  const genericMatch = text.match(/\b\d{6}-\d{4}\b/);
  return genericMatch?.[0];
}

function extractAccountingStandardV1(text: string): "K2" | "K3" | undefined {
  const match = text.match(
    /\b(K2|K3)\b|(?:regelverk|årsredovisningslagen|uppr[äa]ttad enligt|bfnar|k-regelverk|[åa]rsredovisningen har uppr[äa]ttats)\s*[:.]?\s*(?:enligt\s*)?(K2|K3)|BFNAR\s*\d{4}:\d+\s*\((K2|K3)\)/i,
  );
  const normalized = (match?.[1] ?? match?.[2] ?? match?.[3])?.toUpperCase();
  return normalized === "K2" || normalized === "K3" ? normalized : undefined;
}

function normalizeDateCandidateV1(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const normalized = trimmed.replace(/[./]/g, "-");
  const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const dateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return undefined;
  }

  return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
}

function normalizeMonthNameV1(value: string): string | undefined {
  switch (value.trim().toLowerCase()) {
    case "januari":
      return "01";
    case "februari":
      return "02";
    case "mars":
      return "03";
    case "april":
      return "04";
    case "maj":
      return "05";
    case "juni":
      return "06";
    case "juli":
      return "07";
    case "augusti":
      return "08";
    case "september":
      return "09";
    case "oktober":
      return "10";
    case "november":
      return "11";
    case "december":
      return "12";
    default:
      return undefined;
  }
}

function normalizeWrittenDateCandidateV1(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d{1,2})\s+([A-Za-zåäöÅÄÖ]+)\s+(\d{4})/i);
  if (!match) {
    return undefined;
  }

  const month = normalizeMonthNameV1(match[2]);
  if (!month) {
    return undefined;
  }

  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function extractFiscalYearV1(text: string): {
  end?: string;
  start?: string;
} {
  const patterns = [
    /(?:r[äa]kenskaps[åa]r|fiscal\s+year)?\s*:?\s*(\d{4}[-./]?\d{2}[-./]?\d{2})\s*(?:-|–|till|to)\s*(\d{4}[-./]?\d{2}[-./]?\d{2})/i,
    /(?:fr[åa]n)\s*(\d{4}[-./]?\d{2}[-./]?\d{2})\s*(?:till|-|–)\s*(\d{4}[-./]?\d{2}[-./]?\d{2})/i,
    /(?:r[äa]kenskaps[åa]ret\s+omfattar|verksamhets[åa]r(?:et)?)\s*(\d{4}[-./]?\d{2}[-./]?\d{2})\s*(?:-|–|till)\s*(\d{4}[-./]?\d{2}[-./]?\d{2})/i,
    /(\d{4}[-./]?\d{2}[-./]?\d{2})\s*[–-]\s*(\d{4}[-./]?\d{2}[-./]?\d{2})\s*(?:r[äa]kenskaps[åa]r|verksamhets[åa]r)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const start = normalizeDateCandidateV1(match?.[1]);
    const end = normalizeDateCandidateV1(match?.[2]);
    if (!start || !end) {
      continue;
    }

    return {
      start,
      end,
    };
  }

  const writtenPatterns = [
    /(?:för\s+r[äa]kenskaps[åa]ret|r[äa]kenskaps[åa]r(?:et)?|verksamhets[åa]r(?:et)?)\s*(\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4})\s*(?:-|–|till)\s*(\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4})/i,
    /(\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4})\s*(?:-|–|till)\s*(\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4})/i,
  ];

  for (const pattern of writtenPatterns) {
    const match = text.match(pattern);
    const start = normalizeWrittenDateCandidateV1(match?.[1]);
    const end = normalizeWrittenDateCandidateV1(match?.[2]);
    if (!start || !end) {
      continue;
    }

    return { start, end };
  }

  const yearOnlyMatch = text.match(
    /(?:r[äa]kenskaps[åa]r|fiscal\s+year)\s*:?\s*(\d{4})\s*(?:-|\/)\s*(\d{4})/i,
  );
  if (!yearOnlyMatch) {
    return {};
  }

  return {
    start: `${yearOnlyMatch[1]}-01-01`,
    end: `${yearOnlyMatch[2]}-12-31`,
  };
}

function extractCompanyNameV1(lines: string[]): string | undefined {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 120) {
      continue;
    }
    if (/årsredovisning|org\.?\s*nr|organisationsnummer|räkenskapsår/i.test(trimmed)) {
      continue;
    }
    if (/\bAB\b/.test(trimmed) || /aktiebolag/i.test(trimmed)) {
      return trimmed.replace(/\s+/g, " ");
    }
  }
  return undefined;
}

function extractProfitBeforeTaxV1(text: string): number | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (!/(?:resultat\s+f(?:[oö]re|ore)\s+skatt|profit\s+before\s+tax)/i.test(line)) {
      continue;
    }

    const tail = line.replace(
      /.*?(?:resultat\s+f(?:[oö]re|ore)\s+skatt|profit\s+before\s+tax)\s*[:.]?\s*/i,
      "",
    );
    const decimalCandidates = [...tail.matchAll(/[+\-–]?\d+(?:[.,]\d+)?/g)];
    if (decimalCandidates.length === 1 && !tail.includes(" ")) {
      const parsed = Number(
        decimalCandidates[0][0].replace(/[–−]/g, "-").replace(",", "."),
      );
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const groupedTokens = tail
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => /^[+\-–]?\d{1,3}$/.test(token));
    if (groupedTokens.length > 0) {
      const firstNumberTokens =
        groupedTokens.length <= 2
          ? groupedTokens
          : groupedTokens.length % 2 === 0
            ? groupedTokens.slice(0, groupedTokens.length / 2)
            : [groupedTokens[0]];
      const parsed = Number(
        firstNumberTokens.join("").replace(/[–−]/g, "-"),
      );
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const compactCandidate = tail.match(/[+\-–]?\d[\d\s]*(?:[.,]\d+)?/);
    if (compactCandidate?.[0]) {
      const normalized = compactCandidate[0]
        .replace(/[–−]/g, "-")
        .replace(/\s+/g, "")
        .replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

export function extractAnnualReportCoreFactsSeedV1(input: {
  coreFactsRanges: AnnualReportAiSectionLocatorRangeV1[];
  sourceText: AnnualReportSourceTextV1;
  statementRanges?: AnnualReportAiSectionLocatorRangeV1[];
}): AnnualReportCoreFactsSeedV1 {
  if (input.sourceText.fileType !== "pdf" || input.sourceText.pageTexts.length === 0) {
    return {
      diagnostics: [],
      fields: {},
    };
  }

  const fields: AnnualReportCoreFactsSeedV1["fields"] = {};
  const diagnostics: string[] = [];
  const coreFactsPages = uniquePagesFromRangesV1(
    input.coreFactsRanges,
    input.sourceText.pageTexts.length,
  );

  for (const page of coreFactsPages) {
    const pageText = input.sourceText.pageTexts[page - 1] ?? "";
    const lines = pageText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (!fields.organizationNumber) {
      const organizationNumber = extractOrganizationNumberV1(pageText);
      if (organizationNumber) {
        fields.organizationNumber = {
          page,
          valueText: organizationNumber,
        };
      }
    }

    if (!fields.accountingStandard) {
      const accountingStandard = extractAccountingStandardV1(pageText);
      if (accountingStandard) {
        fields.accountingStandard = {
          normalizedValue: accountingStandard,
          page,
          valueText: accountingStandard,
        };
      }
    }

    if (!fields.companyName) {
      const companyName = extractCompanyNameV1(lines);
      if (companyName) {
        fields.companyName = {
          page,
          valueText: companyName,
        };
      }
    }

    if (!fields.fiscalYearStart || !fields.fiscalYearEnd) {
      const fiscalYear = extractFiscalYearV1(pageText);
      if (fiscalYear.start && fiscalYear.end) {
        fields.fiscalYearStart = {
          normalizedValue: fiscalYear.start,
          page,
          valueText: fiscalYear.start,
        };
        fields.fiscalYearEnd = {
          normalizedValue: fiscalYear.end,
          page,
          valueText: fiscalYear.end,
        };
      }
    }
  }

  if (!fields.accountingStandard) {
    for (let page = 1; page <= input.sourceText.pageTexts.length; page += 1) {
      const accountingStandard = extractAccountingStandardV1(
        input.sourceText.pageTexts[page - 1] ?? "",
      );
      if (accountingStandard) {
        fields.accountingStandard = {
          normalizedValue: accountingStandard,
          page,
          valueText: accountingStandard,
        };
        break;
      }
    }
  }

  if (!fields.fiscalYearStart || !fields.fiscalYearEnd) {
    for (let page = 1; page <= input.sourceText.pageTexts.length; page += 1) {
      const fiscalYear = extractFiscalYearV1(input.sourceText.pageTexts[page - 1] ?? "");
      if (fiscalYear.start && fiscalYear.end) {
        fields.fiscalYearStart = {
          normalizedValue: fiscalYear.start,
          page,
          valueText: fiscalYear.start,
        };
        fields.fiscalYearEnd = {
          normalizedValue: fiscalYear.end,
          page,
          valueText: fiscalYear.end,
        };
        break;
      }
    }
  }

  const statementPages = uniquePagesFromRangesV1(
    input.statementRanges ?? [],
    input.sourceText.pageTexts.length,
  );
  if (!fields.profitBeforeTax && statementPages.length > 0) {
    for (const page of statementPages) {
      const profitBeforeTax = extractProfitBeforeTaxV1(
        input.sourceText.pageTexts[page - 1] ?? "",
      );
      if (profitBeforeTax !== undefined) {
        fields.profitBeforeTax = {
          normalizedValue: profitBeforeTax,
          page,
          valueText: String(profitBeforeTax),
        };
        break;
      }
    }
  }

  diagnostics.push(
    fields.organizationNumber ? "seed.organization_number=hit" : "seed.organization_number=miss",
  );
  diagnostics.push(
    fields.accountingStandard ? "seed.accounting_standard=hit" : "seed.accounting_standard=miss",
  );
  diagnostics.push(
    fields.fiscalYearStart && fields.fiscalYearEnd
      ? "seed.fiscal_year=hit"
      : "seed.fiscal_year=miss",
  );
  diagnostics.push(fields.companyName ? "seed.company_name=hit" : "seed.company_name=miss");
  diagnostics.push(
    fields.profitBeforeTax ? "seed.profit_before_tax=hit" : "seed.profit_before_tax=miss",
  );

  return {
    diagnostics,
    fields,
  };
}
