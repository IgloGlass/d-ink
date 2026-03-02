import { describe, expect, it } from "vitest";

import { loadMappingReviewModuleConfigV1 } from "../../../src/server/ai/modules/mapping-review/loader.v1";

describe("mapping review module loader v1", () => {
  it("loads module spec and policy pack successfully", () => {
    const result = loadMappingReviewModuleConfigV1();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.config.moduleSpec.moduleId).toBe("mapping-review");
    expect(result.config.policyPack.policyVersion).toBe("mapping-review.v1");
    expect(result.config.promptVersion).toBe("mapping-review.prompts.v1");
  });

  it("contains comprehensive policy coverage from original guidelines", () => {
    const result = loadMappingReviewModuleConfigV1();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.config.policyPack.guidelineRules.length).toBeGreaterThanOrEqual(
      25,
    );
    expect(result.config.policyPack.categoryCatalog.balance_sheet.length).toBe(
      19,
    );
    expect(result.config.policyPack.categoryCatalog.income_statement.length).toBe(
      48,
    );
  });
});

