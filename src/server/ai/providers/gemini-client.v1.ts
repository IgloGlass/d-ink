/**
 * AI provider client — Alibaba DashScope (Qwen) via OpenAI-compatible API.
 *
 * This file retains its original "gemini-client" filename and all exported
 * type/function names so that no import sites need updating.  The Gemini SDK
 * has been replaced with direct fetch calls to the DashScope international
 * endpoint, which exposes an OpenAI-compatible chat-completions API.
 *
 * Limitation vs Gemini: binary PDF documents cannot be passed inline.
 * The executor already extracts text from PDFs before calling this layer;
 * any remaining inline-PDF document parts are silently dropped.
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

import type { AiModelTierV1 } from "../../../shared/contracts/ai-run.v1";

export type GeminiModelConfigV1 = {
  fastModel: string;
  thinkingModel: string;
};

export type GeminiInlineDocumentPartV1 = {
  kind?: "inline";
  dataBase64: string;
  mimeType: string;
};

export type GeminiUriDocumentPartV1 = {
  kind: "uri";
  mimeType: string;
  uri: string;
};

export type GeminiDocumentPartV1 =
  | GeminiInlineDocumentPartV1
  | GeminiUriDocumentPartV1;

export type GeminiFileReferenceV1 = {
  expirationTime?: string;
  mimeType: string;
  name: string;
  state?: string;
  uri: string;
};

export type GeminiStructuredOutputRequestV1 = {
  modelTier: AiModelTierV1;
  responseSchema: ZodTypeAny;
  systemInstruction: string;
  userInstruction: string;
  useResponseJsonSchema?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  documents?: GeminiDocumentPartV1[];
  timeoutMs?: number;
};

export type GeminiStructuredOutputSuccessV1<TOutput> = {
  ok: true;
  output: TOutput;
  model: string;
};

export type GeminiStructuredOutputFailureV1 = {
  ok: false;
  error: {
    code:
      | "CONFIG_INVALID"
      | "MODEL_EXECUTION_FAILED"
      | "MODEL_RESPONSE_INVALID";
    message: string;
    context: Record<string, unknown>;
  };
};

export type GeminiStructuredOutputResultV1<TOutput> =
  | GeminiStructuredOutputSuccessV1<TOutput>
  | GeminiStructuredOutputFailureV1;

const DASHSCOPE_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

const DEFAULT_TIMEOUT_MS_V1 = 90_000;

function resolveModelNameV1(
  tier: AiModelTierV1,
  config: GeminiModelConfigV1,
): string {
  return tier === "thinking" ? config.thinkingModel : config.fastModel;
}

export function toBase64V1(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function isAbortErrorV1(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("AbortError"))
  );
}

async function withAbortTimeoutV1<TValue>(input: {
  label: string;
  timeoutMs: number;
  execute: (abortSignal: AbortSignal) => Promise<TValue>;
}): Promise<TValue> {
  const abortController = new AbortController();
  const abortPromise = new Promise<never>((_resolve, reject) => {
    const handleAbort = () => {
      const reason = abortController.signal.reason;
      reject(
        reason instanceof Error
          ? reason
          : new DOMException(
              `${input.label} timed out after ${input.timeoutMs}ms.`,
              "AbortError",
            ),
      );
    };

    abortController.signal.addEventListener("abort", handleAbort, {
      once: true,
    });
  });
  const timeoutHandle = globalThis.setTimeout(() => {
    abortController.abort(
      new DOMException(
        `${input.label} timed out after ${input.timeoutMs}ms.`,
        "AbortError",
      ),
    );
  }, input.timeoutMs);

  const executePromise = input.execute(abortController.signal);
  executePromise.catch(() => {});

  try {
    return await Promise.race([executePromise, abortPromise]);
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

/**
 * Appends text-format inline document parts to the user message.
 * Binary PDF parts (mimeType application/pdf) are dropped — the executor
 * already includes extracted page text in userInstruction for that case.
 * URI parts are not supported by DashScope and are also dropped.
 */
function buildUserContentV1(input: {
  userInstruction: string;
  documents?: GeminiDocumentPartV1[];
}): string {
  const parts: string[] = [input.userInstruction];

  for (const doc of input.documents ?? []) {
    if ("uri" in doc) {
      // URI references (Gemini Files API) are not supported by DashScope.
      continue;
    }

    if (doc.mimeType === "text/plain") {
      try {
        const decoded = atob(doc.dataBase64);
        if (decoded.trim().length > 0) {
          parts.push(decoded);
        }
      } catch {
        // ignore malformed base64
      }
    }
    // Binary PDF / other binary mimeTypes are dropped intentionally.
  }

  return parts.join("\n\n");
}

