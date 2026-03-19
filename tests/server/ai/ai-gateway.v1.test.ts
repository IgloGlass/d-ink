import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { qwenGenerateStructuredOutputMock, openAiGenerateStructuredOutputMock } =
  vi.hoisted(() => ({
    qwenGenerateStructuredOutputMock: vi.fn(),
    openAiGenerateStructuredOutputMock: vi.fn(),
  }));

vi.mock("../../../src/server/ai/providers/qwen-adapter.v1", () => ({
  qwenAdapter: {
    name: "qwen",
    generateStructuredOutput: qwenGenerateStructuredOutputMock,
  },
}));

vi.mock("../../../src/server/ai/providers/openai-adapter.v1", () => ({
  openAiAdapter: {
    name: "openai",
    generateStructuredOutput: openAiGenerateStructuredOutputMock,
  },
}));

import {
  generateAiStructuredOutputV1,
  resolveAiProviderV1,
} from "../../../src/server/ai/providers/ai-gateway.v1";
import type { Env } from "../../../src/shared/types/env";

function makeEnvV1(overrides: Partial<Env> = {}): Env {
  return {
    APP_BASE_URL: "http://localhost:5173",
    AUTH_TOKEN_HMAC_SECRET: "test-secret",
    DB: {} as Env["DB"],
    ...overrides,
  };
}

describe("ai-gateway.v1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves qwen by default and openai when selected", () => {
    const defaultProvider = resolveAiProviderV1(
      makeEnvV1({ QWEN_API_KEY: "qwen-key" }),
    );
    const openAiProvider = resolveAiProviderV1(
      makeEnvV1({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "openai-key",
      }),
    );

    expect(defaultProvider?.adapter.name).toBe("qwen");
    expect(openAiProvider?.adapter.name).toBe("openai");
  });

  it("delegates structured-output generation to the selected provider", async () => {
    qwenGenerateStructuredOutputMock.mockResolvedValue({
      ok: true,
      output: { answer: "qwen" },
      model: "qwen-plus",
    });
    openAiGenerateStructuredOutputMock.mockResolvedValue({
      ok: true,
      output: { answer: "openai" },
      model: "gpt-4o",
    });

    const result = await generateAiStructuredOutputV1({
      env: makeEnvV1({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "openai-key",
      }),
      request: {
        modelTier: "fast",
        responseSchema: z
          .object({
            answer: z.string(),
          })
          .strict(),
        systemInstruction: "Return JSON only.",
        userInstruction: "Say hello.",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.output).toEqual({ answer: "openai" });
    expect(result.model).toBe("gpt-4o");
    expect(openAiGenerateStructuredOutputMock).toHaveBeenCalledTimes(1);
    expect(qwenGenerateStructuredOutputMock).not.toHaveBeenCalled();
  });

  it("returns a config error when the selected provider key is missing", async () => {
    const result = await generateAiStructuredOutputV1({
      env: makeEnvV1({ AI_PROVIDER: "openai" }),
      request: {
        modelTier: "fast",
        responseSchema: z
          .object({
            answer: z.string(),
          })
          .strict(),
        systemInstruction: "Return JSON only.",
        userInstruction: "Say hello.",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("CONFIG_INVALID");
    expect(result.error.message).toContain("openai");
  });
});
