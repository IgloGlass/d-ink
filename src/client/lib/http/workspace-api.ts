import {
  type ApplyAnnualReportExtractionOverridesResultV1,
  type ConfirmAnnualReportExtractionResultV1,
  type GetActiveAnnualReportExtractionResultV1,
  type RunAnnualReportExtractionResultV1,
  parseApplyAnnualReportExtractionOverridesResultV1,
  parseConfirmAnnualReportExtractionResultV1,
  parseGetActiveAnnualReportExtractionResultV1,
  parseRunAnnualReportExtractionResultV1,
} from "../../../shared/contracts/annual-report-extraction.v1";
import {
  type CompleteTaskResultV1,
  type CreateCommentResultV1,
  type CreateTaskResultV1,
  type ListCommentsResultV1,
  type ListTasksResultV1,
  parseCompleteTaskResultV1,
  parseCreateCommentResultV1,
  parseCreateTaskResultV1,
  parseListCommentsResultV1,
  parseListTasksResultV1,
} from "../../../shared/contracts/collaboration.v1";
import {
  type CreatePdfExportResultV1,
  type ListWorkspaceExportsResultV1,
  parseCreatePdfExportResultV1,
  parseListWorkspaceExportsResultV1,
} from "../../../shared/contracts/export-package.v1";
import {
  type ApplyInk2FormOverridesResultV1,
  type GetActiveInk2FormResultV1,
  type RunInk2FormResultV1,
  parseApplyInk2FormOverridesResultV1,
  parseGetActiveInk2FormResultV1,
  parseRunInk2FormResultV1,
} from "../../../shared/contracts/ink2-form.v1";
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
  type ApplyTaxAdjustmentOverridesResultV1,
  type GetActiveTaxAdjustmentsResultV1,
  type RunTaxAdjustmentResultV1,
  parseApplyTaxAdjustmentOverridesResultV1,
  parseGetActiveTaxAdjustmentsResultV1,
  parseRunTaxAdjustmentResultV1,
} from "../../../shared/contracts/tax-adjustments.v1";
import {
  type GetActiveTaxSummaryResultV1,
  type RunTaxSummaryResultV1,
  parseGetActiveTaxSummaryResultV1,
  parseRunTaxSummaryResultV1,
} from "../../../shared/contracts/tax-summary.v1";
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

export type RunAnnualReportExtractionInputV1 = {
  fileBytesBase64: string;
  fileName: string;
  fileType?: "pdf" | "docx";
  policyVersion: string;
  tenantId: string;
  workspaceId: string;
};

export type RunAnnualReportExtractionResponseV1 = Extract<
  RunAnnualReportExtractionResultV1,
  { ok: true }
>;

export type GetActiveAnnualReportExtractionResponseV1 = Extract<
  GetActiveAnnualReportExtractionResultV1,
  { ok: true }
>;

export type ApplyAnnualReportOverridesInputV1 = {
  expectedActiveExtraction: {
    artifactId: string;
    version: number;
  };
  overrides: Array<{
    fieldKey:
      | "companyName"
      | "organizationNumber"
      | "fiscalYearStart"
      | "fiscalYearEnd"
      | "accountingStandard"
      | "profitBeforeTax";
    reason: string;
    value: string | number;
  }>;
  tenantId: string;
  workspaceId: string;
};

export type ApplyAnnualReportOverridesResponseV1 = Extract<
  ApplyAnnualReportExtractionOverridesResultV1,
  { ok: true }
>;

export type ConfirmAnnualReportExtractionInputV1 = {
  expectedActiveExtraction: {
    artifactId: string;
    version: number;
  };
  tenantId: string;
  workspaceId: string;
};

export type ConfirmAnnualReportExtractionResponseV1 = Extract<
  ConfirmAnnualReportExtractionResultV1,
  { ok: true }
>;

export type RunTaxAdjustmentsInputV1 = {
  policyVersion: string;
  tenantId: string;
  workspaceId: string;
};

export type RunTaxAdjustmentsResponseV1 = Extract<
  RunTaxAdjustmentResultV1,
  { ok: true }
>;

export type GetActiveTaxAdjustmentsResponseV1 = Extract<
  GetActiveTaxAdjustmentsResultV1,
  { ok: true }
>;

export type ApplyTaxAdjustmentsOverridesInputV1 = {
  expectedActiveAdjustments: {
    artifactId: string;
    version: number;
  };
  overrides: Array<{
    amount: number;
    decisionId: string;
    reason: string;
    targetField?:
      | "INK2S.depreciation_adjustment"
      | "INK2S.non_deductible_expenses"
      | "INK2S.other_manual_adjustments"
      | "INK2S.representation_non_deductible";
  }>;
  tenantId: string;
  workspaceId: string;
};

