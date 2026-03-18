import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule04BuildingsV1({
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
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  // Section 1: Building asset summary — BS accounts 111xxx, 115xxx, 123xxx
  const buildingBalanceSheetLines = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("111") ||
      code.startsWith("115") ||
      code.startsWith("123")
    );
  });

  // Section 3: Booked depreciation — IS accounts 777000, 782400, 784000
  const bookedDepreciationLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return (
      code.startsWith("777") ||
      code.startsWith("7824") ||
      code.startsWith("784")
    );
  });

  const totalBookedDepreciation = bookedDepreciationLines.reduce(
    (sum, line) => sum + (line.currentYearValue ?? 0),
    0,
  );

  // Section 4: Capital gains/losses — IS accounts 397200 and 797200
  const capitalGainLossLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("3972") || code.startsWith("7972");
  });

  // Building asset movement lines from depreciation context
  const buildingAssetAreas = assetAreas.filter((area) => {
    const label = (area.assetArea ?? "").toLowerCase();
    return (
      label.includes("bygg") ||
      label.includes("building") ||
      label.includes("mark") ||
      label.includes("land") ||
      label.includes("förbättr") ||
      label.includes("leasehold") ||
      label.includes("improvement")
    );
  });

  // Fixed assets / depreciation notes
  const buildingNotes = relevantNotes.filter(
    (note) => note.category === "fixed_assets_depreciation",
  );

  // AI decisions for buildings module
  const buildingsDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "buildings_improvements_property_gains",
  );

  // Depreciation decisions: INK2 4.9 add-back and deduction
  const depreciationAddBack = buildingsDecisions.filter(
    (decision) =>
      decision.targetField === "INK2S.depreciation_adjustment" &&
      decision.direction === "increase_taxable_income",
  );

  const depreciationDeduction = buildingsDecisions.filter(
    (decision) =>
      decision.targetField === "INK2S.depreciation_adjustment" &&
      decision.direction === "decrease_taxable_income",
  );

  // Capital gain/loss decisions
  const capitalGainDecisions = buildingsDecisions.filter(
    (decision) => decision.targetField === "INK2S.other_manual_adjustments",
  );

  const totalTaxDepreciationAllowable = depreciationDeduction.reduce(
    (sum, decision) => sum + decision.amount,
    0,
  );

  const totalDepreciationAddBack = depreciationAddBack.reduce(
    (sum, decision) => sum + decision.amount,
    0,
  );

  const unreviewed = buildingsDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  const hasLandBuildingSplitWarning = capitalGainDecisions.some(
    (decision) => decision.reviewFlag,
  );

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
    <div className="tax-adj-m04-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Building Asset Summary */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--asset-summary">
        <div className="tax-adj-m04-section__header">
          <h2>Building Asset Summary</h2>
          <p className="tax-adj-m04-section__subtitle">
            Balance sheet accounts for buildings (111000), land improvements
            (115000), and leaseholder's improvements (123200).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m04-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : buildingBalanceSheetLines.length > 0 ? (
          <div className="tax-adj-m04-asset-table">
            <table className="tax-adj-m04-table">
              <thead className="tax-adj-m04-table__head">
                <tr>
                  <th className="tax-adj-m04-table__header">Code</th>
                  <th className="tax-adj-m04-table__header">Label</th>
                  <th className="tax-adj-m04-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m04-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m04-table__body">
                {buildingBalanceSheetLines.map((line) => (
                  <tr key={line.code} className="tax-adj-m04-table__row">
                    <td className="tax-adj-m04-table__cell">{line.code}</td>
                    <td className="tax-adj-m04-table__cell">{line.label}</td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m04-empty-message">
            No building balance sheet accounts found in annual report.
          </p>
        )}

        {buildingAssetAreas.length > 0 ? (
          <div className="tax-adj-m04-asset-movements">
            <h3 className="tax-adj-m04-asset-movements__title">
              Asset Movements (from notes)
            </h3>
            <table className="tax-adj-m04-table">
              <thead className="tax-adj-m04-table__head">
                <tr>
                  <th className="tax-adj-m04-table__header">Asset Area</th>
                  <th className="tax-adj-m04-table__header">
                    Opening Carrying Amount (SEK)
                  </th>
                  <th className="tax-adj-m04-table__header">
                    Acquisitions (SEK)
                  </th>
                  <th className="tax-adj-m04-table__header">
                    Disposals (SEK)
                  </th>
                  <th className="tax-adj-m04-table__header">
                    Depreciation for Year (SEK)
                  </th>
                  <th className="tax-adj-m04-table__header">
                    Closing Carrying Amount (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m04-table__body">
                {buildingAssetAreas.map((area, index) => (
                  <tr key={index} className="tax-adj-m04-table__row">
                    <td className="tax-adj-m04-table__cell">
                      {area.assetArea}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(area.openingCarryingAmount)}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(area.acquisitions)}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(area.disposals)}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(area.depreciationForYear)}
                    </td>
                    <td className="tax-adj-m04-table__cell">
                      {formatNumber(area.closingCarryingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardV1>

      {/* Section 2: Building Type Classification */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--classification">
        <div className="tax-adj-m04-section__header">
          <h2>Building Type Classification</h2>
          <p className="tax-adj-m04-section__subtitle">
            AI-identified building category, applicable statutory depreciation
            rate (IL 19–20), and computed maximum tax depreciation.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m04-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : depreciationAddBack.length > 0 ||
          depreciationDeduction.length > 0 ? (
          <div className="tax-adj-m04-classification-table">
            <table className="tax-adj-m04-table">
              <thead className="tax-adj-m04-table__head">
                <tr>
                  <th className="tax-adj-m04-table__header">Rationale</th>
                  <th className="tax-adj-m04-table__header">Policy Rule</th>
                  <th className="tax-adj-m04-table__header">Amount (SEK)</th>
                  <th className="tax-adj-m04-table__header">Direction</th>
                  <th className="tax-adj-m04-table__header">Confidence</th>
                  <th className="tax-adj-m04-table__header">Status</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m04-table__body">
                {[...depreciationAddBack, ...depreciationDeduction].map(
                  (decision) => (
                    <tr key={decision.id} className="tax-adj-m04-table__row">
                      <td className="tax-adj-m04-table__cell">
                        {decision.rationale}
                      </td>
                      <td className="tax-adj-m04-table__cell">
                        {decision.policyRuleReference}
                      </td>
                      <td className="tax-adj-m04-table__cell">
                        {formatNumber(decision.amount)}
                      </td>
                      <td className="tax-adj-m04-table__cell">
                        {getDirectionLabel(decision.direction)}
                      </td>
                      <td className="tax-adj-m04-table__cell">
                        {Math.round(decision.confidence * 100)}%
                      </td>
                      <td className="tax-adj-m04-table__cell">
                        {decision.status}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : buildingNotes.length > 0 ? (
          <div className="tax-adj-m04-notes-list">
            {buildingNotes.map((note, index) => (
              <div key={index} className="tax-adj-m04-note-item">
                <h3 className="tax-adj-m04-note-item__title">{note.title}</h3>
                {note.notes.length > 0 ? (
                  <ul className="tax-adj-m04-note-item__notes">
                    {note.notes.map((text, noteIndex) => (
                      <li key={noteIndex}>{text}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="tax-adj-m04-empty-message">
            No building type classification decisions from AI. Upload an annual
            report and run tax adjustments to generate decisions.
          </p>
        )}
      </CardV1>

      {/* Section 3: Depreciation Adjustment Computation */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--depreciation">
        <div className="tax-adj-m04-section__header">
          <h2>Depreciation Adjustment Computation</h2>
          <p className="tax-adj-m04-section__subtitle">
            Booked depreciation (IS accounts 777000, 782400, 784000) versus
            allowable tax depreciation. Output flows to INK2 4.9.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m04-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <>
            {bookedDepreciationLines.length > 0 ? (
              <div className="tax-adj-m04-depreciation-table">
                <h3 className="tax-adj-m04-depreciation-table__title">
                  Booked Depreciation (Income Statement)
                </h3>
                <table className="tax-adj-m04-table">
                  <thead className="tax-adj-m04-table__head">
                    <tr>
                      <th className="tax-adj-m04-table__header">Code</th>
                      <th className="tax-adj-m04-table__header">Label</th>
                      <th className="tax-adj-m04-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m04-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m04-table__body">
                    {bookedDepreciationLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m04-table__row">
                        <td className="tax-adj-m04-table__cell">{line.code}</td>
                        <td className="tax-adj-m04-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="tax-adj-m04-empty-message">
                No depreciation accounts (777000, 782400, 784000) found in
                income statement.
              </p>
            )}

            <div className="tax-adj-m04-depreciation-summary">
              <div className="tax-adj-m04-summary-row">
                <span className="tax-adj-m04-summary-label">
                  Total booked depreciation:
                </span>
                <span className="tax-adj-m04-summary-value">
                  {formatNumber(totalBookedDepreciation)} SEK
                </span>
              </div>
              <div className="tax-adj-m04-summary-row">
                <span className="tax-adj-m04-summary-label">
                  Tax-allowable depreciation (AI):
                </span>
                <span className="tax-adj-m04-summary-value">
                  {formatNumber(totalTaxDepreciationAllowable)} SEK
                </span>
              </div>
              {totalDepreciationAddBack > 0 ? (
                <div className="tax-adj-m04-summary-row tax-adj-m04-summary-row--highlight">
                  <span className="tax-adj-m04-summary-label">
                    Add-back at INK2 4.9+ (booked exceeds tax allowable):
                  </span>
                  <span className="tax-adj-m04-summary-value">
                    {formatNumber(totalDepreciationAddBack)} SEK
                  </span>
                </div>
              ) : null}
              {totalTaxDepreciationAllowable > totalBookedDepreciation ? (
                <div className="tax-adj-m04-summary-row tax-adj-m04-summary-row--highlight">
                  <span className="tax-adj-m04-summary-label">
                    Deduction at INK2 4.9− (tax allowable exceeds booked):
                  </span>
                  <span className="tax-adj-m04-summary-value">
                    {formatNumber(
                      totalTaxDepreciationAllowable - totalBookedDepreciation,
                    )}{" "}
                    SEK
                  </span>
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardV1>

      {/* Section 4: Capital Gains/Losses */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--capital-gains">
        <div className="tax-adj-m04-section__header">
          <h2>Capital Gains / Losses on Real Property</h2>
          <p className="tax-adj-m04-section__subtitle">
            Income statement accounts 397200 (capital gain) and 797200 (capital
            loss). Gains fully taxable (IL 45); losses deductible only against
            capital gains.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m04-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <>
            {capitalGainLossLines.length > 0 ? (
              <div className="tax-adj-m04-capital-table">
                <table className="tax-adj-m04-table">
                  <thead className="tax-adj-m04-table__head">
                    <tr>
                      <th className="tax-adj-m04-table__header">Code</th>
                      <th className="tax-adj-m04-table__header">Label</th>
                      <th className="tax-adj-m04-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m04-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m04-table__body">
                    {capitalGainLossLines.map((line) => (
                      <tr key={line.code} className="tax-adj-m04-table__row">
                        <td className="tax-adj-m04-table__cell">{line.code}</td>
                        <td className="tax-adj-m04-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="tax-adj-m04-empty-message">
                No capital gain (397200) or capital loss (797200) accounts found
                in income statement.
              </p>
            )}

            {hasLandBuildingSplitWarning ? (
              <div className="tax-adj-m04-status tax-adj-m04-status--warning">
                <span className="tax-adj-m04-status__icon">⚠</span>
                <span className="tax-adj-m04-status__text">
                  A property sale has been detected. The gain or loss must be
                  split between the building component (depreciable, subject to
                  recapture) and the land component (non-depreciable, straight
                  capital gain). Review AI decisions below.
                </span>
              </div>
            ) : null}

            {capitalGainDecisions.length > 0 ? (
              <div className="tax-adj-m04-capital-decisions">
                <h3 className="tax-adj-m04-capital-decisions__title">
                  AI Capital Gain/Loss Decisions
                </h3>
                <table className="tax-adj-m04-table">
                  <thead className="tax-adj-m04-table__head">
                    <tr>
                      <th className="tax-adj-m04-table__header">
                        Amount (SEK)
                      </th>
                      <th className="tax-adj-m04-table__header">Direction</th>
                      <th className="tax-adj-m04-table__header">Rationale</th>
                      <th className="tax-adj-m04-table__header">Status</th>
                      <th className="tax-adj-m04-table__header">
                        Land/Building Split
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m04-table__body">
                    {capitalGainDecisions.map((decision) => (
                      <tr key={decision.id} className="tax-adj-m04-table__row">
                        <td className="tax-adj-m04-table__cell">
                          {formatNumber(decision.amount)}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {getDirectionLabel(decision.direction)}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {decision.rationale}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {decision.status}
                        </td>
                        <td className="tax-adj-m04-table__cell">
                          {decision.reviewFlag ? (
                            <span className="tax-adj-m04-review-flag">
                              ⚠ Required
                            </span>
                          ) : (
                            <span className="tax-adj-m04-review-ok">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </CardV1>

      {/* Section 5: Review Status */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--review-status">
        <div className="tax-adj-m04-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m04-section__subtitle">
            Unresolved decisions requiring manual review.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m04-status tax-adj-m04-status--warning">
            <span className="tax-adj-m04-status__icon">⚠</span>
            <span className="tax-adj-m04-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m04-status tax-adj-m04-status--ok">
            <span className="tax-adj-m04-status__icon">✓</span>
            <span className="tax-adj-m04-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 6: Verification Checklist */}
      <CardV1 className="tax-adj-m04-section tax-adj-m04-section--verification">
        <div className="tax-adj-m04-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m04-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m04-checklist">
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              Building type is correctly identified from annual report notes
            </span>
          </li>
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              Acquisition value (not book value) is used as the depreciation
              base
            </span>
          </li>
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              Tax depreciation uses the fixed statutory rate, not 30%/20%
              methods (IL 19–20)
            </span>
          </li>
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              Any capital gain/loss is confirmed against sale proceeds in the
              annual report
            </span>
          </li>
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              If a property sale occurred, land and building components are
              separately valued
            </span>
          </li>
          <li className="tax-adj-m04-checklist__item">
            <span className="tax-adj-m04-checklist__marker">✓</span>
            <span>
              Capital losses are only deducted against capital gains — excess is
              carried forward
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
