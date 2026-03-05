import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  type SilverfinTaxCategoryCodeV1,
  listSilverfinTaxCategoriesV1,
} from "../../../shared/contracts/mapping.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { GuidanceBannerV1 } from "../../components/guidance-banner-v1";
import { InputV1 } from "../../components/input-v1";
import { SidebarNavV1 } from "../../components/sidebar-nav-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { TabsV1 } from "../../components/tabs-v1";
import { inlineAiCommandAdapterV1 } from "../../lib/adapters/inline-ai-command-adapter.v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  applyMappingOverridesV1,
  getActiveInk2FormV1,
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
} from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

type CoreModuleSlugV1 =
  | "annual-report-analysis"
  | "account-mapping"
  | "tax-adjustments"
  | "tax-return-ink2";

type MappingStateLabelV1 =
  | "AI Confident"
  | "Approved"
  | "Manual Override"
  | "Pending Review";

const coreModuleOrderV1: CoreModuleSlugV1[] = [
  "annual-report-analysis",
  "account-mapping",
  "tax-adjustments",
  "tax-return-ink2",
];

const mappingGridRowHeightV1 = 44;
const mappingGridViewportHeightV1 = 520;
const mappingGridOverscanV1 = 10;
const mappingGridTemplateColumnsV1 = "56px 1.2fr 2fr 1fr 1.6fr 1fr 1.2fr";

const taxAdjustmentGroupsV1 = {
  common: [
    "General Client Information",
    "Trial Balance to Local GAAP",
    "Disallowed Expenses",
    "Non-Taxable Income",
    "Provisions",
    "Depreciation on Tangible and Acquired Intangible Assets",
    "Group Contributions",
    "Items Not Included in the Books",
    "Tax Losses Carried Forward",
  ],
  advancedFrequent: [
    "Property Tax and Property Fee",
    "Warranty Provision",
    "Pension Costs and Basis for Special Employer's Contribution",
    "Buildings, Building Improvements, Leasehold Improvements, Land Improvements, and Capital Gains on Sale of Commercial Property",
    "Capital Assets and Unrealized Changes",
    "Obsolescence Reserve for Inventory",
    "Shares and Participations",
    "Shares and Participations - Average Method",
    "Partnership Interest (Handelsbolag) - N3B",
  ],
  advancedSpecialized: [
    "CFC Taxation",
    "Yield Tax, Risk Tax, and Renewable Energy",
    "Hybrid and Targeted Interest Limitation Rules, and Offsetting of Net Interest",
    "Deductible Net Interest Under the General Interest Deduction Limitation Rule",
    "Notional Income on Tax Allocation Reserve",
    "Reversal of Tax Allocation Reserve",
    "Allocation to Tax Allocation Reserve",
    "Increased Deduction for Restricted Tax Losses Carried Forward (TLCF)",
  ],
  calculation: [
    "Tax Calculation Before Deduction of Prior-Year Losses and Negative Net Interest",
    "Tax Calculation After Deduction for Negative Net Interest and Tax Losses Carried Forward",
    "Tax Calculation After Deduction for Negative Net Interest, Tax Allocation Reserve, and Tax Losses",
  ],
  final: ["Final Tax Calculation"],
};

