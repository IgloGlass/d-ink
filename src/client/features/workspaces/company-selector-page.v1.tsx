import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { InputV1 } from "../../components/input-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { StatusPill } from "../../components/status-pill";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  createCompanyV1,
  listCompaniesByTenantV1,
} from "../../lib/http/company-api";
import {
  type WorkspaceV1,
  createWorkspaceV1,
  listWorkspacesByTenantV1,
} from "../../lib/http/workspace-api";

const companyListQueryKeyV1 = (tenantId: string) => ["companies", tenantId];
const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];

const demoCompaniesV1 = [
  ["Nordic Fika Goods AB", "5561231234"],
  ["Skylight Digital Studio AB", "5562342345"],
  ["Baltic Precision Parts AB", "5563453456"],
] as const;

function normalizeOrgNoV1(value: string): string {
  return value.replace(/\D/g, "");
}

function formatOrgNoV1(value: string): string {
  const digits = normalizeOrgNoV1(value);
  return digits.length === 10
    ? `${digits.slice(0, 6)}-${digits.slice(6)}`
    : value;
}

function toFiscalYearLabelV1(workspace: {
  fiscalYearStart: string;
  fiscalYearEnd: string;
}): string {
  return `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`;
}

function compareWorkspaceRecencyV1(
  left: WorkspaceV1,
  right: WorkspaceV1,
): number {
  const byUpdate = right.updatedAt.localeCompare(left.updatedAt);
  return byUpdate !== 0 ? byUpdate : left.id.localeCompare(right.id);
}

type DirectoryRowV1 = {
  company: {
    id: string;
    tenantId: string;
    legalName: string;
    organizationNumber: string;
    defaultFiscalYearStart: string;
    defaultFiscalYearEnd: string;
    createdAt: string;
    updatedAt: string;
  };
  latest: WorkspaceV1 | null;
  count: number;
  isLegacyWorkspaceOnly: boolean;
};

type SearchIndexedRowV1 = {
  row: DirectoryRowV1;
  searchBlob: string;
};

function rankDirectoryMatchV1(input: {
  row: DirectoryRowV1;
  search: string;
}): number {
  const search = input.search;
  const legalName = input.row.company.legalName.toLowerCase();
  const formattedOrgNo = formatOrgNoV1(input.row.company.organizationNumber)
    .toLowerCase();
  const workspaceId = input.row.latest?.id.toLowerCase() ?? "";
  const status = input.row.latest?.status.toLowerCase() ?? "";
  if (legalName.startsWith(search)) return 0;
  if (formattedOrgNo.startsWith(search)) return 1;
  if (workspaceId.startsWith(search)) return 2;
  if (status.startsWith(search)) return 3;
  if (legalName.includes(search)) return 4;
  if (formattedOrgNo.includes(search)) return 5;
  if (workspaceId.includes(search)) return 6;
  if (status.includes(search)) return 7;
  return 8;
}

