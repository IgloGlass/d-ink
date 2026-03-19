/**
 * Abstract AI provider interface.
 *
 * All provider adapters (Qwen, OpenAI, …) must conform to this interface.
 * The rest of the codebase only depends on these types — never on a specific
 * provider's SDK or HTTP details.
 */
import type { ZodTypeAny } from "zod";

import type { AiModelTierV1 } from "../../../shared/contracts/ai-run.v1";

// ---------------------------------------------------------------------------
// Model config
// ---------------------------------------------------------------------------

export type AiModelConfigV1 = {
  /** Model name used for fast / low-cost requests. */
  fastModel: string;
  /** Model name used for slower, higher-quality requests. */
  thinkingModel: string;
};

// ---------------------------------------------------------------------------
// Document parts (passed alongside prompts)
// ---------------------------------------------------------------------------

export type AiInlineDocumentPartV1 = {
  kind?: "inline";
  /** Base-64 encoded file bytes. */
  dataBase64: string;
  mimeType: string;
};

export type AiUriDocumentPartV1 = {
  kind: "uri";
  mimeType: string;
  /** Remote URI — support depends on the provider. */
  uri: string;
};

export type AiDocumentPartV1 = AiInlineDocumentPartV1 | AiUriDocumentPartV1;

// ---------------------------------------------------------------------------
// Structured-output request
// ---------------------------------------------------------------------------

export type AiStructuredOutputRequestV1 = {
  modelTier: AiModelTierV1;
  /** Zod schema describing the expected JSON response shape. */
  responseSchema: ZodTypeAny;
  systemInstruction: string;
  userInstruction: string;
  /** Hint to the provider whether to embed the schema in the system prompt.
   *  Adapters may ignore this if the provider has no native schema support. */
  useResponseJsonSchema?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  documents?: AiDocumentPartV1[];
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Abort the request when the caller cancels the enclosing execution budget. */
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type AiStructuredOutputSuccessV1<TOutput> = {
  ok: true;
  output: TOutput;
  /** Exact model identifier returned by the provider. */
  model: string;
};

export type AiStructuredOutputFailureV1 = {
  ok: false;
  error: {
    code:
      | "CONFIG_INVALID" // missing/invalid key or model config
      | "MODEL_EXECUTION_FAILED" // network error, timeout, provider error
      | "MODEL_RESPONSE_INVALID"; // response didn't match the Zod schema
    message: string;
    context: Record<string, unknown>;
  };
};

export type AiStructuredOutputResultV1<TOutput> =
  | AiStructuredOutputSuccessV1<TOutput>
  | AiStructuredOutputFailureV1;

// ---------------------------------------------------------------------------
// Provider adapter interface
// ---------------------------------------------------------------------------

/**
 * A provider adapter translates the abstract request/result types above into
 * provider-specific API calls.  Add a new adapter to support a new AI vendor.
 */
export type AiProviderAdapterV1 = {
  /** Human-readable provider name, used in logs and error messages. */
  readonly name: string;

  /**
   * Execute a structured-output generation request.
   * Must always resolve (never reject) — errors are returned as { ok: false }.
   */
  generateStructuredOutput<TOutput>(input: {
    apiKey: string;
    modelConfig: AiModelConfigV1;
    request: AiStructuredOutputRequestV1;
  }): Promise<AiStructuredOutputResultV1<TOutput>>;
};
