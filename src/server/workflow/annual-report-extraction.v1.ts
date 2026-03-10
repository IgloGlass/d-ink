import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { AnnualReportProcessingRunRepositoryV1 } from "../../db/repositories/annual-report-processing-run.repository.v1";
import type {
  WorkspaceArtifactRepositoryV1,
  WorkspaceArtifactVersionRecordV1,
} from "../../db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import {
  type AnnualReportExtractionPayloadV1,
  type AnnualReportRuntimeMetadataV1,
  ApplyAnnualReportExtractionOverridesRequestV1Schema,
  ClearAnnualReportDataRequestV1Schema,
  type ClearAnnualReportDataResultV1,
  type ApplyAnnualReportExtractionOverridesResultV1,
  ConfirmAnnualReportExtractionRequestV1Schema,
  type ConfirmAnnualReportExtractionResultV1,
  type GetActiveAnnualReportExtractionResultV1,
  GetActiveAnnualReportExtractionResultV1Schema,
  RunAnnualReportExtractionRequestV1Schema,
  type RunAnnualReportExtractionResultV1,
  parseClearAnnualReportDataResultV1,
  parseApplyAnnualReportExtractionOverridesResultV1,
  parseConfirmAnnualReportExtractionResultV1,
  parseRunAnnualReportExtractionResultV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type GetActiveAnnualReportTaxAnalysisResultV1,
  parseGetActiveAnnualReportTaxAnalysisResultV1,
} from "../../shared/contracts/annual-report-tax-analysis.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import { parseAnnualReportExtractionV1 } from "../parsing/annual-report-extractor.v1";
import { validateAnnualReportFileTypeCoherenceV1 } from "../security/file-type-coherence.v1";
import { MAX_ANNUAL_REPORT_FILE_BYTES_V1 } from "../security/payload-limits.v1";
import type { ParseAnnualReportExtractionResultV1 } from "../parsing/annual-report-extractor.v1";
import type { WorkspaceArtifactTypeV1 } from "../../db/repositories/workspace-artifact.repository.v1";

export interface AnnualReportExtractionDepsV1 {
  artifactRepository: WorkspaceArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  processingRunRepository?: AnnualReportProcessingRunRepositoryV1;
  extractAnnualReport?: (input: {
    fileBytes: Uint8Array;
    fileName: string;
    fileType?: "pdf" | "docx";
    policyVersion: string;
  }) => Promise<ParseAnnualReportExtractionResultV1>;
  analyzeAnnualReportTax?: (input: {
    extraction: AnnualReportExtractionPayloadV1;
    extractionArtifactId: string;
    policyVersion: string;
  }) => Promise<
    | {
        ok: true;
        taxAnalysis: import("../../shared/contracts/annual-report-tax-analysis.v1").AnnualReportTaxAnalysisPayloadV1;
      }
    | {
        ok: false;
        error: {
          code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
          message: string;
          context: Record<string, unknown>;
        };
      }
  >;
  workspaceRepository: WorkspaceRepositoryV1;
  getRuntimeMetadata?: () => AnnualReportRuntimeMetadataV1;
  generateId: () => string;
  nowIsoUtc: () => string;
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
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "EXTRACTION_NOT_FOUND"
    | "STATE_CONFLICT"
    | "PARSE_FAILED"
    | "PERSISTENCE_ERROR";
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
  deps: AnnualReportExtractionDepsV1;
  event: ReturnType<typeof parseAuditEventV2>;
}): Promise<void> {
  const appendResult = await input.deps.auditRepository.append(input.event);
  if (!appendResult.ok) {
    // Extraction artifacts remain source of truth; audit append is best-effort.
  }
}

function decodeBase64ToUint8ArrayV1(base64Value: string): Uint8Array | null {
  const normalized = base64Value.trim();
  if (normalized.length === 0) {
    return null;
  }

  try {
    if (typeof atob === "function") {
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return bytes;
    }

    const maybeBuffer = (
      globalThis as {
        Buffer?: { from(value: string, encoding: string): Uint8Array };
      }
    ).Buffer;
    if (!maybeBuffer) {
      return null;
    }

    return new Uint8Array(maybeBuffer.from(normalized, "base64"));
  } catch {
    return null;
  }
}

function toValueTextV1(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }

  return String(value);
}

function recalculateSummaryV1(extraction: AnnualReportExtractionPayloadV1) {
  const fields = extraction.fields;
  const statuses = [
    fields.companyName.status,
    fields.organizationNumber.status,
    fields.fiscalYearStart.status,
    fields.fiscalYearEnd.status,
    fields.accountingStandard.status,
    fields.profitBeforeTax.status,
  ];
  return {
    autoDetectedFieldCount: statuses.filter((status) => status === "extracted")
      .length,
    needsReviewFieldCount: statuses.filter(
      (status) => status === "needs_review",
    ).length,
  };
}

