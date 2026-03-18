import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule26NetInterestDeductionV1({
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

  const interestLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("830") ||
      code.startsWith("831") ||
      code.startsWith("832") ||
      code.startsWith("833")
    );
  });

  const interestIncomeLines = interestLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("830") || code.startsWith("831");
  });

  const interestExpenseLines = interestLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("832") || code.startsWith("833");
  });

  const totalInterestIncome = interestIncomeLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0
  );

  const totalInterestExpense = interestExpenseLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0
  );

  const netInterestExpense = totalInterestExpense - totalInterestIncome;

  const allDecisions = adjustments?.decisions ?? [];

  const interestDecisions = allDecisions.filter(
    (decision) =>
      decision.module === "hybrid_targeted_interest_and_net_interest_offset"
  );

  const deductibleInterestDecisions = interestDecisions.filter(
    (d) => d.direction === "decrease_taxable_income"
  );

  const nonDeductibleAddBackDecisions = interestDecisions.filter(
    (d) => d.direction === "increase_taxable_income"
  );

  const deductibleInterestAmount = deductibleInterestDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  const nonDeductibleAmount = nonDeductibleAddBackDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  const nonInformationalDecisions = allDecisions.filter(
    (d) => d.direction !== "informational"
  );

  const addBacks = nonInformationalDecisions
    .filter((d) => d.direction === "increase_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const deductions = nonInformationalDecisions
    .filter((d) => d.direction === "decrease_taxable_income")
    .reduce((sum, d) => sum + d.amount, 0);

  const profitBeforeTax = extraction?.fields.profitBeforeTax.value ?? 0;
  const module22Result = profitBeforeTax + addBacks - deductions;

  const taxableIncomeAfterModule26 = module22Result - deductibleInterestAmount;

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

  const getInterestPositionBadgeClass = (): string => {
    if (netInterestExpense > 0) {
      return "tax-adj-m26-badge--expense";
    }
    if (netInterestExpense < 0) {
      return "tax-adj-m26-badge--income";
    }
    return "tax-adj-m26-badge--neutral";
  };

  const getInterestPositionLabel = (): string => {
    if (netInterestExpense > 0) {
      return "Net Interest Expense";
    }
    if (netInterestExpense < 0) {
      return "Net Interest Income";
    }
    return "No Net Interest";
  };

  return (
    <div className="tax-adj-m26-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <>
          <SkeletonV1 height={200} />
          <SkeletonV1 height={200} />
        </>
      ) : (
        <>
          {/* Section 1: Net Interest Position */}
          <CardV1 className="tax-adj-m26-section tax-adj-m26-section--position">
            <div className="tax-adj-m26-section__header">
              <h2>Net Interest Position</h2>
              <p className="tax-adj-m26-section__subtitle">
                Interest income and expense from the annual report (accounts
                830x, 831x, 832x, 833x)
              </p>
            </div>

            <div className="tax-adj-m26-position-summary">
              <div className="tax-adj-m26-position-row">
                <span className="tax-adj-m26-position-label">
                  Total Interest Income:
                </span>
                <span className="tax-adj-m26-position-value">
                  {formatNumber(totalInterestIncome)} SEK
                </span>
              </div>
              <div className="tax-adj-m26-position-row">
                <span className="tax-adj-m26-position-label">
                  Total Interest Expense:
                </span>
                <span className="tax-adj-m26-position-value">
                  {formatNumber(totalInterestExpense)} SEK
                </span>
              </div>
              <div className="tax-adj-m26-position-row tax-adj-m26-position-row--net">
                <span className="tax-adj-m26-position-label">Net Position:</span>
                <div className="tax-adj-m26-position-value-with-badge">
                  <span className="tax-adj-m26-position-value">
                    {formatNumber(netInterestExpense)} SEK
                  </span>
                  <span
                    className={`tax-adj-m26-badge ${getInterestPositionBadgeClass()}`}
                  >
                    {getInterestPositionLabel()}
                  </span>
                </div>
              </div>
            </div>
          </CardV1>

          {/* Section 2: Interest Limitation Summary */}
          <CardV1 className="tax-adj-m26-section tax-adj-m26-section--limitation">
            <div className="tax-adj-m26-section__header">
              <h2>Interest Limitation Summary</h2>
              <p className="tax-adj-m26-section__subtitle">
                Deductible and non-deductible interest amounts from module 21
                (hybrid targeted interest and net interest offset rules)
              </p>
            </div>

            {interestDecisions.length === 0 ? (
              <p className="tax-adj-m26-empty-state">
                No interest limitation decisions from module 21.
              </p>
            ) : (
              <div className="tax-adj-m26-limitation-table">
                <table className="tax-adj-m26-table">
                  <thead className="tax-adj-m26-table__head">
                    <tr>
                      <th className="tax-adj-m26-table__header">Description</th>
                      <th className="tax-adj-m26-table__header">Amount (SEK)</th>
                      <th className="tax-adj-m26-table__header">Type</th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m26-table__body">
                    {deductibleInterestDecisions.length > 0 && (
                      <tr className="tax-adj-m26-table__row tax-adj-m26-table__row--deductible">
                        <td className="tax-adj-m26-table__cell">
                          Deductible net interest (this module)
                        </td>
                        <td className="tax-adj-m26-table__cell tax-adj-m26-table__cell--amount">
                          {formatNumber(deductibleInterestAmount)}
                        </td>
                        <td className="tax-adj-m26-table__cell">
                          <span className="tax-adj-m26-type-badge tax-adj-m26-type-badge--deduction">
                            Deduction
                          </span>
                        </td>
                      </tr>
                    )}
                    {nonDeductibleAddBackDecisions.length > 0 && (
                      <tr className="tax-adj-m26-table__row tax-adj-m26-table__row--non-deductible">
                        <td className="tax-adj-m26-table__cell">
                          Non-deductible interest excess (already added back in
                          module 21)
                        </td>
                        <td className="tax-adj-m26-table__cell tax-adj-m26-table__cell--amount">
                          {formatNumber(nonDeductibleAmount)}
                        </td>
                        <td className="tax-adj-m26-table__cell">
                          <span className="tax-adj-m26-type-badge tax-adj-m26-type-badge--addback">
                            Add-back
                          </span>
                        </td>
                      </tr>
                    )}
                    {interestDecisions.length > 0 && (
                      <tr className="tax-adj-m26-table__row tax-adj-m26-table__row--total">
                        <td className="tax-adj-m26-table__cell">
                          <strong>Net Interest Impact</strong>
                        </td>
                        <td className="tax-adj-m26-table__cell tax-adj-m26-table__cell--amount">
                          <strong>
                            {formatNumber(
                              deductibleInterestAmount - nonDeductibleAmount
                            )}
                          </strong>
                        </td>
                        <td className="tax-adj-m26-table__cell"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardV1>

          {/* Section 3: Calculation Waterfall */}
          <CardV1 className="tax-adj-m26-section tax-adj-m26-section--waterfall">
            <div className="tax-adj-m26-section__header">
              <h2>Calculation Waterfall</h2>
              <p className="tax-adj-m26-section__subtitle">
                Step-by-step calculation through module 26
              </p>
            </div>

            <dl className="tax-adj-m26-waterfall">
              <dt className="tax-adj-m26-waterfall__label">
                Taxable income from modules 22–23:
              </dt>
              <dd className="tax-adj-m26-waterfall__value">
                {formatNumber(module22Result)} SEK
              </dd>

              <dt className="tax-adj-m26-waterfall__label">
                − Deductible net interest (module 21, IL 24:21–29):
              </dt>
              <dd className="tax-adj-m26-waterfall__value">
                {deductibleInterestAmount > 0
                  ? `${formatNumber(deductibleInterestAmount)} SEK`
                  : "0 SEK"}
              </dd>

              <dt className="tax-adj-m26-waterfall__label tax-adj-m26-waterfall__label--result">
                = Taxable income after module 26 (IL 24:21–29):
              </dt>
              <dd className="tax-adj-m26-waterfall__value tax-adj-m26-waterfall__value--result">
                {formatNumber(taxableIncomeAfterModule26)} SEK
              </dd>
            </dl>
          </CardV1>

          {/* Section 4: IL 24:21–29 Reference */}
          <CardV1 className="tax-adj-m26-section tax-adj-m26-section--reference">
            <div className="tax-adj-m26-section__header">
              <h2>IL 24:21–29 – Interest Deduction Limitation</h2>
            </div>

            <div className="tax-adj-m26-reference-content">
              <p>
                Module 26 applies the deductible net interest computed under
                the general interest deduction limitation rule (IL 24:21–29).
              </p>

              <h3 className="tax-adj-m26-reference-subheading">Two-Layer System</h3>
              <ul className="tax-adj-m26-reference-list">
                <li>
                  <strong>Module 21 (Targeted Rules):</strong> Applies rule-specific
                  interest limitation requirements (e.g., substance-over-form,
                  transfer pricing for related-party loans, anti-avoidance).
                  Computes the deductible net interest portion (≤30% EBITDA
                  ceiling) and adds back non-deductible excess.
                </li>
                <li>
                  <strong>Module 26 (This Module):</strong> Applies the deductible
                  net interest amount at the correct point in the tax
                  calculation chain, reducing taxable income. The
                  non-deductible excess was already added back in module 21.
                </li>
              </ul>

              <h3 className="tax-adj-m26-reference-subheading">Scope</h3>
              <p>
                Applies to all net interest expense not permitted under the
                general deduction limitation, regardless of whether the
                interest-bearing debt is domestic or cross-border.
              </p>
            </div>
          </CardV1>

          {/* Section 5: Verification Checklist */}
          <CardV1 className="tax-adj-m26-section tax-adj-m26-section--checklist">
            <div className="tax-adj-m26-section__header">
              <h2>Verification Checklist</h2>
              <p className="tax-adj-m26-section__subtitle">
                Key points to review before finalizing module 26
              </p>
            </div>

            <ul className="tax-adj-m26-checklist">
              <li className="tax-adj-m26-checklist__item">
                <span className="tax-adj-m26-checklist__bullet">✓</span>
                <span className="tax-adj-m26-checklist__text">
                  Interest income and expense accounts (830x–833x) correctly
                  extracted from annual report
                </span>
              </li>
              <li className="tax-adj-m26-checklist__item">
                <span className="tax-adj-m26-checklist__bullet">✓</span>
                <span className="tax-adj-m26-checklist__text">
                  Net interest position in module 21 calculations reflects
                  interest limitation rules (targeted rules + 30% EBITDA)
                </span>
              </li>
              <li className="tax-adj-m26-checklist__item">
                <span className="tax-adj-m26-checklist__bullet">✓</span>
                <span className="tax-adj-m26-checklist__text">
                  Deductible net interest amount from module 21 correctly
                  reduces taxable income in module 26
                </span>
              </li>
              <li className="tax-adj-m26-checklist__item">
                <span className="tax-adj-m26-checklist__bullet">✓</span>
                <span className="tax-adj-m26-checklist__text">
                  No deductions or add-backs from module 26 itself; module acts
                  as a pass-through deterministic application point
                </span>
              </li>
            </ul>
          </CardV1>
        </>
      )}
    </div>
  );
}
