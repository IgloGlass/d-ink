import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { MappingPreferenceRepositoryV1 } from "../../db/repositories/mapping-preference.repository.v1";
import type { TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import type {
  WorkspaceArtifactRepositoryV1,
  WorkspaceArtifactTypeV1,
} from "../../db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  type MappingAiEnrichmentErrorCodeV1,
  RunMappingAiEnrichmentRequestV1Schema,
  type RunMappingAiEnrichmentResultV1,
  parseRunMappingAiEnrichmentResultV1,
} from "../../shared/contracts/mapping-ai-enrichment.v1";
import type { GenerateMappingDecisionsResultV1 } from "../../shared/contracts/mapping.v1";
import type {
  GenerateMappingDecisionsRequestV2,
  MappingDecisionSetArtifactV1,
} from "../../shared/contracts/mapping.v1";
import {
  type TrialBalanceNormalizedArtifactV1,
  getTrialBalanceRowBalanceValueV1,
  listAvailableTrialBalanceBalanceColumnsV1,
  parseTrialBalanceNormalizedV1,
} from "../../shared/contracts/trial-balance.v1";
import { applyMappingPreferencesToDecisionSetV1 } from "./mapping-override.v1";

export interface MappingAiEnrichmentDepsV1 {
  artifactRepository: TbPipelineArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  mappingPreferenceRepository: MappingPreferenceRepositoryV1;
  workspaceArtifactRepository: WorkspaceArtifactRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
  buildMappingRequest: (input: {
    policyVersion: string;
    reconciliation: GenerateMappingDecisionsRequestV2["reconciliation"];
    tenantId: string;
    trialBalance: GenerateMappingDecisionsRequestV2["trialBalance"];
    workspaceId: string;
  }) => Promise<GenerateMappingDecisionsRequestV2>;
  generateAiMapping: (input: {
    request: GenerateMappingDecisionsRequestV2;
  }) => Promise<GenerateMappingDecisionsResultV1>;
  generateId: () => string;
  nowIsoUtc: () => string;
}

export type MappingAiEnrichmentActorContextV1 = {
  actorUserId: string;
};

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
  code: MappingAiEnrichmentErrorCodeV1;
  context: Record<string, unknown>;
  message: string;
  userMessage: string;
}): RunMappingAiEnrichmentResultV1 {
  return parseRunMappingAiEnrichmentResultV1({
    ok: false,
    error: {
      code: input.code,
      message: input.message,
      user_message: input.userMessage,
      context: input.context,
    },
  });
}

function buildActiveMappingRefV1(input: {
  artifactId: string;
  schemaVersion: string;
  version: number;
}) {
  return {
    artifactId: input.artifactId,
    version: input.version,
    schemaVersion: input.schemaVersion,
  };
}

const MAPPING_DEPENDENT_WORKSPACE_ARTIFACT_TYPES_V1: WorkspaceArtifactTypeV1[] =
  ["tax_adjustments", "tax_summary", "ink2_form", "export_package"];

function normalizeTrialBalanceTotalsV1(
  trialBalance: TrialBalanceNormalizedArtifactV1,
): TrialBalanceNormalizedArtifactV1 {
  const openingBalanceAvailable =
    listAvailableTrialBalanceBalanceColumnsV1(trialBalance).includes(
      "opening_balance",
    );
  const closingBalanceAvailable =
    listAvailableTrialBalanceBalanceColumnsV1(trialBalance).includes(
      "closing_balance",
    );
  const openingBalanceTotal = openingBalanceAvailable
    ? trialBalance.rows.reduce(
        (total, row) =>
          total +
          (getTrialBalanceRowBalanceValueV1(row, "opening_balance") ?? 0),
        0,
      )
    : null;
  const closingBalanceTotal = closingBalanceAvailable
    ? trialBalance.rows.reduce(
        (total, row) =>
          total +
          (getTrialBalanceRowBalanceValueV1(row, "closing_balance") ?? 0),
        0,
      )
    : null;

  if (trialBalance.schemaVersion === "trial_balance_normalized_v2") {
    return parseTrialBalanceNormalizedV1({
      ...trialBalance,
      verification: {
        ...trialBalance.verification,
        candidateRows: trialBalance.rows.length,
        normalizedRows: trialBalance.rows.length,
        rejectedRows: 0,
        duplicateAccountNumberGroups: 0,
        openingBalanceTotal,
        closingBalanceTotal,
      },
    });
  }

  return parseTrialBalanceNormalizedV1({
    ...trialBalance,
    verification: {
      ...trialBalance.verification,
      candidateRows: trialBalance.rows.length,
      normalizedRows: trialBalance.rows.length,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: openingBalanceTotal ?? 0,
      closingBalanceTotal: closingBalanceTotal ?? 0,
    },
  });
}

