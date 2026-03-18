import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveMappingDecisionsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule02TrialBalanceToLocalGaapV1({
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

  const mappingQuery = useQuery({
    queryKey: ["active-mapping-decisions", tenantId, workspaceId],
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId,
        workspaceId,
      }),
  });

  const extraction = extractionQuery.data?.extraction;
  const mappingDecisions = mappingQuery.data?.mapping;

  const profitBeforeTax = extraction?.fields.profitBeforeTax.value;
  const taxExpenseContext = extraction?.taxDeep?.taxExpenseContext;
  const incomeStatement = extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];
  const cfcRiskFlag =
    extraction?.taxDeep?.foreignSubsidiariesContext?.cfcRiskFlag ?? false;

  const errorMessage =
    extractionQuery.isError || mappingQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : mappingQuery.error
          ? toUserFacingErrorMessage(mappingQuery.error)
          : "An unknown error occurred"
      : null;

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return new Intl.NumberFormat("sv-SE").format(value);
  };

  const getTaxCategoryName = (code: string): string => {
    const categoryMap: Record<string, string> = {
      "891000": "Skattekostnad (Tax expense)",
      "940000": "Årets resultat (Year result)",
    };
    return categoryMap[code] ?? code;
  };

  const relevantMappingDecisions =
    mappingDecisions && "decisions" in mappingDecisions
      ? mappingDecisions.decisions.filter(
          (decision) =>
            decision.selectedCategory.code === "891000" ||
            decision.selectedCategory.code === "940000",
        )
      : [];

  const hasReconciliationIssue =
    cfcRiskFlag ||
    (taxExpenseContext?.notes && taxExpenseContext.notes.length > 0);

  const isLoading = extractionQuery.isPending || mappingQuery.isPending;

  return (
    <div className="tax-adj-m02-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--income-statement">
        <div className="tax-adj-m02-section__header">
          <h2>Annual Report Income Statement</h2>
          <p className="tax-adj-m02-section__subtitle">
            Reference data from the extracted annual report.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m02-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : incomeStatement.length > 0 ? (
          <div className="tax-adj-m02-income-statement-table">
            <table className="tax-adj-m02-table">
              <thead className="tax-adj-m02-table__head">
                <tr>
                  <th className="tax-adj-m02-table__header">Code</th>
                  <th className="tax-adj-m02-table__header">Label</th>
                  <th className="tax-adj-m02-table__header">Current Year (SEK)</th>
                  <th className="tax-adj-m02-table__header">Prior Year (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m02-table__body">
                {incomeStatement.map((line) => (
                  <tr key={line.code} className="tax-adj-m02-table__row">
                    <td className="tax-adj-m02-table__cell">{line.code}</td>
                    <td className="tax-adj-m02-table__cell">{line.label}</td>
                    <td className="tax-adj-m02-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m02-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m02-empty-message">
            No income statement data available.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--reconciliation">
        <div className="tax-adj-m02-section__header">
          <h2>Profit Before Tax Reconciliation</h2>
          <p className="tax-adj-m02-section__subtitle">
            Starting point for IL 14:2 tax calculation.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m02-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <div className="tax-adj-m02-reconciliation-grid">
            <div className="tax-adj-m02-reconciliation-row">
              <span className="tax-adj-m02-reconciliation-label">
                Årets resultat (account 940000)
              </span>
              <span className="tax-adj-m02-reconciliation-value">
                {profitBeforeTax !== undefined &&
                taxExpenseContext?.totalTaxExpense?.value !== undefined
                  ? formatNumber(
                      profitBeforeTax - taxExpenseContext.totalTaxExpense.value,
                    )
                  : "-"}
              </span>
            </div>

            {taxExpenseContext?.totalTaxExpense?.value !== undefined ? (
              <div className="tax-adj-m02-reconciliation-row">
                <span className="tax-adj-m02-reconciliation-label">
                  + Skattekostnad / tax expense (account 891000)
                </span>
                <span className="tax-adj-m02-reconciliation-value">
                  {formatNumber(taxExpenseContext.totalTaxExpense.value)}
                </span>
              </div>
            ) : null}

            {taxExpenseContext?.currentTax?.value !== undefined ? (
              <div className="tax-adj-m02-reconciliation-row tax-adj-m02-reconciliation-row--indent">
                <span className="tax-adj-m02-reconciliation-label">
                  of which current tax
                </span>
                <span className="tax-adj-m02-reconciliation-value">
                  {formatNumber(taxExpenseContext.currentTax.value)}
                </span>
              </div>
            ) : null}

            {taxExpenseContext?.deferredTax?.value !== undefined ? (
              <div className="tax-adj-m02-reconciliation-row tax-adj-m02-reconciliation-row--indent">
                <span className="tax-adj-m02-reconciliation-label">
                  of which deferred tax
                </span>
                <span className="tax-adj-m02-reconciliation-value">
                  {formatNumber(taxExpenseContext.deferredTax.value)}
                </span>
              </div>
            ) : null}

            <div className="tax-adj-m02-reconciliation-row tax-adj-m02-reconciliation-row--total">
              <span className="tax-adj-m02-reconciliation-label">
                = Profit before tax (IL 14:2 starting point)
              </span>
              <span className="tax-adj-m02-reconciliation-value">
                {formatNumber(profitBeforeTax)}
              </span>
            </div>

            <div className="tax-adj-m02-reconciliation-note">
              <strong>Note:</strong> Both current and deferred tax are
              non-deductible and must be fully added back (IL 14:2). This
              figure becomes <code>INK2R.profit_before_tax</code>.
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--account-mapping">
        <div className="tax-adj-m02-section__header">
          <h2>Account Mapping Review</h2>
          <p className="tax-adj-m02-section__subtitle">
            Accounts mapped to tax categories 891000 (skattekostnad) and 940000
            (årets resultat).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m02-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : relevantMappingDecisions.length > 0 ? (
          <div className="tax-adj-m02-mapping-table">
            <table className="tax-adj-m02-table">
              <thead className="tax-adj-m02-table__head">
                <tr>
                  <th className="tax-adj-m02-table__header">Account Number</th>
                  <th className="tax-adj-m02-table__header">Account Name</th>
                  <th className="tax-adj-m02-table__header">Tax Category</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m02-table__body">
                {relevantMappingDecisions.map((decision) => (
                  <tr key={decision.id} className="tax-adj-m02-table__row">
                    <td className="tax-adj-m02-table__cell">
                      {decision.accountNumber}
                    </td>
                    <td className="tax-adj-m02-table__cell">
                      {decision.accountName}
                    </td>
                    <td className="tax-adj-m02-table__cell">
                      {getTaxCategoryName(decision.selectedCategory.code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m02-empty-message">
            No relevant account mappings found.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--reconciliation-status">
        <div className="tax-adj-m02-section__header">
          <h2>Reconciliation Status</h2>
          <p className="tax-adj-m02-section__subtitle">
            Validation of profit before tax derivation.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : hasReconciliationIssue ? (
          <div className="tax-adj-m02-status tax-adj-m02-status--warning">
            <span className="tax-adj-m02-status__icon">⚠</span>
            <span className="tax-adj-m02-status__text">
              Reconciliation review required.
              {cfcRiskFlag ? " CFC risk flag detected." : ""}
              {taxExpenseContext?.notes && taxExpenseContext.notes.length > 0
                ? ` ${taxExpenseContext.notes.length} note(s) present.`
                : ""}
            </span>
          </div>
        ) : (
          <div className="tax-adj-m02-status tax-adj-m02-status--ok">
            <span className="tax-adj-m02-status__icon">✓</span>
            <span className="tax-adj-m02-status__text">Reconciliation OK</span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--output">
        <div className="tax-adj-m02-section__header">
          <h2>INK2R Output: Profit Before Tax</h2>
          <p className="tax-adj-m02-section__subtitle">
            This figure is the deterministic starting point for all downstream
            tax calculation submodules.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : (
          <div className="tax-adj-m02-output-card">
            <div className="tax-adj-m02-output-label">
              INK2R.profit_before_tax
            </div>
            <div className="tax-adj-m02-output-value">
              {formatNumber(profitBeforeTax)} SEK
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m02-section tax-adj-m02-section--verification">
        <div className="tax-adj-m02-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m02-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m02-checklist">
          <li className="tax-adj-m02-checklist__item">
            <span className="tax-adj-m02-checklist__marker">✓</span>
            <span>
              The profit before tax matches the annual report income statement
            </span>
          </li>
          <li className="tax-adj-m02-checklist__item">
            <span className="tax-adj-m02-checklist__marker">✓</span>
            <span>
              Both current tax and deferred tax components are included in the
              add-back
            </span>
          </li>
          <li className="tax-adj-m02-checklist__item">
            <span className="tax-adj-m02-checklist__marker">✓</span>
            <span>
              All accounts mapped to 891000 (skattekostnad) are complete
            </span>
          </li>
          <li className="tax-adj-m02-checklist__item">
            <span className="tax-adj-m02-checklist__marker">✓</span>
            <span>
              All accounts mapped to 940000 (årets resultat) are complete
            </span>
          </li>
          <li className="tax-adj-m02-checklist__item">
            <span className="tax-adj-m02-checklist__marker">✓</span>
            <span>No unexplained reconciling difference remains</span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
