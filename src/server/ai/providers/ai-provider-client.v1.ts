/**
 * AI provider client — provider-neutral interface for structured-output calls.
 *
 * Delegates to the active provider adapter via the gateway.
 * Executors import from here and are fully decoupled from any specific provider.
 */
import type { Env } from "../../../shared/types/env";
import type {
  AiDocumentPartV1,
  AiModelConfigV1,
  AiStructuredOutputFailureV1,
  AiStructuredOutputRequestV1,
  AiStructuredOutputResultV1,
} from "./ai-provider.v1";
import {
  generateAiStructuredOutputV1 as generateAiStructuredOutputThroughGatewayV1,
} from "./ai-gateway.v1";
import { qwenAdapter } from "./qwen-adapter.v1";

// Re-export the abstract types so executors have a single import point.
export type {
  AiDocumentPartV1,
  AiModelConfigV1,
  AiStructuredOutputFailureV1,
  AiStructuredOutputRequestV1,
  AiStructuredOutputResultV1,
};

// File-reference type (kept for API surface; file upload is not supported).
export type AiFileReferenceV1 = {
  expirationTime?: string;
  mimeType: string;
  name: string;
  state?: string;
  uri: string;
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Encode raw bytes as base64. Used by executors to prepare document parts. */
export function toBase64V1(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Main generation call
// ---------------------------------------------------------------------------

/**
 * Execute a structured-output request using the active provider adapter.
 *
 * The `apiKey` + `modelConfig` interface is retained so executor input types
 * stay unchanged.  Use `generateAiStructuredOutputV1` from ai-gateway.v1.ts
 * if you have access to `env` and want the fully automatic selection path.
 */
export async function generateAiStructuredOutputV1<TOutput>(input: {
  env?: Env;
  apiKey?: string;
  modelConfig: AiModelConfigV1;
  request: AiStructuredOutputRequestV1;
}): Promise<AiStructuredOutputResultV1<TOutput>> {
  if (input.env) {
    return generateAiStructuredOutputThroughGatewayV1<TOutput>({
      env: input.env,
      request: input.request,
    });
  }

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
// File operations — not supported; kept so callers degrade gracefully
// ---------------------------------------------------------------------------

export async function uploadAiFileV1(_input: {
  apiKey?: string;
  displayName?: string;
  fileBytes: Uint8Array;
  mimeType: string;
  name?: string;
  timeoutMs?: number;
}): Promise<{ ok: true; file: AiFileReferenceV1 } | AiStructuredOutputFailureV1> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File upload is not supported by the current AI provider.",
      context: {},
    },
  };
}

export async function getAiFileV1(_input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<{ ok: true; file: AiFileReferenceV1 } | AiStructuredOutputFailureV1> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File retrieval is not supported by the current AI provider.",
      context: {},
    },
  };
}

export async function deleteAiFileV1(_input: {
  apiKey?: string;
  name: string;
  timeoutMs?: number;
}): Promise<{ ok: true } | AiStructuredOutputFailureV1> {
  return {
    ok: false,
    error: {
      code: "CONFIG_INVALID",
      message: "File deletion is not supported by the current AI provider.",
      context: {},
    },
  };
}

// Suppress unused import (Env is used only in JSDoc context above).
export type { Env };
