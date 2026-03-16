# Tax Adjustments Submodule Catalog V1

This catalog reserves a dedicated code space for each target tax-adjustment submodule so prompt logic, policy packs, routing, and tests can evolve independently.

## Canonical scaffolded submodules
- `general_client_information`
- `trial_balance_to_local_gaap`
- `provisions`
- `buildings_improvements_property_gains`
- `avskrivning_pa_byggnader_vm4`
- `capital_assets_and_unrealized_changes`
- `cfc_taxation`
- `non_taxable_income`
- `yield_risk_and_renewable_energy_taxes`
- `group_contributions`
- `disallowed_expenses`
- `pension_costs_and_special_payroll_tax`
- `depreciation_tangible_and_acquired_intangible_assets`
- `shares_and_participations`
- `partnership_interest_n3b`
- `property_tax_and_property_fee`
- `warranty_provision`
- `notional_income_on_tax_allocation_reserve`
- `inventory_obsolescence_reserve`
- `shares_and_participations_average_method`
- `items_not_included_in_books`
- `hybrid_targeted_interest_and_net_interest_offset`
- `final_tax_calculation`

## Current bridge modules still wired in runtime
- `non_deductible_expenses`
- `representation_entertainment`
- `depreciation_differences_basic`
- `manual_review_bucket`

## Intent
- Each canonical submodule owns its own directory under `src/server/ai/modules/`.
- Each canonical submodule has its own `module-spec.v1.json` and `prompt-text.v1.ts`.
- Bridge modules remain active until routing and deterministic handoff are migrated safely.
