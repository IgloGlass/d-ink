import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule18InkuransreservV1({
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

  const balanceSheetLines = extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];
  const incomeStatementLines = extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];

  const inventoryLines = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("14");
  });

  const writeDownLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("49");
  });

  const inkuransDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "inventory_obsolescence_reserve"
  );

  const addBackDecisions = inkuransDecisions.filter(
    (decision) => decision.direction === "increase_taxable_income"
  );

  const deductionDecisions = inkuransDecisions.filter(
    (decision) => decision.direction === "decrease_taxable_income"
  );

  const totalAddBack = addBackDecisions.reduce(
    (sum, decision) => sum + decision.amount,
    0
  );

  const totalDeduction = deductionDecisions.reduce(
    (sum, decision) => sum + decision.amount,
    0
  );

  const unreviewed = inkuransDecisions.filter(
    (decision) => decision.status === "manual_review_required"
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
      | "informational"
  ): string => {
    switch (direction) {
      case "increase_taxable_income":
        return "Add-back (INK2 4.3c)";
      case "decrease_taxable_income":
        return "Deduction (INK2 4.5c)";
      case "informational":
        return "Informational";
      default:
        return direction;
    }
  };

  return (
    <div className="tax-adj-m18-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--inventory-accounts">
        <div className="tax-adj-m18-section__header">
          <h2>Inventory Accounts (Balance Sheet)</h2>
          <p className="tax-adj-m18-section__subtitle">
            Accounts starting with 14xx — inventory and related reserves.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m18-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : inventoryLines.length > 0 ? (
          <div className="tax-adj-m18-inventory-table">
            <table className="tax-adj-m18-table">
              <thead className="tax-adj-m18-table__head">
                <tr>
                  <th className="tax-adj-m18-table__header">Code</th>
                  <th className="tax-adj-m18-table__header">Label</th>
                  <th className="tax-adj-m18-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m18-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m18-table__body">
                {inventoryLines.map((line) => (
                  <tr key={line.code} className="tax-adj-m18-table__row">
                    <td className="tax-adj-m18-table__cell">{line.code}</td>
                    <td className="tax-adj-m18-table__cell">{line.label}</td>
                    <td className="tax-adj-m18-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m18-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m18-empty-message">
            No inventory accounts found in balance sheet.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--write-downs">
        <div className="tax-adj-m18-section__header">
          <h2>Write-downs & Changes (Income Statement)</h2>
          <p className="tax-adj-m18-section__subtitle">
            Accounts starting with 49xx — change in inventory and write-downs.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m18-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : writeDownLines.length > 0 ? (
          <div className="tax-adj-m18-write-down-table">
            <table className="tax-adj-m18-table">
              <thead className="tax-adj-m18-table__head">
                <tr>
                  <th className="tax-adj-m18-table__header">Code</th>
                  <th className="tax-adj-m18-table__header">Label</th>
                  <th className="tax-adj-m18-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m18-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m18-table__body">
                {writeDownLines.map((line) => (
                  <tr key={line.code} className="tax-adj-m18-table__row">
                    <td className="tax-adj-m18-table__cell">{line.code}</td>
                    <td className="tax-adj-m18-table__cell">{line.label}</td>
                    <td className="tax-adj-m18-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m18-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m18-empty-message">
            No write-down accounts found in income statement.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--ai-decisions">
        <div className="tax-adj-m18-section__header">
          <h2>AI Inkuransreserv Analysis</h2>
          <p className="tax-adj-m18-section__subtitle">
            Proposed adjustments based on 3% maximum deductible reserve rule.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m18-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : inkuransDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m18-decisions-table">
              <table className="tax-adj-m18-table">
                <thead className="tax-adj-m18-table__head">
                  <tr>
                    <th className="tax-adj-m18-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m18-table__header">Direction</th>
                    <th className="tax-adj-m18-table__header">Rationale</th>
                    <th className="tax-adj-m18-table__header">Status</th>
                    <th className="tax-adj-m18-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m18-table__body">
                  {inkuransDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m18-table__row">
                      <td className="tax-adj-m18-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m18-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m18-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m18-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m18-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m18-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m18-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m18-decisions-summary">
              {totalAddBack > 0 ? (
                <div className="tax-adj-m18-summary-row">
                  <span className="tax-adj-m18-summary-label">
                    Total add-back at INK2 4.3c:
                  </span>
                  <span className="tax-adj-m18-summary-value">
                    {formatNumber(totalAddBack)} SEK
                  </span>
                </div>
              ) : null}
              {totalDeduction > 0 ? (
                <div className="tax-adj-m18-summary-row">
                  <span className="tax-adj-m18-summary-label">
                    Prior year reversal at INK2 4.5c:
                  </span>
                  <span className="tax-adj-m18-summary-value">
                    {formatNumber(totalDeduction)} SEK
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="tax-adj-m18-empty-message">
            No adjustment decisions for inventory obsolescence reserve module.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--regel">
        <div className="tax-adj-m18-section__header">
          <h2>Inkuransregel (IL 17:4)</h2>
          <p className="tax-adj-m18-section__subtitle">
            Tax regulation for inventory obsolescence reserves.
          </p>
        </div>

        <div className="tax-adj-m18-regel-content">
          <p>
            <strong>Maximum deductible reserve: 3% of inventory cost</strong> (acquisition value, FIFO method).
          </p>
          <p>
            Booked obsolescence reserves exceeding 3% of total inventory cost are non-deductible. The excess must be added back to taxable income at INK2 4.3c.
          </p>
          <p>
            If a prior year's disallowed excess is reversed in the current year, that reversal is deductible at INK2 4.5c.
          </p>
        </div>
      </CardV1>

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--review-status">
        <div className="tax-adj-m18-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m18-section__subtitle">
            Validation of unresolved adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m18-status tax-adj-m18-status--warning">
            <span className="tax-adj-m18-status__icon">⚠</span>
            <span className="tax-adj-m18-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m18-status tax-adj-m18-status--ok">
            <span className="tax-adj-m18-status__icon">✓</span>
            <span className="tax-adj-m18-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m18-section tax-adj-m18-section--verification">
        <div className="tax-adj-m18-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m18-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m18-checklist">
          <li className="tax-adj-m18-checklist__item">
            <span className="tax-adj-m18-checklist__marker">✓</span>
            <span>
              Inventory cost basis (acquisition cost, FIFO) is confirmed from annual report notes
            </span>
          </li>
          <li className="tax-adj-m18-checklist__item">
            <span className="tax-adj-m18-checklist__marker">✓</span>
            <span>
              The booked inkuransreserv is correctly identified as a separate line item (not mixed with other write-downs)
            </span>
          </li>
          <li className="tax-adj-m18-checklist__item">
            <span className="tax-adj-m18-checklist__marker">✓</span>
            <span>
              3% ceiling has been applied against the correct inventory cost figure
            </span>
          </li>
          <li className="tax-adj-m18-checklist__item">
            <span className="tax-adj-m18-checklist__marker">✓</span>
            <span>
              Any specific write-downs (utöver schablonregeln) are separately documented and justified
            </span>
          </li>
          <li className="tax-adj-m18-checklist__item">
            <span className="tax-adj-m18-checklist__marker">✓</span>
            <span>
              Prior year's disallowed excess correctly identified and reversed in the current year
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
