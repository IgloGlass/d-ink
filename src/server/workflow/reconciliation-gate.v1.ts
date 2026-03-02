import type { z } from "zod";

import {
  EvaluateReconciliationGateRequestV1Schema,
  type EvaluateReconciliationGateResultV1,
  parseEvaluateReconciliationGateResultV1,
} from "../../shared/contracts/reconciliation-gate.v1";
import { evaluateTrialBalanceReconciliationV1 } from "../validation/trial-balance-reconciliation.v1";

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

/**
 * Evaluates whether mapping is allowed based on deterministic reconciliation.
 *
 * Safety boundary:
 * - Mapping must not run when reconciliation fails.
 * - This gate is deterministic and must remain AI-free.
 */
export function evaluateReconciliationGateForMappingV1(
  input: unknown,
): EvaluateReconciliationGateResultV1 {
  const parsedRequest =
    EvaluateReconciliationGateRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseEvaluateReconciliationGateResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Reconciliation gate request payload is invalid.",
        user_message:
          "The reconciliation gate request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      },
    });
  }

  const reconciliationResult = evaluateTrialBalanceReconciliationV1({
    trialBalance: parsedRequest.data.trialBalance,
  });
  if (!reconciliationResult.ok) {
    return parseEvaluateReconciliationGateResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: reconciliationResult.error.message,
        user_message: reconciliationResult.error.user_message,
        context: reconciliationResult.error.context,
      },
    });
  }

  const reconciliation = reconciliationResult.reconciliation;

  if (!reconciliation.canProceedToMapping) {
    return parseEvaluateReconciliationGateResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message:
          "Mapping is blocked because deterministic reconciliation failed.",
        user_message:
          "Reconciliation failed. Fix trial balance issues before continuing to mapping.",
        context: {
          reconciliationStatus: reconciliation.status,
          canProceedToMapping: reconciliation.canProceedToMapping,
          blockingReasonCodes: reconciliation.blockingReasonCodes,
          summary: reconciliation.summary,
        },
      },
    });
  }

  return parseEvaluateReconciliationGateResultV1({
    ok: true,
    reconciliation,
  });
}
