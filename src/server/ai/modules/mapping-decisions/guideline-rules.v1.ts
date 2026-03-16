/**
 * Mapping-specific prompt rules preserved from the original account-mapper
 * guidance. Keep these versioned and prompt-rendered so future refactors do
 * not silently drop domain instructions that materially affect classifications.
 */
export const MAPPING_DECISIONS_SYSTEM_RULES_V1 = [
  "Return JSON only.",
  "Choose exactly one selectedCategoryCode per input row.",
  "Use reviewFlag whenever the classification is ambiguous, tax-sensitive, or depends on note-level annual-report context.",
  "Never invent category codes outside the provided catalog.",
  "Prefer the category that best supports later Swedish corporate income tax review.",
  "Do not calculate tax. This module only proposes mapping decisions.",
  "Account numbers may follow BAS, but they may also be client-specific, ERP-specific, grouped, legacy, or partially custom.",
  "Do not assume BAS numbering is reliable. Treat account number patterns as one signal only.",
  "Prefer semantic classification from account name, values, nearby row context, annual-report context, and tax-sensitive disclosures ahead of pure number-pattern matching.",
  "Annual-report context is supportive only. Use it to improve classification where the trial balance alone is insufficient.",
  "Preserve statement-type discipline. Do not map expense rows into balance-sheet acquisition-value categories, and do not map asset rows into income-statement depreciation categories unless the row itself is clearly a depreciation or write-down expense.",
  "For buildings, land improvements, and leaseholder's improvements, distinguish acquisition/carrying-value asset rows from booked-depreciation expense rows. Acquisition or carrying-value rows belong to balance-sheet asset categories. Depreciation expense rows belong to the income statement only.",
  "If a row describes depreciation of leasehold improvements, buildings, or land improvements, prefer the matching booked-depreciation P/L category rather than the underlying balance-sheet asset category.",
  "If no specific tax-sensitive category is justified, fall back to the non-tax-sensitive category for the row's statement type.",
] as const;

export const MAPPING_DECISIONS_BALANCE_SHEET_GUIDELINES_V1 = [
  "Capitalized expenditure (balanserad utgift) and related balance-sheet depreciation balances are usually non-tax sensitive unless the wording clearly indicates a more specific building, land-improvement, or leasehold-improvement asset category.",
  "In the balance sheet, building depreciation, land-improvement depreciation, and leasehold-improvement depreciation are not mapped to their depreciation categories. If they appear as balance-sheet balances rather than P/L expenses, treat them as non-tax sensitive balance-sheet rows unless the row is clearly an acquisition or carrying-value asset row. This exception overrides the generic accumulated-depreciation-to-102000 rule.",
  "Land (mark) is generally not depreciated and should usually remain non-tax sensitive rather than being treated as a depreciable asset category.",
  "Balance-sheet accumulated depreciation (ackumulerad avskrivning) should normally map to the general tangible/acquired intangible opening-closing balance category, not accelerated depreciation, unless the row clearly refers to excess/accelerated depreciation.",
  "Work in progress, ongoing projects, and similar balance-sheet construction or project balances are generally non-tax sensitive balance-sheet rows.",
  "Balance-sheet accruals, provisions, reserveringar, and avsattningar should generally map to Other provisions unless a more specific category is clearly indicated.",
  "Property-tax accruals or liabilities should map to Property tax and property fee rather than a generic provision category when that is what the row concerns.",
  "Group-contribution receivables should not be treated as generic provisions.",
  "Intra-group receivables with a lower closing balance than opening balance can indicate a write-down or change in value on capital assets and may belong in the related balance-sheet tax-sensitive category.",
  "Estimated or accrued special payroll tax on pension costs in the balance sheet should map to Accrued special payroll tax on pension when the row is clearly an accrual or provision for that tax.",
  "No balance-sheet row should map to Result of the year.",
  "Bad debt, doubtful receivables, osakra kundfordringar, or disputed receivables may map to Doubtful debts, but ordinary trade receivables should not.",
] as const;

