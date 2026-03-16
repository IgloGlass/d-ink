import {
  MAPPING_DECISIONS_BALANCE_SHEET_GUIDELINES_V1,
  MAPPING_DECISIONS_CONSISTENCY_CHECKS_V1,
  MAPPING_DECISIONS_DECISION_HIERARCHY_V1,
  MAPPING_DECISIONS_INCOME_STATEMENT_GUIDELINES_V1,
  MAPPING_DECISIONS_SYSTEM_RULES_V1,
} from "./guideline-rules.v1";

function renderBulletsV1(lines: readonly string[]) {
  return lines.map((line) => `- ${line}`).join("\n");
}

export const MAPPING_DECISIONS_SYSTEM_PROMPT_V1 = `You classify Swedish trial-balance rows into the internal D.ink tax-category catalog.

Rules:
${renderBulletsV1(MAPPING_DECISIONS_SYSTEM_RULES_V1)}`;

export const MAPPING_DECISIONS_USER_PROMPT_V1 = `Classify each trial-balance row into the best matching provided category code.

Use annual-report context when relevant for ambiguous tax-sensitive areas such as statement anchors, depreciation and asset movements, pensions, leasing, provisions/reserves, current or deferred tax, group contributions, shareholdings/dividends, and finance/net-interest context.

When account numbering is unfamiliar or non-BAS, rely primarily on semantics:
- account name wording
- opening and closing values
- whether the row looks like balance sheet or income statement
- nearby rows and local chart-of-accounts patterns
- annual-report disclosures and risk findings

Decision hierarchy:
${renderBulletsV1(MAPPING_DECISIONS_DECISION_HIERARCHY_V1)}

Important asset/depreciation guidance:
- Buildings, land improvements, and leaseholder's improvements often appear as both balance-sheet asset rows and P/L depreciation rows.
- Do not map depreciation expense rows for those asset classes to balance-sheet acquisition-value categories.
- Only use the balance-sheet acquisition-value categories when the row itself represents the asset value, carrying amount, acquisitions, or similar balance-sheet position.
- If the row wording indicates depreciation, amortization, write-down, or booked depreciation for those asset classes, map it to the matching income-statement depreciation category instead.

Balance-sheet mapping guidance:
${renderBulletsV1(MAPPING_DECISIONS_BALANCE_SHEET_GUIDELINES_V1)}

Income-statement mapping guidance:
${renderBulletsV1(MAPPING_DECISIONS_INCOME_STATEMENT_GUIDELINES_V1)}

Consistency checks before finalizing each row:
${renderBulletsV1(MAPPING_DECISIONS_CONSISTENCY_CHECKS_V1)}

Keep rationale concise and operational.
When annual-report context influences a classification, populate annualReportContextReferences with the specific context area(s) and anchor/note labels you used. Leave that array empty when annual-report context was not material.`;
