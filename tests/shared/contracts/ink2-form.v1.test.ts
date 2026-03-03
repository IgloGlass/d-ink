import { describe, expect, it } from "vitest";

import {
  Ink2FormDraftPayloadV1Schema,
  parseApplyInk2FormOverridesResultV1,
} from "../../../src/shared/contracts/ink2-form.v1";

function createDraftFields() {
  return [
    {
      fieldId: "INK2R.profit_before_tax" as const,
      amount: 1000000,
      provenance: "extracted" as const,
      sourceReferences: ["annual_report:profitBeforeTax"],
    },
    {
      fieldId: "INK2S.non_deductible_expenses" as const,
      amount: 5000,
      provenance: "adjustment" as const,
      sourceReferences: ["adjustment:non_deductible_expenses"],
    },
    {
      fieldId: "INK2S.representation_non_deductible" as const,
      amount: 1000,
      provenance: "adjustment" as const,
      sourceReferences: ["adjustment:representation_entertainment"],
    },
    {
      fieldId: "INK2S.depreciation_adjustment" as const,
      amount: 0,
      provenance: "adjustment" as const,
      sourceReferences: ["adjustment:depreciation_differences_basic"],
    },
    {
      fieldId: "INK2S.other_manual_adjustments" as const,
      amount: 0,
      provenance: "manual" as const,
      sourceReferences: ["adjustment:manual_review_bucket"],
    },
    {
      fieldId: "INK2S.total_adjustments" as const,
      amount: 6000,
      provenance: "calculated" as const,
      sourceReferences: ["summary:totalAdjustments"],
    },
    {
      fieldId: "INK2S.taxable_income" as const,
      amount: 1006000,
      provenance: "calculated" as const,
      sourceReferences: ["summary:taxableIncome"],
    },
    {
      fieldId: "INK2S.corporate_tax" as const,
      amount: 207236,
      provenance: "calculated" as const,
      sourceReferences: ["summary:corporateTax"],
    },
  ];
}

describe("INK2 form contracts v1", () => {
  it("accepts valid INK2 draft payload", () => {
    const result = Ink2FormDraftPayloadV1Schema.safeParse({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: "99100000-0000-4000-8000-000000000001",
      adjustmentsArtifactId: "99100000-0000-4000-8000-000000000002",
      summaryArtifactId: "99100000-0000-4000-8000-000000000003",
      fields: createDraftFields(),
      validation: {
        status: "valid",
        issues: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate field IDs", () => {
    const fields = createDraftFields();
    fields[7] = { ...fields[0] };

    const result = Ink2FormDraftPayloadV1Schema.safeParse({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: "99100000-0000-4000-8000-000000000001",
      adjustmentsArtifactId: "99100000-0000-4000-8000-000000000002",
      summaryArtifactId: "99100000-0000-4000-8000-000000000003",
      fields,
      validation: {
        status: "invalid",
        issues: ["duplicate field"],
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts override result envelope", () => {
    const result = parseApplyInk2FormOverridesResultV1({
      ok: true,
      active: {
        artifactId: "99100000-0000-4000-8000-000000000010",
        version: 2,
        schemaVersion: "ink2_form_draft_v1",
      },
      form: {
        schemaVersion: "ink2_form_draft_v1",
        extractionArtifactId: "99100000-0000-4000-8000-000000000001",
        adjustmentsArtifactId: "99100000-0000-4000-8000-000000000002",
        summaryArtifactId: "99100000-0000-4000-8000-000000000003",
        fields: createDraftFields(),
        validation: {
          status: "valid",
          issues: [],
        },
      },
      appliedCount: 1,
    });

    expect(result.ok).toBe(true);
  });
});
