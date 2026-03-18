import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const PARTNERSHIP_KEYWORDS = [
  "handelsbolag",
  "kommanditbolag",
  "n3b",
  "partnership",
] as const;

function noteTextContainsPartnershipKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return PARTNERSHIP_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function TaxAdjSubmodule14PartnershipN3bV1({
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

  const partnershipDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "partnership_interest_n3b",
  );

  const partnershipReviewDecisions = partnershipDecisions.filter(
    (decision) => decision.reviewFlag,
  );

  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  const partnershipMentionedInNotes = relevantNotes.some((note) => {
    const titleMatch =
      note.title !== undefined && noteTextContainsPartnershipKeyword(note.title);
    const notesMatch = note.notes.some((noteText) =>
      noteTextContainsPartnershipKeyword(noteText),
    );
    const evidenceMatch = note.evidence.some(
      (ev) =>
        noteTextContainsPartnershipKeyword(ev.snippet) ||
        (ev.section !== undefined &&
          noteTextContainsPartnershipKeyword(ev.section)),
    );
    return titleMatch || notesMatch || evidenceMatch;
  });

  const partnershipDetected =
    partnershipReviewDecisions.length > 0 || partnershipMentionedInNotes;

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

  return (
    <div className="tax-adj-m14-container">
      {errorMessage !== null ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Partnership Detection Status */}
      <CardV1 className="tax-adj-m14-section tax-adj-m14-section--detection-status">
        <div className="tax-adj-m14-section__header">
          <h2>Partnership Detection Status</h2>
          <p className="tax-adj-m14-section__subtitle">
            Based on AI review decisions and annual report note analysis.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : partnershipDetected ? (
          <div
            className="tax-adj-m14-status tax-adj-m14-status--warning"
            role="alert"
          >
            <span className="tax-adj-m14-status__icon" aria-hidden="true">
              ⚠
            </span>
            <div className="tax-adj-m14-status__body">
              <strong className="tax-adj-m14-status__title">
                Partnership interest detected — N3B form required
              </strong>
              <p className="tax-adj-m14-status__description">
                The annual report contains references to a handelsbolag or
                kommanditbolag interest, or an AI review decision has flagged
                this module. The N3B form must be obtained and the company's
                proportional share of income, loss, and tax adjustments must be
                verified before filing.
              </p>
            </div>
          </div>
        ) : (
          <div className="tax-adj-m14-status tax-adj-m14-status--ok">
            <span className="tax-adj-m14-status__icon" aria-hidden="true">
              ✓
            </span>
            <div className="tax-adj-m14-status__body">
              <strong className="tax-adj-m14-status__title">
                No partnership interests detected in the annual report
              </strong>
              <p className="tax-adj-m14-status__description">
                If the company holds any handelsbolag or kommanditbolag
                interests not disclosed in the annual report, enter them
                manually below.
              </p>
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 2: N3B Guidance (always shown) */}
      <CardV1 className="tax-adj-m14-section tax-adj-m14-section--guidance">
        <div className="tax-adj-m14-section__header">
          <h2>N3B Guidance</h2>
          <p className="tax-adj-m14-section__subtitle">
            Swedish partnerships (HB/KB) are fiscally transparent. The partner
            company is taxed on its proportional share of the partnership's
            income or loss and must declare via form N3B. Review each item
            below.
          </p>
        </div>

        <ol className="tax-adj-m14-guidance-list">
          <li className="tax-adj-m14-guidance-list__item">
            <span className="tax-adj-m14-guidance-list__number">1</span>
            <span>
              Confirm the company's ownership share (%) in the partnership
            </span>
          </li>
          <li className="tax-adj-m14-guidance-list__item">
            <span className="tax-adj-m14-guidance-list__number">2</span>
            <span>
              Obtain the partnership's N3B form and identify the company's
              proportional share of income/loss for the fiscal year
            </span>
          </li>
          <li className="tax-adj-m14-guidance-list__item">
            <span className="tax-adj-m14-guidance-list__number">3</span>
            <span>
              Apply any tax adjustments that exist at partnership level to this
              company's proportional share
            </span>
          </li>
          <li className="tax-adj-m14-guidance-list__item">
            <span className="tax-adj-m14-guidance-list__number">4</span>
            <span>
              Manual entry for the N3B section in the INK2 form will be
              implemented in V2
            </span>
          </li>
        </ol>
      </CardV1>

      {/* Section 3: AI Review Decisions (shown only when decisions exist) */}
      {isLoading ? (
        <CardV1 className="tax-adj-m14-section tax-adj-m14-section--ai-decisions">
          <div className="tax-adj-m14-section__header">
            <h2>AI Review Decisions</h2>
          </div>
          <div className="tax-adj-m14-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        </CardV1>
      ) : partnershipDecisions.length > 0 ? (
        <CardV1 className="tax-adj-m14-section tax-adj-m14-section--ai-decisions">
          <div className="tax-adj-m14-section__header">
            <h2>AI Review Decisions</h2>
            <p className="tax-adj-m14-section__subtitle">
              Decisions produced for the partnership_interest_n3b module.
            </p>
          </div>

          <div className="tax-adj-m14-decisions-table">
            <table className="tax-adj-m14-table">
              <thead className="tax-adj-m14-table__head">
                <tr>
                  <th className="tax-adj-m14-table__header">Rationale</th>
                  <th className="tax-adj-m14-table__header">Status</th>
                  <th className="tax-adj-m14-table__header">Review flag</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m14-table__body">
                {partnershipDecisions.map((decision) => (
                  <tr key={decision.id} className="tax-adj-m14-table__row">
                    <td className="tax-adj-m14-table__cell">
                      {decision.rationale}
                    </td>
                    <td className="tax-adj-m14-table__cell">
                      {decision.status}
                    </td>
                    <td className="tax-adj-m14-table__cell">
                      {decision.reviewFlag ? (
                        <span
                          className="tax-adj-m14-review-flag"
                          aria-label="Review required"
                        >
                          ⚠
                        </span>
                      ) : (
                        <span
                          className="tax-adj-m14-review-ok"
                          aria-label="No review required"
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardV1>
      ) : null}

      {/* Section 4: Verification Checklist (always shown, static) */}
      <CardV1 className="tax-adj-m14-section tax-adj-m14-section--verification">
        <div className="tax-adj-m14-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m14-section__subtitle">
            Confirm each item before proceeding to the next module.
          </p>
        </div>

        <ul className="tax-adj-m14-checklist">
          <li className="tax-adj-m14-checklist__item">
            <span className="tax-adj-m14-checklist__marker" aria-hidden="true">
              ✓
            </span>
            <span>
              All handelsbolag and kommanditbolag interests are identified
            </span>
          </li>
          <li className="tax-adj-m14-checklist__item">
            <span className="tax-adj-m14-checklist__marker" aria-hidden="true">
              ✓
            </span>
            <span>
              The company's proportional share (%) in each partnership is
              confirmed
            </span>
          </li>
          <li className="tax-adj-m14-checklist__item">
            <span className="tax-adj-m14-checklist__marker" aria-hidden="true">
              ✓
            </span>
            <span>
              The partnership's N3B income/loss figure is obtained for the
              fiscal year
            </span>
          </li>
          <li className="tax-adj-m14-checklist__item">
            <span className="tax-adj-m14-checklist__marker" aria-hidden="true">
              ✓
            </span>
            <span>
              Tax adjustments at partnership level have been reviewed and
              applied
            </span>
          </li>
          <li className="tax-adj-m14-checklist__item">
            <span className="tax-adj-m14-checklist__marker" aria-hidden="true">
              ✓
            </span>
            <span>
              If no partnership interests exist: confirmed with certainty (not
              just "none found in annual report")
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
