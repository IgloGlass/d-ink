import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../src/client/app/providers";
import { CoreModuleShellPageV1 } from "../../src/client/features/modules/core-module-shell-page.v1";
import { parseRunMappingAiEnrichmentResultV1 } from "../../src/shared/contracts/mapping-ai-enrichment.v1";
import { getSilverfinTaxCategoryByCodeV1 } from "../../src/shared/contracts/mapping.v1";
import { parseReconciliationResultPayloadV1 } from "../../src/shared/contracts/reconciliation.v1";
import { parseExecuteTrialBalancePipelineResultV1 } from "../../src/shared/contracts/tb-pipeline-run.v1";
import { parseTrialBalanceNormalizedV1 } from "../../src/shared/contracts/trial-balance.v1";

const sessionPrincipalMock = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  emailNormalized: "editor@example.com",
  role: "Editor" as const,
};

const cashAndBankCategory = getSilverfinTaxCategoryByCodeV1("102000");
const buildingCategory = getSilverfinTaxCategoryByCodeV1("111000");

function createMappingDecisionV1(input: {
  id: string;
  sourceAccountNumber: string;
  accountName: string;
  confidence?: number;
  selectedCategory?: ReturnType<typeof getSilverfinTaxCategoryByCodeV1>;
  proposedCategory?: ReturnType<typeof getSilverfinTaxCategoryByCodeV1>;
  reviewFlag?: boolean;
  status?: "proposed" | "confirmed" | "overridden";
  source?: "deterministic" | "ai" | "manual";
  rationale?: string;
  override?: {
    scope: "return" | "group" | "user";
    reason: string;
    author?: string;
  };
}) {
  const selectedCategory = input.selectedCategory ?? cashAndBankCategory;
  const proposedCategory = input.proposedCategory ?? selectedCategory;

  return {
    id: input.id,
    accountNumber: input.sourceAccountNumber,
    sourceAccountNumber: input.sourceAccountNumber,
    accountName: input.accountName,
    proposedCategory,
    selectedCategory,
    confidence: input.confidence ?? 0.98,
    evidence: [
      {
        type: "tb_row" as const,
        reference: `Trial Balance:${input.id}`,
        snippet: `${input.sourceAccountNumber} ${input.accountName}`,
        source: {
          sheetName: "Trial Balance",
          rowNumber: Number(input.id.replace(/\D/g, "")) || 2,
        },
      },
    ],
    policyRuleReference: "map.test.rule.v1",
    reviewFlag: input.reviewFlag ?? false,
    status: input.status ?? "proposed",
    source: input.source ?? "ai",
    ...(input.override ? { override: input.override } : {}),
    ...(input.rationale
      ? {
          aiTrace: {
            rationale: input.rationale,
            annualReportContextReferences: [
              {
                area: "asset_movements",
                reference: "Note 7 leasehold improvements",
              },
            ],
          },
        }
      : {}),
  };
}

function createActiveMappingBodyV1(
  decisions: ReturnType<typeof createMappingDecisionV1>[],
) {
  return {
    ok: true,
    active: {
      artifactId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      version: 1,
      schemaVersion: "mapping_decisions_v1",
    },
    mapping: {
      schemaVersion: "mapping_decisions_v1",
      policyVersion: "mapping-ai.v1",
      executionMetadata: {
        requestedStrategy: "ai_primary",
        actualStrategy: "ai",
        degraded: false,
        annualReportContextAvailable: true,
        usedAiRunFallback: false,
      },
      summary: {
        totalRows: decisions.length,
        deterministicDecisions: decisions.filter(
          (d) => d.source === "deterministic",
        ).length,
        manualReviewRequired: decisions.filter((d) => d.reviewFlag).length,
        fallbackDecisions: 0,
        matchedByAccountNumber: decisions.length,
        matchedByAccountName: 0,
        unmatchedRows: 0,
      },
      decisions,
    },
  };
}

function createActiveMappingBodyWithExecutionMetadataV1(input: {
  decisions: ReturnType<typeof createMappingDecisionV1>[];
  actualStrategy?: "deterministic" | "ai";
  active?: {
    artifactId: string;
    version: number;
    schemaVersion?: string;
  };
  aiGeneratedAt?: string;
  degraded?: boolean;
  degradedReason?: string;
}) {
  const response = createActiveMappingBodyV1(input.decisions);
  return {
    ...response,
    active: input.active
      ? {
          artifactId: input.active.artifactId,
          version: input.active.version,
          schemaVersion:
            input.active.schemaVersion ?? response.active.schemaVersion,
        }
      : response.active,
    mapping: {
      ...response.mapping,
      ...(input.aiGeneratedAt
        ? {
            aiRun: {
              runId: "mapping-ai-run-test",
              moduleId: "mapping-decisions",
              moduleVersion: "v1",
              promptVersion: "mapping-decisions.prompts.v1",
              policyVersion: "mapping-decisions.v1",
              activePatchVersions: [],
              provider: "qwen" as const,
              model: "qwen-plus",
              modelTier: "fast" as const,
              generatedAt: input.aiGeneratedAt,
              usedFallback: false,
            },
          }
        : {}),
      executionMetadata: {
        ...response.mapping.executionMetadata,
        actualStrategy:
          input.actualStrategy ??
          response.mapping.executionMetadata.actualStrategy,
        degraded: input.degraded ?? false,
        degradedReasonCode: input.degraded
          ? "model_execution_failed"
          : undefined,
        degradedReason: input.degradedReason,
      },
    },
  };
}

function createTrialBalanceArtifactV1(
  decisions: ReturnType<typeof createMappingDecisionV1>[],
) {
  const closingBalanceTotal = decisions.length * 50 * (decisions.length + 1);

  return parseTrialBalanceNormalizedV1({
    schemaVersion: "trial_balance_normalized_v1",
    fileType: "xlsx",
    selectedSheetName: "Trial Balance",
    headerRowNumber: 1,
    columnMappings: [
      {
        key: "account_name",
        required: true,
        sourceHeader: "Account Name",
        normalizedSourceHeader: "account name",
        sourceColumnIndex: 0,
        sourceColumnLetter: "A",
        matchType: "exact_synonym",
      },
      {
        key: "account_number",
        required: true,
        sourceHeader: "Account Number",
        normalizedSourceHeader: "account number",
        sourceColumnIndex: 1,
        sourceColumnLetter: "B",
        matchType: "exact_synonym",
      },
      {
        key: "opening_balance",
        required: true,
        sourceHeader: "Opening Balance",
        normalizedSourceHeader: "opening balance",
        sourceColumnIndex: 2,
        sourceColumnLetter: "C",
        matchType: "exact_synonym",
      },
      {
        key: "closing_balance",
        required: true,
        sourceHeader: "Closing Balance",
        normalizedSourceHeader: "closing balance",
        sourceColumnIndex: 3,
        sourceColumnLetter: "D",
        matchType: "exact_synonym",
      },
    ],
    rows: decisions.map((decision, index) => ({
      accountName: decision.accountName,
      accountNumber: decision.accountNumber,
      sourceAccountNumber: decision.sourceAccountNumber,
      openingBalance: 0,
      closingBalance: 100 * (index + 1),
      source: { sheetName: "Trial Balance", rowNumber: index + 2 },
      rawValues: {
        account_name: decision.accountName,
        account_number: decision.accountNumber,
        opening_balance: "0",
        closing_balance: String(100 * (index + 1)),
      },
    })),
    rejectedRows: [],
    sheetAnalyses: [
      {
        sheetName: "Trial Balance",
        headerRowNumber: 1,
        requiredColumnsMatched: 4,
        candidateDataRows: decisions.length,
        score: 5000,
      },
    ],
    verification: {
      totalRowsRead: decisions.length + 1,
      candidateRows: decisions.length,
      normalizedRows: decisions.length,
      rejectedRows: 0,
      duplicateAccountNumberGroups: 0,
      openingBalanceTotal: 0,
      closingBalanceTotal,
      checks: [
        {
          code: "required_columns_present",
          status: "pass",
          message: "ok",
          context: {},
        },
      ],
    },
  });
}

