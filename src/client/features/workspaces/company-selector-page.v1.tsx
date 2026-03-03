import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { InputV1 } from "../../components/input-v1";
import { StatusPill } from "../../components/status-pill";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import { listWorkspacesByTenantV1 } from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];

export function CompanySelectorPageV1() {
  const navigate = useNavigate();
  const { t } = useI18nV1();
  const principal = useRequiredSessionPrincipalV1();
  const { setActiveContext } = useGlobalAppContextV1();
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const listQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(principal.tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });

  const filteredWorkspaces = useMemo(() => {
    const workspaces = listQuery.data?.workspaces ?? [];
    const query = search.trim().toLowerCase();
    if (query.length === 0) {
      return workspaces;
    }
    return workspaces.filter((workspace) => {
      return (
        workspace.companyId.toLowerCase().includes(query) ||
        workspace.id.toLowerCase().includes(query) ||
        workspace.fiscalYearStart.includes(query) ||
        workspace.fiscalYearEnd.includes(query)
      );
    });
  }, [listQuery.data?.workspaces, search]);

  const suggestionList = filteredWorkspaces.slice(0, 8);

  const openWorkspace = (workspaceId: string, fiscalYear: string) => {
    setActiveContext({
      activeWorkspaceId: workspaceId,
      activeFiscalYear: fiscalYear,
    });
    navigate(`/app/workspaces/${workspaceId}/workbench`);
  };

  return (
    <section className="page-wrap">
      <CardV1>
        <p className="micro-label">{t("workspace.selector.title")}</p>
        <h1 className="page-title">{t("workspace.selector.title")}</h1>
        <p className="hint-text">{t("workspace.selector.subtitle")}</p>
        <p>
          <a href="/templates/trial-balance-template-v1.xlsx" download>
            {t("workspace.selector.templateLink")}
          </a>
        </p>
        <div style={{ position: "relative", maxWidth: "680px" }}>
          <InputV1
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, suggestionList.length - 1),
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === "Enter" && suggestionList[activeIndex]) {
                event.preventDefault();
                const selected = suggestionList[activeIndex];
                openWorkspace(
                  selected.id,
                  `${selected.fiscalYearStart} to ${selected.fiscalYearEnd}`,
                );
              }
            }}
            placeholder={t("workspace.selector.search")}
            aria-label={t("workspace.selector.search")}
          />
          {search.trim().length > 0 && suggestionList.length > 0 ? (
            <div className="search-combobox-menu">
              {suggestionList.map((workspace, index) => (
                <button
                  key={workspace.id}
                  type="button"
                  className="search-combobox-option"
                  aria-selected={index === activeIndex}
                  onClick={() =>
                    openWorkspace(
                      workspace.id,
                      `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`,
                    )
                  }
                >
                  {workspace.companyId.slice(0, 8)} -{" "}
                  {workspace.fiscalYearStart}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </CardV1>

      <CardV1>
        <h2 className="section-title">{t("nav.workspaces")}</h2>
        {listQuery.isPending ? <p>{t("workspace.selector.loading")}</p> : null}
        {listQuery.isError ? (
          <p className="error-text" role="alert">
            {toUserFacingErrorMessage(listQuery.error)}
          </p>
        ) : null}
        {listQuery.isSuccess ? (
          filteredWorkspaces.length === 0 ? (
            <p>{t("workspace.selector.empty")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Company</th>
                    <th>Fiscal year</th>
                    <th>{t("common.status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((workspace) => {
                    const fiscalYear = `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`;
                    return (
                      <tr key={workspace.id}>
                        <td>{workspace.id.slice(0, 8)}</td>
                        <td>{workspace.companyId.slice(0, 8)}</td>
                        <td>{fiscalYear}</td>
                        <td>
                          <StatusPill status={workspace.status} />
                        </td>
                        <td>
                          <ButtonV1
                            variant="primary"
                            onClick={() =>
                              openWorkspace(workspace.id, fiscalYear)
                            }
                          >
                            {t("workspace.selector.continue")}
                          </ButtonV1>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </CardV1>
    </section>
  );
}
