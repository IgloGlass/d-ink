/**
 * AI gateway — the single place that knows which provider to use.
 *
 * Reads AI_PROVIDER from the environment, selects the matching adapter, and
 * resolves the API key and model config for that provider.  All caller code
 * only needs to supply the env object and the structured-output request.
 *
 * Adding a new provider:
 *   1. Create <name>-adapter.v1.ts implementing AiProviderAdapterV1.
 *   2. Add an entry to PROVIDER_REGISTRY below.
 *   3. Add the API key and model env vars to env.ts and .dev.vars.
 *   Done — no other files need to change.
 */
import type { Env } from "../../../shared/types/env";
import type {
  AiModelConfigV1,
  AiProviderAdapterV1,
  AiStructuredOutputRequestV1,
  AiStructuredOutputResultV1,
} from "./ai-provider.v1";
import { openAiAdapter } from "./openai-adapter.v1";
import { qwenAdapter } from "./qwen-adapter.v1";

// ---------------------------------------------------------------------------
// Provider registry — add new providers here
// ---------------------------------------------------------------------------

type ProviderEntry = {
  adapter: AiProviderAdapterV1;
  getApiKey: (env: Env) => string | undefined;
  getModelConfig: (env: Env) => AiModelConfigV1;
};

export type AiProviderEntryV1 = ProviderEntry;

const PROVIDER_REGISTRY: Record<string, ProviderEntry> = {
  qwen: {
    adapter: qwenAdapter,
    getApiKey: (env) => env.QWEN_API_KEY ?? env.AI_PROVIDER_API_KEY,
    getModelConfig: (env) => ({
      fastModel: env.QWEN_FAST_MODEL ?? "qwen-plus",
      thinkingModel: env.QWEN_THINKING_MODEL ?? "qwen-max",
      baseUrl: env.QWEN_BASE_URL,
    }),
  },
  openai: {
    adapter: openAiAdapter,
    getApiKey: (env) => env.OPENAI_API_KEY ?? env.AI_PROVIDER_API_KEY,
    getModelConfig: (env) => ({
      fastModel: env.OPENAI_FAST_MODEL ?? "gpt-4o-mini",
      thinkingModel: env.OPENAI_THINKING_MODEL ?? "gpt-4o",
    }),
  },
};

const DEFAULT_PROVIDER = "qwen";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves the active provider entry from the environment.
 * Returns null if the configured provider is not registered.
 */
export function resolveAiProviderV1(env: Env): AiProviderEntryV1 | null {
  const providerName = env.AI_PROVIDER ?? DEFAULT_PROVIDER;
  return PROVIDER_REGISTRY[providerName] ?? null;
}

export function getActiveAiApiKeyV1(env: Env): string | undefined {
  return resolveAiProviderV1(env)?.getApiKey(env);
}

export function getActiveAiModelConfigV1(env: Env): AiModelConfigV1 | null {
  const provider = resolveAiProviderV1(env);
  return provider ? provider.getModelConfig(env) : null;
}

/**
 * Executes a structured-output request through the gateway.
 *
 * This is the preferred call site for all new code.  It handles provider
 * selection, API key resolution, and model config in one place.
 */
export async function generateAiStructuredOutputV1<TOutput>(input: {
  env: Env;
  request: AiStructuredOutputRequestV1;
}): Promise<AiStructuredOutputResultV1<TOutput>> {
  const providerName = input.env.AI_PROVIDER ?? DEFAULT_PROVIDER;
  const entry = PROVIDER_REGISTRY[providerName];

  if (!entry) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: `Unknown AI provider "${providerName}". Registered providers: ${Object.keys(PROVIDER_REGISTRY).join(", ")}.`,
        context: { providerName },
      },
    };
  }

  const apiKey = entry.getApiKey(input.env);
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: `AI provider API key is not configured for provider "${providerName}".`,
        context: { providerName },
      },
    };
  }

  const modelConfig = entry.getModelConfig(input.env);

  return entry.adapter.generateStructuredOutput<TOutput>({
    apiKey,
    modelConfig,
    request: input.request,
  });
}
