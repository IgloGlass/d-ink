import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const CORPORATE_TAX_RATE = 0.206;
const CORPORATE_TAX_RATE_DISPLAY = "20.6%";
const LONESKATT_RATE = 0.2426;
const LONESKATT_RATE_DISPLAY = "24.26%";
const EFFECTIVE_TAX_RATE_HEALTHY_MIN = 0.18;
const EFFECTIVE_TAX_RATE_HEALTHY_MAX = 0.23;
const BOOKED_TAX_VARIANCE_THRESHOLD = 0.1;

interface TaxComponent {
  label: string;
  ink2Code: string;
  basis: number;
  rate: number;
  amount: number;
}

export function TaxAdjSubmodule30FinalTaxCalcV1({
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

  const profitBeforeTax = extraction?.fields.profitBeforeTax.value ?? 0;
  const incomeStatementLines =
    extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];

  const allDecisions = adjustments?.decisions ?? [];

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return new Intl.NumberFormat("sv-SE").format(Math.round(value));
  };

  const formatPercent = (value: number): string => {
    return (value * 100).toFixed(1) + "%";
  };

  const parseDecisionAmount = (decision: {
    amount: number;
    direction: string;
  }): number => {
    const base = decision.amount;
    return decision.direction === "increase_taxable_income" ? base : -base;
  };

  // Compute final taxable income (from module 29 result logic)
  // Formula: profitBeforeTax + all add-backs - all deductions - deductible net interest - allocation
  const addBacksTotal = allDecisions
    .filter(
      (d) =>
        d.direction === "increase_taxable_income"
    )
    .reduce((sum, d) => sum + d.amount, 0);

  const deductionsTotal = allDecisions
    .filter(
      (d) =>
        d.direction === "decrease_taxable_income"
    )
    .reduce((sum, d) => sum + d.amount, 0);

  // Deductible net interest from module 21 (hybrid_targeted_interest_and_net_interest_offset)
  const netInterestDecisions = allDecisions.filter(
    (d) =>
      d.module === "hybrid_targeted_interest_and_net_interest_offset" &&
      d.direction === "decrease_taxable_income"
  );
  const deductibleNetInterest = netInterestDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // Allocation for new periodsiseringsfond: 25% of positive profit after main adjustments
  const profitAfterMainDecisions = profitBeforeTax + addBacksTotal - deductionsTotal;
  const allocationAmount =
    profitAfterMainDecisions > 0 ? profitAfterMainDecisions * 0.25 : 0;

  const finalTaxableIncome =
    profitBeforeTax +
    addBacksTotal -
    deductionsTotal -
    deductibleNetInterest -
    allocationAmount;

  // Corporate income tax
  const corporateIncomeTax =
    finalTaxableIncome > 0 ? finalTaxableIncome * CORPORATE_TAX_RATE : 0;

  // Extract supplementary tax bases from decisions
  const pensionBasisDecisions = allDecisions.filter(
    (d) =>
      d.module === "pension_costs_and_special_payroll_tax" &&
      (d.policyRuleReference.includes("1.4") ||
        d.rationale.toLowerCase().includes("löneskatt") ||
        d.rationale.toLowerCase().includes("pension basis"))
  );
  const pensionBasis = Math.max(
    0,
    pensionBasisDecisions.reduce((sum, d) => sum + d.amount, 0)
  );
  const loneskattAmount = pensionBasis * LONESKATT_RATE;

  // Yield tax components from module 8
  const yieldTaxDecisions = allDecisions.filter(
    (d) => d.module === "yield_risk_and_renewable_energy_taxes"
  );

  const yieldComponents: TaxComponent[] = [];
  let yieldTaxBasis16a = 0;
  let yieldTaxBasis16b = 0;
  let yieldTaxBasis17a = 0;

  for (const decision of yieldTaxDecisions) {
    const ref = decision.policyRuleReference.toLowerCase();
    if (ref.includes("1.6a")) {
      yieldTaxBasis16a = Math.max(0, decision.amount);
    } else if (ref.includes("1.6b")) {
      yieldTaxBasis16b = Math.max(0, decision.amount);
    } else if (ref.includes("1.7a")) {
      yieldTaxBasis17a = Math.max(0, decision.amount);
    }
  }

  if (yieldTaxBasis16a > 0) {
    yieldComponents.push({
      label: "Avkastningsskatt life",
      ink2Code: "1.6a",
      basis: yieldTaxBasis16a,
      rate: 0.15,
      amount: Math.round(yieldTaxBasis16a * 0.15),
    });
  }
  if (yieldTaxBasis16b > 0) {
    yieldComponents.push({
      label: "Avkastningsskatt pension",
      ink2Code: "1.6b",
      basis: yieldTaxBasis16b,
      rate: 0.15,
      amount: Math.round(yieldTaxBasis16b * 0.15),
    });
  }
  if (yieldTaxBasis17a > 0) {
    yieldComponents.push({
      label: "Avkastningsskatt other",
      ink2Code: "1.7a",
      basis: yieldTaxBasis17a,
      rate: 0.3,
      amount: Math.round(yieldTaxBasis17a * 0.3),
    });
  }

  // Riskskatt (1.3) — from yield/risk module
  let riskskatAmount = 0;
  let riskskatBasis = 0;
  const riskskatDecision = yieldTaxDecisions.find((d) =>
    d.policyRuleReference.toLowerCase().includes("1.3")
  );
  if (riskskatDecision) {
    riskskatBasis = Math.max(0, riskskatDecision.amount);
    riskskatAmount = riskskatBasis; // Assume rate is embedded in decision amount
  }

  // Property tax components from module 15
  const propertyTaxDecisions = allDecisions.filter(
    (d) => d.module === "property_tax_and_property_fee"
  );
  let propertyTaxTotalBasis = 0;
  let propertyTaxTotal = 0;
  for (const decision of propertyTaxDecisions) {
    const ref = decision.policyRuleReference.toLowerCase();
    if (ref.match(/1\.[8-9]|1\.1[0-5]/)) {
      propertyTaxTotalBasis += decision.amount;
      propertyTaxTotal += decision.amount;
    }
  }

  // Booked tax expense from income statement (accounts 88xx)
  const bookedTaxLines = incomeStatementLines.filter(
    (line) =>
      line.code.startsWith("88") &&
      (line.code === "8800" || line.code === "8810")
  );
  const bookedCurrentTax = Math.abs(
    bookedTaxLines.find((l) => l.code === "8800")?.currentYearValue ?? 0
  );
  const bookedDeferredTax = Math.abs(
    bookedTaxLines.find((l) => l.code === "8810")?.currentYearValue ?? 0
  );
  const bookedTotalTax = bookedCurrentTax + bookedDeferredTax;

  // Compute total tax
  const supplementaryTaxTotal =
    loneskattAmount +
    yieldComponents.reduce((sum, c) => sum + c.amount, 0) +
    riskskatAmount +
    propertyTaxTotal;
  const totalTaxCharge = corporateIncomeTax + supplementaryTaxTotal;

  // Effective tax rate
  const effectiveTaxRate =
    profitBeforeTax > 0 ? totalTaxCharge / profitBeforeTax : 0;
  const isEffectiveTaxRateHealthy =
    effectiveTaxRate >= EFFECTIVE_TAX_RATE_HEALTHY_MIN &&
    effectiveTaxRate <= EFFECTIVE_TAX_RATE_HEALTHY_MAX;

  // Booked tax variance
  const taxVariance = totalTaxCharge - bookedTotalTax;
  const taxVariancePercent =
    bookedTotalTax > 0 ? Math.abs(taxVariance) / bookedTotalTax : 0;
  const hasSignificantVariance =
    taxVariancePercent > BOOKED_TAX_VARIANCE_THRESHOLD;

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

  return (
    <div className="tax-adj-m30-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Tax Calculation Waterfall */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--waterfall">
        <div className="tax-adj-m30-section__header">
          <h2>Tax Calculation Waterfall</h2>
          <p className="tax-adj-m30-section__subtitle">
            Step-by-step calculation from profit before tax to corporate income
            tax.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m30-loading-grid">
            <SkeletonV1 height={200} />
          </div>
        ) : (
          <div className="tax-adj-m30-waterfall">
            <table className="tax-adj-m30-waterfall-table">
              <tbody className="tax-adj-m30-waterfall-table__body">
                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--base">
                  <td className="tax-adj-m30-waterfall-label">
                    Profit before tax (PBT)
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {formatNumber(profitBeforeTax)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--addback">
                  <td className="tax-adj-m30-waterfall-label">
                    {'+'} Total add-backs
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {formatNumber(addBacksTotal)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--deduction">
                  <td className="tax-adj-m30-waterfall-label">
                    {'−'} Total deductions
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {formatNumber(deductionsTotal)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--deduction">
                  <td className="tax-adj-m30-waterfall-label">
                    {'−'} Deductible net interest (module 21)
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {formatNumber(deductibleNetInterest)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--deduction">
                  <td className="tax-adj-m30-waterfall-label">
                    {'−'} New periodsiseringsfond allocation (25%)
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {formatNumber(allocationAmount)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--subtotal">
                  <td className="tax-adj-m30-waterfall-label">
                    <strong>Final taxable income</strong>
                  </td>
                  <td className="tax-adj-m30-waterfall-amount tax-adj-m30-waterfall-amount--bold">
                    {formatNumber(finalTaxableIncome)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--rate">
                  <td className="tax-adj-m30-waterfall-label">
                    × Corporate tax rate
                  </td>
                  <td className="tax-adj-m30-waterfall-amount">
                    {CORPORATE_TAX_RATE_DISPLAY}
                  </td>
                </tr>

                <tr className="tax-adj-m30-waterfall-row tax-adj-m30-waterfall-row--result">
                  <td className="tax-adj-m30-waterfall-label">
                    <strong>Corporate income tax</strong>
                  </td>
                  <td className="tax-adj-m30-waterfall-amount tax-adj-m30-waterfall-amount--highlighted">
                    {formatNumber(corporateIncomeTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardV1>

      {/* Section 2: Supplementary Tax Bases */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--supplementary">
        <div className="tax-adj-m30-section__header">
          <h2>Supplementary Tax Bases</h2>
          <p className="tax-adj-m30-section__subtitle">
            Special taxes applied to dedicated tax bases outside corporate
            income tax.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m30-loading-grid">
            <SkeletonV1 height={150} />
          </div>
        ) : (
          <table className="tax-adj-m30-table">
            <thead className="tax-adj-m30-table__head">
              <tr>
                <th className="tax-adj-m30-table__header">Tax Type</th>
                <th className="tax-adj-m30-table__header">INK2 Code</th>
                <th className="tax-adj-m30-table__header">Basis (SEK)</th>
                <th className="tax-adj-m30-table__header">Rate</th>
                <th className="tax-adj-m30-table__header">Tax Amount (SEK)</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m30-table__body">
              {pensionBasis > 0 ? (
                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    Särskild löneskatt
                  </td>
                  <td className="tax-adj-m30-table__cell">1.4</td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(pensionBasis)}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {LONESKATT_RATE_DISPLAY}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(loneskattAmount)}
                  </td>
                </tr>
              ) : null}

              {yieldComponents.map((component) => (
                <tr key={component.ink2Code} className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    {component.label}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {component.ink2Code}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(component.basis)}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatPercent(component.rate)}
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(component.amount)}
                  </td>
                </tr>
              ))}

              {riskskatBasis > 0 ? (
                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">Riskskatt</td>
                  <td className="tax-adj-m30-table__cell">1.3</td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(riskskatBasis)}
                  </td>
                  <td className="tax-adj-m30-table__cell">—</td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(riskskatAmount)}
                  </td>
                </tr>
              ) : null}

              {propertyTaxTotalBasis > 0 ? (
                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    Fastighetsskatt / -avgift
                  </td>
                  <td className="tax-adj-m30-table__cell">1.8—1.15</td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(propertyTaxTotalBasis)}
                  </td>
                  <td className="tax-adj-m30-table__cell">various</td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(propertyTaxTotal)}
                  </td>
                </tr>
              ) : null}

              {pensionBasis === 0 &&
              yieldComponents.length === 0 &&
              riskskatBasis === 0 &&
              propertyTaxTotalBasis === 0 ? (
                <tr className="tax-adj-m30-table__row">
                  <td colSpan={5} className="tax-adj-m30-table__cell">
                    <em>No supplementary tax bases identified.</em>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </CardV1>

      {/* Section 3: Total Tax Summary */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--total-summary">
        <div className="tax-adj-m30-section__header">
          <h2>Total Tax Summary</h2>
          <p className="tax-adj-m30-section__subtitle">
            Aggregated tax charge across all components.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={120} />
        ) : (
          <div className="tax-adj-m30-summary">
            <table className="tax-adj-m30-summary-table">
              <tbody className="tax-adj-m30-summary-table__body">
                <tr className="tax-adj-m30-summary-row">
                  <td className="tax-adj-m30-summary-label">
                    Corporate income tax
                  </td>
                  <td className="tax-adj-m30-summary-amount">
                    {formatNumber(corporateIncomeTax)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-summary-row">
                  <td className="tax-adj-m30-summary-label">
                    Supplementary taxes
                  </td>
                  <td className="tax-adj-m30-summary-amount">
                    {formatNumber(supplementaryTaxTotal)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-summary-row tax-adj-m30-summary-row--total">
                  <td className="tax-adj-m30-summary-label">
                    <strong>Total tax charge</strong>
                  </td>
                  <td className="tax-adj-m30-summary-amount tax-adj-m30-summary-amount--highlighted">
                    <strong>{formatNumber(totalTaxCharge)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardV1>

      {/* Section 4: Effective Tax Rate */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--effective-rate">
        <div className="tax-adj-m30-section__header">
          <h2>Effective Tax Rate</h2>
          <p className="tax-adj-m30-section__subtitle">
            Calculated as total tax charge divided by profit before tax.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : profitBeforeTax > 0 ? (
          <div
            className={`tax-adj-m30-rate-display ${
              isEffectiveTaxRateHealthy
                ? "tax-adj-m30-rate-display--healthy"
                : "tax-adj-m30-rate-display--outside-range"
            }`}
          >
            <div className="tax-adj-m30-rate-display__value">
              {formatPercent(effectiveTaxRate)}
            </div>
            <div className="tax-adj-m30-rate-display__range">
              <small>
                {isEffectiveTaxRateHealthy
                  ? "Within healthy range (18%—23%)"
                  : "Outside healthy range (18%—23%)"}
              </small>
            </div>
            {!isEffectiveTaxRateHealthy ? (
              <div className="tax-adj-m30-alert tax-adj-m30-alert--warning">
                <span className="tax-adj-m30-alert__icon">⚠</span>
                <span className="tax-adj-m30-alert__text">
                  Effective tax rate deviates from expected range. Verify
                  calculation and tax base adjustments.
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="tax-adj-m30-empty-message">
            Profit before tax is not positive; effective tax rate not
            applicable.
          </p>
        )}
      </CardV1>

      {/* Section 5: Booked Tax Comparison */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--booked-comparison">
        <div className="tax-adj-m30-section__header">
          <h2>Booked Tax Expense Comparison</h2>
          <p className="tax-adj-m30-section__subtitle">
            Comparison of computed total tax to booked tax expense (IS accounts
            8800, 8810).
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={120} />
        ) : (
          <>
            <table className="tax-adj-m30-table">
              <thead className="tax-adj-m30-table__head">
                <tr>
                  <th className="tax-adj-m30-table__header">Item</th>
                  <th className="tax-adj-m30-table__header">Amount (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m30-table__body">
                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    Computed total tax charge
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(totalTaxCharge)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    Booked current tax (8800)
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(bookedCurrentTax)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    Booked deferred tax (8810)
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    {formatNumber(bookedDeferredTax)}
                  </td>
                </tr>

                <tr className="tax-adj-m30-table__row">
                  <td className="tax-adj-m30-table__cell">
                    <strong>Booked total tax</strong>
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    <strong>{formatNumber(bookedTotalTax)}</strong>
                  </td>
                </tr>

                <tr className="tax-adj-m30-table__row tax-adj-m30-table__row--variance">
                  <td className="tax-adj-m30-table__cell">
                    <strong>Variance (SEK)</strong>
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    <strong>{formatNumber(taxVariance)}</strong>
                  </td>
                </tr>

                <tr className="tax-adj-m30-table__row tax-adj-m30-table__row--variance">
                  <td className="tax-adj-m30-table__cell">
                    <strong>Variance (%)</strong>
                  </td>
                  <td className="tax-adj-m30-table__cell">
                    <strong>{formatPercent(taxVariancePercent)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {hasSignificantVariance ? (
              <div className="tax-adj-m30-alert tax-adj-m30-alert--warning">
                <span className="tax-adj-m30-alert__icon">⚠</span>
                <span className="tax-adj-m30-alert__text">
                  Variance exceeds 10% threshold ({formatPercent(taxVariancePercent)}). Investigate
                  deferred tax timing, valuation allowances, or prior-year
                  adjustments.
                </span>
              </div>
            ) : (
              <div className="tax-adj-m30-alert tax-adj-m30-alert--ok">
                <span className="tax-adj-m30-alert__icon">✓</span>
                <span className="tax-adj-m30-alert__text">
                  Variance is within acceptable tolerance.
                </span>
              </div>
            )}
          </>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m30-section tax-adj-m30-section--verification">
        <div className="tax-adj-m30-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m30-section__subtitle">
            Confirm each item before proceeding to INK2 export.
          </p>
        </div>

        <ul className="tax-adj-m30-checklist">
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              Effective tax rate is reasonable{" "}
              {profitBeforeTax > 0
                ? `(computed: ${formatPercent(effectiveTaxRate)})`
                : "(N/A — loss year)"}
            </span>
          </li>
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              Tax bases confirmed from upstream modules (pension 11, yield 8,
              property 15, interest 21)
            </span>
          </li>
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              Booked tax expense variance explained (current: {formatPercent(taxVariancePercent)})
            </span>
          </li>
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              New periodsiseringsfond allocation ({formatNumber(allocationAmount)} SEK) confirmed
            </span>
          </li>
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              INK2 codes 1.3—1.15 and 4.x fields ready for export
            </span>
          </li>
          <li className="tax-adj-m30-checklist__item">
            <span className="tax-adj-m30-checklist__marker">✓</span>
            <span>
              Sign-off ready for final PDF export
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
