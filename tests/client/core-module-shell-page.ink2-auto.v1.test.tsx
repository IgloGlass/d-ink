import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { CoreModuleShellPageV1 } from "../../src/client/features/modules/core-module-shell-page.v1";

const sessionPrincipalMock = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "editor@example.com",
  role: "Editor" as const,
};

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

function mockJsonResponse(input: { body: unknown; status?: number }) {
  return Promise.resolve(
    new Response(JSON.stringify(input.body), {
      status: input.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockNotFoundResponse(code: string) {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        ok: false,
        error: {
          code,
          message: code,
          user_message: code,
          context: {},
        },
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
}

function createWorkspaceBodyV1() {
  return {
    ok: true,
    workspace: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: sessionPrincipalMock.tenantId,
      companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      status: "draft",
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z",
    },
  };
}

function createAnnualReportBodyV1() {
  return {
    ok: true,
    active: {
      artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      version: 1,
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
          incomeStatement: [
            {
              code: "3.26",
              label: "Arets resultat, vinst",
              currentYearValue: 1000000,
              evidence: [],
            },
          ],
          balanceSheet: [
            {
              code: "2.26",
              label: "Kassa och bank",
              currentYearValue: 250000,
              evidence: [],
            },
          ],
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
      confirmation: { isConfirmed: false },
    },
  };
}

function createInk2BodyV1() {
  return {
    ok: true,
    active: {
      artifactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      version: 1,
      schemaVersion: "ink2_form_draft_v1",
    },
    form: {
      schemaVersion: "ink2_form_draft_v1",
      extractionArtifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      adjustmentsArtifactId: "00000000-0000-4000-8000-000000000041",
      summaryArtifactId: "00000000-0000-4000-8000-000000000042",
      fields: [
        {
          fieldId: "1.1",
          amount: 1000000,
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
          amount: 1000000,
          provenance: "extracted",
          sourceReferences: ["annual_report_statement:3.26"],
        },
        {
          fieldId: "4.1",
          amount: 1000000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.1"],
        },
        {
          fieldId: "4.15",
          amount: 1000000,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.15"],
        },
        {
          fieldId: "4.16",
          amount: 0,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:4.16"],
        },
        {
          fieldId: "1.2",
          amount: 0,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:1.2"],
        },
        {
          fieldId: "1.3",
          amount: 0,
          provenance: "calculated",
          sourceReferences: ["ink2_derived:1.3"],
        },
      ],
      validation: {
        status: "invalid",
        issues: [
          "Tax adjustments have not been generated yet. INK2S rows are still provisional.",
        ],
      },
    },
  };
}

describe("CoreModuleShellPageV1 ink2 auto sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-generates the INK2 draft and hides the workspace status rail", async () => {
    let ink2Available = false;
    let ink2RunCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const requestUrl = new URL(url, "http://localhost");
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");

      if (
        requestUrl.pathname ===
        "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      ) {
        return mockJsonResponse({ body: createWorkspaceBodyV1() });
      }

      if (
        requestUrl.pathname ===
        "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-extractions/active"
      ) {
        return mockJsonResponse({ body: createAnnualReportBodyV1() });
      }

      if (
        requestUrl.pathname ===
        "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ink2-form/active"
      ) {
        return ink2Available
          ? mockJsonResponse({ body: createInk2BodyV1() })
          : mockNotFoundResponse("FORM_NOT_FOUND");
      }

      if (
        requestUrl.pathname ===
          "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ink2-form-runs" &&
        method === "POST"
      ) {
        ink2Available = true;
        ink2RunCount += 1;
        return mockJsonResponse({ body: createInk2BodyV1() });
      }

      if (
        requestUrl.pathname ===
        "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-tax-analysis/active"
      ) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (
        requestUrl.pathname ===
          "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-processing-runs/latest" ||
        requestUrl.pathname ===
          "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/mapping-decisions/active" ||
        requestUrl.pathname ===
          "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tax-adjustments/active" ||
        requestUrl.pathname ===
          "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tax-summary/active"
      ) {
        return mockNotFoundResponse("NOT_FOUND");
      }

      return mockNotFoundResponse("UNEXPECTED_ROUTE");
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tax-return-ink2",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(ink2RunCount).toBe(1);
    });

    expect(
      await screen.findByRole("textbox", { name: "2.26 amount" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Workspace status")).not.toBeInTheDocument();
  });
});
