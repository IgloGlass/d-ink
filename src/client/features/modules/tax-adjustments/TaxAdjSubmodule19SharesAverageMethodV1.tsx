import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule19SharesAverageMethodV1({
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

  const portfolioShareLines = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("133");
  });

  const capitalGainLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("802");
  });

  const sharesDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "shares_and_participations_average_method",
  );

  const addBackDecisions = sharesDecisions.filter(
    (d) => d.direction === "increase_taxable_income",
  );

  const deductionDecisions = sharesDecisions.filter(
    (d) => d.direction === "decrease_taxable_income",
  );

  const addBackTotal = addBackDecisions.reduce((sum, d) => sum + d.amount, 0);
  const deductionTotal = deductionDecisions.reduce(
    (sum, d) => sum + d.amount,
    0,
  );

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
        return "Addition (INK2 4.3c)";
      case "decrease_taxable_income":
        return "Deduction (INK2 4.5c)";
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
    <div className="tax-adj-m19-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Portfolio Share Accounts */}
      <CardV1 className="tax-adj-m19-section tax-adj-m19-section--accounts">
        <div className="tax-adj-m19-section__header">
          <h2>Portfolio Share Accounts</h2>
          <p className="tax-adj-m19-section__subtitle">
            Shares classified as portfolio (non-näringsbetingade). If these are
            näringsbetingade andelar, refer to module 13.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m19-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : portfolioShareLines.length > 0 ||
          capitalGainLines.length > 0 ? (
          <>
            {portfolioShareLines.length > 0 ? (
              <div className="tax-adj-m19-accounts-group">
                <h3 className="tax-adj-m19-accounts-group__title">
                  Balance Sheet (133x — Portfolio shares)
                </h3>
                <table className="tax-adj-m19-table">
                  <thead className="tax-adj-m19-table__head">
                    <tr>
                      <th className="tax-adj-m19-table__header">Code</th>
                      <th className="tax-adj-m19-table__header">Label</th>
                      <th className="tax-adj-m19-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m19-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m19-table__body">
                    {portfolioShareLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m19-table__row">
                        <td className="tax-adj-m19-table__cell">{line.code}</td>
                        <td className="tax-adj-m19-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m19-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m19-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {capitalGainLines.length > 0 ? (
              <div className="tax-adj-m19-accounts-group">
                <h3 className="tax-adj-m19-accounts-group__title">
                  Income Statement (802x — Capital gains/losses on shares)
                </h3>
                <table className="tax-adj-m19-table">
                  <thead className="tax-adj-m19-table__head">
                    <tr>
                      <th className="tax-adj-m19-table__header">Code</th>
                      <th className="tax-adj-m19-table__header">Label</th>
                      <th className="tax-adj-m19-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m19-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m19-table__body">
                    {capitalGainLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m19-table__row">
                        <td className="tax-adj-m19-table__cell">{line.code}</td>
                        <td className="tax-adj-m19-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m19-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m19-table__cell">
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
          <p className="tax-adj-m19-empty-message">
            No portfolio share accounts found in the mapped statements.
          </p>
        )}
      </CardV1>

      {/* Section 2: AI Genomsnittsmetoden Analysis */}
      <CardV1 className="tax-adj-m19-section tax-adj-m19-section--ai-decisions">
        <div className="tax-adj-m19-section__header">
          <h2>AI Genomsnittsmetoden Analysis</h2>
          <p className="tax-adj-m19-section__subtitle">
            AI-identified disposals of portfolio shares and proposed adjustments
            for average cost method differences between tax and book gain/loss.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m19-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : sharesDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m19-decisions-table">
              <table className="tax-adj-m19-table">
                <thead className="tax-adj-m19-table__head">
                  <tr>
                    <th className="tax-adj-m19-table__header">Rationale</th>
                    <th className="tax-adj-m19-table__header">Direction</th>
                    <th className="tax-adj-m19-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m19-table__header">Status</th>
                    <th className="tax-adj-m19-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m19-table__body">
                  {sharesDecisions.map((decision) => (
                    <tr
                      key={decision.id}
                      className={
                        decision.reviewFlag
                          ? "tax-adj-m19-table__row tax-adj-m19-table__row--flagged"
                          : "tax-adj-m19-table__row"
                      }
                    >
                      <td className="tax-adj-m19-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m19-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m19-table__cell tax-adj-m19-table__cell--number">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m19-table__cell">
                        {getStatusLabel(decision.status)}
                      </td>
                      <td className="tax-adj-m19-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m19-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m19-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m19-decisions-summary">
              {addBackDecisions.length > 0 ? (
                <div className="tax-adj-m19-summary-row">
                  <span className="tax-adj-m19-summary-label">
                    Total Addition (tax gain &gt; book gain) for INK2 4.3c:
                  </span>
                  <span className="tax-adj-m19-summary-value tax-adj-m19-summary-value--addition">
                    {formatNumber(addBackTotal)} SEK
                  </span>
                </div>
              ) : null}
              {deductionDecisions.length > 0 ? (
                <div className="tax-adj-m19-summary-row">
                  <span className="tax-adj-m19-summary-label">
                    Total Deduction (tax gain &lt; book gain) for INK2 4.5c:
                  </span>
                  <span className="tax-adj-m19-summary-value tax-adj-m19-summary-value--deduction">
                    {formatNumber(deductionTotal)} SEK
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="tax-adj-m19-empty-message">
            No adjustment decisions for shares and participations (average
            method) module.
          </p>
        )}
      </CardV1>

      {/* Section 3: Genomsnittsmetoden Guidance */}
      <CardV1 className="tax-adj-m19-section tax-adj-m19-section--guidance">
        <div className="tax-adj-m19-section__header">
          <h2>Genomsnittsmetoden Guidance</h2>
          <p className="tax-adj-m19-section__subtitle">
            Income Tax Law (Inkomstskattelagen) 48:7
          </p>
        </div>

        <div className="tax-adj-m19-guidance">
          <p className="tax-adj-m19-guidance__text">
            <strong>When portfolio shares are sold</strong>, acquisition cost is
            determined using the <em>genomsnittsmetoden</em> (average method) —
            the average cost of all shares of the same class held at the time of
            disposal.
          </p>

          <p className="tax-adj-m19-guidance__text">
            <strong>Tax gain/loss may differ from booked gain/loss</strong> if
            the average cost differs from the book cost (carrying value recorded
            in the balance sheet). This difference must be adjusted in the tax
            return.
          </p>

          <p className="tax-adj-m19-guidance__text">
            <strong>AI flags portfolio share disposals</strong> identified from
            annual report notes. The accountant must manually:
          </p>

          <ul className="tax-adj-m19-guidance__list">
            <li className="tax-adj-m19-guidance__list-item">
              Obtain the complete acquisition history for all shares of the same
              class
            </li>
            <li className="tax-adj-m19-guidance__list-item">
              Compute the average acquisition cost per share
            </li>
            <li className="tax-adj-m19-guidance__list-item">
              Calculate taxable gain/loss using average cost
            </li>
            <li className="tax-adj-m19-guidance__list-item">
              Compare to booked gain/loss and enter any difference as an
              adjustment
            </li>
          </ul>

          <p className="tax-adj-m19-guidance__text">
            <strong>Direction of adjustment:</strong>
          </p>

          <ul className="tax-adj-m19-guidance__list">
            <li className="tax-adj-m19-guidance__list-item">
              Tax gain &gt; book gain → <strong>Addition</strong> at{" "}
              <strong>INK2 4.3c</strong>
            </li>
            <li className="tax-adj-m19-guidance__list-item">
              Tax gain &lt; book gain (or tax loss &gt; book loss) →{" "}
              <strong>Deduction</strong> at <strong>INK2 4.5c</strong>
            </li>
          </ul>
        </div>
      </CardV1>

      {/* Section 4: Review Status */}
      <CardV1 className="tax-adj-m19-section tax-adj-m19-section--review-status">
        <div className="tax-adj-m19-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m19-section__subtitle">
            Decisions pending manual review before this module can be finalised.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewedDecisions.length > 0 ? (
          <div className="tax-adj-m19-status tax-adj-m19-status--warning">
            <span className="tax-adj-m19-status__icon">⚠</span>
            <span className="tax-adj-m19-status__text">
              {unreviewedDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m19-status tax-adj-m19-status--ok">
            <span className="tax-adj-m19-status__icon">✓</span>
            <span className="tax-adj-m19-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 5: Verification Checklist */}
      <CardV1 className="tax-adj-m19-section tax-adj-m19-section--verification">
        <div className="tax-adj-m19-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m19-section__subtitle">
            Confirm each item before proceeding to the next module.
          </p>
        </div>

        <ul className="tax-adj-m19-checklist">
          <li className="tax-adj-m19-checklist__item">
            <span className="tax-adj-m19-checklist__marker">✓</span>
            <span>
              Shares are correctly classified as portfolio (non-näringsbetingade)
              — näringsbetingade andelar belong in module 13
            </span>
          </li>
          <li className="tax-adj-m19-checklist__item">
            <span className="tax-adj-m19-checklist__marker">✓</span>
            <span>
              All disposals of portfolio shares during the fiscal year are
              identified
            </span>
          </li>
          <li className="tax-adj-m19-checklist__item">
            <span className="tax-adj-m19-checklist__marker">✓</span>
            <span>
              The average acquisition cost per share class (genomsnittsmetoden)
              has been computed using complete acquisition history
            </span>
          </li>
          <li className="tax-adj-m19-checklist__item">
            <span className="tax-adj-m19-checklist__marker">✓</span>
            <span>
              The taxable gain/loss has been compared to the booked gain/loss
              and any difference entered as an adjustment
            </span>
          </li>
          <li className="tax-adj-m19-checklist__item">
            <span className="tax-adj-m19-checklist__marker">✓</span>
            <span>
              If no portfolio share disposals occurred: confirmed with certainty
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
