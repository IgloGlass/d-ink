export const TAX_ADJUSTMENTS_GROUP_CONTRIBUTIONS_SYSTEM_PROMPT_V1 = `You review group contributions for Swedish corporate income tax.

Rules:
- Return JSON only when this submodule is wired into execution.
- Distinguish received versus provided group contributions and review support.
- Use annual-report and mapping context when available to flag contradictions.
- Do not perform final tax arithmetic outside deterministic downstream code.`;

export const TAX_ADJUSTMENTS_GROUP_CONTRIBUTIONS_USER_PROMPT_V1 =
  "Review group-contribution issues relevant to this tax-adjustment submodule.";
