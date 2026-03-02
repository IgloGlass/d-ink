import { describe, expect, it } from "vitest";

import {
  safeParseApplyMappingOverridesRequestV1,
  safeParseApplyMappingOverridesResultV1,
  safeParseGetActiveMappingDecisionsResultV1,
} from "../../../src/shared/contracts/mapping-override.v1";

function createMappingPayloadV1() {
  return {
    schemaVersion: "mapping_decisions_v1" as const,
    policyVersion: "deterministic-bas.v1",
    summary: {
      totalRows: 1,
      deterministicDecisions: 1,
      manualReviewRequired: 0,
      fallbackDecisions: 0,
      matchedByAccountNumber: 1,
      matchedByAccountName: 0,
      unmatchedRows: 0,
    },
    decisions: [
      {
        id: "Trial Balance:2:6072",
        accountNumber: "6072",
        sourceAccountNumber: "6072",
        accountName: "Representation external ej avdragsgill",
        proposedCategory: {
          code: "607200" as const,
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement" as const,
        },
        selectedCategory: {
          code: "607200" as const,
          name: "Entertainment - internal and external - presumed non-deductible",
          statementType: "income_statement" as const,
        },
        confidence: 0.92,
        evidence: [
          {
            type: "tb_row" as const,
            reference: "Trial Balance:2",
          },
        ],
        policyRuleReference: "map.is.entertainment.non-deductible.v1",
        reviewFlag: false,
        status: "proposed" as const,
        source: "deterministic" as const,
      },
    ],
  };
}

describe("mapping override contracts v1", () => {
  it("accepts valid active-mapping read success envelope", () => {
    const result = safeParseGetActiveMappingDecisionsResultV1({
      ok: true,
      active: {
        artifactId: "87000000-0000-4000-8000-000000000001",
        version: 3,
        schemaVersion: "mapping_decisions_v1",
      },
      mapping: createMappingPayloadV1(),
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid override-apply success envelope", () => {
    const result = safeParseApplyMappingOverridesResultV1({
      ok: true,
      active: {
        artifactId: "87000000-0000-4000-8000-000000000002",
        version: 4,
        schemaVersion: "mapping_decisions_v1",
      },
      mapping: createMappingPayloadV1(),
      appliedCount: 1,
      savedPreferenceCount: 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects scope=group in override request", () => {
    const result = safeParseApplyMappingOverridesRequestV1({
      tenantId: "87000000-0000-4000-8000-000000000010",
      workspaceId: "87000000-0000-4000-8000-000000000011",
      expectedActiveMapping: {
        artifactId: "87000000-0000-4000-8000-000000000012",
        version: 1,
      },
      overrides: [
        {
          decisionId: "Trial Balance:2:6072",
          selectedCategoryCode: "607200",
          scope: "group",
          reason: "Incorrect category",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed expectedActiveMapping or override entry", () => {
    const invalidVersionResult = safeParseApplyMappingOverridesRequestV1({
      tenantId: "87000000-0000-4000-8000-000000000020",
      workspaceId: "87000000-0000-4000-8000-000000000021",
      expectedActiveMapping: {
        artifactId: "87000000-0000-4000-8000-000000000022",
        version: 0,
      },
      overrides: [
        {
          decisionId: "Trial Balance:2:6072",
          selectedCategoryCode: "607200",
          scope: "return",
          reason: "Incorrect category",
        },
      ],
    });

    const invalidOverrideResult = safeParseApplyMappingOverridesRequestV1({
      tenantId: "87000000-0000-4000-8000-000000000020",
      workspaceId: "87000000-0000-4000-8000-000000000021",
      expectedActiveMapping: {
        artifactId: "87000000-0000-4000-8000-000000000022",
        version: 1,
      },
      overrides: [
        {
          decisionId: "",
          selectedCategoryCode: "607200",
          scope: "return",
          reason: "Incorrect category",
        },
      ],
    });

    expect(invalidVersionResult.success).toBe(false);
    expect(invalidOverrideResult.success).toBe(false);
  });

  it("accepts valid failure envelope", () => {
    const result = safeParseApplyMappingOverridesResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Mapping override request payload is invalid.",
        user_message: "The override request is invalid. Refresh and retry.",
        context: {
          issues: [],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