export type ApplyTaxAdjustmentsOverridesResponseV1 = Extract<
  ApplyTaxAdjustmentOverridesResultV1,
  { ok: true }
>;

export type RunTaxSummaryInputV1 = {
  tenantId: string;
  workspaceId: string;
};

export type RunTaxSummaryResponseV1 = Extract<RunTaxSummaryResultV1, { ok: true }>;

export type GetActiveTaxSummaryResponseV1 = Extract<
  GetActiveTaxSummaryResultV1,
  { ok: true }
>;

export type RunInk2FormInputV1 = {
  tenantId: string;
  workspaceId: string;
};

export type RunInk2FormResponseV1 = Extract<RunInk2FormResultV1, { ok: true }>;

export type GetActiveInk2FormResponseV1 = Extract<
  GetActiveInk2FormResultV1,
  { ok: true }
>;

export type ApplyInk2OverridesInputV1 = {
  expectedActiveForm: {
    artifactId: string;
    version: number;
  };
  overrides: Array<{
    amount: number;
    fieldId:
      | "INK2R.profit_before_tax"
      | "INK2S.corporate_tax"
      | "INK2S.depreciation_adjustment"
      | "INK2S.non_deductible_expenses"
      | "INK2S.other_manual_adjustments"
      | "INK2S.representation_non_deductible"
      | "INK2S.taxable_income"
      | "INK2S.total_adjustments";
    reason: string;
  }>;
  tenantId: string;
  workspaceId: string;
};

export type ApplyInk2OverridesResponseV1 = Extract<
  ApplyInk2FormOverridesResultV1,
  { ok: true }
>;

export type CreatePdfExportInputV1 = {
  tenantId: string;
  workspaceId: string;
};

export type CreatePdfExportResponseV1 = Extract<
  CreatePdfExportResultV1,
  { ok: true }
>;

export type ListWorkspaceExportsResponseV1 = Extract<
  ListWorkspaceExportsResultV1,
  { ok: true }
>;

export type ListCommentsResponseV1 = Extract<ListCommentsResultV1, { ok: true }>;
export type CreateCommentInputV1 = {
  body: string;
  tenantId: string;
  workspaceId: string;
};
export type CreateCommentResponseV1 = Extract<CreateCommentResultV1, { ok: true }>;
export type ListTasksResponseV1 = Extract<ListTasksResultV1, { ok: true }>;
export type CreateTaskInputV1 = {
  assignedToUserId?: string;
  description?: string;
  tenantId: string;
  title: string;
  workspaceId: string;
};
export type CreateTaskResponseV1 = Extract<CreateTaskResultV1, { ok: true }>;
export type CompleteTaskInputV1 = {
  taskId: string;
  tenantId: string;
  workspaceId: string;
};
export type CompleteTaskResponseV1 = Extract<CompleteTaskResultV1, { ok: true }>;

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

function parseRunAnnualReportExtractionHttpResponseV1(
  payload: unknown,
): RunAnnualReportExtractionResponseV1 {
  return expectSuccessResultV1(parseRunAnnualReportExtractionResultV1(payload));
}

function parseGetActiveAnnualReportExtractionHttpResponseV1(
  payload: unknown,
): GetActiveAnnualReportExtractionResponseV1 {
  return expectSuccessResultV1(
    parseGetActiveAnnualReportExtractionResultV1(payload),
  );
}

function parseApplyAnnualReportOverridesHttpResponseV1(
  payload: unknown,
): ApplyAnnualReportOverridesResponseV1 {
  return expectSuccessResultV1(
    parseApplyAnnualReportExtractionOverridesResultV1(payload),
  );
}

function parseConfirmAnnualReportExtractionHttpResponseV1(
  payload: unknown,
): ConfirmAnnualReportExtractionResponseV1 {
  return expectSuccessResultV1(
    parseConfirmAnnualReportExtractionResultV1(payload),
  );
}

function parseRunTaxAdjustmentsHttpResponseV1(
  payload: unknown,
): RunTaxAdjustmentsResponseV1 {
  return expectSuccessResultV1(parseRunTaxAdjustmentResultV1(payload));
}

function parseGetActiveTaxAdjustmentsHttpResponseV1(
  payload: unknown,
): GetActiveTaxAdjustmentsResponseV1 {
  return expectSuccessResultV1(parseGetActiveTaxAdjustmentsResultV1(payload));
}

