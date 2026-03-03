import { z } from "zod";

import { AuditActorTypeV2Schema, AuditEventV2Schema } from "./audit-event.v2";
import { IsoDateSchema, UuidV4Schema } from "./common.v1";
import { WorkspaceRoleV1Schema } from "./workspace-status-transition.v1";
import { WorkspaceStatusV1Schema, WorkspaceV1Schema } from "./workspace.v1";

/**
 * Actor context required for workspace lifecycle writes.
 *
 * Invariants:
 * - `user` actor requires `actorUserId`
 * - `system` actor forbids `actorUserId`
 */
export const WorkspaceActorContextV1Schema = z
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
export type WorkspaceActorContextV1 = z.infer<
  typeof WorkspaceActorContextV1Schema
>;

/**
 * Structured failure codes for lifecycle service operations.
 */
export const WorkspaceLifecycleErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "DUPLICATE_WORKSPACE",
  "TRANSITION_REJECTED",
  "STATE_CONFLICT",
  "PERSISTENCE_ERROR",
]);

/**
 * Inferred TypeScript type for lifecycle service error codes.
 */
export type WorkspaceLifecycleErrorCodeV1 = z.infer<
  typeof WorkspaceLifecycleErrorCodeV1Schema
>;

/**
 * Flexible structured context payload for lifecycle errors.
 */
export const WorkspaceLifecycleErrorContextV1Schema = z.record(
  z.string(),
  z.unknown(),
);

/**
 * Inferred TypeScript type for lifecycle error context.
 */
export type WorkspaceLifecycleErrorContextV1 = z.infer<
  typeof WorkspaceLifecycleErrorContextV1Schema
>;

/**
 * Structured lifecycle error contract used by service responses.
 */
export const WorkspaceLifecycleErrorV1Schema = z
  .object({
    code: WorkspaceLifecycleErrorCodeV1Schema,
    message: z.string().min(1),
    user_message: z.string().min(1),
    context: WorkspaceLifecycleErrorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for lifecycle service errors.
 */
export type WorkspaceLifecycleErrorV1 = z.infer<
  typeof WorkspaceLifecycleErrorV1Schema
>;

/**
 * Request payload for creating a workspace.
 */
export const CreateWorkspaceRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
    fiscalYearStart: IsoDateSchema,
    fiscalYearEnd: IsoDateSchema,
    actor: WorkspaceActorContextV1Schema,
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.fiscalYearEnd < input.fiscalYearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fiscalYearEnd must be on or after fiscalYearStart.",
        path: ["fiscalYearEnd"],
      });
    }
  });

/**
 * Inferred TypeScript type for create workspace request payloads.
 */
export type CreateWorkspaceRequestV1 = z.infer<
  typeof CreateWorkspaceRequestV1Schema
>;

/**
 * Success payload for create workspace operation.
 */
export const CreateWorkspaceSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    workspace: WorkspaceV1Schema,
    auditEvent: AuditEventV2Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful create workspace results.
 */
export type CreateWorkspaceSuccessV1 = z.infer<
  typeof CreateWorkspaceSuccessV1Schema
>;

/**
 * Shared failure payload for lifecycle operations.
 */
export const WorkspaceLifecycleFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: WorkspaceLifecycleErrorV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for failed lifecycle operation results.
 */
export type WorkspaceLifecycleFailureV1 = z.infer<
  typeof WorkspaceLifecycleFailureV1Schema
>;

/**
 * Discriminated result payload for create workspace operation.
 */
export const CreateWorkspaceResultV1Schema = z.discriminatedUnion("ok", [
  CreateWorkspaceSuccessV1Schema,
  WorkspaceLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for create workspace result payloads.
 */
export type CreateWorkspaceResultV1 = z.infer<
  typeof CreateWorkspaceResultV1Schema
>;

/**
 * Request payload for workspace lookup by tenant + workspace ID.
 */
export const GetWorkspaceByIdRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for get workspace request payloads.
 */
export type GetWorkspaceByIdRequestV1 = z.infer<
  typeof GetWorkspaceByIdRequestV1Schema
>;

/**
 * Success payload for get workspace operation.
 */
export const GetWorkspaceByIdSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    workspace: WorkspaceV1Schema.nullable(),
  })
  .strict();

/**
 * Inferred TypeScript type for successful get workspace results.
 */
export type GetWorkspaceByIdSuccessV1 = z.infer<
  typeof GetWorkspaceByIdSuccessV1Schema
>;

/**
 * Discriminated result payload for get workspace operation.
 */
