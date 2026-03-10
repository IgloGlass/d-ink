import type { AnnualReportFileTypeV1 } from "../../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportSourceTextV1 } from "../../../shared/contracts/annual-report-source-text.v1";
import type { AnnualReportCoreFactsSeedV1 } from "../../parsing/annual-report-core-facts-seed.v1";
import type { AnnualReportPreparedPdfRoutingV1 } from "../../parsing/annual-report-page-routing.v1";

export type AnnualReportPreparedDocumentV1 = {
  coreFactsSeed?: AnnualReportCoreFactsSeedV1;
  fileType: AnnualReportFileTypeV1;
  mimeType: string;
  inlineDataBase64?: string;
  executionProfile?: "extractable_text_pdf" | "scanned_or_low_text_pdf" | "docx";
  pageCount?: number;
  pageTexts?: string[];
  parserVersion?: string;
  parseWarnings?: string[];
  pdfRouting?: AnnualReportPreparedPdfRoutingV1;
  sourcePdfBytes?: Uint8Array;
  sourceText?: AnnualReportSourceTextV1;
  uri?: string;
  text: string;
};

/**
 * Prepares annual report documents for Gemini without leaking provider details upward.
 *
 * Safety boundary:
 * - Parsing owns file-format handling and page-text extraction.
 * - AI document prep only attaches provider-safe document parts and normalized text.
 */
export function prepareAnnualReportDocumentV1(input: {
  fileBytes: Uint8Array;
  pdfRouting?: AnnualReportPreparedPdfRoutingV1;
  sourceText: AnnualReportSourceTextV1;
  toBase64: (bytes: Uint8Array) => string;
}): AnnualReportPreparedDocumentV1 {
  if (input.sourceText.fileType === "pdf") {
    const inlineDataBase64 = input.toBase64(Uint8Array.from(input.fileBytes));
    return {
      fileType: "pdf",
      mimeType: "application/pdf",
      executionProfile:
        input.sourceText.pdfAnalysis?.classification ?? "extractable_text_pdf",
      inlineDataBase64,
      coreFactsSeed: input.pdfRouting?.coreFactsSeed,
      pageCount: input.sourceText.pageCount,
      pageTexts: input.sourceText.pageTexts,
      parserVersion: input.sourceText.parserVersion,
      parseWarnings: input.sourceText.warnings,
      pdfRouting: input.pdfRouting,
      sourcePdfBytes: input.fileBytes,
      sourceText: input.sourceText,
      text: input.sourceText.text,
    };
  }

  return {
    fileType: "docx",
    executionProfile: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pageCount: input.sourceText.pageCount,
    parserVersion: input.sourceText.parserVersion,
    parseWarnings: input.sourceText.warnings,
    sourceText: input.sourceText,
    text: input.sourceText.text,
  };
}

export function prepareAnnualReportUriDocumentV1(input: {
  fileType: "pdf";
  mimeType: string;
  uri: string;
}): AnnualReportPreparedDocumentV1 {
  return {
    fileType: input.fileType,
    mimeType: input.mimeType,
    uri: input.uri,
    text: "",
  };
}
