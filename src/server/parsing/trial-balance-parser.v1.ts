import * as XLSX from "xlsx";
import type { z } from "zod";

import {
  type ParseTrialBalanceFailureV1,
  ParseTrialBalanceRequestV1Schema,
  type ParseTrialBalanceResultV1,
  type TrialBalanceBalanceColumnKeyV1,
  type TrialBalanceColumnKeyV1,
  type TrialBalanceColumnMappingV1,
  type TrialBalanceFileTypeV1,
  type TrialBalanceRawCellValueV1,
  type TrialBalanceRejectedRowReasonCodeV1,
  parseParseTrialBalanceResultV1,
} from "../../shared/contracts/trial-balance.v1";

type ColumnDefinitionV1 = {
  canonicalHeader: string;
  key: TrialBalanceColumnKeyV1;
  required: boolean;
  synonyms: string[];
};

type HeaderMatchTypeV1 =
  | "exact_synonym"
  | "token_match"
  | "derived_compound_split";

type InternalColumnMappingV1 = TrialBalanceColumnMappingV1 & {
  score: number;
};

type HeaderCandidateV1 = {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
  headerRowNumber: number;
  isAccountPairComplete: boolean;
  requiredColumnsMatched: number;
  score: number;
};

type SheetCandidateV1 = {
  candidateDataRows: number;
  headerCandidate: HeaderCandidateV1 | null;
  score: number;
  sheetName: string;
};

type NumericParseResultV1 =
  | {
      ok: true;
      value: number;
      wasBlank: boolean;
    }
  | {
      ok: false;
      wasBlank: boolean;
    };

type CompoundAccountPartsV1 = {
  accountName: string;
  accountNumber: string;
};

type ParsedRowDraftV1 = {
  accountName: string;
  closingBalance: number | null;
  openingBalance: number | null;
  rawValues: Record<string, TrialBalanceRawCellValueV1>;
  rowNumber: number;
  sourceAccountNumber: string;
};

const HEADER_SCAN_LIMIT_V1 = 200;

const TRIAL_BALANCE_COLUMN_DEFINITIONS_V1: ColumnDefinitionV1[] = [
  {
    key: "account_name",
    required: true,
    canonicalHeader: "Account Name",
    synonyms: [
      "Account Description",
      "Description",
      "Kontonamn",
      "Konto Namn",
      "Benamning",
      "Konto Benamning",
    ],
  },
  {
    key: "account_number",
    required: true,
    canonicalHeader: "Account Number",
    synonyms: [
      "Account No",
      "Account No.",
      "Account Code",
      "Ledger Account",
      "Konto",
      "Kontonummer",
      "Kontonr",
      "Konto Nr",
    ],
  },
  {
    key: "opening_balance",
    required: true,
    canonicalHeader: "Opening Balance",
    synonyms: [
      "Opening",
      "Opening Bal",
      "Ingaende Balans",
      "Ingående Balans",
      "IB",
      "Opening Amount",
    ],
  },
  {
    key: "closing_balance",
    required: true,
    canonicalHeader: "Closing Balance",
    synonyms: [
      "Closing",
      "Ending Balance",
      "Year End Balance",
      "Utgaende Balans",
      "Utgående Balans",
      "UB",
      "Closing Amount",
    ],
  },
];

const ACCOUNT_COMPOUND_HEADER_ALIASES_V1 = [
  "Account",
  "Account Details",
  "Account Text",
  "Konto",
  "Kontotext",
  "Kontostrang",
  "Kontosträng",
  "Kontonummer Kontonamn",
];

const REQUIRED_COLUMN_KEYS_V1 = TRIAL_BALANCE_COLUMN_DEFINITIONS_V1.filter(
  (definition) => definition.required,
).map((definition) => definition.key);

const MATERIAL_REJECTION_REASON_CODES_V1 =
  new Set<TrialBalanceRejectedRowReasonCodeV1>([
    "ACCOUNT_NUMBER_MISSING",
    "ACCOUNT_NAME_MISSING",
    "ACCOUNT_COMBINED_PARSE_FAILED",
    "OPENING_BALANCE_MISSING",
    "OPENING_BALANCE_INVALID",
    "CLOSING_BALANCE_MISSING",
    "CLOSING_BALANCE_INVALID",
  ]);

const SUMMARY_ROW_EXACT_LABELS_V1 = new Set(
  [
    "total",
    "totals",
    "summa",
    "subtotal",
    "totalt",
    "grand total",
    "sum of",
    "balanssumma",
    "resultat",
    "balance total",
  ].map((value) => normalizeHeaderTextV1(value)),
);

const SUMMARY_ROW_PREFIXES_V1 = [
  "total ",
  "totals ",
  "summa ",
  "subtotal ",
  "totalt ",
  "grand total ",
  "sum of ",
  "balance total ",
].map((value) => normalizeHeaderTextV1(value));

const PREFERRED_SHEET_NAME_KEYWORDS_V1 = [
  "trial balance",
  "tb",
  "balans",
  "saldobalans",
  "konto",
  "ledger",
];

function normalizeHeaderTextV1(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/[^a-z0-9åäö ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeHeaderTextV1(value: string): string[] {
  return normalizeHeaderTextV1(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeCellTextV1(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    if (Number.isInteger(value)) {
      return value.toString(10);
    }

    return value.toString();
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value).trim();
}

function isCellEmptyV1(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
}

function toRawCellValueV1(value: unknown): TrialBalanceRawCellValueV1 {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }

  return String(value);
}

function toColumnLetterV1(columnIndex: number): string {
  let current = columnIndex + 1;
  let output = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    current = Math.floor((current - 1) / 26);
  }

  return output;
}

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function buildFailureV1(
  code: ParseTrialBalanceFailureV1["error"]["code"],
  message: string,
  userMessage: string,
  context: Record<string, unknown>,
): ParseTrialBalanceResultV1 {
  return parseParseTrialBalanceResultV1({
    ok: false,
    error: {
      code,
      message,
      user_message: userMessage,
      context,
    },
  });
}

function resolveFileTypeFromNameV1(
  fileName: string,
): TrialBalanceFileTypeV1 | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xlsx")) {
    return "xlsx";
  }

  if (lowerName.endsWith(".xlsm")) {
    return "xlsm";
  }

  if (lowerName.endsWith(".xls")) {
    return "xls";
  }

  if (lowerName.endsWith(".xlsb")) {
    return "xlsb";
  }

  if (lowerName.endsWith(".csv")) {
    return "csv";
  }

  return null;
}

function scoreAliasMatchV1(input: {
  aliases: string[];
  headerText: string;
  normalizedHeader: string;
}): { matchType: HeaderMatchTypeV1; score: number } | null {
  for (const alias of input.aliases) {
    if (normalizeHeaderTextV1(alias) === input.normalizedHeader) {
      return {
        matchType: "exact_synonym",
        score: 100,
      };
    }
  }

  const headerTokens = tokenizeHeaderTextV1(input.headerText);
  if (headerTokens.length === 0) {
    return null;
  }

  const headerTokenSet = new Set(headerTokens);
  for (const alias of input.aliases) {
    const aliasTokens = tokenizeHeaderTextV1(alias);
    if (aliasTokens.length < 2) {
      continue;
    }

    const containsAllTokens = aliasTokens.every((token) =>
      headerTokenSet.has(token),
    );
    if (!containsAllTokens) {
      continue;
    }

    return {
      matchType: "token_match",
      score: 60 + aliasTokens.length,
    };
  }

  return null;
}

