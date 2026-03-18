import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

interface FundRecord {
  fundYear: number;
  amount: number;
  deadline: number;
  isMandatory: boolean;
  source: string;
}

const CURRENT_YEAR = 2025;
const REVERSAL_DEADLINE_YEARS = 6;

export function TaxAdjSubmodule25PeriodiseringsfondReversalV1({
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

  const balanceSheetLines = extraction?.taxDeep?.ink2rExtracted?.balanceSheet ?? [];
  const incomeStatementLines = extraction?.taxDeep?.ink2rExtracted?.incomeStatement ?? [];
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  const periodiseringsfonderAccounts = balanceSheetLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("211");
  });

  const reserveNotes = relevantNotes.filter(
    (note) => note.category === "reserve"
  );

  const fundRecords: FundRecord[] = reserveNotes
    .flatMap((note) => {
      const notes = note.notes ?? [];
      return notes.map((noteText) => {
        const fundYear = extractFundYearFromNote(noteText, CURRENT_YEAR);
        const deadline = fundYear + REVERSAL_DEADLINE_YEARS;
        const isMandatory = deadline <= CURRENT_YEAR;

        return {
          fundYear,
          amount: 0,
          deadline,
          isMandatory,
          source: note.title ?? "Reserve Fund",
        };
      });
    })
    .sort((a, b) => a.deadline - b.deadline);

  const schablonIncomeLines = incomeStatementLines.filter((line) => {
    const code = line.code ?? "";
    return code.startsWith("881") || code.startsWith("882");
  });

  const mandatoryReversalAmount = fundRecords
    .filter((fund) => fund.isMandatory)
    .reduce((sum, fund) => sum + fund.amount, 0);

  const totalReversalAmount = fundRecords.reduce((sum, fund) => sum + fund.amount, 0);

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
    <div className="tax-adj-m25-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--balance-sheet">
        <div className="tax-adj-m25-section__header">
          <h2>Outstanding Periodiseringsfonder (BS 211x)</h2>
          <p className="tax-adj-m25-section__subtitle">
            Balance sheet accounts for tax allocation reserves (periodiseringsfonder).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m25-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : periodiseringsfonderAccounts.length > 0 ? (
          <div className="tax-adj-m25-balance-sheet-table">
            <table className="tax-adj-m25-table">
              <thead className="tax-adj-m25-table__head">
                <tr>
                  <th className="tax-adj-m25-table__header">Account Code</th>
                  <th className="tax-adj-m25-table__header">Description</th>
                  <th className="tax-adj-m25-table__header">Current Year (SEK)</th>
                  <th className="tax-adj-m25-table__header">Prior Year (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m25-table__body">
                {periodiseringsfonderAccounts.map((line) => (
                  <tr key={line.code} className="tax-adj-m25-table__row">
                    <td className="tax-adj-m25-table__cell">{line.code}</td>
                    <td className="tax-adj-m25-table__cell">{line.label}</td>
                    <td className="tax-adj-m25-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m25-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m25-empty-message">
            No periodiseringsfonder accounts (211x) found in balance sheet.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--fund-register">
        <div className="tax-adj-m25-section__header">
          <h2>Fund Register and Reversal Status</h2>
          <p className="tax-adj-m25-section__subtitle">
            Outstanding funds with allocation year, reversal deadline, and mandatory
            reversal status per IL 30.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m25-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : fundRecords.length > 0 ? (
          <div className="tax-adj-m25-fund-register-table">
            <table className="tax-adj-m25-table">
              <thead className="tax-adj-m25-table__head">
                <tr>
                  <th className="tax-adj-m25-table__header">Fund Source</th>
                  <th className="tax-adj-m25-table__header">Allocation Year</th>
                  <th className="tax-adj-m25-table__header">Reversal Deadline</th>
                  <th className="tax-adj-m25-table__header">Status</th>
                  <th className="tax-adj-m25-table__header">Fund Age (Years)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m25-table__body">
                {fundRecords.map((fund, index) => {
                  const age = CURRENT_YEAR - fund.fundYear;
                  return (
                    <tr
                      key={index}
                      className={`tax-adj-m25-table__row ${
                        fund.isMandatory ? "tax-adj-m25-table__row--mandatory" : ""
                      }`}
                    >
                      <td className="tax-adj-m25-table__cell">{fund.source}</td>
                      <td className="tax-adj-m25-table__cell">{fund.fundYear}</td>
                      <td className="tax-adj-m25-table__cell">{fund.deadline}</td>
                      <td className="tax-adj-m25-table__cell">
                        {fund.isMandatory ? (
                          <span className="tax-adj-m25-badge tax-adj-m25-badge--mandatory">
                            Mandatory Reversal
                          </span>
                        ) : (
                          <span className="tax-adj-m25-badge tax-adj-m25-badge--voluntary">
                            Optional
                          </span>
                        )}
                      </td>
                      <td className="tax-adj-m25-table__cell">{age}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m25-empty-message">
            No fund records found in annual report notes.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--impact-summary">
        <div className="tax-adj-m25-section__header">
          <h2>Reversal Impact Summary</h2>
          <p className="tax-adj-m25-section__subtitle">
            Total reversal amounts and impact on taxable income (module 29).
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={120} />
        ) : (
          <div className="tax-adj-m25-summary-grid">
            <div className="tax-adj-m25-summary-item">
              <div className="tax-adj-m25-summary-label">Mandatory Reversals</div>
              <div className="tax-adj-m25-summary-value">
                {formatNumber(mandatoryReversalAmount)} SEK
              </div>
              <div className="tax-adj-m25-summary-meta">
                Funds ≥6 years old (must reverse by deadline)
              </div>
            </div>

            <div className="tax-adj-m25-summary-item">
              <div className="tax-adj-m25-summary-label">
                Voluntary Reversals (Not Selected)
              </div>
              <div className="tax-adj-m25-summary-value">0 SEK</div>
              <div className="tax-adj-m25-summary-meta">
                For funds &lt;6 years old, early reversal optional
              </div>
            </div>

            <div className="tax-adj-m25-summary-item tax-adj-m25-summary-item--total">
              <div className="tax-adj-m25-summary-label">Total Reversal Amount</div>
              <div className="tax-adj-m25-summary-value">
                {formatNumber(totalReversalAmount)} SEK
              </div>
              <div className="tax-adj-m25-summary-meta">
                Addition to taxable income, module 29
              </div>
            </div>
          </div>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--rules-explanation">
        <div className="tax-adj-m25-section__header">
          <h2>IL 30 Rules: Tax Allocation Reserve Reversal</h2>
          <p className="tax-adj-m25-section__subtitle">
            Legal framework and reversal requirements.
          </p>
        </div>

        <div className="tax-adj-m25-rules-content">
          <div className="tax-adj-m25-rule-item">
            <h3 className="tax-adj-m25-rule-item__title">Six-Year Reversal Rule</h3>
            <p className="tax-adj-m25-rule-item__text">
              Funds allocated in year Y must be reversed by the end of year Y+6 at
              the latest. This reversal is mandatory and increases taxable income
              in the reversal year.
            </p>
          </div>

          <div className="tax-adj-m25-rule-item">
            <h3 className="tax-adj-m25-rule-item__title">Voluntary Early Reversal</h3>
            <p className="tax-adj-m25-rule-item__text">
              A company may choose to reverse periodiseringsfonder before the
              mandatory deadline. Early reversal is permitted and follows the same
              income recognition principles as mandatory reversal.
            </p>
          </div>

          <div className="tax-adj-m25-rule-item">
            <h3 className="tax-adj-m25-rule-item__title">Impact on Taxable Income</h3>
            <p className="tax-adj-m25-rule-item__text">
              All reversals (mandatory and voluntary) are additions to taxable income
              and feed into the tax calculation as adjustments under module 29. They
              are reflected in the final tax basis.
            </p>
          </div>

          <div className="tax-adj-m25-rule-item">
            <h3 className="tax-adj-m25-rule-item__title">Documentation</h3>
            <p className="tax-adj-m25-rule-item__text">
              Supporting documentation for periodiseringsfonder should be maintained
              in the annual report notes or supplementary tax schedules. The fund
              allocation date and reversal timeline must be clearly traceable.
            </p>
          </div>
        </div>
      </CardV1>

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--income-statement">
        <div className="tax-adj-m25-section__header">
          <h2>Related Income Statement Lines</h2>
          <p className="tax-adj-m25-section__subtitle">
            Income statement items 881x (schablonintäkt) and 882x (reversal income)
            related to periodiseringsfonder.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m25-loading-grid">
            <SkeletonV1 height={60} />
          </div>
        ) : schablonIncomeLines.length > 0 ? (
          <div className="tax-adj-m25-income-statement-table">
            <table className="tax-adj-m25-table">
              <thead className="tax-adj-m25-table__head">
                <tr>
                  <th className="tax-adj-m25-table__header">Account Code</th>
                  <th className="tax-adj-m25-table__header">Description</th>
                  <th className="tax-adj-m25-table__header">Current Year (SEK)</th>
                  <th className="tax-adj-m25-table__header">Prior Year (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m25-table__body">
                {schablonIncomeLines.map((line) => (
                  <tr key={line.code} className="tax-adj-m25-table__row">
                    <td className="tax-adj-m25-table__cell">{line.code}</td>
                    <td className="tax-adj-m25-table__cell">{line.label}</td>
                    <td className="tax-adj-m25-table__cell">
                      {formatNumber(line.currentYearValue)}
                    </td>
                    <td className="tax-adj-m25-table__cell">
                      {formatNumber(line.priorYearValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tax-adj-m25-empty-message">
            No schablonintäkt (881x) or reversal income (882x) accounts found in
            income statement.
          </p>
        )}
      </CardV1>

      <CardV1 className="tax-adj-m25-section tax-adj-m25-section--verification">
        <div className="tax-adj-m25-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m25-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m25-checklist">
          <li className="tax-adj-m25-checklist__item">
            <span className="tax-adj-m25-checklist__marker">✓</span>
            <span>
              All periodiseringsfonder from balance sheet (211x) are accounted for
            </span>
          </li>
          <li className="tax-adj-m25-checklist__item">
            <span className="tax-adj-m25-checklist__marker">✓</span>
            <span>
              Fund allocation years and reversal deadlines are correctly estimated
              from supporting notes
            </span>
          </li>
          <li className="tax-adj-m25-checklist__item">
            <span className="tax-adj-m25-checklist__marker">✓</span>
            <span>
              Mandatory reversals (deadline ≤ current year) are clearly identified
            </span>
          </li>
          <li className="tax-adj-m25-checklist__item">
            <span className="tax-adj-m25-checklist__marker">✓</span>
            <span>
              Total reversal amount is correct and ready for addition to taxable
              income (module 29)
            </span>
          </li>
          <li className="tax-adj-m25-checklist__item">
            <span className="tax-adj-m25-checklist__marker">✓</span>
            <span>
              Related schablonintäkt and reversal income items (881x, 882x) are
              reviewed for consistency
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}

function extractFundYearFromNote(
  noteText: string,
  currentYear: number,
): number {
  const numberMatches = noteText.match(/\d{4}/g);
  if (numberMatches) {
    for (const match of numberMatches) {
      const year = parseInt(match, 10);
      if (year >= 1900 && year <= currentYear) {
        return year;
      }
    }
  }

  return currentYear - 3;
}