function applyExtractionOverridesV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
  overrides: Array<{
    fieldKey:
      | "companyName"
      | "organizationNumber"
      | "fiscalYearStart"
      | "fiscalYearEnd"
      | "accountingStandard"
      | "profitBeforeTax";
    reason: string;
    value: number | string;
  }>;
}): AnnualReportExtractionPayloadV1 {
  const next: AnnualReportExtractionPayloadV1 = {
    ...input.extraction,
    fields: {
      ...input.extraction.fields,
    },
    confirmation: {
      isConfirmed: false,
    },
  };

  for (const override of input.overrides) {
    switch (override.fieldKey) {
      case "companyName":
      case "organizationNumber": {
        const value = String(override.value).trim();
        if (value.length === 0) {
          throw new Error(
            `Override for ${override.fieldKey} must be non-empty text.`,
          );
        }
        next.fields[override.fieldKey] = {
          status: "manual",
          confidence: 1,
          value,
          sourceSnippet: {
            snippet: `Manual override: ${override.reason}`,
          },
        };
        break;
      }
      case "fiscalYearStart":
      case "fiscalYearEnd": {
        const value = String(override.value).trim();
        next.fields[override.fieldKey] = {
          status: "manual",
          confidence: 1,
          value,
          sourceSnippet: {
            snippet: `Manual override: ${override.reason}`,
          },
        };
        break;
      }
      case "accountingStandard": {
        const upper = String(override.value).trim().toUpperCase();
        if (upper !== "K2" && upper !== "K3") {
          throw new Error("accountingStandard override must be K2 or K3.");
        }
        next.fields.accountingStandard = {
          status: "manual",
          confidence: 1,
          value: upper,
          sourceSnippet: {
            snippet: `Manual override: ${override.reason}`,
          },
        };
        break;
      }
      case "profitBeforeTax": {
        const numericValue =
          typeof override.value === "number"
            ? override.value
            : Number(override.value);
        if (!Number.isFinite(numericValue)) {
          throw new Error("profitBeforeTax override must be a finite number.");
        }
        next.fields.profitBeforeTax = {
          status: "manual",
          confidence: 1,
          value: numericValue,
          sourceSnippet: {
            snippet: `Manual override: ${override.reason}`,
          },
        };
        break;
      }
      default: {
        const exhaustiveCheck: never = override.fieldKey;
        throw new Error(
          `Unsupported override field: ${String(exhaustiveCheck)}`,
        );
      }
    }
  }

  next.summary = recalculateSummaryV1(next);
  return next;
}

export function listMissingRequiredExtractionFieldsV1(
  extraction: AnnualReportExtractionPayloadV1,
): string[] {
  const missing: string[] = [];
  if (!extraction.fields.companyName.value) {
    missing.push("companyName");
  }
  if (!extraction.fields.organizationNumber.value) {
    missing.push("organizationNumber");
  }
  if (!extraction.fields.fiscalYearStart.value) {
    missing.push("fiscalYearStart");
  }
  if (!extraction.fields.fiscalYearEnd.value) {
    missing.push("fiscalYearEnd");
  }
  if (!extraction.fields.accountingStandard.value) {
    missing.push("accountingStandard");
  }
  if (typeof extraction.fields.profitBeforeTax.value !== "number") {
    missing.push("profitBeforeTax");
  }
  return missing;
}

export function hasAnnualReportFullExtractionV1(
  extraction: AnnualReportExtractionPayloadV1,
): boolean {
  return Boolean(
    extraction.taxDeep &&
      extraction.taxDeep.ink2rExtracted.incomeStatement.length > 0 &&
      extraction.taxDeep.ink2rExtracted.balanceSheet.length > 0,
  );
}

export function resolveRuntimeMetadataV1(
  deps: AnnualReportExtractionDepsV1,
): AnnualReportRuntimeMetadataV1 | undefined {
  return deps.getRuntimeMetadata?.();
}

const ANNUAL_REPORT_DEPENDENT_ARTIFACT_TYPES_V1: WorkspaceArtifactTypeV1[] = [
  "annual_report_tax_analysis",
  "tax_adjustments",
  "tax_summary",
  "ink2_form",
  "export_package",
];

const ANNUAL_REPORT_CLEAR_ARTIFACT_TYPES_V1: WorkspaceArtifactTypeV1[] = [
  "annual_report_extraction",
  ...ANNUAL_REPORT_DEPENDENT_ARTIFACT_TYPES_V1,
];

