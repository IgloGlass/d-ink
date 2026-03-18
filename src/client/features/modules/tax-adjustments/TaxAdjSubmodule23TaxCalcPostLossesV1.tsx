import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule23TaxCalcPostLossesV1({
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

  const allDecisions = adjustments?.decisions ?? [];

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return new Intl.NumberFormat("sv-SE").format(value);
  };

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

  // Recompute module 22 result inline
  const addBacks = allDecisions
    .filter((d) => d.direction === "increase_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const deductions = allDecisions
    .filter((d) => d.direction === "decrease_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const profitBeforeTax = extraction?.fields.profitBeforeTax.value ?? 0;
  const module22Result = profitBeforeTax + addBacks - deductions;

  // Net interest deduction from module 21
  const interestDeductionDecisions = allDecisions.filter(
    (d) =>
      d.module === "hybrid_targeted_interest_and_net_interest_offset" &&
      d.direction === "decrease_taxable_income"
  );

  const interestDeduction = interestDeductionDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // Underskott utilization (display-only for V1)
  // No dedicated module code for tax losses; filter by rationale keywords
  const underskottDecisions = allDecisions.filter((d) => {
    const r = (d.rationale ?? "").toLowerCase();
    return (
      r.includes("underskott") ||
      r.includes("tax loss") ||
      r.includes("förlust") ||
      r.includes("carry") ||
      r.includes("beloppsspärr")
    );
  });

  // Final result
  const taxableIncomePostLosses = module22Result - interestDeduction;

  // Check for ownership change warnings in extraction notes
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];
  const ownershipChangeKeywords = [
    "ägarskifte",
    "ownership change",
    "underskottsspärr",
  ];

  const hasOwnershipChange = relevantNotes.some((note) => {
    const titleLC = (note.title ?? "").toLowerCase();
    const notesLC = note.notes.map((n) => n.toLowerCase());
    return ownershipChangeKeywords.some(
      (keyword) =>
        titleLC.includes(keyword.toLowerCase()) ||
        notesLC.some((n) => n.includes(keyword.toLowerCase()))
    );
  });

  return (
    <div className="tax-adj-m23-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Calculation Waterfall */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--waterfall">
        <div className="tax-adj-m23-section__header">
          <h2>Calculation Waterfall</h2>
          <p className="tax-adj-m23-section__subtitle">
            Step-by-step calculation from module 22 result to taxable income
            after losses.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m23-loading-grid">
            <SkeletonV1 height={200} />
          </div>
        ) : (
          <dl className="tax-adj-m23-waterfall">
            <dt className="tax-adj-m23-waterfall__label">
              Module 22 intermediate result:
            </dt>
            <dd className="tax-adj-m23-waterfall__value">
              {formatNumber(module22Result)} SEK
            </dd>

            <dt className="tax-adj-m23-waterfall__label">
              − Net interest deduction (module 21):
            </dt>
            <dd className="tax-adj-m23-waterfall__value">
              {interestDeduction > 0
                ? `${formatNumber(interestDeduction)} SEK`
                : "0 SEK — no net interest deduction applies"}
            </dd>

            <dt className="tax-adj-m23-waterfall__label">
              − Underskott utilized (module 24):
            </dt>
            <dd className="tax-adj-m23-waterfall__value">
              {underskottDecisions.length > 0
                ? `${formatNumber(
                    underskottDecisions.reduce((s, d) => s + d.amount, 0)
                  )} SEK`
                : "Determined in module 24"}
            </dd>

            <dt className="tax-adj-m23-waterfall__label tax-adj-m23-waterfall__label--total">
              = Taxable income after losses:
            </dt>
            <dd className="tax-adj-m23-waterfall__value tax-adj-m23-waterfall__value--total">
              {formatNumber(taxableIncomePostLosses)} SEK
            </dd>
          </dl>
        )}
      </CardV1>

      {/* Section 2: Net Interest Deduction Details */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--interest-details">
        <div className="tax-adj-m23-section__header">
          <h2>Net Interest Deduction Details</h2>
          <p className="tax-adj-m23-section__subtitle">
            Deductions from module 21 (interest limitation) applied to this
            calculation.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m23-loading-grid">
            <SkeletonV1 height={100} />
          </div>
        ) : interestDeductionDecisions.length > 0 ? (
          <table className="tax-adj-m23-table">
            <thead className="tax-adj-m23-table__head">
              <tr>
                <th className="tax-adj-m23-table__header">Module</th>
                <th className="tax-adj-m23-table__header">Amount (SEK)</th>
                <th className="tax-adj-m23-table__header">Rationale</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m23-table__body">
              {interestDeductionDecisions.map((d) => (
                <tr key={d.id} className="tax-adj-m23-table__row">
                  <td className="tax-adj-m23-table__cell">{d.module}</td>
                  <td className="tax-adj-m23-table__cell">
                    {formatNumber(d.amount)}
                  </td>
                  <td className="tax-adj-m23-table__cell">{d.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="tax-adj-m23-empty-message">
            No net interest deduction from module 21.
          </p>
        )}
      </CardV1>

      {/* Section 3: Underskott (Tax Losses) Guidance */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--underskott-guidance">
        <div className="tax-adj-m23-section__header">
          <h2>Underskott (Tax Losses Carried Forward)</h2>
          <p className="tax-adj-m23-section__subtitle">
            Prior-year tax loss utilization rules and restrictions.
          </p>
        </div>

        <div className="tax-adj-m23-guidance">
          <p className="tax-adj-m23-guidance__text">
            Prior-year tax losses carried forward (underskott) are managed in
            module 24. The amount utilized in the current year reduces taxable
            income here. Utilization cannot create a negative taxable income —
            unused losses carry forward automatically.
          </p>
        </div>

        {hasOwnershipChange ? (
          <div className="tax-adj-m23-notice tax-adj-m23-notice--warning">
            <span className="tax-adj-m23-notice__icon">⚠</span>
            <p className="tax-adj-m23-notice__text">
              Ownership change detected — underskottsspärr may restrict
              utilization of prior-year losses. Review module 24 for any
              restrictions on loss utilization.
            </p>
          </div>
        ) : null}
      </CardV1>

      {/* Section 4: Result Status */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--result-status">
        <div className="tax-adj-m23-section__header">
          <h2>Result Status</h2>
          <p className="tax-adj-m23-section__subtitle">
            Outcome of the tax calculation after losses.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : taxableIncomePostLosses < 0 ? (
          <div className="tax-adj-m23-status tax-adj-m23-status--warning">
            <span className="tax-adj-m23-status__icon">⚠</span>
            <span className="tax-adj-m23-status__text">
              Taxable income is negative ({formatNumber(taxableIncomePostLosses)}{" "}
              SEK). Underskott cannot reduce below zero. Excess losses carry
              forward to next year — confirmed in module 24.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m23-status tax-adj-m23-status--ok">
            <span className="tax-adj-m23-status__icon">✓</span>
            <span className="tax-adj-m23-status__text">
              Taxable income after losses: {formatNumber(taxableIncomePostLosses)}{" "}
              SEK. Proceeds to module 25 (periodiseringsfond reversals) and
              module 29 (final calculation).
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 5: Downstream Impact */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--downstream">
        <div className="tax-adj-m23-section__header">
          <h2>Downstream Impact</h2>
          <p className="tax-adj-m23-section__subtitle">
            How this result feeds downstream modules.
          </p>
        </div>

        <div className="tax-adj-m23-downstream">
          <p className="tax-adj-m23-downstream__text">
            This taxable income after losses ({formatNumber(taxableIncomePostLosses)}{" "}
            SEK) feeds:
          </p>
          <ul className="tax-adj-m23-downstream__list">
            <li className="tax-adj-m23-downstream__item">
              <strong>Module 25</strong> — Periodiseringsfond reversals (if
              applicable). Further adjustments reduce or increase the taxable
              income.
            </li>
            <li className="tax-adj-m23-downstream__item">
              <strong>Module 29</strong> — Final taxable income calculation
              leading to INK2 entry at line 3.10 (taxable income or loss).
            </li>
          </ul>
        </div>
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m23-section tax-adj-m23-section--verification">
        <div className="tax-adj-m23-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m23-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m23-checklist">
          <li className="tax-adj-m23-checklist__item">
            <span className="tax-adj-m23-checklist__marker">✓</span>
            <span>
              Module 22 intermediate result ({formatNumber(module22Result)} SEK)
              is correctly calculated from profit before tax plus add-backs minus
              deductions
            </span>
          </li>
          <li className="tax-adj-m23-checklist__item">
            <span className="tax-adj-m23-checklist__marker">✓</span>
            <span>
              Net interest deduction from module 21 ({formatNumber(interestDeduction)}{" "}
              SEK) is correctly applied
            </span>
          </li>
          <li className="tax-adj-m23-checklist__item">
            <span className="tax-adj-m23-checklist__marker">✓</span>
            <span>
              Module 24 underskott register reviewed — all prior-year losses
              identified and utilization planned
            </span>
          </li>
          <li className="tax-adj-m23-checklist__item">
            <span className="tax-adj-m23-checklist__marker">✓</span>
            <span>
              If ownership change occurred, underskottsspärr restrictions
              confirmed and loss utilization adjusted accordingly
            </span>
          </li>
          <li className="tax-adj-m23-checklist__item">
            <span className="tax-adj-m23-checklist__marker">✓</span>
            <span>
              Final taxable income after losses ({formatNumber(taxableIncomePostLosses)}{" "}
              SEK) is non-negative or has valid underskott carryforward plan
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
