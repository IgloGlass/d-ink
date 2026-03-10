import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { MappingPreferenceRepositoryV1 } from "../../db/repositories/mapping-preference.repository.v1";
import type { TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import type { ReconciliationResultPayloadV1 } from "../../shared/contracts/reconciliation.v1";
import {
  ExecuteTrialBalancePipelineRequestV1Schema,
  type ExecuteTrialBalancePipelineResultV1,
  parseExecuteTrialBalancePipelineResultV1,
} from "../../shared/contracts/tb-pipeline-run.v1";
import type { GenerateMappingDecisionsResultV1 } from "../../shared/contracts/mapping.v1";
import type { TrialBalanceNormalizedV1 } from "../../shared/contracts/trial-balance.v1";
import { generateDeterministicMappingDecisionsV1 } from "../mapping/deterministic-mapping.v1";
import { parseTrialBalanceFileV1 } from "../parsing/trial-balance-parser.v1";
import { validateTrialBalanceFileTypeCoherenceV1 } from "../security/file-type-coherence.v1";
import { MAX_TRIAL_BALANCE_FILE_BYTES_V1 } from "../security/payload-limits.v1";
import { evaluateTrialBalanceReconciliationV1 } from "../validation/trial-balance-reconciliation.v1";
import { applyMappingPreferencesToDecisionSetV1 } from "./mapping-override.v1";

/**
 * Dependencies required by the deterministic TB pipeline workflow.
 */
export interface TrialBalancePipelineRunDepsV1 {
  artifactRepository: TbPipelineArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  generateMappingDecisions?: (input: {
    tenantId: string;
    workspaceId: string;
    policyVersion: string;
    trialBalance: TrialBalanceNormalizedV1;
    reconciliation: ReconciliationResultPayloadV1;
  }) => Promise<GenerateMappingDecisionsResultV1>;
  mappingPreferenceRepository: MappingPreferenceRepositoryV1;
  workspaceArtifactRepository?: WorkspaceArtifactRepositoryV1;
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

function buildAuditActorFieldsV1(createdByUserId?: string): {
  actorType: "system" | "user";
  actorUserId?: string;
} {
  if (createdByUserId) {
    return {
      actorType: "user",
      actorUserId: createdByUserId,
    };
  }

  return {
    actorType: "system",
  };
}

async function appendAuditEventBestEffortV1(input: {
  deps: TrialBalancePipelineRunDepsV1;
  event: ReturnType<typeof parseAuditEventV2>;
}): Promise<void> {
  const appendResult = await input.deps.auditRepository.append(input.event);
  if (!appendResult.ok) {
    // Pipeline artifacts remain source of truth; audit append is best-effort.
  }
}

/**
 * Runs the deterministic TB pipeline and persists immutable artifacts per step.
 *
 * Safety boundary:
 * - Parser, reconciliation, and mapping remain deterministic and AI-free.
 * - Mapping is strictly blocked if reconciliation cannot proceed.
 */
export async function executeTrialBalancePipelineRunV1(
  input: unknown,
  deps: TrialBalancePipelineRunDepsV1,
): Promise<ExecuteTrialBalancePipelineResultV1> {
  const parsedRequest =
    ExecuteTrialBalancePipelineRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "TB pipeline request payload is invalid.",
        user_message: "The uploaded payload is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      },
    });
  }

  const request = parsedRequest.data;
  const actorFields = buildAuditActorFieldsV1(request.createdByUserId);
  const fileBytes = decodeBase64ToUint8ArrayV1(request.fileBytesBase64);
  if (!fileBytes || fileBytes.byteLength === 0) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "fileBytesBase64 could not be decoded into non-empty file bytes.",
        user_message:
          "The uploaded file bytes are invalid. Upload the file again.",
        context: {
          fileName: request.fileName,
        },
      },
    });
  }
  if (fileBytes.byteLength > MAX_TRIAL_BALANCE_FILE_BYTES_V1) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Decoded trial balance file exceeds configured size limit.",
        user_message:
          "The trial balance file is too large for V1 processing limits.",
        context: {
          reason: "payload_too_large",
          maxBytes: MAX_TRIAL_BALANCE_FILE_BYTES_V1,
          actualBytes: fileBytes.byteLength,
          fileName: request.fileName,
        },
      },
    });
  }
  const fileTypeCoherenceFailure = validateTrialBalanceFileTypeCoherenceV1({
    fileName: request.fileName,
    fileType: request.fileType,
    fileBytes,
  });
  if (fileTypeCoherenceFailure) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "Trial balance file content does not match declared or inferred file type.",
        user_message:
          "The uploaded trial balance file type does not match its content.",
        context: fileTypeCoherenceFailure,
      },
    });
  }

  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      ...actorFields,
      eventType: AUDIT_EVENT_TYPES_V1.FILE_UPLOADED,
      targetType: "trial_balance_file",
      targetId: request.fileName,
      after: {
        fileName: request.fileName,
        fileType: request.fileType ?? null,
        decodedBytes: fileBytes.byteLength,
        module: "trial_balance_pipeline",
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const parseResult = parseTrialBalanceFileV1({
    fileName: request.fileName,
    fileType: request.fileType,
    fileBytes,
  });
  if (!parseResult.ok) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        ...actorFields,
        eventType: AUDIT_EVENT_TYPES_V1.PARSE_FAILED,
        targetType: "trial_balance_file",
        targetId: request.fileName,
        after: {
          fileName: request.fileName,
          errorCode: parseResult.error.code,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: parseResult.error.message,
        user_message: parseResult.error.user_message,
        context: {
          parserError: parseResult.error,
        },
      },
    });
  }
  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      ...actorFields,
      eventType: AUDIT_EVENT_TYPES_V1.PARSE_SUCCEEDED,
      targetType: "trial_balance_artifact",
      targetId: parseResult.trialBalance.schemaVersion,
      after: {
        selectedSheetName: parseResult.trialBalance.selectedSheetName,
        rowCount: parseResult.trialBalance.rows.length,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const trialBalancePersisted =
    await deps.artifactRepository.appendTrialBalanceAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
      trialBalance: parseResult.trialBalance,
    });
  if (!trialBalancePersisted.ok) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code:
          trialBalancePersisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: trialBalancePersisted.message,
        user_message:
          trialBalancePersisted.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The trial balance could not be saved due to a storage error.",
        context: {
          step: "trial_balance_persist",
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  const reconciliationResult = evaluateTrialBalanceReconciliationV1({
    trialBalance: parseResult.trialBalance,
  });
  if (!reconciliationResult.ok) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        ...actorFields,
        eventType: AUDIT_EVENT_TYPES_V1.RECONCILIATION_RESULT_RECORDED,
        targetType: "reconciliation_run",
        targetId: request.workspaceId,
        after: {
          status: "error",
          errorMessage: reconciliationResult.error.message,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_FAILED",
        message: reconciliationResult.error.message,
        user_message: reconciliationResult.error.user_message,
        context: {
          reconciliationError: reconciliationResult.error,
        },
      },
    });
  }
  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      ...actorFields,
      eventType: AUDIT_EVENT_TYPES_V1.RECONCILIATION_RESULT_RECORDED,
      targetType: "reconciliation_result",
      targetId: request.workspaceId,
      after: {
        status: reconciliationResult.reconciliation.status,
        canProceedToMapping:
          reconciliationResult.reconciliation.canProceedToMapping,
        blockingReasonCodes:
          reconciliationResult.reconciliation.blockingReasonCodes,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  const reconciliationPersisted =
    await deps.artifactRepository.appendReconciliationAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
      reconciliation: reconciliationResult.reconciliation,
    });
  if (!reconciliationPersisted.ok) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code:
          reconciliationPersisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: reconciliationPersisted.message,
        user_message:
          reconciliationPersisted.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The reconciliation result could not be saved due to a storage error.",
        context: {
          step: "reconciliation_persist",
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  if (!reconciliationResult.reconciliation.canProceedToMapping) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message:
          "Mapping is blocked because deterministic reconciliation did not pass.",
        user_message:
          "Reconciliation failed. Fix blocking issues before mapping.",
        context: {
          reconciliationStatus: reconciliationResult.reconciliation.status,
          blockingReasonCodes:
            reconciliationResult.reconciliation.blockingReasonCodes,
          artifacts: {
            trialBalance: {
              artifactId: trialBalancePersisted.artifact.id,
              version: trialBalancePersisted.artifact.version,
            },
            reconciliation: {
              artifactId: reconciliationPersisted.artifact.id,
              version: reconciliationPersisted.artifact.version,
            },
          },
        },
      },
    });
  }

  const mappingResult = deps.generateMappingDecisions
    ? await deps.generateMappingDecisions({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        trialBalance: parseResult.trialBalance,
        reconciliation: reconciliationResult.reconciliation,
        policyVersion: request.policyVersion,
      })
    : generateDeterministicMappingDecisionsV1({
        trialBalance: parseResult.trialBalance,
        reconciliation: reconciliationResult.reconciliation,
        policyVersion: request.policyVersion,
      });
  if (!mappingResult.ok) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code:
          mappingResult.error.code === "RECONCILIATION_BLOCKED"
            ? "RECONCILIATION_BLOCKED"
            : "MAPPING_FAILED",
        message: mappingResult.error.message,
        user_message: mappingResult.error.user_message,
        context: {
          mappingError: mappingResult.error,
        },
      },
    });
  }

  const preferenceLookupRows = mappingResult.mapping.decisions.map(
    (decision) => ({
      sourceAccountNumber: decision.sourceAccountNumber,
      statementType: decision.proposedCategory.statementType,
    }),
  );
  const applicablePreferences =
    await deps.mappingPreferenceRepository.findApplicableForRows({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      userId: request.createdByUserId,
      rows: preferenceLookupRows,
    });
  if (!applicablePreferences.ok) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code: "PERSISTENCE_ERROR",
        message: applicablePreferences.message,
        user_message:
          "Stored mapping preferences could not be loaded due to a storage error.",
        context: {
          step: "mapping_preference_lookup",
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  const mappingWithPreferences = applyMappingPreferencesToDecisionSetV1({
    mapping: mappingResult.mapping,
    preferences: applicablePreferences.preferences,
    authorUserId: request.createdByUserId,
  });

  const mappingPersisted =
    await deps.artifactRepository.appendMappingAndSetActive({
      artifactId: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
      mapping: mappingWithPreferences.mapping,
    });
  if (!mappingPersisted.ok) {
    return parseExecuteTrialBalancePipelineResultV1({
      ok: false,
      error: {
        code:
          mappingPersisted.code === "WORKSPACE_NOT_FOUND"
            ? "WORKSPACE_NOT_FOUND"
            : "PERSISTENCE_ERROR",
        message: mappingPersisted.message,
        user_message:
          mappingPersisted.code === "WORKSPACE_NOT_FOUND"
            ? "Workspace could not be found."
            : "The mapping result could not be saved due to a storage error.",
        context: {
          step: "mapping_persist",
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  await appendAuditEventBestEffortV1({
    deps,
    event: parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      ...actorFields,
      eventType: AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED,
      targetType: "mapping_artifact",
      targetId: mappingPersisted.artifact.id,
      after: {
        artifactId: mappingPersisted.artifact.id,
        version: mappingPersisted.artifact.version,
        decisionCount: mappingPersisted.artifact.payload.decisions.length,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    }),
  });

  if (mappingPersisted.artifact.version > 1) {
    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        ...actorFields,
        eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
        targetType: "pipeline_module",
        targetId: "trial_balance_pipeline",
        before: {
          mappingVersion: mappingPersisted.artifact.version - 1,
        },
        after: {
          mappingVersion: mappingPersisted.artifact.version,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });
  }

  if (mappingWithPreferences.appliedCount > 0) {
    const autoAppliedEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      ...actorFields,
      eventType: AUDIT_EVENT_TYPES_V1.MAPPING_PREFERENCES_AUTO_APPLIED,
      targetType: "mapping_artifact",
      targetId: mappingPersisted.artifact.id,
      after: {
        artifactId: mappingPersisted.artifact.id,
        version: mappingPersisted.artifact.version,
        appliedCount: mappingWithPreferences.appliedCount,
        appliedPreferenceCount: mappingWithPreferences.appliedPreferenceCount,
      },
      timestamp: deps.nowIsoUtc(),
      context: {},
    });

    const autoAppliedAuditWrite =
      await deps.auditRepository.append(autoAppliedEvent);
    if (!autoAppliedAuditWrite.ok) {
      // Pipeline artifacts are already committed; audit append is best-effort.
    }
  }

  return parseExecuteTrialBalancePipelineResultV1({
    ok: true,
    pipeline: {
      schemaVersion: "tb_pipeline_run_result_v1",
      policyVersion: request.policyVersion,
      artifacts: {
        trialBalance: {
          artifactType: "trial_balance",
          artifactId: trialBalancePersisted.artifact.id,
          version: trialBalancePersisted.artifact.version,
          schemaVersion: trialBalancePersisted.artifact.schemaVersion,
        },
        reconciliation: {
          artifactType: "reconciliation",
          artifactId: reconciliationPersisted.artifact.id,
          version: reconciliationPersisted.artifact.version,
          schemaVersion: reconciliationPersisted.artifact.schemaVersion,
        },
        mapping: {
          artifactType: "mapping",
          artifactId: mappingPersisted.artifact.id,
          version: mappingPersisted.artifact.version,
          schemaVersion: mappingPersisted.artifact.schemaVersion,
        },
      },
      trialBalance: parseResult.trialBalance,
      reconciliation: reconciliationResult.reconciliation,
      mapping: mappingWithPreferences.mapping,
    },
  });
}
