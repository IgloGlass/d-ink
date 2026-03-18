import { useQuery } from "@tanstack/react-query";

import { CardV1 } from "../../../components/card-v1";
import { SkeletonV1 } from "../../../components/skeleton-v1";
import { toUserFacingErrorMessage } from "../../../lib/http/api-client";
import {
  getActiveAnnualReportExtractionV1,
  getActiveTaxAdjustmentsV1,
} from "../../../lib/http/workspace-api";
import type { TaxAdjSubmoduleContentPropsV1 } from "../tax-adjustment-submodule-content-map.v1";

const LONESKATT_RATE = 0.2426;
const LONESKATT_RATE_DISPLAY = "24.26%";
const PBB_LIMIT_FY2025 = 588_000;
const PBB_LIMIT_FY2026 = 592_000;
const DISCREPANCY_THRESHOLD = 0.01;

export function TaxAdjSubmodule11PensionCostsV1({
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
  const pensionContext = extraction?.taxDeep?.pensionContext;
  const relevantNotes = extraction?.taxDeep?.relevantNotes ?? [];

  const pensionBalanceSheetAccounts = balanceSheetLines.filter((line) =>
    line.code.startsWith("294"),
  );

  const pensionIncomeStatementAccounts = incomeStatementLines.filter(
    (line) => line.code.startsWith("740") || line.code.startsWith("753"),
  );

  const pensionDecisions = (adjustments?.decisions ?? []).filter(
    (decision) => decision.module === "pension_costs_and_special_payroll_tax",
  );

  const pensionNotes = relevantNotes.filter(
    (note) => note.category === "pension",
  );

  const account740Line = pensionIncomeStatementAccounts.find((line) =>
    line.code.startsWith("740"),
  );
  const account753Line = pensionIncomeStatementAccounts.find((line) =>
    line.code.startsWith("753"),
  );

  const booked740Amount = account740Line?.currentYearValue ?? 0;
  const booked753Amount = account753Line?.currentYearValue ?? 0;

  const computedLoneskatt = Math.round(Math.abs(booked740Amount) * LONESKATT_RATE);
  const bookedLoneskattAbs = Math.abs(booked753Amount);
  const loneskattDiscrepancy =
    computedLoneskatt > 0
      ? Math.abs(computedLoneskatt - bookedLoneskattAbs) / computedLoneskatt
      : 0;
  const hasLoneskattDiscrepancy = loneskattDiscrepancy > DISCREPANCY_THRESHOLD;

  const direktpensionFlag = pensionContext?.flags.find(
    (flag) => flag.code === "direktpension",
  );
  const isDirektpensionFlagged = direktpensionFlag?.value === true;

  const ink2Basis14 = Math.abs(booked740Amount);
  const ink2Basis421 = ink2Basis14;

  const unreviewedDecisions = pensionDecisions.filter(
    (decision) => decision.status === "manual_review_required",
  );

  const isLoading = extractionQuery.isPending || adjustmentsQuery.isPending;

  const errorMessage =
    extractionQuery.isError || adjustmentsQuery.isError
      ? extractionQuery.error
        ? toUserFacingErrorMessage(extractionQuery.error)
        : adjustmentsQuery.error
          ? toUserFacingErrorMessage(adjustmentsQuery.error)
          : "An unknown error occurred"
      : null;

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
    <div className="tax-adj-m11-container">
      {errorMessage ? (
        <div className="workspace-inline-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Section 1: Pension Cost Accounts */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--accounts">
        <div className="tax-adj-m11-section__header">
          <h2>Pension Cost Accounts</h2>
          <p className="tax-adj-m11-section__subtitle">
            Balance sheet account 294x (accrued löneskatt on pension) and income
            statement accounts 740x (pensionskostnader) and 753x (löneskatt på
            pensionskostnader).
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m11-loading-grid">
            <SkeletonV1 height={60} />
            <SkeletonV1 height={60} />
          </div>
        ) : pensionBalanceSheetAccounts.length > 0 ||
          pensionIncomeStatementAccounts.length > 0 ? (
          <>
            {pensionBalanceSheetAccounts.length > 0 ? (
              <div className="tax-adj-m11-accounts-group">
                <h3 className="tax-adj-m11-accounts-group__title">
                  Balance Sheet (294x — Accrued löneskatt on pension)
                </h3>
                <table className="tax-adj-m11-table">
                  <thead className="tax-adj-m11-table__head">
                    <tr>
                      <th className="tax-adj-m11-table__header">Code</th>
                      <th className="tax-adj-m11-table__header">Label</th>
                      <th className="tax-adj-m11-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m11-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m11-table__body">
                    {pensionBalanceSheetAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m11-table__row">
                        <td className="tax-adj-m11-table__cell">{line.code}</td>
                        <td className="tax-adj-m11-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {formatNumber(line.priorYearValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {pensionIncomeStatementAccounts.length > 0 ? (
              <div className="tax-adj-m11-accounts-group">
                <h3 className="tax-adj-m11-accounts-group__title">
                  Income Statement (740x — Pensionskostnader, 753x — Löneskatt
                  på pensionskostnader)
                </h3>
                <table className="tax-adj-m11-table">
                  <thead className="tax-adj-m11-table__head">
                    <tr>
                      <th className="tax-adj-m11-table__header">Code</th>
                      <th className="tax-adj-m11-table__header">Label</th>
                      <th className="tax-adj-m11-table__header">
                        Current Year (SEK)
                      </th>
                      <th className="tax-adj-m11-table__header">
                        Prior Year (SEK)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m11-table__body">
                    {pensionIncomeStatementAccounts.map((line) => (
                      <tr key={line.code} className="tax-adj-m11-table__row">
                        <td className="tax-adj-m11-table__cell">{line.code}</td>
                        <td className="tax-adj-m11-table__cell">
                          {line.label}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {formatNumber(line.currentYearValue)}
                        </td>
                        <td className="tax-adj-m11-table__cell">
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
          <p className="tax-adj-m11-empty-message">
            No pension cost accounts found in the extracted statements.
          </p>
        )}
      </CardV1>

      {/* Section 2: AI Pension Type Assessment */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--ai-assessment">
        <div className="tax-adj-m11-section__header">
          <h2>AI Pension Type Assessment</h2>
          <p className="tax-adj-m11-section__subtitle">
            Decisions from the{" "}
            <code>pension_costs_and_special_payroll_tax</code> module, including
            pension arrangement type, löneskatt rate, and direktpension flag.
          </p>
        </div>

        {isLoading ? (
          <div className="tax-adj-m11-loading-grid">
            <SkeletonV1 height={80} />
            <SkeletonV1 height={80} />
          </div>
        ) : (
          <>
            {pensionContext ? (
              <div className="tax-adj-m11-context-summary">
                {pensionContext.specialPayrollTax?.value !== undefined ? (
                  <div className="tax-adj-m11-context-row">
                    <span className="tax-adj-m11-context-label">
                      Extracted special payroll tax (löneskatt):
                    </span>
                    <span className="tax-adj-m11-context-value">
                      {formatNumber(pensionContext.specialPayrollTax.value)} SEK
                    </span>
                  </div>
                ) : null}

                {pensionContext.flags.length > 0 ? (
                  <div className="tax-adj-m11-flags">
                    <h3 className="tax-adj-m11-flags__title">
                      Narrative Flags
                    </h3>
                    <ul className="tax-adj-m11-flags__list">
                      {pensionContext.flags.map((flag) => (
                        <li key={flag.code} className="tax-adj-m11-flags__item">
                          <span className="tax-adj-m11-flags__label">
                            {flag.label}
                          </span>
                          {flag.value !== undefined ? (
                            <span
                              className={`tax-adj-m11-flags__value ${flag.value ? "tax-adj-m11-flags__value--true" : "tax-adj-m11-flags__value--false"}`}
                            >
                              {flag.value ? "Yes" : "No"}
                            </span>
                          ) : null}
                          {flag.notes.length > 0 ? (
                            <ul className="tax-adj-m11-flags__notes">
                              {flag.notes.map((note, i) => (
                                <li key={i}>{note}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {pensionContext.notes.length > 0 ? (
                  <div className="tax-adj-m11-context-notes">
                    <h3 className="tax-adj-m11-context-notes__title">
                      Pension Context Notes
                    </h3>
                    <ul className="tax-adj-m11-context-notes__list">
                      {pensionContext.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isDirektpensionFlagged ? (
              <div className="tax-adj-m11-alert tax-adj-m11-alert--warning">
                <span className="tax-adj-m11-alert__icon">⚠</span>
                <span className="tax-adj-m11-alert__text">
                  Direktpension detected. Deduction is only permitted when paid
                  out, not when provisioned — unless secured via PRI credit
                  insurance (IL 28:3).
                </span>
              </div>
            ) : null}

            {pensionDecisions.length > 0 ? (
              <div className="tax-adj-m11-decisions-table">
                <table className="tax-adj-m11-table">
                  <thead className="tax-adj-m11-table__head">
                    <tr>
                      <th className="tax-adj-m11-table__header">
                        Amount (SEK)
                      </th>
                      <th className="tax-adj-m11-table__header">Direction</th>
                      <th className="tax-adj-m11-table__header">Rationale</th>
                      <th className="tax-adj-m11-table__header">Status</th>
                      <th className="tax-adj-m11-table__header">Review</th>
                    </tr>
                  </thead>
                  <tbody className="tax-adj-m11-table__body">
                    {pensionDecisions.map((decision) => (
                      <tr key={decision.id} className="tax-adj-m11-table__row">
                        <td className="tax-adj-m11-table__cell">
                          {formatNumber(decision.amount)}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {getDirectionLabel(decision.direction)}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {decision.rationale}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {decision.status}
                        </td>
                        <td className="tax-adj-m11-table__cell">
                          {decision.reviewFlag ? (
                            <span className="tax-adj-m11-review-flag">⚠</span>
                          ) : (
                            <span className="tax-adj-m11-review-ok">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="tax-adj-m11-empty-message">
                No AI adjustment decisions for this module.
              </p>
            )}

            {pensionNotes.length > 0 ? (
              <div className="tax-adj-m11-relevant-notes">
                <h3 className="tax-adj-m11-relevant-notes__title">
                  Pension Notes from Annual Report
                </h3>
                {pensionNotes.map((note, i) => (
                  <div key={i} className="tax-adj-m11-note-item">
                    {note.title ? (
                      <p className="tax-adj-m11-note-item__title">
                        {note.title}
                      </p>
                    ) : null}
                    {note.notes.length > 0 ? (
                      <ul className="tax-adj-m11-note-item__list">
                        {note.notes.map((text, j) => (
                          <li key={j}>{text}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardV1>

      {/* Section 3: Prisbasbelopp Disclaimer — ALWAYS SHOWN */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--disclaimer">
        <div className="tax-adj-m11-section__header">
          <h2>IL 28 Individual Cap — Disclaimer</h2>
        </div>
        <div className="tax-adj-m11-alert tax-adj-m11-alert--important">
          <span className="tax-adj-m11-alert__icon">!</span>
          <div className="tax-adj-m11-alert__body">
            <p>
              <strong>Important:</strong> The IL 28 deduction cap applies per
              individual employee. The annual report does not contain
              per-employee pension data. This module cannot verify whether
              individual pension premiums exceed the allowable limit.
            </p>
            <p>
              Please confirm manually that no individual's pension premium
              exceeds the higher of 35% of their annual salary or SEK{" "}
              {formatNumber(PBB_LIMIT_FY2025)} (FY2025) / SEK{" "}
              {formatNumber(PBB_LIMIT_FY2026)} (FY2026) (10 prisbasbelopp).
              Maximum deductible is also capped at 70% of salary for individual
              insurance premiums.
            </p>
          </div>
        </div>
      </CardV1>

      {/* Section 4: Löneskatt Verification */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--loneskatt">
        <div className="tax-adj-m11-section__header">
          <h2>Löneskatt Verification</h2>
          <p className="tax-adj-m11-section__subtitle">
            Special employer's contribution (särskild löneskatt) is{" "}
            {LONESKATT_RATE_DISPLAY} on pension costs (IL 1 § lag om
            särskild löneskatt på pensionskostnader).
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={80} />
        ) : booked740Amount !== 0 ? (
          <div className="tax-adj-m11-loneskatt-check">
            <table className="tax-adj-m11-table">
              <thead className="tax-adj-m11-table__head">
                <tr>
                  <th className="tax-adj-m11-table__header">Item</th>
                  <th className="tax-adj-m11-table__header">Amount (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m11-table__body">
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell">
                    Pension cost basis (740x, absolute value)
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {formatNumber(Math.abs(booked740Amount))}
                  </td>
                </tr>
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell">
                    Computed löneskatt ({LONESKATT_RATE_DISPLAY} × basis)
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {formatNumber(computedLoneskatt)}
                  </td>
                </tr>
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell">
                    Booked löneskatt (753x, absolute value)
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {formatNumber(bookedLoneskattAbs)}
                  </td>
                </tr>
              </tbody>
            </table>

            {hasLoneskattDiscrepancy ? (
              <div className="tax-adj-m11-alert tax-adj-m11-alert--warning">
                <span className="tax-adj-m11-alert__icon">⚠</span>
                <span className="tax-adj-m11-alert__text">
                  Discrepancy detected:{" "}
                  {(loneskattDiscrepancy * 100).toFixed(1)}% difference between
                  computed and booked löneskatt (threshold: 1%). Manual review
                  required.
                </span>
              </div>
            ) : (
              <div className="tax-adj-m11-alert tax-adj-m11-alert--ok">
                <span className="tax-adj-m11-alert__icon">✓</span>
                <span className="tax-adj-m11-alert__text">
                  Booked löneskatt matches computed amount within 1% tolerance.
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="tax-adj-m11-empty-message">
            No pension cost amount found in account 740x — löneskatt computation
            not available.
          </p>
        )}
      </CardV1>

      {/* Section 5: INK2 Basis Summary */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--ink2-basis">
        <div className="tax-adj-m11-section__header">
          <h2>INK2 Basis Summary</h2>
          <p className="tax-adj-m11-section__subtitle">
            Pension cost basis flowing to INK2 fields 1.4 (positive basis),
            1.5 (negative basis if applicable), and 4.21.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={100} />
        ) : (
          <div className="tax-adj-m11-ink2-summary">
            <table className="tax-adj-m11-table">
              <thead className="tax-adj-m11-table__head">
                <tr>
                  <th className="tax-adj-m11-table__header">INK2 Field</th>
                  <th className="tax-adj-m11-table__header">Description</th>
                  <th className="tax-adj-m11-table__header">Amount (SEK)</th>
                </tr>
              </thead>
              <tbody className="tax-adj-m11-table__body">
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell tax-adj-m11-table__cell--field-code">
                    INK2 1.4
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    Pension cost basis for särskild löneskatt (positive)
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {ink2Basis14 > 0 ? formatNumber(ink2Basis14) : "—"}
                  </td>
                </tr>
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell tax-adj-m11-table__cell--field-code">
                    INK2 1.5
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    Pension cost basis (negative, if applicable)
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {booked740Amount < 0
                      ? formatNumber(Math.abs(booked740Amount))
                      : "—"}
                  </td>
                </tr>
                <tr className="tax-adj-m11-table__row">
                  <td className="tax-adj-m11-table__cell tax-adj-m11-table__cell--field-code">
                    INK2 4.21
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    Basis for särskild löneskatt på pensionskostnader
                  </td>
                  <td className="tax-adj-m11-table__cell">
                    {ink2Basis421 > 0 ? formatNumber(ink2Basis421) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>

            {booked740Amount === 0 ? (
              <p className="tax-adj-m11-empty-message">
                No pension cost basis computed — account 740x not found or
                has zero balance.
              </p>
            ) : null}
          </div>
        )}
      </CardV1>

      {/* Section 6: Review Status */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--review-status">
        <div className="tax-adj-m11-section__header">
          <h2>Review Status</h2>
          <p className="tax-adj-m11-section__subtitle">
            Unresolved pension adjustment decisions requiring manual review.
          </p>
        </div>

        {isLoading ? (
          <SkeletonV1 height={60} />
        ) : unreviewedDecisions.length > 0 ? (
          <div className="tax-adj-m11-status tax-adj-m11-status--warning">
            <span className="tax-adj-m11-status__icon">⚠</span>
            <span className="tax-adj-m11-status__text">
              {unreviewedDecisions.length} decision(s) require manual review.
            </span>
          </div>
        ) : (
          <div className="tax-adj-m11-status tax-adj-m11-status--ok">
            <span className="tax-adj-m11-status__icon">✓</span>
            <span className="tax-adj-m11-status__text">
              All decisions resolved.
            </span>
          </div>
        )}
      </CardV1>

      {/* Section 7: Verification Checklist */}
      <CardV1 className="tax-adj-m11-section tax-adj-m11-section--verification">
        <div className="tax-adj-m11-section__header">
          <h2>Verification Checklist</h2>
          <p className="tax-adj-m11-section__subtitle">
            Confirm each item before proceeding.
          </p>
        </div>

        <ul className="tax-adj-m11-checklist">
          <li className="tax-adj-m11-checklist__item">
            <span className="tax-adj-m11-checklist__marker">✓</span>
            <span>
              Pension arrangement type confirmed (collective / individual /
              direktpension)
            </span>
          </li>
          <li className="tax-adj-m11-checklist__item">
            <span className="tax-adj-m11-checklist__marker">✓</span>
            <span>
              Löneskatt rate is {LONESKATT_RATE_DISPLAY} — booked amount matches
              computed amount
            </span>
          </li>
          <li className="tax-adj-m11-checklist__item">
            <span className="tax-adj-m11-checklist__marker">✓</span>
            <span>
              If direktpension: deduction timing verified (only deductible when
              paid, not when provisioned)
            </span>
          </li>
          <li className="tax-adj-m11-checklist__item">
            <span className="tax-adj-m11-checklist__marker">✓</span>
            <span>
              Individual pension premiums confirmed within the IL 28 cap (35% of
              salary or 10 pbb — SEK {formatNumber(PBB_LIMIT_FY2025)} / SEK{" "}
              {formatNumber(PBB_LIMIT_FY2026)})
            </span>
          </li>
          <li className="tax-adj-m11-checklist__item">
            <span className="tax-adj-m11-checklist__marker">✓</span>
            <span>
              INK2 1.4 and 4.21 basis figures are correctly populated
            </span>
          </li>
        </ul>
      </CardV1>
    </div>
  );
}
