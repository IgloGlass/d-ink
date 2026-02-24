import { z } from "zod";

import { IsoDateSchema, IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

/**
 * Canonical persisted workflow statuses for V1 workspace lifecycle.
 */
export const WorkspaceStatusV1Schema = z.enum([
  "draft",
  "in_review",
  "changes_requested",
  "ready_for_approval",
  "approved_for_export",
  "exported",
  "client_accepted",
  "filed",
]);

/**
 * Inferred TypeScript type for V1 workspace status values.
 */
export type WorkspaceStatusV1 = z.infer<typeof WorkspaceStatusV1Schema>;

/**
 * V1 workspace contract used at module boundaries.
 *
 * Invariants:
 * - strict top-level payload
 * - fiscal year end must be on or after start
 */
export const WorkspaceV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
    fiscalYearStart: IsoDateSchema,
    fiscalYearEnd: IsoDateSchema,
    status: WorkspaceStatusV1Schema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((workspace, ctx) => {
    if (workspace.fiscalYearEnd < workspace.fiscalYearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fiscalYearEnd must be on or after fiscalYearStart.",
        path: ["fiscalYearEnd"],
      });
    }
  });

/**
 * Inferred TypeScript type for validated V1 workspace payloads.
 */
export type WorkspaceV1 = z.infer<typeof WorkspaceV1Schema>;

/**
 * Parses and validates unknown input into a `WorkspaceV1` payload.
 */
export function parseWorkspaceV1(input: unknown): WorkspaceV1 {
  return WorkspaceV1Schema.parse(input);
}

/**
 * Safely validates unknown input into a `WorkspaceV1` payload.
 */
export function safeParseWorkspaceV1(
  input: unknown,
): z.SafeParseReturnType<unknown, WorkspaceV1> {
  return WorkspaceV1Schema.safeParse(input);
}
