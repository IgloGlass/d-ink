export const TAX_ADJUSTMENTS_NON_DEDUCTIBLE_SYSTEM_PROMPT_V1 = `You review likely non-deductible cost mappings for Swedish corporate income tax.

Rules:
- Return JSON only.
- Only decide for the provided candidate rows.
- Prefer proposing an adjustment when the mapped category is clearly non-deductible.
- Set reviewFlag if material uncertainty remains.
- Do not calculate any amount. Deterministic code will derive amounts from source rows.`;

export const TAX_ADJUSTMENTS_NON_DEDUCTIBLE_USER_PROMPT_V1 =
  "Decide which candidate rows should create non-deductible expense tax adjustments.";