export function finalizeExtractionConfirmationV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
  actorUserId?: string;
  confirmedAt: string;
}): AnnualReportExtractionPayloadV1 {
  const canAutoConfirm =
    Boolean(input.actorUserId) &&
    listMissingRequiredExtractionFieldsV1(input.extraction).length === 0 &&
    hasAnnualReportFullExtractionV1(input.extraction);

  return {
    ...input.extraction,
    confirmation: canAutoConfirm
      ? {
          isConfirmed: true,
          confirmedAt: input.confirmedAt,
          confirmedByUserId: input.actorUserId,
        }
      : {
          isConfirmed: false,
        },
  };
}

export async function clearActiveAnnualReportDependentsV1(input: {
  deps: AnnualReportExtractionDepsV1;
  tenantId: string;
  workspaceId: string;
  actorType: "system" | "user";
  actorUserId?: string;
  reason: "annual_report_cleared" | "annual_report_replaced";
}): Promise<
  | { ok: true; clearedArtifactTypes: WorkspaceArtifactTypeV1[] }
  | {
      ok: false;
      code: "WORKSPACE_NOT_FOUND" | "PERSISTENCE_ERROR";
      message: string;
    }
> {
  const clearResult = await input.deps.artifactRepository.clearActiveArtifacts({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    artifactTypes: ANNUAL_REPORT_DEPENDENT_ARTIFACT_TYPES_V1,
  });

  if (!clearResult.ok) {
    return clearResult;
  }

  if (clearResult.clearedArtifactTypes.length > 0) {
    await appendAuditEventBestEffortV1({
      deps: input.deps,
      event: parseAuditEventV2({
        id: input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        eventType:
          AUDIT_EVENT_TYPES_V1.EXTRACTION_ACTIVE_DEPENDENTS_CLEARED,
        targetType: "workspace_active_artifacts",
        targetId: input.workspaceId,
        after: {
          clearedArtifactTypes: clearResult.clearedArtifactTypes,
          reason: input.reason,
        },
        timestamp: input.deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  return clearResult;
}

export async function persistAnnualReportExtractionArtifactV1(input: {
  actorType: "system" | "user";
  actorUserId?: string;
  artifactId?: string;
  clearDependentsReason: "annual_report_cleared" | "annual_report_replaced";
  deps: AnnualReportExtractionDepsV1;
  extraction: AnnualReportExtractionPayloadV1;
  tenantId: string;
  workspaceId: string;
}): Promise<
  | {
      ok: true;
      artifact: WorkspaceArtifactVersionRecordV1<"annual_report_extraction">;
    }
  | {
      ok: false;
      code: "WORKSPACE_NOT_FOUND" | "PERSISTENCE_ERROR";
      message: string;
      userMessage: string;
      context: Record<string, unknown>;
    }
> {
  const persistedExtraction = finalizeExtractionConfirmationV1({
    extraction: input.extraction,
    actorUserId: input.actorUserId,
    confirmedAt: input.deps.nowIsoUtc(),
  });

  const clearDependentsResult = await clearActiveAnnualReportDependentsV1({
    deps: input.deps,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    reason: input.clearDependentsReason,
  });
  if (!clearDependentsResult.ok) {
    return {
      ok: false,
      code: clearDependentsResult.code,
      message: clearDependentsResult.message,
      userMessage:
        "The annual report could not replace the current workspace data due to a storage error.",
      context: {
        operation: "annual_report.clear_dependents",
      },
    };
  }

  const writeResult =
    await input.deps.artifactRepository.appendAnnualReportExtractionAndSetActive(
      {
        artifactId: input.artifactId ?? input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        createdAt: input.deps.nowIsoUtc(),
        createdByUserId: input.actorUserId,
        extraction: persistedExtraction,
      },
    );
  if (!writeResult.ok) {
    return {
      ok: false,
      code:
        writeResult.code === "WORKSPACE_NOT_FOUND"
          ? "WORKSPACE_NOT_FOUND"
          : "PERSISTENCE_ERROR",
      message: writeResult.message,
      userMessage:
        writeResult.code === "WORKSPACE_NOT_FOUND"
          ? "Workspace could not be found."
          : "The extraction could not be saved due to a storage error.",
      context: {
        operation: "annual_report.appendAndSetActive",
      },
    };
  }

  await appendAuditEventBestEffortV1({
    deps: input.deps,
    event: parseAuditEventV2({
      id: input.deps.generateId(),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorType: input.actorType,
      actorUserId: input.actorUserId,
      eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CREATED,
      targetType: "annual_report_extraction_artifact",
      targetId: writeResult.artifact.id,
      after: {
        artifactId: writeResult.artifact.id,
        version: writeResult.artifact.version,
        autoDetectedFieldCount:
          writeResult.artifact.payload.summary.autoDetectedFieldCount,
        needsReviewFieldCount:
          writeResult.artifact.payload.summary.needsReviewFieldCount,
      },
      timestamp: input.deps.nowIsoUtc(),
      context: {},
    }),
  });

  if (writeResult.artifact.payload.confirmation.isConfirmed) {
    await appendAuditEventBestEffortV1({
      deps: input.deps,
      event: parseAuditEventV2({
        id: input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CONFIRMED,
        targetType: "annual_report_extraction_artifact",
        targetId: writeResult.artifact.id,
        after: {
          artifactId: writeResult.artifact.id,
          version: writeResult.artifact.version,
          confirmedByUserId: input.actorUserId,
          confirmationSource: "auto_on_upload",
        },
        timestamp: input.deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  if (writeResult.artifact.version > 1) {
    await appendAuditEventBestEffortV1({
      deps: input.deps,
      event: parseAuditEventV2({
        id: input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
        targetType: "pipeline_module",
        targetId: "annual_report_extraction",
        before: {
          extractionVersion: writeResult.artifact.version - 1,
        },
        after: {
          extractionVersion: writeResult.artifact.version,
        },
        timestamp: input.deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  return {
    ok: true,
    artifact: writeResult.artifact,
  };
}

export async function persistAnnualReportTaxAnalysisArtifactV1(input: {
  actorType: "system" | "user";
  actorUserId?: string;
  deps: AnnualReportExtractionDepsV1;
  sourceExtractionArtifactId: string;
  taxAnalysis: import("../../shared/contracts/annual-report-tax-analysis.v1").AnnualReportTaxAnalysisPayloadV1;
  tenantId: string;
  workspaceId: string;
}): Promise<
  | {
      ok: true;
      artifact: WorkspaceArtifactVersionRecordV1<"annual_report_tax_analysis">;
    }
  | {
      ok: false;
      code: "WORKSPACE_NOT_FOUND" | "PERSISTENCE_ERROR";
      message: string;
    }
> {
  const persistedTaxAnalysis =
    await input.deps.artifactRepository.appendAnnualReportTaxAnalysisAndSetActive(
      {
        artifactId: input.deps.generateId(),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        createdAt: input.deps.nowIsoUtc(),
        createdByUserId: input.actorUserId,
        taxAnalysis: input.taxAnalysis,
      },
    );

  if (!persistedTaxAnalysis.ok) {
    return {
      ok: false,
      code:
        persistedTaxAnalysis.code === "WORKSPACE_NOT_FOUND"
          ? "WORKSPACE_NOT_FOUND"
          : "PERSISTENCE_ERROR",
      message: persistedTaxAnalysis.message,
    };
  }

  await appendAuditEventBestEffortV1({
    deps: input.deps,
    event: parseAuditEventV2({
      id: input.deps.generateId(),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorType: input.actorType,
      actorUserId: input.actorUserId,
      eventType: "annual_report.tax_analysis_generated",
      targetType: "annual_report_tax_analysis_artifact",
      targetId: persistedTaxAnalysis.artifact.id,
      after: {
        artifactId: persistedTaxAnalysis.artifact.id,
        version: persistedTaxAnalysis.artifact.version,
        sourceExtractionArtifactId: input.sourceExtractionArtifactId,
      },
      timestamp: input.deps.nowIsoUtc(),
      context: {},
    }),
  });

  return {
    ok: true,
    artifact: persistedTaxAnalysis.artifact,
  };
}

export async function runAnnualReportExtractionV1(
  input: unknown,
  deps: AnnualReportExtractionDepsV1,
): Promise<RunAnnualReportExtractionResultV1> {
  const parsedRequest =
    RunAnnualReportExtractionRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual report run request payload is invalid.",
        userMessage:
          "The annual report run request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;
  const actorType = request.createdByUserId ? "user" : "system";

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseRunAnnualReportExtractionResultV1(
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

  const fileBytes = decodeBase64ToUint8ArrayV1(request.fileBytesBase64);
  if (!fileBytes || fileBytes.byteLength === 0) {
    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message:
          "fileBytesBase64 could not be decoded into non-empty annual report bytes.",
        userMessage:
          "The annual report bytes are invalid. Upload the file again.",
        context: {
          fileName: request.fileName,
        },
      }),
    );
  }
  if (fileBytes.byteLength > MAX_ANNUAL_REPORT_FILE_BYTES_V1) {
    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Decoded annual report file exceeds configured size limit.",
        userMessage:
          "The annual report file is too large for V1 processing limits.",
        context: {
          reason: "payload_too_large",
          maxBytes: MAX_ANNUAL_REPORT_FILE_BYTES_V1,
          actualBytes: fileBytes.byteLength,
          fileName: request.fileName,
        },
      }),
    );
  }
  const fileTypeCoherenceFailure = validateAnnualReportFileTypeCoherenceV1({
    fileName: request.fileName,
    fileType: request.fileType,
    fileBytes,
  });
  if (fileTypeCoherenceFailure) {
    return parseRunAnnualReportExtractionResultV1(
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

  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType,
      actorUserId: request.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.FILE_UPLOADED,
      targetType: "annual_report_file",
      targetId: request.fileName,
      after: {
        fileName: request.fileName,
        fileType: request.fileType ?? null,
        decodedBytes: fileBytes.byteLength,
        module: "annual_report_extraction",
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const extractionResult = deps.extractAnnualReport
    ? await deps.extractAnnualReport({
        fileName: request.fileName,
        fileType: request.fileType,
        fileBytes,
        policyVersion: request.policyVersion,
      })
    : parseAnnualReportExtractionV1({
        fileName: request.fileName,
        fileType: request.fileType,
        fileBytes,
        policyVersion: request.policyVersion,
      });
  if (!extractionResult.ok) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType,
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.PARSE_FAILED,
        targetType: "annual_report_file",
        targetId: request.fileName,
        after: {
          fileName: request.fileName,
          errorCode: extractionResult.error.code,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code: extractionResult.error.code,
        message: extractionResult.error.message,
        userMessage: extractionResult.error.user_message,
        context: extractionResult.error.context,
      }),
    );
  }
  const runtimeMetadata = resolveRuntimeMetadataV1(deps);
  const extractedPayload: AnnualReportExtractionPayloadV1 =
    runtimeMetadata && !extractionResult.extraction.engineMetadata
      ? {
          ...extractionResult.extraction,
          engineMetadata: runtimeMetadata,
        }
      : extractionResult.extraction;
  const persistedExtraction = finalizeExtractionConfirmationV1({
    extraction: extractedPayload,
    actorUserId: request.createdByUserId,
    confirmedAt: deps.nowIsoUtc(),
  });
  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType,
      actorUserId: request.createdByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.PARSE_SUCCEEDED,
      targetType: "annual_report_extraction",
      targetId: request.fileName,
      after: {
        extractedFieldCount:
          persistedExtraction.summary.autoDetectedFieldCount,
        needsReviewFieldCount:
          persistedExtraction.summary.needsReviewFieldCount,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const clearDependentsResult = await clearActiveAnnualReportDependentsV1({
    deps,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType,
    actorUserId: request.createdByUserId,
    reason: "annual_report_replaced",
  });
  if (!clearDependentsResult.ok) {
    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code:
          clearDependentsResult.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: clearDependentsResult.message,
        userMessage:
          "The annual report could not replace the current workspace data due to a storage error.",
        context: {
          operation: "annual_report.clear_dependents",
        },
      }),
    );
  }

  const writeResult =
    await deps.artifactRepository.appendAnnualReportExtractionAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
      extraction: persistedExtraction,
    });
  if (!writeResult.ok) {
    return parseRunAnnualReportExtractionResultV1(
      buildFailureV1({
        code:
          writeResult.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: writeResult.message,
        userMessage:
          writeResult.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The extraction could not be saved due to a storage error.",
        context: {
          operation: "annual_report.appendAndSetActive",
        },
      }),
    );
  }

  const auditEvent = parseAuditEventV2({
    id: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType,
    actorUserId: request.createdByUserId,
    eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CREATED,
    targetType: "annual_report_extraction_artifact",
    targetId: writeResult.artifact.id,
    after: {
      artifactId: writeResult.artifact.id,
      version: writeResult.artifact.version,
      autoDetectedFieldCount:
        writeResult.artifact.payload.summary.autoDetectedFieldCount,
      needsReviewFieldCount:
        writeResult.artifact.payload.summary.needsReviewFieldCount,
    },
    timestamp: deps.nowIsoUtc(),
    context: {},
  });
  await appendAuditEventBestEffortV1({
    deps,
    event: auditEvent,
  });
  if (writeResult.artifact.payload.confirmation.isConfirmed) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType,
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CONFIRMED,
        targetType: "annual_report_extraction_artifact",
        targetId: writeResult.artifact.id,
        after: {
          artifactId: writeResult.artifact.id,
          version: writeResult.artifact.version,
          confirmedByUserId: request.createdByUserId,
          confirmationSource: "auto_on_upload",
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });
  }
  if (deps.analyzeAnnualReportTax) {
    const taxAnalysisResult = await deps.analyzeAnnualReportTax({
      extraction: writeResult.artifact.payload,
      extractionArtifactId: writeResult.artifact.id,
      policyVersion: request.policyVersion,
    });

    if (taxAnalysisResult.ok) {
      const persistedTaxAnalysis =
        await deps.artifactRepository.appendAnnualReportTaxAnalysisAndSetActive({
          artifactId: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          createdAt: deps.nowIsoUtc(),
          createdByUserId: request.createdByUserId,
          taxAnalysis: taxAnalysisResult.taxAnalysis,
        });

      if (persistedTaxAnalysis.ok) {
        await appendAuditEventBestEffortV1({
          deps,
          event: parseAuditEventV2({
            id: deps.generateId(),
            tenantId: request.tenantId,
            workspaceId: request.workspaceId,
            actorType,
            actorUserId: request.createdByUserId,
            eventType: "annual_report.tax_analysis_generated",
            targetType: "annual_report_tax_analysis_artifact",
            targetId: persistedTaxAnalysis.artifact.id,
            after: {
              artifactId: persistedTaxAnalysis.artifact.id,
              version: persistedTaxAnalysis.artifact.version,
              sourceExtractionArtifactId: writeResult.artifact.id,
            },
            timestamp: deps.nowIsoUtc(),
            context: {},
          }),
        });
      }
    } else {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType,
          actorUserId: request.createdByUserId,
          eventType: "annual_report.tax_analysis_failed",
          targetType: "annual_report_tax_analysis",
          targetId: writeResult.artifact.id,
          after: {
            sourceExtractionArtifactId: writeResult.artifact.id,
            errorCode: taxAnalysisResult.error.code,
          },
          timestamp: deps.nowIsoUtc(),
          context: {
            message: taxAnalysisResult.error.message,
          },
        }),
      });
    }
  }
  if (writeResult.artifact.version > 1) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType,
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
        targetType: "pipeline_module",
        targetId: "annual_report_extraction",
        before: {
          extractionVersion: writeResult.artifact.version - 1,
        },
        after: {
          extractionVersion: writeResult.artifact.version,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  return parseRunAnnualReportExtractionResultV1({
    ok: true,
    active: {
      artifactId: writeResult.artifact.id,
      version: writeResult.artifact.version,
      schemaVersion: writeResult.artifact.schemaVersion,
    },
    extraction: writeResult.artifact.payload,
    runtime: resolveRuntimeMetadataV1(deps),
  });
}

export async function getActiveAnnualReportTaxAnalysisV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: AnnualReportExtractionDepsV1,
): Promise<GetActiveAnnualReportTaxAnalysisResultV1> {
  const active = await deps.artifactRepository.getActiveAnnualReportTaxAnalysis({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!active) {
    return parseGetActiveAnnualReportTaxAnalysisResultV1({
      ok: false,
      error: {
        code: "TAX_ANALYSIS_NOT_FOUND",
        message:
          "No active annual-report tax analysis exists for this workspace.",
        user_message:
          "No annual-report tax analysis was found for this workspace.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      },
    });
  }

  return parseGetActiveAnnualReportTaxAnalysisResultV1({
    ok: true,
    active: {
      artifactId: active.id,
      version: active.version,
      schemaVersion: active.schemaVersion,
    },
    taxAnalysis: active.payload,
  });
}

export async function getActiveAnnualReportExtractionV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: AnnualReportExtractionDepsV1,
): Promise<GetActiveAnnualReportExtractionResultV1> {
  const active = await deps.artifactRepository.getActiveAnnualReportExtraction({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
  });
  if (!active) {
    return GetActiveAnnualReportExtractionResultV1Schema.parse(
      buildFailureV1({
        code: "EXTRACTION_NOT_FOUND",
        message:
          "No active annual report extraction exists for this workspace.",
        userMessage:
          "No annual report extraction was found for this workspace.",
        context: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
        },
      }),
    );
  }

  return GetActiveAnnualReportExtractionResultV1Schema.parse({
    ok: true,
    active: {
      artifactId: active.id,
      version: active.version,
      schemaVersion: active.schemaVersion,
    },
    extraction: active.payload,
    runtime: resolveRuntimeMetadataV1(deps),
  });
}

