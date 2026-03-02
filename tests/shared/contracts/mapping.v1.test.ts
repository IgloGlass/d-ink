import { describe, expect, it } from "vitest";

import {
  getSilverfinTaxCategoryByCodeV1,
  safeParseGenerateMappingDecisionsRequestV1,
  safeParseGenerateMappingDecisionsResultV1,
  safeParseMappingDecisionV1,
  safeParseSilverfinTaxCategoryReferenceV1,
} from "../../../src/shared/contracts/mapping.v1";

function createBaseTrialBalanceV1() {
  return {
    schemaVersion: "trial_balance_normalized_v1" as const,
    fileType: "xlsx" as const,
    selectedSheetName: "Trial Balance",
    headerRowNumber: 1,
    columnMappings: [
      {
        key: "account_name" as const,
        required: true,
        sourceHeader: "Account Name",
        normalizedSourceHeader: "account name",
        sourceColumnIndex: 0,
        sourceColumnLetter: "A",
        matchType: "exact_synonym" as const,
      },
      {
        key: "account_number" as const,
        required: true,
        sourceHeader: "Account Number",
        normalizedSourceHeader: "account number",
        sourceColumnIndex: 1,
        sourceColumnLetter: "B",
        matchType: "exact_synonym" as const,
      },
      {
        key: "opening_balance" as const,
        required: true,
        sourceHeader: "Opening Balance",
        normalizedSourceHeader: "opening balance",
        sourceColumnIndex: 2,
        sourceColumnLetter: "C",
        matchType: "exact_synonym" as const,
      },
      {
        key: "closing_balance" as const,
        required: true,
        sourceHeader: "Closing Balance",
        normalizedSourceHeader: "closing balance",
        sourceColumnIndex: 3,
        sourceColumnLetter: "D",
        matchType: "exact_synonym" as const,
      },
    ],
    rows: [
      {
        accountName: "External representation",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        openingBalance: 0,
        closingBalance: 1000,
        source: {
          sheetName: "Trial Balance",
          rowNumber: 2,
        },
        rawValues: {
          account_name: "External representation",
          account_number: "6072",
          opening_balance: "0",
          closing_balance: "1000",
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
        score: 4500,
      },
    ],
    verification: {
      totalRowsRead: 2,
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: 1000,
      checks: [
        {
          code: "required_columns_present",
          status: "pass" as const,
          message: "ok",
          context: {},
        },
      ],
    },
  };
}

function createPassReconciliationV1() {
  return {
    schemaVersion: "reconciliation_result_v1" as const,
    status: "pass" as const,
    canProceedToMapping: true,
    blockingReasonCodes: [],
    summary: {
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: 1000,
    },
    checks: [
      {
        code: "candidate_rows_present" as const,
        status: "pass" as const,
        blocking: false,
        message: "ok",
        context: {},
      },
    ],
  };
}

describe("mapping contracts v1", () => {
  it("accepts valid mapping decision payload", () => {
    const category = getSilverfinTaxCategoryByCodeV1("607200");
    const result = safeParseMappingDecisionV1({
      id: "Trial Balance:2:6072",
      accountNumber: "6072",
      sourceAccountNumber: "6072",
      accountName: "External representation",
      proposedCategory: category,
      selectedCategory: category,
      confidence: 0.92,
      evidence: [
        {
          type: "tb_row",
          reference: "Trial Balance:2",
          snippet: "6072 External representation",
          source: {
            sheetName: "Trial Balance",
            rowNumber: 2,
          },
        },
      ],
      policyRuleReference: "map.is.entertainment.non-deductible.v1",
      reviewFlag: false,
      status: "proposed",
      source: "deterministic",
    });

    expect(result.success).toBe(true);
  });

  it("rejects category references with mismatched canonical name", () => {
    const result = safeParseSilverfinTaxCategoryReferenceV1({
      code: "607200",
      name: "Entertainment - internal and external - presumed deductible",
      statementType: "income_statement",
    });

    expect(result.success).toBe(false);
  });

  it("rejects selected category changes when status is not overridden", () => {
    const proposedCategory = getSilverfinTaxCategoryByCodeV1("607100");
    const selectedCategory = getSilverfinTaxCategoryByCodeV1("607200");
    const result = safeParseMappingDecisionV1({
      id: "Trial Balance:2:6072",
      accountNumber: "6072",
      sourceAccountNumber: "6072",
      accountName: "External representation",
      proposedCategory,
      selectedCategory,
      confidence: 0.6,
      evidence: [
        {
          type: "tb_row",
          reference: "Trial Balance:2",
          snippet: "6072 External representation",
          source: {
            sheetName: "Trial Balance",
            rowNumber: 2,
          },
        },
      ],
      policyRuleReference: "map.is.entertainment.non-deductible.v1",
      reviewFlag: true,
      status: "proposed",
      source: "deterministic",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid mapping generation request payload", () => {
    const result = safeParseGenerateMappingDecisionsRequestV1({
      trialBalance: createBaseTrialBalanceV1(),
      reconciliation: createPassReconciliationV1(),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid mapping generation failure payload", () => {
    const result = safeParseGenerateMappingDecisionsResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message: "Mapping blocked by reconciliation.",
        user_message: "Fix reconciliation issues first.",
        context: {
          blockingReasonCodes: ["material_rejections_absent"],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
