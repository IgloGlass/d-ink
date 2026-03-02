import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const mappingContractPath = resolve(
  repoRoot,
  "src/shared/contracts/mapping.v1.ts",
);
const deterministicMappingPath = resolve(
  repoRoot,
  "src/server/mapping/deterministic-mapping.v1.ts",
);
const outputPath = resolve(
  repoRoot,
  "references/deterministic-mapping-review-v1.md",
);

function extractEnumValues(source, enumName) {
  const enumRegex = new RegExp(
    `${enumName}\\s*=\\s*z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`,
    "m",
  );
  const match = source.match(enumRegex);
  if (!match) {
    throw new Error(`Could not find enum ${enumName}.`);
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

function extractCategoryDefinitions(source) {
  const blockStart = source.indexOf("const SILVERFIN_TAX_CATEGORY_BY_CODE_V1");
  if (blockStart === -1) {
    throw new Error("Could not find SILVERFIN_TAX_CATEGORY_BY_CODE_V1.");
  }

  const afterStart = source.slice(blockStart);
  const mapBlockMatch = afterStart.match(/\{\s*([\s\S]*?)\s*\};\s*\n\s*\/\*\*/);
  if (!mapBlockMatch) {
    throw new Error("Could not parse SILVERFIN_TAX_CATEGORY_BY_CODE_V1 block.");
  }

  const definitions = new Map();
  const entryRegex =
    /"(\d{6})":\s*\{\s*name:\s*"([^"]+)",\s*statementType:\s*"([^"]+)",\s*\}/g;
  for (const match of mapBlockMatch[1].matchAll(entryRegex)) {
    definitions.set(match[1], {
      name: match[2],
      statementType: match[3],
    });
  }

  return definitions;
}

function extractArrayBlock(source, constantName) {
  const declarationIndex = source.indexOf(constantName);
  if (declarationIndex === -1) {
    throw new Error(`Could not find constant ${constantName}.`);
  }

  const equalsIndex = source.indexOf("=", declarationIndex);
  if (equalsIndex === -1) {
    throw new Error(`Could not find assignment for ${constantName}.`);
  }

  const arrayStart = source.indexOf("[", equalsIndex);
  if (arrayStart === -1) {
    throw new Error(`Could not find array start for ${constantName}.`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(arrayStart, index + 1);
      }
    }
  }

  throw new Error(`Could not find array end for ${constantName}.`);
}

function splitTopLevelObjects(arrayBlock) {
  const objects = [];
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  let currentStart = -1;

  for (let index = 0; index < arrayBlock.length; index += 1) {
    const char = arrayBlock[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        currentStart = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && currentStart !== -1) {
        objects.push(arrayBlock.slice(currentStart, index + 1));
        currentStart = -1;
      }
    }
  }

  return objects;
}

function extractStringArray(objectText, propertyName) {
  const regex = new RegExp(`${propertyName}:\\s*\\[([\\s\\S]*?)\\]`, "m");
  const match = objectText.match(regex);
  if (!match) {
    return [];
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

function extractRulesByCategory(source) {
  const rulesArrayBlock = extractArrayBlock(
    source,
    "const DETERMINISTIC_MAPPING_RULES_V1",
  );
  const objectTexts = splitTopLevelObjects(rulesArrayBlock);
  const rulesByCategory = new Map();

  for (const objectText of objectTexts) {
    const ruleId = objectText.match(/ruleId:\s*"([^"]+)"/)?.[1];
    const categoryCode = objectText.match(/categoryCode:\s*"(\d{6})"/)?.[1];
    if (!ruleId || !categoryCode) {
      continue;
    }

    const rule = {
      ruleId,
      exactAccountNumbers: extractStringArray(
        objectText,
        "exactAccountNumbers",
      ),
      accountNumberPrefixes: extractStringArray(
        objectText,
        "accountNumberPrefixes",
      ),
      accountNameKeywords: extractStringArray(
        objectText,
        "accountNameKeywords",
      ),
    };

    const existing = rulesByCategory.get(categoryCode) ?? [];
    existing.push(rule);
    rulesByCategory.set(categoryCode, existing);
  }

  return rulesByCategory;
}

function joinUnique(values) {
  const seen = new Set();
  const ordered = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function toCsvLikeCell(values) {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatNumberRules(rules) {
  const exact = joinUnique(
    rules
      .flatMap((rule) => rule.exactAccountNumbers)
      .map((value) => `=${value}`),
  );
  const prefixes = joinUnique(
    rules
      .flatMap((rule) => rule.accountNumberPrefixes)
      .map((value) => `${value}*`),
  );

  if (exact.length === 0 && prefixes.length === 0) {
    return "No dedicated BAS account-number rule (fallback only)";
  }

  const parts = [];
  if (exact.length > 0) {
    parts.push(`Exact: ${exact.join(", ")}`);
  }
  if (prefixes.length > 0) {
    parts.push(`Prefixes: ${prefixes.join(", ")}`);
  }
  return parts.join(" | ");
}

function buildRowsForStatementType(input) {
  const { statementType, categoryCodes, categoryDefinitions, rulesByCategory } =
    input;

  const lines = [];
  lines.push(
    "| Silverfin Category | Silverfin Code | BAS Account Number Rules | Name/Description Keyword Triggers | Rule IDs | Coverage |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- |");

  for (const code of categoryCodes) {
    const definition = categoryDefinitions.get(code);
    if (!definition || definition.statementType !== statementType) {
      continue;
    }

    const rules = rulesByCategory.get(code) ?? [];
    const keywords = joinUnique(
      rules.flatMap((rule) => rule.accountNameKeywords),
    );
    const ruleIds = rules.map((rule) => rule.ruleId);

    const coverage =
      rules.length > 0 ? "Dedicated deterministic rule(s)" : "Fallback only";

    lines.push(
      `| ${definition.name} | ${code} | ${formatNumberRules(
        rules,
      )} | ${toCsvLikeCell(keywords)} | ${toCsvLikeCell(ruleIds)} | ${coverage} |`,
    );
  }

  return lines.join("\n");
}

const mappingContractSource = readFileSync(mappingContractPath, "utf8");
const deterministicMappingSource = readFileSync(
  deterministicMappingPath,
  "utf8",
);

const categoryCodes = extractEnumValues(
  mappingContractSource,
  "SilverfinTaxCategoryCodeV1Schema",
);
const categoryDefinitions = extractCategoryDefinitions(mappingContractSource);
const rulesByCategory = extractRulesByCategory(deterministicMappingSource);

const balanceSheetTable = buildRowsForStatementType({
  statementType: "balance_sheet",
  categoryCodes,
  categoryDefinitions,
  rulesByCategory,
});
const incomeStatementTable = buildRowsForStatementType({
  statementType: "income_statement",
  categoryCodes,
  categoryDefinitions,
  rulesByCategory,
});

const generatedAt = new Date().toISOString();
const markdown = `# Deterministic Mapping Review V1

Generated from code at ${generatedAt}.

Source files:
- src/shared/contracts/mapping.v1.ts
- src/server/mapping/deterministic-mapping.v1.ts

Legend:
- BAS number rules:
  - \`=6072\` means exact account number match.
  - \`6072*\` means prefix match (all accounts beginning with 6072).
- Coverage:
  - "Dedicated deterministic rule(s)" means there is explicit rule logic for the category.
  - "Fallback only" means no explicit category-specific rule yet; mapping falls back by statement type.

## Balance Sheet Categories

${balanceSheetTable}

## Income Statement Categories

${incomeStatementTable}
`;

writeFileSync(outputPath, markdown, "utf8");

console.log(`Wrote ${outputPath}`);
