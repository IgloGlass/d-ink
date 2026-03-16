import { describe, expect, it } from "vitest";

import {
  buildTrialBalanceRowIdentityV1,
  safeParseParseTrialBalanceRequestV1,
  safeParseTrialBalanceNormalizedV1,
} from "../../../src/shared/contracts/trial-balance.v1";

describe("trial balance contracts v1", () => {
  it("accepts valid normalized trial balance payload", () => {
    const result = safeParseTrialBalanceNormalizedV1({
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
          accountName: "Bank",
          accountNumber: "1930",
          sourceAccountNumber: "1930",
          openingBalance: 1000,
          closingBalance: 1500,
          source: {
            sheetName: "Trial Balance",
            rowNumber: 2,
          },
          rawValues: {
            account_name: "Bank",
            account_number: "1930",
            opening_balance: "1 000",
            closing_balance: "1 500",
          },
        },
      ],
      rejectedRows: [],
      sheetAnalyses: [
        {
          sheetName: "Trial Balance",
          headerRowNumber: 1,
          requiredColumnsMatched: 4,
          candidateDataRows: 1,
          score: 4200,
        },
      ],
      verification: {
        totalRowsRead: 2,
        candidateRows: 1,
        normalizedRows: 1,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 0,
        openingBalanceTotal: 1000,
        closingBalanceTotal: 1500,
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

    expect(result.success).toBe(true);
  });

  it("rejects unknown schemaVersion", () => {
    const result = safeParseTrialBalanceNormalizedV1({
      schemaVersion: "trial_balance_normalized_v9",
      fileType: "xlsx",
      selectedSheetName: "Trial Balance",
      headerRowNumber: 1,
      columnMappings: [],
      rows: [],
      rejectedRows: [],
      sheetAnalyses: [],
      verification: {
        totalRowsRead: 0,
        candidateRows: 0,
        normalizedRows: 0,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 0,
        openingBalanceTotal: 0,
        closingBalanceTotal: 0,
        checks: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts flexible v2 trial balance payloads with closing balance only", () => {
    const result = safeParseTrialBalanceNormalizedV1({
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
          accountName: "Bank",
          accountNumber: "1930",
          sourceAccountNumber: "1930",
          openingBalance: null,
          closingBalance: 1500,
          source: {
            sheetName: "Trial Balance",
            rowNumber: 2,
          },
          rawValues: {
            account_name: "Bank",
            account_number: "1930",
            closing_balance: "1 500",
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
          score: 3200,
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
        closingBalanceTotal: 1500,
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

    expect(result.success).toBe(true);
  });

  it("rejects parse request when bytes are missing", () => {
    const result = safeParseParseTrialBalanceRequestV1({
      fileName: "tb.xlsx",
      fileType: "xlsx",
    });

    expect(result.success).toBe(false);
  });

  it("accepts parse request for supported file type with bytes", () => {
    const result = safeParseParseTrialBalanceRequestV1({
      fileName: "tb.xlsb",
      fileType: "xlsb",
      fileBytes: new Uint8Array([1, 2, 3]),
    });

    expect(result.success).toBe(true);
  });

  it("builds a stable row identity from the canonical source location", () => {
    expect(
      buildTrialBalanceRowIdentityV1({
        sheetName: "Trial Balance",
        rowNumber: 2,
      }),
    ).toEqual({
      rowKey: "Trial Balance:2",
      source: {
        sheetName: "Trial Balance",
        rowNumber: 2,
      },
    });
  });
});
