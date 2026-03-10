import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import {
  readWorkspaceIdFromPathnameV1,
  useGlobalAppContextV1,
} from "../app/app-context.v1";
import {
  buildCoreModulePathV1,
  coreModuleDefinitionsV1,
} from "../app/core-modules.v1";
import {
  buildFiscalYearOptionsV1,
  replaceWorkspaceIdInPathnameV1,
  resolveWorkspaceForCompanyAndFiscalYearV1,
} from "../lib/fiscal-year.v1";
import { listCompaniesByTenantV1 } from "../lib/http/company-api";
import {
  currentSessionQueryKeyV1,
  logoutSessionV1,
  type SessionPrincipalV1,
} from "../lib/http/auth-api";
import { listWorkspacesByTenantV1, type WorkspaceV1 } from "../lib/http/workspace-api";
import { ButtonV1 } from "./button-v1";
import { LauncherV1 } from "./launcher-v1";
import { StatusPill } from "./status-pill";

function resolveSiblingWorkspaceV1(input: {
  activeFiscalYear: string | null;
  currentWorkspace: WorkspaceV1 | null;
  workspaces: WorkspaceV1[];
}): WorkspaceV1 | null {
  if (!input.currentWorkspace) {
    return null;
  }

  return resolveWorkspaceForCompanyAndFiscalYearV1({
    companyId: input.currentWorkspace.companyId,
    fiscalYearKey: input.activeFiscalYear,
    workspaces: input.workspaces,
  });
}

export function AppShell({
  children,
  principal,
}: {
  children: ReactNode;
  principal: SessionPrincipalV1;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { activeFiscalYear, setActiveContext } = useGlobalAppContextV1();
  const [launcherOpen, setLauncherOpen] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ["companies", principal.tenantId],
    queryFn: () => listCompaniesByTenantV1({ tenantId: principal.tenantId }),
  });

  const workspacesQuery = useQuery({
    queryKey: ["workspaces", principal.tenantId],
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });

  const logoutMutation = useMutation({
    mutationFn: logoutSessionV1,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: currentSessionQueryKeyV1,
      });
      navigate("/");
    },
  });

  const closeLauncher = useCallback(() => {
    setLauncherOpen(false);
  }, []);

  const toggleLauncher = useCallback(() => {
    setLauncherOpen((current) => !current);
  }, []);

  const openLauncher = useCallback(() => {
    setLauncherOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        if (launcherOpen) {
          closeLauncher();
          return;
        }

        openLauncher();
        return;
      }

      if (event.key === "Escape" && launcherOpen) {
        event.preventDefault();
        closeLauncher();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeLauncher, launcherOpen, openLauncher]);

  const allCompanies = companiesQuery.data?.companies ?? [];
  const allWorkspaces = workspacesQuery.data?.workspaces ?? [];
  const fiscalYearOptions = useMemo(
    () =>
      buildFiscalYearOptionsV1({
        companies: allCompanies,
        workspaces: allWorkspaces,
      }),
    [allCompanies, allWorkspaces],
  );

  useEffect(() => {
    if (activeFiscalYear || fiscalYearOptions.length === 0) {
      return;
    }

    setActiveContext({
      activeFiscalYear: fiscalYearOptions[0],
    });
  }, [activeFiscalYear, fiscalYearOptions, setActiveContext]);

  const workspaceIdFromPath = readWorkspaceIdFromPathnameV1(location.pathname);
  const currentWorkspace =
    allWorkspaces.find((workspace) => workspace.id === workspaceIdFromPath) ?? null;
  const currentCompany =
    currentWorkspace === null
      ? null
      : allCompanies.find((company) => company.id === currentWorkspace.companyId) ??
        null;
  const isWorkspacePath = workspaceIdFromPath !== null;

  const handleFiscalYearChange = (nextFiscalYear: string) => {
    const nextWorkspace = resolveSiblingWorkspaceV1({
      activeFiscalYear: nextFiscalYear,
      currentWorkspace,
      workspaces: allWorkspaces,
    });

    setActiveContext({ activeFiscalYear: nextFiscalYear });

    if (!currentWorkspace) {
      return;
    }

    if (nextWorkspace && nextWorkspace.id !== currentWorkspace.id) {
      setActiveContext({
        activeFiscalYear: nextFiscalYear,
        activeWorkspaceId: nextWorkspace.id,
      });

      navigate(
        replaceWorkspaceIdInPathnameV1({
          pathname: location.pathname,
          nextWorkspaceId: nextWorkspace.id,
        }),
      );
      return;
    }

    // When the selected year has no existing sibling workspace, send the user
    // back to the company landing so they can create/open the correct year.
    setActiveContext({ activeWorkspaceId: null });
    navigate("/app/workspaces");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <NavLink className="brand" to="/app/workspaces">
            Deloitte<span className="brand-dot">.</span>
          </NavLink>
          <nav className="app-primary-nav">
            <NavLink
              to="/app/workspaces"
              className={({ isActive }) =>
                `app-primary-link${isActive ? " app-primary-link--active" : ""}`
              }
            >
              Companies
            </NavLink>
            <NavLink
              to="/app/groups/default/control-panel"
              className={({ isActive }) =>
                `app-primary-link${isActive ? " app-primary-link--active" : ""}`
              }
            >
              Groups
            </NavLink>
          </nav>
          {currentCompany ? (
            <div className="app-context-chip">
              <span className="app-context-chip__label">Current company</span>
              <strong>{currentCompany.legalName}</strong>
            </div>
          ) : null}
        </div>

        <div className="app-header-right">
          <label className="app-header-select">
            <span>Fiscal year</span>
            <select
              value={activeFiscalYear ?? ""}
              onChange={(event) => handleFiscalYearChange(event.target.value)}
              disabled={fiscalYearOptions.length === 0}
            >
              {fiscalYearOptions.map((fiscalYearOption) => (
                <option key={fiscalYearOption} value={fiscalYearOption}>
                  FY {fiscalYearOption}
                </option>
              ))}
            </select>
          </label>

          {currentWorkspace ? <StatusPill status={currentWorkspace.status} /> : null}

          <ButtonV1 onClick={toggleLauncher}>
            <span>Quick Search</span>
            <kbd className="app-shortcut-kbd">Ctrl+J</kbd>
          </ButtonV1>

          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="app-logout-button"
          >
            Logout
          </button>
        </div>
      </header>

      {isWorkspacePath && workspaceIdFromPath ? (
        <div className="module-tab-bar">
          <div className="module-tab-bar__inner">
            <NavLink
              to={`/app/workspaces/${workspaceIdFromPath}`}
              className="module-home-link"
            >
              Dashboard
            </NavLink>
            {coreModuleDefinitionsV1.map((moduleDefinition) => (
              <NavLink
                key={moduleDefinition.slug}
                to={buildCoreModulePathV1(
                  workspaceIdFromPath,
                  moduleDefinition.slug,
                )}
                className={({ isActive }) =>
                  `module-tab${isActive ? " module-tab--active" : ""}`
                }
              >
                <span className="module-tab__step">{moduleDefinition.step}</span>
                <span>{moduleDefinition.shortLabel}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}

      <main className="app-main animate-fade-in">{children}</main>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <div className="app-footer__brand">
            Deloitte<span className="brand-dot">.</span>
          </div>
          <div className="app-footer__meta">
            AI-powered Swedish corporate tax workflow
          </div>
        </div>
      </footer>

      <LauncherV1
        isOpen={launcherOpen}
        onClose={closeLauncher}
        tenantId={principal.tenantId}
      />
    </div>
  );
}
