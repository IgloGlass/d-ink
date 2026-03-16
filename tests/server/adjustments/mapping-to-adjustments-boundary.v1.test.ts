import { describe, expect, it } from "vitest";

import {
  projectRoutedTaxAdjustmentCandidatesV1,
  projectTaxAdjustmentModuleContextV1,
} from "../../../src/server/adjustments/tax-adjustment-submodule-routing.v1";
import { generateTaxAdjustmentsV1 } from "../../../src/server/adjustments/tax-adjustments-engine.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseAnnualReportDownstreamTaxContextV1 } from "../../../src/shared/contracts/annual-report-tax-context.v1";
import { parseMappingDecisionSetArtifactV1 } from "../../../src/shared/contracts/mapping.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

describe("mapping to adjustments boundary v1", () => {
  it("projects row-level candidates and canonical adjustment decisions end to end", () => {
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
          accountName: "Group contribution received",
          accountNumber: "8820",
          sourceAccountNumber: "8820",
          openingBalance: 0,
          closingBalance: 250000,
          source: { sheetName: "TB", rowNumber: 3 },
          rawValues: {
            account_name: "Group contribution received",
            account_number: "8820",
            opening_balance: "0",
            closing_balance: "250000",
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
        duplicateAccountNumberGroups: 0,
        openingBalanceTotal: 0,
        closingBalanceTotal: 251000,
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
          id: "map-6072",
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
          confidence: 0.95,
          evidence: [{ type: "tb_row", reference: "r1" }],
          policyRuleReference: "rule-6072",
          reviewFlag: false,
          status: "proposed",
          source: "deterministic",
        },
        {
          id: "map-8820",
          trialBalanceRowIdentity: {
            rowKey: "TB:3",
            source: { sheetName: "TB", rowNumber: 3 },
          },
          accountNumber: "8820",
          sourceAccountNumber: "8820",
          accountName: "Group contribution received",
          proposedCategory: {
            code: "882000",
            name: "Group contribution - received",
            statementType: "income_statement",
          },
          selectedCategory: {
            code: "882000",
            name: "Group contribution - received",
            statementType: "income_statement",
          },
          confidence: 0.92,
          evidence: [{ type: "tb_row", reference: "r2" }],
          policyRuleReference: "rule-8820",
          reviewFlag: false,
          status: "proposed",
          source: "deterministic",
        },
      ],
    });

    const annualReportTaxContext = parseAnnualReportDownstreamTaxContextV1({
      schemaVersion: "annual_report_tax_context_v1",
      incomeStatementAnchors: [],
      balanceSheetAnchors: [],
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: {
        notes: ["Ej avdragsgilla kostnader kommenteras i not 7."],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: ["Koncernbidrag mottaget under räkenskapsåret."],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      relevantNotes: [],
      priorYearComparatives: [],
      selectedRiskFindings: [],
      missingInformation: [],
    });

    const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
      mapping,
      trialBalance,
    });

    expect(routedCandidates).toMatchObject([
      {
        mappingDecisionId: "map-6072",
        moduleCode: "disallowed_expenses",
        trialBalanceRowIdentity: { rowKey: "TB:2" },
        rowResolutionStatus: "matched",
      },
      {
        mappingDecisionId: "map-8820",
        moduleCode: "group_contributions",
        trialBalanceRowIdentity: { rowKey: "TB:3" },
        rowResolutionStatus: "matched",
      },
    ]);

    const groupContext = projectTaxAdjustmentModuleContextV1({
      annualReportTaxContext,
      moduleCode: "group_contributions",
    });

    expect(groupContext).toEqual({
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
        notes: ["Koncernbidrag mottaget under räkenskapsåret."],
        evidence: [],
      },
    });

    const result = generateTaxAdjustmentsV1({
      policyVersion: "tax-adjustments.v1",
      mappingArtifactId: "c0000000-0000-4000-8000-000000000001",
      annualReportExtractionArtifactId: "c0000000-0000-4000-8000-000000000002",
      annualReportExtraction: parseAnnualReportExtractionPayloadV1({
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: "annual-report.pdf",
        sourceFileType: "pdf",
        policyVersion: "annual-report-manual-first.v1",
        fields: {
          companyName: { status: "manual", confidence: 1, value: "Acme AB" },
          organizationNumber: {
            status: "manual",
            confidence: 1,
            value: "556677-8899",
          },
          fiscalYearStart: { status: "manual", confidence: 1, value: "2025-01-01" },
          fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
          accountingStandard: { status: "manual", confidence: 1, value: "K2" },
          profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
        },
        summary: {
          autoDetectedFieldCount: 0,
          needsReviewFieldCount: 0,
        },
        confirmation: {
          isConfirmed: true,
          confirmedAt: "2026-03-12T12:00:00.000Z",
          confirmedByUserId: "c0000000-0000-4000-8000-000000000010",
        },
      }),
      mapping,
      trialBalance,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.adjustments.decisions).toMatchObject([
      {
        module: "disallowed_expenses",
        amount: 1000,
        targetField: "INK2S.non_deductible_expenses",
        status: "proposed",
      },
      {
        module: "group_contributions",
        amount: 0,
        targetField: "INK2S.other_manual_adjustments",
        status: "manual_review_required",
      },
    ]);
  });
});
