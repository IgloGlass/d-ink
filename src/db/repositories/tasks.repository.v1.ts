import {
  type CollaborationTaskV1,
  CollaborationTaskV1Schema,
  parseCompleteTaskResultV1,
  parseListTasksResultV1,
} from "../../shared/contracts/collaboration.v1";
import type { D1Database } from "../../shared/types/d1";

export type TasksRepositoryFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "STATE_CONFLICT"
  | "PERSISTENCE_ERROR";

export type TasksRepositoryFailureV1 = {
  code: TasksRepositoryFailureCodeV1;
  message: string;
  ok: false;
};

export type TasksRepositoryListSuccessV1 = {
  ok: true;
  tasks: CollaborationTaskV1[];
};

export type TasksRepositoryCreateSuccessV1 = {
  ok: true;
  task: CollaborationTaskV1;
};

export type TasksRepositoryCompleteSuccessV1 = {
  ok: true;
  task: CollaborationTaskV1;
};

export type TasksRepositoryListResultV1 =
  | TasksRepositoryListSuccessV1
  | TasksRepositoryFailureV1;
export type TasksRepositoryCreateResultV1 =
  | TasksRepositoryCreateSuccessV1
  | TasksRepositoryFailureV1;
export type TasksRepositoryCompleteResultV1 =
  | TasksRepositoryCompleteSuccessV1
  | TasksRepositoryFailureV1;

export interface TasksRepositoryV1 {
  complete(input: {
    completedAt: string;
    completedByUserId: string;
    taskId: string;
    tenantId: string;
    workspaceId: string;
  }): Promise<TasksRepositoryCompleteResultV1>;
  create(input: {
    assignedToUserId?: string;
    createdAt: string;
    createdByUserId: string;
    description?: string;
    taskId: string;
    tenantId: string;
    title: string;
    workspaceId: string;
  }): Promise<TasksRepositoryCreateResultV1>;
  listByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TasksRepositoryListResultV1>;
}

type WorkspaceExistsRowV1 = { id: string };

type TaskRowV1 = {
  assigned_to_user_id: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  created_at: string;
  created_by_user_id: string;
  description: string | null;
  id: string;
  status: "open" | "completed";
  tenant_id: string;
  title: string;
  workspace_id: string;
};

const SELECT_WORKSPACE_EXISTS_SQL_V1 = `
SELECT id
FROM workspaces
WHERE tenant_id = ?1 AND id = ?2
LIMIT 1
`;

const INSERT_TASK_SQL_V1 = `
INSERT INTO tasks_v1 (
  id,
  tenant_id,
  workspace_id,
  title,
  description,
  created_by_user_id,
  assigned_to_user_id,
  status,
  created_at,
  completed_at,
  completed_by_user_id
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, NULL, NULL)
`;

const LIST_TASKS_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  title,
  description,
  created_by_user_id,
  assigned_to_user_id,
  status,
  created_at,
  completed_at,
  completed_by_user_id
FROM tasks_v1
WHERE tenant_id = ?1 AND workspace_id = ?2
ORDER BY created_at DESC, id ASC
`;

const SELECT_TASK_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  title,
  description,
  created_by_user_id,
  assigned_to_user_id,
  status,
  created_at,
  completed_at,
  completed_by_user_id
FROM tasks_v1
WHERE tenant_id = ?1 AND workspace_id = ?2 AND id = ?3
LIMIT 1
`;

const COMPLETE_TASK_IF_OPEN_SQL_V1 = `
UPDATE tasks_v1
SET
  status = 'completed',
  completed_at = ?1,
  completed_by_user_id = ?2
WHERE tenant_id = ?3
  AND workspace_id = ?4
  AND id = ?5
  AND status = 'open'
`;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function mapTaskRowToContractV1(row: TaskRowV1): CollaborationTaskV1 {
  return CollaborationTaskV1Schema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? undefined,
    createdByUserId: row.created_by_user_id,
    assignedToUserId: row.assigned_to_user_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    completedByUserId: row.completed_by_user_id ?? undefined,
  });
}

export function createD1TasksRepositoryV1(db: D1Database): TasksRepositoryV1 {
  return {
    async create(input): Promise<TasksRepositoryCreateResultV1> {
      try {
        const workspace = await db
          .prepare(SELECT_WORKSPACE_EXISTS_SQL_V1)
          .bind(input.tenantId, input.workspaceId)
          .first<WorkspaceExistsRowV1>();
        if (!workspace) {
          return {
            ok: false,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace does not exist for tenant and workspace ID.",
          };
        }

        const insertResult = await db
          .prepare(INSERT_TASK_SQL_V1)
          .bind(
            input.taskId,
            input.tenantId,
            input.workspaceId,
            input.title,
            input.description ?? null,
            input.createdByUserId,
            input.assignedToUserId ?? null,
            input.createdAt,
          )
          .run();

        if (!insertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: insertResult.error ?? "Failed to insert workspace task.",
          };
        }

        return {
          ok: true,
          task: mapTaskRowToContractV1({
            id: input.taskId,
            tenant_id: input.tenantId,
            workspace_id: input.workspaceId,
            title: input.title,
            description: input.description ?? null,
            created_by_user_id: input.createdByUserId,
            assigned_to_user_id: input.assignedToUserId ?? null,
            status: "open",
            created_at: input.createdAt,
            completed_at: null,
            completed_by_user_id: null,
          }),
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async listByWorkspace(input): Promise<TasksRepositoryListResultV1> {
      try {
        const queryResult = await db
          .prepare(LIST_TASKS_SQL_V1)
          .bind(input.tenantId, input.workspaceId)
          .all<TaskRowV1>();
        if (!queryResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: queryResult.error ?? "Failed to list workspace tasks.",
          };
        }

        const tasks = (queryResult.results ?? []).map((row) =>
          mapTaskRowToContractV1(row),
        );
        parseListTasksResultV1({
          ok: true,
          tasks,
        });

        return {
          ok: true,
          tasks,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async complete(input): Promise<TasksRepositoryCompleteResultV1> {
      try {
        const updateResult = await db
          .prepare(COMPLETE_TASK_IF_OPEN_SQL_V1)
          .bind(
            input.completedAt,
            input.completedByUserId,
            input.tenantId,
            input.workspaceId,
            input.taskId,
          )
          .run();
        if (!updateResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              updateResult.error ?? "Failed to update task completion state.",
          };
        }

        const changedRows = Number(updateResult.meta.changes ?? 0);
        const taskRow = await db
          .prepare(SELECT_TASK_SQL_V1)
          .bind(input.tenantId, input.workspaceId, input.taskId)
          .first<TaskRowV1>();

        if (!taskRow) {
          return {
            ok: false,
            code: "TASK_NOT_FOUND",
            message: "Task does not exist for tenant/workspace/task ID.",
          };
        }

        if (changedRows === 0 && taskRow.status !== "open") {
          return {
            ok: false,
            code: "STATE_CONFLICT",
            message: "Task is already completed.",
          };
        }

        const task = mapTaskRowToContractV1(taskRow);
        parseCompleteTaskResultV1({
          ok: true,
          task,
        });

        return {
          ok: true,
          task,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },
  };
}
