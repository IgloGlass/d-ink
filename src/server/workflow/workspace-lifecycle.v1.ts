import type { z } from "zod";

import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  ApplyWorkspaceTransitionRequestV1Schema,
  type ApplyWorkspaceTransitionResultV1,
  CreateWorkspaceRequestV1Schema,
  type CreateWorkspaceResultV1,
  GetWorkspaceByIdRequestV1Schema,
  type GetWorkspaceByIdResultV1,
  ListWorkspacesByTenantRequestV1Schema,
  type ListWorkspacesByTenantResultV1,
  type WorkspaceActorContextV1,
  type WorkspaceLifecycleErrorCodeV1,
  type WorkspaceLifecycleFailureV1,
  parseApplyWorkspaceTransitionResultV1,
  parseCreateWorkspaceResultV1,
  parseGetWorkspaceByIdResultV1,
  parseListWorkspacesByTenantResultV1,
} from "../../shared/contracts/workspace-lifecycle.v1";
import { parseWorkspaceV1 } from "../../shared/contracts/workspace.v1";
import { evaluateWorkspaceStatusTransitionV1 } from "./workspace-status-transition.v1";

/**
 * Dependencies required by the V1 workspace lifecycle service.
 */
export interface WorkspaceLifecycleDepsV1 {
  generateId: () => string;
  nowIsoUtc: () => string;
  workspaceRepository: WorkspaceRepositoryV1;
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

function buildFailure(
  code: WorkspaceLifecycleErrorCodeV1,
  message: string,
  userMessage: string,
  context: Record<string, unknown>,
): WorkspaceLifecycleFailureV1 {
  return {
    ok: false,
    error: {
      code,
      message,
      user_message: userMessage,
      context,
    },
  };
}

function buildActorAuditFields(actor: WorkspaceActorContextV1): {
  actorType: "user" | "system";
  actorUserId?: string;
} {
  if (actor.actorType === "user") {
    return {
      actorType: "user",
      actorUserId: actor.actorUserId,
    };
  }

  return {
    actorType: "system",
  };
}

function toUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

/**
 * Creates a workspace in persistent storage and appends `workspace.created`.
 */
export async function createWorkspaceV1(
  input: unknown,
  deps: WorkspaceLifecycleDepsV1,
): Promise<CreateWorkspaceResultV1> {
  const parsed = CreateWorkspaceRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseCreateWorkspaceResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Create workspace request payload is invalid.",
        "The workspace request is invalid. Please review the input and try again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const createdAt = deps.nowIsoUtc();
    const workspace = parseWorkspaceV1({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      companyId: parsed.data.companyId,
      fiscalYearStart: parsed.data.fiscalYearStart,
      fiscalYearEnd: parsed.data.fiscalYearEnd,
      status: "draft",
      createdAt,
      updatedAt: createdAt,
    });

    const auditTimestamp = deps.nowIsoUtc();
    const auditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: workspace.id,
      ...buildActorAuditFields(parsed.data.actor),
      eventType: "workspace.created",
      targetType: "workspace",
      targetId: workspace.id,
      after: {
        companyId: workspace.companyId,
        fiscalYearEnd: workspace.fiscalYearEnd,
        fiscalYearStart: workspace.fiscalYearStart,
        status: workspace.status,
      },
      timestamp: auditTimestamp,
      context: {
        actorRole: parsed.data.actor.actorRole,
      },
    });

    const createResult = await deps.workspaceRepository.createWithAudit({
      workspace,
      auditEvent,
    });

    if (!createResult.ok) {
      if (createResult.code === "DUPLICATE_WORKSPACE") {
        return parseCreateWorkspaceResultV1(
          buildFailure(
            "DUPLICATE_WORKSPACE",
            createResult.message,
            "A workspace already exists for this company and fiscal year.",
            {
              companyId: parsed.data.companyId,
              fiscalYearEnd: parsed.data.fiscalYearEnd,
              fiscalYearStart: parsed.data.fiscalYearStart,
              tenantId: parsed.data.tenantId,
            },
          ),
        );
      }

      return parseCreateWorkspaceResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          createResult.message,
          "Workspace could not be created due to a storage error.",
          {
            operation: "workspace.createWithAudit",
          },
        ),
      );
    }

    return parseCreateWorkspaceResultV1({
      ok: true,
      workspace: createResult.workspace,
      auditEvent,
    });
  } catch (error) {
    return parseCreateWorkspaceResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Workspace could not be created due to an unexpected error.",
        {
          operation: "workspace.createWithAudit",
        },
      ),
    );
  }
}

/**
 * Fetches a workspace by tenant and workspace ID.
 */
export async function getWorkspaceByIdV1(
  input: unknown,
  deps: WorkspaceLifecycleDepsV1,
): Promise<GetWorkspaceByIdResultV1> {
  const parsed = GetWorkspaceByIdRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseGetWorkspaceByIdResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Get workspace request payload is invalid.",
        "The workspace lookup request is invalid.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const workspace = await deps.workspaceRepository.getById({
      tenantId: parsed.data.tenantId,
      workspaceId: parsed.data.workspaceId,
    });

    return parseGetWorkspaceByIdResultV1({
      ok: true,
      workspace,
    });
  } catch (error) {
    return parseGetWorkspaceByIdResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Workspace could not be loaded due to a storage error.",
        {
          operation: "workspace.getById",
        },
      ),
    );
  }
}

