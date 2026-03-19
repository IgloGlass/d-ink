import { describe, expect, it, vi } from "vitest";

import type { Env } from "../src/shared/types/env";

const mocks = vi.hoisted(() => ({
  processAnnualReportProcessingRunV1Mock: vi.fn(async () => ({
    ok: true as const,
  })),
  runMappingAiEnrichmentV1Mock: vi.fn(async () => ({
    ok: true as const,
    status: "updated" as const,
    activeBefore: {
      artifactId: "mapping-artifact-1",
      version: 1,
      schemaVersion: "mapping_decisions_v2",
    },
    activeAfter: {
      artifactId: "mapping-artifact-2",
      version: 2,
      schemaVersion: "mapping_decisions_v2",
    },
    message: "ok",
  })),
  createAnnualReportProcessingDepsV1Mock: vi.fn(() => ({ mocked: true })),
  createMappingAiEnrichmentDepsV1Mock: vi.fn(() => ({ mocked: true })),
}));

vi.mock("../src/server/workflow/annual-report-processing.v1", () => ({
  processAnnualReportProcessingRunV1:
    mocks.processAnnualReportProcessingRunV1Mock,
}));

vi.mock("../src/server/workflow/mapping-ai-enrichment.v1", () => ({
  runMappingAiEnrichmentV1: mocks.runMappingAiEnrichmentV1Mock,
}));

vi.mock("../src/server/workflow/workflow-deps.v1", () => ({
  createAnnualReportProcessingDepsV1:
    mocks.createAnnualReportProcessingDepsV1Mock,
  createMappingAiEnrichmentDepsV1: mocks.createMappingAiEnrichmentDepsV1Mock,
}));

import worker from "../src/worker";

describe("worker queue dispatcher v1", () => {
  it("routes mapping ai enrichment queue messages to the mapping workflow", async () => {
    const ack = vi.fn();
    const retry = vi.fn();

    await worker.queue(
      {
        messages: [
          {
            body: {
              taskType: "mapping_ai_enrichment",
              request: {
                tenantId: "85000000-0000-4000-8000-000000000001",
                workspaceId: "85000000-0000-4000-8000-000000000002",
                expectedActiveMapping: {
                  artifactId: "85000000-0000-4000-8000-000000000003",
                  version: 1,
                },
              },
              actorUserId: "85000000-0000-4000-8000-000000000004",
            },
            ack,
            retry,
          },
        ],
      },
      {
        DB: {} as never,
        AUTH_TOKEN_HMAC_SECRET: "test-secret",
        APP_BASE_URL: "https://app.dink.test",
      } as Env,
    );

    expect(mocks.runMappingAiEnrichmentV1Mock).toHaveBeenCalledTimes(1);
    expect(mocks.createMappingAiEnrichmentDepsV1Mock).toHaveBeenCalledTimes(1);
    expect(mocks.processAnnualReportProcessingRunV1Mock).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
