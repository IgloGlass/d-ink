import { z } from "zod";

import moduleSpecJson from "./module-spec.v1.json";
import policyPackJson from "./policy-pack.mapping-review.v1.json";
import policyPatchP0Json from "./policy-patch.mapping-review.v1-p0.json";

const MappingReviewGuidelineRuleV1Schema = z
  .object({
    ruleId: z.string().trim().min(1),
    scope: z.enum(["balance_sheet", "income_statement"]),
    instruction: z.string().trim().min(1),
  })
  .strict();

const MappingReviewReviewRuleV1Schema = z
  .object({
    ruleId: z.string().trim().min(1),
    when: z
      .object({
        fallbackApplied: z.boolean().optional(),
        confidenceBelow: z.number().min(0).max(1).optional(),
        topTwoScoreMarginBelow: z.number().min(0).max(1).optional(),
      })
      .strict(),
    setReviewFlag: z.boolean(),
  })
  .strict();

const MappingReviewCategoryCatalogEntryV1Schema = z
  .object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .strict();

const MappingReviewPolicyPackV1Schema = z
  .object({
    schemaVersion: z.literal("ai_policy_pack_v1"),
    moduleId: z.literal("mapping-review"),
    policyVersion: z.string().trim().min(1),
    hardConstraints: z
      .object({
        fallback: z
          .object({
            balanceSheetCategoryCode: z.string().trim().min(1),
            incomeStatementCategoryCode: z.string().trim().min(1),
          })
          .strict(),
      })
      .passthrough(),
    categoryCatalog: z
      .object({
        balance_sheet: z.array(MappingReviewCategoryCatalogEntryV1Schema),
        income_statement: z.array(MappingReviewCategoryCatalogEntryV1Schema),
      })
      .strict(),
    guidelineRules: z.array(MappingReviewGuidelineRuleV1Schema),
    reviewRules: z.array(MappingReviewReviewRuleV1Schema),
  })
  .passthrough();

