import { parseAiRunMetadataV1, type AiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import {
  TaxAdjustmentAiProposalResultV1Schema,
  type TaxAdjustmentAiProposalDecisionV1,
} from "../../../../shared/contracts/tax-adjustment-ai.v1";
import type { AnnualReportDownstreamTaxContextV1 } from "../../../../shared/contracts/annual-report-tax-context.v1";
import type { MappingDecisionSetPayloadV1 } from "../../../../shared/contracts/mapping.v1";
import type { GeminiModelConfigV1 } from "../../providers/gemini-client.v1";
import { generateGeminiStructuredOutputV1 } from "../../providers/gemini-client.v1";
import type { AiModuleSpecV1 } from "../../runtime/module-config.v1";
import { executeChunksWithRetryAndSplitV1 } from "../../runtime/chunk-retry.v1";

type CandidateRowV1 = {
  sourceMappingDecisionId: string;
  sourceAccountNumber: string;
  accountName: string;
  selectedCategoryCode: string;
  closingBalance: number;
  mappingReviewFlag: boolean;
};

export type TaxAdjustmentModuleRuntimeConfigV1<TPolicy> = {
  moduleSpec: AiModuleSpecV1;
  policyPack: TPolicy;
};

type TaxAdjustmentPolicyRuntimeV1 = {
  batching: {
    maxRowsPerBatch: number;
    minRowsPerChunk: number;
  };
  retries: {
    backoffMs: number;
    maxAttempts: number;
  };
  timeouts: {
    requestTimeoutMs: number;
  };
  policyVersion: string;
};

export type ExecuteTaxAdjustmentSubmoduleInputV1<TPolicy> = {
  apiKey?: string;
  annualReportTaxContext: AnnualReportDownstreamTaxContextV1;
  candidates: CandidateRowV1[];
  config: TaxAdjustmentModuleRuntimeConfigV1<TPolicy & TaxAdjustmentPolicyRuntimeV1>;
  generateId: () => string;
  generatedAt: string;
  modelConfig: GeminiModelConfigV1;
  systemPrompt: string;
  userPrompt: string;
};

export type ExecuteTaxAdjustmentSubmoduleResultV1 =
  | {
      ok: true;
      aiRun?: AiRunMetadataV1;
      decisions: TaxAdjustmentAiProposalDecisionV1[];
      failedCandidates: CandidateRowV1[];
      telemetry: {
        splitCount: number;
        totalAttempts: number;
      };
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    };

export function projectTaxAdjustmentCandidatesV1(input: {
  mapping: MappingDecisionSetPayloadV1;
  allowedCategoryCodes: string[];
  closingBalanceBySourceAccount: Map<string, number>;
}): CandidateRowV1[] {
  return input.mapping.decisions
    .filter((decision) =>
      input.allowedCategoryCodes.includes(decision.selectedCategory.code),
    )
    .map((decision) => ({
      sourceMappingDecisionId: decision.id,
      sourceAccountNumber: decision.sourceAccountNumber,
      accountName: decision.accountName,
      selectedCategoryCode: decision.selectedCategory.code,
      closingBalance:
        input.closingBalanceBySourceAccount.get(decision.sourceAccountNumber) ?? 0,
      mappingReviewFlag: decision.reviewFlag,
    }));
}

function chunkRowsV1(rows: CandidateRowV1[], chunkSize: number): CandidateRowV1[][] {
  const chunks: CandidateRowV1[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function splitChunkV1(input: {
  minRowsPerChunk: number;
  rows: CandidateRowV1[];
}): [CandidateRowV1[], CandidateRowV1[]] | null {
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

export async function executeTaxAdjustmentSubmoduleV1<TPolicy>(
  input: ExecuteTaxAdjustmentSubmoduleInputV1<TPolicy>,
): Promise<ExecuteTaxAdjustmentSubmoduleResultV1> {
  const candidateChunks = chunkRowsV1(
    input.candidates,
    input.config.policyPack.batching.maxRowsPerBatch,
  );
  const chunkedResult = await executeChunksWithRetryAndSplitV1({
    chunks: candidateChunks,
    maxAttempts: input.config.policyPack.retries.maxAttempts,
    backoffMs: input.config.policyPack.retries.backoffMs,
    splitChunk: (chunk) =>
      splitChunkV1({
        rows: chunk,
        minRowsPerChunk: input.config.policyPack.batching.minRowsPerChunk,
      }),
    executeChunk: async (chunk) => {
      const result = await generateGeminiStructuredOutputV1({
        apiKey: input.apiKey,
        modelConfig: input.modelConfig,
        request: {
          modelTier: input.config.moduleSpec.runtime.modelTier,
          responseSchema: TaxAdjustmentAiProposalResultV1Schema,
          systemInstruction: input.systemPrompt,
          timeoutMs: input.config.policyPack.timeouts.requestTimeoutMs,
          userInstruction: [
            input.userPrompt,
            "Annual report context:",
            JSON.stringify(input.annualReportTaxContext, null, 2),
            "Candidate mapping rows:",
            JSON.stringify(chunk, null, 2),
          ].join("\n\n"),
        },
      });
      if (!result.ok) {
        return result;
      }

      const output = result.output as {
        decisions: TaxAdjustmentAiProposalDecisionV1[];
      };

      return {
        ok: true as const,
        output: {
          decisions: output.decisions,
          model: result.model,
        },
      };
    },
  });

  const decisions: TaxAdjustmentAiProposalDecisionV1[] = [];
  let modelUsed: string | null = null;
  let usedFallback = false;

  for (const success of chunkedResult.successes) {
    modelUsed = success.output.model;
    const emittedByMappingDecisionId = new Set(
      success.output.decisions.map((decision) => decision.sourceMappingDecisionId),
    );
    decisions.push(...success.output.decisions);
    for (const candidate of success.chunk) {
      if (!emittedByMappingDecisionId.has(candidate.sourceMappingDecisionId)) {
        usedFallback = true;
      }
    }
  }
  if (chunkedResult.failures.length > 0 || chunkedResult.telemetry.splitCount > 0) {
    usedFallback = true;
  }

  return {
    ok: true,
    decisions,
    failedCandidates: chunkedResult.failures.flatMap((failure) => failure.chunk),
    telemetry: chunkedResult.telemetry,
    aiRun:
      modelUsed === null
        ? undefined
        : parseAiRunMetadataV1({
            runId: input.generateId(),
            moduleId: input.config.moduleSpec.moduleId,
            moduleVersion: input.config.moduleSpec.moduleVersion,
            promptVersion: input.config.moduleSpec.promptVersion,
            policyVersion: input.config.policyPack.policyVersion,
            activePatchVersions: input.config.moduleSpec.policy.activePatchVersions,
            provider: "gemini",
            model: modelUsed,
            modelTier: input.config.moduleSpec.runtime.modelTier,
            generatedAt: input.generatedAt,
            usedFallback,
          }),
  };
}
