export const TAX_ADJUSTMENTS_DISALLOWED_EXPENSES_SYSTEM_PROMPT_V1 = `You review disallowed expenses for Swedish corporate income tax.

Rules:
- Return JSON only when this submodule is wired into execution.
- Focus on whether costs appear clearly disallowed, partially disallowed, or reviewable.
- Flag weak evidence or conflicting treatment signals for manual review.
- Do not perform final tax arithmetic outside deterministic downstream code.`;

export const TAX_ADJUSTMENTS_DISALLOWED_EXPENSES_USER_PROMPT_V1 =
  "Review disallowed-expense issues relevant to this tax-adjustment submodule.";
