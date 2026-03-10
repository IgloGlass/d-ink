import {
  getSilverfinTaxCategoryByCodeV1,
  listSilverfinTaxCategoriesV1,
  type MappingDecisionSetPayloadV1,
  type SilverfinTaxCategoryCodeV1,
} from "../../../../shared/contracts/mapping.v1";
import type { AnnualReportMappingContextV1 } from "../../../../shared/contracts/annual-report-tax-context.v1";
import {
  MappingAiProposalResultV1Schema,
  type MappingAiProposalDecisionV1,
} from "../../../../shared/contracts/mapping-ai-proposal.v1";
import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import type { TrialBalanceNormalizedV1 } from "../../../../shared/contracts/trial-balance.v1";
import { generateGeminiStructuredOutputV1 } from "../../providers/gemini-client.v1";
import type { GeminiModelConfigV1 } from "../../providers/gemini-client.v1";
import { executeChunksWithRetryAndSplitV1 } from "../../runtime/chunk-retry.v1";
import type { loadMappingDecisionsModuleConfigV1 } from "./loader.v1";
import {
  MAPPING_DECISIONS_SYSTEM_PROMPT_V1,
  MAPPING_DECISIONS_USER_PROMPT_V1,
} from "./prompt-text.v1";

export type MappingDecisionsRuntimeConfigV1 =
  NonNullable<
    Extract<
      ReturnType<typeof loadMappingDecisionsModuleConfigV1>,
      { ok: true }
    >["config"]
  >;

type MappingRowProjectionV1 = {
  rowId: string;
  sourceAccountNumber: string;
  accountNumber: string;
  accountName: string;
  openingBalance: number;
  closingBalance: number;
};

export type ExecuteMappingDecisionsInputV1 = {
  apiKey?: string;
  annualReportContext?: AnnualReportMappingContextV1;
  config: MappingDecisionsRuntimeConfigV1;
  generateId: () => string;
  generatedAt: string;
  modelConfig: GeminiModelConfigV1;
  policyVersion: string;
  trialBalance: TrialBalanceNormalizedV1;
};

export type ExecuteMappingDecisionsResultV1 =
  | {
      ok: true;
      mapping: MappingDecisionSetPayloadV1;
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    };

