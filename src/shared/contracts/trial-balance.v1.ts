import { z } from "zod";

/**
 * Supported upload file formats for deterministic trial-balance parsing in V1.
 */
export const TrialBalanceFileTypeV1Schema = z.enum([
  "xlsx",
  "xlsm",
  "xls",
  "xlsb",
  "csv",
]);

/**
 * Inferred TypeScript type for supported trial-balance file formats.
 */
export type TrialBalanceFileTypeV1 = z.infer<
  typeof TrialBalanceFileTypeV1Schema
>;

/**
 * Canonical V1 column keys for normalized trial-balance rows.
 *
 * Keep this enum as the single contract source when new columns are introduced.
 */
export const TrialBalanceColumnKeyV1Schema = z.enum([
  "account_name",
  "account_number",
  "opening_balance",
  "closing_balance",
]);

/**
 * Inferred TypeScript type for canonical trial-balance column keys.
 */
export type TrialBalanceColumnKeyV1 = z.infer<
  typeof TrialBalanceColumnKeyV1Schema
>;

/**
 * Canonical balance-only column keys used when files omit one side.
 */
export const TrialBalanceBalanceColumnKeyV1Schema = z.enum([
  "opening_balance",
  "closing_balance",
]);

/**
 * Inferred TypeScript type for canonical balance-only trial-balance keys.
 */
export type TrialBalanceBalanceColumnKeyV1 = z.infer<
  typeof TrialBalanceBalanceColumnKeyV1Schema
>;

/**
 * Row-level rejection reasons for deterministic parsing.
 */
export const TrialBalanceRejectedRowReasonCodeV1Schema = z.enum([
  "NON_DATA_ROW",
  "SUMMARY_ROW_EXCLUDED",
  "ACCOUNT_NUMBER_MISSING",
  "ACCOUNT_NAME_MISSING",
  "ACCOUNT_COMBINED_PARSE_FAILED",
  "OPENING_BALANCE_MISSING",
  "OPENING_BALANCE_INVALID",
  "CLOSING_BALANCE_MISSING",
  "CLOSING_BALANCE_INVALID",
]);

/**
 * Inferred TypeScript type for row rejection reason codes.
 */
export type TrialBalanceRejectedRowReasonCodeV1 = z.infer<
  typeof TrialBalanceRejectedRowReasonCodeV1Schema
>;

/**
 * Verification check status used in parse summaries.
 */
export const TrialBalanceVerificationStatusV1Schema = z.enum([
  "pass",
  "warning",
  "fail",
]);

/**
 * Inferred TypeScript type for verification status values.
 */
export type TrialBalanceVerificationStatusV1 = z.infer<
  typeof TrialBalanceVerificationStatusV1Schema
>;

/**
 * Structured parse error codes for trial-balance parsing workflows.
 */
export const TrialBalanceParseErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "UNSUPPORTED_FILE_FORMAT",
  "REQUIRED_COLUMN_MISSING",
  "PARSE_ERROR",
  "VERIFICATION_FAILED",
]);

/**
 * Inferred TypeScript type for parse error codes.
 */
export type TrialBalanceParseErrorCodeV1 = z.infer<
  typeof TrialBalanceParseErrorCodeV1Schema
>;

/**
 * Request payload for parsing a trial-balance file into normalized rows.
 */
