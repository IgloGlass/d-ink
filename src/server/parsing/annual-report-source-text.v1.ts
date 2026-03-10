import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

import {
  type AnnualReportPdfClassificationV1,
  type AnnualReportSourceTextV1,
  parseAnnualReportSourceTextV1,
} from "../../shared/contracts/annual-report-source-text.v1";
import type { AnnualReportFileTypeV1 } from "../../shared/contracts/annual-report-extraction.v1";

const ANNUAL_REPORT_SOURCE_TEXT_PARSER_VERSION_V1 =
  "annual-report-source-text.v1/unpdf-1.4.0";

export type ParseAnnualReportSourceTextRequestV1 = {
  fileBytes: Uint8Array;
  fileType: AnnualReportFileTypeV1;
};

export type ParseAnnualReportSourceTextResultV1 =
  | {
      ok: true;
      sourceText: AnnualReportSourceTextV1;
    }
  | {
      ok: false;
      error: {
        code: "INPUT_INVALID" | "PARSE_FAILED";
        message: string;
        user_message: string;
        context: Record<string, unknown>;
      };
    };

function normalizeTextV1(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocxTextV1(fileBytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(fileBytes);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) {
    throw new Error("DOCX file is missing word/document.xml.");
  }

  return normalizeTextV1(
    documentXml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab[^>]*\/>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

async function extractPdfTextV1(fileBytes: Uint8Array): Promise<{
  pageCount: number;
  pageTexts: string[];
  text: string;
}> {
  const pdf = await getDocumentProxy(Uint8Array.from(fileBytes));
  try {
    const extracted = await extractText(pdf, { mergePages: false });
    const pageTexts = extracted.text.map((pageText) => normalizeTextV1(pageText));

    return {
      pageCount: extracted.totalPages,
      pageTexts,
      text: normalizeTextV1(pageTexts.join("\n\n")),
    };
  } finally {
    if (typeof pdf.destroy === "function") {
      await pdf.destroy();
    }
  }
}

function classifyPdfTextV1(input: {
  pageTexts: string[];
  text: string;
}): AnnualReportSourceTextV1["pdfAnalysis"] {
  const nonEmptyPageCount = input.pageTexts.filter((page) => page.length > 20).length;
  const totalExtractedChars = input.text.length;
  const averageCharsPerPage =
    input.pageTexts.length > 0 ? totalExtractedChars / input.pageTexts.length : 0;
  const nonEmptyPageRatio =
    input.pageTexts.length > 0 ? nonEmptyPageCount / input.pageTexts.length : 0;
  const frontMatterText = input.pageTexts.slice(0, 5).join("\n").toLowerCase();
  const hasMetadataSignals =
    /årsredovisning|förvaltningsberättelse|org\.?\s*nr|organisationsnummer|räkenskapsår|\bk2\b|\bk3\b/.test(
      frontMatterText,
    );
  const hasStatementSignals =
    input.pageTexts.some((pageText) =>
      /resultaträkning|balansräkning|kassaflödesanalys/i.test(pageText),
    );
  const classification: AnnualReportPdfClassificationV1 =
    totalExtractedChars >= 40 &&
    averageCharsPerPage >= 15 &&
    nonEmptyPageRatio >= 0.2 &&
    (hasMetadataSignals || hasStatementSignals)
      ? "extractable_text_pdf"
      : "scanned_or_low_text_pdf";

  return {
    classification,
    averageCharsPerPage,
    nonEmptyPageCount,
    nonEmptyPageRatio,
    totalExtractedChars,
  };
}

export async function parseAnnualReportSourceTextForAiV1(
  input: ParseAnnualReportSourceTextRequestV1,
): Promise<ParseAnnualReportSourceTextResultV1> {
  if (!(input.fileBytes instanceof Uint8Array) || input.fileBytes.byteLength === 0) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Annual-report source text request did not include file bytes.",
        user_message: "The uploaded annual report could not be read.",
        context: {},
      },
    };
  }

  try {
    if (input.fileType === "pdf") {
      const extracted = await extractPdfTextV1(input.fileBytes);
      const pdfAnalysis = classifyPdfTextV1(extracted);

      return {
        ok: true,
        sourceText: parseAnnualReportSourceTextV1({
          schemaVersion: "annual_report_source_text_v1",
          fileType: input.fileType,
          text: extracted.text,
          pageTexts: extracted.pageTexts,
          pageCount: extracted.pageCount,
          textSource: "pdf_unpdf_text",
          parserVersion: ANNUAL_REPORT_SOURCE_TEXT_PARSER_VERSION_V1,
          pdfAnalysis,
          warnings: [],
        }),
      };
    }

    const text = await extractDocxTextV1(input.fileBytes);
    if (text.length === 0) {
      return {
        ok: false,
        error: {
          code: "PARSE_FAILED",
          message: "DOCX text extraction completed but returned no readable text.",
          user_message: "The annual report document could not be parsed into readable text.",
          context: {
            fileType: input.fileType,
          },
        },
      };
    }

    return {
      ok: true,
      sourceText: parseAnnualReportSourceTextV1({
        schemaVersion: "annual_report_source_text_v1",
        fileType: input.fileType,
        text,
        pageTexts: [],
        pageCount: 0,
        textSource: "docx_document_xml",
        parserVersion: ANNUAL_REPORT_SOURCE_TEXT_PARSER_VERSION_V1,
        pdfAnalysis: undefined,
        warnings: [],
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unknown annual-report source text parsing failure.",
        user_message:
          "The annual report could not be parsed for AI analysis. Upload the report again or contact your administrator.",
        context: {
          fileType: input.fileType,
        },
      },
    };
  }
}
