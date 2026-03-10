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

import { executeTaxAdjustmentSubmoduleV1 } from "../../../src/server/ai/modules/tax-adjustments-shared/executor.v1";
import { loadTaxAdjustmentsNonDeductibleExpensesModuleConfigV1 } from "../../../src/server/ai/modules/tax-adjustments-non-deductible-expenses/loader.v1";
import { generateGeminiStructuredOutputV1 } from "../../../src/server/ai/providers/gemini-client.v1";
import type { AnnualReportDownstreamTaxContextV1 } from "../../../src/shared/contracts/annual-report-tax-context.v1";

function parseCandidatesFromInstruction(userInstruction: string): Array<{
  sourceMappingDecisionId: string;
}> {
  const marker = "Candidate mapping rows:";
  const markerIndex = userInstruction.indexOf(marker);
  if (markerIndex < 0) {
    return [];
  }

  return JSON.parse(
    userInstruction.slice(markerIndex + marker.length).trim(),
  ) as Array<{
    sourceMappingDecisionId: string;
  }>;
}

const taxContext: AnnualReportDownstreamTaxContextV1 = {
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
  leasingContext: {
    flags: [],
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
  missingInformation: [],
};

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

    vi.mocked(generateGeminiStructuredOutputV1).mockImplementation(async (input) => {
      const candidates = parseCandidatesFromInstruction(input.request.userInstruction);
      if (
        candidates.some((candidate) =>
          ["map-1", "map-2"].includes(candidate.sourceMappingDecisionId),
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
        model: "gemini-test",
        output: {
          schemaVersion: "tax_adjustment_ai_proposal_v1",
          decisions: candidates.map((candidate) => ({
            decisionId: `adj-ai-${candidate.sourceMappingDecisionId}`,
            module: "non_deductible_expenses",
            sourceMappingDecisionId: candidate.sourceMappingDecisionId,
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
          sourceMappingDecisionId: "map-1",
          sourceAccountNumber: "6072",
          accountName: "Representation",
          selectedCategoryCode: "607200",
          closingBalance: 100,
          mappingReviewFlag: false,
        },
        {
          sourceMappingDecisionId: "map-2",
          sourceAccountNumber: "6982",
          accountName: "Membership fee",
          selectedCategoryCode: "698200",
          closingBalance: 200,
          mappingReviewFlag: false,
        },
        {
          sourceMappingDecisionId: "map-3",
          sourceAccountNumber: "6900",
          accountName: "Other non deductible",
          selectedCategoryCode: "690000",
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
});