export const MAPPING_DECISIONS_INCOME_STATEMENT_GUIDELINES_V1 = [
  "Leasing costs should generally map to Interest - financial leasing - cost when the row is truly a leasing-interest or financial-leasing cost.",
  "For PP&E and acquired intangible depreciation in the income statement, use Tangible/acquired intangible assets - booked depreciation unless the row is specifically for buildings, land improvements, or leaseholder's improvements, which have their own booked-depreciation categories.",
  "Differentiate depreciated building costs from ordinary building maintenance or repair costs. Maintenance and similar operating costs are usually non-tax sensitive P/L rows.",
  "Cost of goods sold, cost of sold goods, and sales-cost depreciation wording should not be treated as booked depreciation categories unless the row is clearly a tax-relevant depreciation line.",
  "Special payroll tax expense itself maps to Special payroll tax on pension cost. Pension expense that forms the basis for that tax maps to Pension costs and basis for special payroll tax on pension cost. Do not confuse those with the balance-sheet accrued special payroll tax category.",
  "Legal fees and consulting fees are generally Consulting fees when they relate to tax, legal, accounting, or similar advisory work. Tax-return assistance may also be hidden in accounting-fee wording, so take a prudent approach there. IT consulting and software-support type costs are usually non-tax sensitive operating expenses instead.",
  "Rows described as partially deductible should generally be mapped prudently to the non-deductible variant of the relevant tax-sensitive category.",
  "Social contributions, arbetsgivaravgifter, and general wage taxes are usually non-tax sensitive operating expenses, not pension-base or special-payroll-tax categories.",
  "Most ordinary salary and employment costs are non-tax sensitive operating expenses and should not be mapped to pension-base or special-payroll-tax categories unless the wording clearly supports that treatment.",
  "Interest income on the tax account maps to Interest income on the tax account. Interest cost on the tax account maps to Interest cost on the tax account, even if the row wording mentions tax-exempt or non-deductible.",
  "Banking costs generally map to Interest - Banking costs.",
  "Foreign exchange gains, losses, and FX effects generally map to Interest - FX-gain or Interest - FX-loss because they are relevant for net-interest analysis even when the chart-of-accounts presentation looks operational.",
  "Membership fees are usually presumed non-deductible unless the wording clearly indicates deductible employers'-association conflict payments or similar.",
  "Entertainment is usually presumed non-deductible unless the wording clearly supports deductible treatment, while staff catering, employee travel meals, and ordinary staff events are usually non-tax sensitive operating expenses unless the row says otherwise.",
  "Gifts, sponsorship, and donations are usually presumed non-deductible unless the row clearly indicates a small deductible staff gift or similar deductible exception.",
] as const;

export const MAPPING_DECISIONS_DECISION_HIERARCHY_V1 = [
  "First determine whether the row is balance sheet or income statement in substance, then only choose categories from that statement type.",
  "Use row semantics before account-number patterns. Account name wording and whether the row describes an asset value, accumulated depreciation balance, expense, accrual, or provision matter more than BAS-style numbering.",
  "Specific guideline exceptions override generic category heuristics. If a specific rule conflicts with a general pattern, follow the specific rule.",
  "Use annual-report context to identify asset area, tax-sensitive note support, and surrounding context, but do not let annual-report notes override explicit row wording about whether the row is acquisition value, carrying value, accumulated depreciation, or current-year expense.",
  "If evidence remains mixed after applying the specific guidelines, choose the non-tax-sensitive category for the correct statement type and set reviewFlag.",
] as const;

export const MAPPING_DECISIONS_CONSISTENCY_CHECKS_V1 = [
  "If the row is a balance-sheet accumulated depreciation balance for buildings, land improvements, or leaseholder's improvements, do not map it to an acquisition-value category or generic asset balance merely because the annual report confirms the asset note; keep the balance-sheet exception in mind.",
  "If the annual report confirms an asset class but the row wording says depreciation, accumulated depreciation, write-down, maintenance, COGS, support, or another operating-cost concept, classify the row by its own wording and statement role, not by the note heading alone.",
  "Do not let a rationale that mentions uncertainty, conflicting signals, or note-only evidence end in a highly specific tax-sensitive category without reviewFlag.",
] as const;
