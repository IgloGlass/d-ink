import { z } from "zod";

import { AiRunMetadataV1Schema } from "./ai-run.v1";
import { UuidV4Schema } from "./common.v1";
import { MappingDecisionSetPayloadV1Schema } from "./mapping.v1";

export const TaxAdjustmentModuleCodeV1Schema = z.enum([
  "non_deductible_expenses",
  "representation_entertainment",
  "depreciation_differences_basic",
  "manual_review_bucket",
]);
export type TaxAdjustmentModuleCodeV1 = z.infer<
  typeof TaxAdjustmentModuleCodeV1Schema
>;

export const TaxAdjustmentTargetFieldV1Schema = z.enum([
  "INK2S.non_deductible_expenses",
  "INK2S.representation_non_deductible",
  "INK2S.depreciation_adjustment",
  "INK2S.other_manual_adjustments",
]);
export type TaxAdjustmentTargetFieldV1 = z.infer<
  typeof TaxAdjustmentTargetFieldV1Schema
>;

export const TaxAdjustmentDirectionV1Schema = z.enum([
  "increase_taxable_income",
  "decrease_taxable_income",
  "informational",
]);
export type TaxAdjustmentDirectionV1 = z.infer<
  typeof TaxAdjustmentDirectionV1Schema
>;

export const TaxAdjustmentDecisionStatusV1Schema = z.enum([
  "proposed",
  "manual_review_required",
  "overridden",
  "accepted",
]);
export type TaxAdjustmentDecisionStatusV1 = z.infer<
  typeof TaxAdjustmentDecisionStatusV1Schema
>;

export const TaxAdjustmentEvidenceV1Schema = z
  .object({
    type: z.string().trim().min(1),
    reference: z.string().trim().min(1),
    snippet: z.string().trim().min(1).optional(),
  })
  .strict();
export type TaxAdjustmentEvidenceV1 = z.infer<
  typeof TaxAdjustmentEvidenceV1Schema
>;

export const TaxAdjustmentOverrideV1Schema = z
  .object({
    reason: z.string().trim().min(1),
    authorUserId: UuidV4Schema.optional(),
  })
  .strict();
export type TaxAdjustmentOverrideV1 = z.infer<
  typeof TaxAdjustmentOverrideV1Schema
>;

export const TaxAdjustmentDecisionV1Schema = z
  .object({
    id: z.string().trim().min(1),
    module: TaxAdjustmentModuleCodeV1Schema,
    amount: z.number().finite(),
    direction: TaxAdjustmentDirectionV1Schema,
    targetField: TaxAdjustmentTargetFieldV1Schema,
    status: TaxAdjustmentDecisionStatusV1Schema,
    confidence: z.number().min(0).max(1),
    reviewFlag: z.boolean(),
    policyRuleReference: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    evidence: z.array(TaxAdjustmentEvidenceV1Schema).min(1),
    override: TaxAdjustmentOverrideV1Schema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "overridden" && !value.override) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Overridden adjustment decisions must include override metadata.",
        path: ["override"],
      });
    }
  });
export type TaxAdjustmentDecisionV1 = z.infer<
  typeof TaxAdjustmentDecisionV1Schema
>;

export const TaxAdjustmentDecisionSummaryV1Schema = z
  .object({
    totalDecisions: z.number().int().nonnegative(),
    manualReviewRequired: z.number().int().nonnegative(),
    totalPositiveAdjustments: z.number().nonnegative(),
    totalNegativeAdjustments: z.number().nonnegative(),
    totalNetAdjustments: z.number().finite(),
  })
  .strict();
export type TaxAdjustmentDecisionSummaryV1 = z.infer<
  typeof TaxAdjustmentDecisionSummaryV1Schema
>;

export const TaxAdjustmentDecisionSetPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("tax_adjustments_v1"),
    policyVersion: z.string().trim().min(1),
    aiRuns: z.array(AiRunMetadataV1Schema).default([]),
    summary: TaxAdjustmentDecisionSummaryV1Schema,
    generatedFrom: z
      .object({
        mappingArtifactId: UuidV4Schema,
        annualReportExtractionArtifactId: UuidV4Schema,
      })
      .strict(),
    decisions: z.array(TaxAdjustmentDecisionV1Schema),
  })
  .strict();
export type TaxAdjustmentDecisionSetPayloadV1 = z.infer<
  typeof TaxAdjustmentDecisionSetPayloadV1Schema
