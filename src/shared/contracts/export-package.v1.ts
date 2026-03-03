import { z } from "zod";

import { IsoDateTimeSchema, UuidV4Schema } from "./common.v1";
import { WorkspaceStatusV1Schema } from "./workspace.v1";

export const ExportFormatV1Schema = z.enum(["pdf"]);
export type ExportFormatV1 = z.infer<typeof ExportFormatV1Schema>;

export const ExportPackagePayloadV1Schema = z
  .object({
    schemaVersion: z.literal("export_package_v1"),
    format: ExportFormatV1Schema,
    fileName: z.string().trim().min(1),
    mimeType: z.literal("application/pdf"),
    contentBase64: z.string().trim().min(1),
    createdAt: IsoDateTimeSchema,
    createdByUserId: UuidV4Schema.optional(),
    artifactReferences: z
      .object({
        annualReportExtractionArtifactId: UuidV4Schema,
        adjustmentsArtifactId: UuidV4Schema,
        summaryArtifactId: UuidV4Schema,
        ink2FormArtifactId: UuidV4Schema,
      })
      .strict(),
    workspaceSnapshot: z
      .object({
        workspaceId: UuidV4Schema,
        tenantId: UuidV4Schema,
        status: WorkspaceStatusV1Schema,
      })
      .strict(),
  })
  .strict();
export type ExportPackagePayloadV1 = z.infer<typeof ExportPackagePayloadV1Schema>;

export const ActiveExportRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("export_package_v1"),
  })
  .strict();
export type ActiveExportRefV1 = z.infer<typeof ActiveExportRefV1Schema>;

export const CreatePdfExportRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type CreatePdfExportRequestV1 = z.infer<typeof CreatePdfExportRequestV1Schema>;

export const ListWorkspaceExportsRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();
export type ListWorkspaceExportsRequestV1 = z.infer<
  typeof ListWorkspaceExportsRequestV1Schema
>;

export const ExportPackageErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXPORT_NOT_ALLOWED",
  "FORM_NOT_FOUND",
  "PERSISTENCE_ERROR",
]);
export type ExportPackageErrorCodeV1 = z.infer<typeof ExportPackageErrorCodeV1Schema>;

export const ExportPackageFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: ExportPackageErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type ExportPackageFailureV1 = z.infer<typeof ExportPackageFailureV1Schema>;

const ExportPackageSuccessBaseV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveExportRefV1Schema,
    exportPackage: ExportPackagePayloadV1Schema,
  })
  .strict();

export const CreatePdfExportResultV1Schema = z.discriminatedUnion("ok", [
  ExportPackageSuccessBaseV1Schema,
  ExportPackageFailureV1Schema,
]);
export type CreatePdfExportResultV1 = z.infer<typeof CreatePdfExportResultV1Schema>;

export const ListWorkspaceExportsResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      exports: z.array(
        z
          .object({
            active: ActiveExportRefV1Schema,
            exportPackage: ExportPackagePayloadV1Schema,
          })
          .strict(),
      ),
    })
    .strict(),
  ExportPackageFailureV1Schema,
]);
export type ListWorkspaceExportsResultV1 = z.infer<
  typeof ListWorkspaceExportsResultV1Schema
>;

export function parseExportPackagePayloadV1(input: unknown): ExportPackagePayloadV1 {
  return ExportPackagePayloadV1Schema.parse(input);
}

export function parseCreatePdfExportResultV1(
  input: unknown,
): CreatePdfExportResultV1 {
  return CreatePdfExportResultV1Schema.parse(input);
}

export function parseListWorkspaceExportsResultV1(
  input: unknown,
): ListWorkspaceExportsResultV1 {
  return ListWorkspaceExportsResultV1Schema.parse(input);
}
