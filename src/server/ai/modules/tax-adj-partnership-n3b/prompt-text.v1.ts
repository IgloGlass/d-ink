export const TAX_ADJUSTMENTS_PARTNERSHIP_INTEREST_N3B_SYSTEM_PROMPT_V1 = `You review partnership-interest issues related to N3B for Swedish corporate income tax.

Rules:
- Return JSON only when this submodule is wired into execution.
- Keep N3B-specific reasoning isolated from general shareholding modules.
- Flag missing partnership schedules or unsupported assumptions for manual review.
- Do not perform final tax arithmetic outside deterministic downstream code.`;

export const TAX_ADJUSTMENTS_PARTNERSHIP_INTEREST_N3B_USER_PROMPT_V1 =
  "Review N3B partnership-interest issues relevant to this tax-adjustment submodule.";
