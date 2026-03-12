import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/server/ai/providers/gemini-client.v1", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/server/ai/providers/gemini-client.v1")
  >("../../../src/server/ai/providers/gemini-client.v1");

  return {
    ...actual,
    generateGeminiStructuredOutputV1: vi.fn(),
  };
});

import { executeMappingDecisionsModelV1 } from "../../../src/server/ai/modules/mapping-decisions/executor.v1";
import { loadMappingDecisionsModuleConfigV1 } from "../../../src/server/ai/modules/mapping-decisions/loader.v1";
import { generateGeminiStructuredOutputV1 } from "../../../src/server/ai/providers/gemini-client.v1";
import { parseTrialBalanceNormalizedV1 } from "../../../src/shared/contracts/trial-balance.v1";

type ProjectionRow = {
  rowId: string;
  accountName: string;
};

function parseAnnualReportContextFromInstruction(userInstruction: string): Record<string, unknown> | null {
  const startMarker = "Annual report mapping context:";
  const endMarker = "Rows to classify:";
  const startIndex = userInstruction.indexOf(startMarker);
  const endIndex = userInstruction.indexOf(endMarker);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  const contextJson = userInstruction
    .slice(startIndex + startMarker.length, endIndex)
    .trim();

  return JSON.parse(contextJson) as Record<string, unknown>;
}

function parseRowsFromInstruction(userInstruction: string): ProjectionRow[] {
  const marker = "Rows to classify:";
  const markerIndex = userInstruction.indexOf(marker);
  if (markerIndex < 0) {
    return [];
  }

  const rowsJson = userInstruction
    .slice(markerIndex + marker.length)
    .trim();

  return JSON.parse(rowsJson) as ProjectionRow[];
}

