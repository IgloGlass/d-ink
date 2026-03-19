import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnualReportProcessingRunV1 } from "../../src/shared/contracts/annual-report-processing-run.v1";
import { isAnnualReportOpenRunStaleV1 } from "../../src/client/features/annual-report/use-annual-report-upload-controller.v1";

function createOpenRunV1(updatedAt: string): AnnualReportProcessingRunV1 {
  return {
    schemaVersion: "annual_report_processing_run_v1",
    runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    workspaceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    status: "queued",
    statusMessage: "Uploading source",
    technicalDetails: [],
    hasPreviousActiveResult: false,
    createdAt: "2026-03-03T12:00:00.000Z",
    updatedAt,
  };
}

describe("isAnnualReportOpenRunStaleV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("stays fresh for the 5 minute warning window", () => {
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );

    expect(
      isAnnualReportOpenRunStaleV1(
        createOpenRunV1("2026-03-03T12:06:00.000Z"),
      ),
    ).toBe(false);
  });

  it("becomes stale once the 5 minute warning window has elapsed", () => {
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-03-03T12:10:00.000Z"),
    );

    expect(
      isAnnualReportOpenRunStaleV1(
        createOpenRunV1("2026-03-03T12:05:00.000Z"),
      ),
    ).toBe(true);
  });
});
