import { z } from "zod";

import { WorkspaceStatusV1Schema } from "./workspace.v1";

/**
 * V1 workspace roles used for transition authorization decisions.
 */
export const WorkspaceRoleV1Schema = z.enum(["Admin", "Editor"]);

/**
 * Inferred TypeScript type for V1 workspace roles.
 */
export type WorkspaceRoleV1 = z.infer<typeof WorkspaceRoleV1Schema>;

/**
 * Transition request payload for workspace status changes.
 */
export const WorkspaceTransitionRequestV1Schema = z
  .object({
    fromStatus: WorkspaceStatusV1Schema,
    toStatus: WorkspaceStatusV1Schema,
    actorRole: WorkspaceRoleV1Schema,
    reason: z.string().optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for transition request payloads.
 */
export type WorkspaceTransitionRequestV1 = z.infer<
  typeof WorkspaceTransitionRequestV1Schema
>;

/**
 * Structured error codes for transition validation failures.
 */
export const WorkspaceTransitionErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "NO_OP_TRANSITION",
  "INVALID_TRANSITION",
  "ROLE_FORBIDDEN",
  "REASON_REQUIRED",
]);

/**
 * Inferred TypeScript type for transition error code values.
 */
export type WorkspaceTransitionErrorCodeV1 = z.infer<
  typeof WorkspaceTransitionErrorCodeV1Schema
>;

/**
 * Context payload for transition validation errors.
 */
export const WorkspaceTransitionErrorContextV1Schema = z
  .object({
    fromStatus: WorkspaceStatusV1Schema,
    toStatus: WorkspaceStatusV1Schema,
    actorRole: WorkspaceRoleV1Schema,
    allowedNextStatuses: z.array(WorkspaceStatusV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for transition error context.
 */
export type WorkspaceTransitionErrorContextV1 = z.infer<
  typeof WorkspaceTransitionErrorContextV1Schema
>;

/**
 * Structured transition validation error contract.
 */
export const WorkspaceTransitionErrorV1Schema = z
  .object({
    code: WorkspaceTransitionErrorCodeV1Schema,
    message: z.string().min(1),
    user_message: z.string().min(1),
    context: WorkspaceTransitionErrorContextV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for transition validation errors.
 */
export type WorkspaceTransitionErrorV1 = z.infer<
  typeof WorkspaceTransitionErrorV1Schema
>;

/**
 * Successful transition validation result.
 */
export const WorkspaceTransitionSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    fromStatus: WorkspaceStatusV1Schema,
    toStatus: WorkspaceStatusV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for successful transition results.
 */
export type WorkspaceTransitionSuccessV1 = z.infer<
  typeof WorkspaceTransitionSuccessV1Schema
>;

/**
 * Failed transition validation result.
 */
export const WorkspaceTransitionFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: WorkspaceTransitionErrorV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for failed transition results.
 */
export type WorkspaceTransitionFailureV1 = z.infer<
  typeof WorkspaceTransitionFailureV1Schema
>;

/**
 * Discriminated transition validation result contract.
 */
export const WorkspaceTransitionResultV1Schema = z.discriminatedUnion("ok", [
  WorkspaceTransitionSuccessV1Schema,
  WorkspaceTransitionFailureV1Schema,
]);

/**
 * Inferred TypeScript type for transition validation results.
 */
export type WorkspaceTransitionResultV1 = z.infer<
  typeof WorkspaceTransitionResultV1Schema
>;

/**
 * Parses and validates unknown input into a transition request payload.
 */
export function parseWorkspaceTransitionRequestV1(
  input: unknown,
): WorkspaceTransitionRequestV1 {
  return WorkspaceTransitionRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a transition request payload.
 */
export function safeParseWorkspaceTransitionRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, WorkspaceTransitionRequestV1> {
  return WorkspaceTransitionRequestV1Schema.safeParse(input);
}

/**
 * Parses and validates unknown input into a transition result payload.
 */
export function parseWorkspaceTransitionResultV1(
  input: unknown,
): WorkspaceTransitionResultV1 {
  return WorkspaceTransitionResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a transition result payload.
 */
export function safeParseWorkspaceTransitionResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, WorkspaceTransitionResultV1> {
  return WorkspaceTransitionResultV1Schema.safeParse(input);
}