function looksLikeAccountNumberTokenV1(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }

  const compact = value.replace(/\s+/g, "");
  if (compact.length > 64) {
    return false;
  }

  return /[0-9]/.test(compact) && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(compact);
}

function detectCompoundColumnMappingForRowV1(input: {
  row: unknown[];
  usedColumnIndexes: Set<number>;
}): InternalColumnMappingV1 | null {
  let best: InternalColumnMappingV1 | null = null;

  for (const [columnIndex, cellValue] of input.row.entries()) {
    if (input.usedColumnIndexes.has(columnIndex)) {
      continue;
    }

    const sourceHeader = normalizeCellTextV1(cellValue);
    if (sourceHeader.length === 0) {
      continue;
    }

    const normalizedHeader = normalizeHeaderTextV1(sourceHeader);
    if (normalizedHeader.length === 0) {
      continue;
    }

    const aliasMatch = scoreAliasMatchV1({
      aliases: ACCOUNT_COMPOUND_HEADER_ALIASES_V1,
      headerText: sourceHeader,
      normalizedHeader,
    });
    if (!aliasMatch) {
      continue;
    }

    const candidate: InternalColumnMappingV1 = {
      key: "account_number",
      required: true,
      sourceHeader,
      normalizedSourceHeader: normalizedHeader,
      sourceColumnIndex: columnIndex,
      sourceColumnLetter: toColumnLetterV1(columnIndex),
      matchType: aliasMatch.matchType,
      score: aliasMatch.score,
    };

    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score &&
        candidate.sourceColumnIndex < best.sourceColumnIndex)
    ) {
      best = candidate;
    }
  }

  return best;
}

function hasAccountIdentitySupportV1(input: {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
}): boolean {
  const hasAccountName = input.columnMappingsByKey.has("account_name");
  const hasAccountNumber = input.columnMappingsByKey.has("account_number");

  return (hasAccountName && hasAccountNumber) || !!input.accountCompoundMapping;
}

function hasRequiredColumnSupportV1(input: {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
}): boolean {
  const hasAccountIdentity = hasAccountIdentitySupportV1(input);
  const availableBalanceColumns = listAvailableBalanceColumnsForMappingsV1(
    input.columnMappingsByKey,
  );

  return availableBalanceColumns.length > 0 && hasAccountIdentity;
}

function listAvailableBalanceColumnsForMappingsV1(
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>,
): TrialBalanceBalanceColumnKeyV1[] {
  const available: TrialBalanceBalanceColumnKeyV1[] = [];
  if (columnMappingsByKey.has("opening_balance")) {
    available.push("opening_balance");
  }
  if (columnMappingsByKey.has("closing_balance")) {
    available.push("closing_balance");
  }

  return available;
}

function detectHeaderCandidateForRowV1(input: {
  row: unknown[];
  rowNumber: number;
}): HeaderCandidateV1 | null {
  const mappingByKey = new Map<
    TrialBalanceColumnKeyV1,
    InternalColumnMappingV1
  >([]);

  for (const [columnIndex, cellValue] of input.row.entries()) {
    const sourceHeader = normalizeCellTextV1(cellValue);
    if (sourceHeader.length === 0) {
      continue;
    }

    const normalizedHeader = normalizeHeaderTextV1(sourceHeader);
    if (normalizedHeader.length === 0) {
      continue;
    }

    const matches: Array<{
      definition: ColumnDefinitionV1;
      matchType: HeaderMatchTypeV1;
      score: number;
    }> = [];

    for (const definition of TRIAL_BALANCE_COLUMN_DEFINITIONS_V1) {
      const aliases = [definition.canonicalHeader, ...definition.synonyms];
      const scored = scoreAliasMatchV1({
        aliases,
        headerText: sourceHeader,
        normalizedHeader,
      });

      if (!scored) {
        continue;
      }

      matches.push({
        definition,
        matchType: scored.matchType,
        score: scored.score,
      });
    }

    if (matches.length === 0) {
      continue;
    }

    matches.sort((left, right) => right.score - left.score);
    const best = matches[0];
    if (!best) {
      continue;
    }

    const hasAmbiguousBestMatch = matches.some(
      (match) =>
        match.definition.key !== best.definition.key &&
        match.score === best.score,
    );
    if (hasAmbiguousBestMatch) {
      continue;
    }

    const existing = mappingByKey.get(best.definition.key);
    if (
      existing &&
      (existing.score > best.score ||
        (existing.score === best.score &&
          existing.sourceColumnIndex < columnIndex))
    ) {
      continue;
    }

    mappingByKey.set(best.definition.key, {
      key: best.definition.key,
      required: best.definition.required,
      sourceHeader,
      normalizedSourceHeader: normalizedHeader,
      sourceColumnIndex: columnIndex,
      sourceColumnLetter: toColumnLetterV1(columnIndex),
      matchType: best.matchType,
      score: best.score,
    });
  }

  const usedColumnIndexes = new Set<number>(
    Array.from(mappingByKey.values()).map(
      (mapping) => mapping.sourceColumnIndex,
    ),
  );
  const accountCompoundMapping = detectCompoundColumnMappingForRowV1({
    row: input.row,
    usedColumnIndexes,
  });

  const requiredColumnsMatched = REQUIRED_COLUMN_KEYS_V1.filter((key) =>
    mappingByKey.has(key),
  ).length;
  const isAccountPairComplete =
    mappingByKey.has("account_name") && mappingByKey.has("account_number");
  const hasRequiredColumnSupport = hasRequiredColumnSupportV1({
    columnMappingsByKey: mappingByKey,
    accountCompoundMapping,
  });

  if (!hasRequiredColumnSupport && requiredColumnsMatched === 0) {
    return null;
  }

  const score =
    requiredColumnsMatched * 100 +
    mappingByKey.size * 20 +
    (isAccountPairComplete ? 45 : 0) +
    (accountCompoundMapping ? 20 : 0) -
    Math.min(input.rowNumber, 50);

  return {
    accountCompoundMapping,
    headerRowNumber: input.rowNumber,
    isAccountPairComplete,
    columnMappingsByKey: mappingByKey,
    requiredColumnsMatched,
    score,
  };
}

function estimateCandidateDataRowsV1(input: {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
  headerRowNumber: number;
  rows: unknown[][];
}): number {
  let count = 0;

  const mappedColumnIndexes = new Set<number>(
    Array.from(input.columnMappingsByKey.values()).map(
      (mapping) => mapping.sourceColumnIndex,
    ),
  );
  if (input.accountCompoundMapping) {
    mappedColumnIndexes.add(input.accountCompoundMapping.sourceColumnIndex);
  }

  for (
    let rowIndex = input.headerRowNumber;
    rowIndex < input.rows.length;
    rowIndex += 1
  ) {
    const row = input.rows[rowIndex] ?? [];
    const hasAnyMappedValue = Array.from(mappedColumnIndexes).some(
      (columnIndex) => !isCellEmptyV1(row[columnIndex]),
    );

    if (hasAnyMappedValue) {
      count += 1;
    }
  }

  return count;
}

