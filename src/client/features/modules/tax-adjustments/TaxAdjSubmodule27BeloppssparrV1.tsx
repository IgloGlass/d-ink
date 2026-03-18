import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const BELOPPSPARR_KEYWORDS = [
  "beloppsspärr",
  "ägarskifte",
  "ownership change",
  "underskottsspärr",
];

function hasBeloppssparrKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return BELOPPSPARR_KEYWORDS.some((kw) => lower.includes(kw));
}

export function TaxAdjSubmodule27BeloppssparrV1({
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

  const beloppssparrNotes = relevantNotes.filter(
    (note) =>
      (note.title && hasBeloppssparrKeyword(note.title)) ||
      note.notes.some((n) => hasBeloppssparrKeyword(n))
  );

  const beloppssparrDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => hasBeloppssparrKeyword(decision.rationale ?? "")
  );

  const hasBeloppssparre = beloppssparrNotes.length > 0 || beloppssparrDecisions.length > 0;

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

  return (
    <div className="tax-adj-m27-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Beloppsspärr Status */}
      {isLoading ? (
        <CardV1 className="tax-adj-m27-section tax-adj-m27-section--status">
          <SkeletonV1 height={80} />
        </CardV1>
      ) : (
        <CardV1 className="tax-adj-m27-section tax-adj-m27-section--status">
          <div className="tax-adj-m27-section__header">
            <h2>Beloppsspärr Status</h2>
            <p className="tax-adj-m27-section__subtitle">
              Ownership change restriction on tax loss utilization (IL 40:10–15)
            </p>
          </div>

          {hasBeloppssparre ? (
            <div className="tax-adj-m27-warning-card" role="alert">
              <span className="tax-adj-m27-warning-card__icon">⚠</span>
              <div className="tax-adj-m27-warning-card__body">
                <p className="tax-adj-m27-warning-card__title">
                  Ownership change restrictions detected
                </p>
                <p className="tax-adj-m27-warning-card__message">
                  Evidence suggests that an ownership change (ägarskifte) may have
                  occurred. If ownership transfer exceeded 50%, restricted tax losses
                  (underskott) are subject to beloppsspärr: utilization is limited to
                  the acquisition price spread over 5 years. Unused annual ceiling is
                  lost.
                </p>
              </div>
            </div>
          ) : (
            <div className="tax-adj-m27-status-card tax-adj-m27-status-card--ok">
              <span className="tax-adj-m27-status-card__icon">✓</span>
              <span className="tax-adj-m27-status-card__text">
                Not applicable — no ownership change keywords detected in annual
                report or adjustment decisions. Proceed if ownership change did not
                occur.
              </span>
            </div>
          )}
        </CardV1>
      )}

      {/* Section 2: Evidence & Restrictions (only when beloppsspärr detected) */}
      {hasBeloppssparre ? (
        <>
          <CardV1 className="tax-adj-m27-section tax-adj-m27-section--evidence">
            <div className="tax-adj-m27-section__header">
              <h2>Evidence from Annual Report</h2>
              <p className="tax-adj-m27-section__subtitle">
                Ownership change references detected
              </p>
            </div>

            {isLoading ? (
              <div className="tax-adj-m27-loading-grid">
                <SkeletonV1 height={60} />
                <SkeletonV1 height={60} />
              </div>
            ) : beloppssparrNotes.length > 0 ? (
              <div className="tax-adj-m27-notes-list">
                {beloppssparrNotes.map((note, idx) => (
                  <div key={idx} className="tax-adj-m27-note">
                    {note.title ? (
                      <h3 className="tax-adj-m27-note__title">{note.title}</h3>
                    ) : null}
                    {note.noteReference ? (
                      <p className="tax-adj-m27-note__reference">
                        Note: {note.noteReference}
                      </p>
                    ) : null}
                    {note.notes.length > 0 ? (
                      <ul className="tax-adj-m27-note__content">
                        {note.notes.map((n, nIdx) => (
                          <li key={nIdx} className="tax-adj-m27-note__item">
                            {n}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {note.evidence.length > 0 ? (
                      <div className="tax-adj-m27-note__evidence">
                        <p className="tax-adj-m27-note__evidence-label">
                          Evidence from annual report:
                        </p>
                        <ul className="tax-adj-m27-note__evidence-list">
                          {note.evidence.map((ev, evIdx) => (
                            <li
                              key={evIdx}
                              className="tax-adj-m27-note__evidence-item"
                            >
                              {ev.section ? (
                                <span className="tax-adj-m27-note__evidence-section">
                                  {ev.section}
                                </span>
                              ) : null}
                              <span className="tax-adj-m27-note__evidence-snippet">
                                "{ev.snippet}"
                              </span>
                              {ev.page ? (
                                <span className="tax-adj-m27-note__evidence-page">
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
            ) : (
              <p className="tax-adj-m27-empty-message">
                No evidence notes found; verify ownership change date from company
                records.
              </p>
            )}
          </CardV1>

          <CardV1 className="tax-adj-m27-section tax-adj-m27-section--restriction-details">
            <div className="tax-adj-m27-section__header">
              <h2>Restriction Calculation</h2>
              <p className="tax-adj-m27-section__subtitle">
                IL 40:10 — Acquisition price basis divided by 5 years
              </p>
            </div>

            <div className="tax-adj-m27-restriction-info">
              <p className="tax-adj-m27-restriction-info__text">
                <strong>Annual ceiling calculation:</strong> Acquisition price ÷ 5
                years = maximum annual restricted underskott utilization
              </p>
              <p className="tax-adj-m27-restriction-info__text">
                <strong>AI cannot reliably determine acquisition price</strong> from
                the annual report. Manual entry is required.
              </p>

              <dl className="tax-adj-m27-definition-list">
                <dt className="tax-adj-m27-definition-list__term">
                  Acquisition price
                </dt>
                <dd className="tax-adj-m27-definition-list__definition">
                  [To be entered manually by accountant]
                </dd>

                <dt className="tax-adj-m27-definition-list__term">
                  Annual ceiling (acquisition price ÷ 5)
                </dt>
                <dd className="tax-adj-m27-definition-list__definition">
                  [Calculated once acquisition price is known]
                </dd>

                <dt className="tax-adj-m27-definition-list__term">
                  Maximum utilizable restricted underskott
                </dt>
                <dd className="tax-adj-m27-definition-list__definition">
                  Limited to annual ceiling; unused ceiling is forfeited
                </dd>

                <dt className="tax-adj-m27-definition-list__term">
                  Restriction period
                </dt>
                <dd className="tax-adj-m27-definition-list__definition">
                  5 years from acquisition date; lifts automatically after 5 years
                </dd>
              </dl>
            </div>
          </CardV1>

          <CardV1 className="tax-adj-m27-section tax-adj-m27-section--wasted-ceiling-warning">
            <div className="tax-adj-m27-section__header">
              <h2>Potential Ceiling Waste Warning</h2>
            </div>

            <div className="tax-adj-m27-wasted-ceiling-info">
              <p className="tax-adj-m27-wasted-ceiling-info__text">
                If taxable income for the current year is lower than the annual
                restriction ceiling, the unused portion of the ceiling will be
                forfeited and cannot be carried forward.
              </p>

              <div className="tax-adj-m27-wasted-ceiling-guidance">
                <p className="tax-adj-m27-wasted-ceiling-guidance__item">
                  <strong>Verify:</strong> Compare current year taxable income to
                  the calculated annual ceiling. If taxable income &lt; ceiling,
                  document the expected wasted amount.
                </p>
              </div>
            </div>
          </CardV1>
        </>
      ) : null}

      {/* Section 3: IL 40:10–15 Rules */}
      <CardV1 className="tax-adj-m27-section tax-adj-m27-section--il-rules">
        <div className="tax-adj-m27-section__header">
          <h2>IL 40:10–15 Ownership Change Restrictions</h2>
          <p className="tax-adj-m27-section__subtitle">
            Swedish tax law — beloppsspärr and underskottsspärr rules
          </p>
        </div>

        <div className="tax-adj-m27-rules-list">
          <div className="tax-adj-m27-rule">
            <h3 className="tax-adj-m27-rule__title">
              IL 40:10 — Beloppsspärr (Acquisition Price Restriction)
            </h3>
            <p className="tax-adj-m27-rule__content">
              When an ownership change occurs (transfer of more than 50% of voting
              rights), the acquired company's tax losses from before the acquisition
              may only be utilized up to the acquisition price, divided evenly over
              5 years. Any unused annual portion is lost permanently.
            </p>
          </div>

          <div className="tax-adj-m27-rule">
            <h3 className="tax-adj-m27-rule__title">
              IL 40:11–12 — Underskottsspärr (Ownership Change Lock-In)
            </h3>
            <p className="tax-adj-m27-rule__content">
              Pre-acquisition losses are further restricted in the first 5 years:
              they may only offset income from the original business operations, not
              from new activities or intra-group transfers.
            </p>
          </div>

          <div className="tax-adj-m27-rule">
            <h3 className="tax-adj-m27-rule__title">
              IL 40:13–15 — Timing and Calculation Details
            </h3>
            <p className="tax-adj-m27-rule__content">
              The 5-year restriction period begins on the acquisition date. The
              annual ceiling is calculated by dividing the acquisition price by 5,
              rounded according to standard rounding rules. If the company generates
              insufficient taxable income, the unused ceiling portion cannot be
              deferred; it is forfeited permanently.
            </p>
          </div>

          <div className="tax-adj-m27-rule">
            <h3 className="tax-adj-m27-rule__title">
              Interaction with Koncernbidrag (Group Contributions)
            </h3>
            <p className="tax-adj-m27-rule__content">
              Pre-acquisition losses cannot be utilized via group contributions
              during the 5-year restriction period. They must be applied directly
              against taxable income from the original operations.
            </p>
          </div>
        </div>
      </CardV1>

      {/* Section 4: Verification Checklist */}
      <CardV1 className="tax-adj-m27-section tax-adj-m27-section--verification">
        <div className="tax-adj-m27-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m27-section__subtitle">
            Confirm each item for beloppsspärr compliance (if applicable).
          </p>
        </div>

        <ul className="tax-adj-m27-checklist">
          <li className="tax-adj-m27-checklist__item">
            <span className="tax-adj-m27-checklist__marker">✓</span>
            <span>
              Ownership change date confirmed (when more than 50% voting rights
              transferred)
            </span>
          </li>
          <li className="tax-adj-m27-checklist__item">
            <span className="tax-adj-m27-checklist__marker">✓</span>
            <span>
              Acquisition price obtained from purchase agreement or valuation
            </span>
          </li>
          <li className="tax-adj-m27-checklist__item">
            <span className="tax-adj-m27-checklist__marker">✓</span>
            <span>
              Annual ceiling calculated (acquisition price ÷ 5); verified for
              reasonableness
            </span>
          </li>
          <li className="tax-adj-m27-checklist__item">
            <span className="tax-adj-m27-checklist__marker">✓</span>
            <span>
              Years remaining until restriction lifts documented (5-year lock-in
              period tracked)
            </span>
          </li>
          <li className="tax-adj-m27-checklist__item">
            <span className="tax-adj-m27-checklist__marker">✓</span>
            <span>
              Restricted underskott utilized only up to annual ceiling; excess
              documented as forfeited
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