function toSlugV1(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const allTaxSubmoduleLabelsV1 = [
  ...taxAdjustmentGroupsV1.common,
  ...taxAdjustmentGroupsV1.advancedFrequent,
  ...taxAdjustmentGroupsV1.advancedSpecialized,
  ...taxAdjustmentGroupsV1.calculation,
  ...taxAdjustmentGroupsV1.final,
];

const taxSubmoduleLabelBySlugV1 = new Map(
  allTaxSubmoduleLabelsV1.map((label) => [toSlugV1(label), label]),
);

function toMappingStateLabelV1(input: {
  confidence: number;
  reviewFlag: boolean;
  status: string;
}): MappingStateLabelV1 {
  if (input.status === "overridden") {
    return "Manual Override";
  }
  if (input.reviewFlag || input.confidence < 0.8) {
    return "Pending Review";
  }
  if (input.confidence >= 0.9) {
    return "AI Confident";
  }
  return "Approved";
}

function isMappingExceptionV1(input: {
  reviewFlag: boolean;
  status: string;
  confidence: number;
}): boolean {
  return (
    input.reviewFlag || input.status === "overridden" || input.confidence < 0.8
  );
}

function getCoreModuleLabelV1(
  moduleSlug: CoreModuleSlugV1,
  labels: Record<CoreModuleSlugV1, string>,
): string {
  return labels[moduleSlug];
}

export function CoreModuleShellPageV1() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const principal = useRequiredSessionPrincipalV1();
  const { t } = useI18nV1();
  const { workspaceId, coreModule, subModule } = useParams();
  const resolvedWorkspaceId = workspaceId ?? "";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mappingViewMode, setMappingViewMode] = useState<"all" | "exceptions">(
    "all",
  );
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categorySelection, setCategorySelection] =
    useState<SilverfinTaxCategoryCodeV1 | null>(null);
  const [commandText, setCommandText] = useState("");
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [mappingScrollTop, setMappingScrollTop] = useState(0);
  const mappingScrollRef = useRef<HTMLDivElement | null>(null);
  const mappingScrollRafRef = useRef<number | null>(null);

  function setRowSelectedV1(decisionId: string, shouldSelect: boolean) {
    setSelectedRowIds((current) => {
      const alreadySelected = current.includes(decisionId);
      if (shouldSelect && !alreadySelected) {
        return [...current, decisionId];
      }
      if (!shouldSelect && alreadySelected) {
        return current.filter((id) => id !== decisionId);
      }
      return current;
    });
  }

  function toggleRowSelectionV1(decisionId: string) {
    setSelectedRowIds((current) => {
      if (current.includes(decisionId)) {
        return current.filter((id) => id !== decisionId);
      }
      return [...current, decisionId];
    });
  }

  const normalizedCoreModule = coreModuleOrderV1.includes(
    (coreModule as CoreModuleSlugV1) ?? "annual-report-analysis",
  )
    ? ((coreModule as CoreModuleSlugV1) ?? "annual-report-analysis")
    : "annual-report-analysis";

  const moduleLabelMap = useMemo<Record<CoreModuleSlugV1, string>>(
    () => ({
      "annual-report-analysis": t("module.tabs.annualReport"),
      "account-mapping": t("module.tabs.mapping"),
      "tax-adjustments": t("module.tabs.adjustments"),
      "tax-return-ink2": t("module.tabs.ink2"),
    }),
    [t],
  );

  useEffect(() => {
    if (resolvedWorkspaceId.length === 0) {
      return;
    }
    if (!coreModule) {
      navigate(
        `/app/workspaces/${resolvedWorkspaceId}/${normalizedCoreModule}`,
        {
          replace: true,
        },
      );
      return;
    }
    if (!coreModuleOrderV1.includes(coreModule as CoreModuleSlugV1)) {
      navigate(
        `/app/workspaces/${resolvedWorkspaceId}/annual-report-analysis`,
        {
          replace: true,
        },
      );
    }
  }, [coreModule, navigate, normalizedCoreModule, resolvedWorkspaceId]);

  const moduleTabs = coreModuleOrderV1.map((moduleSlug) => ({
    id: moduleSlug,
    label: getCoreModuleLabelV1(moduleSlug, moduleLabelMap),
  }));

  const mappingQuery = useQuery({
    queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled:
      resolvedWorkspaceId.length > 0 &&
      normalizedCoreModule === "account-mapping",
    retry: false,
  });

  const taxAdjustmentsQuery = useQuery({
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
    enabled:
      resolvedWorkspaceId.length > 0 &&
      normalizedCoreModule === "tax-adjustments",
    retry: false,
  });

  const taxSummaryQuery = useQuery({
    queryKey: ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled:
      resolvedWorkspaceId.length > 0 &&
      normalizedCoreModule === "tax-adjustments",
    retry: false,
  });

  const ink2Query = useQuery({
    queryKey: ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled:
      resolvedWorkspaceId.length > 0 &&
      normalizedCoreModule === "tax-return-ink2",
    retry: false,
  });

  const applyMappingOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!mappingQuery.data?.active || !categorySelection) {
        throw new Error("Select rows and a category before applying override.");
      }
      if (selectedRowIds.length === 0) {
        throw new Error("Select at least one account row.");
      }

      return applyMappingOverridesV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
        expectedActiveMapping: {
          artifactId: mappingQuery.data.active.artifactId,
          version: mappingQuery.data.active.version,
        },
        overrides: selectedRowIds.map((decisionId) => ({
          decisionId,
          selectedCategoryCode: categorySelection,
          scope: "return",
          reason: "Manual override from account mapping workbench.",
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
      });
      setSelectedRowIds([]);
      setCategorySelection(null);
      setCategoryQuery("");
    },
  });

  const mappingRows = useMemo(() => {
    const rows = mappingQuery.data?.mapping.decisions ?? [];
    if (mappingViewMode === "all") {
      return rows;
    }
    return rows.filter((row) => isMappingExceptionV1(row));
  }, [mappingQuery.data?.mapping.decisions, mappingViewMode]);

  const mappingVirtualRows = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(mappingScrollTop / mappingGridRowHeightV1) -
        mappingGridOverscanV1,
    );
    const endIndex = Math.min(
      mappingRows.length,
      Math.ceil(
        (mappingScrollTop + mappingGridViewportHeightV1) /
          mappingGridRowHeightV1,
      ) + mappingGridOverscanV1,
    );
    return {
      totalSize: mappingRows.length * mappingGridRowHeightV1,
      rows: mappingRows.slice(startIndex, endIndex).map((row, index) => {
        const absoluteIndex = startIndex + index;
        return {
          index: absoluteIndex,
          start: absoluteIndex * mappingGridRowHeightV1,
          row,
        };
      }),
    };
  }, [mappingRows, mappingScrollTop]);

  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds],
  );

  useEffect(() => {
    return () => {
      if (mappingScrollRafRef.current !== null) {
        cancelAnimationFrame(mappingScrollRafRef.current);
      }
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const allCategories = listSilverfinTaxCategoriesV1();
    const query = categoryQuery.trim().toLowerCase();
    if (query.length === 0) {
      return allCategories.slice(0, 8);
    }
    return allCategories
      .filter((category) => {
        return (
          category.code.toLowerCase().includes(query) ||
          category.name.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [categoryQuery]);

  const taxSidebarSections = [
    {
      id: "common",
      title: t("module.sidebar.common"),
      items: taxAdjustmentGroupsV1.common.map((label) => ({
        id: toSlugV1(label),
        label,
        to: `/app/workspaces/${resolvedWorkspaceId}/tax-adjustments/${toSlugV1(label)}`,
      })),
    },
    {
      id: "advanced",
      title: t("module.sidebar.advanced"),
      collapsible: true,
      collapsed: !showAdvanced,
      onToggle: () => setShowAdvanced((current) => !current),
      items: [
        ...taxAdjustmentGroupsV1.advancedFrequent,
        ...taxAdjustmentGroupsV1.advancedSpecialized,
      ].map((label) => ({
        id: toSlugV1(label),
        label,
        to: `/app/workspaces/${resolvedWorkspaceId}/tax-adjustments/${toSlugV1(label)}`,
      })),
    },
  ];

  const taxPinnedItems = [
    ...taxAdjustmentGroupsV1.calculation.map((label) => ({
      id: toSlugV1(label),
      label,
      to: `/app/workspaces/${resolvedWorkspaceId}/tax-adjustments/${toSlugV1(label)}`,
    })),
    ...taxAdjustmentGroupsV1.final.map((label) => ({
      id: toSlugV1(label),
      label,
      to: `/app/workspaces/${resolvedWorkspaceId}/tax-adjustments/${toSlugV1(label)}`,
    })),
  ];

  if (resolvedWorkspaceId.length === 0) {
    return <EmptyStateV1 title={t("module.notFound")} description="" />;
  }

  return (
    <section className="page-wrap module-shell-v1">
      <CardV1>
        <TabsV1
          items={moduleTabs}
          activeId={normalizedCoreModule}
          onChange={(moduleId) =>
            navigate(`/app/workspaces/${resolvedWorkspaceId}/${moduleId}`)
          }
        />
      </CardV1>

      {normalizedCoreModule !== "annual-report-analysis" ? (
        <GuidanceBannerV1 tone="advisory">
          {t("module.advisoryOutOfOrder")}
        </GuidanceBannerV1>
      ) : null}

      {normalizedCoreModule === "annual-report-analysis" ? (
        <CardV1 id="module-panel-annual-report-analysis" role="tabpanel">
          <p className="micro-label">{t("module.annualReport")}</p>
          <h1 className="page-title">{t("module.annualReport")}</h1>
          <p className="hint-text">
            Upload, extract, and confirm annual report values in this module.
          </p>
          <p className="hint-text">
            Detailed extraction actions remain available in legacy flow while
            this premium shell is rolled out.
          </p>
          <ButtonV1
            onClick={() =>
              navigate(`/app/workspaces/${resolvedWorkspaceId}/legacy-detail`)
            }
          >
            Open detailed workflow
          </ButtonV1>
        </CardV1>
      ) : null}

      {normalizedCoreModule === "account-mapping" ? (
        <CardV1 id="module-panel-account-mapping" role="tabpanel">
          <div className="section-heading-row">
            <div>
              <p className="micro-label">{t("module.accountMapping")}</p>
              <h1 className="page-title">{t("module.accountMapping")}</h1>
            </div>
            <div className="inline-row" style={{ width: "340px" }}>
              <ButtonV1
                variant={mappingViewMode === "all" ? "primary" : "secondary"}
                pressed={mappingViewMode === "all"}
                onClick={() => setMappingViewMode("all")}
              >
                {t("mapping.viewAll")}
              </ButtonV1>
              <ButtonV1
                variant={
                  mappingViewMode === "exceptions" ? "primary" : "secondary"
                }
                pressed={mappingViewMode === "exceptions"}
                onClick={() => setMappingViewMode("exceptions")}
              >
                {t("mapping.exceptionsOnly")}
              </ButtonV1>
            </div>
          </div>

          {mappingQuery.isPending ? (
            <div className="panel-stack">
              <SkeletonV1 height={40} />
              <SkeletonV1 height={40} />
              <SkeletonV1 height={40} />
            </div>
          ) : null}

          {mappingQuery.isError ? (
            mappingQuery.error instanceof ApiClientError &&
            mappingQuery.error.code === "MAPPING_NOT_FOUND" ? (
              <EmptyStateV1
                title={t("mapping.empty")}
                description="Run trial-balance mapping to populate this grid."
                action={
                  <ButtonV1
                    variant="secondary"
                    onClick={() =>
                      navigate(
                        `/app/workspaces/${resolvedWorkspaceId}/annual-report-analysis`,
                      )
                    }
                  >
                    Open annual report
                  </ButtonV1>
                }
              />
            ) : (
              <EmptyStateV1
                title="Mapping data unavailable"
                description={toUserFacingErrorMessage(mappingQuery.error)}
                tone="error"
                role="alert"
                action={
                  <ButtonV1 onClick={() => mappingQuery.refetch()}>
                    Retry
                  </ButtonV1>
                }
              />
            )
          ) : null}

          {mappingQuery.isSuccess ? (
            <div className="panel-stack">
              <div className="form-grid form-grid--inline">
                <label htmlFor="mapping-category-search">
                  <span className="micro-label">
                    {t("mapping.searchCategory")}
                  </span>
                  <InputV1
                    id="mapping-category-search"
                    value={categoryQuery}
                    placeholder={t("mapping.searchCategory")}
                    onChange={(event) => {
                      setCategoryQuery(event.target.value);
                      setCategorySelection(null);
                    }}
                  />
                </label>
                <div>
                  <span className="micro-label">Suggestions</span>
                  <div
                    className="search-combobox-menu"
                    style={{ position: "relative" }}
                  >
                    {categoryOptions.map((category) => (
                      <button
                        key={category.code}
                        type="button"
                        className="search-combobox-option"
                        aria-selected={categorySelection === category.code}
                        onClick={() => {
                          setCategorySelection(category.code);
                          setCategoryQuery(
                            `${category.code} - ${category.name}`,
                          );
                        }}
                      >
                        {category.code} - {category.name}
                      </button>
                    ))}
                  </div>
                </div>
                <ButtonV1
                  variant="primary"
                  onClick={() => applyMappingOverrideMutation.mutate()}
                  disabled={
                    applyMappingOverrideMutation.isPending ||
                    selectedRowIds.length === 0 ||
                    !categorySelection
                  }
                >
                  Apply override
                </ButtonV1>
              </div>

              <GuidanceBannerV1
                tone={selectedRowIds.length > 0 ? "active" : "neutral"}
                ariaLive="polite"
              >
                {selectedRowIds.length > 0
                  ? `${selectedRowIds.length} row(s) selected for override.`
                  : "Select one or more rows to enable override and AI command actions."}
              </GuidanceBannerV1>

              <div className="form-grid form-grid--inline">
                <InputV1
                  value={commandText}
                  placeholder={t("mapping.inlineCommandPlaceholder")}
                  invalid={
                    commandText.trim().length > 0 && selectedRowIds.length === 0
                  }
                  onChange={(event) => setCommandText(event.target.value)}
                />
                <ButtonV1
                  onClick={() => {
                    const preview = inlineAiCommandAdapterV1.preview({
                      command: commandText,
                      selectedRowIds,
                    });
                    setCommandPreview(preview.previewMessage);
                  }}
                  disabled={
                    commandText.trim().length === 0 ||
                    selectedRowIds.length === 0
                  }
                >
                  {t("mapping.applyCommand")}
                </ButtonV1>
              </div>
              {commandPreview ? (
                <p className="hint-text">{commandPreview}</p>
              ) : null}

              <section
                className="table-wrap mapping-grid-wrap"
                ref={mappingScrollRef}
                style={{
                  height: `${mappingGridViewportHeightV1}px`,
                  minWidth: "980px",
                }}
                aria-label="Account mapping grid"
                onScroll={(event) => {
                  const nextTop = event.currentTarget.scrollTop;
                  if (mappingScrollRafRef.current !== null) {
                    cancelAnimationFrame(mappingScrollRafRef.current);
                  }
                  mappingScrollRafRef.current = requestAnimationFrame(() => {
                    setMappingScrollTop(nextTop);
                    mappingScrollRafRef.current = null;
                  });
                }}
              >
                <div
                  className="mapping-grid-header"
                  style={{
                    display: "grid",
                    gridTemplateColumns: mappingGridTemplateColumnsV1,
                    position: "sticky",
                    top: 0,
                    minHeight: `${mappingGridRowHeightV1}px`,
                    alignItems: "center",
                  }}
                >
                  <div />
                  <div className="micro-label">
                    {t("mapping.table.account")}
                  </div>
                  <div className="micro-label">
                    {t("mapping.table.description")}
                  </div>
                  <div className="micro-label">{t("mapping.table.amount")}</div>
                  <div className="micro-label">
                    {t("mapping.table.category")}
                  </div>
                  <div className="micro-label">
                    {t("mapping.table.confidence")}
                  </div>
                  <div className="micro-label">{t("mapping.table.state")}</div>
                </div>

                <div
                  className="mapping-grid-virtual-body"
                  style={{
                    height: `${mappingVirtualRows.totalSize}px`,
                    position: "relative",
                  }}
                >
                  {mappingVirtualRows.rows.map((virtualRow) => {
                    const row = virtualRow.row;
                    const selected = selectedRowIdSet.has(row.id);
                    const isManualOverride = row.status === "overridden";
                    const isAiHighlighted = row.confidence >= 0.9;
                    const isException = isMappingExceptionV1(row);
                    const stateLabel = toMappingStateLabelV1(row);
                    return (
                      <div
                        key={row.id}
                        className="mapping-grid-row"
                        data-selected={selected ? "true" : undefined}
                        data-ai-highlighted={
                          isAiHighlighted ? "true" : undefined
                        }
                        data-manual-override={
                          isManualOverride ? "true" : undefined
                        }
                        data-exception={isException ? "true" : undefined}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: "grid",
                          gridTemplateColumns: mappingGridTemplateColumnsV1,
                          minHeight: `${mappingGridRowHeightV1}px`,
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          className="mapping-grid-row-checkbox"
                          onChange={(event) => {
                            setRowSelectedV1(row.id, event.target.checked);
                          }}
                          aria-label={`Select account ${row.sourceAccountNumber}`}
                        />
                        <div>{row.sourceAccountNumber}</div>
                        <div>{row.accountName}</div>
                        <div className="numeric">{row.accountNumber}</div>
                        <div>{row.selectedCategory.code}</div>
                        <div>{Math.round(row.confidence * 100)}%</div>
                        <div>
                          <span
                            className="mapping-grid-state"
                            data-state={stateLabel
                              .toLowerCase()
                              .replace(/\s+/g, "-")}
                          >
                            {stateLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}

          {applyMappingOverrideMutation.isError ? (
            <p className="error-text">
              {toUserFacingErrorMessage(applyMappingOverrideMutation.error)}
            </p>
          ) : null}
        </CardV1>
      ) : null}

      {normalizedCoreModule === "tax-adjustments" ? (
        <section
          id="module-panel-tax-adjustments"
          role="tabpanel"
          className="workspace-layout workspace-layout--tax"
        >
          <div className="workspace-layout-sidebar">
            <SidebarNavV1
              sections={taxSidebarSections}
              pinnedItems={taxPinnedItems}
              pinnedTitle="Calculation Chain"
            />
          </div>

          <div className="module-shell-v1-main">
            <CardV1>
              <p className="micro-label">{t("module.taxAdjustments")}</p>
              <h1 className="page-title">
                {subModule
                  ? (taxSubmoduleLabelBySlugV1.get(subModule) ?? subModule)
                  : "General Client Information"}
              </h1>
              <p className="hint-text">
                Use the left navigation to work through common and advanced tax
                adjustment modules.
              </p>
              {taxAdjustmentsQuery.isPending ? (
                <div className="panel-stack">
                  <SkeletonV1 width={240} height={16} />
                  <SkeletonV1 width={200} height={16} />
                  <SkeletonV1 width={260} height={16} />
                </div>
              ) : null}
              {taxAdjustmentsQuery.isSuccess ? (
                <p className="hint-text">
                  Active adjustments version{" "}
                  {taxAdjustmentsQuery.data.active.version}
                </p>
              ) : null}
              {taxAdjustmentsQuery.isError ? (
                taxAdjustmentsQuery.error instanceof ApiClientError &&
                taxAdjustmentsQuery.error.code === "ADJUSTMENTS_NOT_FOUND" ? (
                  <EmptyStateV1
                    title="No adjustment artifact yet"
                    description="Run annual report and account mapping first, then return here for adjustments."
                  />
                ) : (
                  <EmptyStateV1
                    title="Tax adjustments unavailable"
                    description={toUserFacingErrorMessage(
                      taxAdjustmentsQuery.error,
                    )}
                    tone="error"
                    role="alert"
                    action={
                      <ButtonV1 onClick={() => taxAdjustmentsQuery.refetch()}>
                        Retry
                      </ButtonV1>
                    }
                  />
                )
              ) : null}
            </CardV1>

            <CardV1 className="module-shell-v1-summary-card">
              <p className="micro-label">{t("module.sidebar.finalTax")}</p>
              {taxSummaryQuery.isPending ? (
                <div className="panel-stack">
                  <SkeletonV1 width={160} height={28} />
                  <SkeletonV1 width={120} height={14} />
                  <SkeletonV1 width={160} height={28} />
                  <SkeletonV1 width={120} height={14} />
                </div>
              ) : null}
              {taxSummaryQuery.isSuccess ? (
                <>
                  <p className="section-title numeric">
                    {taxSummaryQuery.data.summary.taxableIncome}
                  </p>
                  <p className="hint-text">Taxable income</p>
                  <p className="section-title numeric">
                    {taxSummaryQuery.data.summary.corporateTax}
                  </p>
                  <p className="hint-text">Corporate tax</p>
                </>
              ) : null}
              {taxSummaryQuery.isError ? (
                taxSummaryQuery.error instanceof ApiClientError &&
                taxSummaryQuery.error.code === "ADJUSTMENTS_NOT_FOUND" ? (
                  <EmptyStateV1
                    title="Summary pending"
                    description="No final summary available yet."
                  />
                ) : (
                  <EmptyStateV1
                    title="Final summary unavailable"
                    description={toUserFacingErrorMessage(
                      taxSummaryQuery.error,
                    )}
                    tone="error"
                    role="alert"
                    action={
                      <ButtonV1 onClick={() => taxSummaryQuery.refetch()}>
                        Retry
                      </ButtonV1>
                    }
                  />
                )
              ) : null}
            </CardV1>
          </div>
        </section>
      ) : null}

      {normalizedCoreModule === "tax-return-ink2" ? (
        <CardV1 id="module-panel-tax-return-ink2" role="tabpanel">
          <p className="micro-label">{t("ink2.title")}</p>
          <h1 className="page-title">{t("ink2.title")}</h1>
          <p className="hint-text">{t("ink2.subtitle")}</p>
          {ink2Query.isPending ? (
            <div className="ink2-canvas">
              <div className="panel-stack">
                <SkeletonV1 height={36} />
                <SkeletonV1 height={36} />
                <SkeletonV1 height={36} />
                <SkeletonV1 height={36} />
                <SkeletonV1 height={36} />
              </div>
            </div>
          ) : null}
          {ink2Query.isSuccess ? (
            ink2Query.data.form.fields.length === 0 ? (
              <EmptyStateV1
                title="INK2 draft is empty"
                description="Run tax summary and populate the form to show values here."
              />
            ) : (
              <div className="ink2-canvas">
                <div className="ink2-grid">
                  <div className="micro-label ink2-grid-header">Code</div>
                  <div className="micro-label ink2-grid-header">Field</div>
                  <div className="micro-label numeric ink2-grid-header">
                    Amount
                  </div>
                  {ink2Query.data.form.fields.map((field) => (
                    <div key={field.fieldId} style={{ display: "contents" }}>
                      <div className="ink2-code">
                        {field.fieldId.split(".")[1]?.toUpperCase() ??
                          field.fieldId}
                      </div>
                      <div
                        className={
                          field.provenance === "manual"
                            ? "ink2-field"
                            : "ink2-field ink2-field--ai"
                        }
                      >
                        {field.fieldId}
                      </div>
                      <div className="numeric ink2-amount">{field.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : null}
          {ink2Query.isError ? (
            ink2Query.error instanceof ApiClientError &&
            ink2Query.error.code === "FORM_NOT_FOUND" ? (
              <EmptyStateV1
                title="No INK2 draft yet"
                description="Run tax summary and INK2 form generation first."
              />
            ) : (
              <EmptyStateV1
                title="INK2 draft unavailable"
                description={toUserFacingErrorMessage(ink2Query.error)}
                tone="error"
                role="alert"
                action={
                  <ButtonV1 onClick={() => ink2Query.refetch()}>Retry</ButtonV1>
                }
              />
            )
          ) : null}
        </CardV1>
      ) : null}
    </section>
  );
}