function extractJsonPayloadTextV1(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

function summarizeSchemaIssuesV1(
  issues: Array<{ message: string; path: Array<string | number> }>,
): string {
  if (issues.length === 0) {
    return "No schema issues were reported.";
  }

  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

type DashScopeChatCompletionResponseV1 = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  model?: string;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

async function callDashScopeV1(input: {
  apiKey: string;
  model: string;
  systemMessage: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  abortSignal: AbortSignal;
}): Promise<DashScopeChatCompletionResponseV1> {
  const body = JSON.stringify({
    model: input.model,
    messages: [
      { role: "system", content: input.systemMessage },
      { role: "user", content: input.userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: input.temperature ?? 0.1,
    max_tokens: input.maxTokens ?? 8192,
  });

  const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal: input.abortSignal,
  });

  return response.json() as Promise<DashScopeChatCompletionResponseV1>;
}

/**
 * Executes Qwen structured-output generation via DashScope OpenAI-compatible API.
 *
 * Safety boundary:
 * - All callers receive parsed app contracts, never raw API objects.
 * - Schema validation happens after model generation before workflow code sees data.
 */
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

  try {
    const model = resolveModelNameV1(
      input.request.modelTier,
      input.modelConfig,
    );
    const timeoutMs = input.request.timeoutMs ?? DEFAULT_TIMEOUT_MS_V1;

    const jsonSchema = zodToJsonSchema(input.request.responseSchema, {
      $refStrategy: "none",
      target: "jsonSchema7",
    });

    const systemMessage = [
      input.request.systemInstruction,
      "IMPORTANT: You MUST respond with valid JSON that exactly matches the following JSON Schema. Output only the JSON object — no explanation, no markdown fences.",
      JSON.stringify(jsonSchema, null, 2),
    ].join("\n\n");

    const userMessage = buildUserContentV1({
      userInstruction: input.request.userInstruction,
      documents: input.request.documents,
    });

    const apiResponse = await withAbortTimeoutV1({
      label: "Qwen request",
      timeoutMs,
      execute: (abortSignal) =>
        callDashScopeV1({
          apiKey: input.apiKey as string,
          model,
          systemMessage,
          userMessage,
          temperature: input.request.temperature,
          maxTokens: input.request.maxOutputTokens,
          abortSignal,
        }),
    });

    if (apiResponse.error) {
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: apiResponse.error.message ?? "DashScope API returned an error.",
          context: {
            model,
            errorType: apiResponse.error.type,
            errorCode: apiResponse.error.code,
          },
        },
      };
    }

    const responseText = apiResponse.choices?.[0]?.message?.content;
    if (!responseText || responseText.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: "Qwen returned an empty response body.",
          context: { model },
        },
      };
    }

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(extractJsonPayloadTextV1(responseText));
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: "Qwen returned invalid JSON.",
          context: {
            model,
            error: error instanceof Error ? error.message : "Unknown parse error.",
          },
        },
      };
    }

    const parsedOutput = input.request.responseSchema.safeParse(parsedJson);
    if (!parsedOutput.success) {
      const summarizedIssues = summarizeSchemaIssuesV1(parsedOutput.error.issues);
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: `Qwen response did not match the expected schema. ${summarizedIssues}`,
          context: {
            model,
            issueSummary: summarizedIssues,
            issues: parsedOutput.error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              path: issue.path.join("."),
            })),
          },
        },
      };
    }

    return {
      ok: true,
      output: parsedOutput.data as TOutput,
      model,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: isAbortErrorV1(error)
          ? `Qwen request timed out after ${input.request.timeoutMs ?? DEFAULT_TIMEOUT_MS_V1}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown Qwen execution failure.",
        context: {
          timeoutMs: input.request.timeoutMs ?? DEFAULT_TIMEOUT_MS_V1,
        },
      },
    };
  }
}

/**
 * File upload — not supported by DashScope.
 * Returns CONFIG_INVALID so callers degrade gracefully (same as missing API key).
 */
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

/**
 * File retrieval — not supported by DashScope.
 */
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

/**
 * File deletion — not supported by DashScope.
 */
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