async function clearMappingDependentsV1(input: {
  deps: MappingAiEnrichmentDepsV1;
  tenantId: string;
  workspaceId: string;
  actorUserId: string;
  reason: "mapping_replaced";
}): Promise<
  | { ok: true; clearedArtifactTypes: WorkspaceArtifactTypeV1[] }
  | {
      ok: false;
      code: "WORKSPACE_NOT_FOUND" | "PERSISTENCE_ERROR";
      message: string;
    }
> {
  const clearResult =
    await input.deps.workspaceArtifactRepository.clearActiveArtifacts({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      artifactTypes: MAPPING_DEPENDENT_WORKSPACE_ARTIFACT_TYPES_V1,
    });
  if (!clearResult.ok) {
    return clearResult;
  }

  if (clearResult.clearedArtifactTypes.length > 0) {
    const auditEvent = parseAuditEventV2({
      id: input.deps.generateId(),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorType: "user",
      actorUserId: input.actorUserId,
      eventType: AUDIT_EVENT_TYPES_V1.MAPPING_ACTIVE_DEPENDENTS_CLEARED,
      targetType: "workspace_active_artifacts",
      targetId: input.workspaceId,
      after: {
        clearedArtifactTypes: clearResult.clearedArtifactTypes,
        reason: input.reason,
      },
      timestamp: input.deps.nowIsoUtc(),
      context: {},
    });
    const auditWrite = await input.deps.auditRepository.append(auditEvent);
    if (!auditWrite.ok) {
      // Updated mapping artifacts remain the source of truth if audit append fails.
    }
  }

  return clearResult;
}

/**
 * Re-runs AI account mapping against the active trial balance and replaces the
 * active mapping artifact only if the expected mapping is still current.
 */
