import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportDownstreamTaxContextV1 } from "../../shared/contracts/annual-report-tax-context.v1";
import {
  type MappingDecisionSetPayloadV1,
  MappingDecisionSetPayloadV1Schema,
} from "../../shared/contracts/mapping.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  type TaxAdjustmentDecisionV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import type { TaxAdjustmentAiProposalDecisionV1 } from "../../shared/contracts/tax-adjustment-ai.v1";
import type { AiRunMetadataV1 } from "../../shared/contracts/ai-run.v1";
import {
  type TrialBalanceNormalizedV1,
  parseTrialBalanceNormalizedV1,
} from "../../shared/contracts/trial-balance.v1";

export type GenerateTaxAdjustmentsInputV1 = {
  annualReportExtraction: AnnualReportExtractionPayloadV1;
  annualReportTaxContext?: AnnualReportDownstreamTaxContextV1;
  annualReportExtractionArtifactId: string;
  mapping: MappingDecisionSetPayloadV1;
  mappingArtifactId: string;
  policyVersion: string;
  trialBalance: TrialBalanceNormalizedV1;
};

export type GenerateTaxAdjustmentsResultV1 =
  | {
      adjustments: TaxAdjustmentDecisionSetPayloadV1;
      ok: true;
    }
  | {
      error: {
        code: "INPUT_INVALID";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
      ok: false;
    };

const NON_DEDUCTIBLE_CATEGORY_CODES_V1 = new Set([
  "607200",
  "698200",
  "699300",
  "762300",
  "634200",
  "690000",
]);

const DEPRECIATION_CATEGORY_CODES_V1 = new Set([
  "885000",
  "397000",
  "777000",
  "782400",
  "784000",
]);

function roundToMinorUnitV1(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPositiveAdjustmentAmountV1(value: number): number {
  return roundToMinorUnitV1(Math.abs(value));
}

function buildManualReviewDecisionV1(input: {
  decisionId: string;
  moduleReason: string;
  sourceAccountNumber: string;
  decisionCategoryCode: string;
}): TaxAdjustmentDecisionSetPayloadV1["decisions"][number] {
  return {
    id: `adj-manual-${input.decisionId}`,
    module: "manual_review_bucket",
    amount: 0,
    direction: "informational",
    targetField: "INK2S.other_manual_adjustments",
    status: "manual_review_required",
    confidence: 1,
    reviewFlag: true,
    policyRuleReference: "adj.manual_review_bucket.v1",
    rationale: input.moduleReason,
    evidence: [
      {
        type: "mapping_decision",
        reference: input.decisionId,
        snippet: `${input.sourceAccountNumber} -> ${input.decisionCategoryCode}`,
      },
    ],
  };
}

function buildDecisionFromAiProposalV1(input: {
  proposal: TaxAdjustmentAiProposalDecisionV1;
  sourceAmount: number;
}): TaxAdjustmentDecisionV1 {
  if (input.proposal.module === "representation_entertainment") {
    return {
      id: input.proposal.decisionId,
      module: input.proposal.module,
      amount: roundToMinorUnitV1(
        toPositiveAdjustmentAmountV1(input.sourceAmount) * 0.1,
      ),
      direction: input.proposal.direction,
      targetField: input.proposal.targetField,
      status: input.proposal.reviewFlag ? "manual_review_required" : "proposed",
      confidence: input.proposal.confidence,
      reviewFlag: input.proposal.reviewFlag,
      policyRuleReference: input.proposal.policyRuleReference,
      rationale: input.proposal.rationale,
      evidence: [
        {
          type: "mapping_decision",
          reference: input.proposal.sourceMappingDecisionId,
          snippet: "AI proposal converted to deterministic representation adjustment.",
        },
      ],
    };
  }

  if (input.proposal.module === "depreciation_differences_basic") {
    return {
      id: input.proposal.decisionId,
      module: input.proposal.module,
      amount: 0,
      direction: input.proposal.direction,
      targetField: input.proposal.targetField,
      status: "manual_review_required",
      confidence: input.proposal.confidence,
      reviewFlag: true,
      policyRuleReference: input.proposal.policyRuleReference,
      rationale: input.proposal.rationale,
      evidence: [
        {
          type: "mapping_decision",
          reference: input.proposal.sourceMappingDecisionId,
          snippet: "AI proposal routed to deterministic depreciation review bucket.",
        },
      ],
    };
  }

  return {
    id: input.proposal.decisionId,
    module: input.proposal.module,
    amount: toPositiveAdjustmentAmountV1(input.sourceAmount),
    direction: input.proposal.direction,
    targetField: input.proposal.targetField,
    status: input.proposal.reviewFlag ? "manual_review_required" : "proposed",
    confidence: input.proposal.confidence,
    reviewFlag: input.proposal.reviewFlag,
    policyRuleReference: input.proposal.policyRuleReference,
    rationale: input.proposal.rationale,
    evidence: [
      {
        type: "mapping_decision",
        reference: input.proposal.sourceMappingDecisionId,
        snippet: "AI proposal converted to deterministic amount from trial balance.",
      },
    ],
  };
}

/**
 * Deterministic tax-adjustment engine for the first V1 adjustment module set.
 *
 * Safety boundary:
 * - Pure deterministic logic only; no AI calls or prompt-derived arithmetic.
 * - Unsupported or ambiguous cases are routed to `manual_review_bucket`.
 */
export function generateTaxAdjustmentsV1(
  input: unknown,
): GenerateTaxAdjustmentsResultV1 {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax-adjustment input payload is invalid.",
        user_message: "Adjustment input is invalid.",
        context: {},
      },
    };
  }

  const candidate = input as Partial<GenerateTaxAdjustmentsInputV1>;
  if (
    typeof candidate.policyVersion !== "string" ||
    candidate.policyVersion.trim().length === 0 ||
    typeof candidate.mappingArtifactId !== "string" ||
    candidate.mappingArtifactId.trim().length === 0 ||
    typeof candidate.annualReportExtractionArtifactId !== "string" ||
    candidate.annualReportExtractionArtifactId.trim().length === 0
  ) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax-adjustment input metadata is invalid.",
        user_message: "Adjustment input metadata is invalid.",
        context: {},
      },
    };
  }

  let mapping: MappingDecisionSetPayloadV1;
  let trialBalance: TrialBalanceNormalizedV1;
  let annualExtraction: AnnualReportExtractionPayloadV1;
  try {
    mapping = MappingDecisionSetPayloadV1Schema.parse(candidate.mapping);
    trialBalance = parseTrialBalanceNormalizedV1(candidate.trialBalance);
    annualExtraction = parseAnnualReportExtractionPayloadV1(
      candidate.annualReportExtraction,
    );
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Tax-adjustment input contracts are invalid.",
        user_message: "Adjustment input payload is invalid.",
        context: {
          message:
            error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }

  if (!annualExtraction.confirmation.isConfirmed) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "A usable annual report extraction is required before adjustments.",
        user_message:
          "Upload a complete annual report before running adjustments.",
        context: {},
      },
    };
  }

  const closingBalanceBySourceAccount = new Map<string, number>();
  for (const row of trialBalance.rows) {
    closingBalanceBySourceAccount.set(
      row.sourceAccountNumber,
      (closingBalanceBySourceAccount.get(row.sourceAccountNumber) ?? 0) +
        row.closingBalance,
    );
  }

  const decisions: TaxAdjustmentDecisionSetPayloadV1["decisions"] = [];
  for (const mappingDecision of mapping.decisions) {
    const selectedCode = mappingDecision.selectedCategory.code;
    const sourceAmount = closingBalanceBySourceAccount.get(
      mappingDecision.sourceAccountNumber,
    );
    const amount = typeof sourceAmount === "number" ? sourceAmount : 0;

    if (NON_DEDUCTIBLE_CATEGORY_CODES_V1.has(selectedCode)) {
      decisions.push({
        id: `adj-non-deductible-${mappingDecision.id}`,
        module: "non_deductible_expenses",
        amount: toPositiveAdjustmentAmountV1(amount),
        direction: "increase_taxable_income",
        targetField: "INK2S.non_deductible_expenses",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "adj.non_deductible_expenses.v1",
        rationale: "Mapped BAS category is configured as non-deductible in V1.",
        evidence: [
          {
            type: "mapping_decision",
            reference: mappingDecision.id,
            snippet: `${mappingDecision.sourceAccountNumber} -> ${selectedCode}`,
          },
        ],
      });
      continue;
    }

    if (selectedCode === "607100") {
      decisions.push({
        id: `adj-representation-${mappingDecision.id}`,
        module: "representation_entertainment",
        amount: roundToMinorUnitV1(toPositiveAdjustmentAmountV1(amount) * 0.1),
        direction: "increase_taxable_income",
        targetField: "INK2S.representation_non_deductible",
        status: "proposed",
        confidence: 0.9,
        reviewFlag: false,
        policyRuleReference: "adj.representation_entertainment.v1",
        rationale:
          "Representation adjustment uses deterministic V1 baseline rate (10%) pending policy expansion.",
        evidence: [
          {
            type: "mapping_decision",
            reference: mappingDecision.id,
            snippet: `${mappingDecision.sourceAccountNumber} -> 607100`,
          },
        ],
      });
      continue;
    }

    if (DEPRECIATION_CATEGORY_CODES_V1.has(selectedCode)) {
      decisions.push({
        id: `adj-depreciation-${mappingDecision.id}`,
        module: "depreciation_differences_basic",
        amount: 0,
        direction: "informational",
        targetField: "INK2S.depreciation_adjustment",
        status: "manual_review_required",
        confidence: 0.7,
        reviewFlag: true,
        policyRuleReference: "adj.depreciation_differences_basic.v1",
        rationale:
          "Depreciation differences need manual review in V1 unless full tax-vs-book basis is supplied.",
        evidence: [
          {
            type: "mapping_decision",
            reference: mappingDecision.id,
            snippet: `${mappingDecision.sourceAccountNumber} -> ${selectedCode}`,
          },
        ],
      });
      continue;
    }

    if (mappingDecision.reviewFlag) {
      decisions.push(
        buildManualReviewDecisionV1({
          decisionId: mappingDecision.id,
          sourceAccountNumber: mappingDecision.sourceAccountNumber,
          decisionCategoryCode: selectedCode,
          moduleReason:
            "Mapping decision was already flagged for review and requires manual tax treatment.",
        }),
      );
    }
  }

  const totalPositiveAdjustments = decisions
    .filter((decision) => decision.direction === "increase_taxable_income")
    .reduce((sum, decision) => sum + decision.amount, 0);
  const totalNegativeAdjustments = decisions
    .filter((decision) => decision.direction === "decrease_taxable_income")
    .reduce((sum, decision) => sum + Math.abs(decision.amount), 0);
  const totalNetAdjustments = roundToMinorUnitV1(
    totalPositiveAdjustments - totalNegativeAdjustments,
  );

  try {
    const adjustments = parseTaxAdjustmentDecisionSetPayloadV1({
      schemaVersion: "tax_adjustments_v1",
      policyVersion: candidate.policyVersion,
      generatedFrom: {
        mappingArtifactId: candidate.mappingArtifactId,
        annualReportExtractionArtifactId:
          candidate.annualReportExtractionArtifactId,
      },
      summary: {
        totalDecisions: decisions.length,
        manualReviewRequired: decisions.filter(
          (decision) => decision.status === "manual_review_required",
        ).length,
        totalPositiveAdjustments: roundToMinorUnitV1(totalPositiveAdjustments),
        totalNegativeAdjustments: roundToMinorUnitV1(totalNegativeAdjustments),
        totalNetAdjustments,
      },
      decisions,
    });

    return {
      ok: true,
      adjustments,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          "Generated adjustment payload did not pass contract validation.",
        user_message: "Generated adjustments are invalid.",
        context: {
          message:
            error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }
}

export function generateTaxAdjustmentsFromAiProposalsV1(input: {
  aiRuns: AiRunMetadataV1[];
  annualReportExtraction: AnnualReportExtractionPayloadV1;
  annualReportExtractionArtifactId: string;
  mapping: MappingDecisionSetPayloadV1;
  mappingArtifactId: string;
  policyVersion: string;
  proposals: TaxAdjustmentAiProposalDecisionV1[];
  trialBalance: TrialBalanceNormalizedV1;
}): GenerateTaxAdjustmentsResultV1 {
  const base = generateTaxAdjustmentsV1({
    annualReportExtraction: input.annualReportExtraction,
    annualReportExtractionArtifactId: input.annualReportExtractionArtifactId,
    mapping: input.mapping,
    mappingArtifactId: input.mappingArtifactId,
    policyVersion: input.policyVersion,
    trialBalance: input.trialBalance,
  });
  if (!base.ok) {
    return base;
  }

  const closingBalanceBySourceAccount = new Map<string, number>();
  for (const row of input.trialBalance.rows) {
    closingBalanceBySourceAccount.set(
      row.sourceAccountNumber,
      (closingBalanceBySourceAccount.get(row.sourceAccountNumber) ?? 0) +
        row.closingBalance,
    );
  }

  const nextDecisions = [
    ...base.adjustments.decisions.filter(
      (decision) => decision.module === "manual_review_bucket",
    ),
    ...input.proposals.map((proposal) =>
      buildDecisionFromAiProposalV1({
        proposal,
        sourceAmount:
          closingBalanceBySourceAccount.get(
            input.mapping.decisions.find(
              (decision) => decision.id === proposal.sourceMappingDecisionId,
            )?.sourceAccountNumber ?? "",
          ) ?? 0,
      }),
    ),
  ];

  const totalPositiveAdjustments = nextDecisions
    .filter((decision) => decision.direction === "increase_taxable_income")
    .reduce((sum, decision) => sum + decision.amount, 0);
  const totalNegativeAdjustments = nextDecisions
    .filter((decision) => decision.direction === "decrease_taxable_income")
    .reduce((sum, decision) => sum + Math.abs(decision.amount), 0);
  const totalNetAdjustments = roundToMinorUnitV1(
    totalPositiveAdjustments - totalNegativeAdjustments,
  );

  try {
    return {
      ok: true,
      adjustments: parseTaxAdjustmentDecisionSetPayloadV1({
        schemaVersion: "tax_adjustments_v1",
        policyVersion: input.policyVersion,
        aiRuns: input.aiRuns,
        generatedFrom: {
          mappingArtifactId: input.mappingArtifactId,
          annualReportExtractionArtifactId:
            input.annualReportExtractionArtifactId,
        },
        summary: {
          totalDecisions: nextDecisions.length,
          manualReviewRequired: nextDecisions.filter(
            (decision) => decision.status === "manual_review_required",
          ).length,
          totalPositiveAdjustments: roundToMinorUnitV1(totalPositiveAdjustments),
          totalNegativeAdjustments: roundToMinorUnitV1(totalNegativeAdjustments),
          totalNetAdjustments,
        },
        decisions: nextDecisions,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message:
          error instanceof Error
            ? error.message
            : "Generated AI adjustment payload is invalid.",
        user_message: "Generated AI adjustments are invalid.",
        context: {},
      },
    };
  }
}