function createReconciliationPayloadV1(rowCount: number) {
  const closingBalanceTotal = rowCount * 50 * (rowCount + 1);

  return parseReconciliationResultPayloadV1({
    schemaVersion: "reconciliation_result_v1",
    status: "pass",
    canProceedToMapping: true,
    blockingReasonCodes: [],
    summary: {
      candidateRows: rowCount,
      normalizedRows: rowCount,
      rejectedRows: 0,
      materialRejectedRows: 0,
      nonMaterialRejectedRows: 0,
      availableBalanceColumns: ["opening_balance", "closing_balance"],
      openingBalanceTotal: 0,
      closingBalanceTotal,
    },
    checks: [
      {
        code: "normalized_rows_present",
        status: "pass",
        blocking: false,
        message: "ok",
        context: {},
      },
    ],
  });
}

function createTrialBalancePipelineBodyV1(input: {
  decisions: ReturnType<typeof createMappingDecisionV1>[];
  actualStrategy?: "deterministic" | "ai";
  degraded?: boolean;
  degradedReason?: string;
}) {
  const activeMapping = createActiveMappingBodyV1(input.decisions);
  const mapping = {
    ...activeMapping.mapping,
    executionMetadata: {
      ...activeMapping.mapping.executionMetadata,
      actualStrategy:
        input.actualStrategy ??
        activeMapping.mapping.executionMetadata.actualStrategy,
      degraded: input.degraded ?? false,
      degradedReason: input.degradedReason,
      degradedReasonCode: input.degraded ? "model_execution_failed" : undefined,
    },
  };

  return parseExecuteTrialBalancePipelineResultV1({
    ok: true,
    pipeline: {
      schemaVersion: "tb_pipeline_run_result_v1",
      policyVersion: "mapping-decisions.v1",
      artifacts: {
        trialBalance: {
          artifactType: "trial_balance",
          artifactId: "tb-artifact-1",
          version: 1,
          schemaVersion: "trial_balance_normalized_v1",
        },
        reconciliation: {
          artifactType: "reconciliation",
          artifactId: "reconciliation-artifact-1",
          version: 1,
          schemaVersion: "reconciliation_result_v1",
        },
        mapping: {
          artifactType: "mapping",
          artifactId: "mapping-artifact-1",
          version: 1,
          schemaVersion: mapping.schemaVersion,
        },
      },
      trialBalance: createTrialBalanceArtifactV1(input.decisions),
      reconciliation: createReconciliationPayloadV1(input.decisions.length),
      mapping,
    },
  });
}

function createMappingAiEnrichmentSuccessBodyV1(input: {
  activeBefore: {
    artifactId: string;
    version: number;
    schemaVersion?: string;
  };
  activeAfter: {
    artifactId: string;
    version: number;
    schemaVersion?: string;
  };
  message: string;
  mapping?: ReturnType<typeof createActiveMappingBodyV1>["mapping"];
  status: "accepted" | "updated" | "no_change" | "stale_skipped";
}) {
  return parseRunMappingAiEnrichmentResultV1({
    ok: true,
    status: input.status,
    activeBefore: {
      artifactId: input.activeBefore.artifactId,
      version: input.activeBefore.version,
      schemaVersion: input.activeBefore.schemaVersion ?? "mapping_decisions_v2",
    },
    activeAfter: {
      artifactId: input.activeAfter.artifactId,
      version: input.activeAfter.version,
      schemaVersion: input.activeAfter.schemaVersion ?? "mapping_decisions_v2",
    },
    mapping: input.mapping,
    message: input.message,
  });
}

vi.mock("../../src/client/app/session-context", () => ({
  useRequiredSessionPrincipalV1: () => sessionPrincipalMock,
}));

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function mockNotFoundResponse(code: string): Response {
  return mockJsonResponse({
    status: 404,
    body: {
      ok: false,
      error: {
        code,
        message: "Not found",
        user_message: "Not found",
        context: {},
      },
    },
  });
}

function installAnnualReportUploadXhrMock(input: {
  body: unknown;
  onSend?: () => void;
  status?: number;
}): void {
  class MockXmlHttpRequest {
    onabort: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    responseText = "";
    status = 0;
    upload = {
      onprogress: null as
        | ((event: {
            lengthComputable: boolean;
            loaded: number;
            total: number;
          }) => void)
        | null,
    };
    withCredentials = false;

    open(): void {}

    setRequestHeader(): void {}

    getResponseHeader(name: string): string | null {
      if (name.toLowerCase() === "x-dink-annual-report-runtime") {
        return "annual-report-deep-extraction.v3|qwen-plus|qwen-max";
      }
      return null;
    }

    send(): void {
      input.onSend?.();
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      });
      this.status = input.status ?? 202;
      this.responseText = JSON.stringify(input.body);
      this.onload?.();
    }
  }

  vi.stubGlobal("XMLHttpRequest", MockXmlHttpRequest);
}

