import type {
  ApplyWorkspaceTransitionSuccessV1,
  CreateWorkspaceSuccessV1,
  GetWorkspaceByIdHttpSuccessV1,
  ListWorkspacesByTenantSuccessV1,
  WorkspaceStatusV1,
} from "../../../shared/contracts";
import {
  ApplyWorkspaceTransitionSuccessV1Schema,
  CreateWorkspaceSuccessV1Schema,
  safeParseGetWorkspaceByIdHttpSuccessV1,
  ListWorkspacesByTenantSuccessV1Schema,
} from "../../../shared/contracts";

import { apiRequest } from "./api-client";

export type CreateWorkspaceInputV1 = {
  companyId: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  tenantId: string;
};

export type TransitionWorkspaceInputV1 = {
  reason?: string;
  tenantId: string;
  toStatus: WorkspaceStatusV1;
  workspaceId: string;
};

export { type WorkspaceStatusV1 };

export async function listWorkspacesByTenantV1(input: {
  tenantId: string;
}): Promise<ListWorkspacesByTenantSuccessV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListWorkspacesByTenantSuccessV1>({
    path: `/v1/workspaces?${search.toString()}`,
    method: "GET",
    safeParseResponse: (payload) =>
      ListWorkspacesByTenantSuccessV1Schema.safeParse(payload),
  });
}

export async function createWorkspaceV1(
  input: CreateWorkspaceInputV1,
): Promise<CreateWorkspaceSuccessV1> {
  return apiRequest<CreateWorkspaceSuccessV1>({
    path: "/v1/workspaces",
    method: "POST",
    body: input,
    safeParseResponse: (payload) => CreateWorkspaceSuccessV1Schema.safeParse(payload),
  });
}

export async function getWorkspaceByIdV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetWorkspaceByIdHttpSuccessV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetWorkspaceByIdHttpSuccessV1>({
    path: `/v1/workspaces/${input.workspaceId}?${search.toString()}`,
    method: "GET",
    safeParseResponse: safeParseGetWorkspaceByIdHttpSuccessV1,
  });
}

export async function applyWorkspaceTransitionV1(
  input: TransitionWorkspaceInputV1,
): Promise<ApplyWorkspaceTransitionSuccessV1> {
  return apiRequest<ApplyWorkspaceTransitionSuccessV1>({
    path: `/v1/workspaces/${input.workspaceId}/transitions`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      toStatus: input.toStatus,
      reason: input.reason,
    },
    safeParseResponse: (payload) =>
      ApplyWorkspaceTransitionSuccessV1Schema.safeParse(payload),
  });
}
