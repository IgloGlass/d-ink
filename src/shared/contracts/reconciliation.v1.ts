import { z } from "zod";

import { TrialBalanceNormalizedV1Schema } from "./trial-balance.v1";

/**
 * Reconciliation status values used for deterministic trial-balance gating.
 */
export const ReconciliationStatusV1Schema = z.enum(["pass", "warning", "fail"]);

/**
 * Inferred TypeScript type for reconciliation status values.
 */
export type ReconciliationStatusV1 = z.infer<
  typeof ReconciliationStatusV1Schema
>;

/**
 * Fixed deterministic reconciliation check codes for V1.
 */
export const ReconciliationCheckCodeV1Schema = z.enum([
  "candidate_rows_present",
  "normalized_rows_present",
  "material_rejections_absent",
  "non_material_rejections_review",
  "normalized_account_number_uniqueness",
  "duplicate_suffix_consistency",
  "verification_count_consistency",
  "verification_total_consistency",
  "summary_row_total_consistency",
]);

/**
 * Inferred TypeScript type for reconciliation check codes.
 */
export type ReconciliationCheckCodeV1 = z.infer<
  typeof ReconciliationCheckCodeV1Schema
>;

/**
 * Structured reconciliation check result contract.
 */
export const ReconciliationCheckV1Schema = z
  .object({
    code: ReconciliationCheckCodeV1Schema,
    status: ReconciliationStatusV1Schema,
    blocking: z.boolean(),
    message: z.string().trim().min(1),
    context: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation checks.
 */
export type ReconciliationCheckV1 = z.infer<typeof ReconciliationCheckV1Schema>;

/**
 * Deterministic reconciliation summary counters and totals.
 */
export const ReconciliationSummaryV1Schema = z
  .object({
    candidateRows: z.number().int().nonnegative(),
    normalizedRows: z.number().int().nonnegative(),
    rejectedRows: z.number().int().nonnegative(),
    materialRejectedRows: z.number().int().nonnegative(),
    nonMaterialRejectedRows: z.number().int().nonnegative(),
    openingBalanceTotal: z.number().finite(),
    closingBalanceTotal: z.number().finite(),
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation summaries.
 */
export type ReconciliationSummaryV1 = z.infer<
  typeof ReconciliationSummaryV1Schema
>;

/**
 * Deterministic reconciliation payload used by downstream gating.
 */
export const ReconciliationResultPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("reconciliation_result_v1"),
    status: ReconciliationStatusV1Schema,
    canProceedToMapping: z.boolean(),
    blockingReasonCodes: z.array(ReconciliationCheckCodeV1Schema),
    summary: ReconciliationSummaryV1Schema,
    checks: z.array(ReconciliationCheckV1Schema).min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation result payloads.
 */
export type ReconciliationResultPayloadV1 = z.infer<
  typeof ReconciliationResultPayloadV1Schema
>;

/**
 * Request payload for deterministic reconciliation evaluation.
 */
export const ReconcileTrialBalanceRequestV1Schema = z
  .object({
    trialBalance: TrialBalanceNormalizedV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation request payloads.
 */
export type ReconcileTrialBalanceRequestV1 = z.infer<
  typeof ReconcileTrialBalanceRequestV1Schema
>;

/**
 * Structured reconciliation error codes for V1.
 */
export const ReconciliationErrorCodeV1Schema = z.enum(["INPUT_INVALID"]);

/**
 * Inferred TypeScript type for reconciliation error codes.
 */
export type ReconciliationErrorCodeV1 = z.infer<
  typeof ReconciliationErrorCodeV1Schema
>;

/**
 * Reconciliation failure payload.
 */
export const ReconcileTrialBalanceFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: ReconciliationErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation failures.
 */
export type ReconcileTrialBalanceFailureV1 = z.infer<
  typeof ReconcileTrialBalanceFailureV1Schema
>;

/**
 * Reconciliation success payload.
 */
export const ReconcileTrialBalanceSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    reconciliation: ReconciliationResultPayloadV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation successes.
 */
export type ReconcileTrialBalanceSuccessV1 = z.infer<
  typeof ReconcileTrialBalanceSuccessV1Schema
>;

/**
 * Discriminated reconciliation result contract.
 */
export const ReconcileTrialBalanceResultV1Schema = z.discriminatedUnion("ok", [
  ReconcileTrialBalanceSuccessV1Schema,
  ReconcileTrialBalanceFailureV1Schema,
]);

/**
 * Inferred TypeScript type for reconciliation result payloads.
 */
export type ReconcileTrialBalanceResultV1 = z.infer<
  typeof ReconcileTrialBalanceResultV1Schema
>;

/**
 * Parses unknown input into a reconciliation request payload.
 */
export function parseReconcileTrialBalanceRequestV1(
  input: unknown,
): ReconcileTrialBalanceRequestV1 {
  return ReconcileTrialBalanceRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a reconciliation request payload.
 */
export function safeParseReconcileTrialBalanceRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ReconcileTrialBalanceRequestV1> {
  return ReconcileTrialBalanceRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into reconciliation result payload.
 */
export function parseReconcileTrialBalanceResultV1(
  input: unknown,
): ReconcileTrialBalanceResultV1 {
  return ReconcileTrialBalanceResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a reconciliation result payload.
 */
export function safeParseReconcileTrialBalanceResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ReconcileTrialBalanceResultV1> {
  return ReconcileTrialBalanceResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into reconciliation result payload details.
 */
export function parseReconciliationResultPayloadV1(
  input: unknown,
): ReconciliationResultPayloadV1 {
  return ReconciliationResultPayloadV1Schema.parse(input);
}

/**
 * Safely validates unknown input as reconciliation result payload details.
 */
export function safeParseReconciliationResultPayloadV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ReconciliationResultPayloadV1> {
  return ReconciliationResultPayloadV1Schema.safeParse(input);
}
