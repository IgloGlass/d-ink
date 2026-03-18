import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule09GroupContributionsV1({
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

  const groupContributionLines = incomeStatement.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("882") || code.startsWith("883");
  });

  const groupContributionDecisions = (
    adjustmentsQuery.data?.adjustments.decisions ?? []
  ).filter((d) => d.module === "group_contributions");

  const hasIssue = groupContributionDecisions.some(
    (d) =>
      d.status === "manual_review_required" ||
      d.direction === "increase_taxable_income",
  );

  const unreviewed = groupContributionDecisions.filter(
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
    <div className="tax-adj-m09-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m09-section tax-adj-m09-section--accounts">
        <div className="tax-adj-m09-section__header">
          <h2>Group Contribution Accounts</h2>
          <p className="tax-adj-m09-section__subtitle">
            Account 882000 (received) and 883000 (provided). Group
            contributions are recognized at INK2 3.x codes — no 4.x adjustment
            is needed when IL 35 conditions are met.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m09-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : groupContributionLines.length > 0 ? (
          <table className="tax-adj-m09-table">
            <thead className="tax-adj-m09-table__head">
              <tr>
                <th className="tax-adj-m09-table__header">Code</th>
                <th className="tax-adj-m09-table__header">Label</th>
                <th className="tax-adj-m09-table__header">
                  Current Year (SEK)
                </th>
                <th className="tax-adj-m09-table__header">Prior Year (SEK)</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m09-table__body">
              {groupContributionLines.map((line) => (
                <tr key={line.code} className="tax-adj-m09-table__row">
                  <td className="tax-adj-m09-table__cell">{line.code}</td>
                  <td className="tax-adj-m09-table__cell">{line.label}</td>
                  <td className="tax-adj-m09-table__cell">
                    {formatNumber(line.currentYearValue)}
                  </td>
                  <td className="tax-adj-m09-table__cell">
                    {formatNumber(line.priorYearValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="tax-adj-m09-empty-message">
            No group contribution accounts (882x, 883x) found in income
            statement.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m09-section tax-adj-m09-section--il35-validation">
        <div className="tax-adj-m09-section__header">
          <h2>IL 35 Conditions Validation</h2>
          <p className="tax-adj-m09-section__subtitle">
            AI verification of the four conditions required for deductibility
            under IL 35:1–3.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m09-loading-grid">
            <SkeletonV1 height={80} />
          </div>
        ) : groupContributionDecisions.length > 0 ? (
          <table className="tax-adj-m09-table">
            <thead className="tax-adj-m09-table__head">
              <tr>
                <th className="tax-adj-m09-table__header">Amount (SEK)</th>
                <th className="tax-adj-m09-table__header">Direction</th>
                <th className="tax-adj-m09-table__header">Rationale</th>
                <th className="tax-adj-m09-table__header">Status</th>
                <th className="tax-adj-m09-table__header">Review</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m09-table__body">
              {groupContributionDecisions.map((d) => (
                <tr key={d.id} className="tax-adj-m09-table__row">
                  <td className="tax-adj-m09-table__cell">
                    {formatNumber(d.amount)}
                  </td>
                  <td className="tax-adj-m09-table__cell">
                    {d.direction === "increase_taxable_income"
                      ? "Add-back"
                      : d.direction === "decrease_taxable_income"
                        ? "Deduction"
                        : "Informational"}
                  </td>
                  <td className="tax-adj-m09-table__cell">{d.rationale}</td>
                  <td className="tax-adj-m09-table__cell">{d.status}</td>
                  <td className="tax-adj-m09-table__cell">
                    {d.reviewFlag ? (
                      <span className="tax-adj-m09-review-flag">⚠</span>
                    ) : (
                      <span className="tax-adj-m09-review-ok">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="tax-adj-m09-empty-message">
            No group contribution decisions generated. Run the adjustment draft
            to populate this module.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m09-section tax-adj-m09-section--validation-summary">
        <div className="tax-adj-m09-section__header">
          <h2>Validation Summary</h2>
          <p className="tax-adj-m09-section__subtitle">
            Overall IL 35 compliance status.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : hasIssue ? (
          <div className="tax-adj-m09-status tax-adj-m09-status--warning">
            <span className="tax-adj-m09-status__icon">⚠</span>
            <span className="tax-adj-m09-status__text">
              IL 35 conditions not fully verified — review required before
              finalizing. If conditions are not met, the provided contribution
              (883000) must be added back.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m09-status tax-adj-m09-status--ok">
            <span className="tax-adj-m09-status__icon">✓</span>
            <span className="tax-adj-m09-status__text">
              All IL 35 conditions confirmed — group contributions flow at 3.x
              codes as booked. No 4.x adjustment required.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m09-section tax-adj-m09-section--review-status">
        <div className="tax-adj-m09-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m09-section__subtitle">
            Unresolved decisions requiring manual action.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m09-status tax-adj-m09-status--warning">
            <span className="tax-adj-m09-status__icon">⚠</span>
            <span className="tax-adj-m09-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m09-status tax-adj-m09-status--ok">
            <span className="tax-adj-m09-status__icon">✓</span>
            <span className="tax-adj-m09-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m09-section tax-adj-m09-section--verification">
        <div className="tax-adj-m09-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m09-section__subtitle">
            Confirm each IL 35 condition before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m09-checklist">
          <li className="tax-adj-m09-checklist__item">
            <span className="tax-adj-m09-checklist__marker">✓</span>
            <span>
              Ownership was &gt;90% for the ENTIRE fiscal year (not just
              year-end)
            </span>
          </li>
          <li className="tax-adj-m09-checklist__item">
            <span className="tax-adj-m09-checklist__marker">✓</span>
            <span>
              Both the giving and receiving company are Swedish tax residents
            </span>
          </li>
          <li className="tax-adj-m09-checklist__item">
            <span className="tax-adj-m09-checklist__marker">✓</span>
            <span>
              The contribution is recognized in the same fiscal year by both
              parties
            </span>
          </li>
          <li className="tax-adj-m09-checklist__item">
            <span className="tax-adj-m09-checklist__marker">✓</span>
            <span>
              The giving company does not create or increase a deficit through
              the contribution
            </span>
          </li>
          <li className="tax-adj-m09-checklist__item">
            <span className="tax-adj-m09-checklist__marker">✓</span>
            <span>
              If conditions are not met: the non-qualifying contribution amount
              is identified for add-back
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
