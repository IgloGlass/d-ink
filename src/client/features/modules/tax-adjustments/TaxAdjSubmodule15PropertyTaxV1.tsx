import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const INK2_BASIS_CODES = [
  {
    code: "1.8",
    label: "Fastighetsavgift — Småhus / ägarlägenhet",
    propertyKey: "fastighetsavgift_smahus",
  },
  {
    code: "1.9",
    label: "Fastighetsavgift — Hyreshus, bostäder",
    propertyKey: "fastighetsavgift_hyreshus_bostader",
  },
  {
    code: "1.10",
    label: "Fastighetsskatt — Småhus tomtmark / byggnad under uppförande",
    propertyKey: "fastighetsskatt_smahus_tomtmark",
  },
  {
    code: "1.11",
    label:
      "Fastighetsskatt — Hyreshus tomtmark / bostäder under uppförande",
    propertyKey: "fastighetsskatt_hyreshus_tomtmark",
  },
  {
    code: "1.12",
    label: "Fastighetsskatt — Hyreshus lokaler",
    propertyKey: "fastighetsskatt_hyreshus_lokaler",
  },
  {
    code: "1.13",
    label: "Fastighetsskatt — Industri / värmekraftverk",
    propertyKey: "fastighetsskatt_industri",
  },
  {
    code: "1.14",
    label: "Fastighetsskatt — Vattenkraftverk",
    propertyKey: "fastighetsskatt_vattenkraft",
  },
  {
    code: "1.15",
    label: "Fastighetsskatt — Vindkraftverk",
    propertyKey: "fastighetsskatt_vindkraft",
  },
] as const;

