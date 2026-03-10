import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  StatusBadgeV1,
  getWorkspaceStatusAggregateToneV1,
  getWorkspaceStatusBadgeMetaV1,
} from "../../components/status-badge-v1";
import { groupControlPanelAdapterV1 } from "../../lib/adapters/group-control-panel-adapter.v1";
import { listCompaniesByTenantV1 } from "../../lib/http/company-api";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import { listWorkspacesByTenantV1 } from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];
const companyListQueryKeyV1 = (tenantId: string) => ["companies", tenantId];

function formatOrganizationNumberV1(value: string): string {
  return value.length === 10 ? `${value.slice(0, 6)}-${value.slice(6)}` : value;
}

export function GroupControlPanelPageV1() {
  const navigate = useNavigate();
  const { t } = useI18nV1();
  const { groupId = "default" } = useParams();
  const principal = useRequiredSessionPrincipalV1();
  const { setActiveContext } = useGlobalAppContextV1();

  const listQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(principal.tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });
  const companiesQuery = useQuery({
    queryKey: companyListQueryKeyV1(principal.tenantId),
    queryFn: () => listCompaniesByTenantV1({ tenantId: principal.tenantId }),
  });

  const overview =
    listQuery.data?.workspaces &&
    companiesQuery.data?.companies &&
    groupControlPanelAdapterV1.getGroupOverview({
      companies: companiesQuery.data.companies,
      groupId,
      workspaces: listQuery.data.workspaces,
    });
  const overviewStatusTone = overview
    ? getWorkspaceStatusAggregateToneV1(
        overview.companies.map((company) => company.latestStatus),
      )
    : "neutral";
  const overviewStatusLabel =
    overviewStatusTone === "attention"
      ? "Needs review"
      : overviewStatusTone === "warning"
        ? "In progress"
        : overviewStatusTone === "success"
          ? "Finalized"
          : "Not started";

  return (
    <section className="page-wrap">
      <CardV1 className="group-panel-hero-card">
        <div className="group-panel-hero-content">
          <p className="micro-label">{t("group.panel.title")}</p>
          <h1 className="page-title">{t("group.panel.title")}</h1>
          <p className="hint-text">{t("group.panel.subtitle")}</p>
        </div>
        {overview ? (
          <div className="group-panel-hero-aside">
            <div className="group-panel-hero-stat">
              <span>Active workspaces</span>
              <strong>{overview.companies.length}</strong>
            </div>
            <div className="group-panel-hero-stat">
              <span>Portfolio status</span>
              <strong>{overviewStatusLabel}</strong>
            </div>
          </div>
        ) : null}
      </CardV1>

      {listQuery.isPending || companiesQuery.isPending ? (
        <div className="panel-grid panel-grid--2 group-panel-overview-grid">
          <CardV1 className="group-profile-card">
            <SkeletonV1 width={140} height={12} />
            <SkeletonV1 width={280} height={30} />
            <SkeletonV1 height={72} />
            <SkeletonV1 height={72} />
          </CardV1>
          <CardV1 className="group-summary-card">
            <SkeletonV1 width={140} height={12} />
            <SkeletonV1 width="68%" height={16} />
            <div className="panel-grid panel-grid--4 group-summary-grid">
              <SkeletonV1 height={88} />
              <SkeletonV1 height={88} />
              <SkeletonV1 height={88} />
              <SkeletonV1 height={88} />
            </div>
          </CardV1>
        </div>
      ) : null}

      {listQuery.isError || companiesQuery.isError ? (
        <EmptyStateV1
          title="Group overview unavailable"
          description={toUserFacingErrorMessage(
            listQuery.error ?? companiesQuery.error,
          )}
          tone="error"
          role="alert"
          action={
            <ButtonV1
              onClick={() => {
                listQuery.refetch();
                companiesQuery.refetch();
              }}
            >
              Retry
            </ButtonV1>
          }
        />
      ) : null}

      {listQuery.isSuccess && companiesQuery.isSuccess && !overview ? (
        <EmptyStateV1
          title="No workspace group found"
          description="Add workspaces first, then return to this group overview."
        />
      ) : null}

      {overview ? (
        <section
          className="group-panel-section group-panel-section--overview"
          aria-label="Group profile and summary"
        >
          <header className="section-heading-row group-panel-heading-row">
            <div>
              <p className="micro-label">Group snapshot</p>
              <p className="group-panel-caption">
                Profile and stage coverage for the active company group.
              </p>
            </div>
            <StatusBadgeV1 label={overviewStatusLabel} tone={overviewStatusTone} />
          </header>
          <div className="panel-grid panel-grid--2 group-panel-overview-grid">
            <CardV1 className="group-profile-card">
              <header className="group-panel-section-header group-panel-section-header--split">
                <div className="group-panel-section-heading">
                  <p className="micro-label">{t("group.panel.profile")}</p>
                  <h2 className="section-title">{overview.profile.legalName}</h2>
                </div>
                <StatusBadgeV1 label={`Group ${overview.groupId}`} tone="neutral" />
              </header>
              <div className="group-profile-meta">
                <div>
                  <p className="micro-label">Org no</p>
                  <p className="group-profile-value">
                    {overview.profile.organizationNumber}
                  </p>
                </div>
                <div>
                  <p className="micro-label">Registered address</p>
                  <p className="group-profile-value">
                    {overview.profile.registeredAddress}
                  </p>
                </div>
              </div>
            </CardV1>

            <CardV1 className="group-summary-card">
              <header className="group-panel-section-header group-panel-section-header--split">
                <div className="group-panel-section-heading">
                  <p className="micro-label">{t("group.panel.summary")}</p>
                  <p className="group-summary-caption">
                    Current pipeline position across all active workspaces.
                  </p>
                </div>
                <StatusBadgeV1
                  label={`${overview.companies.length} active workspaces`}
                  tone={overviewStatusTone}
                />
              </header>
              <div className="panel-grid panel-grid--4 group-summary-grid">
                {overview.stageSummary.map((item) => (
                  <div key={item.label} className="group-summary-metric">
                    <p className="group-summary-value">{item.value}</p>
                    <p className="group-summary-label">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardV1>
          </div>
        </section>
      ) : null}

      {overview ? (
        <section
          className="group-panel-section group-panel-section--directory"
          aria-label="Company workspace directory"
        >
          <CardV1 className="group-directory-card">
            <div className="section-heading-row group-directory-heading-row">
              <div>
                <p className="micro-label">{t("group.panel.directory")}</p>
                <h2 className="section-title">Company workspace directory</h2>
                <p className="group-directory-caption">
                  Quick-open each workspace while preserving active context.
                </p>
              </div>
              <StatusBadgeV1
                label={`${overview.companies.length} companies`}
                tone={overviewStatusTone}
              />
            </div>
            <div className="table-wrap group-directory-table-wrap">
              <table className="group-directory-table">
                <caption className="group-directory-table-caption">
                  Group company workspace directory.
                </caption>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Workspace</th>
                    <th>Fiscal year</th>
                    <th>{t("common.status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview.companies.map((company) => {
                    const statusMeta = getWorkspaceStatusBadgeMetaV1(
                      company.latestStatus,
                    );

                    return (
                      <tr key={company.workspaceId}>
                        <td>
                          <div className="group-directory-company">
                            <p className="group-directory-cell-value">
                              {company.companyName}
                            </p>
                            <p className="group-directory-cell-meta">
                              {formatOrganizationNumberV1(
                                company.organizationNumber,
                              )}
                            </p>
                          </div>
                        </td>
                        <td>
                          <p className="group-directory-cell-value group-directory-cell-value--mono">
                            {company.workspaceId.slice(0, 8)}
                          </p>
                        </td>
                        <td>
                          <p className="group-directory-cell-value group-directory-cell-value--mono">
                            {company.fiscalYearStart} to {company.fiscalYearEnd}
                          </p>
                        </td>
                        <td>
                          <StatusBadgeV1
                            label={statusMeta.label}
                            tone={statusMeta.tone}
                          />
                        </td>
                        <td>
                          <ButtonV1
                            variant="primary"
                            className="group-directory-action"
                            onClick={() => {
                              setActiveContext({
                                activeWorkspaceId: company.workspaceId,
                                activeFiscalYear: company.fiscalYearEnd.slice(0, 4),
                              });
                              navigate(`/app/workspaces/${company.workspaceId}`);
                            }}
                          >
                            Open dashboard
                          </ButtonV1>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardV1>
        </section>
      ) : null}
    </section>
  );
}
