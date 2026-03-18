import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const RENEWABLE_ENERGY_KEYWORDS = [
  "renewable",
  "energy",
  "elcertifikat",
  "vattenkraft",
  "ursprungsgaranti",
  "produktionsskatt",
  "förnybar",
];

function containsRenewableKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return RENEWABLE_ENERGY_KEYWORDS.some((kw) => lower.includes(kw));
}

export function TaxAdjSubmodule08YieldTaxV1({
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

  const yieldTaxBalanceSheet = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("138") ||
      code.startsWith("221") ||
      code.startsWith("294")
    );
  });

  const yieldTaxDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "yield_risk_and_renewable_energy_taxes",
  );

  const renewableEnergyDecisions = yieldTaxDecisions.filter(
    (decision) =>
      decision.reviewFlag && containsRenewableKeyword(decision.rationale),
  );

  const hasRenewableFlag = renewableEnergyDecisions.length > 0;

  const unreviewed = yieldTaxDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  // Aggregate basis amounts per INK2 code from policy rule references
  const ink2Codes = ["1.3", "1.6a", "1.6b", "1.7a", "1.7b", "1.16"] as const;

  type Ink2Code = (typeof ink2Codes)[number];

  const ink2Labels: Record<Ink2Code, string> = {
    "1.3": "Riskskatt (INK2 1.3)",
    "1.6a": "Avkastningsskatt 15% — försäkringsföretag/avsatt till pensioner (INK2 1.6a)",
    "1.6b": "Avkastningsskatt 15% — utländska pensionsförsäkringar (INK2 1.6b)",
    "1.7a": "Avkastningsskatt 30% — försäkringsföretag (INK2 1.7a)",
    "1.7b": "Avkastningsskatt 30% — utländska kapitalförsäkringar (INK2 1.7b)",
    "1.16": "Förnybar el (INK2 1.16)",
  };

  const basisByCode: Record<Ink2Code, number> = {
    "1.3": 0,
    "1.6a": 0,
    "1.6b": 0,
    "1.7a": 0,
    "1.7b": 0,
    "1.16": 0,
  };

  for (const decision of yieldTaxDecisions) {
    const ref = decision.policyRuleReference;
    for (const code of ink2Codes) {
      if (ref.includes(code)) {
        basisByCode[code] += decision.amount;
      }
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
    <div className="tax-adj-m08-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Balance Sheet Accounts */}
      <CardV1 className="tax-adj-m08-section tax-adj-m08-section--balance-sheet">
        <div className="tax-adj-m08-section__header">
          <h2>Balance Sheet Accounts</h2>
          <p className="tax-adj-m08-section__subtitle">
            Accounts starting with 138 (kapitalförsäkring), 221 (basis for
            yield tax), and 294 (accrued yield tax on pension).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m08-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : yieldTaxBalanceSheet.length > 0 ? (
          <div className="tax-adj-m08-balance-sheet-table">
            <table className="tax-adj-m08-table">
              <thead className="tax-adj-m08-table__head">
                <tr>
                  <th className="tax-adj-m08-table__header">Code</th>
                  <th className="tax-adj-m08-table__header">Label</th>
                  <th className="tax-adj-m08-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m08-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m08-table__body">
                {yieldTaxBalanceSheet.map((line) => (
                  <tr key={line.code} className="tax-adj-m08-table__row">
                    <td className="tax-adj-m08-table__cell">{line.code}</td>
                    <td className="tax-adj-m08-table__cell">{line.label}</td>
                    <td className="tax-adj-m08-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m08-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m08-empty-message">
            No yield tax accounts found in balance sheet (138x, 221x, 294x).
          </p>
        )}
      </CardV1>

      {/* Section 2: AI Adjustment Decisions */}
      <CardV1 className="tax-adj-m08-section tax-adj-m08-section--ai-decisions">
        <div className="tax-adj-m08-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m08-section__subtitle">
            Arrangement type identified, formula verification, and discrepancy
            flags. Most decisions are informational — no income adjustment is
            generated. Target INK2 codes: 1.3, 1.6a, 1.6b, 1.7a, 1.7b, 1.16.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m08-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : yieldTaxDecisions.length > 0 ? (
          <div className="tax-adj-m08-decisions-table">
            <table className="tax-adj-m08-table">
              <thead className="tax-adj-m08-table__head">
                <tr>
                  <th className="tax-adj-m08-table__header">Amount (SEK)</th>
                  <th className="tax-adj-m08-table__header">Direction</th>
                  <th className="tax-adj-m08-table__header">INK2 Code</th>
                  <th className="tax-adj-m08-table__header">Rationale</th>
                  <th className="tax-adj-m08-table__header">Status</th>
                  <th className="tax-adj-m08-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m08-table__body">
                {yieldTaxDecisions.map((decision) => {
                  const matchedCode =
                    ink2Codes.find((c) =>
                      decision.policyRuleReference.includes(c),
                    ) ?? "—";

                  return (
                    <tr key={decision.id} className="tax-adj-m08-table__row">
                      <td className="tax-adj-m08-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m08-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m08-table__cell">
                        {matchedCode}
                      </td>
                      <td className="tax-adj-m08-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m08-table__cell">
                        {decision.status}
                      </td>
                      <td className="tax-adj-m08-table__cell">
                        {decision.reviewFlag ? (
                          <span className="tax-adj-m08-review-flag">⚠</span>
                        ) : (
                          <span className="tax-adj-m08-review-ok">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m08-empty-message">
            No adjustment decisions for yield tax / risk tax module.
          </p>
        )}
      </CardV1>

      {/* Section 3: Renewable Energy Flag */}
      {hasRenewableFlag ? (
        <CardV1 className="tax-adj-m08-section tax-adj-m08-section--renewable-flag">
          <div className="tax-adj-m08-section__header">
            <h2>Renewable Energy Item Identified</h2>
          </div>
          <div className="tax-adj-m08-warning-card" role="alert">
            <span className="tax-adj-m08-warning-card__icon">⚠</span>
            <div className="tax-adj-m08-warning-card__body">
              <p className="tax-adj-m08-warning-card__message">
                A renewable energy item has been identified — please verify that
                certificates and/or taxes (elcertifikat, ursprungsgarantier,
                produktionsskatt på vattenkraft) are correctly classified as
                income or deductible expense (INK2 1.16).
              </p>
              {renewableEnergyDecisions.length > 0 ? (
                <ul className="tax-adj-m08-warning-card__items">
                  {renewableEnergyDecisions.map((d) => (
                    <li key={d.id} className="tax-adj-m08-warning-card__item">
                      {d.rationale}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </CardV1>
      ) : null}

      {/* Section 4: Basis Summary */}
      <CardV1 className="tax-adj-m08-section tax-adj-m08-section--basis-summary">
        <div className="tax-adj-m08-section__header">
          <h2>Basis Summary by INK2 Code</h2>
          <p className="tax-adj-m08-section__subtitle">
            Computed basis amounts per INK2 target code from AI decisions.
            Zero-value rows indicate no decisions matched that code.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={160} />
        ) : (
          <div className="tax-adj-m08-basis-table">
            <table className="tax-adj-m08-table">
              <thead className="tax-adj-m08-table__head">
                <tr>
                  <th className="tax-adj-m08-table__header">INK2 Code</th>
                  <th className="tax-adj-m08-table__header">Description</th>
                  <th className="tax-adj-m08-table__header">Basis (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m08-table__body">
                {ink2Codes.map((code) => (
                  <tr key={code} className="tax-adj-m08-table__row">
                    <td className="tax-adj-m08-table__cell tax-adj-m08-table__cell--code">
                      {code}
                    </td>
                    <td className="tax-adj-m08-table__cell">
                      {ink2Labels[code]}
                    </td>
                    <td className="tax-adj-m08-table__cell">
                      {formatNumber(basisByCode[code])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardV1>

      {/* Section 5: Review Status */}
      <CardV1 className="tax-adj-m08-section tax-adj-m08-section--review-status">
        <div className="tax-adj-m08-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m08-section__subtitle">
            Validation of unresolved adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m08-status tax-adj-m08-status--warning">
            <span className="tax-adj-m08-status__icon">⚠</span>
            <span className="tax-adj-m08-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m08-status tax-adj-m08-status--ok">
            <span className="tax-adj-m08-status__icon">✓</span>
            <span className="tax-adj-m08-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m08-section tax-adj-m08-section--verification">
        <div className="tax-adj-m08-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m08-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m08-checklist">
          <li className="tax-adj-m08-checklist__item">
            <span className="tax-adj-m08-checklist__marker">✓</span>
            <span>
              Surrender value / pension basis matches the annual report
            </span>
          </li>
          <li className="tax-adj-m08-checklist__item">
            <span className="tax-adj-m08-checklist__marker">✓</span>
            <span>
              Statslåneränta rate is correct for the fiscal year (published by
              Riksgälden, 30 Nov prior year)
            </span>
          </li>
          <li className="tax-adj-m08-checklist__item">
            <span className="tax-adj-m08-checklist__marker">✓</span>
            <span>
              Yield tax cost is correctly booked as a deductible expense in P&L
            </span>
          </li>
          <li className="tax-adj-m08-checklist__item">
            <span className="tax-adj-m08-checklist__marker">✓</span>
            <span>
              If riskskatt applies: company is a credit institution and basis is
              correctly computed (INK2 1.3)
            </span>
          </li>
          <li className="tax-adj-m08-checklist__item">
            <span className="tax-adj-m08-checklist__marker">✓</span>
            <span>
              Renewable energy items (if any) are correctly classified as income
              or deductible expense (INK2 1.16)
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