function analyzeSheetCandidateV1(input: {
  rows: unknown[][];
  sheetName: string;
}): SheetCandidateV1 {
  const scanLimit = Math.min(input.rows.length, HEADER_SCAN_LIMIT_V1);
  let bestHeaderCandidate: HeaderCandidateV1 | null = null;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = input.rows[rowIndex] ?? [];
    const candidate = detectHeaderCandidateForRowV1({
      row,
      rowNumber: rowIndex + 1,
    });

    if (!candidate) {
      continue;
    }

    if (!bestHeaderCandidate) {
      bestHeaderCandidate = candidate;
      continue;
    }

    const candidateHasRequiredSupport = hasRequiredColumnSupportV1({
      columnMappingsByKey: candidate.columnMappingsByKey,
      accountCompoundMapping: candidate.accountCompoundMapping,
    });
    const bestHasRequiredSupport = hasRequiredColumnSupportV1({
      columnMappingsByKey: bestHeaderCandidate.columnMappingsByKey,
      accountCompoundMapping: bestHeaderCandidate.accountCompoundMapping,
    });

    if (candidateHasRequiredSupport && !bestHasRequiredSupport) {
      bestHeaderCandidate = candidate;
      continue;
    }

    if (!candidateHasRequiredSupport && bestHasRequiredSupport) {
      continue;
    }

    if (
      candidate.requiredColumnsMatched >
      bestHeaderCandidate.requiredColumnsMatched
    ) {
      bestHeaderCandidate = candidate;
      continue;
    }

    if (
      candidate.requiredColumnsMatched ===
        bestHeaderCandidate.requiredColumnsMatched &&
      candidate.isAccountPairComplete &&
      !bestHeaderCandidate.isAccountPairComplete
    ) {
      bestHeaderCandidate = candidate;
      continue;
    }

    if (
      candidate.requiredColumnsMatched ===
        bestHeaderCandidate.requiredColumnsMatched &&
      candidate.score > bestHeaderCandidate.score
    ) {
      bestHeaderCandidate = candidate;
      continue;
    }

    if (
      candidate.requiredColumnsMatched ===
        bestHeaderCandidate.requiredColumnsMatched &&
      candidate.score === bestHeaderCandidate.score &&
      candidate.headerRowNumber < bestHeaderCandidate.headerRowNumber
    ) {
      bestHeaderCandidate = candidate;
    }
  }

  if (!bestHeaderCandidate) {
    return {
      sheetName: input.sheetName,
      headerCandidate: null,
      candidateDataRows: 0,
      score: 0,
    };
  }

  const candidateDataRows = estimateCandidateDataRowsV1({
    rows: input.rows,
    headerRowNumber: bestHeaderCandidate.headerRowNumber,
    columnMappingsByKey: bestHeaderCandidate.columnMappingsByKey,
    accountCompoundMapping: bestHeaderCandidate.accountCompoundMapping,
  });

  const score =
    bestHeaderCandidate.requiredColumnsMatched * 1000 +
    candidateDataRows * 12 +
    bestHeaderCandidate.score;

  return {
    sheetName: input.sheetName,
    headerCandidate: bestHeaderCandidate,
    candidateDataRows,
    score,
  };
}

function parseNumericCellValueV1(value: unknown): NumericParseResultV1 {
  if (value === null || value === undefined) {
    return { ok: false, wasBlank: true };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, wasBlank: false };
    }

    return { ok: true, value, wasBlank: false };
  }

  let text = normalizeCellTextV1(value);
  if (text.length === 0) {
    return { ok: false, wasBlank: true };
  }

  text = text.replace(/\u00A0/g, " ");
  text = text.replace(/\s+/g, "");
  text = text.replace(/[−–]/g, "-");
  text = text.replace(/[’']/g, "");
  text = text.replace(/^(sek|eur|usd|gbp)/i, "");
  text = text.replace(/(sek|eur|usd|gbp)$/i, "");
  text = text.replace(/[kr$€£]/gi, "");

  let isNegative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    isNegative = true;
    text = text.slice(1, -1);
  }

  if (text.endsWith("-")) {
    isNegative = true;
    text = text.slice(0, -1);
  }

  if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (text.startsWith("-")) {
    isNegative = true;
    text = text.slice(1);
  }

  const commaCount = (text.match(/,/g) ?? []).length;
  const dotCount = (text.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";

    text = text.split(thousandSeparator).join("");
    text = decimalSeparator === "," ? text.replace(",", ".") : text;
  } else if (commaCount > 0) {
    const isCommaThousandFormat = /^(\d{1,3})(,\d{3})+$/.test(text);
    text = isCommaThousandFormat
      ? text.split(",").join("")
      : text.replace(",", ".");
  } else if (dotCount > 0) {
    const isDotThousandFormat = /^(\d{1,3})(\.\d{3})+$/.test(text);
    text = isDotThousandFormat ? text.split(".").join("") : text;
  }

  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, wasBlank: false };
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { ok: false, wasBlank: false };
  }

  return { ok: true, value: isNegative ? -parsed : parsed, wasBlank: false };
}

function isLikelyNonDataLabelV1(label: string): boolean {
  const normalized = normalizeHeaderTextV1(label);
  if (normalized.length === 0) {
    return false;
  }

  if (SUMMARY_ROW_EXACT_LABELS_V1.has(normalized)) {
    return true;
  }

  return SUMMARY_ROW_PREFIXES_V1.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function scoreSheetNamePreferenceV1(sheetName: string): number {
  const normalized = normalizeHeaderTextV1(sheetName);
  if (normalized.length === 0) {
    return 0;
  }

  let score = 0;
  for (const keyword of PREFERRED_SHEET_NAME_KEYWORDS_V1) {
    if (normalized.includes(normalizeHeaderTextV1(keyword))) {
      score += 10;
    }
  }

  return score;
}

function buildRawValuesForMappedColumnsV1(input: {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
  rawRow: unknown[];
  textRow: unknown[];
}): Record<string, TrialBalanceRawCellValueV1> {
  const rawValues: Record<string, TrialBalanceRawCellValueV1> = {};

  for (const [key, mapping] of input.columnMappingsByKey.entries()) {
    const sourceValue =
      key === "account_name" || key === "account_number"
        ? input.textRow[mapping.sourceColumnIndex]
        : input.rawRow[mapping.sourceColumnIndex];
    rawValues[key] = toRawCellValueV1(sourceValue);
  }

  if (input.accountCompoundMapping) {
    rawValues.account_compound = toRawCellValueV1(
      input.textRow[input.accountCompoundMapping.sourceColumnIndex] ??
        input.rawRow[input.accountCompoundMapping.sourceColumnIndex],
    );
  }

  return rawValues;
}

function parseCompoundAccountCellV1(
  value: string,
): CompoundAccountPartsV1 | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length === 0) {
    return null;
  }

  const numberThenNameWithDivider =
    /^([A-Za-z0-9][A-Za-z0-9._/-]{0,63})\s*[-:/|]\s*(.+)$/u.exec(text);
  if (numberThenNameWithDivider) {
    const accountNumber = numberThenNameWithDivider[1]?.trim() ?? "";
    const accountName = numberThenNameWithDivider[2]?.trim() ?? "";
    if (
      accountName.length > 0 &&
      looksLikeAccountNumberTokenV1(accountNumber)
    ) {
      return { accountNumber, accountName };
    }
  }

  const numberThenNameWhitespace =
    /^([A-Za-z0-9][A-Za-z0-9._/-]{0,63})\s+(.+)$/u.exec(text);
  if (numberThenNameWhitespace) {
    const accountNumber = numberThenNameWhitespace[1]?.trim() ?? "";
    const accountName = numberThenNameWhitespace[2]?.trim() ?? "";
    if (
      looksLikeAccountNumberTokenV1(accountNumber) &&
      accountName.length > 0 &&
      /[A-Za-zÅÄÖåäö]/u.test(accountName)
    ) {
      return { accountNumber, accountName };
    }
  }

  const nameThenNumberWithDivider =
    /^(.+?)\s*[-:/|]\s*([A-Za-z0-9][A-Za-z0-9._/-]{0,63})$/u.exec(text);
  if (nameThenNumberWithDivider) {
    const accountName = nameThenNumberWithDivider[1]?.trim() ?? "";
    const accountNumber = nameThenNumberWithDivider[2]?.trim() ?? "";
    if (
      accountName.length > 0 &&
      looksLikeAccountNumberTokenV1(accountNumber)
    ) {
      return { accountNumber, accountName };
    }
  }

  const nameWithBracketedNumber =
    /^(.+?)\s+\(([A-Za-z0-9][A-Za-z0-9._/-]{0,63})\)$/u.exec(text);
  if (nameWithBracketedNumber) {
    const accountName = nameWithBracketedNumber[1]?.trim() ?? "";
    const accountNumber = nameWithBracketedNumber[2]?.trim() ?? "";
    if (
      accountName.length > 0 &&
      looksLikeAccountNumberTokenV1(accountNumber)
    ) {
      return { accountNumber, accountName };
    }
  }

  return null;
}

