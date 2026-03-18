import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule24TaxLossesV1({
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

  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];
  const balanceSheetLines =
    extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];

  const underskottNotes = relevantNotes.filter(
    (note) =>
      note.category === "deferred_tax_loss_carryforwards" ||
      (note.title &&
        (note.title.toLowerCase().includes("underskott") ||
          note.title.toLowerCase().includes("tax loss") ||
          note.title.toLowerCase().includes("förlust"))) ||
      note.notes.some(
        (n) =>
          n.toLowerCase().includes("underskott") ||
          n.toLowerCase().includes("tax loss") ||
          n.toLowerCase().includes("förlust") ||
          n.toLowerCase().includes("deferred tax") ||
          n.toLowerCase().includes("uppskjuten skattefordran")
      )
  );

  const deferredTaxAssetAccounts = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("134");
  });

  // No dedicated module code for tax losses; match by rationale keywords
  const taxLossDecisions = (adjustments?.decisions ?? []).filter((decision) => {
    const r = (decision.rationale ?? "").toLowerCase();
    return (
      r.includes("underskott") ||
      r.includes("tax loss") ||
      r.includes("förlust") ||
      r.includes("carry") ||
      r.includes("beloppsspärr")
    );
  });

  const unreviewed = taxLossDecisions.filter(
    (decision) => decision.status === "manual_review_required"
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
      | "informational"
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
    <div className="tax-adj-m24-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--ai-prefill">
        <div className="tax-adj-m24-section__header">
          <h2>AI Pre-fill from Annual Report</h2>
          <p className="tax-adj-m24-section__subtitle">
            AI has extracted underskott (tax loss carry-forward) information
            from the annual report notes.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m24-loading-grid">
            <SkeletonV1 height={80} />
          </div>
        ) : underskottNotes.length > 0 ? (
          <>
            <div className="tax-adj-m24-ai-notice">
              <span className="tax-adj-m24-ai-notice__icon">ℹ</span>
              <p className="tax-adj-m24-ai-notice__text">
                AI has extracted the following underskott information from the
                annual report. Verify this matches the actual underskott
                register from prior tax returns.
              </p>
            </div>
            <div className="tax-adj-m24-notes-list">
              {underskottNotes.map((note, idx) => (
                <div key={idx} className="tax-adj-m24-note">
                  {note.title ? (
                    <h3 className="tax-adj-m24-note__title">{note.title}</h3>
                  ) : null}
                  {note.noteReference ? (
                    <p className="tax-adj-m24-note__reference">
                      Note: {note.noteReference}
                    </p>
                  ) : null}
                  <ul className="tax-adj-m24-note__content">
                    {note.notes.map((n, nIdx) => (
                      <li key={nIdx} className="tax-adj-m24-note__item">
                        {n}
                      </li>
                    ))}
                  </ul>
                  {note.evidence.length > 0 ? (
                    <div className="tax-adj-m24-note__evidence">
                      <p className="tax-adj-m24-note__evidence-label">
                        Evidence from annual report:
                      </p>
                      <ul className="tax-adj-m24-note__evidence-list">
                        {note.evidence.map((ev, evIdx) => (
                          <li key={evIdx} className="tax-adj-m24-note__evidence-item">
                            {ev.section ? (
                              <span className="tax-adj-m24-note__evidence-section">
                                {ev.section}
                              </span>
                            ) : null}
                            <span className="tax-adj-m24-note__evidence-snippet">
                              "{ev.snippet}"
                            </span>
                            {ev.page ? (
                              <span className="tax-adj-m24-note__evidence-page">
                                (p. {ev.page})
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="tax-adj-m24-empty-notice">
            <p className="tax-adj-m24-empty-notice__text">
              No underskott references found in the annual report — verify
              manually by reviewing the prior-year tax return and any current
              year losses.
            </p>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--deferred-tax">
        <div className="tax-adj-m24-section__header">
          <h2>Deferred Tax Asset Accounts</h2>
          <p className="tax-adj-m24-section__subtitle">
            Deferred tax asset at 20.6% on underskott. Implicit underskott =
            deferred tax asset / 20.6%
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m24-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : deferredTaxAssetAccounts.length > 0 ? (
          <div className="tax-adj-m24-accounts-table">
            <table className="tax-adj-m24-table">
              <thead className="tax-adj-m24-table__head">
                <tr>
                  <th className="tax-adj-m24-table__header">Code</th>
                  <th className="tax-adj-m24-table__header">Label</th>
                  <th className="tax-adj-m24-table__header">
                    Current Year (SEK)
                  </th>
                  <th className="tax-adj-m24-table__header">
                    Prior Year (SEK)
                  </th>
                </tr>
              </thead>
              <tbody className="tax-adj-m24-table__body">
                {deferredTaxAssetAccounts.map((line) => (
                  <tr key={line.code} className="tax-adj-m24-table__row">
                    <td className="tax-adj-m24-table__cell">{line.code}</td>
                    <td className="tax-adj-m24-table__cell">{line.label}</td>
                    <td className="tax-adj-m24-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m24-empty-message">
            No deferred tax asset accounts (134xx) found in the balance sheet.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--il-rules">
        <div className="tax-adj-m24-section__header">
          <h2>IL 40 Rules — Tax Loss Carry-Forward</h2>
          <p className="tax-adj-m24-section__subtitle">
            Swedish tax law provisions governing underskott utilization and
            restrictions.
          </p>
        </div>

        <div className="tax-adj-m24-rules-list">
          <div className="tax-adj-m24-rule">
            <h3 className="tax-adj-m24-rule__title">
              Indefinite Carry-Forward (IL 40)
            </h3>
            <p className="tax-adj-m24-rule__content">
              Underskott carries forward indefinitely — no time limit in Swedish
              tax law. Tax losses may be utilized in any subsequent year against
              taxable income.
            </p>
          </div>

          <div className="tax-adj-m24-rule">
            <h3 className="tax-adj-m24-rule__title">
              Underskottsspärr — Ownership Change Restriction (IL 40:10)
            </h3>
            <p className="tax-adj-m24-rule__content">
              If an ownership change ({'>'} 50% change in ownership) occurred, the
              utilization of underskott acquired before the change is restricted
              for 5 years following the acquisition. The utilization is limited
              to the acquisition price (beloppsspärr). After 5 years, remaining
              losses may be utilized without restriction.
            </p>
          </div>

          <div className="tax-adj-m24-rule">
            <h3 className="tax-adj-m24-rule__title">
              Koncernbidragsspärr — Group Contribution Restriction (IL 40:18)
            </h3>
            <p className="tax-adj-m24-rule__content">
              After an ownership change, underskott from before the acquisition
              can only be offset against income from the same business
              operations for 5 years. Group contributions cannot be used to
              utilize acquired losses during this period.
            </p>
          </div>

          <div className="tax-adj-m24-rule">
            <h3 className="tax-adj-m24-rule__title">
              Debt Forgiveness Impact (IL 40:21)
            </h3>
            <p className="tax-adj-m24-rule__content">
              Any ackord (debt forgiveness) in the current year reduces the
              underskott register by the amount forgiven. This reduction occurs
              before calculating the utilizable underskott.
            </p>
          </div>
        </div>
      </CardV1>

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--decisions">
        <div className="tax-adj-m24-section__header">
          <h2>AI Adjustment Decisions</h2>
          <p className="tax-adj-m24-section__subtitle">
            Proposed adjustments to underskott utilization and carry-forward.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m24-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : taxLossDecisions.length > 0 ? (
          <div className="tax-adj-m24-decisions-table">
            <table className="tax-adj-m24-table">
              <thead className="tax-adj-m24-table__head">
                <tr>
                  <th className="tax-adj-m24-table__header">
                    Amount (SEK)
                  </th>
                  <th className="tax-adj-m24-table__header">Direction</th>
                  <th className="tax-adj-m24-table__header">Rationale</th>
                  <th className="tax-adj-m24-table__header">Confidence</th>
                  <th className="tax-adj-m24-table__header">Status</th>
                  <th className="tax-adj-m24-table__header">Review</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m24-table__body">
                {taxLossDecisions.map((decision) => (
                  <tr key={decision.id} className="tax-adj-m24-table__row">
                    <td className="tax-adj-m24-table__cell">
                      {formatNumber(decision.amount)}
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {getDirectionLabel(decision.direction)}
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {decision.rationale}
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {Math.round(decision.confidence * 100)}%
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {decision.status}
                    </td>
                    <td className="tax-adj-m24-table__cell">
                      {decision.reviewFlag ? (
                        <span className="tax-adj-m24-review-flag">⚠</span>
                      ) : (
                        <span className="tax-adj-m24-review-ok">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m24-empty-message">
            No adjustment decisions for tax losses module.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--review-status">
        <div className="tax-adj-m24-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m24-section__subtitle">
            Validation of unresolved adjustment decisions.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewed.length > 0 ? (
          <div className="tax-adj-m24-status tax-adj-m24-status--warning">
            <span className="tax-adj-m24-status__icon">⚠</span>
            <span className="tax-adj-m24-status__text">
              {unreviewed.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m24-status tax-adj-m24-status--ok">
            <span className="tax-adj-m24-status__icon">✓</span>
            <span className="tax-adj-m24-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m24-section tax-adj-m24-section--verification">
        <div className="tax-adj-m24-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m24-section__subtitle">
            Confirm each item before proceeding to module 23.
          </p>
        </div>

        <ul className="tax-adj-m24-checklist">
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              Prior-year underskott register obtained from last year's tax
              return (not just the annual report)
            </span>
          </li>
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              If ownership change occurred: acquisition price documented for
              beloppsspärr (IL 40:10) calculation
            </span>
          </li>
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              If applicable, ownership change restrictions (underskottsspärr and
              koncernbidragsspärr) applied correctly for prior-year losses
            </span>
          </li>
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              Any debt forgiveness (ackord) from module 7 has reduced the
              underskott register accordingly (IL 40:21)
            </span>
          </li>
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              AI-extracted underskott amount from deferred tax asset reconciled
              with the actual underskott register
            </span>
          </li>
          <li className="tax-adj-m24-checklist__item">
            <span className="tax-adj-m24-checklist__marker">✓</span>
            <span>
              Underskott utilization amount for current year confirmed before
              proceeding to module 23
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
