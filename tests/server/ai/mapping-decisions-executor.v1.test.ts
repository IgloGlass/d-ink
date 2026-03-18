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
import {
  MAPPING_DECISIONS_BALANCE_SHEET_GUIDELINES_V1,
  MAPPING_DECISIONS_CONSISTENCY_CHECKS_V1,
  MAPPING_DECISIONS_DECISION_HIERARCHY_V1,
  MAPPING_DECISIONS_INCOME_STATEMENT_GUIDELINES_V1,
  MAPPING_DECISIONS_SYSTEM_RULES_V1,
} from "../../../src/server/ai/modules/mapping-decisions/guideline-rules.v1";
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

function buildCustomNumberingTrialBalance() {
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
        accountName: "Building improvements - rented office",
        accountNumber: "ZX-LEASE-01",
        sourceAccountNumber: "ZX-LEASE-01",
        openingBalance: 40000,
        closingBalance: 125000,
        source: { sheetName: "TB", rowNumber: 2 },
        rawValues: {
          account_name: "Building improvements - rented office",
          account_number: "ZX-LEASE-01",
          opening_balance: "40000",
          closing_balance: "125000",
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
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: 2,
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 40000,
      closingBalanceTotal: 125000,
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

function buildMixedStatementTrialBalance() {
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
        accountName: "Software platform",
        accountNumber: "1012",
        sourceAccountNumber: "1012",
        openingBalance: 1000,
        closingBalance: 1500,
        source: { sheetName: "TB", rowNumber: 2 },
        rawValues: {
          account_name: "Software platform",
          account_number: "1012",
          opening_balance: "1000",
          closing_balance: "1500",
        },
      },
      {
        accountName: "Consulting revenue",
        accountNumber: "3010",
        sourceAccountNumber: "3010",
        openingBalance: 0,
        closingBalance: 400,
        source: { sheetName: "TB", rowNumber: 3 },
        rawValues: {
          account_name: "Consulting revenue",
          account_number: "3010",
          opening_balance: "0",
          closing_balance: "400",
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
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: 3,
      candidateRows: 2,
      normalizedRows: 2,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 1000,
      closingBalanceTotal: 1900,
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

function buildBuildingAccumulatedDepreciationTrialBalance() {
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
        accountName: "Ackumulerade avskrivningar pa byggnader",
        accountNumber: "1119",
        sourceAccountNumber: "1119",
        openingBalance: -20000,
        closingBalance: -35000,
        source: { sheetName: "TB", rowNumber: 2 },
        rawValues: {
          account_name: "Ackumulerade avskrivningar pa byggnader",
          account_number: "1119",
          opening_balance: "-20000",
          closing_balance: "-35000",
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
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: 2,
      candidateRows: 1,
      normalizedRows: 1,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: -20000,
      closingBalanceTotal: -35000,
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

function buildLargeTrialBalance(rowCount: number) {
  const rows = Array.from({ length: rowCount }, (_value, index) => {
    const rowNumber = index + 2;
    const accountNumber = String(7000 + index);
    const accountName = `Synthetic account ${rowNumber}`;
    return {
      accountName,
      accountNumber,
      sourceAccountNumber: accountNumber,
      openingBalance: 0,
      closingBalance: 100,
      source: { sheetName: "TB", rowNumber },
      rawValues: {
        account_name: accountName,
        account_number: accountNumber,
        opening_balance: "0",
        closing_balance: "100",
      },
    };
  });

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
    rows,
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "TB",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: rowCount,
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: rowCount + 1,
      candidateRows: rowCount,
      normalizedRows: rowCount,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal: rowCount * 100,
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
  it("fails fast when the AI execution budget is exceeded", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.useFakeTimers();
    try {
      vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(
        () => new Promise(() => undefined),
      );

      const pendingResult = executeMappingDecisionsModelV1({
        apiKey: "test-key",
        annualReportContext: undefined,
        config: {
          ...configResult.config,
          policyPack: {
            ...configResult.config.policyPack,
            batching: { maxRowsPerBatch: 4, minRowsPerChunk: 1 },
            retries: { maxAttempts: 1, backoffMs: 0 },
          },
        },
        executionBudgetMs: 10,
        generateId: () => "run-timeout",
        generatedAt: "2026-03-13T10:00:00.000Z",
        modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
        policyVersion: "mapping-ai.v1",
        trialBalance: buildTrialBalance(),
      });

      await vi.advanceTimersByTimeAsync(10);
      const result = await pendingResult;

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe("MODEL_EXECUTION_FAILED");
      expect(result.error.message).toContain("timed out after 10ms");
      expect(result.error.context).toMatchObject({
        executionBudgetMs: 10,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("continues with split retries and marks AI run fallback usage", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    let largeChunkAttempts = 0;
    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      // Exhaust both runtime-tier and tier-fallback calls across both retry
      // attempts so the chunk-retry runtime is forced to split.
      if (rows.length === 4 && largeChunkAttempts < 4) {
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
        model: "qwen-test",
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
    expect(result.mapping.executionMetadata).toMatchObject({
      requestedStrategy: "ai_primary",
      actualStrategy: "ai",
      degraded: true,
      degradedReasonCode: "ai_chunk_fallback",
      annualReportContextAvailable: false,
      usedAiRunFallback: true,
    });
    expect(result.mapping.decisions).toHaveLength(4);
    expect(result.mapping.decisions[0]?.aiTrace?.rationale).toContain("Mapped");
  });

  it("fills failed chunks with conservative fallback decisions", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      if (rows.some((row) => row.rowId === "TB:2" || row.rowId === "TB:3")) {
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
        model: "qwen-test",
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
    expect(result.mapping.executionMetadata).toMatchObject({
      degraded: true,
      degradedReasonCode: "ai_chunk_fallback",
      usedAiRunFallback: true,
    });
    expect(fallbackRows[0]?.aiTrace?.annualReportContextReferences).toEqual([]);
  });

  it("uses statement-type-safe fallback categories when chunk retries are exhausted", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: "timed out",
        context: {},
      },
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
      generateId: () => "run-statement-fallback",
      generatedAt: "2026-03-16T12:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildMixedStatementTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const balanceSheetRow = result.mapping.decisions.find(
      (decision) => decision.sourceAccountNumber === "1012",
    );
    const incomeStatementRow = result.mapping.decisions.find(
      (decision) => decision.sourceAccountNumber === "3010",
    );

    expect(balanceSheetRow).toMatchObject({
      selectedCategory: {
        code: "100000",
        statementType: "balance_sheet",
      },
      reviewFlag: true,
    });
    expect(balanceSheetRow?.policyRuleReference).toContain("mapping.ai.fallback");
    expect(incomeStatementRow).toMatchObject({
      selectedCategory: {
        code: "950000",
        statementType: "income_statement",
      },
      reviewFlag: true,
    });
  });

  it("does not send already-fallback rows into escalation retries", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    const observedBatchSizes: number[] = [];
    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      observedBatchSizes.push(rows.length);
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: "timed out",
          context: {},
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
      generateId: () => "run-no-escalate-fallback",
      generatedAt: "2026-03-16T12:20:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildMixedStatementTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(observedBatchSizes).toEqual([2, 2]);
    expect(
      result.mapping.decisions.every(
        (decision) =>
          decision.policyRuleReference ===
          "mapping.ai.fallback.chunk_retry_exhausted.v1",
      ),
    ).toBe(true);
  });

  it("caps each AI request to at most 40 rows even if runtime config exceeds the limit", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    const observedBatchSizes: number[] = [];
    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      observedBatchSizes.push(rows.length);
      return {
        ok: true,
        model: "qwen-test",
        output: {
          schemaVersion: "mapping_ai_proposal_v1",
          decisions: rows.map((row) => ({
            rowId: row.rowId,
            selectedCategoryCode: "950000",
            confidence: 0.96,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.synthetic.v1",
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
          batching: { maxRowsPerBatch: 120, minRowsPerChunk: 1 },
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "run-batch-cap",
      generatedAt: "2026-03-15T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildLargeTrialBalance(95),
    });

    expect(result.ok).toBe(true);
    expect(observedBatchSizes).toEqual([40, 40, 15]);
    expect(Math.max(...observedBatchSizes)).toBeLessThanOrEqual(40);
  });

  it("accepts model outputs when only schemaVersion label drifts", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      return {
        ok: true,
        model: "qwen-test",
        output: {
          schemaVersion: "mapping_ai_proposal_result_v1",
          decisions: rows.map((row) => ({
            rowId: row.rowId,
            selectedCategoryCode: "950000",
            confidence: 0.96,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.schema_drift.v1",
            rationale: `Mapped ${row.accountName}`,
          })),
        },
      };
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: undefined,
      config: configResult.config,
      generateId: () => "run-schema-drift",
      generatedAt: "2026-03-16T12:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.summary.fallbackDecisions).toBe(0);
    expect(result.mapping.aiRun?.usedFallback).toBe(false);
    expect(
      result.mapping.decisions.every(
        (decision) =>
          decision.policyRuleReference === "mapping.ai.rule.schema_drift.v1",
      ),
    ).toBe(true);
  });

  it("filters blank annual-report references instead of degrading the full batch", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      return {
        ok: true,
        model: "qwen-test",
        output: {
          schemaVersion: "mapping_ai_proposal_v1",
          decisions: rows.map((row, index) => ({
            rowId: row.rowId,
            selectedCategoryCode: "102000",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.blank_reference.v1",
            rationale: `Mapped ${row.accountName}`,
            annualReportContextReferences:
              index === 0
                ? [
                    {
                      area: "relevant_notes",
                      reference: "  ",
                    },
                    {
                      area: "relevant_notes",
                      reference: "Not 12",
                    },
                  ]
                : [],
          })),
        },
      };
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: {
        schemaVersion: "annual_report_mapping_context_v1",
        incomeStatementAnchors: [],
        balanceSheetAnchors: [],
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
        selectedRiskFindings: [],
        missingInformation: [],
      },
      config: configResult.config,
      generateId: () => "run-blank-reference",
      generatedAt: "2026-03-16T13:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.summary.fallbackDecisions).toBe(0);
    expect(
      result.mapping.decisions[0]?.aiTrace?.annualReportContextReferences,
    ).toEqual([
      {
        area: "relevant_notes",
        reference: "Not 12",
      },
    ]);
  });

  it("repairs omitted rows with a follow-up single-row AI pass before falling back", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    let batchCallCount = 0;
    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const rows = parseRowsFromInstruction(input.request.userInstruction);
      batchCallCount += 1;

      if (batchCallCount === 1) {
        return {
          ok: true,
          model: "qwen-test",
          output: {
            schemaVersion: "mapping_ai_proposal_v1",
            decisions: rows
              .filter((row) => row.rowId !== "TB:3")
              .map((row) => ({
                rowId: row.rowId,
                selectedCategoryCode: "102000",
                confidence: 0.92,
                reviewFlag: false,
                policyRuleReference: "mapping.ai.rule.omission-repair.v1",
                rationale: `Mapped ${row.accountName}`,
              })),
          },
        };
      }

      return {
        ok: true,
        model: "qwen-test",
        output: {
          schemaVersion: "mapping_ai_proposal_v1",
          decisions: rows.map((row) => ({
            rowId: row.rowId,
            selectedCategoryCode: "950000",
            confidence: 0.93,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.omission-repair.v1",
            rationale: `Recovered ${row.accountName}`,
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
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "run-omission-repair",
      generatedAt: "2026-03-16T13:15:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(batchCallCount).toBe(2);
    expect(result.mapping.summary.fallbackDecisions).toBe(0);
    expect(
      result.mapping.decisions.find((decision) => decision.id === "TB:3")
        ?.policyRuleReference,
    ).toBe("mapping.ai.rule.omission-repair.v1");
  });

  it("passes the expanded structured annual-report mapping context into the mapping prompt", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: true,
      model: "qwen-test",
      output: {
        schemaVersion: "mapping_ai_proposal_v1",
        decisions: [
          {
            rowId: "TB:2",
            selectedCategoryCode: "123200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
            annualReportContextReferences: [
              {
                area: "balance_sheet_anchors",
                reference: "leasehold_improvements",
              },
              {
                area: "relevant_notes",
                reference: "No building note was found in the annual report.",
              },
            ],
          },
          {
            rowId: "TB:3",
            selectedCategoryCode: "698200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
          {
            rowId: "TB:4",
            selectedCategoryCode: "607200",
            confidence: 0.91,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.test.v1",
            rationale: "Used annual-report context.",
          },
          {
            rowId: "TB:5",
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
      annualReportLineage: {
        sourceExtractionArtifactId: "ar-extraction-1",
        sourceTaxAnalysisArtifactId: "ar-tax-1",
      },
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
    const systemInstruction = String(
      vi.mocked(generateGeminiStructuredOutputV1).mock.calls[0]?.[0]?.request
        ?.systemInstruction ?? "",
    );
    const serializedContext = parseAnnualReportContextFromInstruction(instruction);
    expect(instruction).toContain("Classification strategy:");
    expect(instruction).toContain("\"mode\": \"ai_primary\"");
    expect(instruction).toContain(
      "\"inferStatementTypeBeforeCategorySelection\": true",
    );
    expect(instruction).toContain("\"preferSemanticSignalsOverAccountNumbers\": true");
    expect(instruction).toContain("\"localContext\"");
    for (const rule of MAPPING_DECISIONS_SYSTEM_RULES_V1) {
      expect(systemInstruction).toContain(rule);
    }
    for (const guideline of MAPPING_DECISIONS_BALANCE_SHEET_GUIDELINES_V1) {
      expect(instruction).toContain(guideline);
    }
    for (const guideline of MAPPING_DECISIONS_INCOME_STATEMENT_GUIDELINES_V1) {
      expect(instruction).toContain(guideline);
    }
    for (const guideline of MAPPING_DECISIONS_DECISION_HIERARCHY_V1) {
      expect(instruction).toContain(guideline);
    }
    for (const guideline of MAPPING_DECISIONS_CONSISTENCY_CHECKS_V1) {
      expect(instruction).toContain(guideline);
    }
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
    if (result.ok) {
      expect(result.mapping.executionMetadata).toMatchObject({
        requestedStrategy: "ai_primary",
        actualStrategy: "ai",
        degraded: false,
        annualReportContextAvailable: true,
        usedAiRunFallback: false,
      });
      expect(result.mapping.decisions[0]?.aiTrace).toMatchObject({
        rationale: "Used annual-report context.",
        annualReportContextReferences: [
          {
            area: "balance_sheet_anchors",
            reference: "leasehold_improvements",
          },
          {
            area: "relevant_notes",
            reference: "No building note was found in the annual report.",
          },
        ],
        sourceExtractionArtifactId: "ar-extraction-1",
        sourceTaxAnalysisArtifactId: "ar-tax-1",
      });
      expect(result.mapping.decisions[0]?.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "annual_report_context",
            matchedValue: "balance_sheet_anchors",
            snippet: "leasehold_improvements",
          }),
        ]),
      );
    }
  });

  it("forces BS accumulated building depreciation to non-tax-sensitive balance even if AI proposes 102000", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: true,
      model: "qwen-test",
      output: {
        schemaVersion: "mapping_ai_proposal_v1",
        decisions: [
          {
            rowId: "TB:2",
            selectedCategoryCode: "102000",
            confidence: 0.94,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.rule.accumulated-depreciation.v1",
            rationale:
              "Account refers to accumulated depreciation on buildings. As a balance sheet contra-asset, it maps to the general tangible/acquired intangible assets category.",
            annualReportContextReferences: [
              {
                area: "relevant_notes",
                reference: "Not 14",
              },
            ],
          },
        ],
      },
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: undefined,
      config: configResult.config,
      generateId: () => "run-bs-accumulated-building-depr",
      generatedAt: "2026-03-16T15:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildBuildingAccumulatedDepreciationTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0]?.selectedCategory.code).toBe("100000");
    expect(result.mapping.decisions[0]?.reviewFlag).toBe(true);
    expect(result.mapping.decisions[0]?.policyRuleReference).toBe(
      "mapping.ai.guardrail.bs.building_land_leasehold_accumulated_depreciation.non_tax_sensitive.v1",
    );
    expect(result.mapping.decisions[0]?.aiTrace?.rationale).toContain(
      "Guardrail applied: balance-sheet accumulated depreciation for buildings, land improvements, or leasehold improvements maps to Non-tax sensitive - Balance",
    );
  });

  it("uses semantics-only fallback for non-BAS rows when AI execution fails", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: "synthetic failure",
        context: {},
      },
    });

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext: undefined,
      config: {
        ...configResult.config,
        policyPack: {
          ...configResult.config.policyPack,
          batching: { maxRowsPerBatch: 4, minRowsPerChunk: 1 },
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "run-semantics-fallback",
      generatedAt: "2026-03-16T16:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildCustomNumberingTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions[0]?.selectedCategory.code).toBe("100000");
    expect(result.mapping.decisions[0]?.policyRuleReference).toBe(
      "mapping.ai.fallback.chunk_retry_exhausted.v1",
    );
  });

  it("persists annual-report-driven leasehold-improvement classification for non-BAS custom numbering", async () => {
    const configResult = loadMappingDecisionsModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateGeminiStructuredOutputV1).mockResolvedValue({
      ok: true,
      model: "qwen-test",
      output: {
        schemaVersion: "mapping_ai_proposal_v1",
        decisions: [
          {
            rowId: "TB:2",
            selectedCategoryCode: "123200",
            confidence: 0.94,
            reviewFlag: false,
            policyRuleReference: "mapping.ai.leasehold.contextual.v1",
            rationale:
              "Annual-report asset note indicates leasehold improvements and no owned buildings.",
            annualReportContextReferences: [
              {
                area: "balance_sheet_anchors",
                reference: "leasehold_improvements",
              },
              {
                area: "relevant_notes",
                reference: "No building note was found in the annual report.",
              },
            ],
          },
        ],
      },
    });

    const annualReportContext = {
      schemaVersion: "annual_report_mapping_context_v1" as const,
      incomeStatementAnchors: [],
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
            openingCarryingAmount: 40000,
            acquisitions: 100000,
            depreciationForYear: 15000,
            closingCarryingAmount: 125000,
            evidence: [],
          },
        ],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      taxExpenseContext: {
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: ["Rented premises are disclosed in the annual report."],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      priorYearComparatives: [],
      selectedRiskFindings: [],
      missingInformation: ["No building note was found in the annual report."],
    };

    const result = await executeMappingDecisionsModelV1({
      apiKey: "test-key",
      annualReportContext,
      annualReportLineage: {
        sourceExtractionArtifactId: "ar-extraction-leasehold",
      },
      config: configResult.config,
      generateId: () => "run-leasehold",
      generatedAt: "2026-03-12T12:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      policyVersion: "mapping-ai.v1",
      trialBalance: buildCustomNumberingTrialBalance(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.mapping.decisions).toMatchObject([
      {
        sourceAccountNumber: "ZX-LEASE-01",
        selectedCategory: {
          code: "123200",
        },
        aiTrace: {
          rationale:
            "Annual-report asset note indicates leasehold improvements and no owned buildings.",
          annualReportContextReferences: [
            {
              area: "balance_sheet_anchors",
              reference: "leasehold_improvements",
            },
            {
              area: "relevant_notes",
              reference: "No building note was found in the annual report.",
            },
          ],
          sourceExtractionArtifactId: "ar-extraction-leasehold",
        },
      },
    ]);
  });
});
