import { z } from "zod";

import {
  type AnnualReportFileTypeV1,
  ApplyAnnualReportExtractionOverridesRequestV1Schema,
  ClearAnnualReportDataRequestV1Schema,
  ConfirmAnnualReportExtractionRequestV1Schema,
  RunAnnualReportExtractionRequestV1Schema,
} from "../../shared/contracts/annual-report-extraction.v1";
import { CreateAnnualReportProcessingRunRequestV1Schema } from "../../shared/contracts/annual-report-processing-run.v1";
import { RunAnnualReportTaxAnalysisRequestV1Schema } from "../../shared/contracts/annual-report-tax-analysis.v1";
import { CreateAnnualReportUploadSessionRequestV1Schema } from "../../shared/contracts/annual-report-upload-session.v1";
import {
  CompleteTaskRequestV1Schema,
  CreateCommentRequestV1Schema,
  CreateTaskRequestV1Schema,
} from "../../shared/contracts/collaboration.v1";
import { IsoDateSchema, UuidV4Schema } from "../../shared/contracts/common.v1";
import {
  CreatePdfExportRequestV1Schema,
  ListWorkspaceExportsRequestV1Schema,
} from "../../shared/contracts/export-package.v1";
import {
  ApplyInk2FormOverridesRequestV1Schema,
  RunInk2FormRequestV1Schema,
} from "../../shared/contracts/ink2-form.v1";
import {
  RunMappingAiEnrichmentRequestV1Schema,
  parseRunMappingAiEnrichmentResultV1,
} from "../../shared/contracts/mapping-ai-enrichment.v1";
import {
  ExpectedActiveMappingRefV1Schema,
  MappingOverrideInstructionV1Schema,
} from "../../shared/contracts/mapping-override.v1";
import { GenerateMappingReviewSuggestionsRequestV1Schema } from "../../shared/contracts/mapping-review.v1";
import {
  ApplyTaxAdjustmentOverridesRequestV1Schema,
  RunTaxAdjustmentRequestV1Schema,
} from "../../shared/contracts/tax-adjustments.v1";
import { RunTaxSummaryRequestV1Schema } from "../../shared/contracts/tax-summary.v1";
import {
  ClearTrialBalancePipelineDataRequestV1Schema,
  ExecuteTrialBalancePipelineRequestV1Schema,
} from "../../shared/contracts/tb-pipeline-run.v1";
import { WorkspaceStatusV1Schema } from "../../shared/contracts/workspace.v1";
import type { Env } from "../../shared/types/env";
import {
  MAX_ANNUAL_REPORT_FILE_BYTES_V1,
  MAX_UPLOAD_JSON_BODY_BYTES_V1,
  parseContentLengthHeaderV1,
} from "../security/payload-limits.v1";
import {
  applyAnnualReportExtractionOverridesV1,
  clearAnnualReportDataV1,
  confirmAnnualReportExtractionV1,
  getActiveAnnualReportExtractionV1,
  getActiveAnnualReportTaxAnalysisV1,
} from "../workflow/annual-report-extraction.v1";
import {
  createAnnualReportProcessingRunV1,
  createAnnualReportUploadSessionV1,
  getLatestAnnualReportProcessingRunV1,
  startAnnualReportTaxAnalysisProcessingRunV1,
  uploadAnnualReportSourceV1,
} from "../workflow/annual-report-processing.v1";
import { resolveSessionPrincipalByTokenV1 } from "../workflow/auth-magic-link.v1";
import {
  completeTaskV1,
  createCommentV1,
  createTaskV1,
  listCommentsV1,
  listTasksV1,
} from "../workflow/collaboration.v1";
import { runMappingAiEnrichmentV1 } from "../workflow/mapping-ai-enrichment.v1";
import {
  applyMappingOverridesV1,
  getActiveMappingDecisionsV1,
} from "../workflow/mapping-override.v1";
import { generateMappingReviewSuggestionsV1 } from "../workflow/mapping-review.v1";
import {
  applyInk2FormOverridesV1,
  applyTaxAdjustmentOverridesV1,
  createPdfExportV1,
  getActiveInk2FormV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
  listWorkspaceExportsV1,
  runInk2FormV1,
  runTaxAdjustmentsV1,
  runTaxSummaryV1,
} from "../workflow/tax-core-workflow.v1";
import {
  clearTrialBalancePipelineDataV1,
  executeTrialBalancePipelineRunV1,
} from "../workflow/trial-balance-pipeline-run.v1";
import {
  buildAnnualReportRuntimeMetadataV1,
  createAnnualReportExtractionDepsV1,
  createAnnualReportProcessingDepsV1,
  createCollaborationDepsV1,
  createMappingAiEnrichmentDepsV1,
  createMappingOverrideDepsV1,
  createMappingReviewDepsV1,
  createResolveSessionPrincipalDepsV1,
  createTaxCoreWorkflowDepsV1,
  createTrialBalancePipelineRunDepsV1,
  createWorkspaceLifecycleDepsV1,
  resolveAnnualReportProcessingRuntimeV1,
} from "../workflow/workflow-deps.v1";
import {
  applyWorkspaceTransitionV1,
  createWorkspaceV1,
  getWorkspaceByIdV1,
  listWorkspacesByTenantV1,
} from "../workflow/workspace-lifecycle.v1";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
  createServiceFailureResponseV1,
  parseJsonBodyWithSchemaV1,
  validateOriginForPostV1,
} from "./http-helpers.v1";
import { parseCookiesV1 } from "./session-auth.v1";

