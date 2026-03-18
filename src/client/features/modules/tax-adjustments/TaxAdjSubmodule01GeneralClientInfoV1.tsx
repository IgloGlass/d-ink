import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ButtonV1 } from "../../../components/button-v1";
import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import {
  toUserFacingErrorMessage,
} from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  type GetActiveAnnualReportExtractionResponseV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

type PeriodiseringsfonderRowV1 = {
  year: number;
  amount: number;
};

export function TaxAdjSubmodule01GeneralClientInfoV1({
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

  const [isPartOfGroup, setIsPartOfGroup] = useState(false);
  const [periodiseringsfonder, setPeriodiseringsfonder] = useState<
    PeriodiseringsfonderRowV1[]
  >([]);
  const [underskott, setUnderskott] = useState("");
  const [ownershipChangeOccurred, setOwnershipChangeOccurred] =
    useState(false);

  const extraction = extractionQuery.data?.extraction;
  const companyName = extraction?.fields.companyName.value ?? "";
  const organizationNumber = extraction?.fields.organizationNumber.value ?? "";
  const fiscalYearStart = extraction?.fields.fiscalYearStart.value ?? "";
  const fiscalYearEnd = extraction?.fields.fiscalYearEnd.value ?? "";
  const accountingStandard =
    extraction?.fields.accountingStandard.value ?? "";

  const errorMessage =
    extractionQuery.isError && extractionQuery.error
      ? toUserFacingErrorMessage(extractionQuery.error)
      : null;

  const handleAddPeriodiseringsfonderRow = () => {
    setPeriodiseringsfonder([
      ...periodiseringsfonder,
      { year: new Date().getFullYear() - 1, amount: 0 },
    ]);
  };

  const handleRemovePeriodiseringsfonderRow = (index: number) => {
    setPeriodiseringsfonder(
      periodiseringsfonder.filter((_, i) => i !== index),
    );
  };

  const handleUpdatePeriodiseringsfonderRow = (
    index: number,
    field: "year" | "amount",
    value: string,
  ) => {
    const updated = [...periodiseringsfonder];
    if (field === "year") {
      updated[index].year = parseInt(value, 10) || 0;
    } else {
      updated[index].amount = parseFloat(value) || 0;
    }
    setPeriodiseringsfonder(updated);
  };

  return (
    <div className="tax-adj-m01-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m01-section tax-adj-m01-section--company">
        <div className="tax-adj-m01-section__header">
          <h2>Company Information</h2>
          <p className="tax-adj-m01-section__subtitle">
            Pre-filled from annual report. Review for accuracy.
          </p>
        </div>

        {extractionQuery.isPending ? (
          <div className="tax-adj-m01-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : (
          <div className="tax-adj-m01-fields-grid">
            <div className="tax-adj-m01-field">
              <label className="tax-adj-m01-field__label">Company Name</label>
              <div className="tax-adj-m01-field__value">{companyName}</div>
            </div>
            <div className="tax-adj-m01-field">
              <label className="tax-adj-m01-field__label">
                Organization Number
              </label>
              <div className="tax-adj-m01-field__value">
                {organizationNumber}
              </div>
            </div>
            <div className="tax-adj-m01-field">
              <label className="tax-adj-m01-field__label">
                Fiscal Year Start
              </label>
              <div className="tax-adj-m01-field__value">{fiscalYearStart}</div>
            </div>
            <div className="tax-adj-m01-field">
              <label className="tax-adj-m01-field__label">
                Fiscal Year End
              </label>
              <div className="tax-adj-m01-field__value">{fiscalYearEnd}</div>
            </div>
            <div className="tax-adj-m01-field">
              <label className="tax-adj-m01-field__label">
                Accounting Standard
              </label>
              <div className="tax-adj-m01-field__value">
                {accountingStandard}
              </div>
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m01-section tax-adj-m01-section--group">
        <div className="tax-adj-m01-section__header">
          <h2>Group Structure</h2>
          <p className="tax-adj-m01-section__subtitle">
            Is the company part of a group?
          </p>
        </div>

        <div className="tax-adj-m01-toggle-field">
          <label className="tax-adj-m01-toggle">
            <input
              type="checkbox"
              checked={isPartOfGroup}
              onChange={(e) => setIsPartOfGroup(e.target.checked)}
              className="tax-adj-m01-toggle__input"
            />
            <span className="tax-adj-m01-toggle__label">
              This company is part of a corporate group
            </span>
          </label>
        </div>
      </CardV1>

      <CardV1 className="tax-adj-m01-section tax-adj-m01-section--periodiseringsfonder">
        <div className="tax-adj-m01-section__header">
          <h2>Periodiseringsfonder from Prior Years</h2>
          <p className="tax-adj-m01-section__subtitle">
            Required for module 17 (Schablonintäkt). Add rows for each prior
            year with allocated amounts.
          </p>
        </div>

        <div className="tax-adj-m01-table-container">
          <table className="tax-adj-m01-table">
            <thead className="tax-adj-m01-table__head">
              <tr>
                <th className="tax-adj-m01-table__header">Year</th>
                <th className="tax-adj-m01-table__header">Amount (SEK)</th>
                <th className="tax-adj-m01-table__header">Action</th>
              </tr>
            </thead>
            <tbody className="tax-adj-m01-table__body">
              {periodiseringsfonder.map((row, index) => (
                <tr key={index} className="tax-adj-m01-table__row">
                  <td className="tax-adj-m01-table__cell">
                    <input
                      type="number"
                      value={row.year}
                      onChange={(e) =>
                        handleUpdatePeriodiseringsfonderRow(
                          index,
                          "year",
                          e.target.value,
                        )
                      }
                      className="tax-adj-m01-table__input"
                    />
                  </td>
                  <td className="tax-adj-m01-table__cell">
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) =>
                        handleUpdatePeriodiseringsfonderRow(
                          index,
                          "amount",
                          e.target.value,
                        )
                      }
                      className="tax-adj-m01-table__input"
                    />
                  </td>
                  <td className="tax-adj-m01-table__cell">
                    <ButtonV1
                      variant="secondary"
                      onClick={() => handleRemovePeriodiseringsfonderRow(index)}
                    >
                      Remove
                    </ButtonV1>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tax-adj-m01-section__actions">
          <ButtonV1 variant="secondary" onClick={handleAddPeriodiseringsfonderRow}>
            Add Row
          </ButtonV1>
        </div>

        <p className="tax-adj-m01-notice">
          This data will be included in the next adjustment run.
        </p>
      </CardV1>

      <CardV1 className="tax-adj-m01-section tax-adj-m01-section--underskott">
        <div className="tax-adj-m01-section__header">
          <h2>Tax Loss Carry-Forward (Underskott)</h2>
          <p className="tax-adj-m01-section__subtitle">
            Required for module 24. Enter the accumulated tax loss amount.
          </p>
        </div>

        <div className="tax-adj-m01-field">
          <label className="tax-adj-m01-field__label">
            Tax Loss Amount (SEK)
          </label>
          <input
            type="number"
            value={underskott}
            onChange={(e) => setUnderskott(e.target.value)}
            className="tax-adj-m01-field__input"
            placeholder="0"
          />
        </div>

        <div className="tax-adj-m01-toggle-field">
          <label className="tax-adj-m01-toggle">
            <input
              type="checkbox"
              checked={ownershipChangeOccurred}
              onChange={(e) => setOwnershipChangeOccurred(e.target.checked)}
              className="tax-adj-m01-toggle__input"
            />
            <span className="tax-adj-m01-toggle__label">
              An ownership change occurred this year (triggers underskottsspärr
              warning)
            </span>
          </label>
        </div>

        <p className="tax-adj-m01-notice">
          This data will be included in the next adjustment run.
        </p>
      </CardV1>

      <CardV1 className="tax-adj-m01-section tax-adj-m01-section--verification">
        <div className="tax-adj-m01-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m01-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m01-checklist">
          <li className="tax-adj-m01-checklist__item">
            <span className="tax-adj-m01-checklist__marker">✓</span>
            <span>
              Pre-filled company data matches the Swedish Tax Authority's
              records
            </span>
          </li>
          <li className="tax-adj-m01-checklist__item">
            <span className="tax-adj-m01-checklist__marker">✓</span>
            <span>
              All prior-year periodiseringsfonder allocations have been entered
              (check last year's tax return)
            </span>
          </li>
          <li className="tax-adj-m01-checklist__item">
            <span className="tax-adj-m01-checklist__marker">✓</span>
            <span>Tax loss carry-forward amount is correct</span>
          </li>
          <li className="tax-adj-m01-checklist__item">
            <span className="tax-adj-m01-checklist__marker">✓</span>
            <span>
              Group structure flag correctly reflects the company's ownership
              situation
            </span>
          </li>
          <li className="tax-adj-m01-checklist__item">
            <span className="tax-adj-m01-checklist__marker">✓</span>
            <span>
              If an ownership change occurred, the acquisition date and price
              are available for module 24
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
