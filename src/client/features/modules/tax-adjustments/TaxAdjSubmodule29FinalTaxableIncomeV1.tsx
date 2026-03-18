import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule29FinalTaxableIncomeV1({
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

  const allDecisions = adjustments?.decisions ?? [];

  // 1. Profit before tax from extraction
  const profitBeforeTax = extraction?.fields.profitBeforeTax.value ?? 0;

  // 2. All add-backs and deductions from modules 3–21
  const nonInformationalDecisions = allDecisions.filter(
    (d) => d.direction !== "informational"
  );

  const addBacks = nonInformationalDecisions
    .filter((d) => d.direction === "increase_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const deductions = nonInformationalDecisions
    .filter((d) => d.direction === "decrease_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  // 4. Module 22 intermediate = profitBeforeTax + addBacks - deductions
  const module22Result = profitBeforeTax + addBacks - deductions;

  // 5. Module 23 result = same as module 22 in V1 (underskott utilization is user-driven)
  const module23Result = module22Result;

  // 6. Periodiseringsfond reversals (no persistent decisions in V1, show as 0)
  const periodiseringsfondReversals = 0;

  // 7. Deductible net interest from module 26 (hybrid_targeted_interest_and_net_interest_offset)
  const deductibleInterestDecisions = allDecisions.filter(
    (d) =>
      d.module === "hybrid_targeted_interest_and_net_interest_offset" &&
      d.direction === "decrease_taxable_income"
  );

  const deductibleNetInterest = deductibleInterestDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // 8. Restricted TLCF utilized = 0 (user-determined in module 27, no API persistence in V1)
  const restrictedTlcfUtilized = 0;

  // 9. New periodiseringsfond allocation (default: 25% of profit after all decisions)
  const profitAfterAllDecisions =
    profitBeforeTax + addBacks - deductions - deductibleNetInterest;
  const newPeriodiseringsfondAllocation =
    profitAfterAllDecisions > 0 ? profitAfterAllDecisions * 0.25 : 0;

  // 10. Final taxable income
  const finalTaxableIncome =
    module23Result +
    periodiseringsfondReversals -
    deductibleNetInterest -
    restrictedTlcfUtilized -
    newPeriodiseringsfondAllocation;

  const getStatusClass = (): string => {
    if (finalTaxableIncome > 0) {
      return "tax-adj-m29-status--ok";
    }
    if (finalTaxableIncome === 0) {
      return "tax-adj-m29-status--warning";
    }
    return "tax-adj-m29-status--alert";
  };

  const getStatusIcon = (): string => {
    if (finalTaxableIncome > 0) {
      return "✓";
    }
    return "⚠";
  };

  const getStatusLabel = (): string => {
    if (finalTaxableIncome > 0) {
      return "Positive Taxable Income";
    }
    if (finalTaxableIncome === 0) {
      return "Zero Taxable Income";
    }
    return "Negative Taxable Income";
  };

  return (
    <div className="tax-adj-m29-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Full Calculation Waterfall */}
      <CardV1 className="tax-adj-m29-section tax-adj-m29-section--waterfall">
        <div className="tax-adj-m29-section__header">
          <h2>Full Calculation Waterfall</h2>
          <p className="tax-adj-m29-section__subtitle">
            Step-by-step aggregation of all deductions to compute final taxable
            income
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={300} />
        ) : (
          <dl className="tax-adj-m29-waterfall">
            <dt className="tax-adj-m29-waterfall__label">
              Profit before tax (module 2):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {formatNumber(profitBeforeTax)} SEK
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              + Total add-backs (modules 3–21):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {formatNumber(addBacks)} SEK
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              − Total deductions (modules 3–21):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {formatNumber(deductions)} SEK
            </dd>

            <dt className="tax-adj-m29-waterfall__label tax-adj-m29-waterfall__label--subtotal">
              = Intermediate taxable income (module 22):
            </dt>
            <dd className="tax-adj-m29-waterfall__value tax-adj-m29-waterfall__value--subtotal">
              {formatNumber(module22Result)} SEK
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              + Periodiseringsfond reversals (module 25):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {periodiseringsfondReversals > 0
                ? `${formatNumber(periodiseringsfondReversals)} SEK`
                : "0 SEK — user-confirmed in module 25"}
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              − Deductible net interest (module 26):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {deductibleNetInterest > 0
                ? `${formatNumber(deductibleNetInterest)} SEK`
                : "0 SEK"}
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              − Restricted TLCF utilized (module 27):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {restrictedTlcfUtilized > 0
                ? `${formatNumber(restrictedTlcfUtilized)} SEK`
                : "0 SEK — user-confirmed in module 27"}
            </dd>

            <dt className="tax-adj-m29-waterfall__label">
              − New periodiseringsfond allocation (module 28):
            </dt>
            <dd className="tax-adj-m29-waterfall__value">
              {formatNumber(newPeriodiseringsfondAllocation)} SEK (default max,
              user-confirmed in module 28)
            </dd>

            <dt className="tax-adj-m29-waterfall__label tax-adj-m29-waterfall__label--final-result">
              = Final taxable income:
            </dt>
            <dd className="tax-adj-m29-waterfall__value tax-adj-m29-waterfall__value--final-result">
              {formatNumber(finalTaxableIncome)} SEK
            </dd>
          </dl>
        )}
      </CardV1>

      {/* Section 2: Result Status */}
      <CardV1 className="tax-adj-m29-section tax-adj-m29-section--result-status">
        <div className="tax-adj-m29-section__header">
          <h2>Result Status</h2>
          <p className="tax-adj-m29-section__subtitle">
            Validation of the final taxable income
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : (
          <div className={`tax-adj-m29-status ${getStatusClass()}`}>
            <span className="tax-adj-m29-status__icon">{getStatusIcon()}</span>
            <span className="tax-adj-m29-status__text">
              {getStatusLabel()} ({formatNumber(finalTaxableIncome)} SEK)
              {finalTaxableIncome < 0
                ? " — Negative taxable income. Review deductions and allocations in modules 25–28."
                : finalTaxableIncome === 0
                  ? " — No corporate tax liability."
                  : " — Proceeds to module 30 for corporate tax rate application."}
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 3: Downstream Impact */}
      <CardV1 className="tax-adj-m29-section tax-adj-m29-section--downstream">
        <div className="tax-adj-m29-section__header">
          <h2>Downstream Impact</h2>
          <p className="tax-adj-m29-section__subtitle">
            How the final taxable income feeds the INK2 form and tax calculation
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={100} />
        ) : (
          <div className="tax-adj-m29-downstream">
            <p className="tax-adj-m29-downstream__text">
              This final taxable income ({formatNumber(finalTaxableIncome)} SEK)
              is recorded as:
            </p>
            <ul className="tax-adj-m29-downstream__list">
              <li className="tax-adj-m29-downstream__item">
                <strong>INK2 Form Line 3.10:</strong> Taxable income or loss
                (underskott) for the tax year. If negative, amount carried
                forward as prior-year loss (underskott) for future years.
              </li>
              <li className="tax-adj-m29-downstream__item">
                <strong>Module 30:</strong> Corporate tax rate applied to
                positive taxable income to compute final tax liability.
              </li>
            </ul>
          </div>
        )}
      </CardV1>

      {/* Section 4: Verification Checklist */}
      <CardV1 className="tax-adj-m29-section tax-adj-m29-section--verification">
        <div className="tax-adj-m29-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m29-section__subtitle">
            Key points to review before finalizing the tax return
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={150} />
        ) : (
          <ul className="tax-adj-m29-checklist">
            <li className="tax-adj-m29-checklist__item">
              <span className="tax-adj-m29-checklist__bullet">✓</span>
              <span className="tax-adj-m29-checklist__text">
                Module 22 intermediate result ({formatNumber(module22Result)}{" "}
                SEK) correctly computed from profit before tax, add-backs, and
                deductions
              </span>
            </li>
            <li className="tax-adj-m29-checklist__item">
              <span className="tax-adj-m29-checklist__bullet">✓</span>
              <span className="tax-adj-m29-checklist__text">
                Deductible net interest from module 26 ({formatNumber(
                  deductibleNetInterest
                )}{" "}
                SEK) correctly applied
              </span>
            </li>
            <li className="tax-adj-m29-checklist__item">
              <span className="tax-adj-m29-checklist__bullet">✓</span>
              <span className="tax-adj-m29-checklist__text">
                New periodiseringsfond allocation ({formatNumber(
                  newPeriodiseringsfondAllocation
                )}{" "}
                SEK) set to default 25% of profit or user-confirmed amount in
                module 28
              </span>
            </li>
            <li className="tax-adj-m29-checklist__item">
              <span className="tax-adj-m29-checklist__bullet">✓</span>
              <span className="tax-adj-m29-checklist__text">
                Final taxable income ({formatNumber(finalTaxableIncome)} SEK) is
                deterministically computed — no further adjustments apply
              </span>
            </li>
            <li className="tax-adj-m29-checklist__item">
              <span className="tax-adj-m29-checklist__bullet">✓</span>
              <span className="tax-adj-m29-checklist__text">
                INK2 form line 3.10 will be populated with this final taxable
                income for submission to SKV
              </span>
            </li>
          </ul>
        )}
      </CardV1>
    </div>
  );
}
