import type {
  MappingDecisionSetPayloadV1,
  MappingDecisionV1,
} from "../../../../shared/contracts/mapping.v1";
import type {
  MappingReviewSuggestionScopeV1,
  MappingReviewSuggestionV1,
} from "../../../../shared/contracts/mapping-review.v1";
import type { ReconciliationResultPayloadV1 } from "../../../../shared/contracts/reconciliation.v1";
import type { MappingReviewRuntimeConfigV1 } from "./loader.v1";

export type ExecuteMappingReviewModelInputV1 = {
  config: MappingReviewRuntimeConfigV1;
  mapping: MappingDecisionSetPayloadV1;
  reconciliation: ReconciliationResultPayloadV1;
  requestedScope: MappingReviewSuggestionScopeV1;
  maxSuggestions: number;
};

export type ExecuteMappingReviewModelResultV1 =
  | {
      ok: true;
      suggestions: MappingReviewSuggestionV1[];
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED";
        message: string;
        context: Record<string, unknown>;
      };
    };

function normalizeTextV1(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeywordV1(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(normalizeTextV1(keyword)));
}

function getGuidelineInstructionV1(input: {
  config: MappingReviewRuntimeConfigV1;
  ruleId: string;
}): string | null {
  const matchedRule = input.config.policyPack.guidelineRules.find(
    (rule) => rule.ruleId === input.ruleId,
  );
  return matchedRule?.instruction ?? null;
}

function isCategoryAllowedForDecisionStatementTypeV1(input: {
  config: MappingReviewRuntimeConfigV1;
  decision: MappingDecisionV1;
  selectedCategoryCode: MappingReviewSuggestionV1["selectedCategoryCode"];
}): boolean {
  const statementType = input.decision.proposedCategory.statementType;
  const catalog =
    statementType === "balance_sheet"
      ? input.config.policyPack.categoryCatalog.balance_sheet
      : input.config.policyPack.categoryCatalog.income_statement;
  return catalog.some((entry) => entry.code === input.selectedCategoryCode);
}

function shouldSetReviewFlagFromPolicyV1(input: {
  config: MappingReviewRuntimeConfigV1;
  decision: MappingDecisionV1;
  confidence: number;
  baseReviewFlag: boolean;
}): boolean {
  const fallbackApplied = input.decision.evidence.some(
    (evidence) => evidence.type === "fallback_category",
  );

  let reviewFlag = input.baseReviewFlag;
  for (const rule of input.config.policyPack.reviewRules) {
    if (!rule.setReviewFlag) {
      continue;
    }

    if (
      rule.when.fallbackApplied !== undefined &&
      rule.when.fallbackApplied !== fallbackApplied
    ) {
      continue;
    }

    if (
      rule.when.confidenceBelow !== undefined &&
      !(input.confidence < rule.when.confidenceBelow)
    ) {
      continue;
    }

    if (rule.when.topTwoScoreMarginBelow !== undefined) {
      // Margin is unavailable in the deterministic decision schema for V1.
      continue;
    }

    reviewFlag = true;
  }

  return reviewFlag;
}

function buildSuggestionV1(input: {
  config: MappingReviewRuntimeConfigV1;
  decision: MappingDecisionV1;
  requestedScope: MappingReviewSuggestionScopeV1;
  selectedCategoryCode: MappingReviewSuggestionV1["selectedCategoryCode"];
  policyRuleReference: string;
  confidence: number;
  baseReviewFlag: boolean;
}): MappingReviewSuggestionV1 | null {
  if (input.decision.selectedCategory.code === input.selectedCategoryCode) {
    return null;
  }

  if (
    !isCategoryAllowedForDecisionStatementTypeV1({
      config: input.config,
      decision: input.decision,
      selectedCategoryCode: input.selectedCategoryCode,
    })
  ) {
    return null;
  }

  const guidelineInstruction = getGuidelineInstructionV1({
    config: input.config,
    ruleId: input.policyRuleReference,
  });
  if (!guidelineInstruction) {
    return null;
  }

  return {
    decisionId: input.decision.id,
    selectedCategoryCode: input.selectedCategoryCode,
    scope: input.requestedScope,
    reason: guidelineInstruction,
    policyRuleReference: input.policyRuleReference,
    confidence: input.confidence,
    reviewFlag: shouldSetReviewFlagFromPolicyV1({
      config: input.config,
      decision: input.decision,
      confidence: input.confidence,
      baseReviewFlag: input.baseReviewFlag,
    }),
  };
}