function maybeSwapAccountCellsV1(input: {
  accountName: string;
  accountNumber: string;
}): CompoundAccountPartsV1 {
  const accountNameLooksLikeNumber = looksLikeAccountNumberTokenV1(
    input.accountName,
  );
  const accountNumberLooksLikeNumber = looksLikeAccountNumberTokenV1(
    input.accountNumber,
  );
  const accountNumberLooksLikeText = /[A-Za-zÅÄÖåäö]/u.test(
    input.accountNumber,
  );

  if (
    accountNameLooksLikeNumber &&
    !accountNumberLooksLikeNumber &&
    accountNumberLooksLikeText
  ) {
    return {
      accountNumber: input.accountName,
      accountName: input.accountNumber,
    };
  }

  return {
    accountNumber: input.accountNumber,
    accountName: input.accountName,
  };
}

function parseRowsFromSelectedSheetV1(input: {
  accountCompoundMapping: InternalColumnMappingV1 | null;
  columnMappingsByKey: Map<TrialBalanceColumnKeyV1, InternalColumnMappingV1>;
  headerRowNumber: number;
  rawRows: unknown[][];
  textRows: unknown[][];
}): {
  blankBalanceZeroDefaultCount: number;
  candidateRows: number;
  draftRows: ParsedRowDraftV1[];
  inferredAccountNameCount: number;
  rejectedRows: Array<{
    message: string;
    rawValues: Record<string, TrialBalanceRawCellValueV1>;
    reasonCode: TrialBalanceRejectedRowReasonCodeV1;
    rowNumber: number;
  }>;
} {
  const draftRows: ParsedRowDraftV1[] = [];
  const rejectedRows: Array<{
    message: string;
    rawValues: Record<string, TrialBalanceRawCellValueV1>;
    reasonCode: TrialBalanceRejectedRowReasonCodeV1;
    rowNumber: number;
  }> = [];

  let candidateRows = 0;
  let inferredAccountNameCount = 0;
  let blankBalanceZeroDefaultCount = 0;
  const rowCount = Math.max(input.rawRows.length, input.textRows.length);

  const accountNameMapping = input.columnMappingsByKey.get("account_name");
  const accountNumberMapping = input.columnMappingsByKey.get("account_number");
  const openingBalanceMapping =
    input.columnMappingsByKey.get("opening_balance");
  const closingBalanceMapping =
    input.columnMappingsByKey.get("closing_balance");
  const availableBalanceColumns = listAvailableBalanceColumnsForMappingsV1(
    input.columnMappingsByKey,
  );

  if (availableBalanceColumns.length === 0) {
      return {
        blankBalanceZeroDefaultCount,
        candidateRows,
        draftRows,
        inferredAccountNameCount,
        rejectedRows: [
          {
          reasonCode: "NON_DATA_ROW",
          message:
            "No mapped balance columns were detected for row parsing in the selected sheet.",
          rowNumber: input.headerRowNumber,
          rawValues: {},
        },
      ],
    };
  }

  if (
    !accountNameMapping &&
    !accountNumberMapping &&
    !input.accountCompoundMapping
  ) {
      return {
        blankBalanceZeroDefaultCount,
        candidateRows,
        draftRows,
        inferredAccountNameCount,
        rejectedRows: [
          {
          reasonCode: "ACCOUNT_COMBINED_PARSE_FAILED",
          message:
            "No account identity columns were detected (account name/account number or combined account column).",
          rowNumber: input.headerRowNumber,
          rawValues: {},
        },
      ],
    };
  }

  const candidateColumnIndexes = new Set<number>([
    ...Array.from(input.columnMappingsByKey.values()).map(
      (mapping) => mapping.sourceColumnIndex,
    ),
  ]);
  if (input.accountCompoundMapping) {
    candidateColumnIndexes.add(input.accountCompoundMapping.sourceColumnIndex);
  }

  for (
    let rowIndex = input.headerRowNumber;
    rowIndex < rowCount;
    rowIndex += 1
  ) {
    const rawRow = input.rawRows[rowIndex] ?? [];
    const textRow = input.textRows[rowIndex] ?? [];
    const rowNumber = rowIndex + 1;

    const rawValues = buildRawValuesForMappedColumnsV1({
      accountCompoundMapping: input.accountCompoundMapping,
      columnMappingsByKey: input.columnMappingsByKey,
      rawRow,
      textRow,
    });

    const hasAnyMappedValue = Array.from(candidateColumnIndexes).some(
      (columnIndex) =>
        !isCellEmptyV1(textRow[columnIndex]) ||
        !isCellEmptyV1(rawRow[columnIndex]),
    );
    if (!hasAnyMappedValue) {
      continue;
    }

    candidateRows += 1;

    let accountName = accountNameMapping
      ? normalizeCellTextV1(textRow[accountNameMapping.sourceColumnIndex])
      : "";
    let sourceAccountNumber = accountNumberMapping
      ? normalizeCellTextV1(
          textRow[accountNumberMapping.sourceColumnIndex],
        ).replace(/\s+/g, "")
      : "";

    const swapped = maybeSwapAccountCellsV1({
      accountName,
      accountNumber: sourceAccountNumber,
    });
    accountName = swapped.accountName;
    sourceAccountNumber = swapped.accountNumber;

    const compoundCellValue = input.accountCompoundMapping
      ? normalizeCellTextV1(
          textRow[input.accountCompoundMapping.sourceColumnIndex] ??
            rawRow[input.accountCompoundMapping.sourceColumnIndex],
        )
      : "";

    if (
      (accountName.length === 0 || sourceAccountNumber.length === 0) &&
      compoundCellValue.length > 0
    ) {
      const compoundParts = parseCompoundAccountCellV1(compoundCellValue);
      if (compoundParts) {
        if (sourceAccountNumber.length === 0) {
          sourceAccountNumber = compoundParts.accountNumber.replace(/\s+/g, "");
        }

        if (accountName.length === 0) {
          accountName = compoundParts.accountName;
        }
      } else {
        rejectedRows.push({
          reasonCode: "ACCOUNT_COMBINED_PARSE_FAILED",
          message:
            "Combined account cell could not be split into account number and account name.",
          rowNumber,
          rawValues,
        });
        continue;
      }
    }

    const summaryLabelCandidate =
      accountName.length > 0 ? accountName : sourceAccountNumber;
    if (isLikelyNonDataLabelV1(summaryLabelCandidate)) {
      rejectedRows.push({
        reasonCode: "SUMMARY_ROW_EXCLUDED",
        message:
          "Summary/subtotal row excluded to avoid counting non-leaf account totals.",
        rowNumber,
        rawValues,
      });
      continue;
    }

    if (sourceAccountNumber.length === 0) {
      rejectedRows.push({
        reasonCode: "ACCOUNT_NUMBER_MISSING",
        message:
          "Account number is required for deterministic row normalization.",
        rowNumber,
        rawValues,
      });
      continue;
    }

    if (accountName.length === 0) {
      accountName = `Account ${sourceAccountNumber}`;
      inferredAccountNameCount += 1;
    }

    let openingBalance: number | null = null;
    if (openingBalanceMapping) {
      const openingBalanceResult = parseNumericCellValueV1(
        rawRow[openingBalanceMapping.sourceColumnIndex],
      );
      if (!openingBalanceResult.ok) {
        if (
          openingBalanceResult.wasBlank &&
          availableBalanceColumns.length === 1
        ) {
          openingBalance = 0;
          blankBalanceZeroDefaultCount += 1;
        } else {
          rejectedRows.push({
            reasonCode: openingBalanceResult.wasBlank
              ? "OPENING_BALANCE_MISSING"
              : "OPENING_BALANCE_INVALID",
            message: openingBalanceResult.wasBlank
              ? "Opening balance column was detected but this row is blank."
              : "Opening balance could not be parsed as a deterministic numeric value.",
            rowNumber,
            rawValues,
          });
          continue;
        }
      } else {
        openingBalance = openingBalanceResult.value;
      }
    }

    let closingBalance: number | null = null;
    if (closingBalanceMapping) {
      const closingBalanceResult = parseNumericCellValueV1(
        rawRow[closingBalanceMapping.sourceColumnIndex],
      );
      if (!closingBalanceResult.ok) {
        if (
          closingBalanceResult.wasBlank &&
          availableBalanceColumns.length === 1
        ) {
          closingBalance = 0;
          blankBalanceZeroDefaultCount += 1;
        } else {
          rejectedRows.push({
            reasonCode: closingBalanceResult.wasBlank
              ? "CLOSING_BALANCE_MISSING"
              : "CLOSING_BALANCE_INVALID",
            message: closingBalanceResult.wasBlank
              ? "Closing balance column was detected but this row is blank."
              : "Closing balance could not be parsed as a deterministic numeric value.",
            rowNumber,
            rawValues,
          });
          continue;
        }
      } else {
        closingBalance = closingBalanceResult.value;
      }
    }

    draftRows.push({
      accountName,
      sourceAccountNumber,
      openingBalance,
      closingBalance,
      rowNumber,
      rawValues,
    });
  }

  return {
    blankBalanceZeroDefaultCount,
    candidateRows,
    draftRows,
    inferredAccountNameCount,
    rejectedRows,
  };
}