export async function runMappingAiEnrichmentV1(
  input: unknown,
  actor: MappingAiEnrichmentActorContextV1,
  deps: MappingAiEnrichmentDepsV1,
): Promise<RunMappingAiEnrichmentResultV1> {
  const parsedRequest = RunMappingAiEnrichmentRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return buildFailureV1({
      code: "INPUT_INVALID",
      message: "Mapping AI enrichment request payload is invalid.",
      userMessage:
        "The mapping enrichment request is invalid. Refresh and retry.",
      context: buildErrorContextFromZod(parsedRequest.error),
    });
  }

  const request = parsedRequest.data;
  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return buildFailureV1({
      code: "WORKSPACE_NOT_FOUND",
      message: "Workspace does not exist for tenant and workspace ID.",
      userMessage: "Workspace could not be found.",
      context: {
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      },
    });
  }

  const activeMapping = await deps.artifactRepository.getActiveMapping({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!activeMapping) {
    return buildFailureV1({
      code: "MAPPING_NOT_FOUND",
      message: "No active mapping artifact exists for this workspace.",
      userMessage: "No active mapping was found for this workspace.",
      context: {
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      },
    });
  }

  const activeBefore = buildActiveMappingRefV1({
    artifactId: activeMapping.id,
    version: activeMapping.version,
    schemaVersion: activeMapping.schemaVersion,
  });
  if (
    activeMapping.id !== request.expectedActiveMapping.artifactId ||
    activeMapping.version !== request.expectedActiveMapping.version
  ) {
    return parseRunMappingAiEnrichmentResultV1({
      ok: true,
      status: "stale_skipped",
      activeBefore,
      activeAfter: activeBefore,
      message:
        "Active mapping changed before AI account mapping started, so no replacement was applied.",
    });
  }

  const activeTrialBalance =
    await deps.artifactRepository.getActiveTrialBalance({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
  if (!activeTrialBalance) {
    return buildFailureV1({
      code: "TRIAL_BALANCE_NOT_FOUND",
      message: "No active trial-balance artifact exists for this workspace.",
      userMessage:
        "No active trial balance was found. Import a trial balance first.",
      context: {
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      },
    });
  }

  const activeReconciliation =
    await deps.artifactRepository.getActiveReconciliation({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
  if (!activeReconciliation) {
    return buildFailureV1({
      code: "RECONCILIATION_NOT_FOUND",
      message: "No active reconciliation artifact exists for this workspace.",
      userMessage:
        "No reconciliation result was found. Import a trial balance first.",
      context: {
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      },
    });
  }

  if (!activeReconciliation.payload.canProceedToMapping) {
    return buildFailureV1({
      code: "RECONCILIATION_BLOCKED",
      message:
        "AI account mapping is blocked because reconciliation cannot proceed to mapping.",
      userMessage:
        "Reconciliation is blocked. Fix reconciliation issues before rerunning AI mapping.",
      context: {
        reconciliationStatus: activeReconciliation.payload.status,
        blockingReasonCodes: activeReconciliation.payload.blockingReasonCodes,
      },
    });
  }

  const mappingRequest = await deps.buildMappingRequest({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    policyVersion: activeMapping.payload.policyVersion,
    trialBalance: normalizeTrialBalanceTotalsV1(activeTrialBalance.payload),
    reconciliation: activeReconciliation.payload,
  });
  const aiResult = await deps.generateAiMapping({
    request: mappingRequest,
  });
  if (
    !aiResult.ok ||
    aiResult.mapping.executionMetadata?.actualStrategy !== "ai"
  ) {
    return parseRunMappingAiEnrichmentResultV1({
      ok: true,
      status: "no_change",
      activeBefore,
      activeAfter: activeBefore,
      message: aiResult.ok
        ? "AI account mapping completed without producing a replaceable AI mapping."
        : "AI account mapping did not complete, so the current mapping remains active.",
    });
  }

  const applicablePreferences =
    await deps.mappingPreferenceRepository.findApplicableForRows({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      userId: actor.actorUserId,
      rows: aiResult.mapping.decisions.map((decision) => ({
        sourceAccountNumber: decision.sourceAccountNumber,
        statementType: decision.proposedCategory.statementType,
      })),
    });
  if (!applicablePreferences.ok) {
    return buildFailureV1({
      code: "PERSISTENCE_ERROR",
      message: applicablePreferences.message,
      userMessage:
        "Stored mapping preferences could not be loaded during AI account mapping.",
      context: {
        step: "mapping_preference_lookup",
        workspaceId: request.workspaceId,
      },
    });
  }

  const mappingWithPreferences = applyMappingPreferencesToDecisionSetV1({
    mapping: aiResult.mapping,
    preferences: applicablePreferences.preferences,
    authorUserId: actor.actorUserId,
  });

  const latestActiveMapping = await deps.artifactRepository.getActiveMapping({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (
    !latestActiveMapping ||
    latestActiveMapping.id !== request.expectedActiveMapping.artifactId ||
    latestActiveMapping.version !== request.expectedActiveMapping.version
  ) {
    const activeAfterConflict = latestActiveMapping
      ? buildActiveMappingRefV1({
          artifactId: latestActiveMapping.id,
          version: latestActiveMapping.version,
          schemaVersion: latestActiveMapping.schemaVersion,
        })
      : activeBefore;

    return parseRunMappingAiEnrichmentResultV1({
      ok: true,
      status: "stale_skipped",
      activeBefore,
      activeAfter: activeAfterConflict,
      message:
        "Active mapping changed before AI account mapping could be saved, so no replacement was applied.",
    });
  }

  const persisted = await deps.artifactRepository.appendMappingAndSetActive({
    artifactId: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    createdAt: deps.nowIsoUtc(),
    createdByUserId: actor.actorUserId,
    mapping: mappingWithPreferences.mapping,
  });
  if (!persisted.ok) {
    return buildFailureV1({
      code: "PERSISTENCE_ERROR",
      message: persisted.message,
      userMessage:
        "The AI account mapping could not be saved due to a storage error.",
      context: {
        workspaceId: request.workspaceId,
        step: "mapping_persist",
      },
    });
  }

  const clearDependentsResult = await clearMappingDependentsV1({
    deps,
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorUserId: actor.actorUserId,
    reason: "mapping_replaced",
  });
  if (!clearDependentsResult.ok) {
    return buildFailureV1({
      code: "PERSISTENCE_ERROR",
      message: clearDependentsResult.message,
      userMessage:
        "The updated account mapping could not clear downstream workspace data.",
      context: {
        workspaceId: request.workspaceId,
        step: "mapping_clear_dependents",
      },
    });
  }

  const auditEvent = parseAuditEventV2({
    id: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType: "user",
    actorUserId: actor.actorUserId,
    eventType: AUDIT_EVENT_TYPES_V1.MAPPING_GENERATED,
    targetType: "mapping_artifact",
    targetId: persisted.artifact.id,
    before: {
      activeMappingArtifactId: activeMapping.id,
      activeMappingVersion: activeMapping.version,
      executionMetadata: activeMapping.payload.executionMetadata,
    },
    after: {
      artifactId: persisted.artifact.id,
      version: persisted.artifact.version,
      executionMetadata: persisted.artifact.payload.executionMetadata,
      decisionCount: persisted.artifact.payload.decisions.length,
      appliedPreferenceCount: mappingWithPreferences.appliedPreferenceCount,
      trigger: "manual_ai_rerun",
    },
    modelRunId: persisted.artifact.payload.aiRun?.runId,
    timestamp: deps.nowIsoUtc(),
    context: {},
  });
  const auditWrite = await deps.auditRepository.append(auditEvent);
  if (!auditWrite.ok) {
    // Persisted mapping artifacts remain the source of truth if audit append fails.
  }

  const activeAfter = buildActiveMappingRefV1({
    artifactId: persisted.artifact.id,
    version: persisted.artifact.version,
    schemaVersion: persisted.artifact.schemaVersion,
  });

  return parseRunMappingAiEnrichmentResultV1({
    ok: true,
    status: "updated",
    activeBefore,
    activeAfter,
    mapping: persisted.artifact.payload,
    message:
      "AI account mapping completed and replaced the previous active mapping.",
  });
}
