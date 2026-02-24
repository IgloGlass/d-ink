import { apiRequest } from "./api-client";

export type WorkspaceStatusV1 =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "ready_for_approval"
  | "approved_for_export"
  | "exported"
  | "client_accepted"
  | "filed";

export type WorkspaceV1 = {
  companyId: string;
  createdAt: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  id: string;
  status: WorkspaceStatusV1;
  tenantId: string;
  updatedAt: string;
};

export type ListWorkspacesResponseV1 = {
  ok: true;
  workspaces: WorkspaceV1[];
};

export type CreateWorkspaceInputV1 = {
  companyId: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  tenantId: string;
};

export type CreateWorkspaceResponseV1 = {
  auditEvent: { id: string; eventType: string };
  ok: true;
  workspace: WorkspaceV1;
};

export type GetWorkspaceResponseV1 = {
  ok: true;
  workspace: WorkspaceV1;
};

export type TransitionWorkspaceInputV1 = {
  reason?: string;
  tenantId: string;
  toStatus: WorkspaceStatusV1;
  workspaceId: string;
};

export type TransitionWorkspaceResponseV1 = {
  auditEvent: { id: string; eventType: string };
  ok: true;
  workspace: WorkspaceV1;
};

export async function listWorkspacesByTenantV1(input: {
  tenantId: string;
}): Promise<ListWorkspacesResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListWorkspacesResponseV1>({
    path: `/v1/workspaces?${search.toString()}`,
    method: "GET",
  });
}

export async function createWorkspaceV1(
  input: CreateWorkspaceInputV1,
): Promise<CreateWorkspaceResponseV1> {
  return apiRequest<CreateWorkspaceResponseV1>({
    path: "/v1/workspaces",
    method: "POST",
    body: input,
  });
}

export async function getWorkspaceByIdV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetWorkspaceResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetWorkspaceResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}?${search.toString()}`,
    method: "GET",
  });
}

export async function applyWorkspaceTransitionV1(
  input: TransitionWorkspaceInputV1,
): Promise<TransitionWorkspaceResponseV1> {
  return apiRequest<TransitionWorkspaceResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/transitions`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      toStatus: input.toStatus,
      reason: input.reason,
    },
  });
}
