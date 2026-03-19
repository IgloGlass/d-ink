import { z } from "zod";

import { UuidV4Schema } from "./common.v1";
import { MappingDecisionSetArtifactV1Schema } from "./mapping.v1";
import {
  ActiveMappingArtifactRefV1Schema,
  ExpectedActiveMappingRefV1Schema,
} from "./mapping-override.v1";

/**
 * Request payload for a follow-up AI enrichment pass over an already imported
 * deterministic mapping artifact.
 */
export const RunMappingAiEnrichmentRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveMapping: ExpectedActiveMappingRefV1Schema,
  })
  .strict();

export type RunMappingAiEnrichmentRequestV1 = z.infer<
  typeof RunMappingAiEnrichmentRequestV1Schema
>;

/**
 * Queue message for durable AI account-mapping reruns.
 *
 * The queue carries the full request payload so the worker consumer can
 * rehydrate the workflow without depending on the original HTTP request
 * lifecycle.
 */
export const MappingAiEnrichmentQueueMessageV1Schema = z
  .object({
    taskType: z.literal("mapping_ai_enrichment"),
    request: RunMappingAiEnrichmentRequestV1Schema,
    actorUserId: UuidV4Schema,
  })
  .strict();

export type MappingAiEnrichmentQueueMessageV1 = z.infer<
  typeof MappingAiEnrichmentQueueMessageV1Schema
>;

export function parseMappingAiEnrichmentQueueMessageV1(
  input: unknown,
): MappingAiEnrichmentQueueMessageV1 {
  return MappingAiEnrichmentQueueMessageV1Schema.parse(input);
}

/**
 * Successful enrichment outcomes for the two-phase mapping flow.
 */
export const MappingAiEnrichmentStatusV1Schema = z.enum([
  "accepted",
  "updated",
  "no_change",
  "stale_skipped",
]);

export type MappingAiEnrichmentStatusV1 = z.infer<
  typeof MappingAiEnrichmentStatusV1Schema
>;

/**
 * Failure codes for the async mapping enrichment workflow.
 */
export const MappingAiEnrichmentErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "TRIAL_BALANCE_NOT_FOUND",
  "RECONCILIATION_NOT_FOUND",
  "RECONCILIATION_BLOCKED",
  "MAPPING_NOT_FOUND",
  "PERSISTENCE_ERROR",
]);

export type MappingAiEnrichmentErrorCodeV1 = z.infer<
  typeof MappingAiEnrichmentErrorCodeV1Schema
>;

export const RunMappingAiEnrichmentFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: MappingAiEnrichmentErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

export type RunMappingAiEnrichmentFailureV1 = z.infer<
  typeof RunMappingAiEnrichmentFailureV1Schema
>;

export const RunMappingAiEnrichmentSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    status: MappingAiEnrichmentStatusV1Schema,
    activeBefore: ActiveMappingArtifactRefV1Schema,
    activeAfter: ActiveMappingArtifactRefV1Schema,
    mapping: MappingDecisionSetArtifactV1Schema.optional(),
    message: z.string().trim().min(1),
  })
  .strict();

export type RunMappingAiEnrichmentSuccessV1 = z.infer<
  typeof RunMappingAiEnrichmentSuccessV1Schema
>;

export const RunMappingAiEnrichmentResultV1Schema = z.discriminatedUnion("ok", [
  RunMappingAiEnrichmentSuccessV1Schema,
  RunMappingAiEnrichmentFailureV1Schema,
]);

export type RunMappingAiEnrichmentResultV1 = z.infer<
  typeof RunMappingAiEnrichmentResultV1Schema
>;

export function parseRunMappingAiEnrichmentRequestV1(
  input: unknown,
): RunMappingAiEnrichmentRequestV1 {
  return RunMappingAiEnrichmentRequestV1Schema.parse(input);
}

export function safeParseRunMappingAiEnrichmentRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, RunMappingAiEnrichmentRequestV1> {
  return RunMappingAiEnrichmentRequestV1Schema.safeParse(input);
}

export function parseRunMappingAiEnrichmentResultV1(
  input: unknown,
): RunMappingAiEnrichmentResultV1 {
  return RunMappingAiEnrichmentResultV1Schema.parse(input);
}

export function safeParseRunMappingAiEnrichmentResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, RunMappingAiEnrichmentResultV1> {
  return RunMappingAiEnrichmentResultV1Schema.safeParse(input);
}
