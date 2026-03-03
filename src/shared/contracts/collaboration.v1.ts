import { z } from "zod";

import { IsoDateTimeSchema, UuidV4Schema } from "./common.v1";

export const CollaborationCommentV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    body: z.string().trim().min(1),
    createdByUserId: UuidV4Schema,
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type CollaborationCommentV1 = z.infer<typeof CollaborationCommentV1Schema>;

export const CollaborationTaskStatusV1Schema = z.enum(["open", "completed"]);
export type CollaborationTaskStatusV1 = z.infer<
  typeof CollaborationTaskStatusV1Schema
>;

export const CollaborationTaskV1Schema = z
  .object({
    id: UuidV4Schema,
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    createdByUserId: UuidV4Schema,
    assignedToUserId: UuidV4Schema.optional(),
    status: CollaborationTaskStatusV1Schema,
    createdAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.optional(),
    completedByUserId: UuidV4Schema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "completed") {
      if (!value.completedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completedAt is required for completed tasks.",
          path: ["completedAt"],
        });
      }
      if (!value.completedByUserId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "completedByUserId is required for completed tasks.",
          path: ["completedByUserId"],
        });
      }
    }
  });
export type CollaborationTaskV1 = z.infer<typeof CollaborationTaskV1Schema>;

export const ListCommentsRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();
export type ListCommentsRequestV1 = z.infer<typeof ListCommentsRequestV1Schema>;

export const CreateCommentRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    body: z.string().trim().min(1),
    createdByUserId: UuidV4Schema,
  })
  .strict();
export type CreateCommentRequestV1 = z.infer<typeof CreateCommentRequestV1Schema>;

export const ListTasksRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
  })
  .strict();
export type ListTasksRequestV1 = z.infer<typeof ListTasksRequestV1Schema>;

export const CreateTaskRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    assignedToUserId: UuidV4Schema.optional(),
    createdByUserId: UuidV4Schema,
  })
  .strict();
export type CreateTaskRequestV1 = z.infer<typeof CreateTaskRequestV1Schema>;

export const CompleteTaskRequestV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    workspaceId: UuidV4Schema,
    taskId: UuidV4Schema,
    completedByUserId: UuidV4Schema,
  })
  .strict();
export type CompleteTaskRequestV1 = z.infer<typeof CompleteTaskRequestV1Schema>;

export const CollaborationErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "WORKSPACE_NOT_FOUND",
  "TASK_NOT_FOUND",
  "STATE_CONFLICT",
  "PERSISTENCE_ERROR",
]);
export type CollaborationErrorCodeV1 = z.infer<typeof CollaborationErrorCodeV1Schema>;

export const CollaborationFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: CollaborationErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();
export type CollaborationFailureV1 = z.infer<typeof CollaborationFailureV1Schema>;

export const ListCommentsResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      comments: z.array(CollaborationCommentV1Schema),
    })
    .strict(),
  CollaborationFailureV1Schema,
]);
export type ListCommentsResultV1 = z.infer<typeof ListCommentsResultV1Schema>;

export const CreateCommentResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      comment: CollaborationCommentV1Schema,
    })
    .strict(),
  CollaborationFailureV1Schema,
]);
export type CreateCommentResultV1 = z.infer<typeof CreateCommentResultV1Schema>;

export const ListTasksResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      tasks: z.array(CollaborationTaskV1Schema),
    })
    .strict(),
  CollaborationFailureV1Schema,
]);
export type ListTasksResultV1 = z.infer<typeof ListTasksResultV1Schema>;

export const CreateTaskResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      task: CollaborationTaskV1Schema,
    })
    .strict(),
  CollaborationFailureV1Schema,
]);
export type CreateTaskResultV1 = z.infer<typeof CreateTaskResultV1Schema>;

export const CompleteTaskResultV1Schema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      task: CollaborationTaskV1Schema,
    })
    .strict(),
  CollaborationFailureV1Schema,
]);
export type CompleteTaskResultV1 = z.infer<typeof CompleteTaskResultV1Schema>;

export function parseListCommentsResultV1(input: unknown): ListCommentsResultV1 {
  return ListCommentsResultV1Schema.parse(input);
}

export function parseCreateCommentResultV1(input: unknown): CreateCommentResultV1 {
  return CreateCommentResultV1Schema.parse(input);
}

export function parseListTasksResultV1(input: unknown): ListTasksResultV1 {
  return ListTasksResultV1Schema.parse(input);
}

export function parseCreateTaskResultV1(input: unknown): CreateTaskResultV1 {
  return CreateTaskResultV1Schema.parse(input);
}

export function parseCompleteTaskResultV1(input: unknown): CompleteTaskResultV1 {
  return CompleteTaskResultV1Schema.parse(input);
}
