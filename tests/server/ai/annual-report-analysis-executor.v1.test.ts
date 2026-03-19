import { describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";

const { generateGeminiStructuredOutputMock } = vi.hoisted(() => ({
  generateGeminiStructuredOutputMock: vi.fn(),
}));

vi.mock("../../../src/server/ai/providers/ai-provider-client.v1", () => ({
  generateAiStructuredOutputV1: generateGeminiStructuredOutputMock,
  toBase64V1: vi.fn(() => "base64"),
}));

import { loadAnnualReportAnalysisModuleConfigV1 } from "../../../src/server/ai/modules/annual-report-analysis/loader.v1";
import { executeAnnualReportAnalysisV1 } from "../../../src/server/ai/modules/annual-report-analysis/executor.v1";
import {
  prepareAnnualReportPdfRoutingV1,
  resolveAnnualReportPdfLocatorSectionsV1,
} from "../../../src/server/parsing/annual-report-page-routing.v1";
import { parseAnnualReportSourceTextV1, type AnnualReportPdfClassificationV1 } from "../../../src/shared/contracts/annual-report-source-text.v1";

function getConfigOrThrowV1() {
  const configResult = loadAnnualReportAnalysisModuleConfigV1();
  if (!configResult.ok) {
    throw new Error(configResult.error.message);
  }

  return configResult.config;
}

async function createPdfBytesWithPageLabelsV1(
  pageLabels: Record<number, string>,
  pageCount = 32,
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(pageLabels[pageNumber] ?? `Page ${pageNumber}`, {
      x: 40,
      y: 780,
      size: 14,
      font,
    });
  }

  return pdf.save();
}

function createPreparedPdfDocumentV1(input: {
  classification?: AnnualReportPdfClassificationV1;
  pageCount: number;
  pageTexts: string[];
  pdfBytes: Uint8Array;
}) {
  const text = input.pageTexts.join("\n\n");
  const classification =
    input.classification ?? "extractable_text_pdf";
  const sourceText = parseAnnualReportSourceTextV1({
    schemaVersion: "annual_report_source_text_v1",
    fileType: "pdf",
    text,
    pageCount: input.pageCount,
    textSource: "pdf_unpdf_text",
    parserVersion: "annual-report-source-text.v1/test",
    pdfAnalysis: {
      classification,
      averageCharsPerPage: input.pageCount > 0 ? text.length / input.pageCount : 0,
      nonEmptyPageCount: input.pageTexts.filter((page) => page.trim().length > 20).length,
      nonEmptyPageRatio:
        input.pageCount > 0
          ? input.pageTexts.filter((page) => page.trim().length > 20).length /
            input.pageCount
          : 0,
      totalExtractedChars: text.length,
    },
    warnings: [],
    pageTexts: input.pageTexts,
  });
  const pdfRouting =
    classification === "extractable_text_pdf"
      ? prepareAnnualReportPdfRoutingV1({
          sourceText,
        })
      : undefined;

  return {
    fileType: "pdf" as const,
    mimeType: "application/pdf",
    inlineDataBase64: "base64",
    sourcePdfBytes: input.pdfBytes,
    sourceText,
    pageTexts: input.pageTexts,
    executionProfile: classification,
    text,
    pdfRouting,
    coreFactsSeed: pdfRouting?.coreFactsSeed,
  };
}

function findMockUserInstructionV1(stageLabel: string): string {
  const match = generateGeminiStructuredOutputMock.mock.calls.find((call) =>
    String(call?.[0]?.request?.userInstruction ?? "").includes(stageLabel),
  );
  return String(match?.[0]?.request?.userInstruction ?? "");
}

function createCombinedExtractionOutputV1(input?: {
  incomeStatement?: Array<Record<string, unknown>>;
  balanceSheet?: Array<Record<string, unknown>>;
  priorYearComparatives?: Array<Record<string, unknown>>;
  reserveNotes?: string[];
  netInterestNotes?: string[];
  shareholdingNotes?: string[];
  taxExpenseNotes?: string[];
}) {
  return {
    schemaVersion: "annual_report_ai_combined_text_extraction_v1",
    documentWarnings: [],
    ink2rExtracted: {
      statementUnit: "ksek",
      incomeStatement: input?.incomeStatement ?? [
        { code: "revenue", label: "Nettoomsättning", currentYearValue: 1000 },
      ],
      balanceSheet: input?.balanceSheet ?? [
        { code: "cash", label: "Kassa och bank", currentYearValue: 200 },
      ],
    },
    priorYearComparatives: input?.priorYearComparatives ?? [],
    depreciationContext: { assetAreas: [], evidence: [] },
    assetMovements: { lines: [], evidence: [] },
    reserveContext: {
      movements: [],
      notes: input?.reserveNotes ?? [],
      evidence: [],
    },
    netInterestContext: { notes: input?.netInterestNotes ?? [], evidence: [] },
    pensionContext: { flags: [], notes: [], evidence: [] },
    leasingContext: { flags: [], notes: [], evidence: [] },
    groupContributionContext: { flags: [], notes: [], evidence: [] },
    shareholdingContext: {
      flags: [],
      notes: input?.shareholdingNotes ?? [],
      evidence: [],
    },
    taxExpenseContext: {
      notes: input?.taxExpenseNotes ?? [],
      evidence: [],
    },
    evidence: [],
  };
}

