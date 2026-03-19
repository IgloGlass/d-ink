import type { z } from "zod";

import type {
  AnnualReportProcessingRunRecordV1,
  AnnualReportProcessingRunRepositoryV1,
} from "../../db/repositories/annual-report-processing-run.repository.v1";
import type {
  AnnualReportUploadSessionRecordV1,
  AnnualReportUploadSessionRepositoryV1,
} from "../../db/repositories/annual-report-upload-session.repository.v1";
import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import type {
  AnnualReportExtractionPayloadV1,
  AnnualReportRuntimeMetadataV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type AnnualReportProcessingQueueMessageV1,
  AnnualReportProcessingQueueMessageV1Schema,
  type AnnualReportProcessingRunDegradationV1,
  type AnnualReportProcessingRunStatusV1,
  CreateAnnualReportProcessingRunRequestV1Schema,
  type CreateAnnualReportProcessingRunResultV1,
  type GetLatestAnnualReportProcessingRunResultV1,
  parseAnnualReportProcessingRunV1,
  parseCreateAnnualReportProcessingRunResultV1,
  parseGetLatestAnnualReportProcessingRunResultV1,
} from "../../shared/contracts/annual-report-processing-run.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../shared/contracts/annual-report-tax-analysis.v1";
import {
  type AnnualReportUploadSessionV1,
  CreateAnnualReportUploadSessionRequestV1Schema,
  type CreateAnnualReportUploadSessionResultV1,
  MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1,
  type UploadAnnualReportSourceResultV1,
  parseAnnualReportUploadSessionV1,
  parseCreateAnnualReportUploadSessionResultV1,
  parseUploadAnnualReportSourceResultV1,
} from "../../shared/contracts/annual-report-upload-session.v1";
import {
  RunAnnualReportTaxAnalysisRequestV1Schema,
  type RunAnnualReportTaxAnalysisResultV1,
  parseRunAnnualReportTaxAnalysisResultV1,
} from "../../shared/contracts/annual-report-tax-analysis.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import type { AnnualReportSourceStoreV1 } from "../../shared/types/env";
import type { ParseAnnualReportExtractionResultV1 } from "../parsing/annual-report-extractor.v1";
import { validateAnnualReportFileTypeCoherenceV1 } from "../security/file-type-coherence.v1";
import { MAX_ANNUAL_REPORT_FILE_BYTES_V1 } from "../security/payload-limits.v1";
import {
  buildAnnualReportSourceLineageV1,
  finalizeExtractionConfirmationV1,
  hasAnnualReportFullExtractionV1,
  listMissingRequiredExtractionFieldsV1,
  persistAnnualReportExtractionArtifactV1,
  runAnnualReportTaxAnalysisV1,
} from "./annual-report-extraction.v1";

type AnnualReportCreateRunFailureCodeV1 =
  | "INPUT_INVALID"
  | "WORKSPACE_NOT_FOUND"
  | "EXTRACTION_NOT_FOUND"
  | "PROCESSING_RUN_NOT_FOUND"
  | "PROCESSING_RUN_UNAVAILABLE"
  | "STATE_CONFLICT"
  | "PERSISTENCE_ERROR";

export interface AnnualReportProcessingDepsV1 {
  artifactRepository: WorkspaceArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  processingRunRepository: AnnualReportProcessingRunRepositoryV1;
  uploadSessionRepository: AnnualReportUploadSessionRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
  sourceStore?: AnnualReportSourceStoreV1;
  processingConfigError?: string;
  allowInlineFallbackInDev?: boolean;
  scheduleBackgroundTask?: (promise: Promise<unknown>) => void;
  enqueueProcessingRun?: (
    message: AnnualReportProcessingQueueMessageV1,
  ) => Promise<
    | { ok: true }
    | {
        ok: false;
        code: "PROCESSING_RUN_UNAVAILABLE" | "PERSISTENCE_ERROR";
        message: string;
      }
  >;
  extractAnnualReport?: (input: {
    fileBytes: Uint8Array;
    fileName: string;
    fileType?: "pdf" | "docx";
    policyVersion: string;
    onProgress?: (
      status: AnnualReportProcessingRunStatusV1,
      technicalDetails?: string[],
    ) => Promise<void>;
  }) => Promise<ParseAnnualReportExtractionResultV1>;
  analyzeAnnualReportTax?: (input: {
    extraction: AnnualReportExtractionPayloadV1;
    extractionArtifactId: string;
    policyVersion: string;
    sourceDocument?: {
      fileBytes: Uint8Array;
      fileName: string;
      fileType: "pdf" | "docx";
    };
  }) => Promise<
    | { ok: true; taxAnalysis: AnnualReportTaxAnalysisPayloadV1 }
    | {
        ok: false;
        error: {
          code:
            | "MODEL_EXECUTION_FAILED"
            | "MODEL_RESPONSE_INVALID"
            | "CONFIG_INVALID";
          message: string;
          context: Record<string, unknown>;
        };
      }
  >;
  getRuntimeMetadata?: () => AnnualReportRuntimeMetadataV1;
  generateId: () => string;
  nowIsoUtc: () => string;
}

function canUseQueuedInfrastructureV1(
  deps: AnnualReportProcessingDepsV1,
): boolean {
  return (
    Boolean(deps.sourceStore) &&
    Boolean(deps.enqueueProcessingRun) &&
    !deps.processingConfigError
  );
}

function buildProcessingUnavailableFailureV1(input: {
  message: string;
}): ReturnType<typeof parseCreateAnnualReportProcessingRunResultV1> {
  return parseCreateAnnualReportProcessingRunResultV1(
    buildFailureV1({
      code: "PROCESSING_RUN_UNAVAILABLE",
      message: input.message,
      userMessage:
        "Annual-report analysis is temporarily unavailable. Check the app configuration and try again.",
      context: {},
    }),
  );
}