const SESSION_COOKIE_NAME_V1 = "dink_session_v1";
const WORKSPACES_ROUTE_BASE_PATH_V1 = "/v1/workspaces";
const MAPPING_AI_ENRICHMENT_BACKGROUND_EXECUTION_BUDGET_MS = 900_000;

type WorkerExecutionContextV1 = {
  waitUntil(promise: Promise<unknown>): void;
};

function createAnnualReportRuntimeHeadersV1(env: Env): HeadersInit {
  const runtimeMetadata = buildAnnualReportRuntimeMetadataV1(env);

  return {
    "Cache-Control": "no-store",
    "X-Dink-Annual-Report-Engine": runtimeMetadata.extractionEngineVersion,
    "X-Dink-Annual-Report-Runtime": runtimeMetadata.runtimeFingerprint,
  };
}

function inferAnnualReportFileTypeFromNameV1(
  fileName: string,
): AnnualReportFileTypeV1 | null {
  const lower = fileName.toLowerCase();
  if (lower === "application/pdf") {
    return "pdf";
  }
  if (
    lower ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }
  if (lower.endsWith(".docx")) {
    return "docx";
  }
  return null;
}

const CreateWorkspaceHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
    fiscalYearStart: IsoDateSchema,
    fiscalYearEnd: IsoDateSchema,
  })
  .strict();

const WorkspaceGetQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

const WorkspaceTransitionHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    toStatus: WorkspaceStatusV1Schema,
    reason: z.string().optional(),
  })
  .strict();

const TrialBalancePipelineRunHttpRequestBodyV1Schema =
  ExecuteTrialBalancePipelineRequestV1Schema.omit({
    workspaceId: true,
    createdByUserId: true,
  });

const TrialBalanceClearHttpRequestBodyV1Schema =
  ClearTrialBalancePipelineDataRequestV1Schema.omit({
    workspaceId: true,
    clearedByUserId: true,
  });

const AnnualReportRunHttpRequestBodyV1Schema =
  RunAnnualReportExtractionRequestV1Schema.omit({
    workspaceId: true,
    createdByUserId: true,
  });

const AnnualReportProcessingMultipartFieldsV1Schema =
  CreateAnnualReportProcessingRunRequestV1Schema.omit({
    workspaceId: true,
    createdByUserId: true,
    fileName: true,
    fileType: true,
  });

const AnnualReportUploadSessionHttpRequestBodyV1Schema =
  CreateAnnualReportUploadSessionRequestV1Schema.omit({
    workspaceId: true,
    createdByUserId: true,
  });

const AnnualReportOverrideHttpRequestBodyV1Schema =
  ApplyAnnualReportExtractionOverridesRequestV1Schema.omit({
    workspaceId: true,
    authorUserId: true,
  });

const AnnualReportConfirmHttpRequestBodyV1Schema =
  ConfirmAnnualReportExtractionRequestV1Schema.omit({
    workspaceId: true,
    confirmedByUserId: true,
  });

const AnnualReportClearHttpRequestBodyV1Schema =
  ClearAnnualReportDataRequestV1Schema.omit({
    workspaceId: true,
    clearedByUserId: true,
  });

const AnnualReportTaxAnalysisRunHttpRequestBodyV1Schema =
  RunAnnualReportTaxAnalysisRequestV1Schema.omit({
    workspaceId: true,
    requestedByUserId: true,
  });

const TaxAdjustmentRunHttpRequestBodyV1Schema =
  RunTaxAdjustmentRequestV1Schema.omit({
    workspaceId: true,
    createdByUserId: true,
  });

