import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { GuidanceBannerV1 } from "../../components/guidance-banner-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  StatusBadgeV1,
  type StatusToneV1,
} from "../../components/status-badge-v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveInk2FormV1,
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getWorkspaceByIdV1,
} from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

type CoreModuleSlugV1 =
  | "annual-report-analysis"
  | "account-mapping"
  | "tax-adjustments"
  | "tax-return-ink2";

type ModuleSignalV1 = {
  artifact: string;
  status: "in_progress" | "not_started" | "ready";
  version?: number;
};

function getModuleStatusBadgeV1(signal: ModuleSignalV1): {
  label: string;
  tone: StatusToneV1;
} {
  if (signal.status === "ready") {
    return { label: "Ready", tone: "success" };
  }
  if (signal.status === "not_started") {
    return { label: "Not started", tone: "neutral" };
  }
  return { label: "In progress", tone: "warning" };
}

function getSignalFromQueryV1(
  query: {
    data?: { active?: { version: number } };
    error: unknown;
    isError: boolean;
    isSuccess: boolean;
  },
  notFoundCodes: string[],
): ModuleSignalV1 {
  if (query.isSuccess && query.data?.active?.version) {
    return {
      status: "ready",
      version: query.data.active.version,
      artifact: `v${query.data.active.version}`,
    };
  }

  if (
    query.isError &&
    query.error instanceof ApiClientError &&
    notFoundCodes.includes(query.error.code)
  ) {
    return {
      status: "not_started",
      artifact: "No active artifact",
    };
  }

  return {
    status: "in_progress",
    artifact: "Awaiting module run",
  };
}