export function CompanySelectorPageV1() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const principal = useRequiredSessionPrincipalV1() as
    | ReturnType<typeof useRequiredSessionPrincipalV1>
    | undefined;
  const tenantId = principal?.tenantId ?? "missing-tenant";
  const { setActiveContext } = useGlobalAppContextV1();

  const [search, setSearch] = useState("");
  const [legalName, setLegalName] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [fiscalYearStart, setFiscalYearStart] = useState("2025-01-01");
  const [fiscalYearEnd, setFiscalYearEnd] = useState("2025-12-31");
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [launchTargetKey, setLaunchTargetKey] = useState<string | null>(null);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchComboboxId = useId();
  const searchListboxId = `${searchComboboxId}-listbox`;
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const legalNameInputId = "company-legal-name-input-v1";
  const organizationNumberInputId = "company-organization-number-input-v1";
  const fiscalYearStartInputId = "company-fiscal-year-start-input-v1";
  const fiscalYearEndInputId = "company-fiscal-year-end-input-v1";

  const companyQuery = useQuery({
    queryKey: companyListQueryKeyV1(tenantId),
    queryFn: () => listCompaniesByTenantV1({ tenantId }),
    enabled: Boolean(principal?.tenantId),
  });
  const workspaceQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId }),
    enabled: Boolean(principal?.tenantId),
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspaceV1,
  });

  const createCompanyAndWorkspaceMutation = useMutation({
    mutationFn: async () => {
      if (!principal?.tenantId) {
        throw new Error("Session context is missing for company creation.");
      }
      const company = await createCompanyV1({
        tenantId: principal.tenantId,
        legalName: legalName.trim(),
        organizationNumber: organizationNumber.trim(),
        defaultFiscalYearStart: fiscalYearStart,
        defaultFiscalYearEnd: fiscalYearEnd,
      });
      const workspace = await createWorkspaceV1({
        tenantId: principal.tenantId,
        companyId: company.company.id,
        fiscalYearStart,
        fiscalYearEnd,
      });
      return workspace.workspace;
    },
    onSuccess: async (workspace) => {
      if (!principal?.tenantId) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: companyListQueryKeyV1(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceListQueryKeyV1(tenantId),
        }),
      ]);
      setLegalName("");
      setOrganizationNumber("");
      setActiveContext({
        activeWorkspaceId: workspace.id,
        activeFiscalYear: toFiscalYearLabelV1(workspace),
      });
      navigate(`/app/workspaces/${workspace.id}/workbench`);
    },
  });

  const directory = useMemo<DirectoryRowV1[]>(() => {
    const companies = companyQuery.data?.companies ?? [];
    const workspaces = workspaceQuery.data?.workspaces ?? [];
    const companiesById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const byCompany = new Map<string, WorkspaceV1[]>();
    for (const workspace of workspaces) {
      const rows = byCompany.get(workspace.companyId) ?? [];
      rows.push(workspace);
      byCompany.set(workspace.companyId, rows);
    }
    for (const rows of byCompany.values()) {
      rows.sort(compareWorkspaceRecencyV1);
    }
    const directoryRows = companies.map((company) => {
      const rows = byCompany.get(company.id) ?? [];
      const latest = rows[0] ?? null;
      return {
        company,
        latest,
        count: rows.length,
        isLegacyWorkspaceOnly: false,
      };
    });

    for (const [companyId, rows] of byCompany.entries()) {
      if (companiesById.has(companyId)) {
        continue;
      }
      const latest = rows[0] ?? null;
      directoryRows.push({
        company: {
          id: companyId,
          tenantId,
          legalName: `Legacy workspace company (${companyId.slice(0, 8)})`,
          organizationNumber: "0000000000",
          defaultFiscalYearStart: latest?.fiscalYearStart ?? "2025-01-01",
          defaultFiscalYearEnd: latest?.fiscalYearEnd ?? "2025-12-31",
          createdAt:
            latest?.createdAt ?? latest?.updatedAt ?? new Date(0).toISOString(),
          updatedAt: latest?.updatedAt ?? new Date(0).toISOString(),
        },
        latest,
        count: rows.length,
        isLegacyWorkspaceOnly: true,
      });
    }

    return directoryRows;
  }, [
    companyQuery.data?.companies,
    tenantId,
    workspaceQuery.data?.workspaces,
  ]);

  const normalizedSearch = search.trim().toLowerCase();
  const searchableDirectory = useMemo<SearchIndexedRowV1[]>(() => {
    return directory.map((row) => {
      const searchBlob = [
        row.company.legalName.toLowerCase(),
        formatOrgNoV1(row.company.organizationNumber).toLowerCase(),
        row.latest?.id.toLowerCase() ?? "",
        row.latest?.status.toLowerCase() ?? "",
      ].join("|");
      return { row, searchBlob };
    });
  }, [directory]);

  const filteredDirectory = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return directory;
    }
    return searchableDirectory
      .filter((entry) => entry.searchBlob.includes(normalizedSearch))
      .map((entry) => entry.row);
  }, [directory, normalizedSearch, searchableDirectory]);

  const suggestionRows = useMemo(() => {
    if (normalizedSearch.length === 0) {
      return filteredDirectory.slice(0, 6);
    }
    return [...filteredDirectory]
      .sort((left, right) => {
        const leftRank = rankDirectoryMatchV1({
          row: left,
          search: normalizedSearch,
        });
        const rightRank = rankDirectoryMatchV1({
          row: right,
          search: normalizedSearch,
        });
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.company.legalName.localeCompare(right.company.legalName);
      })
      .slice(0, 6);
  }, [filteredDirectory, normalizedSearch]);

  useEffect(() => {
    setActiveSuggestionIndex(
      suggestionRows.length > 0 ? 0 : -1,
    );
  }, [suggestionRows.length, normalizedSearch]);

  useEffect(() => {
    if (!isSuggestionOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isSuggestionOpen]);

  const openWorkspaceV1 = (workspace: WorkspaceV1) => {
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: toFiscalYearLabelV1(workspace),
    });
    navigate(`/app/workspaces/${workspace.id}/workbench`);
  };

  const openCompanyV1 = async (input: {
    companyId: string;
    latestWorkspace: WorkspaceV1 | null;
    start: string;
    end: string;
  }) => {
    if (!principal?.tenantId) {
      throw new Error("Session context is missing for workspace launch.");
    }

    if (input.latestWorkspace) return openWorkspaceV1(input.latestWorkspace);
    try {
      const created = await createWorkspaceMutation.mutateAsync({
        tenantId: principal.tenantId,
        companyId: input.companyId,
        fiscalYearStart: input.start,
        fiscalYearEnd: input.end,
      });
      openWorkspaceV1(created.workspace);
    } catch (error) {
      if (
        !(error instanceof ApiClientError) ||
        error.code !== "DUPLICATE_WORKSPACE"
      ) {
        throw error;
      }
      const refreshed = await workspaceQuery.refetch();
      const existing = refreshed.data?.workspaces.find(
        (row) =>
          row.companyId === input.companyId &&
          row.fiscalYearStart === input.start &&
          row.fiscalYearEnd === input.end,
      );
      if (existing) openWorkspaceV1(existing);
    }
  };

  const handleContinueV1 = (row: DirectoryRowV1) => {
    const targetKey = [
      row.company.id,
      row.company.defaultFiscalYearStart,
      row.company.defaultFiscalYearEnd,
    ].join(":");
    if (launchTargetKey) {
      return;
    }
    setLaunchTargetKey(targetKey);
    void openCompanyV1({
      companyId: row.company.id,
      latestWorkspace: row.latest,
      start: row.company.defaultFiscalYearStart,
      end: row.company.defaultFiscalYearEnd,
    }).finally(() => {
      setLaunchTargetKey((activeKey) =>
        activeKey === targetKey ? null : activeKey,
      );
    });
  };

  const activeSuggestion =
    activeSuggestionIndex >= 0
      ? suggestionRows[activeSuggestionIndex] ?? null
      : null;
  const activeSuggestionId =
    activeSuggestion ? `${searchComboboxId}-option-${activeSuggestion.company.id}` : undefined;
  const isSuggestionVisible =
    isSuggestionOpen && normalizedSearch.length > 0;

  const seedDemoV1 = async () => {
    if (!principal?.tenantId) {
      setSeedError(
        "Session context is missing. Reload the page and try again.",
      );
      return;
    }

    setSeedError(null);
    setSeedMessage(null);
    let createdCompanies = 0;
    let createdWorkspaces = 0;
    try {
      for (const [name, orgNo] of demoCompaniesV1) {
        let companyId = companyQuery.data?.companies.find(
          (row) => row.organizationNumber === normalizeOrgNoV1(orgNo),
        )?.id;
        if (!companyId) {
          const company = await createCompanyV1({
            tenantId: principal.tenantId,
            legalName: name,
            organizationNumber: orgNo,
            defaultFiscalYearStart: "2025-01-01",
            defaultFiscalYearEnd: "2025-12-31",
          });
          companyId = company.company.id;
          createdCompanies += 1;
        }
        const hasWorkspace = workspaceQuery.data?.workspaces.some(
          (row) =>
            row.companyId === companyId &&
            row.fiscalYearStart === "2025-01-01" &&
            row.fiscalYearEnd === "2025-12-31",
        );
        if (!hasWorkspace) {
          await createWorkspaceV1({
            tenantId: principal.tenantId,
            companyId,
            fiscalYearStart: "2025-01-01",
            fiscalYearEnd: "2025-12-31",
          });
          createdWorkspaces += 1;
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: companyListQueryKeyV1(principal.tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceListQueryKeyV1(principal.tenantId),
        }),
      ]);
      setSeedMessage(
        `Demo seeded: ${createdCompanies} companies and ${createdWorkspaces} workspaces created.`,
      );
    } catch (error) {
      setSeedError(toUserFacingErrorMessage(error));
    }
  };

  if (!principal) {
    return (
      <section className="page-wrap">
        <EmptyStateV1
          title="Session context unavailable"
          description="Reload the app. If the issue persists, restart `npm run dev`."
          tone="error"
          role="alert"
        />
      </section>
    );
  }

  return (
    <section className="page-wrap">
      <CardV1 className="company-hub-hero-card">
        <p className="micro-label">Company Hub</p>
        <h1 className="page-title">Create and Open Companies</h1>
        <p className="hint-text">
          Create company first, then import and run modules.
        </p>
        <div className="form-grid company-hub-create-form">
          <label htmlFor={legalNameInputId}>Legal name</label>
          <InputV1
            id={legalNameInputId}
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            placeholder="Examplebolaget AB"
          />
          <label htmlFor={organizationNumberInputId}>Organization number</label>
          <InputV1
            id={organizationNumberInputId}
            value={organizationNumber}
            onChange={(event) => setOrganizationNumber(event.target.value)}
            placeholder="556123-1234"
          />
          <div className="form-grid form-grid--2">
            <div className="form-grid">
              <label htmlFor={fiscalYearStartInputId}>Fiscal year start</label>
              <InputV1
                id={fiscalYearStartInputId}
                type="date"
                value={fiscalYearStart}
                onChange={(event) => setFiscalYearStart(event.target.value)}
              />
            </div>
            <div className="form-grid">
              <label htmlFor={fiscalYearEndInputId}>Fiscal year end</label>
              <InputV1
                id={fiscalYearEndInputId}
                type="date"
                value={fiscalYearEnd}
                onChange={(event) => setFiscalYearEnd(event.target.value)}
              />
            </div>
          </div>
          <div className="company-hub-create-actions">
            <ButtonV1
              variant="primary"
              onClick={() => createCompanyAndWorkspaceMutation.mutate()}
              disabled={
                createCompanyAndWorkspaceMutation.isPending ||
                legalName.trim().length === 0 ||
                normalizeOrgNoV1(organizationNumber).length !== 10
              }
            >
              {createCompanyAndWorkspaceMutation.isPending
                ? "Creating..."
                : "Create company and continue"}
            </ButtonV1>
            <ButtonV1 onClick={() => void seedDemoV1()}>
              Seed demo companies
            </ButtonV1>
            <a href="/templates/trial-balance-template-v1.xlsx" download>
              Download trial balance template (.xlsx)
            </a>
          </div>
          {createCompanyAndWorkspaceMutation.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(
                createCompanyAndWorkspaceMutation.error,
              )}
            </p>
          ) : null}
          {seedError ? <p className="error-text">{seedError}</p> : null}
          {seedMessage ? <p className="success-text">{seedMessage}</p> : null}
        </div>
      </CardV1>

      <CardV1>
        <div className="company-selector-list-header">
          <div className="company-selector-list-header-copy">
            <h2 className="section-title">Companies</h2>
            <p className="company-selector-list-summary">
              Search first, then continue with a deterministic workspace launch.
            </p>
          </div>
          <div
            ref={searchWrapRef}
            className="company-selector-search"
            data-suggestion-open={isSuggestionVisible ? "true" : "false"}
          >
            <InputV1
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setIsSuggestionOpen(true);
              }}
              onFocus={() => setIsSuggestionOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsSuggestionOpen(false);
                  return;
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex(0);
                  return;
                }
                if (event.key === "End") {
                  event.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex(
                    suggestionRows.length > 0 ? suggestionRows.length - 1 : -1,
                  );
                  return;
                }
                if (event.key === "Tab") {
                  setIsSuggestionOpen(false);
                  return;
                }
                if (suggestionRows.length === 0) {
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((index) =>
                    index >= suggestionRows.length - 1 ? 0 : index + 1,
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setIsSuggestionOpen(true);
                  setActiveSuggestionIndex((index) =>
                    index <= 0 ? suggestionRows.length - 1 : index - 1,
                  );
                  return;
                }
                if (event.key === "Enter" && activeSuggestion) {
                  event.preventDefault();
                  setIsSuggestionOpen(false);
                  handleContinueV1(activeSuggestion);
                }
              }}
              placeholder="Search company, org number, workspace, or status"
              aria-label="Search companies"
              aria-haspopup="listbox"
              aria-controls={isSuggestionVisible ? searchListboxId : undefined}
              aria-expanded={isSuggestionVisible}
              aria-activedescendant={
                isSuggestionVisible ? activeSuggestionId : undefined
              }
              aria-autocomplete="list"
              role="combobox"
              className="company-selector-search-input"
            />
            <div className="company-selector-search-meta">
              <p className="company-selector-search-summary">
                {filteredDirectory.length} match
                {filteredDirectory.length === 1 ? "" : "es"}
              </p>
              <p className="company-selector-search-summary-secondary">
                {normalizedSearch.length > 0
                  ? "Arrow keys to navigate, Enter to continue"
                  : "Start typing for ranked suggestions"}
              </p>
            </div>
            {isSuggestionVisible ? (
              <div
                id={searchListboxId}
                role="listbox"
                className="search-combobox-menu"
                aria-label="Company suggestions"
              >
                {suggestionRows.length > 0 ? (
                  suggestionRows.map((row, index) => {
                    const optionId = `${searchComboboxId}-option-${row.company.id}`;
                    return (
                      <button
                        key={row.company.id}
                        id={optionId}
                        type="button"
                        role="option"
                        className="search-combobox-option"
                        aria-selected={index === activeSuggestionIndex}
                        data-active={index === activeSuggestionIndex}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          setIsSuggestionOpen(false);
                          handleContinueV1(row);
                        }}
                      >
                        <span className="search-combobox-option-row">
                          <span className="search-combobox-option-primary">
                            {row.company.legalName}
                          </span>
                          {row.latest ? (
                            <StatusPill status={row.latest.status} />
                          ) : (
                            <span className="status-pill">No workspace</span>
                          )}
                        </span>
                        <span className="search-combobox-option-meta">
                          {formatOrgNoV1(row.company.organizationNumber)} |{" "}
                          {row.count} workspace{row.count === 1 ? "" : "s"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="search-combobox-empty">
                    No suggestions. Adjust the query or create a new company.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {companyQuery.isPending || workspaceQuery.isPending ? (
          <div className="panel-stack">
            <SkeletonV1 height={40} />
            <SkeletonV1 height={40} />
            <SkeletonV1 height={40} />
          </div>
        ) : null}
        {companyQuery.isError || workspaceQuery.isError ? (
          <EmptyStateV1
            title="Company directory unavailable"
            description={toUserFacingErrorMessage(
              companyQuery.error ?? workspaceQuery.error,
            )}
            tone="error"
            action={
              <ButtonV1
                onClick={() => {
                  void companyQuery.refetch();
                  void workspaceQuery.refetch();
                }}
              >
                Retry
              </ButtonV1>
            }
          />
        ) : null}
        {companyQuery.isSuccess &&
        workspaceQuery.isSuccess &&
        filteredDirectory.length === 0 ? (
          <EmptyStateV1
            title="No matching companies"
            description="Adjust the query, or create/seed a company to continue."
          />
        ) : null}
        {companyQuery.isSuccess &&
        workspaceQuery.isSuccess &&
        filteredDirectory.length > 0 ? (
          <div className="table-wrap">
            <table className="company-selector-table">
              <caption className="company-selector-table-caption">
                Company selector results
              </caption>
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Workspace</th>
                  <th scope="col">Fiscal year</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectory.map((row, index) => (
                  <tr
                    key={row.company.id}
                    className="company-selector-table-row"
                    data-top-match={
                      normalizedSearch.length > 0 && index === 0
                        ? "true"
                        : "false"
                    }
                  >
                    <th scope="row">
                      <div className="company-selector-cell-stack">
                        <p className="company-selector-cell-primary">
                          {row.company.legalName}
                        </p>
                        <p className="company-selector-cell-directory-rank">
                          {index + 1}.
                        </p>
                        <p className="company-selector-cell-meta">
                          {row.isLegacyWorkspaceOnly
                            ? "Legacy workspace without a company profile."
                            : `Org no ${formatOrgNoV1(row.company.organizationNumber)}`}
                        </p>
                      </div>
                    </th>
                    <td>
                      <div className="company-selector-cell-stack">
                        {row.latest ? (
                          <StatusPill status={row.latest.status} />
                        ) : (
                          <span className="status-pill">No workspace</span>
                        )}
                        <p className="company-selector-cell-meta">
                          {row.latest
                            ? `Workspace ${row.latest.id.slice(0, 8)}`
                            : "No workspace yet"}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="company-selector-cell-stack">
                        <p className="company-selector-cell-fiscal">
                          {row.company.defaultFiscalYearStart} to{" "}
                          {row.company.defaultFiscalYearEnd}
                        </p>
                        <p className="company-selector-cell-meta">
                          {row.count} workspace{row.count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </td>
                    <td className="company-selector-cell-action">
                      <ButtonV1
                        variant="primary"
                        className="company-selector-continue-button"
                        onClick={() => handleContinueV1(row)}
                        disabled={Boolean(launchTargetKey)}
                      >
                        {row.latest
                          ? "Open company landing"
                          : "Create initial workspace"}
                      </ButtonV1>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardV1>
    </section>
  );
}
