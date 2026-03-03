import {
  type CollaborationCommentV1,
  CollaborationCommentV1Schema,
  parseListCommentsResultV1,
} from "../../shared/contracts/collaboration.v1";
import type { D1Database } from "../../shared/types/d1";

export type CommentsRepositoryFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

export type CommentsRepositoryFailureV1 = {
  code: CommentsRepositoryFailureCodeV1;
  message: string;
  ok: false;
};

export type CommentsRepositoryListSuccessV1 = {
  comments: CollaborationCommentV1[];
  ok: true;
};

export type CommentsRepositoryCreateSuccessV1 = {
  comment: CollaborationCommentV1;
  ok: true;
};

export type CommentsRepositoryListResultV1 =
  | CommentsRepositoryListSuccessV1
  | CommentsRepositoryFailureV1;

export type CommentsRepositoryCreateResultV1 =
  | CommentsRepositoryCreateSuccessV1
  | CommentsRepositoryFailureV1;

export interface CommentsRepositoryV1 {
  create(input: {
    body: string;
    commentId: string;
    createdAt: string;
    createdByUserId: string;
    tenantId: string;
    workspaceId: string;
  }): Promise<CommentsRepositoryCreateResultV1>;
  listByWorkspace(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<CommentsRepositoryListResultV1>;
}

type WorkspaceExistsRowV1 = {
  id: string;
};

type CommentRowV1 = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  body: string;
  created_by_user_id: string;
  created_at: string;
};

const SELECT_WORKSPACE_EXISTS_SQL_V1 = `
SELECT id
FROM workspaces
WHERE tenant_id = ?1 AND id = ?2
LIMIT 1
`;

const INSERT_COMMENT_SQL_V1 = `
INSERT INTO comments_v1 (
  id,
  tenant_id,
  workspace_id,
  body,
  created_by_user_id,
  created_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6)
`;

const LIST_COMMENTS_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  body,
  created_by_user_id,
  created_at
FROM comments_v1
WHERE tenant_id = ?1 AND workspace_id = ?2
ORDER BY created_at DESC, id ASC
`;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function mapCommentRowToContractV1(row: CommentRowV1): CollaborationCommentV1 {
  return CollaborationCommentV1Schema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    body: row.body,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  });
}

export function createD1CommentsRepositoryV1(
  db: D1Database,
): CommentsRepositoryV1 {
  return {
    async create(input): Promise<CommentsRepositoryCreateResultV1> {
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
          .prepare(INSERT_COMMENT_SQL_V1)
          .bind(
            input.commentId,
            input.tenantId,
            input.workspaceId,
            input.body,
            input.createdByUserId,
            input.createdAt,
          )
          .run();
        if (!insertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              insertResult.error ?? "Failed to insert workspace comment.",
          };
        }

        return {
          ok: true,
          comment: mapCommentRowToContractV1({
            id: input.commentId,
            tenant_id: input.tenantId,
            workspace_id: input.workspaceId,
            body: input.body,
            created_by_user_id: input.createdByUserId,
            created_at: input.createdAt,
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

    async listByWorkspace(input): Promise<CommentsRepositoryListResultV1> {
      try {
        const queryResult = await db
          .prepare(LIST_COMMENTS_SQL_V1)
          .bind(input.tenantId, input.workspaceId)
          .all<CommentRowV1>();

        if (!queryResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: queryResult.error ?? "Failed to list workspace comments.",
          };
        }

        const rows = queryResult.results ?? [];
        const comments = rows.map((row) => mapCommentRowToContractV1(row));
        parseListCommentsResultV1({
          ok: true,
          comments,
        });
        return {
          ok: true,
          comments,
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
