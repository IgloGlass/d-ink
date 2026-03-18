import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule12DepreciationV1({
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
  const assetAreas =
    extraction?.taxDeep?.depreciationContext?.assetAreas ?? [];

  // Balance sheet: codes starting with 102 (tangible fixed assets) and 215 (accelerated depreciation reserve)
  const assetBalanceSheetLines = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("102") || code.startsWith("215");
  });

  // Income statement: codes starting with 397 (booked depreciation) and 885 (accelerated depreciation)
  const assetIncomeStatementLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("397") || code.startsWith("885");
  });

  const depreciationDecisions = (adjustments?.decisions ?? []).filter(
    (decision) =>
      decision.module === "depreciation_tangible_and_acquired_intangible_assets"
  );

  const manualReviewDecisions = depreciationDecisions.filter(
    (decision) => decision.status === "manual_review_required"
  );

  const hasManualReview = manualReviewDecisions.length > 0;

  const isTier3 = manualReviewDecisions.some((decision) => {
    const rationaleLC = decision.rationale.toLowerCase();
    return rationaleLC.includes("tier 3") || rationaleLC.includes("manual");
  });

  // 215000 vs 885000 consistency check
  const code215Line = balanceSheetLines.find((line) =>
    (line.code ?? "").startsWith("215")
  );
  const code885Line = incomeStatementLines.find((line) =>
    (line.code ?? "").startsWith("885")
  );

  const reserveMovement =
    code215Line !== undefined
      ? (code215Line.currentYearValue ?? 0) -
        (code215Line.priorYearValue ?? 0)
      : undefined;
  const acceleratedDepreciation = code885Line?.currentYearValue;

  const showReserveConsistencyWarning =
    reserveMovement !== undefined &&
    acceleratedDepreciation !== undefined &&
    Math.abs(reserveMovement - acceleratedDepreciation) >
      Math.max(1, Math.abs(acceleratedDepreciation) * 0.01);

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
      | "informational"
  ): string => {
    switch (direction) {
      case "increase_taxable_income":
        return "Add-back (INK2 4.9+)";
      case "decrease_taxable_income":
        return "Deduction (INK2 4.9−)";
      case "informational":
        return "Informational";
      default:
        return direction;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "proposed":
        return "Proposed";
      case "manual_review_required":
        return "Manual review required";
      case "overridden":
        return "Overridden";
      case "accepted":
        return "Accepted";
      default:
        return status;
    }
  };

  return (
    <div className="tax-adj-m12-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Asset Balance Sheet Accounts */}
      <CardV1 className="tax-adj-m12-section tax-adj-m12-section--balance-sheet">
        <div className="tax-adj-m12-section__header">
          <h2>Asset Balance Sheet Accounts</h2>
          <p className="tax-adj-m12-section__subtitle">
            Accounts 102xxx (tangible fixed assets) and 215xxx (accelerated
            depreciation reserve) from balance sheet; 397xxx (booked
            depreciation) and 885xxx (accelerated depreciation) from income
            statement.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m12-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : assetBalanceSheetLines.length > 0 ||
          assetIncomeStatementLines.length > 0 ? (
          <>
            {assetBalanceSheetLines.length > 0 ? (
              <div className="tax-adj-m12-accounts-table">
                <p className="tax-adj-m12-accounts-table__label">
                  Balance sheet
                </p>
                <table className="tax-adj-m12-table">
                  <thead className="tax-adj-m12-table__head">
                    <tr>
                      <th className="tax-adj-m12-table__header">Code</th>
                      <th className="tax-adj-m12-table__header">Label</th>
                      <th className="tax-adj-m12-table__header">
                        Current year (SEK)
                      </th>
                      <th className="tax-adj-m12-table__header">
                        Prior year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m12-table__body">
                    {assetBalanceSheetLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m12-table__row">
                        <td className="tax-adj-m12-table__cell">{line.code}</td>
                        <td className="tax-adj-m12-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m12-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m12-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {assetIncomeStatementLines.length > 0 ? (
              <div className="tax-adj-m12-accounts-table">
                <p className="tax-adj-m12-accounts-table__label">
                  Income statement
                </p>
                <table className="tax-adj-m12-table">
                  <thead className="tax-adj-m12-table__head">
                    <tr>
                      <th className="tax-adj-m12-table__header">Code</th>
                      <th className="tax-adj-m12-table__header">Label</th>
                      <th className="tax-adj-m12-table__header">
                        Current year (SEK)
                      </th>
                      <th className="tax-adj-m12-table__header">
                        Prior year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m12-table__body">
                    {assetIncomeStatementLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m12-table__row">
                        <td className="tax-adj-m12-table__cell">{line.code}</td>
                        <td className="tax-adj-m12-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m12-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m12-table__cell">
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
          <p className="tax-adj-m12-empty-message">
            No asset accounts found in the mapped statements.
          </p>
        )}
      </CardV1>

      {/* Section 2: Depreciation Context (Asset Note) */}
      <CardV1 className="tax-adj-m12-section tax-adj-m12-section--asset-note">
        <div className="tax-adj-m12-section__header">
          <h2>Depreciation Context (Asset Note)</h2>
          <p className="tax-adj-m12-section__subtitle">
            Asset movement table from the annual report note on tangible and
            intangible fixed assets.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m12-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : assetAreas.length > 0 ? (
          <div className="tax-adj-m12-asset-note-table">
            <table className="tax-adj-m12-table">
              <thead className="tax-adj-m12-table__head">
                <tr>
                  <th className="tax-adj-m12-table__header">Asset type</th>
                  <th className="tax-adj-m12-table__header">
                    Opening carrying amount (SEK)
                  </th>
                  <th className="tax-adj-m12-table__header">
                    Additions (SEK)
                  </th>
                  <th className="tax-adj-m12-table__header">
                    Disposals (SEK)
                  </th>
                  <th className="tax-adj-m12-table__header">
                    Depreciation for year (SEK)
                  </th>
                  <th className="tax-adj-m12-table__header">
                    Closing carrying amount (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m12-table__body">
                {assetAreas.map((area, index) => (
                  <tr key={index} className="tax-adj-m12-table__row">
                    <td className="tax-adj-m12-table__cell">
                      {area.assetArea}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(area.openingCarryingAmount)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(area.acquisitions)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(area.disposals)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(area.depreciationForYear)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(area.closingCarryingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m12-empty-message">
            No asset movement data extracted from the annual report. Asset note
            context is required for tier 2 (20%-metoden) compliance assessment.
          </p>
        )}
      </CardV1>

      {/* Section 3: AI Compliance Assessment */}
      <CardV1 className="tax-adj-m12-section tax-adj-m12-section--ai-assessment">
        <div className="tax-adj-m12-section__header">
          <h2>AI Compliance Assessment</h2>
          <p className="tax-adj-m12-section__subtitle">
            Depreciation compliance under IL 18 — 30%-metoden (declining
            balance) and 20%-metoden (straight-line). Target field: INK2 4.9.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m12-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : depreciationDecisions.length > 0 ? (
          <div className="tax-adj-m12-decisions-table">
            <table className="tax-adj-m12-table">
              <thead className="tax-adj-m12-table__head">
                <tr>
                  <th className="tax-adj-m12-table__header">
                    Amount (SEK)
                  </th>
                  <th className="tax-adj-m12-table__header">Direction</th>
                  <th className="tax-adj-m12-table__header">Rationale</th>
                  <th className="tax-adj-m12-table__header">Status</th>
                  <th className="tax-adj-m12-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m12-table__body">
                {depreciationDecisions.map((decision) => (
                  <tr key={decision.id} className="tax-adj-m12-table__row">
                    <td className="tax-adj-m12-table__cell">
                      {formatNumber(decision.amount)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {getDirectionLabel(decision.direction)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {decision.rationale}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {getStatusLabel(decision.status)}
                    </td>
                    <td className="tax-adj-m12-table__cell">
                      {decision.reviewFlag ? (
                        <span className="tax-adj-m12-review-flag">⚠</span>
                      ) : (
                        <span className="tax-adj-m12-review-ok">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m12-empty-message">
            No AI adjustment decisions for the depreciation module.
          </p>
        )}
      </CardV1>

      {/* Section 4: Tier 3 Manual Input Notice */}
      {isTier3 ? (
        <CardV1 className="tax-adj-m12-section tax-adj-m12-section--tier3-notice">
          <div className="tax-adj-m12-section__header">
            <h2>Tier 3 Manual Input Required</h2>
          </div>
          <div className="tax-adj-m12-notice tax-adj-m12-notice--warning">
            <span className="tax-adj-m12-notice__icon">⚠</span>
            <p className="tax-adj-m12-notice__text">
              The AI was unable to confirm compliance using the proxy check or
              acquisition history. Please enter the opening skattemässigt
              restvärde from last year's tax return.
            </p>
          </div>
        </CardV1>
      ) : null}

      {/* Section 5: 215000 Obeskattad Reserv Consistency */}
      {showReserveConsistencyWarning ? (
        <CardV1 className="tax-adj-m12-section tax-adj-m12-section--reserve-consistency">
          <div className="tax-adj-m12-section__header">
            <h2>Obeskattad Reserv Consistency Check</h2>
            <p className="tax-adj-m12-section__subtitle">
              Movement in 215000 compared with 885000 (accelerated depreciation
              booked).
            </p>
          </div>
          <div className="tax-adj-m12-notice tax-adj-m12-notice--warning">
            <span className="tax-adj-m12-notice__icon">⚠</span>
            <p className="tax-adj-m12-notice__text">
              The accelerated depreciation reserve (215000) movement (
              {formatNumber(reserveMovement)} SEK) does not match accelerated
              depreciation booked (885000:{" "}
              {formatNumber(acceleratedDepreciation)} SEK). Review for method
              consistency.
            </p>
          </div>
        </CardV1>
      ) : null}

      {/* Section 6: Review Status */}
      <CardV1 className="tax-adj-m12-section tax-adj-m12-section--review-status">
        <div className="tax-adj-m12-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m12-section__subtitle">
            Unresolved depreciation adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : hasManualReview ? (
          <div className="tax-adj-m12-status tax-adj-m12-status--warning">
            <span className="tax-adj-m12-status__icon">⚠</span>
            <span className="tax-adj-m12-status__text">
              {manualReviewDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m12-status tax-adj-m12-status--ok">
            <span className="tax-adj-m12-status__icon">✓</span>
            <span className="tax-adj-m12-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 7: Verification Checklist */}
      <CardV1 className="tax-adj-m12-section tax-adj-m12-section--verification">
        <div className="tax-adj-m12-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m12-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m12-checklist">
          <li className="tax-adj-m12-checklist__item">
            <span className="tax-adj-m12-checklist__marker">✓</span>
            <span>
              Depreciation method (30%-metoden or 20%-metoden) is consistent
              with prior years
            </span>
          </li>
          <li className="tax-adj-m12-checklist__item">
            <span className="tax-adj-m12-checklist__marker">✓</span>
            <span>
              All additions and disposals during the year are correctly
              reflected in the asset note
            </span>
          </li>
          <li className="tax-adj-m12-checklist__item">
            <span className="tax-adj-m12-checklist__marker">✓</span>
            <span>
              The obeskattad reserv (215000) movement is consistent with 885000
              (accelerated depreciation)
            </span>
          </li>
          <li className="tax-adj-m12-checklist__item">
            <span className="tax-adj-m12-checklist__marker">✓</span>
            <span>
              If tier 3 triggered: opening skattemässigt restvärde is confirmed
              from last year's tax return
            </span>
          </li>
          <li className="tax-adj-m12-checklist__item">
            <span className="tax-adj-m12-checklist__marker">✓</span>
            <span>
              Adjustment direction (4.9+ add-back or 4.9− deduction) is correct
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
