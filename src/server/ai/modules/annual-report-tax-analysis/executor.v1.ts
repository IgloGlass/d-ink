import { z } from "zod";
import { parseAiRunMetadataV1 } from "../../../../shared/contracts/ai-run.v1";
import type { AnnualReportExtractionPayloadV1 } from "../../../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportTaxAnalysisPayloadV1 } from "../../../../shared/contracts/annual-report-tax-analysis.v1";
import type { AnnualReportPreparedDocumentV1 } from "../../document-prep/annual-report-document.v1";
import type { GeminiModelConfigV1 } from "../../providers/gemini-client.v1";
import { generateGeminiStructuredOutputV1 } from "../../providers/gemini-client.v1";
import type { loadAnnualReportTaxAnalysisModuleConfigV1 } from "./loader.v1";
import {
  ANNUAL_REPORT_TAX_ANALYSIS_SYSTEM_PROMPT_V1,
  ANNUAL_REPORT_TAX_ANALYSIS_USER_PROMPT_V1,
} from "./prompt-text.v1";

export type AnnualReportTaxAnalysisRuntimeConfigV1 = NonNullable<
  Extract<
    ReturnType<typeof loadAnnualReportTaxAnalysisModuleConfigV1>,
    { ok: true }
  >["config"]
>;

export type ExecuteAnnualReportTaxAnalysisInputV1 = {
  apiKey?: string;
  config: AnnualReportTaxAnalysisRuntimeConfigV1;
  document?: AnnualReportPreparedDocumentV1;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
  generateId: () => string;
  generatedAt: string;
  modelConfig: GeminiModelConfigV1;
  policyVersion: string;
  sourceDiagnostics?: string[];
};

export type ExecuteAnnualReportTaxAnalysisResultV1 =
  | {
      ok: true;
      taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
    }
  | {
      ok: false;
      error: {
        code:
          | "MODEL_EXECUTION_FAILED"
          | "MODEL_RESPONSE_INVALID"
          | "CONFIG_INVALID";
        message: string;
        context: Record<string, unknown>;
      };
    };

const AnnualReportTaxAnalysisAiEnvelopeV1Schema = z.object({}).passthrough();

