import type { Env } from "../../../shared/types/env";
import type { GeminiModelConfigV1 } from "./gemini-client.v1";

export function getGeminiApiKeyV1(env: Env): string | undefined {
  return env.QWEN_API_KEY ?? env.AI_PROVIDER_API_KEY;
}

export function getGeminiModelConfigV1(env: Env): GeminiModelConfigV1 {
  return {
    fastModel: env.QWEN_FAST_MODEL ?? "qwen-plus",
    thinkingModel: env.QWEN_THINKING_MODEL ?? "qwen-max",
  };
}
