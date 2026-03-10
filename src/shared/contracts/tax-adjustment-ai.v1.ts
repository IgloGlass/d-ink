import { z } from "zod";

import {
  TaxAdjustmentDirectionV1Schema,
  TaxAdjustmentModuleCodeV1Schema,
  TaxAdjustmentTargetFieldV1Schema,
} from "./tax-adjustments.v1";

export const TaxAdjustmentAiProposalDecisionV1Schema = z
  .object({
    decisionId: z.string().trim().min(1),
    module: TaxAdjustmentModuleCodeV1Schema,
    sourceMappingDecisionId: z.string().trim().min(1),
    direction: TaxAdjustmentDirectionV1Schema,
    targetField: TaxAdjustmentTargetFieldV1Schema,
    reviewFlag: z.boolean(),
    confidence: z.number().min(0).max(1),
    policyRuleReference: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  })
  .strict();
export type TaxAdjustmentAiProposalDecisionV1 = z.infer<
  typeof TaxAdjustmentAiProposalDecisionV1Schema
>;

export const TaxAdjustmentAiProposalResultV1Schema = z
  .object({
    schemaVersion: z.literal("tax_adjustment_ai_proposal_v1"),
    decisions: z.array(TaxAdjustmentAiProposalDecisionV1Schema),
  })
  .strict();
export type TaxAdjustmentAiProposalResultV1 = z.infer<
  typeof TaxAdjustmentAiProposalResultV1Schema
>;

export function parseTaxAdjustmentAiProposalResultV1(
  input: unknown,
): TaxAdjustmentAiProposalResultV1 {
  return TaxAdjustmentAiProposalResultV1Schema.parse(input);
}
