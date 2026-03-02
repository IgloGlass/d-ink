import { z } from "zod";

import {
  ReconciliationResultPayloadV1Schema,
  ReconciliationStatusV1Schema,
} from "./reconciliation.v1";
import { TrialBalanceNormalizedV1Schema } from "./trial-balance.v1";

/**
 * Error codes for workflow-level reconciliation gating before mapping.
 */
export const ReconciliationGateErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "RECONCILIATION_BLOCKED",
]);

/**
 * Inferred TypeScript type for reconciliation gate error codes.
 */
export type ReconciliationGateErrorCodeV1 = z.infer<
  typeof ReconciliationGateErrorCodeV1Schema
>;

/**
 * Request payload for evaluating mapping gate readiness from trial balance data.
 */
export const EvaluateReconciliationGateRequestV1Schema = z
  .object({
    trialBalance: TrialBalanceNormalizedV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation gate requests.
 */
export type EvaluateReconciliationGateRequestV1 = z.infer<
  typeof EvaluateReconciliationGateRequestV1Schema
>;

/**
 * Structured gate error payload.
 */
export const ReconciliationGateErrorV1Schema = z
  .object({
    code: ReconciliationGateErrorCodeV1Schema,
    message: z.string().trim().min(1),
    user_message: z.string().trim().min(1),
    context: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Inferred TypeScript type for reconciliation gate errors.
 */
export type ReconciliationGateErrorV1 = z.infer<
  typeof ReconciliationGateErrorV1Schema
>;

/**
 * Success payload for gate evaluation.
 */
export const EvaluateReconciliationGateSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    reconciliation: ReconciliationResultPayloadV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful gate evaluations.
 */
export type EvaluateReconciliationGateSuccessV1 = z.infer<
  typeof EvaluateReconciliationGateSuccessV1Schema
>;

/**
 * Failure payload for gate evaluation.
 */
export const EvaluateReconciliationGateFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: ReconciliationGateErrorV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for failed gate evaluations.
 */
export type EvaluateReconciliationGateFailureV1 = z.infer<
  typeof EvaluateReconciliationGateFailureV1Schema
>;

/**
 * Discriminated result payload for workflow-level reconciliation gating.
 */
export const EvaluateReconciliationGateResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    EvaluateReconciliationGateSuccessV1Schema,
    EvaluateReconciliationGateFailureV1Schema,
  ],
);

/**
 * Inferred TypeScript type for reconciliation gate evaluation results.
 */
export type EvaluateReconciliationGateResultV1 = z.infer<
  typeof EvaluateReconciliationGateResultV1Schema
>;

/**
 * Parsable context structure for blocked reconciliation gate outcomes.
 */
export const ReconciliationGateBlockedContextV1Schema = z
  .object({
    reconciliationStatus: ReconciliationStatusV1Schema,
    canProceedToMapping: z.boolean(),
    blockingReasonCodes: z.array(z.string()),
    summary: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Inferred TypeScript type for blocked gate context.
 */
export type ReconciliationGateBlockedContextV1 = z.infer<
  typeof ReconciliationGateBlockedContextV1Schema
>;

/**
 * Parses unknown input into a reconciliation gate request payload.
 */
export function parseEvaluateReconciliationGateRequestV1(
  input: unknown,
): EvaluateReconciliationGateRequestV1 {
  return EvaluateReconciliationGateRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a reconciliation gate request payload.
 */
export function safeParseEvaluateReconciliationGateRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, EvaluateReconciliationGateRequestV1> {
  return EvaluateReconciliationGateRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into reconciliation gate evaluation results.
 */
export function parseEvaluateReconciliationGateResultV1(
  input: unknown,
): EvaluateReconciliationGateResultV1 {
  return EvaluateReconciliationGateResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as reconciliation gate evaluation results.
 */
export function safeParseEvaluateReconciliationGateResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, EvaluateReconciliationGateResultV1> {
  return EvaluateReconciliationGateResultV1Schema.safeParse(input);
}