>;

export const ActiveTaxAdjustmentsRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("tax_adjustments_v1"),
  })
  .strict();
export type ActiveTaxAdjustmentsRefV1 = z.infer<
  typeof ActiveTaxAdjustmentsRefV1Schema
>;

export const RunTaxAdjustmentRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    policyVersion: z.string().trim().min(1),
    createdByUserId: UuidV4Schema.optional(),
    mapping: MappingDecisionSetPayloadV1Schema.optional(),
  })
  .strict();
export type RunTaxAdjustmentRequestV1 = z.infer<
  typeof RunTaxAdjustmentRequestV1Schema
>;

export const TaxAdjustmentOverrideInstructionV1Schema = z
  .object({
    decisionId: z.string().trim().min(1),
    amount: z.number().finite(),
    targetField: TaxAdjustmentTargetFieldV1Schema.optional(),
    reason: z.string().trim().min(1),
  })
  .strict();
export type TaxAdjustmentOverrideInstructionV1 = z.infer<
  typeof TaxAdjustmentOverrideInstructionV1Schema
>;

export const ApplyTaxAdjustmentOverridesRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    expectedActiveAdjustments: z
      .object({
        artifactId: UuidV4Schema,
        version: z.number().int().positive(),
      })
      .strict(),
    overrides: z.array(TaxAdjustmentOverrideInstructionV1Schema).min(1),
    authorUserId: UuidV4Schema.optional(),
  })
  .strict();
export type ApplyTaxAdjustmentOverridesRequestV1 = z.infer<
  typeof ApplyTaxAdjustmentOverridesRequestV1Schema
>;

export const TaxAdjustmentErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXTRACTION_NOT_CONFIRMED",
  "MAPPING_NOT_FOUND",
  "ADJUSTMENTS_NOT_FOUND",
  "STATE_CONFLICT",
  "PERSISTENCE_ERROR",
]);
export type TaxAdjustmentErrorCodeV1 = z.infer<
  typeof TaxAdjustmentErrorCodeV1Schema
>;

export const TaxAdjustmentFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: TaxAdjustmentErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type TaxAdjustmentFailureV1 = z.infer<
  typeof TaxAdjustmentFailureV1Schema
>;

const TaxAdjustmentSuccessBaseV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveTaxAdjustmentsRefV1Schema,
    adjustments: TaxAdjustmentDecisionSetPayloadV1Schema,
  })
  .strict();

export const RunTaxAdjustmentResultV1Schema = z.discriminatedUnion("ok", [
  TaxAdjustmentSuccessBaseV1Schema,
  TaxAdjustmentFailureV1Schema,
]);
export type RunTaxAdjustmentResultV1 = z.infer<
  typeof RunTaxAdjustmentResultV1Schema
>;

export const GetActiveTaxAdjustmentsResultV1Schema = z.discriminatedUnion(
  "ok",
  [TaxAdjustmentSuccessBaseV1Schema, TaxAdjustmentFailureV1Schema],
);
export type GetActiveTaxAdjustmentsResultV1 = z.infer<
  typeof GetActiveTaxAdjustmentsResultV1Schema
>;

export const ApplyTaxAdjustmentOverridesResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    TaxAdjustmentSuccessBaseV1Schema.extend({
      appliedCount: z.number().int().nonnegative(),
    }),
    TaxAdjustmentFailureV1Schema,
  ],
);
export type ApplyTaxAdjustmentOverridesResultV1 = z.infer<
  typeof ApplyTaxAdjustmentOverridesResultV1Schema
>;

export function parseTaxAdjustmentDecisionSetPayloadV1(
  input: unknown,
): TaxAdjustmentDecisionSetPayloadV1 {
  return TaxAdjustmentDecisionSetPayloadV1Schema.parse(input);
}

export function parseRunTaxAdjustmentResultV1(
  input: unknown,
): RunTaxAdjustmentResultV1 {
  return RunTaxAdjustmentResultV1Schema.parse(input);
}

export function parseGetActiveTaxAdjustmentsResultV1(
  input: unknown,
): GetActiveTaxAdjustmentsResultV1 {
  return GetActiveTaxAdjustmentsResultV1Schema.parse(input);
}

export function parseApplyTaxAdjustmentOverridesResultV1(
  input: unknown,
): ApplyTaxAdjustmentOverridesResultV1 {
  return ApplyTaxAdjustmentOverridesResultV1Schema.parse(input);
}
