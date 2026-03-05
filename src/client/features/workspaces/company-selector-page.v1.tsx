import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
const MAX_SUGGESTIONS = 8;

type SearchableWorkspaceV1 = {
  id: string;
  companyId: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  status: string;
  updatedAt: string;
};

function formatCompactId(value: string): string {
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function toFiscalYearLabel(workspace: {
  fiscalYearStart: string;
  fiscalYearEnd: string;
}): string {
  return `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`;
}

function computeWorkspaceMatchScore(
  workspace: SearchableWorkspaceV1,
  query: string,
): number {
  const matchValues: Array<{ value: string; baseScore: number }> = [
    { value: workspace.companyId.toLowerCase(), baseScore: 0 },
    { value: workspace.id.toLowerCase(), baseScore: 3 },
    { value: workspace.fiscalYearStart.toLowerCase(), baseScore: 6 },
    { value: workspace.fiscalYearEnd.toLowerCase(), baseScore: 6 },
  ];

  let bestScore = Number.POSITIVE_INFINITY;
  for (const { value, baseScore } of matchValues) {
    if (value === query) {
      bestScore = Math.min(bestScore, baseScore);
      continue;
    }
    if (value.startsWith(query)) {
      bestScore = Math.min(bestScore, baseScore + 1);
      continue;
    }
    if (value.includes(query)) {
      bestScore = Math.min(bestScore, baseScore + 2);
    }
  }
  return bestScore;
}

function compareWorkspaceRecency(
  left: SearchableWorkspaceV1,
  right: SearchableWorkspaceV1,
): number {
  const updatedAtCompare = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedAtCompare !== 0) {
    return updatedAtCompare;
  }
  const companyCompare = left.companyId.localeCompare(right.companyId);
  if (companyCompare !== 0) {
    return companyCompare;
  }
  return left.id.localeCompare(right.id);
}

