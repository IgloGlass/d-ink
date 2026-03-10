import { z } from "zod";

import {
  type AnnualReportExtractionPayloadV1,
  AnnualReportExtractionPayloadV1Schema,
  AnnualReportFileTypeV1Schema,
  AnnualReportRuntimeMetadataV1Schema,
} from "./annual-report-extraction.v1";
import { IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

export const AnnualReportProcessingRunStatusV1Schema = z.enum([
  "queued",
  "uploading_source",
  "locating_sections",
  "extracting_core_facts",
  "extracting_statements",
  "extracting_tax_notes",
  "running_tax_analysis",
  "completed",
  "partial",
  "failed",
  "cancelled",
  "superseded",
]);
export type AnnualReportProcessingRunStatusV1 = z.infer<
  typeof AnnualReportProcessingRunStatusV1Schema
>;

export const AnnualReportProcessingRunErrorV1Schema = z
  .object({
    code: z.string().trim().min(1),
    userMessage: z.string().trim().min(1),
    technicalMessage: z.string().trim().min(1).optional(),
  })
  .strict();
export type AnnualReportProcessingRunErrorV1 = z.infer<
  typeof AnnualReportProcessingRunErrorV1Schema
>;

export const AnnualReportProcessingRunResultRefsV1Schema = z
  .object({
    extractionArtifactId: UuidV4Schema.optional(),
    taxAnalysisArtifactId: UuidV4Schema.optional(),
  })
  .strict();
export type AnnualReportProcessingRunResultRefsV1 = z.infer<
  typeof AnnualReportProcessingRunResultRefsV1Schema
>;

export const AnnualReportProcessingFallbackDetailV1Schema = z
  .object({
    stage: z.string().trim().min(1),
    strategy: z.string().trim().min(1),
    attempts: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).optional(),
  })
  .strict();
export type AnnualReportProcessingFallbackDetailV1 = z.infer<
  typeof AnnualReportProcessingFallbackDetailV1Schema
>;

export const AnnualReportProcessingRunDegradationV1Schema = z
  .object({
    mode: z.enum([
      "none",
      "partial_with_analysis",
      "partial_without_analysis",
    ]),
    warnings: z.array(z.string().trim().min(1)).default([]),
    fallbacks: z.array(AnnualReportProcessingFallbackDetailV1Schema).default([]),
  })
  .strict();
export type AnnualReportProcessingRunDegradationV1 = z.infer<
  typeof AnnualReportProcessingRunDegradationV1Schema
>;

export const AnnualReportProcessingRunV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_processing_run_v1"),
    runId: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    sourceFileName: z.string().trim().min(1),
    sourceFileType: AnnualReportFileTypeV1Schema,
    status: AnnualReportProcessingRunStatusV1Schema,
    statusMessage: z.string().trim().min(1),
    technicalDetails: z.array(z.string().trim().min(1)).default([]),
    error: AnnualReportProcessingRunErrorV1Schema.optional(),
    degradation: AnnualReportProcessingRunDegradationV1Schema.optional(),
    previewExtraction: AnnualReportExtractionPayloadV1Schema.optional(),
    result: AnnualReportProcessingRunResultRefsV1Schema.optional(),
    runtime: AnnualReportRuntimeMetadataV1Schema.optional(),
    hasPreviousActiveResult: z.boolean().default(false),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    startedAt: IsoDateTimeSchema.optional(),
    finishedAt: IsoDateTimeSchema.optional(),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type AnnualReportProcessingRunV1 = z.infer<
  typeof AnnualReportProcessingRunV1Schema
>;

export type AnnualReportProcessingRunPreviewV1 =
  AnnualReportExtractionPayloadV1 | undefined;

export const CreateAnnualReportProcessingRunRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileType: AnnualReportFileTypeV1Schema.optional(),
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type CreateAnnualReportProcessingRunRequestV1 = z.infer<
  typeof CreateAnnualReportProcessingRunRequestV1Schema
>;

export const AnnualReportProcessingRunFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.enum([
          "INPUT_INVALID",
          "WORKSPACE_NOT_FOUND",
          "PROCESSING_RUN_NOT_FOUND",
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
export type AnnualReportProcessingRunFailureV1 = z.infer<
  typeof AnnualReportProcessingRunFailureV1Schema
>;

export const CreateAnnualReportProcessingRunSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    run: AnnualReportProcessingRunV1Schema,
  })
  .strict();
export type CreateAnnualReportProcessingRunSuccessV1 = z.infer<
  typeof CreateAnnualReportProcessingRunSuccessV1Schema
>;

export const CreateAnnualReportProcessingRunResultV1Schema =
  z.discriminatedUnion("ok", [
    CreateAnnualReportProcessingRunSuccessV1Schema,
    AnnualReportProcessingRunFailureV1Schema,
  ]);
export type CreateAnnualReportProcessingRunResultV1 = z.infer<
  typeof CreateAnnualReportProcessingRunResultV1Schema
>;

export const GetLatestAnnualReportProcessingRunResultV1Schema =
  z.discriminatedUnion("ok", [
    z
      .object({
        ok: z.literal(true),
        run: AnnualReportProcessingRunV1Schema,
      })
      .strict(),
    AnnualReportProcessingRunFailureV1Schema,
  ]);
export type GetLatestAnnualReportProcessingRunResultV1 = z.infer<
  typeof GetLatestAnnualReportProcessingRunResultV1Schema
>;

export const AnnualReportProcessingQueueMessageV1Schema = z
  .object({
    runId: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();
export type AnnualReportProcessingQueueMessageV1 = z.infer<
  typeof AnnualReportProcessingQueueMessageV1Schema
>;

export function parseAnnualReportProcessingRunV1(
  input: unknown,
): AnnualReportProcessingRunV1 {
  return AnnualReportProcessingRunV1Schema.parse(input);
}

export function parseCreateAnnualReportProcessingRunResultV1(
  input: unknown,
): CreateAnnualReportProcessingRunResultV1 {
  return CreateAnnualReportProcessingRunResultV1Schema.parse(input);
}

export function parseGetLatestAnnualReportProcessingRunResultV1(
  input: unknown,
): GetLatestAnnualReportProcessingRunResultV1 {
  return GetLatestAnnualReportProcessingRunResultV1Schema.parse(input);
}
