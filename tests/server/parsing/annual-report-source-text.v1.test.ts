import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { parseAnnualReportSourceTextForAiV1 } from "../../../src/server/parsing/annual-report-source-text.v1";

describe("annual report source text parsing v1", () => {
  it("extracts per-page text from PDFs without runtime asset URLs", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const pageOne = pdf.addPage([600, 800]);
    pageOne.drawText("Innehåll\nResultaträkning 15\nBalansräkning 16-17", {
      x: 40,
      y: 760,
      size: 14,
      font,
      lineHeight: 18,
    });
    const pageTwo = pdf.addPage([600, 800]);
    pageTwo.drawText("Resultaträkning", {
      x: 40,
      y: 760,
      size: 14,
      font,
    });

    const bytes = await pdf.save();
    const result = await parseAnnualReportSourceTextForAiV1({
      fileBytes: bytes,
      fileType: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.sourceText.parserVersion).toContain("unpdf");
    expect(result.sourceText.pageCount).toBe(2);
    expect(result.sourceText.pageTexts).toEqual([
      expect.stringContaining("Resultaträkning 15"),
      expect.stringContaining("Resultaträkning"),
    ]);
    expect(result.sourceText.text).toContain("Balansräkning 16-17");
    expect(result.sourceText.pdfAnalysis?.classification).toBe("extractable_text_pdf");
  });

  it("classifies low-text PDFs as scanned_or_low_text_pdf instead of failing parsing", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    page.drawText("X", {
      x: 40,
      y: 760,
      size: 10,
    });

    const bytes = await pdf.save();
    const result = await parseAnnualReportSourceTextForAiV1({
      fileBytes: bytes,
      fileType: "pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.sourceText.pdfAnalysis?.classification).toBe(
      "scanned_or_low_text_pdf",
    );
  });
});