const TaxAdjustmentOverrideHttpRequestBodyV1Schema =
  ApplyTaxAdjustmentOverridesRequestV1Schema.omit({
    workspaceId: true,
    authorUserId: true,
  });

const TaxSummaryRunHttpRequestBodyV1Schema = RunTaxSummaryRequestV1Schema.omit({
  workspaceId: true,
  createdByUserId: true,
});

const Ink2FormRunHttpRequestBodyV1Schema = RunInk2FormRequestV1Schema.omit({
  workspaceId: true,
  createdByUserId: true,
});

const Ink2FormOverrideHttpRequestBodyV1Schema =
  ApplyInk2FormOverridesRequestV1Schema.omit({
    workspaceId: true,
    authorUserId: true,
  });

const PdfExportHttpRequestBodyV1Schema = CreatePdfExportRequestV1Schema.omit({
  workspaceId: true,
  createdByUserId: true,
});

const ListExportsQueryV1Schema = ListWorkspaceExportsRequestV1Schema.omit({
  workspaceId: true,
});

const CreateCommentHttpRequestBodyV1Schema = CreateCommentRequestV1Schema.omit({
  workspaceId: true,
  createdByUserId: true,
});

const CreateTaskHttpRequestBodyV1Schema = CreateTaskRequestV1Schema.omit({
  workspaceId: true,
  createdByUserId: true,
});

const CompleteTaskHttpRequestBodyV1Schema = CompleteTaskRequestV1Schema.omit({
  workspaceId: true,
  taskId: true,
  completedByUserId: true,
});

const MappingOverrideHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    expectedActiveMapping: ExpectedActiveMappingRefV1Schema,
    overrides: z.array(MappingOverrideInstructionV1Schema).min(1),
  })
  .strict();

const MappingReviewHttpRequestBodyV1Schema =
  GenerateMappingReviewSuggestionsRequestV1Schema.omit({
    workspaceId: true,
  });
const MappingAiEnrichmentHttpRequestBodyV1Schema =
  RunMappingAiEnrichmentRequestV1Schema.omit({
    workspaceId: true,
  });

async function requireTenantSessionPrincipalV1(input: {
  request: Request;
  env: Env;
  tenantId: string;
}): Promise<
  | {
      ok: true;
      principal: {
        emailNormalized: string;
        role: "Admin" | "Editor";
        tenantId: string;
        userId: string;
      };
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const devBypass =
    input.env.DEV_AUTH_BYPASS_ENABLED === "1" ||
    input.env.DEV_AUTH_BYPASS_ENABLED === "true" ||
    input.env.DEV_AUTH_BYPASS_ENABLED === "yes";
  if (devBypass) {
    return {
      ok: true,
      principal: {
        emailNormalized:
          input.env.DEV_AUTH_DEFAULT_EMAIL ?? "demo@example.com",
        role: "Admin",
        tenantId: input.tenantId,
        userId: "00000000-0000-4000-8000-000000000001",
      },
    };
  }

  const cookies = parseCookiesV1(input.request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 401,
        code: "SESSION_MISSING",
        message: "A valid authenticated session is required.",
      }),
    };
  }

  const sessionLookupResult = await resolveSessionPrincipalByTokenV1(
    {
      sessionToken,
    },
    createResolveSessionPrincipalDepsV1(input.env),
  );

  if (!sessionLookupResult.ok) {
    if (
      sessionLookupResult.error.code === "SESSION_INVALID_OR_EXPIRED" ||
      sessionLookupResult.error.code === "INPUT_INVALID"
    ) {
      return {
        ok: false,
        response: createJsonErrorResponseV1({
          status: 401,
          code: "SESSION_INVALID_OR_EXPIRED",
          message: sessionLookupResult.error.message,
          userMessage: sessionLookupResult.error.user_message,
          context: sessionLookupResult.error.context,
        }),
      };
    }

    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 500,
        code: "PERSISTENCE_ERROR",
        message: sessionLookupResult.error.message,
        userMessage: sessionLookupResult.error.user_message,
        context: sessionLookupResult.error.context,
      }),
    };
  }

  if (sessionLookupResult.principal.tenantId !== input.tenantId) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 403,
        code: "TENANT_MISMATCH",
        message: "Session tenant does not match requested tenant.",
        userMessage:
          "You can only access workspace resources in the active tenant.",
        context: {
          requestTenantId: input.tenantId,
          sessionTenantId: sessionLookupResult.principal.tenantId,
        },
      }),
    };
  }

  return {
    ok: true,
    principal: sessionLookupResult.principal,
  };
}

