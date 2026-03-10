import type { CoreModuleDefinitionV1, CoreModuleSlugV1 } from "../app/core-modules.v1";

export type WorkflowSnapshotV1 = {
  hasAnnualReport: boolean;
  hasInk2Draft: boolean;
  hasMapping: boolean;
  hasTaxAdjustments: boolean;
  hasTaxSummary: boolean;
};

export type ModuleWorkflowStateV1 = {
  nextActionLabel: string;
  statusLabel: string;
  warning: string | null;
};

export function buildWorkflowSnapshotV1(input: {
  annualReportConfirmed: boolean;
  hasInk2Draft: boolean;
  hasMapping: boolean;
  hasTaxAdjustments: boolean;
  hasTaxSummary: boolean;
}): WorkflowSnapshotV1 {
  return {
    hasAnnualReport: input.annualReportConfirmed,
    hasMapping: input.hasMapping,
    hasTaxAdjustments: input.hasTaxAdjustments,
    hasTaxSummary: input.hasTaxSummary,
    hasInk2Draft: input.hasInk2Draft,
  };
}

export function getRecommendedNextModuleV1(
  snapshot: WorkflowSnapshotV1,
): CoreModuleSlugV1 {
  if (!snapshot.hasAnnualReport) {
    return "annual-report-analysis";
  }
  if (!snapshot.hasMapping) {
    return "account-mapping";
  }
  if (!snapshot.hasTaxAdjustments || !snapshot.hasTaxSummary) {
    return "tax-adjustments";
  }

  return "tax-return-ink2";
}

export function getModuleWorkflowStateV1(input: {
  definition: CoreModuleDefinitionV1;
  snapshot: WorkflowSnapshotV1;
}): ModuleWorkflowStateV1 {
  const { definition, snapshot } = input;

  if (definition.slug === "annual-report-analysis") {
    return snapshot.hasAnnualReport
      ? {
          statusLabel: "Ready",
          nextActionLabel: definition.nextStepLabel,
          warning: null,
        }
      : {
          statusLabel: "Start here",
          nextActionLabel: definition.ctaLabel,
          warning: null,
        };
  }

  if (definition.slug === "account-mapping") {
    if (!snapshot.hasAnnualReport) {
      return {
        statusLabel: "Waiting",
        nextActionLabel: "Annual report required first",
        warning:
          "This module is available, but a complete annual report must be uploaded before mapping starts.",
      };
    }

    return snapshot.hasMapping
      ? {
          statusLabel: "Ready",
          nextActionLabel: definition.nextStepLabel,
          warning: null,
        }
      : {
          statusLabel: "Open",
          nextActionLabel: definition.ctaLabel,
          warning: null,
        };
  }

  if (definition.slug === "tax-adjustments") {
    if (!snapshot.hasMapping) {
      return {
        statusLabel: "Waiting",
        nextActionLabel: "Mapping required first",
        warning:
          "Generate and review account mapping before calculating tax adjustments.",
      };
    }

    return snapshot.hasTaxAdjustments && snapshot.hasTaxSummary
      ? {
          statusLabel: "Ready",
          nextActionLabel: definition.nextStepLabel,
          warning: null,
        }
      : {
          statusLabel: "Open",
          nextActionLabel: definition.ctaLabel,
          warning: null,
        };
  }

  if (!snapshot.hasTaxAdjustments || !snapshot.hasTaxSummary) {
    return {
      statusLabel: "Waiting",
      nextActionLabel: "Tax adjustments required first",
      warning:
        "Generate and review tax adjustments before preparing the INK2 draft.",
    };
  }

  return snapshot.hasInk2Draft
    ? {
        statusLabel: "Ready",
        nextActionLabel: definition.nextStepLabel,
        warning: null,
      }
    : {
        statusLabel: "Open",
        nextActionLabel: definition.ctaLabel,
        warning: null,
      };
}
