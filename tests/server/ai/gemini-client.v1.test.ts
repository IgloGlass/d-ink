import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
  createPartFromBase64: vi.fn((dataBase64: string, mimeType: string) => ({
    dataBase64,
    mimeType,
  })),
  createUserContent: vi.fn((parts: unknown[]) => ({
    role: "user",
    parts,
  })),
}));

import { generateGeminiStructuredOutputV1 } from "../../../src/server/ai/providers/gemini-client.v1";

describe("generateGeminiStructuredOutputV1", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("omits response schema config when plain JSON mode is requested", async () => {
    generateContentMock.mockResolvedValue({
      text: '```json\n{"answer":"ok"}\n```',
    });

    const result = await generateGeminiStructuredOutputV1({
      apiKey: "test-key",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      request: {
        modelTier: "fast",
        responseSchema: z
          .object({
            answer: z.string(),
          })
          .strict(),
        systemInstruction: "Return JSON only.",
        userInstruction: "Say ok.",
        useResponseJsonSchema: false,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.output).toEqual({
      answer: "ok",
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const config = generateContentMock.mock.calls[0]?.[0]?.config as
      | Record<string, unknown>
      | undefined;
    expect(config).toBeDefined();
    expect(config?.responseJsonSchema).toBeUndefined();
    expect(config?.responseMimeType).toBeUndefined();
  });

  it("fails cleanly when Gemini does not return before the timeout", async () => {
    vi.useFakeTimers();
    generateContentMock.mockReturnValue(new Promise(() => {}));

    const resultPromise = generateGeminiStructuredOutputV1({
      apiKey: "test-key",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      request: {
        modelTier: "fast",
        responseSchema: z
          .object({
            answer: z.string(),
          })
          .strict(),
        systemInstruction: "Return JSON only.",
        userInstruction: "Say ok.",
        timeoutMs: 25,
      },
    });

    await vi.advanceTimersByTimeAsync(30);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("MODEL_EXECUTION_FAILED");
    expect(result.error.message).toContain("timed out");
    expect(result.error.context.timeoutMs).toBe(25);
  });

  it("includes compact schema issue summaries when validation fails", async () => {
    generateContentMock.mockResolvedValue({
      text: '{"answer":123,"extra":"value"}',
    });

    const result = await generateGeminiStructuredOutputV1({
      apiKey: "test-key",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      request: {
        modelTier: "fast",
        responseSchema: z.object({
          answer: z.string(),
          items: z.array(z.string()),
        }),
        systemInstruction: "Return JSON only.",
        userInstruction: "Say ok.",
        useResponseJsonSchema: false,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("MODEL_RESPONSE_INVALID");
    expect(result.error.message).toContain("answer");
    expect(result.error.message).toContain("items");
    expect(result.error.context.issueSummary).toBeTypeOf("string");
    expect(result.error.context.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "answer" }),
        expect.objectContaining({ path: "items" }),
      ]),
    );
  });
});
