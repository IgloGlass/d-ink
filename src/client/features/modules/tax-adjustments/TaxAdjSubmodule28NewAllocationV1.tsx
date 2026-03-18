import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const CURRENT_YEAR = 2025;

export function TaxAdjSubmodule28NewAllocationV1({
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

  const profitBeforeTax =
    extraction?.fields?.profitBeforeTax?.value ?? 0;
  const balanceSheetLines = extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];

  const decisions = adjustments?.decisions ?? [];

  const addBackDecisions = decisions.filter(
    (d) => d.direction === "increase_taxable_income"
  );
  const deductionDecisions = decisions.filter(
    (d) => d.direction === "decrease_taxable_income"
  );

  const totalAddBacks = addBackDecisions.reduce(
    (sum, d) => sum + (d.amount ?? 0),
    0
  );
  const totalDeductions = deductionDecisions.reduce(
    (sum, d) => sum + (d.amount ?? 0),
    0
  );

  const taxableIncome = profitBeforeTax + totalAddBacks - totalDeductions;

  const maximumAllocationRate = 0.25;
  const maximumAllocationAmount =
    taxableIncome > 0 ? taxableIncome * maximumAllocationRate : 0;

  const allocationAmount = maximumAllocationAmount;
  const taxableIncomeAfterAllocation = taxableIncome - allocationAmount;

  const periodiseringsfonderAccounts = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("211");
  });

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

  const getTaxableIncomeStatusBadge = (): string => {
    if (taxableIncome > 0) {
      return "tax-adj-m28-badge--positive";
    }
    return "tax-adj-m28-badge--non-positive";
  };

  return (
    <div className="tax-adj-m28-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--taxable-position">
        <div className="tax-adj-m28-section__header">
          <h2>Taxable Income Position</h2>
          <p className="tax-adj-m28-section__subtitle">
            Current taxable income before allocation to periodiseringsfond.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : (
          <div className="tax-adj-m28-position-display">
            <div className="tax-adj-m28-position-item">
              <span className="tax-adj-m28-position-label">Taxable Income</span>
              <span className="tax-adj-m28-position-value">
                {formatNumber(taxableIncome)} SEK
              </span>
              <span
                className={`tax-adj-m28-badge ${getTaxableIncomeStatusBadge()}`}
              >
                {taxableIncome > 0 ? "Positive" : "Zero or Negative"}
              </span>
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--maximum-allocation">
        <div className="tax-adj-m28-section__header">
          <h2>Maximum Allocation</h2>
          <p className="tax-adj-m28-section__subtitle">
            IL 30 — 25% of positive taxable income.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={120} />
        ) : (
          <dl className="tax-adj-m28-definition-list">
            <dt className="tax-adj-m28-definition-list__term">
              Taxable Income
            </dt>
            <dd className="tax-adj-m28-definition-list__definition">
              {formatNumber(taxableIncome)} SEK
            </dd>

            <dt className="tax-adj-m28-definition-list__term">
              Maximum Allocation Rate
            </dt>
            <dd className="tax-adj-m28-definition-list__definition">
              {(maximumAllocationRate * 100).toFixed(0)}%
            </dd>

            <dt className="tax-adj-m28-definition-list__term">
              Maximum Allocation Amount
            </dt>
            <dd className="tax-adj-m28-definition-list__definition">
              {formatNumber(maximumAllocationAmount)} SEK
            </dd>

            <dt className="tax-adj-m28-definition-list__term">
              Allocation Restriction
            </dt>
            <dd className="tax-adj-m28-definition-list__definition">
              {taxableIncome <= 0
                ? "No allocation permitted — taxable income is ≤ 0"
                : "Allocation permitted — positive taxable income"}
            </dd>
          </dl>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--allocation-impact">
        <div className="tax-adj-m28-section__header">
          <h2>Allocation Impact</h2>
          <p className="tax-adj-m28-section__subtitle">
            Effect of new allocation on taxable income and module 29 input.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={120} />
        ) : (
          <div className="tax-adj-m28-impact-summary">
            <div className="tax-adj-m28-impact-item">
              <div className="tax-adj-m28-impact-label">Allocation Amount</div>
              <div className="tax-adj-m28-impact-value">
                {formatNumber(allocationAmount)} SEK
              </div>
              <div className="tax-adj-m28-impact-meta">
                V1 defaults to maximum allowable allocation
              </div>
            </div>

            <div className="tax-adj-m28-impact-item">
              <div className="tax-adj-m28-impact-label">
                Taxable Income After Allocation
              </div>
              <div className="tax-adj-m28-impact-value">
                {formatNumber(taxableIncomeAfterAllocation)} SEK
              </div>
              <div className="tax-adj-m28-impact-meta">
                = Taxable income minus allocation amount
              </div>
            </div>

            <div className="tax-adj-m28-impact-item tax-adj-m28-impact-item--note">
              <div className="tax-adj-m28-impact-note">
                New fund is added to periodiseringsfond register (211x accounts)
                for 6-year reversal window. This allocation reduces taxable
                income in the current year and will be reversed in future years
                (module 25).
              </div>
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--il-rules">
        <div className="tax-adj-m28-section__header">
          <h2>IL 30 Rules: Tax Allocation Reserve</h2>
          <p className="tax-adj-m28-section__subtitle">
            Swedish tax law framework for periodiseringsfond allocation.
          </p>
        </div>

        <div className="tax-adj-m28-rules-list">
          <div className="tax-adj-m28-rule">
            <h3 className="tax-adj-m28-rule__title">Maximum 25% Allocation</h3>
            <p className="tax-adj-m28-rule__content">
              A company may allocate a maximum of 25% of positive taxable income
              to a tax allocation reserve (periodiseringsfond). The allocation
              is deductible from taxable income in the allocation year.
            </p>
          </div>

          <div className="tax-adj-m28-rule">
            <h3 className="tax-adj-m28-rule__title">Negative Income Rule</h3>
            <p className="tax-adj-m28-rule__content">
              No allocation is permitted if taxable income is zero or negative.
              The allocation is entirely voluntary, but when made, it must not
              exceed the 25% ceiling of positive income.
            </p>
          </div>

          <div className="tax-adj-m28-rule">
            <h3 className="tax-adj-m28-rule__title">
              Six-Year Reversal Window
            </h3>
            <p className="tax-adj-m28-rule__content">
              The allocated fund is held for a maximum of 6 years. By the end
              of year Y+6 (where Y is the allocation year), the fund must be
              reversed and added back to taxable income. Reversal is tracked in
              module 25.
            </p>
          </div>

          <div className="tax-adj-m28-rule">
            <h3 className="tax-adj-m28-rule__title">
              Register Maintenance
            </h3>
            <p className="tax-adj-m28-rule__content">
              The fund is recorded in balance sheet accounts 211x
              (periodiseringsfonder). A fund register must be maintained
              documenting allocation year, amount, and reversal deadline for
              compliance and audit purposes.
            </p>
          </div>
        </div>
      </CardV1>

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--outstanding-register">
        <div className="tax-adj-m28-section__header">
          <h2>Outstanding Periodiseringsfonder Register</h2>
          <p className="tax-adj-m28-section__subtitle">
            Existing funds from prior years (balance sheet 211x accounts).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m28-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : periodiseringsfonderAccounts.length > 0 ? (
          <div className="tax-adj-m28-register-table">
            <table className="tax-adj-m28-table">
              <thead className="tax-adj-m28-table__head">
                <tr>
                  <th className="tax-adj-m28-table__header">Account Code</th>
                  <th className="tax-adj-m28-table__header">Description</th>
                  <th className="tax-adj-m28-table__header">Current Year (SEK)</th>
                  <th className="tax-adj-m28-table__header">Prior Year (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m28-table__body">
                {periodiseringsfonderAccounts.map((line) => (
                  <tr key={line.code} className="tax-adj-m28-table__row">
                    <td className="tax-adj-m28-table__cell">{line.code}</td>
                    <td className="tax-adj-m28-table__cell">{line.label}</td>
                    <td className="tax-adj-m28-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m28-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m28-empty-message">
            No existing periodiseringsfonder (211x) found in balance sheet. This
            will be the first new allocation if allocation amount is greater
            than zero.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m28-section tax-adj-m28-section--verification">
        <div className="tax-adj-m28-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m28-section__subtitle">
            Confirm each item before proceeding to module 29.
          </p>
        </div>

        <ul className="tax-adj-m28-checklist">
          <li className="tax-adj-m28-checklist__item">
            <span className="tax-adj-m28-checklist__marker">✓</span>
            <span>Taxable income is correctly calculated and confirmed</span>
          </li>
          <li className="tax-adj-m28-checklist__item">
            <span className="tax-adj-m28-checklist__marker">✓</span>
            <span>25% allocation ceiling has been verified as applicable</span>
          </li>
          <li className="tax-adj-m28-checklist__item">
            <span className="tax-adj-m28-checklist__marker">✓</span>
            <span>Allocation amount has been decided (or zero if not desired)</span>
          </li>
          <li className="tax-adj-m28-checklist__item">
            <span className="tax-adj-m28-checklist__marker">✓</span>
            <span>
              New fund has been added to register (211x) with allocation year
              and 6-year deadline noted
            </span>
          </li>
          <li className="tax-adj-m28-checklist__item">
            <span className="tax-adj-m28-checklist__marker">✓</span>
            <span>
              Impact on module 29 (final taxable income reduction) is understood
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
