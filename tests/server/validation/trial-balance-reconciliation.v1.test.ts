import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { parseTrialBalanceFileV1 } from "../../../src/server/parsing/trial-balance-parser.v1";
import { evaluateTrialBalanceReconciliationV1 } from "../../../src/server/validation/trial-balance-reconciliation.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

function createWorkbookBytesV1(input: {
  sheets: Record<string, unknown[][]>;
}): Uint8Array {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(input.sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return new Uint8Array(bytes);
}

function createBaseTrialBalanceV1() {
  return parseTrialBalanceNormalizedV1({
    schemaVersion: "trial_balance_normalized_v1",
    fileType: "xlsx",
    selectedSheetName: "Trial Balance",
    headerRowNumber: 1,
    columnMappings: [
      {
        key: "account_name",
        required: true,
        sourceHeader: "Account Name",
        normalizedSourceHeader: "account name",
        sourceColumnIndex: 0,
        sourceColumnLetter: "A",
        matchType: "exact_synonym",
      },
      {
        key: "account_number",
        required: true,
        sourceHeader: "Account Number",
        normalizedSourceHeader: "account number",
        sourceColumnIndex: 1,
        sourceColumnLetter: "B",
        matchType: "exact_synonym",
      },
      {
        key: "opening_balance",
        required: true,
        sourceHeader: "Opening Balance",
        normalizedSourceHeader: "opening balance",
        sourceColumnIndex: 2,
        sourceColumnLetter: "C",
        matchType: "exact_synonym",
      },
      {
        key: "closing_balance",
        required: true,
        sourceHeader: "Closing Balance",
        normalizedSourceHeader: "closing balance",
        sourceColumnIndex: 3,
        sourceColumnLetter: "D",
        matchType: "exact_synonym",
      },
    ],
    rows: [
      {
        accountName: "Cash",
        accountNumber: "1000",
        sourceAccountNumber: "1000",
        openingBalance: 100,
        closingBalance: 150,
        source: {
          sheetName: "Trial Balance",
          rowNumber: 2,
        },
        rawValues: {
          account_name: "Cash",
          account_number: "1000",
          opening_balance: "100",
          closing_balance: "150",
        },
      },
      {
        accountName: "Receivables",
        accountNumber: "2000",
        sourceAccountNumber: "2000",
        openingBalance: 200,
        closingBalance: 250,
        source: {
          sheetName: "Trial Balance",
          rowNumber: 3,
        },
        rawValues: {
          account_name: "Receivables",
          account_number: "2000",
          opening_balance: "200",
          closing_balance: "250",
        },
      },
    ],
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "Trial Balance",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: 2,
        score: 4800,
      },
    ],
    verification: {
      totalRowsRead: 3,
      candidateRows: 2,
      normalizedRows: 2,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 300,
      closingBalanceTotal: 400,
      checks: [
        {
          code: "required_columns_present",
          status: "pass",
          message: "ok",
          context: {},
        },
      ],
    },
  });
}

function updateVerificationFromRowsV1(
  trialBalance: ReturnType<typeof createBaseTrialBalanceV1>,
): void {
  const duplicateSourceAccountGroups = new Map<string, number>();
  for (const row of trialBalance.rows) {
    duplicateSourceAccountGroups.set(
      row.sourceAccountNumber,
      (duplicateSourceAccountGroups.get(row.sourceAccountNumber) ?? 0) + 1,
    );
  }

  trialBalance.verification.candidateRows =
    trialBalance.rows.length + trialBalance.rejectedRows.length;
  trialBalance.verification.normalizedRows = trialBalance.rows.length;
  trialBalance.verification.rejectedRows = trialBalance.rejectedRows.length;
  trialBalance.verification.openingBalanceTotal = trialBalance.rows.reduce(
    (sum, row) => sum + (row.openingBalance ?? 0),
    0,
  );
  trialBalance.verification.closingBalanceTotal = trialBalance.rows.reduce(
    (sum, row) => sum + (row.closingBalance ?? 0),
    0,
  );
  trialBalance.verification.duplicateAccountNumberGroups = Array.from(
    duplicateSourceAccountGroups.values(),
  ).filter((count) => count > 1).length;
}

