import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  GenerateMappingReviewSuggestionsRequestV1Schema,
  type GenerateMappingReviewSuggestionsResultV1,
  MappingReviewSuggestionV1Schema,
  parseGenerateMappingReviewSuggestionsResultV1,
} from "../../shared/contracts/mapping-review.v1";
import {
  type MappingDecisionRecordV1,
  getSilverfinTaxCategoryByCodeV1,
} from "../../shared/contracts/mapping.v1";
import type {
  MappingReviewModelInputProjectionV1,
  executeMappingReviewModelV1,
} from "../ai/modules/mapping-review/executor.v1";
import type { loadMappingReviewModuleConfigV1 } from "../ai/modules/mapping-review/loader.v1";

/**
 * Dependencies required for mapping-review suggestion generation.
 */
export interface MappingReviewDepsV1 {
  artifactRepository: TbPipelineArtifactRepositoryV1;
  workspaceRepository: WorkspaceRepositoryV1;
  auditRepository: AuditRepositoryV1;
  loadModuleConfig: typeof loadMappingReviewModuleConfigV1;
  runModel: typeof executeMappingReviewModelV1;
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

function buildMappingReviewProjectionV1(input: {
  canProceedToMapping: boolean;
  decisions: MappingDecisionRecordV1[];
}): MappingReviewModelInputProjectionV1 {
  return {
    canProceedToMapping: input.canProceedToMapping,
    decisions: input.decisions.map((decision) => ({
      id: decision.id,
      accountName: decision.accountName,
      proposedStatementType: decision.proposedCategory.statementType,
      selectedCategoryCode: decision.selectedCategory.code,
      evidenceTypes: decision.evidence.map((evidence) => evidence.type),
    })),
  };
}

/**
 * Generates structured mapping-review suggestions from active reconciliation + mapping artifacts.
 *
 * Safety boundary:
 * - Mapping review remains advisory and does not mutate persisted artifacts.
 * - The active mapping artifact remains source of truth unless a user later applies overrides.
 */
export async function generateMappingReviewSuggestionsV1(
  input: unknown,
  deps: MappingReviewDepsV1,
): Promise<GenerateMappingReviewSuggestionsResultV1> {
  const parsedRequest =
    GenerateMappingReviewSuggestionsRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Mapping review request payload is invalid.",
        user_message:
          "The mapping review request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      },
    });
  }

  const request = parsedRequest.data;

  const workspace = await deps.workspaceRepository.getById({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!workspace) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
        user_message: "Workspace could not be found.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  const activeReconciliation =
    await deps.artifactRepository.getActiveReconciliation({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
  if (!activeReconciliation) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_NOT_FOUND",
        message: "No active reconciliation artifact exists for this workspace.",
        user_message:
          "No active reconciliation was found. Run trial balance reconciliation first.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  if (!activeReconciliation.payload.canProceedToMapping) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message:
          "Mapping review is blocked because reconciliation cannot proceed to mapping.",
        user_message:
          "Reconciliation is blocked. Fix reconciliation issues before requesting mapping review.",
        context: {
          reconciliationStatus: activeReconciliation.payload.status,
          blockingReasonCodes: activeReconciliation.payload.blockingReasonCodes,
          reconciliationSummary: activeReconciliation.payload.summary,
        },
      },
    });
  }

  const activeMapping = await deps.artifactRepository.getActiveMapping({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
  });
  if (!activeMapping) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "MAPPING_NOT_FOUND",
        message: "No active mapping artifact exists for this workspace.",
        user_message: "No active mapping was found for this workspace.",
        context: {
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
        },
      },
    });
  }

  const moduleConfig = deps.loadModuleConfig();
  if (!moduleConfig.ok) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "AI_MODULE_CONFIG_INVALID",
        message: moduleConfig.error.message,
        user_message:
          "Mapping review configuration is invalid. Contact support.",
        context: moduleConfig.error.context,
      },
    });
  }

  const modelInputProjection = buildMappingReviewProjectionV1({
    canProceedToMapping: activeReconciliation.payload.canProceedToMapping,
    decisions: activeMapping.payload.decisions,
  });

  const modelResult = await deps.runModel({
    config: moduleConfig.config,
    projection: modelInputProjection,
    requestedScope: request.scope,
    maxSuggestions: request.maxSuggestions ?? 100,
  });
  if (!modelResult.ok) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "AI_PROVIDER_ERROR",
        message: modelResult.error.message,
        user_message:
          "Mapping review suggestions could not be generated at this time.",
        context: modelResult.error.context,
      },
    });
  }

  const parsedSuggestions = modelResult.suggestions.map((suggestion) =>
    MappingReviewSuggestionV1Schema.safeParse(suggestion),
  );
  const invalidSuggestionIssues = parsedSuggestions
    .filter((result) => !result.success)
    .map((result) =>
      !result.success
        ? {
            issues: result.error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              path: issue.path.join("."),
            })),
          }
        : null,
    )
    .filter((value) => value !== null);

  if (invalidSuggestionIssues.length > 0) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "AI_OUTPUT_INVALID",
        message: "AI model returned malformed mapping review suggestions.",
        user_message:
          "Mapping review output was invalid. Please retry in a moment.",
        context: {
          invalidSuggestionIssues,
        },
      },
    });
  }

  const suggestions = parsedSuggestions
    .filter(
      (
        result,
      ): result is {
        success: true;
        data: z.infer<typeof MappingReviewSuggestionV1Schema>;
      } => result.success,
    )
    .map((result) => result.data);

  const decisionsById = new Map(
    activeMapping.payload.decisions.map((decision) => [decision.id, decision]),
  );
  const compatibilityIssues: Array<Record<string, unknown>> = [];

  for (const suggestion of suggestions) {
    const decision = decisionsById.get(suggestion.decisionId);
    if (!decision) {
      compatibilityIssues.push({
        code: "UNKNOWN_DECISION_ID",
        decisionId: suggestion.decisionId,
      });
      continue;
    }

    const selectedCategory = getSilverfinTaxCategoryByCodeV1(
      suggestion.selectedCategoryCode,
    );
    if (
      selectedCategory.statementType !== decision.proposedCategory.statementType
    ) {
      compatibilityIssues.push({
        code: "STATEMENT_TYPE_MISMATCH",
        decisionId: suggestion.decisionId,
        expectedStatementType: decision.proposedCategory.statementType,
        selectedCategoryCode: suggestion.selectedCategoryCode,
        selectedCategoryStatementType: selectedCategory.statementType,
      });
    }
  }

  if (compatibilityIssues.length > 0) {
    return parseGenerateMappingReviewSuggestionsResultV1({
      ok: false,
      error: {
        code: "AI_OUTPUT_INVALID",
        message: "AI model output failed mapping compatibility checks.",
        user_message:
          "Mapping review output was incompatible with active mapping decisions.",
        context: {
          compatibilityIssues,
        },
      },
    });
  }

  const suggestionPayload = {
    schemaVersion: "mapping_review_suggestions_v1" as const,
    moduleId: moduleConfig.config.moduleSpec.moduleId,
    moduleVersion: moduleConfig.config.moduleSpec.moduleVersion,
    policyVersion: moduleConfig.config.policyPack.policyVersion,
    summary: {
      totalDecisionsEvaluated: activeMapping.payload.decisions.length,
      suggestedOverrides: suggestions.length,
      reviewFlaggedSuggestions: suggestions.filter(
        (suggestion) => suggestion.reviewFlag,
      ).length,
    },
    suggestions,
  };

  const moduleSpec = moduleConfig.config.moduleSpec as Record<string, unknown>;
  const runtime =
    typeof moduleSpec.runtime === "object" && moduleSpec.runtime
      ? (moduleSpec.runtime as Record<string, unknown>)
      : null;

  const reviewAuditEvent = parseAuditEventV2({
    id: deps.generateId(),
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    actorType: "system",
    eventType: AUDIT_EVENT_TYPES_V1.MAPPING_REVIEW_SUGGESTIONS_GENERATED,
    targetType: "mapping_artifact",
    targetId: activeMapping.id,
    after: {
      artifactId: activeMapping.id,
      artifactVersion: activeMapping.version,
      scope: request.scope,
      maxSuggestions: request.maxSuggestions ?? 100,
      moduleId: suggestionPayload.moduleId,
      moduleVersion: suggestionPayload.moduleVersion,
      promptVersion: moduleConfig.config.promptVersion,
      policyVersion: suggestionPayload.policyVersion,
      activePatchVersions:
        moduleConfig.config.moduleSpec.policy.activePatchVersions,
      modelProvider:
        typeof runtime?.provider === "string" ? runtime.provider : "unknown",
      modelName: typeof runtime?.model === "string" ? runtime.model : "unknown",
      suggestionCount: suggestionPayload.summary.suggestedOverrides,
      projectedDecisionCount: modelInputProjection.decisions.length,
    },
    timestamp: deps.nowIsoUtc(),
    context: {},
  });
  const reviewAuditWrite = await deps.auditRepository.append(reviewAuditEvent);
  if (!reviewAuditWrite.ok) {
    // Suggestions are advisory and already computed; audit append is best-effort.
  }

  return parseGenerateMappingReviewSuggestionsResultV1({
    ok: true,
    activeMapping: {
      artifactId: activeMapping.id,
      version: activeMapping.version,
      schemaVersion: activeMapping.schemaVersion,
    },
    suggestions: suggestionPayload,
  });
}