function chunkRowsV1<TValue>(rows: TValue[], chunkSize: number): TValue[][] {
  const chunks: TValue[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildRowsV1(trialBalance: TrialBalanceNormalizedV1): MappingRowProjectionV1[] {
  return trialBalance.rows.map((row, index) => ({
    rowId: `tb-row-${index + 1}`,
    sourceAccountNumber: row.sourceAccountNumber,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    openingBalance: row.openingBalance,
    closingBalance: row.closingBalance,
  }));
}

function buildInstructionV1(input: {
  annualReportContext?: AnnualReportMappingContextV1;
  rows: MappingRowProjectionV1[];
}): string {
  const categoryCatalog = listSilverfinTaxCategoriesV1().map((category) => ({
    code: category.code,
    name: category.name,
    statementType: category.statementType,
  }));

  return [
    MAPPING_DECISIONS_USER_PROMPT_V1,
    "Category catalog:",
    JSON.stringify(categoryCatalog, null, 2),
    "Annual report mapping context:",
    JSON.stringify(input.annualReportContext ?? null, null, 2),
    "Rows to classify:",
    JSON.stringify(input.rows, null, 2),
  ].join("\n\n");
}

async function runBatchV1(input: {
  apiKey?: string;
  annualReportContext?: AnnualReportMappingContextV1;
  config: MappingDecisionsRuntimeConfigV1;
  modelConfig: GeminiModelConfigV1;
  rows: MappingRowProjectionV1[];
  modelTier: "fast" | "thinking";
}): Promise<
  | {
      ok: true;
      decisions: MappingAiProposalDecisionV1[];
      model: string;
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    }
> {
  const result = await generateGeminiStructuredOutputV1({
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    request: {
      modelTier: input.modelTier,
      responseSchema: MappingAiProposalResultV1Schema,
      systemInstruction: MAPPING_DECISIONS_SYSTEM_PROMPT_V1,
      timeoutMs: input.config.policyPack.timeouts.requestTimeoutMs,
      userInstruction: buildInstructionV1({
        annualReportContext: input.annualReportContext,
        rows: input.rows,
      }),
    },
  });

  if (!result.ok) {
    return result;
  }

  const output = result.output as { decisions: MappingAiProposalDecisionV1[] };

  return {
    ok: true,
    decisions: output.decisions,
    model: result.model,
  };
}

function splitRowsForRetryV1(input: {
  minRowsPerChunk: number;
  rows: MappingRowProjectionV1[];
}): [MappingRowProjectionV1[], MappingRowProjectionV1[]] | null {
  if (input.rows.length <= Math.max(1, input.minRowsPerChunk)) {
    return null;
  }

  const midpoint = Math.ceil(input.rows.length / 2);
  const left = input.rows.slice(0, midpoint);
  const right = input.rows.slice(midpoint);
  if (left.length === 0 || right.length === 0) {
    return null;
  }

  return [left, right];
}

function shouldEscalateDecisionV1(input: {
  config: MappingDecisionsRuntimeConfigV1;
  decision: MappingAiProposalDecisionV1;
}): boolean {
  return (
    input.decision.reviewFlag ||
    input.decision.confidence <
      input.config.policyPack.reviewThresholds.fastConfidenceBelow ||
    input.config.policyPack.escalation.taxSensitiveCategoryCodes.includes(
      input.decision.selectedCategoryCode,
    )
  );
}

function buildMappingDecisionSetV1(input: {
  aiRun: MappingDecisionSetPayloadV1["aiRun"];
  policyVersion: string;
  rows: MappingRowProjectionV1[];
  decisionsByRowId: Map<string, MappingAiProposalDecisionV1>;
}): MappingDecisionSetPayloadV1 {
  const decisions = input.rows.map((row) => {
    const proposal = input.decisionsByRowId.get(row.rowId);
    const selectedCategoryCode = proposal?.selectedCategoryCode ?? "950000";
    const selectedCategory = getSilverfinTaxCategoryByCodeV1(
      selectedCategoryCode as SilverfinTaxCategoryCodeV1,
    );

    return {
      id: row.rowId,
      accountNumber: row.accountNumber,
      sourceAccountNumber: row.sourceAccountNumber,
      accountName: row.accountName,
      proposedCategory: selectedCategory,
      selectedCategory,
      confidence: proposal?.confidence ?? 0.3,
      evidence: [
        {
          type: "tb_row" as const,
          reference: row.rowId,
          snippet: `${row.sourceAccountNumber} ${row.accountName}`,
        },
      ],
      policyRuleReference:
        proposal?.policyRuleReference ?? "mapping.ai.fallback.non_tax_sensitive.v1",
      reviewFlag: proposal?.reviewFlag ?? true,
      status: "proposed" as const,
      source: "ai" as const,
    };
  });

  const fallbackDecisions = decisions.filter(
    (decision) => decision.policyRuleReference.startsWith("mapping.ai.fallback."),
  ).length;

  return {
    schemaVersion: "mapping_decisions_v1",
    policyVersion: input.policyVersion,
    aiRun: input.aiRun,
    summary: {
      totalRows: decisions.length,
      deterministicDecisions: 0,
      manualReviewRequired: decisions.filter((decision) => decision.reviewFlag)
        .length,
      fallbackDecisions,
      matchedByAccountNumber: 0,
      matchedByAccountName: decisions.length - fallbackDecisions,
      unmatchedRows: 0,
    },
    decisions,
  };
}

function buildConservativeFallbackProposalV1(
  row: MappingRowProjectionV1,
): MappingAiProposalDecisionV1 {
  return {
    rowId: row.rowId,
    selectedCategoryCode: "950000",
    confidence: 0.25,
    reviewFlag: true,
    policyRuleReference: "mapping.ai.fallback.chunk_retry_exhausted.v1",
    rationale:
      "AI classification fallback used after retry/split exhaustion for this row chunk.",
  };
}

export async function executeMappingDecisionsModelV1(
  input: ExecuteMappingDecisionsInputV1,
): Promise<ExecuteMappingDecisionsResultV1> {
  const rows = buildRowsV1(input.trialBalance);
  const batches = chunkRowsV1(
    rows,
    input.config.policyPack.batching.maxRowsPerBatch,
  );
  const decisionsByRowId = new Map<string, MappingAiProposalDecisionV1>();
  let primaryModel = input.modelConfig.fastModel;
  let usedFallback = false;

  const initialPass = await executeChunksWithRetryAndSplitV1({
    chunks: batches,
    maxAttempts: input.config.policyPack.retries.maxAttempts,
    backoffMs: input.config.policyPack.retries.backoffMs,
    splitChunk: (chunk) =>
      splitRowsForRetryV1({
        rows: chunk,
        minRowsPerChunk: input.config.policyPack.batching.minRowsPerChunk,
      }),
    executeChunk: async (chunk) => {
      const result = await runBatchV1({
        apiKey: input.apiKey,
        annualReportContext: input.annualReportContext,
        config: input.config,
        modelConfig: input.modelConfig,
        rows: chunk,
        modelTier: input.config.moduleSpec.runtime.modelTier,
      });
      if (!result.ok) {
        return result;
      }

      return {
        ok: true as const,
        output: result,
      };
    },
  });

  for (const success of initialPass.successes) {
    primaryModel = success.output.model;
    for (const decision of success.output.decisions) {
      decisionsByRowId.set(decision.rowId, decision);
    }
    for (const row of success.chunk) {
      if (!decisionsByRowId.has(row.rowId)) {
        usedFallback = true;
        decisionsByRowId.set(row.rowId, buildConservativeFallbackProposalV1(row));
      }
    }
  }

  for (const failure of initialPass.failures) {
    usedFallback = true;
    for (const row of failure.chunk) {
      if (decisionsByRowId.has(row.rowId)) {
        continue;
      }
      decisionsByRowId.set(row.rowId, buildConservativeFallbackProposalV1(row));
    }
  }
  if (initialPass.telemetry.splitCount > 0) {
    usedFallback = true;
  }

  const escalatedRows = rows.filter((row) => {
    const decision = decisionsByRowId.get(row.rowId);
    return (
      decision &&
      shouldEscalateDecisionV1({
        config: input.config,
        decision,
      })
    );
  });

  if (escalatedRows.length > 0) {
    const escalatedBatches = chunkRowsV1(
      escalatedRows,
      input.config.policyPack.batching.maxRowsPerBatch,
    );
    const escalationPass = await executeChunksWithRetryAndSplitV1({
      chunks: escalatedBatches,
      maxAttempts: input.config.policyPack.retries.maxAttempts,
      backoffMs: input.config.policyPack.retries.backoffMs,
      splitChunk: (chunk) =>
        splitRowsForRetryV1({
          rows: chunk,
          minRowsPerChunk: input.config.policyPack.batching.minRowsPerChunk,
        }),
      executeChunk: async (chunk) => {
        const result = await runBatchV1({
          apiKey: input.apiKey,
          annualReportContext: input.annualReportContext,
          config: input.config,
          modelConfig: input.modelConfig,
          rows: chunk,
          modelTier: input.config.policyPack.escalation.modelTier,
        });
        if (!result.ok) {
          return result;
        }

        return {
          ok: true as const,
          output: result,
        };
      },
    });

    for (const success of escalationPass.successes) {
      primaryModel = success.output.model;
      for (const decision of success.output.decisions) {
        decisionsByRowId.set(decision.rowId, decision);
      }
    }

    for (const failure of escalationPass.failures) {
      usedFallback = true;
      for (const row of failure.chunk) {
        const existingDecision = decisionsByRowId.get(row.rowId);
        if (!existingDecision) {
          decisionsByRowId.set(row.rowId, buildConservativeFallbackProposalV1(row));
          continue;
        }

        decisionsByRowId.set(row.rowId, {
          ...existingDecision,
          confidence: Math.min(existingDecision.confidence, 0.5),
          reviewFlag: true,
          policyRuleReference: "mapping.ai.fallback.escalation_unavailable.v1",
          rationale:
            "Escalation model unavailable after retries; retaining fast-pass decision with manual review required.",
        });
      }
    }
    if (escalationPass.telemetry.splitCount > 0) {
      usedFallback = true;
    }
  }

  return {
    ok: true,
    mapping: buildMappingDecisionSetV1({
      aiRun: parseAiRunMetadataV1({
        runId: input.generateId(),
        moduleId: input.config.moduleSpec.moduleId,
        moduleVersion: input.config.moduleSpec.moduleVersion,
        promptVersion: input.config.moduleSpec.promptVersion,
        policyVersion: input.config.policyPack.policyVersion,
        activePatchVersions: input.config.moduleSpec.policy.activePatchVersions,
        provider: "gemini",
        model: primaryModel,
        modelTier:
          escalatedRows.length > 0
            ? input.config.policyPack.escalation.modelTier
            : input.config.moduleSpec.runtime.modelTier,
        generatedAt: input.generatedAt,
        usedFallback,
      }),
      policyVersion: input.policyVersion,
      rows,
      decisionsByRowId,
    }),
  };
}
