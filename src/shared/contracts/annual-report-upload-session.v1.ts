import { z } from "zod";

import {
  type AnnualReportFileTypeV1,
  AnnualReportFileTypeV1Schema,
} from "./annual-report-extraction.v1";
import {
  AnnualReportProcessingRunV1Schema,
  type AnnualReportProcessingRunFailureV1,
  AnnualReportProcessingRunFailureV1Schema,
} from "./annual-report-processing-run.v1";
import { IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

export const MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1 = 25 * 1024 * 1024;

export const AnnualReportUploadSessionStatusV1Schema = z.enum([
  "created",
  "uploaded",
  "consumed",
  "expired",
]);
export type AnnualReportUploadSessionStatusV1 = z.infer<
  typeof AnnualReportUploadSessionStatusV1Schema
>;

export const AnnualReportUploadSessionV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_upload_session_v1"),
    uploadSessionId: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileType: AnnualReportFileTypeV1Schema,
    fileSizeBytes: z.number().int().positive(),
    policyVersion: z.string().trim().min(1),
    uploadUrl: z.string().trim().min(1),
    maxSizeBytes: z.number().int().positive(),
    expiresAt: IsoDateTimeSchema,
    status: AnnualReportUploadSessionStatusV1Schema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type AnnualReportUploadSessionV1 = z.infer<
  typeof AnnualReportUploadSessionV1Schema
>;

export const CreateAnnualReportUploadSessionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileType: AnnualReportFileTypeV1Schema,
    fileSizeBytes: z.number().int().positive(),
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type CreateAnnualReportUploadSessionRequestV1 = z.infer<
  typeof CreateAnnualReportUploadSessionRequestV1Schema
>;

export const CreateAnnualReportUploadSessionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    session: AnnualReportUploadSessionV1Schema,
  })
  .strict();
export type CreateAnnualReportUploadSessionSuccessV1 = z.infer<
  typeof CreateAnnualReportUploadSessionSuccessV1Schema
>;

export const CreateAnnualReportUploadSessionResultV1Schema =
  z.discriminatedUnion("ok", [
    CreateAnnualReportUploadSessionSuccessV1Schema,
    AnnualReportProcessingRunFailureV1Schema,
  ]);
export type CreateAnnualReportUploadSessionResultV1 = z.infer<
  typeof CreateAnnualReportUploadSessionResultV1Schema
>;

export const UploadAnnualReportSourceResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    z
      .object({
        ok: z.literal(true),
        run: AnnualReportProcessingRunV1Schema,
      })
      .strict(),
    AnnualReportProcessingRunFailureV1Schema,
  ],
);
export type UploadAnnualReportSourceResultV1 = z.infer<
  typeof UploadAnnualReportSourceResultV1Schema
>;

export function parseAnnualReportUploadSessionV1(
  input: unknown,
): AnnualReportUploadSessionV1 {
  return AnnualReportUploadSessionV1Schema.parse(input);
}

export function parseCreateAnnualReportUploadSessionResultV1(
  input: unknown,
): CreateAnnualReportUploadSessionResultV1 {
  return CreateAnnualReportUploadSessionResultV1Schema.parse(input);
}

export function parseUploadAnnualReportSourceResultV1(
  input: unknown,
): UploadAnnualReportSourceResultV1 {
  return UploadAnnualReportSourceResultV1Schema.parse(input);
}

export type AnnualReportUploadSessionFailureV1 =
  AnnualReportProcessingRunFailureV1;

export type AnnualReportUploadFileTypeV1 = AnnualReportFileTypeV1;
