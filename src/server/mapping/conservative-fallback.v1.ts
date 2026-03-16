import type { SilverfinTaxCategoryCodeV1 } from "../../shared/contracts/mapping.v1";

export type ConservativeFallbackRowV1 = {
  accountName: string;
  openingBalance: number | null;
  closingBalance: number | null;
};

export type ConservativeFallbackStatementTypeV1 =
  | "balance_sheet"
  | "income_statement"
  | "unknown";

function normalizeTextV1(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeywordV1(
  normalized: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) =>
    normalized.includes(normalizeTextV1(keyword)),
  );
}

const BALANCE_SHEET_KEYWORDS_V1 = [
  "tillgang",
  "anlaggning",
  "anläggning",
  "asset",
  "receivable",
  "fordran",
  "payable",
  "leverantorsskuld",
  "leverantörsskuld",
  "liability",
  "skuld",
  "inventory",
  "lager",
  "bank",
  "cash",
  "kassa",
  "equity",
  "eget kapital",
  "provision",
  "avsattning",
  "avsättning",
  "accrued",
  "upplupen",
  "prepaid",
  "forutbetald",
  "förutbetald",
  "deferred",
  "leasehold",
  "byggnad",
  "byggnader",
  "markanlaggning",
  "markanläggning",
  "goodwill",
  "kundfordring",
  "osakra kundfordringar",
  "osäkra kundfordringar",
  "tax allocation reserve",
  "periodiseringsfond",
];

const INCOME_STATEMENT_KEYWORDS_V1 = [
  "revenue",
  "income",
  "intakt",
  "intäkt",
  "expense",
  "cost",
  "kostnad",
  "depreciation",
  "avskrivning",
  "amortization",
  "nedskrivning",
  "interest",
  "ranta",
  "ränta",
  "fee",
  "avgift",
  "consulting",
  "konsult",
  "representation",
  "gift",
  "donation",
  "membership",
  "medlemsavgift",
  "leasing",
  "lease",
  "salary",
  "lon",
  "lön",
  "pension",
  "tax cost",
  "skattekostnad",
  "fx",
  "valutakurs",
  "group contribution",
  "koncernbidrag",
  "result of the year",
  "arets resultat",
  "årets resultat",
  "cogs",
  "sold goods",
  "kostnad salda varor",
  "kostnad sålda varor",
  "maintenance",
  "reparation",
  "repair",
];

export function inferConservativeFallbackStatementTypeV1(
  row: ConservativeFallbackRowV1,
): ConservativeFallbackStatementTypeV1 {
  const normalizedName = normalizeTextV1(row.accountName);
  const balanceSignals = hasAnyKeywordV1(
    normalizedName,
    BALANCE_SHEET_KEYWORDS_V1,
  );
  const incomeSignals = hasAnyKeywordV1(
    normalizedName,
    INCOME_STATEMENT_KEYWORDS_V1,
  );

  if (balanceSignals && !incomeSignals) {
    return "balance_sheet";
  }

  if (incomeSignals && !balanceSignals) {
    return "income_statement";
  }

  // As a last resort, use row balance shape rather than BAS numbering.
  if (
    typeof row.openingBalance === "number" &&
    typeof row.closingBalance === "number" &&
    row.openingBalance !== 0
  ) {
    return "balance_sheet";
  }

  if (
    typeof row.openingBalance === "number" &&
    typeof row.closingBalance === "number" &&
    row.openingBalance === 0 &&
    row.closingBalance !== 0
  ) {
    return "income_statement";
  }

  return "unknown";
}

export function resolveConservativeFallbackCategoryCodeV1(
  row: ConservativeFallbackRowV1,
): SilverfinTaxCategoryCodeV1 {
  const statementType = inferConservativeFallbackStatementTypeV1(row);
  if (statementType === "balance_sheet") {
    return "100000";
  }

  return "950000";
}