export const ParseTrialBalanceRequestV1Schema = z
  .object({
    fileName: z.string().trim().min(1),
    fileBytes: z.custom<Uint8Array>(
      (value) => value instanceof Uint8Array && value.byteLength > 0,
      "Expected non-empty Uint8Array file bytes.",
    ),
    fileType: TrialBalanceFileTypeV1Schema.optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for trial-balance parse request payloads.
 */
export type ParseTrialBalanceRequestV1 = z.infer<
  typeof ParseTrialBalanceRequestV1Schema
>;

/**
 * Source location for parsed rows or mapping metadata.
 */
export const TrialBalanceSourceLocationV1Schema = z
  .object({
    sheetName: z.string().trim().min(1),
    rowNumber: z.number().int().positive(),
    columnIndex: z.number().int().nonnegative().optional(),
    columnLetter: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for source locations.
 */
export type TrialBalanceSourceLocationV1 = z.infer<
  typeof TrialBalanceSourceLocationV1Schema
>;

/**
 * Stable V1 row identity for referencing a normalized trial-balance row across
 * mapping and adjustment modules without passing raw worksheet structures.
 */
export const TrialBalanceRowIdentityV1Schema = z
  .object({
    rowKey: z.string().trim().min(1),
    source: TrialBalanceSourceLocationV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for normalized row identities.
 */
export type TrialBalanceRowIdentityV1 = z.infer<
  typeof TrialBalanceRowIdentityV1Schema
>;

/**
 * Raw cell value contract for traceability.
 */
export const TrialBalanceRawCellValueV1Schema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Inferred TypeScript type for raw trace values.
 */
export type TrialBalanceRawCellValueV1 = z.infer<
  typeof TrialBalanceRawCellValueV1Schema
>;

/**
 * Column mapping metadata documenting how canonical columns were resolved.
 */
export const TrialBalanceColumnMappingV1Schema = z
  .object({
    key: TrialBalanceColumnKeyV1Schema,
    required: z.boolean(),
    sourceHeader: z.string().trim().min(1),
    normalizedSourceHeader: z.string().trim().min(1),
    sourceColumnIndex: z.number().int().nonnegative(),
    sourceColumnLetter: z.string().trim().min(1),
    matchType: z.enum([
      "exact_synonym",
      "token_match",
      "derived_compound_split",
    ]),
  })
  .strict();

/**
 * Inferred TypeScript type for column mapping metadata.
 */
export type TrialBalanceColumnMappingV1 = z.infer<
  typeof TrialBalanceColumnMappingV1Schema
>;

/**
 * Normalized trial-balance row contract used by downstream deterministic modules.
 */
export const TrialBalanceNormalizedRowV1Schema = z
  .object({
    accountName: z.string().trim().min(1),
    accountNumber: z.string().trim().min(1),
    sourceAccountNumber: z.string().trim().min(1),
    openingBalance: z.number().finite(),
    closingBalance: z.number().finite(),
    source: TrialBalanceSourceLocationV1Schema,
    rawValues: z.record(z.string(), TrialBalanceRawCellValueV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for normalized trial-balance rows.
 */
export type TrialBalanceNormalizedRowV1 = z.infer<
  typeof TrialBalanceNormalizedRowV1Schema
>;

/**
 * V2 normalized trial-balance row contract for flexible input files where one
 * balance column may be absent from the source workbook.
 */
export const TrialBalanceNormalizedRowV2Schema = z
  .object({
    accountName: z.string().trim().min(1),
    accountNumber: z.string().trim().min(1),
    sourceAccountNumber: z.string().trim().min(1),
    openingBalance: z.number().finite().nullable(),
    closingBalance: z.number().finite().nullable(),
    source: TrialBalanceSourceLocationV1Schema,
    rawValues: z.record(z.string(), TrialBalanceRawCellValueV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for V2 normalized trial-balance rows.
 */
export type TrialBalanceNormalizedRowV2 = z.infer<
  typeof TrialBalanceNormalizedRowV2Schema
>;

/**
 * Union row contract consumed by downstream modules while V1 and V2 coexist.
 */
export type TrialBalanceNormalizedRowArtifactV1 =
  | TrialBalanceNormalizedRowV1
  | TrialBalanceNormalizedRowV2;

/**
 * Rejected row contract for deterministic parse diagnostics.
 */
export const TrialBalanceRejectedRowV1Schema = z
  .object({
    reasonCode: TrialBalanceRejectedRowReasonCodeV1Schema,
    message: z.string().trim().min(1),
    source: TrialBalanceSourceLocationV1Schema,
    rawValues: z.record(z.string(), TrialBalanceRawCellValueV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for rejected row diagnostics.
 */
export type TrialBalanceRejectedRowV1 = z.infer<
  typeof TrialBalanceRejectedRowV1Schema
>;

/**
 * Sheet-level analysis summary used for deterministic sheet selection auditability.
 */
export const TrialBalanceSheetAnalysisV1Schema = z
  .object({
    sheetName: z.string().trim().min(1),
    headerRowNumber: z.number().int().positive().nullable(),
    requiredColumnsMatched: z.number().int().nonnegative(),
    candidateDataRows: z.number().int().nonnegative(),
    score: z.number(),
  })
  .strict();

/**
 * Inferred TypeScript type for sheet analysis summaries.
 */
export type TrialBalanceSheetAnalysisV1 = z.infer<
  typeof TrialBalanceSheetAnalysisV1Schema
>;

/**
 * Verification check contract for parsed trial-balance outputs.
 */
export const TrialBalanceVerificationCheckV1Schema = z
  .object({
    code: z.string().trim().min(1),
    status: TrialBalanceVerificationStatusV1Schema,
    message: z.string().trim().min(1),
    context: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Inferred TypeScript type for verification checks.
 */
export type TrialBalanceVerificationCheckV1 = z.infer<
  typeof TrialBalanceVerificationCheckV1Schema
>;

/**
 * Deterministic verification summary that captures parse coverage and integrity.
 */
export const TrialBalanceVerificationSummaryV1Schema = z
  .object({
    totalRowsRead: z.number().int().nonnegative(),
    candidateRows: z.number().int().nonnegative(),
    normalizedRows: z.number().int().nonnegative(),
    rejectedRows: z.number().int().nonnegative(),
    duplicateAccountNumberGroups: z.number().int().nonnegative(),
    openingBalanceTotal: z.number().finite(),
    closingBalanceTotal: z.number().finite(),
    checks: z.array(TrialBalanceVerificationCheckV1Schema).min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for verification summaries.
 */
export type TrialBalanceVerificationSummaryV1 = z.infer<
  typeof TrialBalanceVerificationSummaryV1Schema
>;

/**
 * V2 verification summary that records which balance columns were actually
 * available instead of forcing missing source columns to behave like zeroes.
 */
export const TrialBalanceVerificationSummaryV2Schema = z
  .object({
    totalRowsRead: z.number().int().nonnegative(),
    candidateRows: z.number().int().nonnegative(),
    normalizedRows: z.number().int().nonnegative(),
    rejectedRows: z.number().int().nonnegative(),
    duplicateAccountNumberGroups: z.number().int().nonnegative(),
    availableBalanceColumns: z
      .array(TrialBalanceBalanceColumnKeyV1Schema)
      .min(1),
    openingBalanceTotal: z.number().finite().nullable(),
    closingBalanceTotal: z.number().finite().nullable(),
    checks: z.array(TrialBalanceVerificationCheckV1Schema).min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for V2 verification summaries.
 */
export type TrialBalanceVerificationSummaryV2 = z.infer<
  typeof TrialBalanceVerificationSummaryV2Schema
>;

/**
 * Normalized output payload produced by the deterministic trial-balance parser.
 */
export const TrialBalanceNormalizedV1Schema = z
  .object({
    schemaVersion: z.literal("trial_balance_normalized_v1"),
    fileType: TrialBalanceFileTypeV1Schema,
    selectedSheetName: z.string().trim().min(1),
    headerRowNumber: z.number().int().positive(),
    columnMappings: z.array(TrialBalanceColumnMappingV1Schema).min(1),
    rows: z.array(TrialBalanceNormalizedRowV1Schema),
    rejectedRows: z.array(TrialBalanceRejectedRowV1Schema),
    sheetAnalyses: z.array(TrialBalanceSheetAnalysisV1Schema).min(1),
    verification: TrialBalanceVerificationSummaryV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for normalized trial-balance outputs.
 */
export type TrialBalanceNormalizedV1 = z.infer<
  typeof TrialBalanceNormalizedV1Schema
>;

/**
 * Flexible normalized output payload produced by the deterministic parser when
 * the source workbook does not provide the full V1 balance set.
 */
export const TrialBalanceNormalizedV2Schema = z
  .object({
    schemaVersion: z.literal("trial_balance_normalized_v2"),
    fileType: TrialBalanceFileTypeV1Schema,
    selectedSheetName: z.string().trim().min(1),
    headerRowNumber: z.number().int().positive(),
    columnMappings: z.array(TrialBalanceColumnMappingV1Schema).min(1),
    availableBalanceColumns: z.array(TrialBalanceBalanceColumnKeyV1Schema).min(1),
    rows: z.array(TrialBalanceNormalizedRowV2Schema),
    rejectedRows: z.array(TrialBalanceRejectedRowV1Schema),
    sheetAnalyses: z.array(TrialBalanceSheetAnalysisV1Schema).min(1),
    verification: TrialBalanceVerificationSummaryV2Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for V2 normalized trial-balance outputs.
 */
export type TrialBalanceNormalizedV2 = z.infer<
  typeof TrialBalanceNormalizedV2Schema
>;

/**
 * Union artifact contract accepted during the V1 -> V2 migration window.
 */
export const TrialBalanceNormalizedArtifactV1Schema = z.discriminatedUnion(
  "schemaVersion",
  [TrialBalanceNormalizedV1Schema, TrialBalanceNormalizedV2Schema],
);

/**
 * Inferred TypeScript type for accepted normalized trial-balance artifacts.
 */
export type TrialBalanceNormalizedArtifactV1 = z.infer<
  typeof TrialBalanceNormalizedArtifactV1Schema
>;

/**
 * Structured parse failure payload for deterministic parser workflows.
 */
export const ParseTrialBalanceFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: TrialBalanceParseErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for parser failures.
 */
export type ParseTrialBalanceFailureV1 = z.infer<
  typeof ParseTrialBalanceFailureV1Schema
>;

/**
 * Success payload for deterministic trial-balance parsing.
 */
export const ParseTrialBalanceSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    trialBalance: TrialBalanceNormalizedArtifactV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for parser successes.
 */
export type ParseTrialBalanceSuccessV1 = z.infer<
  typeof ParseTrialBalanceSuccessV1Schema
>;

/**
 * Discriminated result payload for trial-balance parse workflows.
 */
export const ParseTrialBalanceResultV1Schema = z.discriminatedUnion("ok", [
  ParseTrialBalanceSuccessV1Schema,
  ParseTrialBalanceFailureV1Schema,
]);

/**
 * Inferred TypeScript type for parser workflow results.
 */
export type ParseTrialBalanceResultV1 = z.infer<
  typeof ParseTrialBalanceResultV1Schema
>;

/**
 * Parses unknown input into a trial-balance parse request payload.
 */
export function parseParseTrialBalanceRequestV1(
  input: unknown,
): ParseTrialBalanceRequestV1 {
  return ParseTrialBalanceRequestV1Schema.parse(input);
}

/**
 * Builds the stable V1 row key from the canonical source location.
 *
 * This key is scoped to the normalized trial-balance artifact and should be
 * treated as immutable once the parser output is persisted.
 */
export function buildTrialBalanceRowKeyV1(
  source: TrialBalanceSourceLocationV1,
): string {
  const columnPart =
    typeof source.columnIndex === "number" ? `:${source.columnIndex}` : "";
  return `${source.sheetName}:${source.rowNumber}${columnPart}`;
}

/**
 * Builds the stable V1 row identity object from a canonical source location.
 */
export function buildTrialBalanceRowIdentityV1(
  source: TrialBalanceSourceLocationV1,
): TrialBalanceRowIdentityV1 {
  return {
    rowKey: buildTrialBalanceRowKeyV1(source),
    source,
  };
}

/**
 * Safely validates unknown input as a trial-balance parse request payload.
 */
export function safeParseParseTrialBalanceRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ParseTrialBalanceRequestV1> {
  return ParseTrialBalanceRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into normalized trial-balance payloads.
 */
export function parseTrialBalanceNormalizedV1(
  input: unknown,
): TrialBalanceNormalizedArtifactV1 {
  return TrialBalanceNormalizedArtifactV1Schema.parse(input);
}

/**
 * Parses unknown input into stable trial-balance row identities.
 */
export function parseTrialBalanceRowIdentityV1(
  input: unknown,
): TrialBalanceRowIdentityV1 {
  return TrialBalanceRowIdentityV1Schema.parse(input);
}

/**
 * Safely validates unknown input as normalized trial-balance payloads.
 */
export function safeParseTrialBalanceNormalizedV1(
  input: unknown,
): z.SafeParseReturnType<unknown, TrialBalanceNormalizedArtifactV1> {
  return TrialBalanceNormalizedArtifactV1Schema.safeParse(input);
}

/**
 * Returns the balance columns that are truly available on a normalized
 * trial-balance artifact, preserving V1 compatibility.
 */
export function listAvailableTrialBalanceBalanceColumnsV1(
  trialBalance: TrialBalanceNormalizedArtifactV1,
): TrialBalanceBalanceColumnKeyV1[] {
  if (trialBalance.schemaVersion === "trial_balance_normalized_v2") {
    return [...trialBalance.availableBalanceColumns];
  }

  return ["opening_balance", "closing_balance"];
}

/**
 * Reads a normalized row balance and returns `null` when the source workbook
 * did not provide that balance column.
 */
export function getTrialBalanceRowBalanceValueV1(
  row: TrialBalanceNormalizedRowArtifactV1,
  key: TrialBalanceBalanceColumnKeyV1,
): number | null {
  if (key === "opening_balance") {
    return row.openingBalance ?? null;
  }

  return row.closingBalance ?? null;
}

/**
 * Parses unknown input into deterministic trial-balance parse results.
 */
export function parseParseTrialBalanceResultV1(
  input: unknown,
): ParseTrialBalanceResultV1 {
  return ParseTrialBalanceResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as deterministic trial-balance parse results.
 */
export function safeParseParseTrialBalanceResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ParseTrialBalanceResultV1> {
  return ParseTrialBalanceResultV1Schema.safeParse(input);
}
