import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import {
  buildCoreModulePathV1,
  coreModuleDefinitionsV1,
} from "../../app/core-modules.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { GuidanceBannerV1 } from "../../components/guidance-banner-v1";
import { StatusPill } from "../../components/status-pill";
import { listCompaniesByTenantV1 } from "../../lib/http/company-api";
import {
  getActiveAnnualReportExtractionV1,
  getActiveInk2FormV1,
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
  getWorkspaceByIdV1,
} from "../../lib/http/workspace-api";
import {
  buildWorkflowSnapshotV1,
  getModuleWorkflowStateV1,
  getRecommendedNextModuleV1,
} from "../../lib/workflow-v1";
import { formatFiscalYearLabelV1 } from "../../lib/fiscal-year.v1";

function formatVersionTimestampV1(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function WorkspaceDashboardPageV1() {
  const navigate = useNavigate();
  const principal = useRequiredSessionPrincipalV1();
  const { workspaceId } = useParams();
  const resolvedWorkspaceId = workspaceId ?? "";

  const workspaceQuery = useQuery({
    queryKey: ["workspace", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getWorkspaceByIdV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
  });

  const companiesQuery = useQuery({
    queryKey: ["companies", principal.tenantId],
    queryFn: () => listCompaniesByTenantV1({ tenantId: principal.tenantId }),
  });

  const annualReportQuery = useQuery({
    queryKey: ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveAnnualReportExtractionV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const mappingQuery = useQuery({
    queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxAdjustmentsQuery = useQuery({
    queryKey: ["active-tax-adjustments", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxSummaryQuery = useQuery({
    queryKey: ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const ink2Query = useQuery({
    queryKey: ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  if (workspaceQuery.isError || !workspaceId) {
    return (
      <EmptyStateV1
        title="Workspace not found"
        description="Open a company from the landing page to continue."
      />
    );
  }

  const workspace = workspaceQuery.data?.workspace;
  if (!workspace) {
    return <div className="workspace-empty-state">Loading workspace…</div>;
  }

  const company =
    companiesQuery.data?.companies.find(
      (candidate) => candidate.id === workspace.companyId,
    ) ?? null;

  const workflowSnapshot = buildWorkflowSnapshotV1({
    annualReportConfirmed:
      annualReportQuery.data?.extraction.confirmation.isConfirmed ?? false,
    hasMapping: mappingQuery.isSuccess,
    hasTaxAdjustments: taxAdjustmentsQuery.isSuccess,
    hasTaxSummary: taxSummaryQuery.isSuccess,
    hasInk2Draft: ink2Query.isSuccess,
  });

  const recommendedModule = getRecommendedNextModuleV1(workflowSnapshot);

  return (
    <div className="workspace-dashboard">
      <header className="workspace-dashboard__hero">
        <div>
          <div className="workspace-dashboard__eyebrow">Company dashboard</div>
          <h1>{company?.legalName ?? "Workspace"}</h1>
          <p>
            {formatFiscalYearLabelV1({
              fiscalYearStart: workspace.fiscalYearStart,
              fiscalYearEnd: workspace.fiscalYearEnd,
            })}
          </p>
        </div>
        <div className="workspace-dashboard__meta">
          <div className="workspace-dashboard__status-row">
            <StatusPill status={workspace.status} />
            <button
              type="button"
              className="workspace-dashboard__continue-btn"
              onClick={() =>
                navigate(buildCoreModulePathV1(workspace.id, recommendedModule))
              }
            >
              Continue:{" "}
              {coreModuleDefinitionsV1.find(
                (m) => m.slug === recommendedModule,
              )?.shortLabel}{" "}
              →
            </button>
          </div>

          <div className="workspace-dashboard__progress-rail">
            {coreModuleDefinitionsV1.map((mod) => {
              const modState = getModuleWorkflowStateV1({
                definition: mod,
                snapshot: workflowSnapshot,
              });
              const isActive = mod.slug === recommendedModule;
              const stateSlug = modState.statusLabel
                .toLowerCase()
                .replace(" ", "-");
              return (
                <div
                  key={mod.slug}
                  className={`workspace-dashboard__progress-step workspace-dashboard__progress-step--${stateSlug}${isActive ? " workspace-dashboard__progress-step--active" : ""}`}
                >
                  <div className="workspace-dashboard__progress-dot" />
                  <span className="workspace-dashboard__progress-label">
                    {mod.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <section className="workspace-dashboard__cards">
        {coreModuleDefinitionsV1.map((moduleDefinition) => {
          const moduleState = getModuleWorkflowStateV1({
            definition: moduleDefinition,
            snapshot: workflowSnapshot,
          });
          const isRecommended = recommendedModule === moduleDefinition.slug;
          const isBlocked = moduleState.statusLabel === "Waiting";
          const isDone = moduleState.statusLabel === "Ready";

          // Build per-module "last updated" timestamp
          let lastUpdated: string | null = null;
          if (moduleDefinition.slug === "annual-report-analysis" && annualReportQuery.data?.active) {
            const ar = annualReportQuery.data;
            lastUpdated =
              formatVersionTimestampV1(ar.extraction.confirmation.confirmedAt ?? undefined) ??
              formatVersionTimestampV1(ar.extraction.aiRun?.generatedAt ?? undefined);
          } else if (moduleDefinition.slug === "account-mapping" && mappingQuery.data?.active) {
            const mp = mappingQuery.data;
            const aiGen = (mp.mapping as { aiRun?: { generatedAt?: string } }).aiRun?.generatedAt;
            lastUpdated = formatVersionTimestampV1(aiGen);
          } else if (moduleDefinition.slug === "tax-adjustments" && taxAdjustmentsQuery.data?.active) {
            const ta = taxAdjustmentsQuery.data;
            const runs = (ta.adjustments as { aiRuns?: Array<{ generatedAt?: string }> }).aiRuns ?? [];
            lastUpdated = formatVersionTimestampV1(runs[runs.length - 1]?.generatedAt);
          }

          let cardClass = "workspace-dashboard-card";
          if (isBlocked) cardClass += " workspace-dashboard-card--blocked";
          else if (isRecommended) cardClass += " workspace-dashboard-card--recommended";
          else if (isDone) cardClass += " workspace-dashboard-card--done";

          return (
            <CardV1
              key={moduleDefinition.slug}
              className={cardClass}
            >
              <div className="workspace-dashboard-card__header">
                <div className="workspace-dashboard-card__step">
                  {moduleDefinition.step}
                </div>
                <div
                  className={`workspace-dashboard-card__status-badge workspace-dashboard-card__status-badge--${moduleState.statusLabel.toLowerCase().replace(" ", "-")}`}
                >
                  {moduleState.statusLabel}
                </div>
              </div>

              <h2>{moduleDefinition.longLabel}</h2>
              <p>{moduleDefinition.description}</p>

              {lastUpdated ? (
                <div className="workspace-dashboard-card__last-updated">
                  Last updated {lastUpdated}
                </div>
              ) : null}

              {moduleState.warning ? (
                <div className="workspace-dashboard-card__blocker" role="note">
                  {moduleState.warning}
                </div>
              ) : null}

              <div className="workspace-dashboard-card__footer">
                {isBlocked ? (
                  <span className="workspace-dashboard-card__blocked-hint">
                    Complete the previous step to unlock
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`workspace-dashboard-card__button${isDone ? " workspace-dashboard-card__button--revisit" : ""}`}
                    onClick={() =>
                      navigate(
                        buildCoreModulePathV1(workspace.id, moduleDefinition.slug),
                      )
                    }
                  >
                    {moduleState.nextActionLabel}
                  </button>
                )}
              </div>
            </CardV1>
          );
        })}
      </section>
    </div>
  );
}
