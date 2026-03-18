import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import { getActiveAnnualReportExtractionV1 } from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

export function TaxAdjSubmodule06CfcV1({
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

  const extraction = extractionQuery.data?.extraction;

  const foreignSubsidiariesContext =
    extraction?.taxDeep?.foreignSubsidiariesContext;
  const cfcRiskFlag = foreignSubsidiariesContext?.cfcRiskFlag;
  const entities = foreignSubsidiariesContext?.entities ?? [];
  const contextNotes = foreignSubsidiariesContext?.notes ?? [];

  const isLoading = extractionQuery.isPending;

  const errorMessage = extractionQuery.isError
    ? toUserFacingErrorMessage(extractionQuery.error)
    : null;

  const formatOwnership = (value: number | undefined): string => {
    if (value === undefined || value === null) {
      return "-";
    }
    return `${value.toFixed(1)} %`;
  };

  return (
    <div className="tax-adj-m06-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: CFC Risk Assessment */}
      <CardV1 className="tax-adj-m06-section tax-adj-m06-section--risk-assessment">
        <div className="tax-adj-m06-section__header">
          <h2>CFC Risk Assessment</h2>
          <p className="tax-adj-m06-section__subtitle">
            Controlled Foreign Company (CFC) risk based on annual report
            extraction. Governed by IL 39a.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m06-loading-grid">
            <SkeletonV1 height={72} />
          </div>
        ) : cfcRiskFlag === true ? (
          <div className="tax-adj-m06-risk-banner tax-adj-m06-risk-banner--warning">
            <span className="tax-adj-m06-risk-banner__icon">⚠</span>
            <div className="tax-adj-m06-risk-banner__body">
              <strong className="tax-adj-m06-risk-banner__title">
                CFC risk identified
              </strong>
              <p className="tax-adj-m06-risk-banner__text">
                One or more foreign subsidiaries may be subject to CFC
                inclusion under IL 39a. Review each flagged entity below and
                verify the applicable exemptions.
              </p>
            </div>
          </div>
        ) : (
          <div className="tax-adj-m06-risk-banner tax-adj-m06-risk-banner--ok">
            <span className="tax-adj-m06-risk-banner__icon">✓</span>
            <div className="tax-adj-m06-risk-banner__body">
              <strong className="tax-adj-m06-risk-banner__title">
                No CFC risk identified
              </strong>
              <p className="tax-adj-m06-risk-banner__text">
                The annual report extraction did not flag any foreign
                subsidiaries as potential CFC entities. No further action is
                required unless new information becomes available.
              </p>
            </div>
          </div>
        )}
      </CardV1>

      {/* Section 2: Foreign Entities (shown only when cfcRiskFlag is true) */}
      {cfcRiskFlag === true ? (
        <CardV1 className="tax-adj-m06-section tax-adj-m06-section--entities">
          <div className="tax-adj-m06-section__header">
            <h2>Foreign Entities</h2>
            <p className="tax-adj-m06-section__subtitle">
              Subsidiaries and associates identified in the annual report.
              Ownership threshold for IL 39a: ≥25%.
            </p>
          </div>

          {isLoading ? (
            <div className="tax-adj-m06-loading-grid">
              <SkeletonV1 height={60} />
              <SkeletonV1 height={60} />
            </div>
          ) : entities.length > 0 ? (
            <div className="tax-adj-m06-entities-table">
              <table className="tax-adj-m06-table">
                <thead className="tax-adj-m06-table__head">
                  <tr>
                    <th className="tax-adj-m06-table__header">Entity name</th>
                    <th className="tax-adj-m06-table__header">Country</th>
                    <th className="tax-adj-m06-table__header">
                      Ownership (%)
                    </th>
                    <th className="tax-adj-m06-table__header">Notes</th>
                  </tr>
                </thead>
                <tbody className="tax-adj-m06-table__body">
                  {entities.map((entity, index) => (
                    <tr key={index} className="tax-adj-m06-table__row">
                      <td className="tax-adj-m06-table__cell">
                        {entity.entityName ?? "—"}
                      </td>
                      <td className="tax-adj-m06-table__cell">
                        {entity.country ?? "—"}
                      </td>
                      <td className="tax-adj-m06-table__cell">
                        {formatOwnership(entity.ownershipPercentage)}
                      </td>
                      <td className="tax-adj-m06-table__cell">
                        {entity.notes.length > 0
                          ? entity.notes.join("; ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tax-adj-m06-empty-message">
              No individual entity details were extracted from the annual
              report.
            </p>
          )}
        </CardV1>
      ) : null}

      {/* Section 3: Guidance (shown only when cfcRiskFlag is true) */}
      {cfcRiskFlag === true ? (
        <CardV1 className="tax-adj-m06-section tax-adj-m06-section--guidance">
          <div className="tax-adj-m06-section__header">
            <h2>IL 39a Guidance</h2>
            <p className="tax-adj-m06-section__subtitle">
              Legal framework and verification steps for each flagged entity.
            </p>
          </div>

          <div className="tax-adj-m06-guidance-body">
            <p className="tax-adj-m06-guidance-rule">
              <strong>IL 39a may apply to each entity listed above.</strong>{" "}
              Please verify the following for each entity:
            </p>

            <ol className="tax-adj-m06-guidance-steps">
              <li className="tax-adj-m06-guidance-step">
                <strong>Effective foreign tax rate</strong> — The CFC rules
                apply only when the foreign company is subject to a low
                effective tax rate. The threshold is approximately 11.3%
                (55% of the Swedish corporate rate of 20.6%). An effective
                rate at or above 11.3% generally exempts the entity.
              </li>
              <li className="tax-adj-m06-guidance-step">
                <strong>Skatteverket white list</strong> — Verify whether the
                entity's jurisdiction appears on Skatteverket's approved list
                of countries exempt from CFC inclusion. White-listed
                jurisdictions are presumed to meet the effective-rate test.
              </li>
              <li className="tax-adj-m06-guidance-step">
                <strong>EEA exemption</strong> — Companies resident within the
                EEA (European Economic Area) and genuinely established there
                are generally exempt from CFC inclusion under EU law
                compatibility rules. Confirm that the entity is not a
                letterbox arrangement.
              </li>
              <li className="tax-adj-m06-guidance-step">
                <strong>Proportional income share</strong> — If CFC inclusion
                applies, the Swedish company must include its proportional
                share of the foreign entity's income in Swedish taxable income
                for the fiscal year.
              </li>
            </ol>

            <div className="tax-adj-m06-guidance-note tax-adj-m06-guidance-note--v2">
              <span className="tax-adj-m06-guidance-note__label">
                Manual entry (V2)
              </span>
              <span className="tax-adj-m06-guidance-note__text">
                Direct input of the CFC income share for INK2 will be
                available in V2. For now, compute the proportional share
                offline and enter it manually in the INK2 CFC section.
              </span>
            </div>
          </div>
        </CardV1>
      ) : null}

      {/* Section 4: Context Notes */}
      {contextNotes.length > 0 ? (
        <CardV1 className="tax-adj-m06-section tax-adj-m06-section--context-notes">
          <div className="tax-adj-m06-section__header">
            <h2>Context Notes</h2>
            <p className="tax-adj-m06-section__subtitle">
              Notes extracted from the annual report regarding foreign
              subsidiaries.
            </p>
          </div>

          {isLoading ? (
            <div className="tax-adj-m06-loading-grid">
              <SkeletonV1 height={60} />
            </div>
          ) : (
            <ul className="tax-adj-m06-notes-list">
              {contextNotes.map((note, index) => (
                <li key={index} className="tax-adj-m06-notes-list__item">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </CardV1>
      ) : null}

      {/* Section 5: Verification Checklist */}
      <CardV1 className="tax-adj-m06-section tax-adj-m06-section--verification">
        <div className="tax-adj-m06-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m06-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m06-checklist">
          <li className="tax-adj-m06-checklist__item">
            <span className="tax-adj-m06-checklist__marker">✓</span>
            <span>
              All foreign subsidiaries and associates identified in the annual
              report are reviewed
            </span>
          </li>
          <li className="tax-adj-m06-checklist__item">
            <span className="tax-adj-m06-checklist__marker">✓</span>
            <span>
              EEA-resident entities are confirmed as exempt from IL 39a
            </span>
          </li>
          <li className="tax-adj-m06-checklist__item">
            <span className="tax-adj-m06-checklist__marker">✓</span>
            <span>
              Effective foreign tax rate for flagged entities verified —
              ≥11.3% qualifies as exempt
            </span>
          </li>
          <li className="tax-adj-m06-checklist__item">
            <span className="tax-adj-m06-checklist__marker">✓</span>
            <span>
              Jurisdiction confirmed against Skatteverket's approved white
              list
            </span>
          </li>
          <li className="tax-adj-m06-checklist__item">
            <span className="tax-adj-m06-checklist__marker">✓</span>
            <span>
              If CFC income applies: proportional share is computed and ready
              for manual entry in the INK2 CFC section
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
