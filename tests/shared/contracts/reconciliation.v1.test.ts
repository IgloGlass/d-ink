import { describe, expect, it } from "vitest";

import {
  safeParseReconcileTrialBalanceRequestV1,
  safeParseReconcileTrialBalanceResultV1,
} from "../../../src/shared/contracts/reconciliation.v1";

describe("reconciliation contracts v1", () => {
  it("accepts valid reconciliation success payload", () => {
    const result = safeParseReconcileTrialBalanceResultV1({
      ok: true,
      reconciliation: {
        schemaVersion: "reconciliation_result_v1",
        status: "pass",
        canProceedToMapping: true,
        blockingReasonCodes: [],
        summary: {
          candidateRows: 1,
          normalizedRows: 1,
          rejectedRows: 0,
          materialRejectedRows: 0,
          nonMaterialRejectedRows: 0,
          openingBalanceTotal: 1000,
          closingBalanceTotal: 1200,
        },
        checks: [
          {
            code: "candidate_rows_present",
            status: "pass",
            blocking: false,
            message: "ok",
            context: {},
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown schemaVersion", () => {
    const result = safeParseReconcileTrialBalanceResultV1({
      ok: true,
      reconciliation: {
        schemaVersion: "reconciliation_result_v2",
        status: "pass",
        canProceedToMapping: true,
        blockingReasonCodes: [],
        summary: {
          candidateRows: 1,
          normalizedRows: 1,
          rejectedRows: 0,
          materialRejectedRows: 0,
          nonMaterialRejectedRows: 0,
          openingBalanceTotal: 1000,
          closingBalanceTotal: 1200,
        },
        checks: [
          {
            code: "candidate_rows_present",
            status: "pass",
            blocking: false,
            message: "ok",
            context: {},
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed request payload", () => {
    const result = safeParseReconcileTrialBalanceRequestV1({
      foo: "bar",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid failure payload", () => {
    const result = safeParseReconcileTrialBalanceResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Request is invalid.",
        user_message: "Invalid request.",
        context: {
          issues: [],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
