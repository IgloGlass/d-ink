import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule07NonTaxableIncomeV1({
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

  const nonTaxableIncomeAccounts = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("831") ||
      code.startsWith("3993") ||
      code.startsWith("3995") ||
      code === "399300" ||
      code === "399500"
    );
  });

  const nonTaxableDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "non_taxable_income",
  );

  const totalDeduction = nonTaxableDecisions
    .filter((decision) => decision.direction === "decrease_taxable_income")
    .reduce((sum, decision) => sum + decision.amount, 0);

  const unreviewed = nonTaxableDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  const compositionDecisions = nonTaxableDecisions.filter((decision) => {
    const rationale = decision.rationale.toLowerCase();
    return (
      rationale.includes("ackord") ||
      rationale.includes("composition") ||
      rationale.includes("skuldsanering") ||
      rationale.includes("399500")
    );
  });

  const hasCompositionDecision = compositionDecisions.length > 0;

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

  const getIncomeTypeLabel = (rationale: string): string => {
    const lower = rationale.toLowerCase();
    if (lower.includes("skattekonto") || lower.includes("831400") || lower.includes("tax account interest")) {
      return "Tax account interest (831400)";
    }
    if (lower.includes("ackord") || lower.includes("composition") || lower.includes("399500")) {
      return "Composition / ackord (399500)";
    }
    if (lower.includes("gift") || lower.includes("gåva") || lower.includes("donation") || lower.includes("399300")) {
      return "Gift / donation (399300)";
    }
    return "Non-taxable income";
  };

  return (
    <div className="tax-adj-m07-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m07-section tax-adj-m07-section--income-accounts">
        <div className="tax-adj-m07-section__header">
          <h2>Income Statement Accounts</h2>
          <p className="tax-adj-m07-section__subtitle">
            Accounts starting with 831 (skattekonto interest), 399300 (received
            gifts/donations), and 399500 (composition proceeds).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m07-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : nonTaxableIncomeAccounts.length > 0 ? (
          <div className="tax-adj-m07-accounts-table">
            <table className="tax-adj-m07-table">
              <thead className="tax-adj-m07-table__head">
                <tr>
                  <th className="tax-adj-m07-table__header">Code</th>
                  <th className="tax-adj-m07-table__header">Label</th>
                  <th className="tax-adj-m07-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m07-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m07-table__body">
                {nonTaxableIncomeAccounts.map((line) => (
                  <tr key={line.code} className="tax-adj-m07-table__row">
                    <td className="tax-adj-m07-table__cell">{line.code}</td>
                    <td className="tax-adj-m07-table__cell">{line.label}</td>
                    <td className="tax-adj-m07-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m07-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m07-empty-message">
            No accounts in the 831 or 399 range found in the income statement.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m07-section tax-adj-m07-section--ai-decisions">
        <div className="tax-adj-m07-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m07-section__subtitle">
            Proposed deductions for non-taxable income items. Target field: INK2
            4.5c
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m07-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : nonTaxableDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m07-decisions-table">
              <table className="tax-adj-m07-table">
                <thead className="tax-adj-m07-table__head">
                  <tr>
                    <th className="tax-adj-m07-table__header">
                      Amount (SEK)
                    </th>
                    <th className="tax-adj-m07-table__header">Direction</th>
                    <th className="tax-adj-m07-table__header">Income Type</th>
                    <th className="tax-adj-m07-table__header">Rationale</th>
                    <th className="tax-adj-m07-table__header">Confidence</th>
                    <th className="tax-adj-m07-table__header">Status</th>
                    <th className="tax-adj-m07-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m07-table__body">
                  {nonTaxableDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m07-table__row">
                      <td className="tax-adj-m07-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {getIncomeTypeLabel(decision.rationale)}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {Math.round(decision.confidence * 100)}%
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m07-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m07-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="tax-adj-m07-empty-message">
            No adjustment decisions for non-taxable income module.
          </p>
        )}
      </CardV1>

      {hasCompositionDecision ? (
        <CardV1 className="tax-adj-m07-section tax-adj-m07-section--composition-notice">
          <div className="tax-adj-m07-section__header">
            <h2>Composition / Ackord Notice</h2>
          </div>
          <div className="tax-adj-m07-composition-notice">
            <span className="tax-adj-m07-composition-notice__icon">ℹ</span>
            <p className="tax-adj-m07-composition-notice__text">
              One or more decisions relate to a formal composition agreement
              (ackord, 399500). Under IL 39:2, the forgiven debt amount is
              non-taxable, but it will reduce any outstanding underskott
              (tax loss carry-forward). This reduction must be applied in{" "}
              <strong>module 24 — Tax losses carried forward</strong>.
            </p>
          </div>
          {compositionDecisions.length > 0 ? (
            <div className="tax-adj-m07-composition-decisions">
              <table className="tax-adj-m07-table">
                <thead className="tax-adj-m07-table__head">
                  <tr>
                    <th className="tax-adj-m07-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m07-table__header">Rationale</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m07-table__body">
                  {compositionDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m07-table__row">
                      <td className="tax-adj-m07-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m07-table__cell">
                        {decision.rationale}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardV1>
      ) : null}

      <CardV1 className="tax-adj-m07-section tax-adj-m07-section--deduction-summary">
        <div className="tax-adj-m07-section__header">
          <h2>Total Deduction Summary</h2>
          <p className="tax-adj-m07-section__subtitle">
            Sum of all deductions flowing to INK2 4.5c.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : (
          <div className="tax-adj-m07-decisions-summary">
            <div className="tax-adj-m07-summary-row">
              <span className="tax-adj-m07-summary-label">
                Total deduction at INK2 4.5c:
              </span>
              <span className="tax-adj-m07-summary-value">
                {formatNumber(totalDeduction)} SEK
              </span>
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m07-section tax-adj-m07-section--review-status">
        <div className="tax-adj-m07-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m07-section__subtitle">
            Validation of unresolved adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m07-status tax-adj-m07-status--warning">
            <span className="tax-adj-m07-status__icon">⚠</span>
            <span className="tax-adj-m07-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m07-status tax-adj-m07-status--ok">
            <span className="tax-adj-m07-status__icon">✓</span>
            <span className="tax-adj-m07-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m07-section tax-adj-m07-section--verification">
        <div className="tax-adj-m07-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m07-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m07-checklist">
          <li className="tax-adj-m07-checklist__item">
            <span className="tax-adj-m07-checklist__marker">✓</span>
            <span>
              Tax account interest (831400) matches the skattekonto statement
              from the Swedish Tax Authority
            </span>
          </li>
          <li className="tax-adj-m07-checklist__item">
            <span className="tax-adj-m07-checklist__marker">✓</span>
            <span>
              Tax account interest is confirmed as non-taxable under IL 8:1
            </span>
          </li>
          <li className="tax-adj-m07-checklist__item">
            <span className="tax-adj-m07-checklist__marker">✓</span>
            <span>
              Any gift income (399300) is confirmed as non-taxable (requires
              group relationship or similar IL 8:2 exception)
            </span>
          </li>
          <li className="tax-adj-m07-checklist__item">
            <span className="tax-adj-m07-checklist__marker">✓</span>
            <span>
              If composition/ackord (399500) applies: outstanding underskott
              will be reduced by the forgiven amount in module 24
            </span>
          </li>
          <li className="tax-adj-m07-checklist__item">
            <span className="tax-adj-m07-checklist__marker">✓</span>
            <span>
              Total deduction is correct for INK2 4.5c
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
