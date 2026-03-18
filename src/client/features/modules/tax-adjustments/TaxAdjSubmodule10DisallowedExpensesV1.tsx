import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule10DisallowedExpensesV1({
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
  const incomeStatement =
    extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];

  const expenseAccountPrefixes = [
    "607",
    "634",
    "655",
    "690",
    "698",
    "699",
    "762",
    "598",
  ];

  const disallowedExpenseLines = incomeStatement.filter((line) => {
    const code = line.code ?? "";
    return expenseAccountPrefixes.some((prefix) => code.startsWith(prefix));
  });

  const disallowedDecisions = (
    adjustmentsQuery.data?.adjustments.decisions ?? []
  ).filter((d) => d.module === "disallowed_expenses");

  const addBackAmount = disallowedDecisions
    .filter((d) => d.direction === "increase_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const unreviewed = disallowedDecisions.filter(
    (d) => d.status === "manual_review_required",
  );

  const sanctionsLines = incomeStatement.filter((line) =>
    (line.code ?? "").startsWith("634"),
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
    <div className="tax-adj-m10-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m10-section tax-adj-m10-section--accounts">
        <div className="tax-adj-m10-section__header">
          <h2>Expense Accounts Overview</h2>
          <p className="tax-adj-m10-section__subtitle">
            Accounts 607x (entertainment), 634x (sanctions/fines), 655x
            (consulting), 690x (other non-deductible), 698x (membership fees),
            699x (sponsorship), 762x (healthcare), 598x (sponsorship
            deductible).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m10-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : disallowedExpenseLines.length > 0 ? (
          <table className="tax-adj-m10-table">
            <thead className="tax-adj-m10-table__head">
              <tr>
                <th className="tax-adj-m10-table__header">Code</th>
                <th className="tax-adj-m10-table__header">Label</th>
                <th className="tax-adj-m10-table__header">
                  Current Year (SEK)
                </th>
                <th className="tax-adj-m10-table__header">Prior Year (SEK)</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m10-table__body">
              {disallowedExpenseLines.map((line) => (
                <tr key={line.code} className="tax-adj-m10-table__row">
                  <td className="tax-adj-m10-table__cell">{line.code}</td>
                  <td className="tax-adj-m10-table__cell">{line.label}</td>
                  <td className="tax-adj-m10-table__cell">
                    {formatNumber(line.currentYearValue)}
                  </td>
                  <td className="tax-adj-m10-table__cell">
                    {formatNumber(line.priorYearValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="tax-adj-m10-empty-message">
            No disallowed expense accounts found in income statement.
          </p>
        )}
      </CardV1>

      {sanctionsLines.length > 0 ? (
        <CardV1 className="tax-adj-m10-section tax-adj-m10-section--sanctions">
          <div className="tax-adj-m10-section__header">
            <h2>Sanctions and Fines (634x)</h2>
            <p className="tax-adj-m10-section__subtitle">
              Never deductible under IL 9:9 — full add-back required, no
              exceptions.
            </p>
          </div>
          <div className="tax-adj-m10-status tax-adj-m10-status--warning">
            <span className="tax-adj-m10-status__icon">⚠</span>
            <span className="tax-adj-m10-status__text">
              Fines and sanctions (account 634x) are never deductible — full
              add-back at INK2 4.3c required without exception (IL 9:9).
            </span>
          </div>
        </CardV1>
      ) : null}

      <CardV1 className="tax-adj-m10-section tax-adj-m10-section--ai-decisions">
        <div className="tax-adj-m10-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m10-section__subtitle">
            All add-backs target INK2 4.3c. Consulting fees (655000): only
            income tax return preparation fees are flagged.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m10-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : disallowedDecisions.length > 0 ? (
          <>
            <table className="tax-adj-m10-table">
              <thead className="tax-adj-m10-table__head">
                <tr>
                  <th className="tax-adj-m10-table__header">Amount (SEK)</th>
                  <th className="tax-adj-m10-table__header">Direction</th>
                  <th className="tax-adj-m10-table__header">Rationale</th>
                  <th className="tax-adj-m10-table__header">Status</th>
                  <th className="tax-adj-m10-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m10-table__body">
                {disallowedDecisions.map((d) => (
                  <tr key={d.id} className="tax-adj-m10-table__row">
                    <td className="tax-adj-m10-table__cell">
                      {formatNumber(d.amount)}
                    </td>
                    <td className="tax-adj-m10-table__cell">
                      {d.direction === "increase_taxable_income"
                        ? "Add-back → INK2 4.3c"
                        : d.direction === "decrease_taxable_income"
                          ? "Deduction"
                          : "No adjustment"}
                    </td>
                    <td className="tax-adj-m10-table__cell">{d.rationale}</td>
                    <td className="tax-adj-m10-table__cell">{d.status}</td>
                    <td className="tax-adj-m10-table__cell">
                      {d.reviewFlag ? (
                        <span className="tax-adj-m10-review-flag">⚠</span>
                      ) : (
                        <span className="tax-adj-m10-review-ok">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tax-adj-m10-decisions-summary">
              <div className="tax-adj-m10-summary-row">
                <span className="tax-adj-m10-summary-label">
                  Total Add-back for INK2 4.3c:
                </span>
                <span className="tax-adj-m10-summary-value">
                  {formatNumber(addBackAmount)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m10-empty-message">
            No disallowed expense decisions generated. Run the adjustment draft
            to populate this module.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m10-section tax-adj-m10-section--review-status">
        <div className="tax-adj-m10-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m10-section__subtitle">
            Unresolved decisions requiring manual action.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m10-status tax-adj-m10-status--warning">
            <span className="tax-adj-m10-status__icon">⚠</span>
            <span className="tax-adj-m10-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m10-status tax-adj-m10-status--ok">
            <span className="tax-adj-m10-status__icon">✓</span>
            <span className="tax-adj-m10-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m10-section tax-adj-m10-section--verification">
        <div className="tax-adj-m10-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m10-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m10-checklist">
          <li className="tax-adj-m10-checklist__item">
            <span className="tax-adj-m10-checklist__marker">✓</span>
            <span>
              All 607200 / 698200 / 762300 / 699300 accounts are correctly
              mapped as non-deductible
            </span>
          </li>
          <li className="tax-adj-m10-checklist__item">
            <span className="tax-adj-m10-checklist__marker">✓</span>
            <span>
              634200 (sanctions/fines) is fully added back — no exceptions
              apply (IL 9:9)
            </span>
          </li>
          <li className="tax-adj-m10-checklist__item">
            <span className="tax-adj-m10-checklist__marker">✓</span>
            <span>
              Consulting fees (655000): only income tax return preparation fees
              are flagged — all other consulting is deductible
            </span>
          </li>
          <li className="tax-adj-m10-checklist__item">
            <span className="tax-adj-m10-checklist__marker">✓</span>
            <span>
              Healthcare and entertainment splits (deductible vs non-deductible)
              match the underlying expenses
            </span>
          </li>
          <li className="tax-adj-m10-checklist__item">
            <span className="tax-adj-m10-checklist__marker">✓</span>
            <span>
              Total add-back is correct and ready for INK2 4.3c
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