function applyDuplicateAccountNumberSuffixesV1(draftRows: ParsedRowDraftV1[]): {
  duplicateAccountNumberGroups: number;
  normalizedRows: Array<{
    accountName: string;
    accountNumber: string;
    closingBalance: number | null;
    openingBalance: number | null;
    rawValues: Record<string, TrialBalanceRawCellValueV1>;
    rowNumber: number;
    sourceAccountNumber: string;
  }>;
} {
  const countBySourceAccountNumber = new Map<string, number>();
  for (const row of draftRows) {
    countBySourceAccountNumber.set(
      row.sourceAccountNumber,
      (countBySourceAccountNumber.get(row.sourceAccountNumber) ?? 0) + 1,
    );
  }

  const duplicateAccountNumberGroups = Array.from(
    countBySourceAccountNumber.values(),
  ).filter((count) => count > 1).length;

  const nextIndexBySourceAccountNumber = new Map<string, number>();
  const normalizedRows = draftRows.map((row) => {
    const totalCountForSource =
      countBySourceAccountNumber.get(row.sourceAccountNumber) ?? 1;

    if (totalCountForSource === 1) {
      return {
        accountName: row.accountName,
        accountNumber: row.sourceAccountNumber,
        sourceAccountNumber: row.sourceAccountNumber,
        openingBalance: row.openingBalance,
        closingBalance: row.closingBalance,
        rowNumber: row.rowNumber,
        rawValues: row.rawValues,
      };
    }

    const nextIndex =
      (nextIndexBySourceAccountNumber.get(row.sourceAccountNumber) ?? 0) + 1;
    nextIndexBySourceAccountNumber.set(row.sourceAccountNumber, nextIndex);

    return {
      accountName: row.accountName,
      accountNumber: `${row.sourceAccountNumber}.${nextIndex}`,
      sourceAccountNumber: row.sourceAccountNumber,
      openingBalance: row.openingBalance,
      closingBalance: row.closingBalance,
      rowNumber: row.rowNumber,
      rawValues: row.rawValues,
    };
  });

  return {
    duplicateAccountNumberGroups,
    normalizedRows,
  };
}

function isLikelyGrandTotalLabelV1(label: string): boolean {
  const normalized = normalizeHeaderTextV1(label);
  if (normalized.length === 0) {
    return false;
  }

  return (
    normalized === "total" ||
    normalized === "summa" ||
    normalized === "totalt" ||
    normalized.startsWith("grand total") ||
    normalized.startsWith("summa totalt") ||
    normalized.startsWith("total ")
  );
}

function isApproximatelyEqualV1(
  left: number,
  right: number,
  epsilon = 0.0001,
): boolean {
  return Math.abs(left - right) <= epsilon;
}

function doSummaryTotalsMatchAvailableBalancesV1(input: {
  availableBalanceColumns: TrialBalanceBalanceColumnKeyV1[];
  closing: number | null;
  closingBalanceTotal: number | null;
  opening: number | null;
  openingBalanceTotal: number | null;
}): boolean {
  return input.availableBalanceColumns.every((columnKey) => {
    if (columnKey === "opening_balance") {
      return (
        input.opening !== null &&
        input.openingBalanceTotal !== null &&
        isApproximatelyEqualV1(input.opening, input.openingBalanceTotal)
      );
    }

    return (
      input.closing !== null &&
      input.closingBalanceTotal !== null &&
      isApproximatelyEqualV1(input.closing, input.closingBalanceTotal)
    );
  });
}

