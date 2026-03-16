import { describe, expect, it } from "vitest";

import {
  parseMappedAdjustmentCandidateV1,
  parseTaxAdjustmentCategoryDispositionRecordV1,
  parseTaxAdjustmentModuleContextV1,
} from "../../../src/shared/contracts/tax-adjustment-routing.v1";

describe("tax adjustment routing contracts v1", () => {
  it("accepts a mapped adjustment candidate payload", () => {
    const candidate = parseMappedAdjustmentCandidateV1({
      schemaVersion: "mapped_adjustment_candidate_v1",
      mappingDecisionId: "map-6072",
      trialBalanceRowIdentity: {
        rowKey: "Trial Balance:2",
        source: {
          sheetName: "Trial Balance",
          rowNumber: 2,
        },
      },
      sourceAccountNumber: "6072",
      accountNumber: "6072",
      accountName: "Representation",
      openingBalance: 0,
      closingBalance: 1000,
      selectedCategory: {
        code: "607200",
        name: "Entertainment - internal and external - presumed non-deductible",
        statementType: "income_statement",
      },
      mappingConfidence: 0.95,
      mappingReviewFlag: false,
      mappingPolicyRuleReference: "map.607200.v1",
      moduleCode: "disallowed_expenses",
      bridgeAiModule: "non_deductible_expenses",
      dispositionStatus: "routed_to_submodule",
      decisionMode: "full_amount",
      direction: "increase_taxable_income",
      targetField: "INK2S.non_deductible_expenses",
      annualReportContextLineage: {
        sourceContextSchemaVersion: "annual_report_tax_context_v1",
        moduleContextSchemaVersion: "tax_adjustment_module_context_v1",
        includedAreas: ["taxExpenseContext"],
        sharedAreas: [
          "relevantNotes",
          "priorYearComparatives",
          "selectedRiskFindings",
          "missingInformation",
        ],
      },
    });

    expect(candidate.moduleCode).toBe("disallowed_expenses");
  });

  it("accepts a category disposition record", () => {
    const record = parseTaxAdjustmentCategoryDispositionRecordV1({
      category: {
        code: "882000",
        name: "Group contribution - received",
        statementType: "income_statement",
      },
      moduleCode: "group_contributions",
      bridgeAiModule: null,
      dispositionStatus: "manual_review_required",
      decisionMode: "manual_review",
      direction: "informational",
      targetField: "INK2S.other_manual_adjustments",
      contextAreas: ["groupContributionContext"],
    });

    expect(record.moduleCode).toBe("group_contributions");
  });

  it("accepts a module-scoped annual-report context payload", () => {
    const context = parseTaxAdjustmentModuleContextV1({
      schemaVersion: "tax_adjustment_module_context_v1",
      moduleCode: "group_contributions",
      shared: {
        relevantNotes: [],
        priorYearComparatives: [],
        selectedRiskFindings: [],
        missingInformation: [],
      },
      groupContributionContext: {
        flags: [],
        notes: ["Koncernbidrag mottaget."],
        evidence: [],
      },
    });

    expect(context.moduleCode).toBe("group_contributions");
  });
});
