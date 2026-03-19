/**
 * AI provider configuration helpers.
 *
 * Reads per-provider API keys and model names from the environment.
 * For new code that has access to env, prefer ai-gateway.v1.ts which handles
 * all of this automatically based on AI_PROVIDER.
 */
import type { Env } from "../../../shared/types/env";
import type { AiModelConfigV1 } from "./ai-provider.v1";
import {
  getActiveAiApiKeyV1,
  getActiveAiModelConfigV1,
} from "./ai-gateway.v1";

/** Returns the active AI provider API key from env. */
export function getAiApiKeyV1(env: Env): string | undefined {
  return getActiveAiApiKeyV1(env) ?? env.AI_PROVIDER_API_KEY;
}

/** Returns the model names for the active AI provider. */
export function getAiModelConfigV1(env: Env): AiModelConfigV1 {
  return (
    getActiveAiModelConfigV1(env) ?? {
      fastModel: env.QWEN_FAST_MODEL ?? "qwen-plus",
      thinkingModel: env.QWEN_THINKING_MODEL ?? "qwen-max",
    }
  );
}
