/**
 * OpenAI provider adapter.
 *
 * Uses the OpenAI chat-completions API with response_format: json_object.
 * The request/response shape is identical to DashScope so this adapter is
 * intentionally a thin copy of qwen-adapter.v1.ts with different constants.
 *
 * Supported models (configure via env vars):
 *   OPENAI_FAST_MODEL    — default: gpt-4o-mini
 *   OPENAI_THINKING_MODEL — default: gpt-4o
 */
import { zodToJsonSchema } from "zod-to-json-schema";

import type {
  AiDocumentPartV1,
  AiModelConfigV1,
  AiProviderAdapterV1,
  AiStructuredOutputRequestV1,
  AiStructuredOutputResultV1,
} from "./ai-provider.v1";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_BASE_URL = "https://api.openai.com/v1";

const DEFAULT_TIMEOUT_MS = 90_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveModel(tier: "fast" | "thinking", config: AiModelConfigV1): string {
  return tier === "thinking" ? config.thinkingModel : config.fastModel;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("AbortError"));
}

async function withAbortTimeout<TValue>(input: {
  label: string;
  timeoutMs: number;
  execute: (signal: AbortSignal) => Promise<TValue>;
  signal?: AbortSignal;
}): Promise<TValue> {
  const controller = new AbortController();
  const externalSignal = input.signal;
  const onExternalAbort = () => {
    controller.abort(
      externalSignal?.reason ??
        new DOMException(
          `${input.label} was aborted by the caller.`,
          "AbortError",
        ),
    );
  };

  if (externalSignal?.aborted) {
    onExternalAbort();
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const abortPromise = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        const reason = controller.signal.reason;
        reject(
          reason instanceof Error
            ? reason
            : new DOMException(
                `${input.label} timed out after ${input.timeoutMs}ms.`,
                "AbortError",
              ),
        );
      },
      { once: true },
    );
  });

  const timeoutHandle = globalThis.setTimeout(() => {
    controller.abort(
      new DOMException(
        `${input.label} timed out after ${input.timeoutMs}ms.`,
        "AbortError",
      ),
    );
  }, input.timeoutMs);

  const executePromise = input.execute(controller.signal);
  executePromise.catch(() => {});

  try {
    return await Promise.race([executePromise, abortPromise]);
  } finally {
    globalThis.clearTimeout(timeoutHandle);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

/**
 * Builds the user message string from the instruction and any text documents.
 * URI document parts are dropped — standard OpenAI doesn't support remote file URIs.
 */
function buildUserContent(input: {
  userInstruction: string;
  documents?: AiDocumentPartV1[];
}): string {
  const parts: string[] = [input.userInstruction];

  for (const doc of input.documents ?? []) {
    if ("uri" in doc) continue;

    if (doc.mimeType === "text/plain") {
      try {
        const decoded = atob(doc.dataBase64);
        if (decoded.trim().length > 0) parts.push(decoded);
      } catch {
        // ignore malformed base64
      }
    }
  }

  return parts.join("\n\n");
}

function extractJsonPayload(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart)
    return trimmed.slice(objectStart, objectEnd + 1);

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart)
    return trimmed.slice(arrayStart, arrayEnd + 1);

  return trimmed;
}

function summarizeSchemaIssues(
  issues: Array<{ message: string; path: Array<string | number> }>,
): string {
  if (issues.length === 0) return "No schema issues were reported.";
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// OpenAI HTTP client
// ---------------------------------------------------------------------------

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  model?: string;
  error?: { message?: string; type?: string; code?: string };
};

async function callOpenAi(input: {
  apiKey: string;
  model: string;
  systemMessage: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  signal: AbortSignal;
}): Promise<OpenAiResponse> {
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

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal: input.signal,
  });

  return response.json() as Promise<OpenAiResponse>;
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

async function generateStructuredOutput<TOutput>(adapterInput: {
  apiKey: string;
  modelConfig: AiModelConfigV1;
  request: AiStructuredOutputRequestV1;
}): Promise<AiStructuredOutputResultV1<TOutput>> {
  try {
    const model = resolveModel(adapterInput.request.modelTier, adapterInput.modelConfig);
    const timeoutMs = adapterInput.request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const jsonSchema = zodToJsonSchema(adapterInput.request.responseSchema, {
      $refStrategy: "none",
      target: "jsonSchema7",
    });

    const systemMessage = [
      adapterInput.request.systemInstruction,
      "IMPORTANT: You MUST respond with valid JSON that exactly matches the following JSON Schema. Output only the JSON object — no explanation, no markdown fences.",
      JSON.stringify(jsonSchema, null, 2),
    ].join("\n\n");

    const userMessage = buildUserContent({
      userInstruction: adapterInput.request.userInstruction,
      documents: adapterInput.request.documents,
    });

    const apiResponse = await withAbortTimeout({
      label: "OpenAI request",
      timeoutMs,
      signal: adapterInput.request.signal,
      execute: (signal) =>
        callOpenAi({
          apiKey: adapterInput.apiKey,
          model,
          systemMessage,
          userMessage,
          temperature: adapterInput.request.temperature,
          maxTokens: adapterInput.request.maxOutputTokens,
          signal,
        }),
    });

    if (apiResponse.error) {
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: apiResponse.error.message ?? "OpenAI API returned an error.",
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
          message: "OpenAI returned an empty response body.",
          context: { model },
        },
      };
    }

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(extractJsonPayload(responseText));
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: "OpenAI returned invalid JSON.",
          context: {
            model,
            error: error instanceof Error ? error.message : "Unknown parse error.",
          },
        },
      };
    }

    const parsedOutput = adapterInput.request.responseSchema.safeParse(parsedJson);
    if (!parsedOutput.success) {
      const issueSummary = summarizeSchemaIssues(parsedOutput.error.issues);
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: `OpenAI response did not match the expected schema. ${issueSummary}`,
          context: {
            model,
            issueSummary,
            issues: parsedOutput.error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              path: issue.path.join("."),
            })),
          },
        },
      };
    }

    return { ok: true, output: parsedOutput.data as TOutput, model };
  } catch (error) {
    const timeoutMs = adapterInput.request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: isAbortError(error)
          ? `OpenAI request timed out after ${timeoutMs}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown OpenAI execution failure.",
        context: { timeoutMs },
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Exported adapter singleton
// ---------------------------------------------------------------------------

export const openAiAdapter: AiProviderAdapterV1 = {
  name: "openai",
  generateStructuredOutput,
};
