import { z } from "zod";

import { loadAiModuleConfigV1 } from "../../runtime/module-config.v1";
import moduleSpecJson from "./module-spec.v1.json";
import policyPackJson from "./policy-pack.mapping-decisions.v1.json";

const MappingDecisionsPolicyPackV1Schema = z
  .object({
    schemaVersion: z.literal("ai_policy_pack_v1"),
    moduleId: z.literal("mapping-decisions"),
    policyVersion: z.string().trim().min(1),
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
    reviewThresholds: z
      .object({
        fastConfidenceBelow: z.number().min(0).max(1),
      })
      .strict(),
    escalation: z
      .object({
        modelTier: z.enum(["fast", "thinking"]),
        taxSensitiveCategoryCodes: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .strict();

export function loadMappingDecisionsModuleConfigV1() {
  return loadAiModuleConfigV1({
    moduleSpec: moduleSpecJson,
    policyPack: policyPackJson,
    policySchema: MappingDecisionsPolicyPackV1Schema,
  });
}
