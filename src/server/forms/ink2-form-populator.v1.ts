import {
  type AnnualReportExtractionPayloadV1,
  type AnnualReportStatementLineV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type Ink2DraftFieldV1,
  type Ink2FormDraftPayloadV1,
  parseInk2FormDraftPayloadV1,
} from "../../shared/contracts/ink2-form.v1";
import {
  type Ink2FieldDefinitionV1,
  getInk2FieldDefinitionV1,
  listInk2FieldDefinitionsV1,
} from "../../shared/contracts/ink2-layout.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  type TaxAdjustmentDecisionV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import {
  type TaxSummaryPayloadV1,
  parseTaxSummaryPayloadV1,
} from "../../shared/contracts/tax-summary.v1";

export type PopulateInk2FormInputV1 = {
  adjustments?: TaxAdjustmentDecisionSetPayloadV1;
  adjustmentsArtifactId?: string;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
  summary?: TaxSummaryPayloadV1;
  summaryArtifactId?: string;
};

export type PopulateInk2FormResultV1 =
  | {
      form: Ink2FormDraftPayloadV1;
      ok: true;
    }
  | {
      error: {
        code: "INPUT_INVALID";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
      ok: false;
    };

function roundToMinorUnitV1(value: number): number {
  return Math.round(value * 100) / 100;
}

const EMPTY_INK2_ADJUSTMENTS_ARTIFACT_ID_V1 =
  "00000000-0000-4000-8000-000000000041";
const EMPTY_INK2_SUMMARY_ARTIFACT_ID_V1 =
  "00000000-0000-4000-8000-000000000042";

function buildFallbackAdjustmentsPayloadV1(input: {
  extractionArtifactId: string;
}): TaxAdjustmentDecisionSetPayloadV1 {
  return parseTaxAdjustmentDecisionSetPayloadV1({
    schemaVersion: "tax_adjustments_v1",
    policyVersion: "ink2-provisional.v1",
    aiRuns: [],
    summary: {
      totalDecisions: 0,
      manualReviewRequired: 0,
      totalPositiveAdjustments: 0,
      totalNegativeAdjustments: 0,
      totalNetAdjustments: 0,
    },
    generatedFrom: {
      // Module 4 may need to render before mapping/adjustments exist.
      mappingArtifactId: EMPTY_INK2_ADJUSTMENTS_ARTIFACT_ID_V1,
      annualReportExtractionArtifactId: input.extractionArtifactId,
    },
    decisions: [],
  });
}

function buildFallbackSummaryPayloadV1(input: {
  adjustmentsArtifactId: string;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
}): TaxSummaryPayloadV1 {
  const profitBeforeTax = roundToMinorUnitV1(
    input.extraction.fields.profitBeforeTax.value ?? 0,
  );
  const taxableIncome = Math.max(profitBeforeTax, 0);
  const corporateTax = roundToMinorUnitV1(taxableIncome * 0.206);

  return parseTaxSummaryPayloadV1({
    schemaVersion: "tax_summary_v1",
    extractionArtifactId: input.extractionArtifactId,
    adjustmentsArtifactId: input.adjustmentsArtifactId,
    fiscalYearEnd: input.extraction.fields.fiscalYearEnd.value,
    taxRatePercent: 20.6,
    profitBeforeTax,
    totalAdjustments: 0,
    taxableIncome,
    corporateTax,
    lineItems: [
      {
        code: "profit_before_tax",
        amount: profitBeforeTax,
        sourceReference: "annual_report_extraction",
      },
      {
        code: "total_adjustments",
        amount: 0,
        sourceReference: "ink2_fallback",
      },
      {
        code: "taxable_income",
        amount: taxableIncome,
        sourceReference: "ink2_fallback",
      },
      {
        code: "corporate_tax",
        amount: corporateTax,
        sourceReference: "ink2_fallback",
      },
    ],
  });
}

function normalizeFixedSignAmountV1(
  definition: Ink2FieldDefinitionV1,
  rawAmount: number,
): number {
  if (definition.sign === "+/-") {
    return roundToMinorUnitV1(rawAmount);
  }

  return roundToMinorUnitV1(Math.abs(rawAmount));
}

function toSignedAdjustmentAmountV1(decision: TaxAdjustmentDecisionV1): number {
  if (decision.direction === "informational") {
    return 0;
  }
  if (decision.direction === "decrease_taxable_income") {
    return roundToMinorUnitV1(-Math.abs(decision.amount));
  }

  return roundToMinorUnitV1(Math.abs(decision.amount));
}

function resolveAdjustmentFieldIdV1(
  decision: TaxAdjustmentDecisionV1,
): string | null {
  switch (decision.module) {
    case "non_deductible_expenses":
    case "representation_entertainment":
    case "disallowed_expenses":
      return "4.3c";
    case "non_taxable_income":
      return "4.5c";
    case "notional_income_on_tax_allocation_reserve":
      return "4.6a";
    case "group_contributions":
      return decision.direction === "decrease_taxable_income" ? "4.4a" : "4.6c";
    case "items_not_included_in_books":
      return decision.direction === "decrease_taxable_income" ? "4.4b" : "4.6e";
    case "partnership_interest_n3b":
      return decision.direction === "decrease_taxable_income" ? "4.8d" : "4.8b";
    case "depreciation_differences_basic":
    case "depreciation_tangible_and_acquired_intangible_assets":
    case "buildings_improvements_property_gains":
    case "avskrivning_pa_byggnader_vm4":
      return "4.9";
    default:
      if (decision.targetField === "INK2S.non_deductible_expenses") {
        return "4.3c";
      }
      if (decision.targetField === "INK2S.representation_non_deductible") {
        return "4.3c";
      }
      if (decision.targetField === "INK2S.depreciation_adjustment") {
        return "4.9";
      }
      return "4.13";
  }
}

function buildStatementLineByCodeV1(
  extraction: AnnualReportExtractionPayloadV1,
): Map<string, AnnualReportStatementLineV1> {
  const lines = [
    ...(extraction.taxDeep?.ink2rExtracted.balanceSheet ?? []),
    ...(extraction.taxDeep?.ink2rExtracted.incomeStatement ?? []),
  ];
  const byCode = new Map<string, AnnualReportStatementLineV1>();

  for (const line of lines) {
    const existing = byCode.get(line.code);
    if (!existing) {
      byCode.set(line.code, line);
      continue;
    }

    byCode.set(line.code, {
      ...existing,
      currentYearValue: roundToMinorUnitV1(
        (existing.currentYearValue ?? 0) + (line.currentYearValue ?? 0),
      ),
      priorYearValue: roundToMinorUnitV1(
        (existing.priorYearValue ?? 0) + (line.priorYearValue ?? 0),
      ),
      evidence: [...existing.evidence, ...line.evidence],
    });
  }

  return byCode;
}

function buildStatementSourceReferencesV1(
  sourceCode: string,
  line: AnnualReportStatementLineV1 | undefined,
): string[] {
  if (!line) {
    return [`annual_report_statement:${sourceCode}`];
  }

  const evidenceReferences = line.evidence
    .filter((evidence) => evidence.page !== undefined)
    .map(
      (evidence) =>
        `annual_report_statement:${sourceCode}:page:${evidence.page ?? "na"}`,
    );

  return evidenceReferences.length > 0
    ? evidenceReferences
    : [`annual_report_statement:${sourceCode}`];
}

function buildAdjustmentSourceReferencesV1(
  fieldId: string,
  decisions: TaxAdjustmentDecisionV1[],
): string[] {
  if (decisions.length === 0) {
    return [`tax_adjustments:${fieldId}`];
  }

  return decisions.map((decision) => `tax_adjustments:${decision.id}`);
}

function computeTaxableResultV1(fieldAmounts: Map<string, number>): number {
  const value = (fieldId: string) =>
    roundToMinorUnitV1(fieldAmounts.get(fieldId) ?? 0);

  const netBeforeLossCarryforward =
    value("4.1") -
    value("4.2") +
    value("4.3a") +
    value("4.3b") +
    value("4.3c") -
    value("4.4a") -
    value("4.4b") -
    value("4.5a") -
    value("4.5b") -
    value("4.5c") +
    value("4.6a") +
    value("4.6b") +
    value("4.6c") +
    value("4.6d") +
    value("4.6e") -
    value("4.7a") +
    value("4.7b") -
    value("4.7c") +
    value("4.7d") +
    value("4.7e") -
    value("4.7f") -
    value("4.8a") +
    value("4.8b") +
    value("4.8c") -
    value("4.8d") +
    value("4.9") -
    value("4.10") -
    value("4.11") +
    value("4.12") +
    value("4.13");

  return roundToMinorUnitV1(
    netBeforeLossCarryforward -
      value("4.14a") +
      value("4.14b") +
      value("4.14c"),
  );
}

function buildDerivedFieldAmountsV1(input: {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  extraction: AnnualReportExtractionPayloadV1;
  statementFieldAmounts: Map<string, number>;
}): Map<string, number> {
  const fieldAmounts = new Map<string, number>(input.statementFieldAmounts);
  const adjustmentsByFieldId = new Map<string, number>();

  for (const decision of input.adjustments.decisions) {
    const fieldId = resolveAdjustmentFieldIdV1(decision);
    if (!fieldId) {
      continue;
    }

    adjustmentsByFieldId.set(
      fieldId,
      roundToMinorUnitV1(
        (adjustmentsByFieldId.get(fieldId) ?? 0) +
          toSignedAdjustmentAmountV1(decision),
      ),
    );
  }

  for (const [fieldId, amount] of adjustmentsByFieldId.entries()) {
    fieldAmounts.set(fieldId, roundToMinorUnitV1(amount));
  }

  fieldAmounts.set("4.1", roundToMinorUnitV1(fieldAmounts.get("3.27") ?? 0));
  fieldAmounts.set("4.2", roundToMinorUnitV1(fieldAmounts.get("3.28") ?? 0));
  fieldAmounts.set("4.3a", roundToMinorUnitV1(fieldAmounts.get("3.26") ?? 0));
  fieldAmounts.set(
    "1.4",
    roundToMinorUnitV1(
      input.extraction.taxDeep?.pensionContext.specialPayrollTax?.value ?? 0,
    ),
  );
  fieldAmounts.set("1.5", 0);

  const taxableResult = computeTaxableResultV1(fieldAmounts);
  fieldAmounts.set("4.15", taxableResult > 0 ? taxableResult : 0);
  fieldAmounts.set("4.16", taxableResult < 0 ? Math.abs(taxableResult) : 0);
  fieldAmounts.set("1.1", roundToMinorUnitV1(fieldAmounts.get("4.15") ?? 0));
  fieldAmounts.set("1.2", roundToMinorUnitV1(fieldAmounts.get("4.16") ?? 0));
  fieldAmounts.set("1.3", roundToMinorUnitV1(fieldAmounts.get("4.14c") ?? 0));

  return fieldAmounts;
}

function buildFormFieldsV1(input: {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  extraction: AnnualReportExtractionPayloadV1;
}): {
  fields: Ink2DraftFieldV1[];
  knownAdjustmentNetAmount: number;
  missingStatementCodes: string[];
} {
  const definitions = listInk2FieldDefinitionsV1();
  const statementLineByCode = buildStatementLineByCodeV1(input.extraction);
  const missingStatementCodes = new Set<string>();
  const statementFieldAmounts = new Map<string, number>();

  for (const definition of definitions) {
    if (!definition.sourceCode) {
      continue;
    }

    const sourceLine = statementLineByCode.get(definition.sourceCode);
    if (!sourceLine && definition.page !== 1) {
      missingStatementCodes.add(definition.sourceCode);
    }

    statementFieldAmounts.set(
      definition.fieldId,
      normalizeFixedSignAmountV1(definition, sourceLine?.currentYearValue ?? 0),
    );
  }

  const fieldAmounts = buildDerivedFieldAmountsV1({
    adjustments: input.adjustments,
    extraction: input.extraction,
    statementFieldAmounts,
  });

  const decisionsByFieldId = new Map<string, TaxAdjustmentDecisionV1[]>();
  for (const decision of input.adjustments.decisions) {
    const fieldId = resolveAdjustmentFieldIdV1(decision);
    if (!fieldId) {
      continue;
    }
    const existing = decisionsByFieldId.get(fieldId) ?? [];
    existing.push(decision);
    decisionsByFieldId.set(fieldId, existing);
  }

  const fields = definitions.map((definition) => {
    const amount = roundToMinorUnitV1(
      fieldAmounts.get(definition.fieldId) ?? 0,
    );
    const sourceLine = definition.sourceCode
      ? statementLineByCode.get(definition.sourceCode)
      : undefined;
    const relatedDecisions = decisionsByFieldId.get(definition.fieldId) ?? [];

    if (definition.sourceCode) {
      return {
        fieldId: definition.fieldId,
        amount,
        provenance: "extracted" as const,
        sourceReferences: buildStatementSourceReferencesV1(
          definition.sourceCode,
          sourceLine,
        ),
      };
    }

    if (relatedDecisions.length > 0) {
      return {
        fieldId: definition.fieldId,
        amount,
        provenance: "adjustment" as const,
        sourceReferences: buildAdjustmentSourceReferencesV1(
          definition.fieldId,
          relatedDecisions,
        ),
      };
    }

    return {
      fieldId: definition.fieldId,
      amount,
      provenance: "calculated" as const,
      sourceReferences: [`ink2_derived:${definition.fieldId}`],
    };
  });

  const knownAdjustmentNetAmount = roundToMinorUnitV1(
    [...decisionsByFieldId.entries()]
      .filter(([fieldId]) => fieldId.startsWith("4."))
      .reduce(
        (sum, [, decisions]) =>
          sum +
          decisions.reduce(
            (decisionSum, decision) =>
              decisionSum + toSignedAdjustmentAmountV1(decision),
            0,
          ),
        0,
      ),
  );

  return {
    fields,
    knownAdjustmentNetAmount,
    missingStatementCodes: [...missingStatementCodes],
  };
}

/**
 * Deterministically populates the checked-in INK2 Utg 23 template layout.
 *
 * Safety boundary:
 * - Only structured annual-report lines and structured adjustment decisions are
 *   allowed to drive the populated return.
 * - Tax form totals stay deterministic; no AI arithmetic happens here.
 */
export function populateInk2FormDraftV1(
  input: unknown,
): PopulateInk2FormResultV1 {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "INK2 form input payload is invalid.",
        user_message: "INK2 form input is invalid.",
        context: {},
      },
    };
  }

  const candidate = input as Partial<PopulateInk2FormInputV1>;
  if (typeof candidate.extractionArtifactId !== "string") {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "INK2 extraction artifact reference is invalid.",
        user_message: "INK2 form artifact references are invalid.",
        context: {},
      },
    };
  }

  let extraction: AnnualReportExtractionPayloadV1;
  let adjustments: TaxAdjustmentDecisionSetPayloadV1;
  let summary: TaxSummaryPayloadV1;
  const hasPersistedAdjustments = candidate.adjustments !== undefined;
  const hasPersistedSummary = candidate.summary !== undefined;
  try {
    extraction = parseAnnualReportExtractionPayloadV1(candidate.extraction);
    adjustments =
      candidate.adjustments !== undefined
        ? parseTaxAdjustmentDecisionSetPayloadV1(candidate.adjustments)
        : buildFallbackAdjustmentsPayloadV1({
            extractionArtifactId: candidate.extractionArtifactId,
          });
    summary =
      candidate.summary !== undefined
        ? parseTaxSummaryPayloadV1(candidate.summary)
        : buildFallbackSummaryPayloadV1({
            adjustmentsArtifactId:
              candidate.adjustmentsArtifactId ??
              EMPTY_INK2_ADJUSTMENTS_ARTIFACT_ID_V1,
            extraction,
            extractionArtifactId: candidate.extractionArtifactId,
          });
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "INK2 form input contracts are invalid.",
        user_message: "INK2 form input payload is invalid.",
        context: {
          message:
            error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }

  if (!extraction.taxDeep) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "INK2 generation requires taxDeep annual-report statement data.",
        user_message:
          "Annual-report statements are incomplete, so the INK2 draft could not be created.",
        context: {},
      },
    };
  }

  const built = buildFormFieldsV1({
    adjustments,
    extraction,
  });

  const validationIssues: string[] = [];
  if (built.missingStatementCodes.includes("3.26")) {
    validationIssues.push(
      "Annual-report extraction is missing year's result (vinst) for INK2 row 4.1.",
    );
  }
  if (built.missingStatementCodes.includes("3.27")) {
    validationIssues.push(
      "Annual-report extraction is missing year's result (forlust) for INK2 row 4.2.",
    );
  }
  if (!extraction.confirmation.isConfirmed) {
    validationIssues.push(
      "Annual-report extraction is not confirmed yet. Review INK2R values before filing.",
    );
  }
  if (!hasPersistedAdjustments) {
    validationIssues.push(
      "Tax adjustments have not been generated yet. INK2S rows are still provisional.",
    );
  }
  if (!hasPersistedSummary) {
    validationIssues.push(
      "Tax summary has not been generated yet. Taxable result is provisional.",
    );
  }
  if (
    hasPersistedSummary &&
    built.knownAdjustmentNetAmount !==
      roundToMinorUnitV1(summary.totalAdjustments)
  ) {
    validationIssues.push(
      "Mapped INK2 adjustment rows do not yet cover the full tax-summary adjustment total.",
    );
  }

  const taxableIncomeField = built.fields.find(
    (field) => field.fieldId === "4.15",
  );
  const taxableLossField = built.fields.find(
    (field) => field.fieldId === "4.16",
  );
  const taxableNetAmount = roundToMinorUnitV1(
    (taxableIncomeField?.amount ?? 0) - (taxableLossField?.amount ?? 0),
  );
  if (
    hasPersistedSummary &&
    taxableNetAmount !== roundToMinorUnitV1(summary.taxableIncome)
  ) {
    validationIssues.push(
      "Computed INK2 taxable result does not match the current tax summary.",
    );
  }

  try {
    const form = parseInk2FormDraftPayloadV1({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: candidate.extractionArtifactId,
      adjustmentsArtifactId:
        candidate.adjustmentsArtifactId ??
        EMPTY_INK2_ADJUSTMENTS_ARTIFACT_ID_V1,
      summaryArtifactId:
        candidate.summaryArtifactId ?? EMPTY_INK2_SUMMARY_ARTIFACT_ID_V1,
      fields: built.fields,
      validation: {
        status: validationIssues.length === 0 ? "valid" : "invalid",
        issues: validationIssues,
      },
    });

    return {
      ok: true,
      form,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "INK2 form output failed contract validation.",
        user_message: "Generated INK2 draft is invalid.",
        context: {
          message:
            error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }
}
