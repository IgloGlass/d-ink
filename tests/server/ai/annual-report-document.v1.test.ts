import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { prepareAnnualReportDocumentV1 } from "../../../src/server/ai/document-prep/annual-report-document.v1";
import { parseAnnualReportSourceTextForAiV1 } from "../../../src/server/parsing/annual-report-source-text.v1";

function encodeBase64V1(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

describe("annual report document preparation v1", () => {
  it("keeps PDFs as inline documents for Gemini and extracts page text for routing", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([600, 800]);
    page.drawText("Resultaträkning 15", {
      x: 40,
      y: 760,
      size: 16,
      font,
    });
    const bytes = await pdf.save();

    const parsed = await parseAnnualReportSourceTextForAiV1({
      fileBytes: bytes,
      fileType: "pdf",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const prepared = prepareAnnualReportDocumentV1({
      fileBytes: bytes,
      sourceText: parsed.sourceText,
      toBase64: encodeBase64V1,
    });

    expect(prepared.fileType).toBe("pdf");
    expect(prepared.inlineDataBase64).toBeTruthy();
    expect(prepared.mimeType).toBe("application/pdf");
    expect(prepared.parserVersion).toContain("unpdf");
    expect(prepared.pageCount).toBe(1);
    expect(prepared.executionProfile).toBe("scanned_or_low_text_pdf");
    expect(prepared.pageTexts).toEqual([expect.stringContaining("Resultaträkning 15")]);
    expect(prepared.text).toContain("Resultaträkning 15");
  });

  it("extracts DOCX document text for Gemini text prompts", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      "<w:document><w:body><w:p><w:r><w:t>Acme AB</w:t></w:r></w:p><w:p><w:r><w:t>Resultat fore skatt 1000</w:t></w:r></w:p></w:body></w:document>",
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const parsed = await parseAnnualReportSourceTextForAiV1({
      fileBytes: bytes,
      fileType: "docx",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const prepared = prepareAnnualReportDocumentV1({
      fileBytes: bytes,
      sourceText: parsed.sourceText,
      toBase64: encodeBase64V1,
    });

    expect(prepared.fileType).toBe("docx");
    expect(prepared.executionProfile).toBe("docx");
    expect(prepared.inlineDataBase64).toBeUndefined();
    expect(prepared.text).toContain("Acme AB");
    expect(prepared.text).toContain("Resultat fore skatt 1000");
  });
});
