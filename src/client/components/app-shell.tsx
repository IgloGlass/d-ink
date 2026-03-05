import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  return Array.from(
    container.querySelectorAll<HTMLElement>(selectors.join(",")),
  ).filter(
    (element) => !element.hasAttribute("hidden") && element.tabIndex >= 0,
  );
}

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
  const launcherDialogRef = useRef<HTMLDialogElement | null>(null);
  const launcherCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const launcherInputRef = useRef<HTMLInputElement | null>(null);
  const activeLauncherOptionRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const shouldFocusLauncherOptionRef = useRef(false);
  const launcherDialogId = useId();
  const launcherListboxId = useId();
  const launcherShortcutHintId = useId();
  const launcherTitleId = useId();

  const focusActiveLauncherOption = useCallback(() => {
    queueMicrotask(() => {
      activeLauncherOptionRef.current?.focus();
    });
  }, []);

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

  const closeLauncher = useCallback(() => {
    shouldFocusLauncherOptionRef.current = false;
    setLauncherOpen(false);
  }, []);

  const toggleLauncher = useCallback(() => {
    setLauncherOpen((current) => !current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleLauncher();
        return;
      }

      if (event.key === "Escape" && launcherOpen) {
        event.preventDefault();
        closeLauncher();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeLauncher, launcherOpen, toggleLauncher]);

  useEffect(() => {
    if (!launcherOpen) {
      return;
    }

    const dialogElement = launcherDialogRef.current;
    if (!dialogElement) {
      return;
    }

    const onDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialogElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const activeInsideDialog =
        activeElement !== null && dialogElement.contains(activeElement);

      if (event.shiftKey) {
        if (!activeInsideDialog || activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (!activeInsideDialog || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialogElement.addEventListener("keydown", onDialogKeyDown);
    return () => dialogElement.removeEventListener("keydown", onDialogKeyDown);
  }, [launcherOpen]);

  useEffect(() => {
    if (launcherOpen) {
      previousFocusedElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      queueMicrotask(() => {
        launcherInputRef.current?.focus();
      });
      return;
    }

    setLauncherQuery("");
    setLauncherActiveIndex(0);
    shouldFocusLauncherOptionRef.current = false;

    const previousFocusedElement = previousFocusedElementRef.current;
    previousFocusedElementRef.current = null;
    if (previousFocusedElement) {
      queueMicrotask(() => {
        previousFocusedElement.focus();
      });
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

  useEffect(() => {
    if (!launcherOpen || launcherActiveIndex < 0) {
      return;
    }
    const activeLauncherOption = activeLauncherOptionRef.current;
    activeLauncherOption?.scrollIntoView({ block: "nearest" });
    if (shouldFocusLauncherOptionRef.current) {
      activeLauncherOption?.focus();
      shouldFocusLauncherOptionRef.current = false;
    }
  }, [launcherActiveIndex, launcherOpen]);

  const switchWorkspace = (workspace: WorkspaceSummaryV1) => {
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`,
    });
    navigate(`/app/workspaces/${workspace.id}/workbench`);
    closeLauncher();
  };

  const handleLauncherNavigation = (
    event: React.KeyboardEvent<HTMLElement>,
  ) => {
    const eventTarget = event.currentTarget;
    const navigationStartsFromInput = eventTarget === launcherInputRef.current;

    if (event.key === "Escape") {
      event.preventDefault();
      closeLauncher();
      return;
    }

    if (!navigationStartsFromInput) {
      const isTypeaheadKey =
        event.key.length === 1 &&
        event.key !== " " &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey;
      if (isTypeaheadKey) {
        event.preventDefault();
        launcherInputRef.current?.focus();
        setLauncherQuery((current) => `${current}${event.key}`);
        setLauncherActiveIndex(0);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        launcherInputRef.current?.focus();
        setLauncherQuery((current) => current.slice(0, -1));
        setLauncherActiveIndex(0);
        return;
      }
    }

    if (filteredWorkspaces.length === 0) {
      if (event.key === "Tab" && !event.shiftKey && navigationStartsFromInput) {
        event.preventDefault();
        launcherCloseButtonRef.current?.focus();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (navigationStartsFromInput) {
        if (launcherActiveIndex < 0) {
          shouldFocusLauncherOptionRef.current = true;
          setLauncherActiveIndex(0);
          return;
        }
        focusActiveLauncherOption();
        return;
      }
      setLauncherActiveIndex((current) =>
        current >= filteredWorkspaces.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (navigationStartsFromInput) {
        if (launcherActiveIndex < 0) {
          shouldFocusLauncherOptionRef.current = true;
          setLauncherActiveIndex(filteredWorkspaces.length - 1);
          return;
        }
        focusActiveLauncherOption();
        return;
      }
      setLauncherActiveIndex((current) =>
        current <= 0 ? filteredWorkspaces.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setLauncherActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setLauncherActiveIndex(filteredWorkspaces.length - 1);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && navigationStartsFromInput) {
      event.preventDefault();
      if (launcherActiveIndex < 0) {
        shouldFocusLauncherOptionRef.current = true;
        setLauncherActiveIndex(0);
        return;
      }
      focusActiveLauncherOption();
      return;
    }

    if (event.key === "Tab" && event.shiftKey && !navigationStartsFromInput) {
      event.preventDefault();
      launcherInputRef.current?.focus();
      return;
    }

    if (event.key === "Enter" && launcherActiveIndex >= 0) {
      event.preventDefault();
      switchWorkspace(filteredWorkspaces[launcherActiveIndex]);
    }
  };

  const handleLauncherBackdropMouseDown = (
    event: React.MouseEvent<HTMLDialogElement>,
  ) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      closeLauncher();
    }
  };

  const activeWorkspaceIdInLauncher =
    launcherActiveIndex >= 0 && launcherActiveIndex < filteredWorkspaces.length
      ? filteredWorkspaces[launcherActiveIndex]?.id
      : undefined;
  const activeWorkspaceLabel =
    activeWorkspaceId?.slice(0, 8) ?? t("shell.notSelectedWorkspace");
  const activeFiscalYearLabel = activeFiscalYear ?? t("shell.notSelectedYear");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <a className="brand" href="/">
            {t("app.brand")}
          </a>
          <span className="app-header-divider" aria-hidden="true" />
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
          <div
            className="app-context-badge"
            title={t("shell.context")}
            aria-live="polite"
          >
            <span className="app-context-badge__label">
              {t("shell.context")}
            </span>
            <span className="app-context-badge__values">
              <span
                className="app-context-badge__value"
                title={activeWorkspaceLabel}
              >
                {activeWorkspaceLabel}
              </span>
              <span className="app-context-badge__separator" aria-hidden="true">
                /
              </span>
              <span
                className="app-context-badge__value"
                title={activeFiscalYearLabel}
              >
                {activeFiscalYearLabel}
              </span>
            </span>
          </div>
          <div className="app-header-controls">
            <ButtonV1
              tone="shell"
              size="sm"
              className="app-launcher-trigger"
              onClick={toggleLauncher}
              aria-haspopup="dialog"
              aria-expanded={launcherOpen}
              aria-controls={launcherDialogId}
              aria-describedby={launcherShortcutHintId}
              aria-keyshortcuts="Control+J Meta+J"
              data-shell-active={launcherOpen ? "true" : "false"}
            >
              <span>{t("shell.quickSwitch")}</span>
              <kbd id={launcherShortcutHintId}>{t("nav.commandHint")}</kbd>
            </ButtonV1>
            <div className="app-language-switch">
              <label
                className="app-language-switch__label"
                htmlFor="language-switch"
              >
                {t("nav.language")}
              </label>
              <div className="app-language-switch__field-wrap">
                <select
                  id="language-switch"
                  className="app-header-control app-language-switch__field"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as "en")}
                  aria-label={t("nav.language")}
                >
                  <option value="en">{t("language.en")}</option>
                </select>
              </div>
            </div>
            <ButtonV1
              tone="shell"
              size="sm"
              className="app-logout-trigger"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending
                ? t("nav.logoutPending")
                : t("nav.logout")}
            </ButtonV1>
          </div>
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
          id={launcherDialogId}
          ref={launcherDialogRef}
          open
          className="launcher-overlay"
          aria-labelledby={launcherTitleId}
          aria-modal="true"
          onMouseDown={handleLauncherBackdropMouseDown}
        >
          <CardV1 className="launcher-panel" tight>
            <div className="launcher-shell">
              <div className="launcher-header section-heading-row">
                <p id={launcherTitleId} className="micro-label">
                  {t("shell.quickSwitch")}
                </p>
                <ButtonV1
                  ref={launcherCloseButtonRef}
                  variant="icon"
                  className="launcher-close"
                  onClick={closeLauncher}
                  aria-label={t("common.close")}
                >
                  ×
                </ButtonV1>
              </div>
              <InputV1
                ref={launcherInputRef}
                tone="shell"
                className="launcher-input"
                value={launcherQuery}
                onChange={(event) => {
                  setLauncherQuery(event.target.value);
                  setLauncherActiveIndex(0);
                }}
                onKeyDown={handleLauncherNavigation}
                placeholder={t("workspace.selector.search")}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={launcherOpen}
                aria-controls={launcherListboxId}
                aria-activedescendant={
                  activeWorkspaceIdInLauncher
                    ? `launcher-option-${activeWorkspaceIdInLauncher}`
                    : undefined
                }
              />
              <div
                id={launcherListboxId}
                className="launcher-results"
                aria-label={t("workspace.selector.search")}
                aria-busy={workspaceListQuery.isLoading}
              >
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
                      id={`launcher-option-${workspace.id}`}
                      className="launcher-result"
                      aria-pressed={isActive}
                      data-active={isActive ? "true" : "false"}
                      tabIndex={isActive ? 0 : -1}
                      ref={isActive ? activeLauncherOptionRef : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setLauncherActiveIndex(index)}
                      onFocus={() => setLauncherActiveIndex(index)}
                      onKeyDown={handleLauncherNavigation}
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