function getRecordValueV1(input: unknown): Record<string, unknown> | null {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function getTrimmedStringV1(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getStringArrayV1(
  input: unknown,
  normalizeValue?: (value: string) => string | undefined,
): string[] {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? [input]
      : [];
  const values: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    const normalized = getTrimmedStringV1(rawValue);
    const projected = normalized
      ? (normalizeValue?.(normalized) ?? normalized)
      : undefined;
    if (!projected || seen.has(projected)) {
      continue;
    }

    seen.add(projected);
    values.push(projected);
  }

  return values;
}

function normalizeActionTextV1(input: string): string | undefined {
  const normalized = input
    .trim()
    .replace(/^\d+[\).\s-]+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeEvidenceV1(
  input: unknown,
): AnnualReportTaxAnalysisPayloadV1["findings"][number]["evidence"] {
  if (!Array.isArray(input)) {
    return [];
  }

  const evidence: AnnualReportTaxAnalysisPayloadV1["findings"][number]["evidence"] =
    [];
  for (const entry of input) {
    const record = getRecordValueV1(entry);
    const snippet = getTrimmedStringV1(record?.snippet);
    if (!record || !snippet) {
      continue;
    }

    const pageValue =
      typeof record.page === "number" &&
      Number.isInteger(record.page) &&
      record.page > 0
        ? record.page
        : undefined;
    evidence.push({
      snippet,
      section: getTrimmedStringV1(record.section),
      noteReference: getTrimmedStringV1(record.noteReference),
      page: pageValue,
    });
  }

  return evidence;
}

function normalizeSeverityV1(input: unknown): "low" | "medium" | "high" {
  const normalized = getTrimmedStringV1(input)?.toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }

  return "medium";
}

function normalizeAccountingStandardStatusV1(
  input: unknown,
): "aligned" | "needs_review" | undefined {
  const normalized = getTrimmedStringV1(input)?.toLowerCase();
  switch (normalized) {
    case "aligned":
    case "ok":
    case "consistent":
      return "aligned";
    case "needs_review":
    case "needs review":
    case "review":
    case "mismatch":
      return "needs_review";
    default:
      return undefined;
  }
}

function slugifyForIdentifierV1(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug.length > 0 ? slug : "finding";
}

function normalizeFindingV1(input: {
  defaultPolicyRuleReference: string;
  index: number;
  value: unknown;
}): AnnualReportTaxAnalysisPayloadV1["findings"][number] | null {
  const record = getRecordValueV1(input.value);
  if (!record) {
    return null;
  }

  const area =
    getTrimmedStringV1(record.area) ??
    getTrimmedStringV1(record.domain) ??
    getTrimmedStringV1(record.topic) ??
    "general_tax_review";
  const title =
    getTrimmedStringV1(record.title) ??
    getTrimmedStringV1(record.issue) ??
    `${area.replace(/_/g, " ")} finding`;
  const rationale =
    getTrimmedStringV1(record.rationale) ??
    getTrimmedStringV1(record.reason) ??
    getTrimmedStringV1(record.summary) ??
    "Review this area against the annual report before finalizing the tax position.";
  const identifierSeed = `${area}-${title}`;

  return {
    id:
      getTrimmedStringV1(record.id) ??
      `finding-${input.index + 1}-${slugifyForIdentifierV1(identifierSeed)}`,
    area,
    title,
    severity: normalizeSeverityV1(record.severity),
    rationale,
    recommendedFollowUp:
      getTrimmedStringV1(record.recommendedFollowUp) ??
      getTrimmedStringV1(record.followUp),
    missingInformation: getStringArrayV1(
      record.missingInformation ?? record.missing_info,
    ),
    policyRuleReference:
      getTrimmedStringV1(record.policyRuleReference) ??
      input.defaultPolicyRuleReference,
    evidence: normalizeEvidenceV1(record.evidence),
  };
}

function dedupeFindingsV1(
  findings: AnnualReportTaxAnalysisPayloadV1["findings"],
): AnnualReportTaxAnalysisPayloadV1["findings"] {
  const seen = new Set<string>();
  const deduped: AnnualReportTaxAnalysisPayloadV1["findings"] = [];

  for (const finding of findings) {
    const key = [
      finding.area.toLowerCase(),
      finding.title.toLowerCase(),
      finding.rationale.toLowerCase(),
    ].join("|");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(finding);
  }

  return deduped;
}

function buildFallbackExecutiveSummaryV1(input: {
  findings: AnnualReportTaxAnalysisPayloadV1["findings"];
  missingInformation: string[];
  recommendedNextActions: string[];
}): string {
  if (input.findings.length > 0) {
    return `The forensic annual-report review flagged ${input.findings.length} tax-sensitive area(s) for follow-up.`;
  }
  if (input.recommendedNextActions.length > 0) {
    return `The forensic annual-report review identified ${input.recommendedNextActions.length} concrete follow-up action(s).`;
  }
  if (input.missingInformation.length > 0) {
    return "The forensic annual-report review completed, but the document is missing enough detail that downstream tax modules should stay conservative.";
  }

  return "The forensic annual-report review completed without specific high-confidence findings.";
}

function buildDefaultAccountingStandardAssessmentV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
}): AnnualReportTaxAnalysisPayloadV1["accountingStandardAssessment"] {
  const accountingStandard = input.extraction.fields.accountingStandard.value;
  if (accountingStandard) {
    return {
      status: "aligned",
      rationale: `${accountingStandard} is available in the extracted annual-report core facts.`,
    };
  }

  return {
    status: "unclear",
    rationale:
      "The accounting standard could not be confirmed confidently from the available annual-report analysis inputs.",
  };
}

