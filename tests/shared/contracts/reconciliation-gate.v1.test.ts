import { describe, expect, it } from "vitest";

import {
  safeParseEvaluateReconciliationGateRequestV1,
  safeParseEvaluateReconciliationGateResultV1,
} from "../../../src/shared/contracts/reconciliation-gate.v1";

describe("reconciliation gate contracts v1", () => {
  it("accepts valid gate success payload", () => {
    const result = safeParseEvaluateReconciliationGateResultV1({
      ok: true,
      reconciliation: {
        schemaVersion: "reconciliation_result_v1",
        status: "pass",
        canProceedToMapping: true,
        blockingReasonCodes: [],
        summary: {
          candidateRows: 2,
          normalizedRows: 2,
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

  it("accepts schema-valid success payload shape", () => {
    const result = safeParseEvaluateReconciliationGateResultV1({
      ok: true,
      reconciliation: {
        schemaVersion: "reconciliation_result_v1",
        status: "fail",
        canProceedToMapping: false,
        blockingReasonCodes: ["material_rejections_absent"],
        summary: {
          candidateRows: 2,
          normalizedRows: 1,
          rejectedRows: 1,
          materialRejectedRows: 1,
          nonMaterialRejectedRows: 0,
          openingBalanceTotal: 1000,
          closingBalanceTotal: 1200,
        },
        checks: [
          {
            code: "material_rejections_absent",
            status: "fail",
            blocking: true,
            message: "blocked",
            context: {},
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid blocked failure payload", () => {
    const result = safeParseEvaluateReconciliationGateResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message: "blocked",
        user_message: "blocked",
        context: {
          reconciliationStatus: "fail",
          canProceedToMapping: false,
          blockingReasonCodes: ["material_rejections_absent"],
          summary: {},
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed gate request payload", () => {
    const result = safeParseEvaluateReconciliationGateRequestV1({
      foo: "bar",
    });

    expect(result.success).toBe(false);
  });
});
