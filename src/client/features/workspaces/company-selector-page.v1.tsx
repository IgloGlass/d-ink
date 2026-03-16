import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { StatusPill } from "../../components/status-pill";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";
import {
  buildFiscalYearOptionsV1,
  deriveFiscalYearRangeForSelectionV1,
  formatFiscalYearLabelV1,
  getFiscalYearKeyV1,
  resolveWorkspaceForCompanyAndFiscalYearV1,
} from "../../lib/fiscal-year.v1";
import {
  createCompanyV1,
  listCompaniesByTenantV1,
} from "../../lib/http/company-api";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  createWorkspaceV1,
  listWorkspacesByTenantV1,
} from "../../lib/http/workspace-api";

const companyListQueryKeyV1 = (tenantId: string) => ["companies", tenantId];
const workspaceListQueryKeyV1 = (tenantId: string) => ["workspaces", tenantId];
const LOCAL_DEMO_COMPANY_NAME_V1 = "Test Company AB";
const LOCAL_DEMO_ORGANIZATION_NUMBER_V1 = "5561231234";

function formatOrganizationNumberV1(value: string): string {
  return value.length === 10
    ? `${value.slice(0, 6)}-${value.slice(6)}`
    : value;
}

function isLocalDevHostV1(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function buildWorkspaceDashboardPathV1(workspaceId: string): string {
  return `/app/workspaces/${workspaceId}`;
}

function resolveFiscalYearKeyV1(input: string | null | undefined): {
  fiscalYearKey: string;
  usedFallback: boolean;
} {
  const normalized = input?.trim() ?? "";
  if (/^\d{4}$/.test(normalized)) {
    return {
      fiscalYearKey: normalized,
      usedFallback: false,
    };
  }

  return {
    fiscalYearKey: String(new Date().getFullYear()),
    usedFallback: normalized.length > 0,
  };
}

export function CompanySelectorPageV1() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const principal = useRequiredSessionPrincipalV1();
  const tenantId = principal.tenantId;
  const { activeFiscalYear, setActiveContext } = useGlobalAppContextV1();
  const { t } = useI18nV1();
  const fiscalYearResolution = resolveFiscalYearKeyV1(activeFiscalYear);
  const createCompanyFiscalYearKey = fiscalYearResolution.fiscalYearKey;

  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [hasAttemptedLocalDemoSeed, setHasAttemptedLocalDemoSeed] =
    useState(false);

  const openWorkspaceV1 = ({
    fiscalYear,
    workspaceId,
  }: {
    fiscalYear: string;
    workspaceId: string;
  }) => {
    setActiveContext({
      activeFiscalYear: fiscalYear,
      activeWorkspaceId: workspaceId,
    });
    navigate(buildWorkspaceDashboardPathV1(workspaceId));
  };

  const companyQuery = useQuery({
    queryKey: companyListQueryKeyV1(tenantId),
    queryFn: () => listCompaniesByTenantV1({ tenantId }),
  });

  const workspaceQuery = useQuery({
    queryKey: workspaceListQueryKeyV1(tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId }),
  });

  const fiscalYearOptions = useMemo(
    () =>
      buildFiscalYearOptionsV1({
        companies: companyQuery.data?.companies ?? [],
        workspaces: workspaceQuery.data?.workspaces ?? [],
      }),
    [companyQuery.data, workspaceQuery.data],
  );

  useEffect(() => {
    if (activeFiscalYear || fiscalYearOptions.length === 0) {
      return;
    }

    setActiveContext({
      activeFiscalYear: fiscalYearOptions[0],
    });
  }, [activeFiscalYear, fiscalYearOptions, setActiveContext]);

  const createCompanyMutation = useMutation({
    mutationFn: async () => {
      const company = await createCompanyV1({
        tenantId,
        legalName: legalName.trim(),
        organizationNumber: organizationNumber.replace(/\D/g, ""),
        defaultFiscalYearStart: `${createCompanyFiscalYearKey}-01-01`,
        defaultFiscalYearEnd: `${createCompanyFiscalYearKey}-12-31`,
      });

      const workspace = await createWorkspaceV1({
        tenantId,
        companyId: company.company.id,
        fiscalYearStart: `${createCompanyFiscalYearKey}-01-01`,
        fiscalYearEnd: `${createCompanyFiscalYearKey}-12-31`,
      });

      return workspace.workspace.id;
    },
    onSuccess: async (workspaceId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: companyListQueryKeyV1(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceListQueryKeyV1(tenantId),
        }),
      ]);

      setShowCreateForm(false);
      setLegalName("");
      setOrganizationNumber("");
      openWorkspaceV1({
        fiscalYear: createCompanyFiscalYearKey,
        workspaceId,
      });
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const companies = companyQuery.data?.companies ?? [];
      const company = companies.find((candidate) => candidate.id === companyId);
      if (!company) {
        throw new Error("Company could not be found.");
      }

      const selectedFiscalYearKey =
        activeFiscalYear ??
        getFiscalYearKeyV1({ fiscalYearEnd: company.defaultFiscalYearEnd });
      const fiscalYearRange = deriveFiscalYearRangeForSelectionV1({
        company,
        fiscalYearKey: selectedFiscalYearKey,
      });

      const workspace = await createWorkspaceV1({
        tenantId,
        companyId,
        fiscalYearStart: fiscalYearRange.fiscalYearStart,
        fiscalYearEnd: fiscalYearRange.fiscalYearEnd,
      });

      return workspace.workspace.id;
    },
    onSuccess: async (workspaceId) => {
      const selectedFiscalYearKey =
        activeFiscalYear ?? String(new Date().getFullYear());
      await queryClient.invalidateQueries({
        queryKey: workspaceListQueryKeyV1(tenantId),
      });
      openWorkspaceV1({
        fiscalYear: selectedFiscalYearKey,
        workspaceId,
      });
    },
  });

  const seedLocalDemoMutation = useMutation({
    mutationFn: async () => {
      const company = await createCompanyV1({
        tenantId,
        legalName: LOCAL_DEMO_COMPANY_NAME_V1,
        organizationNumber: LOCAL_DEMO_ORGANIZATION_NUMBER_V1,
        defaultFiscalYearStart: `${createCompanyFiscalYearKey}-01-01`,
        defaultFiscalYearEnd: `${createCompanyFiscalYearKey}-12-31`,
      });

      const workspace = await createWorkspaceV1({
        tenantId,
        companyId: company.company.id,
        fiscalYearStart: `${createCompanyFiscalYearKey}-01-01`,
        fiscalYearEnd: `${createCompanyFiscalYearKey}-12-31`,
      });

      return workspace.workspace.id;
    },
    onSuccess: async (workspaceId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: companyListQueryKeyV1(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceListQueryKeyV1(tenantId),
        }),
      ]);
      openWorkspaceV1({
        fiscalYear: createCompanyFiscalYearKey,
        workspaceId,
      });
    },
  });

  const filteredCompanies = useMemo(() => {
    const companies = companyQuery.data?.companies ?? [];
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return companies;
    }

    return companies.filter((company) => {
      return (
        company.legalName.toLowerCase().includes(normalizedSearch) ||
        company.organizationNumber.includes(normalizedSearch.replace(/\D/g, ""))
      );
    });
  }, [companyQuery.data, search]);

  useEffect(() => {
    if (!isLocalDevHostV1()) {
      return;
    }
    if (hasAttemptedLocalDemoSeed || seedLocalDemoMutation.isPending) {
      return;
    }
    if (companyQuery.isLoading || workspaceQuery.isLoading) {
      return;
    }
    if (companyQuery.isError || workspaceQuery.isError) {
      return;
    }

    const companies = companyQuery.data?.companies ?? [];
    const workspaces = workspaceQuery.data?.workspaces ?? [];
    if (companies.length > 0 || workspaces.length > 0) {
      return;
    }

    setHasAttemptedLocalDemoSeed(true);
    seedLocalDemoMutation.mutate();
  }, [
    companyQuery.data,
    companyQuery.isError,
    companyQuery.isLoading,
    hasAttemptedLocalDemoSeed,
    seedLocalDemoMutation,
    workspaceQuery.data,
    workspaceQuery.isError,
    workspaceQuery.isLoading,
  ]);

  return (
    <div className="workspace-landing">
      <section className="workspace-landing__hero">
        <div>
          <div className="workspace-landing__eyebrow">{t("module.annualReport")}</div>
          <h1 className="workspace-landing__title">
            {t("workspace.selector.title")}
          </h1>
          <p className="workspace-landing__copy">
            {t("workspace.selector.subtitle")}
          </p>
        </div>
        <ButtonV1
          variant="black"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? "Close new company form" : "Create new company"}
        </ButtonV1>
      </section>

      <section className="workspace-search-panel">
        <label
          className="workspace-search-panel__label"
          htmlFor="workspace-search"
        >
          Search company
        </label>
        <input
          id="workspace-search"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("workspace.selector.search")}
          className="workspace-search-input"
        />
      </section>

      {showCreateForm ? (
        <CardV1 className="workspace-create-panel">
          <div className="workspace-create-grid">
            <label className="workspace-field">
              <span>Legal name</span>
              <input
                type="text"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                placeholder="e.g. Examplebolaget AB"
                className="input-v1"
              />
            </label>
            <label className="workspace-field">
              <span>Organization number</span>
              <input
                type="text"
                value={organizationNumber}
                onChange={(event) => setOrganizationNumber(event.target.value)}
                placeholder="e.g. 556123-1234"
                className="input-v1"
              />
            </label>
          </div>
          <div className="workspace-create-actions">
            <ButtonV1
              variant="black"
              onClick={() => createCompanyMutation.mutate()}
              disabled={
                !legalName.trim() ||
                !organizationNumber.trim() ||
                createCompanyMutation.isPending
              }
            >
              Create company and workspace
            </ButtonV1>
          </div>
          {fiscalYearResolution.usedFallback ? (
            <div className="workspace-inline-error" role="alert">
              Fiscal year filter is invalid. New company setup will use{" "}
              {createCompanyFiscalYearKey}.
            </div>
          ) : null}
          {createCompanyMutation.isError ? (
            <div className="workspace-inline-error" role="alert">
              {toUserFacingErrorMessage(createCompanyMutation.error)}
            </div>
          ) : null}
        </CardV1>
      ) : null}

      <CardV1 className="workspace-list-panel card-v1--hero">
        <div className="workspace-panel-header">
          <div>
            <div className="workspace-panel-header__eyebrow">Companies</div>
            <h2>Available clients</h2>
          </div>
          <div className="workspace-selected-meta">
            Fiscal year filter: {activeFiscalYear ?? "Loading"}
          </div>
        </div>

        {companyQuery.isLoading || workspaceQuery.isLoading ? (
          <div className="workspace-list__loading">
            <SkeletonV1 height={88} />
            <SkeletonV1 height={88} />
            <SkeletonV1 height={88} />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="workspace-empty-state">
            {seedLocalDemoMutation.isPending && isLocalDevHostV1()
              ? "Preparing local test company..."
              : "No companies matched the current search."}
          </div>
        ) : (
          <table className="company-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Org. number</th>
                <th>Fiscal year</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => {
                const workspace = resolveWorkspaceForCompanyAndFiscalYearV1({
                  companyId: company.id,
                  fiscalYearKey: activeFiscalYear,
                  workspaces: workspaceQuery.data?.workspaces ?? [],
                });
                const openExistingWorkspace = () => {
                  if (!workspace) {
                    return;
                  }
                  openWorkspaceV1({
                    fiscalYear: workspace.fiscalYearEnd.slice(0, 4),
                    workspaceId: workspace.id,
                  });
                };

                return (
                  <tr key={company.id} className="company-table__row">
                    <td className="company-table__cell company-table__cell--name">
                      <button type="button" onClick={openExistingWorkspace}>
                        {company.legalName}
                      </button>
                    </td>
                    <td className="company-table__cell company-table__cell--mono">
                      {formatOrganizationNumberV1(company.organizationNumber)}
                    </td>
                    <td className="company-table__cell company-table__cell--mono">
                      {formatFiscalYearLabelV1({
                        fiscalYearStart: company.defaultFiscalYearStart,
                        fiscalYearEnd: company.defaultFiscalYearEnd,
                      })}
                    </td>
                    <td className="company-table__cell">
                      {workspace ? (
                        <StatusPill status={workspace.status} />
                      ) : (
                        <span className="company-table__no-workspace">
                          No workspace
                        </span>
                      )}
                    </td>
                    <td className="company-table__cell company-table__cell--actions">
                      {workspace ? (
                        <ButtonV1 variant="black" onClick={openExistingWorkspace}>
                          Open
                        </ButtonV1>
                      ) : (
                        <ButtonV1
                          variant="primary"
                          onClick={() => createWorkspaceMutation.mutate(company.id)}
                          disabled={createWorkspaceMutation.isPending}
                        >
                          Create workspace
                        </ButtonV1>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {createWorkspaceMutation.isError ? (
          <div className="workspace-inline-error" role="alert">
            {toUserFacingErrorMessage(createWorkspaceMutation.error)}
          </div>
        ) : null}
        {seedLocalDemoMutation.isError ? (
          <div className="workspace-inline-error" role="alert">
            {toUserFacingErrorMessage(seedLocalDemoMutation.error)}
          </div>
        ) : null}
      </CardV1>
    </div>
  );
}