function buildProcessingUnavailableUploadFailureV1(input: {
  message: string;
}): ReturnType<typeof parseUploadAnnualReportSourceResultV1> {
  return parseUploadAnnualReportSourceResultV1(
    buildFailureV1({
      code: "PROCESSING_RUN_UNAVAILABLE",
      message: input.message,
      userMessage:
        "Annual-report analysis is temporarily unavailable. Check the app configuration and try again.",
      context: {},
    }),
  );
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
  code: AnnualReportCreateRunFailureCodeV1;
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

async function appendAuditEventBestEffortV1(input: {
  deps: AnnualReportProcessingDepsV1;
  event: ReturnType<typeof parseAuditEventV2>;
}): Promise<void> {
  const appendResult = await input.deps.auditRepository.append(input.event);
  if (!appendResult.ok) {
    // Processing run remains source of truth if audit persistence fails.
  }
}

function resolveRunStatusMessageV1(input: {
  degradation?: AnnualReportProcessingRunDegradationV1;
  error?: AnnualReportProcessingRunRecordV1["error"];
  status: AnnualReportProcessingRunStatusV1;
}): string {
  switch (input.status) {
    case "queued":
      return "Annual report upload received. Analysis is queued.";
    case "uploading_source":
      return "Uploading source";
    case "locating_sections":
      return "Scanning document structure";
    case "extracting_core_facts":
      return "Extracting core facts";
    case "extracting_statements":
      return "Extracting financial statements";
    case "extracting_tax_notes":
      return "Extracting tax notes";
    case "running_tax_analysis":
      return "Running forensic review";
    case "completed":
      return "Completed";
    case "partial":
      if (input.degradation?.mode === "partial_with_analysis") {
        return "Partial extraction with limited tax analysis";
      }
      return "Partial extraction without tax analysis";
    case "failed":
      return input.error?.userMessage ?? "Analysis failed";
    case "cancelled":
      return "Analysis cancelled";
    case "superseded":
      return "Replaced by a newer annual report upload";
    default: {
      const exhaustiveCheck: never = input.status;
      return exhaustiveCheck;
    }
  }
}

function mergeTechnicalDetailsV1(input: {
  existing: string[];
  incoming?: string[];
}): string[] {
  const merged = [...input.existing];
  for (const detail of input.incoming ?? []) {
    if (typeof detail !== "string" || detail.trim().length === 0) {
      continue;
    }
    const normalized = detail.trim();
    if (merged[merged.length - 1] === normalized) {
      continue;
    }
    merged.push(normalized);
  }

  return merged.slice(-60);
}

const PROCESSING_OPERATION_TECHNICAL_DETAIL_PREFIX_V1 = "processing.operation";
const TAX_ANALYSIS_OPERATION_TECHNICAL_DETAIL_VALUE_V1 = "tax_analysis";
const TAX_ANALYSIS_EXPECTED_EXTRACTION_ARTIFACT_ID_DETAIL_PREFIX_V1 =
  "tax_analysis.expected_extraction_artifact_id";
const TAX_ANALYSIS_EXPECTED_EXTRACTION_VERSION_DETAIL_PREFIX_V1 =
  "tax_analysis.expected_extraction_version";

function readTechnicalDetailValueV1(input: {
  prefix: string;
  technicalDetails: string[];
}): string | undefined {
  const detail = input.technicalDetails.find((entry) =>
    entry.startsWith(`${input.prefix}=`),
  );
  if (!detail) {
    return undefined;
  }

  return detail.slice(input.prefix.length + 1).trim() || undefined;
}

function buildTaxAnalysisRunTechnicalDetailsV1(input: {
  expectedExtractionArtifactId: string;
  expectedExtractionVersion: number;
}): string[] {
  return [
    `${PROCESSING_OPERATION_TECHNICAL_DETAIL_PREFIX_V1}=${TAX_ANALYSIS_OPERATION_TECHNICAL_DETAIL_VALUE_V1}`,
    `${TAX_ANALYSIS_EXPECTED_EXTRACTION_ARTIFACT_ID_DETAIL_PREFIX_V1}=${input.expectedExtractionArtifactId}`,
    `${TAX_ANALYSIS_EXPECTED_EXTRACTION_VERSION_DETAIL_PREFIX_V1}=${input.expectedExtractionVersion}`,
  ];
}

function isTaxAnalysisProcessingRunV1(
  run: AnnualReportProcessingRunRecordV1,
): boolean {
  return (
    run.status === "running_tax_analysis" &&
    readTechnicalDetailValueV1({
      prefix: PROCESSING_OPERATION_TECHNICAL_DETAIL_PREFIX_V1,
      technicalDetails: run.technicalDetails,
    }) === TAX_ANALYSIS_OPERATION_TECHNICAL_DETAIL_VALUE_V1
  );
}

function projectRunV1(run: AnnualReportProcessingRunRecordV1) {
  return parseAnnualReportProcessingRunV1({
    schemaVersion: "annual_report_processing_run_v1",
    runId: run.id,
    tenantId: run.tenantId,
    workspaceId: run.workspaceId,
    sourceFileName: run.sourceFileName,
    sourceFileType: run.sourceFileType,
    status: run.status,
    statusMessage: resolveRunStatusMessageV1({
      status: run.status,
      error: run.error,
      degradation: run.degradation,
    }),
    technicalDetails: run.technicalDetails,
    error: run.error,
    degradation: run.degradation,
    previewExtraction: run.previewExtraction,
    result:
      run.resultExtractionArtifactId || run.resultTaxAnalysisArtifactId
        ? {
            extractionArtifactId: run.resultExtractionArtifactId,
            taxAnalysisArtifactId: run.resultTaxAnalysisArtifactId,
          }
        : undefined,
    runtime: run.runtime,
    hasPreviousActiveResult: run.hasPreviousActiveResult,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdByUserId: run.createdByUserId,
  });
}

function projectUploadSessionV1(input: {
  session: AnnualReportUploadSessionRecordV1;
  workspaceId: string;
}): AnnualReportUploadSessionV1 {
  return parseAnnualReportUploadSessionV1({
    schemaVersion: "annual_report_upload_session_v1",
    uploadSessionId: input.session.id,
    tenantId: input.session.tenantId,
    workspaceId: input.session.workspaceId,
    fileName: input.session.fileName,
    fileType: input.session.fileType,
    fileSizeBytes: input.session.fileSizeBytes,
    policyVersion: input.session.policyVersion,
    uploadUrl: `/v1/workspaces/${input.workspaceId}/annual-report-upload-sessions/${input.session.id}/file`,
    maxSizeBytes: MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1,
    expiresAt: input.session.expiresAt,
    status: input.session.status,
    createdAt: input.session.createdAt,
    updatedAt: input.session.updatedAt,
    createdByUserId: input.session.createdByUserId,
  });
}

function createSourceStorageKeyV1(input: {
  fileName: string;
  runId: string;
  tenantId: string;
  workspaceId: string;
}): string {
  const safeFileName = input.fileName.replace(/[^A-Za-z0-9._-]+/g, "-");
  return [
    "annual-report-source",
    input.tenantId,
    input.workspaceId,
    input.runId,
    safeFileName,
  ].join("/");
}

function inferAnnualReportFileTypeFromNameV1(
  fileName: string,
): "pdf" | "docx" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }
  if (lower.endsWith(".docx")) {
    return "docx";
  }
  return null;
}

function resolveMimeTypeV1(fileType: "pdf" | "docx"): string {
  return fileType === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

async function saveRunOrThrowV1(
  deps: AnnualReportProcessingDepsV1,
  run: AnnualReportProcessingRunRecordV1,
): Promise<AnnualReportProcessingRunRecordV1> {
  const persisted = await deps.processingRunRepository.save(run);
  if (!persisted.ok) {
    throw new Error(persisted.message);
  }
  return persisted.value;
}

async function markRunStatusV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
  status: AnnualReportProcessingRunStatusV1;
  technicalDetails?: string[];
  degradation?: AnnualReportProcessingRunRecordV1["degradation"];
  error?: AnnualReportProcessingRunRecordV1["error"];
  previewExtraction?: AnnualReportProcessingRunRecordV1["previewExtraction"];
  resultExtractionArtifactId?: string;
  resultTaxAnalysisArtifactId?: string;
  finishedAt?: string;
  startedAt?: string;
}): Promise<AnnualReportProcessingRunRecordV1> {
  const next: AnnualReportProcessingRunRecordV1 = {
    ...input.run,
    status: input.status,
    technicalDetails:
      input.technicalDetails === undefined
        ? input.run.technicalDetails
        : mergeTechnicalDetailsV1({
            existing: input.run.technicalDetails,
            incoming: input.technicalDetails,
          }),
    degradation: input.degradation ?? input.run.degradation,
    error: input.error,
    previewExtraction:
      input.previewExtraction === undefined
        ? input.run.previewExtraction
        : input.previewExtraction,
    resultExtractionArtifactId:
      input.resultExtractionArtifactId ?? input.run.resultExtractionArtifactId,
    resultTaxAnalysisArtifactId:
      input.resultTaxAnalysisArtifactId ??
      input.run.resultTaxAnalysisArtifactId,
    updatedAt: input.deps.nowIsoUtc(),
    startedAt: input.startedAt ?? input.run.startedAt,
    finishedAt:
      input.finishedAt === undefined ? input.run.finishedAt : input.finishedAt,
  };
  return saveRunOrThrowV1(input.deps, next);
}

