import { z } from "zod";

import { IsoDateSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

export const AnnualReportFileTypeV1Schema = z.enum(["pdf", "docx"]);
export type AnnualReportFileTypeV1 = z.infer<
  typeof AnnualReportFileTypeV1Schema
>;

export const AnnualReportAccountingStandardV1Schema = z.enum(["K2", "K3"]);
export type AnnualReportAccountingStandardV1 = z.infer<
  typeof AnnualReportAccountingStandardV1Schema
>;

export const AnnualReportExtractionFieldStatusV1Schema = z.enum([
  "extracted",
  "needs_review",
  "manual",
]);
export type AnnualReportExtractionFieldStatusV1 = z.infer<
  typeof AnnualReportExtractionFieldStatusV1Schema
>;

export const AnnualReportExtractionFieldKeyV1Schema = z.enum([
  "companyName",
  "organizationNumber",
  "fiscalYearStart",
  "fiscalYearEnd",
  "accountingStandard",
  "profitBeforeTax",
]);
export type AnnualReportExtractionFieldKeyV1 = z.infer<
  typeof AnnualReportExtractionFieldKeyV1Schema
>;

export const AnnualReportFieldSourceSnippetV1Schema = z
  .object({
    snippet: z.string().trim().min(1),
    page: z.number().int().positive().optional(),
  })
  .strict();
export type AnnualReportFieldSourceSnippetV1 = z.infer<
  typeof AnnualReportFieldSourceSnippetV1Schema
>;

const AnnualReportFieldMetaV1Schema = z
  .object({
    status: AnnualReportExtractionFieldStatusV1Schema,
    confidence: z.number().min(0).max(1),
    sourceSnippet: AnnualReportFieldSourceSnippetV1Schema.optional(),
  })
  .strict();

export const AnnualReportStringFieldV1Schema = z
  .object({
    value: z.string().trim().min(1).optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportStringFieldV1 = z.infer<
  typeof AnnualReportStringFieldV1Schema
>;

export const AnnualReportDateFieldV1Schema = z
  .object({
    value: IsoDateSchema.optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportDateFieldV1 = z.infer<
  typeof AnnualReportDateFieldV1Schema
>;

export const AnnualReportEnumFieldV1Schema = z
  .object({
    value: AnnualReportAccountingStandardV1Schema.optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportEnumFieldV1 = z.infer<
  typeof AnnualReportEnumFieldV1Schema
>;

export const AnnualReportNumberFieldV1Schema = z
  .object({
    value: z.number().finite().optional(),
  })
  .merge(AnnualReportFieldMetaV1Schema)
  .strict();
export type AnnualReportNumberFieldV1 = z.infer<
  typeof AnnualReportNumberFieldV1Schema
>;

export const AnnualReportExtractionPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("annual_report_extraction_v1"),
    sourceFileName: z.string().trim().min(1),
    sourceFileType: AnnualReportFileTypeV1Schema,
    policyVersion: z.string().trim().min(1),
    fields: z
      .object({
        companyName: AnnualReportStringFieldV1Schema,
        organizationNumber: AnnualReportStringFieldV1Schema,
        fiscalYearStart: AnnualReportDateFieldV1Schema,
        fiscalYearEnd: AnnualReportDateFieldV1Schema,
        accountingStandard: AnnualReportEnumFieldV1Schema,
        profitBeforeTax: AnnualReportNumberFieldV1Schema,
      })
      .strict(),
    summary: z
      .object({
        autoDetectedFieldCount: z.number().int().nonnegative(),
        needsReviewFieldCount: z.number().int().nonnegative(),
      })
      .strict(),
    confirmation: z
      .object({
        isConfirmed: z.boolean(),
        confirmedAt: IsoDateTimeSchema.optional(),
        confirmedByUserId: UuidV4Schema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.confirmation.isConfirmed) {
      return;
    }

    if (!value.confirmation.confirmedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmedAt is required when extraction is confirmed.",
        path: ["confirmation", "confirmedAt"],
      });
    }
    if (!value.confirmation.confirmedByUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmedByUserId is required when extraction is confirmed.",
        path: ["confirmation", "confirmedByUserId"],
      });
    }
  });
export type AnnualReportExtractionPayloadV1 = z.infer<
  typeof AnnualReportExtractionPayloadV1Schema
>;

export const ActiveAnnualReportExtractionRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("annual_report_extraction_v1"),
  })
  .strict();
export type ActiveAnnualReportExtractionRefV1 = z.infer<
  typeof ActiveAnnualReportExtractionRefV1Schema
>;

export const RunAnnualReportExtractionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    fileName: z.string().trim().min(1),
    fileType: AnnualReportFileTypeV1Schema.optional(),
    fileBytesBase64: z.string().trim().min(1),
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type RunAnnualReportExtractionRequestV1 = z.infer<
  typeof RunAnnualReportExtractionRequestV1Schema
>;

