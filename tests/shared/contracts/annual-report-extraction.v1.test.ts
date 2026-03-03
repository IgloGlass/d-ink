import { describe, expect, it } from "vitest";

import {
  ApplyAnnualReportExtractionOverridesRequestV1Schema,
  AnnualReportExtractionPayloadV1Schema,
  ConfirmAnnualReportExtractionRequestV1Schema,
  parseApplyAnnualReportExtractionOverridesResultV1,
  parseConfirmAnnualReportExtractionResultV1,
  parseRunAnnualReportExtractionResultV1,
} from "../../../src/shared/contracts/annual-report-extraction.v1";

describe("annual report extraction contracts v1", () => {
  it("accepts valid extraction payload", () => {
    const result = AnnualReportExtractionPayloadV1Schema.safeParse({
      schemaVersion: "annual_report_extraction_v1",
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      policyVersion: "annual-report-manual-first.v1",
      fields: {
        companyName: { status: "extracted", confidence: 0.93, value: "Acme AB" },
        organizationNumber: {
          status: "needs_review",
          confidence: 0.3,
        },
        fiscalYearStart: {
          status: "manual",
          confidence: 1,
          value: "2025-01-01",
        },
        fiscalYearEnd: {
          status: "manual",
          confidence: 1,
          value: "2025-12-31",
        },
        accountingStandard: {
          status: "manual",
          confidence: 1,
          value: "K2",
        },
        profitBeforeTax: { status: "manual", confidence: 1, value: 250000 },
      },
      summary: {
        autoDetectedFieldCount: 1,
        needsReviewFieldCount: 1,
      },
      confirmation: {
        isConfirmed: true,
        confirmedAt: "2026-03-03T07:00:00.000Z",
        confirmedByUserId: "97000000-0000-4000-8000-000000000001",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects confirmed payload missing confirmation metadata", () => {
    const result = AnnualReportExtractionPayloadV1Schema.safeParse({
      schemaVersion: "annual_report_extraction_v1",
      sourceFileName: "annual-report.pdf",
      sourceFileType: "pdf",
      policyVersion: "annual-report-manual-first.v1",
      fields: {
        companyName: { status: "manual", confidence: 1, value: "Acme AB" },
        organizationNumber: { status: "manual", confidence: 1, value: "556677-8899" },
        fiscalYearStart: { status: "manual", confidence: 1, value: "2025-01-01" },
        fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
        accountingStandard: { status: "manual", confidence: 1, value: "K2" },
        profitBeforeTax: { status: "manual", confidence: 1, value: 250000 },
      },
      summary: {
        autoDetectedFieldCount: 0,
        needsReviewFieldCount: 0,
      },
      confirmation: {
        isConfirmed: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts run/override/confirm envelopes", () => {
    const base = {
      active: {
        artifactId: "97000000-0000-4000-8000-000000000011",
        version: 2,
        schemaVersion: "annual_report_extraction_v1",
      },
      extraction: {
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: "annual-report.pdf",
        sourceFileType: "pdf",
        policyVersion: "annual-report-manual-first.v1",
        fields: {
          companyName: { status: "manual", confidence: 1, value: "Acme AB" },
          organizationNumber: {
            status: "manual",
            confidence: 1,
            value: "556677-8899",
          },
          fiscalYearStart: { status: "manual", confidence: 1, value: "2025-01-01" },
          fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
          accountingStandard: { status: "manual", confidence: 1, value: "K2" },
          profitBeforeTax: { status: "manual", confidence: 1, value: 250000 },
        },
        summary: {
          autoDetectedFieldCount: 0,
          needsReviewFieldCount: 0,
        },
        confirmation: {
          isConfirmed: true,
          confirmedAt: "2026-03-03T07:00:00.000Z",
          confirmedByUserId: "97000000-0000-4000-8000-000000000001",
        },
      },
    };

    expect(
      parseRunAnnualReportExtractionResultV1({
        ok: true,
        ...base,
      }).ok,
    ).toBe(true);
    expect(
      parseApplyAnnualReportExtractionOverridesResultV1({
        ok: true,
        ...base,
        appliedCount: 1,
      }).ok,
    ).toBe(true);
    expect(
      parseConfirmAnnualReportExtractionResultV1({
        ok: true,
        ...base,
      }).ok,
    ).toBe(true);
  });

  it("accepts expectedActiveExtraction with optional schemaVersion", () => {
    const sharedBody = {
      tenantId: "97000000-0000-4000-8000-000000000001",
      workspaceId: "97000000-0000-4000-8000-000000000002",
      expectedActiveExtraction: {
        artifactId: "97000000-0000-4000-8000-000000000011",
        version: 2,
        schemaVersion: "annual_report_extraction_v1",
      },
    };

    expect(
      ApplyAnnualReportExtractionOverridesRequestV1Schema.safeParse({
        ...sharedBody,
        overrides: [
          {
            fieldKey: "profitBeforeTax",
            reason: "Manual fix",
            value: 123,
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      ConfirmAnnualReportExtractionRequestV1Schema.safeParse({
        ...sharedBody,
        confirmedByUserId: "97000000-0000-4000-8000-000000000003",
      }).success,
    ).toBe(true);
  });
});
