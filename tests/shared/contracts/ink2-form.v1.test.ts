import { describe, expect, it } from "vitest";

import {
  Ink2FormDraftPayloadV1Schema,
  parseApplyInk2FormOverridesResultV1,
} from "../../../src/shared/contracts/ink2-form.v1";

function createDraftFields() {
  return [
    {
      fieldId: "1.1",
      amount: 1006000,
      provenance: "extracted" as const,
      sourceReferences: ["ink2_derived:1.1"],
    },
    {
      fieldId: "2.26",
      amount: 250000,
      provenance: "adjustment" as const,
      sourceReferences: ["annual_report_statement:2.26"],
    },
    {
      fieldId: "3.26",
      amount: 20000,
      provenance: "adjustment" as const,
      sourceReferences: ["annual_report_statement:3.25"],
    },
    {
      fieldId: "3.27",
      amount: 150000,
      provenance: "adjustment" as const,
      sourceReferences: ["annual_report_statement:3.26"],
    },
    {
      fieldId: "4.3c",
      amount: 5000,
      provenance: "manual" as const,
      sourceReferences: ["tax_adjustments:adj-1"],
    },
    {
      fieldId: "4.9",
      amount: -4000,
      provenance: "calculated" as const,
      sourceReferences: ["tax_adjustments:adj-2"],
    },
    {
      fieldId: "4.15",
      amount: 1006000,
      provenance: "calculated" as const,
      sourceReferences: ["ink2_derived:4.15"],
    },
    {
      fieldId: "4.16",
      amount: 0,
      provenance: "calculated" as const,
      sourceReferences: ["ink2_derived:4.16"],
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
