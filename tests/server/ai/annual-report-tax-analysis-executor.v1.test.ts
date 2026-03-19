import { afterEach, describe, expect, it, vi } from "vitest";

const { generateGeminiStructuredOutputMock } = vi.hoisted(() => ({
  generateGeminiStructuredOutputMock: vi.fn(),
}));

vi.mock("../../../src/server/ai/providers/ai-provider-client.v1", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/server/ai/providers/ai-provider-client.v1")
  >("../../../src/server/ai/providers/ai-provider-client.v1");

  return {
    ...actual,
    generateAiStructuredOutputV1: generateGeminiStructuredOutputMock,
  };
});

import { executeAnnualReportTaxAnalysisV1 } from "../../../src/server/ai/modules/annual-report-tax-analysis/executor.v1";
import { loadAnnualReportTaxAnalysisModuleConfigV1 } from "../../../src/server/ai/modules/annual-report-tax-analysis/loader.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";

function getConfigOrThrowV1() {
  const configResult = loadAnnualReportTaxAnalysisModuleConfigV1();
  if (!configResult.ok) {
    throw new Error(configResult.error.message);
  }

  return configResult.config;
}

function createExtractionV1() {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
    fields: {
      companyName: { status: "extracted", confidence: 0.99, value: "Acme AB" },
      organizationNumber: {
        status: "extracted",
        confidence: 0.99,
        value: "556677-8899",
      },
      fiscalYearStart: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-01-01",
      },
      fiscalYearEnd: {
        status: "extracted",
        confidence: 0.99,
        value: "2025-12-31",
      },
      accountingStandard: {
        status: "extracted",
        confidence: 0.99,
        value: "K3",
      },
      profitBeforeTax: {
        status: "extracted",
        confidence: 0.99,
        value: 1000,
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
        incomeStatement: [],
        balanceSheet: [],
      },
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      priorYearComparatives: [],
    },
    confirmation: {
      isConfirmed: true,
      confirmedAt: "2026-03-11T12:00:00.000Z",
      confirmedByUserId: "9d000000-0000-4000-8000-000000000004",
    },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("executeAnnualReportTaxAnalysisV1", () => {
  it("attaches the full annual report PDF and uses a larger time budget", async () => {
    generateGeminiStructuredOutputMock.mockResolvedValue({
      ok: true,
      model: "qwen-max",
      output: {
        executiveSummary: "Finance note and depreciation note need review.",
        accountingStandardAssessment: {
          status: "aligned",
          rationale: "K3 is stated in the report.",
        },
        findings: [],
        missingInformation: [],
        recommendedNextActions: [],
      },
    });

    const result = await executeAnnualReportTaxAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: {
        fileType: "pdf",
        inlineDataBase64: "base64-pdf",
        mimeType: "application/pdf",
        text: "",
        executionProfile: "extractable_text_pdf",
      },
      extraction: createExtractionV1(),
      extractionArtifactId: "9f000000-0000-4000-8000-000000000001",
      generateId: () => "tax-analysis-run-1",
      generatedAt: "2026-03-11T12:00:00.000Z",
      modelConfig: { fastModel: "fast-model", thinkingModel: "thinking-model" },
      policyVersion: "annual-report-manual-first.v1",
      sourceDiagnostics: ["parsing.pdf.classification=extractable_text_pdf"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(generateGeminiStructuredOutputMock).toHaveBeenCalledTimes(1);
    expect(
      generateGeminiStructuredOutputMock.mock.calls[0]?.[0]?.request?.timeoutMs,
    ).toBe(600_000);
    expect(
      generateGeminiStructuredOutputMock.mock.calls[0]?.[0]?.request?.documents,
    ).toEqual([
      {
        dataBase64: "base64-pdf",
        mimeType: "application/pdf",
      },
    ]);
    expect(
      String(
        generateGeminiStructuredOutputMock.mock.calls[0]?.[0]?.request
          ?.userInstruction ?? "",
      ),
    ).toContain("full annual report PDF is attached");
    expect(result.taxAnalysis.aiRun?.usedFallback).toBe(false);
    expect(result.taxAnalysis.reviewState).toEqual({
      mode: "full_ai",
      reasons: [],
      sourceDocumentAvailable: true,
      sourceDocumentUsed: true,
    });
  });

  it("normalizes loose AI output into the saved tax-analysis contract", async () => {
    generateGeminiStructuredOutputMock.mockResolvedValue({
      ok: true,
      model: "qwen-max",
      output: {
        accountingStandardAssessment: {},
        missingInformation: ["Signed merger agreement is missing."],
        recommended_actions: [
          "1. **Prioritize Restructuring:** Obtain and review the merger documents.",
          "2. **Reconcile Fixed Assets:** Review the tax fixed asset register.",
        ],
      },
    });

    const result = await executeAnnualReportTaxAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      extraction: createExtractionV1(),
      extractionArtifactId: "9f000000-0000-4000-8000-000000000001",
      generateId: () => "tax-analysis-run-2",
      generatedAt: "2026-03-11T12:00:00.000Z",
      modelConfig: { fastModel: "fast-model", thinkingModel: "thinking-model" },
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.taxAnalysis.executiveSummary).toBe(
      "The forensic annual-report review flagged 2 tax-sensitive area(s) for follow-up.",
    );
    expect(result.taxAnalysis.accountingStandardAssessment.status).toBe(
      "aligned",
    );
    expect(result.taxAnalysis.findings).toHaveLength(2);
    expect(result.taxAnalysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "asset_acquisitions_and_disposals",
          policyRuleReference:
            "annual-report-tax-analysis.v1.action-synthesized",
          recommendedFollowUp:
            "Prioritize Restructuring: Obtain and review the merger documents.",
        }),
        expect.objectContaining({
          area: "depreciation_differences",
          policyRuleReference:
            "annual-report-tax-analysis.v1.action-synthesized",
          recommendedFollowUp:
            "Reconcile Fixed Assets: Review the tax fixed asset register.",
        }),
      ]),
    );
    expect(result.taxAnalysis.findings[0]?.id).toContain("finding-1");
    expect(result.taxAnalysis.recommendedNextActions).toEqual([
      "Prioritize Restructuring: Obtain and review the merger documents.",
      "Reconcile Fixed Assets: Review the tax fixed asset register.",
    ]);
    expect(result.taxAnalysis.reviewState).toEqual({
      mode: "extraction_only",
      reasons: ["Source document was not provided to the forensic AI review."],
      sourceDocumentAvailable: false,
      sourceDocumentUsed: false,
    });
  });

  it("synthesizes minimum forensic coverage when the AI returns an empty review but extraction signals exist", async () => {
    generateGeminiStructuredOutputMock.mockResolvedValue({
      ok: true,
      model: "qwen-max",
      output: {
        executiveSummary: "",
        findings: [],
        missingInformation: [],
        recommendedNextActions: [],
      },
    });

    const extraction = createExtractionV1();
    if (!extraction.taxDeep) {
      throw new Error("Expected taxDeep in fixture extraction.");
    }
    extraction.taxDeep.assetMovements = {
      lines: [
        {
          assetArea: "Programvaror",
          acquisitions: 19492,
          depreciationForYear: 3628,
          closingCarryingAmount: 49004,
          evidence: [{ snippet: "Programvaror 49 004", page: 27 }],
        },
      ],
      evidence: [{ snippet: "Not 12 Programvaror", page: 27 }],
    };
    extraction.taxDeep.taxExpenseContext = {
      currentTax: {
        value: 116885,
        evidence: [{ snippet: "Aktuell skatt 116 885", page: 26 }],
      },
      notes: ["Skatt pa arets resultat framgar av not 9."],
      evidence: [{ snippet: "Not 9 Skatt pa arets resultat", page: 26 }],
    };
    extraction.taxDeep.shareholdingContext = {
      ...extraction.taxDeep.shareholdingContext,
      notes: ["Andelar i koncernforetag framgar av not 18."],
      evidence: [{ snippet: "Not 18 Andelar i koncernforetag", page: 29 }],
    };

    const result = await executeAnnualReportTaxAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: {
        fileType: "pdf",
        inlineDataBase64: "base64-pdf",
        mimeType: "application/pdf",
        text: "",
        executionProfile: "extractable_text_pdf",
      },
      extraction,
      extractionArtifactId: "9f000000-0000-4000-8000-000000000001",
      generateId: () => "tax-analysis-run-3",
      generatedAt: "2026-03-12T10:00:00.000Z",
      modelConfig: { fastModel: "fast-model", thinkingModel: "thinking-model" },
      policyVersion: "annual-report-manual-first.v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.taxAnalysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "depreciation_differences",
          policyRuleReference:
            "annual-report-tax-analysis.v1.minimum-coverage.depreciation",
        }),
        expect.objectContaining({
          area: "untaxed_reserves",
          policyRuleReference:
            "annual-report-tax-analysis.v1.minimum-coverage.tax-reserve",
        }),
        expect.objectContaining({
          area: "shareholdings_dividends",
          policyRuleReference:
            "annual-report-tax-analysis.v1.minimum-coverage.group-ownership",
        }),
      ]),
    );
    expect(result.taxAnalysis.recommendedNextActions.length).toBeGreaterThan(0);
    expect(result.taxAnalysis.executiveSummary).toContain("flagged");
  });
});
