import { describe, expect, it } from "vitest";

import {
  getInk2FieldDefinitionV1,
  listInk2FieldDefinitionsBySectionV1,
} from "../../../src/shared/contracts/ink2-layout.v1";

describe("ink2 layout v1", () => {
  it("uses official Swedish labels with diacritics for key INK2 rows", () => {
    expect(getInk2FieldDefinitionV1("1.1")?.label).toBe(
      "Överskott av näringsverksamhet",
    );
    expect(getInk2FieldDefinitionV1("3.1")?.label).toBe("Nettoomsättning");
    expect(getInk2FieldDefinitionV1("3.26")?.label).toBe(
      "Skatt på årets resultat",
    );
    expect(getInk2FieldDefinitionV1("3.27")?.label).toBe(
      "Årets resultat, vinst (flyttas till p. 4.1)",
    );
    expect(getInk2FieldDefinitionV1("4.3c")?.label).toBe(
      "Andra bokförda kostnader",
    );
    expect(getInk2FieldDefinitionV1("4.10")?.label).toBe(
      "Skattemässig korrigering av bokfört resultat vid avyttring av näringsfastighet och näringsbostadsrätt",
    );
    expect(getInk2FieldDefinitionV1("4.15")?.label).toBe(
      "Överskott (flyttas till p. 1.1 på sid. 1)",
    );
  });

  it("keeps official section wording for INK2S", () => {
    expect(getInk2FieldDefinitionV1("4.3a")?.subsection).toBe(
      "4.3 Bokförda kostnader som inte ska dras av",
    );
    expect(getInk2FieldDefinitionV1("4.6a")?.subsection).toBe(
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
    );
    expect(getInk2FieldDefinitionV1("4.17")?.subsection).toBe(
      "Övriga uppgifter",
    );
  });

  it("exposes the expected PDF sections for the polished UI", () => {
    expect(
      listInk2FieldDefinitionsBySectionV1("page_1").length,
    ).toBeGreaterThan(0);
    expect(
      listInk2FieldDefinitionsBySectionV1("ink2r_balance").length,
    ).toBeGreaterThan(0);
    expect(
      listInk2FieldDefinitionsBySectionV1("ink2r_income").length,
    ).toBeGreaterThan(0);
    expect(listInk2FieldDefinitionsBySectionV1("ink2s").length).toBeGreaterThan(
      0,
    );
  });

  it("tracks the official two-column page flow for the UI layout", () => {
    expect(getInk2FieldDefinitionV1("1.1")?.layoutColumn).toBe("left");
    expect(getInk2FieldDefinitionV1("1.4")?.layoutColumn).toBe("right");
    expect(getInk2FieldDefinitionV1("2.26")?.layoutColumn).toBe("left");
    expect(getInk2FieldDefinitionV1("2.27")?.layoutColumn).toBe("right");
    expect(getInk2FieldDefinitionV1("3.14")?.layoutColumn).toBe("left");
    expect(getInk2FieldDefinitionV1("3.15")?.layoutColumn).toBe("right");
    expect(getInk2FieldDefinitionV1("4.9")?.layoutColumn).toBe("left");
    expect(getInk2FieldDefinitionV1("4.10")?.layoutColumn).toBe("right");
  });
});
