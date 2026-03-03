import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import {
  type TaxSummaryPayloadV1,
  parseTaxSummaryPayloadV1,
} from "../../shared/contracts/tax-summary.v1";
import { resolveCorporateTaxRateByFiscalYearEndV1 } from "./tax-rate-config.v1";

export type CalculateTaxSummaryInputV1 = {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  adjustmentsArtifactId: string;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
};

export type CalculateTaxSummaryResultV1 =
  | {
      ok: true;
      summary: TaxSummaryPayloadV1;
    }
  | {
      error: {
        code: "INPUT_INVALID" | "INPUT_INVALID_FISCAL_YEAR";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
      ok: false;
    };

function roundToMinorUnitV1(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic tax summary calculator for V1.
 *
 * Safety boundary:
 * - No AI calls or probabilistic behavior.
 * - Outputs remain traceable to confirmed extraction and active adjustments.
 */
export function calculateTaxSummaryV1(
  input: unknown,
): CalculateTaxSummaryResultV1 {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax summary input payload is invalid.",
        user_message: "Tax summary input is invalid.",
        context: {},
      },
    };
  }

  const candidate = input as Partial<CalculateTaxSummaryInputV1>;
  if (
    typeof candidate.extractionArtifactId !== "string" ||
    candidate.extractionArtifactId.trim().length === 0 ||
    typeof candidate.adjustmentsArtifactId !== "string" ||
    candidate.adjustmentsArtifactId.trim().length === 0
  ) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax summary artifact references are invalid.",
        user_message: "Tax summary artifact references are invalid.",
        context: {},
      },
    };
  }

  let extraction: AnnualReportExtractionPayloadV1;
  let adjustments: TaxAdjustmentDecisionSetPayloadV1;
  try {
    extraction = parseAnnualReportExtractionPayloadV1(candidate.extraction);
    adjustments = parseTaxAdjustmentDecisionSetPayloadV1(candidate.adjustments);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax summary input contracts are invalid.",
        user_message: "Tax summary input payload is invalid.",
        context: {
          message: error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }

  if (!extraction.confirmation.isConfirmed) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Annual report extraction must be confirmed before tax summary.",
        user_message: "Confirm annual report extraction before running tax summary.",
        context: {},
      },
    };
  }

  const fiscalYearEnd = extraction.fields.fiscalYearEnd.value;
  const profitBeforeTax = extraction.fields.profitBeforeTax.value;
  if (!fiscalYearEnd || typeof profitBeforeTax !== "number") {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "Annual report extraction is missing fiscalYearEnd or profitBeforeTax required by tax summary.",
        user_message:
          "Annual report extraction is missing required fields for tax summary.",
        context: {
          fiscalYearEnd,
          profitBeforeTax,
        },
      },
    };
  }

  const taxRateResult = resolveCorporateTaxRateByFiscalYearEndV1({
    fiscalYearEnd,
  });
  if (!taxRateResult.ok) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID_FISCAL_YEAR",
        message: taxRateResult.error.message,
        user_message: taxRateResult.error.user_message,
        context: taxRateResult.error.context,
      },
    };
  }

  const totalAdjustments = roundToMinorUnitV1(adjustments.summary.totalNetAdjustments);
  const taxableIncome = roundToMinorUnitV1(profitBeforeTax + totalAdjustments);
  const corporateTax = roundToMinorUnitV1(
    taxableIncome * (taxRateResult.taxRatePercent / 100),
  );

  try {
    const summary = parseTaxSummaryPayloadV1({
      schemaVersion: "tax_summary_v1",
      extractionArtifactId: candidate.extractionArtifactId,
      adjustmentsArtifactId: candidate.adjustmentsArtifactId,
      fiscalYearEnd,
      taxRatePercent: taxRateResult.taxRatePercent,
      profitBeforeTax,
      totalAdjustments,
      taxableIncome,
      corporateTax,
      lineItems: [
        {
          code: "profit_before_tax",
          amount: profitBeforeTax,
          sourceReference: "annual_report_extraction:profitBeforeTax",
        },
        {
          code: "total_adjustments",
          amount: totalAdjustments,
          sourceReference: "tax_adjustments:totalNetAdjustments",
        },
        {
          code: "taxable_income",
          amount: taxableIncome,
          sourceReference: "calc:profit_before_tax+total_adjustments",
        },
        {
          code: "corporate_tax",
          amount: corporateTax,
          sourceReference: "calc:taxable_income*tax_rate",
        },
      ],
    });

    return {
      ok: true,
      summary,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax summary output failed contract validation.",
        user_message: "Generated tax summary is invalid.",
        context: {
          message: error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }
}