export function TaxAdjSubmodule15PropertyTaxV1({
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
  const balanceSheetLines =
    extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];

  const propertyTaxISLines = incomeStatementLines.filter((line) =>
    line.code.startsWith("519"),
  );

  const propertyTaxBSLines = balanceSheetLines.filter((line) =>
    line.code.startsWith("251"),
  );

  const propertyTaxDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "property_tax_and_property_fee",
  );

  const unreviewed = propertyTaxDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  // Consistency check: IS 519x sum vs BS 251x movement (current - prior)
  const isExpense = propertyTaxISLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0,
  );

  const bsCurrentTotal = propertyTaxBSLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0,
  );

  const bsPriorTotal = propertyTaxBSLines.reduce(
    (sum, line) => sum + (line.priorYearValue ?? 0),
    0,
  );

  const bsMovement = bsCurrentTotal - bsPriorTotal;

  const hasConsistencyData = isExpense !== 0 || bsMovement !== 0;
  const divergencePct =
    isExpense !== 0
      ? Math.abs((isExpense - bsMovement) / isExpense)
      : bsMovement !== 0
        ? 1
        : 0;
  const showConsistencyWarning = hasConsistencyData && divergencePct > 0.05;

  // Build a map of INK2 basis amounts from AI decisions
  const basisByPropertyKey = new Map<string, number>();
  for (const decision of propertyTaxDecisions) {
    if (decision.direction === "informational") {
      // Parse property key from policyRuleReference or rationale if present
      // Decisions carry rationale/evidence; we surface per code using amount
      // Since the contract doesn't expose a structured property key, we
      // derive from policyRuleReference substring matching
      for (const entry of INK2_BASIS_CODES) {
        if (
          decision.policyRuleReference
            .toLowerCase()
            .includes(entry.propertyKey.replace(/_/g, "_"))
        ) {
          basisByPropertyKey.set(
            entry.propertyKey,
            (basisByPropertyKey.get(entry.propertyKey) ?? 0) + decision.amount,
          );
        }
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
      return "\u2014";
    }
    return new Intl.NumberFormat("sv-SE").format(value);
  };

  const formatPercent = (value: number): string =>
    `${(value * 100).toFixed(1)}%`;

  return (
    <div className="tax-adj-m15-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Property Tax Accounts */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--accounts">
        <div className="tax-adj-m15-section__header">
          <h2>Property Tax Accounts</h2>
          <p className="tax-adj-m15-section__subtitle">
            Income statement accounts starting with 519x and balance sheet
            accounts starting with 251x.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m15-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <div className="tax-adj-m15-accounts-grid">
            <div className="tax-adj-m15-accounts-group">
              <h3 className="tax-adj-m15-accounts-group__title">
                Income Statement — 519x (Fastighetsskatt / fastighetsavgift)
              </h3>
              {propertyTaxISLines.length > 0 ? (
                <table className="tax-adj-m15-table">
                  <thead className="tax-adj-m15-table__head">
                    <tr>
                      <th className="tax-adj-m15-table__header">Account</th>
                      <th className="tax-adj-m15-table__header">Label</th>
                      <th className="tax-adj-m15-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m15-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m15-table__body">
                    {propertyTaxISLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m15-table__row">
                        <td className="tax-adj-m15-table__cell">{line.code}</td>
                        <td className="tax-adj-m15-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m15-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m15-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="tax-adj-m15-empty-message">
                  No 519x accounts found in income statement.
                </p>
              )}
            </div>

            <div className="tax-adj-m15-accounts-group">
              <h3 className="tax-adj-m15-accounts-group__title">
                Balance Sheet — 251x (Accrued property tax)
              </h3>
              {propertyTaxBSLines.length > 0 ? (
                <table className="tax-adj-m15-table">
                  <thead className="tax-adj-m15-table__head">
                    <tr>
                      <th className="tax-adj-m15-table__header">Account</th>
                      <th className="tax-adj-m15-table__header">Label</th>
                      <th className="tax-adj-m15-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m15-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m15-table__body">
                    {propertyTaxBSLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m15-table__row">
                        <td className="tax-adj-m15-table__cell">{line.code}</td>
                        <td className="tax-adj-m15-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m15-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m15-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="tax-adj-m15-empty-message">
                  No 251x accounts found in balance sheet.
                </p>
              )}
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 2: AI Decisions / Verification */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--ai-decisions">
        <div className="tax-adj-m15-section__header">
          <h2>AI Verification Decisions</h2>
          <p className="tax-adj-m15-section__subtitle">
            Property tax is fully deductible (IL 16:1). These decisions are
            informational — no income adjustment is generated. AI verifies
            property type, assessed value, rate applied, and period coverage.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m15-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : propertyTaxDecisions.length > 0 ? (
          <table className="tax-adj-m15-table">
            <thead className="tax-adj-m15-table__head">
              <tr>
                <th className="tax-adj-m15-table__header">Basis (SEK)</th>
                <th className="tax-adj-m15-table__header">Type</th>
                <th className="tax-adj-m15-table__header">Rationale</th>
                <th className="tax-adj-m15-table__header">Confidence</th>
                <th className="tax-adj-m15-table__header">Status</th>
                <th className="tax-adj-m15-table__header">Flag</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m15-table__body">
              {propertyTaxDecisions.map((decision) => (
                <tr key={decision.id} className="tax-adj-m15-table__row">
                  <td className="tax-adj-m15-table__cell">
                    {formatNumber(decision.amount)}
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    <span className="tax-adj-m15-badge tax-adj-m15-badge--info">
                      Informational
                    </span>
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    {decision.rationale}
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    {formatPercent(decision.confidence)}
                  </td>
                  <td className="tax-adj-m15-table__cell">{decision.status}</td>
                  <td className="tax-adj-m15-table__cell">
                    {decision.reviewFlag ? (
                      <span className="tax-adj-m15-review-flag">&#9888;</span>
                    ) : (
                      <span className="tax-adj-m15-review-ok">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="tax-adj-m15-empty-message">
            No AI verification decisions for property tax module.
          </p>
        )}
      </CardV1>

      {/* Section 3: INK2 Basis Code Summary */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--ink2-basis">
        <div className="tax-adj-m15-section__header">
          <h2>INK2 Basis Code Summary</h2>
          <p className="tax-adj-m15-section__subtitle">
            Assessed value (taxeringsvärde) basis per INK2 1.8–1.15 property
            type. Codes with no identified property show —.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={180} />
        ) : (
          <table className="tax-adj-m15-table">
            <thead className="tax-adj-m15-table__head">
              <tr>
                <th className="tax-adj-m15-table__header">INK2 Code</th>
                <th className="tax-adj-m15-table__header">Property Type</th>
                <th className="tax-adj-m15-table__header">
                  Taxeringsvärde Basis (SEK)
                </th>
              </tr>
            </thead>
            <tbody className="tax-adj-m15-table__body">
              {INK2_BASIS_CODES.map((entry) => {
                const basis = basisByPropertyKey.get(entry.propertyKey);
                return (
                  <tr key={entry.code} className="tax-adj-m15-table__row">
                    <td className="tax-adj-m15-table__cell tax-adj-m15-table__cell--code">
                      {entry.code}
                    </td>
                    <td className="tax-adj-m15-table__cell">{entry.label}</td>
                    <td className="tax-adj-m15-table__cell">
                      {basis !== undefined ? formatNumber(basis) : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardV1>

      {/* Section 4: Consistency Check */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--consistency">
        <div className="tax-adj-m15-section__header">
          <h2>Consistency Check</h2>
          <p className="tax-adj-m15-section__subtitle">
            IS 519x expense vs BS 251x movement (current &minus; prior). A
            divergence above 5% may indicate an accrual timing mismatch.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : hasConsistencyData ? (
          <div className="tax-adj-m15-consistency">
            <table className="tax-adj-m15-table tax-adj-m15-table--narrow">
              <tbody className="tax-adj-m15-table__body">
                <tr className="tax-adj-m15-table__row">
                  <td className="tax-adj-m15-table__cell tax-adj-m15-table__cell--label">
                    IS expense (519x, current year)
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    {formatNumber(isExpense)} SEK
                  </td>
                </tr>
                <tr className="tax-adj-m15-table__row">
                  <td className="tax-adj-m15-table__cell tax-adj-m15-table__cell--label">
                    BS movement (251x, current &minus; prior)
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    {formatNumber(bsMovement)} SEK
                  </td>
                </tr>
                <tr className="tax-adj-m15-table__row">
                  <td className="tax-adj-m15-table__cell tax-adj-m15-table__cell--label">
                    Divergence
                  </td>
                  <td className="tax-adj-m15-table__cell">
                    {formatPercent(divergencePct)}
                  </td>
                </tr>
              </tbody>
            </table>

            {showConsistencyWarning ? (
              <div
                className="tax-adj-m15-status tax-adj-m15-status--warning"
                role="alert"
              >
                <span className="tax-adj-m15-status__icon">&#9888;</span>
                <span className="tax-adj-m15-status__text">
                  Accrued property tax (251x) movement does not match booked
                  property tax expense (519x). Verify that the accrual covers
                  exactly the fiscal year.
                </span>
              </div>
            ) : (
              <div className="tax-adj-m15-status tax-adj-m15-status--ok">
                <span className="tax-adj-m15-status__icon">&#10003;</span>
                <span className="tax-adj-m15-status__text">
                  IS expense and BS accrual movement are consistent
                  (divergence &le; 5%).
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="tax-adj-m15-empty-message">
            Insufficient data to perform consistency check.
          </p>
        )}
      </CardV1>

      {/* Section 5: Review Status */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--review-status">
        <div className="tax-adj-m15-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m15-section__subtitle">
            Count of AI decisions flagged for manual review.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m15-status tax-adj-m15-status--warning">
            <span className="tax-adj-m15-status__icon">&#9888;</span>
            <span className="tax-adj-m15-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m15-status tax-adj-m15-status--ok">
            <span className="tax-adj-m15-status__icon">&#10003;</span>
            <span className="tax-adj-m15-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m15-section tax-adj-m15-section--verification">
        <div className="tax-adj-m15-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m15-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m15-checklist">
          <li className="tax-adj-m15-checklist__item">
            <span className="tax-adj-m15-checklist__marker">&#10003;</span>
            <span>
              Taxeringsvärde (assessed value) used as the basis matches the
              annual report or Skatteverket notice
            </span>
          </li>
          <li className="tax-adj-m15-checklist__item">
            <span className="tax-adj-m15-checklist__marker">&#10003;</span>
            <span>
              Property type correctly identified (commercial fastighetsskatt
              0.5% vs residential fastighetsavgift capped fee)
            </span>
          </li>
          <li className="tax-adj-m15-checklist__item">
            <span className="tax-adj-m15-checklist__marker">&#10003;</span>
            <span>
              Accrual (251300) covers exactly the fiscal year — not over- or
              under-accrued
            </span>
          </li>
          <li className="tax-adj-m15-checklist__item">
            <span className="tax-adj-m15-checklist__marker">&#10003;</span>
            <span>
              Correct INK2 1.x basis code selected based on property type
            </span>
          </li>
          <li className="tax-adj-m15-checklist__item">
            <span className="tax-adj-m15-checklist__marker">&#10003;</span>
            <span>
              No income adjustment is needed — property tax is fully deductible
              as booked
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
