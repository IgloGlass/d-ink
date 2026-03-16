import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type MouseEvent as ReactMouseEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MappingDecisionRecordV1,
  SilverfinTaxCategoryCodeV1,
  SilverfinTaxCategoryStatementTypeV1,
} from "../../../shared/contracts/mapping.v1";
import { listSilverfinTaxCategoriesV1 } from "../../../shared/contracts/mapping.v1";
import { ButtonV1 } from "../../components/button-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import type { GetActiveMappingResponseV1 } from "../../lib/http/workspace-api";
import { applyMappingOverridesV1 } from "../../lib/http/workspace-api";

const mappingGridRowHeightV1 = 68;
const mappingGridViewportHeightV1 = 620;
const mappingGridOverscanV1 = 8;

type MappingPreferenceScopeDraftV1 = "return" | "user" | "group";
type MappingViewModeV1 = "all" | "exceptions";
type MappingRowToneV1 = "stable" | "attention" | "override";

type MappingGridDraftV1 = {
  reason: string;
  scope: MappingPreferenceScopeDraftV1;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
};

const mappingColumnMinWidthsV1 = {
  account: 92,
  description: 220,
  category: 260,
  confidence: 340,
} as const;

function formatConfidenceLabelV1(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function normalizeReasoningTextV1(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUsefulReasoningTextV1(
  decision: MappingDecisionRecordV1,
  text: string | null | undefined,
): text is string {
  if (!text) {
    return false;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return false;
  }

  const normalizedText = normalizeReasoningTextV1(trimmedText);
  const normalizedAccountName = normalizeReasoningTextV1(decision.accountName);
  const normalizedAccountNumber = normalizeReasoningTextV1(
    decision.sourceAccountNumber,
  );

  if (
    normalizedText === normalizedAccountName ||
    normalizedText === `${normalizedAccountNumber} ${normalizedAccountName}` ||
    normalizedText.startsWith(
      `${normalizedAccountNumber} ${normalizedAccountName}`,
    )
  ) {
    return false;
  }

  return true;
}

function buildReasoningSummaryV1(decision: MappingDecisionRecordV1): string {
  const rationale = decision.aiTrace?.rationale?.trim();
  if (isUsefulReasoningTextV1(decision, rationale)) {
    return rationale;
  }

  const snippet = decision.evidence.find(
    (item) => (item.snippet ?? "").trim().length > 0,
  );
  const evidenceSnippet = snippet?.snippet?.trim();
  if (isUsefulReasoningTextV1(decision, evidenceSnippet)) {
    return evidenceSnippet;
  }

  if (decision.selectedCategory.code !== decision.proposedCategory.code) {
    return `${decision.accountName} should be treated as ${decision.selectedCategory.name} instead of ${decision.proposedCategory.name}.`;
  }

  return `${decision.accountName} should be treated as ${decision.selectedCategory.name}.`;
}

function getStatementTypeCategoriesV1(
  statementType: SilverfinTaxCategoryStatementTypeV1,
) {
  return listSilverfinTaxCategoriesV1().filter(
    (category) => category.statementType === statementType,
  );
}

function getDecisionToneV1(
  decision: MappingDecisionRecordV1,
): MappingRowToneV1 {
  if (decision.status === "overridden") {
    return "override";
  }

  if (decision.reviewFlag || decision.confidence < 0.8) {
    return "attention";
  }

  return "stable";
}

function getDecisionStatusLabelV1(decision: MappingDecisionRecordV1): string {
  if (decision.status === "overridden") {
    return "Manual override";
  }

  if (decision.reviewFlag || decision.confidence < 0.8) {
    return "Needs review";
  }

  if (decision.status === "confirmed") {
    return "Confirmed";
  }

  return "Proposed";
}

function getDecisionStatusCompactLabelV1(
  decision: MappingDecisionRecordV1,
): string {
  if (decision.status === "overridden") {
    return "Override";
  }

  if (decision.reviewFlag || decision.confidence < 0.8) {
    return "Review";
  }

  if (decision.status === "confirmed") {
    return "Confirmed";
  }

  return "Aligned";
}

function getDecisionStatusToneV1(
  decision: MappingDecisionRecordV1,
): "success" | "attention" | undefined {
  const tone = getDecisionToneV1(decision);
  if (tone === "stable") {
    return "success";
  }
  if (tone === "attention") {
    return "attention";
  }
  return undefined;
}

function getSourceLabelV1(source: MappingDecisionRecordV1["source"]): string {
  switch (source) {
    case "ai":
      return "AI";
    case "manual":
      return "Manual";
    default:
      return "Deterministic";
  }
}

function matchesSearchTermV1(
  decision: MappingDecisionRecordV1,
  searchTerm: string,
): boolean {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    decision.sourceAccountNumber,
    decision.accountName,
    decision.selectedCategory.code,
    decision.selectedCategory.name,
    decision.proposedCategory.code,
    decision.proposedCategory.name,
    decision.policyRuleReference,
    getSourceLabelV1(decision.source),
    buildReasoningSummaryV1(decision),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
}

function getDraftForDecisionV1(
  decision: MappingDecisionRecordV1,
  draft: MappingGridDraftV1 | undefined,
): MappingGridDraftV1 {
  if (draft) {
    return draft;
  }

  return {
    selectedCategoryCode: decision.selectedCategory.code,
    scope: decision.override?.scope ?? "return",
    reason: "",
  };
}

function isDraftDirtyV1(
  decision: MappingDecisionRecordV1,
  draft: MappingGridDraftV1,
): boolean {
  return (
    draft.selectedCategoryCode !== decision.selectedCategory.code ||
    draft.scope !== (decision.override?.scope ?? "return") ||
    draft.reason.trim().length > 0
  );
}

function formatCategoryOptionLabelV1(code: string, name: string): string {
  return `${code} - ${name}`;
}

export function AccountMappingGridV1({
  tenantId,
  workspaceId,
  mappingQuery,
}: {
  tenantId: string;
  workspaceId: string;
  mappingQuery: {
    data?: GetActiveMappingResponseV1;
    isPending: boolean;
  };
}) {
  const queryClient = useQueryClient();
  const [mappingViewMode, setMappingViewMode] =
    useState<MappingViewModeV1>("all");
  const [searchValue, setSearchValue] = useState("");
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MappingGridDraftV1>>({});
  const [mappingScrollTop, setMappingScrollTop] = useState(0);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(
    null,
  );
  const [columnWidths, setColumnWidths] = useState({
    account: 96,
    description: 300,
    category: 300,
    confidence: 430,
  });

  const mappingScrollRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLElement | null>(null);
  const deferredSearchValue = useDeferredValue(
    searchValue.trim().toLowerCase(),
  );
  const mappingArtifact = mappingQuery.data?.mapping;
  const activeMappingKeyV1 = `${
    mappingQuery.data?.active?.artifactId ?? "none"
  }:${mappingQuery.data?.active?.version ?? 0}`;
  const mappingAllRows = useMemo(
    () => mappingArtifact?.decisions ?? [],
    [mappingArtifact],
  );
  const deferredRows = useDeferredValue(mappingAllRows);
  const effectiveRows =
    deferredRows.length === 0 && mappingAllRows.length > 0
      ? mappingAllRows
      : deferredRows;

  const mappingRows = useMemo(() => {
    const modeFilteredRows =
      mappingViewMode === "all"
        ? effectiveRows
        : effectiveRows.filter(
            (row) =>
              row.reviewFlag ||
              row.status === "overridden" ||
              row.confidence < 0.8,
          );

    return modeFilteredRows.filter((row) =>
      matchesSearchTermV1(row, deferredSearchValue),
    );
  }, [deferredSearchValue, effectiveRows, mappingViewMode]);

  useEffect(() => {
    if (!mappingRows) {
      return;
    }

    setMappingScrollTop(0);
    const scrollContainer = mappingScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0 });
      return;
    }

    scrollContainer.scrollTop = 0;
  }, [mappingRows]);

  useEffect(() => {
    if (mappingRows.length === 0) {
      setSelectedDecisionId(null);
      setIsDetailPanelOpen(false);
      return;
    }

    const hasCurrentSelection = mappingRows.some(
      (decision) => decision.id === selectedDecisionId,
    );

    if (!hasCurrentSelection) {
      setSelectedDecisionId(mappingRows[0]?.id ?? null);
    }
  }, [mappingRows, selectedDecisionId]);

  useEffect(() => {
    const latestActiveMappingKeyV1 = activeMappingKeyV1;
    if (!latestActiveMappingKeyV1) {
      return;
    }

    setDrafts({});
  }, [activeMappingKeyV1]);

  useEffect(() => {
    const tableCardNode = tableCardRef.current;
    const scrollNode = mappingScrollRef.current;

    if (!tableCardNode && !scrollNode) {
      return;
    }

    const measureWidth = () => {
      const scrollViewportWidth = scrollNode?.clientWidth ?? 0;
      const fallbackCardWidth = tableCardNode?.clientWidth ?? 0;
      const nextWidth = scrollViewportWidth || fallbackCardWidth;

      if (nextWidth > 0) {
        setTableViewportWidth(nextWidth);
      }
    };

    measureWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      measureWidth();
    });

    if (tableCardNode) {
      observer.observe(tableCardNode);
    }

    if (scrollNode) {
      observer.observe(scrollNode);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const selectedDecision =
    mappingRows.find((decision) => decision.id === selectedDecisionId) ??
    mappingAllRows.find((decision) => decision.id === selectedDecisionId) ??
    mappingRows[0] ??
    null;

  const selectedDraft = selectedDecision
    ? getDraftForDecisionV1(selectedDecision, drafts[selectedDecision.id])
    : null;
  const isDetailPanelVisible = Boolean(
    isDetailPanelOpen && selectedDecision && selectedDraft,
  );

  const effectiveColumnWidths = useMemo(() => {
    const baseTotalWidth = Object.values(columnWidths).reduce(
      (sum, width) => sum + width,
      0,
    );

    if (tableViewportWidth <= baseTotalWidth) {
      return columnWidths;
    }

    const extraWidth = tableViewportWidth - baseTotalWidth;
    const descriptionExtra = Math.round(extraWidth * 0.24);
    const categoryExtra = Math.round(extraWidth * 0.5);
    const confidenceExtra = extraWidth - descriptionExtra - categoryExtra;

    return {
      account: columnWidths.account,
      description: columnWidths.description + descriptionExtra,
      category: columnWidths.category + categoryExtra,
      confidence: columnWidths.confidence + confidenceExtra,
    };
  }, [columnWidths, tableViewportWidth]);

  const virtualRows = useMemo(() => {
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

    return mappingRows.slice(startIndex, endIndex).map((row, index) => ({
      row,
      offsetTop: (startIndex + index) * mappingGridRowHeightV1,
    }));
  }, [mappingRows, mappingScrollTop]);

  const applyOverrideMutation = useMutation({
    mutationFn: async (decisionId: string) => {
      const active = mappingQuery.data?.active;
      const decision = mappingAllRows.find((row) => row.id === decisionId);
      const draft = decision
        ? getDraftForDecisionV1(decision, drafts[decisionId])
        : null;

      if (!active || !decision || !draft) {
        throw new Error("Active mapping decision is not available.");
      }

      if (!draft.reason.trim()) {
        throw new Error("Override reason is required.");
      }

      if (draft.scope === "group") {
        throw new Error(
          "Legacy group-scoped overrides cannot be edited from the V1 mapper workbench.",
        );
      }

      return applyMappingOverridesV1({
        tenantId,
        workspaceId,
        expectedActiveMapping: {
          artifactId: active.artifactId,
          version: active.version,
        },
        overrides: [
          {
            decisionId,
            selectedCategoryCode: draft.selectedCategoryCode,
            scope: draft.scope,
            reason: draft.reason.trim(),
          },
        ],
      });
    },
    onSuccess: async (_, decisionId) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[decisionId];
        return next;
      });
      await queryClient.invalidateQueries({
        queryKey: ["active-mapping", tenantId, workspaceId],
      });
    },
  });

  const updateDraftV1 = (
    decision: MappingDecisionRecordV1,
    patch: Partial<MappingGridDraftV1>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [decision.id]: {
        ...getDraftForDecisionV1(decision, current[decision.id]),
        ...patch,
      },
    }));
  };

  const handleShowDetailsV1 = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDetailPanelOpen(true);
  };

  const startResize = (
    event: ReactMouseEvent,
    columnKey: keyof typeof columnWidths,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[columnKey];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidths((current) => ({
        ...current,
        [columnKey]: Math.max(
          mappingColumnMinWidthsV1[columnKey],
          startWidth + delta,
        ),
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  if (mappingQuery.isPending) {
    return (
      <div className="account-mapper account-mapper--loading">
        <SkeletonV1 height={148} />
        <SkeletonV1 height={96} />
        <SkeletonV1 height={620} />
      </div>
    );
  }

  if (mappingAllRows.length === 0) {
    return (
      <div className="account-mapper account-mapper--empty">
        <div className="account-mapper__empty-state">
          <div className="workspace-panel-header__eyebrow">
            AI mapping workbench
          </div>
          <h3>Import the trial balance to populate the account table.</h3>
          <p>
            The mapper creates a reviewable account-to-tax table once the trial
            balance import completes.
          </p>
        </div>
      </div>
    );
  }

  const executionMetadata = mappingArtifact?.executionMetadata;

  return (
    <div className="account-mapper">
      {executionMetadata?.degraded ? (
        <div className="account-mapper__banner">
          <div className="account-mapper__banner-label">
            Degraded mapping mode
          </div>
          <p>
            Requested strategy was{" "}
            <strong>{executionMetadata.requestedStrategy}</strong>, but the
            saved run executed as{" "}
            <strong>{executionMetadata.actualStrategy}</strong>.
          </p>
          {executionMetadata.degradedReason ? (
            <p>{executionMetadata.degradedReason}</p>
          ) : null}
        </div>
      ) : null}

      <section className="account-mapper__toolbar">
        <div className="account-mapper__toolbar-controls">
          <div
            className="account-mapper__toggle-group"
            role="tablist"
            aria-label="Mapping view mode"
          >
            <button
              type="button"
              className={`account-mapper__toggle${
                mappingViewMode === "all"
                  ? " account-mapper__toggle--active"
                  : ""
              }`}
              onClick={() => setMappingViewMode("all")}
            >
              All rows
            </button>
            <button
              type="button"
              className={`account-mapper__toggle${
                mappingViewMode === "exceptions"
                  ? " account-mapper__toggle--active"
                  : ""
              }`}
              onClick={() => setMappingViewMode("exceptions")}
            >
              Exceptions only
            </button>
          </div>

          <label className="account-mapper__search-field">
            <span className="sr-only">Search mapped rows</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search account, category, rule, or reasoning"
            />
          </label>
        </div>

        <div className="account-mapper__toolbar-meta">
          <span>{mappingRows.length} visible rows</span>
          <span>
            {searchValue.trim()
              ? `Filtered by "${searchValue.trim()}"`
              : mappingViewMode === "all"
                ? "Showing the full mapping table"
                : "Showing the review queue"}
          </span>
        </div>
      </section>

      {selectedDecision ? (
        <section className="account-mapper__selection-bar">
          <div className="account-mapper__selection-copy">
            <span className="account-mapper__selection-label">
              Selected row
            </span>
            <div className="account-mapper__selection-primary">
              <span className="account-mapper__selection-account">
                {selectedDecision.sourceAccountNumber}
              </span>
              <span
                className="account-mapper__selection-name"
                title={selectedDecision.accountName}
              >
                {selectedDecision.accountName}
              </span>
            </div>
            <span
              className="account-mapper__selection-secondary"
              title={`${selectedDecision.selectedCategory.code} · ${selectedDecision.selectedCategory.name}`}
            >
              {selectedDecision.selectedCategory.code} ·{" "}
              {selectedDecision.selectedCategory.name}
            </span>
          </div>

          <div className="account-mapper__selection-actions">
            <span
              className="status-pill account-mapper__status-pill"
              data-tone={getDecisionStatusToneV1(selectedDecision)}
              data-mapper-state={selectedDecision.status}
            >
              <span className="status-badge-v1__dot" />
              {getDecisionStatusCompactLabelV1(selectedDecision)}
            </span>
            <ButtonV1
              variant={isDetailPanelVisible ? "secondary" : "black"}
              size="sm"
              aria-label={
                isDetailPanelVisible
                  ? "Hide selected row details"
                  : "Show selected row details"
              }
              onClick={() =>
                isDetailPanelVisible
                  ? setIsDetailPanelOpen(false)
                  : handleShowDetailsV1(selectedDecision.id)
              }
            >
              {isDetailPanelVisible ? "Hide details" : "Show details"}
            </ButtonV1>
          </div>
        </section>
      ) : null}

      <section
        className={`account-mapper__layout${
          isDetailPanelVisible ? " account-mapper__layout--detail-open" : ""
        }`}
      >
        <article ref={tableCardRef} className="account-mapper__table-card">
          <div className="account-mapper__table-header">
            <div>
              <div className="micro-label">Mapping table</div>
              <h4>Account-to-tax overview</h4>
            </div>
            <div className="account-mapper__legend" aria-label="Mapping legend">
              <span className="account-mapper__legend-item" data-tone="stable">
                AI aligned
              </span>
              <span
                className="account-mapper__legend-item"
                data-tone="attention"
              >
                Needs review
              </span>
              <span
                className="account-mapper__legend-item"
                data-tone="override"
              >
                Override
              </span>
            </div>
          </div>

          <div className="account-mapper__table-head">
            {[
              { key: "account", label: "Account" },
              { key: "description", label: "Description" },
              { key: "category", label: "Category" },
              { key: "confidence", label: "AI review" },
            ].map((column) => (
              <div
                key={column.key}
                style={{
                  width:
                    effectiveColumnWidths[
                      column.key as keyof typeof effectiveColumnWidths
                    ],
                }}
                className="account-mapper__table-head-cell"
              >
                {column.label}
                <div
                  className="account-mapper__column-resizer"
                  onMouseDown={(event) =>
                    startResize(event, column.key as keyof typeof columnWidths)
                  }
                />
              </div>
            ))}
          </div>

          {mappingRows.length === 0 ? (
            <div className="account-mapper__table-empty">
              <strong>No rows match the current filters.</strong>
              <p>
                Adjust the view or clear the search to see more mapped accounts.
              </p>
            </div>
          ) : (
            <div
              ref={mappingScrollRef}
              className="account-mapper__table-scroll"
              data-testid="account-mapping-grid-scroll"
              style={{ height: mappingGridViewportHeightV1 }}
              onScroll={(event) =>
                setMappingScrollTop(event.currentTarget.scrollTop)
              }
            >
              <div
                style={{
                  height: mappingRows.length * mappingGridRowHeightV1,
                  position: "relative",
                }}
              >
                {virtualRows.map(({ row, offsetTop }) => {
                  const draft = getDraftForDecisionV1(row, drafts[row.id]);
                  const draftDirty = isDraftDirtyV1(row, draft);
                  const allowedCategories = getStatementTypeCategoriesV1(
                    row.selectedCategory.statementType,
                  );
                  const isSelected = row.id === selectedDecision?.id;
                  const tone = getDecisionToneV1(row);
                  const annualReportReferenceCount =
                    row.aiTrace?.annualReportContextReferences?.length ?? 0;
                  const reasoningSummary = buildReasoningSummaryV1(row);

                  return (
                    <div
                      key={row.id}
                      className={`account-mapper__row${
                        isSelected ? " account-mapper__row--selected" : ""
                      }`}
                      data-tone={tone}
                      style={{
                        height: mappingGridRowHeightV1,
                        transform: `translateY(${offsetTop}px)`,
                      }}
                    >
                      <button
                        type="button"
                        style={{ width: effectiveColumnWidths.account }}
                        className="account-mapper__cell account-mapper__cell--account account-mapper__cell-button"
                        onClick={() => setSelectedDecisionId(row.id)}
                        title={`${row.sourceAccountNumber} · ${row.accountName}`}
                      >
                        <div className="account-mapper__account-number">
                          {row.sourceAccountNumber}
                        </div>
                      </button>

                      <button
                        type="button"
                        style={{ width: effectiveColumnWidths.description }}
                        className="account-mapper__cell account-mapper__cell-button"
                        onClick={() => setSelectedDecisionId(row.id)}
                        title={row.accountName}
                      >
                        <div className="account-mapper__cell-title">
                          {row.accountName}
                        </div>
                      </button>

                      <div
                        style={{ width: effectiveColumnWidths.category }}
                        className="account-mapper__cell"
                      >
                        <label
                          className="sr-only"
                          htmlFor={`mapping-category-${row.id}`}
                        >
                          Category for {row.sourceAccountNumber}
                        </label>
                        <select
                          id={`mapping-category-${row.id}`}
                          aria-label={`Category for ${row.sourceAccountNumber}`}
                          className={`account-mapper__select${
                            draftDirty ? " account-mapper__select--dirty" : ""
                          }`}
                          value={draft.selectedCategoryCode}
                          onChange={(event) => {
                            updateDraftV1(row, {
                              selectedCategoryCode: event.target
                                .value as SilverfinTaxCategoryCodeV1,
                            });
                            setSelectedDecisionId(row.id);
                          }}
                        >
                          {allowedCategories.map((category) => (
                            <option key={category.code} value={category.code}>
                              {formatCategoryOptionLabelV1(
                                category.code,
                                category.name,
                              )}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div
                        style={{ width: effectiveColumnWidths.confidence }}
                        className="account-mapper__cell account-mapper__cell--review"
                      >
                        <button
                          type="button"
                          className="account-mapper__cell-button account-mapper__review-button"
                          onClick={() => setSelectedDecisionId(row.id)}
                          title={reasoningSummary}
                        >
                          <div className="account-mapper__confidence-cluster">
                            <span
                              className="account-mapper__confidence-value"
                              data-tone={tone}
                            >
                              {formatConfidenceLabelV1(row.confidence)}
                            </span>
                          </div>
                          <div className="account-mapper__reasoning-snippet">
                            {reasoningSummary}
                          </div>
                        </button>
                        <div className="account-mapper__review-meta">
                          {annualReportReferenceCount > 0 ? (
                            <span className="account-mapper__trace-chip">
                              {annualReportReferenceCount} refs
                            </span>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`${
                              isSelected && isDetailPanelVisible
                                ? "Hide"
                                : "Show"
                            } details for ${row.sourceAccountNumber}`}
                            className={`account-mapper__row-action${
                              isSelected
                                ? " account-mapper__row-action--visible"
                                : ""
                            }`}
                            onClick={() =>
                              isSelected && isDetailPanelVisible
                                ? setIsDetailPanelOpen(false)
                                : handleShowDetailsV1(row.id)
                            }
                          >
                            {isSelected && isDetailPanelVisible
                              ? "Hide"
                              : "Details"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        {isDetailPanelOpen && selectedDecision && selectedDraft ? (
          <article className="account-mapper__detail-card">
            <div className="account-mapper__detail-header">
              <div>
                <div className="workspace-panel-header__eyebrow">
                  Selected row
                </div>
                <h3>
                  {selectedDecision.sourceAccountNumber} ·{" "}
                  {selectedDecision.accountName}
                </h3>
                <p>
                  Review the AI rationale, evidence trail, and override settings
                  before promoting a different category.
                </p>
              </div>
              <div className="account-mapper__detail-summary-meta">
                <ButtonV1
                  variant="secondary"
                  size="sm"
                  aria-label="Hide selected row details"
                  onClick={() => setIsDetailPanelOpen(false)}
                >
                  Hide
                </ButtonV1>
                <span
                  className="status-pill account-mapper__status-pill"
                  data-tone={getDecisionStatusToneV1(selectedDecision)}
                  data-mapper-state={selectedDecision.status}
                >
                  <span className="status-badge-v1__dot" />
                  {getDecisionStatusLabelV1(selectedDecision)}
                </span>
                <strong>
                  {formatConfidenceLabelV1(selectedDecision.confidence)}
                </strong>
              </div>
            </div>

            <div className="account-mapper__detail-metrics">
              <div className="account-mapper__detail-metric">
                <span>Proposed</span>
                <strong>{selectedDecision.proposedCategory.code}</strong>
                <p>{selectedDecision.proposedCategory.name}</p>
              </div>
              <div className="account-mapper__detail-metric">
                <span>Selected</span>
                <strong>{selectedDecision.selectedCategory.code}</strong>
                <p>{selectedDecision.selectedCategory.name}</p>
              </div>
              <div className="account-mapper__detail-metric">
                <span>Source</span>
                <strong>{getSourceLabelV1(selectedDecision.source)}</strong>
                <p>{selectedDecision.policyRuleReference}</p>
              </div>
            </div>

            <section className="account-mapper__detail-section">
              <div className="micro-label">AI reasoning</div>
              <div className="account-mapper__detail-reasoning">
                {buildReasoningSummaryV1(selectedDecision)}
              </div>
            </section>

            {selectedDecision.aiTrace?.annualReportContextReferences?.length ? (
              <section className="account-mapper__detail-section">
                <div className="micro-label">Annual-report context used</div>
                <ul className="account-mapper__detail-list">
                  {selectedDecision.aiTrace.annualReportContextReferences.map(
                    (reference) => (
                      <li
                        key={`${reference.area}:${reference.reference}`}
                        className="account-mapper__detail-list-item"
                      >
                        <strong>{reference.area}</strong>
                        <span>{reference.reference}</span>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}

            <section className="account-mapper__detail-section">
              <div className="micro-label">Evidence trail</div>
              <ul className="account-mapper__detail-list">
                {selectedDecision.evidence.map((item, index) => (
                  <li
                    key={`${item.reference}-${index}`}
                    className="account-mapper__detail-list-item"
                  >
                    <strong>
                      {item.type} · {item.reference}
                    </strong>
                    <span>{item.snippet}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="account-mapper__detail-section">
              <div className="micro-label">Review action</div>
              <div className="account-mapper__detail-note">
                Changes stay versioned and auditable. A reason is required
                before a new mapping becomes active.
              </div>

              <label className="account-mapper__field">
                <span>Override scope</span>
                <select
                  aria-label={`Override scope for ${selectedDecision.sourceAccountNumber}`}
                  className="account-mapper__select"
                  value={selectedDraft.scope}
                  onChange={(event) =>
                    updateDraftV1(selectedDecision, {
                      scope: event.target
                        .value as MappingPreferenceScopeDraftV1,
                    })
                  }
                >
                  <option value="return">Return</option>
                  <option value="group">Group (legacy)</option>
                  <option value="user">User</option>
                </select>
              </label>

              <label className="account-mapper__field">
                <span>Target category</span>
                <select
                  aria-label={`Override category for ${selectedDecision.sourceAccountNumber}`}
                  className={`account-mapper__select${
                    isDraftDirtyV1(selectedDecision, selectedDraft)
                      ? " account-mapper__select--dirty"
                      : ""
                  }`}
                  value={selectedDraft.selectedCategoryCode}
                  onChange={(event) =>
                    updateDraftV1(selectedDecision, {
                      selectedCategoryCode: event.target
                        .value as SilverfinTaxCategoryCodeV1,
                    })
                  }
                >
                  {getStatementTypeCategoriesV1(
                    selectedDecision.selectedCategory.statementType,
                  ).map((category) => (
                    <option key={category.code} value={category.code}>
                      {formatCategoryOptionLabelV1(
                        category.code,
                        category.name,
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label className="account-mapper__field">
                <span>Override reason</span>
                <textarea
                  aria-label={`Override reason for ${selectedDecision.sourceAccountNumber}`}
                  className="account-mapper__textarea"
                  placeholder="Explain why this mapping should change."
                  value={selectedDraft.reason}
                  onChange={(event) =>
                    updateDraftV1(selectedDecision, {
                      reason: event.target.value,
                    })
                  }
                />
              </label>

              {selectedDecision.override ? (
                <div className="account-mapper__current-override">
                  Current override: {selectedDecision.override.scope} ·{" "}
                  {selectedDecision.override.reason}
                </div>
              ) : null}

              {applyOverrideMutation.isError ? (
                <div className="workspace-inline-error" role="alert">
                  {toUserFacingErrorMessage(applyOverrideMutation.error)}
                </div>
              ) : null}

              <div className="account-mapper__detail-actions">
                <div className="account-mapper__detail-actions-copy">
                  {isDraftDirtyV1(selectedDecision, selectedDraft)
                    ? "Pending override change"
                    : "No unsaved override changes"}
                </div>
                <ButtonV1
                  variant="primary"
                  disabled={
                    applyOverrideMutation.isPending ||
                    !isDraftDirtyV1(selectedDecision, selectedDraft)
                  }
                  onClick={() =>
                    applyOverrideMutation.mutate(selectedDecision.id)
                  }
                >
                  {applyOverrideMutation.isPending
                    ? "Applying..."
                    : "Apply override"}
                </ButtonV1>
              </div>
            </section>
          </article>
        ) : null}
      </section>
    </div>
  );
}
