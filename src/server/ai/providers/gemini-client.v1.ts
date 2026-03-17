import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
  type Content,
  type Part,
} from "@google/genai";
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

function buildContentsV1(input: {
  userInstruction: string;
  documents?: GeminiDocumentPartV1[];
}): Content {
  const parts: Array<string | Part> = [input.userInstruction];
  for (const document of input.documents ?? []) {
    if ("uri" in document) {
      parts.push(createPartFromUri(document.uri, document.mimeType));
      continue;
    }

    parts.push(createPartFromBase64(document.dataBase64, document.mimeType));
  }

  return createUserContent(parts);
}

const DEFAULT_GEMINI_TIMEOUT_MS_V1 = 90_000;

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

  // Create the execute promise and immediately attach a no-op rejection handler.
  // This prevents an unhandled-rejection crash if Promise.race settles via the
  // abort path first (i.e. on timeout) and the underlying SDK fetch later
  // rejects — an unobserved rejection that can crash the Worker runtime
  // (fatal with recent compatibility_date values).
  const executePromise = input.execute(abortController.signal);
  executePromise.catch(() => {});

  try {
    return await Promise.race([executePromise, abortPromise]);
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

function normalizeGeminiFileReferenceV1(file: Partial<GeminiFileReferenceV1>): GeminiFileReferenceV1 {
  if (
    typeof file.name !== "string" ||
    file.name.trim().length === 0 ||
    typeof file.uri !== "string" ||
    file.uri.trim().length === 0 ||
    typeof file.mimeType !== "string" ||
    file.mimeType.trim().length === 0
  ) {
    throw new Error("Gemini file response is missing required file metadata.");
  }

  return {
    name: file.name,
    uri: file.uri,
    mimeType: file.mimeType,
    expirationTime:
      typeof file.expirationTime === "string"
        ? file.expirationTime
        : undefined,
    state: typeof file.state === "string" ? file.state : undefined,
  };
}

export function createGeminiClientV1(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
  });
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

/**
 * Executes Gemini structured-output generation behind a provider-local adapter.
 *
 * Safety boundary:
 * - All callers receive parsed app contracts, never raw SDK objects.
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
        message: "Gemini API key is not configured.",
        context: {},
      },
    };
  }

  try {
    const client = createGeminiClientV1(input.apiKey);
    const model = resolveModelNameV1(
      input.request.modelTier,
      input.modelConfig,
    );
    const timeoutMs = input.request.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1;
    const response = await withAbortTimeoutV1({
      label: "Gemini request",
      timeoutMs,
      execute: (abortSignal) =>
        client.models.generateContent({
          model,
          contents: buildContentsV1({
            userInstruction: input.request.userInstruction,
            documents: input.request.documents,
          }),
          config: {
            abortSignal,
            systemInstruction: input.request.systemInstruction,
            temperature: input.request.temperature,
            maxOutputTokens: input.request.maxOutputTokens,
            ...(input.request.useResponseJsonSchema === false
              ? {}
              : {
                  responseMimeType: "application/json",
                  responseJsonSchema: zodToJsonSchema(
                    input.request.responseSchema,
                    {
                      $refStrategy: "none",
                      target: "jsonSchema7",
                    },
                  ),
                }),
          },
        }),
    });

    const responseText = response.text;
    if (!responseText || responseText.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: "Gemini returned an empty response body.",
          context: {
            model,
          },
        },
      };
    }

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(
        input.request.useResponseJsonSchema === false
          ? extractJsonPayloadTextV1(responseText)
          : responseText,
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message: "Gemini returned invalid JSON.",
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
          message: `Gemini response did not match the expected schema. ${summarizedIssues}`,
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
          ? `Gemini request timed out after ${input.request.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown Gemini execution failure.",
        context: {
          timeoutMs: input.request.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1,
        },
      },
    };
  }
}

export async function uploadGeminiFileV1(input: {
  apiKey?: string;
  displayName?: string;
  fileBytes: Uint8Array;
  mimeType: string;
  name?: string;
  timeoutMs?: number;
}): Promise<
  | {
      ok: true;
      file: GeminiFileReferenceV1;
    }
  | GeminiStructuredOutputFailureV1
> {
  if (!input.apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Gemini API key is not configured.",
        context: {},
      },
    };
  }

  try {
    const client = createGeminiClientV1(input.apiKey);
    const timeoutMs = input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1;
    const fileBuffer = Uint8Array.from(input.fileBytes).buffer as ArrayBuffer;
    const file = await withAbortTimeoutV1({
      label: "Gemini file upload",
      timeoutMs,
      execute: (abortSignal) =>
        client.files.upload({
          file: new Blob([fileBuffer], { type: input.mimeType }),
          config: {
            abortSignal,
            displayName: input.displayName,
            mimeType: input.mimeType,
            name: input.name,
          },
        }),
    });

    return {
      ok: true,
      file: normalizeGeminiFileReferenceV1(file),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: isAbortErrorV1(error)
          ? `Gemini file upload timed out after ${input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown Gemini file upload failure.",
        context: {
          timeoutMs: input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1,
        },
      },
    };
  }
}

export async function getGeminiFileV1(input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<
  | {
      ok: true;
      file: GeminiFileReferenceV1;
    }
  | GeminiStructuredOutputFailureV1
> {
  if (!input.apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Gemini API key is not configured.",
        context: {},
      },
    };
  }

  try {
    const client = createGeminiClientV1(input.apiKey);
    const timeoutMs = input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1;
    const file = await withAbortTimeoutV1({
      label: "Gemini file lookup",
      timeoutMs,
      execute: (abortSignal) =>
        client.files.get({
          name: input.name,
          config: {
            abortSignal,
          },
        }),
    });

    return {
      ok: true,
      file: normalizeGeminiFileReferenceV1(file),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: isAbortErrorV1(error)
          ? `Gemini file lookup timed out after ${input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown Gemini file lookup failure.",
        context: {
          timeoutMs: input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1,
          fileName: input.name,
        },
      },
    };
  }
}

export async function deleteGeminiFileV1(input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<
  | {
      ok: true;
    }
  | GeminiStructuredOutputFailureV1
> {
  if (!input.apiKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_INVALID",
        message: "Gemini API key is not configured.",
        context: {},
      },
    };
  }

  try {
    const client = createGeminiClientV1(input.apiKey);
    const timeoutMs = input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1;
    await withAbortTimeoutV1({
      label: "Gemini file delete",
      timeoutMs,
      execute: (abortSignal) =>
        client.files.delete({
          name: input.name,
          config: {
            abortSignal,
          },
        }),
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MODEL_EXECUTION_FAILED",
        message: isAbortErrorV1(error)
          ? `Gemini file delete timed out after ${input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1}ms.`
          : error instanceof Error
            ? error.message
            : "Unknown Gemini file delete failure.",
        context: {
          timeoutMs: input.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS_V1,
          fileName: input.name,
        },
      },
    };
  }
}
