import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type {
  MappingPreferenceRecordV1,
  MappingPreferenceRepositoryV1,
  MappingPreferenceUpsertEntryV1,
} from "../../db/repositories/mapping-preference.repository.v1";
import type { TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  ApplyMappingOverridesRequestV1Schema,
  type ApplyMappingOverridesResultV1,
  GetActiveMappingDecisionsRequestV1Schema,
  type GetActiveMappingDecisionsResultV1,
  type MappingOverrideFailureV1,
  type MappingOverrideInstructionV1,
  type MappingPreferenceScopeV1,
  parseApplyMappingOverridesResultV1,
  parseGetActiveMappingDecisionsResultV1,
} from "../../shared/contracts/mapping-override.v1";
import {
  type MappingDecisionRecordV1,
  type MappingDecisionSetArtifactV1,
  type MappingDecisionSummaryV1,
  type MappingDecisionV2,
  type SilverfinTaxCategoryCodeV1,
  getSilverfinTaxCategoryByCodeV1,
  parseMappingDecisionRecordV1,
} from "../../shared/contracts/mapping.v1";

/**
 * Dependencies required by mapping override + preference workflows.
 */
export interface MappingOverrideDepsV1 {
  artifactRepository: TbPipelineArtifactRepositoryV1;
  auditRepository: AuditRepositoryV1;
  mappingPreferenceRepository: MappingPreferenceRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
  generateId: () => string;
  nowIsoUtc: () => string;
}

/**
 * Actor context for user-initiated mapping overrides.
 */
export type MappingOverrideActorContextV1 = {
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
  code: MappingOverrideFailureV1["error"]["code"];
  context: Record<string, unknown>;
  message: string;
  userMessage: string;
}): MappingOverrideFailureV1 {
  return {
    ok: false,
    error: {
      code: input.code,
      message: input.message,
      user_message: input.userMessage,
      context: input.context,
    },
  };
}

function normalizePreferenceKeyV1(input: {
  sourceAccountNumber: string;
  statementType: "balance_sheet" | "income_statement";
}): string {
  return `${input.sourceAccountNumber.trim()}|${input.statementType}`;
}

function mapOverrideToPreferenceEntryV1(input: {
  decision: MappingDecisionRecordV1;
  override: MappingOverrideInstructionV1;
  workspaceId: string;
  actorUserId: string;
}): MappingPreferenceUpsertEntryV1 {
  const baseEntry = {
    sourceAccountNumber: input.decision.sourceAccountNumber,
    statementType: input.decision.proposedCategory.statementType,
    selectedCategoryCode: input.override.selectedCategoryCode,
    reason: input.override.reason,
  };

  if (input.override.scope === "return") {
    return {
      ...baseEntry,
      scope: "return",
      workspaceId: input.workspaceId,
    };
  }

  return {
    ...baseEntry,
    scope: "user",
    userId: input.actorUserId,
  };
}

function dedupePreferenceEntriesV1(
  entries: MappingPreferenceUpsertEntryV1[],
): MappingPreferenceUpsertEntryV1[] {
  const deduped = new Map<string, MappingPreferenceUpsertEntryV1>();
  for (const entry of entries) {
    const scopeKey =
      entry.scope === "return"
        ? `${entry.scope}|${entry.workspaceId}`
        : `${entry.scope}|${entry.userId}`;
    const key = `${scopeKey}|${normalizePreferenceKeyV1({
      sourceAccountNumber: entry.sourceAccountNumber,
      statementType: entry.statementType,
    })}`;
    deduped.set(key, entry);
  }

  return [...deduped.values()];
}

function appendManualEvidenceV1(input: {
  decision: MappingDecisionRecordV1;
  evidenceReference: string;
  reason: string;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
}): MappingDecisionRecordV1["evidence"] {
  return [
    ...input.decision.evidence,
    {
      type: "manual_note",
      reference: input.evidenceReference,
      snippet: input.reason,
      matchedValue: input.selectedCategoryCode,
    },
  ];
}

