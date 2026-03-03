import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import {
  StatusBadgeV1,
  type StatusToneV1,
} from "../../components/status-badge-v1";
import { groupControlPanelAdapterV1 } from "../../lib/adapters/group-control-panel-adapter.v1";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  type WorkspaceStatusV1,
  listWorkspacesByTenantV1,
} from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];

const statusLabelByValueV1: Record<WorkspaceStatusV1, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  ready_for_approval: "Ready for approval",
  approved_for_export: "Approved for export",
  exported: "Exported",
  client_accepted: "Client accepted",
  filed: "Filed",
};

const statusToneByValueV1: Record<WorkspaceStatusV1, StatusToneV1> = {
  draft: "warning",
  in_review: "warning",
  changes_requested: "attention",
  ready_for_approval: "neutral",
  approved_for_export: "success",
  exported: "success",
  client_accepted: "success",
  filed: "success",
};

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

  const overview =
    listQuery.data?.workspaces &&
    groupControlPanelAdapterV1.getGroupOverview({
      groupId,
      workspaces: listQuery.data.workspaces,
    });

  return (
    <section className="page-wrap">
      <CardV1 className="group-panel-hero-card">
        <p className="micro-label">{t("group.panel.title")}</p>
        <h1 className="page-title">{t("group.panel.title")}</h1>
        <p className="hint-text">{t("group.panel.subtitle")}</p>
      </CardV1>

      {listQuery.isError ? (
        <CardV1>
          <p className="error-text">
            {toUserFacingErrorMessage(listQuery.error)}
          </p>
        </CardV1>
      ) : null}

      {overview ? (
        <div className="panel-grid panel-grid--2 group-panel-overview-grid">
          <CardV1 className="group-profile-card">
            <p className="micro-label">{t("group.panel.profile")}</p>
            <h2 className="section-title">{overview.profile.legalName}</h2>
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
            <p className="micro-label">{t("group.panel.summary")}</p>
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
      ) : null}

      {overview ? (
        <CardV1 className="group-directory-card">
          <div className="section-heading-row">
            <div>
              <p className="micro-label">{t("group.panel.directory")}</p>
              <h2 className="section-title">Company workspace directory</h2>
            </div>
            <StatusBadgeV1
              label={`${overview.companies.length} companies`}
              tone="neutral"
            />
          </div>
          <div className="table-wrap">
            <table>
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
                {overview.companies.map((company) => (
                  <tr key={company.workspaceId}>
                    <td>{company.companyId.slice(0, 8)}</td>
                    <td>{company.workspaceId.slice(0, 8)}</td>
                    <td>
                      {company.fiscalYearStart} to {company.fiscalYearEnd}
                    </td>
                    <td>
                      <StatusBadgeV1
                        label={statusLabelByValueV1[company.latestStatus]}
                        tone={statusToneByValueV1[company.latestStatus]}
                      />
                    </td>
                    <td>
                      <ButtonV1
                        variant="primary"
                        className="group-directory-action"
                        onClick={() => {
                          setActiveContext({
                            activeWorkspaceId: company.workspaceId,
                            activeFiscalYear: `${company.fiscalYearStart} to ${company.fiscalYearEnd}`,
                          });
                          navigate(
                            `/app/workspaces/${company.workspaceId}/workbench`,
                          );
                        }}
                      >
                        {t("workspace.selector.continue")}
                      </ButtonV1>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardV1>
      ) : null}
    </section>
  );
}