async function supersedeOpenRunsV1(input: {
  deps: AnnualReportProcessingDepsV1;
  tenantId: string;
  workspaceId: string;
  actorUserId?: string;
}): Promise<void> {
  const openRuns = await input.deps.processingRunRepository.listOpenByWorkspace(
    {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    },
  );
  const finishedAt = input.deps.nowIsoUtc();

  for (const run of openRuns) {
    await saveRunOrThrowV1(input.deps, {
      ...run,
      status: "superseded",
      technicalDetails: [
        ...run.technicalDetails,
        "Superseded by a newer annual report upload.",
      ],
      updatedAt: finishedAt,
      finishedAt,
    });

    await appendAuditEventBestEffortV1({
      deps: input.deps,
      event: parseAuditEventV2({
        id: input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        actorType: input.actorUserId ? "user" : "system",
        actorUserId: input.actorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_SUPERSEDED,
        targetType: "annual_report_processing_run",
        targetId: run.id,
        after: {
          runId: run.id,
        },
        timestamp: finishedAt,
        context: {},
      }),
    });
  }
}

async function loadSourceBytesV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
}): Promise<Uint8Array> {
  const object = await input.deps.sourceStore?.get(input.run.sourceStorageKey);
  if (!object) {
    throw new Error("Stored annual report source file could not be found.");
  }

  const buffer = await object.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) {
    throw new Error("Stored annual report source file was empty.");
  }

  return bytes;
}

async function createQueuedProcessingRunForStoredSourceV1(input: {
  createdByUserId?: string;
  deps: AnnualReportProcessingDepsV1;
  fileName: string;
  fileType: "pdf" | "docx";
  policyVersion: string;
  sourceSizeBytes: number;
  sourceStorageKey: string;
  tenantId: string;
  workspaceId: string;
}): Promise<CreateAnnualReportProcessingRunResultV1> {
  if (!canUseQueuedInfrastructureV1(input.deps)) {
    return buildProcessingUnavailableFailureV1({
      message:
        input.deps.processingConfigError ??
        "Annual-report background processing is not configured.",
    });
  }

  const workspace = await input.deps.workspaceRepository.getById({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!workspace) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        userMessage: "Workspace could not be found.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      }),
    );
  }

  await supersedeOpenRunsV1({
    deps: input.deps,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.createdByUserId,
  });

  const activeExtraction =
    await input.deps.artifactRepository.getActiveAnnualReportExtraction({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
  const now = input.deps.nowIsoUtc();
  const runId = input.deps.generateId();
  const actorType = input.createdByUserId ? "user" : "system";
  const createdRun: AnnualReportProcessingRunRecordV1 = {
    id: runId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    sourceFileName: input.fileName,
    sourceFileType: input.fileType,
    sourceStorageKey: input.sourceStorageKey,
    sourceSizeBytes: input.sourceSizeBytes,
    policyVersion: input.policyVersion,
    status: "queued",
    hasPreviousActiveResult: Boolean(activeExtraction),
    previousActiveExtractionArtifactId: activeExtraction?.id,
    technicalDetails: [],
    runtime: input.deps.getRuntimeMetadata?.(),
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  };

  const persistedRun =
    await input.deps.processingRunRepository.create(createdRun);
  if (!persistedRun.ok) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code:
          persistedRun.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persistedRun.message,
        userMessage:
          persistedRun.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The annual report upload could not be saved.",
        context: {},
      }),
    );
  }

  const enqueueProcessingRun = input.deps.enqueueProcessingRun;
  if (!enqueueProcessingRun) {
    return buildProcessingUnavailableFailureV1({
      message:
        input.deps.processingConfigError ??
        "Annual-report background processing is not configured.",
    });
  }

  const enqueueResult = await enqueueProcessingRun({
    runId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!enqueueResult.ok) {
    const failedRun = await markRunStatusV1({
      deps: input.deps,
      run: persistedRun.value,
      status: "failed",
      error: {
        code: enqueueResult.code,
        userMessage:
          "The annual report was uploaded, but the analysis job could not be started.",
        technicalMessage: enqueueResult.message,
      },
      finishedAt: input.deps.nowIsoUtc(),
    });
    return parseCreateAnnualReportProcessingRunResultV1({
      ok: true,
      run: projectRunV1(failedRun),
    });
  }

  await appendAuditEventBestEffortV1({
    deps: input.deps,
    event: parseAuditEventV2({
      id: input.deps.generateId(),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorType,
      actorUserId: input.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_QUEUED,
      targetType: "annual_report_processing_run",
      targetId: runId,
      after: {
        runId,
        hasPreviousActiveResult: persistedRun.value.hasPreviousActiveResult,
      },
      timestamp: input.deps.nowIsoUtc(),
      context: {},
    }),
  });

  return parseCreateAnnualReportProcessingRunResultV1({
    ok: true,
    run: projectRunV1(persistedRun.value),
  });
}

async function refreshRunIfCurrentV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
}): Promise<AnnualReportProcessingRunRecordV1 | null> {
  const current = await input.deps.processingRunRepository.getById({
    runId: input.run.id,
    tenantId: input.run.tenantId,
    workspaceId: input.run.workspaceId,
  });
  if (!current) {
    return null;
  }

  if (current.status === "cancelled" || current.status === "superseded") {
    return null;
  }

  const latest = await input.deps.processingRunRepository.getLatestByWorkspace({
    tenantId: current.tenantId,
    workspaceId: current.workspaceId,
  });

  if (!latest || latest.id !== current.id) {
    const finishedAt = input.deps.nowIsoUtc();
    await saveRunOrThrowV1(input.deps, {
      ...current,
      status: "superseded",
      technicalDetails: [
        ...current.technicalDetails,
        "Superseded before activation.",
      ],
      updatedAt: finishedAt,
      finishedAt,
    });
    return null;
  }

  return current;
}

function createArtifactPersistenceDepsV1(deps: AnnualReportProcessingDepsV1) {
  return {
    artifactRepository: deps.artifactRepository,
    auditRepository: deps.auditRepository,
    workspaceRepository: deps.workspaceRepository,
    getRuntimeMetadata: deps.getRuntimeMetadata,
    extractAnnualReport: deps.extractAnnualReport,
    generateId: deps.generateId,
    nowIsoUtc: deps.nowIsoUtc,
  };
}

async function markRunFailedForRuntimeIssueV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
  technicalDetail: string;
  technicalMessage: string;
}): Promise<AnnualReportProcessingRunRecordV1> {
  return markRunStatusV1({
    deps: input.deps,
    run: input.run,
    status: "failed",
    technicalDetails: [...input.run.technicalDetails, input.technicalDetail],
    error: {
      code: "PROCESSING_RUN_UNAVAILABLE",
      userMessage:
        "The annual report analysis could not be completed. Upload the report again or contact your administrator.",
      technicalMessage: input.technicalMessage,
    },
    finishedAt: input.deps.nowIsoUtc(),
  });
}