function applyManualSelectionToDecisionV1(input: {
  decision: MappingDecisionRecordV1;
  scope: MappingPreferenceScopeV1;
  reason: string;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
  authorUserId?: string;
  evidenceReference: string;
}): MappingDecisionRecordV1 {
  const selectedCategory = getSilverfinTaxCategoryByCodeV1(
    input.selectedCategoryCode,
  );
  if (
    selectedCategory.statementType !==
    input.decision.proposedCategory.statementType
  ) {
    throw new Error(
      "Selected category statement type does not match mapping decision statement type.",
    );
  }

  return parseMappingDecisionRecordV1({
    ...input.decision,
    selectedCategory,
    reviewFlag: false,
    status: "overridden",
    source: "manual",
    override: {
      scope: input.scope,
      reason: input.reason,
      author: input.authorUserId,
    },
    evidence: appendManualEvidenceV1({
      decision: input.decision,
      evidenceReference: input.evidenceReference,
      reason: input.reason,
      selectedCategoryCode: input.selectedCategoryCode,
    }),
  });
}

/**
 * Recomputes mapping summary counters from decision evidence and states.
 */
export function recomputeMappingDecisionSummaryV1(
  decisions: MappingDecisionRecordV1[],
): MappingDecisionSummaryV1 {
  const fallbackDecisions = decisions.filter((decision) =>
    decision.policyRuleReference.startsWith("mapping.ai.fallback.") ||
    decision.evidence.some((evidence) => evidence.type === "fallback_category"),
  ).length;

  const matchedByAccountNumber = decisions.filter((decision) =>
    decision.evidence.some(
      (evidence) =>
        evidence.type === "account_number_exact" ||
        evidence.type === "account_number_prefix",
    ),
  ).length;

  const matchedByAccountName = decisions.filter((decision) =>
    decision.evidence.some(
      (evidence) => evidence.type === "account_name_keyword",
    ),
  ).length;

  return {
    totalRows: decisions.length,
    deterministicDecisions: decisions.filter(
      (decision) => decision.source === "deterministic",
    ).length,
    manualReviewRequired: decisions.filter((decision) => decision.reviewFlag)
      .length,
    fallbackDecisions,
    matchedByAccountNumber,
    matchedByAccountName,
    unmatchedRows: fallbackDecisions,
  };
}

/**
 * Applies persisted preferences to an existing mapping decision set.
 *
 * Safety boundary:
 * - Preference matching is exact by `sourceAccountNumber + statementType`.
 * - This workflow mutates selection only; it never re-runs mapping generation.
 */
export function applyMappingPreferencesToDecisionSetV1(input: {
  mapping: MappingDecisionSetArtifactV1;
  preferences: MappingPreferenceRecordV1[];
  authorUserId?: string;
}): {
  appliedCount: number;
  appliedPreferenceCount: number;
  mapping: MappingDecisionSetArtifactV1;
} {
  const preferenceByKey = new Map<string, MappingPreferenceRecordV1>();
  for (const preference of input.preferences) {
    const key = normalizePreferenceKeyV1({
      sourceAccountNumber: preference.sourceAccountNumber,
      statementType: preference.statementType,
    });
    preferenceByKey.set(key, preference);
  }

  const appliedPreferenceKeys = new Set<string>();
  let appliedCount = 0;

  const nextDecisions = input.mapping.decisions.map((decision) => {
    const decisionKey = normalizePreferenceKeyV1({
      sourceAccountNumber: decision.sourceAccountNumber,
      statementType: decision.proposedCategory.statementType,
    });
    const preference = preferenceByKey.get(decisionKey);
    if (!preference) {
      return decision;
    }

    const selectedCategory = getSilverfinTaxCategoryByCodeV1(
      preference.selectedCategoryCode,
    );
    if (
      selectedCategory.statementType !== decision.proposedCategory.statementType
    ) {
      return decision;
    }

    appliedCount += 1;
    appliedPreferenceKeys.add(decisionKey);
    return applyManualSelectionToDecisionV1({
      decision,
      scope: preference.scope,
      reason: preference.reason,
      selectedCategoryCode: preference.selectedCategoryCode,
      authorUserId: input.authorUserId ?? preference.updatedByUserId,
      evidenceReference: "mapping.preference.auto_apply.v1",
    });
  });

  const nextSummary = recomputeMappingDecisionSummaryV1(nextDecisions);

  return {
    appliedCount,
    appliedPreferenceCount: appliedPreferenceKeys.size,
    mapping:
      input.mapping.schemaVersion === "mapping_decisions_v2"
        ? ({
            ...input.mapping,
            summary: nextSummary,
            decisions: nextDecisions as MappingDecisionV2[],
          } as MappingDecisionSetArtifactV1)
        : ({
            ...input.mapping,
            summary: nextSummary,
            decisions: nextDecisions,
          } as MappingDecisionSetArtifactV1),
  };
}

