import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule03ProvisionsV1({
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

  const reserveMovements = extraction?.taxDeep?.reserveContext?.movements ?? [];
  const reserveNotes = extraction?.taxDeep?.reserveContext?.notes ?? [];
  const balanceSheetLines = extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  const provisionNotes = relevantNotes.filter(
    (note) => note.category === "provisions_contingencies"
  );

  const provisionsBalanceSheet = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("1515") ||
      code.startsWith("1518") ||
      code.startsWith("1519") ||
      code.startsWith("229")
    );
  });

  const provisionsDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "provisions"
  );

  const addBackAmount = provisionsDecisions
    .filter((decision) => decision.direction === "increase_taxable_income")
    .reduce((sum, decision) => sum + decision.amount, 0);

  const unreviewed = provisionsDecisions.filter(
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
    <div className="tax-adj-m03-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--reserve-movements">
        <div className="tax-adj-m03-section__header">
          <h2>Reserve Movements from Annual Report</h2>
          <p className="tax-adj-m03-section__subtitle">
            Opening balance, movements, and closing balance for identified
            reserves.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m03-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : reserveMovements.length > 0 ? (
          <>
            <div className="tax-adj-m03-reserve-table">
              <table className="tax-adj-m03-table">
                <thead className="tax-adj-m03-table__head">
                  <tr>
                    <th className="tax-adj-m03-table__header">Reserve Type</th>
                    <th className="tax-adj-m03-table__header">
                      Opening Balance (SEK)
                    </th>
                    <th className="tax-adj-m03-table__header">
                      Movement This Year (SEK)
                    </th>
                    <th className="tax-adj-m03-table__header">
                      Closing Balance (SEK)
                    </th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m03-table__body">
                  {reserveMovements.map((movement, index) => (
                    <tr key={index} className="tax-adj-m03-table__row">
                      <td className="tax-adj-m03-table__cell">
                        {movement.reserveType}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {formatNumber(movement.openingBalance)}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {formatNumber(movement.movementForYear)}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {formatNumber(movement.closingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reserveNotes.length > 0 ? (
              <div className="tax-adj-m03-reserve-notes">
                <strong>Notes:</strong>
                <ul className="tax-adj-m03-reserve-notes__list">
                  {reserveNotes.map((note, index) => (
                    <li key={index} className="tax-adj-m03-reserve-notes__item">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="tax-adj-m03-empty-message">
            No reserve movements data available from the annual report.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--balance-sheet">
        <div className="tax-adj-m03-section__header">
          <h2>Balance Sheet Accounts (Provisions)</h2>
          <p className="tax-adj-m03-section__subtitle">
            Accounts starting with 1515, 1518, 1519 (doubtful receivables) and
            229 (other provisions).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m03-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : provisionsBalanceSheet.length > 0 ? (
          <div className="tax-adj-m03-balance-sheet-table">
            <table className="tax-adj-m03-table">
              <thead className="tax-adj-m03-table__head">
                <tr>
                  <th className="tax-adj-m03-table__header">Code</th>
                  <th className="tax-adj-m03-table__header">Label</th>
                  <th className="tax-adj-m03-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m03-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m03-table__body">
                {provisionsBalanceSheet.map((line) => (
                  <tr key={line.code} className="tax-adj-m03-table__row">
                    <td className="tax-adj-m03-table__cell">{line.code}</td>
                    <td className="tax-adj-m03-table__cell">{line.label}</td>
                    <td className="tax-adj-m03-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m03-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m03-empty-message">
            No provisions accounts found in balance sheet.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--relevant-notes">
        <div className="tax-adj-m03-section__header">
          <h2>Provisions & Contingencies Notes</h2>
          <p className="tax-adj-m03-section__subtitle">
            Annual report notes related to provisions and contingencies.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m03-loading-grid">
            <SkeletonV1 height={60} />
          </div>
        ) : provisionNotes.length > 0 ? (
          <div className="tax-adj-m03-notes-list">
            {provisionNotes.map((note, index) => (
              <div key={index} className="tax-adj-m03-note-item">
                <h3 className="tax-adj-m03-note-item__title">{note.title}</h3>
                {note.category ? (
                  <p className="tax-adj-m03-note-item__category">
                    {note.category}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="tax-adj-m03-empty-message">
            No provisions notes found in annual report.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--ai-decisions">
        <div className="tax-adj-m03-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m03-section__subtitle">
            Proposed additions to taxable income. Target field: INK2 4.3c
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m03-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : provisionsDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m03-decisions-table">
              <table className="tax-adj-m03-table">
                <thead className="tax-adj-m03-table__head">
                  <tr>
                    <th className="tax-adj-m03-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m03-table__header">Direction</th>
                    <th className="tax-adj-m03-table__header">Rationale</th>
                    <th className="tax-adj-m03-table__header">Status</th>
                    <th className="tax-adj-m03-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m03-table__body">
                  {provisionsDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m03-table__row">
                      <td className="tax-adj-m03-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m03-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m03-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m03-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m03-decisions-summary">
              <div className="tax-adj-m03-summary-row">
                <span className="tax-adj-m03-summary-label">
                  Total Add-back for INK2 4.3c:
                </span>
                <span className="tax-adj-m03-summary-value">
                  {formatNumber(addBackAmount)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m03-empty-message">
            No adjustment decisions for provisions module.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--review-status">
        <div className="tax-adj-m03-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m03-section__subtitle">
            Validation of unresolved adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m03-status tax-adj-m03-status--warning">
            <span className="tax-adj-m03-status__icon">⚠</span>
            <span className="tax-adj-m03-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m03-status tax-adj-m03-status--ok">
            <span className="tax-adj-m03-status__icon">✓</span>
            <span className="tax-adj-m03-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m03-section tax-adj-m03-section--verification">
        <div className="tax-adj-m03-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m03-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m03-checklist">
          <li className="tax-adj-m03-checklist__item">
            <span className="tax-adj-m03-checklist__marker">✓</span>
            <span>
              Each doubtful receivable in 151500 is individually assessed — no
              general reserve included
            </span>
          </li>
          <li className="tax-adj-m03-checklist__item">
            <span className="tax-adj-m03-checklist__marker">✓</span>
            <span>
              Other provisions in 229000 are non-deductible until the actual
              cost is incurred (IL 16:1)
            </span>
          </li>
          <li className="tax-adj-m03-checklist__item">
            <span className="tax-adj-m03-checklist__marker">✓</span>
            <span>
              No warranty provision (module 16 — garantiavsättning) is
              mis-mapped here
            </span>
          </li>
          <li className="tax-adj-m03-checklist__item">
            <span className="tax-adj-m03-checklist__marker">✓</span>
            <span>
              Prior-year additions already reversed are not added back again (no
              double add-back)
            </span>
          </li>
          <li className="tax-adj-m03-checklist__item">
            <span className="tax-adj-m03-checklist__marker">✓</span>
            <span>
              Total add-back is correct and ready for INK2 4.3c
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
