import { z } from "zod";

import { AuditActorTypeV2Schema } from "./audit-event.v2";
import { IsoDateSchema, UuidV4Schema } from "./common.v1";
import { CompanyV1Schema } from "./company.v1";
import { WorkspaceRoleV1Schema } from "./workspace-status-transition.v1";

/**
 * Actor context required for company lifecycle writes.
 *
 * Invariants:
 * - `user` actor requires `actorUserId`
 * - `system` actor forbids `actorUserId`
 */
export const CompanyActorContextV1Schema = z
  .object({
    actorType: AuditActorTypeV2Schema,
    actorRole: WorkspaceRoleV1Schema,
    actorUserId: UuidV4Schema.optional(),
  })
  .strict()
  .superRefine((actor, ctx) => {
    if (actor.actorType === "user" && !actor.actorUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actorUserId is required when actorType is 'user'.",
        path: ["actorUserId"],
      });
    }

    if (actor.actorType === "system" && actor.actorUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actorUserId must be omitted when actorType is 'system'.",
        path: ["actorUserId"],
      });
    }
  });

/**
 * Inferred TypeScript type for lifecycle actor context.
 */
export type CompanyActorContextV1 = z.infer<typeof CompanyActorContextV1Schema>;

/**
 * Structured failure codes for company lifecycle service operations.
 */
export const CompanyLifecycleErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "COMPANY_NOT_FOUND",
  "DUPLICATE_COMPANY",
  "PERSISTENCE_ERROR",
]);

/**
 * Inferred TypeScript type for lifecycle service error codes.
 */
export type CompanyLifecycleErrorCodeV1 = z.infer<
  typeof CompanyLifecycleErrorCodeV1Schema
>;

/**
 * Flexible structured context payload for company lifecycle errors.
 */
export const CompanyLifecycleErrorContextV1Schema = z.record(
  z.string(),
  z.unknown(),
);

/**
 * Inferred TypeScript type for lifecycle error context.
 */
export type CompanyLifecycleErrorContextV1 = z.infer<
  typeof CompanyLifecycleErrorContextV1Schema
>;

/**
 * Structured company lifecycle error contract used by service responses.
 */
export const CompanyLifecycleErrorV1Schema = z
  .object({
    code: CompanyLifecycleErrorCodeV1Schema,
    message: z.string().min(1),
    user_message: z.string().min(1),
    context: CompanyLifecycleErrorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for lifecycle service errors.
 */
export type CompanyLifecycleErrorV1 = z.infer<
  typeof CompanyLifecycleErrorV1Schema
>;

/**
 * Request payload for creating a company.
 */
export const CreateCompanyRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    legalName: z.string().trim().min(1).max(200),
    organizationNumber: z
      .string()
      .trim()
      .regex(
        /^\d{6}-?\d{4}$/,
        "Expected organization number in 10-digit format (with optional dash).",
      ),
    defaultFiscalYearStart: IsoDateSchema,
    defaultFiscalYearEnd: IsoDateSchema,
    actor: CompanyActorContextV1Schema,
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.defaultFiscalYearEnd < input.defaultFiscalYearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "defaultFiscalYearEnd must be on or after defaultFiscalYearStart.",
        path: ["defaultFiscalYearEnd"],
      });
    }
  });

/**
 * Inferred TypeScript type for create company request payloads.
 */
export type CreateCompanyRequestV1 = z.infer<
  typeof CreateCompanyRequestV1Schema
>;

/**
 * Request payload for updating company identity fields.
 */
export const UpdateCompanyRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
    legalName: z.string().trim().min(1).max(200),
    organizationNumber: z
      .string()
      .trim()
      .regex(
        /^\d{6}-?\d{4}$/,
        "Expected organization number in 10-digit format (with optional dash).",
      ),
    actor: CompanyActorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for update company request payloads.
 */
export type UpdateCompanyRequestV1 = z.infer<
  typeof UpdateCompanyRequestV1Schema
>;

/**
 * Success payload for create company operation.
 */