/**
 * Reads the active mapping decision artifact for a workspace.
 */
export async function getActiveMappingDecisionsV1(
  input: unknown,
  deps: MappingOverrideDepsV1,
): Promise<GetActiveMappingDecisionsResultV1> {
  const parsedRequest =
    GetActiveMappingDecisionsRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseGetActiveMappingDecisionsResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Active mapping request payload is invalid.",
        userMessage:
          "The active mapping request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }

  const request = parsedRequest.data;

  try {
    const workspace = await deps.workspaceRepository.getById({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!workspace) {
      return parseGetActiveMappingDecisionsResultV1(
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

    const activeMapping = await deps.artifactRepository.getActiveMapping({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!activeMapping) {
      return parseGetActiveMappingDecisionsResultV1(
        buildFailureV1({
          code: "MAPPING_NOT_FOUND",
          message: "No active mapping artifact exists for this workspace.",
          userMessage: "No active mapping was found for this workspace.",
          context: {
            tenantId: request.tenantId,
            workspaceId: request.workspaceId,
          },
        }),
      );
    }

    return parseGetActiveMappingDecisionsResultV1({
      ok: true,
      active: {
        artifactId: activeMapping.id,
        version: activeMapping.version,
        schemaVersion: activeMapping.schemaVersion,
      },
      mapping: activeMapping.payload,
    });
  } catch (error) {
    return parseGetActiveMappingDecisionsResultV1(
      buildFailureV1({
        code: "PERSISTENCE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error.",
        userMessage:
          "The active mapping could not be loaded due to a storage error.",
        context: {
          operation: "mapping.getActive",
        },
      }),
    );
  }
}

/**
 * Applies batch overrides to the active mapping artifact and persists preferences.
 */
export async function applyMappingOverridesV1(
  input: unknown,
  actor: MappingOverrideActorContextV1,
  deps: MappingOverrideDepsV1,
): Promise<ApplyMappingOverridesResultV1> {
  const parsedRequest = ApplyMappingOverridesRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseApplyMappingOverridesResultV1(
      buildFailureV1({
        code: "INPUT_INVALID",
        message: "Mapping override request payload is invalid.",
        userMessage: "The override request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }

  const request = parsedRequest.data;

  try {
    const workspace = await deps.workspaceRepository.getById({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!workspace) {
      return parseApplyMappingOverridesResultV1(
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

    const activeMapping = await deps.artifactRepository.getActiveMapping({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!activeMapping) {
      return parseApplyMappingOverridesResultV1(
        buildFailureV1({
          code: "MAPPING_NOT_FOUND",
          message: "No active mapping artifact exists for this workspace.",
          userMessage: "No active mapping was found for this workspace.",
          context: {
            tenantId: request.tenantId,
            workspaceId: request.workspaceId,
          },
        }),
      );
    }

    if (
      activeMapping.id !== request.expectedActiveMapping.artifactId ||
      activeMapping.version !== request.expectedActiveMapping.version
    ) {
      return parseApplyMappingOverridesResultV1(
        buildFailureV1({
          code: "STATE_CONFLICT",
          message:
            "Active mapping artifact/version differs from expected compare-and-set values.",
          userMessage:
            "Mapping changed before your overrides were applied. Refresh and retry.",
          context: {
            expectedActiveMapping: request.expectedActiveMapping,
            actualActiveMapping: {
              artifactId: activeMapping.id,
              version: activeMapping.version,
            },
          },
        }),
      );
    }

    const decisionsById = new Map(
      activeMapping.payload.decisions.map((decision) => [
        decision.id,
        decision,
      ]),
    );

    const unknownDecisionIds = request.overrides
      .map((override) => override.decisionId)
      .filter((decisionId) => !decisionsById.has(decisionId));

    if (unknownDecisionIds.length > 0) {
      return parseApplyMappingOverridesResultV1(
        buildFailureV1({
          code: "INPUT_INVALID",
          message:
            "One or more override decision IDs were not found in active mapping.",
          userMessage:
            "At least one selected row is no longer in active mapping. Refresh and retry.",
          context: {
            unknownDecisionIds,
          },
        }),
      );
    }

    const statementTypeMismatches = request.overrides
      .map((override) => {
        const decision = decisionsById.get(override.decisionId);
        if (!decision) {
          return null;
        }

        const selectedCategory = getSilverfinTaxCategoryByCodeV1(
          override.selectedCategoryCode,
        );
        if (
          selectedCategory.statementType ===
          decision.proposedCategory.statementType
        ) {
          return null;
        }

        return {
          decisionId: override.decisionId,
          selectedCategoryCode: override.selectedCategoryCode,
          expectedStatementType: decision.proposedCategory.statementType,
          selectedCategoryStatementType: selectedCategory.statementType,
        };
      })
      .filter((value) => value !== null);

    if (statementTypeMismatches.length > 0) {
      return parseApplyMappingOverridesResultV1(
        buildFailureV1({
          code: "INPUT_INVALID",
          message:
            "One or more overrides selected a category with an incompatible statement type.",
          userMessage:
            "One or more selected categories are incompatible with the mapped row type.",
          context: {
            statementTypeMismatches,
          },
        }),
      );
    }

    const overrideByDecisionId = new Map(
      request.overrides.map((override) => [override.decisionId, override]),
    );

    const nextDecisions = activeMapping.payload.decisions.map((decision) => {
      const override = overrideByDecisionId.get(decision.id);
      if (!override) {
        return decision;
      }

      return applyManualSelectionToDecisionV1({
        decision,
        scope: override.scope,
        reason: override.reason,
        selectedCategoryCode: override.selectedCategoryCode,
        authorUserId: actor.actorUserId,
        evidenceReference: "mapping.override.batch.v1",
      });
    });

    const nextMappingSummary = recomputeMappingDecisionSummaryV1(nextDecisions);
    const nextMappingPayload: MappingDecisionSetArtifactV1 =
      activeMapping.payload.schemaVersion === "mapping_decisions_v2"
        ? {
            ...activeMapping.payload,
            summary: nextMappingSummary,
            decisions: nextDecisions as MappingDecisionV2[],
          }
        : {
            ...activeMapping.payload,
            summary: nextMappingSummary,
            decisions: nextDecisions,
          };

    const persistedMapping =
      await deps.artifactRepository.appendMappingAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: actor.actorUserId,
        mapping: nextMappingPayload,
      });
    if (!persistedMapping.ok) {
      return parseApplyMappingOverridesResultV1(
        buildFailureV1({
          code:
            persistedMapping.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persistedMapping.message,
          userMessage:
            persistedMapping.code === "WORKSPACE_NOT_FOUND"
              ? "Workspace could not be found."
              : "Override changes could not be saved due to a storage error.",
          context: {
            operation: "mapping.appendAndSetActive",
          },
        }),
      );
    }

    const preferenceEntries = dedupePreferenceEntriesV1(
      request.overrides.map((override) =>
        mapOverrideToPreferenceEntryV1({
          decision: decisionsById.get(
            override.decisionId,
          ) as MappingDecisionRecordV1,
          override,
          workspaceId: request.workspaceId,
          actorUserId: actor.actorUserId,
        }),
      ),
    );

    const nowIsoUtc = deps.nowIsoUtc();
    let savedPreferenceCount = 0;
    let preferenceUpsertFailedMessage: string | null = null;
    const upsertPreferencesResult =
      await deps.mappingPreferenceRepository.upsertBatch({
        entries: preferenceEntries,
        nowIsoUtc,
        tenantId: request.tenantId,
        actorUserId: actor.actorUserId,
      });
    if (upsertPreferencesResult.ok) {
      savedPreferenceCount = upsertPreferencesResult.savedCount;
    } else {
      preferenceUpsertFailedMessage = upsertPreferencesResult.message;
    }

    const overrideAuditEvent = parseAuditEventV2({
      id: deps.generateId(),
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
      actorType: "user",
      actorUserId: actor.actorUserId,
      eventType: "mapping.overrides_applied",
      targetType: "mapping_artifact",
      targetId: persistedMapping.artifact.id,
      before: {
        artifactId: activeMapping.id,
        version: activeMapping.version,
      },
      after: {
        artifactId: persistedMapping.artifact.id,
        version: persistedMapping.artifact.version,
        appliedCount: request.overrides.length,
        savedPreferenceCount,
        preferencesPersisted: preferenceUpsertFailedMessage === null,
      },
      timestamp: nowIsoUtc,
      context: {
        expectedActiveMapping: request.expectedActiveMapping,
        preferenceUpsertFailedMessage,
      },
    });

    const overrideAuditAppend =
      await deps.auditRepository.append(overrideAuditEvent);
    if (!overrideAuditAppend.ok) {
      // The override artifact is already committed; audit append is best-effort.
    }

    if (preferenceUpsertFailedMessage === null) {
      for (const preferenceEntry of preferenceEntries) {
        const scopeTargetId =
          preferenceEntry.scope === "return"
            ? `${preferenceEntry.scope}:${request.workspaceId}:${preferenceEntry.sourceAccountNumber}:${preferenceEntry.statementType}`
            : `${preferenceEntry.scope}:${actor.actorUserId}:${preferenceEntry.sourceAccountNumber}:${preferenceEntry.statementType}`;

        const preferenceAuditEvent = parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: "user",
          actorUserId: actor.actorUserId,
          eventType: "mapping.preference_saved",
          targetType: "mapping_preference",
          targetId: scopeTargetId,
          after: {
            scope: preferenceEntry.scope,
            sourceAccountNumber: preferenceEntry.sourceAccountNumber,
            statementType: preferenceEntry.statementType,
            selectedCategoryCode: preferenceEntry.selectedCategoryCode,
            reason: preferenceEntry.reason,
          },
          timestamp: nowIsoUtc,
          context: {},
        });

        const preferenceAuditAppend =
          await deps.auditRepository.append(preferenceAuditEvent);
        if (!preferenceAuditAppend.ok) {
          // Preferences are already persisted; audit append is best-effort.
        }
      }
    }

    return parseApplyMappingOverridesResultV1({
      ok: true,
      active: {
        artifactId: persistedMapping.artifact.id,
        version: persistedMapping.artifact.version,
        schemaVersion: persistedMapping.artifact.schemaVersion,
      },
      mapping: persistedMapping.artifact.payload,
      appliedCount: request.overrides.length,
      savedPreferenceCount,
    });
  } catch (error) {
    return parseApplyMappingOverridesResultV1(
      buildFailureV1({
        code: "PERSISTENCE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error.",
        userMessage: "Override processing failed due to an unexpected error.",
        context: {
          operation: "mapping.override.apply",
        },
      }),
    );
  }
}
