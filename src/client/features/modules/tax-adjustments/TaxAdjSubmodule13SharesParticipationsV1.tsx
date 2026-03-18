import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule13SharesParticipationsV1({
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
  const shareholdingContext = extraction?.taxDeep?.shareholdingContext;

  // Section 1: filter shareholding accounts
  const shareholdingBalanceSheet = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("131");
  });

  const shareholdingIncomeStatement = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("801") || code.startsWith("802");
  });

  // Section 3: AI classification decisions for this module
  const sharesDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "shares_and_participations",
  );

  const hasHighValueDecisions = sharesDecisions.some(
    (decision) => Math.abs(decision.amount) > 0,
  );

  // Section 4: Exemption summary
  const exemptDividendsTotal = sharesDecisions
    .filter(
      (d) =>
        d.direction === "decrease_taxable_income" &&
        d.policyRuleReference.includes("4.5b"),
    )
    .reduce((sum, d) => sum + d.amount, 0);

  const exemptCapitalGainsTotal = sharesDecisions
    .filter(
      (d) =>
        d.direction === "decrease_taxable_income" &&
        d.policyRuleReference.includes("4.7a"),
    )
    .reduce((sum, d) => sum + d.amount, 0);

  const nonDeductibleLossesTotal = sharesDecisions
    .filter(
      (d) =>
        d.direction === "increase_taxable_income" &&
        d.policyRuleReference.includes("4.7b"),
    )
    .reduce((sum, d) => sum + d.amount, 0);

  // Section 5: Review status
  const unreviewedDecisions = sharesDecisions.filter(
    (d) => d.status === "manual_review_required",
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

  const getStatusLabel = (
    status:
      | "proposed"
      | "manual_review_required"
      | "overridden"
      | "accepted",
  ): string => {
    switch (status) {
      case "proposed":
        return "Proposed";
      case "manual_review_required":
        return "Manual review required";
      case "overridden":
        return "Overridden";
      case "accepted":
        return "Accepted";
      default:
        return status;
    }
  };

  return (
    <div className="tax-adj-m13-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Shareholding Accounts */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--accounts">
        <div className="tax-adj-m13-section__header">
          <h2>Shareholding Accounts</h2>
          <p className="tax-adj-m13-section__subtitle">
            Balance sheet accounts starting with 131 (andelar) and income
            statement accounts 801x (dividends received) and 802x (capital
            gains/losses on shares).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m13-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : shareholdingBalanceSheet.length > 0 ||
          shareholdingIncomeStatement.length > 0 ? (
          <>
            {shareholdingBalanceSheet.length > 0 ? (
              <div className="tax-adj-m13-accounts-group">
                <h3 className="tax-adj-m13-accounts-group__title">
                  Balance Sheet (131x — Shares and participations)
                </h3>
                <table className="tax-adj-m13-table">
                  <thead className="tax-adj-m13-table__head">
                    <tr>
                      <th className="tax-adj-m13-table__header">Code</th>
                      <th className="tax-adj-m13-table__header">Label</th>
                      <th className="tax-adj-m13-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m13-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m13-table__body">
                    {shareholdingBalanceSheet.map((line) => (
                      <tr key={line.code} className="tax-adj-m13-table__row">
                        <td className="tax-adj-m13-table__cell">{line.code}</td>
                        <td className="tax-adj-m13-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m13-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m13-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {shareholdingIncomeStatement.length > 0 ? (
              <div className="tax-adj-m13-accounts-group">
                <h3 className="tax-adj-m13-accounts-group__title">
                  Income Statement (801x — Dividends received, 802x — Capital
                  gain/loss on shares)
                </h3>
                <table className="tax-adj-m13-table">
                  <thead className="tax-adj-m13-table__head">
                    <tr>
                      <th className="tax-adj-m13-table__header">Code</th>
                      <th className="tax-adj-m13-table__header">Label</th>
                      <th className="tax-adj-m13-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m13-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m13-table__body">
                    {shareholdingIncomeStatement.map((line) => (
                      <tr key={line.code} className="tax-adj-m13-table__row">
                        <td className="tax-adj-m13-table__cell">{line.code}</td>
                        <td className="tax-adj-m13-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m13-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m13-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <p className="tax-adj-m13-empty-message">
            No shareholding accounts found in the mapped statements.
          </p>
        )}
      </CardV1>

      {/* Section 2: Shareholding Context */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--context">
        <div className="tax-adj-m13-section__header">
          <h2>Shareholding Context</h2>
          <p className="tax-adj-m13-section__subtitle">
            Dividends received, flags, and notes extracted from the annual
            report notes on shareholdings and participations.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m13-loading-grid">
            <SkeletonV1 height={60} />
          </div>
        ) : shareholdingContext ? (
          <div className="tax-adj-m13-context">
            {shareholdingContext.dividendsReceived?.value !== undefined ? (
              <div className="tax-adj-m13-context-row">
                <span className="tax-adj-m13-context-row__label">
                  Dividends received (per annual report):
                </span>
                <span className="tax-adj-m13-context-row__value">
                  {formatNumber(shareholdingContext.dividendsReceived.value)}{" "}
                  SEK
                </span>
              </div>
            ) : null}

            {shareholdingContext.dividendsPaid?.value !== undefined ? (
              <div className="tax-adj-m13-context-row">
                <span className="tax-adj-m13-context-row__label">
                  Dividends paid:
                </span>
                <span className="tax-adj-m13-context-row__value">
                  {formatNumber(shareholdingContext.dividendsPaid.value)} SEK
                </span>
              </div>
            ) : null}

            {shareholdingContext.flags.length > 0 ? (
              <div className="tax-adj-m13-context-flags">
                <strong className="tax-adj-m13-context-flags__title">
                  Flags:
                </strong>
                <ul className="tax-adj-m13-context-flags__list">
                  {shareholdingContext.flags.map((flag, index) => (
                    <li
                      key={index}
                      className="tax-adj-m13-context-flags__item"
                    >
                      <span className="tax-adj-m13-context-flags__code">
                        {flag.code}
                      </span>
                      {" — "}
                      {flag.label}
                      {flag.value !== undefined ? (
                        <span className="tax-adj-m13-context-flags__value">
                          {" "}
                          ({String(flag.value)})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {shareholdingContext.notes.length > 0 ? (
              <div className="tax-adj-m13-context-notes">
                <strong className="tax-adj-m13-context-notes__title">
                  Notes:
                </strong>
                <ul className="tax-adj-m13-context-notes__list">
                  {shareholdingContext.notes.map((note, index) => (
                    <li key={index} className="tax-adj-m13-context-notes__item">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {shareholdingContext.dividendsReceived?.value === undefined &&
            shareholdingContext.dividendsPaid?.value === undefined &&
            shareholdingContext.flags.length === 0 &&
            shareholdingContext.notes.length === 0 ? (
              <p className="tax-adj-m13-empty-message">
                Shareholding context extracted but no detail values found.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="tax-adj-m13-empty-message">
            No shareholding context available from the annual report extraction.
          </p>
        )}
      </CardV1>

      {/* Section 3: AI Classification Decisions */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--ai-decisions">
        <div className="tax-adj-m13-section__header">
          <h2>AI Classification Decisions</h2>
          <p className="tax-adj-m13-section__subtitle">
            Näringsbetingade andelar (IL 24:14, IL 25a) — AI classification of
            each shareholding as näringsbetingad or portfolio, with proposed
            treatment for dividends (INK2 4.5b), capital gains (INK2 4.7a), and
            non-deductible losses (INK2 4.7b).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m13-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : sharesDecisions.length > 0 ? (
          <>
            {hasHighValueDecisions ? (
              <div
                className="tax-adj-m13-critical-warning"
                role="alert"
              >
                <span className="tax-adj-m13-critical-warning__icon">⚠</span>
                <span className="tax-adj-m13-critical-warning__text">
                  This module is critical — errors cause significant tax
                  misstatements. Review each classification carefully.
                </span>
              </div>
            ) : null}

            <div className="tax-adj-m13-decisions-table">
              <table className="tax-adj-m13-table">
                <thead className="tax-adj-m13-table__head">
                  <tr>
                    <th className="tax-adj-m13-table__header">Rationale</th>
                    <th className="tax-adj-m13-table__header">Direction</th>
                    <th className="tax-adj-m13-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m13-table__header">INK2 Target</th>
                    <th className="tax-adj-m13-table__header">Confidence</th>
                    <th className="tax-adj-m13-table__header">Status</th>
                    <th className="tax-adj-m13-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m13-table__body">
                  {sharesDecisions.map((decision) => (
                    <tr
                      key={decision.id}
                      className={
                        decision.reviewFlag
                          ? "tax-adj-m13-table__row tax-adj-m13-table__row--flagged"
                          : "tax-adj-m13-table__row"
                      }
                    >
                      <td className="tax-adj-m13-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m13-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m13-table__cell tax-adj-m13-table__cell--number">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m13-table__cell tax-adj-m13-table__cell--mono">
                        {decision.policyRuleReference}
                      </td>
                      <td className="tax-adj-m13-table__cell">
                        {Math.round(decision.confidence * 100)}%
                      </td>
                      <td className="tax-adj-m13-table__cell">
                        {getStatusLabel(decision.status)}
                      </td>
                      <td className="tax-adj-m13-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m13-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m13-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="tax-adj-m13-empty-message">
            No AI classification decisions for shares and participations module.
          </p>
        )}
      </CardV1>

      {/* Section 4: Exemption Summary */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--exemption-summary">
        <div className="tax-adj-m13-section__header">
          <h2>Exemption Summary</h2>
          <p className="tax-adj-m13-section__subtitle">
            Totals flowing to INK2 from näringsbetingade andelar classifications
            (IL 24:17, IL 25a:5, IL 25a:19).
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : (
          <div className="tax-adj-m13-summary">
            <div className="tax-adj-m13-summary-row">
              <span className="tax-adj-m13-summary-row__label">
                Exempt dividends (näringsbetingade) — deduction at INK2 4.5b:
              </span>
              <span className="tax-adj-m13-summary-row__value tax-adj-m13-summary-row__value--deduction">
                {formatNumber(exemptDividendsTotal)} SEK
              </span>
            </div>
            <div className="tax-adj-m13-summary-row">
              <span className="tax-adj-m13-summary-row__label">
                Exempt capital gains (näringsbetingade) — deduction at INK2
                4.7a:
              </span>
              <span className="tax-adj-m13-summary-row__value tax-adj-m13-summary-row__value--deduction">
                {formatNumber(exemptCapitalGainsTotal)} SEK
              </span>
            </div>
            <div className="tax-adj-m13-summary-row">
              <span className="tax-adj-m13-summary-row__label">
                Non-deductible losses (IL 25a:19) — add-back at INK2 4.7b:
              </span>
              <span className="tax-adj-m13-summary-row__value tax-adj-m13-summary-row__value--addback">
                {formatNumber(nonDeductibleLossesTotal)} SEK
              </span>
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 5: Review Status */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--review-status">
        <div className="tax-adj-m13-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m13-section__subtitle">
            Decisions pending manual review before this module can be finalised.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewedDecisions.length > 0 ? (
          <div className="tax-adj-m13-status tax-adj-m13-status--warning">
            <span className="tax-adj-m13-status__icon">⚠</span>
            <span className="tax-adj-m13-status__text">
              {unreviewedDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m13-status tax-adj-m13-status--ok">
            <span className="tax-adj-m13-status__icon">✓</span>
            <span className="tax-adj-m13-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m13-section tax-adj-m13-section--verification">
        <div className="tax-adj-m13-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m13-section__subtitle">
            Confirm each item before proceeding to the next module.
          </p>
        </div>

        <ul className="tax-adj-m13-checklist">
          <li className="tax-adj-m13-checklist__item">
            <span className="tax-adj-m13-checklist__marker">✓</span>
            <span>
              Each shareholding classified as näringsbetingad meets the ≥10%
              voting rights threshold OR is held for business reasons
            </span>
          </li>
          <li className="tax-adj-m13-checklist__item">
            <span className="tax-adj-m13-checklist__marker">✓</span>
            <span>
              No holding changed classification (näringsbetingad ↔ portfolio)
              during the fiscal year
            </span>
          </li>
          <li className="tax-adj-m13-checklist__item">
            <span className="tax-adj-m13-checklist__marker">✓</span>
            <span>
              Gains on näringsbetingade shares are fully excluded from taxable
              income (no partial treatment)
            </span>
          </li>
          <li className="tax-adj-m13-checklist__item">
            <span className="tax-adj-m13-checklist__marker">✓</span>
            <span>
              Non-deductible losses on näringsbetingade shares are added back
              (IL 25a:19)
            </span>
          </li>
          <li className="tax-adj-m13-checklist__item">
            <span className="tax-adj-m13-checklist__marker">✓</span>
            <span>
              Portfolio share gains and dividends correctly remain in the taxable
              base
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