const MappingReviewModuleSpecV1Schema = z
  .object({
    schemaVersion: z.literal("ai_module_spec_v1"),
    moduleId: z.literal("mapping-review"),
    moduleVersion: z.string().trim().min(1),
    policy: z
      .object({
        basePolicyVersion: z.string().trim().min(1),
        activePatchVersions: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .passthrough();

const DisableRulePatchOperationV1Schema = z
  .object({
    op: z.literal("disable_rule"),
    ruleId: z.string().trim().min(1),
  })
  .strict();

const AddGuidelineRulePatchOperationV1Schema = z
  .object({
    op: z.literal("add_guideline_rule"),
    rule: MappingReviewGuidelineRuleV1Schema,
  })
  .strict();

const AddReviewRulePatchOperationV1Schema = z
  .object({
    op: z.literal("add_review_rule"),
    rule: MappingReviewReviewRuleV1Schema,
  })
  .strict();

const SetThresholdPatchOperationV1Schema = z
  .object({
    op: z.literal("set_threshold"),
    target: z.literal("review.low-confidence"),
    value: z.number().min(0).max(1),
  })
  .strict();

const MappingReviewPatchOperationV1Schema = z.discriminatedUnion("op", [
  DisableRulePatchOperationV1Schema,
  AddGuidelineRulePatchOperationV1Schema,
  AddReviewRulePatchOperationV1Schema,
  SetThresholdPatchOperationV1Schema,
]);

const MappingReviewPolicyPatchV1Schema = z
  .object({
    schemaVersion: z.literal("ai_policy_patch_v1"),
    moduleId: z.literal("mapping-review"),
    patchVersion: z.string().trim().min(1),
    basePolicyVersion: z.string().trim().min(1),
    status: z.enum(["active", "inactive"]),
    operations: z.array(MappingReviewPatchOperationV1Schema),
  })
  .strict();

type MappingReviewPatchOperationV1 = z.infer<
  typeof MappingReviewPatchOperationV1Schema
>;

export type MappingReviewGuidelineRuleV1 = z.infer<
  typeof MappingReviewGuidelineRuleV1Schema
>;

export type MappingReviewReviewRuleV1 = z.infer<
  typeof MappingReviewReviewRuleV1Schema
>;

export type MappingReviewPolicyPackV1 = z.infer<
  typeof MappingReviewPolicyPackV1Schema
>;

export type MappingReviewModuleSpecV1 = z.infer<
  typeof MappingReviewModuleSpecV1Schema
>;

export type MappingReviewPolicyPatchV1 = z.infer<
  typeof MappingReviewPolicyPatchV1Schema
>;

export type LoadMappingReviewModuleConfigFailureCodeV1 =
  | "CONFIG_INVALID"
  | "PATCH_INVALID";

export type LoadMappingReviewModuleConfigFailureV1 = {
  ok: false;
  error: {
    code: LoadMappingReviewModuleConfigFailureCodeV1;
    message: string;
    context: Record<string, unknown>;
  };
};

export type MappingReviewRuntimeConfigV1 = {
  moduleSpec: MappingReviewModuleSpecV1;
  policyPack: MappingReviewPolicyPackV1;
  promptVersion: string;
};

export type LoadMappingReviewModuleConfigSuccessV1 = {
  ok: true;
  config: MappingReviewRuntimeConfigV1;
};

export type LoadMappingReviewModuleConfigResultV1 =
  | LoadMappingReviewModuleConfigSuccessV1
  | LoadMappingReviewModuleConfigFailureV1;

const KNOWN_POLICY_PATCHES_BY_VERSION_V1: Record<string, unknown> = {
  "mapping-review.v1-p0": policyPatchP0Json,
};

function applyPatchOperationToPolicyPackV1(input: {
  operation: MappingReviewPatchOperationV1;
  policyPack: MappingReviewPolicyPackV1;
}): MappingReviewPolicyPackV1 {
  const nextPolicyPack = structuredClone(input.policyPack);
  const operation = input.operation;

  if (operation.op === "disable_rule") {
    return {
      ...nextPolicyPack,
      guidelineRules: nextPolicyPack.guidelineRules.filter(
        (rule) => rule.ruleId !== operation.ruleId,
      ),
      reviewRules: nextPolicyPack.reviewRules.filter(
        (rule) => rule.ruleId !== operation.ruleId,
      ),
    };
  }

  if (operation.op === "add_guideline_rule") {
    return {
      ...nextPolicyPack,
      guidelineRules: [...nextPolicyPack.guidelineRules, operation.rule],
    };
  }

  if (operation.op === "add_review_rule") {
    return {
      ...nextPolicyPack,
      reviewRules: [...nextPolicyPack.reviewRules, operation.rule],
    };
  }

  const patchedReviewRules = nextPolicyPack.reviewRules.map((rule) => {
    if (rule.ruleId !== "review.low-confidence.v1") {
      return rule;
    }

    return {
      ...rule,
      when: {
        ...rule.when,
        confidenceBelow: operation.value,
      },
    };
  });

  return {
    ...nextPolicyPack,
    reviewRules: patchedReviewRules,
  };
}

function applyPolicyPatchesV1(input: {
  basePolicyPack: MappingReviewPolicyPackV1;
  activePatchVersions: string[];
}): LoadMappingReviewModuleConfigResultV1 {
  let patchedPolicyPack = structuredClone(input.basePolicyPack);

  for (const patchVersion of input.activePatchVersions) {
    const rawPatch = KNOWN_POLICY_PATCHES_BY_VERSION_V1[patchVersion];
    if (!rawPatch) {
      return {
        ok: false,
        error: {
          code: "PATCH_INVALID",
          message: "Unknown mapping-review policy patch version.",
          context: {
            patchVersion,
          },
        },
      };
    }

    const parsedPatch = MappingReviewPolicyPatchV1Schema.safeParse(rawPatch);
    if (!parsedPatch.success) {
      return {
        ok: false,
        error: {
          code: "PATCH_INVALID",
          message: "Policy patch payload is invalid.",
          context: {
            patchVersion,
            issues: parsedPatch.error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              path: issue.path.join("."),
            })),
          },
        },
      };
    }

    if (parsedPatch.data.status !== "active") {
      return {
        ok: false,
        error: {
          code: "PATCH_INVALID",
          message: "Inactive patch cannot be activated by module spec.",
          context: {
            patchVersion: parsedPatch.data.patchVersion,
            status: parsedPatch.data.status,
          },
        },
      };
    }

    if (parsedPatch.data.basePolicyVersion !== patchedPolicyPack.policyVersion) {
      return {
        ok: false,
        error: {
          code: "PATCH_INVALID",
          message: "Patch base policy version does not match active policy.",
          context: {
            patchVersion: parsedPatch.data.patchVersion,
            patchBasePolicyVersion: parsedPatch.data.basePolicyVersion,
            activePolicyVersion: patchedPolicyPack.policyVersion,
          },
        },
      };
    }

    for (const operation of parsedPatch.data.operations) {
      patchedPolicyPack = applyPatchOperationToPolicyPackV1({
        operation,
        policyPack: patchedPolicyPack,
      });
    }
  }

  return {
    ok: true,
    config: {
      moduleSpec: MappingReviewModuleSpecV1Schema.parse(moduleSpecJson),
      policyPack: patchedPolicyPack,
      promptVersion: "mapping-review.prompts.v1",
    },
  };
}

/**
 * Loads and validates mapping-review module configuration artifacts.
 *
 * Safety boundary:
 * - Module spec, policy pack, and active patches must parse before model execution.
 * - Invalid config must hard-fail and never silently continue with partial policy.
 */
export function loadMappingReviewModuleConfigV1(): LoadMappingReviewModuleConfigResultV1 {
  const parsedModuleSpec = MappingReviewModuleSpecV1Schema.safeParse(
    moduleSpecJson,
  );
  if (!parsedModuleSpec.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Module spec payload is invalid.",
        context: {
          issues: parsedModuleSpec.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
      },
    };
  }

  const parsedPolicyPack = MappingReviewPolicyPackV1Schema.safeParse(
    policyPackJson,
  );
  if (!parsedPolicyPack.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Policy pack payload is invalid.",
        context: {
          issues: parsedPolicyPack.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
      },
    };
  }

  if (
    parsedModuleSpec.data.policy.basePolicyVersion !==
    parsedPolicyPack.data.policyVersion
  ) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Module spec basePolicyVersion does not match policy pack.",
        context: {
          basePolicyVersion: parsedModuleSpec.data.policy.basePolicyVersion,
          policyPackVersion: parsedPolicyPack.data.policyVersion,
        },
      },
    };
  }

  const patchedPolicyResult = applyPolicyPatchesV1({
    basePolicyPack: parsedPolicyPack.data,
    activePatchVersions: parsedModuleSpec.data.policy.activePatchVersions,
  });
  if (!patchedPolicyResult.ok) {
    return patchedPolicyResult;
  }

  return {
    ok: true,
    config: {
      moduleSpec: parsedModuleSpec.data,
      policyPack: patchedPolicyResult.config.policyPack,
      promptVersion: patchedPolicyResult.config.promptVersion,
    },
  };
}