function buildExtractionFailureTechnicalDetailsV1(input: {
  error: Extract<ParseAnnualReportExtractionResultV1, { ok: false }>["error"];
}): string[] {
  const details = [`processing.extraction.failed code=${input.error.code}`];
  const stage = input.error.context.stage;
  if (typeof stage === "string" && stage.trim().length > 0) {
    details.push(`processing.extraction.failed stage=${stage}`);
  }
  return details;
}

async function executeProcessingRunFromSourceBytesV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
  sourceBytes: Uint8Array;
}): Promise<void> {
  const { deps } = input;
  let run = input.run;
  const extractAnnualReport = deps.extractAnnualReport;
  if (!extractAnnualReport) {
    await markRunFailedForRuntimeIssueV1({
      deps,
      run,
      technicalDetail:
        "processing.runtime.unavailable extractor_dependency_missing",
      technicalMessage: "Annual-report extractor is not configured.",
    });
    return;
  }

  try {
    run = await markRunStatusV1({
      deps,
      run,
      status: "locating_sections",
      startedAt: deps.nowIsoUtc(),
    });
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        actorType: run.createdByUserId ? "user" : "system",
        actorUserId: run.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_STARTED,
        targetType: "annual_report_processing_run",
        targetId: run.id,
        after: {
          runId: run.id,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    const onProgress = async (
      status: AnnualReportProcessingRunStatusV1,
      technicalDetails?: string[],
    ) => {
      run = await markRunStatusV1({
        deps,
        run,
        status,
        technicalDetails,
      });
    };

    const extractionResult = await extractAnnualReport({
      fileBytes: input.sourceBytes,
      fileName: run.sourceFileName,
      fileType: run.sourceFileType,
      policyVersion: run.policyVersion,
      onProgress,
    });
    if (!extractionResult.ok) {
      await markRunStatusV1({
        deps,
        run,
        status: "failed",
        error: {
          code: extractionResult.error.code,
          userMessage: extractionResult.error.user_message,
          technicalMessage: extractionResult.error.message,
        },
        technicalDetails: buildExtractionFailureTechnicalDetailsV1({
          error: extractionResult.error,
        }),
        finishedAt: deps.nowIsoUtc(),
      });
      return;
    }

    const finalizedExtraction = finalizeExtractionConfirmationV1({
      extraction: extractionResult.extraction,
      actorUserId: run.createdByUserId,
      confirmedAt: deps.nowIsoUtc(),
    });
    const pendingExtractionArtifactId = deps.generateId();
    const missingRequiredFields =
      listMissingRequiredExtractionFieldsV1(finalizedExtraction);
    const extractionIsPartial =
      missingRequiredFields.length > 0 ||
      !hasAnnualReportFullExtractionV1(finalizedExtraction);
    const extractionWarnings = [
      ...(finalizedExtraction.documentWarnings ?? []),
    ];
    if (missingRequiredFields.length > 0) {
      extractionWarnings.push(
        `degraded.extraction.partial Missing required core facts: ${missingRequiredFields.join(", ")}.`,
      );
    }
    if (!hasAnnualReportFullExtractionV1(finalizedExtraction)) {
      extractionWarnings.push(
        "degraded.extraction.partial Income statement or balance sheet extraction is incomplete; manual review is required before relying on downstream tax analysis.",
      );
    }

    const currentRun = await refreshRunIfCurrentV1({
      deps,
      run,
    });
    if (!currentRun) {
      return;
    }

    // Diagnostic: all AI stages done, about to compute source lineage then
    // persist the extraction artifact.  If the run ends up stuck after this
    // entry the crash is in the persistence path, not in an AI stage.
    let runBeforePersist = await markRunStatusV1({
      deps,
      run: currentRun,
      status: currentRun.status,
      technicalDetails: ["persistence.stage=computing_source_lineage"],
    });

    const extractionWithSourceLineage = {
      ...finalizedExtraction,
      sourceLineage: await buildAnnualReportSourceLineageV1({
        fileBytes: input.sourceBytes,
        processingRunId: currentRun.id,
        sourceStorageKey: currentRun.sourceStorageKey,
      }),
    };

    // Diagnostic: lineage computed, now writing artifact to D1.
    runBeforePersist = await markRunStatusV1({
      deps,
      run: runBeforePersist,
      status: currentRun.status,
      technicalDetails: ["persistence.stage=writing_artifact"],
    });

    const persistedExtraction = await persistAnnualReportExtractionArtifactV1({
      actorType: currentRun.createdByUserId ? "user" : "system",
      actorUserId: currentRun.createdByUserId,
      artifactId: pendingExtractionArtifactId,
      clearDependentsReason: "annual_report_replaced",
      deps: createArtifactPersistenceDepsV1(deps),
      extraction: extractionWithSourceLineage,
      tenantId: currentRun.tenantId,
      workspaceId: currentRun.workspaceId,
    });
    if (!persistedExtraction.ok) {
      await markRunStatusV1({
        deps,
        run: runBeforePersist,
        status: "failed",
        error: {
          code: persistedExtraction.code,
          userMessage: persistedExtraction.userMessage,
          technicalMessage: persistedExtraction.message,
        },
        previewExtraction: finalizedExtraction,
        technicalDetails: finalizedExtraction.documentWarnings ?? [],
        finishedAt: deps.nowIsoUtc(),
      });
      return;
    }

    run = await markRunStatusV1({
      deps,
      run: runBeforePersist,
      status: extractionIsPartial ? "partial" : "completed",
      previewExtraction: finalizedExtraction,
      technicalDetails: [
        ...extractionWarnings,
        "tax_analysis.execution_mode=manual_trigger",
        extractionIsPartial
          ? "tax_analysis.manual_run_blocked=extraction_incomplete"
          : "tax_analysis.manual_run_available=1",
      ],
      degradation: extractionIsPartial
        ? {
            mode: "partial_without_analysis",
            warnings: extractionWarnings,
            fallbacks: [],
          }
        : {
            mode: "none",
            warnings: [],
            fallbacks: [],
          },
      resultExtractionArtifactId: persistedExtraction.artifact.id,
      finishedAt: deps.nowIsoUtc(),
    });

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: currentRun.tenantId,
        workspaceId: currentRun.workspaceId,
        actorType: currentRun.createdByUserId ? "user" : "system",
        actorUserId: currentRun.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_COMPLETED,
        targetType: "annual_report_processing_run",
        targetId: currentRun.id,
        after: {
          runId: currentRun.id,
          extractionArtifactId: persistedExtraction.artifact.id,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });
  } catch (error) {
    const failedRun =
      (await deps.processingRunRepository.getById({
        runId: run.id,
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
      })) ?? run;

    await markRunStatusV1({
      deps,
      run: failedRun,
      status: "failed",
      error: {
        code: "PROCESSING_RUN_FAILED",
        userMessage:
          "The annual report could not be analyzed. Upload the annual report again.",
        technicalMessage:
          error instanceof Error ? error.message : "Unknown processing error.",
      },
      technicalDetails: failedRun.technicalDetails,
      finishedAt: deps.nowIsoUtc(),
    });
  }
}

