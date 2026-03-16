import { describe, expect, it } from "vitest";

import {
  TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1,
  listTaxAdjustmentSubmoduleCatalogV1,
} from "../../../src/server/ai/modules/tax-adjustments-shared/submodule-catalog.v1";
import { TaxAdjustmentModuleCodeV1Schema } from "../../../src/shared/contracts/tax-adjustments.v1";

describe("tax adjustments submodule catalog v1", () => {
  it("lists the full canonical scaffold catalog with unique module metadata", () => {
    expect(TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1).toHaveLength(23);

    const moduleCodes = TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1.map(
      (entry) => entry.moduleCode,
    );
    const moduleIds = TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1.map(
      (entry) => entry.moduleId,
    );
    const promptVersions = TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1.map(
      (entry) => entry.promptVersion,
    );

    expect(new Set(moduleCodes).size).toBe(moduleCodes.length);
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(promptVersions).size).toBe(promptVersions.length);

    for (const moduleCode of moduleCodes) {
      expect(TaxAdjustmentModuleCodeV1Schema.safeParse(moduleCode).success).toBe(
        true,
      );
    }
  });

  it("returns a defensive copy when listing the catalog", () => {
    const listed = listTaxAdjustmentSubmoduleCatalogV1();
    expect(listed).toEqual(TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1);
    expect(listed).not.toBe(TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1);
  });
});
