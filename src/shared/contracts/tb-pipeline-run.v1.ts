import { z } from "zod";

import { UuidV4Schema } from "./common.v1";
import { MappingDecisionSetArtifactV1Schema } from "./mapping.v1";
import { ReconciliationResultPayloadV1Schema } from "./reconciliation.v1";
import {
  TrialBalanceFileTypeV1Schema,
  TrialBalanceNormalizedArtifactV1Schema,
} from "./trial-balance.v1";

/**
 * Canonical artifact types emitted by the trial-balance pipeline.
 */
export const TbPipelineArtifactTypeV1Schema = z.enum([
  "trial_balance",
  "reconciliation",
  "mapping",
]);

/**
 * Inferred TypeScript type for pipeline artifact types.
 */
export type TbPipelineArtifactTypeV1 = z.infer<
  typeof TbPipelineArtifactTypeV1Schema
>;

/**
 * Version reference for persisted immutable TB pipeline artifacts.
 */
export const TbPipelineArtifactVersionRefV1Schema = z
  .object({
    artifactType: TbPipelineArtifactTypeV1Schema,
    artifactId: z.string().trim().min(1),
    version: z.number().int().positive(),
    schemaVersion: z.string().trim().min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for pipeline artifact version references.
 */
export type TbPipelineArtifactVersionRefV1 = z.infer<
  typeof TbPipelineArtifactVersionRefV1Schema
>;

/**
 * Request payload for TB pipeline execution.
 */
export const ExecuteTrialBalancePipelineRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileBytesBase64: z.string().trim().min(1),
    fileType: TrialBalanceFileTypeV1Schema.optional(),
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for TB pipeline execution requests.
 */
export type ExecuteTrialBalancePipelineRequestV1 = z.infer<
  typeof ExecuteTrialBalancePipelineRequestV1Schema
>;

/**
 * TB pipeline success payload.
 */
export const TrialBalancePipelineRunPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("tb_pipeline_run_result_v1"),
    policyVersion: z.string().trim().min(1),
    artifacts: z
      .object({
        trialBalance: TbPipelineArtifactVersionRefV1Schema.extend({
          artifactType: z.literal("trial_balance"),
        }),
        reconciliation: TbPipelineArtifactVersionRefV1Schema.extend({
          artifactType: z.literal("reconciliation"),
        }),
        mapping: TbPipelineArtifactVersionRefV1Schema.extend({
          artifactType: z.literal("mapping"),
        }),
      })
      .strict(),
    trialBalance: TrialBalanceNormalizedArtifactV1Schema,
    reconciliation: ReconciliationResultPayloadV1Schema,
    mapping: MappingDecisionSetArtifactV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for TB pipeline success payloads.
 */
export type TrialBalancePipelineRunPayloadV1 = z.infer<
  typeof TrialBalancePipelineRunPayloadV1Schema
>;

/**
 * Structured TB pipeline error codes.
 */
export const TrialBalancePipelineErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "PARSE_FAILED",
  "RECONCILIATION_FAILED",
  "RECONCILIATION_BLOCKED",
  "MAPPING_FAILED",
  "PERSISTENCE_ERROR",
]);

/**
 * Inferred TypeScript type for TB pipeline error codes.
 */
export type TrialBalancePipelineErrorCodeV1 = z.infer<
  typeof TrialBalancePipelineErrorCodeV1Schema
>;

export const ClearTrialBalancePipelineDataRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    clearedByUserId: UuidV4Schema.optional(),
  })
  .strict();

export type ClearTrialBalancePipelineDataRequestV1 = z.infer<
  typeof ClearTrialBalancePipelineDataRequestV1Schema
>;

export const ClearTrialBalancePipelineDataSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    clearedArtifactTypes: z.array(TbPipelineArtifactTypeV1Schema),
    clearedDependentArtifactTypes: z.array(
      z.enum(["tax_adjustments", "tax_summary", "ink2_form", "export_package"]),
    ),
  })
  .strict();

