import { z } from "zod";

import { IsoDateSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

const ORGANIZATION_NUMBER_REGEX_V1 = /^\d{10}$/;

/**
 * Canonical organization number format for persisted V1 company records.
 *
 * Invariants:
 * - normalized to digits only before persistence
 * - exactly 10 digits
 */
export const OrganizationNumberV1Schema = z
  .string()
  .regex(
    ORGANIZATION_NUMBER_REGEX_V1,
    "Expected organization number in normalized 10-digit format.",
  );

/**
 * Inferred TypeScript type for normalized organization numbers.
 */
export type OrganizationNumberV1 = z.infer<typeof OrganizationNumberV1Schema>;

/**
 * V1 company contract used at module boundaries.
 *
 * Invariants:
 * - strict top-level payload
 * - default fiscal year end must be on or after start
 */
export const CompanyV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    legalName: z.string().trim().min(1).max(200),
    organizationNumber: OrganizationNumberV1Schema,
    defaultFiscalYearStart: IsoDateSchema,
    defaultFiscalYearEnd: IsoDateSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((company, ctx) => {
    if (company.defaultFiscalYearEnd < company.defaultFiscalYearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "defaultFiscalYearEnd must be on or after defaultFiscalYearStart.",
        path: ["defaultFiscalYearEnd"],
      });
    }
  });

/**
 * Inferred TypeScript type for validated company payloads.
 */
export type CompanyV1 = z.infer<typeof CompanyV1Schema>;

/**
 * Parses and validates unknown input into a `CompanyV1` payload.
 */
export function parseCompanyV1(input: unknown): CompanyV1 {
  return CompanyV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a `CompanyV1` payload.
 */
export function safeParseCompanyV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CompanyV1> {
  return CompanyV1Schema.safeParse(input);
}

/**
 * Normalizes user-input organization numbers into persisted canonical form.
 */
export function normalizeOrganizationNumberV1(value: string): string {
  return value.replace(/\D/g, "");
}
