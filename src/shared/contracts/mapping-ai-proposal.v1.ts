import { z } from "zod";

import {
  MappingAnnualReportContextAreaV1Schema,
  MappingAnnualReportContextReferenceV1Schema,
  SilverfinTaxCategoryCodeV1Schema,
} from "./mapping.v1";

export const MappingAiProposalDecisionV1Schema = z
  .object({
    rowId: z.string().trim().min(1),
    selectedCategoryCode: SilverfinTaxCategoryCodeV1Schema,
    confidence: z.number().min(0).max(1),
    reviewFlag: z.boolean(),
    policyRuleReference: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    annualReportContextReferences: z
      .array(MappingAnnualReportContextReferenceV1Schema)
      .default([]),
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

const MappingAiProposalProviderContextReferenceV1Schema = z
  .object({
    area: MappingAnnualReportContextAreaV1Schema,
    reference: z.string().trim().optional().nullable(),
  })
  .strict();

const MappingAiProposalProviderDecisionV1Schema = z
  .object({
    rowId: z.string().trim().min(1),
    selectedCategoryCode: SilverfinTaxCategoryCodeV1Schema,
    confidence: z.number().min(0).max(1),
    reviewFlag: z.boolean(),
    policyRuleReference: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    annualReportContextReferences: z
      .array(MappingAiProposalProviderContextReferenceV1Schema)
      .default([]),
  })
  .strict();

/**
 * Provider-facing schema that tolerates version-label drift while still
 * enforcing strict decision payload structure.
 */
export const MappingAiProposalProviderResultV1Schema = z
  .object({
    schemaVersion: z.string().trim().optional(),
    decisions: z.array(MappingAiProposalProviderDecisionV1Schema),
  })
  .strict();

function normalizeAnnualReportContextReferencesV1(
  value: unknown,
): Array<z.infer<typeof MappingAnnualReportContextReferenceV1Schema>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((reference) => {
    const parsed =
      MappingAiProposalProviderContextReferenceV1Schema.safeParse(reference);
    if (!parsed.success) {
      return [];
    }

    const normalizedReference = parsed.data.reference?.trim() ?? "";
    if (normalizedReference.length === 0) {
      return [];
    }

    return [
      {
        area: parsed.data.area,
        reference: normalizedReference,
      },
    ];
  });
}

export function parseMappingAiProposalResultV1(
  input: unknown,
): MappingAiProposalResultV1 {
  // Gemini occasionally returns the right payload shape with a variant
  // schemaVersion string. Keep the contract strict for decision fields while
  // canonicalizing the version tag to avoid unnecessary full-run fallback.
  if (input && typeof input === "object") {
    const candidate = input as {
      decisions?: unknown;
      schemaVersion?: unknown;
    };
    if (Array.isArray(candidate.decisions)) {
      return MappingAiProposalResultV1Schema.parse({
        schemaVersion: "mapping_ai_proposal_v1",
        decisions: candidate.decisions.map((decision) => {
          const parsedDecision =
            MappingAiProposalProviderDecisionV1Schema.parse(decision);

          return {
            ...parsedDecision,
            annualReportContextReferences: normalizeAnnualReportContextReferencesV1(
              parsedDecision.annualReportContextReferences,
            ),
          };
        }),
      });
    }
  }

  return MappingAiProposalResultV1Schema.parse(input);
}