async function createInlineProcessingRunV1(input: {
  createdByUserId?: string;
  deps: AnnualReportProcessingDepsV1;
  fileBytes: Uint8Array;
  fileName: string;
  fileType: "pdf" | "docx";
  policyVersion: string;
  tenantId: string;
  workspaceId: string;
}): Promise<CreateAnnualReportProcessingRunResultV1> {
  const workspace = await input.deps.workspaceRepository.getById({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!workspace) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        userMessage: "Workspace could not be found.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      }),
    );
  }

  await supersedeOpenRunsV1({
    deps: input.deps,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.createdByUserId,
  });

  const activeExtraction =
    await input.deps.artifactRepository.getActiveAnnualReportExtraction({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
  const now = input.deps.nowIsoUtc();
  const runId = input.deps.generateId();
  const createdRun: AnnualReportProcessingRunRecordV1 = {
    id: runId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    sourceFileName: input.fileName,
    sourceFileType: input.fileType,
    sourceStorageKey: [
      "annual-report-inline",
      input.tenantId,
      input.workspaceId,
      runId,
    ].join("/"),
    sourceSizeBytes: input.fileBytes.byteLength,
    policyVersion: input.policyVersion,
    status: "queued",
    hasPreviousActiveResult: Boolean(activeExtraction),
    previousActiveExtractionArtifactId: activeExtraction?.id,
    technicalDetails: [
      "Local inline fallback mode active because queue/storage bindings are unavailable.",
    ],
    runtime: input.deps.getRuntimeMetadata?.(),
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  };

  const persistedRun =
    await input.deps.processingRunRepository.create(createdRun);
  if (!persistedRun.ok) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code:
          persistedRun.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persistedRun.message,
        userMessage: "The annual report upload could not be saved.",
        context: {},
      }),
    );
  }

  const executionPromise = executeProcessingRunFromSourceBytesV1({
    deps: input.deps,
    run: persistedRun.value,
    sourceBytes: input.fileBytes,
  });

  if (input.deps.scheduleBackgroundTask) {
    // Fire-and-forget: return the queued run immediately so the client can poll.
    // Wrap with a safety deadline so if Cloudflare kills the Worker mid-run
    // (e.g. plan CPU/wall-clock limits), the run is marked "failed" rather than
    // left permanently stuck. Set to 6 minutes — Gemini processing for a typical
    // annual report takes 1-3 minutes, and the internal budget is 7 minutes.
    const INLINE_FALLBACK_DEADLINE_MS = 360_000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(
          new Error(
            "Inline fallback processing deadline exceeded. Upload the annual report again.",
          ),
        );
      }, INLINE_FALLBACK_DEADLINE_MS);
    });
    const guardedExecution = Promise.race([executionPromise, timeoutPromise]).catch(
      async (error) => {
        // Timeout (or any unhandled error from execution): mark the run failed
        // so the frontend stops polling and can offer a retry.
        try {
          await markRunFailedForRuntimeIssueV1({
            deps: input.deps,
            run: persistedRun.value,
            technicalDetail:
              "processing.runtime.inline_fallback_deadline_exceeded",
            technicalMessage:
              error instanceof Error
                ? error.message
                : "Inline fallback processing timed out.",
          });
        } catch {
          // Best-effort cleanup — swallow to avoid crashing the waitUntil promise.
        }
      },
    );
    input.deps.scheduleBackgroundTask(guardedExecution);
  } else {
    // Fallback for local dev without ctx.waitUntil — await synchronously.
    await executionPromise;
  }

  return parseCreateAnnualReportProcessingRunResultV1({
    ok: true,
    run: projectRunV1(persistedRun.value),
  });
}