function parseApplyTaxAdjustmentsOverridesHttpResponseV1(
  payload: unknown,
): ApplyTaxAdjustmentsOverridesResponseV1 {
  return expectSuccessResultV1(parseApplyTaxAdjustmentOverridesResultV1(payload));
}

function parseRunTaxSummaryHttpResponseV1(
  payload: unknown,
): RunTaxSummaryResponseV1 {
  return expectSuccessResultV1(parseRunTaxSummaryResultV1(payload));
}

function parseGetActiveTaxSummaryHttpResponseV1(
  payload: unknown,
): GetActiveTaxSummaryResponseV1 {
  return expectSuccessResultV1(parseGetActiveTaxSummaryResultV1(payload));
}

function parseRunInk2FormHttpResponseV1(payload: unknown): RunInk2FormResponseV1 {
  return expectSuccessResultV1(parseRunInk2FormResultV1(payload));
}

function parseGetActiveInk2FormHttpResponseV1(
  payload: unknown,
): GetActiveInk2FormResponseV1 {
  return expectSuccessResultV1(parseGetActiveInk2FormResultV1(payload));
}

function parseApplyInk2OverridesHttpResponseV1(
  payload: unknown,
): ApplyInk2OverridesResponseV1 {
  return expectSuccessResultV1(parseApplyInk2FormOverridesResultV1(payload));
}

function parseCreatePdfExportHttpResponseV1(
  payload: unknown,
): CreatePdfExportResponseV1 {
  return expectSuccessResultV1(parseCreatePdfExportResultV1(payload));
}

function parseListWorkspaceExportsHttpResponseV1(
  payload: unknown,
): ListWorkspaceExportsResponseV1 {
  return expectSuccessResultV1(parseListWorkspaceExportsResultV1(payload));
}

function parseListCommentsHttpResponseV1(payload: unknown): ListCommentsResponseV1 {
  return expectSuccessResultV1(parseListCommentsResultV1(payload));
}

function parseCreateCommentHttpResponseV1(
  payload: unknown,
): CreateCommentResponseV1 {
  return expectSuccessResultV1(parseCreateCommentResultV1(payload));
}

function parseListTasksHttpResponseV1(payload: unknown): ListTasksResponseV1 {
  return expectSuccessResultV1(parseListTasksResultV1(payload));
}

function parseCreateTaskHttpResponseV1(payload: unknown): CreateTaskResponseV1 {
  return expectSuccessResultV1(parseCreateTaskResultV1(payload));
}

function parseCompleteTaskHttpResponseV1(
  payload: unknown,
): CompleteTaskResponseV1 {
  return expectSuccessResultV1(parseCompleteTaskResultV1(payload));
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

export async function runAnnualReportExtractionV1(
  input: RunAnnualReportExtractionInputV1,
): Promise<RunAnnualReportExtractionResponseV1> {
  return apiRequest<RunAnnualReportExtractionResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/annual-report-runs`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileBytesBase64: input.fileBytesBase64,
      policyVersion: input.policyVersion,
    },
    parseResponse: parseRunAnnualReportExtractionHttpResponseV1,
  });
}

export async function getActiveAnnualReportExtractionV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetActiveAnnualReportExtractionResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetActiveAnnualReportExtractionResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/annual-report-extractions/active?${search.toString()}`,
    method: "GET",
    parseResponse: parseGetActiveAnnualReportExtractionHttpResponseV1,
  });
}

export async function applyAnnualReportOverridesV1(
  input: ApplyAnnualReportOverridesInputV1,
): Promise<ApplyAnnualReportOverridesResponseV1> {
  return apiRequest<ApplyAnnualReportOverridesResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/annual-report-extractions/overrides`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      expectedActiveExtraction: input.expectedActiveExtraction,
      overrides: input.overrides,
    },
    parseResponse: parseApplyAnnualReportOverridesHttpResponseV1,
  });
}

export async function confirmAnnualReportExtractionV1(
  input: ConfirmAnnualReportExtractionInputV1,
): Promise<ConfirmAnnualReportExtractionResponseV1> {
  return apiRequest<ConfirmAnnualReportExtractionResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/annual-report-extractions/confirm`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      expectedActiveExtraction: input.expectedActiveExtraction,
    },
    parseResponse: parseConfirmAnnualReportExtractionHttpResponseV1,
  });
}