function inferFindingAreaFromActionV1(action: string): string {
  const normalized = action.toLowerCase();
  if (
    normalized.includes("fixed asset") ||
    normalized.includes("goodwill") ||
    normalized.includes("depreciation")
  ) {
    return "depreciation_differences";
  }
  if (normalized.includes("untaxed reserve")) {
    return "untaxed_reserves";
  }
  if (
    normalized.includes("dividend") ||
    normalized.includes("parent company")
  ) {
    return "shareholdings_dividends";
  }
  if (
    normalized.includes("interest") ||
    normalized.includes("debt") ||
    normalized.includes("finance")
  ) {
    return "net_interest";
  }
  if (
    normalized.includes("merger") ||
    normalized.includes("acquisition") ||
    normalized.includes("restructuring")
  ) {
    return "asset_acquisitions_and_disposals";
  }

  return "general_tax_review";
}

function buildFindingTitleFromActionV1(action: string): string {
  const colonIndex = action.indexOf(":");
  if (colonIndex > 0) {
    return action.slice(0, colonIndex).trim();
  }

  const firstSentence = action.split(/[.!?]/, 1)[0]?.trim();
  if (firstSentence && firstSentence.length > 0) {
    return firstSentence;
  }

  return "Tax follow-up required";
}

function synthesizeFindingsFromActionsV1(input: {
  actions: string[];
  defaultPolicyRuleReference: string;
  startIndex: number;
}): AnnualReportTaxAnalysisPayloadV1["findings"] {
  return input.actions.map((action, index) => {
    const area = inferFindingAreaFromActionV1(action);
    return {
      id: `finding-${input.startIndex + index + 1}-${slugifyForIdentifierV1(`${area}-${action}`)}`,
      area,
      title: buildFindingTitleFromActionV1(action),
      severity: "medium",
      rationale: action,
      recommendedFollowUp: action,
      missingInformation: [],
      policyRuleReference: input.defaultPolicyRuleReference,
      evidence: [],
    };
  });
}

function hasEvidenceOrTextV1(input: {
  evidence?: AnnualReportTaxAnalysisPayloadV1["findings"][number]["evidence"];
  notes?: string[];
}): boolean {
  return (input.notes?.length ?? 0) > 0 || (input.evidence?.length ?? 0) > 0;
}

