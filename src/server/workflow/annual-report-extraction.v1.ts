import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import {
  type AnnualReportExtractionPayloadV1,
  ApplyAnnualReportExtractionOverridesRequestV1Schema,
  type ApplyAnnualReportExtractionOverridesResultV1,
  ConfirmAnnualReportExtractionRequestV1Schema,
  type ConfirmAnnualReportExtractionResultV1,
  type GetActiveAnnualReportExtractionResultV1,
  GetActiveAnnualReportExtractionResultV1Schema,
  RunAnnualReportExtractionRequestV1Schema,
  type RunAnnualReportExtractionResultV1,
  parseApplyAnnualReportExtractionOverridesResultV1,
  parseConfirmAnnualReportExtractionResultV1,
  parseRunAnnualReportExtractionResultV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import { parseAnnualReportExtractionV1 } from "../parsing/annual-report-extractor.v1";
import { MAX_ANNUAL_REPORT_FILE_BYTES_V1 } from "../security/payload-limits.v1";

export interface AnnualReportExtractionDepsV1 {
  artifactRepository: WorkspaceArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
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

function listMissingRequiredExtractionFieldsV1(
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

  const extractionResult = parseAnnualReportExtractionV1({
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
          extractionResult.extraction.summary.autoDetectedFieldCount,
        needsReviewFieldCount:
          extractionResult.extraction.summary.needsReviewFieldCount,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const writeResult =
    await deps.artifactRepository.appendAnnualReportExtractionAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
      extraction: extractionResult.extraction,
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

  const persisted =
    await deps.artifactRepository.appendAnnualReportExtractionAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.authorUserId,
      extraction: updatedExtraction,
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

  return parseApplyAnnualReportExtractionOverridesResultV1({
    ok: true,
    active: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      schemaVersion: persisted.artifact.schemaVersion,
    },
    extraction: persisted.artifact.payload,
    appliedCount: request.overrides.length,
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

  const confirmedExtraction = {
    ...active.payload,
    confirmation: {
      isConfirmed: true,
      confirmedAt: deps.nowIsoUtc(),
      confirmedByUserId: request.confirmedByUserId,
    },
  } satisfies AnnualReportExtractionPayloadV1;
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
  });
}
