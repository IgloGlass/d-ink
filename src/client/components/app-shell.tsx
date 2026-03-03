import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useGlobalAppContextV1 } from "../app/app-context.v1";
import { toUserFacingErrorMessage } from "../lib/http/api-client";
import {
  type SessionPrincipalV1,
  currentSessionQueryKeyV1,
  logoutSessionV1,
} from "../lib/http/auth-api";
import { listWorkspacesByTenantV1 } from "../lib/http/workspace-api";
import { useI18nV1 } from "../lib/i18n/use-i18n.v1";
import { ButtonV1 } from "./button-v1";
import { CardV1 } from "./card-v1";
import { InputV1 } from "./input-v1";

const workspaceListKeyV1 = (tenantId: string) => ["workspaces", tenantId];
type WorkspaceSummaryV1 = Awaited<
  ReturnType<typeof listWorkspacesByTenantV1>
>["workspaces"][number];

export function AppShell({
  children,
  principal,
}: {
  children: React.ReactNode;
  principal: SessionPrincipalV1;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, locale, setLocale } = useI18nV1();
  const { activeFiscalYear, activeWorkspaceId, setActiveContext } =
    useGlobalAppContextV1();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState("");
  const [launcherActiveIndex, setLauncherActiveIndex] = useState(0);

  const logoutMutation = useMutation({
    mutationFn: logoutSessionV1,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: currentSessionQueryKeyV1,
      });
      navigate("/");
    },
  });

  const workspaceListQuery = useQuery({
    queryKey: workspaceListKeyV1(principal.tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setLauncherOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setLauncherOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!launcherOpen) {
      setLauncherQuery("");
      setLauncherActiveIndex(0);
    }
  }, [launcherOpen]);

  const filteredWorkspaces = useMemo(() => {
    const workspaces = workspaceListQuery.data?.workspaces ?? [];
    const query = launcherQuery.trim().toLowerCase();
    if (query.length === 0) {
      return workspaces.slice(0, 8);
    }
    return workspaces
      .filter((workspace) => {
        return (
          workspace.id.toLowerCase().includes(query) ||
          workspace.companyId.toLowerCase().includes(query) ||
          workspace.fiscalYearStart.includes(query) ||
          workspace.fiscalYearEnd.includes(query)
        );
      })
      .slice(0, 8);
  }, [launcherQuery, workspaceListQuery.data?.workspaces]);

  useEffect(() => {
    if (!launcherOpen) {
      return;
    }
    setLauncherActiveIndex((current) => {
      if (filteredWorkspaces.length === 0) {
        return -1;
      }
      if (current < 0) {
        return 0;
      }
      if (current >= filteredWorkspaces.length) {
        return filteredWorkspaces.length - 1;
      }
      return current;
    });
  }, [filteredWorkspaces.length, launcherOpen]);

  const closeLauncher = () => {
    setLauncherOpen(false);
  };

  const switchWorkspace = (workspace: WorkspaceSummaryV1) => {
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`,
    });
    navigate(`/app/workspaces/${workspace.id}/workbench`);
    closeLauncher();
  };

  const handleLauncherKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (filteredWorkspaces.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setLauncherActiveIndex((current) =>
        current >= filteredWorkspaces.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setLauncherActiveIndex((current) =>
        current <= 0 ? filteredWorkspaces.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && launcherActiveIndex >= 0) {
      event.preventDefault();
      switchWorkspace(filteredWorkspaces[launcherActiveIndex]);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <a className="brand" href="/">
            {t("app.brand")}
          </a>
          <nav className="main-nav" aria-label="Primary">
            <NavLink to="/app/workspaces">{t("nav.workspaces")}</NavLink>
            <NavLink to="/app/groups/default/control-panel">
              {t("nav.groups")}
            </NavLink>
            {principal.role === "Admin" ? (
              <NavLink to="/app/invite">{t("nav.invite")}</NavLink>
            ) : null}
          </nav>
        </div>

        <div className="app-header-right">
          <div className="app-context-badge" title={t("shell.context")}>
            <span>
              {activeWorkspaceId?.slice(0, 8) ??
                t("shell.notSelectedWorkspace")}
            </span>
            <span>-</span>
            <span>{activeFiscalYear ?? t("shell.notSelectedYear")}</span>
          </div>
          <ButtonV1
            className="app-launcher-trigger"
            onClick={() => setLauncherOpen(true)}
          >
            <span>{t("shell.quickSwitch")}</span>
            <kbd>{t("nav.commandHint")}</kbd>
          </ButtonV1>
          <div className="app-language-switch">
            <label className="micro-label" htmlFor="language-switch">
              {t("nav.language")}
            </label>
            <select
              id="language-switch"
              value={locale}
              onChange={(event) => setLocale(event.target.value as "en")}
              aria-label={t("nav.language")}
            >
              <option value="en">{t("language.en")}</option>
            </select>
          </div>
          <ButtonV1
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending
              ? t("nav.logoutPending")
              : t("nav.logout")}
          </ButtonV1>
        </div>
      </header>

      {logoutMutation.isError ? (
        <p className="error-text" role="alert">
          {toUserFacingErrorMessage(logoutMutation.error)}
        </p>
      ) : null}

      <main className="app-main">{children}</main>

      {launcherOpen ? (
        <dialog
          open
          className="launcher-overlay"
          aria-label={t("shell.quickSwitch")}
          aria-modal="true"
        >
          <CardV1 className="launcher-panel" tight>
            <div className="launcher-shell">
              <div className="launcher-header section-heading-row">
                <p className="micro-label">{t("shell.quickSwitch")}</p>
                <ButtonV1
                  variant="icon"
                  className="launcher-close"
                  onClick={closeLauncher}
                  aria-label={t("common.close")}
                >
                  ×
                </ButtonV1>
              </div>
              <InputV1
                autoFocus
                className="launcher-input"
                value={launcherQuery}
                onChange={(event) => setLauncherQuery(event.target.value)}
                onKeyDown={handleLauncherKeyDown}
                placeholder={t("workspace.selector.search")}
              />
              <div className="launcher-results panel-stack">
                {workspaceListQuery.isLoading ? (
                  <p className="hint-text">{t("workspace.selector.loading")}</p>
                ) : null}
                {workspaceListQuery.isError ? (
                  <p className="error-text">
                    {toUserFacingErrorMessage(workspaceListQuery.error)}
                  </p>
                ) : null}
                {filteredWorkspaces.map((workspace, index) => {
                  const isActive = index === launcherActiveIndex;
                  return (
                    <ButtonV1
                      key={workspace.id}
                      className="launcher-result"
                      data-active={isActive ? "true" : "false"}
                      onMouseEnter={() => setLauncherActiveIndex(index)}
                      onFocus={() => setLauncherActiveIndex(index)}
                      onClick={() => switchWorkspace(workspace)}
                    >
                      <span className="launcher-result-primary">
                        {workspace.companyId.slice(0, 8)}
                      </span>
                      <span className="launcher-result-secondary">
                        {workspace.fiscalYearStart} - {workspace.fiscalYearEnd}
                      </span>
                    </ButtonV1>
                  );
                })}
                {!workspaceListQuery.isLoading &&
                !workspaceListQuery.isError &&
                filteredWorkspaces.length === 0 ? (
                  <p className="hint-text">{t("workspace.selector.empty")}</p>
                ) : null}
              </div>
            </div>
          </CardV1>
        </dialog>
      ) : null}
    </div>
  );
}