describe("CoreModuleShellPageV1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps module tabs open but shows prerequisite guidance and review panel content", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            comments: [],
          },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            tasks: [],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("heading", { name: "Account Mapping" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This module is available, but a complete annual report must be uploaded before mapping starts.",
    );
    expect(
      screen.queryByText("Populate the account table"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import trial balance" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Recommended next action"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No recent tasks.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload trial balance drop zone" }),
    ).toBeInTheDocument();
  });

  it("shows annual-report AI progress state while upload analysis is running", async () => {
    let processingRunCreated = false;
    installAnnualReportUploadXhrMock({
      onSend: () => {
        processingRunCreated = true;
      },
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              comments: [],
            },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              tasks: [],
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: processingRunCreated ? 200 : 404,
            body: processingRunCreated
              ? {
                  ok: true,
                  run: {
                    schemaVersion: "annual_report_processing_run_v1",
                    runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    tenantId: sessionPrincipalMock.tenantId,
                    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    sourceFileName: "annual-report.pdf",
                    sourceFileType: "pdf",
                    status: "queued",
                    statusMessage: "Uploading source",
                    technicalDetails: [],
                    hasPreviousActiveResult: false,
                    createdAt: "2026-03-01T10:00:00.000Z",
                    updatedAt: new Date().toISOString(),
                  },
                }
              : {
                  ok: false,
                  error: {
                    code: "PROCESSING_RUN_NOT_FOUND",
                    message: "Not found",
                    user_message: "Not found",
                    context: {},
                  },
                },
          }),
        );
      }

      if (url.includes("/annual-report-upload-sessions") && method === "POST") {
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/dddddddd-dddd-4ddd-8ddd-dddddddddddd/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-01T10:15:00.000Z",
                status: "created",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(
        screen.getByRole("button", { name: "Choose annual report" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["annual report"], "annual-report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByText("Upload annual report", { selector: "button" }),
    );

    expect(
      await screen.findByText("AI analysis in progress"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Uploading source").length).toBeGreaterThan(0);
  });

  it("treats stale open annual-report runs as recoverable and allows replacement upload", async () => {
    let uploadSessionRequests = 0;
    installAnnualReportUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date(Date.now() - 8 * 60 * 1_000).toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              comments: [],
            },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              tasks: [],
            },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "annual-report.pdf",
                sourceFileType: "pdf",
                status: "queued",
                statusMessage: "Uploading source",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date(Date.now() - 8 * 60 * 1_000).toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-upload-sessions") && method === "POST") {
        uploadSessionRequests += 1;
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/dddddddd-dddd-4ddd-8ddd-dddddddddddd/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-01T10:15:00.000Z",
                status: "created",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    expect(
      await screen.findByText(
        "Annual-report processing appears stuck (no update for at least 5 minutes). You can upload a replacement file now.",
      ),
    ).toBeInTheDocument();

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["annual report"], "annual-report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    const uploadButton = screen
      .getAllByRole("button", {
        name: "Upload annual report",
      })
      .find((button) => button.closest(".module-stage-card__actions"));
    expect(uploadButton).toBeDefined();
    expect(uploadButton).toBeEnabled();
    await userEvent.click(uploadButton!);

    await waitFor(() => {
      expect(uploadSessionRequests).toBe(1);
    });
  });

  it("keeps only one upload CTA label in failed state and retries with the selected file", async () => {
    let uploadSessionRequests = 0;
    installAnnualReportUploadXhrMock({
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "99999999-9999-4999-8999-999999999999",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: false,
          createdAt: "2026-03-07T09:00:00.000Z",
          updatedAt: "2026-03-07T09:00:00.000Z",
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("EXTRACTION_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "12121212-1212-4212-8212-121212121212",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "previous.pdf",
                sourceFileType: "pdf",
                status: "failed",
                statusMessage: "Failed",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-07T08:50:00.000Z",
                updatedAt: "2026-03-07T08:51:00.000Z",
                error: {
                  code: "ANNUAL_REPORT_ANALYSIS_FAILED",
                  userMessage:
                    "The annual report could not be analyzed. Upload the annual report again.",
                },
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-upload-sessions") && method === "POST") {
        uploadSessionRequests += 1;
        return Promise.resolve(
          mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              session: {
                schemaVersion: "annual_report_upload_session_v1",
                uploadSessionId: "34343434-3434-4343-8434-343434343434",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                fileName: "annual-report.pdf",
                fileType: "pdf",
                fileSizeBytes: 100,
                policyVersion: "annual-report-manual-first.v1",
                uploadUrl:
                  "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/34343434-3434-4343-8434-343434343434/file",
                maxSizeBytes: 26214400,
                expiresAt: "2026-03-07T09:15:00.000Z",
                status: "created",
                createdAt: "2026-03-07T09:00:00.000Z",
                updatedAt: "2026-03-07T09:00:00.000Z",
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(
        screen.getAllByText(
          "The annual report could not be analyzed. Upload the annual report again.",
        ).length,
      ).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByRole("button", { name: "Upload annual report" }),
    ).toHaveLength(1);

    const fileInput = document.querySelector(
      '#annual-report-upload-panel input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["annual report"], "annual-report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Upload annual report" })[0]!,
    );

    await waitFor(() => {
      expect(uploadSessionRequests).toBe(1);
    });
  });

  it("opens the chooser from the failed-state recovery action when no file is selected", async () => {
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("EXTRACTION_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              run: {
                schemaVersion: "annual_report_processing_run_v1",
                runId: "45454545-4545-4454-8454-454545454545",
                tenantId: sessionPrincipalMock.tenantId,
                workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                sourceFileName: "previous.pdf",
                sourceFileType: "pdf",
                status: "failed",
                statusMessage: "Failed",
                technicalDetails: [],
                hasPreviousActiveResult: false,
                createdAt: "2026-03-07T08:50:00.000Z",
                updatedAt: "2026-03-07T08:51:00.000Z",
                error: {
                  code: "ANNUAL_REPORT_ANALYSIS_FAILED",
                  userMessage:
                    "The annual report could not be analyzed. Upload the annual report again.",
                },
              },
            },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(
        screen.getAllByText(
          "The annual report could not be analyzed. Upload the annual report again.",
        ).length,
      ).toBeGreaterThan(0);
    });

    const recoveryButton = screen
      .getAllByRole("button", { name: "Choose annual report" })
      .find((button) => button.closest(".module-upload-drop-zone__actions"));
    expect(recoveryButton).toBeDefined();

    await userEvent.click(recoveryButton!);

    expect(fileInputClickSpy).toHaveBeenCalled();
  });

  it("requires confirmation before rerunning annual-report analysis when active extraction data exists", async () => {
    let annualReportRunCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    installAnnualReportUploadXhrMock({
      onSend: () => {
        annualReportRunCount += 1;
      },
      body: {
        ok: true,
        run: {
          schemaVersion: "annual_report_processing_run_v1",
          runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          tenantId: sessionPrincipalMock.tenantId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceFileName: "annual-report.pdf",
          sourceFileType: "pdf",
          status: "queued",
          statusMessage: "Uploading source",
          technicalDetails: [],
          hasPreviousActiveResult: true,
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 1,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "5561231234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K2",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 120000,
                  status: "extracted",
                  confidence: 0.88,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      if (
        url.includes("/annual-report-processing-runs/latest?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: annualReportRunCount > 0 ? 200 : 404,
          body:
            annualReportRunCount > 0
              ? {
                  ok: true,
                  run: {
                    schemaVersion: "annual_report_processing_run_v1",
                    runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                    tenantId: sessionPrincipalMock.tenantId,
                    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    sourceFileName: "annual-report.pdf",
                    sourceFileType: "pdf",
                    status: "queued",
                    statusMessage: "Uploading source",
                    technicalDetails: [],
                    hasPreviousActiveResult: true,
                    createdAt: "2026-03-01T10:00:00.000Z",
                    updatedAt: new Date().toISOString(),
                  },
                }
              : {
                  ok: false,
                  error: {
                    code: "PROCESSING_RUN_NOT_FOUND",
                    message: "Not found",
                    user_message: "Not found",
                    context: {},
                  },
                },
        });
      }

      if (url.includes("/annual-report-upload-sessions") && method === "POST") {
        return mockJsonResponse({
          status: 201,
          body: {
            ok: true,
            session: {
              schemaVersion: "annual_report_upload_session_v1",
              uploadSessionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              fileName: "annual-report.pdf",
              fileType: "pdf",
              fileSizeBytes: 100,
              policyVersion: "annual-report-manual-first.v1",
              uploadUrl:
                "/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-upload-sessions/ffffffff-ffff-4fff-8fff-ffffffffffff/file",
              maxSizeBytes: 26214400,
              expiresAt: "2026-03-01T10:15:00.000Z",
              status: "created",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(
        screen.getByRole("button", { name: "Choose annual report" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["annual report"], "annual-report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByText("Upload a new annual report", { selector: "button" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Upload a new annual report? This will replace the active annual-report dataset and dependent tax outputs for this workspace. Previous versions will still be kept in history.",
    );
    expect(annualReportRunCount).toBe(0);

    confirmSpy.mockReturnValue(true);

    await userEvent.click(
      screen.getByText("Upload a new annual report", { selector: "button" }),
    );

    expect(annualReportRunCount).toBe(1);
  });

  it("requires confirmation before clearing active annual-report data", async () => {
    let clearCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 1,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "5561231234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K2",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 120000,
                  status: "extracted",
                  confidence: 0.88,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              taxDeep: {
                ink2rExtracted: {
                  incomeStatement: [
                    {
                      code: "profit",
                      label: "Profit",
                      currentYearValue: 120000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "assets",
                      label: "Assets",
                      currentYearValue: 400000,
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
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              confirmation: {
                isConfirmed: true,
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }
      if (
        url.includes("/annual-report-extractions/clear") &&
        method === "POST"
      ) {
        clearCount += 1;
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            clearedArtifactTypes: ["annual_report_extraction"],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(
        screen.getAllByRole("button", { name: "Clear annual report data" })
          .length,
      ).toBeGreaterThan(0);
    });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      "Clear the current annual-report data? This will remove the active annual-report extraction and dependent tax outputs from this workspace. Historical versions will still be kept.",
    );
    expect(clearCount).toBe(0);

    confirmSpy.mockReturnValue(true);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );
    expect(clearCount).toBe(1);
  });

  it("clears the annual-report screen after clearing active data", async () => {
    let activeFetchCount = 0;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        activeFetchCount += 1;
        if (activeFetchCount === 1) {
          return mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              active: {
                artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                version: 1,
                schemaVersion: "annual_report_extraction_v1",
              },
              extraction: {
                schemaVersion: "annual_report_extraction_v1",
                sourceFileName: "annual-report.pdf",
                sourceFileType: "pdf",
                policyVersion: "annual-report-manual-first.v1",
                fields: {
                  companyName: {
                    value: "Test Company AB",
                    status: "extracted",
                    confidence: 0.95,
                  },
                  organizationNumber: {
                    value: "5561231234",
                    status: "extracted",
                    confidence: 0.95,
                  },
                  fiscalYearStart: {
                    value: "2025-01-01",
                    status: "extracted",
                    confidence: 0.95,
                  },
                  fiscalYearEnd: {
                    value: "2025-12-31",
                    status: "extracted",
                    confidence: 0.95,
                  },
                  accountingStandard: {
                    value: "K2",
                    status: "extracted",
                    confidence: 0.92,
                  },
                  profitBeforeTax: {
                    value: 120000,
                    status: "extracted",
                    confidence: 0.88,
                  },
                },
                summary: {
                  autoDetectedFieldCount: 6,
                  needsReviewFieldCount: 0,
                },
                taxSignals: [],
                documentWarnings: [],
                taxDeep: {
                  ink2rExtracted: {
                    incomeStatement: [
                      {
                        code: "profit",
                        label: "Profit",
                        currentYearValue: 120000,
                        evidence: [],
                      },
                    ],
                    balanceSheet: [
                      {
                        code: "assets",
                        label: "Assets",
                        currentYearValue: 400000,
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
                  groupContributionContext: {
                    flags: [],
                    notes: [],
                    evidence: [],
                  },
                  shareholdingContext: { flags: [], notes: [], evidence: [] },
                  priorYearComparatives: [],
                },
                confirmation: {
                  isConfirmed: true,
                  confirmedAt: "2026-03-01T10:00:00.000Z",
                  confirmedByUserId: sessionPrincipalMock.userId,
                },
              },
            },
          });
        }

        return mockNotFoundResponse("EXTRACTION_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }
      if (
        url.includes("/annual-report-extractions/clear") &&
        method === "POST"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            clearedArtifactTypes: ["annual_report_extraction"],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    expect(await screen.findByText("Test Company AB")).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Clear annual report data" })[0]!,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Upload an annual report to populate the financial extraction workbench.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Test Company AB")).not.toBeInTheDocument();
  });

  it("runs forensic tax review manually from a saved extraction", async () => {
    let hasTaxReview = false;
    let forensicRunPollCount = 0;
    let forensicRunStatus: "idle" | "running" | "completed" = "idle";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "556123-1234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 545286000,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              taxDeep: {
                ink2rExtracted: {
                  statementUnit: "sek",
                  incomeStatement: [
                    {
                      code: "3.1",
                      label: "Nettoomsättning",
                      currentYearValue: 3989355000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "2.26",
                      label: "Kassa, bank och redovisningsmedel",
                      currentYearValue: 301521000,
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
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              confirmation: {
                isConfirmed: true,
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        if (!hasTaxReview || forensicRunStatus !== "completed") {
          return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
        }

        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              version: 1,
              schemaVersion: "annual_report_tax_analysis_v1",
            },
            taxAnalysis: {
              schemaVersion: "annual_report_tax_analysis_v1",
              sourceExtractionArtifactId:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              policyVersion: "annual-report-manual-first.v1",
              basedOn: {
                ink2rExtracted: {
                  incomeStatement: [],
                  balanceSheet: [],
                },
                depreciationContext: { assetAreas: [], evidence: [] },
                assetMovements: { lines: [], evidence: [] },
                reserveContext: { movements: [], notes: [], evidence: [] },
                netInterestContext: { notes: [], evidence: [] },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              executiveSummary: "Manual forensic review finished.",
              accountingStandardAssessment: {
                status: "aligned",
                rationale: "K3 is explicit in the saved extraction.",
              },
              reviewState: {
                mode: "full_ai",
                reasons: [],
                sourceDocumentAvailable: true,
                sourceDocumentUsed: true,
              },
              findings: [],
              missingInformation: [],
              recommendedNextActions: [],
            },
          },
        });
      }

      if (
        url.includes("/annual-report-tax-analysis/run") &&
        method === "POST"
      ) {
        hasTaxReview = true;
        forensicRunStatus = "running";
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            run: {
              schemaVersion: "annual_report_processing_run_v1",
              runId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              status: "running_tax_analysis",
              statusMessage: "Running forensic review",
              technicalDetails: [
                "processing.operation=tax_analysis",
                "tax_analysis.expected_extraction_artifact_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "tax_analysis.expected_extraction_version=3",
              ],
              result: {
                extractionArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              },
              hasPreviousActiveResult: false,
              createdAt: "2099-03-12T10:05:00.000Z",
              updatedAt: "2099-03-12T10:05:00.000Z",
              startedAt: "2099-03-12T10:05:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-processing-runs/latest?")) {
        if (forensicRunStatus === "idle") {
          return mockNotFoundResponse("PROCESSING_RUN_NOT_FOUND");
        }

        forensicRunPollCount += 1;
        if (forensicRunPollCount >= 2) {
          forensicRunStatus = "completed";
        }

        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            run: {
              schemaVersion: "annual_report_processing_run_v1",
              runId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              tenantId: sessionPrincipalMock.tenantId,
              workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              status:
                forensicRunStatus === "completed"
                  ? "completed"
                  : "running_tax_analysis",
              statusMessage:
                forensicRunStatus === "completed"
                  ? "Completed"
                  : "Running forensic review",
              technicalDetails: [],
              result: {
                extractionArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                taxAnalysisArtifactId:
                  forensicRunStatus === "completed"
                    ? "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
                    : undefined,
              },
              hasPreviousActiveResult: false,
              createdAt: "2099-03-12T10:05:00.000Z",
              updatedAt:
                forensicRunStatus === "completed"
                  ? "2099-03-12T10:05:03.000Z"
                  : "2099-03-12T10:05:01.000Z",
              startedAt: "2099-03-12T10:05:00.000Z",
              finishedAt:
                forensicRunStatus === "completed"
                  ? "2099-03-12T10:05:03.000Z"
                  : undefined,
            },
          },
        });
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    await userEvent.click(
      await screen.findByRole("button", { name: "Show forensic review" }),
    );
    expect(
      await screen.findByText("Financial extraction is ready for workflow."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The structured annual-report data is ready for downstream workflow automation. Run forensic tax review when you want an AI risk assessment based on the saved extraction.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Workflow-ready extraction"),
    ).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: "Run forensic tax review" }),
    );

    expect(
      await screen.findByText("Forensic tax review is running."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Manual forensic review finished.",
        {},
        {
          timeout: 5_000,
        },
      ),
    ).toBeInTheDocument();
  });

  it("surfaces degraded forensic review state instead of presenting fallback output as a normal AI review", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "556123-1234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 545286000,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
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
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              confirmation: {
                isConfirmed: true,
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              version: 1,
              schemaVersion: "annual_report_tax_analysis_v1",
            },
            taxAnalysis: {
              schemaVersion: "annual_report_tax_analysis_v1",
              sourceExtractionArtifactId:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              policyVersion: "annual-report-manual-first.v1",
              basedOn: {
                ink2rExtracted: {
                  incomeStatement: [],
                  balanceSheet: [],
                },
                depreciationContext: { assetAreas: [], evidence: [] },
                assetMovements: { lines: [], evidence: [] },
                reserveContext: { movements: [], notes: [], evidence: [] },
                netInterestContext: { notes: [], evidence: [] },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              executiveSummary: "Fallback forensic summary.",
              accountingStandardAssessment: {
                status: "aligned",
                rationale: "K3 is explicit in the saved extraction.",
              },
              reviewState: {
                mode: "deterministic_fallback",
                reasons: [
                  "AI fallback reason: Qwen request timed out after 180000ms.",
                  "Source document unavailable for the active extraction.",
                ],
                sourceDocumentAvailable: false,
                sourceDocumentUsed: false,
              },
              findings: [],
              missingInformation: [],
              recommendedNextActions: [],
            },
          },
        });
      }

      if (url.includes("/annual-report-processing-runs/latest?")) {
        return mockNotFoundResponse("PROCESSING_RUN_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    await userEvent.click(
      await screen.findByRole("button", { name: "Show forensic review" }),
    );

    expect(await screen.findByText("Fallback review only")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The forensic AI review did not complete normally, so D.ink saved a deterministic fallback summary instead.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "AI fallback reason: Qwen request timed out after 180000ms.",
      ),
    ).toBeInTheDocument();
  });

  it("renders INK2-coded rows with a balance control instead of raw summary rows", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-01T10:00:00.000Z",
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Test Company AB",
                  status: "extracted",
                  confidence: 0.95,
                },
                organizationNumber: {
                  value: "556123-1234",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearStart: {
                  value: "2025-01-01",
                  status: "extracted",
                  confidence: 0.95,
                },
                fiscalYearEnd: {
                  value: "2025-12-31",
                  status: "extracted",
                  confidence: 0.95,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.92,
                },
                profitBeforeTax: {
                  value: 545286000,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [],
              taxDeep: {
                ink2rExtracted: {
                  statementUnit: "sek",
                  incomeStatement: [
                    {
                      code: "3.1",
                      label: "Nettoomsättning",
                      currentYearValue: 3989355000,
                      priorYearValue: 4381698000,
                      evidence: [],
                    },
                    {
                      code: "3.7",
                      label: "Övriga externa kostnader",
                      currentYearValue: 1234567000,
                      priorYearValue: 1111111000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "2.26",
                      label: "Kassa, bank och redovisningsmedel",
                      currentYearValue: 301521000,
                      priorYearValue: 287144000,
                      evidence: [],
                    },
                    {
                      code: "2.27",
                      label: "Bundet eget kapital",
                      currentYearValue: 150000000,
                      priorYearValue: 150000000,
                      evidence: [],
                    },
                    {
                      code: "2.28",
                      label: "Fritt eget kapital",
                      currentYearValue: 31000000,
                      priorYearValue: 16144000,
                      evidence: [],
                    },
                    {
                      code: "2.45",
                      label: "Leverantörsskulder",
                      currentYearValue: 120521000,
                      priorYearValue: 121000000,
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
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              confirmation: {
                isConfirmed: true,
                confirmedAt: "2026-03-01T10:00:00.000Z",
                confirmedByUserId: sessionPrincipalMock.userId,
              },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }
      if (url.includes("/annual-report-processing/latest?")) {
        return mockNotFoundResponse("PROCESSING_RUN_NOT_FOUND");
      }
      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    await screen.findByRole("heading", { name: "Financial data" });

    expect(screen.getByText("2.26")).toBeInTheDocument();
    expect(
      screen.getByText("Kassa, bank och redovisningsmedel"),
    ).toBeInTheDocument();
    expect(screen.getByText("Balance control")).toBeInTheDocument();
    expect(screen.getByText("Equity + liabilities")).toBeInTheDocument();
    expect(
      screen.getByText("Control passed: assets equal equity plus liabilities."),
    ).toBeInTheDocument();
    expect(screen.queryByText("SUMMA TILLGÅNGAR")).not.toBeInTheDocument();
  });

  it("requires confirmation before rerunning account mapping when active mapping data exists", async () => {
    let trialBalanceRunCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              version: 1,
              schemaVersion: "mapping_decisions_v1",
            },
            mapping: {
              schemaVersion: "mapping_decisions_v1",
              policyVersion: "mapping-ai.v1",
              summary: {
                totalRows: 1,
                deterministicDecisions: 1,
                manualReviewRequired: 0,
                fallbackDecisions: 0,
                matchedByAccountNumber: 1,
                matchedByAccountName: 0,
                unmatchedRows: 0,
              },
              decisions: [
                {
                  id: "mapping-1",
                  accountNumber: "1930",
                  sourceAccountNumber: "1930",
                  accountName: "Bank",
                  proposedCategory: cashAndBankCategory,
                  selectedCategory: cashAndBankCategory,
                  confidence: 0.98,
                  evidence: [
                    {
                      type: "tb_row",
                      reference: "Trial Balance:2",
                      snippet: "1930 Bank",
                      source: {
                        sheetName: "Trial Balance",
                        rowNumber: 2,
                      },
                    },
                  ],
                  policyRuleReference: "map.is.cash-and-bank.v1",
                  reviewFlag: false,
                  status: "proposed",
                  source: "deterministic",
                },
              ],
            },
          },
        });
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      if (url.includes("/tb-pipeline-runs") && method === "POST") {
        trialBalanceRunCount += 1;
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "99999999-9999-4999-8999-999999999999",
              version: 2,
              schemaVersion: "mapping_decisions_v1",
            },
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Choose trial balance" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["trial balance"], "trial-balance.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByText("Import a new trial balance", { selector: "button" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      "Import trial balance again? This will replace the active account mapping data and current mapping review state for this workspace.",
    );
    expect(trialBalanceRunCount).toBe(0);

    confirmSpy.mockReturnValue(true);

    await userEvent.click(
      screen.getByText("Import a new trial balance", { selector: "button" }),
    );

    expect(trialBalanceRunCount).toBe(1);
  });

  it("shows visible progress while a trial-balance import is still running", async () => {
    let resolvePipelineRequest: ((response: Response) => void) | null = null;
    let importCompleted = false;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(
          importCompleted
            ? mockJsonResponse({
                status: 200,
                body: createActiveMappingBodyV1([
                  createMappingDecisionV1({
                    id: "mapping-1",
                    sourceAccountNumber: "1930",
                    accountName: "Bank",
                  }),
                ]),
              })
            : mockNotFoundResponse("MAPPING_NOT_FOUND"),
        );
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      if (url.includes("/tb-pipeline-runs") && method === "POST") {
        return new Promise<Response>((resolve) => {
          resolvePipelineRequest = resolve;
        });
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Choose trial balance" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["trial balance"], "trial-balance.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Import trial balance" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Trial balance import and AI mapping in progress"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Structuring uploaded accounts and mapping them with AI/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Importing and mapping..." }),
    ).toBeDisabled();
    expect(
      screen.getByText("Trial balance import and AI mapping in progress"),
    ).toBeInTheDocument();

    importCompleted = true;
    const resolveImportRequest = resolvePipelineRequest as
      | ((response: Response) => void)
      | null;
    expect(resolveImportRequest).not.toBeNull();
    resolveImportRequest?.(
      mockJsonResponse({
        status: 200,
        body: createTrialBalancePipelineBodyV1({
          decisions: [
            createMappingDecisionV1({
              id: "mapping-1",
              sourceAccountNumber: "1930",
              accountName: "Bank",
            }),
          ],
        }),
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Trial balance imported and AI mapping completed. Review the rows below or rerun AI mapping.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("surfaces degraded mapping when trial-balance import falls back for reviewability", async () => {
    let importCompleted = false;
    const degradedReason =
      "AI mapping exceeded the synchronous import budget, so a conservative fallback mapping was saved for immediate review.";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return importCompleted
          ? mockJsonResponse({
              status: 200,
              body: createActiveMappingBodyWithExecutionMetadataV1({
                decisions: [
                  createMappingDecisionV1({
                    id: "mapping-1",
                    sourceAccountNumber: "1930",
                    accountName: "Bank",
                    source: "deterministic",
                  }),
                ],
                degraded: true,
                degradedReason,
              }),
            })
          : mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      if (url.includes("/tb-pipeline-runs") && method === "POST") {
        importCompleted = true;
        return mockJsonResponse({
          status: 200,
          body: createTrialBalancePipelineBodyV1({
            decisions: [
              createMappingDecisionV1({
                id: "mapping-1",
                sourceAccountNumber: "1930",
                accountName: "Bank",
                source: "deterministic",
              }),
            ],
            degraded: true,
            degradedReason,
          }),
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Choose trial balance" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["trial balance"], "trial-balance.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Import trial balance" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(`Trial balance imported. ${degradedReason}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Run AI account mapping" }),
    ).toBeInTheDocument();
  });

  it("runs AI account mapping manually after import and refreshes the mapping", async () => {
    let importCompleted = false;
    let enrichmentCompleted = false;
    let enrichmentRunCount = 0;
    let activeMappingReadCount = 0;
    const degradedReason =
      "AI mapping exceeded the synchronous import budget, so a conservative fallback mapping was saved for immediate review.";

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        if (!importCompleted) {
          return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
        }

        activeMappingReadCount += 1;
        if (activeMappingReadCount >= 2) {
          enrichmentCompleted = true;
        }

        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: enrichmentCompleted
              ? {
                  ...createActiveMappingBodyWithExecutionMetadataV1({
                    decisions: [
                      createMappingDecisionV1({
                        id: "mapping-1",
                        sourceAccountNumber: "1270",
                        accountName: "Forbattringsutgifter pa annans fastighet",
                        selectedCategory:
                          getSilverfinTaxCategoryByCodeV1("123200"),
                        proposedCategory:
                          getSilverfinTaxCategoryByCodeV1("123200"),
                        source: "ai",
                        rationale:
                          "Annual report context indicates leasehold improvements.",
                      }),
                    ],
                    actualStrategy: "ai",
                  }),
                  active: {
                    artifactId: "mapping-artifact-2",
                    version: 2,
                    schemaVersion: "mapping_decisions_v2",
                  },
                }
              : {
                  ...createActiveMappingBodyWithExecutionMetadataV1({
                    decisions: [
                      createMappingDecisionV1({
                        id: "mapping-1",
                        sourceAccountNumber: "1270",
                        accountName: "Forbattringsutgifter pa annans fastighet",
                        selectedCategory:
                          getSilverfinTaxCategoryByCodeV1("100000"),
                        proposedCategory:
                          getSilverfinTaxCategoryByCodeV1("100000"),
                        source: "deterministic",
                        reviewFlag: true,
                      }),
                    ],
                    actualStrategy: "deterministic",
                    degraded: true,
                    degradedReason,
                  }),
                  active: {
                    artifactId: "mapping-artifact-1",
                    version: 1,
                    schemaVersion: "mapping_decisions_v2",
                  },
                },
          }),
        );
      }

      if (
        url.includes("/mapping-decisions/ai-enrichment") &&
        method === "POST"
      ) {
        enrichmentRunCount += 1;
        return Promise.resolve(
          mockJsonResponse({
            status: 202,
            body: createMappingAiEnrichmentSuccessBodyV1({
              status: "accepted",
              activeBefore: {
                artifactId: "mapping-artifact-1",
                version: 1,
              },
              activeAfter: {
                artifactId: "mapping-artifact-1",
                version: 1,
              },
              message:
                "AI account mapping started in the background. This page will refresh automatically when the latest mapping is ready.",
            }),
          }),
        );
      }

      if (url.includes("/tb-pipeline-runs") && method === "POST") {
        importCompleted = true;
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: createTrialBalancePipelineBodyV1({
              decisions: [
                createMappingDecisionV1({
                  id: "mapping-1",
                  sourceAccountNumber: "1270",
                  accountName: "Forbattringsutgifter pa annans fastighet",
                  selectedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
                  proposedCategory: getSilverfinTaxCategoryByCodeV1("100000"),
                  source: "deterministic",
                  reviewFlag: true,
                }),
              ],
              actualStrategy: "deterministic",
              degraded: true,
              degradedReason,
            }),
          }),
        );
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Choose trial balance" }),
      ).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["trial balance"], "trial-balance.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Import trial balance" }),
    );

    await waitFor(() => {
      expect(enrichmentRunCount).toBe(0);
      expect(
        screen.getByRole("button", { name: "Run AI account mapping" }),
      ).toBeEnabled();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Run AI account mapping" }),
    );

    await waitFor(() => {
      expect(enrichmentRunCount).toBe(1);
    });

    await waitFor(
      () => {
        expect(
          screen.getByText(
            "AI account mapping completed and replaced the previous active mapping.",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 5_000 },
    );
    expect(screen.getByLabelText("Category for 1270")).toHaveValue("123200");
  }, 10_000);

  it("stops the background mapping spinner when a refreshed AI run timestamp arrives", async () => {
    let enrichmentAccepted = false;
    let enrichmentRunCount = 0;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: enrichmentAccepted
              ? createActiveMappingBodyWithExecutionMetadataV1({
                  decisions: [
                    createMappingDecisionV1({
                      id: "mapping-1",
                      sourceAccountNumber: "1270",
                      accountName: "Forbattringsutgifter pa annans fastighet",
                      selectedCategory:
                        getSilverfinTaxCategoryByCodeV1("123200"),
                      proposedCategory:
                        getSilverfinTaxCategoryByCodeV1("123200"),
                      source: "ai",
                      rationale:
                        "Annual report context indicates leasehold improvements.",
                    }),
                  ],
                  actualStrategy: "ai",
                  active: {
                    artifactId: "mapping-artifact-1",
                    version: 1,
                  },
                  aiGeneratedAt: "2026-03-16T13:05:00.000Z",
                })
              : createActiveMappingBodyWithExecutionMetadataV1({
                  decisions: [
                    createMappingDecisionV1({
                      id: "mapping-1",
                      sourceAccountNumber: "1270",
                      accountName: "Forbattringsutgifter pa annans fastighet",
                      selectedCategory:
                        getSilverfinTaxCategoryByCodeV1("100000"),
                      proposedCategory:
                        getSilverfinTaxCategoryByCodeV1("100000"),
                      source: "ai",
                      reviewFlag: true,
                    }),
                  ],
                  actualStrategy: "ai",
                  degraded: true,
                  degradedReason:
                    "Prior mapping is still conservative while the background refresh is running.",
                  active: {
                    artifactId: "mapping-artifact-1",
                    version: 1,
                  },
                  aiGeneratedAt: "2026-03-16T13:00:00.000Z",
                }),
          }),
        );
      }

      if (
        url.includes("/mapping-decisions/ai-enrichment") &&
        method === "POST"
      ) {
        enrichmentRunCount += 1;
        enrichmentAccepted = true;
        return Promise.resolve(
          mockJsonResponse({
            status: 202,
            body: createMappingAiEnrichmentSuccessBodyV1({
              status: "accepted",
              activeBefore: {
                artifactId: "mapping-artifact-1",
                version: 1,
              },
              activeAfter: {
                artifactId: "mapping-artifact-1",
                version: 1,
              },
              message:
                "AI account mapping started in the background. This page will refresh automatically when the latest mapping is ready.",
            }),
          }),
        );
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Run AI account mapping" }),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Run AI account mapping" }),
    );

    await waitFor(() => {
      expect(enrichmentRunCount).toBe(1);
    });

    await waitFor(
      () => {
        expect(
          screen.getByText(
            "AI account mapping completed and replaced the previous active mapping.",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 5_000 },
    );
    expect(
      screen.queryByText("AI account mapping in progress"),
    ).not.toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("clears active account-mapping data from the module", async () => {
    let mappingCleared = false;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              workspace: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: sessionPrincipalMock.tenantId,
                companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                fiscalYearStart: "2025-01-01",
                fiscalYearEnd: "2025-12-31",
                status: "draft",
                createdAt: "2026-03-01T10:00:00.000Z",
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return Promise.resolve(mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND"));
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND"));
      }

      if (url.includes("/mapping-decisions/active?")) {
        if (mappingCleared) {
          return Promise.resolve(mockNotFoundResponse("MAPPING_NOT_FOUND"));
        }

        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: createActiveMappingBodyV1([
              createMappingDecisionV1({
                id: "mapping-1",
                sourceAccountNumber: "1930",
                accountName: "Bank",
              }),
            ]),
          }),
        );
      }

      if (url.includes("/tb-pipeline-runs/clear") && method === "POST") {
        mappingCleared = true;
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              clearedArtifactTypes: [
                "trial_balance",
                "reconciliation",
                "mapping",
              ],
              clearedDependentArtifactTypes: [],
            },
          }),
        );
      }

      if (url.includes("/tax-adjustments/active?")) {
        return Promise.resolve(mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND"));
      }

      if (url.includes("/tax-summary/active?")) {
        return Promise.resolve(mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND"));
      }

      if (url.includes("/ink2-form/active?")) {
        return Promise.resolve(mockNotFoundResponse("INK2_FORM_NOT_FOUND"));
      }

      if (url.includes("/comments?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, comments: [] },
          }),
        );
      }

      if (url.includes("/tasks?")) {
        return Promise.resolve(
          mockJsonResponse({
            status: 200,
            body: { ok: true, tasks: [] },
          }),
        );
      }

      return Promise.resolve(
        mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        }),
      );
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("button", { name: "Clear account-mapping data" }),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Clear account-mapping data" }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByText(
          "Active account-mapping data cleared from this workspace.",
        ),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Account-to-tax overview" }),
      ).not.toBeInTheDocument();
    });
  });

  it("collapses the forensic rail by default and surfaces extracted tax notes in the annual-report review", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 2,
              schemaVersion: "annual_report_extraction_v1",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Deloitte AB",
                  status: "extracted",
                  confidence: 0.98,
                },
                organizationNumber: {
                  value: "556271-5309",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearStart: {
                  value: "2024-06-01",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearEnd: {
                  value: "2025-05-31",
                  status: "extracted",
                  confidence: 0.98,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.95,
                },
                profitBeforeTax: {
                  value: 545286,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [
                "Gemini statements extraction skipped on the previous run.",
              ],
              taxDeep: {
                ink2rExtracted: {
                  statementUnit: "ksek",
                  incomeStatement: [
                    {
                      code: "net-turnover",
                      label: "Nettoomsättning",
                      currentYearValue: 428447275000,
                      priorYearValue: 401000000000,
                      evidence: [],
                    },
                    {
                      code: "profit-before-tax",
                      label: "Resultat före skatt",
                      currentYearValue: 545286000,
                      priorYearValue: 510210000,
                      evidence: [],
                    },
                  ],
                  balanceSheet: [
                    {
                      code: "inventories",
                      label: "Varulager",
                      currentYearValue: 128000,
                      evidence: [],
                    },
                    {
                      code: "untaxed-reserves",
                      label: "Obeskattade reserver",
                      currentYearValue: 8000000,
                      evidence: [],
                    },
                  ],
                },
                depreciationContext: {
                  assetAreas: [
                    {
                      assetArea: "Inventories and equipment",
                      acquisitions: 22000,
                      disposals: 3500,
                      depreciationForYear: 8000,
                      closingCarryingAmount: 99000,
                      evidence: [],
                    },
                  ],
                  evidence: [],
                },
                assetMovements: {
                  lines: [],
                  evidence: [],
                },
                reserveContext: {
                  movements: [
                    {
                      reserveType: "Overavskrivningar",
                      openingBalance: 0,
                      movementForYear: 8000,
                      closingBalance: 8000,
                      evidence: [],
                    },
                  ],
                  notes: [
                    "Overavskrivningar of 8,000 should be matched to the tax depreciation schedule.",
                  ],
                  evidence: [],
                },
                netInterestContext: {
                  netInterest: {
                    value: -12000,
                    evidence: [],
                  },
                  notes: [
                    "Finance items should be reviewed against interest limitation rules if group debt exists.",
                  ],
                  evidence: [],
                },
                pensionContext: {
                  flags: [],
                  notes: [
                    "Pension commitments should be reconciled to the special payroll tax base.",
                  ],
                  evidence: [],
                },
                taxExpenseContext: {
                  currentTax: {
                    value: 112345000,
                    evidence: [],
                  },
                  deferredTax: {
                    value: -1200000,
                    evidence: [],
                  },
                  notes: [],
                  evidence: [],
                },
                leasingContext: {
                  flags: [],
                  notes: [],
                  evidence: [
                    {
                      snippet:
                        "Lease commitments continue through 2030 according to note 3.",
                      noteReference: "Not 3",
                      page: 24,
                    },
                  ],
                },
                groupContributionContext: {
                  flags: [],
                  notes: [
                    "Group contribution references are present in the notes and should be reconciled to the tax return.",
                  ],
                  evidence: [],
                },
                shareholdingContext: {
                  dividendsPaid: {
                    value: 559458000,
                    evidence: [],
                  },
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                relevantNotes: [
                  {
                    category: "fixed_assets_depreciation",
                    noteReference: "Not 12",
                    title: "Programvaror",
                    pages: [27],
                    notes: ["Programvaror skrivs av med 10 procent per ar."],
                    evidence: [],
                  },
                  {
                    category: "tax_expense",
                    noteReference: "Not 9",
                    title: "Skatt pa arets resultat",
                    pages: [26],
                    notes: [
                      "Aktuell skatt och skatteeffekter av ej avdragsgilla kostnader framgar av noten.",
                    ],
                    evidence: [],
                  },
                  {
                    category: "impairments_write_downs",
                    noteReference: "Not 22",
                    title: "Nedskrivningar av andelar",
                    pages: [30],
                    notes: [
                      "Andelar i koncernforetag ska foljas upp for eventuell skattemassig avdragsbegransning.",
                    ],
                    evidence: [],
                  },
                ],
                priorYearComparatives: [],
              },
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              version: 1,
              schemaVersion: "annual_report_tax_analysis_v1",
            },
            taxAnalysis: {
              schemaVersion: "annual_report_tax_analysis_v1",
              sourceExtractionArtifactId:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              policyVersion: "annual-report-tax-analysis.v1",
              basedOn: {
                ink2rExtracted: { incomeStatement: [], balanceSheet: [] },
                depreciationContext: { assetAreas: [], evidence: [] },
                assetMovements: { lines: [], evidence: [] },
                reserveContext: { movements: [], notes: [], evidence: [] },
                netInterestContext: { notes: [], evidence: [] },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              executiveSummary:
                "The report contains depreciation and reserve movements that require tax review.",
              accountingStandardAssessment: {
                status: "aligned",
                rationale: "K3 is explicit and usable for tax review.",
              },
              findings: [
                {
                  id: "finding-1",
                  area: "depreciation",
                  title: "Depreciation schedule should be reconciled",
                  severity: "medium",
                  rationale:
                    "Acquisitions, disposals, and over-depreciation are present in the report.",
                  recommendedFollowUp:
                    "Confirm the tax depreciation basis before filing.",
                  missingInformation: [],
                  policyRuleReference: "annual-report.tax.depreciation",
                  evidence: [],
                },
              ],
              missingInformation: [],
              recommendedNextActions: [
                "Verify the depreciation schedule against the fixed-asset ledger.",
              ],
            },
          },
        });
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            comments: [],
          },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            tasks: [],
          },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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

    expect(
      await screen.findByRole("heading", { name: "Financial data" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Extract company facts and financial values"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Deloitte AB")).toBeInTheDocument();
    expect(screen.getByText("Normalized from kSEK to SEK")).toBeInTheDocument();
    expect(screen.getByText("Income statement")).toBeInTheDocument();
    expect(screen.getByText("Balance sheet")).toBeInTheDocument();
    expect(screen.getByText("Nettoomsättning")).toBeInTheDocument();
    expect(screen.getByText("428 447 275 000")).toBeInTheDocument();
    expect(screen.getByText("Varulager")).toBeInTheDocument();
    expect(screen.getByText("Depreciation and movements")).toBeInTheDocument();
    expect(screen.getByText("Current tax")).toBeInTheDocument();
    expect(screen.getByText("112 345 000")).toBeInTheDocument();
    expect(screen.getByText("Inventories and equipment")).toBeInTheDocument();
    expect(screen.getByText("Relevant tax notes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Not 12 Programvaror: Programvaror skrivs av med 10 procent per ar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Not 9 Skatt pa arets resultat: Aktuell skatt och skatteeffekter av ej avdragsgilla kostnader framgar av noten.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Impairments and write-downs")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Not 22 Nedskrivningar av andelar: Andelar i koncernforetag ska foljas upp for eventuell skattemassig avdragsbegransning.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Lease commitments continue through 2030 according to note 3.",
      ),
    ).toBeInTheDocument();
    const showForensicReviewButton = screen.getByRole("button", {
      name: "Show forensic review",
    });
    const clearAnnualReportButton = screen.getByRole("button", {
      name: "Clear annual report data",
    });
    expect(showForensicReviewButton).toBeInTheDocument();
    expect(clearAnnualReportButton).toBeInTheDocument();
    expect(
      showForensicReviewButton.closest(
        ".annual-report-sidebar__actions--header",
      ),
    ).toBe(
      clearAnnualReportButton.closest(
        ".annual-report-sidebar__actions--header",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Continue to forensic review" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Forensic tax review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Overavskrivningar of 8,000 should be matched to the tax depreciation schedule.",
      ),
    ).toBeInTheDocument();
    const warningDisclosure = document.querySelector(
      ".annual-report-sidebar__details",
    ) as HTMLDetailsElement | null;
    expect(warningDisclosure).not.toBeNull();
    expect(warningDisclosure?.open).toBe(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Show forensic review" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Forensic tax review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide forensic review" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fallback only")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "The report contains depreciation and reserve movements that require tax review.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Forensic tax review" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Show forensic review" }),
    ).toBeInTheDocument();
  });

  it("shows a rerun-required state for stale core-only annual-report artifacts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            active: {
              artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              version: 3,
              schemaVersion: "annual_report_extraction_v1",
            },
            runtime: {
              extractionEngineVersion: "annual-report-deep-extraction.v2",
              runtimeFingerprint:
                "annual-report-deep-extraction.v2|qwen-plus|qwen-max",
            },
            extraction: {
              schemaVersion: "annual_report_extraction_v1",
              sourceFileName: "annual-report.pdf",
              sourceFileType: "pdf",
              policyVersion: "annual-report-manual-first.v1",
              fields: {
                companyName: {
                  value: "Deloitte AB",
                  status: "extracted",
                  confidence: 0.98,
                },
                organizationNumber: {
                  value: "556271-5309",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearStart: {
                  value: "2024-06-01",
                  status: "extracted",
                  confidence: 0.98,
                },
                fiscalYearEnd: {
                  value: "2025-05-31",
                  status: "extracted",
                  confidence: 0.98,
                },
                accountingStandard: {
                  value: "K3",
                  status: "extracted",
                  confidence: 0.95,
                },
                profitBeforeTax: {
                  value: 545286,
                  status: "extracted",
                  confidence: 0.9,
                },
              },
              summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
              taxSignals: [],
              documentWarnings: [
                'Gemini statements extraction skipped: {"error":{"code":400,"message":"A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth.","status":"INVALID_ARGUMENT"}}',
                "Full financial extraction is missing on this artifact. Re-run the annual report analysis to populate full income statement, balance sheet, and tax-note data.",
              ],
              taxDeep: {
                ink2rExtracted: {
                  incomeStatement: [],
                  balanceSheet: [],
                },
                depreciationContext: { assetAreas: [], evidence: [] },
                assetMovements: { lines: [], evidence: [] },
                reserveContext: { movements: [], notes: [], evidence: [] },
                netInterestContext: { notes: [], evidence: [] },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: {
                  flags: [],
                  notes: [],
                  evidence: [],
                },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                priorYearComparatives: [],
              },
              confirmation: { isConfirmed: false },
            },
          },
        });
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockNotFoundResponse("MAPPING_NOT_FOUND");
      }
      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }
      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }
      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }
      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }
      if (url.includes("/tasks?")) {
        return mockJsonResponse({ status: 200, body: { ok: true, tasks: [] } });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/annual-report-analysis",
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
      expect(screen.getAllByText("Legacy result")).toHaveLength(1);
    });
    expect(
      screen.getAllByText(
        "This saved result was created with an older extraction engine and is missing full statements and tax-note context. Upload the annual report again to refresh it.",
      ),
    ).toHaveLength(1);
    expect(screen.queryByText("Income statement")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Choose annual report" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Clear annual report data" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Show forensic review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Technical details (1)")).toBeInTheDocument();
  });

  it("renders the full account-mapping workbench and exposes rows beyond the old preview limit", async () => {
    const decisions = Array.from({ length: 12 }, (_, index) =>
      createMappingDecisionV1({
        id: `mapping-${index + 1}`,
        sourceAccountNumber: String(1930 + index),
        accountName: `Mapped account ${index + 1}`,
        confidence: index === 0 ? 0.74 : 0.92,
        reviewFlag: index === 0,
        rationale:
          index === 0
            ? "Annual report indicates leasehold improvements rather than owned buildings."
            : undefined,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: createActiveMappingBodyV1(decisions),
        });
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(
        screen.getByRole("heading", { name: "Account-to-tax overview" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("12 visible rows")).toBeInTheDocument();
    expect(screen.queryByText("asset_movements")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Show selected row details" }),
    );

    expect(
      screen.getAllByText(
        "Annual report indicates leasehold improvements rather than owned buildings.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("asset_movements")).toBeInTheDocument();

    fireEvent.scroll(screen.getByTestId("account-mapping-grid-scroll"), {
      target: { scrollTop: 520 },
    });

    await waitFor(() => {
      expect(screen.getByText("Mapped account 12")).toBeInTheDocument();
    });
  });

  it("applies account-mapping overrides from the module workbench", async () => {
    let overrideRequestBody: Record<string, unknown> | null = null;
    let activeMappingBody = createActiveMappingBodyV1([
      createMappingDecisionV1({
        id: "mapping-1",
        sourceAccountNumber: "1930",
        accountName: "Bank",
        rationale:
          "Annual report context suggests this balance relates to leasehold improvements.",
      }),
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: activeMappingBody,
        });
      }

      if (url.includes("/mapping-overrides") && method === "POST") {
        overrideRequestBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        activeMappingBody = createActiveMappingBodyV1([
          createMappingDecisionV1({
            id: "mapping-1",
            sourceAccountNumber: "1930",
            accountName: "Bank",
            selectedCategory: buildingCategory,
            proposedCategory: cashAndBankCategory,
            source: "manual",
            status: "overridden",
            override: {
              scope: "return",
              reason:
                "Annual report indicates the account should route to building adjustments.",
            },
          }),
        ]);

        return mockJsonResponse({
          status: 200,
          body: {
            ...activeMappingBody,
            appliedCount: 1,
            savedPreferenceCount: 1,
          },
        });
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("TAX_SUMMARY_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/account-mapping",
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
      expect(screen.getByLabelText("Category for 1930")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Show selected row details" }),
    );

    await userEvent.selectOptions(screen.getByLabelText("Category for 1930"), [
      "111000",
    ]);
    await userEvent.clear(screen.getByLabelText("Override reason for 1930"));
    await userEvent.type(
      screen.getByLabelText("Override reason for 1930"),
      "Annual report indicates the account should route to building adjustments.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply override" }),
    );

    await waitFor(() => {
      expect(overrideRequestBody).not.toBeNull();
    });

    expect(overrideRequestBody).toMatchObject({
      tenantId: sessionPrincipalMock.tenantId,
      overrides: [
        {
          decisionId: "mapping-1",
          selectedCategoryCode: "111000",
          scope: "return",
          reason:
            "Annual report indicates the account should route to building adjustments.",
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(/Current override: return/i)).toBeInTheDocument();
    });
  });

  it("renders the tax-adjustments scaffold with sidebar submodule navigation", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        url.includes("/v1/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?") &&
        method === "GET"
      ) {
        return mockJsonResponse({
          status: 200,
          body: {
            ok: true,
            workspace: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: sessionPrincipalMock.tenantId,
              companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              fiscalYearStart: "2025-01-01",
              fiscalYearEnd: "2025-12-31",
              status: "draft",
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      if (url.includes("/annual-report-extractions/active?")) {
        return mockNotFoundResponse("ANNUAL_REPORT_NOT_FOUND");
      }

      if (url.includes("/annual-report-tax-analysis/active?")) {
        return mockNotFoundResponse("TAX_ANALYSIS_NOT_FOUND");
      }

      if (url.includes("/mapping-decisions/active?")) {
        return mockJsonResponse({
          status: 200,
          body: createActiveMappingBodyV1([
            createMappingDecisionV1({
              id: "mapping-1",
              sourceAccountNumber: "1930",
              accountName: "Bank",
            }),
          ]),
        });
      }

      if (url.includes("/tax-adjustments/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/tax-summary/active?")) {
        return mockNotFoundResponse("ADJUSTMENTS_NOT_FOUND");
      }

      if (url.includes("/ink2-form/active?")) {
        return mockNotFoundResponse("INK2_FORM_NOT_FOUND");
      }

      if (url.includes("/comments?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, comments: [] },
        });
      }

      if (url.includes("/tasks?")) {
        return mockJsonResponse({
          status: 200,
          body: { ok: true, tasks: [] },
        });
      }

      return mockJsonResponse({
        status: 500,
        body: {
          ok: false,
          error: {
            code: "UNEXPECTED",
            message: "Unexpected call",
            user_message: "Unexpected call",
            context: {},
          },
        },
      });
    });

    render(
      <AppProviders>
        <MemoryRouter
          initialEntries={[
            "/app/workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/tax-adjustments",
          ]}
        >
          <Routes>
            <Route
              path="/app/workspaces/:workspaceId/:coreModule/:subModule"
              element={<CoreModuleShellPageV1 />}
            />
            <Route
              path="/app/workspaces/:workspaceId/:coreModule"
              element={<CoreModuleShellPageV1 />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "General client information",
          level: 1,
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("region", { name: "Submodule navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Under construction")).toBeInTheDocument();
    expect(screen.queryByText("Workspace status")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Calculation chain" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Final tax calculation" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("link", { name: "Final tax calculation" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Final tax calculation",
          level: 1,
        }),
      ).toBeInTheDocument();
    });
  });
});
