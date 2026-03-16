import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import type { AnnualReportDownstreamTaxContextV1 } from "../../shared/contracts/annual-report-tax-context.v1";
import {
  type MappingDecisionSetArtifactV1,
  parseMappingDecisionSetArtifactV1,
} from "../../shared/contracts/mapping.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  type TaxAdjustmentDecisionV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import type { TaxAdjustmentAiProposalDecisionV1 } from "../../shared/contracts/tax-adjustment-ai.v1";
import type { AiRunMetadataV1 } from "../../shared/contracts/ai-run.v1";
import {
  type TrialBalanceNormalizedArtifactV1,
  parseTrialBalanceNormalizedV1,
} from "../../shared/contracts/trial-balance.v1";
import {
  projectRoutedTaxAdjustmentCandidatesV1,
} from "./tax-adjustment-submodule-routing.v1";

export type GenerateTaxAdjustmentsInputV1 = {
  annualReportExtraction: AnnualReportExtractionPayloadV1;
  annualReportTaxContext?: AnnualReportDownstreamTaxContextV1;
  annualReportExtractionArtifactId: string;
  mapping: MappingDecisionSetArtifactV1;
  mappingArtifactId: string;
  policyVersion: string;
  trialBalance: TrialBalanceNormalizedArtifactV1;
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

function roundToMinorUnitV1(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPositiveAdjustmentAmountV1(value: number): number {
  return roundToMinorUnitV1(Math.abs(value));
}

function buildManualReviewDecisionV1(input: {
  accountName: string;
  accountNumber: string;
  closingBalance: number;
  decisionId: string;
  direction: TaxAdjustmentDecisionV1["direction"];
  module: TaxAdjustmentDecisionV1["module"];
  moduleReason: string;
  sourceAccountNumber: string;
  targetField: TaxAdjustmentDecisionV1["targetField"];
  decisionCategoryCode: string;
  rowResolutionReason?: string;
}): TaxAdjustmentDecisionSetPayloadV1["decisions"][number] {
  return {
    id: `adj-manual-${input.decisionId}`,
    module: input.module,
    amount: 0,
    direction: input.direction,
    targetField: input.targetField,
    status: "manual_review_required",
    confidence: 1,
    reviewFlag: true,
    policyRuleReference: `adj.${input.module}.manual_review.v1`,
    rationale: input.rowResolutionReason
      ? `${input.moduleReason} ${input.rowResolutionReason}`
      : input.moduleReason,
    evidence: [
      {
        type: "mapping_decision",
        reference: input.decisionId,
        snippet: `${input.accountNumber} ${input.accountName} (${input.closingBalance}) -> ${input.decisionCategoryCode}`,
      },
    ],
  };
}

function buildDecisionFromAiProposalV1(input: {
  proposal: TaxAdjustmentAiProposalDecisionV1;
  sourceAmount: number;
}): TaxAdjustmentDecisionV1 {
  if (input.proposal.targetField === "INK2S.representation_non_deductible") {
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

  if (
    input.proposal.direction === "informational" ||
    input.proposal.targetField === "INK2S.depreciation_adjustment" ||
    input.proposal.targetField === "INK2S.other_manual_adjustments"
  ) {
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
          snippet: "AI proposal routed to a reviewable canonical adjustment module.",
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

function getSourceMappingDecisionIdFromAdjustmentV1(
  decision: TaxAdjustmentDecisionV1,
): string | null {
  return (
    decision.evidence.find((evidence) => evidence.type === "mapping_decision")
      ?.reference ?? null
  );
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

  let mapping: MappingDecisionSetArtifactV1;
  let trialBalance: TrialBalanceNormalizedArtifactV1;
  let annualExtraction: AnnualReportExtractionPayloadV1;
  try {
    mapping = parseMappingDecisionSetArtifactV1(candidate.mapping);
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

  const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
    mapping,
    trialBalance,
  });
  const routedCandidateByDecisionId = new Map(
    routedCandidates.map((candidate) => [candidate.mappingDecisionId, candidate]),
  );
  const decisions: TaxAdjustmentDecisionSetPayloadV1["decisions"] = [];
  for (const mappingDecision of mapping.decisions) {
    const selectedCode = mappingDecision.selectedCategory.code;
    const routedCandidate = routedCandidateByDecisionId.get(mappingDecision.id);
    if (routedCandidate) {
      if (
        routedCandidate.rowResolutionStatus !== "matched" ||
        mappingDecision.reviewFlag ||
        routedCandidate.decisionMode === "manual_review"
      ) {
        decisions.push(
          buildManualReviewDecisionV1({
            accountName: routedCandidate.accountName,
            accountNumber: routedCandidate.accountNumber,
            closingBalance: routedCandidate.closingBalance,
            decisionId: mappingDecision.id,
            direction: routedCandidate.direction,
            module: routedCandidate.moduleCode,
            moduleReason:
              routedCandidate.rowResolutionStatus !== "matched"
                ? "The mapped row could not be re-linked to a unique active trial-balance row, so downstream routing is blocked pending review."
                : mappingDecision.reviewFlag
                ? "Mapping decision was flagged for review and has been routed into its canonical tax-adjustment submodule."
                : "This canonical tax-adjustment submodule is wired for review routing in V1 but still requires manual treatment.",
            rowResolutionReason: routedCandidate.rowResolutionReason,
            sourceAccountNumber: routedCandidate.sourceAccountNumber,
            targetField: routedCandidate.targetField,
            decisionCategoryCode: selectedCode,
          }),
        );
        continue;
      }

      if (routedCandidate.decisionMode === "full_amount") {
        decisions.push({
          id: `adj-${routedCandidate.moduleCode}-${mappingDecision.id}`,
          module: routedCandidate.moduleCode,
          amount: toPositiveAdjustmentAmountV1(routedCandidate.closingBalance),
          direction: routedCandidate.direction,
          targetField: routedCandidate.targetField,
          status: "proposed",
          confidence: 1,
          reviewFlag: false,
          policyRuleReference: `adj.${routedCandidate.moduleCode}.full_amount.v1`,
          rationale:
            "Canonical routing marks this mapped category as a full-amount adjustment in V1.",
          evidence: [
            {
              type: "mapping_decision",
              reference: mappingDecision.id,
              snippet: `${routedCandidate.sourceAccountNumber} -> ${selectedCode}`,
            },
          ],
        });
        continue;
      }

      if (routedCandidate.decisionMode === "representation_10_percent") {
        decisions.push({
          id: `adj-${routedCandidate.moduleCode}-${mappingDecision.id}`,
          module: routedCandidate.moduleCode,
          amount: roundToMinorUnitV1(
            toPositiveAdjustmentAmountV1(routedCandidate.closingBalance) * 0.1,
          ),
          direction: routedCandidate.direction,
          targetField: routedCandidate.targetField,
          status: "proposed",
          confidence: 0.9,
          reviewFlag: false,
          policyRuleReference: `adj.${routedCandidate.moduleCode}.representation_10_percent.v1`,
          rationale:
            "Canonical routing marks deductible representation for the V1 10 percent baseline adjustment.",
          evidence: [
            {
              type: "mapping_decision",
              reference: mappingDecision.id,
              snippet: `${routedCandidate.sourceAccountNumber} -> ${selectedCode}`,
            },
          ],
        });
        continue;
      }
    }

    if (mappingDecision.reviewFlag) {
      decisions.push({
        id: `adj-manual-${mappingDecision.id}`,
        module: "manual_review_bucket",
        amount: 0,
        direction: "informational",
        targetField: "INK2S.other_manual_adjustments",
        status: "manual_review_required",
        confidence: 1,
        reviewFlag: true,
        policyRuleReference: "adj.manual_review_bucket.v1",
        rationale:
          "This mapped row does not route to a canonical adjustment submodule and remains in the manual review bucket.",
        evidence: [
          {
            type: "mapping_decision",
            reference: mappingDecision.id,
            snippet: `${mappingDecision.sourceAccountNumber} -> ${selectedCode}`,
          },
        ],
      });
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
  mapping: MappingDecisionSetArtifactV1;
  mappingArtifactId: string;
  policyVersion: string;
  proposals: TaxAdjustmentAiProposalDecisionV1[];
  trialBalance: TrialBalanceNormalizedArtifactV1;
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

  const routedCandidates = projectRoutedTaxAdjustmentCandidatesV1({
    mapping: input.mapping,
    trialBalance: input.trialBalance,
  });
  const candidateByDecisionId = new Map(
    routedCandidates.map((candidate) => [candidate.mappingDecisionId, candidate]),
  );
  const proposalDecisionIds = new Set(
    input.proposals.map((proposal) => proposal.sourceMappingDecisionId),
  );

  const nextDecisions = [
    ...base.adjustments.decisions.filter((decision) => {
      const sourceMappingDecisionId = getSourceMappingDecisionIdFromAdjustmentV1(
        decision,
      );
      return (
        sourceMappingDecisionId === null ||
        !proposalDecisionIds.has(sourceMappingDecisionId)
      );
    }),
    ...input.proposals.map((proposal) =>
      buildDecisionFromAiProposalV1({
        proposal,
        sourceAmount:
          candidateByDecisionId.get(proposal.sourceMappingDecisionId)
            ?.closingBalance ?? 0,
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
