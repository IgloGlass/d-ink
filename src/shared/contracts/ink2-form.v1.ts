import { z } from "zod";

import { UuidV4Schema } from "./common.v1";

export const Ink2FieldIdV1Schema = z.string().trim().min(1);
export type Ink2FieldIdV1 = z.infer<typeof Ink2FieldIdV1Schema>;

export const Ink2FieldProvenanceV1Schema = z.enum([
  "extracted",
  "calculated",
  "adjustment",
  "manual",
]);
export type Ink2FieldProvenanceV1 = z.infer<typeof Ink2FieldProvenanceV1Schema>;

export const Ink2DraftFieldV1Schema = z
  .object({
    fieldId: Ink2FieldIdV1Schema,
    amount: z.number().finite(),
    provenance: Ink2FieldProvenanceV1Schema,
    sourceReferences: z.array(z.string().trim().min(1)),
  })
  .strict();
export type Ink2DraftFieldV1 = z.infer<typeof Ink2DraftFieldV1Schema>;

export const Ink2FormDraftPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("ink2_form_draft_v1"),
    extractionArtifactId: UuidV4Schema,
    adjustmentsArtifactId: UuidV4Schema,
    summaryArtifactId: UuidV4Schema,
    fields: z.array(Ink2DraftFieldV1Schema).min(8),
    validation: z
      .object({
        status: z.enum(["valid", "invalid"]),
        issues: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const uniqueFieldCount = new Set(value.fields.map((field) => field.fieldId))
      .size;
    if (uniqueFieldCount !== value.fields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INK2 draft fields must be unique by fieldId.",
        path: ["fields"],
      });
    }
  });
export type Ink2FormDraftPayloadV1 = z.infer<
  typeof Ink2FormDraftPayloadV1Schema
>;

export const ActiveInk2FormRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("ink2_form_draft_v1"),
  })
  .strict();
export type ActiveInk2FormRefV1 = z.infer<typeof ActiveInk2FormRefV1Schema>;

export const RunInk2FormRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type RunInk2FormRequestV1 = z.infer<typeof RunInk2FormRequestV1Schema>;

export const Ink2FormOverrideInstructionV1Schema = z
  .object({
    fieldId: Ink2FieldIdV1Schema,
    amount: z.number().finite(),
    reason: z.string().trim().min(1),
  })
  .strict();
export type Ink2FormOverrideInstructionV1 = z.infer<
  typeof Ink2FormOverrideInstructionV1Schema
>;

export const ApplyInk2FormOverridesRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveForm: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
      })
      .strict(),
    overrides: z.array(Ink2FormOverrideInstructionV1Schema).min(1),
    authorUserId: UuidV4Schema.optional(),
  })
  .strict();
export type ApplyInk2FormOverridesRequestV1 = z.infer<
  typeof ApplyInk2FormOverridesRequestV1Schema
>;

export const Ink2FormErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXTRACTION_NOT_CONFIRMED",
  "SUMMARY_NOT_FOUND",
  "FORM_NOT_FOUND",
  "STATE_CONFLICT",
  "PERSISTENCE_ERROR",
]);
export type Ink2FormErrorCodeV1 = z.infer<typeof Ink2FormErrorCodeV1Schema>;

export const Ink2FormFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: Ink2FormErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type Ink2FormFailureV1 = z.infer<typeof Ink2FormFailureV1Schema>;

const Ink2FormSuccessBaseV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveInk2FormRefV1Schema,
    form: Ink2FormDraftPayloadV1Schema,
  })
  .strict();

export const RunInk2FormResultV1Schema = z.discriminatedUnion("ok", [
  Ink2FormSuccessBaseV1Schema,
  Ink2FormFailureV1Schema,
]);
export type RunInk2FormResultV1 = z.infer<typeof RunInk2FormResultV1Schema>;

export const GetActiveInk2FormResultV1Schema = z.discriminatedUnion("ok", [
  Ink2FormSuccessBaseV1Schema,
  Ink2FormFailureV1Schema,
]);
export type GetActiveInk2FormResultV1 = z.infer<
  typeof GetActiveInk2FormResultV1Schema
>;

export const ApplyInk2FormOverridesResultV1Schema = z.discriminatedUnion("ok", [
  Ink2FormSuccessBaseV1Schema.extend({
    appliedCount: z.number().int().nonnegative(),
  }),
  Ink2FormFailureV1Schema,
]);
export type ApplyInk2FormOverridesResultV1 = z.infer<
  typeof ApplyInk2FormOverridesResultV1Schema
>;

export function parseInk2FormDraftPayloadV1(
  input: unknown,
): Ink2FormDraftPayloadV1 {
  return Ink2FormDraftPayloadV1Schema.parse(input);
}

export function parseRunInk2FormResultV1(input: unknown): RunInk2FormResultV1 {
  return RunInk2FormResultV1Schema.parse(input);
}

export function parseGetActiveInk2FormResultV1(
  input: unknown,
): GetActiveInk2FormResultV1 {
  return GetActiveInk2FormResultV1Schema.parse(input);
}

export function parseApplyInk2FormOverridesResultV1(
  input: unknown,
): ApplyInk2FormOverridesResultV1 {
  return ApplyInk2FormOverridesResultV1Schema.parse(input);
}
