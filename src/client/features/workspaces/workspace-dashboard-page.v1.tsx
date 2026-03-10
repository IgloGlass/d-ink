import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import {
  buildCoreModulePathV1,
  coreModuleDefinitionsV1,
} from "../../app/core-modules.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
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
          <StatusPill status={workspace.status} />
          <div className="workspace-dashboard__recommendation">
            Recommended next module:{" "}
            {
              coreModuleDefinitionsV1.find(
                (moduleDefinition) => moduleDefinition.slug === recommendedModule,
              )?.longLabel
            }
          </div>
        </div>
      </header>

      <section className="workspace-dashboard__cards">
        {coreModuleDefinitionsV1.map((moduleDefinition) => {
          const moduleState = getModuleWorkflowStateV1({
            definition: moduleDefinition,
            snapshot: workflowSnapshot,
          });

          return (
            <CardV1
              key={moduleDefinition.slug}
              className={`workspace-dashboard-card${
                recommendedModule === moduleDefinition.slug
                  ? " workspace-dashboard-card--recommended"
                  : ""
              }`}
            >
              <div className="workspace-dashboard-card__step">
                {moduleDefinition.step}
              </div>
              <h2>{moduleDefinition.longLabel}</h2>
              <p>{moduleDefinition.description}</p>
              <div className="workspace-dashboard-card__status">
                {moduleState.statusLabel}
              </div>
              <div className="workspace-dashboard-card__action">
                {moduleState.nextActionLabel}
              </div>
              {moduleState.warning ? (
                <div className="workspace-dashboard-card__warning">
                  {moduleState.warning}
                </div>
              ) : null}
              <button
                type="button"
                className="workspace-dashboard-card__button"
                onClick={() =>
                  navigate(
                    buildCoreModulePathV1(workspace.id, moduleDefinition.slug),
                  )
                }
              >
                Open module
              </button>
            </CardV1>
          );
        })}
      </section>
    </div>
  );
}
