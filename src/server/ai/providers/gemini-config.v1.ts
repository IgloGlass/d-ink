import type { Env } from "../../../shared/types/env";
import type { GeminiModelConfigV1 } from "./gemini-client.v1";

export function getGeminiApiKeyV1(env: Env): string | undefined {
  return env.GEMINI_API_KEY ?? env.AI_PROVIDER_API_KEY;
}

export function getGeminiModelConfigV1(env: Env): GeminiModelConfigV1 {
  return {
    fastModel: env.GEMINI_FAST_MODEL ?? "gemini-2.5-flash",
    thinkingModel: env.GEMINI_THINKING_MODEL ?? "gemini-2.5-pro",
  };
}
