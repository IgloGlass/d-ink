import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useParams } from "react-router-dom";

import type {
  AnnualReportAmountUnitV1,
  AnnualReportExtractionPayloadV1,
  AnnualReportRuntimeMetadataV1,
  AnnualReportStatementLineV1,
} from "../../../shared/contracts/annual-report-extraction.v1";
import { MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1 } from "../../../shared/contracts/annual-report-upload-session.v1";
import type {
  AnnualReportProcessingRunV1,
} from "../../../shared/contracts/annual-report-processing-run.v1";
import {
  coreModuleDefinitionsV1,
  type CoreModuleDefinitionV1,
  type CoreModuleSlugV1,
} from "../../app/core-modules.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { UploadDropZoneV1 } from "../../components/upload-drop-zone.v1";
import { WorkspaceReviewPanelV1 } from "../../components/workspace-review-panel.v1";
import {
  formatAnnualReportRunElapsedLabelV1,
  isAnnualReportOpenRunStaleV1,
  isAnnualReportProcessingOpenStatusV1,
  selectAnnualReportProgressDetailsV1,
  useAnnualReportUploadControllerV1,
} from "../annual-report/use-annual-report-upload-controller.v1";
import {
  createPdfExportV1,
  getActiveAnnualReportExtractionV1,
  getActiveAnnualReportTaxAnalysisV1,
  getActiveInk2FormV1,
  getLatestAnnualReportProcessingRunV1,
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
  getWorkspaceByIdV1,
  runInk2FormV1,
  runTaxAdjustmentsV1,
  runTaxSummaryV1,
  runTrialBalancePipelineV1,
} from "../../lib/http/workspace-api";
import {
  fileToBase64V1,
  inferTrialBalanceFileTypeV1,
} from "../../lib/workspace-files.v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import {
  buildWorkflowSnapshotV1,
  getModuleWorkflowStateV1,
} from "../../lib/workflow-v1";

const ANNUAL_REPORT_POLICY_VERSION_V1 = "annual-report-manual-first.v1";
const TRIAL_BALANCE_POLICY_VERSION_V1 = "deterministic-bas.v1";
const TAX_ADJUSTMENTS_POLICY_VERSION_V1 = "tax-adjustments.v1";

function formatCurrencyV1(value: number): string {
  return new Intl.NumberFormat("sv-SE").format(value);
}

function formatSeverityLabelV1(input: "low" | "medium" | "high"): string {
  if (input === "high") {
    return "High";
  }
  if (input === "medium") {
    return "Medium";
  }
  return "Low";
}