export async function runTaxAdjustmentsV1(
  input: RunTaxAdjustmentsInputV1,
): Promise<RunTaxAdjustmentsResponseV1> {
  return apiRequest<RunTaxAdjustmentsResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tax-adjustment-runs`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      policyVersion: input.policyVersion,
    },
    parseResponse: parseRunTaxAdjustmentsHttpResponseV1,
  });
}

export async function getActiveTaxAdjustmentsV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetActiveTaxAdjustmentsResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetActiveTaxAdjustmentsResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tax-adjustments/active?${search.toString()}`,
    method: "GET",
    parseResponse: parseGetActiveTaxAdjustmentsHttpResponseV1,
  });
}

export async function applyTaxAdjustmentsOverridesV1(
  input: ApplyTaxAdjustmentsOverridesInputV1,
): Promise<ApplyTaxAdjustmentsOverridesResponseV1> {
  return apiRequest<ApplyTaxAdjustmentsOverridesResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tax-adjustments/overrides`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      expectedActiveAdjustments: input.expectedActiveAdjustments,
      overrides: input.overrides,
    },
    parseResponse: parseApplyTaxAdjustmentsOverridesHttpResponseV1,
  });
}

export async function runTaxSummaryV1(
  input: RunTaxSummaryInputV1,
): Promise<RunTaxSummaryResponseV1> {
  return apiRequest<RunTaxSummaryResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tax-summary-runs`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
    },
    parseResponse: parseRunTaxSummaryHttpResponseV1,
  });
}

export async function getActiveTaxSummaryV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetActiveTaxSummaryResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetActiveTaxSummaryResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tax-summary/active?${search.toString()}`,
    method: "GET",
    parseResponse: parseGetActiveTaxSummaryHttpResponseV1,
  });
}

export async function runInk2FormV1(
  input: RunInk2FormInputV1,
): Promise<RunInk2FormResponseV1> {
  return apiRequest<RunInk2FormResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/ink2-form-runs`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
    },
    parseResponse: parseRunInk2FormHttpResponseV1,
  });
}

export async function getActiveInk2FormV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<GetActiveInk2FormResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<GetActiveInk2FormResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/ink2-form/active?${search.toString()}`,
    method: "GET",
    parseResponse: parseGetActiveInk2FormHttpResponseV1,
  });
}

export async function applyInk2OverridesV1(
  input: ApplyInk2OverridesInputV1,
): Promise<ApplyInk2OverridesResponseV1> {
  return apiRequest<ApplyInk2OverridesResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/ink2-form/overrides`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      expectedActiveForm: input.expectedActiveForm,
      overrides: input.overrides,
    },
    parseResponse: parseApplyInk2OverridesHttpResponseV1,
  });
}

export async function createPdfExportV1(
  input: CreatePdfExportInputV1,
): Promise<CreatePdfExportResponseV1> {
  return apiRequest<CreatePdfExportResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/exports/pdf`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
    },
    parseResponse: parseCreatePdfExportHttpResponseV1,
  });
}

export async function listWorkspaceExportsV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<ListWorkspaceExportsResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListWorkspaceExportsResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/exports?${search.toString()}`,
    method: "GET",
    parseResponse: parseListWorkspaceExportsHttpResponseV1,
  });
}

export async function listCommentsV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<ListCommentsResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListCommentsResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/comments?${search.toString()}`,
    method: "GET",
    parseResponse: parseListCommentsHttpResponseV1,
  });
}

export async function createCommentV1(
  input: CreateCommentInputV1,
): Promise<CreateCommentResponseV1> {
  return apiRequest<CreateCommentResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/comments`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      body: input.body,
    },
    parseResponse: parseCreateCommentHttpResponseV1,
  });
}

export async function listTasksV1(input: {
  tenantId: string;
  workspaceId: string;
}): Promise<ListTasksResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  return apiRequest<ListTasksResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tasks?${search.toString()}`,
    method: "GET",
    parseResponse: parseListTasksHttpResponseV1,
  });
}

export async function createTaskV1(
  input: CreateTaskInputV1,
): Promise<CreateTaskResponseV1> {
  return apiRequest<CreateTaskResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tasks`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      assignedToUserId: input.assignedToUserId,
    },
    parseResponse: parseCreateTaskHttpResponseV1,
  });
}

export async function completeTaskV1(
  input: CompleteTaskInputV1,
): Promise<CompleteTaskResponseV1> {
  return apiRequest<CompleteTaskResponseV1>({
    path: `/v1/workspaces/${input.workspaceId}/tasks/${input.taskId}/complete`,
    method: "POST",
    body: {
      tenantId: input.tenantId,
    },
    parseResponse: parseCompleteTaskHttpResponseV1,
  });
}
