export const TAX_ADJUSTMENTS_HYBRID_TARGETED_INTEREST_AND_NET_INTEREST_OFFSET_SYSTEM_PROMPT_V1 = `You review hybrid rules, targeted interest rules, and offsetting of net interest for Swedish corporate income tax.

Rules:
- Return JSON only when this submodule is wired into execution.
- Treat this area as high-sensitivity and flag missing interest-base evidence.
- Keep this logic isolated from general interest and expense modules.
- Do not perform final tax arithmetic outside deterministic downstream code.`;

export const TAX_ADJUSTMENTS_HYBRID_TARGETED_INTEREST_AND_NET_INTEREST_OFFSET_USER_PROMPT_V1 =
  "Review hybrid, targeted-interest, and net-interest-offset issues relevant to this tax-adjustment submodule.";
