import { describe, expect, it } from "vitest";

import { generateTaxAdjustmentsV1 } from "../../../src/server/adjustments/tax-adjustments-engine.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { MappingDecisionSetPayloadV1Schema } from "../../../src/shared/contracts/mapping.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

describe("tax adjustments engine golden v1", () => {
  it("matches expected net adjustment totals for baseline fixture", () => {
    const result = generateTaxAdjustmentsV1({
      policyVersion: "tax-adjustments.v1",
      mappingArtifactId: "a1000000-0000-4000-8000-000000000001",
      annualReportExtractionArtifactId: "a1000000-0000-4000-8000-000000000002",
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
          fiscalYearStart: {
            status: "manual",
            confidence: 1,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "manual",
            confidence: 1,
            value: "2025-12-31",
          },
          accountingStandard: { status: "manual", confidence: 1, value: "K2" },
          profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
        },
        summary: {
          autoDetectedFieldCount: 0,
          needsReviewFieldCount: 0,
        },
        confirmation: {
          isConfirmed: true,
          confirmedAt: "2026-03-03T14:00:00.000Z",
          confirmedByUserId: "a1000000-0000-4000-8000-000000000010",
        },
      }),
      mapping: MappingDecisionSetPayloadV1Schema.parse({
        schemaVersion: "mapping_decisions_v1",
        policyVersion: "deterministic-bas.v1",
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
            id: "row-1",
            accountNumber: "6072",
            sourceAccountNumber: "6072",
            accountName: "Rep non deductible",
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
            policyRuleReference: "rule-1",
            reviewFlag: false,
            status: "proposed",
            source: "deterministic",
          },
          {
            id: "row-2",
            accountNumber: "6071",
            sourceAccountNumber: "6071",
            accountName: "Rep deductible",
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
            confidence: 0.9,
            evidence: [{ type: "tb_row", reference: "r2" }],
            policyRuleReference: "rule-2",
            reviewFlag: false,
            status: "proposed",
            source: "deterministic",
          },
        ],
      }),
      trialBalance: parseTrialBalanceNormalizedV1({
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
            accountName: "Rep non deductible",
            accountNumber: "6072",
            sourceAccountNumber: "6072",
            openingBalance: 0,
            closingBalance: 1000,
            source: { sheetName: "TB", rowNumber: 2 },
            rawValues: {
              account_name: "Rep non deductible",
              account_number: "6072",
              opening_balance: "0",
              closing_balance: "1000",
            },
          },
          {
            accountName: "Rep deductible",
            accountNumber: "6071",
            sourceAccountNumber: "6071",
            openingBalance: 0,
            closingBalance: 2000,
            source: { sheetName: "TB", rowNumber: 3 },
            rawValues: {
              account_name: "Rep deductible",
              account_number: "6071",
              opening_balance: "0",
              closing_balance: "2000",
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
          closingBalanceTotal: 3000,
          checks: [
            {
              code: "required_columns_present",
              status: "pass",
              message: "ok",
              context: {},
            },
          ],
        },
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.adjustments.summary.totalPositiveAdjustments).toBe(1200);
    expect(result.adjustments.summary.totalNegativeAdjustments).toBe(0);
    expect(result.adjustments.summary.totalNetAdjustments).toBe(1200);
  });
});
