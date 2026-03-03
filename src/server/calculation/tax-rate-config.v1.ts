export type ResolveCorporateTaxRateResultV1 =
  | {
      ok: true;
      taxRatePercent: number;
    }
  | {
      error: {
        code: "INPUT_INVALID_FISCAL_YEAR";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
      ok: false;
    };

const MIN_SUPPORTED_FISCAL_YEAR_END_V1 = "2021-01-01";
const CORPORATE_TAX_RATE_PERCENT_V1 = 20.6;

/**
 * V1 deterministic corporate tax-rate resolver.
 *
 * Rule lock:
 * - Fiscal year end >= 2021-01-01 uses 20.6%
 * - Earlier years return INPUT_INVALID_FISCAL_YEAR
 */
export function resolveCorporateTaxRateByFiscalYearEndV1(input: {
  fiscalYearEnd: string;
}): ResolveCorporateTaxRateResultV1 {
  if (typeof input.fiscalYearEnd !== "string" || input.fiscalYearEnd.length !== 10) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID_FISCAL_YEAR",
        message: "Fiscal year end must be ISO date (YYYY-MM-DD).",
        user_message: "Fiscal year end is invalid.",
        context: {
          fiscalYearEnd: input.fiscalYearEnd,
        },
      },
    };
  }

  if (input.fiscalYearEnd < MIN_SUPPORTED_FISCAL_YEAR_END_V1) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID_FISCAL_YEAR",
        message:
          "Fiscal year end is outside the V1 supported deterministic tax-rate range.",
        user_message:
          "Fiscal year is outside the supported range for deterministic tax-rate calculation.",
        context: {
          fiscalYearEnd: input.fiscalYearEnd,
          minimumSupportedFiscalYearEnd: MIN_SUPPORTED_FISCAL_YEAR_END_V1,
        },
      },
    };
  }

  return {
    ok: true,
    taxRatePercent: CORPORATE_TAX_RATE_PERCENT_V1,
  };
}
