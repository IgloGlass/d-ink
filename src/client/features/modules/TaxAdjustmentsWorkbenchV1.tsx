import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { SidebarNavV1 } from "../../components/sidebar-nav-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import type {
  GetActiveTaxAdjustmentsResponseV1,
  GetActiveTaxSummaryResponseV1,
} from "../../lib/http/workspace-api";
import type { ModuleWorkflowStateV1 } from "../../lib/workflow-v1";
import {
  buildTaxAdjustmentSidebarSectionsV1,
  buildTaxAdjustmentSubmodulePathV1,
  findTaxAdjustmentSubmoduleV1,
  getTaxAdjustmentSubmoduleGroupTitleV1,
  listTaxAdjustmentSubmodulesV1,
} from "./tax-adjustment-submodules.v1";

function formatOptionalCurrencyV1(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("sv-SE").format(value);
}

function isArtifactNotFoundErrorV1(
  error: Error | null,
  code: string,
): error is ApiClientError {
  return error instanceof ApiClientError && error.code === code;
}

export function TaxAdjustmentsWorkbenchV1({
  workspaceId,
  subModule,
  taxAdjustmentsQuery,
  taxSummaryQuery,
  workflowState,
  onGenerate,
  isGenerating,
  generateLabel,
}: {
  workspaceId: string;
  subModule?: string;
  taxAdjustmentsQuery: UseQueryResult<GetActiveTaxAdjustmentsResponseV1, Error>;
  taxSummaryQuery: UseQueryResult<GetActiveTaxSummaryResponseV1, Error>;
  workflowState: ModuleWorkflowStateV1;
  onGenerate: () => void;
  isGenerating: boolean;
  generateLabel: string;
}) {
  const navigate = useNavigate();
  const selectedSubmodule = findTaxAdjustmentSubmoduleV1(subModule);
  const allSubmodules = listTaxAdjustmentSubmodulesV1();
  const currentSubmoduleIndex = allSubmodules.findIndex(
    (submoduleItem) =>
      submoduleItem.routeSegment === selectedSubmodule.routeSegment,
  );
  const previousSubmodule =
    currentSubmoduleIndex > 0 ? allSubmodules[currentSubmoduleIndex - 1] : null;
  const nextSubmodule =
    currentSubmoduleIndex < allSubmodules.length - 1
      ? allSubmodules[currentSubmoduleIndex + 1]
      : null;
  const { sections } = buildTaxAdjustmentSidebarSectionsV1(workspaceId);
  const adjustmentsNotFound = isArtifactNotFoundErrorV1(
    taxAdjustmentsQuery.error ?? null,
    "ADJUSTMENTS_NOT_FOUND",
  );
  const taxSummaryNotFound =
    isArtifactNotFoundErrorV1(
      taxSummaryQuery.error ?? null,
      "ADJUSTMENTS_NOT_FOUND",
    ) ||
    isArtifactNotFoundErrorV1(
      taxSummaryQuery.error ?? null,
      "TAX_SUMMARY_NOT_FOUND",
    );
  const activeAdjustment = taxAdjustmentsQuery.data?.active;
  const adjustmentSummary = taxAdjustmentsQuery.data?.adjustments.summary;
  const taxSummary = taxSummaryQuery.data?.summary;
  const calculationCheckpointCount = allSubmodules.filter(
    (submoduleItem) => submoduleItem.group === "calculation",
  ).length;
  const currentSectionTitle = getTaxAdjustmentSubmoduleGroupTitleV1(
    selectedSubmodule.group,
  );
  const currentSubmoduleLabel = String(selectedSubmodule.ordinal).padStart(
    2,
    "0",
  );
  const currentPositionLabel = `${currentSubmoduleLabel} / ${String(
    allSubmodules.length,
  ).padStart(2, "0")}`;
  const remainingSubmoduleCount = Math.max(
    allSubmodules.length - currentSubmoduleIndex - 1,
    0,
  );
  const progressPercent =
    currentSubmoduleIndex >= 0
      ? ((currentSubmoduleIndex + 1) / allSubmodules.length) * 100
      : 0;
  const queryErrorMessage =
    !adjustmentsNotFound && taxAdjustmentsQuery.isError
      ? toUserFacingErrorMessage(taxAdjustmentsQuery.error)
      : !taxSummaryNotFound && taxSummaryQuery.isError
        ? toUserFacingErrorMessage(taxSummaryQuery.error)
        : null;

  return (
    <div className="tax-adjustments-workbench">
      <aside className="tax-adjustments-workbench__sidebar">
        <CardV1 className="tax-adjustments-nav-card">
          <div className="tax-adjustments-nav-card__header">
            <div className="module-shell__eyebrow">Module 03</div>
            <h2>Adjustment Navigator</h2>
            <p>
              Move through the full adjustment sequence in one scroll, with the
              calculation chain anchored at the end of the same navigator.
            </p>
            <div className="tax-adjustments-nav-card__metrics">
              <div className="tax-adjustments-nav-card__metric">
                <span>Current</span>
                <strong>{currentPositionLabel}</strong>
              </div>
              <div className="tax-adjustments-nav-card__metric">
                <span>Calculation checkpoints</span>
                <strong>
                  {String(calculationCheckpointCount).padStart(2, "0")}
                </strong>
              </div>
            </div>
          </div>
          <SidebarNavV1 sections={sections} density="dense" />
        </CardV1>
      </aside>

      <div className="tax-adjustments-workbench__main">
        <CardV1 className="module-stage-card card-v1--hero">
          <div className="tax-adjustments-stage-header">
            <div>
              <div className="module-shell__eyebrow">
                Submodule {currentSubmoduleLabel}
              </div>
              <h1>{selectedSubmodule.title}</h1>
              <p>{selectedSubmodule.summary}</p>
            </div>
            <div className="tax-adjustments-stage-header__actions">
              <div className="tax-adjustments-stage-status">
                {workflowState.statusLabel}
              </div>
              <ButtonV1
                variant="black"
                busy={isGenerating}
                onClick={onGenerate}
              >
                {generateLabel}
              </ButtonV1>
            </div>
          </div>

          <div className="tax-adjustments-briefing-grid">
            <div className="tax-adjustments-briefing-card">
              <span>Current section</span>
              <strong>{currentSectionTitle}</strong>
              <p>
                {selectedSubmodule.group === "calculation"
                  ? "You are inside the deterministic calculation chain that feeds the downstream tax summary."
                  : "This submodule stays in the review sequence before the deterministic calculation checkpoints."}
              </p>
            </div>
            <div className="tax-adjustments-briefing-card">
              <span>Recommended next action</span>
              <strong>{workflowState.nextActionLabel}</strong>
              <p>
                {activeAdjustment
                  ? "A saved adjustment artifact already exists, so you can move between submodules without losing downstream state."
                  : "Generate the first draft adjustment set to seed this module and unlock downstream totals."}
              </p>
            </div>
            <div className="tax-adjustments-briefing-card">
              <span>Progress through module</span>
              <strong className="tax-adjustments-summary-card__value--mono">
                {currentPositionLabel}
              </strong>
              <p>
                {remainingSubmoduleCount > 0
                  ? `${remainingSubmoduleCount} reserved surfaces remain after this one.`
                  : "You are at the end of the module flow."}
              </p>
            </div>
          </div>

          {queryErrorMessage ? (
            <div className="workspace-inline-error" role="alert">
              {queryErrorMessage}
            </div>
          ) : null}

          {taxAdjustmentsQuery.isPending || taxSummaryQuery.isPending ? (
            <div className="tax-adjustments-summary-grid">
              <SkeletonV1 height={120} />
              <SkeletonV1 height={120} />
              <SkeletonV1 height={120} />
              <SkeletonV1 height={120} />
            </div>
          ) : (
            <div className="tax-adjustments-summary-grid">
              <div className="tax-adjustments-summary-card">
                <span>Adjustment artifact</span>
                <strong>
                  {activeAdjustment
                    ? `v${activeAdjustment.version}`
                    : "Not generated"}
                </strong>
                <p>
                  {activeAdjustment
                    ? "The active adjustment decision set is available for downstream use."
                    : "Run the draft adjustment generator when you are ready to seed this module."}
                </p>
              </div>
              <div className="tax-adjustments-summary-card">
                <span>Draft decisions</span>
                <strong>{adjustmentSummary?.totalDecisions ?? 0}</strong>
                <p>
                  {adjustmentSummary
                    ? `${adjustmentSummary.manualReviewRequired} currently flagged for manual review.`
                    : "No decisions have been generated yet for this workspace."}
                </p>
              </div>
              <div className="tax-adjustments-summary-card">
                <span>Taxable income</span>
                <strong className="tax-adjustments-summary-card__value--mono">
                  {formatOptionalCurrencyV1(taxSummary?.taxableIncome)}
                </strong>
                <p>
                  {taxSummary
                    ? "Live deterministic total from the current tax summary."
                    : "Tax summary will populate after the first adjustment draft exists."}
                </p>
              </div>
              <div className="tax-adjustments-summary-card">
                <span>Corporate tax</span>
                <strong className="tax-adjustments-summary-card__value--mono">
                  {formatOptionalCurrencyV1(taxSummary?.corporateTax)}
                </strong>
                <p>
                  {taxSummary
                    ? "Current computed tax impact for the workspace."
                    : "Corporate tax remains pending until the calculation chain is populated."}
                </p>
              </div>
            </div>
          )}
        </CardV1>

        <CardV1 className="tax-adjustments-placeholder-card card-v1--brand">
          <div className="tax-adjustments-placeholder-card__header">
            <div>
              <div className="tax-adjustments-placeholder-card__eyebrow">
                Reserved build surface
              </div>
              <h2>{selectedSubmodule.title}</h2>
            </div>
            <div className="tax-adjustments-placeholder-card__badge">
              Under construction
            </div>
          </div>
          <p>
            The shell is now locked so each future submodule can drop into a
            stable review surface without forcing another navigation redesign.
          </p>
          <div className="tax-adjustments-placeholder-card__grid">
            <section className="tax-adjustments-placeholder-panel">
              <h3>What will render here</h3>
              <ul className="tax-adjustments-placeholder-card__list">
                <li>
                  Mapped accounts routed into this tax area, ready for review.
                </li>
                <li>
                  Annual-report note context and supporting evidence beside the
                  reviewer workflow.
                </li>
                <li>
                  Overrides, audit markers, and deterministic totals attached to
                  the same decision surface.
                </li>
              </ul>
            </section>
            <section className="tax-adjustments-placeholder-panel">
              <h3>What is already live</h3>
              <ul className="tax-adjustments-placeholder-card__list">
                <li>
                  Persistent submodule routing across the full tax-adjustments
                  sequence.
                </li>
                <li>
                  A unified navigator that carries straight into the calculation
                  chain.
                </li>
                <li>
                  Live adjustment and tax-summary signals so downstream impact
                  stays visible while each submodule is built.
                </li>
              </ul>
            </section>
          </div>
        </CardV1>

        <CardV1 className="tax-adjustments-stepper-card">
          <div className="tax-adjustments-stepper-card__meta">
            <span>Submodule progress</span>
            <strong>{currentPositionLabel}</strong>
          </div>
          <div
            className="tax-adjustments-stepper-card__progress"
            aria-hidden="true"
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="tax-adjustments-stepper-card__actions">
            <ButtonV1
              variant="secondary"
              disabled={previousSubmodule === null}
              onClick={() => {
                if (!previousSubmodule) {
                  return;
                }

                navigate(
                  buildTaxAdjustmentSubmodulePathV1(
                    workspaceId,
                    previousSubmodule,
                  ),
                );
              }}
            >
              Previous submodule
            </ButtonV1>
            <ButtonV1
              variant="black"
              disabled={nextSubmodule === null}
              onClick={() => {
                if (!nextSubmodule) {
                  return;
                }

                navigate(
                  buildTaxAdjustmentSubmodulePathV1(workspaceId, nextSubmodule),
                );
              }}
            >
              Next submodule
            </ButtonV1>
          </div>
        </CardV1>
      </div>
    </div>
  );
}
