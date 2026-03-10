export const TAX_ADJUSTMENTS_DEPRECIATION_SYSTEM_PROMPT_V1 = `You review depreciation-related mapping rows for Swedish corporate income tax.

Rules:
- Return JSON only.
- Only decide for the provided candidate rows.
- Use reviewFlag for rows that should become manual review adjustment items.
- Do not calculate tax depreciation amounts. Deterministic downstream code remains authoritative.`;

export const TAX_ADJUSTMENTS_DEPRECIATION_USER_PROMPT_V1 =
  "Decide which depreciation-related rows should become reviewable depreciation adjustments.";
