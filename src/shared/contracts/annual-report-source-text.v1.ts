import { z } from "zod";

import { AnnualReportFileTypeV1Schema } from "./annual-report-extraction.v1";

export const AnnualReportSourceTextOriginV1Schema = z.enum([
  "pdf_unpdf_text",
  "docx_document_xml",
]);
export type AnnualReportSourceTextOriginV1 = z.infer<
  typeof AnnualReportSourceTextOriginV1Schema
>;

export const AnnualReportPdfClassificationV1Schema = z.enum([
  "extractable_text_pdf",
  "scanned_or_low_text_pdf",
]);
export type AnnualReportPdfClassificationV1 = z.infer<
  typeof AnnualReportPdfClassificationV1Schema
>;

export const AnnualReportPdfAnalysisV1Schema = z
  .object({
    classification: AnnualReportPdfClassificationV1Schema,
    averageCharsPerPage: z.number().nonnegative(),
    nonEmptyPageCount: z.number().int().nonnegative(),
    nonEmptyPageRatio: z.number().min(0).max(1),
    totalExtractedChars: z.number().int().nonnegative(),
  })
  .strict();
export type AnnualReportPdfAnalysisV1 = z.infer<
  typeof AnnualReportPdfAnalysisV1Schema
>;

/**
 * Public parsing-layer contract for prepared annual-report source text.
 *
 * Safety boundary:
 * - Parsing owns file-format handling and page-text extraction.
 * - Downstream AI code consumes normalized text only and must not reach into parser internals.
 */
export const AnnualReportSourceTextV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_source_text_v1"),
    fileType: AnnualReportFileTypeV1Schema,
    text: z.string(),
    pageTexts: z.array(z.string()).default([]),
    pageCount: z.number().int().nonnegative(),
    textSource: AnnualReportSourceTextOriginV1Schema,
    parserVersion: z.string().trim().min(1),
    pdfAnalysis: AnnualReportPdfAnalysisV1Schema.optional(),
    warnings: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
export type AnnualReportSourceTextV1 = z.infer<
  typeof AnnualReportSourceTextV1Schema
>;

export function parseAnnualReportSourceTextV1(input: unknown): AnnualReportSourceTextV1 {
  return AnnualReportSourceTextV1Schema.parse(input);
}