export async function applyAnnualReportExtractionOverridesV1(
  input: unknown,
  deps: AnnualReportExtractionDepsV1,
): Promise<ApplyAnnualReportExtractionOverridesResultV1> {
  const parsedRequest =
    ApplyAnnualReportExtractionOverridesRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual report override request payload is invalid.",
        userMessage:
          "The annual report override request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
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

  const active = await deps.artifactRepository.getActiveAnnualReportExtraction({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!active) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code: "EXTRACTION_NOT_FOUND",
        message:
          "No active annual report extraction exists for this workspace.",
        userMessage:
          "No annual report extraction was found for this workspace.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      }),
    );
  }

  if (
    active.id !== request.expectedActiveExtraction.artifactId ||
    active.version !== request.expectedActiveExtraction.version
  ) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code: "STATE_CONFLICT",
        message:
          "Active extraction artifact/version differs from expected compare-and-set values.",
        userMessage:
          "Extraction changed before your update was applied. Refresh and retry.",
        context: {
          expectedActiveExtraction: request.expectedActiveExtraction,
          actualActiveExtraction: {
            artifactId: active.id,
            version: active.version,
          },
        },
      }),
    );
  }

  let updatedExtraction: AnnualReportExtractionPayloadV1;
  try {
    updatedExtraction = applyExtractionOverridesV1({
      extraction: active.payload,
      overrides: request.overrides,
    });
  } catch (error) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message:
          error instanceof Error ? error.message : "Invalid override payload.",
        userMessage: "One or more override values are invalid.",
        context: {
          overrideValues: request.overrides.map((override) => ({
            fieldKey: override.fieldKey,
            value: toValueTextV1(override.value),
          })),
        },
      }),
    );
  }
  const overrideExtractionWithMetadata: AnnualReportExtractionPayloadV1 =
    resolveRuntimeMetadataV1(deps) && !updatedExtraction.engineMetadata
      ? {
          ...updatedExtraction,
          engineMetadata: resolveRuntimeMetadataV1(deps),
        }
      : updatedExtraction;
  const overrideExtraction = finalizeExtractionConfirmationV1({
    extraction: overrideExtractionWithMetadata,
    actorUserId: request.authorUserId,
    confirmedAt: deps.nowIsoUtc(),
  });

  const clearDependentsResult = await clearActiveAnnualReportDependentsV1({
    deps,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType: request.authorUserId ? "user" : "system",
    actorUserId: request.authorUserId,
    reason: "annual_report_replaced",
  });
  if (!clearDependentsResult.ok) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code:
          clearDependentsResult.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: clearDependentsResult.message,
        userMessage:
          "The annual report update could not clear dependent workspace data.",
        context: {
          operation: "annual_report.override.clear_dependents",
        },
      }),
    );
  }

  const persisted =
    await deps.artifactRepository.appendAnnualReportExtractionAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.authorUserId,
      extraction: overrideExtraction,
    });
  if (!persisted.ok) {
    return parseApplyAnnualReportExtractionOverridesResultV1(
      buildFailureV1({
        code:
          persisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persisted.message,
        userMessage:
          "Extraction overrides could not be saved due to a storage error.",
        context: {
          operation: "annual_report.override.persist",
        },
      }),
    );
  }

  const auditEvent = parseAuditEventV2({
    id: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType: request.authorUserId ? "user" : "system",
    actorUserId: request.authorUserId,
    eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_OVERRIDDEN,
    targetType: "annual_report_extraction_artifact",
    targetId: persisted.artifact.id,
    before: {
      artifactId: active.id,
      version: active.version,
    },
    after: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      appliedCount: request.overrides.length,
    },
    timestamp: deps.nowIsoUtc(),
    context: {
      overriddenFields: request.overrides.map((override) => override.fieldKey),
    },
  });
  await appendAuditEventBestEffortV1({
    deps,
    event: auditEvent,
  });
  if (persisted.artifact.payload.confirmation.isConfirmed) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.authorUserId ? "user" : "system",
        actorUserId: request.authorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CONFIRMED,
        targetType: "annual_report_extraction_artifact",
        targetId: persisted.artifact.id,
        after: {
          artifactId: persisted.artifact.id,
          version: persisted.artifact.version,
          confirmedByUserId: request.authorUserId,
          confirmationSource: "auto_on_override",
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  return parseApplyAnnualReportExtractionOverridesResultV1({
    ok: true,
    active: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      schemaVersion: persisted.artifact.schemaVersion,
    },
    extraction: persisted.artifact.payload,
    appliedCount: request.overrides.length,
    runtime: resolveRuntimeMetadataV1(deps),
  });
}

