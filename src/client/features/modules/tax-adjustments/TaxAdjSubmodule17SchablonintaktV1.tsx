import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule17SchablonintaktV1({
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

  const periodiseringsfonderBalanceSheetAccounts = balanceSheetLines.filter(
    (line) => {
      const code = line.code ?? "";
      return code.startsWith("211");
    },
  );

  const periodiseringsfonderIncomeStatementAccounts = incomeStatementLines.filter(
    (line) => {
      const code = line.code ?? "";
      return code.startsWith("881");
    },
  );

  const schablonintaktDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "notional_income_on_tax_allocation_reserve",
  );

  const increaseDecisions = schablonintaktDecisions.filter(
    (decision) => decision.direction === "increase_taxable_income",
  );

  const totalSchablonintakt = increaseDecisions.reduce(
    (sum, decision) => sum + decision.amount,
    0,
  );

  const unreviewed = schablonintaktDecisions.filter(
    (decision) => decision.status === "manual_review_required",
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
        return "Taxable addition";
      case "decrease_taxable_income":
        return "Deduction";
      case "informational":
        return "Informational";
      default:
        return direction;
    }
  };

  return (
    <div className="tax-adj-m17-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Outstanding Periodiseringsfonder Accounts */}
      <CardV1 className="tax-adj-m17-section tax-adj-m17-section--accounts">
        <div className="tax-adj-m17-section__header">
          <h2>Outstanding Periodiseringsfonder Accounts</h2>
          <p className="tax-adj-m17-section__subtitle">
            Balance sheet accounts (211x — tax allocation reserves /
            periodiseringsfonder) and income statement accounts (881x — allocation
            and reversal movements).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m17-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : periodiseringsfonderBalanceSheetAccounts.length > 0 ||
          periodiseringsfonderIncomeStatementAccounts.length > 0 ? (
          <>
            {periodiseringsfonderBalanceSheetAccounts.length > 0 ? (
              <div className="tax-adj-m17-accounts-table">
                <h3 className="tax-adj-m17-accounts-table__title">
                  Balance Sheet (211x)
                </h3>
                <table className="tax-adj-m17-table">
                  <thead className="tax-adj-m17-table__head">
                    <tr>
                      <th className="tax-adj-m17-table__header">Code</th>
                      <th className="tax-adj-m17-table__header">Label</th>
                      <th className="tax-adj-m17-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m17-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m17-table__body">
                    {periodiseringsfonderBalanceSheetAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m17-table__row">
                        <td className="tax-adj-m17-table__cell">{line.code}</td>
                        <td className="tax-adj-m17-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m17-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m17-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {periodiseringsfonderIncomeStatementAccounts.length > 0 ? (
              <div className="tax-adj-m17-accounts-table">
                <h3 className="tax-adj-m17-accounts-table__title">
                  Income Statement (881x)
                </h3>
                <table className="tax-adj-m17-table">
                  <thead className="tax-adj-m17-table__head">
                    <tr>
                      <th className="tax-adj-m17-table__header">Code</th>
                      <th className="tax-adj-m17-table__header">Label</th>
                      <th className="tax-adj-m17-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m17-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m17-table__body">
                    {periodiseringsfonderIncomeStatementAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m17-table__row">
                        <td className="tax-adj-m17-table__cell">{line.code}</td>
                        <td className="tax-adj-m17-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m17-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m17-table__cell">
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
          <p className="tax-adj-m17-empty-message">
            No periodiseringsfonder accounts found in balance sheet or income
            statement.
          </p>
        )}
      </CardV1>

      {/* Section 2: Schablonintäkt Calculation */}
      <CardV1 className="tax-adj-m17-section tax-adj-m17-section--calculation">
        <div className="tax-adj-m17-section__header">
          <h2>Schablonintäkt Calculation</h2>
          <p className="tax-adj-m17-section__subtitle">
            AI-computed notional income on tax allocation reserves (IL 30:6a).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m17-loading-grid">
            <SkeletonV1 height={80} />
          </div>
        ) : schablonintaktDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m17-decisions-table">
              <table className="tax-adj-m17-table">
                <thead className="tax-adj-m17-table__head">
                  <tr>
                    <th className="tax-adj-m17-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m17-table__header">Direction</th>
                    <th className="tax-adj-m17-table__header">Target</th>
                    <th className="tax-adj-m17-table__header">Rationale</th>
                    <th className="tax-adj-m17-table__header">Status</th>
                    <th className="tax-adj-m17-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m17-table__body">
                  {schablonintaktDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m17-table__row">
                      <td className="tax-adj-m17-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m17-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m17-table__cell">
                        {decision.targetField}
                      </td>
                      <td className="tax-adj-m17-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m17-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m17-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m17-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m17-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m17-calculation-summary">
              <div className="tax-adj-m17-summary-row tax-adj-m17-summary-row--total">
                <span className="tax-adj-m17-summary-label">
                  Total schablonintäkt at INK2 4.6a:
                </span>
                <span className="tax-adj-m17-summary-value">
                  {formatNumber(totalSchablonintakt)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m17-empty-message">
            No adjustment decisions for schablonintäkt module.
          </p>
        )}
      </CardV1>

      {/* Section 3: Formula Information */}
      <CardV1 className="tax-adj-m17-section tax-adj-m17-section--formula-info">
        <div className="tax-adj-m17-section__header">
          <h2>Formula Information</h2>
          <p className="tax-adj-m17-section__subtitle">
            IL 30:6a — notional yield charge on tax allocation reserves.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m17-loading-grid">
            <SkeletonV1 height={200} />
          </div>
        ) : (
          <dl className="tax-adj-m17-formula-list">
            <div className="tax-adj-m17-formula-list__row tax-adj-m17-formula-list__row--formula">
              <dt className="tax-adj-m17-formula-list__term">
                Formula applied
              </dt>
              <dd className="tax-adj-m17-formula-list__value">
                Schablonintäkt = Sum of outstanding periodiseringsfonder ×
                statslåneränta (30 Nov prior year) × 72%
              </dd>
            </div>

            <div className="tax-adj-m17-formula-list__row">
              <dt className="tax-adj-m17-formula-list__term">
                Statslåneränta (government loan rate)
              </dt>
              <dd className="tax-adj-m17-formula-list__value">
                Applied automatically from system fiscal year lookup (30 November
                prior year)
              </dd>
            </div>

            <div className="tax-adj-m17-formula-list__row">
              <dt className="tax-adj-m17-formula-list__term">
                Tax basis determination
              </dt>
              <dd className="tax-adj-m17-formula-list__value">
                Sum of all outstanding periodiseringsfonder balances (balance
                sheet accounts 211x)
              </dd>
            </div>

            <div className="tax-adj-m17-formula-list__row">
              <dt className="tax-adj-m17-formula-list__term">
                Statutory reference
              </dt>
              <dd className="tax-adj-m17-formula-list__value">
                IL 30:6a (Inkomstskattelagen / Swedish Income Tax Act)
              </dd>
            </div>
          </dl>
        )}
      </CardV1>

      {/* Section 4: Review Status */}
      <CardV1 className="tax-adj-m17-section tax-adj-m17-section--review-status">
        <div className="tax-adj-m17-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m17-section__subtitle">
            Schablonintäkt decision review status.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m17-status tax-adj-m17-status--warning">
            <span className="tax-adj-m17-status__icon">⚠</span>
            <span className="tax-adj-m17-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m17-status tax-adj-m17-status--ok">
            <span className="tax-adj-m17-status__icon">✓</span>
            <span className="tax-adj-m17-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 5: Verification Checklist */}
      <CardV1 className="tax-adj-m17-section tax-adj-m17-section--verification">
        <div className="tax-adj-m17-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m17-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m17-checklist">
          <li className="tax-adj-m17-checklist__item">
            <span className="tax-adj-m17-checklist__marker">✓</span>
            <span>
              The outstanding periodiseringsfonder table (module 1) is complete
              and covers all prior-year allocations
            </span>
          </li>
          <li className="tax-adj-m17-checklist__item">
            <span className="tax-adj-m17-checklist__marker">✓</span>
            <span>
              No periodiseringsfond has been omitted or double-counted
            </span>
          </li>
          <li className="tax-adj-m17-checklist__item">
            <span className="tax-adj-m17-checklist__marker">✓</span>
            <span>
              The statslåneränta rate shown is correct for the fiscal year (30
              November prior year)
            </span>
          </li>
          <li className="tax-adj-m17-checklist__item">
            <span className="tax-adj-m17-checklist__marker">✓</span>
            <span>
              The schablonintäkt amount flows to INK2 4.6a in the final
              calculation
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
