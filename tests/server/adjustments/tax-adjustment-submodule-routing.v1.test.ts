import { describe, expect, it } from "vitest";

import {
  getTaxAdjustmentCategoryRouteByCodeV1,
  listNonRoutedTaxCategoryCodesV1,
  listTaxAdjustmentCategoryDispositionRecordsV1,
  listUncoveredTaxCategoryCodesV1,
  projectRoutedTaxAdjustmentCandidatesV1,
} from "../../../src/server/adjustments/tax-adjustment-submodule-routing.v1";
import { parseMappingDecisionSetArtifactV1 } from "../../../src/shared/contracts/mapping.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

describe("tax adjustment submodule routing v1", () => {
  it("covers the canonical mapper taxonomy apart from explicitly non-routed categories", () => {
    expect(listUncoveredTaxCategoryCodesV1()).toEqual([]);
    expect(listNonRoutedTaxCategoryCodesV1()).toEqual(["100000", "950000"]);
    expect(listTaxAdjustmentCategoryDispositionRecordsV1()).toHaveLength(67);
  });

  it("maps representative tax categories into their canonical submodules", () => {
    expect(getTaxAdjustmentCategoryRouteByCodeV1("607200")).toMatchObject({
      moduleCode: "disallowed_expenses",
      targetField: "INK2S.non_deductible_expenses",
      decisionMode: "full_amount",
    });
    expect(getTaxAdjustmentCategoryRouteByCodeV1("607100")).toMatchObject({
      moduleCode: "disallowed_expenses",
      targetField: "INK2S.representation_non_deductible",
      decisionMode: "representation_10_percent",
    });
    expect(getTaxAdjustmentCategoryRouteByCodeV1("882000")).toMatchObject({
      moduleCode: "group_contributions",
    });
    expect(getTaxAdjustmentCategoryRouteByCodeV1("521200")).toMatchObject({
      moduleCode: "hybrid_targeted_interest_and_net_interest_offset",
    });
    expect(getTaxAdjustmentCategoryRouteByCodeV1("891000")).toMatchObject({
      moduleCode: "trial_balance_to_local_gaap",
    });
  });

  it("projects routed candidates at row level without collapsing duplicate source accounts", () => {
    const mapping = parseMappingDecisionSetArtifactV1({
      schemaVersion: "mapping_decisions_v2",
      policyVersion: "deterministic-bas.v1",
      executionMetadata: {
        requestedStrategy: "deterministic_only",
        actualStrategy: "deterministic",
        degraded: false,
        annualReportContextAvailable: false,
        usedAiRunFallback: false,
      },
      summary: {
        totalRows: 2,
        deterministicDecisions: 2,
        manualReviewRequired: 0,
        fallbackDecisions: 0,
        matchedByAccountNumber: 2,
        matchedByAccountName: 0,
        unmatchedRows: 0,
      },
      decisions: [
        {
          id: "map-6072-a",
          trialBalanceRowIdentity: {
            rowKey: "TB:2",
            source: { sheetName: "TB", rowNumber: 2 },
          },
          accountNumber: "6072-1",
          sourceAccountNumber: "6072",
          accountName: "Representation A",
          proposedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          confidence: 0.91,
          evidence: [{ type: "tb_row", reference: "r1" }],
          policyRuleReference: "rule-1",
          reviewFlag: false,
          status: "proposed",
          source: "deterministic",
        },
        {
          id: "map-6072-b",
          trialBalanceRowIdentity: {
            rowKey: "TB:3",
            source: { sheetName: "TB", rowNumber: 3 },
          },
          accountNumber: "6072-2",
          sourceAccountNumber: "6072",
          accountName: "Representation B",
          proposedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          confidence: 0.9,
          evidence: [{ type: "tb_row", reference: "r2" }],
          policyRuleReference: "rule-2",
          reviewFlag: false,
          status: "proposed",
          source: "deterministic",
        },
      ],
    });
    const trialBalance = parseTrialBalanceNormalizedV1({
      schemaVersion: "trial_balance_normalized_v1",
      fileType: "xlsx",
      selectedSheetName: "TB",
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
          accountName: "Representation A",
          accountNumber: "6072-1",
          sourceAccountNumber: "6072",
          openingBalance: 0,
          closingBalance: 1000,
          source: { sheetName: "TB", rowNumber: 2 },
          rawValues: {
            account_name: "Representation A",
            account_number: "6072-1",
            opening_balance: "0",
            closing_balance: "1000",
          },
        },
        {
          accountName: "Representation B",
          accountNumber: "6072-2",
          sourceAccountNumber: "6072",
          openingBalance: 0,
          closingBalance: 250,
          source: { sheetName: "TB", rowNumber: 3 },
          rawValues: {
            account_name: "Representation B",
            account_number: "6072-2",
            opening_balance: "0",
            closing_balance: "250",
          },
        },
      ],
      rejectedRows: [],
      sheetAnalyses: [
        {
          sheetName: "TB",
          headerRowNumber: 1,
          requiredColumnsMatched: 4,
          candidateDataRows: 2,
          score: 4000,
        },
      ],
      verification: {
        totalRowsRead: 3,
        candidateRows: 2,
        normalizedRows: 2,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 1,
        openingBalanceTotal: 0,
        closingBalanceTotal: 1250,
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

    const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
      mapping,
      trialBalance,
    });

    expect(routedCandidates).toHaveLength(2);
    expect(routedCandidates.map((candidate) => candidate.closingBalance)).toEqual([
      1000,
      250,
    ]);
    expect(routedCandidates.map((candidate) => candidate.accountNumber)).toEqual([
      "6072-1",
      "6072-2",
    ]);
    expect(
      routedCandidates.map((candidate) => candidate.trialBalanceRowIdentity?.rowKey),
    ).toEqual(["TB:2", "TB:3"]);
    expect(
      routedCandidates.map((candidate) => candidate.rowResolutionStatus),
    ).toEqual(["matched", "matched"]);
    expect(
      routedCandidates.every(
        (candidate) =>
          candidate.annualReportContextLineage.moduleContextSchemaVersion ===
          "tax_adjustment_module_context_v1",
      ),
    ).toBe(true);
  });

  it("marks v2 candidates missing when stored row identity no longer resolves", () => {
    const mapping = parseMappingDecisionSetArtifactV1({
      schemaVersion: "mapping_decisions_v2",
      policyVersion: "mapping-ai.v1",
      executionMetadata: {
        requestedStrategy: "ai_primary",
        actualStrategy: "ai",
        degraded: false,
        annualReportContextAvailable: false,
        usedAiRunFallback: false,
      },
      summary: {
        totalRows: 1,
        deterministicDecisions: 0,
        manualReviewRequired: 0,
        fallbackDecisions: 0,
        matchedByAccountNumber: 0,
        matchedByAccountName: 1,
        unmatchedRows: 0,
      },
      decisions: [
        {
          id: "map-missing",
          trialBalanceRowIdentity: {
            rowKey: "TB:99",
            source: { sheetName: "TB", rowNumber: 99 },
          },
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          accountName: "Representation A",
          proposedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          confidence: 0.9,
          evidence: [{ type: "tb_row", reference: "r1" }],
          policyRuleReference: "mapping.ai.rule.test.v1",
          reviewFlag: false,
          status: "proposed",
          source: "ai",
        },
      ],
    });
    const trialBalance = parseTrialBalanceNormalizedV1({
      schemaVersion: "trial_balance_normalized_v1",
      fileType: "xlsx",
      selectedSheetName: "TB",
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
          accountName: "Representation A",
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          openingBalance: 0,
          closingBalance: 1000,
          source: { sheetName: "TB", rowNumber: 2 },
          rawValues: {
            account_name: "Representation A",
            account_number: "6072",
            opening_balance: "0",
            closing_balance: "1000",
          },
        },
      ],
      rejectedRows: [],
      sheetAnalyses: [
        {
          sheetName: "TB",
          headerRowNumber: 1,
          requiredColumnsMatched: 4,
          candidateDataRows: 1,
          score: 4000,
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
            status: "pass",
            message: "ok",
            context: {},
          },
        ],
      },
    });

    const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
      mapping,
      trialBalance,
    });

    expect(routedCandidates).toHaveLength(1);
    expect(routedCandidates[0]).toMatchObject({
      rowResolutionStatus: "missing",
      openingBalance: 0,
      closingBalance: 0,
      trialBalanceRowIdentity: {
        rowKey: "TB:99",
      },
    });
  });

  it("keeps exact duplicate rows distinct when only row identity differs", () => {
    const mapping = parseMappingDecisionSetArtifactV1({
      schemaVersion: "mapping_decisions_v2",
      policyVersion: "mapping-ai.v1",
      executionMetadata: {
        requestedStrategy: "ai_primary",
        actualStrategy: "ai",
        degraded: false,
        annualReportContextAvailable: true,
        usedAiRunFallback: false,
      },
      summary: {
        totalRows: 2,
        deterministicDecisions: 0,
        manualReviewRequired: 0,
        fallbackDecisions: 0,
        matchedByAccountNumber: 0,
        matchedByAccountName: 2,
        unmatchedRows: 0,
      },
      decisions: [
        {
          id: "dup-1",
          trialBalanceRowIdentity: {
            rowKey: "TB:2",
            source: { sheetName: "TB", rowNumber: 2 },
          },
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          accountName: "Representation",
          proposedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          confidence: 0.9,
          evidence: [{ type: "tb_row", reference: "TB:2" }],
          policyRuleReference: "mapping.ai.representation.v1",
          reviewFlag: false,
          status: "proposed",
          source: "ai",
        },
        {
          id: "dup-2",
          trialBalanceRowIdentity: {
            rowKey: "TB:3",
            source: { sheetName: "TB", rowNumber: 3 },
          },
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          accountName: "Representation",
          proposedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          confidence: 0.9,
          evidence: [{ type: "tb_row", reference: "TB:3" }],
          policyRuleReference: "mapping.ai.representation.v1",
          reviewFlag: false,
          status: "proposed",
          source: "ai",
        },
      ],
    });
    const trialBalance = parseTrialBalanceNormalizedV1({
      schemaVersion: "trial_balance_normalized_v1",
      fileType: "xlsx",
      selectedSheetName: "TB",
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
          accountName: "Representation",
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          openingBalance: 0,
          closingBalance: 1000,
          source: { sheetName: "TB", rowNumber: 2 },
          rawValues: {
            account_name: "Representation",
            account_number: "6072",
            opening_balance: "0",
            closing_balance: "1000",
          },
        },
        {
          accountName: "Representation",
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          openingBalance: 0,
          closingBalance: 250,
          source: { sheetName: "TB", rowNumber: 3 },
          rawValues: {
            account_name: "Representation",
            account_number: "6072",
            opening_balance: "0",
            closing_balance: "250",
          },
        },
      ],
      rejectedRows: [],
      sheetAnalyses: [
        {
          sheetName: "TB",
          headerRowNumber: 1,
          requiredColumnsMatched: 4,
          candidateDataRows: 2,
          score: 4000,
        },
      ],
      verification: {
        totalRowsRead: 3,
        candidateRows: 2,
        normalizedRows: 2,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 1,
        openingBalanceTotal: 0,
        closingBalanceTotal: 1250,
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

    const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
      mapping,
      trialBalance,
    });

    expect(routedCandidates).toHaveLength(2);
    expect(routedCandidates.map((candidate) => candidate.closingBalance)).toEqual([
      1000,
      250,
    ]);
    expect(
      routedCandidates.map((candidate) => candidate.trialBalanceRowIdentity?.rowKey),
    ).toEqual(["TB:2", "TB:3"]);
    expect(
      routedCandidates.map((candidate) => candidate.rowResolutionStatus),
    ).toEqual(["matched", "matched"]);
  });
});
