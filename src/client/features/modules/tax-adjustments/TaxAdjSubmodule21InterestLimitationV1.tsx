import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule21InterestLimitationV1({
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

  const incomeStatementLines =
    extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];

  // Interest accounts: 830x (interest income), 831x (interest income),
  // 832x (interest expense), 833x (interest expense)
  const interestLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("830") ||
      code.startsWith("831") ||
      code.startsWith("832") ||
      code.startsWith("833")
    );
  });

  // Separate income and expense lines
  const interestIncomeLines = interestLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("830") || code.startsWith("831");
  });

  const interestExpenseLines = interestLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("832") || code.startsWith("833");
  });

  // Calculate totals for interest accounts
  const totalInterestIncome = interestIncomeLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0
  );

  const totalInterestExpense = interestExpenseLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0
  );

  // Net interest position: expense - income
  // Note: expense values are typically negative in data, so we calculate correctly
  const netInterestExpense = totalInterestExpense - totalInterestIncome;

  // Get interest limitation decisions
  const interestDecisions = (adjustments?.decisions ?? []).filter(
    (decision) =>
      decision.module === "hybrid_targeted_interest_and_net_interest_offset"
  );

  // Check for targeted rule review flags
  const hasTargetedRuleFlags = interestDecisions.some((decision) => {
    if (!decision.reviewFlag) return false;
    const rationaleLC = decision.rationale.toLowerCase();
    return (
      rationaleLC.includes("riktade regler") ||
      rationaleLC.includes("group loan") ||
      rationaleLC.includes("intra-group") ||
      rationaleLC.includes("acquisition financing") ||
      rationaleLC.includes("hybrid")
    );
  });

  // Check for unreviewed decisions
  const unreviewedDecisions = interestDecisions.filter(
    (decision) => decision.status === "manual_review_required"
  );

  const hasUnreviewedDecisions = unreviewedDecisions.length > 0;

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
      | "informational"
  ): string => {
    switch (direction) {
      case "increase_taxable_income":
        return "Add-back (INK2 4.3c)";
      case "decrease_taxable_income":
        return "Deduction";
      case "informational":
        return "Informational";
      default:
        return direction;
    }
  };

  const getStatusLabel = (status: string): string => {
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
    <div className="tax-adj-m21-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Interest Accounts */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--interest-accounts">
        <div className="tax-adj-m21-section__header">
          <h2>Interest Accounts</h2>
          <p className="tax-adj-m21-section__subtitle">
            All income statement lines with codes starting with 830, 831, 832,
            or 833 (interest income and expense).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m21-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : interestLines.length > 0 ? (
          <div className="tax-adj-m21-accounts-table">
            <table className="tax-adj-m21-table">
              <thead className="tax-adj-m21-table__head">
                <tr>
                  <th className="tax-adj-m21-table__header">Code</th>
                  <th className="tax-adj-m21-table__header">Label</th>
                  <th className="tax-adj-m21-table__header">
                    Current year (SEK)
                  </th>
                  <th className="tax-adj-m21-table__header">Prior year (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m21-table__body">
                {interestLines.map((line) => (
                  <tr key={line.code} className="tax-adj-m21-table__row">
                    <td className="tax-adj-m21-table__cell">{line.code}</td>
                    <td className="tax-adj-m21-table__cell">{line.label}</td>
                    <td className="tax-adj-m21-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m21-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m21-empty-message">
            No interest accounts found in the income statement.
          </p>
        )}
      </CardV1>

      {/* Section 2: Net Interest Position */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--net-interest">
        <div className="tax-adj-m21-section__header">
          <h2>Net Interest Position</h2>
          <p className="tax-adj-m21-section__subtitle">
            Summary of total interest income and expense.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m21-loading-grid">
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <div className="tax-adj-m21-position-summary">
            <div className="tax-adj-m21-position-row">
              <span className="tax-adj-m21-position-label">
                Total interest income (830x, 831x):
              </span>
              <span className="tax-adj-m21-position-value">
                {formatNumber(totalInterestIncome)} SEK
              </span>
            </div>
            <div className="tax-adj-m21-position-row">
              <span className="tax-adj-m21-position-label">
                Total interest expense (832x, 833x):
              </span>
              <span className="tax-adj-m21-position-value">
                {formatNumber(totalInterestExpense)} SEK
              </span>
            </div>
            <div className="tax-adj-m21-position-row tax-adj-m21-position-row--highlight">
              <span className="tax-adj-m21-position-label">
                Net interest position:
              </span>
              <span
                className={`tax-adj-m21-position-value ${
                  netInterestExpense < 0
                    ? "tax-adj-m21-position-value--income"
                    : "tax-adj-m21-position-value--expense"
                }`}
              >
                {netInterestExpense < 0
                  ? `Net income: ${formatNumber(Math.abs(netInterestExpense))} SEK`
                  : `Net expense: ${formatNumber(netInterestExpense)} SEK`}
              </span>
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 3: Targeted Rules Warning */}
      {hasTargetedRuleFlags ? (
        <CardV1 className="tax-adj-m21-section tax-adj-m21-section--targeted-rules-warning">
          <div className="tax-adj-m21-notice tax-adj-m21-notice--warning">
            <span className="tax-adj-m21-notice__icon">⚠</span>
            <p className="tax-adj-m21-notice__text">
              Targeted rules review required — group loans or hybrid instruments
              detected. Verify that loans between group companies and loans
              financing intra-group share acquisitions are not primarily
              tax-motivated, and that hybrid instruments have corresponding
              income recognized by counterparty.
            </p>
          </div>
        </CardV1>
      ) : null}

      {/* Section 4: AI Limitation Analysis */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--ai-analysis">
        <div className="tax-adj-m21-section__header">
          <h2>AI Limitation Analysis</h2>
          <p className="tax-adj-m21-section__subtitle">
            Decisions on deductible vs non-deductible net interest under IL
            24:21–29 (targeted rules and 30% EBITDA rule).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m21-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : interestDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m21-decisions-table">
              <table className="tax-adj-m21-table">
                <thead className="tax-adj-m21-table__head">
                  <tr>
                    <th className="tax-adj-m21-table__header">
                      Amount (SEK)
                    </th>
                    <th className="tax-adj-m21-table__header">Direction</th>
                    <th className="tax-adj-m21-table__header">Rationale</th>
                    <th className="tax-adj-m21-table__header">Status</th>
                    <th className="tax-adj-m21-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m21-table__body">
                  {interestDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m21-table__row">
                      <td className="tax-adj-m21-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m21-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m21-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m21-table__cell">
                        {getStatusLabel(decision.status)}
                      </td>
                      <td className="tax-adj-m21-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m21-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m21-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m21-summary">
              <p className="tax-adj-m21-summary__label">Summary:</p>
              <p className="tax-adj-m21-summary__text">
                Total non-deductible net interest (add-back at INK2 4.3c) is
                determined by layer 1 (targeted rules) and layer 2 (30% EBITDA
                rule). Deductible net interest and negative net interest (net
                income) flow to downstream modules.
              </p>
            </div>
          </>
        ) : (
          <p className="tax-adj-m21-empty-message">
            No AI adjustment decisions for the interest limitation module.
          </p>
        )}
      </CardV1>

      {/* Section 5: EBITDA Rule Explanation */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--ebitda-explanation">
        <div className="tax-adj-m21-section__header">
          <h2>Interest Limitation Framework (IL 24:21–29)</h2>
          <p className="tax-adj-m21-section__subtitle">
            Two-layer interest deduction limitation under Swedish tax law.
          </p>
        </div>

        <div className="tax-adj-m21-explanation">
          <div className="tax-adj-m21-explanation__layer">
            <h3 className="tax-adj-m21-explanation__layer-title">
              Layer 1 — Targeted Rules (Riktade regler)
            </h3>
            <p className="tax-adj-m21-explanation__layer-text">
              Always disallowed, regardless of EBITDA:
            </p>
            <ul className="tax-adj-m21-explanation__list">
              <li>
                Interest on loans between group companies where arrangement is
                primarily tax-motivated
              </li>
              <li>
                Interest on loans financing intra-group share acquisitions
                (unless commercially justified)
              </li>
              <li>
                Hybrid instruments where counterparty does not recognize
                corresponding income
              </li>
            </ul>
          </div>

          <div className="tax-adj-m21-explanation__layer">
            <h3 className="tax-adj-m21-explanation__layer-title">
              Layer 2 — General EBITDA Rule (Generell regel)
            </h3>
            <p className="tax-adj-m21-explanation__layer-text">
              Deductible net interest = min(net interest expense, 30% × EBITDA)
            </p>
            <p className="tax-adj-m21-explanation__layer-text">
              Simplified EBITDA (V1):
            </p>
            <p className="tax-adj-m21-explanation__formula">
              EBITDA = Profit before tax (module 2) + net interest expense +
              depreciation/amortization (module 12)
            </p>
            <p className="tax-adj-m21-explanation__layer-text">
              Negative net interest (net interest income) is fully taxable; no
              limitation applies.
            </p>
          </div>

          <div className="tax-adj-m21-explanation__note">
            <p>
              <strong>Note:</strong> N9 form generation is deferred to V2.
            </p>
          </div>
        </div>
      </CardV1>

      {/* Section 6: Review Status */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--review-status">
        <div className="tax-adj-m21-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m21-section__subtitle">
            Unresolved interest limitation decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : hasUnreviewedDecisions ? (
          <div className="tax-adj-m21-status tax-adj-m21-status--warning">
            <span className="tax-adj-m21-status__icon">⚠</span>
            <span className="tax-adj-m21-status__text">
              {unreviewedDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m21-status tax-adj-m21-status--ok">
            <span className="tax-adj-m21-status__icon">✓</span>
            <span className="tax-adj-m21-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 7: Verification Checklist */}
      <CardV1 className="tax-adj-m21-section tax-adj-m21-section--verification">
        <div className="tax-adj-m21-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m21-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m21-checklist">
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              All interest income (830x, 831x) and expense (832x, 833x)
              accounts are correctly identified
            </span>
          </li>
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              Profit before tax (module 2) and depreciation/amortization
              (module 12) inputs are confirmed for EBITDA calculation
            </span>
          </li>
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              Targeted rules reviewed: any group company loans or acquisition
              financing loans identified
            </span>
          </li>
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              Any hybrid instruments (where counterparty does not recognize
              income) identified and flagged
            </span>
          </li>
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              30% EBITDA ceiling correctly applied — non-deductible excess flows
              to INK2 4.3c
            </span>
          </li>
          <li className="tax-adj-m21-checklist__item">
            <span className="tax-adj-m21-checklist__marker">✓</span>
            <span>
              Deductible net interest and negative net interest position
              confirmed for downstream modules
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
