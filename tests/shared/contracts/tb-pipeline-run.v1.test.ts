import { describe, expect, it } from "vitest";

import {
  safeParseExecuteTrialBalancePipelineRequestV1,
  safeParseExecuteTrialBalancePipelineResultV1,
} from "../../../src/shared/contracts/tb-pipeline-run.v1";

function createTrialBalancePayloadV1() {
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
        accountName: "Representation external ej avdragsgill",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        openingBalance: 0,
        closingBalance: 1000,
        source: {
          sheetName: "Trial Balance",
          rowNumber: 2,
        },
        rawValues: {
          account_name: "Representation external ej avdragsgill",
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
        score: 4800,
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

function createReconciliationPayloadV1() {
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

function createMappingPayloadV1() {
  return {
    schemaVersion: "mapping_decisions_v1" as const,
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 1,
      deterministicDecisions: 1,
      manualReviewRequired: 0,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 0,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "Trial Balance:2:6072",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        accountName: "Representation external ej avdragsgill",
        proposedCategory: {
          code: "607200" as const,
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement" as const,
        },
        selectedCategory: {
          code: "607200" as const,
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement" as const,
        },
        confidence: 0.92,
        evidence: [
          {
            type: "tb_row" as const,
            reference: "Trial Balance:2",
          },
        ],
        policyRuleReference: "map.is.entertainment.non-deductible.v1",
        reviewFlag: false,
        status: "proposed" as const,
        source: "deterministic" as const,
      },
    ],
  };
}

describe("TB pipeline run contracts v1", () => {
  it("accepts valid TB pipeline request payload", () => {
    const result = safeParseExecuteTrialBalancePipelineRequestV1({
      tenantId: "83000000-0000-4000-8000-000000000001",
      workspaceId: "83000000-0000-4000-8000-000000000002",
      fileName: "tb.xlsx",
      fileBytesBase64: "AQID",
      policyVersion: "deterministic-bas.v1",
      fileType: "xlsx",
      createdByUserId: "83000000-0000-4000-8000-000000000003",
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed TB pipeline request payload", () => {
    const result = safeParseExecuteTrialBalancePipelineRequestV1({
      tenantId: "83000000-0000-4000-8000-000000000001",
      fileName: "tb.xlsx",
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid TB pipeline success payload", () => {
    const result = safeParseExecuteTrialBalancePipelineResultV1({
      ok: true,
      pipeline: {
        schemaVersion: "tb_pipeline_run_result_v1",
        policyVersion: "deterministic-bas.v1",
        artifacts: {
          trialBalance: {
            artifactType: "trial_balance",
            artifactId: "83000000-0000-4000-8000-000000000011",
            version: 1,
            schemaVersion: "trial_balance_normalized_v1",
          },
          reconciliation: {
            artifactType: "reconciliation",
            artifactId: "83000000-0000-4000-8000-000000000012",
            version: 1,
            schemaVersion: "reconciliation_result_v1",
          },
          mapping: {
            artifactType: "mapping",
            artifactId: "83000000-0000-4000-8000-000000000013",
            version: 1,
            schemaVersion: "mapping_decisions_v1",
          },
        },
        trialBalance: createTrialBalancePayloadV1(),
        reconciliation: createReconciliationPayloadV1(),
        mapping: createMappingPayloadV1(),
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid TB pipeline failure payload", () => {
    const result = safeParseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message:
          "Mapping is blocked because deterministic reconciliation did not pass.",
        user_message:
          "Reconciliation failed. Fix blocking issues before mapping.",
        context: {
          blockingReasonCodes: ["material_rejections_absent"],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
