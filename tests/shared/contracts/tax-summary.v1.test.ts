import { describe, expect, it } from "vitest";

import {
  TaxSummaryPayloadV1Schema,
  parseRunTaxSummaryResultV1,
} from "../../../src/shared/contracts/tax-summary.v1";

describe("tax summary contracts v1", () => {
  it("accepts valid tax summary payload", () => {
    const result = TaxSummaryPayloadV1Schema.safeParse({
      schemaVersion: "tax_summary_v1",
      extractionArtifactId: "99000000-0000-4000-8000-000000000001",
      adjustmentsArtifactId: "99000000-0000-4000-8000-000000000002",
      fiscalYearEnd: "2025-12-31",
      taxRatePercent: 20.6,
      profitBeforeTax: 1000000,
      totalAdjustments: 15000,
      taxableIncome: 1015000,
      corporateTax: 209090,
      lineItems: [
        {
          code: "profit_before_tax",
          amount: 1000000,
          sourceReference: "annual_report_extraction:profitBeforeTax",
        },
        {
          code: "total_adjustments",
          amount: 15000,
          sourceReference: "tax_adjustments:totalNetAdjustments",
        },
        {
          code: "taxable_income",
          amount: 1015000,
          sourceReference: "calc:profit_before_tax+total_adjustments",
        },
        {
          code: "corporate_tax",
          amount: 209090,
          sourceReference: "calc:taxable_income*tax_rate",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed line-item length", () => {
    const result = TaxSummaryPayloadV1Schema.safeParse({
      schemaVersion: "tax_summary_v1",
      extractionArtifactId: "99000000-0000-4000-8000-000000000001",
      adjustmentsArtifactId: "99000000-0000-4000-8000-000000000002",
      fiscalYearEnd: "2025-12-31",
      taxRatePercent: 20.6,
      profitBeforeTax: 1000000,
      totalAdjustments: 15000,
      taxableIncome: 1015000,
      corporateTax: 209090,
      lineItems: [],
    });

    expect(result.success).toBe(false);
  });

  it("accepts run result envelopes", () => {
    const result = parseRunTaxSummaryResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Invalid request.",
        user_message: "The request is invalid.",
        context: {},
      },
    });

    expect(result.ok).toBe(false);
  });
});
