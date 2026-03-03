import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type Ink2FormDraftPayloadV1,
  parseInk2FormDraftPayloadV1,
} from "../../shared/contracts/ink2-form.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import {
  type TaxSummaryPayloadV1,
  parseTaxSummaryPayloadV1,
} from "../../shared/contracts/tax-summary.v1";

export type PopulateInk2FormInputV1 = {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  adjustmentsArtifactId: string;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
  summary: TaxSummaryPayloadV1;
  summaryArtifactId: string;
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

function sumAdjustmentsForFieldV1(
  adjustments: TaxAdjustmentDecisionSetPayloadV1,
  targetField:
    | "INK2S.non_deductible_expenses"
    | "INK2S.representation_non_deductible"
    | "INK2S.depreciation_adjustment"
    | "INK2S.other_manual_adjustments",
): number {
  return roundToMinorUnitV1(
    adjustments.decisions
      .filter((decision) => decision.targetField === targetField)
      .reduce((sum, decision) => sum + decision.amount, 0),
  );
}

/**
 * Deterministically populates V1 INK2 draft fields from extraction/adjustments/summary.
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
  if (
    typeof candidate.extractionArtifactId !== "string" ||
    typeof candidate.adjustmentsArtifactId !== "string" ||
    typeof candidate.summaryArtifactId !== "string"
  ) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "INK2 form artifact references are invalid.",
        user_message: "INK2 form artifact references are invalid.",
        context: {},
      },
    };
  }

  let extraction: AnnualReportExtractionPayloadV1;
  let adjustments: TaxAdjustmentDecisionSetPayloadV1;
  let summary: TaxSummaryPayloadV1;
  try {
    extraction = parseAnnualReportExtractionPayloadV1(candidate.extraction);
    adjustments = parseTaxAdjustmentDecisionSetPayloadV1(candidate.adjustments);
    summary = parseTaxSummaryPayloadV1(candidate.summary);
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

  const profitBeforeTax = extraction.fields.profitBeforeTax.value;
  if (typeof profitBeforeTax !== "number") {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "profitBeforeTax is required for INK2 draft generation.",
        user_message: "Annual extraction is missing profit before tax.",
        context: {},
      },
    };
  }

  const nonDeductible = sumAdjustmentsForFieldV1(
    adjustments,
    "INK2S.non_deductible_expenses",
  );
  const representation = sumAdjustmentsForFieldV1(
    adjustments,
    "INK2S.representation_non_deductible",
  );
  const depreciation = sumAdjustmentsForFieldV1(
    adjustments,
    "INK2S.depreciation_adjustment",
  );
  const otherManual = sumAdjustmentsForFieldV1(
    adjustments,
    "INK2S.other_manual_adjustments",
  );
  const computedTotalAdjustments = roundToMinorUnitV1(
    nonDeductible + representation + depreciation + otherManual,
  );
  const summaryTotalAdjustments = roundToMinorUnitV1(summary.totalAdjustments);

  const validationIssues: string[] = [];
  if (computedTotalAdjustments !== summaryTotalAdjustments) {
    validationIssues.push(
      "Adjustment line-item sum does not match tax summary total adjustments.",
    );
  }

  try {
    const form = parseInk2FormDraftPayloadV1({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: candidate.extractionArtifactId,
      adjustmentsArtifactId: candidate.adjustmentsArtifactId,
      summaryArtifactId: candidate.summaryArtifactId,
      fields: [
        {
          fieldId: "INK2R.profit_before_tax",
          amount: roundToMinorUnitV1(profitBeforeTax),
          provenance: "extracted",
          sourceReferences: ["annual_report_extraction:profitBeforeTax"],
        },
        {
          fieldId: "INK2S.non_deductible_expenses",
          amount: nonDeductible,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:INK2S.non_deductible_expenses"],
        },
        {
          fieldId: "INK2S.representation_non_deductible",
          amount: representation,
          provenance: "adjustment",
          sourceReferences: [
            "tax_adjustments:INK2S.representation_non_deductible",
          ],
        },
        {
          fieldId: "INK2S.depreciation_adjustment",
          amount: depreciation,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:INK2S.depreciation_adjustment"],
        },
        {
          fieldId: "INK2S.other_manual_adjustments",
          amount: otherManual,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:INK2S.other_manual_adjustments"],
        },
        {
          fieldId: "INK2S.total_adjustments",
          amount: summaryTotalAdjustments,
          provenance: "calculated",
          sourceReferences: ["tax_summary:totalAdjustments"],
        },
        {
          fieldId: "INK2S.taxable_income",
          amount: roundToMinorUnitV1(summary.taxableIncome),
          provenance: "calculated",
          sourceReferences: ["tax_summary:taxableIncome"],
        },
        {
          fieldId: "INK2S.corporate_tax",
          amount: roundToMinorUnitV1(summary.corporateTax),
          provenance: "calculated",
          sourceReferences: ["tax_summary:corporateTax"],
        },
      ],
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
