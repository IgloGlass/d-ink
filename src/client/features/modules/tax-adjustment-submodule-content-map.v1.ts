import type React from "react";
import { TaxAdjSubmodule01GeneralClientInfoV1 } from "./tax-adjustments/TaxAdjSubmodule01GeneralClientInfoV1";
import { TaxAdjSubmodule02TrialBalanceToLocalGaapV1 } from "./tax-adjustments/TaxAdjSubmodule02TrialBalanceToLocalGaapV1";
import { TaxAdjSubmodule03ProvisionsV1 } from "./tax-adjustments/TaxAdjSubmodule03ProvisionsV1";
import { TaxAdjSubmodule04BuildingsV1 } from "./tax-adjustments/TaxAdjSubmodule04BuildingsV1";
import { TaxAdjSubmodule05CapitalAssetsV1 } from "./tax-adjustments/TaxAdjSubmodule05CapitalAssetsV1";
import { TaxAdjSubmodule06CfcV1 } from "./tax-adjustments/TaxAdjSubmodule06CfcV1";
import { TaxAdjSubmodule07NonTaxableIncomeV1 } from "./tax-adjustments/TaxAdjSubmodule07NonTaxableIncomeV1";
import { TaxAdjSubmodule08YieldTaxV1 } from "./tax-adjustments/TaxAdjSubmodule08YieldTaxV1";
import { TaxAdjSubmodule09GroupContributionsV1 } from "./tax-adjustments/TaxAdjSubmodule09GroupContributionsV1";
import { TaxAdjSubmodule10DisallowedExpensesV1 } from "./tax-adjustments/TaxAdjSubmodule10DisallowedExpensesV1";
import { TaxAdjSubmodule11PensionCostsV1 } from "./tax-adjustments/TaxAdjSubmodule11PensionCostsV1";
import { TaxAdjSubmodule12DepreciationV1 } from "./tax-adjustments/TaxAdjSubmodule12DepreciationV1";
import { TaxAdjSubmodule13SharesParticipationsV1 } from "./tax-adjustments/TaxAdjSubmodule13SharesParticipationsV1";
import { TaxAdjSubmodule14PartnershipN3bV1 } from "./tax-adjustments/TaxAdjSubmodule14PartnershipN3bV1";
import { TaxAdjSubmodule15PropertyTaxV1 } from "./tax-adjustments/TaxAdjSubmodule15PropertyTaxV1";
import { TaxAdjSubmodule16WarrantyProvisionV1 } from "./tax-adjustments/TaxAdjSubmodule16WarrantyProvisionV1";
import { TaxAdjSubmodule17SchablonintaktV1 } from "./tax-adjustments/TaxAdjSubmodule17SchablonintaktV1";
import { TaxAdjSubmodule18InkuransreservV1 } from "./tax-adjustments/TaxAdjSubmodule18InkuransreservV1";
import { TaxAdjSubmodule19SharesAverageMethodV1 } from "./tax-adjustments/TaxAdjSubmodule19SharesAverageMethodV1";
import { TaxAdjSubmodule20ItemsNotInBooksV1 } from "./tax-adjustments/TaxAdjSubmodule20ItemsNotInBooksV1";
import { TaxAdjSubmodule21InterestLimitationV1 } from "./tax-adjustments/TaxAdjSubmodule21InterestLimitationV1";
import { TaxAdjSubmodule22TaxCalcPreLossesV1 } from "./tax-adjustments/TaxAdjSubmodule22TaxCalcPreLossesV1";
import { TaxAdjSubmodule23TaxCalcPostLossesV1 } from "./tax-adjustments/TaxAdjSubmodule23TaxCalcPostLossesV1";
import { TaxAdjSubmodule24TaxLossesV1 } from "./tax-adjustments/TaxAdjSubmodule24TaxLossesV1";
import { TaxAdjSubmodule25PeriodiseringsfondReversalV1 } from "./tax-adjustments/TaxAdjSubmodule25PeriodiseringsfondReversalV1";
import { TaxAdjSubmodule26NetInterestDeductionV1 } from "./tax-adjustments/TaxAdjSubmodule26NetInterestDeductionV1";
import { TaxAdjSubmodule27BeloppssparrV1 } from "./tax-adjustments/TaxAdjSubmodule27BeloppssparrV1";
import { TaxAdjSubmodule28NewAllocationV1 } from "./tax-adjustments/TaxAdjSubmodule28NewAllocationV1";
import { TaxAdjSubmodule29FinalTaxableIncomeV1 } from "./tax-adjustments/TaxAdjSubmodule29FinalTaxableIncomeV1";
import { TaxAdjSubmodule30FinalTaxCalcV1 } from "./tax-adjustments/TaxAdjSubmodule30FinalTaxCalcV1";

export type TaxAdjSubmoduleContentPropsV1 = {
  workspaceId: string;
  tenantId: string;
};

const CONTENT_MAP: Record<
  number,
  React.ComponentType<TaxAdjSubmoduleContentPropsV1>
> = {
  1: TaxAdjSubmodule01GeneralClientInfoV1,
  2: TaxAdjSubmodule02TrialBalanceToLocalGaapV1,
  3: TaxAdjSubmodule03ProvisionsV1,
  4: TaxAdjSubmodule04BuildingsV1,
  5: TaxAdjSubmodule05CapitalAssetsV1,
  6: TaxAdjSubmodule06CfcV1,
  7: TaxAdjSubmodule07NonTaxableIncomeV1,
  8: TaxAdjSubmodule08YieldTaxV1,
  9: TaxAdjSubmodule09GroupContributionsV1,
  10: TaxAdjSubmodule10DisallowedExpensesV1,
  11: TaxAdjSubmodule11PensionCostsV1,
  12: TaxAdjSubmodule12DepreciationV1,
  13: TaxAdjSubmodule13SharesParticipationsV1,
  14: TaxAdjSubmodule14PartnershipN3bV1,
  15: TaxAdjSubmodule15PropertyTaxV1,
  16: TaxAdjSubmodule16WarrantyProvisionV1,
  17: TaxAdjSubmodule17SchablonintaktV1,
  18: TaxAdjSubmodule18InkuransreservV1,
  19: TaxAdjSubmodule19SharesAverageMethodV1,
  20: TaxAdjSubmodule20ItemsNotInBooksV1,
  21: TaxAdjSubmodule21InterestLimitationV1,
  22: TaxAdjSubmodule22TaxCalcPreLossesV1,
  23: TaxAdjSubmodule23TaxCalcPostLossesV1,
  24: TaxAdjSubmodule24TaxLossesV1,
  25: TaxAdjSubmodule25PeriodiseringsfondReversalV1,
  26: TaxAdjSubmodule26NetInterestDeductionV1,
  27: TaxAdjSubmodule27BeloppssparrV1,
  28: TaxAdjSubmodule28NewAllocationV1,
  29: TaxAdjSubmodule29FinalTaxableIncomeV1,
  30: TaxAdjSubmodule30FinalTaxCalcV1,
};

export function resolveTaxAdjSubmoduleContentV1(
  ordinal: number,
): React.ComponentType<TaxAdjSubmoduleContentPropsV1> | null {
  return CONTENT_MAP[ordinal] ?? null;
}