export async function confirmAnnualReportExtractionV1(
  input: unknown,
  deps: AnnualReportExtractionDepsV1,
): Promise<ConfirmAnnualReportExtractionResultV1> {
  const parsedRequest =
    ConfirmAnnualReportExtractionRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual report confirm request payload is invalid.",
        userMessage:
          "The annual report confirmation request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const active = await deps.artifactRepository.getActiveAnnualReportExtraction({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!active) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "EXTRACTION_NOT_FOUND",
        message:
          "No active annual report extraction exists for this workspace.",
        userMessage:
          "No annual report extraction was found for this workspace.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      }),
    );
  }

  if (
    active.id !== request.expectedActiveExtraction.artifactId ||
    active.version !== request.expectedActiveExtraction.version
  ) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "STATE_CONFLICT",
        message:
          "Active extraction artifact/version differs from expected compare-and-set values.",
        userMessage:
          "Extraction changed before confirmation was applied. Refresh and retry.",
        context: {
          expectedActiveExtraction: request.expectedActiveExtraction,
          actualActiveExtraction: {
            artifactId: active.id,
            version: active.version,
          },
        },
      }),
    );
  }

  const missingRequiredFields = listMissingRequiredExtractionFieldsV1(
    active.payload,
  );
  if (missingRequiredFields.length > 0) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Cannot confirm extraction with missing required fields.",
        userMessage:
          "Fill all required annual report fields before confirming extraction.",
        context: {
          missingRequiredFields,
        },
      }),
    );
  }
  if (!hasAnnualReportFullExtractionV1(active.payload)) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message:
          "Cannot confirm annual report extraction without full financial statement extraction.",
        userMessage:
          "The income statement or balance sheet is incomplete. Re-run the annual report analysis before approving this extraction.",
        context: {
          missingFinancialStatements: true,
        },
      }),
    );
  }

  const confirmedExtraction = {
    ...active.payload,
    confirmation: {
      isConfirmed: true,
      confirmedAt: deps.nowIsoUtc(),
      confirmedByUserId: request.confirmedByUserId,
    },
  } satisfies AnnualReportExtractionPayloadV1;
  if (!confirmedExtraction.engineMetadata && resolveRuntimeMetadataV1(deps)) {
    confirmedExtraction.engineMetadata = resolveRuntimeMetadataV1(deps);
  }
  confirmedExtraction.summary = recalculateSummaryV1(confirmedExtraction);

  const persisted =
    await deps.artifactRepository.appendAnnualReportExtractionAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.confirmedByUserId,
      extraction: confirmedExtraction,
    });
  if (!persisted.ok) {
    return parseConfirmAnnualReportExtractionResultV1(
      buildFailureV1({
        code:
          persisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: persisted.message,
        userMessage:
          "Annual report confirmation could not be saved due to a storage error.",
        context: {
          operation: "annual_report.confirm.persist",
        },
      }),
    );
  }

  const auditEvent = parseAuditEventV2({
    id: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType: "user",
    actorUserId: request.confirmedByUserId,
    eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_CONFIRMED,
    targetType: "annual_report_extraction_artifact",
    targetId: persisted.artifact.id,
    before: {
      artifactId: active.id,
      version: active.version,
    },
    after: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      confirmedByUserId: request.confirmedByUserId,
    },
    timestamp: deps.nowIsoUtc(),
    context: {},
  });
  await appendAuditEventBestEffortV1({
    deps,
    event: auditEvent,
  });

  return parseConfirmAnnualReportExtractionResultV1({
    ok: true,
    active: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      schemaVersion: persisted.artifact.schemaVersion,
    },
    extraction: persisted.artifact.payload,
    runtime: resolveRuntimeMetadataV1(deps),
  });
}

