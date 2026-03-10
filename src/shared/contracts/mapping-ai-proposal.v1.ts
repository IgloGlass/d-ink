import { z } from "zod";

import { SilverfinTaxCategoryCodeV1Schema } from "./mapping.v1";

export const MappingAiProposalDecisionV1Schema = z
  .object({
    rowId: z.string().trim().min(1),
    selectedCategoryCode: SilverfinTaxCategoryCodeV1Schema,
    confidence: z.number().min(0).max(1),
    reviewFlag: z.boolean(),
    policyRuleReference: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  })
  .strict();
export type MappingAiProposalDecisionV1 = z.infer<
  typeof MappingAiProposalDecisionV1Schema
>;

export const MappingAiProposalResultV1Schema = z
  .object({
    schemaVersion: z.literal("mapping_ai_proposal_v1"),
    decisions: z.array(MappingAiProposalDecisionV1Schema),
  })
  .strict();
export type MappingAiProposalResultV1 = z.infer<
  typeof MappingAiProposalResultV1Schema
>;

export function parseMappingAiProposalResultV1(
  input: unknown,
): MappingAiProposalResultV1 {
  return MappingAiProposalResultV1Schema.parse(input);
}