function buildTrialBalance() {
  return parseTrialBalanceNormalizedV1({
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
        accountName: "Consulting",
        accountNumber: "6550",
        sourceAccountNumber: "6550",
        openingBalance: 0,
        closingBalance: 100,
        source: { sheetName: "TB", rowNumber: 2 },
        rawValues: {
          account_name: "Consulting",
          account_number: "6550",
          opening_balance: "0",
          closing_balance: "100",
        },
      },
      {
        accountName: "Membership fees",
        accountNumber: "6982",
        sourceAccountNumber: "6982",
        openingBalance: 0,
        closingBalance: 200,
        source: { sheetName: "TB", rowNumber: 3 },
        rawValues: {
          account_name: "Membership fees",
          account_number: "6982",
          opening_balance: "0",
          closing_balance: "200",
        },
      },
      {
        accountName: "Representation",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        openingBalance: 0,
        closingBalance: 50,
        source: { sheetName: "TB", rowNumber: 4 },
        rawValues: {
          account_name: "Representation",
          account_number: "6072",
          opening_balance: "0",
          closing_balance: "50",
        },
      },
      {
        accountName: "Other",
        accountNumber: "3990",
        sourceAccountNumber: "3990",
        openingBalance: 0,
        closingBalance: 10,
        source: { sheetName: "TB", rowNumber: 5 },
        rawValues: {
          account_name: "Other",
          account_number: "3990",
          opening_balance: "0",
          closing_balance: "10",
        },
      },
    ],
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "TB",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: 4,
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: 5,
      candidateRows: 4,
      normalizedRows: 4,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: 360,
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

afterEach(() => {
  vi.clearAllMocks();
});

describe("mapping decisions executor reliability v1", () => {
  it("continues with split retries and marks AI run fallback usage", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    let largeChunkAttempts = 0;
    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      if (rows.length === 4 && largeChunkAttempts < 2) {
        largeChunkAttempts += 1;
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "timed out",
            context: {},
          },
        };
      }

      return {
        ok: true,
        model: "gemini-test",
        output: {
          schemaVersion: "mapping_ai_proposal_v1",
          decisions: rows.map((row) => ({
            rowId: row.rowId,
            selectedCategoryCode: "655000",
            confidence: 0.92,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: `Mapped ${row.accountName}`,
          })),
        },
      };
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: undefined,
      config: {
        ...configResult.config,
        policyPack: {
          ...configResult.config.policyPack,
          batching: { maxRowsPerBatch: 4, minRowsPerChunk: 1 },
          retries: { maxAttempts: 2, backoffMs: 0 },
        },
      },
      generateId: () => "run-1",
      generatedAt: "2026-03-07T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.aiRun?.usedFallback).toBe(true);
    expect(result.mapping.decisions).toHaveLength(4);
  });

  it("fills failed chunks with conservative fallback decisions", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      if (rows.some((row) => row.rowId === "tb-row-1" || row.rowId === "tb-row-2")) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "timed out",
            context: {},
          },
        };
      }

      return {
        ok: true,
        model: "gemini-test",
        output: {
          schemaVersion: "mapping_ai_proposal_v1",
          decisions: rows.map((row) => ({
            rowId: row.rowId,
            selectedCategoryCode: "607200",
            confidence: 0.9,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "ok",
          })),
        },
      };
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: undefined,
      config: {
        ...configResult.config,
        policyPack: {
          ...configResult.config.policyPack,
          batching: { maxRowsPerBatch: 2, minRowsPerChunk: 2 },
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "run-2",
      generatedAt: "2026-03-07T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const fallbackRows = result.mapping.decisions.filter((decision) =>
      decision.policyRuleReference.startsWith("mapping.ai.fallback."),
    );
    expect(fallbackRows.length).toBeGreaterThan(0);
    expect(result.mapping.summary.fallbackDecisions).toBeGreaterThan(0);
  });

  it("passes the expanded structured annual-report mapping context into the mapping prompt", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: true,
      model: "gemini-test",
      output: {
        schemaVersion: "mapping_ai_proposal_v1",
        decisions: [
          {
            rowId: "tb-row-1",
            selectedCategoryCode: "123200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
          {
            rowId: "tb-row-2",
            selectedCategoryCode: "698200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
          {
            rowId: "tb-row-3",
            selectedCategoryCode: "607200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
          {
            rowId: "tb-row-4",
            selectedCategoryCode: "397000",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
        ],
      },
    });

    const annualReportContext = {
      schemaVersion: "annual_report_mapping_context_v1" as const,
      incomeStatementAnchors: [
        {
          code: "profit_before_tax",
          label: "Resultat fore skatt",
          currentYearValue: 500000,
          evidence: [],
        },
      ],
      balanceSheetAnchors: [
        {
          code: "leasehold_improvements",
          label: "Forbattringsutgifter pa annans fastighet",
          currentYearValue: 125000,
          evidence: [],
        },
      ],
      depreciationContext: {
        assetAreas: [
          {
            assetArea: "Leasehold improvements",
            openingCarryingAmount: 100000,
            acquisitions: 50000,
            depreciationForYear: 25000,
            closingCarryingAmount: 125000,
            evidence: [],
          },
        ],
        evidence: [],
      },
      assetMovements: {
        lines: [
          {
            assetArea: "Machinery and equipment",
            openingCarryingAmount: 200000,
            depreciationForYear: 40000,
            closingCarryingAmount: 160000,
            evidence: [],
          },
        ],
        evidence: [],
      },
      netInterestContext: {
        interestExpense: {
          value: 12000,
          evidence: [],
        },
        notes: ["Interest expense disclosed in finance note."],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: ["Untaxed reserves disclosed."],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: {
        currentTax: {
          value: 11000,
          evidence: [],
        },
        deferredTax: {
          value: 3000,
          evidence: [],
        },
        notes: ["Deferred tax note captured from annual report."],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: ["Lease commitments disclosed."],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: ["Group-company shares disclosed."],
        evidence: [],
      },
      priorYearComparatives: [],
      selectedRiskFindings: [
        {
          area: "depreciation_differences",
          title: "Depreciation note present",
          severity: "medium" as const,
          rationale: "Annual report includes fixed-asset note disclosures.",
          policyRuleReference: "mapping.test.risk.v1",
          evidence: [],
        },
      ],
      missingInformation: ["No building note was found in the annual report."],
    };

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext,
      config: configResult.config,
      generateId: () => "run-context",
      generatedAt: "2026-03-12T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    const instruction = String(
      vi.mocked(generateGeminiStructuredOutputV1).mock.calls[0]?.[0]?.request
        ?.userInstruction ?? "",
    );
    const serializedContext = parseAnnualReportContextFromInstruction(instruction);
    expect(serializedContext).toMatchObject({
      schemaVersion: "annual_report_mapping_context_v1",
      depreciationContext: {
        assetAreas: [
          expect.objectContaining({
            assetArea: "Leasehold improvements",
          }),
        ],
      },
      assetMovements: {
        lines: [
          expect.objectContaining({
            assetArea: "Machinery and equipment",
          }),
        ],
      },
      taxExpenseContext: {
        deferredTax: {
          value: 3000,
        },
      },
      balanceSheetAnchors: [
        expect.objectContaining({
          code: "leasehold_improvements",
        }),
      ],
      missingInformation: [
        "No building note was found in the annual report.",
      ],
    });
  });
});