type WorkflowFailureResultV1 = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
};

function createWorkflowFailureResponseV1(input: {
  code?: string;
  failure: WorkflowFailureResultV1;
  status: number;
}): Response {
  return createServiceFailureResponseV1({
    code: input.code,
    failure: input.failure,
    status: input.status,
  });
}

function mapWorkspaceLifecycleFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (input.error.code === "DUPLICATE_WORKSPACE") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (input.error.code === "WORKSPACE_NOT_FOUND") {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "STATE_CONFLICT") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (input.error.code === "TRANSITION_REJECTED") {
    const transitionError = input.error.context.transitionError;
    const transitionErrorCode =
      typeof transitionError === "object" &&
      transitionError !== null &&
      "code" in transitionError
        ? (transitionError as { code: unknown }).code
        : null;

    return createWorkflowFailureResponseV1({
      status: transitionErrorCode === "ROLE_FORBIDDEN" ? 403 : 409,
      failure: input,
    });
  }

  if (input.error.code === "PERSISTENCE_ERROR") {
    return createWorkflowFailureResponseV1({
      status: 500,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapTrialBalancePipelineFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (input.error.code === "WORKSPACE_NOT_FOUND") {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "PARSE_FAILED") {
    return createWorkflowFailureResponseV1({
      status: 422,
      failure: input,
    });
  }

  if (input.error.code === "RECONCILIATION_BLOCKED") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (
    input.error.code === "RECONCILIATION_FAILED" ||
    input.error.code === "MAPPING_FAILED"
  ) {
    return createWorkflowFailureResponseV1({
      status: 500,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapAnnualReportFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "EXTRACTION_NOT_FOUND" ||
    input.error.code === "TAX_ANALYSIS_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "STATE_CONFLICT") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (input.error.code === "PROCESSING_RUN_UNAVAILABLE") {
    return createWorkflowFailureResponseV1({
      status: 503,
      failure: input,
    });
  }

  if (input.error.code === "PARSE_FAILED") {
    return createWorkflowFailureResponseV1({
      status: 422,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapAnnualReportProcessingFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "PROCESSING_RUN_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "PROCESSING_RUN_UNAVAILABLE") {
    return createWorkflowFailureResponseV1({
      status: 503,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapTaxCoreFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "MAPPING_NOT_FOUND" ||
    input.error.code === "ADJUSTMENTS_NOT_FOUND" ||
    input.error.code === "SUMMARY_NOT_FOUND" ||
    input.error.code === "FORM_NOT_FOUND" ||
    input.error.code === "EXTRACTION_NOT_CONFIRMED" ||
    input.error.code === "EXTRACTION_NOT_FOUND" ||
    input.error.code === "TASK_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: input.error.code === "EXTRACTION_NOT_CONFIRMED" ? 409 : 404,
      failure: input,
    });
  }

  if (
    input.error.code === "STATE_CONFLICT" ||
    input.error.code === "EXPORT_NOT_ALLOWED"
  ) {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (input.error.code === "INPUT_INVALID_FISCAL_YEAR") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapMappingOverrideFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "MAPPING_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "STATE_CONFLICT") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

function mapMappingReviewFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "MAPPING_NOT_FOUND" ||
    input.error.code === "RECONCILIATION_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "RECONCILIATION_BLOCKED") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    failure: input,
  });
}

function mapMappingAiEnrichmentFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (
    input.error.code === "WORKSPACE_NOT_FOUND" ||
    input.error.code === "TRIAL_BALANCE_NOT_FOUND" ||
    input.error.code === "RECONCILIATION_NOT_FOUND" ||
    input.error.code === "MAPPING_NOT_FOUND"
  ) {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "RECONCILIATION_BLOCKED") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    failure: input,
  });
}

async function handleCreateWorkspaceRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Create workspace",
    schema: CreateWorkspaceHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createWorkspaceV1(
    {
      tenantId: parsedBody.tenantId,
      companyId: parsedBody.companyId,
      fiscalYearStart: parsedBody.fiscalYearStart,
      fiscalYearEnd: parsedBody.fiscalYearEnd,
      actor: {
        actorType: "user",
        actorRole: sessionGuardResult.principal.role,
        actorUserId: sessionGuardResult.principal.userId,
      },
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleGetWorkspaceRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getWorkspaceByIdV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  if (!result.workspace) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
      message: "Workspace does not exist for tenant and workspace ID.",
      userMessage: "Workspace could not be found.",
      context: {
        tenantId: parsedQuery.data.tenantId,
        workspaceId,
      },
    });
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleListWorkspacesRouteV1(
  request: Request,
  env: Env,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await listWorkspacesByTenantV1(
    {
      tenantId: parsedQuery.data.tenantId,
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleWorkspaceTransitionRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Workspace transition",
    schema: WorkspaceTransitionHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyWorkspaceTransitionV1(
    {
      tenantId: parsedBody.tenantId,
      workspaceId,
      toStatus: parsedBody.toStatus,
      reason: parsedBody.reason,
      actor: {
        actorType: "user",
        actorRole: sessionGuardResult.principal.role,
        actorUserId: sessionGuardResult.principal.userId,
      },
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleTrialBalancePipelineRunRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "TB pipeline",
    schema: TrialBalancePipelineRunHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }

  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await executeTrialBalancePipelineRunV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createTrialBalancePipelineRunDepsV1(env),
  );

  if (!result.ok) {
    return mapTrialBalancePipelineFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleClearTrialBalancePipelineDataRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "TB pipeline clear",
    schema: TrialBalanceClearHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }

  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await clearTrialBalancePipelineDataV1(
    {
      ...parsedBody,
      workspaceId,
      clearedByUserId: sessionGuardResult.principal.userId,
    },
    createTrialBalancePipelineRunDepsV1(env),
  );
  if (!result.ok) {
    return mapTrialBalancePipelineFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleAnnualReportRunRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const requestBody = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report",
    schema: AnnualReportRunHttpRequestBodyV1Schema,
  });
  if (!requestBody.ok) {
    return requestBody.response;
  }

  return createJsonErrorResponseV1({
    status: 410,
    code: "PROCESSING_RUN_UNAVAILABLE",
    message:
      "Synchronous annual-report runs are deprecated. Use upload sessions and processing runs.",
    userMessage:
      "Annual-report upload now runs asynchronously. Upload the file again from the annual-report module.",
    context: {
      replacementEndpoint: `/v1/workspaces/${workspaceId}/annual-report-upload-sessions`,
    },
  });
}

async function handleAnnualReportProcessingRunRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual report upload body is invalid.",
      userMessage: "The uploaded annual report could not be read.",
    });
  }

  const fieldsParse = AnnualReportProcessingMultipartFieldsV1Schema.safeParse({
    tenantId: formData.get("tenantId"),
    policyVersion: formData.get("policyVersion"),
  });
  if (!fieldsParse.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual-report upload fields are invalid.",
      userMessage: "The annual report upload is invalid. Refresh and retry.",
      context: {
        issues: fieldsParse.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join("."),
        })),
      },
    });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual report upload is missing a file payload.",
      userMessage: "Choose an annual report file before starting the analysis.",
    });
  }

  const fileType =
    inferAnnualReportFileTypeFromNameV1(fileEntry.name) ??
    inferAnnualReportFileTypeFromNameV1(fileEntry.type);

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: fieldsParse.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createAnnualReportProcessingRunV1(
    {
      tenantId: fieldsParse.data.tenantId,
      workspaceId,
      fileName: fileEntry.name,
      fileType: fileType ?? undefined,
      fileBytes: new Uint8Array(await fileEntry.arrayBuffer()),
      policyVersion: fieldsParse.data.policyVersion,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportProcessingDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportProcessingFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 202,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleCreateAnnualReportUploadSessionRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report upload session",
    schema: AnnualReportUploadSessionHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: bodyParseResult.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createAnnualReportUploadSessionV1(
    {
      ...bodyParseResult.data,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportProcessingDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportProcessingFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleUploadAnnualReportSourceRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
  uploadSessionId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual-report upload query parameters are invalid.",
      userMessage: "The annual report upload is invalid. Refresh and retry.",
    });
  }

  const contentLengthBytes = parseContentLengthHeaderV1(
    request.headers.get("Content-Length"),
  );
  if (contentLengthBytes === null || Number.isNaN(contentLengthBytes)) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual-report upload requires a valid Content-Length header.",
      userMessage:
        "The uploaded annual report could not be read. Upload the file again.",
    });
  }
  if (contentLengthBytes > MAX_ANNUAL_REPORT_FILE_BYTES_V1) {
    return createJsonErrorResponseV1({
      status: 413,
      code: "INPUT_INVALID",
      message: "Annual-report upload exceeds configured size limit.",
      userMessage:
        "The annual report file is too large. Upload a file smaller than 25 MB.",
      context: {
        maxBytes: MAX_ANNUAL_REPORT_FILE_BYTES_V1,
        actualBytes: contentLengthBytes,
      },
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await uploadAnnualReportSourceV1(
    {
      contentLengthBytes,
      createdByUserId: sessionGuardResult.principal.userId,
      tenantId: parsedQuery.data.tenantId,
      uploadBody: request.body,
      uploadSessionId,
      workspaceId,
    },
    createAnnualReportProcessingDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportProcessingFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 202,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleGetLatestAnnualReportProcessingRunRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual-report processing query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getLatestAnnualReportProcessingRunV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createAnnualReportProcessingDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportProcessingFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function handleAnnualReportRuntimeRouteV1(env: Env): Response {
  const runtime = resolveAnnualReportProcessingRuntimeV1(env);

  return Response.json(
    {
      ok: true,
      service: "annual-report-runtime",
      processing: {
        available: runtime.available,
        mode: runtime.mode,
        inlineFallbackEnabled: runtime.inlineFallbackEnabled,
        missingBindings: runtime.missingBindings,
      },
    },
    {
      status: 200,
      headers: createAnnualReportRuntimeHeadersV1(env),
    },
  );
}

async function handleClearAnnualReportRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report clear",
    schema: AnnualReportClearHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await clearAnnualReportDataV1(
    {
      ...parsedBody,
      workspaceId,
      clearedByUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportExtractionDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleGetActiveAnnualReportRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual report extraction query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveAnnualReportExtractionV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createAnnualReportExtractionDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleGetActiveAnnualReportTaxAnalysisRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Annual-report tax-analysis query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveAnnualReportTaxAnalysisV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createAnnualReportExtractionDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleRunAnnualReportTaxAnalysisRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report tax analysis run",
    schema: AnnualReportTaxAnalysisRunHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await startAnnualReportTaxAnalysisProcessingRunV1(
    {
      ...parsedBody,
      workspaceId,
      requestedByUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportProcessingDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: result.taxAnalysis ? 200 : 202,
    headers: createAnnualReportRuntimeHeadersV1(env),
  });
}

async function handleAnnualReportOverridesRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report override",
    schema: AnnualReportOverrideHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyAnnualReportExtractionOverridesV1(
    {
      ...parsedBody,
      workspaceId,
      authorUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportExtractionDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleConfirmAnnualReportRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Annual report confirmation",
    schema: AnnualReportConfirmHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await confirmAnnualReportExtractionV1(
    {
      ...parsedBody,
      workspaceId,
      confirmedByUserId: sessionGuardResult.principal.userId,
    },
    createAnnualReportExtractionDepsV1(env),
  );
  if (!result.ok) {
    return mapAnnualReportFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleRunTaxAdjustmentsRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Tax-adjustment run",
    schema: TaxAdjustmentRunHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await runTaxAdjustmentsV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleGetActiveTaxAdjustmentsRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Tax-adjustment query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveTaxAdjustmentsV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleTaxAdjustmentOverridesRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Tax-adjustment override",
    schema: TaxAdjustmentOverrideHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyTaxAdjustmentOverridesV1(
    {
      ...parsedBody,
      workspaceId,
      authorUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleRunTaxSummaryRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Tax summary run",
    schema: TaxSummaryRunHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await runTaxSummaryV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleGetActiveTaxSummaryRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Tax summary query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveTaxSummaryV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleRunInk2FormRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "INK2 run",
    schema: Ink2FormRunHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await runInk2FormV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleGetActiveInk2FormRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "INK2 query parameters are invalid.",
    });
  }
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveInk2FormV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleInk2FormOverridesRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "INK2 override",
    schema: Ink2FormOverrideHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyInk2FormOverridesV1(
    {
      ...parsedBody,
      workspaceId,
      authorUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handlePdfExportRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Export",
    schema: PdfExportHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createPdfExportV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleListExportsRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = ListExportsQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Export query parameters are invalid.",
    });
  }
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await listWorkspaceExportsV1(
    {
      ...parsedQuery.data,
      workspaceId,
    },
    createTaxCoreWorkflowDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleListCommentsRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Comments query parameters are invalid.",
    });
  }
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await listCommentsV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createCollaborationDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleCreateCommentRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Create comment",
    schema: CreateCommentHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createCommentV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createCollaborationDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleListTasksRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Tasks query parameters are invalid.",
    });
  }
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await listTasksV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createCollaborationDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleCreateTaskRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Create task",
    schema: CreateTaskHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createTaskV1(
    {
      ...parsedBody,
      workspaceId,
      createdByUserId: sessionGuardResult.principal.userId,
    },
    createCollaborationDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleCompleteTaskRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
  taskId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }
  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Complete task",
    schema: CompleteTaskHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await completeTaskV1(
    {
      ...parsedBody,
      workspaceId,
      taskId,
      completedByUserId: sessionGuardResult.principal.userId,
    },
    createCollaborationDepsV1(env),
  );
  if (!result.ok) {
    return mapTaxCoreFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleGetActiveMappingRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Mapping query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getActiveMappingDecisionsV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createMappingOverrideDepsV1(env),
  );
  if (!result.ok) {
    return mapMappingOverrideFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleApplyMappingOverridesRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Mapping override",
    schema: MappingOverrideHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyMappingOverridesV1(
    {
      ...parsedBody,
      workspaceId,
    },
    {
      actorUserId: sessionGuardResult.principal.userId,
    },
    createMappingOverrideDepsV1(env),
  );
  if (!result.ok) {
    return mapMappingOverrideFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleGenerateMappingReviewSuggestionsRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Mapping review",
    schema: MappingReviewHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await generateMappingReviewSuggestionsV1(
    {
      ...parsedBody,
      workspaceId,
    },
    createMappingReviewDepsV1(env),
  );
  if (!result.ok) {
    return mapMappingReviewFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleRunMappingAiEnrichmentRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
  executionContext?: WorkerExecutionContextV1,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Mapping AI enrichment",
    schema: MappingAiEnrichmentHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }

  const parsedBody = bodyParseResult.data;
  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const activeMappingResult = await getActiveMappingDecisionsV1(
    {
      tenantId: parsedBody.tenantId,
      workspaceId,
    },
    createMappingOverrideDepsV1(env),
  );
  if (!activeMappingResult.ok) {
    return mapMappingOverrideFailureToResponseV1(activeMappingResult);
  }

  if (
    activeMappingResult.active.artifactId !==
      parsedBody.expectedActiveMapping.artifactId ||
    activeMappingResult.active.version !==
      parsedBody.expectedActiveMapping.version
  ) {
    return Response.json(
      parseRunMappingAiEnrichmentResultV1({
        ok: true,
        status: "stale_skipped",
        activeBefore: activeMappingResult.active,
        activeAfter: activeMappingResult.active,
        message:
          "Active mapping changed before AI enrichment started, so no upgrade was applied.",
      }),
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const workflowInput = {
    ...parsedBody,
    workspaceId,
  };
  const actor = {
    actorUserId: sessionGuardResult.principal.userId,
  };

  if (!executionContext) {
    const result = await runMappingAiEnrichmentV1(
      workflowInput,
      actor,
      createMappingAiEnrichmentDepsV1(env, {
        executionBudgetMs: MAPPING_AI_ENRICHMENT_BACKGROUND_EXECUTION_BUDGET_MS,
      }),
    );
    if (!result.ok) {
      return mapMappingAiEnrichmentFailureToResponseV1(result);
    }

    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  executionContext.waitUntil(
    runMappingAiEnrichmentV1(
      workflowInput,
      actor,
      createMappingAiEnrichmentDepsV1(env, {
        executionBudgetMs: MAPPING_AI_ENRICHMENT_BACKGROUND_EXECUTION_BUDGET_MS,
      }),
    ).then((result) => {
      if (!result.ok) {
        console.warn("mapping.ai_enrichment.background_failed", {
          code: result.error.code,
          tenantId: parsedBody.tenantId,
          workspaceId,
        });
      }
    }),
  );

  return Response.json(
    parseRunMappingAiEnrichmentResultV1({
      ok: true,
      status: "accepted",
      activeBefore: activeMappingResult.active,
      activeAfter: activeMappingResult.active,
      message:
        "AI account mapping started in the background. This page will refresh automatically when the latest mapping is ready.",
    }),
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Handles V1 workspace HTTP routes for create, fetch, and status transitions.
 */
export async function handleWorkspaceRoutesV1(
  request: Request,
  env: Env,
  executionContext?: WorkerExecutionContextV1,
): Promise<Response> {
  let appBaseUrl: URL;
  try {
    appBaseUrl = new URL(env.APP_BASE_URL);
  } catch {
    return createJsonErrorResponseV1({
      status: 500,
      code: "APP_BASE_URL_INVALID",
      message: "APP_BASE_URL must be a valid absolute URL.",
    });
  }

  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;

  if (pathname === `${WORKSPACES_ROUTE_BASE_PATH_V1}/annual-report-runtime`) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleAnnualReportRuntimeRouteV1(env);
  }

  if (pathname === WORKSPACES_ROUTE_BASE_PATH_V1) {
    if (request.method === "GET") {
      return handleListWorkspacesRouteV1(request, env);
    }

    if (request.method === "POST") {
      return handleCreateWorkspaceRouteV1(request, env, appBaseUrl);
    }

    return createMethodNotAllowedResponseV1(["GET", "POST"]);
  }

  if (!pathname.startsWith(`${WORKSPACES_ROUTE_BASE_PATH_V1}/`)) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "NOT_FOUND",
      message: "Workspace route not found.",
    });
  }

  const routeSegments = pathname
    .slice(WORKSPACES_ROUTE_BASE_PATH_V1.length + 1)
    .split("/");

  if (routeSegments.length === 1 && routeSegments[0]) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetWorkspaceRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "tb-pipeline-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleTrialBalancePipelineRunRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "tb-pipeline-runs" &&
    routeSegments[2] === "clear"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleClearTrialBalancePipelineDataRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-upload-sessions"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleCreateAnnualReportUploadSessionRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 4 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-upload-sessions" &&
    routeSegments[2] &&
    routeSegments[3] === "file"
  ) {
    if (request.method !== "PUT") {
      return createMethodNotAllowedResponseV1("PUT");
    }

    return handleUploadAnnualReportSourceRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
      routeSegments[2],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-processing-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleAnnualReportProcessingRunRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-processing-runs" &&
    routeSegments[2] === "latest"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetLatestAnnualReportProcessingRunRouteV1(
      request,
      env,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleAnnualReportRunRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-extractions" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetActiveAnnualReportRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-tax-analysis" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetActiveAnnualReportTaxAnalysisRouteV1(
      request,
      env,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-tax-analysis" &&
    routeSegments[2] === "run"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleRunAnnualReportTaxAnalysisRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-extractions" &&
    routeSegments[2] === "overrides"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleAnnualReportOverridesRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-extractions" &&
    routeSegments[2] === "clear"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleClearAnnualReportRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "tax-adjustment-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleRunTaxAdjustmentsRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "tax-adjustments" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }
    return handleGetActiveTaxAdjustmentsRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "tax-adjustments" &&
    routeSegments[2] === "overrides"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleTaxAdjustmentOverridesRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "tax-summary-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleRunTaxSummaryRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "tax-summary" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }
    return handleGetActiveTaxSummaryRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "ink2-form-runs"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleRunInk2FormRouteV1(request, env, appBaseUrl, routeSegments[0]);
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "ink2-form" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }
    return handleGetActiveInk2FormRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "ink2-form" &&
    routeSegments[2] === "overrides"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleInk2FormOverridesRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "exports" &&
    routeSegments[2] === "pdf"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handlePdfExportRouteV1(request, env, appBaseUrl, routeSegments[0]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "exports"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }
    return handleListExportsRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "comments"
  ) {
    if (request.method === "GET") {
      return handleListCommentsRouteV1(request, env, routeSegments[0]);
    }
    if (request.method === "POST") {
      return handleCreateCommentRouteV1(
        request,
        env,
        appBaseUrl,
        routeSegments[0],
      );
    }

    return createMethodNotAllowedResponseV1(["GET", "POST"]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "tasks"
  ) {
    if (request.method === "GET") {
      return handleListTasksRouteV1(request, env, routeSegments[0]);
    }
    if (request.method === "POST") {
      return handleCreateTaskRouteV1(
        request,
        env,
        appBaseUrl,
        routeSegments[0],
      );
    }

    return createMethodNotAllowedResponseV1(["GET", "POST"]);
  }

  if (
    routeSegments.length === 4 &&
    routeSegments[0] &&
    routeSegments[1] === "tasks" &&
    routeSegments[2] &&
    routeSegments[3] === "complete"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }
    return handleCompleteTaskRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
      routeSegments[2],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "annual-report-extractions" &&
    routeSegments[2] === "confirm"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleConfirmAnnualReportRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "mapping-decisions" &&
    routeSegments[2] === "active"
  ) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetActiveMappingRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 3 &&
    routeSegments[0] &&
    routeSegments[1] === "mapping-decisions" &&
    routeSegments[2] === "ai-enrichment"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleRunMappingAiEnrichmentRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
      executionContext,
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "mapping-overrides"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleApplyMappingOverridesRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "mapping-review-suggestions"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleGenerateMappingReviewSuggestionsRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "transitions"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleWorkspaceTransitionRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Workspace route not found.",
  });
}
