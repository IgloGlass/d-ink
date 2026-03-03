import { describe, expect, it } from "vitest";

import {
  TaxAdjustmentDecisionSetPayloadV1Schema,
  parseApplyTaxAdjustmentOverridesResultV1,
  parseRunTaxAdjustmentResultV1,
} from "../../../src/shared/contracts/tax-adjustments.v1";

describe("tax adjustments contracts v1", () => {
  it("accepts deterministic adjustment payload", () => {
    const result = TaxAdjustmentDecisionSetPayloadV1Schema.safeParse({
      schemaVersion: "tax_adjustments_v1",
      policyVersion: "tax-adjustments.v1",
      generatedFrom: {
        mappingArtifactId: "98000000-0000-4000-8000-000000000001",
        annualReportExtractionArtifactId: "98000000-0000-4000-8000-000000000002",
      },
      summary: {
        totalDecisions: 1,
        manualReviewRequired: 0,
        totalPositiveAdjustments: 1000,
        totalNegativeAdjustments: 0,
        totalNetAdjustments: 1000,
      },
      decisions: [
        {
          id: "adj-1",
          module: "non_deductible_expenses",
          amount: 1000,
          direction: "increase_taxable_income",
          targetField: "INK2S.non_deductible_expenses",
          status: "proposed",
          confidence: 0.95,
          reviewFlag: false,
          policyRuleReference: "adj.non_deductible_expenses.v1",
          rationale: "Non-deductible expense mapped from BAS category.",
          evidence: [{ type: "mapping_category", reference: "607200" }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects overridden decision missing override details", () => {
    const result = TaxAdjustmentDecisionSetPayloadV1Schema.safeParse({
      schemaVersion: "tax_adjustments_v1",
      policyVersion: "tax-adjustments.v1",
      generatedFrom: {
        mappingArtifactId: "98000000-0000-4000-8000-000000000001",
        annualReportExtractionArtifactId: "98000000-0000-4000-8000-000000000002",
      },
      summary: {
        totalDecisions: 1,
        manualReviewRequired: 0,
        totalPositiveAdjustments: 1000,
        totalNegativeAdjustments: 0,
        totalNetAdjustments: 1000,
      },
      decisions: [
        {
          id: "adj-1",
          module: "manual_review_bucket",
          amount: 0,
          direction: "informational",
          targetField: "INK2S.other_manual_adjustments",
          status: "overridden",
          confidence: 1,
          reviewFlag: true,
          policyRuleReference: "adj.manual_review_bucket.v1",
          rationale: "Manual review.",
          evidence: [{ type: "rule", reference: "manual" }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts run and override result envelopes", () => {
    const base = {
      active: {
        artifactId: "98000000-0000-4000-8000-000000000011",
        version: 1,
        schemaVersion: "tax_adjustments_v1",
      },
      adjustments: {
        schemaVersion: "tax_adjustments_v1",
        policyVersion: "tax-adjustments.v1",
        generatedFrom: {
          mappingArtifactId: "98000000-0000-4000-8000-000000000001",
          annualReportExtractionArtifactId: "98000000-0000-4000-8000-000000000002",
        },
        summary: {
          totalDecisions: 0,
          manualReviewRequired: 0,
          totalPositiveAdjustments: 0,
          totalNegativeAdjustments: 0,
          totalNetAdjustments: 0,
        },
        decisions: [],
      },
    };

    expect(parseRunTaxAdjustmentResultV1({ ok: true, ...base }).ok).toBe(true);
    expect(
      parseApplyTaxAdjustmentOverridesResultV1({
        ok: true,
        ...base,
        appliedCount: 0,
      }).ok,
    ).toBe(true);
  });
});