export const AnnualReportExtractionOverrideInstructionV1Schema = z
  .object({
    fieldKey: AnnualReportExtractionFieldKeyV1Schema,
    value: z.union([z.string().trim().min(1), z.number().finite()]),
    reason: z.string().trim().min(1),
  })
  .strict();
export type AnnualReportExtractionOverrideInstructionV1 = z.infer<
  typeof AnnualReportExtractionOverrideInstructionV1Schema
>;

export const ApplyAnnualReportExtractionOverridesRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveExtraction: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
        schemaVersion: z.literal("annual_report_extraction_v1").optional(),
      })
      .strict(),
    overrides: z
      .array(AnnualReportExtractionOverrideInstructionV1Schema)
      .min(1),
    authorUserId: UuidV4Schema.optional(),
  })
  .strict();
export type ApplyAnnualReportExtractionOverridesRequestV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesRequestV1Schema
>;

export const ConfirmAnnualReportExtractionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveExtraction: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
        schemaVersion: z.literal("annual_report_extraction_v1").optional(),
      })
      .strict(),
    confirmedByUserId: UuidV4Schema,
  })
  .strict();
export type ConfirmAnnualReportExtractionRequestV1 = z.infer<
  typeof ConfirmAnnualReportExtractionRequestV1Schema
>;

export const AnnualReportExtractionErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXTRACTION_NOT_FOUND",
  "STATE_CONFLICT",
  "PARSE_FAILED",
  "PERSISTENCE_ERROR",
]);
export type AnnualReportExtractionErrorCodeV1 = z.infer<
  typeof AnnualReportExtractionErrorCodeV1Schema
>;

export const AnnualReportExtractionFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: AnnualReportExtractionErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type AnnualReportExtractionFailureV1 = z.infer<
  typeof AnnualReportExtractionFailureV1Schema
>;

export const RunAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
  })
  .strict();
export type RunAnnualReportExtractionSuccessV1 = z.infer<
  typeof RunAnnualReportExtractionSuccessV1Schema
>;

export const RunAnnualReportExtractionResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    RunAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ],
);
export type RunAnnualReportExtractionResultV1 = z.infer<
  typeof RunAnnualReportExtractionResultV1Schema
>;

export const GetActiveAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
  })
  .strict();
export type GetActiveAnnualReportExtractionSuccessV1 = z.infer<
  typeof GetActiveAnnualReportExtractionSuccessV1Schema
>;

export const GetActiveAnnualReportExtractionResultV1Schema =
  z.discriminatedUnion("ok", [
    GetActiveAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ]);
export type GetActiveAnnualReportExtractionResultV1 = z.infer<
  typeof GetActiveAnnualReportExtractionResultV1Schema
>;

export const ApplyAnnualReportExtractionOverridesSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
    appliedCount: z.number().int().nonnegative(),
  })
  .strict();
export type ApplyAnnualReportExtractionOverridesSuccessV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesSuccessV1Schema
>;

export const ApplyAnnualReportExtractionOverridesResultV1Schema =
  z.discriminatedUnion("ok", [
    ApplyAnnualReportExtractionOverridesSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ]);
export type ApplyAnnualReportExtractionOverridesResultV1 = z.infer<
  typeof ApplyAnnualReportExtractionOverridesResultV1Schema
>;

export const ConfirmAnnualReportExtractionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveAnnualReportExtractionRefV1Schema,
    extraction: AnnualReportExtractionPayloadV1Schema,
  })
  .strict();
export type ConfirmAnnualReportExtractionSuccessV1 = z.infer<
  typeof ConfirmAnnualReportExtractionSuccessV1Schema
>;

export const ConfirmAnnualReportExtractionResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    ConfirmAnnualReportExtractionSuccessV1Schema,
    AnnualReportExtractionFailureV1Schema,
  ],
);
export type ConfirmAnnualReportExtractionResultV1 = z.infer<
  typeof ConfirmAnnualReportExtractionResultV1Schema
>;

export function parseAnnualReportExtractionPayloadV1(
  input: unknown,
): AnnualReportExtractionPayloadV1 {
  return AnnualReportExtractionPayloadV1Schema.parse(input);
}

export function parseRunAnnualReportExtractionResultV1(
  input: unknown,
): RunAnnualReportExtractionResultV1 {
  return RunAnnualReportExtractionResultV1Schema.parse(input);
}

export function parseGetActiveAnnualReportExtractionResultV1(
  input: unknown,
): GetActiveAnnualReportExtractionResultV1 {
  return GetActiveAnnualReportExtractionResultV1Schema.parse(input);
}

export function parseApplyAnnualReportExtractionOverridesResultV1(
  input: unknown,
): ApplyAnnualReportExtractionOverridesResultV1 {
  return ApplyAnnualReportExtractionOverridesResultV1Schema.parse(input);
}

export function parseConfirmAnnualReportExtractionResultV1(
  input: unknown,
): ConfirmAnnualReportExtractionResultV1 {
  return ConfirmAnnualReportExtractionResultV1Schema.parse(input);
}