function buildExtractionCoverageFindingsV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
  startIndex: number;
}): AnnualReportTaxAnalysisPayloadV1["findings"] {
  const findings: AnnualReportTaxAnalysisPayloadV1["findings"] = [];
  const taxDeep = input.extraction.taxDeep;
  if (!taxDeep) {
    return findings;
  }

  const pushFinding = (finding: AnnualReportTaxAnalysisPayloadV1["findings"][number]) => {
    findings.push(finding);
  };

  if (
    taxDeep.assetMovements.lines.length > 0 ||
    taxDeep.depreciationContext.assetAreas.length > 0 ||
    hasEvidenceOrTextV1({
      evidence: [
        ...taxDeep.assetMovements.evidence,
        ...taxDeep.depreciationContext.evidence,
      ],
    })
  ) {
    pushFinding({
      id: `finding-${input.startIndex + findings.length + 1}-depreciation-review`,
      area: "depreciation_differences",
      title: "Fixed-asset notes require tax depreciation review",
      severity: "medium",
      rationale:
        "The annual report contains fixed-asset movement or depreciation-note signals that should be reconciled against the tax depreciation schedule.",
      recommendedFollowUp:
        "Reconcile accounting fixed-asset movements and depreciation policies against the tax depreciation workpapers.",
      missingInformation: [],
      policyRuleReference:
        "annual-report-tax-analysis.v1.minimum-coverage.depreciation",
      evidence: [
        ...taxDeep.depreciationContext.evidence,
        ...taxDeep.assetMovements.evidence,
        ...taxDeep.assetMovements.lines.flatMap((line) => line.evidence),
      ].slice(0, 4),
    });
  }

  if (
    taxDeep.reserveContext.movements.length > 0 ||
    taxDeep.reserveContext.notes.length > 0 ||
    taxDeep.taxExpenseContext?.notes.length
  ) {
    pushFinding({
      id: `finding-${input.startIndex + findings.length + 1}-reserve-tax-note-review`,
      area: "untaxed_reserves",
      title: "Tax and reserve notes should be traced into the return",
      severity: "medium",
      rationale:
        "Reserve movements or tax-expense note disclosures were extracted and should be traced into the tax return and supporting schedules.",
      recommendedFollowUp:
        "Trace reserve movements and current/deferred tax-note disclosures into the tax return workpapers.",
      missingInformation: [],
      policyRuleReference:
        "annual-report-tax-analysis.v1.minimum-coverage.tax-reserve",
      evidence: [
        ...taxDeep.reserveContext.evidence,
        ...taxDeep.reserveContext.movements.flatMap((movement) => movement.evidence),
        ...(taxDeep.taxExpenseContext?.evidence ?? []),
      ].slice(0, 4),
    });
  }

  if (
    hasEvidenceOrTextV1({
      notes: taxDeep.netInterestContext.notes,
      evidence: taxDeep.netInterestContext.evidence,
    }) ||
    taxDeep.netInterestContext.netInterest !== undefined ||
    taxDeep.netInterestContext.interestExpense !== undefined
  ) {
    pushFinding({
      id: `finding-${input.startIndex + findings.length + 1}-interest-review`,
      area: "net_interest",
      title: "Finance-note disclosures should be reviewed for interest limitations",
      severity: "low",
      rationale:
        "The annual report includes finance or interest-note signals that may affect interest limitation review or debt classification.",
      recommendedFollowUp:
        "Review finance-income and interest-expense disclosures against the interest limitation analysis.",
      missingInformation: [],
      policyRuleReference:
        "annual-report-tax-analysis.v1.minimum-coverage.net-interest",
      evidence: [
        ...taxDeep.netInterestContext.evidence,
        ...(taxDeep.netInterestContext.netInterest?.evidence ?? []),
        ...(taxDeep.netInterestContext.interestExpense?.evidence ?? []),
      ].slice(0, 4),
    });
  }

  if (
    hasEvidenceOrTextV1({
      notes: taxDeep.groupContributionContext.notes,
      evidence: taxDeep.groupContributionContext.evidence,
    }) ||
    hasEvidenceOrTextV1({
      notes: taxDeep.shareholdingContext.notes,
      evidence: taxDeep.shareholdingContext.evidence,
    }) ||
    taxDeep.shareholdingContext.dividendsReceived !== undefined ||
    taxDeep.shareholdingContext.dividendsPaid !== undefined
  ) {
    pushFinding({
      id: `finding-${input.startIndex + findings.length + 1}-group-ownership-review`,
      area: "shareholdings_dividends",
      title: "Group, ownership, or dividend notes require classification review",
      severity: "low",
      rationale:
        "The annual report includes shareholding, dividend, or group-related note disclosures that may affect tax classification or disclosure follow-up.",
      recommendedFollowUp:
        "Review group contribution, ownership, and dividend notes for tax treatment and supporting documentation.",
      missingInformation: [],
      policyRuleReference:
        "annual-report-tax-analysis.v1.minimum-coverage.group-ownership",
      evidence: [
        ...taxDeep.groupContributionContext.evidence,
        ...taxDeep.shareholdingContext.evidence,
        ...(taxDeep.shareholdingContext.dividendsReceived?.evidence ?? []),
        ...(taxDeep.shareholdingContext.dividendsPaid?.evidence ?? []),
      ].slice(0, 4),
    });
  }

  if (
    hasEvidenceOrTextV1({
      notes: taxDeep.pensionContext.notes,
      evidence: taxDeep.pensionContext.evidence,
    }) ||
    hasEvidenceOrTextV1({
      notes: taxDeep.leasingContext.notes,
      evidence: taxDeep.leasingContext.evidence,
    })
  ) {
    pushFinding({
      id: `finding-${input.startIndex + findings.length + 1}-employment-commitment-review`,
      area: "general_tax_review",
      title: "Pension or leasing disclosures require follow-up",
      severity: "low",
      rationale:
        "The annual report includes pension or leasing-note disclosures that should be reconciled to downstream tax workpapers.",
      recommendedFollowUp:
        "Review pension and leasing notes for payroll-tax, deductibility, and commitment follow-up.",
      missingInformation: [],
      policyRuleReference:
        "annual-report-tax-analysis.v1.minimum-coverage.commitments",
      evidence: [
        ...taxDeep.pensionContext.evidence,
        ...taxDeep.leasingContext.evidence,
      ].slice(0, 4),
    });
  }

  return findings;
}