export function CompanySelectorPageV1() {
  const navigate = useNavigate();
  const { t } = useI18nV1();
  const principal = useRequiredSessionPrincipalV1();
  const { setActiveContext } = useGlobalAppContextV1();
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(false);
  const suggestionMenuRef = useRef<HTMLDivElement | null>(null);
  const suggestionListId = useId();
  const searchHintId = `${suggestionListId}-hint`;

  const listQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(principal.tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId: principal.tenantId }),
  });

  const normalizedSearch = search.trim().toLowerCase();
  const workspaces = listQuery.data?.workspaces ?? [];

  const filteredWorkspaces = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return [...workspaces].sort(compareWorkspaceRecency);
    }
    return workspaces
      .map((workspace) => ({
        workspace,
        score: computeWorkspaceMatchScore(workspace, normalizedSearch),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }
        return compareWorkspaceRecency(left.workspace, right.workspace);
      })
      .map((entry) => entry.workspace);
  }, [workspaces, normalizedSearch]);

  const suggestionList = useMemo(
    () => filteredWorkspaces.slice(0, MAX_SUGGESTIONS),
    [filteredWorkspaces],
  );
  const hasSuggestions = suggestionList.length > 0;
  const shouldShowSuggestionPanel =
    isSuggestionMenuOpen && normalizedSearch.length > 0;
  const shouldShowSuggestions = shouldShowSuggestionPanel && hasSuggestions;
  const activeSuggestion = suggestionList[activeIndex];
  const activeOptionId =
    shouldShowSuggestions && activeSuggestion
      ? `${suggestionListId}-${activeSuggestion.id}`
      : undefined;
  const resultCountLabel =
    normalizedSearch.length > 0
      ? `${filteredWorkspaces.length} matching workspace${
          filteredWorkspaces.length === 1 ? "" : "s"
        }`
      : `${filteredWorkspaces.length} total workspace${
          filteredWorkspaces.length === 1 ? "" : "s"
        }`;
  const resultScopeLabel =
    normalizedSearch.length > 0 ? "search results" : "directory";
  const topResultWorkspaceId =
    normalizedSearch.length > 0 ? filteredWorkspaces[0]?.id : undefined;
  const quickSuggestionLabel =
    normalizedSearch.length > 0
      ? hasSuggestions
        ? `${suggestionList.length} quick suggestion${suggestionList.length === 1 ? "" : "s"}`
        : "No quick suggestions in this directory"
      : "Type to surface quick suggestions";

  useEffect(() => {
    if (suggestionList.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, suggestionList.length - 1));
  }, [suggestionList.length]);

  useEffect(() => {
    if (!shouldShowSuggestions || !activeSuggestion) {
      return;
    }
    const activeOption = suggestionMenuRef.current?.querySelector<HTMLElement>(
      `[data-option-id="${activeSuggestion.id}"]`,
    );
    activeOption?.scrollIntoView?.({ block: "nearest" });
  }, [shouldShowSuggestions, activeSuggestion]);

  const openWorkspace = (workspaceId: string, fiscalYear: string) => {
    setActiveContext({
      activeWorkspaceId: workspaceId,
      activeFiscalYear: fiscalYear,
    });
    navigate(`/app/workspaces/${workspaceId}/workbench`);
  };

  const selectWorkspace = (workspace: SearchableWorkspaceV1) => {
    setIsSuggestionMenuOpen(false);
    openWorkspace(workspace.id, toFiscalYearLabel(workspace));
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
        <div
          className="company-selector-search"
          onBlur={(event) => {
            const nextFocusTarget = event.relatedTarget;
            if (
              nextFocusTarget instanceof Node &&
              event.currentTarget.contains(nextFocusTarget)
            ) {
              return;
            }
            setIsSuggestionMenuOpen(false);
          }}
          onFocus={() => {
            if (normalizedSearch.length > 0) {
              setIsSuggestionMenuOpen(true);
            }
          }}
          data-suggestion-open={shouldShowSuggestionPanel ? "true" : "false"}
        >
          <InputV1
            className="company-selector-search-input"
            value={search}
            onChange={(event) => {
              const nextSearch = event.target.value;
              setSearch(nextSearch);
              setActiveIndex(0);
              setIsSuggestionMenuOpen(nextSearch.trim().length > 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!hasSuggestions) {
                  return;
                }
                setIsSuggestionMenuOpen(true);
                setActiveIndex((current) =>
                  shouldShowSuggestions
                    ? (current + 1) % suggestionList.length
                    : 0,
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (!hasSuggestions) {
                  return;
                }
                setIsSuggestionMenuOpen(true);
                setActiveIndex((current) =>
                  shouldShowSuggestions
                    ? current <= 0
                      ? suggestionList.length - 1
                      : current - 1
                    : suggestionList.length - 1,
                );
              }
              if (event.key === "Home" && shouldShowSuggestions) {
                event.preventDefault();
                setActiveIndex(0);
              }
              if (event.key === "End" && shouldShowSuggestions) {
                event.preventDefault();
                setActiveIndex(suggestionList.length - 1);
              }
              if (event.key === "Enter") {
                const selectedSuggestion = shouldShowSuggestions
                  ? suggestionList[activeIndex]
                  : normalizedSearch.length > 0
                    ? suggestionList[0]
                    : undefined;
                if (selectedSuggestion) {
                  event.preventDefault();
                  selectWorkspace(selectedSuggestion);
                }
              }
              if (event.key === "Escape") {
                setIsSuggestionMenuOpen(false);
                setActiveIndex(0);
              }
              if (event.key === "Tab") {
                setIsSuggestionMenuOpen(false);
              }
            }}
            placeholder={t("workspace.selector.search")}
            aria-label={t("workspace.selector.search")}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={suggestionListId}
            aria-expanded={shouldShowSuggestionPanel}
            aria-activedescendant={activeOptionId}
            aria-describedby={searchHintId}
            aria-haspopup="listbox"
            autoComplete="off"
          />
          <p id={searchHintId} className="company-selector-search-hint">
            Use Arrow Up and Arrow Down to scan suggestions. Press Enter to
            continue.
          </p>
          <div className="company-selector-search-meta" aria-live="polite">
            <p className="company-selector-search-summary">
              {resultCountLabel} in {resultScopeLabel}
            </p>
            <p className="company-selector-search-summary-secondary">
              {quickSuggestionLabel}
            </p>
          </div>
          {shouldShowSuggestionPanel ? (
            <div
              ref={suggestionMenuRef}
              className="search-combobox-menu"
              id={suggestionListId}
              aria-label={t("workspace.selector.search")}
            >
              {hasSuggestions ? (
                suggestionList.map((workspace, index) => (
                  <button
                    key={workspace.id}
                    type="button"
                    className="search-combobox-option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    data-active={index === activeIndex ? "true" : "false"}
                    data-option-id={workspace.id}
                    id={`${suggestionListId}-${workspace.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectWorkspace(workspace)}
                  >
                    <span className="search-combobox-option-row">
                      <span className="search-combobox-option-primary">
                        {formatCompactId(workspace.companyId)}
                      </span>
                      <StatusPill status={workspace.status} />
                    </span>
                    <span className="search-combobox-option-meta">
                      {toFiscalYearLabel(workspace)} | WS{" "}
                      {formatCompactId(workspace.id)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="search-combobox-empty">
                  {t("workspace.selector.empty")}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </CardV1>

      <CardV1>
        <div className="company-selector-list-header">
          <h2 className="section-title">{t("nav.workspaces")}</h2>
          <p className="company-selector-list-summary" aria-live="polite">
            {resultCountLabel} in {resultScopeLabel}
          </p>
        </div>
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
              <table className="company-selector-table">
                <thead>
                  <tr>
                    <th scope="col">Workspace</th>
                    <th scope="col">Company</th>
                    <th scope="col">Fiscal year</th>
                    <th scope="col">{t("common.status")}</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((workspace) => {
                    const fiscalYear = toFiscalYearLabel(workspace);
                    return (
                      <tr
                        key={workspace.id}
                        className="company-selector-table-row"
                        data-top-match={
                          topResultWorkspaceId === workspace.id
                            ? "true"
                            : "false"
                        }
                      >
                        <th scope="row">
                          <p className="company-selector-cell-primary">
                            {formatCompactId(workspace.id)}
                          </p>
                          <p className="company-selector-cell-meta">
                            Updated {workspace.updatedAt.slice(0, 10)}
                          </p>
                        </th>
                        <td>
                          <p className="company-selector-cell-primary">
                            {formatCompactId(workspace.companyId)}
                          </p>
                          <p className="company-selector-cell-meta">
                            {workspace.companyId}
                          </p>
                        </td>
                        <td className="company-selector-cell-fiscal">
                          {fiscalYear}
                        </td>
                        <td>
                          <StatusPill status={workspace.status} />
                        </td>
                        <td className="company-selector-cell-action">
                          <ButtonV1
                            variant="primary"
                            size="sm"
                            className="company-selector-continue-button"
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
