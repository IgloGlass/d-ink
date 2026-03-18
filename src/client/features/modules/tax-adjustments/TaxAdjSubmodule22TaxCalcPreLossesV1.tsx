import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const MODULE_ORDER = [
  "general_client_info",
  "trial_balance_to_local_gaap",
  "provisions",
  "buildings",
  "capital_assets",
  "cfc",
  "non_taxable_income",
  "yield_tax",
  "group_contributions",
  "disallowed_expenses",
  "pension_costs",
  "depreciation",
  "shares_participations",
  "partnership_n3b",
  "property_tax",
  "warranty_provision",
  "schablonitakt",
  "inkuransresy",
  "shares_average_method",
  "items_not_in_books",
  "interest_limitation",
];

const MODULE_LABELS: Record<string, string> = {
  general_client_info: "Module 1 - General Client Info",
  trial_balance_to_local_gaap: "Module 2 - Trial Balance to Local GAAP",
  provisions: "Module 3 - Provisions",
  buildings: "Module 4 - Buildings",
  capital_assets: "Module 5 - Capital Assets",
  cfc: "Module 6 - CFC",
  non_taxable_income: "Module 7 - Non-taxable Income",
  yield_tax: "Module 8 - Yield Tax",
  group_contributions: "Module 9 - Group Contributions",
  disallowed_expenses: "Module 10 - Disallowed Expenses",
  pension_costs: "Module 11 - Pension Costs",
  depreciation: "Module 12 - Depreciation",
  shares_participations: "Module 13 - Shares & Participations",
  partnership_n3b: "Module 14 - Partnership N3b",
  property_tax: "Module 15 - Property Tax",
  warranty_provision: "Module 16 - Warranty Provision",
  schablonitakt: "Module 17 - Schablonitakt",
  inkuransresy: "Module 18 - Inkuransreserv",
  shares_average_method: "Module 19 - Shares Average Method",
  items_not_in_books: "Module 20 - Items Not in Books",
  interest_limitation: "Module 21 - Interest Limitation",
};

interface AdjustmentRow {
  module: string;
  moduleLabel: string;
  direction: "increase_taxable_income" | "decrease_taxable_income";
  amount: number;
}

