import { z } from "zod";

import { TaxAdjustmentModuleCodeV1Schema } from "../../../../shared/contracts/tax-adjustments.v1";

/**
 * `scaffolded` means the module has its own reserved code space and prompt home
 * but is not yet wired into the active execution path. Existing V1 bridge
 * modules remain active while we migrate safely toward the full catalog.
 */
export const TaxAdjustmentSubmoduleCatalogStatusV1Schema = z.enum([
  "scaffolded",
  "implemented",
  "legacy_bridge",
]);
export type TaxAdjustmentSubmoduleCatalogStatusV1 = z.infer<
  typeof TaxAdjustmentSubmoduleCatalogStatusV1Schema
>;

export const TaxAdjustmentSubmoduleCatalogEntryV1Schema = z
  .object({
    moduleCode: TaxAdjustmentModuleCodeV1Schema,
    moduleId: z.string().trim().min(1),
    directoryName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    promptVersion: z.string().trim().min(1),
    status: TaxAdjustmentSubmoduleCatalogStatusV1Schema,
    purpose: z.string().trim().min(1),
  })
  .strict();
export type TaxAdjustmentSubmoduleCatalogEntryV1 = z.infer<
  typeof TaxAdjustmentSubmoduleCatalogEntryV1Schema
>;

export const TaxAdjustmentSubmoduleCatalogV1Schema = z
  .array(TaxAdjustmentSubmoduleCatalogEntryV1Schema)
  .min(1);
export type TaxAdjustmentSubmoduleCatalogV1 = z.infer<
  typeof TaxAdjustmentSubmoduleCatalogV1Schema
>;

