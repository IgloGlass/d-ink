import { describe, expect, it } from "vitest";

import {
  sniffBinaryContentKindV1,
  validateAnnualReportFileTypeCoherenceV1,
  validateTrialBalanceFileTypeCoherenceV1,
} from "../../../src/server/security/file-type-coherence.v1";

describe("file type coherence security checks v1", () => {
  it("sniffs core binary kinds from magic bytes", () => {
    expect(
      sniffBinaryContentKindV1(
        Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
      ),
    ).toBe("pdf");
    expect(
      sniffBinaryContentKindV1(
        Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
      ),
    ).toBe("zip");
    expect(
      sniffBinaryContentKindV1(
        Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ).toBe("ole");
    expect(
      sniffBinaryContentKindV1(new TextEncoder().encode("Account Name,Amount")),
    ).toBe("text");
  });

  it("rejects trial-balance extension/content mismatches", () => {
    const mismatch = validateTrialBalanceFileTypeCoherenceV1({
      fileName: "tb.xlsx",
      fileBytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
    });

    expect(mismatch).not.toBeNull();
    expect(mismatch?.reason).toBe("file_type_content_mismatch");
    expect(mismatch?.detectedContentKind).toBe("pdf");
  });

  it("allows pdf-text fallback for annual extraction but rejects docx-text mismatch", () => {
    const pdfText = validateAnnualReportFileTypeCoherenceV1({
      fileName: "annual-report.pdf",
      fileBytes: new TextEncoder().encode("Company Name: Acme AB"),
    });
    expect(pdfText).toBeNull();

    const docxText = validateAnnualReportFileTypeCoherenceV1({
      fileName: "annual-report.docx",
      fileBytes: new TextEncoder().encode("Company Name: Acme AB"),
    });
    expect(docxText).not.toBeNull();
    expect(docxText?.allowedContentKinds).toEqual(["zip"]);
  });
});