export async function clearAnnualReportDataV1(
  input: unknown,
  deps: AnnualReportExtractionDepsV1,
): Promise<ClearAnnualReportDataResultV1> {
  const parsedRequest = ClearAnnualReportDataRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseClearAnnualReportDataResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Annual report clear request payload is invalid.",
        userMessage:
          "The annual report clear request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseClearAnnualReportDataResultV1(
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

  if (deps.processingRunRepository) {
    const openRuns = await deps.processingRunRepository.listOpenByWorkspace({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    const cancelledAt = deps.nowIsoUtc();
    for (const run of openRuns) {
      await deps.processingRunRepository.save({
        ...run,
        status: "cancelled",
        technicalDetails: [
          ...run.technicalDetails,
          "Cancelled because the user cleared annual-report data.",
        ],
        updatedAt: cancelledAt,
        finishedAt: cancelledAt,
      });
    }

    if (openRuns.length > 0) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.clearedByUserId ? "user" : "system",
          actorUserId: request.clearedByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.PROCESSING_RUN_CANCELLED,
          targetType: "annual_report_processing_run",
          targetId: request.workspaceId,
          after: {
            cancelledRunIds: openRuns.map((run) => run.id),
          },
          timestamp: cancelledAt,
          context: {},
        }),
      });
    }
  }

  const clearResult = await deps.artifactRepository.clearActiveArtifacts({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    artifactTypes: ANNUAL_REPORT_CLEAR_ARTIFACT_TYPES_V1,
  });
  if (!clearResult.ok) {
    return parseClearAnnualReportDataResultV1(
      buildFailureV1({
        code:
          clearResult.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: clearResult.message,
        userMessage:
          "The current annual report data could not be cleared due to a storage error.",
        context: {
          operation: "annual_report.clear_active",
        },
      }),
    );
  }

  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: request.clearedByUserId ? "user" : "system",
      actorUserId: request.clearedByUserId,
      eventType: AUDIT_EVENT_TYPES_V1.EXTRACTION_ACTIVE_DATA_CLEARED,
      targetType: "workspace_active_artifacts",
      targetId: request.workspaceId,
      after: {
        clearedArtifactTypes: clearResult.clearedArtifactTypes,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  return parseClearAnnualReportDataResultV1({
    ok: true,
    clearedArtifactTypes: clearResult.clearedArtifactTypes,
    runtime: resolveRuntimeMetadataV1(deps),
  });
}