export function TaxAdjSubmodule22TaxCalcPreLossesV1({
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

  const profitBeforeTax = extraction?.fields.profitBeforeTax.value ?? undefined;

  const allDecisions = adjustments?.decisions ?? [];
  const nonInformationalDecisions = allDecisions.filter(
    (d) => d.direction !== "informational"
  );

  const addBackDecisions = nonInformationalDecisions.filter(
    (d) => d.direction === "increase_taxable_income"
  );
  const deductionDecisions = nonInformationalDecisions.filter(
    (d) => d.direction === "decrease_taxable_income"
  );

  const totalAddBacks = addBackDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );
  const totalDeductions = deductionDecisions.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  const profitBeforeTaxNum = profitBeforeTax ?? 0;
  const taxableIncomePreLosses =
    profitBeforeTaxNum + totalAddBacks - totalDeductions;

  const adjustmentRows: AdjustmentRow[] = [];
  for (const moduleKey of MODULE_ORDER) {
    const moduleDecisions = nonInformationalDecisions.filter(
      (d) => d.module === moduleKey
    );
    for (const decision of moduleDecisions) {
      adjustmentRows.push({
        module: moduleKey,
        moduleLabel: MODULE_LABELS[moduleKey] || moduleKey,
        direction: decision.direction as "increase_taxable_income" | "decrease_taxable_income",
        amount: decision.amount,
      });
    }
  }

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
    direction: "increase_taxable_income" | "decrease_taxable_income"
  ): string => {
    switch (direction) {
      case "increase_taxable_income":
        return "Add-back";
      case "decrease_taxable_income":
        return "Deduction";
      default:
        return direction;
    }
  };

  return (
    <div className="tax-adj-m22-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m22-section tax-adj-m22-section--adjustments-summary">
        <div className="tax-adj-m22-section__header">
          <h2>Adjustments Summary</h2>
          <p className="tax-adj-m22-section__subtitle">
            All add-back and deduction decisions from modules 1–21, grouped by
            source module.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m22-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : adjustmentRows.length > 0 ? (
          <>
            <div className="tax-adj-m22-adjustments-table">
              <table className="tax-adj-m22-table">
                <thead className="tax-adj-m22-table__head">
                  <tr>
                    <th className="tax-adj-m22-table__header">Module</th>
                    <th className="tax-adj-m22-table__header">Type</th>
                    <th className="tax-adj-m22-table__header">Amount (SEK)</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m22-table__body">
                  {adjustmentRows.map((row, index) => (
                    <tr key={index} className="tax-adj-m22-table__row">
                      <td className="tax-adj-m22-table__cell">
                        {row.moduleLabel}
                      </td>
                      <td className="tax-adj-m22-table__cell">
                        {getDirectionLabel(row.direction)}
                      </td>
                      <td className="tax-adj-m22-table__cell tax-adj-m22-table__cell--amount">
                        {formatNumber(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tax-adj-m22-adjustments-summary-rows">
              <div className="tax-adj-m22-summary-row">
                <span className="tax-adj-m22-summary-label">
                  Total add-backs:
                </span>
                <span className="tax-adj-m22-summary-value">
                  {formatNumber(totalAddBacks)} SEK
                </span>
              </div>
              <div className="tax-adj-m22-summary-row">
                <span className="tax-adj-m22-summary-label">
                  Total deductions:
                </span>
                <span className="tax-adj-m22-summary-value">
                  {formatNumber(totalDeductions)} SEK
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="tax-adj-m22-empty-message">
            No adjustment decisions yet. Complete modules 1–21 to see
            adjustments here.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m22-section tax-adj-m22-section--calculation">
        <div className="tax-adj-m22-section__header">
          <h2>Intermediate Tax Calculation</h2>
          <p className="tax-adj-m22-section__subtitle">
            Calculation waterfall showing profit before tax and all adjustments.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m22-loading-grid">
            <SkeletonV1 height={80} />
          </div>
        ) : (
          <dl className="tax-adj-m22-calculation-waterfall">
            <div className="tax-adj-m22-waterfall-row">
              <dt className="tax-adj-m22-waterfall-label">
                Profit before tax:
              </dt>
              <dd className="tax-adj-m22-waterfall-value">
                {profitBeforeTax !== undefined
                  ? formatNumber(profitBeforeTax)
                  : "Not yet available — confirm the annual report extraction"}
              </dd>
            </div>

            {profitBeforeTax !== undefined && (
              <>
                <div className="tax-adj-m22-waterfall-row">
                  <dt className="tax-adj-m22-waterfall-label">
                    + Total add-backs:
                  </dt>
                  <dd className="tax-adj-m22-waterfall-value">
                    {formatNumber(totalAddBacks)}
                  </dd>
                </div>

                <div className="tax-adj-m22-waterfall-row">
                  <dt className="tax-adj-m22-waterfall-label">
                    − Total deductions:
                  </dt>
                  <dd className="tax-adj-m22-waterfall-value">
                    {formatNumber(totalDeductions)}
                  </dd>
                </div>

                <div className="tax-adj-m22-waterfall-row tax-adj-m22-waterfall-row--total">
                  <dt className="tax-adj-m22-waterfall-label tax-adj-m22-waterfall-label--total">
                    = Intermediate taxable income:
                  </dt>
                  <dd className="tax-adj-m22-waterfall-value tax-adj-m22-waterfall-value--total">
                    {formatNumber(taxableIncomePreLosses)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m22-section tax-adj-m22-section--status">
        <div className="tax-adj-m22-section__header">
          <h2>Status</h2>
          <p className="tax-adj-m22-section__subtitle">
            Validation of intermediate taxable income.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : profitBeforeTax === undefined ? (
          <div
            className="tax-adj-m22-status tax-adj-m22-status--warning"
            role="alert"
          >
            <span className="tax-adj-m22-status__icon">⚠</span>
            <span className="tax-adj-m22-status__text">
              Annual report extraction not yet available — upload and confirm
              the annual report to proceed.
            </span>
          </div>
        ) : taxableIncomePreLosses < 0 ? (
          <div
            className="tax-adj-m22-status tax-adj-m22-status--warning"
            role="alert"
          >
            <span className="tax-adj-m22-status__icon">⚠</span>
            <span className="tax-adj-m22-status__text">
              Intermediate taxable income is negative ({formatNumber(
                taxableIncomePreLosses
              )}{" "}
              SEK) — review adjustments before proceeding.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m22-status tax-adj-m22-status--ok">
            <span className="tax-adj-m22-status__icon">✓</span>
            <span className="tax-adj-m22-status__text">
              Intermediate taxable income: {formatNumber(taxableIncomePreLosses)}{" "}
              SEK
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m22-section tax-adj-m22-section--downstream-note">
        <div className="tax-adj-m22-section__header">
          <h2>Downstream Modules</h2>
        </div>

        <p className="tax-adj-m22-note-text">
          This intermediate result feeds module 23. Prior-year tax losses
          (module 24) and net interest deductions (module 21) are applied in
          module 23.
        </p>
      </CardV1>
    </div>
  );
}
