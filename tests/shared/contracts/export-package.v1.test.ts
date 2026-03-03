import { describe, expect, it } from "vitest";

import {
  ExportPackagePayloadV1Schema,
  parseCreatePdfExportResultV1,
  parseListWorkspaceExportsResultV1,
} from "../../../src/shared/contracts/export-package.v1";

describe("export package contracts v1", () => {
  it("accepts valid export package payload", () => {
    const result = ExportPackagePayloadV1Schema.safeParse({
      schemaVersion: "export_package_v1",
      format: "pdf",
      fileName: "ink2-workspace-export.pdf",
      mimeType: "application/pdf",
      contentBase64: "JVBERi0xLjQK",
      createdAt: "2026-03-03T08:00:00.000Z",
      createdByUserId: "99200000-0000-4000-8000-000000000001",
      artifactReferences: {
        annualReportExtractionArtifactId:
          "99200000-0000-4000-8000-000000000010",
        adjustmentsArtifactId: "99200000-0000-4000-8000-000000000011",
        summaryArtifactId: "99200000-0000-4000-8000-000000000012",
        ink2FormArtifactId: "99200000-0000-4000-8000-000000000013",
      },
      workspaceSnapshot: {
        workspaceId: "99200000-0000-4000-8000-000000000020",
        tenantId: "99200000-0000-4000-8000-000000000021",
        status: "approved_for_export",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts create/list result envelopes", () => {
    const base = {
      active: {
        artifactId: "99200000-0000-4000-8000-000000000030",
        version: 1,
        schemaVersion: "export_package_v1",
      },
      exportPackage: {
        schemaVersion: "export_package_v1",
        format: "pdf",
        fileName: "ink2-workspace-export.pdf",
        mimeType: "application/pdf",
        contentBase64: "JVBERi0xLjQK",
        createdAt: "2026-03-03T08:00:00.000Z",
        artifactReferences: {
          annualReportExtractionArtifactId:
            "99200000-0000-4000-8000-000000000010",
          adjustmentsArtifactId: "99200000-0000-4000-8000-000000000011",
          summaryArtifactId: "99200000-0000-4000-8000-000000000012",
          ink2FormArtifactId: "99200000-0000-4000-8000-000000000013",
        },
        workspaceSnapshot: {
          workspaceId: "99200000-0000-4000-8000-000000000020",
          tenantId: "99200000-0000-4000-8000-000000000021",
          status: "approved_for_export",
        },
      },
    };

    expect(
      parseCreatePdfExportResultV1({
        ok: true,
        ...base,
      }).ok,
    ).toBe(true);
    expect(
      parseListWorkspaceExportsResultV1({
        ok: true,
        exports: [base],
      }).ok,
    ).toBe(true);
  });
});