/**
 * Lists all workspaces for a tenant in deterministic recency order.
 */
export async function listWorkspacesByTenantV1(
  input: unknown,
  deps: WorkspaceLifecycleDepsV1,
): Promise<ListWorkspacesByTenantResultV1> {
  const parsed = ListWorkspacesByTenantRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseListWorkspacesByTenantResultV1(
      buildFailure(
        "INPUT_INVALID",
        "List workspaces request payload is invalid.",
        "The workspace list request is invalid.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const workspaces = await deps.workspaceRepository.listByTenant({
      tenantId: parsed.data.tenantId,
    });

    return parseListWorkspacesByTenantResultV1({
      ok: true,
      workspaces,
    });
  } catch (error) {
    return parseListWorkspacesByTenantResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Workspace list could not be loaded due to a storage error.",
        {
          operation: "workspace.listByTenant",
        },
      ),
    );
  }
}

/**
 * Applies a status transition with role-aware validation and compare-and-set persistence.
 */
export async function applyWorkspaceTransitionV1(
  input: unknown,
  deps: WorkspaceLifecycleDepsV1,
): Promise<ApplyWorkspaceTransitionResultV1> {
  const parsed = ApplyWorkspaceTransitionRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseApplyWorkspaceTransitionResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Apply transition request payload is invalid.",
        "The status change request is invalid.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const existingWorkspace = await deps.workspaceRepository.getById({
      tenantId: parsed.data.tenantId,
      workspaceId: parsed.data.workspaceId,
    });

    if (!existingWorkspace) {
      return parseApplyWorkspaceTransitionResultV1(
        buildFailure(
          "WORKSPACE_NOT_FOUND",
          "Workspace does not exist for tenant and workspace ID.",
          "Workspace could not be found.",
          {
            tenantId: parsed.data.tenantId,
            workspaceId: parsed.data.workspaceId,
          },
        ),
      );
    }

    const transitionEvaluation = evaluateWorkspaceStatusTransitionV1({
      fromStatus: existingWorkspace.status,
      toStatus: parsed.data.toStatus,
      actorRole: parsed.data.actor.actorRole,
      reason: parsed.data.reason,
    });

    if (!transitionEvaluation.ok) {
      return parseApplyWorkspaceTransitionResultV1(
        buildFailure(
          "TRANSITION_REJECTED",
          transitionEvaluation.error.message,
          transitionEvaluation.error.user_message,
          {
            transitionError: transitionEvaluation.error,
            workspaceId: parsed.data.workspaceId,
          },
        ),
      );
    }

    const updatedAt = deps.nowIsoUtc();
    const updatedWorkspace = parseWorkspaceV1({
      ...existingWorkspace,
      status: parsed.data.toStatus,
      updatedAt,
    });

    const auditTimestamp = deps.nowIsoUtc();
    const auditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      workspaceId: parsed.data.workspaceId,
      ...buildActorAuditFields(parsed.data.actor),
      eventType: "workspace.status_changed",
      targetType: "workspace",
      targetId: parsed.data.workspaceId,
      before: {
        status: existingWorkspace.status,
      },
      after: {
        status: updatedWorkspace.status,
      },
      timestamp: auditTimestamp,
      context: {
        actorRole: parsed.data.actor.actorRole,
        reason: parsed.data.reason ?? null,
      },
    });

    const updateResult =
      await deps.workspaceRepository.updateStatusCompareAndSetWithAudit({
        tenantId: parsed.data.tenantId,
        workspaceId: parsed.data.workspaceId,
        fromStatus: existingWorkspace.status,
        toStatus: updatedWorkspace.status,
        updatedAt: updatedWorkspace.updatedAt,
        auditEvent,
      });

    if (!updateResult.ok) {
      if (updateResult.code === "WORKSPACE_NOT_FOUND") {
        return parseApplyWorkspaceTransitionResultV1(
          buildFailure(
            "WORKSPACE_NOT_FOUND",
            updateResult.message,
            "Workspace could not be found.",
            {
              tenantId: parsed.data.tenantId,
              workspaceId: parsed.data.workspaceId,
            },
          ),
        );
      }

      if (updateResult.code === "STATE_CONFLICT") {
        return parseApplyWorkspaceTransitionResultV1(
          buildFailure(
            "STATE_CONFLICT",
            updateResult.message,
            "Workspace status changed before your update was applied. Refresh and retry.",
            {
              expectedFromStatus: existingWorkspace.status,
              requestedToStatus: parsed.data.toStatus,
              workspaceId: parsed.data.workspaceId,
            },
          ),
        );
      }

      return parseApplyWorkspaceTransitionResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          updateResult.message,
          "Status change could not be saved due to a storage error.",
          {
            operation: "workspace.updateStatusCompareAndSetWithAudit",
            workspaceId: parsed.data.workspaceId,
          },
        ),
      );
    }

    return parseApplyWorkspaceTransitionResultV1({
      ok: true,
      workspace: updatedWorkspace,
      auditEvent,
    });
  } catch (error) {
    return parseApplyWorkspaceTransitionResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Status change failed due to an unexpected error.",
        {
          operation: "workspace.applyTransition",
        },
      ),
    );
  }
}
