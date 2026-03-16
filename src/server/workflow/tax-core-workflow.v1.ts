import type { z } from "zod";

import type { AuditRepositoryV1 } from "../../db/repositories/audit.repository.v1";
import type { TbPipelineArtifactRepositoryV1 } from "../../db/repositories/tb-pipeline-artifact.repository.v1";
import type { WorkspaceArtifactRepositoryV1 } from "../../db/repositories/workspace-artifact.repository.v1";
import type { WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { AUDIT_EVENT_TYPES_V1 } from "../../shared/audit/audit-event-catalog.v1";
import type { AnnualReportDownstreamTaxContextV1 } from "../../shared/contracts/annual-report-tax-context.v1";
import { parseAuditEventV2 } from "../../shared/contracts/audit-event.v2";
import {
  CreatePdfExportRequestV1Schema,
  type CreatePdfExportResultV1,
  ListWorkspaceExportsRequestV1Schema,
  type ListWorkspaceExportsResultV1,
  parseCreatePdfExportResultV1,
  parseListWorkspaceExportsResultV1,
} from "../../shared/contracts/export-package.v1";
import {
  ApplyInk2FormOverridesRequestV1Schema,
  type ApplyInk2FormOverridesResultV1,
  type GetActiveInk2FormResultV1,
  RunInk2FormRequestV1Schema,
  type RunInk2FormResultV1,
  parseApplyInk2FormOverridesResultV1,
  parseGetActiveInk2FormResultV1,
  parseRunInk2FormResultV1,
} from "../../shared/contracts/ink2-form.v1";
import {
  ApplyTaxAdjustmentOverridesRequestV1Schema,
  type ApplyTaxAdjustmentOverridesResultV1,
  type GetActiveTaxAdjustmentsResultV1,
  RunTaxAdjustmentRequestV1Schema,
  type RunTaxAdjustmentResultV1,
  type TaxAdjustmentDecisionSetPayloadV1,
  parseApplyTaxAdjustmentOverridesResultV1,
  parseGetActiveTaxAdjustmentsResultV1,
  parseRunTaxAdjustmentResultV1,
} from "../../shared/contracts/tax-adjustments.v1";
import {
  type GetActiveTaxSummaryResultV1,
  RunTaxSummaryRequestV1Schema,
  type RunTaxSummaryResultV1,
  parseGetActiveTaxSummaryResultV1,
  parseRunTaxSummaryResultV1,
} from "../../shared/contracts/tax-summary.v1";
import {
  type GenerateTaxAdjustmentsInputV1,
  generateTaxAdjustmentsV1,
} from "../adjustments/tax-adjustments-engine.v1";
import { projectAnnualReportTaxContextV1 } from "../ai/context/annual-report-tax-context.v1";
import { calculateTaxSummaryV1 } from "../calculation/tax-summary-calculator.v1";
import { generatePdfExportPackageV1 } from "../exports/pdf-export.v1";
import { populateInk2FormDraftV1 } from "../forms/ink2-form-populator.v1";

export interface TaxCoreWorkflowDepsV1 {
  auditRepository: AuditRepositoryV1;
  generateTaxAdjustments?: (input: {
    tenantId: string;
    workspaceId: string;
    annualReportExtraction: GenerateTaxAdjustmentsInputV1["annualReportExtraction"];
    annualReportTaxContext?: AnnualReportDownstreamTaxContextV1;
    annualReportExtractionArtifactId: string;
    mapping: GenerateTaxAdjustmentsInputV1["mapping"];
    mappingArtifactId: string;
    policyVersion: string;
    trialBalance: GenerateTaxAdjustmentsInputV1["trialBalance"];
  }) => Promise<
    | {
        ok: true;
        adjustments: TaxAdjustmentDecisionSetPayloadV1;
      }
    | {
        ok: false;
        error: {
          code: "INPUT_INVALID";
          context: Record<string, unknown>;
          message: string;
          user_message: string;
        };
      }
  >;
  tbArtifactRepository: TbPipelineArtifactRepositoryV1;
  workspaceArtifactRepository: WorkspaceArtifactRepositoryV1;
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

function parseUnknownErrorMessageV1(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

async function appendAuditEventBestEffortV1(input: {
  deps: TaxCoreWorkflowDepsV1;
  event: ReturnType<typeof parseAuditEventV2>;
}): Promise<void> {
  const appendResult = await input.deps.auditRepository.append(input.event);
  if (!appendResult.ok) {
    // Artifacts are already immutable source of truth; audit append is best-effort.
  }
}

function buildTaxAdjustmentFailureV1(input: {
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "EXTRACTION_NOT_CONFIRMED"
    | "MAPPING_NOT_FOUND"
    | "ADJUSTMENTS_NOT_FOUND"
    | "STATE_CONFLICT"
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

function buildTaxSummaryFailureV1(input: {
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "EXTRACTION_NOT_CONFIRMED"
    | "ADJUSTMENTS_NOT_FOUND"
    | "INPUT_INVALID_FISCAL_YEAR"
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

function buildInk2FailureV1(input: {
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "EXTRACTION_NOT_CONFIRMED"
    | "SUMMARY_NOT_FOUND"
    | "FORM_NOT_FOUND"
    | "STATE_CONFLICT"
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

function buildExportFailureV1(input: {
  code:
    | "INPUT_INVALID"
    | "WORKSPACE_NOT_FOUND"
    | "EXPORT_NOT_ALLOWED"
    | "FORM_NOT_FOUND"
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

function recalculateAdjustmentSummaryV1(input: {
  decisions: Array<{
    amount: number;
    direction:
      | "decrease_taxable_income"
      | "increase_taxable_income"
      | "informational";
    status: "accepted" | "manual_review_required" | "overridden" | "proposed";
  }>;
}) {
  const totalPositiveAdjustments = input.decisions
    .filter((decision) => decision.direction === "increase_taxable_income")
    .reduce((sum, decision) => sum + decision.amount, 0);
  const totalNegativeAdjustments = input.decisions
    .filter((decision) => decision.direction === "decrease_taxable_income")
    .reduce((sum, decision) => sum + Math.abs(decision.amount), 0);
  const totalNetAdjustments =
    totalPositiveAdjustments - totalNegativeAdjustments;

  return {
    totalDecisions: input.decisions.length,
    manualReviewRequired: input.decisions.filter(
      (decision) => decision.status === "manual_review_required",
    ).length,
    totalPositiveAdjustments: Math.round(totalPositiveAdjustments * 100) / 100,
    totalNegativeAdjustments: Math.round(totalNegativeAdjustments * 100) / 100,
    totalNetAdjustments: Math.round(totalNetAdjustments * 100) / 100,
  };
}

export async function runTaxAdjustmentsV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<RunTaxAdjustmentResultV1> {
  const parsedRequest = RunTaxAdjustmentRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseRunTaxAdjustmentResultV1(
      buildTaxAdjustmentFailureV1({
        code: "INPUT_INVALID",
        message: "Tax-adjustment run request payload is invalid.",
        userMessage: "The tax-adjustment request is invalid.",
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
      return parseRunTaxAdjustmentResultV1(
        buildTaxAdjustmentFailureV1({
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace does not exist for tenant and workspace ID.",
          userMessage: "Workspace could not be found.",
          context: {},
        }),
      );
    }

    const extraction =
      await deps.workspaceArtifactRepository.getActiveAnnualReportExtraction({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!extraction?.payload.confirmation.isConfirmed) {
      return parseRunTaxAdjustmentResultV1(
        buildTaxAdjustmentFailureV1({
          code: "EXTRACTION_NOT_CONFIRMED",
          message:
            "A usable annual report extraction is required before adjustments.",
          userMessage:
            "Upload a complete annual report before running tax adjustments.",
          context: {
            reason: "annual_report_extraction_required",
            requiredStage: "annual_report.extraction_ready",
          },
        }),
      );
    }

    const activeMapping = await deps.tbArtifactRepository.getActiveMapping({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    const activeTrialBalance =
      await deps.tbArtifactRepository.getActiveTrialBalance({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!activeMapping || !activeTrialBalance) {
      return parseRunTaxAdjustmentResultV1(
        buildTaxAdjustmentFailureV1({
          code: "MAPPING_NOT_FOUND",
          message:
            "Active mapping and trial-balance artifacts are required before adjustments.",
          userMessage: "Run trial balance mapping before adjustments.",
          context: {
            reason: "tb_pipeline_artifacts_missing",
            hasActiveMapping: !!activeMapping,
            hasActiveTrialBalance: !!activeTrialBalance,
          },
        }),
      );
    }

    const generated = deps.generateTaxAdjustments
      ? await (async (generateTaxAdjustments) => {
          const taxAnalysis =
            await deps.workspaceArtifactRepository.getActiveAnnualReportTaxAnalysis(
              {
                tenantId: request.tenantId,
                workspaceId: request.workspaceId,
              },
            );
          return generateTaxAdjustments({
            tenantId: request.tenantId,
            workspaceId: request.workspaceId,
            policyVersion: request.policyVersion,
            mappingArtifactId: activeMapping.id,
            annualReportExtractionArtifactId: extraction.id,
            annualReportExtraction: extraction.payload,
            annualReportTaxContext: projectAnnualReportTaxContextV1({
              extraction: extraction.payload,
              taxAnalysis: taxAnalysis?.payload,
            }),
            mapping: activeMapping.payload,
            trialBalance: activeTrialBalance.payload,
          });
        })(deps.generateTaxAdjustments)
      : generateTaxAdjustmentsV1({
          policyVersion: request.policyVersion,
          mappingArtifactId: activeMapping.id,
          annualReportExtractionArtifactId: extraction.id,
          annualReportExtraction: extraction.payload,
          mapping: activeMapping.payload,
          trialBalance: activeTrialBalance.payload,
        });
    if (!generated.ok) {
      return parseRunTaxAdjustmentResultV1(
        buildTaxAdjustmentFailureV1({
          code: "INPUT_INVALID",
          message: generated.error.message,
          userMessage: generated.error.user_message,
          context: generated.error.context,
        }),
      );
    }

    const persisted =
      await deps.workspaceArtifactRepository.appendTaxAdjustmentsAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.createdByUserId,
        adjustments: generated.adjustments,
      });
    if (!persisted.ok) {
      return parseRunTaxAdjustmentResultV1(
        buildTaxAdjustmentFailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage: "Adjustments could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.createdByUserId ? "user" : "system",
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.ADJUSTMENT_GENERATED,
        targetType: "tax_adjustments_artifact",
        targetId: persisted.artifact.id,
        after: {
          artifactId: persisted.artifact.id,
          version: persisted.artifact.version,
          totalDecisions: persisted.artifact.payload.summary.totalDecisions,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    // V1 treats deterministic `proposed` decisions as auto-accepted unless
    // they are explicitly manual-review required or later overridden.
    const acceptedCount = persisted.artifact.payload.decisions.filter(
      (decision) =>
        decision.status === "accepted" || decision.status === "proposed",
    ).length;
    if (acceptedCount > 0) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.createdByUserId ? "user" : "system",
          actorUserId: request.createdByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.ADJUSTMENT_ACCEPTED,
          targetType: "tax_adjustments_artifact",
          targetId: persisted.artifact.id,
          after: {
            acceptedCount,
          },
          timestamp: deps.nowIsoUtc(),
          context: {},
        }),
      });
    }

    if (persisted.artifact.version > 1) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.createdByUserId ? "user" : "system",
          actorUserId: request.createdByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
          targetType: "pipeline_module",
          targetId: "tax_adjustments",
          before: {
            adjustmentsVersion: persisted.artifact.version - 1,
          },
          after: {
            adjustmentsVersion: persisted.artifact.version,
          },
          timestamp: deps.nowIsoUtc(),
          context: {},
        }),
      });
    }

    return parseRunTaxAdjustmentResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      adjustments: persisted.artifact.payload,
    });
  } catch (error) {
    return parseRunTaxAdjustmentResultV1(
      buildTaxAdjustmentFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Tax adjustments failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function getActiveTaxAdjustmentsV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: TaxCoreWorkflowDepsV1,
): Promise<GetActiveTaxAdjustmentsResultV1> {
  try {
    const active =
      await deps.workspaceArtifactRepository.getActiveTaxAdjustments({
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    if (!active) {
      return parseGetActiveTaxAdjustmentsResultV1(
        buildTaxAdjustmentFailureV1({
          code: "ADJUSTMENTS_NOT_FOUND",
          message:
            "No active tax-adjustment artifact exists for this workspace.",
          userMessage: "No tax adjustments were found for this workspace.",
          context: {},
        }),
      );
    }

    return parseGetActiveTaxAdjustmentsResultV1({
      ok: true,
      active: {
        artifactId: active.id,
        version: active.version,
        schemaVersion: active.schemaVersion,
      },
      adjustments: active.payload,
    });
  } catch (error) {
    return parseGetActiveTaxAdjustmentsResultV1(
      buildTaxAdjustmentFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Failed to load tax adjustments.",
        context: {},
      }),
    );
  }
}

export async function applyTaxAdjustmentOverridesV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<ApplyTaxAdjustmentOverridesResultV1> {
  const parsedRequest =
    ApplyTaxAdjustmentOverridesRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseApplyTaxAdjustmentOverridesResultV1(
      buildTaxAdjustmentFailureV1({
        code: "INPUT_INVALID",
        message: "Tax-adjustment override request payload is invalid.",
        userMessage: "The tax-adjustment override request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  try {
    const active =
      await deps.workspaceArtifactRepository.getActiveTaxAdjustments({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!active) {
      return parseApplyTaxAdjustmentOverridesResultV1(
        buildTaxAdjustmentFailureV1({
          code: "ADJUSTMENTS_NOT_FOUND",
          message:
            "No active tax-adjustment artifact exists for this workspace.",
          userMessage: "No tax adjustments were found for this workspace.",
          context: {},
        }),
      );
    }
    if (
      active.id !== request.expectedActiveAdjustments.artifactId ||
      active.version !== request.expectedActiveAdjustments.version
    ) {
      return parseApplyTaxAdjustmentOverridesResultV1(
        buildTaxAdjustmentFailureV1({
          code: "STATE_CONFLICT",
          message:
            "Active adjustments artifact/version differs from expected compare-and-set values.",
          userMessage:
            "Adjustments changed before your update was applied. Refresh and retry.",
          context: {},
        }),
      );
    }

    const overridesByDecisionId = new Map(
      request.overrides.map((override) => [override.decisionId, override]),
    );
    const nextDecisions = active.payload.decisions.map((decision) => {
      const override = overridesByDecisionId.get(decision.id);
      if (!override) {
        return decision;
      }

      return {
        ...decision,
        amount: override.amount,
        targetField: override.targetField ?? decision.targetField,
        status: "overridden" as const,
        reviewFlag: false,
        override: {
          reason: override.reason,
          authorUserId: request.authorUserId,
        },
        evidence: [
          ...decision.evidence,
          {
            type: "manual_override",
            reference: "adjustment.override.v1",
            snippet: override.reason,
          },
        ],
      };
    });
    const nextAdjustments = {
      ...active.payload,
      decisions: nextDecisions,
      summary: recalculateAdjustmentSummaryV1({
        decisions: nextDecisions,
      }),
    };

    const persisted =
      await deps.workspaceArtifactRepository.appendTaxAdjustmentsAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.authorUserId,
        adjustments: nextAdjustments,
      });
    if (!persisted.ok) {
      return parseApplyTaxAdjustmentOverridesResultV1(
        buildTaxAdjustmentFailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage:
            "Adjustment overrides could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.authorUserId ? "user" : "system",
        actorUserId: request.authorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.ADJUSTMENT_OVERRIDDEN,
        targetType: "tax_adjustments_artifact",
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
        context: {},
      }),
    });

    return parseApplyTaxAdjustmentOverridesResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      adjustments: persisted.artifact.payload,
      appliedCount: request.overrides.length,
    });
  } catch (error) {
    return parseApplyTaxAdjustmentOverridesResultV1(
      buildTaxAdjustmentFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage:
          "Tax-adjustment overrides failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function runTaxSummaryV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<RunTaxSummaryResultV1> {
  const parsedRequest = RunTaxSummaryRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseRunTaxSummaryResultV1(
      buildTaxSummaryFailureV1({
        code: "INPUT_INVALID",
        message: "Tax summary run request payload is invalid.",
        userMessage: "The tax summary request is invalid.",
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
      return parseRunTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace does not exist for tenant and workspace ID.",
          userMessage: "Workspace could not be found.",
          context: {},
        }),
      );
    }

    const extraction =
      await deps.workspaceArtifactRepository.getActiveAnnualReportExtraction({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!extraction?.payload.confirmation.isConfirmed) {
      return parseRunTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code: "EXTRACTION_NOT_CONFIRMED",
          message:
            "A usable annual report extraction is required before tax summary.",
          userMessage:
            "Upload a complete annual report before running tax summary.",
          context: {
            reason: "annual_report_extraction_required",
            requiredStage: "annual_report.extraction_ready",
          },
        }),
      );
    }

    const adjustments =
      await deps.workspaceArtifactRepository.getActiveTaxAdjustments({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!adjustments) {
      return parseRunTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code: "ADJUSTMENTS_NOT_FOUND",
          message: "Active tax adjustments are required before tax summary.",
          userMessage: "Run tax adjustments before tax summary.",
          context: {
            reason: "tax_adjustments_required",
          },
        }),
      );
    }

    const calculated = calculateTaxSummaryV1({
      extractionArtifactId: extraction.id,
      adjustmentsArtifactId: adjustments.id,
      extraction: extraction.payload,
      adjustments: adjustments.payload,
    });
    if (!calculated.ok) {
      return parseRunTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code: calculated.error.code,
          message: calculated.error.message,
          userMessage: calculated.error.user_message,
          context: calculated.error.context,
        }),
      );
    }

    const persisted =
      await deps.workspaceArtifactRepository.appendTaxSummaryAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.createdByUserId,
        summary: calculated.summary,
      });
    if (!persisted.ok) {
      return parseRunTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage: "Tax summary could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.createdByUserId ? "user" : "system",
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.SUMMARY_GENERATED,
        targetType: "tax_summary_artifact",
        targetId: persisted.artifact.id,
        after: {
          artifactId: persisted.artifact.id,
          version: persisted.artifact.version,
          taxableIncome: persisted.artifact.payload.taxableIncome,
          corporateTax: persisted.artifact.payload.corporateTax,
        },
        timestamp: deps.nowIsoUtc(),
        context: {
          summaryKind: "tax_summary",
        },
      }),
    });

    if (persisted.artifact.version > 1) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.createdByUserId ? "user" : "system",
          actorUserId: request.createdByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
          targetType: "pipeline_module",
          targetId: "tax_summary",
          before: {
            summaryVersion: persisted.artifact.version - 1,
          },
          after: {
            summaryVersion: persisted.artifact.version,
          },
          timestamp: deps.nowIsoUtc(),
          context: {},
        }),
      });
    }

    return parseRunTaxSummaryResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      summary: persisted.artifact.payload,
    });
  } catch (error) {
    return parseRunTaxSummaryResultV1(
      buildTaxSummaryFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Tax summary failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function getActiveTaxSummaryV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: TaxCoreWorkflowDepsV1,
): Promise<GetActiveTaxSummaryResultV1> {
  try {
    const active = await deps.workspaceArtifactRepository.getActiveTaxSummary({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
    if (!active) {
      return parseGetActiveTaxSummaryResultV1(
        buildTaxSummaryFailureV1({
          code: "ADJUSTMENTS_NOT_FOUND",
          message: "No active tax summary exists for this workspace.",
          userMessage: "No tax summary was found for this workspace.",
          context: {},
        }),
      );
    }

    return parseGetActiveTaxSummaryResultV1({
      ok: true,
      active: {
        artifactId: active.id,
        version: active.version,
        schemaVersion: active.schemaVersion,
      },
      summary: active.payload,
    });
  } catch (error) {
    return parseGetActiveTaxSummaryResultV1(
      buildTaxSummaryFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Failed to load tax summary.",
        context: {},
      }),
    );
  }
}

export async function runInk2FormV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<RunInk2FormResultV1> {
  const parsedRequest = RunInk2FormRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseRunInk2FormResultV1(
      buildInk2FailureV1({
        code: "INPUT_INVALID",
        message: "INK2 form run request payload is invalid.",
        userMessage: "The INK2 run request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  try {
    const extraction =
      await deps.workspaceArtifactRepository.getActiveAnnualReportExtraction({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    if (!extraction) {
      return parseRunInk2FormResultV1(
        buildInk2FailureV1({
          code: "EXTRACTION_NOT_CONFIRMED",
          message:
            "A usable annual report extraction is required before INK2 draft.",
          userMessage:
            "Upload a complete annual report before generating the INK2 draft.",
          context: {
            reason: "annual_report_extraction_required",
            requiredStage: "annual_report.extraction_ready",
          },
        }),
      );
    }
    const adjustments =
      await deps.workspaceArtifactRepository.getActiveTaxAdjustments({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    const summary = await deps.workspaceArtifactRepository.getActiveTaxSummary({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });

    const populated = populateInk2FormDraftV1({
      extractionArtifactId: extraction.id,
      adjustmentsArtifactId: adjustments?.id,
      summaryArtifactId: summary?.id,
      extraction: extraction.payload,
      adjustments: adjustments?.payload,
      summary: summary?.payload,
    });
    if (!populated.ok) {
      return parseRunInk2FormResultV1(
        buildInk2FailureV1({
          code: "INPUT_INVALID",
          message: populated.error.message,
          userMessage: populated.error.user_message,
          context: populated.error.context,
        }),
      );
    }

    const persisted =
      await deps.workspaceArtifactRepository.appendInk2FormAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.createdByUserId,
        form: populated.form,
      });
    if (!persisted.ok) {
      return parseRunInk2FormResultV1(
        buildInk2FailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage:
            "INK2 form draft could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.createdByUserId ? "user" : "system",
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.FORM_POPULATED,
        targetType: "ink2_form_artifact",
        targetId: persisted.artifact.id,
        after: {
          artifactId: persisted.artifact.id,
          version: persisted.artifact.version,
          validationStatus: persisted.artifact.payload.validation.status,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    if (persisted.artifact.version > 1) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.createdByUserId ? "user" : "system",
          actorUserId: request.createdByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
          targetType: "pipeline_module",
          targetId: "ink2_form",
          before: {
            formVersion: persisted.artifact.version - 1,
          },
          after: {
            formVersion: persisted.artifact.version,
          },
          timestamp: deps.nowIsoUtc(),
          context: {},
        }),
      });
    }

    return parseRunInk2FormResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      form: persisted.artifact.payload,
    });
  } catch (error) {
    return parseRunInk2FormResultV1(
      buildInk2FailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "INK2 draft generation failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function getActiveInk2FormV1(
  input: {
    tenantId: string;
    workspaceId: string;
  },
  deps: TaxCoreWorkflowDepsV1,
): Promise<GetActiveInk2FormResultV1> {
  try {
    const active = await deps.workspaceArtifactRepository.getActiveInk2Form({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
    if (!active) {
      return parseGetActiveInk2FormResultV1(
        buildInk2FailureV1({
          code: "FORM_NOT_FOUND",
          message: "No active INK2 form exists for this workspace.",
          userMessage: "No INK2 form was found for this workspace.",
          context: {},
        }),
      );
    }

    return parseGetActiveInk2FormResultV1({
      ok: true,
      active: {
        artifactId: active.id,
        version: active.version,
        schemaVersion: active.schemaVersion,
      },
      form: active.payload,
    });
  } catch (error) {
    return parseGetActiveInk2FormResultV1(
      buildInk2FailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Failed to load INK2 form.",
        context: {},
      }),
    );
  }
}

export async function applyInk2FormOverridesV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<ApplyInk2FormOverridesResultV1> {
  const parsedRequest = ApplyInk2FormOverridesRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseApplyInk2FormOverridesResultV1(
      buildInk2FailureV1({
        code: "INPUT_INVALID",
        message: "INK2 form override request payload is invalid.",
        userMessage: "The INK2 override request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  try {
    const active = await deps.workspaceArtifactRepository.getActiveInk2Form({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!active) {
      return parseApplyInk2FormOverridesResultV1(
        buildInk2FailureV1({
          code: "FORM_NOT_FOUND",
          message: "No active INK2 form exists for this workspace.",
          userMessage: "No INK2 form was found for this workspace.",
          context: {},
        }),
      );
    }
    if (
      active.id !== request.expectedActiveForm.artifactId ||
      active.version !== request.expectedActiveForm.version
    ) {
      return parseApplyInk2FormOverridesResultV1(
        buildInk2FailureV1({
          code: "STATE_CONFLICT",
          message:
            "Active INK2 form artifact/version differs from expected compare-and-set values.",
          userMessage:
            "INK2 form changed before your update was applied. Refresh and retry.",
          context: {},
        }),
      );
    }

    const overrideByFieldId = new Map(
      request.overrides.map((override) => [override.fieldId, override]),
    );
    const nextForm = {
      ...active.payload,
      fields: active.payload.fields.map((field) => {
        const override = overrideByFieldId.get(field.fieldId);
        if (!override) {
          return field;
        }

        return {
          ...field,
          amount: override.amount,
          provenance: "manual" as const,
          sourceReferences: [
            ...field.sourceReferences,
            `manual_override:${override.reason}`,
          ],
        };
      }),
    };

    const persisted =
      await deps.workspaceArtifactRepository.appendInk2FormAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.authorUserId,
        form: nextForm,
      });
    if (!persisted.ok) {
      return parseApplyInk2FormOverridesResultV1(
        buildInk2FailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage:
            "INK2 overrides could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.authorUserId ? "user" : "system",
        actorUserId: request.authorUserId,
        eventType: AUDIT_EVENT_TYPES_V1.FORM_FIELD_EDITED,
        targetType: "ink2_form_artifact",
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
          overriddenFieldIds: request.overrides.map(
            (override) => override.fieldId,
          ),
        },
      }),
    });

    return parseApplyInk2FormOverridesResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      form: persisted.artifact.payload,
      appliedCount: request.overrides.length,
    });
  } catch (error) {
    return parseApplyInk2FormOverridesResultV1(
      buildInk2FailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "INK2 override failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function createPdfExportV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<CreatePdfExportResultV1> {
  const parsedRequest = CreatePdfExportRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseCreatePdfExportResultV1(
      buildExportFailureV1({
        code: "INPUT_INVALID",
        message: "PDF export request payload is invalid.",
        userMessage: "The PDF export request is invalid.",
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
      return parseCreatePdfExportResultV1(
        buildExportFailureV1({
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace does not exist for tenant and workspace ID.",
          userMessage: "Workspace could not be found.",
          context: {},
        }),
      );
    }

    const extraction =
      await deps.workspaceArtifactRepository.getActiveAnnualReportExtraction({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    const adjustments =
      await deps.workspaceArtifactRepository.getActiveTaxAdjustments({
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
      });
    const summary = await deps.workspaceArtifactRepository.getActiveTaxSummary({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    const form = await deps.workspaceArtifactRepository.getActiveInk2Form({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    if (!extraction || !adjustments || !summary || !form) {
      return parseCreatePdfExportResultV1(
        buildExportFailureV1({
          code: "FORM_NOT_FOUND",
          message:
            "Annual extraction, adjustments, summary, and INK2 form are required before PDF export.",
          userMessage:
            "Complete adjustments, summary, and INK2 draft before PDF export.",
          context: {
            reason: "export_prerequisites_missing",
            hasExtraction: !!extraction,
            hasAdjustments: !!adjustments,
            hasSummary: !!summary,
            hasForm: !!form,
          },
        }),
      );
    }

    const generated = generatePdfExportPackageV1({
      workspace,
      extraction: extraction.payload,
      extractionArtifactId: extraction.id,
      adjustments: adjustments.payload,
      adjustmentsArtifactId: adjustments.id,
      summary: summary.payload,
      summaryArtifactId: summary.id,
      form: form.payload,
      formArtifactId: form.id,
      createdAt: deps.nowIsoUtc(),
      createdByUserId: request.createdByUserId,
    });
    if (!generated.ok) {
      return parseCreatePdfExportResultV1(
        buildExportFailureV1({
          code: generated.error.code,
          message: generated.error.message,
          userMessage: generated.error.user_message,
          context: generated.error.context,
        }),
      );
    }

    const persisted =
      await deps.workspaceArtifactRepository.appendExportPackageAndSetActive({
        artifactId: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        createdAt: deps.nowIsoUtc(),
        createdByUserId: request.createdByUserId,
        exportPackage: generated.exportPackage,
      });
    if (!persisted.ok) {
      return parseCreatePdfExportResultV1(
        buildExportFailureV1({
          code:
            persisted.code === "WORKSPACE_NOT_FOUND"
              ? "WORKSPACE_NOT_FOUND"
              : "PERSISTENCE_ERROR",
          message: persisted.message,
          userMessage: "Export could not be saved due to a storage error.",
          context: {},
        }),
      );
    }

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.createdByUserId ? "user" : "system",
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.FORM_APPROVED,
        targetType: "ink2_form_artifact",
        targetId: form.id,
        after: {
          formArtifactId: form.id,
          approvalSource: "export_generation",
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    await appendAuditEventBestEffortV1({
      deps,
      event: parseAuditEventV2({
        id: deps.generateId(),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        actorType: request.createdByUserId ? "user" : "system",
        actorUserId: request.createdByUserId,
        eventType: AUDIT_EVENT_TYPES_V1.EXPORT_CREATED,
        targetType: "export_package_artifact",
        targetId: persisted.artifact.id,
        after: {
          artifactId: persisted.artifact.id,
          version: persisted.artifact.version,
          format: persisted.artifact.payload.format,
        },
        timestamp: deps.nowIsoUtc(),
        context: {},
      }),
    });

    if (persisted.artifact.version > 1) {
      await appendAuditEventBestEffortV1({
        deps,
        event: parseAuditEventV2({
          id: deps.generateId(),
          tenantId: request.tenantId,
          workspaceId: request.workspaceId,
          actorType: request.createdByUserId ? "user" : "system",
          actorUserId: request.createdByUserId,
          eventType: AUDIT_EVENT_TYPES_V1.MODULE_RERUN,
          targetType: "pipeline_module",
          targetId: "pdf_export",
          before: {
            exportVersion: persisted.artifact.version - 1,
          },
          after: {
            exportVersion: persisted.artifact.version,
          },
          timestamp: deps.nowIsoUtc(),
          context: {},
        }),
      });
    }

    return parseCreatePdfExportResultV1({
      ok: true,
      active: {
        artifactId: persisted.artifact.id,
        version: persisted.artifact.version,
        schemaVersion: persisted.artifact.schemaVersion,
      },
      exportPackage: persisted.artifact.payload,
    });
  } catch (error) {
    return parseCreatePdfExportResultV1(
      buildExportFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "PDF export failed due to an unexpected error.",
        context: {},
      }),
    );
  }
}

export async function listWorkspaceExportsV1(
  input: unknown,
  deps: TaxCoreWorkflowDepsV1,
): Promise<ListWorkspaceExportsResultV1> {
  const parsedRequest = ListWorkspaceExportsRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseListWorkspaceExportsResultV1(
      buildExportFailureV1({
        code: "INPUT_INVALID",
        message: "Export list request payload is invalid.",
        userMessage: "The export list request is invalid.",
        context: buildErrorContextFromZod(parsedRequest.error),
      }),
    );
  }
  const request = parsedRequest.data;

  try {
    const exports = await deps.workspaceArtifactRepository.listExportPackages({
      tenantId: request.tenantId,
      workspaceId: request.workspaceId,
    });
    return parseListWorkspaceExportsResultV1({
      ok: true,
      exports: exports.map((artifact) => ({
        active: {
          artifactId: artifact.id,
          version: artifact.version,
          schemaVersion: artifact.schemaVersion,
        },
        exportPackage: artifact.payload,
      })),
    });
  } catch (error) {
    return parseListWorkspaceExportsResultV1(
      buildExportFailureV1({
        code: "PERSISTENCE_ERROR",
        message: parseUnknownErrorMessageV1(error),
        userMessage: "Failed to list exports.",
        context: {},
      }),
    );
  }
}