function getCheckStatusByCodeV1(
  checks: Array<{ code: string; status: "pass" | "warning" | "fail" }>,
  code: string,
): "pass" | "warning" | "fail" {
  const check = checks.find((item) => item.code === code);
  if (!check) {
    throw new Error(`Missing check ${code}`);
  }

  return check.status;
}

describe("trial balance reconciliation v1", () => {
  it("returns INPUT_INVALID for malformed input", () => {
    const result = evaluateTrialBalanceReconciliationV1({
      invalid: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("INPUT_INVALID");
  });

  it("returns pass for a clean normalized trial balance", () => {
    const trialBalance = createBaseTrialBalanceV1();

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("pass");
    expect(result.reconciliation.canProceedToMapping).toBe(true);
    expect(result.reconciliation.blockingReasonCodes).toEqual([]);
    expect(result.reconciliation.checks).toHaveLength(9);
  });

  it("returns warning for non-material rejected rows only", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "NON_DATA_ROW",
      message: "Header row",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 4,
      },
      rawValues: {
        account_name: "Header section",
        opening_balance: null,
        closing_balance: null,
      },
    });
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("warning");
    expect(result.reconciliation.canProceedToMapping).toBe(true);
    expect(
      getCheckStatusByCodeV1(
        result.reconciliation.checks,
        "non_material_rejections_review",
      ),
    ).toBe("warning");
  });

  it("returns fail for material rejected rows", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "OPENING_BALANCE_INVALID",
      message: "Could not parse opening balance.",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 4,
      },
      rawValues: {
        account_name: "Inventory",
        account_number: "1400",
        opening_balance: "12x",
        closing_balance: "120",
      },
    });
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.canProceedToMapping).toBe(false);
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "material_rejections_absent",
    );
  });

  it("returns fail when normalized account numbers are duplicated", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rows[1].accountNumber = trialBalance.rows[0].accountNumber;
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "normalized_account_number_uniqueness",
    );
  });

  it("returns warning for correctly suffixed duplicate source accounts", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rows = [
      {
        ...trialBalance.rows[0],
        sourceAccountNumber: "1001",
        accountNumber: "1001.1",
      },
      {
        ...trialBalance.rows[1],
        sourceAccountNumber: "1001",
        accountNumber: "1001.2",
      },
    ];
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("warning");
    expect(result.reconciliation.canProceedToMapping).toBe(true);
    expect(
      getCheckStatusByCodeV1(
        result.reconciliation.checks,
        "duplicate_suffix_consistency",
      ),
    ).toBe("warning");
  });

  it("returns fail for incorrect duplicate suffix patterns", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rows = [
      {
        ...trialBalance.rows[0],
        sourceAccountNumber: "1001",
        accountNumber: "1001.1",
      },
      {
        ...trialBalance.rows[1],
        sourceAccountNumber: "1001",
        accountNumber: "1001.3",
      },
    ];
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "duplicate_suffix_consistency",
    );
  });

  it("returns fail when parser verification counts are inconsistent", () => {
    const trialBalance = createBaseTrialBalanceV1();
    updateVerificationFromRowsV1(trialBalance);
    trialBalance.verification.normalizedRows = 999;

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "verification_count_consistency",
    );
  });

  it("returns fail when parser verification totals are inconsistent", () => {
    const trialBalance = createBaseTrialBalanceV1();
    updateVerificationFromRowsV1(trialBalance);
    trialBalance.verification.openingBalanceTotal =
      (trialBalance.verification.openingBalanceTotal ?? 0) + 1;

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "verification_total_consistency",
    );
  });

  it("returns warning when summary rows exist without a definitive grand total row", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "SUMMARY_ROW_EXCLUDED",
      message: "Subtotal row",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 4,
      },
      rawValues: {
        account_name: "Subtotal assets",
        opening_balance: "300",
        closing_balance: "400",
      },
    });
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      getCheckStatusByCodeV1(
        result.reconciliation.checks,
        "summary_row_total_consistency",
      ),
    ).toBe("warning");
  });

  it("allows closing-balance-only trial balances to proceed without opening-balance checks", () => {
    const trialBalance = parseTrialBalanceNormalizedV1({
      schemaVersion: "trial_balance_normalized_v2",
      fileType: "xlsx",
      selectedSheetName: "Trial Balance",
      headerRowNumber: 1,
      columnMappings: [
        {
          key: "account_name",
          required: true,
          sourceHeader: "Account Name",
          normalizedSourceHeader: "account name",
          sourceColumnIndex: 0,
          sourceColumnLetter: "A",
          matchType: "exact_synonym",
        },
        {
          key: "account_number",
          required: true,
          sourceHeader: "Account Number",
          normalizedSourceHeader: "account number",
          sourceColumnIndex: 1,
          sourceColumnLetter: "B",
          matchType: "exact_synonym",
        },
        {
          key: "closing_balance",
          required: true,
          sourceHeader: "Closing Balance",
          normalizedSourceHeader: "closing balance",
          sourceColumnIndex: 2,
          sourceColumnLetter: "C",
          matchType: "exact_synonym",
        },
      ],
      availableBalanceColumns: ["closing_balance"],
      rows: [
        {
          accountName: "Cash",
          accountNumber: "1000",
          sourceAccountNumber: "1000",
          openingBalance: null,
          closingBalance: 150,
          source: {
            sheetName: "Trial Balance",
            rowNumber: 2,
          },
          rawValues: {
            account_name: "Cash",
            account_number: "1000",
            closing_balance: "150",
          },
        },
      ],
      rejectedRows: [],
      sheetAnalyses: [
        {
          sheetName: "Trial Balance",
          headerRowNumber: 1,
          requiredColumnsMatched: 3,
          candidateDataRows: 1,
          score: 3000,
        },
      ],
      verification: {
        totalRowsRead: 2,
        candidateRows: 1,
        normalizedRows: 1,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 0,
        availableBalanceColumns: ["closing_balance"],
        openingBalanceTotal: null,
        closingBalanceTotal: 150,
        checks: [
          {
            code: "required_columns_present",
            status: "pass",
            message: "ok",
            context: {},
          },
        ],
      },
    });

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("pass");
    expect(result.reconciliation.summary.availableBalanceColumns).toEqual([
      "closing_balance",
    ]);
    expect(
      getCheckStatusByCodeV1(
        result.reconciliation.checks,
        "verification_total_consistency",
      ),
    ).toBe("pass");
  });

  it("returns fail when grand total summary rows do not match normalized totals", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "SUMMARY_ROW_EXCLUDED",
      message: "Grand total row",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 4,
      },
      rawValues: {
        account_name: "Total",
        opening_balance: "999",
        closing_balance: "999",
      },
    });
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateTrialBalanceReconciliationV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("fail");
    expect(result.reconciliation.blockingReasonCodes).toContain(
      "summary_row_total_consistency",
    );
  });

  it("accepts parser output and reconciles it successfully (contract boundary)", () => {
    const fileBytes = createWorkbookBytesV1({
      sheets: {
        "Trial Balance": [
          [
            "Account Name",
            "Account Number",
            "Opening Balance",
            "Closing Balance",
          ],
          ["Cash", "1001", "1000", "1200"],
          ["Receivables", "1510", "500", "450"],
        ],
      },
    });

    const parseResult = parseTrialBalanceFileV1({
      fileName: "boundary.xlsx",
      fileBytes,
    });

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) {
      return;
    }

    const reconciliationResult = evaluateTrialBalanceReconciliationV1({
      trialBalance: parseResult.trialBalance,
    });

    expect(reconciliationResult.ok).toBe(true);
    if (!reconciliationResult.ok) {
      return;
    }

    expect(reconciliationResult.reconciliation.status).toBe("pass");
    expect(reconciliationResult.reconciliation.canProceedToMapping).toBe(true);
  });
});
