import { z } from "zod";

export const AiModuleSpecV1Schema = z
  .object({
    schemaVersion: z.literal("ai_module_spec_v1"),
    moduleId: z.string().trim().min(1),
    moduleVersion: z.string().trim().min(1),
    promptVersion: z.string().trim().min(1),
    runtime: z
      .object({
        provider: z.literal("qwen"),
        modelTier: z.enum(["fast", "thinking"]),
      })
      .strict(),
    policy: z
      .object({
        basePolicyVersion: z.string().trim().min(1),
        activePatchVersions: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .passthrough();

export type AiModuleSpecV1 = z.infer<typeof AiModuleSpecV1Schema>;

export function loadAiModuleConfigV1<TPolicy extends z.ZodTypeAny>(input: {
  moduleSpec: unknown;
  policyPack: unknown;
  policySchema: TPolicy;
}):
  | {
      ok: true;
      config: {
        moduleSpec: AiModuleSpecV1;
        policyPack: z.infer<TPolicy>;
      };
    }
  | {
      ok: false;
      error: {
        code: "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    } {
  const parsedSpec = AiModuleSpecV1Schema.safeParse(input.moduleSpec);
  if (!parsedSpec.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "AI module spec payload is invalid.",
        context: {
          issues: parsedSpec.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
      },
    };
  }

  const parsedPolicy = input.policySchema.safeParse(input.policyPack);
  if (!parsedPolicy.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "AI policy pack payload is invalid.",
        context: {
          issues: parsedPolicy.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
      },
    };
  }

  const policyVersion =
    typeof parsedPolicy.data === "object" &&
    parsedPolicy.data !== null &&
    "policyVersion" in parsedPolicy.data
      ? String(
          (parsedPolicy.data as {
            policyVersion?: unknown;
          }).policyVersion ?? "",
        )
      : "";
  if (parsedSpec.data.policy.basePolicyVersion !== policyVersion) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "AI module spec base policy version does not match policy pack.",
        context: {
          moduleId: parsedSpec.data.moduleId,
          basePolicyVersion: parsedSpec.data.policy.basePolicyVersion,
          policyVersion,
        },
      },
    };
  }

  return {
    ok: true,
    config: {
      moduleSpec: parsedSpec.data,
      policyPack: parsedPolicy.data,
    },
  };
}
