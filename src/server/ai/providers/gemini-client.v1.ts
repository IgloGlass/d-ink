/**
 * Legacy compatibility shim — re-exports provider-neutral types under their
 * original Gemini-branded names, and delegates all calls to the Qwen adapter
 * via the AI gateway.
 *
 * Nothing outside this file needs to change for Ticket 2.  Ticket 4 will
 * rename these exports at all call sites and remove this shim.
 */
import type { AiModelTierV1 } from "../../../shared/contracts/ai-run.v1";
import type {
  AiDocumentPartV1,
  AiModelConfigV1,
  AiStructuredOutputFailureV1,
  AiStructuredOutputRequestV1,
  AiStructuredOutputResultV1,
} from "./ai-provider.v1";
import { qwenAdapter } from "./qwen-adapter.v1";

// ---------------------------------------------------------------------------
// Re-exported types under legacy names
// ---------------------------------------------------------------------------

export type GeminiModelConfigV1 = AiModelConfigV1;

export type GeminiInlineDocumentPartV1 = Extract<
  AiDocumentPartV1,
  { dataBase64: string }
>;
export type GeminiUriDocumentPartV1 = Extract<AiDocumentPartV1, { uri: string }>;
export type GeminiDocumentPartV1 = AiDocumentPartV1;

export type GeminiFileReferenceV1 = {
  expirationTime?: string;
  mimeType: string;
  name: string;
  state?: string;
  uri: string;
};

export type GeminiStructuredOutputRequestV1 = AiStructuredOutputRequestV1;

export type GeminiStructuredOutputSuccessV1<TOutput> = {
  ok: true;
  output: TOutput;
  model: string;
};

export type GeminiStructuredOutputFailureV1 = AiStructuredOutputFailureV1;

export type GeminiStructuredOutputResultV1<TOutput> =
  AiStructuredOutputResultV1<TOutput>;

// ---------------------------------------------------------------------------
// Utility (still used by executors)
// ---------------------------------------------------------------------------

export function toBase64V1(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Main generation function — delegates to qwenAdapter
// ---------------------------------------------------------------------------

export async function generateGeminiStructuredOutputV1<TOutput>(input: {
  apiKey?: string;
  modelConfig: GeminiModelConfigV1;
  request: GeminiStructuredOutputRequestV1;
}): Promise<GeminiStructuredOutputResultV1<TOutput>> {
  if (!input.apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "AI provider API key is not configured.",
        context: {},
      },
    };
  }

  return qwenAdapter.generateStructuredOutput<TOutput>({
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    request: input.request,
  });
}

// ---------------------------------------------------------------------------
// File operations — not supported by DashScope; kept for API compatibility
// ---------------------------------------------------------------------------

export async function uploadGeminiFileV1(_input: {
  apiKey?: string;
  displayName?: string;
  fileBytes: Uint8Array;
  mimeType: string;
  name?: string;
  timeoutMs?: number;
}): Promise<
  | { ok: true; file: GeminiFileReferenceV1 }
  | GeminiStructuredOutputFailureV1
> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File upload is not supported by the Qwen/DashScope provider.",
      context: {},
    },
  };
}

export async function getGeminiFileV1(_input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<
  | { ok: true; file: GeminiFileReferenceV1 }
  | GeminiStructuredOutputFailureV1
> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File retrieval is not supported by the Qwen/DashScope provider.",
      context: {},
    },
  };
}

export async function deleteGeminiFileV1(_input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<{ ok: true } | GeminiStructuredOutputFailureV1> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File deletion is not supported by the Qwen/DashScope provider.",
      context: {},
    },
  };
}

// ---------------------------------------------------------------------------
// Suppress unused-import warning for AiModelTierV1 (used only in JSDoc / types)
// ---------------------------------------------------------------------------
export type { AiModelTierV1 };