function ModuleStageIntroV1({
  description,
  heading,
  moduleDefinition,
  subModule,
}: {
  description: string;
  heading: string;
  moduleDefinition: CoreModuleDefinitionV1;
  subModule: string | undefined;
}) {
  return (
    <div className="module-stage-card__header">
      <div>
        <div className="module-shell__eyebrow">Module {moduleDefinition.step}</div>
        <h1>{heading}</h1>
        <p>{description}</p>
        {subModule ? (
          <div className="module-stage-card__submodule">
            Focus area: {subModule.replace(/-/g, " ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModuleSummaryGridV1({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="module-summary-grid">{children}</div>;
}

function ModuleSummaryItemV1({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="module-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCountValueV1(value: number | undefined): string {
  return value === undefined ? "-" : formatCurrencyV1(value);
}

function formatOptionalCurrencyV1(value: number | undefined): string {
  return value === undefined ? "-" : formatCurrencyV1(value);
}

function formatStatementUnitLabelV1(
  statementUnit: AnnualReportAmountUnitV1 | undefined,
): string | null {
  if (!statementUnit || statementUnit === "sek") {
    return null;
  }

  return statementUnit === "ksek"
    ? "Normalized from kSEK to SEK"
    : "Normalized from MSEK to SEK";
}

function hasAnnualReportStatementDataV1(
  extraction: AnnualReportExtractionPayloadV1 | undefined,
): boolean {
  return Boolean(
    extraction?.taxDeep &&
      extraction.taxDeep.ink2rExtracted.incomeStatement.length > 0 &&
      extraction.taxDeep.ink2rExtracted.balanceSheet.length > 0,
  );
}

function hasLegacyAnnualReportWarningSignatureV1(
  warnings: string[],
): boolean {
  return warnings.some(
    (warning) =>
      warning.includes("Gemini statements extraction skipped") ||
      warning.includes("maximum allowed nesting depth") ||
      warning.includes("Full financial extraction is missing"),
  );
}

type AnnualReportActiveResultStatusV1 =
  | "empty"
  | "ready"
  | "legacy"
  | "partial";

function normalizeAnnualReportTechnicalWarningsV1(
  warnings: string[],
): string[] {
  return warnings.filter(
    (warning) =>
      !warning.includes("Full financial extraction is missing on this artifact."),
  );
}

function deriveAnnualReportResultStateV1(input: {
  extraction: AnnualReportExtractionPayloadV1 | undefined;
  runtime: AnnualReportRuntimeMetadataV1 | undefined;
  warnings: string[];
}): {
  helperText: string;
  reviewLabel: string;
  status: AnnualReportActiveResultStatusV1;
  statusLabel: string;
  technicalWarnings: string[];
} {
  const hasFullExtraction = hasAnnualReportStatementDataV1(input.extraction);
  const technicalWarnings = normalizeAnnualReportTechnicalWarningsV1(
    input.warnings,
  );
  if (!input.extraction) {
    return {
      status: "empty",
      statusLabel: "No annual report uploaded",
      reviewLabel: "Upload annual report",
      helperText:
        "Upload an annual report to extract financial statements and tax context.",
      technicalWarnings,
    };
  }
  const runtimeFingerprintMismatch = Boolean(
    input.runtime &&
      input.extraction?.engineMetadata &&
      input.extraction.engineMetadata.runtimeFingerprint !==
        input.runtime.runtimeFingerprint,
  );
  const engineVersionMismatch = Boolean(
    input.runtime &&
      input.extraction?.engineMetadata &&
      input.extraction.engineMetadata.extractionEngineVersion !==
        input.runtime.extractionEngineVersion,
  );
  const legacyResult =
    !hasFullExtraction &&
    (hasLegacyAnnualReportWarningSignatureV1(input.warnings) ||
      runtimeFingerprintMismatch ||
      engineVersionMismatch ||
      !input.extraction?.engineMetadata);

  if (legacyResult) {
    return {
      status: "legacy",
      statusLabel: "Legacy result",
      reviewLabel: "Upload again",
      helperText:
        "This saved result was created with an older extraction engine and is missing full statements and tax-note context. Upload the annual report again to refresh it.",
      technicalWarnings,
    };
  }

  if (!hasFullExtraction) {
    return {
      status: "partial",
      statusLabel: "Partial extraction",
      reviewLabel: "Upload again",
      helperText:
        "Analysis completed, but the financial statements or note context are still incomplete. Upload the annual report again to refresh this result.",
      technicalWarnings,
    };
  }

  return {
    status: "ready",
    statusLabel: "Extracted",
    reviewLabel: "Upload a new annual report",
    helperText:
      "The extracted financial data is saved and available for downstream tax modules.",
    technicalWarnings,
  };
}

function buildAnnualReportValueRowsV1(
  items: Array<{ label: string; value?: number }>,
): Array<{ label: string; value: string }> {
  return items
    .filter((item) => item.value !== undefined)
    .map((item) => ({
      label: item.label,
      value: formatCurrencyV1(item.value ?? 0),
    }));
}

function AnnualReportValueListV1({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="annual-report-sidebar__list">
      {items.map((item) => (
        <li key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function confirmActiveDataOverrideV1(message: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm(message);
}

function AnnualReportStatementSectionV1({
  lines,
  title,
}: {
  lines: AnnualReportStatementLineV1[];
  title: string;
}) {
  if (lines.length === 0) {
    return null;
  }

  const hasPriorYearValues = lines.some((line) => line.priorYearValue !== undefined);

  return (
    <div className="annual-report-sidebar__section">
      <div className="annual-report-sidebar__label">{title}</div>
      <table className="annual-report-sidebar__statement-table">
        <thead>
          <tr>
            <th>Line item</th>
            <th>Current year</th>
            {hasPriorYearValues ? <th>Prior year</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${title}-${line.code}-${line.label}`}>
              <td>{line.label}</td>
              <td>{formatOptionalCurrencyV1(line.currentYearValue)}</td>
              {hasPriorYearValues ? (
                <td>{formatOptionalCurrencyV1(line.priorYearValue)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnualReportWarningDisclosureV1({
  warnings,
}: {
  warnings: string[];
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="annual-report-sidebar__section">
      <details className="annual-report-sidebar__details">
        <summary>Technical details ({warnings.length})</summary>
        <ul className="annual-report-sidebar__notes annual-report-sidebar__notes--compact">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function AnnualReportSidebarV1({
  annualDocumentWarnings,
  annualFields,
  annualReportClearPending,
  annualReportMutationPending,
  hasActiveExtraction,
  extraction,
  onClearRequested,
  onRecoveryRequested,
  processingRun,
  recoveryActionLabel,
  runtime,
}: {
  annualDocumentWarnings: string[];
  annualFields: AnnualReportExtractionPayloadV1["fields"] | undefined;
  annualReportClearPending: boolean;
  annualReportMutationPending: boolean;
  hasActiveExtraction: boolean;
  extraction: AnnualReportExtractionPayloadV1 | undefined;
  onClearRequested: () => void;
  onRecoveryRequested: () => void;
  processingRun: AnnualReportProcessingRunV1 | undefined;
  recoveryActionLabel: string;
  runtime: AnnualReportRuntimeMetadataV1 | undefined;
}) {
  const statementUnitLabel = formatStatementUnitLabelV1(
    extraction?.taxDeep?.ink2rExtracted.statementUnit,
  );
  const extractionState = deriveAnnualReportResultStateV1({
    extraction,
    runtime,
    warnings: annualDocumentWarnings,
  });
  const assetMovementRows =
    extraction?.taxDeep?.depreciationContext.assetAreas.length
      ? extraction.taxDeep.depreciationContext.assetAreas
      : extraction?.taxDeep?.assetMovements.lines ?? [];
  const reserveMovements = extraction?.taxDeep?.reserveContext.movements ?? [];
  const financialContextValues = buildAnnualReportValueRowsV1([
    {
      label: "Net interest",
      value: extraction?.taxDeep?.netInterestContext.netInterest?.value,
    },
    {
      label: "Finance expense",
      value: extraction?.taxDeep?.netInterestContext.financeExpense?.value,
    },
    {
      label: "Special payroll tax",
      value: extraction?.taxDeep?.pensionContext.specialPayrollTax?.value,
    },
    {
      label: "Current tax",
      value: extraction?.taxDeep?.taxExpenseContext?.currentTax?.value,
    },
    {
      label: "Deferred tax",
      value: extraction?.taxDeep?.taxExpenseContext?.deferredTax?.value,
    },
    {
      label: "Total tax expense",
      value: extraction?.taxDeep?.taxExpenseContext?.totalTaxExpense?.value,
    },
    {
      label: "Dividends paid",
      value: extraction?.taxDeep?.shareholdingContext.dividendsPaid?.value,
    },
    {
      label: "Dividends received",
      value: extraction?.taxDeep?.shareholdingContext.dividendsReceived?.value,
    },
  ]);
  const interestNotes = extraction?.taxDeep?.netInterestContext.notes ?? [];
  const pensionNotes = extraction?.taxDeep?.pensionContext.notes ?? [];
  const taxExpenseNotes = extraction?.taxDeep?.taxExpenseContext?.notes ?? [];
  const reserveNotes = extraction?.taxDeep?.reserveContext.notes ?? [];
  const leasingNotes = extraction?.taxDeep?.leasingContext.notes ?? [];
  const groupContributionNotes =
    extraction?.taxDeep?.groupContributionContext.notes ?? [];
  const shareholdingNotes = extraction?.taxDeep?.shareholdingContext.notes ?? [];
  const showRecoveryActions =
    extractionState.status === "legacy" || extractionState.status === "partial";
  const processingRunStale = isAnnualReportOpenRunStaleV1(processingRun);
  const processingOpen = isAnnualReportProcessingOpenStatusV1(
    processingRun?.status,
  ) && !processingRunStale;
  const processingStatusLabel = processingOpen
    ? processingRun?.statusMessage
    : processingRunStale
      ? "Processing stalled"
    : processingRun?.status === "failed"
      ? "Extraction failed"
      : processingRun?.status === "partial"
        ? "Incomplete extraction"
        : null;
  const processingElapsedLabel = formatAnnualReportRunElapsedLabelV1(processingRun);
  const processingProgressDetails = selectAnnualReportProgressDetailsV1(processingRun);

  return (
    <aside className="annual-report-sidebar">
      <CardV1 className="annual-report-sidebar__card">
        <div className="annual-report-sidebar__header">
          <div>
            <div className="review-panel__eyebrow">Extraction review</div>
            <h2>Financial data</h2>
            {statementUnitLabel ? (
              <div className="annual-report-sidebar__caption">{statementUnitLabel}</div>
            ) : null}
          </div>
          <div className="annual-report-sidebar__status-block">
            <div className="module-data-card__status">
              {processingStatusLabel ?? extractionState.statusLabel}
            </div>
            <strong>{extractionState.reviewLabel}</strong>
            {hasActiveExtraction ? (
              <ButtonV1
                variant="secondary"
                size="sm"
                onClick={onClearRequested}
                disabled={annualReportClearPending || annualReportMutationPending}
              >
                Clear annual report data
              </ButtonV1>
            ) : null}
          </div>
        </div>

        {annualFields ? (
          <>
            {processingRun?.hasPreviousActiveResult && processingOpen ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Replacement in progress</div>
                <div className="annual-report-sidebar__status-message">
                  {processingRun.statusMessage}. The current extracted dataset stays
                  active until the new upload completes successfully.
                </div>
                {processingElapsedLabel ? (
                  <div className="annual-report-sidebar__caption">{processingElapsedLabel}</div>
                ) : null}
                {processingProgressDetails.length > 0 ? (
                  <ul className="annual-report-sidebar__notes annual-report-sidebar__notes--compact">
                    {processingProgressDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {processingRunStale ? (
              <div className="annual-report-sidebar__section annual-report-sidebar__section--attention">
                <div className="annual-report-sidebar__label">Processing appears stalled</div>
                <div className="annual-report-sidebar__status-message">
                  No run progress has been recorded for at least 90 seconds. Upload
                  a replacement annual report to continue.
                </div>
              </div>
            ) : null}
            {processingOpen &&
            !processingRun?.hasPreviousActiveResult &&
            (processingElapsedLabel || processingProgressDetails.length > 0) ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Processing progress</div>
                <div className="annual-report-sidebar__status-message">
                  {processingRun?.statusMessage}
                </div>
                {processingElapsedLabel ? (
                  <div className="annual-report-sidebar__caption">{processingElapsedLabel}</div>
                ) : null}
                {processingProgressDetails.length > 0 ? (
                  <ul className="annual-report-sidebar__notes annual-report-sidebar__notes--compact">
                    {processingProgressDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div
              className={`annual-report-sidebar__section${
                showRecoveryActions
                  ? " annual-report-sidebar__section--attention"
                  : ""
              }`}
            >
              <div className="annual-report-sidebar__status-message">
                {extractionState.helperText}
              </div>
              <div className="annual-report-sidebar__actions">
                <ButtonV1
                  variant="black"
                  size="sm"
                  onClick={onRecoveryRequested}
                  disabled={annualReportMutationPending}
                >
                  {recoveryActionLabel}
                </ButtonV1>
              </div>
            </div>

            {showRecoveryActions ? (
              <div className="annual-report-sidebar__section annual-report-sidebar__section--attention">
                <div className="annual-report-sidebar__label">Missing from this run</div>
                <ul className="annual-report-sidebar__notes">
                  <li>Full income statement rows</li>
                  <li>Full balance sheet rows</li>
                  <li>Tax-note context for downstream AI review</li>
                </ul>
              </div>
            ) : null}

            <div className="annual-report-sidebar__section">
              <div className="annual-report-sidebar__label">Core facts</div>
              <dl className="annual-report-sidebar__facts">
                <div>
                  <dt>Company</dt>
                  <dd>{annualFields.companyName.value ?? "Missing"}</dd>
                </div>
                <div>
                  <dt>Org no</dt>
                  <dd>{annualFields.organizationNumber.value ?? "Missing"}</dd>
                </div>
                <div>
                  <dt>Framework</dt>
                  <dd>{annualFields.accountingStandard.value ?? "Missing"}</dd>
                </div>
                <div>
                  <dt>Year start</dt>
                  <dd>{annualFields.fiscalYearStart.value ?? "Missing"}</dd>
                </div>
                <div>
                  <dt>Year end</dt>
                  <dd>{annualFields.fiscalYearEnd.value ?? "Missing"}</dd>
                </div>
                <div>
                  <dt>Profit before tax</dt>
                  <dd>
                    {annualFields.profitBeforeTax.value !== undefined
                      ? formatCurrencyV1(annualFields.profitBeforeTax.value)
                      : "Missing"}
                  </dd>
                </div>
              </dl>
            </div>

            <AnnualReportStatementSectionV1
              title="Income statement"
              lines={extraction?.taxDeep?.ink2rExtracted.incomeStatement ?? []}
            />

            <AnnualReportStatementSectionV1
              title="Balance sheet"
              lines={extraction?.taxDeep?.ink2rExtracted.balanceSheet ?? []}
            />

            {financialContextValues.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Interest, tax, and financing</div>
                <AnnualReportValueListV1 items={financialContextValues} />
              </div>
            ) : null}

            {assetMovementRows.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Depreciation and movements</div>
                <div className="annual-report-sidebar__movement-grid">
                  {assetMovementRows.map((row) => (
                    <div className="annual-report-sidebar__movement-card" key={row.assetArea}>
                      <div className="annual-report-sidebar__movement-title">
                        {row.assetArea}
                      </div>
                      <dl className="annual-report-sidebar__movement-values">
                        <div>
                          <dt>Acq</dt>
                          <dd>{formatCountValueV1(row.acquisitions)}</dd>
                        </div>
                        <div>
                          <dt>Disp</dt>
                          <dd>{formatCountValueV1(row.disposals)}</dd>
                        </div>
                        <div>
                          <dt>Depr</dt>
                          <dd>{formatCountValueV1(row.depreciationForYear)}</dd>
                        </div>
                        <div>
                          <dt>Close</dt>
                          <dd>{formatCountValueV1(row.closingCarryingAmount)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {reserveMovements.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Reserve movements</div>
                <ul className="annual-report-sidebar__list">
                  {reserveMovements.map((movement) => (
                    <li key={movement.reserveType}>
                      <span>{movement.reserveType}</span>
                      <strong>{formatCountValueV1(movement.closingBalance)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {interestNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Interest notes</div>
                <ul className="annual-report-sidebar__notes">
                  {interestNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pensionNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Pension notes</div>
                <ul className="annual-report-sidebar__notes">
                  {pensionNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {taxExpenseNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Current and deferred tax</div>
                <ul className="annual-report-sidebar__notes">
                  {taxExpenseNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {reserveNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Reserve notes</div>
                <ul className="annual-report-sidebar__notes">
                  {reserveNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {leasingNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Leasing notes</div>
                <ul className="annual-report-sidebar__notes">
                  {leasingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {groupContributionNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Group contributions</div>
                <ul className="annual-report-sidebar__notes">
                  {groupContributionNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {shareholdingNotes.length > 0 ? (
              <div className="annual-report-sidebar__section">
                <div className="annual-report-sidebar__label">Shareholdings and dividends</div>
                <ul className="annual-report-sidebar__notes">
                  {shareholdingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <AnnualReportWarningDisclosureV1
              warnings={extractionState.technicalWarnings}
            />
          </>
        ) : (
          <>
            {processingRun ? (
              <div className="annual-report-sidebar__section annual-report-sidebar__section--attention">
                <div className="annual-report-sidebar__label">
                  {processingRun.status === "failed"
                    ? "Extraction failed"
                    : processingRun.status === "partial"
                      ? "Incomplete extraction"
                      : "Analysis in progress"}
                </div>
                <div className="annual-report-sidebar__status-message">
                  {processingRun.error?.userMessage ?? processingRun.statusMessage}
                </div>
                <div className="annual-report-sidebar__actions">
                  <ButtonV1
                    variant="black"
                    size="sm"
                    onClick={onRecoveryRequested}
                    disabled={annualReportMutationPending}
                  >
                    {recoveryActionLabel}
                  </ButtonV1>
                  <ButtonV1
                    variant="secondary"
                    size="sm"
                    onClick={onClearRequested}
                    disabled={annualReportClearPending || annualReportMutationPending}
                  >
                    Clear annual report data
                  </ButtonV1>
                </div>
              </div>
            ) : (
              <div className="workspace-empty-state">
                Upload an annual report to populate the financial extraction sidebar.
              </div>
            )}

            <AnnualReportWarningDisclosureV1 warnings={annualDocumentWarnings} />
          </>
        )}
      </CardV1>
    </aside>
  );
}

export function CoreModuleShellPageV1() {
  const principal = useRequiredSessionPrincipalV1();
  const queryClient = useQueryClient();
  const { workspaceId, coreModule, subModule } = useParams();

  const [trialBalanceFile, setTrialBalanceFile] = useState<File | null>(null);

  const resolvedWorkspaceId = workspaceId ?? "";
  const normalizedCoreModule =
    (coreModule as CoreModuleSlugV1) ?? "annual-report-analysis";
  const activeModuleDefinition =
    coreModuleDefinitionsV1.find(
      (moduleDefinition) => moduleDefinition.slug === normalizedCoreModule,
    ) ?? coreModuleDefinitionsV1[0];

  const workspaceQuery = useQuery({
    queryKey: ["workspace", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getWorkspaceByIdV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
  });

  const annualReportQuery = useQuery({
    queryKey: ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveAnnualReportExtractionV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const annualReportProcessingRunQuery = useQuery({
    queryKey: [
      "latest-annual-report-processing-run",
      principal.tenantId,
      resolvedWorkspaceId,
    ],
    queryFn: async () => {
      try {
        return await getLatestAnnualReportProcessingRunV1({
          tenantId: principal.tenantId,
          workspaceId: resolvedWorkspaceId,
        });
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.code === "PROCESSING_RUN_NOT_FOUND"
        ) {
          return null;
        }

        throw error;
      }
    },
    enabled:
      resolvedWorkspaceId.length > 0 &&
      normalizedCoreModule === "annual-report-analysis",
    retry: false,
    refetchInterval: ({ state }) => {
      const data = state.data as
        | { run: AnnualReportProcessingRunV1 }
        | null
        | undefined;
      return isAnnualReportProcessingOpenStatusV1(data?.run?.status)
        ? 2_000
        : false;
    },
  });

  const mappingQuery = useQuery({
    queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const annualReportTaxAnalysisQuery = useQuery({
    queryKey: [
      "active-annual-report-tax-analysis",
      principal.tenantId,
      resolvedWorkspaceId,
    ],
    queryFn: () =>
      getActiveAnnualReportTaxAnalysisV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxAdjustmentsQuery = useQuery({
    queryKey: ["active-tax-adjustments", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxSummaryQuery = useQuery({
    queryKey: ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const ink2Query = useQuery({
    queryKey: ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const trialBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!trialBalanceFile) {
        throw new Error("Select a trial balance file first.");
      }

      return runTrialBalancePipelineV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
        fileName: trialBalanceFile.name,
        fileType: inferTrialBalanceFileTypeV1(trialBalanceFile.name),
        fileBytesBase64: await fileToBase64V1(trialBalanceFile),
        policyVersion: TRIAL_BALANCE_POLICY_VERSION_V1,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
      });
      setTrialBalanceFile(null);
    },
  });

  const taxAdjustmentsMutation = useMutation({
    mutationFn: async () => {
      const adjustments = await runTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
        policyVersion: TAX_ADJUSTMENTS_POLICY_VERSION_V1,
      });

      await runTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      });

      return adjustments;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["active-tax-adjustments", principal.tenantId, resolvedWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
        }),
      ]);
    },
  });

  const ink2Mutation = useMutation({
    mutationFn: async () =>
      runInk2FormV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
      });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async () =>
      createPdfExportV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
  });

  const latestAnnualReportRun = annualReportProcessingRunQuery.data?.run;
  const activeAnnualReportData = annualReportQuery.isSuccess
    ? annualReportQuery.data
    : undefined;
  const activeAnnualReportTaxAnalysis = annualReportTaxAnalysisQuery.isSuccess
    ? annualReportTaxAnalysisQuery.data
    : undefined;
  const hasActiveAnnualReportExtraction = Boolean(activeAnnualReportData?.active);
  const {
    annualReportFile,
    annualReportFileTooLarge,
    annualReportMutation,
    annualReportMutationErrorCode,
    annualReportRunIsOpen,
    annualReportRunIsStale,
    annualReportUploadBlockedByRun,
    annualUploadProgressPercent,
    clearAnnualReportMutation,
    clearActiveData,
    recoveryActionLabel,
    runRecoveryAction,
    setAnnualReportFile,
    startUpload,
  } = useAnnualReportUploadControllerV1({
    tenantId: principal.tenantId,
    workspaceId: resolvedWorkspaceId,
    policyVersion: ANNUAL_REPORT_POLICY_VERSION_V1,
    latestRun: latestAnnualReportRun,
    hasActiveExtraction: hasActiveAnnualReportExtraction,
    uploadPanelId: "annual-report-upload-panel",
    latestRunQueryKey: [
      "latest-annual-report-processing-run",
      principal.tenantId,
      resolvedWorkspaceId,
    ],
    uploadSuccessInvalidateQueryKeys: [
      [
        "latest-annual-report-processing-run",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
      ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
      [
        "active-annual-report-tax-analysis",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
    ],
    clearSuccessRemoveQueryKeys: [
      [
        "latest-annual-report-processing-run",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
      ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
      [
        "active-annual-report-tax-analysis",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
    ],
    clearSuccessInvalidateQueryKeys: [
      ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
      [
        "active-annual-report-tax-analysis",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
      ["active-tax-adjustments", principal.tenantId, resolvedWorkspaceId],
      ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
      ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
      [
        "latest-annual-report-processing-run",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
    ],
    settledRunInvalidateQueryKeys: [
      ["active-annual-report", principal.tenantId, resolvedWorkspaceId],
      [
        "active-annual-report-tax-analysis",
        principal.tenantId,
        resolvedWorkspaceId,
      ],
      ["active-tax-adjustments", principal.tenantId, resolvedWorkspaceId],
      ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
      ["active-ink2-form", principal.tenantId, resolvedWorkspaceId],
    ],
  });

  if (resolvedWorkspaceId.length === 0 || workspaceQuery.isError) {
    return (
      <EmptyStateV1
        title="Module unavailable"
        description="Open a company dashboard first."
      />
    );
  }

  const workspace = workspaceQuery.data?.workspace;
  if (!workspace) {
    return <div className="workspace-empty-state">Loading workspace…</div>;
  }

  const displayedAnnualExtraction =
    activeAnnualReportData?.extraction ??
    (!hasActiveAnnualReportExtraction
      ? latestAnnualReportRun?.previewExtraction
      : undefined);
  const displayedAnnualRuntime =
    activeAnnualReportData?.runtime ?? latestAnnualReportRun?.runtime;
  const annualReportConfirmed =
    activeAnnualReportData?.extraction.confirmation.isConfirmed ?? false;
  const mappingDecisions = mappingQuery.data?.mapping.decisions ?? [];
  const taxAdjustmentDecisions =
    taxAdjustmentsQuery.data?.adjustments.decisions ?? [];
  const taxSummary = taxSummaryQuery.data?.summary;
  const ink2Fields = ink2Query.data?.form.fields ?? [];
  const annualFields = displayedAnnualExtraction?.fields;
  const annualTaxAnalysis = activeAnnualReportTaxAnalysis?.taxAnalysis;
  const annualDocumentWarnings =
    displayedAnnualExtraction?.documentWarnings ??
    latestAnnualReportRun?.technicalDetails ??
    [];
  const annualAiRun = displayedAnnualExtraction?.aiRun;
  const annualUsedFallback = annualAiRun?.usedFallback ?? false;
  const annualPendingStatusMessage =
    latestAnnualReportRun?.statusMessage ??
    "Annual report AI analysis is in progress.";
  const annualResultState = deriveAnnualReportResultStateV1({
    extraction: displayedAnnualExtraction,
    runtime: displayedAnnualRuntime,
    warnings: annualDocumentWarnings,
  });
  const hasActiveMappingDecisions = Boolean(mappingQuery.data?.mapping);
  const showReplacementBanner =
    annualReportRunIsOpen &&
    latestAnnualReportRun?.hasPreviousActiveResult === true &&
    hasActiveAnnualReportExtraction;
  const latestAnnualReportRunNeedsAttention =
    latestAnnualReportRun?.status === "failed" ||
    latestAnnualReportRun?.status === "partial";

  const handleTrialBalanceRunV1 = () => {
    if (
      hasActiveMappingDecisions &&
      !confirmActiveDataOverrideV1(
        "Import trial balance again? This will replace the active account mapping data and current mapping review state for this workspace.",
      )
    ) {
      return;
    }

    trialBalanceMutation.mutate();
  };

  const workflowSnapshot = buildWorkflowSnapshotV1({
    annualReportConfirmed,
    hasMapping: mappingQuery.isSuccess,
    hasTaxAdjustments: taxAdjustmentsQuery.isSuccess,
    hasTaxSummary: taxSummaryQuery.isSuccess,
    hasInk2Draft: ink2Query.isSuccess,
  });

  const moduleWorkflowState = getModuleWorkflowStateV1({
    definition: activeModuleDefinition,
    snapshot: workflowSnapshot,
  });

  let moduleBody: ReactNode;

  if (normalizedCoreModule === "annual-report-analysis") {
    moduleBody = (
      <>
        <CardV1 className="module-stage-card card-v1--hero">
          <ModuleStageIntroV1
            heading={activeModuleDefinition.longLabel}
            description={activeModuleDefinition.description}
            moduleDefinition={activeModuleDefinition}
            subModule={subModule}
          />

          <div className="module-stage-card__body">
            <div className="module-stage-card__control-panel">
              <div
                className="module-stage-card__input-group"
                id="annual-report-upload-panel"
              >
                <UploadDropZoneV1
                  idPrefix="annual-report-upload"
                  title="Upload annual report"
                  helperText="Drag and drop a PDF or DOCX annual report here, or browse for a file."
                  accept=".pdf,.docx"
                  buttonLabel="Choose annual report"
                  file={annualReportFile}
                  onFileSelected={setAnnualReportFile}
                  isDisabled={
                    annualReportMutation.isPending || annualReportUploadBlockedByRun
                  }
                />
                <p className="module-stage-card__note">
                  Upload the signed annual report to extract financial
                  statements and tax context. A new upload replaces the active
                  annual-report dataset automatically.
                </p>
                {annualReportFileTooLarge ? (
                  <div className="workspace-inline-error" role="alert">
                    The annual report file is too large. Upload a file smaller than
                    25 MB.
                  </div>
                ) : null}
                {annualReportMutation.isError ? (
                  <div className="workspace-inline-error" role="alert">
                    {toUserFacingErrorMessage(annualReportMutation.error)}
                  </div>
                ) : null}
                {annualReportMutationErrorCode === "PROCESSING_RUN_UNAVAILABLE" ? (
                  <div className="workspace-inline-info" role="status">
                    Annual-report processing runtime is unavailable. Verify local queue
                    and file bindings, then retry.
                  </div>
                ) : null}
                {annualReportMutationErrorCode === "RUNTIME_MISMATCH" ? (
                  <div className="workspace-inline-info" role="status">
                    Runtime mismatch detected. Restart the local app so web and API use
                    the same runtime fingerprint.
                  </div>
                ) : null}
                {!annualReportMutation.isPending && annualReportFile ? (
                  <div className="workspace-inline-info" role="status">
                    File selected. Ready to upload and run AI analysis.
                  </div>
                ) : null}
                {showReplacementBanner ? (
                  <div className="workspace-inline-info" role="status">
                    A new annual report is processing. The current extracted
                    data stays visible until the replacement succeeds.
                  </div>
                ) : null}
                {annualReportProcessingRunQuery.isError ? (
                  <div className="workspace-inline-error" role="alert">
                    {toUserFacingErrorMessage(annualReportProcessingRunQuery.error)}
                  </div>
                ) : null}
                {annualReportRunIsOpen && !annualReportRunIsStale ? (
                  <div className="module-ai-progress" role="status" aria-live="polite">
                    <div className="module-ai-progress__indicator" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="module-ai-progress__content">
                      <strong>AI analysis in progress</strong>
                      <p>{annualPendingStatusMessage}</p>
                    </div>
                  </div>
                ) : null}
                {annualReportRunIsStale ? (
                  <div className="workspace-inline-error" role="alert">
                    Annual-report processing appears stuck (no update for at least 5
                    minutes). You can upload a replacement file now.
                  </div>
                ) : null}
                {annualReportMutation.isPending &&
                annualUploadProgressPercent !== null ? (
                  <div className="workspace-inline-info" role="status">
                    Uploading file ({annualUploadProgressPercent}%).
                  </div>
                ) : null}
                {latestAnnualReportRun?.status === "completed" ? (
                  <div className="workspace-inline-success" role="status">
                    Annual report analysis completed. The latest extraction is now active.
                  </div>
                ) : null}
                {latestAnnualReportRunNeedsAttention &&
                latestAnnualReportRun?.error ? (
                  <div
                    className={
                      latestAnnualReportRun.status === "failed"
                        ? "workspace-inline-error"
                        : "workspace-inline-info"
                    }
                    role="status"
                  >
                    {latestAnnualReportRun.error.userMessage}
                  </div>
                ) : null}
                {clearAnnualReportMutation.isError ? (
                  <div className="workspace-inline-error" role="alert">
                    {toUserFacingErrorMessage(clearAnnualReportMutation.error)}
                  </div>
                ) : null}
                {clearAnnualReportMutation.isSuccess ? (
                  <div className="workspace-inline-success" role="status">
                    Active annual-report data cleared from this workspace.
                  </div>
                ) : null}
              </div>

              <div className="module-stage-card__actions">
                <ButtonV1
                  variant="black"
                  onClick={startUpload}
                  disabled={
                    !annualReportFile ||
                    annualReportFileTooLarge ||
                    annualReportMutation.isPending ||
                    annualReportUploadBlockedByRun
                  }
                >
                  {hasActiveAnnualReportExtraction
                    ? "Upload a new annual report"
                    : activeModuleDefinition.ctaLabel}
                </ButtonV1>
                {hasActiveAnnualReportExtraction ? (
                  <ButtonV1
                    variant="secondary"
                    onClick={clearActiveData}
                    disabled={
                      clearAnnualReportMutation.isPending ||
                      annualReportMutation.isPending ||
                      annualReportRunIsOpen
                    }
                  >
                    Clear annual report data
                  </ButtonV1>
                ) : null}
              </div>
            </div>
          </div>
        </CardV1>

        <CardV1 className="module-data-card">
          <div className="module-data-card__header">
            <div>
              <div className="workspace-panel-header__eyebrow">AI analysis</div>
              <h2>Forensic tax review</h2>
            </div>
            <div className="module-data-card__status">
              {annualReportRunIsOpen && !annualReportRunIsStale
                ? latestAnnualReportRun?.statusMessage
                : annualReportRunIsStale
                  ? "Stalled run"
                : latestAnnualReportRun?.status === "failed"
                  ? "Failed"
                  : latestAnnualReportRun?.status === "partial"
                    ? "Incomplete extraction"
                : annualResultState.status === "legacy"
                  ? "Legacy result"
                : annualResultState.status === "partial"
                  ? "Partial extraction"
                : annualUsedFallback
                  ? "Fallback only"
                : annualTaxAnalysis
                  ? `${annualTaxAnalysis.findings.length} findings`
                  : annualResultState.status === "ready"
                    ? "Extracted"
                    : "Pending first run"}
            </div>
          </div>

          {annualReportRunIsOpen && !annualReportRunIsStale ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>AI is reviewing tax-sensitive areas now.</strong>
                <p>
                  {latestAnnualReportRun?.hasPreviousActiveResult
                    ? "A new annual report is processing. The current results stay visible until the replacement completes."
                    : "D.ink is extracting financial data first, then generating a forensic tax-risk assessment for downstream modules."}
                </p>
              </div>
            </div>
          ) : annualReportRunIsStale ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>The latest annual-report run appears stalled.</strong>
                <p>
                  No progress has been recorded for more than 5 minutes. Upload a
                  replacement report to continue the workflow.
                </p>
              </div>
            </div>
          ) : annualTaxAnalysis ? (
            <div className="module-ai-analysis-card">
              {latestAnnualReportRunNeedsAttention &&
              latestAnnualReportRun?.hasPreviousActiveResult ? (
                <div className="module-ai-analysis-card__summary">
                  <strong>
                    {latestAnnualReportRun.status === "failed"
                      ? "The latest upload did not replace the active result."
                      : "The latest upload is incomplete and did not replace the active result."}
                  </strong>
                  <p>
                    {latestAnnualReportRun.error?.userMessage ??
                      "The previous annual-report analysis remains active."}
                  </p>
                </div>
              ) : null}

              <div className="module-ai-analysis-card__summary">
                <strong>{annualTaxAnalysis.executiveSummary}</strong>
                <p>{annualTaxAnalysis.accountingStandardAssessment.rationale}</p>
              </div>

              <ModuleSummaryGridV1>
                <ModuleSummaryItemV1
                  label="Accounting standard"
                  value={annualFields?.accountingStandard.value ?? "Missing"}
                />
                <ModuleSummaryItemV1
                  label="Risk findings"
                  value={String(annualTaxAnalysis.findings.length)}
                />
                <ModuleSummaryItemV1
                  label="Next actions"
                  value={String(annualTaxAnalysis.recommendedNextActions.length)}
                />
              </ModuleSummaryGridV1>

              {annualTaxAnalysis.findings.length > 0 ? (
                <div className="module-ai-analysis-list">
                  {annualTaxAnalysis.findings.slice(0, 5).map((finding) => (
                    <div className="module-ai-analysis-item" key={finding.id}>
                      <div className="module-ai-analysis-item__header">
                        <strong>{finding.title}</strong>
                        <span
                          className="module-ai-analysis-item__severity"
                          data-severity={finding.severity}
                        >
                          {formatSeverityLabelV1(finding.severity)}
                        </span>
                      </div>
                      <p>{finding.rationale}</p>
                      {finding.recommendedFollowUp ? (
                        <div className="module-ai-analysis-item__follow-up">
                          Next step: {finding.recommendedFollowUp}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {annualTaxAnalysis.recommendedNextActions.length > 0 ? (
                <div className="module-ai-analysis-actions">
                  <div className="module-ai-analysis-actions__label">
                    Recommended next actions
                  </div>
                  <ul className="module-ai-analysis-actions__list">
                    {annualTaxAnalysis.recommendedNextActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : latestAnnualReportRun?.status === "failed" ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>Analysis failed, please retry.</strong>
                <p>
                  {latestAnnualReportRun.error?.userMessage ??
                    "The annual report could not be processed."}
                </p>
              </div>
              <div className="module-ai-analysis-card__actions">
                <ButtonV1
                  variant="black"
                  size="sm"
                  onClick={runRecoveryAction}
                  disabled={
                    annualReportMutation.isPending || annualReportUploadBlockedByRun
                  }
                >
                  {recoveryActionLabel}
                </ButtonV1>
              </div>
            </div>
          ) : latestAnnualReportRun?.status === "partial" &&
            !activeAnnualReportData?.extraction ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>Analysis completed with limited financial data.</strong>
                <p>
                  {latestAnnualReportRun.error?.userMessage ??
                    "The financial statements or note context are incomplete for this run."}
                </p>
              </div>
              <div className="module-ai-analysis-card__actions">
                <ButtonV1
                  variant="black"
                  size="sm"
                  onClick={runRecoveryAction}
                  disabled={
                    annualReportMutation.isPending || annualReportUploadBlockedByRun
                  }
                >
                  {recoveryActionLabel}
                </ButtonV1>
              </div>
            </div>
          ) : annualResultState.status === "legacy" ||
            annualResultState.status === "partial" ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>
                  {annualResultState.status === "legacy"
                    ? "This result needs to be refreshed."
                    : "Financial extraction is incomplete."}
                </strong>
                <p>{annualResultState.helperText}</p>
              </div>
              <div className="module-ai-analysis-card__actions">
                <ButtonV1
                  variant="black"
                  size="sm"
                  onClick={runRecoveryAction}
                  disabled={
                    annualReportMutation.isPending || annualReportUploadBlockedByRun
                  }
                >
                  {recoveryActionLabel}
                </ButtonV1>
              </div>
            </div>
          ) : activeAnnualReportData?.extraction ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>Financial extraction is saved.</strong>
                <p>
                  The structured annual-report data is available, but the
                  forensic tax review is not available for this saved run. Upload
                  the annual report again if you want to refresh the AI review.
                </p>
              </div>
            </div>
          ) : annualUsedFallback ? (
            <div className="module-ai-analysis-card">
              <div className="module-ai-analysis-card__summary">
                <strong>Analysis completed with limited financial data.</strong>
                <p>
                  The upload was saved, but the extracted financial data is
                  incomplete. Upload the annual report again to refresh the
                  result before relying on downstream tax analysis.
                </p>
              </div>
            </div>
          ) : (
            <div className="workspace-empty-state">
              Upload an annual report to trigger extraction and forensic tax review.
            </div>
          )}
        </CardV1>
      </>
    );
  } else if (normalizedCoreModule === "account-mapping") {
    const highConfidenceCount = mappingDecisions.filter(
      (decision) => decision.confidence >= 0.85,
    ).length;

    moduleBody = (
      <>
        <CardV1 className="module-stage-card card-v1--hero">
          <ModuleStageIntroV1
            heading={activeModuleDefinition.longLabel}
            description={activeModuleDefinition.description}
            moduleDefinition={activeModuleDefinition}
            subModule={subModule}
          />

          <div className="module-stage-card__body">
            <div className="module-stage-card__control-panel">
              <div className="module-stage-card__input-group">
                <UploadDropZoneV1
                  idPrefix="trial-balance-upload"
                  title="Upload trial balance"
                  helperText="Drag and drop an Excel or CSV trial balance here, or browse for a file."
                  accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                  buttonLabel="Choose trial balance"
                  file={trialBalanceFile}
                  onFileSelected={setTrialBalanceFile}
                  isDisabled={trialBalanceMutation.isPending}
                />
                <p className="module-stage-card__note">
                  The V1 pipeline imports the trial balance and runs the mapping
                  engine in the same deterministic step. Review still happens
                  here before moving on.
                </p>
                {trialBalanceMutation.isError ? (
                  <div className="workspace-inline-error" role="alert">
                    {toUserFacingErrorMessage(trialBalanceMutation.error)}
                  </div>
                ) : null}
                {trialBalanceMutation.isSuccess ? (
                  <div className="workspace-inline-success" role="status">
                    Trial balance uploaded and mapping pipeline completed.
                  </div>
                ) : null}
              </div>

              <div className="module-stage-card__actions">
                <ButtonV1
                  variant="black"
                  onClick={handleTrialBalanceRunV1}
                  disabled={!trialBalanceFile || trialBalanceMutation.isPending}
                >
                  {activeModuleDefinition.ctaLabel}
                </ButtonV1>
              </div>
            </div>
          </div>
        </CardV1>

        <CardV1 className="module-data-card">
          <div className="module-data-card__header">
            <div>
              <div className="workspace-panel-header__eyebrow">Review</div>
              <h2>Mapped account preview</h2>
            </div>
            <div className="module-data-card__status">
              {mappingDecisions.length > 0
                ? `${mappingDecisions.length} accounts mapped`
                : "No mapping run yet"}
            </div>
          </div>

          {mappingQuery.isPending ? (
            <SkeletonV1 height={220} />
          ) : mappingDecisions.length > 0 ? (
            <>
              <ModuleSummaryGridV1>
                <ModuleSummaryItemV1
                  label="Mapped accounts"
                  value={String(mappingDecisions.length)}
                />
                <ModuleSummaryItemV1
                  label="High-confidence rows"
                  value={String(highConfidenceCount)}
                />
                <ModuleSummaryItemV1
                  label="Next action"
                  value="Review exceptions"
                />
              </ModuleSummaryGridV1>

              <table className="module-data-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingDecisions.slice(0, 8).map((decision) => (
                    <tr key={decision.id}>
                      <td>{decision.sourceAccountNumber}</td>
                      <td>{decision.accountName}</td>
                      <td>{decision.selectedCategory.name}</td>
                      <td>{Math.round(decision.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="workspace-empty-state">
              Import the trial balance to populate the account table.
            </div>
          )}
        </CardV1>
      </>
    );
  } else if (normalizedCoreModule === "tax-adjustments") {
    moduleBody = (
      <>
        <CardV1 className="module-stage-card card-v1--hero">
          <ModuleStageIntroV1
            heading={activeModuleDefinition.longLabel}
            description={activeModuleDefinition.description}
            moduleDefinition={activeModuleDefinition}
            subModule={subModule}
          />

          <div className="module-stage-card__body">
            <div className="module-stage-card__control-panel">
              <p className="module-stage-card__note">
                Generate the draft adjustment set after mapping is reviewed.
                This action also refreshes the deterministic tax summary used by
                the INK2 draft.
              </p>

              <div className="module-stage-card__actions">
                <ButtonV1
                  variant="black"
                  onClick={() => taxAdjustmentsMutation.mutate()}
                  disabled={taxAdjustmentsMutation.isPending}
                >
                  {activeModuleDefinition.ctaLabel}
                </ButtonV1>
              </div>
            </div>
          </div>
        </CardV1>

        <CardV1 className="module-data-card">
          <div className="module-data-card__header">
            <div>
              <div className="workspace-panel-header__eyebrow">Review</div>
              <h2>Tax effect summary</h2>
            </div>
            <div className="module-data-card__status">
              {taxAdjustmentsQuery.isSuccess
                ? `${taxAdjustmentDecisions.length} adjustments generated`
                : "No adjustment set yet"}
            </div>
          </div>

          {taxSummaryQuery.isPending ? (
            <SkeletonV1 height={180} />
          ) : taxSummary ? (
            <ModuleSummaryGridV1>
              <ModuleSummaryItemV1
                label="Taxable income"
                value={formatCurrencyV1(taxSummary.taxableIncome)}
              />
              <ModuleSummaryItemV1
                label="Corporate tax"
                value={formatCurrencyV1(taxSummary.corporateTax)}
              />
              <ModuleSummaryItemV1
                label="Draft adjustments"
                value={String(taxAdjustmentDecisions.length)}
              />
            </ModuleSummaryGridV1>
          ) : (
            <div className="workspace-empty-state">
              Generate tax adjustments to produce the tax summary.
            </div>
          )}
        </CardV1>
      </>
    );
  } else {
    moduleBody = (
      <>
        <CardV1 className="module-stage-card card-v1--hero">
          <ModuleStageIntroV1
            heading={activeModuleDefinition.longLabel}
            description={activeModuleDefinition.description}
            moduleDefinition={activeModuleDefinition}
            subModule={subModule}
          />

          <div className="module-stage-card__body">
            <div className="module-stage-card__control-panel">
              <p className="module-stage-card__note">
                Generate the INK2 draft once the tax summary is reviewed. Export
                remains available only after a draft exists.
              </p>

              <div className="module-stage-card__actions">
                <ButtonV1
                  variant="black"
                  onClick={() => ink2Mutation.mutate()}
                  disabled={ink2Mutation.isPending}
                >
                  {activeModuleDefinition.ctaLabel}
                </ButtonV1>
                <ButtonV1
                  variant="secondary"
                  onClick={() => exportPdfMutation.mutate()}
                  disabled={!ink2Query.isSuccess || exportPdfMutation.isPending}
                >
                  Export PDF
                </ButtonV1>
              </div>
            </div>
          </div>
        </CardV1>

        <CardV1 className="module-data-card">
          <div className="module-data-card__header">
            <div>
              <div className="workspace-panel-header__eyebrow">Review</div>
              <h2>INK2 draft preview</h2>
            </div>
            <div className="module-data-card__status">
              {ink2Query.isSuccess ? "Draft available" : "No draft generated"}
            </div>
          </div>

          {ink2Query.isPending ? (
            <SkeletonV1 height={220} />
          ) : ink2Fields.length > 0 ? (
            <>
              <ModuleSummaryGridV1>
                <ModuleSummaryItemV1
                  label="Draft fields"
                  value={String(ink2Fields.length)}
                />
                <ModuleSummaryItemV1
                  label="Export"
                  value={exportPdfMutation.isSuccess ? "Created" : "Pending"}
                />
                <ModuleSummaryItemV1
                  label="Next action"
                  value="Review and export"
                />
              </ModuleSummaryGridV1>

              <table className="module-data-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ink2Fields.slice(0, 8).map((field) => (
                    <tr key={field.fieldId}>
                      <td>{field.fieldId}</td>
                      <td>{formatCurrencyV1(field.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="workspace-empty-state">
              Generate the INK2 draft to review the final return.
            </div>
          )}
        </CardV1>
      </>
    );
  }

  const sidebar =
    normalizedCoreModule === "annual-report-analysis" ? (
      <AnnualReportSidebarV1
        annualDocumentWarnings={annualDocumentWarnings}
        annualFields={annualFields}
        annualReportClearPending={clearAnnualReportMutation.isPending}
        annualReportMutationPending={
          annualReportMutation.isPending || annualReportUploadBlockedByRun
        }
        hasActiveExtraction={hasActiveAnnualReportExtraction}
        extraction={displayedAnnualExtraction}
        onClearRequested={clearActiveData}
        onRecoveryRequested={runRecoveryAction}
        processingRun={latestAnnualReportRun}
        recoveryActionLabel={recoveryActionLabel}
        runtime={displayedAnnualRuntime}
      />
    ) : (
      <WorkspaceReviewPanelV1
        tenantId={principal.tenantId}
        workspaceId={workspace.id}
        workspaceStatus={workspace.status}
        recommendedNextAction={moduleWorkflowState.nextActionLabel}
        warning={moduleWorkflowState.warning}
      />
    );

  return (
    <div className="module-shell">
      {moduleWorkflowState.warning ? (
        <div className="workflow-warning-banner" role="alert">
          {moduleWorkflowState.warning}
        </div>
      ) : null}

      <div className="module-shell__layout">
        <div className="module-shell__main">{moduleBody}</div>
        {sidebar}
      </div>
    </div>
  );
}
