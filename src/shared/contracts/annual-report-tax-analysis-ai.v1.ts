import { z } from "zod";

import {
  AnnualReportTaxAnalysisFindingV1Schema,
} from "./annual-report-tax-analysis.v1";

export const AnnualReportTaxAnalysisAiResultV1Schema = z
  .object({
    // Gemini often returns generic versions like "1.0.0" here. Normalize the
    // field so annual-report tax analysis still validates on the real content.
    schemaVersion: z
      .literal("annual_report_tax_analysis_ai_v1")
      .catch("annual_report_tax_analysis_ai_v1"),
    executiveSummary: z.string().trim().min(1),
    accountingStandardAssessment: z
      .object({
        status: z.enum(["aligned", "needs_review", "unclear"]),
        rationale: z.string().trim().min(1),
      })
      .strict(),
    findings: z.array(AnnualReportTaxAnalysisFindingV1Schema),
    missingInformation: z.array(z.string().trim().min(1)).default([]),
    recommendedNextActions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
export type AnnualReportTaxAnalysisAiResultV1 = z.infer<
  typeof AnnualReportTaxAnalysisAiResultV1Schema
>;

export function parseAnnualReportTaxAnalysisAiResultV1(
  input: unknown,
): AnnualReportTaxAnalysisAiResultV1 {
  return AnnualReportTaxAnalysisAiResultV1Schema.parse(input);
}
