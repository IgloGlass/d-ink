import { z } from "zod";

import { UuidV4Schema } from "./common.v1";
import { SilverfinTaxCategoryCodeV1Schema } from "./mapping.v1";

/**
 * Allowed override scope for mapping-review suggestions in V1.
 */
export const MappingReviewSuggestionScopeV1Schema = z.enum(["return", "user"]);

/**
 * Inferred TypeScript type for mapping-review suggestion scope.
 */
export type MappingReviewSuggestionScopeV1 = z.infer<
  typeof MappingReviewSuggestionScopeV1Schema
>;

/**
 * Single AI-proposed mapping override suggestion.
 */
export const MappingReviewSuggestionV1Schema = z
  .object({
    decisionId: z.string().trim().min(1),
    selectedCategoryCode: SilverfinTaxCategoryCodeV1Schema,
    scope: MappingReviewSuggestionScopeV1Schema,
    reason: z.string().trim().min(1),
    policyRuleReference: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
    reviewFlag: z.boolean(),
  })
  .strict();

/**
 * Inferred TypeScript type for a single mapping-review suggestion.
 */
export type MappingReviewSuggestionV1 = z.infer<
  typeof MappingReviewSuggestionV1Schema
>;

/**
 * Summary metadata for a mapping-review suggestion set.
 */
export const MappingReviewSuggestionSummaryV1Schema = z
  .object({
    totalDecisionsEvaluated: z.number().int().nonnegative(),
    suggestedOverrides: z.number().int().nonnegative(),
    reviewFlaggedSuggestions: z.number().int().nonnegative(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping-review suggestion summary.
 */
export type MappingReviewSuggestionSummaryV1 = z.infer<
  typeof MappingReviewSuggestionSummaryV1Schema
>;

/**
 * Structured suggestion payload returned by the mapping-review module.
 */
export const MappingReviewSuggestionSetPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("mapping_review_suggestions_v1"),
    moduleId: z.literal("mapping-review"),
    moduleVersion: z.string().trim().min(1),
    policyVersion: z.string().trim().min(1),
    summary: MappingReviewSuggestionSummaryV1Schema,
    suggestions: z.array(MappingReviewSuggestionV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping-review suggestion payloads.
 */
export type MappingReviewSuggestionSetPayloadV1 = z.infer<
  typeof MappingReviewSuggestionSetPayloadV1Schema
>;

/**
 * Reference metadata for the active mapping artifact that was reviewed.
 */
export const MappingReviewActiveMappingRefV1Schema = z
  .object({
    artifactId: z.string().trim().min(1),
    version: z.number().int().positive(),
    schemaVersion: z.string().trim().min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for reviewed active mapping references.
 */
export type MappingReviewActiveMappingRefV1 = z.infer<
  typeof MappingReviewActiveMappingRefV1Schema
>;

/**
 * Request payload for generating mapping-review suggestions.
 */
export const GenerateMappingReviewSuggestionsRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    scope: MappingReviewSuggestionScopeV1Schema.default("return"),
    maxSuggestions: z.number().int().positive().max(500).optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping-review suggestion requests.
 */
export type GenerateMappingReviewSuggestionsRequestV1 = z.infer<
  typeof GenerateMappingReviewSuggestionsRequestV1Schema
>;

/**
 * Structured mapping-review error codes.
 */
export const GenerateMappingReviewSuggestionsErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "RECONCILIATION_NOT_FOUND",
  "RECONCILIATION_BLOCKED",
  "MAPPING_NOT_FOUND",
  "AI_MODULE_CONFIG_INVALID",
  "AI_PROVIDER_ERROR",
  "AI_OUTPUT_INVALID",
]);

/**
 * Inferred TypeScript type for mapping-review error codes.
 */
export type GenerateMappingReviewSuggestionsErrorCodeV1 = z.infer<
  typeof GenerateMappingReviewSuggestionsErrorCodeV1Schema
>;

/**
 * Failure payload for mapping-review suggestion generation.
 */
export const GenerateMappingReviewSuggestionsFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: GenerateMappingReviewSuggestionsErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping-review failures.
 */
export type GenerateMappingReviewSuggestionsFailureV1 = z.infer<
  typeof GenerateMappingReviewSuggestionsFailureV1Schema
>;

/**
 * Success payload for mapping-review suggestion generation.
 */
export const GenerateMappingReviewSuggestionsSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    activeMapping: MappingReviewActiveMappingRefV1Schema,
    suggestions: MappingReviewSuggestionSetPayloadV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for mapping-review successes.
 */
export type GenerateMappingReviewSuggestionsSuccessV1 = z.infer<
  typeof GenerateMappingReviewSuggestionsSuccessV1Schema
>;

/**
 * Discriminated result payload for mapping-review suggestion generation.
 */
export const GenerateMappingReviewSuggestionsResultV1Schema =
  z.discriminatedUnion("ok", [
    GenerateMappingReviewSuggestionsSuccessV1Schema,
    GenerateMappingReviewSuggestionsFailureV1Schema,
  ]);

/**
 * Inferred TypeScript type for mapping-review suggestion generation results.
 */
export type GenerateMappingReviewSuggestionsResultV1 = z.infer<
  typeof GenerateMappingReviewSuggestionsResultV1Schema
>;

/**
 * Parses unknown input into mapping-review suggestion requests.
 */
export function parseGenerateMappingReviewSuggestionsRequestV1(
  input: unknown,
): GenerateMappingReviewSuggestionsRequestV1 {
  return GenerateMappingReviewSuggestionsRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as mapping-review suggestion requests.
 */
export function safeParseGenerateMappingReviewSuggestionsRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GenerateMappingReviewSuggestionsRequestV1> {
  return GenerateMappingReviewSuggestionsRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into mapping-review suggestion generation results.
 */
export function parseGenerateMappingReviewSuggestionsResultV1(
  input: unknown,
): GenerateMappingReviewSuggestionsResultV1 {
  return GenerateMappingReviewSuggestionsResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as mapping-review suggestion generation results.
 */
export function safeParseGenerateMappingReviewSuggestionsResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GenerateMappingReviewSuggestionsResultV1> {
  return GenerateMappingReviewSuggestionsResultV1Schema.safeParse(input);
}