export function WorkspaceWorkbenchPageV1() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const principal = useRequiredSessionPrincipalV1();
  const { t } = useI18nV1();
  const { setActiveContext } = useGlobalAppContextV1();
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
  const annualQuery = useQuery({
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
  const adjustmentsQuery = useQuery({
    queryKey: [
      "active-tax-adjustments",
      principal.tenantId,
      resolvedWorkspaceId,
    ],
    queryFn: () =>
      getActiveTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });
  const formQuery = useQuery({
    queryKey: ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const moduleCards = useMemo<
    Array<{
      description: string;
      key: CoreModuleSlugV1;
      label: string;
      order: number;
      signal: ModuleSignalV1;
    }>
  >(
    () => [
      {
        key: "annual-report-analysis",
        order: 1,
        label: t("module.annualReport"),
        description: "Extract and confirm annual-report fields.",
        signal: getSignalFromQueryV1(annualQuery, ["EXTRACTION_NOT_FOUND"]),
      },
      {
        key: "account-mapping",
        order: 2,
        label: t("module.accountMapping"),
        description: "Review and override account mapping decisions.",
        signal: getSignalFromQueryV1(mappingQuery, ["MAPPING_NOT_FOUND"]),
      },
      {
        key: "tax-adjustments",
        order: 3,
        label: t("module.taxAdjustments"),
        description: "Apply tax adjustments and see final impact.",
        signal: getSignalFromQueryV1(adjustmentsQuery, [
          "ADJUSTMENTS_NOT_FOUND",
        ]),
      },
      {
        key: "tax-return-ink2",
        order: 4,
        label: t("module.taxReturnInk2"),
        description: "Draft and review the INK2 form output.",
        signal: getSignalFromQueryV1(formQuery, ["FORM_NOT_FOUND"]),
      },
    ],
    [adjustmentsQuery, annualQuery, formQuery, mappingQuery, t],
  );
  const nextRecommendedOrder = useMemo(() => {
    const firstIncomplete = moduleCards.find(
      (module) => module.signal.status !== "ready",
    );
    return firstIncomplete?.order;
  }, [moduleCards]);
  const nextRecommendedModule = useMemo(
    () =>
      nextRecommendedOrder
        ? moduleCards.find((module) => module.order === nextRecommendedOrder)
        : undefined,
    [moduleCards, nextRecommendedOrder],
  );

  useEffect(() => {
    if (!workspaceQuery.data?.workspace) {
      return;
    }
    const workspace = workspaceQuery.data.workspace;
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`,
    });
  }, [setActiveContext, workspaceQuery.data?.workspace]);

  if (!workspaceId) {
    return (
      <EmptyStateV1
        title={t("module.notFound")}
        description="Select a workspace from the directory to continue."
      />
    );
  }

  if (workspaceQuery.isPending) {
    return (
      <section className="page-wrap">
        <CardV1 className="workbench-hero-card">
          <SkeletonV1 width={180} height={12} />
          <SkeletonV1 width={340} height={32} />
          <SkeletonV1 width="72%" height={16} />
          <div className="workbench-hero-meta">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        </CardV1>
        <CardV1 className="module-card-grid-skeleton">
          <SkeletonV1 height={188} />
          <SkeletonV1 height={188} />
          <SkeletonV1 height={188} />
          <SkeletonV1 height={188} />
        </CardV1>
      </section>
    );
  }

  return (
    <section className="page-wrap">
      <CardV1 className="workbench-hero-card">
        <p className="micro-label">{t("workbench.title")}</p>
        <h1 className="page-title">{t("workbench.title")}</h1>
        <p className="hint-text">{t("workbench.subtitle")}</p>
        {workspaceQuery.data?.workspace ? (
          <div className="workbench-hero-meta">
            <div>
              <p className="micro-label">Workspace</p>
              <p className="workbench-hero-value">
                {workspaceQuery.data.workspace.id.slice(0, 8)}
              </p>
            </div>
            <div>
              <p className="micro-label">Fiscal year</p>
              <p className="workbench-hero-value">
                {workspaceQuery.data.workspace.fiscalYearStart} to{" "}
                {workspaceQuery.data.workspace.fiscalYearEnd}
              </p>
            </div>
          </div>
        ) : null}
      </CardV1>

      <GuidanceBannerV1
        tone={nextRecommendedModule ? "active" : "neutral"}
        title={
          nextRecommendedModule ? "Suggested next step" : "Sequence guidance"
        }
      >
        {nextRecommendedModule
          ? `${nextRecommendedModule.order}. ${nextRecommendedModule.label} is recommended next. You can still open every module manually.`
          : t("workbench.sequenceGuidance")}
      </GuidanceBannerV1>

      {workspaceQuery.isError ? (
        <EmptyStateV1
          title="Workspace data unavailable"
          description={toUserFacingErrorMessage(workspaceQuery.error)}
          tone="error"
          role="alert"
          action={
            <ButtonV1 onClick={() => workspaceQuery.refetch()}>Retry</ButtonV1>
          }
        />
      ) : null}

      <div className="module-card-grid">
        {moduleCards.map((module) => {
          const moduleStatus = getModuleStatusBadgeV1(module.signal);
          const isRecommended = module.order === nextRecommendedOrder;
          const isOutOfOrder =
            nextRecommendedOrder !== undefined &&
            module.order > nextRecommendedOrder;
          return (
            <article
              key={module.key}
              className="module-card"
              data-recommended={isRecommended ? "true" : "false"}
              data-out-of-order={isOutOfOrder ? "true" : "false"}
            >
              <div className="module-card-head">
                <div className="module-sequence">
                  <span className="module-order">{module.order}</span>
                  <p className="module-sequence-label">
                    {isRecommended ? "Recommended next" : "Manual access"}
                  </p>
                </div>
                <StatusBadgeV1
                  label={moduleStatus.label}
                  tone={moduleStatus.tone}
                />
              </div>
              <div className="module-card-body">
                <h2 className="section-title">{module.label}</h2>
                <p className="hint-text">{module.description}</p>
              </div>
              <div className="module-card-meta">
                <p className="micro-label">Active artifact</p>
                <p className="module-card-meta-value">
                  {module.signal.artifact}
                </p>
              </div>
              {isOutOfOrder ? (
                <GuidanceBannerV1 tone="advisory">
                  Sequence suggests completing earlier modules first, but this
                  module stays available now.
                </GuidanceBannerV1>
              ) : null}
              <div className="module-card-actions">
                <ButtonV1
                  variant={isRecommended ? "primary" : "secondary"}
                  onClick={() =>
                    navigate(
                      `/app/workspaces/${resolvedWorkspaceId}/${module.key}`,
                    )
                  }
                >
                  {t("module.open")}
                </ButtonV1>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
