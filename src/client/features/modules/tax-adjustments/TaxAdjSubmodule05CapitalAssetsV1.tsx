import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const TARGET_FIELD_LABELS: Record<string, string> = {
  "INK2S.non_deductible_expenses": "INK2 4.3c — Non-deductible expenses",
  "INK2S.representation_non_deductible":
    "INK2 4.3d — Non-deductible representation",
  "INK2S.depreciation_adjustment": "INK2 4.4 — Depreciation adjustment",
  "INK2S.other_manual_adjustments": "INK2 4.5b / 4.7a / 4.7b — Other",
};

function getTargetFieldLabel(targetField: string): string {
  return TARGET_FIELD_LABELS[targetField] ?? targetField;
}

export function TaxAdjSubmodule05CapitalAssetsV1({
  workspaceId,
  tenantId,
}: TaxAdjSubmoduleContentPropsV1) {
  const extractionQuery = useQuery({
    queryKey: ["active-annual-report", tenantId, workspaceId],
    queryFn: () =>
      getActiveAnnualReportExtractionV1({
        tenantId,
        workspaceId,
      }),
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["active-tax-adjustments", tenantId, workspaceId],
    queryFn: () =>
      getActiveTaxAdjustmentsV1({
        tenantId,
        workspaceId,
      }),
  });

  const extraction = extractionQuery.data?.extraction;
  const adjustments = adjustmentsQuery.data?.adjustments;

  const balanceSheetLines =
    extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];
  const incomeStatementLines =
    extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];
  const shareholdingContext = extraction?.taxDeep?.shareholdingContext;

  // Section 1: Financial assets — BS 138xxx, IS 367xxx, 394xxx, 808xxx
  const financialAssetBalanceSheet = balanceSheetLines.filter((line) =>
    (line.code ?? "").startsWith("138"),
  );

  const financialAssetIncomeStatement = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("367") ||
      code.startsWith("394") ||
      code.startsWith("808")
    );
  });

  // Section 2: Capital assets AI decisions
  const capitalAssetsDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "capital_assets_and_unrealized_changes",
  );

  // Section 3: Unrealized changes — 808xxx and 394xxx lines
  const unrealizedLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("808") || code.startsWith("394");
  });

  const totalUnrealizedReversed = unrealizedLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0,
  );

  // Section 4: Computed adjustments summary
  const exemptDividendsDecisions = capitalAssetsDecisions.filter(
    (d) =>
      d.direction === "decrease_taxable_income" &&
      d.rationale.toLowerCase().includes("dividend"),
  );
  const exemptCapitalGainsDecisions = capitalAssetsDecisions.filter(
    (d) =>
      d.direction === "decrease_taxable_income" &&
      !d.rationale.toLowerCase().includes("dividend"),
  );
  const nonDeductibleLossDecisions = capitalAssetsDecisions.filter(
    (d) => d.direction === "increase_taxable_income",
  );

  const totalExemptDividends = exemptDividendsDecisions.reduce(
    (sum, d) => sum + d.amount,
    0,
  );
  const totalExemptCapitalGains = exemptCapitalGainsDecisions.reduce(
    (sum, d) => sum + d.amount,
    0,
  );
  const totalNonDeductibleLosses = nonDeductibleLossDecisions.reduce(
    (sum, d) => sum + d.amount,
    0,
  );

  // Section 5: Review status
  const unreviewedDecisions = capitalAssetsDecisions.filter(
    (d) => d.status === "manual_review_required",
  );

  // Notes relevant to shareholdings / impairments
  const shareholdingNotes = relevantNotes.filter(
    (note) =>
      note.category === "shareholdings_dividends" ||
      note.category === "impairments_write_downs",
  );

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return new Intl.NumberFormat("sv-SE").format(value);
  };

  const getDirectionLabel = (
    direction:
      | "increase_taxable_income"
      | "decrease_taxable_income"
      | "informational",
  ): string => {
    switch (direction) {
      case "increase_taxable_income":
        return "Add-back";
      case "decrease_taxable_income":
        return "Deduction";
      case "informational":
        return "Informational";
      default:
        return direction;
    }
  };

  return (
    <div className="tax-adj-m05-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Financial Assets Overview */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--financial-assets">
        <div className="tax-adj-m05-section__header">
          <h2>Financial Assets Overview</h2>
          <p className="tax-adj-m05-section__subtitle">
            Balance sheet accounts starting with 138 (financial assets
            write-downs) and income statement lines 367xxx (capital
            gain/loss/dividends), 394xxx and 808xxx (unrealized changes).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m05-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <>
            {financialAssetBalanceSheet.length > 0 ? (
              <div className="tax-adj-m05-subsection">
                <h3 className="tax-adj-m05-subsection__title">
                  Balance Sheet — Financial Assets (138xxx)
                </h3>
                <div className="tax-adj-m05-balance-sheet-table">
                  <table className="tax-adj-m05-table">
                    <thead className="tax-adj-m05-table__head">
                      <tr>
                        <th className="tax-adj-m05-table__header">Code</th>
                        <th className="tax-adj-m05-table__header">Label</th>
                        <th className="tax-adj-m05-table__header">
                          Current Year (SEK)
                        </th>
                        <th className="tax-adj-m05-table__header">
                          Prior Year (SEK)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tax-adj-m05-table__body">
                      {financialAssetBalanceSheet.map((line) => (
                        <tr key={line.code} className="tax-adj-m05-table__row">
                          <td className="tax-adj-m05-table__cell">
                            {line.code}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {line.label}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {formatNumber(line.currentYearValue)}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {formatNumber(line.priorYearValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="tax-adj-m05-empty-message">
                No financial asset balance sheet accounts (138xxx) found.
              </p>
            )}

            {financialAssetIncomeStatement.length > 0 ? (
              <div className="tax-adj-m05-subsection">
                <h3 className="tax-adj-m05-subsection__title">
                  Income Statement — Capital Gains/Losses, Dividends &amp;
                  Unrealized Changes (367xxx, 394xxx, 808xxx)
                </h3>
                <div className="tax-adj-m05-income-statement-table">
                  <table className="tax-adj-m05-table">
                    <thead className="tax-adj-m05-table__head">
                      <tr>
                        <th className="tax-adj-m05-table__header">Code</th>
                        <th className="tax-adj-m05-table__header">Label</th>
                        <th className="tax-adj-m05-table__header">
                          Current Year (SEK)
                        </th>
                        <th className="tax-adj-m05-table__header">
                          Prior Year (SEK)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tax-adj-m05-table__body">
                      {financialAssetIncomeStatement.map((line) => (
                        <tr key={line.code} className="tax-adj-m05-table__row">
                          <td className="tax-adj-m05-table__cell">
                            {line.code}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {line.label}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {formatNumber(line.currentYearValue)}
                          </td>
                          <td className="tax-adj-m05-table__cell">
                            {formatNumber(line.priorYearValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="tax-adj-m05-empty-message">
                No capital gain/loss, dividend, or unrealized change income
                statement lines found.
              </p>
            )}

            {shareholdingContext !== undefined ? (
              <div className="tax-adj-m05-subsection">
                <h3 className="tax-adj-m05-subsection__title">
                  Shareholding Context
                </h3>
                <div className="tax-adj-m05-shareholding-summary">
                  {shareholdingContext.dividendsReceived?.value !== undefined ? (
                    <div className="tax-adj-m05-summary-row">
                      <span className="tax-adj-m05-summary-label">
                        Dividends received:
                      </span>
                      <span className="tax-adj-m05-summary-value">
                        {formatNumber(shareholdingContext.dividendsReceived.value)}{" "}
                        SEK
                      </span>
                    </div>
                  ) : null}
                  {shareholdingContext.dividendsPaid?.value !== undefined ? (
                    <div className="tax-adj-m05-summary-row">
                      <span className="tax-adj-m05-summary-label">
                        Dividends paid:
                      </span>
                      <span className="tax-adj-m05-summary-value">
                        {formatNumber(shareholdingContext.dividendsPaid.value)}{" "}
                        SEK
                      </span>
                    </div>
                  ) : null}
                  {shareholdingContext.notes.length > 0 ? (
                    <div className="tax-adj-m05-notes-list">
                      {shareholdingContext.notes.map((note, index) => (
                        <p key={index} className="tax-adj-m05-note-text">
                          {note}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {shareholdingNotes.length > 0 ? (
              <div className="tax-adj-m05-subsection">
                <h3 className="tax-adj-m05-subsection__title">
                  Annual Report Notes — Shareholdings &amp; Impairments
                </h3>
                <div className="tax-adj-m05-notes-list">
                  {shareholdingNotes.map((note, index) => (
                    <div key={index} className="tax-adj-m05-note-item">
                      {note.title ? (
                        <h4 className="tax-adj-m05-note-item__title">
                          {note.title}
                        </h4>
                      ) : null}
                      <p className="tax-adj-m05-note-item__category">
                        {note.category}
                      </p>
                      {note.notes.map((text, noteIndex) => (
                        <p
                          key={noteIndex}
                          className="tax-adj-m05-note-item__text"
                        >
                          {text}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardV1>

      {/* Section 2: Share Classification (AI decisions) */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--ai-decisions">
        <div className="tax-adj-m05-section__header">
          <h2>Share Classification — AI Decisions</h2>
          <p className="tax-adj-m05-section__subtitle">
            AI-proposed treatment per holding based on annual report notes.
            Näringsbetingade andelar (IL 25a): exempt dividends → INK2 4.5b,
            exempt gains → INK2 4.7a, non-deductible losses → INK2 4.7b.
            Portfolio shares remain in the taxable base.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m05-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : capitalAssetsDecisions.length > 0 ? (
          <div className="tax-adj-m05-decisions-table">
            <table className="tax-adj-m05-table">
              <thead className="tax-adj-m05-table__head">
                <tr>
                  <th className="tax-adj-m05-table__header">Amount (SEK)</th>
                  <th className="tax-adj-m05-table__header">Direction</th>
                  <th className="tax-adj-m05-table__header">Target Field</th>
                  <th className="tax-adj-m05-table__header">Rationale</th>
                  <th className="tax-adj-m05-table__header">Confidence</th>
                  <th className="tax-adj-m05-table__header">Status</th>
                  <th className="tax-adj-m05-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m05-table__body">
                {capitalAssetsDecisions.map((decision) => (
                  <tr key={decision.id} className="tax-adj-m05-table__row">
                    <td className="tax-adj-m05-table__cell">
                      {formatNumber(decision.amount)}
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {getDirectionLabel(decision.direction)}
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {getTargetFieldLabel(decision.targetField)}
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {decision.rationale}
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {Math.round(decision.confidence * 100)}%
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {decision.status}
                    </td>
                    <td className="tax-adj-m05-table__cell">
                      {decision.reviewFlag ? (
                        <span className="tax-adj-m05-review-flag">⚠</span>
                      ) : (
                        <span className="tax-adj-m05-review-ok">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m05-empty-message">
            No AI adjustment decisions for capital assets and unrealized changes
            module.
          </p>
        )}
      </CardV1>

      {/* Section 3: Unrealized Changes Reversal */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--unrealized">
        <div className="tax-adj-m05-section__header">
          <h2>Unrealized Changes Reversal</h2>
          <p className="tax-adj-m05-section__subtitle">
            Accounts 808xxx (unrealized changes on shares) and 394xxx (change
            in value / write-downs) are never taxable or deductible — they are
            always fully reversed regardless of share classification.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m05-loading-grid">
            <SkeletonV1 height={60} />
          </div>
        ) : unrealizedLines.length > 0 ? (
          <>
            <div className="tax-adj-m05-unrealized-table">
              <table className="tax-adj-m05-table">
                <thead className="tax-adj-m05-table__head">
                  <tr>
                    <th className="tax-adj-m05-table__header">Code</th>
                    <th className="tax-adj-m05-table__header">Label</th>
                    <th className="tax-adj-m05-table__header">
                      Booked Amount (SEK)
                    </th>
                    <th className="tax-adj-m05-table__header">
                      Reversal (SEK)
                    </th>
                    <th className="tax-adj-m05-table__header">Reason</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m05-table__body">
                  {unrealizedLines.map((line) => (
                    <tr key={line.code} className="tax-adj-m05-table__row">
                      <td className="tax-adj-m05-table__cell">{line.code}</td>
                      <td className="tax-adj-m05-table__cell">{line.label}</td>
                      <td className="tax-adj-m05-table__cell">
                        {formatNumber(line.currentYearValue)}
                      </td>
                      <td className="tax-adj-m05-table__cell">
                        {formatNumber(
                          line.currentYearValue !== undefined
                            ? -line.currentYearValue
                            : undefined,
                        )}
                      </td>
                      <td className="tax-adj-m05-table__cell">
                        Unrealized — never taxable or deductible (IL 25a)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m05-unrealized-summary">
              <div className="tax-adj-m05-summary-row">
                <span className="tax-adj-m05-summary-label">
                  Total unrealized amount to reverse:
                </span>
                <span className="tax-adj-m05-summary-value">
                  {formatNumber(-totalUnrealizedReversed)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m05-empty-message">
            No unrealized change lines (808xxx, 394xxx) found in income
            statement.
          </p>
        )}
      </CardV1>

      {/* Section 4: Computed Adjustments Summary */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--adjustments-summary">
        <div className="tax-adj-m05-section__header">
          <h2>Computed Adjustments Summary</h2>
          <p className="tax-adj-m05-section__subtitle">
            Aggregated tax adjustments by category and target INK2 field.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={100} />
        ) : (
          <div className="tax-adj-m05-computed-summary">
            <div className="tax-adj-m05-summary-row">
              <span className="tax-adj-m05-summary-label">
                Exempt dividends (näringsbetingade andelar) — deduction INK2
                4.5b:
              </span>
              <span className="tax-adj-m05-summary-value">
                {formatNumber(totalExemptDividends)} SEK
              </span>
            </div>
            <div className="tax-adj-m05-summary-row">
              <span className="tax-adj-m05-summary-label">
                Exempt capital gains (näringsbetingade andelar) — deduction INK2
                4.7a:
              </span>
              <span className="tax-adj-m05-summary-value">
                {formatNumber(totalExemptCapitalGains)} SEK
              </span>
            </div>
            <div className="tax-adj-m05-summary-row">
              <span className="tax-adj-m05-summary-label">
                Non-deductible capital losses (IL 25a:19) — add-back INK2 4.7b:
              </span>
              <span className="tax-adj-m05-summary-value">
                {formatNumber(totalNonDeductibleLosses)} SEK
              </span>
            </div>
            <div className="tax-adj-m05-summary-row">
              <span className="tax-adj-m05-summary-label">
                Total unrealized items reversed (no INK2 code — always neutral):
              </span>
              <span className="tax-adj-m05-summary-value">
                {formatNumber(-totalUnrealizedReversed)} SEK
              </span>
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 5: Review Status */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--review-status">
        <div className="tax-adj-m05-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m05-section__subtitle">
            Unresolved decisions requiring manual review.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewedDecisions.length > 0 ? (
          <div className="tax-adj-m05-status tax-adj-m05-status--warning">
            <span className="tax-adj-m05-status__icon">⚠</span>
            <span className="tax-adj-m05-status__text">
              {unreviewedDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m05-status tax-adj-m05-status--ok">
            <span className="tax-adj-m05-status__icon">✓</span>
            <span className="tax-adj-m05-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m05-section tax-adj-m05-section--verification">
        <div className="tax-adj-m05-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m05-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m05-checklist">
          <li className="tax-adj-m05-checklist__item">
            <span className="tax-adj-m05-checklist__marker">✓</span>
            <span>
              Share classification confirmed (näringsbetingad requires ≥10%
              voting rights or business purpose)
            </span>
          </li>
          <li className="tax-adj-m05-checklist__item">
            <span className="tax-adj-m05-checklist__marker">✓</span>
            <span>
              Unrealized gains/losses fully reversed — these are never
              taxable/deductible
            </span>
          </li>
          <li className="tax-adj-m05-checklist__item">
            <span className="tax-adj-m05-checklist__marker">✓</span>
            <span>
              Non-deductible losses on näringsbetingade andelar are added back
              (IL 25a:19)
            </span>
          </li>
          <li className="tax-adj-m05-checklist__item">
            <span className="tax-adj-m05-checklist__marker">✓</span>
            <span>
              No holding changed classification during the year (if it did,
              partial treatment may apply)
            </span>
          </li>
          <li className="tax-adj-m05-checklist__item">
            <span className="tax-adj-m05-checklist__marker">✓</span>
            <span>
              Portfolio share gains/dividends correctly remain in the taxable
              base
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