export async function createAnnualReportProcessingRunV1(
  input: {
    createdByUserId?: string;
    fileBytes: Uint8Array;
    fileName: string;
    fileType?: "pdf" | "docx";
    policyVersion: string;
    tenantId: string;
    workspaceId: string;
  },
  deps: AnnualReportProcessingDepsV1,
): Promise<CreateAnnualReportProcessingRunResultV1> {
  const parsed = CreateAnnualReportProcessingRunRequestV1Schema.safeParse({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    fileName: input.fileName,
    fileType: input.fileType,
    policyVersion: input.policyVersion,
    createdByUserId: input.createdByUserId,
  });
  if (!parsed.success) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report processing request payload is invalid.",
        userMessage: "The annual report upload is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsed.error),
      }),
    );
  }
  if (input.fileBytes.byteLength === 0) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report bytes are empty.",
        userMessage: "The annual report file is empty. Upload the file again.",
        context: {},
      }),
    );
  }
  if (input.fileBytes.byteLength > MAX_ANNUAL_REPORT_FILE_BYTES_V1) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Decoded annual report file exceeds configured size limit.",
        userMessage:
          "The annual report file is too large for V1 processing limits.",
        context: {
          maxBytes: MAX_ANNUAL_REPORT_FILE_BYTES_V1,
          actualBytes: input.fileBytes.byteLength,
        },
      }),
    );
  }

  const resolvedFileType =
    input.fileType ?? inferAnnualReportFileTypeFromNameV1(input.fileName);
  if (!resolvedFileType) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual report file type is unsupported.",
        userMessage: "Upload a PDF or DOCX annual report file.",
        context: {
          fileName: input.fileName,
        },
      }),
    );
  }

  const fileTypeCoherenceFailure = validateAnnualReportFileTypeCoherenceV1({
    fileName: input.fileName,
    fileType: resolvedFileType,
    fileBytes: input.fileBytes,
  });
  if (fileTypeCoherenceFailure) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message:
          "Annual report file content does not match declared or inferred file type.",
        userMessage:
          "The uploaded annual report file type does not match its content.",
        context: fileTypeCoherenceFailure,
      }),
    );
  }

  const canUseQueuedProcessing = canUseQueuedInfrastructureV1(deps);
  if (!canUseQueuedProcessing && deps.allowInlineFallbackInDev) {
    return createInlineProcessingRunV1({
      createdByUserId: input.createdByUserId,
      deps,
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      fileType: resolvedFileType,
      policyVersion: input.policyVersion,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
  }
  if (!canUseQueuedProcessing || !deps.sourceStore) {
    return buildProcessingUnavailableFailureV1({
      message:
        deps.processingConfigError ??
        "Annual-report background processing is not configured.",
    });
  }

  const sourceStorageKey = createSourceStorageKeyV1({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    runId: deps.generateId(),
    fileName: input.fileName,
  });

  try {
    await deps.sourceStore.put(sourceStorageKey, input.fileBytes, {
      httpMetadata: {
        contentType: resolveMimeTypeV1(resolvedFileType),
      },
    });
  } catch (error) {
    return parseCreateAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "PERSISTENCE_ERROR",
        message:
          error instanceof Error ? error.message : "Source store failed.",
        userMessage:
          "The uploaded annual report could not be stored for analysis.",
        context: {},
      }),
    );
  }

  return createQueuedProcessingRunForStoredSourceV1({
    createdByUserId: input.createdByUserId,
    deps,
    fileName: input.fileName,
    fileType: resolvedFileType,
    policyVersion: input.policyVersion,
    sourceSizeBytes: input.fileBytes.byteLength,
    sourceStorageKey,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
}

export async function createAnnualReportUploadSessionV1(
  input: {
    createdByUserId?: string;
    fileName: string;
    fileSizeBytes: number;
    fileType: "pdf" | "docx";
    policyVersion: string;
    tenantId: string;
    workspaceId: string;
  },
  deps: AnnualReportProcessingDepsV1,
): Promise<CreateAnnualReportUploadSessionResultV1> {
  if (!canUseQueuedInfrastructureV1(deps)) {
    return parseCreateAnnualReportUploadSessionResultV1(
      buildFailureV1({
        code: "PROCESSING_RUN_UNAVAILABLE",
        message:
          deps.processingConfigError ??
          "Annual-report background processing is not configured.",
        userMessage:
          "Annual-report analysis is temporarily unavailable. Check the app configuration and try again.",
        context: {},
      }),
    );
  }

  const parsed = CreateAnnualReportUploadSessionRequestV1Schema.safeParse({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSizeBytes: input.fileSizeBytes,
    policyVersion: input.policyVersion,
    createdByUserId: input.createdByUserId,
  });
  if (!parsed.success) {
    return parseCreateAnnualReportUploadSessionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report upload session payload is invalid.",
        userMessage: "The annual report upload is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsed.error),
      }),
    );
  }
  if (input.fileSizeBytes > MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1) {
    return parseCreateAnnualReportUploadSessionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report file exceeds configured upload limit.",
        userMessage:
          "The annual report file is too large. Upload a file smaller than 25 MB.",
        context: {
          maxBytes: MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1,
          actualBytes: input.fileSizeBytes,
        },
      }),
    );
  }

  const workspace = await deps.workspaceRepository.getById({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!workspace) {
    return parseCreateAnnualReportUploadSessionResultV1(
      buildFailureV1({
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        userMessage: "Workspace could not be found.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      }),
    );
  }

  const now = deps.nowIsoUtc();
  const uploadSessionId = deps.generateId();
  const sourceStorageKey = [
    "annual-report-upload-session",
    input.tenantId,
    input.workspaceId,
    uploadSessionId,
    input.fileName.replace(/[^A-Za-z0-9._-]+/g, "-"),
  ].join("/");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const record: AnnualReportUploadSessionRecordV1 = {
    id: uploadSessionId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSizeBytes: input.fileSizeBytes,
    policyVersion: input.policyVersion,
    sourceStorageKey,
    status: "created",
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  const persisted = await deps.uploadSessionRepository.create(record);
  if (!persisted.ok) {
    return parseCreateAnnualReportUploadSessionResultV1(
      buildFailureV1({
        code:
          persisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persisted.message,
        userMessage: "The annual report upload could not be initialized.",
        context: {},
      }),
    );
  }

  return parseCreateAnnualReportUploadSessionResultV1({
    ok: true,
    session: projectUploadSessionV1({
      session: persisted.value,
      workspaceId: input.workspaceId,
    }),
  });
}

export async function uploadAnnualReportSourceV1(
  input: {
    contentLengthBytes: number;
    createdByUserId?: string;
    tenantId: string;
    uploadBody: Uint8Array | null;
    uploadSessionId: string;
    workspaceId: string;
  },
  deps: AnnualReportProcessingDepsV1,
): Promise<UploadAnnualReportSourceResultV1> {
  if (!deps.sourceStore) {
    return buildProcessingUnavailableUploadFailureV1({
      message:
        deps.processingConfigError ??
        "Annual-report background processing is not configured.",
    });
  }

  const session = await deps.uploadSessionRepository.getById({
    uploadSessionId: input.uploadSessionId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!session) {
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "PROCESSING_RUN_NOT_FOUND",
        message: "Annual-report upload session could not be found.",
        userMessage:
          "The annual report upload session has expired. Upload the file again.",
        context: {},
      }),
    );
  }
  if (session.status !== "created") {
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report upload session is no longer open for upload.",
        userMessage:
          "This upload session can no longer accept a file. Start again.",
        context: {
          status: session.status,
        },
      }),
    );
  }
  if (session.expiresAt <= deps.nowIsoUtc()) {
    const expired = await deps.uploadSessionRepository.save({
      ...session,
      status: "expired",
      updatedAt: deps.nowIsoUtc(),
    });
    void expired;
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report upload session has expired.",
        userMessage: "The upload took too long and expired. Start again.",
        context: {},
      }),
    );
  }
  if (!input.uploadBody) {
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report upload request body is empty.",
        userMessage: "The uploaded annual report could not be read.",
        context: {},
      }),
    );
  }
  if (input.contentLengthBytes !== session.fileSizeBytes) {
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message:
          "Annual-report upload size does not match the created session.",
        userMessage:
          "The uploaded annual report did not match the expected file size.",
        context: {
          expectedBytes: session.fileSizeBytes,
          actualBytes: input.contentLengthBytes,
        },
      }),
    );
  }

  try {
    await deps.sourceStore.put(session.sourceStorageKey, input.uploadBody, {
      httpMetadata: {
        contentType: resolveMimeTypeV1(session.fileType),
      },
    });
  } catch (error) {
    return parseUploadAnnualReportSourceResultV1(
      buildFailureV1({
        code: "PERSISTENCE_ERROR",
        message:
          error instanceof Error ? error.message : "Source store failed.",
        userMessage:
          "The uploaded annual report could not be stored for analysis.",
        context: {},
      }),
    );
  }

  const queuedRun = await createQueuedProcessingRunForStoredSourceV1({
    createdByUserId: input.createdByUserId ?? session.createdByUserId,
    deps,
    fileName: session.fileName,
    fileType: session.fileType,
    policyVersion: session.policyVersion,
    sourceSizeBytes: session.fileSizeBytes,
    sourceStorageKey: session.sourceStorageKey,
    tenantId: session.tenantId,
    workspaceId: session.workspaceId,
  });
  if (!queuedRun.ok) {
    return parseUploadAnnualReportSourceResultV1(queuedRun);
  }

  await deps.uploadSessionRepository.save({
    ...session,
    status: "consumed",
    processingRunId: queuedRun.run.runId,
    updatedAt: deps.nowIsoUtc(),
  });

  return parseUploadAnnualReportSourceResultV1({
    ok: true,
    run: queuedRun.run,
  });
}

/** Non-terminal statuses that a background Worker can get stuck in if
 *  Cloudflare kills the process before it can write a final status. */
const STUCK_PROCESSING_STATUSES_V1 = new Set([
  "queued",
  "uploading_source",
  "locating_sections",
  "extracting_core_facts",
  "extracting_statements",
  "extracting_tax_notes",
  "running_tax_analysis",
] as const);

/** Mark a run as failed when it has been in a non-terminal status for longer
 *  than this threshold without any progress update. Chosen to be comfortably
 *  above the Gemini round-trip time (~30-90 s) while still giving the user
 *  timely feedback when the background Worker is killed by Cloudflare. */
const STUCK_RUN_TIMEOUT_MS_V1 = 3 * 60 * 1000; // 3 minutes