function evaluateDecisionForSuggestionV1(input: {
  config: MappingReviewRuntimeConfigV1;
  decision: MappingDecisionV1;
  requestedScope: MappingReviewSuggestionScopeV1;
}): MappingReviewSuggestionV1 | null {
  const normalizedName = normalizeTextV1(input.decision.accountName);
  const statementType = input.decision.proposedCategory.statementType;
  const selectedCode = input.decision.selectedCategory.code;

  if (
    statementType === "balance_sheet" &&
    selectedCode === "229000" &&
    hasAnyKeywordV1(normalizedName, ["koncernbidrag", "group contribution"]) &&
    hasAnyKeywordV1(normalizedName, ["fordran", "receivable"])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "100000",
      policyRuleReference:
        "guideline.bs.group-contribution-receivable.not-229000.v1",
      confidence: 0.87,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "balance_sheet" &&
    selectedCode !== "151500" &&
    hasAnyKeywordV1(normalizedName, [
      "bad debt",
      "osakra kundfordringar",
      "osäkra kundfordringar",
      "tvistiga kundfordringar",
      "dubious receivables",
      "revaluation",
    ])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "151500",
      policyRuleReference: "guideline.bs.bad-debt-vs-generic-receivables.v1",
      confidence: 0.84,
      baseReviewFlag: true,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, [
      "representation",
      "partially deductible",
      "delvis avdragsgill",
      "partiellt avdragsgill",
    ])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "607200",
      policyRuleReference:
        "guideline.is.partially-deductible-representation.prudent.v1",
      confidence: 0.9,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    selectedCode === "655000" &&
    hasAnyKeywordV1(normalizedName, [
      "it konsult",
      "it consulting",
      "software",
      "hosting",
      "support",
      "systemutveckling",
      "implementation",
      "drift",
    ])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "950000",
      policyRuleReference:
        "guideline.is.legal-consulting-tax-assistance-vs-it.v1",
      confidence: 0.86,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, ["bankkostnad", "banking cost", "bankavgift"])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "657000",
      policyRuleReference:
        "guideline.is.banking-costs.prefer-657000-even-atypical-account.v1",
      confidence: 0.83,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, ["valutakursvinst", "fx gain", "exchange gain"])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "843100",
      policyRuleReference: "guideline.is.fx-effects.prefer-843100-843600.v1",
      confidence: 0.82,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, [
      "valutakursforlust",
      "valutakursförlust",
      "fx loss",
      "exchange loss",
    ])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "843600",
      policyRuleReference: "guideline.is.fx-effects.prefer-843100-843600.v1",
      confidence: 0.82,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, ["medlemsavgift", "membership fee", "membership"])
  ) {
    const shouldBeDeductible = hasAnyKeywordV1(normalizedName, [
      "konflikt",
      "conflict",
      "arbetsgivarorganisation",
      "employers association",
    ]);

    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: shouldBeDeductible ? "698100" : "698200",
      policyRuleReference:
        "guideline.is.membership-fees.default-non-deductible.v1",
      confidence: shouldBeDeductible ? 0.8 : 0.78,
      baseReviewFlag: false,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, ["gift", "gava", "gåva", "donation"])
  ) {
    const shouldBeDeductible = hasAnyKeywordV1(normalizedName, [
      "staff",
      "personal",
      "employee",
      "flower",
      "blommor",
      "julgava",
      "julgåva",
      "christmas",
      "jul",
    ]);

    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: shouldBeDeductible ? "598000" : "699300",
      policyRuleReference:
        "guideline.is.gifts.default-non-deductible.with-small-staff-exception.v1",
      confidence: shouldBeDeductible ? 0.79 : 0.77,
      baseReviewFlag: !shouldBeDeductible,
    });
  }

  if (
    statementType === "income_statement" &&
    hasAnyKeywordV1(normalizedName, [
      "arbetsgivaravgift",
      "arbetsgivaravgifter",
      "social contributions",
      "social fees",
      "sociala avgifter",
    ]) &&
    !hasAnyKeywordV1(normalizedName, ["sarskild loneskatt", "särskild löneskatt"])
  ) {
    return buildSuggestionV1({
      config: input.config,
      decision: input.decision,
      requestedScope: input.requestedScope,
      selectedCategoryCode: "950000",
      policyRuleReference:
        "guideline.is.social-contributions-vs-special-payroll-tax.v1",
      confidence: 0.8,
      baseReviewFlag: false,
    });
  }

  return null;
}

/**
 * Executes mapping-review suggestion generation using loaded policy artifacts.
 *
 * Safety boundary:
 * - This module is advisory; it never persists or auto-applies overrides.
 * - Deterministic mapping remains source of truth for active decision sets.
 */
export async function executeMappingReviewModelV1(
  input: ExecuteMappingReviewModelInputV1,
): Promise<ExecuteMappingReviewModelResultV1> {
  try {
    if (!input.reconciliation.canProceedToMapping) {
      return {
        ok: true,
        suggestions: [],
      };
    }

    const hardConstraints = input.config.policyPack
      .hardConstraints as Record<string, unknown>;
    const allowedOverrideScopes = hardConstraints.allowedOverrideScopes;
    if (
      Array.isArray(allowedOverrideScopes) &&
      !allowedOverrideScopes.includes(input.requestedScope)
    ) {
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: "Requested scope is not allowed by mapping-review policy.",
          context: {
            requestedScope: input.requestedScope,
            allowedOverrideScopes,
          },
        },
      };
    }

    const suggestions: MappingReviewSuggestionV1[] = [];
    const seenDecisionIds = new Set<string>();

    for (const decision of input.mapping.decisions) {
      if (seenDecisionIds.has(decision.id)) {
        continue;
      }

      const suggestion = evaluateDecisionForSuggestionV1({
        config: input.config,
        decision,
        requestedScope: input.requestedScope,
      });
      if (!suggestion) {
        continue;
      }

      suggestions.push(suggestion);
      seenDecisionIds.add(decision.id);

      if (suggestions.length >= input.maxSuggestions) {
        break;
      }
    }

    return {
      ok: true,
      suggestions,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unknown model execution failure.",
        context: {},
      },
    };
  }
}
