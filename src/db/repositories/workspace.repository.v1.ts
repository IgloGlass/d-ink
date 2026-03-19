import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../shared/contracts/audit-event.v2";
import {
  type WorkspaceStatusV1,
  type WorkspaceV1,
  parseWorkspaceV1,
} from "../../shared/contracts/workspace.v1";
import type { D1Database } from "../../shared/types/d1";
import { normalizeSqliteTimestampV1 } from "./sqlite-timestamp.v1";
import {
  INSERT_AUDIT_EVENT_IF_PREVIOUS_WRITE_APPLIED_SQL_V1,
  INSERT_AUDIT_EVENT_SQL_V1,
  toAuditDbValuesV1,
} from "./audit-sql.v1";

/**
 * Failure codes emitted by `WorkspaceRepositoryV1#create` and `createWithAudit`.
 */
export type WorkspaceRepositoryCreateFailureCodeV1 =
  | "DUPLICATE_WORKSPACE"
  | "PERSISTENCE_ERROR";

/**
 * Failure result contract for workspace creation.
 */
export type WorkspaceRepositoryCreateFailureV1 = {
  code: WorkspaceRepositoryCreateFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result contract for workspace creation.
 */
export type WorkspaceRepositoryCreateSuccessV1 = {
  ok: true;
  workspace: WorkspaceV1;
};

/**
 * Result contract for workspace creation.
 */
export type WorkspaceRepositoryCreateResultV1 =
  | WorkspaceRepositoryCreateSuccessV1
  | WorkspaceRepositoryCreateFailureV1;

/**
 * Failure codes emitted by compare-and-set update operations.
 */
export type WorkspaceRepositoryUpdateFailureCodeV1 =
  | "STATE_CONFLICT"
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

/**
 * Failure result contract for compare-and-set workspace status updates.
 */
export type WorkspaceRepositoryUpdateFailureV1 = {
  code: WorkspaceRepositoryUpdateFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result contract for compare-and-set workspace status updates.
 */
export type WorkspaceRepositoryUpdateSuccessV1 = {
  ok: true;
  workspace: WorkspaceV1;
};

/**
 * Success result contract for compare-and-set transition+audit atomic writes.
 */
export type WorkspaceRepositoryUpdateWithAuditSuccessV1 = {
  ok: true;
};

/**
 * Result contract for compare-and-set workspace status updates.
 */
export type WorkspaceRepositoryUpdateResultV1 =
  | WorkspaceRepositoryUpdateSuccessV1
  | WorkspaceRepositoryUpdateFailureV1;

/**
 * Result contract for compare-and-set transition+audit atomic writes.
 */
export type WorkspaceRepositoryUpdateWithAuditResultV1 =
  | WorkspaceRepositoryUpdateWithAuditSuccessV1
  | WorkspaceRepositoryUpdateFailureV1;

/**
 * Workspace persistence contract for V1 lifecycle operations.
 */
export interface WorkspaceRepositoryV1 {
  create(workspace: WorkspaceV1): Promise<WorkspaceRepositoryCreateResultV1>;
  createWithAudit(input: {
    auditEvent: AuditEventV2;
    workspace: WorkspaceV1;
  }): Promise<WorkspaceRepositoryCreateResultV1>;
  getById(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceV1 | null>;
  listByTenant(input: { tenantId: string }): Promise<WorkspaceV1[]>;
  updateStatusCompareAndSet(input: {
    fromStatus: WorkspaceStatusV1;
    tenantId: string;
    toStatus: WorkspaceStatusV1;
    updatedAt: string;
    workspaceId: string;
  }): Promise<WorkspaceRepositoryUpdateResultV1>;
  updateStatusCompareAndSetWithAudit(input: {
    auditEvent: AuditEventV2;
    fromStatus: WorkspaceStatusV1;
    tenantId: string;
    toStatus: WorkspaceStatusV1;
    updatedAt: string;
    workspaceId: string;
  }): Promise<WorkspaceRepositoryUpdateWithAuditResultV1>;
}

type WorkspaceRow = {
  company_id: string;
  created_at: string;
  fiscal_year_end: string;
  fiscal_year_start: string;
  id: string;
  status: WorkspaceStatusV1;
  tenant_id: string;
  updated_at: string;
};

const INSERT_WORKSPACE_SQL = `
INSERT INTO workspaces (
  id,
  tenant_id,
  company_id,
  fiscal_year_start,
  fiscal_year_end,
  status,
  created_at,
  updated_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
`;

const SELECT_WORKSPACE_SQL = `
SELECT
  id,
  tenant_id,
  company_id,
  fiscal_year_start,
  fiscal_year_end,
  status,
  created_at,
  updated_at
FROM workspaces
WHERE tenant_id = ?1 AND id = ?2
`;

const LIST_WORKSPACES_BY_TENANT_SQL = `
SELECT
  id,
  tenant_id,
  company_id,
  fiscal_year_start,
  fiscal_year_end,
  status,
  created_at,
  updated_at
FROM workspaces
WHERE tenant_id = ?1
ORDER BY updated_at DESC, id ASC
`;

const UPDATE_WORKSPACE_STATUS_CAS_SQL = `
UPDATE workspaces
SET
  status = ?1,
  updated_at = ?2
WHERE tenant_id = ?3 AND id = ?4 AND status = ?5
`;

function isDuplicateWorkspaceError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique constraint failed") &&
    error.message.toLowerCase().includes("workspaces.")
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function mapWorkspaceRowToContract(row: WorkspaceRow): WorkspaceV1 {
  return parseWorkspaceV1({
    companyId: row.company_id,
    createdAt: normalizeSqliteTimestampV1(row.created_at),
    fiscalYearEnd: row.fiscal_year_end,
    fiscalYearStart: row.fiscal_year_start,
    id: row.id,
    status: row.status,
    tenantId: row.tenant_id,
    updatedAt: normalizeSqliteTimestampV1(row.updated_at),
  });
}

/**
 * Creates a D1-backed V1 workspace repository.
 */
export function createD1WorkspaceRepositoryV1(
  db: D1Database,
): WorkspaceRepositoryV1 {
  async function getById(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceV1 | null> {
    const row = await db
      .prepare(SELECT_WORKSPACE_SQL)
      .bind(input.tenantId, input.workspaceId)
      .first<WorkspaceRow>();

    if (!row) {
      return null;
    }

    return mapWorkspaceRowToContract(row);
  }

  async function listByTenant(input: {
    tenantId: string;
  }): Promise<WorkspaceV1[]> {
    const queryResult = await db
      .prepare(LIST_WORKSPACES_BY_TENANT_SQL)
      .bind(input.tenantId)
      .all<WorkspaceRow>();

    if (!queryResult.success) {
      throw new Error(queryResult.error ?? "Failed to list tenant workspaces.");
    }

    const rows = queryResult.results ?? [];
    return rows.map((row) => mapWorkspaceRowToContract(row));
  }

  async function create(
    workspace: WorkspaceV1,
  ): Promise<WorkspaceRepositoryCreateResultV1> {
    const validatedWorkspace = parseWorkspaceV1(workspace);

    try {
      const insertResult = await db
        .prepare(INSERT_WORKSPACE_SQL)
        .bind(
          validatedWorkspace.id,
          validatedWorkspace.tenantId,
          validatedWorkspace.companyId,
          validatedWorkspace.fiscalYearStart,
          validatedWorkspace.fiscalYearEnd,
          validatedWorkspace.status,
          validatedWorkspace.createdAt,
          validatedWorkspace.updatedAt,
        )
        .run();

      if (!insertResult.success) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: insertResult.error ?? "Failed to insert workspace.",
        };
      }

      return { ok: true, workspace: validatedWorkspace };
    } catch (error) {
      if (isDuplicateWorkspaceError(error)) {
        return {
          ok: false,
          code: "DUPLICATE_WORKSPACE",
          message:
            "Workspace already exists for tenant/company/fiscal-year combination.",
        };
      }

      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: toErrorMessage(error),
      };
    }
  }

  return {
    create,

    async createWithAudit(input: {
      auditEvent: AuditEventV2;
      workspace: WorkspaceV1;
    }): Promise<WorkspaceRepositoryCreateResultV1> {
      const validatedWorkspace = parseWorkspaceV1(input.workspace);
      const validatedAuditEvent = parseAuditEventV2(input.auditEvent);

      if (
        validatedAuditEvent.tenantId !== validatedWorkspace.tenantId ||
        validatedAuditEvent.workspaceId !== validatedWorkspace.id
      ) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Audit event tenant/workspace identifiers must match workspace identifiers.",
        };
      }

      try {
        const [workspaceInsertResult, auditInsertResult] = await db.batch([
          db
            .prepare(INSERT_WORKSPACE_SQL)
            .bind(
              validatedWorkspace.id,
              validatedWorkspace.tenantId,
              validatedWorkspace.companyId,
              validatedWorkspace.fiscalYearStart,
              validatedWorkspace.fiscalYearEnd,
              validatedWorkspace.status,
              validatedWorkspace.createdAt,
              validatedWorkspace.updatedAt,
            ),
          db
            .prepare(INSERT_AUDIT_EVENT_SQL_V1)
            .bind(...toAuditDbValuesV1(validatedAuditEvent)),
        ]);

        if (!workspaceInsertResult.success || !auditInsertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: "Failed to create workspace and audit event atomically.",
          };
        }

        return { ok: true, workspace: validatedWorkspace };
      } catch (error) {
        if (isDuplicateWorkspaceError(error)) {
          return {
            ok: false,
            code: "DUPLICATE_WORKSPACE",
            message:
              "Workspace already exists for tenant/company/fiscal-year combination.",
          };
        }

        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    getById,
    listByTenant,

    async updateStatusCompareAndSet(input: {
      fromStatus: WorkspaceStatusV1;
      tenantId: string;
      toStatus: WorkspaceStatusV1;
      updatedAt: string;
      workspaceId: string;
    }): Promise<WorkspaceRepositoryUpdateResultV1> {
      try {
        const updateResult = await db
          .prepare(UPDATE_WORKSPACE_STATUS_CAS_SQL)
          .bind(
            input.toStatus,
            input.updatedAt,
            input.tenantId,
            input.workspaceId,
            input.fromStatus,
          )
          .run();

        if (!updateResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: updateResult.error ?? "Failed to update workspace status.",
          };
        }

        const updatedRows = Number(updateResult.meta.changes ?? 0);
        if (updatedRows === 0) {
          const existingWorkspace = await getById({
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
          });

          if (!existingWorkspace) {
            return {
              ok: false,
              code: "WORKSPACE_NOT_FOUND",
              message: "Workspace does not exist for tenant and workspace ID.",
            };
          }

          return {
            ok: false,
            code: "STATE_CONFLICT",
            message:
              "Workspace status changed before update could be applied (compare-and-set conflict).",
          };
        }

        const workspace = await getById({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        });

        if (!workspace) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Workspace update succeeded but workspace could not be reloaded.",
          };
        }

        return {
          ok: true,
          workspace,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async updateStatusCompareAndSetWithAudit(input: {
      auditEvent: AuditEventV2;
      fromStatus: WorkspaceStatusV1;
      tenantId: string;
      toStatus: WorkspaceStatusV1;
      updatedAt: string;
      workspaceId: string;
    }): Promise<WorkspaceRepositoryUpdateWithAuditResultV1> {
      const validatedAuditEvent = parseAuditEventV2(input.auditEvent);

      if (
        validatedAuditEvent.tenantId !== input.tenantId ||
        validatedAuditEvent.workspaceId !== input.workspaceId
      ) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message:
            "Audit event tenant/workspace identifiers must match transition input identifiers.",
        };
      }

      try {
        const [workspaceUpdateResult, auditInsertResult] = await db.batch([
          db
            .prepare(UPDATE_WORKSPACE_STATUS_CAS_SQL)
            .bind(
              input.toStatus,
              input.updatedAt,
              input.tenantId,
              input.workspaceId,
              input.fromStatus,
            ),
          db
            .prepare(INSERT_AUDIT_EVENT_IF_PREVIOUS_WRITE_APPLIED_SQL_V1)
            .bind(...toAuditDbValuesV1(validatedAuditEvent)),
        ]);

        if (!workspaceUpdateResult.success || !auditInsertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Failed to persist workspace transition and audit event atomically.",
          };
        }

        const updatedRows = Number(workspaceUpdateResult.meta.changes ?? 0);
        if (updatedRows === 0) {
          const existingWorkspace = await getById({
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
          });

          if (!existingWorkspace) {
            return {
              ok: false,
              code: "WORKSPACE_NOT_FOUND",
              message: "Workspace does not exist for tenant and workspace ID.",
            };
          }

          return {
            ok: false,
            code: "STATE_CONFLICT",
            message:
              "Workspace status changed before update could be applied (compare-and-set conflict).",
          };
        }

        const insertedAuditRows = Number(auditInsertResult.meta.changes ?? 0);
        if (insertedAuditRows !== 1) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Workspace transition was applied but audit event was not inserted as expected.",
          };
        }

        return { ok: true };
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
