import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/server/ai/providers/ai-provider-client.v1", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/server/ai/providers/ai-provider-client.v1")
  >("../../../src/server/ai/providers/ai-provider-client.v1");

  return {
    ...actual,
    generateAiStructuredOutputV1: vi.fn(),
  };
});

import { executeTaxAdjustmentSubmoduleV1 } from "../../../src/server/ai/modules/tax-adjustments-shared/executor.v1";
import { loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1 } from "../../../src/server/ai/modules/tax-adjustments-non-deductible-expenses/loader.v1";
import { generateAiStructuredOutputV1 } from "../../../src/server/ai/providers/ai-provider-client.v1";
import { parseTaxAdjustmentModuleContextV1 } from "../../../src/shared/contracts/tax-adjustment-routing.v1";

function parseCandidatesFromInstruction(userInstruction: string): Array<{
  mappingDecisionId: string;
}> {
  const marker = "Candidate mapping rows:";
  const markerIndex = userInstruction.indexOf(marker);
  if (markerIndex < 0) {
    return [];
  }

  return JSON.parse(
    userInstruction.slice(markerIndex + marker.length).trim(),
  ) as Array<{
    mappingDecisionId: string;
  }>;
}

const taxContext = parseTaxAdjustmentModuleContextV1({
  schemaVersion: "tax_adjustment_module_context_v1",
  moduleCode: "disallowed_expenses",
  shared: {
    relevantNotes: [],
    priorYearComparatives: [],
    selectedRiskFindings: [],
    missingInformation: [],
  },
  taxExpenseContext: {
    notes: [],
    evidence: [],
  },
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("tax-adjustment submodule executor reliability v1", () => {
  it("returns partial success with failed candidates when one chunk is exhausted", async () => {
    const configResult = loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateAiStructuredOutputV1).mockImplementation(async (input) => {
      const candidates = parseCandidatesFromInstruction(input.request.userInstruction);
      if (
        candidates.some((candidate) =>
          ["map-1", "map-2"].includes(candidate.mappingDecisionId),
        )
      ) {
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
          schemaVersion: "tax_adjustment_ai_proposal_v1",
          decisions: candidates.map((candidate) => ({
            decisionId: `adj-ai-${candidate.mappingDecisionId}`,
            module: "non_deductible_expenses",
            sourceMappingDecisionId: candidate.mappingDecisionId,
            direction: "increase_taxable_income",
            targetField: "INK2S.non_deductible_expenses",
            reviewFlag: false,
            confidence: 0.9,
            policyRuleReference: "adj.non_deductible.ai.v1",
            rationale: "ok",
          })),
        },
      };
    });

    const result = await executeTaxAdjustmentSubmoduleV1({
      apiKey: "test-key",
      annualReportTaxContext: taxContext,
      candidates: [
        {
          mappingDecisionId: "map-1",
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          accountName: "Representation",
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          closingBalance: 100,
          mappingReviewFlag: false,
        },
        {
          mappingDecisionId: "map-2",
          accountNumber: "6982",
          sourceAccountNumber: "6982",
          accountName: "Membership fee",
          selectedCategory: {
            code: "698200",
            name: "Membership fees - presumed non-deductible",
            statementType: "income_statement",
          },
          closingBalance: 200,
          mappingReviewFlag: false,
        },
        {
          mappingDecisionId: "map-3",
          accountNumber: "6900",
          sourceAccountNumber: "6900",
          accountName: "Other non deductible",
          selectedCategory: {
            code: "690000",
            name: "Other non-deductible costs",
            statementType: "income_statement",
          },
          closingBalance: 300,
          mappingReviewFlag: false,
        },
      ],
      config: {
        ...configResult.config,
        policyPack: {
          ...configResult.config.policyPack,
          batching: { maxRowsPerBatch: 2, minRowsPerChunk: 2 },
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "adj-run-1",
      generatedAt: "2026-03-07T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.failedCandidates).toHaveLength(2);
    expect(result.decisions).toHaveLength(1);
    expect(result.aiRun?.usedFallback).toBe(true);
  });

  it("fails closed when the AI returns a decision for the wrong module", async () => {
    const configResult = loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1();
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) {
      return;
    }

    vi.mocked(generateAiStructuredOutputV1).mockResolvedValue({
      ok: true,
      model: "qwen-test",
      output: {
        schemaVersion: "tax_adjustment_ai_proposal_v1",
        decisions: [
          {
            decisionId: "adj-ai-map-1",
            module: "representation_entertainment",
            sourceMappingDecisionId: "map-1",
            direction: "increase_taxable_income",
            targetField: "INK2S.non_deductible_expenses",
            reviewFlag: false,
            confidence: 0.9,
            policyRuleReference: "adj.non_deductible.ai.v1",
            rationale: "wrong module",
          },
        ],
      },
    });

    const result = await executeTaxAdjustmentSubmoduleV1({
      apiKey: "test-key",
      annualReportTaxContext: taxContext,
      candidates: [
        {
          mappingDecisionId: "map-1",
          moduleCode: "non_deductible_expenses",
          accountNumber: "6072",
          sourceAccountNumber: "6072",
          accountName: "Representation",
          selectedCategory: {
            code: "607200",
            name: "Entertainment - internal and external - presumed non-deductible",
            statementType: "income_statement",
          },
          closingBalance: 100,
          mappingReviewFlag: false,
        },
      ],
      config: {
        ...configResult.config,
        policyPack: {
          ...configResult.config.policyPack,
          batching: { maxRowsPerBatch: 2, minRowsPerChunk: 1 },
          retries: { maxAttempts: 1, backoffMs: 0 },
        },
      },
      generateId: () => "adj-run-2",
      generatedAt: "2026-03-07T10:00:00.000Z",
      modelConfig: { fastModel: "fast", thinkingModel: "thinking" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.decisions).toHaveLength(0);
    expect(result.failedCandidates).toHaveLength(1);
    expect(result.aiRun).toBeUndefined();
  });
});