function normalizeAnnualReportTaxAnalysisAiOutputV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
  output: Record<string, unknown>;
}): Pick<
  AnnualReportTaxAnalysisPayloadV1,
  | "accountingStandardAssessment"
  | "executiveSummary"
  | "findings"
  | "missingInformation"
  | "recommendedNextActions"
> {
  const rawFindings =
    (Array.isArray(input.output.findings) && input.output.findings) ||
    (Array.isArray(input.output.risks) && input.output.risks) ||
    (Array.isArray(input.output.issues) && input.output.issues) ||
    [];
  const findings = dedupeFindingsV1(
    rawFindings
      .map((value, index) =>
        normalizeFindingV1({
          defaultPolicyRuleReference:
            "annual-report-tax-analysis.v1.ai-normalized",
          index,
          value,
        }),
      )
      .filter(
        (
          finding,
        ): finding is AnnualReportTaxAnalysisPayloadV1["findings"][number] =>
          finding !== null,
      ),
  );

  const missingInformation = getStringArrayV1(
    input.output.missingInformation ?? input.output.missing_info,
  );
  for (const finding of findings) {
    for (const item of finding.missingInformation) {
      if (!missingInformation.includes(item)) {
        missingInformation.push(item);
      }
    }
  }

  const recommendedNextActions = getStringArrayV1(
    input.output.recommendedNextActions ??
      input.output.recommended_actions ??
      input.output.nextActions,
    normalizeActionTextV1,
  );
  if (findings.length === 0) {
    findings.push(
      ...buildExtractionCoverageFindingsV1({
        extraction: input.extraction,
        startIndex: findings.length,
      }),
    );
  }
  if (findings.length === 0 && recommendedNextActions.length > 0) {
    findings.push(
      ...synthesizeFindingsFromActionsV1({
        actions: recommendedNextActions,
        defaultPolicyRuleReference:
          "annual-report-tax-analysis.v1.action-synthesized",
        startIndex: findings.length,
      }),
    );
  }
  if (recommendedNextActions.length === 0) {
    for (const finding of findings) {
      if (
        finding.recommendedFollowUp &&
        !recommendedNextActions.includes(finding.recommendedFollowUp)
      ) {
        recommendedNextActions.push(finding.recommendedFollowUp);
      }
    }
  }

  const accountingStandardRecord = getRecordValueV1(
    input.output.accountingStandardAssessment ??
      input.output.accounting_standard_assessment,
  );
  const defaultAccountingStandardAssessment =
    buildDefaultAccountingStandardAssessmentV1({
      extraction: input.extraction,
    });
  const normalizedAccountingStandardStatus =
    normalizeAccountingStandardStatusV1(accountingStandardRecord?.status);
  const accountingStandardAssessment = accountingStandardRecord
    ? {
        status:
          normalizedAccountingStandardStatus ??
          defaultAccountingStandardAssessment.status,
        rationale:
          getTrimmedStringV1(accountingStandardRecord.rationale) ??
          defaultAccountingStandardAssessment.rationale,
      }
    : defaultAccountingStandardAssessment;

  const executiveSummary =
    getTrimmedStringV1(input.output.executiveSummary) ??
    getTrimmedStringV1(input.output.summary) ??
    buildFallbackExecutiveSummaryV1({
      findings,
      missingInformation,
      recommendedNextActions,
    });

  return {
    executiveSummary,
    accountingStandardAssessment,
    findings,
    missingInformation,
    recommendedNextActions,
  };
}

