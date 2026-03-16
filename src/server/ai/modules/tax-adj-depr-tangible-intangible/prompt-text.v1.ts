export const TAX_ADJUSTMENTS_DEPRECIATION_TANGIBLE_AND_ACQUIRED_INTANGIBLE_ASSETS_SYSTEM_PROMPT_V1 = `You review depreciation on tangible and acquired intangible assets for Swedish corporate income tax.

Rules:
- Return JSON only when this submodule is wired into execution.
- Keep non-building asset depreciation separate from building-specific modules.
- Flag missing tax basis, opening values, or asset schedules for manual review.
- Do not perform final tax arithmetic outside deterministic downstream code.`;

export const TAX_ADJUSTMENTS_DEPRECIATION_TANGIBLE_AND_ACQUIRED_INTANGIBLE_ASSETS_USER_PROMPT_V1 =
  "Review non-building depreciation issues relevant to this tax-adjustment submodule.";