export async function getLatestAnnualReportProcessingRunV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: AnnualReportProcessingDepsV1,
): Promise<GetLatestAnnualReportProcessingRunResultV1> {
  const run = await deps.processingRunRepository.getLatestByWorkspace(input);
  if (!run) {
    return parseGetLatestAnnualReportProcessingRunResultV1(
      buildFailureV1({
        code: "PROCESSING_RUN_NOT_FOUND",
        message: "No annual-report processing run exists for this workspace.",
        userMessage:
          "No annual-report processing run was found for this workspace.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      }),
    );
  }

  // Detect runs that were killed mid-processing by the hosting environment
  // (e.g. Cloudflare's wall-clock limit on waitUntil background tasks).
  // When that happens the background promise is terminated without any catch
  // handler running, leaving the run permanently stuck in an open status.
  // We detect this on every poll and write the failure status here — inside a
  // normal HTTP request — so the frontend can stop spinning and offer a retry.
  if (
    (STUCK_PROCESSING_STATUSES_V1 as Set<string>).has(run.status) &&
    Date.now() - new Date(run.updatedAt).getTime() > STUCK_RUN_TIMEOUT_MS_V1
  ) {
    const failedRun = await markRunFailedForRuntimeIssueV1({
      deps,
      run,
      technicalDetail: "processing.runtime.stuck_run_detected_on_poll",
      technicalMessage:
        "The processing background task was terminated by the hosting environment before it could finish. The run was detected as stuck during a status poll.",
    });
    return parseGetLatestAnnualReportProcessingRunResultV1({
      ok: true,
      run: projectRunV1(failedRun),
    });
  }

  return parseGetLatestAnnualReportProcessingRunResultV1({
    ok: true,
    run: projectRunV1(run),
  });
}

export async function startAnnualReportTaxAnalysisProcessingRunV1(
  input: unknown,
  deps: AnnualReportProcessingDepsV1,
): Promise<RunAnnualReportTaxAnalysisResultV1> {
  const parsedRequest =
    RunAnnualReportTaxAnalysisRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual-report tax-analysis request payload is invalid.",
        userMessage:
          "The forensic tax-review request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  if (!deps.analyzeAnnualReportTax) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "PROCESSING_RUN_UNAVAILABLE",
        message: "Annual-report tax analysis dependency is not configured.",
        userMessage:
          "Forensic tax review is temporarily unavailable. Try again shortly.",
        context: {
          operation: "annual_report.tax_analysis.start_run",
        },
      }),
    );
  }
  if (!deps.enqueueProcessingRun) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "PROCESSING_RUN_UNAVAILABLE",
        message:
          deps.processingConfigError ??
          "Annual-report background processing is not configured.",
        userMessage:
          "Forensic tax review is temporarily unavailable. Try again shortly.",
        context: {
          operation: "annual_report.tax_analysis.start_run",
        },
      }),
    );
  }

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        userMessage: "Workspace could not be found.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      }),
    );
  }

  const openRuns = await deps.processingRunRepository.listOpenByWorkspace({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (openRuns.length > 0) {
    const blockingRun = openRuns[0];
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "STATE_CONFLICT",
        message: "Another annual-report processing run is already open.",
        userMessage:
          blockingRun.status === "running_tax_analysis"
            ? "A forensic tax review is already running. Wait for it to finish before starting another."
            : "An annual-report run is already in progress. Wait for it to finish before starting forensic review.",
        context: {
          blockingRunId: blockingRun.id,
          blockingRunStatus: blockingRun.status,
        },
      }),
    );
  }

  const activeExtraction =
    await deps.artifactRepository.getActiveAnnualReportExtraction({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
  if (!activeExtraction) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "EXTRACTION_NOT_FOUND",
        message:
          "No active annual report extraction exists for this workspace.",
        userMessage:
          "Run the annual report extraction before starting forensic review.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      }),
    );
  }

  if (
    request.expectedActiveExtraction &&
    (activeExtraction.id !== request.expectedActiveExtraction.artifactId ||
      activeExtraction.version !== request.expectedActiveExtraction.version)
  ) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "STATE_CONFLICT",
        message:
          "Active extraction artifact/version differs from expected compare-and-set values.",
        userMessage:
          "The annual report changed before forensic review started. Refresh and retry.",
        context: {
          expectedActiveExtraction: request.expectedActiveExtraction,
          actualActiveExtraction: {
            artifactId: activeExtraction.id,
            version: activeExtraction.version,
          },
        },
      }),
    );
  }

  const missingRequiredFields = listMissingRequiredExtractionFieldsV1(
    activeExtraction.payload,
  );
  if (
    missingRequiredFields.length > 0 ||
    !hasAnnualReportFullExtractionV1(activeExtraction.payload)
  ) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code: "STATE_CONFLICT",
        message:
          "Forensic tax analysis requires a usable annual-report extraction with core facts and statements.",
        userMessage:
          "Finish the annual report extraction before running forensic review.",
        context: {
          missingRequiredFields,
          hasFullExtraction: hasAnnualReportFullExtractionV1(
            activeExtraction.payload,
          ),
        },
      }),
    );
  }

  const now = deps.nowIsoUtc();
  const runId = deps.generateId();
  const createdRun: AnnualReportProcessingRunRecordV1 = {
    id: runId,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    sourceFileName: activeExtraction.payload.sourceFileName,
    sourceFileType: activeExtraction.payload.sourceFileType,
    sourceStorageKey:
      activeExtraction.payload.sourceLineage?.sourceStorageKey ??
      [
        "annual-report-tax-analysis",
        request.tenantId,
        request.workspaceId,
        runId,
      ].join("/"),
    sourceSizeBytes: 1,
    policyVersion: activeExtraction.payload.policyVersion,
    status: "running_tax_analysis",
    hasPreviousActiveResult: Boolean(
      await deps.artifactRepository.getActiveAnnualReportTaxAnalysis({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      }),
    ),
    previousActiveExtractionArtifactId: activeExtraction.id,
    technicalDetails: buildTaxAnalysisRunTechnicalDetailsV1({
      expectedExtractionArtifactId: activeExtraction.id,
      expectedExtractionVersion: activeExtraction.version,
    }),
    resultExtractionArtifactId: activeExtraction.id,
    runtime: deps.getRuntimeMetadata?.(),
    createdByUserId: request.requestedByUserId,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
  };

  const persistedRun = await deps.processingRunRepository.create(createdRun);
  if (!persistedRun.ok) {
    return parseRunAnnualReportTaxAnalysisResultV1(
      buildFailureV1({
        code:
          persistedRun.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persistedRun.message,
        userMessage:
          persistedRun.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The forensic review could not be started.",
        context: {},
      }),
    );
  }

  const enqueueResult = await deps.enqueueProcessingRun({
    runId,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!enqueueResult.ok) {
    const failedRun = await markRunStatusV1({
      deps,
      run: persistedRun.value,
      status: "failed",
      error: {
        code: enqueueResult.code,
        userMessage:
          "The forensic review could not be started. Try again shortly.",
        technicalMessage: enqueueResult.message,
      },
      finishedAt: deps.nowIsoUtc(),
    });
    return parseRunAnnualReportTaxAnalysisResultV1({
      ok: true,
      run: projectRunV1(failedRun),
    });
  }

  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: request.requestedByUserId ? "user" : "system",
      actorUserId: request.requestedByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_STARTED,
      targetType: "annual_report_processing_run",
      targetId: runId,
      after: {
        runId,
        sourceExtractionArtifactId: activeExtraction.id,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  return parseRunAnnualReportTaxAnalysisResultV1({
    ok: true,
    run: projectRunV1(persistedRun.value),
  });
}

async function executeTaxAnalysisProcessingRunV1(input: {
  deps: AnnualReportProcessingDepsV1;
  run: AnnualReportProcessingRunRecordV1;
}): Promise<void> {
  const refreshedRun = await refreshRunIfCurrentV1({
    deps: input.deps,
    run: input.run,
  });
  if (!refreshedRun) {
    return;
  }

  const expectedExtractionArtifactId = readTechnicalDetailValueV1({
    prefix: TAX_ANALYSIS_EXPECTED_EXTRACTION_ARTIFACT_ID_DETAIL_PREFIX_V1,
    technicalDetails: refreshedRun.technicalDetails,
  });
  const expectedExtractionVersionRaw = readTechnicalDetailValueV1({
    prefix: TAX_ANALYSIS_EXPECTED_EXTRACTION_VERSION_DETAIL_PREFIX_V1,
    technicalDetails: refreshedRun.technicalDetails,
  });
  const expectedExtractionVersion = expectedExtractionVersionRaw
    ? Number(expectedExtractionVersionRaw)
    : NaN;
  if (
    !expectedExtractionArtifactId ||
    !Number.isInteger(expectedExtractionVersion) ||
    expectedExtractionVersion <= 0
  ) {
    await markRunFailedForRuntimeIssueV1({
      deps: input.deps,
      run: refreshedRun,
      technicalDetail:
        "processing.tax_analysis.failed missing_expected_extraction_reference",
      technicalMessage:
        "Forensic review run did not store the expected extraction reference.",
    });
    return;
  }

  const taxAnalysisResult = await runAnnualReportTaxAnalysisV1(
    {
      tenantId: refreshedRun.tenantId,
      workspaceId: refreshedRun.workspaceId,
      expectedActiveExtraction: {
        artifactId: expectedExtractionArtifactId,
        version: expectedExtractionVersion,
      },
      requestedByUserId: refreshedRun.createdByUserId,
    },
    {
      artifactRepository: input.deps.artifactRepository,
      auditRepository: input.deps.auditRepository,
      processingRunRepository: input.deps.processingRunRepository,
      sourceStore: input.deps.sourceStore,
      workspaceRepository: input.deps.workspaceRepository,
      analyzeAnnualReportTax: input.deps.analyzeAnnualReportTax,
      generateId: input.deps.generateId,
      nowIsoUtc: input.deps.nowIsoUtc,
    },
  );
  if (!taxAnalysisResult.ok) {
    await markRunStatusV1({
      deps: input.deps,
      run: refreshedRun,
      status: "failed",
      technicalDetails: [
        `processing.tax_analysis.failed code=${taxAnalysisResult.error.code}`,
      ],
      error: {
        code: taxAnalysisResult.error.code,
        userMessage: taxAnalysisResult.error.user_message,
        technicalMessage: taxAnalysisResult.error.message,
      },
      finishedAt: input.deps.nowIsoUtc(),
    });
    return;
  }
  if (!taxAnalysisResult.taxAnalysis || !taxAnalysisResult.active) {
    await markRunFailedForRuntimeIssueV1({
      deps: input.deps,
      run: refreshedRun,
      technicalDetail:
        "processing.tax_analysis.failed missing_completed_tax_analysis_payload",
      technicalMessage:
        "Forensic review run completed without a persisted tax-analysis artifact.",
    });
    return;
  }

  const completedRun = await markRunStatusV1({
    deps: input.deps,
    run: refreshedRun,
    status: "completed",
    technicalDetails: [
      `processing.tax_analysis.review_mode=${
        taxAnalysisResult.taxAnalysis.reviewState?.mode ?? "unknown"
      }`,
      `processing.tax_analysis.source_document_available=${
        taxAnalysisResult.taxAnalysis.reviewState?.sourceDocumentAvailable
          ? 1
          : 0
      }`,
      `processing.tax_analysis.source_document_used=${
        taxAnalysisResult.taxAnalysis.reviewState?.sourceDocumentUsed ? 1 : 0
      }`,
      ...(taxAnalysisResult.taxAnalysis.reviewState?.reasons ?? []).map(
        (reason) => `processing.tax_analysis.reason=${reason}`,
      ),
    ],
    degradation: {
      mode: "none",
      warnings: taxAnalysisResult.taxAnalysis.reviewState?.reasons ?? [],
      fallbacks: [],
    },
    resultTaxAnalysisArtifactId: taxAnalysisResult.active?.artifactId,
    finishedAt: input.deps.nowIsoUtc(),
  });

  await appendAuditEventBestEffortV1({
    deps: input.deps,
    event: parseAuditEventV2({
      id: input.deps.generateId(),
      tenantId: completedRun.tenantId,
      workspaceId: completedRun.workspaceId,
      actorType: completedRun.createdByUserId ? "user" : "system",
      actorUserId: completedRun.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_COMPLETED,
      targetType: "annual_report_processing_run",
      targetId: completedRun.id,
      after: {
        runId: completedRun.id,
        extractionArtifactId: completedRun.resultExtractionArtifactId,
        taxAnalysisArtifactId: completedRun.resultTaxAnalysisArtifactId,
      },
      timestamp: input.deps.nowIsoUtc(),
      context: {},
    }),
  });
}

export async function processAnnualReportProcessingRunV1(
  input: AnnualReportProcessingQueueMessageV1,
  deps: AnnualReportProcessingDepsV1,
): Promise<void> {
  const parsed = AnnualReportProcessingQueueMessageV1Schema.safeParse(input);
  if (!parsed.success) {
    return;
  }

  const initialRun = await deps.processingRunRepository.getById({
    runId: parsed.data.runId,
    tenantId: parsed.data.tenantId,
    workspaceId: parsed.data.workspaceId,
  });
  if (!initialRun) {
    return;
  }
  if (isTaxAnalysisProcessingRunV1(initialRun)) {
    await executeTaxAnalysisProcessingRunV1({
      deps,
      run: initialRun,
    });
    return;
  }
  if (
    initialRun.status !== "queued" &&
    initialRun.status !== "uploading_source"
  ) {
    return;
  }
  if (!deps.sourceStore) {
    await markRunFailedForRuntimeIssueV1({
      deps,
      run: initialRun,
      technicalDetail:
        "processing.runtime.unavailable source_store_binding_missing",
      technicalMessage:
        "Annual-report source storage binding is not configured.",
    });
    return;
  }
  if (!deps.extractAnnualReport) {
    await markRunFailedForRuntimeIssueV1({
      deps,
      run: initialRun,
      technicalDetail:
        "processing.runtime.unavailable extractor_dependency_missing",
      technicalMessage: "Annual-report extractor is not configured.",
    });
    return;
  }
  const run: AnnualReportProcessingRunRecordV1 = initialRun;

  const latest = await deps.processingRunRepository.getLatestByWorkspace({
    tenantId: run.tenantId,
    workspaceId: run.workspaceId,
  });
  if (!latest || latest.id !== run.id) {
    await saveRunOrThrowV1(deps, {
      ...run,
      status: "superseded",
      technicalDetails: [
        ...run.technicalDetails,
        "Superseded before processing started.",
      ],
      updatedAt: deps.nowIsoUtc(),
      finishedAt: deps.nowIsoUtc(),
    });
    return;
  }
  let sourceBytes: Uint8Array;
  try {
    sourceBytes = await loadSourceBytesV1({
      deps,
      run,
    });
  } catch (error) {
    await markRunFailedForRuntimeIssueV1({
      deps,
      run,
      technicalDetail:
        "processing.source_load.failed stored_source_missing_or_unreadable",
      technicalMessage:
        error instanceof Error
          ? error.message
          : "Stored annual report source file could not be loaded.",
    });
    return;
  }
  await executeProcessingRunFromSourceBytesV1({
    deps,
    run,
    sourceBytes,
  });
}
