import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule20ItemsNotInBooksV1({
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
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  const offBookKeywords = [
    "närstående",
    "uttag",
    "related party",
    "ägare",
    "owner",
  ];

  const flaggedNotes = relevantNotes.filter((note) => {
    const titleMatch = offBookKeywords.some((keyword) =>
      (note.title ?? "").toLowerCase().includes(keyword.toLowerCase()),
    );
    const notesMatch = offBookKeywords.some((keyword) =>
      note.notes.some((n) =>
        n.toLowerCase().includes(keyword.toLowerCase()),
      ),
    );
    return titleMatch || notesMatch;
  });

  const itemsDecisions = (
    adjustmentsQuery.data?.adjustments.decisions ?? []
  ).filter((d) => d.module === "items_not_included_in_books");

  const addBackAmount = itemsDecisions
    .filter((d) => d.direction === "increase_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const unreviewed = itemsDecisions.filter(
    (d) => d.status === "manual_review_required",
  );

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return new Intl.NumberFormat("sv-SE").format(value);
  };

  return (
    <div className="tax-adj-m20-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m20-section tax-adj-m20-section--ai-scan">
        <div className="tax-adj-m20-section__header">
          <h2>AI Scan Results</h2>
          <p className="tax-adj-m20-section__subtitle">
            Automatic detection of related-party transactions and off-book
            items.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : flaggedNotes.length > 0 ? (
          <>
            <div className="tax-adj-m20-status tax-adj-m20-status--warning">
              <span className="tax-adj-m20-status__icon">⚠</span>
              <span className="tax-adj-m20-status__text">
                Potential off-book items detected in annual report notes
              </span>
            </div>
            <ul className="tax-adj-m20-flagged-notes">
              {flaggedNotes.map((note, idx) => (
                <li key={idx} className="tax-adj-m20-flagged-notes__item">
                  <span className="tax-adj-m20-flagged-notes__title">
                    {note.title || "(Untitled)"}
                  </span>
                  {note.notes.length > 0 && (
                    <span className="tax-adj-m20-flagged-notes__preview">
                      {note.notes[0].substring(0, 120)}
                      {note.notes[0].length > 120 ? "…" : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="tax-adj-m20-status tax-adj-m20-status--ok">
            <span className="tax-adj-m20-status__icon">✓</span>
            <span className="tax-adj-m20-status__text">
              No related-party or off-book item indicators found in annual
              report notes.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m20-section tax-adj-m20-section--guidance">
        <div className="tax-adj-m20-section__header">
          <h2>Review Guidance</h2>
        </div>

        <p className="tax-adj-m20-guidance-text">
          Review whether any taxable transactions occurred during the year that
          are not reflected in the accounts. Common examples include owner
          withdrawals at below-market value (uttag), private expenses paid by
          the company, benefits in kind not reported on salary statements,
          forgiven intra-group debt, and barter transactions. Enter any such
          amounts manually below.
        </p>

        <ul className="tax-adj-m20-guidance-checklist">
          <li className="tax-adj-m20-guidance-checklist__item">
            Goods or services withdrawn from the company for private use (IL 22
            uttag — taxable at market value)
          </li>
          <li className="tax-adj-m20-guidance-checklist__item">
            Employee benefits not reported on kontrolluppgifter
          </li>
          <li className="tax-adj-m20-guidance-checklist__item">
            Debts forgiven by a related party that should be treated as income
          </li>
          <li className="tax-adj-m20-guidance-checklist__item">
            Barter transactions or non-cash income not reflected in revenue
          </li>
        </ul>
      </CardV1>

      <CardV1 className="tax-adj-m20-section tax-adj-m20-section--ai-decisions">
        <div className="tax-adj-m20-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m20-section__subtitle">
            Manual additions for items not included in the accounts, targeting
            INK2 4.3c or appropriate code.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m20-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : itemsDecisions.length > 0 ? (
          <>
            <table className="tax-adj-m20-table">
              <thead className="tax-adj-m20-table__head">
                <tr>
                  <th className="tax-adj-m20-table__header">Amount (SEK)</th>
                  <th className="tax-adj-m20-table__header">Direction</th>
                  <th className="tax-adj-m20-table__header">Rationale</th>
                  <th className="tax-adj-m20-table__header">Status</th>
                  <th className="tax-adj-m20-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m20-table__body">
                {itemsDecisions.map((d) => (
                  <tr key={d.id} className="tax-adj-m20-table__row">
                    <td className="tax-adj-m20-table__cell">
                      {formatNumber(d.amount)}
                    </td>
                    <td className="tax-adj-m20-table__cell">
                      {d.direction === "increase_taxable_income"
                        ? "Addition (INK2 4.3c)"
                        : d.direction === "decrease_taxable_income"
                          ? "Deduction"
                          : "Informational"}
                    </td>
                    <td className="tax-adj-m20-table__cell">{d.rationale}</td>
                    <td className="tax-adj-m20-table__cell">{d.status}</td>
                    <td className="tax-adj-m20-table__cell">
                      {d.reviewFlag ? (
                        <span className="tax-adj-m20-review-flag">⚠</span>
                      ) : (
                        <span className="tax-adj-m20-review-ok">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tax-adj-m20-decisions-summary">
              <div className="tax-adj-m20-summary-row">
                <span className="tax-adj-m20-summary-label">
                  Total Additions for INK2 4.3c:
                </span>
                <span className="tax-adj-m20-summary-value">
                  {formatNumber(addBackAmount)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m20-empty-message">
            No decisions generated yet. Review the guidance above and enter
            manual adjustments if applicable.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m20-section tax-adj-m20-section--review-status">
        <div className="tax-adj-m20-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m20-section__subtitle">
            Unresolved decisions requiring manual action.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m20-status tax-adj-m20-status--warning">
            <span className="tax-adj-m20-status__icon">⚠</span>
            <span className="tax-adj-m20-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m20-status tax-adj-m20-status--ok">
            <span className="tax-adj-m20-status__icon">✓</span>
            <span className="tax-adj-m20-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m20-section tax-adj-m20-section--verification">
        <div className="tax-adj-m20-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m20-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m20-checklist">
          <li className="tax-adj-m20-checklist__item">
            <span className="tax-adj-m20-checklist__marker">✓</span>
            <span>
              All owner/shareholder transactions reviewed for arm's-length
              pricing (IL 22 uttag)
            </span>
          </li>
          <li className="tax-adj-m20-checklist__item">
            <span className="tax-adj-m20-checklist__marker">✓</span>
            <span>
              Employee benefits and perquisites checked against salary
              statements (kontrolluppgifter)
            </span>
          </li>
          <li className="tax-adj-m20-checklist__item">
            <span className="tax-adj-m20-checklist__marker">✓</span>
            <span>
              Forgiven or waived intra-group debts reviewed for income
              recognition
            </span>
          </li>
          <li className="tax-adj-m20-checklist__item">
            <span className="tax-adj-m20-checklist__marker">✓</span>
            <span>
              Barter transactions and non-cash income identified and valued at
              market price
            </span>
          </li>
          <li className="tax-adj-m20-checklist__item">
            <span className="tax-adj-m20-checklist__marker">✓</span>
            <span>
              Auditor's report and management letter reviewed for any
              unrecorded items flagged
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