function buildVerificationSummaryV1(input: {
  availableBalanceColumns: TrialBalanceBalanceColumnKeyV1[];
  blankBalanceZeroDefaultCount: number;
  candidateRows: number;
  closingBalanceTotal: number | null;
  duplicateAccountNumberGroups: number;
  hasRequiredColumnSupport: boolean;
  inferredAccountNameCount: number;
  normalizedRows: number;
  openingBalanceTotal: number | null;
  rejectedRows: Array<{
    rawValues: Record<string, TrialBalanceRawCellValueV1>;
    reasonCode: TrialBalanceRejectedRowReasonCodeV1;
  }>;
  requiredColumnsMatched: number;
  totalRowsRead: number;
}) {
  const materialRejectionCount = input.rejectedRows.filter((row) =>
    MATERIAL_REJECTION_REASON_CODES_V1.has(row.reasonCode),
  ).length;
  const numericParseFailureCount = input.rejectedRows.filter(
    (row) =>
      row.reasonCode === "OPENING_BALANCE_MISSING" ||
      row.reasonCode === "CLOSING_BALANCE_MISSING" ||
      row.reasonCode === "OPENING_BALANCE_INVALID" ||
      row.reasonCode === "CLOSING_BALANCE_INVALID",
  ).length;
  const summaryRows = input.rejectedRows.filter(
    (row) =>
      row.reasonCode === "SUMMARY_ROW_EXCLUDED" ||
      row.reasonCode === "NON_DATA_ROW",
  );
  const summaryRowsWithNumericTotals = summaryRows
    .map((row) => {
      const opening = input.availableBalanceColumns.includes("opening_balance")
        ? parseNumericCellValueV1(row.rawValues.opening_balance)
        : null;
      const closing = input.availableBalanceColumns.includes("closing_balance")
        ? parseNumericCellValueV1(row.rawValues.closing_balance)
        : null;
      if (
        (opening !== null && !opening.ok) ||
        (closing !== null && !closing.ok)
      ) {
        return null;
      }

      const label = normalizeCellTextV1(
        row.rawValues.account_name ?? row.rawValues.account_number ?? "",
      );

      return {
        label,
        opening: opening?.value ?? null,
        closing: closing?.value ?? null,
      };
    })
    .filter((row) => row !== null);
  const grandTotalRows = summaryRowsWithNumericTotals.filter((row) =>
    isLikelyGrandTotalLabelV1(row.label),
  );
  const hasMatchingGrandTotal = grandTotalRows.some(
    (row) =>
      doSummaryTotalsMatchAvailableBalancesV1({
        availableBalanceColumns: input.availableBalanceColumns,
        opening: row.opening,
        openingBalanceTotal: input.openingBalanceTotal,
        closing: row.closing,
        closingBalanceTotal: input.closingBalanceTotal,
      }),
  );

  const requiredColumnsCheckStatus = input.hasRequiredColumnSupport
    ? "pass"
    : "fail";
  const coverageCheckStatus =
    input.candidateRows === 0
      ? "fail"
      : materialRejectionCount > 0
        ? "fail"
        : input.rejectedRows.length > 0
          ? "warning"
          : "pass";
  const numericCheckStatus = numericParseFailureCount > 0 ? "fail" : "pass";
  const duplicateCheckStatus =
    input.duplicateAccountNumberGroups > 0 ? "warning" : "pass";
  const summaryConsistencyStatus =
    grandTotalRows.length === 0
      ? summaryRowsWithNumericTotals.length > 0
        ? "warning"
        : "pass"
      : hasMatchingGrandTotal
        ? "pass"
        : "fail";

  const checks = [
    {
      code: "required_columns_present",
      status: requiredColumnsCheckStatus,
      message:
        requiredColumnsCheckStatus === "pass"
          ? "Account identity and at least one balance column were matched deterministically."
          : "The parser could not confirm account identity plus at least one balance column.",
      context: {
        requiredColumnsMatched: input.requiredColumnsMatched,
        requiredColumnsExpected: REQUIRED_COLUMN_KEYS_V1.length,
        hasRequiredColumnSupport: input.hasRequiredColumnSupport,
        availableBalanceColumns: input.availableBalanceColumns,
      },
    },
    {
      code: "row_coverage",
      status: coverageCheckStatus,
      message:
        coverageCheckStatus === "fail"
          ? "One or more candidate rows could not be deterministically normalized."
          : coverageCheckStatus === "warning"
            ? "Non-data rows were excluded from normalization."
            : "All candidate rows were normalized without material row loss.",
      context: {
        candidateRows: input.candidateRows,
        normalizedRows: input.normalizedRows,
        rejectedRows: input.rejectedRows.length,
        materialRejections: materialRejectionCount,
      },
    },
    {
      code: "numeric_parse_integrity",
      status: numericCheckStatus,
      message:
        numericCheckStatus === "pass"
          ? "Numeric balance parsing succeeded for all normalized candidate rows."
          : "One or more balance values could not be parsed as deterministic numbers.",
      context: {
        numericParseFailureCount,
      },
    },
    {
      code: "duplicate_account_number_suffixing",
      status: duplicateCheckStatus,
      message:
        duplicateCheckStatus === "warning"
          ? "Duplicate account numbers were suffixed to preserve deterministic uniqueness."
          : "No duplicate account numbers required suffixing.",
      context: {
        duplicateAccountNumberGroups: input.duplicateAccountNumberGroups,
      },
    },
    {
      code: "summary_row_total_consistency",
      status: summaryConsistencyStatus,
      message:
        summaryConsistencyStatus === "pass"
          ? "Summary rows are consistent with parsed account-level totals."
          : summaryConsistencyStatus === "warning"
            ? "Summary rows exist but no definitive grand total row was found for hard validation."
            : "Grand total summary rows do not match parsed account-level totals.",
      context: {
        summaryRows: summaryRows.length,
        summaryRowsWithNumericTotals: summaryRowsWithNumericTotals.length,
        grandTotalRows: grandTotalRows.length,
        hasMatchingGrandTotal,
      },
    },
    {
      code: "row_inference_review",
      status:
        input.inferredAccountNameCount > 0 ||
        input.blankBalanceZeroDefaultCount > 0
          ? "warning"
          : "pass",
      message:
        input.inferredAccountNameCount > 0 ||
        input.blankBalanceZeroDefaultCount > 0
          ? "Some rows required conservative parser inference and should be reviewed in the mapper."
          : "No conservative row-level parser inference was required.",
      context: {
        inferredAccountNameCount: input.inferredAccountNameCount,
        blankBalanceZeroDefaultCount: input.blankBalanceZeroDefaultCount,
      },
    },
  ] as const;

  return {
    totalRowsRead: input.totalRowsRead,
    candidateRows: input.candidateRows,
    normalizedRows: input.normalizedRows,
    rejectedRows: input.rejectedRows.length,
    duplicateAccountNumberGroups: input.duplicateAccountNumberGroups,
    availableBalanceColumns: input.availableBalanceColumns,
    openingBalanceTotal: input.openingBalanceTotal,
    closingBalanceTotal: input.closingBalanceTotal,
    checks,
  };
}

function toUnknownErrorMessageV1(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown parse error.";
}

