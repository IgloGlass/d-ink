import { z } from "zod";

import { UuidV4Schema } from "./common.v1";
import {
  MappingDecisionSetArtifactV1Schema,
  SilverfinTaxCategoryCodeV1Schema,
} from "./mapping.v1";

/**
 * Supported mapping preference scopes for V1 endpoints.
 *
 * `group` is intentionally deferred and excluded from this contract.
 */
export const MappingPreferenceScopeV1Schema = z.enum(["return", "user"]);

/**
 * Inferred TypeScript type for mapping preference scopes.
 */
export type MappingPreferenceScopeV1 = z.infer<
  typeof MappingPreferenceScopeV1Schema
>;

/**
 * Active mapping artifact reference returned by override/read APIs.
 */
export const ActiveMappingArtifactRefV1Schema = z
  .object({
    artifactId: z.string().trim().min(1),
    version: z.number().int().positive(),
    schemaVersion: z.string().trim().min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for active mapping artifact references.
 */
export type ActiveMappingArtifactRefV1 = z.infer<
  typeof ActiveMappingArtifactRefV1Schema
>;

/**
 * Request payload for fetching the active mapping decision artifact.
 */
export const GetActiveMappingDecisionsRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for active mapping read requests.
 */
export type GetActiveMappingDecisionsRequestV1 = z.infer<
  typeof GetActiveMappingDecisionsRequestV1Schema
>;

/**
 * Override instruction item for manual category corrections.
 */
export const MappingOverrideInstructionV1Schema = z
  .object({
    decisionId: z.string().trim().min(1),
    selectedCategoryCode: SilverfinTaxCategoryCodeV1Schema,
    scope: MappingPreferenceScopeV1Schema,
    reason: z.string().trim().min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for manual override instructions.
 */
export type MappingOverrideInstructionV1 = z.infer<
  typeof MappingOverrideInstructionV1Schema
>;

/**
 * Compare-and-set guard for override writes.
 */
export const ExpectedActiveMappingRefV1Schema = z
  .object({
    artifactId: z.string().trim().min(1),
    version: z.number().int().positive(),
  })
  .strict();

/**
 * Inferred TypeScript type for override compare-and-set expectations.
 */
export type ExpectedActiveMappingRefV1 = z.infer<
  typeof ExpectedActiveMappingRefV1Schema
>;

/**
 * Request payload for atomic batch mapping overrides.
 */
export const ApplyMappingOverridesRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveMapping: ExpectedActiveMappingRefV1Schema,
    overrides: z.array(MappingOverrideInstructionV1Schema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seenDecisionIds = new Set<string>();
    for (const [index, override] of value.overrides.entries()) {
      if (seenDecisionIds.has(override.decisionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate override decisionId is not allowed in one batch.",
          path: ["overrides", index, "decisionId"],
        });
      }
      seenDecisionIds.add(override.decisionId);
    }
  });

/**
 * Inferred TypeScript type for override apply requests.
 */
export type ApplyMappingOverridesRequestV1 = z.infer<
  typeof ApplyMappingOverridesRequestV1Schema
>;

/**
 * Structured failure codes for mapping override/read workflows.
 */
export const MappingOverrideErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "MAPPING_NOT_FOUND",
  "STATE_CONFLICT",
  "PERSISTENCE_ERROR",
]);

/**
 * Inferred TypeScript type for mapping override/read failure codes.
 */
export type MappingOverrideErrorCodeV1 = z.infer<
  typeof MappingOverrideErrorCodeV1Schema
>;

/**
 * Structured failure payload for mapping override/read workflows.
 */
export const MappingOverrideFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: MappingOverrideErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping override/read failures.
 */
export type MappingOverrideFailureV1 = z.infer<
  typeof MappingOverrideFailureV1Schema
>;

/**
 * Success payload for active mapping reads.
 */
export const GetActiveMappingDecisionsSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveMappingArtifactRefV1Schema,
    mapping: MappingDecisionSetArtifactV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for active mapping read success payloads.
 */
export type GetActiveMappingDecisionsSuccessV1 = z.infer<
  typeof GetActiveMappingDecisionsSuccessV1Schema
>;

/**
 * Result payload for active mapping reads.
 */
export const GetActiveMappingDecisionsResultV1Schema = z.discriminatedUnion(
  "ok",
  [GetActiveMappingDecisionsSuccessV1Schema, MappingOverrideFailureV1Schema],
);

/**
 * Inferred TypeScript type for active mapping read results.
 */
export type GetActiveMappingDecisionsResultV1 = z.infer<
  typeof GetActiveMappingDecisionsResultV1Schema
>;

/**
 * Success payload for override apply requests.
 */
export const ApplyMappingOverridesSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveMappingArtifactRefV1Schema,
    mapping: MappingDecisionSetArtifactV1Schema,
    appliedCount: z.number().int().nonnegative(),
    savedPreferenceCount: z.number().int().nonnegative(),
  })
  .strict();

/**
 * Inferred TypeScript type for override apply success payloads.
 */
export type ApplyMappingOverridesSuccessV1 = z.infer<
  typeof ApplyMappingOverridesSuccessV1Schema
>;

/**
 * Result payload for override apply requests.
 */
export const ApplyMappingOverridesResultV1Schema = z.discriminatedUnion("ok", [
  ApplyMappingOverridesSuccessV1Schema,
  MappingOverrideFailureV1Schema,
]);

/**
 * Inferred TypeScript type for override apply results.
 */
export type ApplyMappingOverridesResultV1 = z.infer<
  typeof ApplyMappingOverridesResultV1Schema
>;

/**
 * Parses unknown input into active mapping read requests.
 */
export function parseGetActiveMappingDecisionsRequestV1(
  input: unknown,
): GetActiveMappingDecisionsRequestV1 {
  return GetActiveMappingDecisionsRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as active mapping read requests.
 */
export function safeParseGetActiveMappingDecisionsRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetActiveMappingDecisionsRequestV1> {
  return GetActiveMappingDecisionsRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into active mapping read results.
 */
export function parseGetActiveMappingDecisionsResultV1(
  input: unknown,
): GetActiveMappingDecisionsResultV1 {
  return GetActiveMappingDecisionsResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as active mapping read results.
 */
export function safeParseGetActiveMappingDecisionsResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetActiveMappingDecisionsResultV1> {
  return GetActiveMappingDecisionsResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into override apply requests.
 */
export function parseApplyMappingOverridesRequestV1(
  input: unknown,
): ApplyMappingOverridesRequestV1 {
  return ApplyMappingOverridesRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as override apply requests.
 */
export function safeParseApplyMappingOverridesRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ApplyMappingOverridesRequestV1> {
  return ApplyMappingOverridesRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into override apply results.
 */
export function parseApplyMappingOverridesResultV1(
  input: unknown,
): ApplyMappingOverridesResultV1 {
  return ApplyMappingOverridesResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as override apply results.
 */
export function safeParseApplyMappingOverridesResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ApplyMappingOverridesResultV1> {
  return ApplyMappingOverridesResultV1Schema.safeParse(input);
}
