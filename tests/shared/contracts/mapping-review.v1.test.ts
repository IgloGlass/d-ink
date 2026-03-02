import { describe, expect, it } from "vitest";

import {
  safeParseGenerateMappingReviewSuggestionsRequestV1,
  safeParseGenerateMappingReviewSuggestionsResultV1,
} from "../../../src/shared/contracts/mapping-review.v1";

describe("mapping review contracts v1", () => {
  it("accepts valid generate mapping-review request", () => {
    const result = safeParseGenerateMappingReviewSuggestionsRequestV1({
      tenantId: "91000000-0000-4000-8000-000000000001",
      workspaceId: "91000000-0000-4000-8000-000000000002",
      scope: "return",
      maxSuggestions: 25,
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid mapping-review success envelope", () => {
    const result = safeParseGenerateMappingReviewSuggestionsResultV1({
      ok: true,
      activeMapping: {
        artifactId: "91000000-0000-4000-8000-000000000003",
        version: 2,
        schemaVersion: "mapping_decisions_v1",
      },
      suggestions: {
        schemaVersion: "mapping_review_suggestions_v1",
        moduleId: "mapping-review",
        moduleVersion: "v1",
        policyVersion: "mapping-review.v1",
        summary: {
          totalDecisionsEvaluated: 10,
          suggestedOverrides: 1,
          reviewFlaggedSuggestions: 0,
        },
        suggestions: [
          {
            decisionId: "Trial Balance:2:6072",
            selectedCategoryCode: "607200",
            scope: "return",
            reason:
              "Partially deductible representation should be treated as non-deductible.",
            policyRuleReference:
              "guideline.is.partially-deductible-representation.prudent.v1",
            confidence: 0.9,
            reviewFlag: false,
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid suggestion scope and unknown error codes", () => {
    const badScope = safeParseGenerateMappingReviewSuggestionsResultV1({
      ok: true,
      activeMapping: {
        artifactId: "91000000-0000-4000-8000-000000000003",
        version: 2,
        schemaVersion: "mapping_decisions_v1",
      },
      suggestions: {
        schemaVersion: "mapping_review_suggestions_v1",
        moduleId: "mapping-review",
        moduleVersion: "v1",
        policyVersion: "mapping-review.v1",
        summary: {
          totalDecisionsEvaluated: 10,
          suggestedOverrides: 1,
          reviewFlaggedSuggestions: 0,
        },
        suggestions: [
          {
            decisionId: "Trial Balance:2:6072",
            selectedCategoryCode: "607200",
            scope: "group",
            reason: "invalid scope",
            policyRuleReference: "rule",
            confidence: 0.9,
            reviewFlag: false,
          },
        ],
      },
    });

    const badErrorCode = safeParseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "NOT_A_VALID_CODE",
        message: "invalid",
        user_message: "invalid",
        context: {},
      },
    });

    expect(badScope.success).toBe(false);
    expect(badErrorCode.success).toBe(false);
  });
});