/**
 * Deterministically parses common trial-balance files into `TrialBalanceNormalizedV1`.
 *
 * Safety boundary:
 * - This parser is deterministic and must remain AI-free.
 * - Any candidate row that cannot be normalized is returned as explicit rejection.
 */
export function parseTrialBalanceFileV1(
  input: unknown,
): ParseTrialBalanceResultV1 {
  const parsedRequest = ParseTrialBalanceRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return buildFailureV1(
      "INPUT_INVALID",
      "Trial balance parse request payload is invalid.",
      "The uploaded trial balance file payload is invalid.",
      buildErrorContextFromZod(parsedRequest.error),
    );
  }

  const inferredFileType = resolveFileTypeFromNameV1(
    parsedRequest.data.fileName,
  );
  if (
    parsedRequest.data.fileType &&
    inferredFileType &&
    parsedRequest.data.fileType !== inferredFileType
  ) {
    return buildFailureV1(
      "INPUT_INVALID",
      "Declared fileType does not match file extension.",
      "The selected file type does not match the uploaded file name extension.",
      {
        reason: "declared_file_type_mismatch",
        fileName: parsedRequest.data.fileName,
        declaredFileType: parsedRequest.data.fileType,
        inferredFileType,
      },
    );
  }

  const resolvedFileType = parsedRequest.data.fileType ?? inferredFileType;
  if (!resolvedFileType) {
    return buildFailureV1(
      "UNSUPPORTED_FILE_FORMAT",
      "File extension is not supported for deterministic trial balance parsing.",
      "This file type is not supported. Upload an Excel or CSV trial balance file.",
      {
        fileName: parsedRequest.data.fileName,
        supportedFileTypes: [
          "xlsx",
          "xlsm",
          "xls",
          "xlsb",
          "csv",
        ] as TrialBalanceFileTypeV1[],
      },
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(parsedRequest.data.fileBytes, {
      type: "array",
      dense: true,
      raw: true,
      cellFormula: false,
      cellNF: true,
      cellText: true,
    });
  } catch (error) {
    return buildFailureV1(
      "PARSE_ERROR",
      `Failed to read workbook bytes: ${toUnknownErrorMessageV1(error)}`,
      "The file could not be read. Check that it is a valid Excel or CSV file.",
      {
        fileName: parsedRequest.data.fileName,
      },
    );
  }

  if (workbook.SheetNames.length === 0) {
    return buildFailureV1(
      "PARSE_ERROR",
      "Workbook does not contain any sheets.",
      "The uploaded file does not contain any readable sheets.",
      {
        fileName: parsedRequest.data.fileName,
      },
    );
  }

  const rawRowsBySheetName = new Map<string, unknown[][]>();
  const textRowsBySheetName = new Map<string, unknown[][]>();
  const sheetCandidates = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = worksheet
      ? (XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: true,
        }) as unknown[][])
      : [];
    const textRows = worksheet
      ? (XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
          blankrows: true,
        }) as unknown[][])
      : [];

    rawRowsBySheetName.set(sheetName, rawRows);
    textRowsBySheetName.set(sheetName, textRows);

    return analyzeSheetCandidateV1({
      sheetName,
      rows: textRows,
    });
  });

  sheetCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const rightRequired = right.headerCandidate?.requiredColumnsMatched ?? 0;
    const leftRequired = left.headerCandidate?.requiredColumnsMatched ?? 0;
    if (rightRequired !== leftRequired) {
      return rightRequired - leftRequired;
    }

    if (right.candidateDataRows !== left.candidateDataRows) {
      return right.candidateDataRows - left.candidateDataRows;
    }

    const rightHeaderRow =
      right.headerCandidate?.headerRowNumber ?? Number.MAX_SAFE_INTEGER;
    const leftHeaderRow =
      left.headerCandidate?.headerRowNumber ?? Number.MAX_SAFE_INTEGER;
    if (rightHeaderRow !== leftHeaderRow) {
      return leftHeaderRow - rightHeaderRow;
    }

    const rightNameScore = scoreSheetNamePreferenceV1(right.sheetName);
    const leftNameScore = scoreSheetNamePreferenceV1(left.sheetName);
    if (rightNameScore !== leftNameScore) {
      return rightNameScore - leftNameScore;
    }

    return left.sheetName.localeCompare(right.sheetName);
  });

  const selectedSheetCandidate = sheetCandidates[0] ?? null;
  if (!selectedSheetCandidate || !selectedSheetCandidate.headerCandidate) {
    return buildFailureV1(
      "REQUIRED_COLUMN_MISSING",
      "Could not detect required headers in any workbook sheet.",
      "We could not find account columns plus at least one balance column in the uploaded trial balance.",
      {
        requiredColumns: REQUIRED_COLUMN_KEYS_V1,
        sheetAnalyses: sheetCandidates.map((candidate) => ({
          sheetName: candidate.sheetName,
          headerRowNumber: null,
          requiredColumnsMatched: 0,
          candidateDataRows: candidate.candidateDataRows,
          score: candidate.score,
        })),
      },
    );
  }

  if (
    !hasRequiredColumnSupportV1({
      columnMappingsByKey:
        selectedSheetCandidate.headerCandidate.columnMappingsByKey,
      accountCompoundMapping:
        selectedSheetCandidate.headerCandidate.accountCompoundMapping,
    })
  ) {
    return buildFailureV1(
      "REQUIRED_COLUMN_MISSING",
      "Selected sheet did not contain all required headers.",
      "The selected sheet must include account identity columns and at least one balance column.",
      {
        selectedSheetName: selectedSheetCandidate.sheetName,
        requiredColumns: REQUIRED_COLUMN_KEYS_V1,
        requiredColumnsMatched:
          selectedSheetCandidate.headerCandidate.requiredColumnsMatched,
        availableBalanceColumns: listAvailableBalanceColumnsForMappingsV1(
          selectedSheetCandidate.headerCandidate.columnMappingsByKey,
        ),
        detectedMappings: Array.from(
          selectedSheetCandidate.headerCandidate.columnMappingsByKey.values(),
        ).map((mapping) => ({
          key: mapping.key,
          sourceHeader: mapping.sourceHeader,
        })),
        compoundMapping: selectedSheetCandidate.headerCandidate
          .accountCompoundMapping
          ? {
              sourceHeader:
                selectedSheetCandidate.headerCandidate.accountCompoundMapping
                  .sourceHeader,
            }
          : null,
      },
    );
  }

  const selectedRawRows =
    rawRowsBySheetName.get(selectedSheetCandidate.sheetName) ?? [];
  const selectedTextRows =
    textRowsBySheetName.get(selectedSheetCandidate.sheetName) ?? [];
  const parsedRows = parseRowsFromSelectedSheetV1({
    rawRows: selectedRawRows,
    textRows: selectedTextRows,
    headerRowNumber: selectedSheetCandidate.headerCandidate.headerRowNumber,
    accountCompoundMapping:
      selectedSheetCandidate.headerCandidate.accountCompoundMapping,
    columnMappingsByKey:
      selectedSheetCandidate.headerCandidate.columnMappingsByKey,
  });

  const duplicateAppliedRows = applyDuplicateAccountNumberSuffixesV1(
    parsedRows.draftRows,
  );
  const availableBalanceColumns = listAvailableBalanceColumnsForMappingsV1(
    selectedSheetCandidate.headerCandidate.columnMappingsByKey,
  );

  const openingBalanceTotal = availableBalanceColumns.includes("opening_balance")
    ? duplicateAppliedRows.normalizedRows.reduce(
        (sum, row) => sum + (row.openingBalance ?? 0),
        0,
      )
    : null;
  const closingBalanceTotal = availableBalanceColumns.includes("closing_balance")
    ? duplicateAppliedRows.normalizedRows.reduce(
        (sum, row) => sum + (row.closingBalance ?? 0),
        0,
      )
    : null;

  const verification = buildVerificationSummaryV1({
    availableBalanceColumns,
    blankBalanceZeroDefaultCount: parsedRows.blankBalanceZeroDefaultCount,
    totalRowsRead: selectedRawRows.length,
    candidateRows: parsedRows.candidateRows,
    normalizedRows: duplicateAppliedRows.normalizedRows.length,
    inferredAccountNameCount: parsedRows.inferredAccountNameCount,
    rejectedRows: parsedRows.rejectedRows,
    requiredColumnsMatched:
      selectedSheetCandidate.headerCandidate.requiredColumnsMatched,
    hasRequiredColumnSupport: hasRequiredColumnSupportV1({
      columnMappingsByKey:
        selectedSheetCandidate.headerCandidate.columnMappingsByKey,
      accountCompoundMapping:
        selectedSheetCandidate.headerCandidate.accountCompoundMapping,
    }),
    duplicateAccountNumberGroups:
      duplicateAppliedRows.duplicateAccountNumberGroups,
    openingBalanceTotal,
    closingBalanceTotal,
  });

  const failedChecks = verification.checks.filter(
    (check) => check.status === "fail",
  );
  if (failedChecks.length > 0) {
    return buildFailureV1(
      "VERIFICATION_FAILED",
      "Trial balance verification failed due to deterministic integrity checks.",
      "The file was parsed but verification failed. Review rejected rows and fix the source file.",
      {
        selectedSheetName: selectedSheetCandidate.sheetName,
        failedChecks,
        verification,
        rejectedRows: parsedRows.rejectedRows.map((row) => ({
          reasonCode: row.reasonCode,
          rowNumber: row.rowNumber,
          message: row.message,
        })),
      },
    );
  }

  const columnMappingsForOutput = Array.from(
    selectedSheetCandidate.headerCandidate.columnMappingsByKey.values(),
  ).map((mapping) => ({
    key: mapping.key,
    required: mapping.required,
    sourceHeader: mapping.sourceHeader,
    normalizedSourceHeader: mapping.normalizedSourceHeader,
    sourceColumnIndex: mapping.sourceColumnIndex,
    sourceColumnLetter: mapping.sourceColumnLetter,
    matchType: mapping.matchType,
  }));

  const accountCompoundMapping =
    selectedSheetCandidate.headerCandidate.accountCompoundMapping;
  if (accountCompoundMapping) {
    if (
      !columnMappingsForOutput.some((mapping) => mapping.key === "account_name")
    ) {
      columnMappingsForOutput.push({
        key: "account_name",
        required: true,
        sourceHeader: accountCompoundMapping.sourceHeader,
        normalizedSourceHeader: accountCompoundMapping.normalizedSourceHeader,
        sourceColumnIndex: accountCompoundMapping.sourceColumnIndex,
        sourceColumnLetter: accountCompoundMapping.sourceColumnLetter,
        matchType: "derived_compound_split",
      });
    }

    if (
      !columnMappingsForOutput.some(
        (mapping) => mapping.key === "account_number",
      )
    ) {
      columnMappingsForOutput.push({
        key: "account_number",
        required: true,
        sourceHeader: accountCompoundMapping.sourceHeader,
        normalizedSourceHeader: accountCompoundMapping.normalizedSourceHeader,
        sourceColumnIndex: accountCompoundMapping.sourceColumnIndex,
        sourceColumnLetter: accountCompoundMapping.sourceColumnLetter,
        matchType: "derived_compound_split",
      });
    }
  }

  const normalizedRowsForOutput = duplicateAppliedRows.normalizedRows.map((row) => ({
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    sourceAccountNumber: row.sourceAccountNumber,
    openingBalance: row.openingBalance,
    closingBalance: row.closingBalance,
    source: {
      sheetName: selectedSheetCandidate.sheetName,
      rowNumber: row.rowNumber,
    },
    rawValues: row.rawValues,
  }));
  const rejectedRowsForOutput = parsedRows.rejectedRows.map((row) => ({
    reasonCode: row.reasonCode,
    message: row.message,
    source: {
      sheetName: selectedSheetCandidate.sheetName,
      rowNumber: row.rowNumber,
    },
    rawValues: row.rawValues,
  }));
  const sheetAnalysesForOutput = sheetCandidates.map((candidate) => ({
    sheetName: candidate.sheetName,
    headerRowNumber: candidate.headerCandidate?.headerRowNumber ?? null,
    requiredColumnsMatched:
      candidate.headerCandidate?.requiredColumnsMatched ?? 0,
    candidateDataRows: candidate.candidateDataRows,
    score: candidate.score,
  }));
  const sortedColumnMappings = columnMappingsForOutput.sort(
    (left, right) => left.sourceColumnIndex - right.sourceColumnIndex,
  );
  const hasFullBalanceSupport =
    availableBalanceColumns.includes("opening_balance") &&
    availableBalanceColumns.includes("closing_balance");
  const verificationForV1 = {
    totalRowsRead: verification.totalRowsRead,
    candidateRows: verification.candidateRows,
    normalizedRows: verification.normalizedRows,
    rejectedRows: verification.rejectedRows,
    duplicateAccountNumberGroups: verification.duplicateAccountNumberGroups,
    openingBalanceTotal: openingBalanceTotal ?? 0,
    closingBalanceTotal: closingBalanceTotal ?? 0,
    checks: verification.checks,
  };

  const successPayload = hasFullBalanceSupport
    ? {
        schemaVersion: "trial_balance_normalized_v1" as const,
        fileType: resolvedFileType,
        selectedSheetName: selectedSheetCandidate.sheetName,
        headerRowNumber: selectedSheetCandidate.headerCandidate.headerRowNumber,
        columnMappings: sortedColumnMappings,
        rows: normalizedRowsForOutput.map((row) => ({
          ...row,
          openingBalance: row.openingBalance ?? 0,
          closingBalance: row.closingBalance ?? 0,
        })),
        rejectedRows: rejectedRowsForOutput,
        sheetAnalyses: sheetAnalysesForOutput,
        verification: verificationForV1,
      }
    : {
        schemaVersion: "trial_balance_normalized_v2" as const,
        fileType: resolvedFileType,
        selectedSheetName: selectedSheetCandidate.sheetName,
        headerRowNumber: selectedSheetCandidate.headerCandidate.headerRowNumber,
        columnMappings: sortedColumnMappings,
        availableBalanceColumns,
        rows: normalizedRowsForOutput,
        rejectedRows: rejectedRowsForOutput,
        sheetAnalyses: sheetAnalysesForOutput,
        verification,
      };

  return parseParseTrialBalanceResultV1({
    ok: true,
    trialBalance: successPayload,
  });
}