export const CreateCompanySuccessV1Schema = z
  .object({
    ok: z.literal(true),
    company: CompanyV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful create company results.
 */
export type CreateCompanySuccessV1 = z.infer<
  typeof CreateCompanySuccessV1Schema
>;

/**
 * Shared failure payload for lifecycle operations.
 */
export const CompanyLifecycleFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: CompanyLifecycleErrorV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for failed lifecycle operation results.
 */
export type CompanyLifecycleFailureV1 = z.infer<
  typeof CompanyLifecycleFailureV1Schema
>;

/**
 * Discriminated result payload for create company operation.
 */
export const CreateCompanyResultV1Schema = z.discriminatedUnion("ok", [
  CreateCompanySuccessV1Schema,
  CompanyLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for create company result payloads.
 */
export type CreateCompanyResultV1 = z.infer<typeof CreateCompanyResultV1Schema>;

/**
 * Success payload for update company operation.
 */
export const UpdateCompanySuccessV1Schema = z
  .object({
    ok: z.literal(true),
    company: CompanyV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful update company results.
 */
export type UpdateCompanySuccessV1 = z.infer<
  typeof UpdateCompanySuccessV1Schema
>;

/**
 * Discriminated result payload for update company operation.
 */
export const UpdateCompanyResultV1Schema = z.discriminatedUnion("ok", [
  UpdateCompanySuccessV1Schema,
  CompanyLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for update company result payloads.
 */
export type UpdateCompanyResultV1 = z.infer<typeof UpdateCompanyResultV1Schema>;

/**
 * Request payload for company lookup by tenant + company ID.
 */
export const GetCompanyByIdRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for get company request payloads.
 */
export type GetCompanyByIdRequestV1 = z.infer<
  typeof GetCompanyByIdRequestV1Schema
>;

/**
 * Success payload for get company operation.
 */
export const GetCompanyByIdSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    company: CompanyV1Schema.nullable(),
  })
  .strict();

/**
 * Inferred TypeScript type for successful get company results.
 */
export type GetCompanyByIdSuccessV1 = z.infer<
  typeof GetCompanyByIdSuccessV1Schema
>;

/**
 * Discriminated result payload for get company operation.
 */
export const GetCompanyByIdResultV1Schema = z.discriminatedUnion("ok", [
  GetCompanyByIdSuccessV1Schema,
  CompanyLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for get company result payloads.
 */
export type GetCompanyByIdResultV1 = z.infer<
  typeof GetCompanyByIdResultV1Schema
>;

/**
 * Request payload for listing companies by tenant.
 */
export const ListCompaniesByTenantRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for list companies request payloads.
 */
export type ListCompaniesByTenantRequestV1 = z.infer<
  typeof ListCompaniesByTenantRequestV1Schema
>;

/**
 * Success payload for listing companies by tenant.
 */
export const ListCompaniesByTenantSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    companies: z.array(CompanyV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for successful list company results.
 */
export type ListCompaniesByTenantSuccessV1 = z.infer<
  typeof ListCompaniesByTenantSuccessV1Schema
>;

/**
 * Discriminated result payload for list companies operation.
 */
export const ListCompaniesByTenantResultV1Schema = z.discriminatedUnion("ok", [
  ListCompaniesByTenantSuccessV1Schema,
  CompanyLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for list companies result payloads.
 */
export type ListCompaniesByTenantResultV1 = z.infer<
  typeof ListCompaniesByTenantResultV1Schema
>;

/**
 * Parses unknown input into a create company request payload.
 */
export function parseCreateCompanyRequestV1(
  input: unknown,
): CreateCompanyRequestV1 {
  return CreateCompanyRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a create company request payload.
 */
export function safeParseCreateCompanyRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateCompanyRequestV1> {
  return CreateCompanyRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a create company result payload.
 */
export function parseCreateCompanyResultV1(
  input: unknown,
): CreateCompanyResultV1 {
  return CreateCompanyResultV1Schema.parse(input);
}

/**
 * Parses unknown input into an update company result payload.
 */
export function parseUpdateCompanyResultV1(
  input: unknown,
): UpdateCompanyResultV1 {
  return UpdateCompanyResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a create company result payload.
 */
export function safeParseCreateCompanyResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateCompanyResultV1> {
  return CreateCompanyResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a get company by ID request payload.
 */
export function parseGetCompanyByIdRequestV1(
  input: unknown,
): GetCompanyByIdRequestV1 {
  return GetCompanyByIdRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a get company by ID request payload.
 */
export function safeParseGetCompanyByIdRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetCompanyByIdRequestV1> {
  return GetCompanyByIdRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a get company by ID result payload.
 */
export function parseGetCompanyByIdResultV1(
  input: unknown,
): GetCompanyByIdResultV1 {
  return GetCompanyByIdResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a get company by ID result payload.
 */
export function safeParseGetCompanyByIdResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetCompanyByIdResultV1> {
  return GetCompanyByIdResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a list companies request payload.
 */
export function parseListCompaniesByTenantRequestV1(
  input: unknown,
): ListCompaniesByTenantRequestV1 {
  return ListCompaniesByTenantRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a list companies request payload.
 */
export function safeParseListCompaniesByTenantRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ListCompaniesByTenantRequestV1> {
  return ListCompaniesByTenantRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a list companies result payload.
 */
export function parseListCompaniesByTenantResultV1(
  input: unknown,
): ListCompaniesByTenantResultV1 {
  return ListCompaniesByTenantResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a list companies result payload.
 */
export function safeParseListCompaniesByTenantResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ListCompaniesByTenantResultV1> {
  return ListCompaniesByTenantResultV1Schema.safeParse(input);
}