describe("executeAnnualReportAnalysisV1", () => {
  it("keeps tax-note schema failures non-fatal and records stage-labeled warnings", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_section_locator_v1",
          sections: {
            coreFacts: [],
            incomeStatement: [],
            balanceSheet: [],
            taxExpense: [],
            depreciationAndAssets: [],
            reserves: [],
            financeAndInterest: [],
            pensionsAndLeasing: [],
            groupContributionsAndShareholdings: [],
          },
          documentWarnings: [],
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_core_facts_v1",
          fields: {
            companyName: {
              status: "extracted",
              confidence: 0.99,
              valueText: "Acme AB",
            },
            organizationNumber: {
              status: "extracted",
              confidence: 0.99,
              valueText: "556677-8899",
            },
            fiscalYearStart: {
              status: "extracted",
              confidence: 0.99,
              valueText: "2025-01-01",
              normalizedValue: "2025-01-01",
            },
            fiscalYearEnd: {
              status: "extracted",
              confidence: 0.99,
              valueText: "2025-12-31",
              normalizedValue: "2025-12-31",
            },
            accountingStandard: {
              status: "extracted",
              confidence: 0.99,
              valueText: "K2",
              normalizedValue: "K2",
            },
            profitBeforeTax: {
              status: "extracted",
              confidence: 0.99,
              valueText: "250",
              normalizedValue: 250,
            },
          },
          taxSignals: [],
          documentWarnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_statements_only_v1",
          ink2rExtracted: {
            statementUnit: "ksek",
            incomeStatement: [
              {
                code: "profit_before_tax",
                label: "Profit before tax",
                currentYearValue: 250,
              },
            ],
            balanceSheet: [
              {
                code: "total_assets",
                label: "Total assets",
                currentYearValue: 1000,
              },
            ],
          },
          priorYearComparatives: [],
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message:
            "Gemini response did not match the expected schema. reserveContext.movements: Expected array, received string",
          context: {
            issueSummary:
              "reserveContext.movements: Expected array, received string",
          },
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message:
            "Gemini response did not match the expected schema. pensionContext.flags: Expected array, received string",
          context: {
            issueSummary:
              "pensionContext.flags: Expected array, received string",
          },
        },
      });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: {
        fileType: "docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: "Annual report text",
      },
      generateId: () => "run-1",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.ink2rExtracted.incomeStatement).toHaveLength(1);
    expect(result.extraction.taxDeep.reserveContext.movements).toEqual([]);
    expect(result.extraction.taxDeep.pensionContext.flags).toEqual([]);
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("degraded.tax_notes_assets.unavailable:[tax notes assets/reserves]"),
        expect.stringContaining("degraded.tax_notes_finance.unavailable:[tax notes finance/other]"),
      ]),
    );
    expect(result.aiRun?.usedFallback).toBe(true);
  });

  it("keeps statement schema failures reviewable and labels the warning for admins", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_section_locator_v1",
          sections: {
            coreFacts: [],
            incomeStatement: [],
            balanceSheet: [],
            taxExpense: [],
            depreciationAndAssets: [],
            reserves: [],
            financeAndInterest: [],
            pensionsAndLeasing: [],
            groupContributionsAndShareholdings: [],
          },
          documentWarnings: [],
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_core_facts_v1",
          fields: {
            companyName: {
              status: "extracted",
              confidence: 0.99,
              valueText: "Acme AB",
            },
            organizationNumber: {
              status: "extracted",
              confidence: 0.99,
              valueText: "556677-8899",
            },
            fiscalYearStart: {
              status: "extracted",
              confidence: 0.99,
              valueText: "2025-01-01",
              normalizedValue: "2025-01-01",
            },
            fiscalYearEnd: {
              status: "extracted",
              confidence: 0.99,
              valueText: "2025-12-31",
              normalizedValue: "2025-12-31",
            },
            accountingStandard: {
              status: "extracted",
              confidence: 0.99,
              valueText: "K3",
              normalizedValue: "K3",
            },
            profitBeforeTax: {
              status: "extracted",
              confidence: 0.99,
              valueText: "500",
              normalizedValue: 500,
            },
          },
          taxSignals: [],
          documentWarnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "MODEL_RESPONSE_INVALID",
          message:
            "Gemini response did not match the expected schema. ink2rExtracted.balanceSheet: Required",
          context: {
            issueSummary: "ink2rExtracted.balanceSheet: Required",
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
          depreciationContext: { assetAreas: [], evidence: [] },
          assetMovements: { lines: [], evidence: [] },
          reserveContext: { movements: [], notes: [], evidence: [] },
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
          netInterestContext: { notes: [], evidence: [] },
          pensionContext: { flags: [], notes: [], evidence: [] },
          leasingContext: { flags: [], notes: [], evidence: [] },
          groupContributionContext: { flags: [], notes: [], evidence: [] },
          shareholdingContext: { flags: [], notes: [], evidence: [] },
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
          netInterestContext: { notes: [], evidence: [] },
          pensionContext: { flags: [], notes: [], evidence: [] },
          leasingContext: { flags: [], notes: [], evidence: [] },
          groupContributionContext: { flags: [], notes: [], evidence: [] },
          shareholdingContext: { flags: [], notes: [], evidence: [] },
          evidence: [],
        },
      });
    generateGeminiStructuredOutputMock.mockResolvedValue({
      ok: true,
      model: "qwen-plus",
      output: {
        schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        evidence: [],
      },
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: {
        fileType: "docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: "Annual report text",
      },
      generateId: () => "run-2",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.ink2rExtracted.incomeStatement).toEqual([]);
    expect(result.extraction.taxDeep.ink2rExtracted.balanceSheet).toEqual([]);
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("degraded.statements.unavailable:[statements]"),
        expect.stringContaining("ink2rExtracted.balanceSheet: Required"),
      ]),
    );
    expect(result.aiRun?.usedFallback).toBe(true);
  });

  it("recovers statement and note page routing from deterministic PDF text fallback", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [{ startPage: 1, endPage: 3, confidence: 0.9 }],
              incomeStatement: [],
              balanceSheet: [],
              taxExpense: [],
              depreciationAndAssets: [],
              reserves: [],
              financeAndInterest: [],
              pensionsAndLeasing: [],
              groupContributionsAndShareholdings: [],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1({
            taxExpenseNotes: ["Current tax disclosed"],
          }),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      2: "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      24: "Not 3 Leasingavtal",
      25: "Not 5 Pensionskostnader\nNot 6 Övriga ränteintäkter\nNot 7 Räntekostnader",
      26: "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter",
      27: "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
      28: "Not 15 Inventarier\nNot 16 Datorer\nNot 17 Förbättringsutgifter på annans fastighet",
      29: "Not 18 Andelar i koncernföretag\nNot 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav",
      30: "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder",
      31: "Not 28 Ställda säkerheter och eventualförpliktelser",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Page 1",
          "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning",
          "Balansräkning",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Bokslutskommentarer",
          "Page 21",
          "Page 22",
          "Page 23",
          "Not 3 Leasingavtal",
          "Not 5 Pensionskostnader\nNot 6 Övriga ränteintäkter\nNot 7 Räntekostnader",
          "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter",
          "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
          "Not 15 Inventarier\nNot 16 Datorer\nNot 17 Förbättringsutgifter på annans fastighet",
          "Not 18 Andelar i koncernföretag\nNot 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav",
          "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder",
          "Not 28 Ställda säkerheter och eventualförpliktelser",
          "Page 32",
        ],
      }),
      generateId: () => "run-3",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "routing.confidence=high",
        "routing.mode=deterministic_only",
        "execution.profile=extractable_text_pdf",
        "locator.ai.skipped deterministic_routing_sufficient",
      ]),
    );
    expect(findMockUserInstructionV1("Stage: section locator.")).toBe("");
    const combinedInstruction = findMockUserInstructionV1(
      "Stage: combined extractable-text annual-report extraction.",
    );
    expect(combinedInstruction).toBe("");
    expect(findMockUserInstructionV1("Stage: financial statements extraction.")).toContain(
      "Analyze ONLY pages 15, 16",
    );
  });

  it("skips PDF statement and tax-note stages when no focused ranges are available", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_section_locator_v1",
          sections: {
            coreFacts: [ { startPage: 1, endPage: 2, confidence: 0.9 } ],
            incomeStatement: [],
            balanceSheet: [],
            taxExpense: [],
            depreciationAndAssets: [],
            reserves: [],
            financeAndInterest: [],
            pensionsAndLeasing: [],
            groupContributionsAndShareholdings: [],
          },
          documentWarnings: [],
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_core_facts_v1",
          fields: {
            companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
            organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
            fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
            fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
            accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K2", normalizedValue: "K2" },
            profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "250", normalizedValue: 250 },
          },
          taxSignals: [],
          documentWarnings: [],
        },
      });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Förvaltningsberättelse",
      2: "Innehåll\nFörvaltningsberättelse 3\nUnderskrifter 32",
    }, 8);

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 8,
        pageTexts: [
          "Förvaltningsberättelse",
          "Innehåll\nFörvaltningsberättelse 3\nUnderskrifter 32",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
        ],
      }),
      generateId: () => "run-4",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(generateGeminiStructuredOutputMock).toHaveBeenCalledTimes(2);
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "execution.profile=extractable_text_pdf",
        "routing.mode=ai_fallback_only",
        "combined_extractable.skipped reason=required_stages_first_v1 text_chunks=0 text_chars=0",
        "combined_extractable.follow_up_required=1 statements=0 assets=0 finance=0",
      ]),
    );
  });

  it("overrides implausibly broad AI statement ranges with deterministic pages", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [{ startPage: 1, endPage: 3, confidence: 0.9 }],
              incomeStatement: [{ startPage: 12, endPage: 20, confidence: 0.5 }],
              balanceSheet: [{ startPage: 21, endPage: 26, confidence: 0.5 }],
              taxExpense: [],
              depreciationAndAssets: [],
              reserves: [],
              financeAndInterest: [],
              pensionsAndLeasing: [],
              groupContributionsAndShareholdings: [],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      2: "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nUpplysningar till enskilda poster 24-31",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      24: "Not 3 Leasingavtal",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Page 1",
          "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nUpplysningar till enskilda poster 24-31",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning",
          "Balansräkning",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Page 20",
          "Page 21",
          "Page 22",
          "Page 23",
          "Not 3 Leasingavtal",
          "Page 25",
          "Page 26",
          "Page 27",
          "Page 28",
          "Page 29",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-5",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "routing.mode=deterministic_only",
        "locator.ai.skipped deterministic_routing_sufficient",
      ]),
    );
    expect(findMockUserInstructionV1("Stage: section locator.")).toBe("");
    const combinedInstruction = findMockUserInstructionV1(
      "Stage: combined extractable-text annual-report extraction.",
    );
    expect(findMockUserInstructionV1("Stage: financial statements extraction.")).toContain(
      "Analyze ONLY pages 15, 16",
    );
    expect(combinedInstruction).toBe("");
  });

  it("falls back to deterministic core-facts pages and passes seeded hints to the AI stage", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [],
              incomeStatement: [{ startPage: 15, endPage: 15, confidence: 0.9 }],
              balanceSheet: [{ startPage: 16, endPage: 17, confidence: 0.9 }],
              taxExpense: [],
              depreciationAndAssets: [],
              reserves: [],
              financeAndInterest: [],
              pensionsAndLeasing: [],
              groupContributionsAndShareholdings: [],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "545286", normalizedValue: 545286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Acme AB\n556677-8899\nÅrsredovisning",
      2: "Räkenskapsår 2024-06-01 - 2025-05-31\nK3",
      3: "Förvaltningsberättelse",
      15: "Resultaträkning\nResultat före skatt 545286",
      16: "Balansräkning",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Acme AB\n556677-8899\nÅrsredovisning",
          "Räkenskapsår 2024-06-01 - 2025-05-31\nK3",
          "Förvaltningsberättelse",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning\nResultat före skatt 545286",
          "Balansräkning",
          "Page 17",
          "Page 18",
          "Page 19",
          "Page 20",
          "Page 21",
          "Page 22",
          "Page 23",
          "Page 24",
          "Page 25",
          "Page 26",
          "Page 27",
          "Page 28",
          "Page 29",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-6",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "locator.ai.core_facts_ranges=0",
        "locator.fallback.core_facts_ranges=pages 1-4",
        "routing.core_facts.selected=pages 1-4 source=deterministic",
        "routing.mode=deterministic_only",
        "execution.runtime_mode=ai_overdrive",
        "core_facts.input=text",
        "core_facts.chunking=ai_overdrive_statement_context",
        "seed.organization_number=hit",
        "seed.accounting_standard=hit",
        "seed.fiscal_year=hit",
      ]),
    );
    expect(findMockUserInstructionV1("Stage: section locator.")).toBe("");
    const coreFactsInstruction = findMockUserInstructionV1(
      "Stage: core facts extraction.",
    );
    expect(coreFactsInstruction).toContain("Analyze ONLY pages 1-4, 15-16");
    expect(coreFactsInstruction).toContain("organizationNumber=556677-8899");
    expect(coreFactsInstruction).toContain("accountingStandard=K3");
    expect(coreFactsInstruction).toContain("Document text:");
    expect(coreFactsInstruction).not.toContain("Page 32");
  });

  it("keeps compact core facts on a single-shot text request without text chunking", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "553286", normalizedValue: 553286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }

      return {
        ok: true,
        model: "qwen-plus",
        output: createCombinedExtractionOutputV1(),
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
      2: "Räkenskapsår 2024-06-01 - 2025-05-31\nK3",
      3: "Förvaltningsberättelse",
      15: "Resultaträkning\nResultat före skatt 553286",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
          "Räkenskapsår 2024-06-01 - 2025-05-31\nK3",
          "Förvaltningsberättelse",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning\nResultat före skatt 553286",
          "Balansräkning",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Page 20",
          "Page 21",
          "Page 22",
          "Page 23",
          "Page 24",
          "Page 25",
          "Page 26",
          "Page 27",
          "Page 28",
          "Page 29",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-core-facts-single-shot",
      generatedAt: "2026-03-10T09:20:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "core_facts.primary_request_timeout_ms=30000",
        "core_facts.retry_request_timeout_ms=35000",
        "core_facts.stage_budget_ms=60000",
        "core_facts.chunking=disabled_compact_text_single_shot",
      ]),
    );
    expect(
      result.extraction.documentWarnings.some((warning) =>
        warning.startsWith("chunking.core_facts.text_chunks="),
      ),
    ).toBe(false);
  });

  it("skips combined extractable extraction when the routed text is too large and goes straight to targeted stages", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "needs_review", confidence: 0.4 },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "553286", normalizedValue: 553286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [{ code: "profit_before_tax", label: "Resultat före skatt", currentYearValue: 553286 }],
              balanceSheet: [{ code: "cash", label: "Kassa och bank", currentYearValue: 200 }],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "force targeted statements test path",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: ["Current tax disclosed"], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: ["Räntekostnader disclosed"], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning";
      if (page === 2) return "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K2\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultaträkning\nResultat före skatt 553286";
      if (page === 16) return "Balansräkning";
      if (page === 17) return "Balansräkning, forts.";
      if (page === 20) return `Bokslutskommentarer\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 21) return `Not 3 Leasingavtal\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 22) return `Not 5 Pensionskostnader\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 23) return `Not 6 Övriga ränteintäkter\nNot 7 Räntekostnader\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 24) return `Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 25) return `Not 10 Hyresrätter\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 26) return `Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 27) return `Not 15 Inventarier\nNot 16 Datorer\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 28) return `Not 17 Förbättringsutgifter på annans fastighet\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 29) return `Not 18 Andelar i koncernföretag\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 30) return `Not 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 31) return `Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder\n${"Lorem ipsum ".repeat(250)}`;
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
      2: "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K2\nInnehåll",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      20: "Bokslutskommentarer",
      21: "Not 3 Leasingavtal",
      22: "Not 5 Pensionskostnader",
      23: "Not 6 Övriga ränteintäkter\nNot 7 Räntekostnader",
      24: "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat",
      25: "Not 10 Hyresrätter",
      26: "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
      27: "Not 15 Inventarier\nNot 16 Datorer",
      28: "Not 17 Förbättringsutgifter på annans fastighet",
      29: "Not 18 Andelar i koncernföretag",
      30: "Not 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav",
      31: "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-skip-combined",
      generatedAt: "2026-03-10T09:45:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "combined_extractable.primary_request_timeout_ms=30000",
        "combined_extractable.retry_request_timeout_ms=45000",
        "combined_extractable.stage_budget_ms=120000",
        "combined_extractable.minimum_retry_budget_ms=16000",
        "statements.primary_request_timeout_ms=40000",
        "statements.retry_request_timeout_ms=65000",
        "statements.stage_budget_ms=135000",
        "statements.minimum_retry_budget_ms=20000",
        "tax_notes_assets.primary_request_timeout_ms=30000",
        "tax_notes_assets.retry_request_timeout_ms=45000",
        "tax_notes_assets.stage_budget_ms=90000",
        "tax_notes_assets.minimum_retry_budget_ms=18000",
        "tax_notes_finance.primary_request_timeout_ms=30000",
        "tax_notes_finance.retry_request_timeout_ms=45000",
        "tax_notes_finance.stage_budget_ms=90000",
        "tax_notes_finance.minimum_retry_budget_ms=18000",
        expect.stringContaining("combined_extractable.skipped reason="),
        "combined_extractable.follow_up_required=1 statements=1 assets=1 finance=1",
        "fallback.core_facts.accountingStandard=seeded_from_deterministic_text",
      ]),
    );
    expect(result.extraction.fields.accountingStandard).toMatchObject({
      status: "extracted",
      normalizedValue: "K2",
      valueText: "K2",
    });
    expect(findMockUserInstructionV1("Stage: combined extractable-text annual-report extraction.")).toBe("");
    expect(findMockUserInstructionV1("Stage: financial statements extraction.")).toContain("Analyze ONLY pages 15, 16");
  });

  it("keeps overdrive on targeted stages when extractable routed text would require multiple combined chunks", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [{ startPage: 1, endPage: 4, confidence: 0.9 }],
              incomeStatement: [{ startPage: 15, endPage: 15, confidence: 0.9 }],
              balanceSheet: [{ startPage: 16, endPage: 17, confidence: 0.9 }],
              taxExpense: [{ startPage: 24, endPage: 24, confidence: 0.8 }],
              depreciationAndAssets: [{ startPage: 26, endPage: 28, confidence: 0.8 }],
              reserves: [{ startPage: 24, endPage: 24, confidence: 0.8 }],
              financeAndInterest: [{ startPage: 29, endPage: 31, confidence: 0.8 }],
              pensionsAndLeasing: [{ startPage: 21, endPage: 23, confidence: 0.8 }],
              groupContributionsAndShareholdings: [],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "needs_review", confidence: 0.4 },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "553286", normalizedValue: 553286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [{ code: "profit_before_tax", label: "Resultat fore skatt", currentYearValue: 553286 }],
              balanceSheet: [{ code: "cash", label: "Kassa och bank", currentYearValue: 200 }],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: ["Current tax disclosed"], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: ["Rantekostnader disclosed"], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2024-06-01 - 2025-05-31\nUpprattad enligt regelverk: K2\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 553286";
      if (page === 16) return "Balansrakning";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 20) return `Bokslutskommentarer\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 21) return `Not 3 Leasingavtal\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 22) return `Not 5 Pensionskostnader\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 23) return `Not 6 Ovriga ranteintakter\nNot 7 Rantekostnader\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 24) return `Not 8 Bokslutsdispositioner\nNot 9 Skatt pa arets resultat\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 25) return `Not 10 Hyresratter\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 26) return `Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 27) return `Not 15 Inventarier\nNot 16 Datorer\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 28) return `Not 17 Forbattringsutgifter pa annans fastighet\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 29) return `Not 18 Andelar i koncernforetag\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 30) return `Not 19 Andelar i intresseforetag\nNot 20 Andra langfristiga vardepappersinnehav\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 31) return `Not 22 Kassa och bank\nNot 24 Ovriga langfristiga skulder\n${"Lorem ipsum ".repeat(250)}`;
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB\nOrg.nr 556271-5309\nArsredovisning",
      2: "Rakenskapsar 2024-06-01 - 2025-05-31\nUpprattad enligt regelverk: K2\nInnehall",
      15: "Resultatrakning",
      16: "Balansrakning",
      17: "Balansrakning, forts.",
      20: "Bokslutskommentarer",
      21: "Not 3 Leasingavtal",
      22: "Not 5 Pensionskostnader",
      23: "Not 6 Ovriga ranteintakter\nNot 7 Rantekostnader",
      24: "Not 8 Bokslutsdispositioner\nNot 9 Skatt pa arets resultat",
      25: "Not 10 Hyresratter",
      26: "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
      27: "Not 15 Inventarier\nNot 16 Datorer",
      28: "Not 17 Forbattringsutgifter pa annans fastighet",
      29: "Not 18 Andelar i koncernforetag",
      30: "Not 19 Andelar i intresseforetag\nNot 20 Andra langfristiga vardepappersinnehav",
      31: "Not 22 Kassa och bank\nNot 24 Ovriga langfristiga skulder",
    });
    const onProgress = vi.fn(async () => {});

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-overdrive-skip-combined",
      generatedAt: "2026-03-11T09:45:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
      onProgress,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "execution.runtime_mode=ai_overdrive",
        "combined_extractable.primary_request_timeout_ms=60000",
        "combined_extractable.retry_request_timeout_ms=90000",
        "combined_extractable.stage_budget_ms=180000",
        "combined_extractable.minimum_retry_budget_ms=20000",
        expect.stringContaining("combined_extractable.skipped reason=chunk_count_exceeded"),
        expect.stringContaining("combined_extractable.follow_up_required=1"),
      ]),
    );
    expect(findMockUserInstructionV1("Stage: combined extractable-text annual-report extraction.")).toBe("");
    expect(onProgress).toHaveBeenCalledWith(
      "extracting_statements",
      expect.arrayContaining([
        "progress.stage=extracting_required_financial_data",
      ]),
    );
  });

  it("uses overdrive mode to keep the combined stage and broaden core-facts AI context", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [{ startPage: 1, endPage: 4, confidence: 0.9 }],
              incomeStatement: [{ startPage: 15, endPage: 15, confidence: 0.9 }],
              balanceSheet: [{ startPage: 16, endPage: 17, confidence: 0.9 }],
              taxExpense: [{ startPage: 24, endPage: 24, confidence: 0.8 }],
              depreciationAndAssets: [{ startPage: 26, endPage: 28, confidence: 0.8 }],
              reserves: [{ startPage: 24, endPage: 24, confidence: 0.8 }],
              financeAndInterest: [{ startPage: 29, endPage: 31, confidence: 0.8 }],
              pensionsAndLeasing: [],
              groupContributionsAndShareholdings: [],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "545286", normalizedValue: 545286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: createCombinedExtractionOutputV1({
            incomeStatement: [
              { code: "profit_before_tax", label: "Resultat före skatt", currentYearValue: 545286 },
            ],
            reserveNotes: ["Untaxed reserves disclosed"],
            taxExpenseNotes: ["Current tax disclosed"],
          }),
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                { code: "profit_before_tax", label: "Resultat före skatt", currentYearValue: 545286 },
              ],
              balanceSheet: [
                { code: "cash", label: "Kassa och bank", currentYearValue: 200 },
              ],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: ["Untaxed reserves disclosed"], evidence: [] },
            taxExpenseContext: { notes: ["Current tax disclosed"], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-max",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: ["Räntekostnader disclosed"], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for overdrive test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning";
      if (page === 2) return "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17";
      if (page === 15) return `Resultaträkning\nResultat före skatt 545 286 771 473\n${"Lorem ipsum ".repeat(220)}`;
      if (page === 16) return `Balansräkning\n${"Lorem ipsum ".repeat(220)}`;
      if (page === 17) return `Balansräkning, forts.\n${"Lorem ipsum ".repeat(220)}`;
      if (page >= 24 && page <= 31) return `Not ${page}\n${"Lorem ipsum ".repeat(220)}`;
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
      2: "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K3\nInnehåll",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      24: "Not 8 Bokslutsdispositioner",
      25: "Not 10 Hyresrätter",
      26: "Not 11 Goodwill",
      27: "Not 15 Inventarier",
      28: "Not 17 Förbättringsutgifter på annans fastighet",
      29: "Not 18 Andelar i koncernföretag",
      30: "Not 19 Andelar i intresseföretag",
      31: "Not 22 Kassa och bank",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-ai-overdrive",
      generatedAt: "2026-03-10T10:15:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "execution.runtime_mode=ai_overdrive",
        "core_facts.chunking=ai_overdrive_statement_context",
        "combined_extractable.primary_request_timeout_ms=60000",
        "combined_extractable.retry_request_timeout_ms=90000",
        "combined_extractable.stage_budget_ms=180000",
        "combined_extractable.minimum_retry_budget_ms=20000",
      ]),
    );
    expect(
      result.extraction.documentWarnings.some((warning) =>
        warning.startsWith("combined_extractable.skipped reason="),
      ),
    ).toBe(false);
    expect(findMockUserInstructionV1("Stage: core facts extraction.")).toContain("Analyze ONLY pages 1-4, 15-17");
    expect(findMockUserInstructionV1("Stage: combined extractable-text annual-report extraction.")).toContain("Analyze ONLY pages 15, 16, 17");
    expect(
      generateGeminiStructuredOutputMock.mock.calls.every(
        (call) => call[0]?.request?.modelTier === "thinking",
      ),
    ).toBe(true);
  });

  it("uses AI locator as fallback when deterministic PDF routing is low-confidence", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_section_locator_v1",
          sections: {
            coreFacts: [{ startPage: 1, endPage: 2, confidence: 0.9 }],
            incomeStatement: [{ startPage: 5, endPage: 5, confidence: 0.8 }],
            balanceSheet: [{ startPage: 6, endPage: 6, confidence: 0.8 }],
            taxExpense: [],
            depreciationAndAssets: [],
            reserves: [],
            financeAndInterest: [],
            pensionsAndLeasing: [],
            groupContributionsAndShareholdings: [],
          },
          documentWarnings: [],
          evidence: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_core_facts_v1",
          fields: {
            companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
            organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
            fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
            fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
            accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
            profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
          },
          taxSignals: [],
          documentWarnings: [],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        model: "qwen-plus",
        output: createCombinedExtractionOutputV1(),
      });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Acme AB\n556677-8899\nÅrsredovisning\nRäkenskapsår 2025-01-01 - 2025-12-31\nK3",
      2: "Förvaltningsberättelse\nStyrelsen avger härmed årsredovisning för verksamhetsåret.",
      5: "Page 5",
      6: "Page 6",
    }, 8);
    const onProgress = vi.fn(async () => {});

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 8,
        pageTexts: [
          "Acme AB\n556677-8899\nÅrsredovisning\nRäkenskapsår 2025-01-01 - 2025-12-31\nK3",
          "Förvaltningsberättelse\nStyrelsen avger härmed årsredovisning för verksamhetsåret.",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
        ],
      }),
      generateId: () => "run-7",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      onProgress,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "routing.mode=ai_fallback_only",
        "execution.profile=extractable_text_pdf",
        "core_facts.input=compact_text",
        expect.stringMatching(/^core_facts\.compact_chars=\d+$/),
      ]),
    );
    expect(findMockUserInstructionV1("Stage: section locator.")).toContain(
      "Stage: section locator.",
    );
    expect(onProgress).toHaveBeenCalledWith(
      "locating_sections",
      expect.arrayContaining([
        "progress.stage=routing_document",
        "progress.routing.mode=ai_fallback_only",
        "progress.routing.confidence=low",
      ]),
    );
  });

  it("retries combined extractable-text extraction on the fast model before any escalation", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    let combinedAttempts = 0;
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        combinedAttempts += 1;
        if (combinedAttempts === 1) {
          return {
            ok: false,
            error: {
              code: "MODEL_EXECUTION_FAILED",
              message: "Qwen request timed out after 5000ms.",
              context: {},
            },
          };
        }
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                {
                  code: "profit_before_tax",
                  label: "Resultat före skatt",
                  currentYearValue: 500,
                },
              ],
              balanceSheet: [
                { code: "cash", label: "Kassa och bank", currentYearValue: 200 },
              ],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      return {
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_section_locator_v1",
          sections: {
            coreFacts: [],
            incomeStatement: [],
            balanceSheet: [],
            taxExpense: [],
            depreciationAndAssets: [],
            reserves: [],
            financeAndInterest: [],
            pensionsAndLeasing: [],
            groupContributionsAndShareholdings: [],
          },
          documentWarnings: [],
          evidence: [],
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Acme AB\n556677-8899\nÅrsredovisning",
      2: "Räkenskapsår 2025-01-01 - 2025-12-31\nK3",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Acme AB\n556677-8899\nÅrsredovisning",
          "Räkenskapsår 2025-01-01 - 2025-12-31\nK3",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning",
          "Balansräkning",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Page 20",
          "Page 21",
          "Page 22",
          "Page 23",
          "Page 24",
          "Page 25",
          "Page 26",
          "Page 27",
          "Page 28",
          "Page 29",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-8",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    const combinedCalls = generateGeminiStructuredOutputMock.mock.calls.filter((call) =>
      String(call?.[0]?.request?.userInstruction ?? "").includes(
        "Stage: combined extractable-text annual-report extraction.",
      ),
    );
    expect(combinedCalls.length).toBeGreaterThanOrEqual(2);
    expect(combinedCalls[0]?.[0]?.request?.modelTier).toBe("thinking");
    expect(combinedCalls[0]?.[0]?.request?.timeoutMs).toBe(60000);
    expect(combinedCalls[0]?.[0]?.request?.useResponseJsonSchema).toBe(false);
    for (const retryCall of combinedCalls.slice(1)) {
      expect(retryCall?.[0]?.request?.modelTier).toBe("thinking");
      expect(retryCall?.[0]?.request?.timeoutMs).toBe(90000);
      expect(retryCall?.[0]?.request?.useResponseJsonSchema).toBe(false);
    }
  });

  it("overrides broad AI note ranges with deterministic grouped note windows", () => {
    const sourceText = parseAnnualReportSourceTextV1({
      schemaVersion: "annual_report_source_text_v1",
      fileType: "pdf",
      text: [
        "Page 1",
        "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
        "Page 3",
        "Page 4",
        "Page 5",
        "Page 6",
        "Page 7",
        "Page 8",
        "Page 9",
        "Page 10",
        "Page 11",
        "Page 12",
        "Page 13",
        "Page 14",
        "Resultaträkning",
        "Balansräkning",
        "Balansräkning, forts.",
        "Page 18",
        "Page 19",
        "Bokslutskommentarer",
        "Page 21",
        "Page 22",
        "Page 23",
        "Not 3 Leasingavtal",
        "Not 5 Pensionskostnader\nNot 6 Övriga ränteintäkter\nNot 7 Räntekostnader",
        "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter",
        "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
        "Not 15 Inventarier\nNot 16 Datorer\nNot 17 Förbättringsutgifter på annans fastighet",
        "Not 18 Andelar i koncernföretag\nNot 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav",
        "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder",
        "Not 28 Ställda säkerheter och eventualförpliktelser",
      ].join("\n\n"),
      pageCount: 32,
      textSource: "pdf_unpdf_text",
      parserVersion: "annual-report-source-text.v1/test",
      pdfAnalysis: {
        classification: "extractable_text_pdf",
        averageCharsPerPage: 100,
        nonEmptyPageCount: 32,
        nonEmptyPageRatio: 1,
        totalExtractedChars: 3200,
      },
      warnings: [],
      pageTexts: [
        "Page 1",
        "Innehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
        "Page 3",
        "Page 4",
        "Page 5",
        "Page 6",
        "Page 7",
        "Page 8",
        "Page 9",
        "Page 10",
        "Page 11",
        "Page 12",
        "Page 13",
        "Page 14",
        "Resultaträkning",
        "Balansräkning",
        "Balansräkning, forts.",
        "Page 18",
        "Page 19",
        "Bokslutskommentarer",
        "Page 21",
        "Page 22",
        "Page 23",
        "Not 3 Leasingavtal",
        "Not 5 Pensionskostnader\nNot 6 Övriga ränteintäkter\nNot 7 Räntekostnader",
        "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter",
        "Not 11 Goodwill\nNot 12 Programvaror\nNot 14 Byggnader och mark",
        "Not 15 Inventarier\nNot 16 Datorer\nNot 17 Förbättringsutgifter på annans fastighet",
        "Not 18 Andelar i koncernföretag\nNot 19 Andelar i intresseföretag\nNot 20 Andra långfristiga värdepappersinnehav",
        "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder",
        "Not 28 Ställda säkerheter och eventualförpliktelser",
      ],
    });

    const resolved = resolveAnnualReportPdfLocatorSectionsV1({
      sourceText,
      aiSections: {
        coreFacts: [],
        incomeStatement: [],
        balanceSheet: [],
        taxExpense: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
        depreciationAndAssets: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
        reserves: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
        financeAndInterest: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
        pensionsAndLeasing: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
        groupContributionsAndShareholdings: [{ startPage: 20, endPage: 31, confidence: 0.4 }],
      },
    });

    expect(resolved.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("routing.tax_notes.ai_implausible="),
        expect.stringContaining("routing.tax_notes_assets.selected=pages"),
        expect.stringContaining("routing.tax_notes_finance.selected=pages"),
      ]),
    );
    expect(resolved.executionRanges.taxNotesAssets.length).toBeLessThanOrEqual(2);
    expect(resolved.executionRanges.taxNotesFinance.length).toBeLessThanOrEqual(2);
    expect(
      resolved.warnings.some((warning) => warning === "routing.tax_notes_assets.final=pages 20-31"),
    ).toBe(false);
    expect(
      resolved.warnings.some((warning) => warning === "routing.tax_notes_finance.final=pages 20-31"),
    ).toBe(false);
  });

  it("reports the larger extractable-text total budget during routing progress", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const onProgress = vi.fn(async () => {});
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Acme AB\n556677-8899\nÅrsredovisning",
      2: "Räkenskapsår 2025-01-01 - 2025-12-31\nK3",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      26: "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat",
      29: "Not 18 Andelar i koncernföretag",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Acme AB\n556677-8899\nÅrsredovisning",
          "Räkenskapsår 2025-01-01 - 2025-12-31\nK3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning",
          "Balansräkning",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Bokslutskommentarer",
          "Page 21",
          "Page 22",
          "Page 23",
          "Not 3 Leasingavtal",
          "Page 25",
          "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat",
          "Page 27",
          "Page 28",
          "Not 18 Andelar i koncernföretag",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-9",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      onProgress,
    });

    expect(result.ok).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(
      "locating_sections",
      expect.arrayContaining([
        "progress.stage=routing_document",
        "progress.total_budget_ms=420000",
        "progress.execution.profile=extractable_text_pdf",
      ]),
    );
  });

  it("uses text-first statements and note stages for extractable PDFs with separate request budgets", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Acme AB\n556677-8899\nÅrsredovisning",
      2: "Räkenskapsår 2025-01-01 - 2025-12-31\nK3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
      15: "Resultaträkning\nNettoomsättning 1000",
      16: "Balansräkning\nKassa och bank 200",
      17: "Balansräkning, forts.",
      26: "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat",
      29: "Not 18 Andelar i koncernföretag",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        pdfBytes,
        pageCount: 32,
        pageTexts: [
          "Acme AB\n556677-8899\nÅrsredovisning",
          "Räkenskapsår 2025-01-01 - 2025-12-31\nK3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31",
          "Page 3",
          "Page 4",
          "Page 5",
          "Page 6",
          "Page 7",
          "Page 8",
          "Page 9",
          "Page 10",
          "Page 11",
          "Page 12",
          "Page 13",
          "Page 14",
          "Resultaträkning\nNettoomsättning 1000",
          "Balansräkning\nKassa och bank 200",
          "Balansräkning, forts.",
          "Page 18",
          "Page 19",
          "Bokslutskommentarer",
          "Page 21",
          "Page 22",
          "Page 23",
          "Not 3 Leasingavtal",
          "Page 25",
          "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat",
          "Page 27",
          "Page 28",
          "Not 18 Andelar i koncernföretag",
          "Page 30",
          "Page 31",
          "Page 32",
        ],
      }),
      generateId: () => "run-10",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "combined_extractable.input=text",
        "tax_notes_assets.input=pdf",
        "tax_notes_finance.input=text",
        "tax_notes_finance.fallback_input=pdf",
        "combined_extractable.primary_request_timeout_ms=30000",
        "combined_extractable.retry_request_timeout_ms=45000",
        "combined_extractable.stage_budget_ms=120000",
        "combined_extractable.minimum_retry_budget_ms=16000",
        "statements.primary_request_timeout_ms=40000",
        "statements.retry_request_timeout_ms=65000",
        "statements.stage_budget_ms=135000",
        "statements.minimum_retry_budget_ms=20000",
        "tax_notes_assets.primary_request_timeout_ms=30000",
        "tax_notes_assets.retry_request_timeout_ms=45000",
        "tax_notes_assets.stage_budget_ms=90000",
        "tax_notes_assets.minimum_retry_budget_ms=18000",
        "tax_notes_finance.primary_request_timeout_ms=30000",
        "tax_notes_finance.retry_request_timeout_ms=45000",
        "tax_notes_finance.stage_budget_ms=90000",
        "tax_notes_finance.minimum_retry_budget_ms=18000",
        "schema_mode.combined_extractable=json_text_validation",
        "schema_mode.statements=json_text_validation",
        "schema_mode.tax_notes_assets=json_text_validation",
        "schema_mode.tax_notes_finance=json_text_validation",
        expect.stringContaining(
          "combined_extractable.skipped reason=required_stages_first_v1",
        ),
        "combined_extractable.follow_up_required=1 statements=1 assets=1 finance=1",
      ]),
    );

    const combinedCall = generateGeminiStructuredOutputMock.mock.calls.find((call) =>
      String(call?.[0]?.request?.userInstruction ?? "").includes(
        "Stage: combined extractable-text annual-report extraction.",
      ),
    );
    expect(combinedCall).toBeUndefined();
  });

  it("retries finance-note extraction on routed pdf only when the text-first result is unusable", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    const financeAttemptInputs: string[] = [];
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      const usesDocuments =
        Array.isArray(input?.request?.documents) &&
        input.request.documents.length > 0;

      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: {
                status: "extracted",
                confidence: 0.99,
                valueText: "Deloitte AB",
              },
              organizationNumber: {
                status: "extracted",
                confidence: 0.99,
                valueText: "556271-5309",
              },
              fiscalYearStart: {
                status: "extracted",
                confidence: 0.99,
                valueText: "2024-06-01",
                normalizedValue: "2024-06-01",
              },
              fiscalYearEnd: {
                status: "extracted",
                confidence: 0.99,
                valueText: "2025-05-31",
                normalizedValue: "2025-05-31",
              },
              accountingStandard: {
                status: "extracted",
                confidence: 0.99,
                valueText: "K3",
                normalizedValue: "K3",
              },
              profitBeforeTax: {
                status: "extracted",
                confidence: 0.99,
                valueText: "545286",
                normalizedValue: 545286,
              },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                {
                  code: "profit_before_tax",
                  label: "Resultat före skatt",
                  currentYearValue: 545286,
                },
              ],
              balanceSheet: [
                {
                  code: "cash",
                  label: "Kassa och bank",
                  currentYearValue: 200,
                },
              ],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (
        userInstruction.includes(
          "Stage: combined extractable-text annual-report extraction.",
        )
      ) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "force targeted statements test path",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: ["Current tax disclosed"], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        financeAttemptInputs.push(usesDocuments ? "pdf" : "text");
        return {
          ok: true,
          model: usesDocuments ? "qwen-max" : "qwen-plus",
          output: usesDocuments
            ? {
                schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
                netInterestContext: {
                  notes: ["Räntekostnader disclosed"],
                  evidence: [],
                },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: { flags: [], notes: [], evidence: [] },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                evidence: [],
              }
            : {
                schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
                netInterestContext: { notes: [], evidence: [] },
                pensionContext: { flags: [], notes: [], evidence: [] },
                leasingContext: { flags: [], notes: [], evidence: [] },
                groupContributionContext: { flags: [], notes: [], evidence: [] },
                shareholdingContext: { flags: [], notes: [], evidence: [] },
                evidence: [],
              },
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning";
      if (page === 2)
        return "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultaträkning\nResultat före skatt 545286";
      if (page === 16) return "Balansräkning";
      if (page === 17) return "Balansräkning, forts.";
      if (page === 20) return `Bokslutskommentarer\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 21) return `Not 3 Leasingavtal\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 22) return `Not 5 Pensionskostnader\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 24) return `Not 6 Ränteposter\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 29)
        return `Not 18 Andelar i koncernföretag\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 30) return `Not 19 Närstående\n${"Lorem ipsum ".repeat(250)}`;
      return `Page ${page}`;
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB",
      2: "Innehåll",
      15: "Resultaträkning",
      16: "Balansräkning",
      17: "Balansräkning, forts.",
      20: "Bokslutskommentarer",
      21: "Not 3 Leasingavtal",
      22: "Not 5 Pensionskostnader",
      24: "Not 6 Ränteposter",
      29: "Not 18 Andelar i koncernföretag",
      30: "Not 19 Närstående",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-finance-retry",
      generatedAt: "2026-03-12T18:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(financeAttemptInputs.length).toBeGreaterThanOrEqual(2);
    expect(financeAttemptInputs).toContain("text");
    expect(financeAttemptInputs).toContain("pdf");
    const firstPdfAttemptIndex = financeAttemptInputs.indexOf("pdf");
    expect(firstPdfAttemptIndex).toBeGreaterThan(0);
    expect(
      financeAttemptInputs.slice(0, firstPdfAttemptIndex).every((value) => value === "text"),
    ).toBe(true);
    expect(
      financeAttemptInputs.slice(firstPdfAttemptIndex).every((value) => value === "pdf"),
    ).toBe(true);
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "tax_notes_finance.input=text",
        "tax_notes_finance.fallback_input=pdf",
        "tax_notes_finance.pdf_fallback reason=text_output_unusable",
      ]),
    );
    expect(
      result.extraction.documentWarnings.some((warning) =>
        warning.startsWith("degraded.tax_notes_finance.unavailable:"),
      ),
    ).toBe(false);
    expect(result.extraction.taxDeep.netInterestContext.notes).toEqual([
      "Räntekostnader disclosed",
    ]);

    const financeInstruction = findMockUserInstructionV1(
      "Stage: tax notes (finance & other).",
    );
    expect(financeInstruction).not.toContain("taxExpenseContext");
  });

  it("keeps targeted asset-note follow-up for extractable PDFs when combined extraction only returns structured tables", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_combined_text_extraction_v1",
            documentWarnings: [],
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                {
                  code: "profit_before_tax",
                  label: "Resultat fore skatt",
                  currentYearValue: 500,
                },
              ],
              balanceSheet: [
                {
                  code: "cash",
                  label: "Kassa och bank",
                  currentYearValue: 200,
                },
              ],
            },
            priorYearComparatives: [],
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: {
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
            },
            reserveContext: { movements: [], notes: [], evidence: [] },
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            taxExpenseContext: {
              currentTax: {
                value: 116885,
                evidence: [{ snippet: "Aktuell skatt 116 885", page: 26 }],
              },
              notes: [],
              evidence: [],
            },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: {
              notes: [
                "Aktuell skatt, uppskjuten skatt och skatteeffekt av ej avdragsgilla kostnader framgar av not 9.",
              ],
              evidence: [{ snippet: "Not 9 Skatt pa arets resultat", page: 26 }],
            },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: {
              flags: [],
              notes: [
                "Andelar i koncernforetag och utdelningar ska foljas upp i skatteanalysen.",
              ],
              evidence: [{ snippet: "Not 18 Andelar i koncernforetag", page: 29 }],
            },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nNot 9 Skatt pa arets resultat 26\nNot 12 Programvaror 27\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nProgramvaror 12 49 004 33 174\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 24) return "Not 3 Leasingavtal";
      if (page === 26) return "Not 8 Bokslutsdispositioner\nNot 9 Skatt pa arets resultat";
      if (page === 27) return "Not 12 Programvaror\nNot 14 Byggnader och mark";
      if (page === 28) return "Not 15 Inventarier\nNot 17 Forbattringsutgifter pa annans fastighet";
      if (page === 29) return "Not 18 Andelar i koncernforetag";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      24: pageTexts[23]!,
      26: pageTexts[25]!,
      27: pageTexts[26]!,
      28: pageTexts[27]!,
      29: pageTexts[28]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-combined-plus-targeted-notes",
      generatedAt: "2026-03-12T09:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.assetMovements.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetArea: "Programvaror",
          closingCarryingAmount: 49004,
        }),
      ]),
    );
    expect(result.extraction.taxDeep.taxExpenseContext?.notes).toEqual(
      expect.arrayContaining([
        "Aktuell skatt, uppskjuten skatt och skatteeffekt av ej avdragsgilla kostnader framgar av not 9.",
      ]),
    );
    expect(result.extraction.taxDeep.shareholdingContext.notes).toEqual(
      expect.arrayContaining([
        "Andelar i koncernforetag och utdelningar ska foljas upp i skatteanalysen.",
      ]),
    );
    expect(findMockUserInstructionV1("Stage: tax notes (assets & reserves).")).toContain(
      "Prefer keeping narrative note coverage, not just numeric tables",
    );
  });

  it("skips both targeted note stages when combined extraction already covers asset and finance note content", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1({
            reserveNotes: ["Periodiseringsfond redovisas i not 8."],
            taxExpenseNotes: [
              "Aktuell skatt och skatteeffekt av ej avdragsgilla kostnader framgar av not 9.",
            ],
            netInterestNotes: ["Rantekostnader och ovriga ranteintakter framgar av not 7."],
            shareholdingNotes: ["Andelar i koncernforetag framgar av not 18."],
          }),
        };
      }
      if (userInstruction.includes("Stage: tax expense note extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_expense_note_v1",
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [],
            evidence: [],
          },
        };
      }
      if (
        userInstruction.includes("Stage: tax notes (assets & reserves).") ||
        userInstruction.includes("Stage: tax notes (finance & other).")
      ) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "targeted note stage should have been skipped",
            context: {},
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 25) return "Not 7 Rantekostnader\nNot 8 Bokslutsdispositioner";
      if (page === 26) return "Not 9 Skatt pa arets resultat";
      if (page === 29) return "Not 18 Andelar i koncernforetag";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      25: pageTexts[24]!,
      26: pageTexts[25]!,
      29: pageTexts[28]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-combined-skips-targeted-notes",
      generatedAt: "2026-03-12T11:30:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(findMockUserInstructionV1("Stage: tax notes (assets & reserves).")).toBe("");
    expect(findMockUserInstructionV1("Stage: tax notes (finance & other).")).toBe("");
    expect(result.extraction.documentWarnings).toContain(
      "combined_extractable.follow_up_required=0 statements=0 assets=0 finance=0",
    );
  });

  it("runs only finance-note follow-up when combined extraction already covered assets", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1({
            reserveNotes: ["Periodiseringsfond redovisas i not 8."],
            taxExpenseNotes: [
              "Aktuell skatt och skatteeffekt av ej avdragsgilla kostnader framgar av not 9.",
            ],
          }),
        };
      }
      if (userInstruction.includes("Stage: tax expense note extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_expense_note_v1",
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "asset follow-up should have been skipped",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: {
              notes: ["Rantekostnader ska foljas upp i skatteanalysen."],
              evidence: [{ snippet: "Not 7 Rantekostnader", page: 25 }],
            },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 25) return "Not 7 Rantekostnader";
      if (page === 26) return "Not 8 Bokslutsdispositioner\nNot 9 Skatt pa arets resultat";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      25: pageTexts[24]!,
      26: pageTexts[25]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-combined-finance-only-follow-up",
      generatedAt: "2026-03-12T12:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(findMockUserInstructionV1("Stage: tax notes (assets & reserves).")).toBe("");
    expect(findMockUserInstructionV1("Stage: tax notes (finance & other).")).toContain(
      "Stage: tax notes (finance & other).",
    );
    expect(result.extraction.documentWarnings).toContain(
      "combined_extractable.follow_up_required=1 statements=0 assets=0 finance=1",
    );
    expect(result.extraction.taxDeep.netInterestContext.notes).toEqual(
      expect.arrayContaining([
        "Rantekostnader ska foljas upp i skatteanalysen.",
      ]),
    );
  });

  it("stores and backfills relevant note summaries when note stages miss narrative text", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_combined_text_extraction_v1",
            documentWarnings: [],
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                {
                  code: "profit_before_tax",
                  label: "Resultat fore skatt",
                  currentYearValue: 500,
                },
              ],
              balanceSheet: [
                {
                  code: "cash",
                  label: "Kassa och bank",
                  currentYearValue: 200,
                },
              ],
            },
            priorYearComparatives: [],
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: {
              lines: [
                {
                  assetArea: "Programvaror",
                  closingCarryingAmount: 49004,
                  evidence: [{ snippet: "Programvaror 49 004", page: 27 }],
                },
              ],
              evidence: [{ snippet: "Not 12 Programvaror", page: 27 }],
            },
            reserveContext: { movements: [], notes: [], evidence: [] },
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            taxExpenseContext: {
              currentTax: {
                value: 116885,
                evidence: [{ snippet: "Aktuell skatt 116 885", page: 26 }],
              },
              notes: [],
              evidence: [],
            },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [
              {
                blockId: "not-9-26",
                category: "tax_expense",
                noteReference: "Not 9",
                title: "Skatt pa arets resultat",
                pages: [26],
                notes: [
                  "Aktuell skatt, uppskjuten skatt och skatteeffekt av ej avdragsgilla kostnader framgar av noten.",
                ],
                evidence: [{ snippet: "Not 9 Skatt pa arets resultat", page: 26 }],
              },
              {
                blockId: "not-12-26",
                category: "fixed_assets_depreciation",
                noteReference: "Not 12",
                title: "Programvaror",
                pages: [26],
                notes: ["Programvaror skrivs av med 10 procent per ar."],
                evidence: [{ snippet: "Programvaror skrivs av med 10% per ar.", page: 26 }],
              },
            ],
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nProgramvaror 12 49 004 33 174\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 26) return "Not 9 Skatt pa arets resultat\nAktuell skatt 116 885\nUppskjuten skatt -\nSkatteeffekt av ej avdragsgilla kostnader 4 667\nNot 12 Programvaror\nProgramvaror skrivs av med 10 procent per ar.";
      if (page === 27) return "Not 12 Programvaror\nProgramvaror skrivs av med 10 procent per ar.";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      26: pageTexts[25]!,
      27: pageTexts[26]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-relevant-notes",
      generatedAt: "2026-03-12T10:30:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.relevantNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "tax_expense",
          noteReference: "Not 9",
        }),
        expect.objectContaining({
          category: "fixed_assets_depreciation",
          noteReference: "Not 12",
        }),
      ]),
    );
    expect(result.extraction.taxDeep.taxExpenseContext?.notes).toEqual(
      expect.arrayContaining([
        "Aktuell skatt, uppskjuten skatt och skatteeffekt av ej avdragsgilla kostnader framgar av noten.",
      ]),
    );
    expect(result.extraction.taxDeep.depreciationContext.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          snippet: "Programvaror skrivs av med 10% per ar.",
          page: 26,
        }),
      ]),
    );
    expect(findMockUserInstructionV1("Stage: relevant tax-note locator.")).toContain(
      "[BlockId not-9-26]",
    );
  });

  it("drops uncategorized relevant notes and records an explicit warning instead of routing them to tax expense", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      if (userInstruction.includes("Stage: tax expense note extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_expense_note_v1",
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [
              {
                blockId: "not-44-25",
                noteReference: "Not 44",
                title: "Oklassificerad upplysning",
                pages: [25],
                notes: ["This note forgot to set a category."],
                evidence: [{ snippet: "Not 44 Oklassificerad upplysning", page: 25 }],
              },
            ],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 25) {
        return "Not 7 Rantekostnader\nRantekostnader framgar av not 7.\nNot 44 Oklassificerad upplysning\nDenna upplysning saknar relevant skattekategori.";
      }
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      25: pageTexts[24]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-invalid-relevant-note-category",
      generatedAt: "2026-03-12T12:30:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.relevantNotes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          noteReference: "Not 44",
        }),
      ]),
    );
    expect(result.extraction.taxDeep.taxExpenseContext?.notes ?? []).not.toContain(
      "This note forgot to set a category.",
    );
    expect(result.extraction.documentWarnings).toContain(
      "degraded.relevant_notes.invalid_category:block=not-44-25",
    );
  });

  it("does not duplicate note text into section contexts when targeted stages already supplied narrative coverage", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      if (userInstruction.includes("Stage: tax expense note extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_expense_note_v1",
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [
              {
                blockId: "not-7-25",
                category: "interest",
                noteReference: "Not 7",
                title: "Rantekostnader",
                pages: [25],
                notes: ["Rantekostnader framgar av not 7."],
                evidence: [{ snippet: "Not 7 Rantekostnader", page: 25 }],
              },
            ],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: {
              notes: ["Rantekostnader framgar av not 7."],
              evidence: [{ snippet: "Not 7 Rantekostnader", page: 25 }],
            },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 25) return "Not 7 Rantekostnader\nRantekostnader framgar av not 7.";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      25: pageTexts[24]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-no-duplicate-relevant-note-backfill",
      generatedAt: "2026-03-12T13:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.relevantNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "interest",
          noteReference: "Not 7",
        }),
      ]),
    );
    expect(result.extraction.taxDeep.netInterestContext.notes).toEqual([
      "Rantekostnader framgar av not 7.",
    ]);
    expect(result.extraction.taxDeep.netInterestContext.evidence).toEqual([
      expect.objectContaining({
        snippet: "Not 7 Rantekostnader",
        page: 25,
      }),
    ]);
  });

  it("uses the dedicated tax-expense note pass to recover current and deferred tax context", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      if (userInstruction.includes("Stage: tax expense note extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_expense_note_v1",
            taxExpenseContext: {
              currentTax: {
                value: 116885,
                evidence: [{ snippet: "Aktuell skatt 116 885", page: 26 }],
              },
              deferredTax: {
                value: 0,
                evidence: [{ snippet: "Uppskjuten skatt -", page: 26 }],
              },
              notes: [
                "Skatteeffekter av ej avdragsgilla kostnader och tidigare ars justeringar framgar av skattenoten.",
              ],
              evidence: [{ snippet: "Not 9 Skatt pa arets resultat", page: 26 }],
            },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: relevant tax-note locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_relevant_note_locator_v1",
            relevantNotes: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nNot 9 Skatt pa arets resultat 26\nNot 12 Programvaror 27\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nProgramvaror 12 49 004 33 174\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 26) return "Not 9 Skatt pa arets resultat\nAktuell skatt 116 885\nUppskjuten skatt -\nSkatteeffekt av ej avdragsgilla kostnader 4 667";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      26: pageTexts[25]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-tax-expense-note",
      generatedAt: "2026-03-12T11:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.taxExpenseContext).toMatchObject({
      currentTax: { value: 116885 },
      deferredTax: { value: 0 },
    });
    expect(result.extraction.taxDeep.taxExpenseContext?.notes).toEqual(
      expect.arrayContaining([
        "Skatteeffekter av ej avdragsgilla kostnader och tidigare ars justeringar framgar av skattenoten.",
      ]),
    );
    expect(findMockUserInstructionV1("Stage: tax expense note extraction.")).toContain(
      "[BlockId not-9-26]",
    );
  });

  it("keeps tax-note and fixed-asset note coverage when AI note enrichment times out", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Acme AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556677-8899" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2025-01-01", normalizedValue: "2025-01-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-12-31", normalizedValue: "2025-12-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "500", normalizedValue: 500 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      if (
        userInstruction.includes("Stage: tax expense note extraction.") ||
        userInstruction.includes("Stage: relevant tax-note locator.")
      ) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "Qwen request timed out after 15000ms.",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Acme AB\nOrg.nr 556677-8899\nArsredovisning";
      if (page === 2) return "Rakenskapsar 2025-01-01 - 2025-12-31\nK3\nInnehall\nResultatrakning 15\nBalansrakning 16-17\nBokslutskommentarer 20-23\nNot 9 Skatt pa arets resultat 26\nNot 12 Programvaror 27\nUpplysningar till enskilda poster 24-31";
      if (page === 15) return "Resultatrakning\nResultat fore skatt 500";
      if (page === 16) return "Balansrakning\nKassa och bank 200";
      if (page === 17) return "Balansrakning, forts.";
      if (page === 26) return "Not 9 Skatt pa arets resultat\nAktuell skatt 116 885\nUppskjuten skatt -\nSkatteeffekt av ej avdragsgilla kostnader 4 667\nArets redovisade skattekostnad 116 839\nNot 12 Programvaror\nProgramvaror skrivs av med 10 procent per ar.\nUtgaende planenligt restvarde 49 004";
      if (page === 27) return "Not 12 Programvaror\nProgramvaror skrivs av med 10 procent per ar.\nUtgaende planenligt restvarde 49 004";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      26: pageTexts[25]!,
      27: pageTexts[26]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-deterministic-note-fallback",
      generatedAt: "2026-03-12T15:45:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.taxExpenseContext).toMatchObject({
      currentTax: { value: 116885 },
      deferredTax: { value: 0 },
      totalTaxExpense: { value: 116839 },
    });
    expect(result.extraction.taxDeep.taxExpenseContext?.notes).toEqual(
      expect.arrayContaining([
        "Aktuell skatt 116 885",
        "Uppskjuten skatt -",
      ]),
    );
    expect(result.extraction.taxDeep.relevantNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "tax_expense",
          noteReference: "Not 9",
        }),
        expect.objectContaining({
          category: "fixed_assets_depreciation",
          noteReference: "Not 12",
        }),
      ]),
    );
    expect(result.extraction.taxDeep.depreciationContext.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          snippet: "Programvaror skrivs av med 10 procent per ar.",
          page: 26,
        }),
      ]),
    );
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("degraded.tax_expense_note.unavailable"),
        expect.stringContaining("degraded.relevant_notes.unavailable"),
      ]),
    );
  });

  it("skips statement AI follow-up in overdrive when deterministic extractable-PDF statements are already strong", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "545286", normalizedValue: 545286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "statement stage should have been skipped by deterministic rebuild",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: false,
          error: {
            code: "MODEL_EXECUTION_FAILED",
            message: "force targeted statements path",
            context: {},
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const page15 = [
      "Resultaträkning",
      "Belopp i KSEK",
      "Nettoomsättning 3 989 355 4 381 698",
      "Övriga rörelseintäkter 101 234 60 363",
      "Övriga externa kostnader -1 794 747 -2 112 102",
      "Personalkostnader -1 736 302 -1 678 844",
      "Resultat från andelar i koncernföretag - 137 828",
      "Övriga ränteintäkter och liknande resultatposter 12 924 9 873",
      "Räntekostnader och liknande resultatposter -2 477 -2 704",
      "Skatt på årets resultat -116 839 -137 161",
      "Årets resultat 428 447 634 313",
    ].join("\n");
    const page16 = [
      "Balansräkning",
      "Tillgångar",
      "Programvaror 49 004 33 174",
      "Byggnader och mark 115 117",
      "Inventarier 11 669 12 229",
      "Datorer 15 572 22 132",
      "Förbättringsutgifter på annans fastighet 21 212 -",
      "Andelar i koncernföretag 1 004 120",
      "Andelar i intresseföretag 126 126",
      "Andra långfristiga värdepappersinnehav 1 353 1 353",
      "Fordringar hos koncernföretag 53 742 51 265",
      "Kundfordringar 616 185 623 808",
      "Övriga fordringar 878 216",
      "Kassa och bank 301 521 504 292",
    ].join("\n");
    const page17 = [
      "Eget kapital och skulder",
      "Aktiekapital 3 387 3 387",
      "Reservfond 3 523 3 523",
      "Balanserat resultat 236 5",
      "Årets resultat 428 447 634 313",
      "Obeskattade reserver 8 000 -",
      "Övriga långfristiga skulder 37 429 -",
      "Leverantörsskulder 86 969 53 712",
      "Skulder till koncernföretag 159 102 202 329",
      "Övriga kortfristiga skulder 142 664 121 112",
      "Upplupna kostnader och förutbetalda intäkter 412 711 406 990",
    ].join("\n");

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning";
      if (page === 2) {
        return "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K3\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nNoter 20-31";
      }
      if (page === 15) return page15;
      if (page === 16) return page16;
      if (page === 17) return page17;
      if (page >= 20 && page <= 31) {
        return `Not ${page - 11}\n${"Lorem ipsum ".repeat(250)}`;
      }
      return `Page ${page}`;
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
      2: "Räkenskapsår 2024-06-01 - 2025-05-31\nUpprättad enligt regelverk: K3\nInnehåll",
      15: page15,
      16: page16,
      17: page17,
      20: "Not 9 Skatt på årets resultat",
      21: "Not 10 Programvaror",
      22: "Not 11 Byggnader och mark",
      23: "Not 12 Inventarier",
      24: "Not 13 Datorer",
      25: "Not 14 Förbättringsutgifter på annans fastighet",
      26: "Not 15 Andelar i koncernföretag",
      27: "Not 16 Andelar i intresseföretag",
      28: "Not 17 Andra långfristiga värdepappersinnehav",
      29: "Not 18 Fordringar",
      30: "Not 19 Kassa och bank",
      31: "Not 20 Övriga långfristiga skulder",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-deterministic-statement-skip",
      generatedAt: "2026-03-12T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(findMockUserInstructionV1("Stage: financial statements extraction.")).toBe("");
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "statements.skipped=deterministic_extractable_pdf_rebuild",
        ),
      ]),
    );
    expect(result.extraction.taxDeep.ink2rExtracted.statementUnit).toBe("ksek");
    expect(result.extraction.taxDeep.ink2rExtracted.incomeStatement.length).toBeGreaterThanOrEqual(8);
    expect(result.extraction.taxDeep.ink2rExtracted.balanceSheet.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps scanned PDFs on PDF-first stages with longer request budgets", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: section locator.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_section_locator_v1",
            sections: {
              coreFacts: [{ startPage: 1, endPage: 2, confidence: 0.9 }],
              incomeStatement: [{ startPage: 15, endPage: 15, confidence: 0.9 }],
              balanceSheet: [{ startPage: 16, endPage: 17, confidence: 0.9 }],
              taxExpense: [{ startPage: 26, endPage: 26, confidence: 0.9 }],
              depreciationAndAssets: [{ startPage: 27, endPage: 28, confidence: 0.9 }],
              reserves: [{ startPage: 26, endPage: 26, confidence: 0.9 }],
              financeAndInterest: [{ startPage: 29, endPage: 30, confidence: 0.9 }],
              pensionsAndLeasing: [{ startPage: 24, endPage: 25, confidence: 0.9 }],
              groupContributionsAndShareholdings: [{ startPage: 29, endPage: 29, confidence: 0.9 }],
            },
            documentWarnings: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "needs_review", confidence: 0.1 },
              organizationNumber: { status: "needs_review", confidence: 0.1 },
              fiscalYearStart: { status: "needs_review", confidence: 0.1 },
              fiscalYearEnd: { status: "needs_review", confidence: 0.1 },
              accountingStandard: { status: "needs_review", confidence: 0.1 },
              profitBeforeTax: { status: "needs_review", confidence: 0.1 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [],
              balanceSheet: [],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      return {
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
          netInterestContext: { notes: [], evidence: [] },
          pensionContext: { flags: [], notes: [], evidence: [] },
          leasingContext: { flags: [], notes: [], evidence: [] },
          groupContributionContext: { flags: [], notes: [], evidence: [] },
          shareholdingContext: { flags: [], notes: [], evidence: [] },
          evidence: [],
        },
      };
    });

    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: "Image page 1",
      2: "Image page 2",
      15: "Image page 15",
      16: "Image page 16",
      17: "Image page 17",
      26: "Image page 26",
      29: "Image page 29",
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "scanned_or_low_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts: Array.from({ length: 32 }, (_, index) =>
          index < 2 ? "x" : `Page ${index + 1}`,
        ),
      }),
      generateId: () => "run-11",
      generatedAt: "2026-03-09T10:00:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "execution.profile=scanned_or_low_text_pdf",
        "routing.strategy=ai_primary",
        "statements.input=pdf",
        "statements.primary_request_timeout_ms=20000",
        "statements.retry_request_timeout_ms=25000",
        "statements.stage_budget_ms=40000",
        "tax_notes_assets.input=pdf",
        "tax_notes_assets.primary_request_timeout_ms=15000",
        "tax_notes_assets.retry_request_timeout_ms=20000",
        "tax_notes_assets.stage_budget_ms=25000",
        "tax_notes_finance.input=pdf",
        "tax_notes_finance.primary_request_timeout_ms=15000",
        "tax_notes_finance.retry_request_timeout_ms=20000",
        "tax_notes_finance.stage_budget_ms=25000",
      ]),
    );

    const statementCall = generateGeminiStructuredOutputMock.mock.calls.find((call) =>
      String(call?.[0]?.request?.userInstruction ?? "").includes(
        "Stage: financial statements extraction.",
      ),
    );
    expect(statementCall?.[0]?.request?.documents).toBeDefined();
    expect(statementCall?.[0]?.request?.timeoutMs).toBe(20000);
  });

  it("fills missing core facts from deterministic seed when AI leaves them in needs_review", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "needs_review", confidence: 0.2 },
              organizationNumber: { status: "needs_review", confidence: 0.2 },
              fiscalYearStart: { status: "needs_review", confidence: 0.2 },
              fiscalYearEnd: { status: "needs_review", confidence: 0.2 },
              accountingStandard: { status: "needs_review", confidence: 0.2 },
              profitBeforeTax: { status: "needs_review", confidence: 0.2 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: combined extractable-text annual-report extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: createCombinedExtractionOutputV1(),
        };
      }
      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = [
      "Deloitte AB\norg.nr 556271-5309\nÅrsredovisning",
      "Årsredovisningen har upprättats enligt BFNAR 2016:10 (K2)\nVerksamhetsår 2024-06-01 - 2025-05-31\nInnehåll\nResultaträkning 4\nBalansräkning 5",
      "Förvaltningsberättelse",
      "Resultaträkning\nResultat före skatt 553286",
      "Balansräkning",
    ];
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0],
      2: pageTexts[1],
      4: pageTexts[3],
      5: pageTexts[4],
    }, pageTexts.length);

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: pageTexts.length,
        pageTexts,
      }),
      generateId: () => "run-seed-fallback",
      generatedAt: "2026-03-10T10:15:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
      runtimeMode: "ai_overdrive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.fields.companyName).toMatchObject({
      status: "extracted",
      valueText: "Deloitte AB",
    });
    expect(result.extraction.fields.organizationNumber).toMatchObject({
      status: "extracted",
      valueText: "556271-5309",
    });
    expect(result.extraction.fields.fiscalYearStart).toMatchObject({
      status: "extracted",
      normalizedValue: "2024-06-01",
    });
    expect(result.extraction.fields.fiscalYearEnd).toMatchObject({
      status: "extracted",
      normalizedValue: "2025-05-31",
    });
    expect(result.extraction.fields.accountingStandard).toMatchObject({
      status: "extracted",
      normalizedValue: "K2",
    });
    expect(result.extraction.fields.profitBeforeTax).toMatchObject({
      status: "extracted",
      normalizedValue: 553286,
    });
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "fallback.core_facts.companyName=seeded_from_deterministic_text",
        "fallback.core_facts.organizationNumber=seeded_from_deterministic_text",
        "fallback.core_facts.fiscalYearStart=seeded_from_deterministic_text",
        "fallback.core_facts.fiscalYearEnd=seeded_from_deterministic_text",
        "fallback.core_facts.accountingStandard=seeded_from_deterministic_text",
        "fallback.core_facts.profitBeforeTax=seeded_from_deterministic_text",
      ]),
    );
  });

  it("strips legacy Gemini keys before building the final extraction contract", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "extracted", confidence: 0.99, valueText: "Deloitte AB" },
              organizationNumber: { status: "extracted", confidence: 0.99, valueText: "556271-5309" },
              fiscalYearStart: { status: "extracted", confidence: 0.99, valueText: "2024-06-01", normalizedValue: "2024-06-01" },
              fiscalYearEnd: { status: "extracted", confidence: 0.99, valueText: "2025-05-31", normalizedValue: "2025-05-31" },
              accountingStandard: { status: "extracted", confidence: 0.99, valueText: "K3", normalizedValue: "K3" },
              profitBeforeTax: { status: "extracted", confidence: 0.99, valueText: "545286", normalizedValue: 545286 },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [{ code: "profit_before_tax", label: "Resultat före skatt", currentYearValue: 545286 }],
              balanceSheet: [{ code: "cash", label: "Kassa och bank", currentYearValue: 301521 }],
              fiscalYearStart: "2024-06-01",
              fiscalYearEnd: "2025-05-31",
              organizationNumber: "556271-5309",
              fullIncomeStatementRows: [],
              fullBalanceSheetRows: [],
              priorYearComparatives: [],
              taxSignals: [],
              documentWarnings: [],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      return {
        ok: true,
        model: "qwen-plus",
        output: {
          schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
          netInterestContext: { notes: [], evidence: [] },
          pensionContext: {
            flags: [],
            notes: [],
            evidence: [],
            pensionCosts: ["Pensionskostnader framgår av not 5."],
            pensionObligations: ["Pensionsförpliktelser redovisas separat."],
          },
          taxExpenseContext: {
            notes: [],
            evidence: [],
            recognizedTax: {
              value: 120,
              page: 26,
              snippet: "Aktuell skatt 120",
            },
            reconciliation: ["Skatten avviker från schablonberäkningen."],
          },
          leasingContext: {
            flags: [],
            notes: [],
            evidence: [],
            leasingExpenses: ["Leasingkostnader under året uppgår till 12."],
            leasingObligations: ["Framtida leasingåtaganden framgår av not 3."],
          },
          groupContributionContext: { flags: [], notes: [], evidence: [] },
          shareholdingContext: {
            flags: [],
            notes: [],
            evidence: [],
            dividends: ["Utdelning från koncernföretag framgår av not 18."],
            participationsInGroupCompanies: [
              "Andelar i koncernföretag framgår av not 18.",
            ],
            participationsInAssociatedCompanies: [
              "Inga intresseföretag redovisade under året.",
            ],
            otherLongTermSecurities: [
              "Andra långfristiga värdepappersinnehav framgår av not 20.",
            ],
          },
          evidence: [],
        },
      };
    });

    const pageTexts = Array.from({ length: 32 }, (_, index) => {
      const page = index + 1;
      if (page === 1) return "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning";
      if (page === 2) return `Årsredovisning för räkenskapsåret 1 juni 2024 – 31 maj 2025\nInnehåll\nResultaträkning 15\nBalansräkning 16-17\nBokslutskommentarer 20-23\nUpplysningar till enskilda poster 24-31\n${"Lorem ipsum ".repeat(250)}`;
      if (page === 15) return "Resultaträkning\nResultat före skatt 545286";
      if (page === 16) return "Balansräkning";
      if (page === 17) return "Balansräkning, forts.";
      if (page === 20) return "Redovisningsprinciper\nBFNAR 2012:1 (K3)";
      if (page === 24) return "Not 3 Leasingavtal";
      if (page === 25) return "Not 5 Pensionskostnader\nNot 6 Övriga ränteintäkter\nNot 7 Räntekostnader";
      if (page === 26) return "Not 8 Bokslutsdispositioner\nNot 9 Skatt på årets resultat\nNot 10 Hyresrätter";
      if (page === 27) return "Not 12 Programvaror\nNot 14 Byggnader och mark";
      if (page === 28) return "Not 15 Inventarier\nNot 17 Förbättringsutgifter på annans fastighet";
      if (page === 29) return "Not 18 Andelar i koncernföretag\nNot 20 Andra långfristiga värdepappersinnehav";
      if (page === 30) return "Not 22 Kassa och bank\nNot 24 Övriga långfristiga skulder";
      if (page === 31) return "Not 28 Ställda säkerheter och eventualförpliktelser";
      return `Page ${page}`;
    });
    const pdfBytes = await createPdfBytesWithPageLabelsV1({
      1: pageTexts[0]!,
      2: pageTexts[1]!,
      15: pageTexts[14]!,
      16: pageTexts[15]!,
      17: pageTexts[16]!,
      20: pageTexts[19]!,
      24: pageTexts[23]!,
      25: pageTexts[24]!,
      26: pageTexts[25]!,
      27: pageTexts[26]!,
      28: pageTexts[27]!,
      29: pageTexts[28]!,
      30: pageTexts[29]!,
      31: pageTexts[30]!,
    });

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: 32,
        pageTexts,
      }),
      generateId: () => "run-legacy-keys",
      generatedAt: "2026-03-10T10:50:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.taxDeep.ink2rExtracted).toMatchObject({
      statementUnit: "ksek",
      incomeStatement: [{ code: "profit_before_tax", label: "Resultat före skatt", currentYearValue: 545286 }],
      balanceSheet: [{ code: "cash", label: "Kassa och bank", currentYearValue: 301521 }],
    });
    expect(result.extraction.taxDeep.pensionContext.notes).toEqual(
      expect.arrayContaining([
        "Pensionskostnader framgår av not 5.",
        "Pensionsförpliktelser redovisas separat.",
      ]),
    );
    expect(result.extraction.taxDeep.pensionContext).not.toHaveProperty(
      "pensionCosts",
    );
    expect(result.extraction.taxDeep.taxExpenseContext).toMatchObject({
      currentTax: {
        value: 120,
        evidence: [{ page: 26, snippet: "Aktuell skatt 120" }],
      },
    });
    expect(result.extraction.taxDeep.taxExpenseContext?.notes).toEqual(
      expect.arrayContaining([
        "Skatten avviker från schablonberäkningen.",
      ]),
    );
    expect(result.extraction.taxDeep.taxExpenseContext).not.toHaveProperty(
      "recognizedTax",
    );
    expect(result.extraction.taxDeep.leasingContext.notes).toEqual(
      expect.arrayContaining([
        "Leasingkostnader under året uppgår till 12.",
        "Framtida leasingåtaganden framgår av not 3.",
      ]),
    );
    expect(result.extraction.taxDeep.leasingContext).not.toHaveProperty(
      "leasingExpenses",
    );
    expect(result.extraction.taxDeep.shareholdingContext.notes).toEqual(
      expect.arrayContaining([
        "Utdelning från koncernföretag framgår av not 18.",
        "Andelar i koncernföretag framgår av not 18.",
        "Inga intresseföretag redovisade under året.",
        "Andra långfristiga värdepappersinnehav framgår av not 20.",
      ]),
    );
    expect(result.extraction.taxDeep.shareholdingContext).not.toHaveProperty(
      "participationsInGroupCompanies",
    );
  });

  it("prefers AI statement-row profit before tax over deterministic seed fallback", async () => {
    generateGeminiStructuredOutputMock.mockReset();
    generateGeminiStructuredOutputMock.mockImplementation(async (input) => {
      const userInstruction = String(input?.request?.userInstruction ?? "");
      if (userInstruction.includes("Stage: core facts extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_core_facts_v1",
            fields: {
              companyName: { status: "needs_review", confidence: 0.2 },
              organizationNumber: { status: "needs_review", confidence: 0.2 },
              fiscalYearStart: { status: "needs_review", confidence: 0.2 },
              fiscalYearEnd: { status: "needs_review", confidence: 0.2 },
              accountingStandard: { status: "needs_review", confidence: 0.2 },
              profitBeforeTax: {
                status: "extracted",
                confidence: 0.4,
                valueText: "771473",
                normalizedValue: 771473,
              },
            },
            taxSignals: [],
            documentWarnings: [],
          },
        };
      }
      if (userInstruction.includes("Stage: financial statements extraction.")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_statements_only_v1",
            ink2rExtracted: {
              statementUnit: "ksek",
              incomeStatement: [
                {
                  code: "profit_before_tax",
                  label: "Resultat före skatt",
                  currentYearValue: 545286,
                },
              ],
              balanceSheet: [
                { code: "cash", label: "Kassa och bank", currentYearValue: 200 },
              ],
            },
            priorYearComparatives: [],
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (assets & reserves).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_assets_reserves_v1",
            depreciationContext: { assetAreas: [], evidence: [] },
            assetMovements: { lines: [], evidence: [] },
            reserveContext: { movements: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            evidence: [],
          },
        };
      }
      if (userInstruction.includes("Stage: tax notes (finance & other).")) {
        return {
          ok: true,
          model: "qwen-plus",
          output: {
            schemaVersion: "annual_report_ai_tax_notes_finance_other_v1",
            netInterestContext: { notes: [], evidence: [] },
            pensionContext: { flags: [], notes: [], evidence: [] },
            taxExpenseContext: { notes: [], evidence: [] },
            leasingContext: { flags: [], notes: [], evidence: [] },
            groupContributionContext: { flags: [], notes: [], evidence: [] },
            shareholdingContext: { flags: [], notes: [], evidence: [] },
            evidence: [],
          },
        };
      }

      return {
        ok: false,
        error: {
          code: "MODEL_EXECUTION_FAILED",
          message: `Unexpected stage for test: ${userInstruction.slice(0, 80)}`,
          context: {},
        },
      };
    });

    const pageTexts = [
      "Deloitte AB\nOrg.nr 556271-5309\nÅrsredovisning",
      "Räkenskapsår 1 juni 2024 - 31 maj 2025\nK3",
      "Page 3",
      "Page 4",
      "Resultaträkning\nBelopp i KSEK\nResultat före skatt 545 286 553 286",
      "Balansräkning",
    ];
    const pdfBytes = await createPdfBytesWithPageLabelsV1(
      {
        1: pageTexts[0],
        2: pageTexts[1],
        5: pageTexts[4],
        6: pageTexts[5],
      },
      pageTexts.length,
    );

    const result = await executeAnnualReportAnalysisV1({
      apiKey: "test-key",
      config: getConfigOrThrowV1(),
      document: createPreparedPdfDocumentV1({
        classification: "extractable_text_pdf",
        pdfBytes,
        pageCount: pageTexts.length,
        pageTexts,
      }),
      generateId: () => "run-pbt-precedence",
      generatedAt: "2026-03-10T10:30:00.000Z",
      modelConfig: {
        fastModel: "qwen-plus",
        thinkingModel: "qwen-max",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.fields.profitBeforeTax).toMatchObject({
      status: "extracted",
      normalizedValue: 545286,
      valueText: "545286",
    });
    expect(result.extraction.documentWarnings).toEqual(
      expect.arrayContaining([
        "fallback.core_facts.profitBeforeTax=ai_statement_row",
      ]),
    );
  });
});