export const GetWorkspaceByIdResultV1Schema = z.discriminatedUnion("ok", [
  GetWorkspaceByIdSuccessV1Schema,
  WorkspaceLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for get workspace result payloads.
 */
export type GetWorkspaceByIdResultV1 = z.infer<
  typeof GetWorkspaceByIdResultV1Schema
>;

/**
 * Request payload for listing workspaces by tenant.
 */
export const ListWorkspacesByTenantRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for list workspaces request payloads.
 */
export type ListWorkspacesByTenantRequestV1 = z.infer<
  typeof ListWorkspacesByTenantRequestV1Schema
>;

/**
 * Success payload for listing workspaces by tenant.
 */
export const ListWorkspacesByTenantSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    workspaces: z.array(WorkspaceV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for successful list workspaces results.
 */
export type ListWorkspacesByTenantSuccessV1 = z.infer<
  typeof ListWorkspacesByTenantSuccessV1Schema
>;

/**
 * Discriminated result payload for list workspaces operation.
 */
export const ListWorkspacesByTenantResultV1Schema = z.discriminatedUnion("ok", [
  ListWorkspacesByTenantSuccessV1Schema,
  WorkspaceLifecycleFailureV1Schema,
]);

/**
 * Inferred TypeScript type for list workspaces result payloads.
 */
export type ListWorkspacesByTenantResultV1 = z.infer<
  typeof ListWorkspacesByTenantResultV1Schema
>;

/**
 * Request payload for applying a workspace status transition.
 */
export const ApplyWorkspaceTransitionRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    toStatus: WorkspaceStatusV1Schema,
    reason: z.string().optional(),
    actor: WorkspaceActorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for apply transition request payloads.
 */
export type ApplyWorkspaceTransitionRequestV1 = z.infer<
  typeof ApplyWorkspaceTransitionRequestV1Schema
>;

/**
 * Success payload for apply transition operation.
 */
export const ApplyWorkspaceTransitionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    workspace: WorkspaceV1Schema,
    auditEvent: AuditEventV2Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful transition application results.
 */
export type ApplyWorkspaceTransitionSuccessV1 = z.infer<
  typeof ApplyWorkspaceTransitionSuccessV1Schema
>;

/**
 * Discriminated result payload for apply transition operation.
 */
export const ApplyWorkspaceTransitionResultV1Schema = z.discriminatedUnion(
  "ok",
  [ApplyWorkspaceTransitionSuccessV1Schema, WorkspaceLifecycleFailureV1Schema],
);

/**
 * Inferred TypeScript type for apply transition result payloads.
 */
export type ApplyWorkspaceTransitionResultV1 = z.infer<
  typeof ApplyWorkspaceTransitionResultV1Schema
>;

/**
 * Parses unknown input into a create workspace request payload.
 */
export function parseCreateWorkspaceRequestV1(
  input: unknown,
): CreateWorkspaceRequestV1 {
  return CreateWorkspaceRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a create workspace request payload.
 */
export function safeParseCreateWorkspaceRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateWorkspaceRequestV1> {
  return CreateWorkspaceRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a create workspace result payload.
 */
export function parseCreateWorkspaceResultV1(
  input: unknown,
): CreateWorkspaceResultV1 {
  return CreateWorkspaceResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a create workspace result payload.
 */
export function safeParseCreateWorkspaceResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, CreateWorkspaceResultV1> {
  return CreateWorkspaceResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a get workspace by ID request payload.
 */
export function parseGetWorkspaceByIdRequestV1(
  input: unknown,
): GetWorkspaceByIdRequestV1 {
  return GetWorkspaceByIdRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a get workspace by ID request payload.
 */
export function safeParseGetWorkspaceByIdRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetWorkspaceByIdRequestV1> {
  return GetWorkspaceByIdRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a get workspace by ID result payload.
 */
export function parseGetWorkspaceByIdResultV1(
  input: unknown,
): GetWorkspaceByIdResultV1 {
  return GetWorkspaceByIdResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a get workspace by ID result payload.
 */
export function safeParseGetWorkspaceByIdResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GetWorkspaceByIdResultV1> {
  return GetWorkspaceByIdResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a list workspaces request payload.
 */
export function parseListWorkspacesByTenantRequestV1(
  input: unknown,
): ListWorkspacesByTenantRequestV1 {
  return ListWorkspacesByTenantRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a list workspaces request payload.
 */
export function safeParseListWorkspacesByTenantRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ListWorkspacesByTenantRequestV1> {
  return ListWorkspacesByTenantRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into a list workspaces result payload.
 */
export function parseListWorkspacesByTenantResultV1(
  input: unknown,
): ListWorkspacesByTenantResultV1 {
  return ListWorkspacesByTenantResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as a list workspaces result payload.
 */
export function safeParseListWorkspacesByTenantResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ListWorkspacesByTenantResultV1> {
  return ListWorkspacesByTenantResultV1Schema.safeParse(input);
}

/**
 * Parses unknown input into an apply transition request payload.
 */
export function parseApplyWorkspaceTransitionRequestV1(
  input: unknown,
): ApplyWorkspaceTransitionRequestV1 {
  return ApplyWorkspaceTransitionRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as an apply transition request payload.
 */
export function safeParseApplyWorkspaceTransitionRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ApplyWorkspaceTransitionRequestV1> {
  return ApplyWorkspaceTransitionRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into an apply transition result payload.
 */
export function parseApplyWorkspaceTransitionResultV1(
  input: unknown,
): ApplyWorkspaceTransitionResultV1 {
  return ApplyWorkspaceTransitionResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as an apply transition result payload.
 */
export function safeParseApplyWorkspaceTransitionResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, ApplyWorkspaceTransitionResultV1> {
  return ApplyWorkspaceTransitionResultV1Schema.safeParse(input);
}
