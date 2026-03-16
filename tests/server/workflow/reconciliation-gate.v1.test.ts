import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { parseTrialBalanceFileV1 } from "../../../src/server/parsing/trial-balance-parser.v1";
import { evaluateReconciliationGateForMappingV1 } from "../../../src/server/workflow/reconciliation-gate.v1";
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

describe("reconciliation gate workflow v1", () => {
  it("returns INPUT_INVALID for malformed payloads", () => {
    const result = evaluateReconciliationGateForMappingV1({
      invalid: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("INPUT_INVALID");
  });

  it("allows mapping when reconciliation passes", () => {
    const result = evaluateReconciliationGateForMappingV1({
      trialBalance: createBaseTrialBalanceV1(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("pass");
    expect(result.reconciliation.canProceedToMapping).toBe(true);
  });

  it("allows mapping when reconciliation has warnings only", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "NON_DATA_ROW",
      message: "Header row",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 4,
      },
      rawValues: {
        account_name: "Header",
        opening_balance: null,
        closing_balance: null,
      },
    });
    updateVerificationFromRowsV1(trialBalance);

    const result = evaluateReconciliationGateForMappingV1({
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reconciliation.status).toBe("warning");
    expect(result.reconciliation.canProceedToMapping).toBe(true);
  });

  it("blocks mapping when reconciliation fails", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.rejectedRows.push({
      reasonCode: "OPENING_BALANCE_INVALID",
      message: "bad opening value",
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

    const result = evaluateReconciliationGateForMappingV1({
      trialBalance,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("RECONCILIATION_BLOCKED");
    expect(result.error.context.reconciliationStatus).toBe("fail");
    const blockingReasonCodes = result.error.context.blockingReasonCodes as
      | string[]
      | undefined;
    expect(blockingReasonCodes).toContain("material_rejections_absent");
  });

  it("blocks mapping when verification totals are inconsistent", () => {
    const trialBalance = createBaseTrialBalanceV1();
    trialBalance.verification.openingBalanceTotal =
      (trialBalance.verification.openingBalanceTotal ?? 0) + 10;

    const result = evaluateReconciliationGateForMappingV1({
      trialBalance,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("RECONCILIATION_BLOCKED");
    const blockingReasonCodes = result.error.context.blockingReasonCodes as
      | string[]
      | undefined;
    expect(blockingReasonCodes).toContain("verification_total_consistency");
  });

  it("accepts parser output and allows mapping when reconciliation passes", () => {
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
      fileName: "gate-boundary.xlsx",
      fileBytes,
    });

    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) {
      return;
    }

    const gateResult = evaluateReconciliationGateForMappingV1({
      trialBalance: parseResult.trialBalance,
    });

    expect(gateResult.ok).toBe(true);
    if (!gateResult.ok) {
      return;
    }

    expect(gateResult.reconciliation.canProceedToMapping).toBe(true);
  });
});