export type ClearTrialBalancePipelineDataSuccessV1 = z.infer<
  typeof ClearTrialBalancePipelineDataSuccessV1Schema
>;

export const ClearTrialBalancePipelineDataFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum(["INPUT_INVALID", "WORKSPACE_NOT_FOUND", "PERSISTENCE_ERROR"]),
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

export type ClearTrialBalancePipelineDataFailureV1 = z.infer<
  typeof ClearTrialBalancePipelineDataFailureV1Schema
>;

export const ClearTrialBalancePipelineDataResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    ClearTrialBalancePipelineDataSuccessV1Schema,
    ClearTrialBalancePipelineDataFailureV1Schema,
  ],
);

export type ClearTrialBalancePipelineDataResultV1 = z.infer<
  typeof ClearTrialBalancePipelineDataResultV1Schema
>;

/**
 * Structured failure payload for TB pipeline execution.
 */
export const ExecuteTrialBalancePipelineFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: TrialBalancePipelineErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for TB pipeline failures.
 */
export type ExecuteTrialBalancePipelineFailureV1 = z.infer<
  typeof ExecuteTrialBalancePipelineFailureV1Schema
>;

/**
 * Structured success payload for TB pipeline execution.
 */
export const ExecuteTrialBalancePipelineSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    pipeline: TrialBalancePipelineRunPayloadV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for TB pipeline successes.
 */
export type ExecuteTrialBalancePipelineSuccessV1 = z.infer<
  typeof ExecuteTrialBalancePipelineSuccessV1Schema
>;

/**
 * Discriminated result contract for TB pipeline execution.
 */
export const ExecuteTrialBalancePipelineResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    ExecuteTrialBalancePipelineSuccessV1Schema,
    ExecuteTrialBalancePipelineFailureV1Schema,
  ],
);

/**
 * Inferred TypeScript type for TB pipeline execution results.
 */
export type ExecuteTrialBalancePipelineResultV1 = z.infer<
  typeof ExecuteTrialBalancePipelineResultV1Schema
>;

/**
 * Parses unknown input into TB pipeline execution requests.
 */
export function parseExecuteTrialBalancePipelineRequestV1(
  input: unknown,
): ExecuteTrialBalancePipelineRequestV1 {
  return ExecuteTrialBalancePipelineRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as TB pipeline execution requests.
 */
export function safeParseExecuteTrialBalancePipelineRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ExecuteTrialBalancePipelineRequestV1> {
  return ExecuteTrialBalancePipelineRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into TB pipeline execution results.
 */
export function parseExecuteTrialBalancePipelineResultV1(
  input: unknown,
): ExecuteTrialBalancePipelineResultV1 {
  return ExecuteTrialBalancePipelineResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as TB pipeline execution results.
 */
export function safeParseExecuteTrialBalancePipelineResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ExecuteTrialBalancePipelineResultV1> {
  return ExecuteTrialBalancePipelineResultV1Schema.safeParse(input);
}

export function parseClearTrialBalancePipelineDataRequestV1(
  input: unknown,
): ClearTrialBalancePipelineDataRequestV1 {
  return ClearTrialBalancePipelineDataRequestV1Schema.parse(input);
}

export function safeParseClearTrialBalancePipelineDataRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ClearTrialBalancePipelineDataRequestV1> {
  return ClearTrialBalancePipelineDataRequestV1Schema.safeParse(input);
}

export function parseClearTrialBalancePipelineDataResultV1(
  input: unknown,
): ClearTrialBalancePipelineDataResultV1 {
  return ClearTrialBalancePipelineDataResultV1Schema.parse(input);
}

export function safeParseClearTrialBalancePipelineDataResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ClearTrialBalancePipelineDataResultV1> {
  return ClearTrialBalancePipelineDataResultV1Schema.safeParse(input);
}
