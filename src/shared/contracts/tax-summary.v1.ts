import { z } from "zod";

import { IsoDateSchema, UuidV4Schema } from "./common.v1";

export const TaxSummaryLineItemCodeV1Schema = z.enum([
  "profit_before_tax",
  "total_adjustments",
  "taxable_income",
  "corporate_tax",
]);
export type TaxSummaryLineItemCodeV1 = z.infer<
  typeof TaxSummaryLineItemCodeV1Schema
>;

export const TaxSummaryLineItemV1Schema = z
  .object({
    code: TaxSummaryLineItemCodeV1Schema,
    amount: z.number().finite(),
    sourceReference: z.string().trim().min(1),
  })
  .strict();
export type TaxSummaryLineItemV1 = z.infer<typeof TaxSummaryLineItemV1Schema>;

export const TaxSummaryPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("tax_summary_v1"),
    extractionArtifactId: UuidV4Schema,
    adjustmentsArtifactId: UuidV4Schema,
    fiscalYearEnd: IsoDateSchema,
    taxRatePercent: z.number().positive(),
    profitBeforeTax: z.number().finite(),
    totalAdjustments: z.number().finite(),
    taxableIncome: z.number().finite(),
    corporateTax: z.number().finite(),
    lineItems: z.array(TaxSummaryLineItemV1Schema).length(4),
  })
  .strict();
export type TaxSummaryPayloadV1 = z.infer<typeof TaxSummaryPayloadV1Schema>;

export const ActiveTaxSummaryRefV1Schema = z
  .object({
    artifactId: UuidV4Schema,
    version: z.number().int().positive(),
    schemaVersion: z.literal("tax_summary_v1"),
  })
  .strict();
export type ActiveTaxSummaryRefV1 = z.infer<typeof ActiveTaxSummaryRefV1Schema>;

export const RunTaxSummaryRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    createdByUserId: UuidV4Schema.optional(),
  })
  .strict();
export type RunTaxSummaryRequestV1 = z.infer<
  typeof RunTaxSummaryRequestV1Schema
>;

export const TaxSummaryErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "EXTRACTION_NOT_CONFIRMED",
  "ADJUSTMENTS_NOT_FOUND",
  "INPUT_INVALID_FISCAL_YEAR",
  "PERSISTENCE_ERROR",
]);
export type TaxSummaryErrorCodeV1 = z.infer<typeof TaxSummaryErrorCodeV1Schema>;

export const TaxSummaryFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: TaxSummaryErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type TaxSummaryFailureV1 = z.infer<typeof TaxSummaryFailureV1Schema>;

const TaxSummarySuccessBaseV1Schema = z
  .object({
    ok: z.literal(true),
    active: ActiveTaxSummaryRefV1Schema,
    summary: TaxSummaryPayloadV1Schema,
  })
  .strict();

export const RunTaxSummaryResultV1Schema = z.discriminatedUnion("ok", [
  TaxSummarySuccessBaseV1Schema,
  TaxSummaryFailureV1Schema,
]);
export type RunTaxSummaryResultV1 = z.infer<typeof RunTaxSummaryResultV1Schema>;

export const GetActiveTaxSummaryResultV1Schema = z.discriminatedUnion("ok", [
  TaxSummarySuccessBaseV1Schema,
  TaxSummaryFailureV1Schema,
]);
export type GetActiveTaxSummaryResultV1 = z.infer<
  typeof GetActiveTaxSummaryResultV1Schema
>;

export function parseTaxSummaryPayloadV1(input: unknown): TaxSummaryPayloadV1 {
  return TaxSummaryPayloadV1Schema.parse(input);
}

export function parseRunTaxSummaryResultV1(
  input: unknown,
): RunTaxSummaryResultV1 {
  return RunTaxSummaryResultV1Schema.parse(input);
}

export function parseGetActiveTaxSummaryResultV1(
  input: unknown,
): GetActiveTaxSummaryResultV1 {
  return GetActiveTaxSummaryResultV1Schema.parse(input);
}
