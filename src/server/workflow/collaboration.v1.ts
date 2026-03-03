import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { CommentsRepositoryV1 } from "../../db/repositories/comments.repository.v1";
import type { TasksRepositoryV1 } from "../../db/repositories/tasks.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  CompleteTaskRequestV1Schema,
  type CompleteTaskResultV1,
  CreateCommentRequestV1Schema,
  type CreateCommentResultV1,
  CreateTaskRequestV1Schema,
  type CreateTaskResultV1,
  ListCommentsRequestV1Schema,
  type ListCommentsResultV1,
  ListTasksRequestV1Schema,
  type ListTasksResultV1,
  parseCompleteTaskResultV1,
  parseCreateCommentResultV1,
  parseCreateTaskResultV1,
  parseListCommentsResultV1,
  parseListTasksResultV1,
} from "../../shared/contracts/collaboration.v1";

export interface CollaborationDepsV1 {
  auditRepository: AuditRepositoryV1;
  commentsRepository: CommentsRepositoryV1;
  tasksRepository: TasksRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
  generateId: () => string;
  nowIsoUtc: () => string;
}

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function buildFailureV1(input: {
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "TASK_NOT_FOUND"
    | "STATE_CONFLICT"
    | "PERSISTENCE_ERROR";
  context: Record<string, unknown>;
  message: string;
  userMessage: string;
}) {
  return {
    ok: false as const,
    error: {
      code: input.code,
      message: input.message,
      user_message: input.userMessage,
      context: input.context,
    },
  };
}

export async function listCommentsV1(
  input: unknown,
  deps: CollaborationDepsV1,
): Promise<ListCommentsResultV1> {
  const parsedRequest = ListCommentsRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseListCommentsResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "List comments request payload is invalid.",
        userMessage: "The comments request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }

  const listed = await deps.commentsRepository.listByWorkspace(
    parsedRequest.data,
  );
  if (!listed.ok) {
    return parseListCommentsResultV1(
      buildFailureV1({
        code: listed.code,
        message: listed.message,
        userMessage: "Comments could not be loaded.",
        context: {},
      }),
    );
  }

  return parseListCommentsResultV1({
    ok: true,
    comments: listed.comments,
  });
}

export async function createCommentV1(
  input: unknown,
  deps: CollaborationDepsV1,
): Promise<CreateCommentResultV1> {
  const parsedRequest = CreateCommentRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseCreateCommentResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Create comment request payload is invalid.",
        userMessage: "The comment request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseCreateCommentResultV1(
      buildFailureV1({
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        userMessage: "Workspace could not be found.",
        context: {},
      }),
    );
  }

  const created = await deps.commentsRepository.create({
    commentId: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    body: request.body,
    createdByUserId: request.createdByUserId,
    createdAt: deps.nowIsoUtc(),
  });
  if (!created.ok) {
    return parseCreateCommentResultV1(
      buildFailureV1({
        code: created.code,
        message: created.message,
        userMessage: "Comment could not be saved.",
        context: {},
      }),
    );
  }

  await deps.auditRepository.append(
    parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: "user",
      actorUserId: request.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.COMMENT_CREATED,
      targetType: "comment",
      targetId: created.comment.id,
      after: {
        commentId: created.comment.id,
        createdByUserId: created.comment.createdByUserId,
        createdAt: created.comment.createdAt,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  );

  return parseCreateCommentResultV1({
    ok: true,
    comment: created.comment,
  });
}

export async function listTasksV1(
  input: unknown,
  deps: CollaborationDepsV1,
): Promise<ListTasksResultV1> {
  const parsedRequest = ListTasksRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseListTasksResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "List tasks request payload is invalid.",
        userMessage: "The task request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }

  const listed = await deps.tasksRepository.listByWorkspace(parsedRequest.data);
  if (!listed.ok) {
    return parseListTasksResultV1(
      buildFailureV1({
        code: listed.code,
        message: listed.message,
        userMessage: "Tasks could not be loaded.",
        context: {},
      }),
    );
  }

  return parseListTasksResultV1({
    ok: true,
    tasks: listed.tasks,
  });
}

export async function createTaskV1(
  input: unknown,
  deps: CollaborationDepsV1,
): Promise<CreateTaskResultV1> {
  const parsedRequest = CreateTaskRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseCreateTaskResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Create task request payload is invalid.",
        userMessage: "The task request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const created = await deps.tasksRepository.create({
    taskId: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    title: request.title,
    description: request.description,
    assignedToUserId: request.assignedToUserId,
    createdByUserId: request.createdByUserId,
    createdAt: deps.nowIsoUtc(),
  });
  if (!created.ok) {
    return parseCreateTaskResultV1(
      buildFailureV1({
        code: created.code,
        message: created.message,
        userMessage: "Task could not be saved.",
        context: {},
      }),
    );
  }

  await deps.auditRepository.append(
    parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: "user",
      actorUserId: request.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.TASK_CREATED,
      targetType: "task",
      targetId: created.task.id,
      after: {
        taskId: created.task.id,
        status: created.task.status,
        assignedToUserId: created.task.assignedToUserId ?? null,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  );

  return parseCreateTaskResultV1({
    ok: true,
    task: created.task,
  });
}

export async function completeTaskV1(
  input: unknown,
  deps: CollaborationDepsV1,
): Promise<CompleteTaskResultV1> {
  const parsedRequest = CompleteTaskRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseCompleteTaskResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Complete task request payload is invalid.",
        userMessage: "The complete-task request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const completed = await deps.tasksRepository.complete({
    taskId: request.taskId,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    completedByUserId: request.completedByUserId,
    completedAt: deps.nowIsoUtc(),
  });
  if (!completed.ok) {
    return parseCompleteTaskResultV1(
      buildFailureV1({
        code: completed.code,
        message: completed.message,
        userMessage:
          completed.code === "STATE_CONFLICT"
            ? "Task is already completed."
            : "Task could not be completed.",
        context: {},
      }),
    );
  }

  await deps.auditRepository.append(
    parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: "user",
      actorUserId: request.completedByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.TASK_COMPLETED,
      targetType: "task",
      targetId: completed.task.id,
      before: {
        status: "open",
      },
      after: {
        status: completed.task.status,
        completedByUserId: completed.task.completedByUserId,
        completedAt: completed.task.completedAt,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  );

  return parseCompleteTaskResultV1({
    ok: true,
    task: completed.task,
  });
}