function buildSourceDocumentContextV1(input: {
  document?: AnnualReportPreparedDocumentV1;
  sourceDiagnostics?: string[];
}): string | undefined {
  if (!input.document) {
    return undefined;
  }

  const diagnostics =
    input.sourceDiagnostics && input.sourceDiagnostics.length > 0
      ? `Diagnostics: ${input.sourceDiagnostics.join("; ")}.`
      : undefined;

  if (input.document.fileType === "pdf" && input.document.inlineDataBase64) {
    return [
      "Source document: the full annual report PDF is attached to this request.",
      "Review the attached PDF directly and use the extracted JSON as supporting context, not as a hard limit.",
      diagnostics,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  if (
    input.document.fileType === "docx" &&
    input.document.text.trim().length > 0
  ) {
    return [
      "Source document: the annual report DOCX has been parsed to full text and is included below.",
      diagnostics,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  if (input.document.text.trim().length > 0) {
    return [
      "Source document text is included below for direct review.",
      diagnostics,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  return diagnostics;
}

export async function executeAnnualReportTaxAnalysisV1(
  input: ExecuteAnnualReportTaxAnalysisInputV1,
): Promise<ExecuteAnnualReportTaxAnalysisResultV1> {
  const sourceDocumentContext = buildSourceDocumentContextV1({
    document: input.document,
    sourceDiagnostics: input.sourceDiagnostics,
  });
  const structuredExtraction = {
    taxDeep: input.extraction.taxDeep,
    taxSignals: input.extraction.taxSignals,
    documentWarnings: input.extraction.documentWarnings,
    accountingStandard: input.extraction.fields.accountingStandard.value,
    profitBeforeTax: input.extraction.fields.profitBeforeTax.value,
  };
  const result = await generateGeminiStructuredOutputV1<
    Record<string, unknown>
  >({
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
    request: {
      modelTier: input.config.moduleSpec.runtime.modelTier,
      responseSchema: AnnualReportTaxAnalysisAiEnvelopeV1Schema,
      systemInstruction: ANNUAL_REPORT_TAX_ANALYSIS_SYSTEM_PROMPT_V1,
      timeoutMs: 600_000,
      temperature: 0.2,
      maxOutputTokens: 8_192,
      useResponseJsonSchema: false,
      userInstruction: [
        ANNUAL_REPORT_TAX_ANALYSIS_USER_PROMPT_V1,
        sourceDocumentContext,
        "Structured extraction:",
        JSON.stringify(structuredExtraction, null, 2),
        input.document?.fileType === "docx" &&
        input.document.text.trim().length > 0
          ? ["Source document text:", input.document.text].join("\n\n")
          : undefined,
      ].join("\n\n"),
      documents: input.document?.inlineDataBase64
        ? [
            {
              dataBase64: input.document.inlineDataBase64,
              mimeType: input.document.mimeType,
            },
          ]
        : input.document?.uri
          ? [
              {
                kind: "uri",
                uri: input.document.uri,
                mimeType: input.document.mimeType,
              },
            ]
          : undefined,
    },
  });

  if (!result.ok) {
    return result;
  }

  const normalizedOutput = normalizeAnnualReportTaxAnalysisAiOutputV1({
    extraction: input.extraction,
    output: result.output,
  });

  return {
    ok: true,
    taxAnalysis: {
      schemaVersion: "annual_report_tax_analysis_v1",
      sourceExtractionArtifactId: input.extractionArtifactId as `${string}`,
      policyVersion: input.policyVersion,
      basedOn: input.extraction.taxDeep ?? {
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
      executiveSummary: normalizedOutput.executiveSummary,
      accountingStandardAssessment:
        normalizedOutput.accountingStandardAssessment,
      findings: normalizedOutput.findings,
      missingInformation: normalizedOutput.missingInformation,
      recommendedNextActions: normalizedOutput.recommendedNextActions,
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
