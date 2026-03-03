import {
  type ApplyMappingOverridesResultV1,
  type GetActiveMappingDecisionsResultV1,
  type MappingOverrideInstructionV1,
  type MappingPreferenceScopeV1,
  parseApplyMappingOverridesResultV1,
  parseGetActiveMappingDecisionsResultV1,
} from "../../../shared/contracts/mapping-override.v1";
import {
  type GenerateMappingReviewSuggestionsResultV1,
  parseGenerateMappingReviewSuggestionsResultV1,
} from "../../../shared/contracts/mapping-review.v1";
import type { SilverfinTaxCategoryCodeV1 } from "../../../shared/contracts/mapping.v1";
import {
  type ExecuteTrialBalancePipelineResultV1,
  parseExecuteTrialBalancePipelineResultV1,
} from "../../../shared/contracts/tb-pipeline-run.v1";
import type { TrialBalanceFileTypeV1 } from "../../../shared/contracts/trial-balance.v1";
import {
  type ApplyWorkspaceTransitionResultV1,
  type CreateWorkspaceResultV1,
  type GetWorkspaceByIdResultV1,
  type ListWorkspacesByTenantResultV1,
  parseApplyWorkspaceTransitionResultV1,
  parseCreateWorkspaceResultV1,
  parseGetWorkspaceByIdResultV1,
  parseListWorkspacesByTenantResultV1,
} from "../../../shared/contracts/workspace-lifecycle.v1";
import type {
  WorkspaceStatusV1 as SharedWorkspaceStatusV1,
  WorkspaceV1 as SharedWorkspaceV1,
} from "../../../shared/contracts/workspace.v1";
import { ApiClientError, apiRequest } from "./api-client";

export type WorkspaceStatusV1 = SharedWorkspaceStatusV1;
export type WorkspaceV1 = SharedWorkspaceV1;
export type ListWorkspacesResponseV1 = Extract<
  ListWorkspacesByTenantResultV1,
  { ok: true }
>;

export type CreateWorkspaceInputV1 = {
  companyId: string;
  fiscalYearEnd: string;
  fiscalYearStart: string;
  tenantId: string;
};

export type CreateWorkspaceResponseV1 = Extract<
  CreateWorkspaceResultV1,
  { ok: true }
>;

export type GetWorkspaceResponseV1 = {
  ok: true;
  workspace: WorkspaceV1;
  allowedNextStatuses: WorkspaceStatusV1[];
};

export type TransitionWorkspaceInputV1 = {
  reason?: string;
  tenantId: string;
  toStatus: WorkspaceStatusV1;
  workspaceId: string;
};

export type TransitionWorkspaceResponseV1 = Extract<
  ApplyWorkspaceTransitionResultV1,
  { ok: true }
>;

export type GetActiveMappingResponseV1 = Extract<
  GetActiveMappingDecisionsResultV1,
  { ok: true }
>;

export type ApplyMappingOverrideInputV1 = Omit<
  MappingOverrideInstructionV1,
  "scope" | "selectedCategoryCode"
> & {
  scope: MappingPreferenceScopeV1;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
};

export type ApplyMappingOverridesInputV1 = {
  expectedActiveMapping: {
    artifactId: string;
    version: number;
  };
  overrides: ApplyMappingOverrideInputV1[];
  tenantId: string;
  workspaceId: string;
};

export type ApplyMappingOverridesResponseV1 = Extract<
  ApplyMappingOverridesResultV1,
  { ok: true }
>;

export type GenerateMappingReviewSuggestionsInputV1 = {
  tenantId: string;
  workspaceId: string;
  scope?: "return" | "user";
  maxSuggestions?: number;
};

export type GenerateMappingReviewSuggestionsResponseV1 = Extract<
  GenerateMappingReviewSuggestionsResultV1,
  { ok: true }
>;

export type RunTrialBalancePipelineInputV1 = {
  tenantId: string;
  workspaceId: string;
  fileName: string;
  fileBytesBase64: string;
  fileType?: TrialBalanceFileTypeV1;
  policyVersion: string;
};

export type RunTrialBalancePipelineResponseV1 = Extract<
  ExecuteTrialBalancePipelineResultV1,
  { ok: true }
>;

function expectSuccessResultV1<
  TResult extends
    | { ok: true }
    | {
        ok: false;
        error: {
          code: string;
          context: Record<string, unknown>;
          message: string;
          user_message: string;
        };
      },
>(result: TResult): Extract<TResult, { ok: true }> {
  if (!result.ok) {
    throw new ApiClientError({
      status: 200,
      code: result.error.code,
      message: result.error.message,
      userMessage: result.error.user_message,
      context: result.error.context,
    });
  }

  return result as Extract<TResult, { ok: true }>;
}

