import { z } from "zod";

import { loadAiModuleConfigV1 } from "../../runtime/module-config.v1";
import moduleSpecJson from "./module-spec.v1.json";
import policyPackJson from "./policy-pack.tax-adjustments-representation-entertainment.v1.json";

const PolicySchema = z
  .object({
    schemaVersion: z.literal("ai_policy_pack_v1"),
    moduleId: z.literal("tax-adjustments-representation-entertainment"),
    policyVersion: z.string().trim().min(1),
    candidateCategoryCodes: z.array(z.string().trim().min(1)).min(1),
    batching: z
      .object({
        maxRowsPerBatch: z.number().int().positive(),
        minRowsPerChunk: z.number().int().positive(),
      })
      .strict(),
    retries: z
      .object({
        backoffMs: z.number().int().nonnegative(),
        maxAttempts: z.number().int().positive(),
      })
      .strict(),
    timeouts: z
      .object({
        requestTimeoutMs: z.number().int().positive(),
      })
      .strict(),
    targetField: z.literal("INK2S.representation_non_deductible"),
    direction: z.literal("increase_taxable_income"),
  })
  .strict();

export function loadTaxAdjustmentsRepresentationEntertainmentModuleConfigV1() {
  return loadAiModuleConfigV1({
    moduleSpec: moduleSpecJson,
    policyPack: policyPackJson,
    policySchema: PolicySchema,
  });
}
