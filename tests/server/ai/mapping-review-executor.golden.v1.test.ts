import { describe, expect, it } from "vitest";

import { executeMappingReviewModelV1 } from "../../../src/server/ai/modules/mapping-review/executor.v1";
import { loadMappingReviewModuleConfigV1 } from "../../../src/server/ai/modules/mapping-review/loader.v1";
import { MappingDecisionSetPayloadV1Schema } from "../../../src/shared/contracts/mapping.v1";
import { parseReconciliationResultPayloadV1 } from "../../../src/shared/contracts/reconciliation.v1";

function createGoldenMappingPayloadV1() {
  return MappingDecisionSetPayloadV1Schema.parse({
    schemaVersion: "mapping_decisions_v1",
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 3,
      deterministicDecisions: 3,
      manualReviewRequired: 1,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 2,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "decision-bs-group-receivable",
        accountNumber: "1680",
        sourceAccountNumber: "1680",
        accountName: "Koncernbidrag fordran",
        proposedCategory: {
          code: "229000",
          name: "Other provisions",
          statementType: "balance_sheet",
        },
        selectedCategory: {
          code: "229000",
          name: "Other provisions",
          statementType: "balance_sheet",
        },
        confidence: 0.73,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:2",
          },
        ],
        policyRuleReference: "map.bs.other-provisions.v1",
        reviewFlag: true,
        status: "proposed",
        source: "deterministic",
      },
      {
        id: "decision-is-it-consulting",
        accountNumber: "6550",
        sourceAccountNumber: "6550",
        accountName: "IT consulting and software support",
        proposedCategory: {
          code: "655000",
          name: "Consulting fees",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "655000",
          name: "Consulting fees",
          statementType: "income_statement",
        },
        confidence: 0.76,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:3",
          },
        ],
        policyRuleReference: "map.is.consulting-fees.v1",
        reviewFlag: true,
        status: "proposed",
        source: "deterministic",
      },
      {
        id: "decision-is-partially-deductible-representation",
        accountNumber: "6073",
        sourceAccountNumber: "6073",
        accountName: "Representation partially deductible",
        proposedCategory: {
          code: "607100",
          name: "Entertainment - internal and external - presumed deductible",
          statementType: "income_statement",
        },
        selectedCategory: {
          code: "607100",
          name: "Entertainment - internal and external - presumed deductible",
          statementType: "income_statement",
        },
        confidence: 0.79,
        evidence: [
          {
            type: "tb_row",
            reference: "Trial Balance:4",
          },
        ],
        policyRuleReference: "map.is.entertainment.deductible.v1",
        reviewFlag: false,
        status: "proposed",
        source: "deterministic",
      },
    ],
  });
}

describe("mapping review executor golden v1", () => {
  it("returns expected stable overrides for core guideline cases", async () => {
    const configResult = loadMappingReviewModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    const result = await executeMappingReviewModelV1({
      config: configResult.config,
      mapping: createGoldenMappingPayloadV1(),
      reconciliation: parseReconciliationResultPayloadV1({
        schemaVersion: "reconciliation_result_v1",
        status: "pass",
        canProceedToMapping: true,
        blockingReasonCodes: [],
        summary: {
          candidateRows: 3,
          normalizedRows: 3,
          rejectedRows: 0,
          materialRejectedRows: 0,
          nonMaterialRejectedRows: 0,
          openingBalanceTotal: 0,
          closingBalanceTotal: 300,
        },
        checks: [
          {
            code: "candidate_rows_present",
            status: "pass",
            blocking: false,
            message: "ok",
            context: {},
          },
        ],
      }),
      requestedScope: "return",
      maxSuggestions: 10,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.suggestions).toHaveLength(3);

    const suggestionsByDecisionId = new Map(
      result.suggestions.map((suggestion) => [suggestion.decisionId, suggestion]),
    );
    expect(
      suggestionsByDecisionId.get("decision-bs-group-receivable")
        ?.selectedCategoryCode,
    ).toBe("100000");
    expect(
      suggestionsByDecisionId.get("decision-is-it-consulting")
        ?.selectedCategoryCode,
    ).toBe("950000");
    expect(
      suggestionsByDecisionId.get(
        "decision-is-partially-deductible-representation",
      )?.selectedCategoryCode,
    ).toBe("607200");
  });
});