function parseListWorkspacesHttpResponseV1(
  payload: unknown,
): ListWorkspacesResponseV1 {
  return expectSuccessResultV1(parseListWorkspacesByTenantResultV1(payload));
}

function parseCreateWorkspaceHttpResponseV1(
  payload: unknown,
): CreateWorkspaceResponseV1 {
  return expectSuccessResultV1(parseCreateWorkspaceResultV1(payload));
}

function parseGetWorkspaceHttpResponseV1(
  payload: unknown,
): GetWorkspaceResponseV1 {
  const result = expectSuccessResultV1(parseGetWorkspaceByIdResultV1(payload));
  if (!result.workspace) {
    throw new ApiClientError({
      status: 200,
      code: "WORKSPACE_NOT_FOUND",
      message: "Workspace lookup returned null in a success response.",
      userMessage: "Workspace could not be found.",
      context: {},
    });
  }

  return {
    ok: true,
    workspace: result.workspace,
  };
}

function parseTransitionWorkspaceHttpResponseV1(
  payload: unknown,
): TransitionWorkspaceResponseV1 {
  return expectSuccessResultV1(parseApplyWorkspaceTransitionResultV1(payload));
}

function parseGetActiveMappingHttpResponseV1(
  payload: unknown,
): GetActiveMappingResponseV1 {
  return expectSuccessResultV1(parseGetActiveMappingDecisionsResultV1(payload));
}

function parseApplyMappingOverridesHttpResponseV1(
  payload: unknown,
): ApplyMappingOverridesResponseV1 {
  return expectSuccessResultV1(parseApplyMappingOverridesResultV1(payload));
}

function parseGenerateMappingReviewSuggestionsHttpResponseV1(
  payload: unknown,
): GenerateMappingReviewSuggestionsResponseV1 {
  return expectSuccessResultV1(
    parseGenerateMappingReviewSuggestionsResultV1(payload),
  );
}

function parseRunTrialBalancePipelineHttpResponseV1(
  payload: unknown,
): RunTrialBalancePipelineResponseV1 {
  return expectSuccessResultV1(parseExecuteTrialBalancePipelineResultV1(payload));
}

export async function listWorkspacesByTenantV1(input: {
  tenantId: string;
}): Promise<ListWorkspacesResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListWorkspacesResponseV1>({
    path: `/v1/workspaces?${search.toString()}`,
    method: "GET",
    parseResponse: parseListWorkspacesHttpResponseV1,
  });
}

export async function createWorkspaceV1(
  input: CreateWorkspaceInputV1,
): Promise<CreateWorkspaceResponseV1> {
  return apiRequest<CreateWorkspaceResponseV1>({
    path: "/v1/workspaces",
    method: "POST",
    body: input,
    parseResponse: parseCreateWorkspaceHttpResponseV1,
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
    parseResponse: parseGetWorkspaceHttpResponseV1,
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
    parseResponse: parseTransitionWorkspaceHttpResponseV1,
  });
}

export async function getActiveMappingDecisionsV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetActiveMappingResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetActiveMappingResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/mapping-decisions/active?${search.toString()}`,
    method: "GET",
    parseResponse: parseGetActiveMappingHttpResponseV1,
  });
}

export async function applyMappingOverridesV1(
  input: ApplyMappingOverridesInputV1,
): Promise<ApplyMappingOverridesResponseV1> {
  return apiRequest<ApplyMappingOverridesResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/mapping-overrides`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      expectedActiveMapping: input.expectedActiveMapping,
      overrides: input.overrides,
    },
    parseResponse: parseApplyMappingOverridesHttpResponseV1,
  });
}

export async function generateMappingReviewSuggestionsV1(input: {
  tenantId: string;
  workspaceId: string;
  scope?: "return" | "user";
  maxSuggestions?: number;
}): Promise<GenerateMappingReviewSuggestionsResponseV1> {
  return apiRequest<GenerateMappingReviewSuggestionsResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/mapping-review-suggestions`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      scope: input.scope ?? "return",
      maxSuggestions: input.maxSuggestions,
    },
    parseResponse: parseGenerateMappingReviewSuggestionsHttpResponseV1,
  });
}

export async function runTrialBalancePipelineV1(
  input: RunTrialBalancePipelineInputV1,
): Promise<RunTrialBalancePipelineResponseV1> {
  return apiRequest<RunTrialBalancePipelineResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tb-pipeline-runs`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileBytesBase64: input.fileBytesBase64,
      fileType: input.fileType,
      policyVersion: input.policyVersion,
    },
    parseResponse: parseRunTrialBalancePipelineHttpResponseV1,
  });
}