const TAX_ADJUSTMENT_SUBMODULE_CATALOG_DATA_V1 = [
  {
    moduleCode: "general_client_information",
    moduleId: "tax-adjustments-general-client-information",
    directoryName: "tax-adj-general-client-info",
    displayName: "General client information",
    promptVersion: "tax-adjustments-general-client-information.prompts.v1",
    status: "scaffolded",
    purpose: "Capture client-level facts and filing assumptions before tax treatments are applied.",
  },
  {
    moduleCode: "trial_balance_to_local_gaap",
    moduleId: "tax-adjustments-trial-balance-to-local-gaap",
    directoryName: "tax-adj-tb-local-gaap",
    displayName: "Trial balance to local GAAP",
    promptVersion: "tax-adjustments-trial-balance-to-local-gaap.prompts.v1",
    status: "scaffolded",
    purpose: "Evaluate TB-to-local-GAAP normalization issues that affect downstream tax logic.",
  },
  {
    moduleCode: "provisions",
    moduleId: "tax-adjustments-provisions",
    directoryName: "tax-adj-provisions",
    displayName: "Provisions",
    promptVersion: "tax-adjustments-provisions.prompts.v1",
    status: "scaffolded",
    purpose: "Review provision-related balances and movements for tax treatment.",
  },
  {
    moduleCode: "buildings_improvements_property_gains",
    moduleId: "tax-adjustments-buildings-improvements-property-gains",
    directoryName: "tax-adj-buildings-prop-gains",
    displayName:
      "Buildings, improvements on buildings, leaseholder's improvements, land improvements and capital gain on sale of commercial property",
    promptVersion:
      "tax-adjustments-buildings-improvements-property-gains.prompts.v1",
    status: "scaffolded",
    purpose:
      "Handle building-area tax treatments, improvements, and property-sale capital gain analysis.",
  },
  {
    moduleCode: "avskrivning_pa_byggnader_vm4",
    moduleId: "tax-adjustments-avskrivning-pa-byggnader-vm4",
    directoryName: "tax-adj-vm4-buildings",
    displayName: "Avskrivning pa byggnader - Vm4",
    promptVersion:
      "tax-adjustments-avskrivning-pa-byggnader-vm4.prompts.v1",
    status: "scaffolded",
    purpose: "Isolate VM4-specific building depreciation review logic.",
  },
  {
    moduleCode: "capital_assets_and_unrealized_changes",
    moduleId: "tax-adjustments-capital-assets-and-unrealized-changes",
    directoryName: "tax-adj-capital-assets",
    displayName: "Capital assets and unrealized changes",
    promptVersion:
      "tax-adjustments-capital-assets-and-unrealized-changes.prompts.v1",
    status: "scaffolded",
    purpose: "Review capital-asset taxation and unrealized value-change treatment.",
  },
  {
    moduleCode: "cfc_taxation",
    moduleId: "tax-adjustments-cfc-taxation",
    directoryName: "tax-adj-cfc",
    displayName: "CFC taxation",
    promptVersion: "tax-adjustments-cfc-taxation.prompts.v1",
    status: "scaffolded",
    purpose: "Reserve a dedicated module for controlled foreign company tax analysis.",
  },
  {
    moduleCode: "non_taxable_income",
    moduleId: "tax-adjustments-non-taxable-income",
    directoryName: "tax-adj-non-taxable-income",
    displayName: "Non-taxable income",
    promptVersion: "tax-adjustments-non-taxable-income.prompts.v1",
    status: "scaffolded",
    purpose: "Classify and review income items that may be exempt from taxation.",
  },
  {
    moduleCode: "yield_risk_and_renewable_energy_taxes",
    moduleId: "tax-adjustments-yield-risk-and-renewable-energy-taxes",
    directoryName: "tax-adj-yield-risk-renewable",
    displayName: "Yield tax, risk tax and renewable energy",
    promptVersion:
      "tax-adjustments-yield-risk-and-renewable-energy-taxes.prompts.v1",
    status: "scaffolded",
    purpose: "Separate yield-tax, risk-tax, and renewable-energy-specific treatments.",
  },
  {
    moduleCode: "group_contributions",
    moduleId: "tax-adjustments-group-contributions",
    directoryName: "tax-adj-group-contrib",
    displayName: "Group contributions",
    promptVersion: "tax-adjustments-group-contributions.prompts.v1",
    status: "scaffolded",
    purpose: "Review received and provided group contributions with annual-report context.",
  },
  {
    moduleCode: "disallowed_expenses",
    moduleId: "tax-adjustments-disallowed-expenses",
    directoryName: "tax-adj-disallowed-expenses",
    displayName: "Disallowed expenses",
    promptVersion: "tax-adjustments-disallowed-expenses.prompts.v1",
    status: "scaffolded",
    purpose: "Provide the future canonical home for non-deductible expense review logic.",
  },
  {
    moduleCode: "pension_costs_and_special_payroll_tax",
    moduleId: "tax-adjustments-pension-costs-and-special-payroll-tax",
    directoryName: "tax-adj-pension-special-payroll",
    displayName:
      "Pension costs and basis for special employer's contribution",
    promptVersion:
      "tax-adjustments-pension-costs-and-special-payroll-tax.prompts.v1",
    status: "scaffolded",
    purpose: "Handle pension costs and special payroll tax basis determinations.",
  },
  {
    moduleCode: "depreciation_tangible_and_acquired_intangible_assets",
    moduleId:
      "tax-adjustments-depreciation-tangible-and-acquired-intangible-assets",
    directoryName: "tax-adj-depr-tangible-intangible",
    displayName:
      "Depreciation on tangible and acquired intangible assets",
    promptVersion:
      "tax-adjustments-depreciation-tangible-and-acquired-intangible-assets.prompts.v1",
    status: "scaffolded",
    purpose:
      "Reserve a dedicated module for tax-versus-book depreciation differences on non-building assets.",
  },
  {
    moduleCode: "shares_and_participations",
    moduleId: "tax-adjustments-shares-and-participations",
    directoryName: "tax-adj-shares-participations",
    displayName: "Shares and participations",
    promptVersion: "tax-adjustments-shares-and-participations.prompts.v1",
    status: "scaffolded",
    purpose: "Review tax treatment of shares, participations, dividends, and related events.",
  },
  {
    moduleCode: "partnership_interest_n3b",
    moduleId: "tax-adjustments-partnership-interest-n3b",
    directoryName: "tax-adj-partnership-n3b",
    displayName: "Andel i handelsbolag - N3B",
    promptVersion: "tax-adjustments-partnership-interest-n3b.prompts.v1",
    status: "scaffolded",
    purpose: "Isolate N3B-specific treatment for partnership interests.",
  },
  {
    moduleCode: "property_tax_and_property_fee",
    moduleId: "tax-adjustments-property-tax-and-property-fee",
    directoryName: "tax-adj-property-tax-fee",
    displayName: "Property tax and property fee",
    promptVersion: "tax-adjustments-property-tax-and-property-fee.prompts.v1",
    status: "scaffolded",
    purpose: "Handle current and accrued property tax and property fee items.",
  },
  {
    moduleCode: "warranty_provision",
    moduleId: "tax-adjustments-warranty-provision",
    directoryName: "tax-adj-warranty-provision",
    displayName: "Warranty provision",
    promptVersion: "tax-adjustments-warranty-provision.prompts.v1",
    status: "scaffolded",
    purpose: "Review warranty provisions and related actual-cost movements.",
  },
  {
    moduleCode: "notional_income_on_tax_allocation_reserve",
    moduleId: "tax-adjustments-notional-income-on-tax-allocation-reserve",
    directoryName: "tax-adj-notional-tax-alloc-reserve",
    displayName: "Notional income on tax allocation reserve",
    promptVersion:
      "tax-adjustments-notional-income-on-tax-allocation-reserve.prompts.v1",
    status: "scaffolded",
    purpose: "Reserve a dedicated module for notional-income calculations on tax allocation reserves.",
  },
  {
    moduleCode: "inventory_obsolescence_reserve",
    moduleId: "tax-adjustments-inventory-obsolescence-reserve",
    directoryName: "tax-adj-inventory-obsolescence",
    displayName: "Obsolescence reserve for inventory",
    promptVersion:
      "tax-adjustments-inventory-obsolescence-reserve.prompts.v1",
    status: "scaffolded",
    purpose: "Handle reserve analysis for inventory obsolescence.",
  },
  {
    moduleCode: "shares_and_participations_average_method",
    moduleId: "tax-adjustments-shares-and-participations-average-method",
    directoryName: "tax-adj-shares-average-method",
    displayName: "Shares and participations - average method",
    promptVersion:
      "tax-adjustments-shares-and-participations-average-method.prompts.v1",
    status: "scaffolded",
    purpose: "Separate average-method calculations from the general shareholding module.",
  },
  {
    moduleCode: "items_not_included_in_books",
    moduleId: "tax-adjustments-items-not-included-in-books",
    directoryName: "tax-adj-items-not-in-books",
    displayName: "Items not included in the books",
    promptVersion: "tax-adjustments-items-not-included-in-books.prompts.v1",
    status: "scaffolded",
    purpose: "Review tax items that are reported outside the booked trial balance.",
  },
  {
    moduleCode: "hybrid_targeted_interest_and_net_interest_offset",
    moduleId:
      "tax-adjustments-hybrid-targeted-interest-and-net-interest-offset",
    directoryName: "tax-adj-hybrid-targeted-interest",
    displayName:
      "Hybrid- and targeted interest rules and offsetting of net interest",
    promptVersion:
      "tax-adjustments-hybrid-targeted-interest-and-net-interest-offset.prompts.v1",
    status: "scaffolded",
    purpose:
      "Reserve a dedicated module for hybrid mismatch, targeted interest, and net-interest offsetting analysis.",
  },
  {
    moduleCode: "final_tax_calculation",
    moduleId: "tax-adjustments-final-tax-calculation",
    directoryName: "tax-adj-final-tax-calc",
    displayName: "Final tax calculation",
    promptVersion: "tax-adjustments-final-tax-calculation.prompts.v1",
    status: "scaffolded",
    purpose: "Separate the final review layer before deterministic tax summary and form population.",
  },
] as const;

export const TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1 =
  TaxAdjustmentSubmoduleCatalogV1Schema.parse(
    TAX_ADJUSTMENT_SUBMODULE_CATALOG_DATA_V1,
  );

export function listTaxAdjustmentSubmoduleCatalogV1(): TaxAdjustmentSubmoduleCatalogEntryV1[] {
  return [...TAX_ADJUSTMENT_SUBMODULE_CATALOG_V1];
}
