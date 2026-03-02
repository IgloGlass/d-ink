import { describe, expect, it } from "vitest";

import { generateDeterministicMappingDecisionsV1 } from "../../../src/server/mapping/deterministic-mapping.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

function createTrialBalanceV1(input: {
  rows: Array<{
    accountName: string;
    accountNumber: string;
    sourceAccountNumber?: string;
    openingBalance?: number;
    closingBalance?: number;
  }>;
}) {
  const rows = input.rows.map((row, index) => ({
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    sourceAccountNumber: row.sourceAccountNumber ?? row.accountNumber,
    openingBalance: row.openingBalance ?? 0,
    closingBalance: row.closingBalance ?? 0,
    source: {
      sheetName: "Trial Balance",
      rowNumber: index + 2,
    },
    rawValues: {
      account_name: row.accountName,
      account_number: row.accountNumber,
      opening_balance: String(row.openingBalance ?? 0),
      closing_balance: String(row.closingBalance ?? 0),
    },
  }));

  const openingBalanceTotal = rows.reduce(
    (sum, row) => sum + row.openingBalance,
    0,
  );
  const closingBalanceTotal = rows.reduce(
    (sum, row) => sum + row.closingBalance,
    0,
  );

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
    rows,
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "Trial Balance",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: rows.length,
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: rows.length + 1,
      candidateRows: rows.length,
      normalizedRows: rows.length,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal,
      closingBalanceTotal,
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

function createReconciliationV1(input: {
  canProceedToMapping: boolean;
  status?: "pass" | "warning" | "fail";
}) {
  return {
    schemaVersion: "reconciliation_result_v1" as const,
    status: input.status ?? (input.canProceedToMapping ? "pass" : "fail"),
    canProceedToMapping: input.canProceedToMapping,
    blockingReasonCodes: input.canProceedToMapping
      ? []
      : ["material_rejections_absent"],
    summary: {
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: 0,
    },
    checks: [
      {
        code: "candidate_rows_present" as const,
        status: input.canProceedToMapping
          ? ("pass" as const)
          : ("fail" as const),
        blocking: !input.canProceedToMapping,
        message: "ok",
        context: {},
      },
    ],
  };
}

describe("deterministic mapping v1", () => {
  it("returns INPUT_INVALID for malformed input", () => {
    const result = generateDeterministicMappingDecisionsV1({
      invalid: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("INPUT_INVALID");
  });

  it("returns RECONCILIATION_BLOCKED when reconciliation gate is closed", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "External representation",
            accountNumber: "6072",
            closingBalance: 1000,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: false,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("RECONCILIATION_BLOCKED");
  });

  it("maps BAS account 6072 to non-deductible entertainment", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Representation external ej avdragsgill",
            accountNumber: "6072",
            closingBalance: 1000,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("607200");
    expect(result.mapping.decisions[0].reviewFlag).toBe(false);
  });

  it("maps BAS account 6071 to deductible entertainment", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Representation internal avdragsgill",
            accountNumber: "6071",
            closingBalance: 800,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("607100");
  });

  it("uses source account number when normalized account numbers have duplicate suffixes", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Representation external ej avdragsgill",
            accountNumber: "6072.1",
            sourceAccountNumber: "6072",
            closingBalance: 500,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("607200");
  });

  it("maps keyword-only sanctions rows when account number is atypical", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Boter och vite ej avdragsgilla",
            accountNumber: "6991",
            closingBalance: 200,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("634200");
  });

  it("falls back to non-tax-sensitive categories for unknown rows and flags review", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Completely custom account",
            accountNumber: "1630",
            closingBalance: 100,
          },
          {
            accountName: "Custom P&L row",
            accountNumber: "3999",
            closingBalance: 100,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("100000");
    expect(result.mapping.decisions[1].selectedCategory.code).toBe("950000");
    expect(result.mapping.decisions[0].reviewFlag).toBe(true);
    expect(result.mapping.decisions[1].reviewFlag).toBe(true);
    expect(result.mapping.summary.fallbackDecisions).toBe(2);
  });

  it("maps BS accumulated building depreciation to non-tax-sensitive balance", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Ackumulerad avskrivning byggnad",
            accountNumber: "1119",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("100000");
  });

  it("maps BS accumulated depreciation (general) to tangible/intangible opening-closing", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Ackumulerad avskrivning maskiner",
            accountNumber: "1219",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("102000");
  });

  it("maps BS work-in-progress accounts to non-tax-sensitive balance", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Pågående projekt",
            accountNumber: "1470",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("100000");
  });

  it("maps BS generic accrual/reservation to other provisions", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Upplupen reservering för omstrukturering",
            accountNumber: "2999",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("229000");
  });

  it("maps BS group contribution receivable to non-tax-sensitive balance", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Koncernbidrag fordran",
            accountNumber: "1680",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("100000");
  });

  it("maps BS intra-group receivable decrease to capital-asset value change and flags review", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Koncernintern fordran nedskrivning",
            accountNumber: "1685",
            openingBalance: 1000,
            closingBalance: 200,
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("138400");
    expect(result.mapping.decisions[0].reviewFlag).toBe(true);
  });

  it("maps atypical-account banking costs by name", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Bankkostnader",
            accountNumber: "6099",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("657000");
  });

  it("maps atypical-account FX gain/loss by name", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Valutakursvinst",
            accountNumber: "3998",
          },
          {
            accountName: "Valutakursförlust",
            accountNumber: "6998",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("843100");
    expect(result.mapping.decisions[1].selectedCategory.code).toBe("843600");
  });

  it("maps COGS-like depreciation text to non-tax-sensitive P&L", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Kostnad sålda varor avskrivning",
            accountNumber: "4990",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("950000");
  });

  it("distinguishes IT consulting from tax assistance consulting", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "IT consulting and software support",
            accountNumber: "6550",
          },
          {
            accountName: "Tax assistance for INK2 declaration",
            accountNumber: "6551",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("950000");
    expect(result.mapping.decisions[1].selectedCategory.code).toBe("655000");
  });

  it("maps partially deductible representation prudently as non-deductible", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Representation partially deductible",
            accountNumber: "6073",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("607200");
  });

  it("maps social contributions as non-tax-sensitive and not special payroll tax", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Arbetsgivaravgifter",
            accountNumber: "7510",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("950000");
  });

  it("defaults membership fees to non-deductible unless conflict-purpose wording exists", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Membership fee",
            accountNumber: "6980",
          },
          {
            accountName:
              "Membership fee employers association conflict purpose",
            accountNumber: "6980",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("698200");
    expect(result.mapping.decisions[1].selectedCategory.code).toBe("698100");
  });

  it("maps generic gifts non-deductible and small staff gifts deductible", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Gift donation",
            accountNumber: "6994",
          },
          {
            accountName: "Julgåva personal",
            accountNumber: "6994",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("699300");
    expect(result.mapping.decisions[1].selectedCategory.code).toBe("598000");
  });

  it("maps staff catering/events as non-tax-sensitive unless clear representation markers exist", () => {
    const result = generateDeterministicMappingDecisionsV1({
      trialBalance: createTrialBalanceV1({
        rows: [
          {
            accountName: "Staff catering and kickoff",
            accountNumber: "7630",
          },
        ],
      }),
      reconciliation: createReconciliationV1({
        canProceedToMapping: true,
      }),
      policyVersion: "deterministic-bas.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0].selectedCategory.code).toBe("950000");
  });
});
