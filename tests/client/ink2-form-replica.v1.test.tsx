import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Ink2FormReplicaV1 } from "../../src/client/features/modules/Ink2FormReplicaV1";
import { parseAnnualReportExtractionPayloadV1 } from "../../src/shared/contracts/annual-report-extraction.v1";
import { parseInk2FormDraftPayloadV1 } from "../../src/shared/contracts/ink2-form.v1";

describe("Ink2FormReplicaV1", () => {
  it("renders an editable INK2 form and download action", async () => {
    const user = userEvent.setup();
    const onSaveOverride = vi.fn();
    const extraction = parseAnnualReportExtractionPayloadV1({
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
        fiscalYearStart: {
          status: "manual",
          confidence: 1,
          value: "2025-01-01",
        },
        fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
        accountingStandard: { status: "manual", confidence: 1, value: "K2" },
        profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
      },
      summary: {
        autoDetectedFieldCount: 0,
        needsReviewFieldCount: 0,
      },
      taxDeep: {
        ink2rExtracted: {
          statementUnit: "sek",
          incomeStatement: [],
          balanceSheet: [],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      confirmation: {
        isConfirmed: true,
        confirmedAt: "2026-03-03T15:00:00.000Z",
        confirmedByUserId: "a3000000-0000-4000-8000-000000000010",
      },
    });

    const form = parseInk2FormDraftPayloadV1({
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: "a3000000-0000-4000-8000-000000000101",
      adjustmentsArtifactId: "a3000000-0000-4000-8000-000000000102",
      summaryArtifactId: "a3000000-0000-4000-8000-000000000103",
      fields: [
        {
          fieldId: "1.1",
          amount: 1026000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:1.1"],
        },
        {
          fieldId: "2.26",
          amount: 250000,
          provenance: "extracted",
          sourceReferences: ["annual_report_statement:2.26"],
        },
        {
          fieldId: "3.26",
          amount: 20000,
          provenance: "extracted",
          sourceReferences: ["annual_report_statement:3.25"],
        },
        {
          fieldId: "4.1",
          amount: 1000000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.1"],
        },
        {
          fieldId: "4.3c",
          amount: 5000,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:adj-1"],
        },
        {
          fieldId: "4.9",
          amount: -4000,
          provenance: "adjustment",
          sourceReferences: ["tax_adjustments:adj-2"],
        },
        {
          fieldId: "4.15",
          amount: 1026000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.15"],
        },
        {
          fieldId: "4.16",
          amount: 0,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.16"],
        },
      ],
      validation: {
        status: "valid",
        issues: [],
      },
    });

    render(
      <Ink2FormReplicaV1
        extraction={extraction}
        form={form}
        isDownloadingPdf={false}
        isSavingOverride={false}
        isSyncing={false}
        onDownloadPdf={vi.fn()}
        onSaveOverride={onSaveOverride}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Tax Return INK2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate INK2 return PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate INK2 draft" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Acme AB").length).toBeGreaterThan(0);
    expect(screen.getByText("4.3c")).toBeInTheDocument();

    const taxableAddBackInput = screen.getByRole("textbox", {
      name: "4.3c positive amount",
    });
    await user.clear(taxableAddBackInput);
    await user.type(taxableAddBackInput, "6500");
    await user.tab();

    expect(onSaveOverride).toHaveBeenCalledWith({
      fieldId: "4.3c",
      amount: 6500,
    });
  });
});
