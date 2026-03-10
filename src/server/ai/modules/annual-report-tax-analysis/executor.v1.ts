import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import type { AnnualReportExtractionPayloadV1 } from "../../../../shared/contracts/annual-report-extraction.v1";
import {
  type AnnualReportTaxAnalysisAiResultV1,
  AnnualReportTaxAnalysisAiResultV1Schema,
} from "../../../../shared/contracts/annual-report-tax-analysis-ai.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../../../shared/contracts/annual-report-tax-analysis.v1";
import type { GeminiModelConfigV1 } from "../../providers/gemini-client.v1";
import { generateGeminiStructuredOutputV1 } from "../../providers/gemini-client.v1";
import type { loadAnnualReportTaxAnalysisModuleConfigV1 } from "./loader.v1";
import {
  ANNUAL_REPORT_TAX_ANALYSIS_SYSTEM_PROMPT_V1,
  ANNUAL_REPORT_TAX_ANALYSIS_USER_PROMPT_V1,
} from "./prompt-text.v1";

export type AnnualReportTaxAnalysisRuntimeConfigV1 =
  NonNullable<
    Extract<
      ReturnType<typeof loadAnnualReportTaxAnalysisModuleConfigV1>,
      { ok: true }
    >["config"]
  >;

export type ExecuteAnnualReportTaxAnalysisInputV1 = {
  apiKey?: string;
  config: AnnualReportTaxAnalysisRuntimeConfigV1;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
  generateId: () => string;
  generatedAt: string;
  modelConfig: GeminiModelConfigV1;
  policyVersion: string;
};

export type ExecuteAnnualReportTaxAnalysisResultV1 =
  | {
      ok: true;
      taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
    }
  | {
      ok: false;
      error: {
        code: "MODEL_EXECUTION_FAILED" | "MODEL_RESPONSE_INVALID" | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    };

export async function executeAnnualReportTaxAnalysisV1(
  input: ExecuteAnnualReportTaxAnalysisInputV1,
): Promise<ExecuteAnnualReportTaxAnalysisResultV1> {
  const result =
    await generateGeminiStructuredOutputV1<AnnualReportTaxAnalysisAiResultV1>({
      apiKey: input.apiKey,
      modelConfig: input.modelConfig,
      request: {
        modelTier: input.config.moduleSpec.runtime.modelTier,
        responseSchema: AnnualReportTaxAnalysisAiResultV1Schema,
        systemInstruction: ANNUAL_REPORT_TAX_ANALYSIS_SYSTEM_PROMPT_V1,
        timeoutMs: 120_000,
        useResponseJsonSchema: false,
        userInstruction: [
          ANNUAL_REPORT_TAX_ANALYSIS_USER_PROMPT_V1,
          "Structured extraction:",
          JSON.stringify(
            {
              taxDeep: input.extraction.taxDeep,
              taxSignals: input.extraction.taxSignals,
              documentWarnings: input.extraction.documentWarnings,
              accountingStandard:
                input.extraction.fields.accountingStandard.value,
              profitBeforeTax: input.extraction.fields.profitBeforeTax.value,
            },
            null,
            2,
          ),
        ].join("\n\n"),
      },
    });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    taxAnalysis: {
      schemaVersion: "annual_report_tax_analysis_v1",
      sourceExtractionArtifactId: input.extractionArtifactId as `${string}`,
      policyVersion: input.policyVersion,
      basedOn:
        input.extraction.taxDeep ??
        {
          ink2rExtracted: { incomeStatement: [], balanceSheet: [] },
          depreciationContext: { assetAreas: [], evidence: [] },
          assetMovements: { lines: [], evidence: [] },
          reserveContext: { movements: [], notes: [], evidence: [] },
          netInterestContext: { notes: [], evidence: [] },
          pensionContext: { flags: [], notes: [], evidence: [] },
          taxExpenseContext: { notes: [], evidence: [] },
          leasingContext: { flags: [], notes: [], evidence: [] },
          groupContributionContext: { flags: [], notes: [], evidence: [] },
          shareholdingContext: { flags: [], notes: [], evidence: [] },
          priorYearComparatives: [],
        },
      executiveSummary: result.output.executiveSummary,
      accountingStandardAssessment: result.output.accountingStandardAssessment,
      findings: result.output.findings,
      missingInformation: result.output.missingInformation,
      recommendedNextActions: result.output.recommendedNextActions,
      aiRun: parseAiRunMetadataV1({
        runId: input.generateId(),
        moduleId: input.config.moduleSpec.moduleId,
        moduleVersion: input.config.moduleSpec.moduleVersion,
        promptVersion: input.config.moduleSpec.promptVersion,
        policyVersion: input.config.policyPack.policyVersion,
        activePatchVersions: input.config.moduleSpec.policy.activePatchVersions,
        provider: "gemini",
        model: result.model,
        modelTier: input.config.moduleSpec.runtime.modelTier,
        generatedAt: input.generatedAt,
        usedFallback: false,
      }),
    },
  };
}
