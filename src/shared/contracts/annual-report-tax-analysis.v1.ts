import { z } from "zod";

import { AiRunMetadataV1Schema } from "./ai-run.v1";
import {
  AnnualReportEvidenceReferenceV1Schema,
  AnnualReportTaxDeepExtractionV1Schema,
} from "./annual-report-extraction.v1";
import { AnnualReportProcessingRunV1Schema } from "./annual-report-processing-run.v1";
import { UuidV4Schema } from "./common.v1";

export const AnnualReportTaxRiskSeverityV1Schema = z.enum([
  "low",
  "medium",
  "high",
]);
export type AnnualReportTaxRiskSeverityV1 = z.infer<
  typeof AnnualReportTaxRiskSeverityV1Schema
>;

export const AnnualReportTaxAnalysisFindingV1Schema = z
  .object({
    id: z.string().trim().min(1),
    area: z.string().trim().min(1),
    title: z.string().trim().min(1),
    severity: AnnualReportTaxRiskSeverityV1Schema,
    rationale: z.string().trim().min(1),
    recommendedFollowUp: z.string().trim().min(1).optional(),
    missingInformation: z.array(z.string().trim().min(1)).default([]),
    policyRuleReference: z.string().trim().min(1),
    evidence: z.array(AnnualReportEvidenceReferenceV1Schema).default([]),
  })
  .strict();
export type AnnualReportTaxAnalysisFindingV1 = z.infer<
  typeof AnnualReportTaxAnalysisFindingV1Schema
>;

export const AnnualReportTaxAnalysisReviewModeV1Schema = z.enum([
  "full_ai",
  "deterministic_fallback",
  "extraction_only",
]);
export type AnnualReportTaxAnalysisReviewModeV1 = z.infer<
  typeof AnnualReportTaxAnalysisReviewModeV1Schema
>;

export const AnnualReportTaxAnalysisReviewStateV1Schema = z
  .object({
    mode: AnnualReportTaxAnalysisReviewModeV1Schema,
    reasons: z.array(z.string().trim().min(1)).default([]),
    sourceDocumentAvailable: z.boolean(),
    sourceDocumentUsed: z.boolean(),
  })
  .strict();
export type AnnualReportTaxAnalysisReviewStateV1 = z.infer<
  typeof AnnualReportTaxAnalysisReviewStateV1Schema
>;

export const AnnualReportTaxAnalysisPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_tax_analysis_v1"),
    sourceExtractionArtifactId: UuidV4Schema,
    policyVersion: z.string().trim().min(1),
    basedOn: AnnualReportTaxDeepExtractionV1Schema,
    executiveSummary: z.string().trim().min(1),
    accountingStandardAssessment: z
      .object({
        status: z.enum(["aligned", "needs_review", "unclear"]),
        rationale: z.string().trim().min(1),
      })
      .strict(),
    reviewState: AnnualReportTaxAnalysisReviewStateV1Schema.optional(),
    findings: z.array(AnnualReportTaxAnalysisFindingV1Schema),
    missingInformation: z.array(z.string().trim().min(1)).default([]),
    recommendedNextActions: z.array(z.string().trim().min(1)).default([]),
    aiRun: AiRunMetadataV1Schema.optional(),
  })
  .strict();
export type AnnualReportTaxAnalysisPayloadV1 = z.infer<
  typeof AnnualReportTaxAnalysisPayloadV1Schema
>;

export const ActiveAnnualReportTaxAnalysisRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("annual_report_tax_analysis_v1"),
  })
  .strict();
export type ActiveAnnualReportTaxAnalysisRefV1 = z.infer<
  typeof ActiveAnnualReportTaxAnalysisRefV1Schema
>;

export const RunAnnualReportTaxAnalysisRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveExtraction: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
        schemaVersion: z.literal("annual_report_extraction_v1").optional(),
      })
      .strict()
      .optional(),
    requestedByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type RunAnnualReportTaxAnalysisRequestV1 = z.infer<
  typeof RunAnnualReportTaxAnalysisRequestV1Schema
>;

export const AnnualReportTaxAnalysisFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum([
          "INPUT_INVALID",
          "WORKSPACE_NOT_FOUND",
          "EXTRACTION_NOT_FOUND",
          "STATE_CONFLICT",
          "TAX_ANALYSIS_NOT_FOUND",
          "PROCESSING_RUN_UNAVAILABLE",
          "PERSISTENCE_ERROR",
        ]),
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type AnnualReportTaxAnalysisFailureV1 = z.infer<
  typeof AnnualReportTaxAnalysisFailureV1Schema
>;

export const RunAnnualReportTaxAnalysisSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    run: AnnualReportProcessingRunV1Schema.optional(),
    active: ActiveAnnualReportTaxAnalysisRefV1Schema.optional(),
    taxAnalysis: AnnualReportTaxAnalysisPayloadV1Schema.optional(),
  })
  .strict();
export type RunAnnualReportTaxAnalysisSuccessV1 = z.infer<
  typeof RunAnnualReportTaxAnalysisSuccessV1Schema
>;

export const RunAnnualReportTaxAnalysisResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    RunAnnualReportTaxAnalysisSuccessV1Schema,
    AnnualReportTaxAnalysisFailureV1Schema,
  ],
);
export type RunAnnualReportTaxAnalysisResultV1 = z.infer<
  typeof RunAnnualReportTaxAnalysisResultV1Schema
>;

export const GetActiveAnnualReportTaxAnalysisResultV1Schema =
  z.discriminatedUnion("ok", [
    z
      .object({
        ok: z.literal(true),
        active: ActiveAnnualReportTaxAnalysisRefV1Schema,
        taxAnalysis: AnnualReportTaxAnalysisPayloadV1Schema,
      })
      .strict(),
    AnnualReportTaxAnalysisFailureV1Schema,
  ]);
export type GetActiveAnnualReportTaxAnalysisResultV1 = z.infer<
  typeof GetActiveAnnualReportTaxAnalysisResultV1Schema
>;

export function parseAnnualReportTaxAnalysisPayloadV1(
  input: unknown,
): AnnualReportTaxAnalysisPayloadV1 {
  return AnnualReportTaxAnalysisPayloadV1Schema.parse(input);
}

export function parseGetActiveAnnualReportTaxAnalysisResultV1(
  input: unknown,
): GetActiveAnnualReportTaxAnalysisResultV1 {
  return GetActiveAnnualReportTaxAnalysisResultV1Schema.parse(input);
}

export function parseRunAnnualReportTaxAnalysisResultV1(
  input: unknown,
): RunAnnualReportTaxAnalysisResultV1 {
  return RunAnnualReportTaxAnalysisResultV1Schema.parse(input);
}
