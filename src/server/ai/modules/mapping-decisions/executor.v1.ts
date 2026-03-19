import {
  getSilverfinTaxCategoryByCodeV1,
  listSilverfinTaxCategoriesV1,
  type MappingDecisionSetPayloadV2,
  parseMappingExecutionMetadataV1,
  type SilverfinTaxCategoryCodeV1,
} from "../../../../shared/contracts/mapping.v1";
import type { AnnualReportMappingContextV1 } from "../../../../shared/contracts/annual-report-tax-context.v1";
import {
  MappingAiProposalProviderResultV1Schema,
  type MappingAiProposalDecisionV1,
  parseMappingAiProposalResultV1,
} from "../../../../shared/contracts/mapping-ai-proposal.v1";
import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import {
  buildTrialBalanceRowIdentityV1,
  buildTrialBalanceRowKeyV1,
  getTrialBalanceRowBalanceValueV1,
  type TrialBalanceNormalizedArtifactV1,
} from "../../../../shared/contracts/trial-balance.v1";
import type { Env } from "../../../../shared/types/env";
import { generateAiStructuredOutputV1 } from "../../providers/ai-provider-client.v1";
import type { AiModelConfigV1 } from "../../providers/ai-provider-client.v1";
import {
  executeChunksWithRetryAndSplitV1,
  isRetryableAiErrorV1,
} from "../../runtime/chunk-retry.v1";
import { resolveConservativeFallbackCategoryCodeV1 } from "../../../mapping/conservative-fallback.v1";
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
  rowIndex: number;
  source: {
    sheetName: string;
    rowNumber: number;
  };
  sourceAccountNumber: string;
  accountNumber: string;
  accountName: string;
  openingBalance: number | null;
  closingBalance: number | null;
  localContext: {
    previousAccountName: string | null;
    previousAccountNumber: string | null;
    nextAccountName: string | null;
    nextAccountNumber: string | null;
  };
};

type MappingAnnualReportLineageV1 = {
  sourceExtractionArtifactId: string;
  sourceTaxAnalysisArtifactId?: string;
};

export type ExecuteMappingDecisionsInputV1 = {
  apiKey?: string;
  env?: Env;
  annualReportContext?: AnnualReportMappingContextV1;
  annualReportLineage?: MappingAnnualReportLineageV1;
  config: MappingDecisionsRuntimeConfigV1;
  executionBudgetMs?: number;
  generateId: () => string;
  generatedAt: string;
  modelConfig: AiModelConfigV1;
  policyVersion: string;
  trialBalance: TrialBalanceNormalizedArtifactV1;
};

export type ExecuteMappingDecisionsResultV1 =
  | {
      ok: true;
      mapping: MappingDecisionSetPayloadV2;
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

function resolveEffectiveBatchSizeV1(config: MappingDecisionsRuntimeConfigV1) {
  // Hard guardrail: never exceed 40 rows per model call even if config drifts.
  return Math.min(config.policyPack.batching.maxRowsPerBatch, 40);
}

function buildRowsV1(
  trialBalance: TrialBalanceNormalizedArtifactV1,
): MappingRowProjectionV1[] {
  return trialBalance.rows.map((row, index) => ({
    rowId: buildTrialBalanceRowKeyV1(row.source),
    rowIndex: index + 1,
    source: {
      sheetName: row.source.sheetName,
      rowNumber: row.source.rowNumber,
    },
    sourceAccountNumber: row.sourceAccountNumber,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    openingBalance: getTrialBalanceRowBalanceValueV1(row, "opening_balance"),
    closingBalance: getTrialBalanceRowBalanceValueV1(row, "closing_balance"),
    localContext: {
      previousAccountName: trialBalance.rows[index - 1]?.accountName ?? null,
      previousAccountNumber:
        trialBalance.rows[index - 1]?.accountNumber ?? null,
      nextAccountName: trialBalance.rows[index + 1]?.accountName ?? null,
      nextAccountNumber: trialBalance.rows[index + 1]?.accountNumber ?? null,
    },
  }));
}

const MAX_PROMPT_ARRAY_ITEMS_V1 = 24;
const MAX_PROMPT_STRING_CHARS_V1 = 280;

function compactPromptValueV1(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 6) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= MAX_PROMPT_STRING_CHARS_V1) {
      return normalized;
    }
    return `${normalized.slice(0, MAX_PROMPT_STRING_CHARS_V1)}...`;
  }

  if (Array.isArray(value)) {
    const compacted = value
      .slice(0, MAX_PROMPT_ARRAY_ITEMS_V1)
      .map((item) => compactPromptValueV1(item, depth + 1))
      .filter((item) => item !== undefined);
    return compacted;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const compactedEntries: Array<[string, unknown]> = [];
    for (const [key, entryValue] of entries) {
      if (key === "evidence") {
        continue;
      }
      const compactedValue = compactPromptValueV1(entryValue, depth + 1);
      if (compactedValue !== undefined) {
        compactedEntries.push([key, compactedValue]);
      }
    }

    return Object.fromEntries(compactedEntries);
  }

  return value;
}

