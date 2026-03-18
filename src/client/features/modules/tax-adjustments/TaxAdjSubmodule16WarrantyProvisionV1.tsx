import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule16WarrantyProvisionV1({
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

  const balanceSheetLines =
    extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];
  const incomeStatementLines =
    extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];

  const warrantyBalanceSheetAccounts = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("222");
  });

  const warrantyIncomeStatementAccounts = incomeStatementLines.filter(
    (line) => {
      const code = line.code ?? "";
      return code.startsWith("636");
    },
  );

  const warrantyDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "warranty_provision",
  );

  const addBackDecisions = warrantyDecisions.filter(
    (decision) => decision.direction === "increase_taxable_income",
  );

  const deductionDecisions = warrantyDecisions.filter(
    (decision) => decision.direction === "decrease_taxable_income",
  );

  const addBackAmount = addBackDecisions.reduce(
    (sum, decision) => sum + decision.amount,
    0,
  );

  const deductionAmount = deductionDecisions.reduce(
    (sum, decision) => sum + decision.amount,
    0,
  );

  const unreviewed = warrantyDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  const utredningsregelFlag = warrantyDecisions.some((decision) =>
    decision.rationale
      .toLowerCase()
      .includes("utredningsregeln"),
  );

  // Extract formula data from rationale text. The AI embeds structured
  // information in the rationale field; we surface what we can find across
  // all warranty_provision decisions.
  const firstAddBack = addBackDecisions[0];
  const firstDeduction = deductionDecisions[0];

  // Resolve account amounts from balance sheet / income statement lines.
  const account222000 = warrantyBalanceSheetAccounts.find(
    (line) => line.code === "222000",
  );
  const account636100 = warrantyIncomeStatementAccounts.find(
    (line) => line.code === "636100",
  );
  const account636200 = warrantyIncomeStatementAccounts.find(
    (line) => line.code === "636200",
  );

  const bookedProvision = account222000?.currentYearValue;
  const actualWarrantyCosts = account636200?.currentYearValue;
  const provisionMovement = account636100?.currentYearValue;

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

  return (
    <div className="tax-adj-m16-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Warranty Provision Accounts */}
      <CardV1 className="tax-adj-m16-section tax-adj-m16-section--accounts">
        <div className="tax-adj-m16-section__header">
          <h2>Warranty Provision Accounts</h2>
          <p className="tax-adj-m16-section__subtitle">
            Balance sheet accounts (222x — garantiavsättning) and income
            statement accounts (636x — change in warranty provision and actual
            warranty costs).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m16-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : warrantyBalanceSheetAccounts.length > 0 ||
          warrantyIncomeStatementAccounts.length > 0 ? (
          <>
            {warrantyBalanceSheetAccounts.length > 0 ? (
              <div className="tax-adj-m16-accounts-table">
                <h3 className="tax-adj-m16-accounts-table__title">
                  Balance Sheet (222x)
                </h3>
                <table className="tax-adj-m16-table">
                  <thead className="tax-adj-m16-table__head">
                    <tr>
                      <th className="tax-adj-m16-table__header">Code</th>
                      <th className="tax-adj-m16-table__header">Label</th>
                      <th className="tax-adj-m16-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m16-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m16-table__body">
                    {warrantyBalanceSheetAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m16-table__row">
                        <td className="tax-adj-m16-table__cell">{line.code}</td>
                        <td className="tax-adj-m16-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m16-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m16-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {warrantyIncomeStatementAccounts.length > 0 ? (
              <div className="tax-adj-m16-accounts-table">
                <h3 className="tax-adj-m16-accounts-table__title">
                  Income Statement (636x)
                </h3>
                <table className="tax-adj-m16-table">
                  <thead className="tax-adj-m16-table__head">
                    <tr>
                      <th className="tax-adj-m16-table__header">Code</th>
                      <th className="tax-adj-m16-table__header">Label</th>
                      <th className="tax-adj-m16-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m16-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m16-table__body">
                    {warrantyIncomeStatementAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m16-table__row">
                        <td className="tax-adj-m16-table__cell">{line.code}</td>
                        <td className="tax-adj-m16-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m16-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m16-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <p className="tax-adj-m16-empty-message">
            No warranty provision accounts found in balance sheet or income
            statement.
          </p>
        )}
      </CardV1>

      {/* Section 2: AI Warranty Analysis */}
      <CardV1 className="tax-adj-m16-section tax-adj-m16-section--ai-analysis">
        <div className="tax-adj-m16-section__header">
          <h2>AI Warranty Analysis</h2>
          <p className="tax-adj-m16-section__subtitle">
            Schablonregel formula analysis (IL 16:4): maximum deductible =
            (warranty months / 24) × actual warranty costs. Excess provision
            above ceiling → add-back at INK2 4.3c. Prior year reversal →
            deduction at INK2 4.5c.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m16-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : warrantyDecisions.length > 0 ? (
          <>
            <div className="tax-adj-m16-decisions-table">
              <table className="tax-adj-m16-table">
                <thead className="tax-adj-m16-table__head">
                  <tr>
                    <th className="tax-adj-m16-table__header">Amount (SEK)</th>
                    <th className="tax-adj-m16-table__header">Direction</th>
                    <th className="tax-adj-m16-table__header">Target</th>
                    <th className="tax-adj-m16-table__header">Rationale</th>
                    <th className="tax-adj-m16-table__header">Status</th>
                    <th className="tax-adj-m16-table__header">Review</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m16-table__body">
                  {warrantyDecisions.map((decision) => (
                    <tr key={decision.id} className="tax-adj-m16-table__row">
                      <td className="tax-adj-m16-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m16-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m16-table__cell">
                        {decision.targetField}
                      </td>
                      <td className="tax-adj-m16-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m16-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m16-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m16-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m16-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {utredningsregelFlag ? (
              <div className="tax-adj-m16-utredningsregel-flag">
                <span className="tax-adj-m16-utredningsregel-flag__icon">
                  ⚠
                </span>
                <span className="tax-adj-m16-utredningsregel-flag__text">
                  Utredningsregeln (IL 16:5) appears applicable. Higher
                  deduction may be available — documented justification
                  required.
                </span>
              </div>
            ) : null}

            <div className="tax-adj-m16-decisions-summary">
              {firstAddBack ? (
                <div className="tax-adj-m16-summary-row">
                  <span className="tax-adj-m16-summary-label">
                    Total add-back at INK2 4.3c:
                  </span>
                  <span className="tax-adj-m16-summary-value">
                    {formatNumber(addBackAmount)} SEK
                  </span>
                </div>
              ) : null}
              {firstDeduction ? (
                <div className="tax-adj-m16-summary-row">
                  <span className="tax-adj-m16-summary-label">
                    Prior year reversal deduction at INK2 4.5c:
                  </span>
                  <span className="tax-adj-m16-summary-value">
                    {formatNumber(deductionAmount)} SEK
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="tax-adj-m16-empty-message">
            No adjustment decisions for warranty provision module.
          </p>
        )}
      </CardV1>

      {/* Section 3: Formula Summary Card */}
      <CardV1 className="tax-adj-m16-section tax-adj-m16-section--formula-summary">
        <div className="tax-adj-m16-section__header">
          <h2>Schablonregel Formula Summary</h2>
          <p className="tax-adj-m16-section__subtitle">
            IL 16:4 — maximum deductible warranty provision.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m16-loading-grid">
            <SkeletonV1 height={200} />
          </div>
        ) : (
          <dl className="tax-adj-m16-formula-list">
            <div className="tax-adj-m16-formula-list__row">
              <dt className="tax-adj-m16-formula-list__term">
                Actual warranty costs (636200)
              </dt>
              <dd className="tax-adj-m16-formula-list__value">
                {formatNumber(actualWarrantyCosts)} SEK
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__row">
              <dt className="tax-adj-m16-formula-list__term">
                Provision movement — change in warranty provision (636100)
              </dt>
              <dd className="tax-adj-m16-formula-list__value">
                {formatNumber(provisionMovement)} SEK
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__row">
              <dt className="tax-adj-m16-formula-list__term">
                Booked provision — garantiavsättning (222000)
              </dt>
              <dd className="tax-adj-m16-formula-list__value">
                {formatNumber(bookedProvision)} SEK
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__divider" />

            <div className="tax-adj-m16-formula-list__row tax-adj-m16-formula-list__row--highlight">
              <dt className="tax-adj-m16-formula-list__term">
                Excess non-deductible (add-back at INK2 4.3c)
              </dt>
              <dd className="tax-adj-m16-formula-list__value tax-adj-m16-formula-list__value--addback">
                {addBackAmount > 0 ? formatNumber(addBackAmount) : "-"} SEK
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__row tax-adj-m16-formula-list__row--highlight">
              <dt className="tax-adj-m16-formula-list__term">
                Prior year reversal (deduction at INK2 4.5c)
              </dt>
              <dd className="tax-adj-m16-formula-list__value tax-adj-m16-formula-list__value--deduction">
                {deductionAmount > 0 ? formatNumber(deductionAmount) : "-"} SEK
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__row tax-adj-m16-formula-list__row--formula">
              <dt className="tax-adj-m16-formula-list__term">
                Formula applied (schablonregeln)
              </dt>
              <dd className="tax-adj-m16-formula-list__value">
                max deductible = (warranty months / 24) × actual warranty costs
                (636200)
              </dd>
            </div>

            <div className="tax-adj-m16-formula-list__row">
              <dt className="tax-adj-m16-formula-list__term">
                Utredningsregeln (IL 16:5) applicable
              </dt>
              <dd className="tax-adj-m16-formula-list__value">
                {utredningsregelFlag ? "Yes — review required" : "No"}
              </dd>
            </div>
          </dl>
        )}
      </CardV1>

      {/* Section 4: Review Status */}
      <CardV1 className="tax-adj-m16-section tax-adj-m16-section--review-status">
        <div className="tax-adj-m16-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m16-section__subtitle">
            Unresolved warranty provision adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m16-status tax-adj-m16-status--warning">
            <span className="tax-adj-m16-status__icon">⚠</span>
            <span className="tax-adj-m16-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m16-status tax-adj-m16-status--ok">
            <span className="tax-adj-m16-status__icon">✓</span>
            <span className="tax-adj-m16-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 5: Verification Checklist */}
      <CardV1 className="tax-adj-m16-section tax-adj-m16-section--verification">
        <div className="tax-adj-m16-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m16-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m16-checklist">
          <li className="tax-adj-m16-checklist__item">
            <span className="tax-adj-m16-checklist__marker">✓</span>
            <span>
              Warranty period(s) extracted from annual report are correct
            </span>
          </li>
          <li className="tax-adj-m16-checklist__item">
            <span className="tax-adj-m16-checklist__marker">✓</span>
            <span>
              Actual warranty costs (636200) are correctly separated from
              provision movements (636100)
            </span>
          </li>
          <li className="tax-adj-m16-checklist__item">
            <span className="tax-adj-m16-checklist__marker">✓</span>
            <span>
              The schablonregel formula is correctly applied: (warranty months /
              24) × actual costs
            </span>
          </li>
          <li className="tax-adj-m16-checklist__item">
            <span className="tax-adj-m16-checklist__marker">✓</span>
            <span>
              Prior year&apos;s disallowed excess is correctly identified and
              reversed at INK2 4.5c
            </span>
          </li>
          <li className="tax-adj-m16-checklist__item">
            <span className="tax-adj-m16-checklist__marker">✓</span>
            <span>
              Utredningsregeln special circumstances considered and documented
              if applicable
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
