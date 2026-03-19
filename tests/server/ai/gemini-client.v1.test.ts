import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import { generateAiStructuredOutputV1 } from "../../../src/server/ai/providers/ai-provider-client.v1";

function makeDashScopeResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content }, finish_reason: "stop" }],
        model: "qwen-plus",
      }),
  } as unknown as Response;
}

describe("generateAiStructuredOutputV1", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns parsed output when DashScope responds with valid JSON", async () => {
    fetchMock.mockResolvedValue(makeDashScopeResponse('{"answer":"ok"}'));

    const result = await generateAiStructuredOutputV1({
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
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.output).toEqual({ answer: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "qwen-plus",
      response_format: { type: "json_object" },
    });
  });

  it("fails cleanly when DashScope does not respond before the timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockReturnValue(new Promise(() => {}));

    const resultPromise = generateAiStructuredOutputV1({
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
    fetchMock.mockResolvedValue(
      makeDashScopeResponse('{"answer":123,"extra":"value"}'),
    );

    const result = await generateAiStructuredOutputV1({
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
