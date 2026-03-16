import type { z } from "zod";

import {
  ReconcileTrialBalanceRequestV1Schema,
  type ReconcileTrialBalanceResultV1,
  type ReconciliationCheckCodeV1,
  type ReconciliationCheckV1,
  type ReconciliationStatusV1,
  parseReconcileTrialBalanceResultV1,
} from "../../shared/contracts/reconciliation.v1";
import {
  getTrialBalanceRowBalanceValueV1,
  listAvailableTrialBalanceBalanceColumnsV1,
  type TrialBalanceRejectedRowReasonCodeV1,
} from "../../shared/contracts/trial-balance.v1";

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

const NON_MATERIAL_REJECTION_REASON_CODES_V1 =
  new Set<TrialBalanceRejectedRowReasonCodeV1>([
    "NON_DATA_ROW",
    "SUMMARY_ROW_EXCLUDED",
  ]);

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function buildCheckV1(input: {
  blocking: boolean;
  code: ReconciliationCheckCodeV1;
  context: Record<string, unknown>;
  message: string;
  status: ReconciliationStatusV1;
}): ReconciliationCheckV1 {
  return {
    blocking: input.blocking,
    code: input.code,
    context: input.context,
    message: input.message,
    status: input.status,
  };
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

function normalizeLabelTextV1(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/[^a-z0-9åäö ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericSummaryValueV1(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let text = normalizeCellTextV1(value);
  if (text.length === 0) {
    return null;
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
    return null;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegative ? -parsed : parsed;
}

function isLikelyGrandTotalLabelV1(label: string): boolean {
  const normalized = normalizeLabelTextV1(label);
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

/**
 * Deterministically evaluates reconciliation checks for normalized trial balances.
 *
 * Safety boundary:
 * - This function must remain pure and AI-free.
 * - Downstream modules can gate progression using `canProceedToMapping`.
 */
export function evaluateTrialBalanceReconciliationV1(
  input: unknown,
): ReconcileTrialBalanceResultV1 {
  const parsedRequest = ReconcileTrialBalanceRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseReconcileTrialBalanceResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Trial balance reconciliation request payload is invalid.",
        user_message:
          "The reconciliation request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      },
    });
  }

  const trialBalance = parsedRequest.data.trialBalance;
  const normalizedRows = trialBalance.rows;
  const rejectedRows = trialBalance.rejectedRows;
  const availableBalanceColumns =
    listAvailableTrialBalanceBalanceColumnsV1(trialBalance);

  const candidateRows = normalizedRows.length + rejectedRows.length;
  const normalizedRowCount = normalizedRows.length;
  const rejectedRowCount = rejectedRows.length;

  const openingBalanceTotal = availableBalanceColumns.includes("opening_balance")
    ? normalizedRows.reduce(
        (sum, row) =>
          sum + (getTrialBalanceRowBalanceValueV1(row, "opening_balance") ?? 0),
        0,
      )
    : 0;
  const closingBalanceTotal = availableBalanceColumns.includes("closing_balance")
    ? normalizedRows.reduce(
        (sum, row) =>
          sum + (getTrialBalanceRowBalanceValueV1(row, "closing_balance") ?? 0),
        0,
      )
    : 0;

  const materialRejectedRows = rejectedRows.filter((row) =>
    MATERIAL_REJECTION_REASON_CODES_V1.has(row.reasonCode),
  );
  const nonMaterialRejectedRows = rejectedRows.filter((row) =>
    NON_MATERIAL_REJECTION_REASON_CODES_V1.has(row.reasonCode),
  );

  const checks: ReconciliationCheckV1[] = [];

  const hasCandidateRows = candidateRows > 0;
  checks.push(
    buildCheckV1({
      code: "candidate_rows_present",
      status: hasCandidateRows ? "pass" : "fail",
      blocking: !hasCandidateRows,
      message: hasCandidateRows
        ? "Candidate trial balance rows are present for reconciliation."
        : "No candidate rows were found in the normalized trial balance.",
      context: {
        candidateRows,
      },
    }),
  );

  const hasNormalizedRows = normalizedRowCount > 0;
  checks.push(
    buildCheckV1({
      code: "normalized_rows_present",
      status: hasNormalizedRows ? "pass" : "fail",
      blocking: !hasNormalizedRows,
      message: hasNormalizedRows
        ? "Normalized rows are available for deterministic downstream modules."
        : "No normalized rows are available.",
      context: {
        normalizedRows: normalizedRowCount,
      },
    }),
  );

  checks.push(
    buildCheckV1({
      code: "material_rejections_absent",
      status: materialRejectedRows.length > 0 ? "fail" : "pass",
      blocking: materialRejectedRows.length > 0,
      message:
        materialRejectedRows.length > 0
          ? "Material rejected rows were detected and must be corrected."
          : "No material rejected rows were detected.",
      context: {
        materialRejectedRows: materialRejectedRows.length,
        materialReasonCodes: Array.from(
          new Set(materialRejectedRows.map((row) => row.reasonCode)),
        ),
      },
    }),
  );

  checks.push(
    buildCheckV1({
      code: "non_material_rejections_review",
      status: nonMaterialRejectedRows.length > 0 ? "warning" : "pass",
      blocking: false,
      message:
        nonMaterialRejectedRows.length > 0
          ? "Non-material rejected rows were excluded and should be reviewed."
          : "No non-material rejected rows were detected.",
      context: {
        nonMaterialRejectedRows: nonMaterialRejectedRows.length,
        nonMaterialReasonCodes: Array.from(
          new Set(nonMaterialRejectedRows.map((row) => row.reasonCode)),
        ),
      },
    }),
  );

  const accountNumberCounts = new Map<string, number>();
  for (const row of normalizedRows) {
    accountNumberCounts.set(
      row.accountNumber,
      (accountNumberCounts.get(row.accountNumber) ?? 0) + 1,
    );
  }
  const duplicateAccountNumbers = Array.from(accountNumberCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([accountNumber, count]) => ({
      accountNumber,
      count,
    }));
  const hasDuplicateAccountNumbers = duplicateAccountNumbers.length > 0;

  checks.push(
    buildCheckV1({
      code: "normalized_account_number_uniqueness",
      status: hasDuplicateAccountNumbers ? "fail" : "pass",
      blocking: hasDuplicateAccountNumbers,
      message: hasDuplicateAccountNumbers
        ? "Duplicate normalized account numbers were detected."
        : "Normalized account numbers are unique.",
      context: {
        duplicateAccountNumbers,
      },
    }),
  );

  const rowsBySourceAccountNumber = new Map<
    string,
    Array<(typeof normalizedRows)[number]>
  >();
  for (const row of normalizedRows) {
    const existingRows = rowsBySourceAccountNumber.get(row.sourceAccountNumber);
    if (existingRows) {
      existingRows.push(row);
    } else {
      rowsBySourceAccountNumber.set(row.sourceAccountNumber, [row]);
    }
  }
  const duplicateSourceGroups = Array.from(rowsBySourceAccountNumber.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([sourceAccountNumber, rows]) => ({
      sourceAccountNumber,
      rows,
    }));

  const invalidDuplicateGroups = duplicateSourceGroups
    .map((group) => {
      const expectedNumbers = Array.from(
        { length: group.rows.length },
        (_, index) => `${group.sourceAccountNumber}.${index + 1}`,
      );
      const actualNumbers = group.rows.map((row) => row.accountNumber);
      const actualSet = new Set(actualNumbers);
      const missingExpected = expectedNumbers.filter(
        (expected) => !actualSet.has(expected),
      );
      const unexpectedActual = actualNumbers.filter(
        (actual) => !expectedNumbers.includes(actual),
      );
      const hasDuplicateActualValues = actualSet.size !== actualNumbers.length;

      const isInvalid =
        missingExpected.length > 0 ||
        unexpectedActual.length > 0 ||
        hasDuplicateActualValues;
      if (!isInvalid) {
        return null;
      }

      return {
        sourceAccountNumber: group.sourceAccountNumber,
        expectedNumbers,
        actualNumbers,
        missingExpected,
        unexpectedActual,
        hasDuplicateActualValues,
      };
    })
    .filter((group) => group !== null);

  checks.push(
    buildCheckV1({
      code: "duplicate_suffix_consistency",
      status:
        duplicateSourceGroups.length === 0
          ? "pass"
          : invalidDuplicateGroups.length > 0
            ? "fail"
            : "warning",
      blocking: invalidDuplicateGroups.length > 0,
      message:
        duplicateSourceGroups.length === 0
          ? "No duplicate source account numbers required suffix validation."
          : invalidDuplicateGroups.length > 0
            ? "Duplicate source account numbers are not consistently suffixed."
            : "Duplicate source account numbers were consistently suffixed.",
      context: {
        duplicateSourceGroups: duplicateSourceGroups.length,
        invalidDuplicateGroups,
      },
    }),
  );

  const countMismatches: string[] = [];
  if (trialBalance.verification.normalizedRows !== normalizedRowCount) {
    countMismatches.push("normalizedRows");
  }
  if (trialBalance.verification.rejectedRows !== rejectedRowCount) {
    countMismatches.push("rejectedRows");
  }
  if (trialBalance.verification.candidateRows !== candidateRows) {
    countMismatches.push("candidateRows");
  }

  checks.push(
    buildCheckV1({
      code: "verification_count_consistency",
      status: countMismatches.length > 0 ? "fail" : "pass",
      blocking: countMismatches.length > 0,
      message:
        countMismatches.length > 0
          ? "Parser verification row counts are inconsistent with derived counts."
          : "Parser verification row counts match derived counts.",
      context: {
        verification: {
          normalizedRows: trialBalance.verification.normalizedRows,
          rejectedRows: trialBalance.verification.rejectedRows,
          candidateRows: trialBalance.verification.candidateRows,
        },
        derived: {
          normalizedRows: normalizedRowCount,
          rejectedRows: rejectedRowCount,
          candidateRows,
        },
        mismatchedFields: countMismatches,
      },
    }),
  );

  const openingTotalMatches = isApproximatelyEqualV1(
    openingBalanceTotal,
    trialBalance.verification.openingBalanceTotal ?? 0,
  );
  const closingTotalMatches = isApproximatelyEqualV1(
    closingBalanceTotal,
    trialBalance.verification.closingBalanceTotal ?? 0,
  );
  const shouldValidateOpeningTotal =
    availableBalanceColumns.includes("opening_balance");
  const shouldValidateClosingTotal =
    availableBalanceColumns.includes("closing_balance");
  const totalsConsistent =
    (!shouldValidateOpeningTotal || openingTotalMatches) &&
    (!shouldValidateClosingTotal || closingTotalMatches);

  checks.push(
    buildCheckV1({
      code: "verification_total_consistency",
      status: totalsConsistent ? "pass" : "fail",
      blocking: !totalsConsistent,
      message:
        totalsConsistent
          ? "Parser verification totals match derived normalized-row totals."
          : "Parser verification totals are inconsistent with derived totals.",
      context: {
        verification: {
          openingBalanceTotal: trialBalance.verification.openingBalanceTotal,
          closingBalanceTotal: trialBalance.verification.closingBalanceTotal,
        },
        derived: {
          openingBalanceTotal,
          closingBalanceTotal,
        },
        availableBalanceColumns,
        openingTotalMatches,
        closingTotalMatches,
      },
    }),
  );

  const summaryRows = rejectedRows.filter((row) =>
    NON_MATERIAL_REJECTION_REASON_CODES_V1.has(row.reasonCode),
  );
  const summaryRowsWithNumericTotals = summaryRows
    .map((row) => {
      const opening = availableBalanceColumns.includes("opening_balance")
        ? parseNumericSummaryValueV1(row.rawValues.opening_balance)
        : null;
      const closing = availableBalanceColumns.includes("closing_balance")
        ? parseNumericSummaryValueV1(row.rawValues.closing_balance)
        : null;
      if (
        (availableBalanceColumns.includes("opening_balance") &&
          opening === null) ||
        (availableBalanceColumns.includes("closing_balance") &&
          closing === null)
      ) {
        return null;
      }

      const label = normalizeCellTextV1(
        row.rawValues.account_name ?? row.rawValues.account_number ?? "",
      );

      return {
        opening,
        closing,
        label,
        rowNumber: row.source.rowNumber,
      };
    })
    .filter((row) => row !== null);
  const grandTotalRows = summaryRowsWithNumericTotals.filter((row) =>
    isLikelyGrandTotalLabelV1(row.label),
  );
  const hasMatchingGrandTotal = grandTotalRows.some(
    (row) =>
      (!availableBalanceColumns.includes("opening_balance") ||
        (row.opening !== null &&
          isApproximatelyEqualV1(row.opening, openingBalanceTotal))) &&
      (!availableBalanceColumns.includes("closing_balance") ||
        (row.closing !== null &&
          isApproximatelyEqualV1(row.closing, closingBalanceTotal))),
  );

  let summaryConsistencyStatus: ReconciliationStatusV1;
  let summaryConsistencyBlocking = false;
  let summaryConsistencyMessage: string;

  if (grandTotalRows.length > 0) {
    if (hasMatchingGrandTotal) {
      summaryConsistencyStatus = "pass";
      summaryConsistencyMessage =
        "Grand total summary rows are consistent with normalized totals.";
    } else {
      summaryConsistencyStatus = "fail";
      summaryConsistencyBlocking = true;
      summaryConsistencyMessage =
        "Grand total summary rows do not match normalized totals.";
    }
  } else if (summaryRowsWithNumericTotals.length > 0) {
    summaryConsistencyStatus = "warning";
    summaryConsistencyMessage =
      "Summary rows were detected but no definitive grand total row was found.";
  } else {
    summaryConsistencyStatus = "pass";
    summaryConsistencyMessage =
      "No summary-row total inconsistencies were detected.";
  }

  checks.push(
    buildCheckV1({
      code: "summary_row_total_consistency",
      status: summaryConsistencyStatus,
      blocking: summaryConsistencyBlocking,
      message: summaryConsistencyMessage,
      context: {
        summaryRows: summaryRows.length,
        summaryRowsWithNumericTotals: summaryRowsWithNumericTotals.length,
        grandTotalRows: grandTotalRows.length,
        hasMatchingGrandTotal,
      },
    }),
  );

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warning");
  const status: ReconciliationStatusV1 = hasFail
    ? "fail"
    : hasWarning
      ? "warning"
      : "pass";

  const blockingReasonCodes = checks
    .filter((check) => check.status === "fail" && check.blocking)
    .map((check) => check.code);

  return parseReconcileTrialBalanceResultV1({
    ok: true,
    reconciliation: {
      schemaVersion: "reconciliation_result_v1",
      status,
      canProceedToMapping: status !== "fail",
      blockingReasonCodes,
      summary: {
        candidateRows,
        normalizedRows: normalizedRowCount,
        rejectedRows: rejectedRowCount,
        materialRejectedRows: materialRejectedRows.length,
        nonMaterialRejectedRows: nonMaterialRejectedRows.length,
        availableBalanceColumns,
        openingBalanceTotal,
        closingBalanceTotal,
      },
      checks,
    },
  });
}