function compactAnnualReportContextForPromptV1(
  annualReportContext?: AnnualReportMappingContextV1,
): unknown {
  if (!annualReportContext) {
    return null;
  }

  return compactPromptValueV1(annualReportContext);
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

  const annualReportContextSnapshot = compactAnnualReportContextForPromptV1(
    input.annualReportContext,
  );

  return [
    MAPPING_DECISIONS_USER_PROMPT_V1,
    "Classification strategy:",
    JSON.stringify(
      input.annualReportContext
        ? {
            mode: "ai_primary",
            annualReportContextAvailable: true,
            inferStatementTypeBeforeCategorySelection: true,
            preferSemanticSignalsOverAccountNumbers: true,
          }
        : {
            mode: "ai_primary",
            annualReportContextAvailable: false,
            inferStatementTypeBeforeCategorySelection: true,
            preferSemanticSignalsOverAccountNumbers: true,
          },
      null,
      2,
    ),
    "Category catalog:",
    JSON.stringify(categoryCatalog, null, 2),
    "Annual report mapping context:",
    JSON.stringify(annualReportContextSnapshot, null, 2),
    "Rows to classify:",
    JSON.stringify(input.rows, null, 2),
  ].join("\n\n");
}

async function runBatchV1(input: {
  apiKey?: string;
  env?: Env;
  annualReportContext?: AnnualReportMappingContextV1;
  config: MappingDecisionsRuntimeConfigV1;
  modelConfig: AiModelConfigV1;
  rows: MappingRowProjectionV1[];
  modelTier: "fast" | "thinking";
  signal?: AbortSignal;
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
  const result = await generateAiStructuredOutputV1({
    env: input.env,
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    request: {
      modelTier: input.modelTier,
      responseSchema: MappingAiProposalProviderResultV1Schema,
      systemInstruction: MAPPING_DECISIONS_SYSTEM_PROMPT_V1,
      timeoutMs:
        input.modelTier === "thinking"
          ? input.config.policyPack.timeouts.thinkingRequestTimeoutMs
          : input.config.policyPack.timeouts.requestTimeoutMs,
      signal: input.signal,
      userInstruction: buildInstructionV1({
        annualReportContext: input.annualReportContext,
        rows: input.rows,
      }),
    },
  });

  if (!result.ok) {
    return result;
  }

  const output = parseMappingAiProposalResultV1(result.output);

  return {
    ok: true,
    decisions: output.decisions,
    model: result.model,
  };
}

async function runBatchWithTierFallbackV1(input: {
  apiKey?: string;
  env?: Env;
  annualReportContext?: AnnualReportMappingContextV1;
  config: MappingDecisionsRuntimeConfigV1;
  fallbackTier?: "fast" | "thinking";
  modelConfig: AiModelConfigV1;
  preferredTier: "fast" | "thinking";
  rows: MappingRowProjectionV1[];
  signal?: AbortSignal;
}): Promise<
  | {
      ok: true;
      decisions: MappingAiProposalDecisionV1[];
      model: string;
      usedTierFallback: boolean;
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
      usedTierFallback: boolean;
    }
> {
  const preferredResult = await runBatchV1({
    apiKey: input.apiKey,
    env: input.env,
    annualReportContext: input.annualReportContext,
    config: input.config,
    modelConfig: input.modelConfig,
    rows: input.rows,
    modelTier: input.preferredTier,
    signal: input.signal,
  });
  if (preferredResult.ok) {
    return {
      ...preferredResult,
      usedTierFallback: false,
    };
  }

  if (
    !input.fallbackTier ||
    input.fallbackTier === input.preferredTier ||
    !isRetryableAiErrorV1(preferredResult.error)
  ) {
    return {
      ...preferredResult,
      usedTierFallback: false,
    };
  }

  const fallbackResult = await runBatchV1({
    apiKey: input.apiKey,
    env: input.env,
    annualReportContext: input.annualReportContext,
    config: input.config,
    modelConfig: input.modelConfig,
    rows: input.rows,
    modelTier: input.fallbackTier,
    signal: input.signal,
  });
  if (!fallbackResult.ok) {
    return {
      ...fallbackResult,
      usedTierFallback: true,
    };
  }

  return {
    ...fallbackResult,
    usedTierFallback: true,
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

function isFallbackPolicyReferenceV1(policyRuleReference: string): boolean {
  return policyRuleReference.startsWith("mapping.ai.fallback.");
}

function normalizeTextV1(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeywordV1(
  normalized: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) =>
    normalized.includes(normalizeTextV1(keyword)),
  );
}

function shouldForceNonTaxSensitiveBalanceForAccumulatedAssetDepreciationV1(input: {
  row: MappingRowProjectionV1;
  proposal: MappingAiProposalDecisionV1;
}): boolean {
  const selectedCategory = getSilverfinTaxCategoryByCodeV1(
    input.proposal.selectedCategoryCode as SilverfinTaxCategoryCodeV1,
  );
  if (selectedCategory.statementType !== "balance_sheet") {
    return false;
  }

  const normalizedName = normalizeTextV1(input.row.accountName);
  const hasAccumulatedDepreciationSignal = hasAnyKeywordV1(normalizedName, [
    "ackumulerad avskrivning",
    "ackumulerade avskrivningar",
    "accumulated depreciation",
  ]);
  if (!hasAccumulatedDepreciationSignal) {
    return false;
  }

  return hasAnyKeywordV1(normalizedName, [
    "byggnad",
    "byggnader",
    "building",
    "markanlaggning",
    "markanläggning",
    "land improvement",
    "leasehold",
    "hyrd lokal",
    "annans fastighet",
    "forbattringsutgift",
    "förbättringsutgift",
  ]);
}

function applyProposalGuardrailsV1(input: {
  row: MappingRowProjectionV1;
  proposal: MappingAiProposalDecisionV1;
}): MappingAiProposalDecisionV1 {
  if (
    shouldForceNonTaxSensitiveBalanceForAccumulatedAssetDepreciationV1(input)
  ) {
    return {
      ...input.proposal,
      selectedCategoryCode: "100000",
      confidence: Math.min(input.proposal.confidence, 0.82),
      reviewFlag: true,
      policyRuleReference:
        "mapping.ai.guardrail.bs.building_land_leasehold_accumulated_depreciation.non_tax_sensitive.v1",
      rationale: `${input.proposal.rationale} Guardrail applied: balance-sheet accumulated depreciation for buildings, land improvements, or leasehold improvements maps to Non-tax sensitive - Balance because the depreciation is recognized in the income statement.`,
    };
  }

  return input.proposal;
}

function buildAnnualReportContextEvidenceV1(
  proposal: MappingAiProposalDecisionV1,
) {
  return proposal.annualReportContextReferences.map((reference) => ({
    type: "annual_report_context" as const,
    reference: `${reference.area}:${reference.reference}`,
    snippet: reference.reference,
    matchedValue: reference.area,
  }));
}

function buildMappingDecisionSetV1(input: {
  aiRun: MappingDecisionSetPayloadV2["aiRun"];
  annualReportContextAvailable: boolean;
  annualReportLineage?: MappingAnnualReportLineageV1;
  degradedDiagnostics?: string[];
  policyVersion: string;
  rows: MappingRowProjectionV1[];
  decisionsByRowId: Map<string, MappingAiProposalDecisionV1>;
}): MappingDecisionSetPayloadV2 {
  const decisions = input.rows.map((row) => {
    const originalProposal =
      input.decisionsByRowId.get(row.rowId) ??
      buildConservativeFallbackProposalV1(row);
    const proposal = applyProposalGuardrailsV1({
      row,
      proposal: originalProposal,
    });
    const proposedCategory = getSilverfinTaxCategoryByCodeV1(
      originalProposal.selectedCategoryCode as SilverfinTaxCategoryCodeV1,
    );
    const selectedCategory = getSilverfinTaxCategoryByCodeV1(
      proposal.selectedCategoryCode as SilverfinTaxCategoryCodeV1,
    );

    return {
      id: row.rowId,
      trialBalanceRowIdentity: buildTrialBalanceRowIdentityV1({
        sheetName: row.source.sheetName,
        rowNumber: row.source.rowNumber,
      }),
      accountNumber: row.accountNumber,
      sourceAccountNumber: row.sourceAccountNumber,
      accountName: row.accountName,
      openingBalance: row.openingBalance ?? undefined,
      closingBalance: row.closingBalance ?? undefined,
      proposedCategory,
      selectedCategory,
      confidence: proposal.confidence,
      evidence: [
        {
          type: "tb_row" as const,
          reference: row.rowId,
          snippet: `${row.sourceAccountNumber} ${row.accountName}`,
        },
        ...buildAnnualReportContextEvidenceV1(proposal),
      ],
      policyRuleReference: proposal.policyRuleReference,
      reviewFlag: proposal.reviewFlag,
      status: "proposed" as const,
      source: "ai" as const,
      aiTrace: {
        rationale: proposal.rationale,
        annualReportContextReferences: proposal.annualReportContextReferences,
        sourceExtractionArtifactId:
          input.annualReportLineage?.sourceExtractionArtifactId,
        sourceTaxAnalysisArtifactId:
          input.annualReportLineage?.sourceTaxAnalysisArtifactId,
      },
    };
  });

  const fallbackDecisions = decisions.filter(
    (decision) => decision.policyRuleReference.startsWith("mapping.ai.fallback."),
  ).length;
  const degradedReasonDiagnostics = Array.from(
    new Set((input.degradedDiagnostics ?? []).map((entry) => entry.trim())),
  ).filter((entry) => entry.length > 0);
  const degradedReasonDetail =
    degradedReasonDiagnostics.length > 0
      ? ` Diagnostics: ${degradedReasonDiagnostics
          .slice(0, 3)
          .join(" | ")
          .slice(0, 420)}.`
      : "";

  return {
    schemaVersion: "mapping_decisions_v2",
    policyVersion: input.policyVersion,
    aiRun: input.aiRun,
    executionMetadata: parseMappingExecutionMetadataV1({
      requestedStrategy: "ai_primary",
      actualStrategy: "ai",
      degraded: input.aiRun?.usedFallback ?? false,
      degradedReasonCode:
        input.aiRun?.usedFallback === true ? "ai_chunk_fallback" : undefined,
      degradedReason:
        input.aiRun?.usedFallback === true
          ? `AI mapping required chunk splitting or conservative row-level fallback for part of the run.${degradedReasonDetail}`
          : undefined,
      annualReportContextAvailable: input.annualReportContextAvailable,
      usedAiRunFallback: input.aiRun?.usedFallback ?? false,
    }),
    summary: {
      totalRows: decisions.length,
      deterministicDecisions: 0,
      manualReviewRequired: decisions.filter((decision) => decision.reviewFlag)
        .length,
      fallbackDecisions,
      matchedByAccountNumber: 0,
      matchedByAccountName: 0,
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
    selectedCategoryCode: resolveConservativeFallbackCategoryCodeV1({
      accountName: row.accountName,
      openingBalance: row.openingBalance,
      closingBalance: row.closingBalance,
    }),
    confidence: 0.25,
    reviewFlag: true,
    policyRuleReference: "mapping.ai.fallback.chunk_retry_exhausted.v1",
    rationale:
      "AI classification fallback used after retry/split exhaustion for this row chunk.",
    annualReportContextReferences: [],
  };
}

function buildExecutionBudgetErrorV1(input: {
  error: unknown;
  executionBudgetMs?: number;
}): ExecuteMappingDecisionsResultV1 {
  return {
    ok: false,
    error: {
      code: "MODEL_EXECUTION_FAILED",
      message:
        input.error instanceof Error
          ? input.error.message
          : "Mapping decisions AI execution failed.",
      context: {
        executionBudgetMs: input.executionBudgetMs,
      },
    },
  };
}

async function withExecutionBudgetV1<TValue>(input: {
  label: string;
  operation: (signal: AbortSignal) => Promise<TValue>;
  timeoutMs?: number;
}): Promise<TValue> {
  if (!input.timeoutMs) {
    return input.operation(new AbortController().signal);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      input.operation(controller.signal),
      new Promise<TValue>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort(
            new Error(`${input.label} timed out after ${input.timeoutMs}ms.`),
          );
          reject(
            new Error(`${input.label} timed out after ${input.timeoutMs}ms.`),
          );
        }, input.timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function executeMappingDecisionsModelV1(
  input: ExecuteMappingDecisionsInputV1,
): Promise<ExecuteMappingDecisionsResultV1> {
  if (input.config.policyPack.classificationStrategy.mode !== "ai_primary") {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message:
          "Mapping decisions module is configured with a non-supported classification strategy.",
        context: {
          mode: input.config.policyPack.classificationStrategy.mode,
        },
      },
    };
  }

  try {
    return await withExecutionBudgetV1({
      label: "Mapping decisions AI execution",
      timeoutMs: input.executionBudgetMs,
      operation: async (signal) => {
        const rows = buildRowsV1(input.trialBalance);
        const effectiveBatchSize = resolveEffectiveBatchSizeV1(input.config);
        const batches = chunkRowsV1(
          rows,
          effectiveBatchSize,
        );
        const decisionsByRowId = new Map<string, MappingAiProposalDecisionV1>();
        const omittedRowsFromInitialPass: MappingRowProjectionV1[] = [];
        const degradedDiagnostics = new Set<string>();
        let primaryModel = input.modelConfig.fastModel;
        let usedFallback = false;

        const initialPass = await executeChunksWithRetryAndSplitV1({
          chunks: batches,
          maxAttempts: input.config.policyPack.retries.maxAttempts,
          backoffMs: input.config.policyPack.retries.backoffMs,
          shouldRetryError: (error) =>
            !error.context.aborted && isRetryableAiErrorV1(error),
          splitChunk: (chunk) =>
              splitRowsForRetryV1({
                rows: chunk,
                minRowsPerChunk: input.config.policyPack.batching.minRowsPerChunk,
              }),
            executeChunk: async (chunk) => {
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
              const result = await runBatchWithTierFallbackV1({
                apiKey: input.apiKey,
                annualReportContext: input.annualReportContext,
                config: input.config,
                modelConfig: input.modelConfig,
                rows: chunk,
                preferredTier: input.config.moduleSpec.runtime.modelTier,
                fallbackTier: input.config.policyPack.escalation.modelTier,
                signal,
              });
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
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
          if (success.output.usedTierFallback) {
            degradedDiagnostics.add(
              "Model-tier fallback applied for at least one batch.",
            );
          }
          for (const decision of success.output.decisions) {
            decisionsByRowId.set(decision.rowId, decision);
          }
          for (const row of success.chunk) {
            if (!decisionsByRowId.has(row.rowId)) {
              omittedRowsFromInitialPass.push(row);
            }
          }
        }

        for (const failure of initialPass.failures) {
          usedFallback = true;
          degradedDiagnostics.add(
            `Initial pass failure: ${failure.error.code} ${failure.error.message}`,
          );
          for (const row of failure.chunk) {
            if (decisionsByRowId.has(row.rowId)) {
              continue;
            }
            decisionsByRowId.set(
              row.rowId,
              buildConservativeFallbackProposalV1(row),
            );
          }
        }
        if (initialPass.telemetry.splitCount > 0) {
          usedFallback = true;
          degradedDiagnostics.add(
            `Initial pass chunk splits: ${initialPass.telemetry.splitCount}.`,
          );
        }

        if (omittedRowsFromInitialPass.length > 0) {
          degradedDiagnostics.add(
            "At least one model response omitted requested rows.",
          );
          const omittedRowRepairPass = await executeChunksWithRetryAndSplitV1({
            chunks: chunkRowsV1(omittedRowsFromInitialPass, 1),
            maxAttempts: input.config.policyPack.retries.maxAttempts,
            backoffMs: input.config.policyPack.retries.backoffMs,
            shouldRetryError: (error) =>
              !error.context.aborted && isRetryableAiErrorV1(error),
            splitChunk: () => null,
            executeChunk: async (chunk) => {
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
              const result = await runBatchWithTierFallbackV1({
                apiKey: input.apiKey,
                annualReportContext: input.annualReportContext,
                config: input.config,
                modelConfig: input.modelConfig,
                rows: chunk,
                preferredTier: input.config.moduleSpec.runtime.modelTier,
                fallbackTier: input.config.policyPack.escalation.modelTier,
                signal,
              });
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
              if (!result.ok) {
                return result;
              }

              return {
                ok: true as const,
                output: result,
              };
            },
          });

          for (const success of omittedRowRepairPass.successes) {
            primaryModel = success.output.model;
            if (success.output.usedTierFallback) {
              degradedDiagnostics.add(
                "Model-tier fallback applied during omitted-row repair.",
              );
            }
            for (const decision of success.output.decisions) {
              decisionsByRowId.set(decision.rowId, decision);
            }
          }

          for (const failure of omittedRowRepairPass.failures) {
            usedFallback = true;
            degradedDiagnostics.add(
              `Omitted-row repair failure: ${failure.error.code} ${failure.error.message}`,
            );
            for (const row of failure.chunk) {
              if (decisionsByRowId.has(row.rowId)) {
                continue;
              }
              decisionsByRowId.set(
                row.rowId,
                buildConservativeFallbackProposalV1(row),
              );
            }
          }
        }

        const escalatedRows = rows.filter((row) => {
          const decision = decisionsByRowId.get(row.rowId);
          return (
            decision &&
            !isFallbackPolicyReferenceV1(decision.policyRuleReference) &&
            shouldEscalateDecisionV1({
              config: input.config,
              decision,
            })
          );
        });

        if (escalatedRows.length > 0) {
          const escalatedBatches = chunkRowsV1(
            escalatedRows,
            effectiveBatchSize,
          );
          const escalationPass = await executeChunksWithRetryAndSplitV1({
            chunks: escalatedBatches,
            maxAttempts: input.config.policyPack.retries.maxAttempts,
            backoffMs: input.config.policyPack.retries.backoffMs,
            shouldRetryError: (error) =>
              !error.context.aborted && isRetryableAiErrorV1(error),
            splitChunk: (chunk) =>
              splitRowsForRetryV1({
                rows: chunk,
                minRowsPerChunk: input.config.policyPack.batching.minRowsPerChunk,
              }),
            executeChunk: async (chunk) => {
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
              const result = await runBatchWithTierFallbackV1({
                apiKey: input.apiKey,
                annualReportContext: input.annualReportContext,
                config: input.config,
                modelConfig: input.modelConfig,
                rows: chunk,
                preferredTier: input.config.policyPack.escalation.modelTier,
                fallbackTier: input.config.moduleSpec.runtime.modelTier,
                signal,
              });
              if (signal.aborted) {
                return {
                  ok: false as const,
                  error: {
                    code: "MODEL_EXECUTION_FAILED" as const,
                    message: "Mapping decisions execution was aborted.",
                    context: { aborted: true },
                  },
                };
              }
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
            if (success.output.usedTierFallback) {
              degradedDiagnostics.add(
                "Model-tier fallback applied for at least one escalation batch.",
              );
            }
            for (const decision of success.output.decisions) {
              decisionsByRowId.set(decision.rowId, decision);
            }
          }

          for (const failure of escalationPass.failures) {
            usedFallback = true;
            degradedDiagnostics.add(
              `Escalation failure: ${failure.error.code} ${failure.error.message}`,
            );
            for (const row of failure.chunk) {
              const existingDecision = decisionsByRowId.get(row.rowId);
              if (!existingDecision) {
                decisionsByRowId.set(
                  row.rowId,
                  buildConservativeFallbackProposalV1(row),
                );
                continue;
              }

              decisionsByRowId.set(row.rowId, {
                ...existingDecision,
                confidence: Math.min(existingDecision.confidence, 0.5),
                reviewFlag: true,
                policyRuleReference:
                  "mapping.ai.fallback.escalation_unavailable.v1",
                rationale:
                  "Escalation model unavailable after retries; retaining fast-pass decision with manual review required.",
              });
            }
          }
          if (escalationPass.telemetry.splitCount > 0) {
            usedFallback = true;
            degradedDiagnostics.add(
              `Escalation chunk splits: ${escalationPass.telemetry.splitCount}.`,
            );
          }
        }

        return {
          ok: true as const,
          mapping: buildMappingDecisionSetV1({
            aiRun: parseAiRunMetadataV1({
              runId: input.generateId(),
              moduleId: input.config.moduleSpec.moduleId,
              moduleVersion: input.config.moduleSpec.moduleVersion,
              promptVersion: input.config.moduleSpec.promptVersion,
              policyVersion: input.config.policyPack.policyVersion,
              activePatchVersions:
                input.config.moduleSpec.policy.activePatchVersions,
              provider: input.env?.AI_PROVIDER === "openai" ? "openai" : "qwen",
              model: primaryModel,
              modelTier:
                escalatedRows.length > 0
                  ? input.config.policyPack.escalation.modelTier
                  : input.config.moduleSpec.runtime.modelTier,
              generatedAt: input.generatedAt,
              usedFallback,
            }),
            annualReportContextAvailable:
              input.annualReportContext !== undefined,
            annualReportLineage: input.annualReportLineage,
            degradedDiagnostics: Array.from(degradedDiagnostics),
            policyVersion: input.policyVersion,
            rows,
            decisionsByRowId,
          }),
        };
      },
    });
  } catch (error) {
    return buildExecutionBudgetErrorV1({
      error,
      executionBudgetMs: input.executionBudgetMs,
    });
  }
}
