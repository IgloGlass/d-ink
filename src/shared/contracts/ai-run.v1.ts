import { z } from "zod";

export const AiModelTierV1Schema = z.enum(["fast", "thinking"]);
export type AiModelTierV1 = z.infer<typeof AiModelTierV1Schema>;

export const AiRunMetadataV1Schema = z
  .object({
    runId: z.string().trim().min(1),
    moduleId: z.string().trim().min(1),
    moduleVersion: z.string().trim().min(1),
    promptVersion: z.string().trim().min(1),
    policyVersion: z.string().trim().min(1),
    activePatchVersions: z.array(z.string().trim().min(1)),
    provider: z.literal("qwen"),
    model: z.string().trim().min(1),
    modelTier: AiModelTierV1Schema,
    generatedAt: z.string().trim().min(1),
    usedFallback: z.boolean().default(false),
  })
  .strict();
export type AiRunMetadataV1 = z.infer<typeof AiRunMetadataV1Schema>;

export function parseAiRunMetadataV1(input: unknown): AiRunMetadataV1 {
  return AiRunMetadataV1Schema.parse(input);
}
