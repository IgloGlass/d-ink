import { describe, expect, it } from "vitest";

import { prepareAnnualReportPdfRoutingV1 } from "../../../src/server/parsing/annual-report-page-routing.v1";
import { parseAnnualReportSourceTextV1 } from "../../../src/shared/contracts/annual-report-source-text.v1";

describe("annual report page routing v1", () => {
  it("keeps asset and finance note routing focused on numbered note pages for Deloitte-style reports", () => {
    const pageTexts = Array.from({ length: 32 }, (_, index) => `Page ${index + 1}`);
    pageTexts[0] = "Deloitte AB\nOrg. nr 556271-5309\nÅrsredovisning för räkenskapsåret 1 juni 2024 – 31 maj 2025";
    pageTexts[1] =
      "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
    pageTexts[14] = "Resultaträkning\nResultat före skatt 545 286 771 473\nBelopp i KSEK";
    pageTexts[15] = "Balansräkning\nBelopp i KSEK";
    pageTexts[16] = "Balansräkning, forts.\nBelopp i KSEK";
    pageTexts[19] =
      "Redovisningsprinciper\nBokföringsnämndens allmänna råd BFNAR 2012:1 Årsredovisning och koncernredovisning (K3).";
    pageTexts[20] = "Fortsatta redovisningsprinciper\nGoodwill behandlas enligt K3.";
    pageTexts[21] = "Fortsatta redovisningsprinciper";
    pageTexts[22] = "Fortsatta redovisningsprinciper\nUtdelning och räntor.";
    pageTexts[23] = "Not 3 Leasingavtal\nNot 4 Upplysning om ersättning till revisorn";
    pageTexts[24] =
      "Not 5 Antal anställda, löner, andra ersättningar och sociala kostnader\nNot 6 Övriga ränteintäkter och liknande intäkter\nNot 7 Räntekostnader och liknande kostnader";
    pageTexts[25] =
      "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter och liknande rättigheter\nNot 11 Goodwill";
    pageTexts[26] =
      "Not 12 Programvaror\nNot 13 Övriga immateriella tillgångar\nNot 14 Byggnader och mark";
    pageTexts[27] =
      "Not 15 Inventarier\nNot 16 Datorer\nNot 17 Förbättringsutgifter på annans fastighet";
    pageTexts[28] =
      "Not 18 Andelar i koncernföretag\nNot 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav";
    pageTexts[29] = "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder";
    pageTexts[30] = "Not 27 Fusion\nNot 28 Ställda säkerheter och eventualförpliktelser";

    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: pageTexts.join("\n\n"),
      pageTexts,
      pageCount: pageTexts.length,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 120,
        nonEmptyPageCount: pageTexts.length,
        nonEmptyPageRatio: 1,
        totalExtractedChars: pageTexts.join("").length,
      },
      warnings: [],
    });

    const routing = prepareAnnualReportPdfRoutingV1({ sourceText });

    expect(routing.warnings).toEqual(
      expect.arrayContaining([
        "routing.tax_notes_assets.final=pages 26-28",
        "routing.tax_notes_finance.final=pages 24-26, 29-31",
      ]),
    );
    expect(routing.coreFactsSeed.fields.accountingStandard?.normalizedValue).toBe("K3");
    expect(routing.coreFactsSeed.fields.fiscalYearStart?.normalizedValue).toBe("2024-06-01");
    expect(routing.coreFactsSeed.fields.fiscalYearEnd?.normalizedValue).toBe("2025-05-31");
  });
});
