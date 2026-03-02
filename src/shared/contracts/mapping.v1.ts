import { z } from "zod";

import { ReconciliationResultPayloadV1Schema } from "./reconciliation.v1";
import {
  TrialBalanceNormalizedV1Schema,
  TrialBalanceSourceLocationV1Schema,
} from "./trial-balance.v1";

/**
 * Statement type associated with a Silverfin tax category.
 */
export const SilverfinTaxCategoryStatementTypeV1Schema = z.enum([
  "balance_sheet",
  "income_statement",
]);

/**
 * Inferred TypeScript type for category statement types.
 */
export type SilverfinTaxCategoryStatementTypeV1 = z.infer<
  typeof SilverfinTaxCategoryStatementTypeV1Schema
>;

/**
 * Canonical Silverfin tax category account-number codes.
 *
 * These are internal identifiers and do not need to be shown in the UI.
 */
export const SilverfinTaxCategoryCodeV1Schema = z.enum([
  "100000",
  "102000",
  "111000",
  "115000",
  "123200",
  "131000",
  "138400",
  "138500",
  "141000",
  "141900",
  "151500",
  "211000",
  "215000",
  "221000",
  "222000",
  "229000",
  "251300",
  "294300",
  "294400",
  "367000",
  "367200",
  "394000",
  "397000",
  "397200",
  "399300",
  "399500",
  "519100",
  "521200",
  "522200",
  "598000",
  "607100",
  "607200",
  "634200",
  "636100",
  "636200",
  "655000",
  "657000",
  "690000",
  "698100",
  "698200",
  "699300",
  "740000",
  "753000",
  "762200",
  "762300",
  "777000",
  "782400",
  "784000",
  "797200",
  "801000",
  "802000",
  "808000",
  "831000",
  "831400",
  "842300",
  "843100",
  "843600",
  "849000",
  "881000",
  "881100",
  "881900",
  "882000",
  "883000",
  "885000",
  "891000",
  "940000",
  "950000",
]);

/**
 * Inferred TypeScript type for Silverfin tax category account-number codes.
 */
export type SilverfinTaxCategoryCodeV1 = z.infer<
  typeof SilverfinTaxCategoryCodeV1Schema
>;

type SilverfinTaxCategoryDefinitionV1 = {
  name: string;
  statementType: SilverfinTaxCategoryStatementTypeV1;
};

const SILVERFIN_TAX_CATEGORY_BY_CODE_V1: Record<
  SilverfinTaxCategoryCodeV1,
  SilverfinTaxCategoryDefinitionV1
> = {
  "100000": {
    name: "Non-tax sensitive - Balance",
    statementType: "balance_sheet",
  },
  "102000": {
    name: "Tangible and acquired intangible assets - opening/closing balance",
    statementType: "balance_sheet",
  },
  "111000": {
    name: "Buildings - Acquisition value",
    statementType: "balance_sheet",
  },
  "115000": {
    name: "Land improvements - Acquisition value",
    statementType: "balance_sheet",
  },
  "123200": {
    name: "Leaseholder's improvements - Acquisition value",
    statementType: "balance_sheet",
  },
  "131000": {
    name: "Shares and shareholdings - General balance sheet item",
    statementType: "balance_sheet",
  },
  "138400": {
    name: "Change in value and write-downs on capital assets - General balance sheet item",
    statementType: "balance_sheet",
  },
  "138500": {
    name: "Endowment insurance",
    statementType: "balance_sheet",
  },
  "141000": {
    name: "Inventory - Acquisition value",
    statementType: "balance_sheet",
  },
  "141900": {
    name: "Inventory - Obsolescence reserve",
    statementType: "balance_sheet",
  },
  "151500": {
    name: "Doubtful debts",
    statementType: "balance_sheet",
  },
  "211000": {
    name: "Tax allocation reserve",
    statementType: "balance_sheet",
  },
  "215000": {
    name: "Accelerated depreciation - tangible/acquired intangible assets",
    statementType: "balance_sheet",
  },
  "221000": {
    name: "Basis for yield tax",
    statementType: "balance_sheet",
  },
  "222000": {
    name: "Warranty provision",
    statementType: "balance_sheet",
  },
  "229000": {
    name: "Other provisions",
    statementType: "balance_sheet",
  },
  "251300": {
    name: "Property tax and property fee",
    statementType: "balance_sheet",
  },
  "294300": {
    name: "Accrued special payroll tax on pension",
    statementType: "balance_sheet",
  },
  "294400": {
    name: "Accrued yield tax on pension",
    statementType: "balance_sheet",
  },
  "367000": {
    name: "Financial inventory assets - Capital gain/loss",
    statementType: "income_statement",
  },
  "367200": {
    name: "Financial inventory assets - dividend",
    statementType: "income_statement",
  },
  "394000": {
    name: "Change in value and write-downs on capital assets",
    statementType: "income_statement",
  },
  "397000": {
    name: "Tangible/acquired intangible assets - booked depreciation",
    statementType: "income_statement",
  },
  "397200": {
    name: "Buildings and land - capital gain",
    statementType: "income_statement",
  },
  "399300": {
    name: "Received gifts and donations - non-taxable",
    statementType: "income_statement",
  },
  "399500": {
    name: "Composition agreement - non-taxable",
    statementType: "income_statement",
  },
  "519100": {
    name: "Property tax and property fee",
    statementType: "income_statement",
  },
  "521200": {
    name: "Interest - financial leasing - income",
    statementType: "income_statement",
  },
  "522200": {
    name: "Interest - financial leasing - cost",
    statementType: "income_statement",
  },
  "598000": {
    name: "Sponsorship, donations and gifts - presumed deductible",
    statementType: "income_statement",
  },
  "607100": {
    name: "Entertainment - internal and external - presumed deductible",
    statementType: "income_statement",
  },
  "607200": {
    name: "Entertainment - internal and external - presumed non-deductible",
    statementType: "income_statement",
  },
  "634200": {
    name: "Sanctions and penalties",
    statementType: "income_statement",
  },
  "636100": {
    name: "Warranty provision - Change in warranty provision",
    statementType: "income_statement",
  },
  "636200": {
    name: "Warranty provision - Actual costs",
    statementType: "income_statement",
  },
  "655000": {
    name: "Consulting fees",
    statementType: "income_statement",
  },
  "657000": {
    name: "Interest - Banking costs",
    statementType: "income_statement",
  },
  "690000": {
    name: "Other non-deductible costs",
    statementType: "income_statement",
  },
  "698100": {
    name: "Membership fees - presumed deductible",
    statementType: "income_statement",
  },
  "698200": {
    name: "Membership fees - presumed non-deductible",
    statementType: "income_statement",
  },
  "699300": {
    name: "Sponsorship, donations and gifts - presumed non-deductible",
    statementType: "income_statement",
  },
  "740000": {
    name: "Pension costs and basis for special payroll tax on pension cost",
    statementType: "income_statement",
  },
  "753000": {
    name: "Special payroll tax on pension cost",
    statementType: "income_statement",
  },
  "762200": {
    name: "Health care - presumed deductible",
    statementType: "income_statement",
  },
  "762300": {
    name: "Health care - presumed non-deductible",
    statementType: "income_statement",
  },
  "777000": {
    name: "Buildings - booked depreciation",
    statementType: "income_statement",
  },
  "782400": {
    name: "Land improvement - booked depreciation",
    statementType: "income_statement",
  },
  "784000": {
    name: "Leaseholder's improvements - booked depreciation",
    statementType: "income_statement",
  },
  "797200": {
    name: "Buildings and land - capital loss",
    statementType: "income_statement",
  },
  "801000": {
    name: "Capital assets (Shares) - Dividend",
    statementType: "income_statement",
  },
  "802000": {
    name: "Capital assets (Shares) - Capital gain/loss",
    statementType: "income_statement",
  },
  "808000": {
    name: "Capital assets (Shares) - Unrealized change in value",
    statementType: "income_statement",
  },
  "831000": {
    name: "Interest - interest income",
    statementType: "income_statement",
  },
  "831400": {
    name: "Interest income on the tax account",
    statementType: "income_statement",
  },
  "842300": {
    name: "Interest cost on the tax account",
    statementType: "income_statement",
  },
  "843100": {
    name: "Interest - FX-gain",
    statementType: "income_statement",
  },
  "843600": {
    name: "Interest - FX-loss",
    statementType: "income_statement",
  },
  "849000": {
    name: "Interest - Interest cost",
    statementType: "income_statement",
  },
  "881000": {
    name: "Tax allocation reserve - this year's change",
    statementType: "income_statement",
  },
  "881100": {
    name: "Tax allocation reserve - allocation",
    statementType: "income_statement",
  },
  "881900": {
    name: "Tax allocation reserve - reversal",
    statementType: "income_statement",
  },
  "882000": {
    name: "Group contribution - received",
    statementType: "income_statement",
  },
  "883000": {
    name: "Group contribution - provided",
    statementType: "income_statement",
  },
  "885000": {
    name: "Accelerated depreciation - tangible/acquired intangible assets",
    statementType: "income_statement",
  },
  "891000": {
    name: "Tax cost",
    statementType: "income_statement",
  },
  "940000": {
    name: "Result of the year",
    statementType: "income_statement",
  },
  "950000": {
    name: "Non-tax sensitive - Profit and loss statement",
    statementType: "income_statement",
  },
};

/**
 * Silverfin tax category reference linking user-facing category name to internal account-number code.
 */
export const SilverfinTaxCategoryReferenceV1Schema = z
  .object({
    code: SilverfinTaxCategoryCodeV1Schema,
    name: z.string().trim().min(1),
    statementType: SilverfinTaxCategoryStatementTypeV1Schema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedDefinition = SILVERFIN_TAX_CATEGORY_BY_CODE_V1[value.code];

    if (value.name !== expectedDefinition.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Category name does not match canonical name for code ${value.code}.`,
        path: ["name"],
      });
    }

    if (value.statementType !== expectedDefinition.statementType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Statement type does not match canonical statement type for code ${value.code}.`,
        path: ["statementType"],
      });
    }
  });

/**
 * Inferred TypeScript type for linked Silverfin tax categories.
 */
export type SilverfinTaxCategoryReferenceV1 = z.infer<
  typeof SilverfinTaxCategoryReferenceV1Schema
>;

/**
 * Lists the canonical Silverfin tax category catalog for deterministic mapping.
 */
export function listSilverfinTaxCategoriesV1(): SilverfinTaxCategoryReferenceV1[] {
  return SilverfinTaxCategoryCodeV1Schema.options.map((code) =>
    getSilverfinTaxCategoryByCodeV1(code),
  );
}

/**
 * Resolves a canonical Silverfin category reference by category code.
 */
export function getSilverfinTaxCategoryByCodeV1(
  code: SilverfinTaxCategoryCodeV1,
): SilverfinTaxCategoryReferenceV1 {
  const definition = SILVERFIN_TAX_CATEGORY_BY_CODE_V1[code];
  return {
    code,
    name: definition.name,
    statementType: definition.statementType,
  };
}

/**
 * Deterministic evidence types for mapping decisions.
 */
export const MappingEvidenceTypeV1Schema = z.enum([
  "tb_row",
  "account_number_exact",
  "account_number_prefix",
  "account_name_keyword",
  "statement_type_inference",
  "fallback_category",
  "manual_note",
]);

/**
 * Inferred TypeScript type for mapping evidence types.
 */
export type MappingEvidenceTypeV1 = z.infer<typeof MappingEvidenceTypeV1Schema>;

/**
 * Evidence item for deterministic or manual mapping decisions.
 */
export const MappingDecisionEvidenceV1Schema = z
  .object({
    type: MappingEvidenceTypeV1Schema,
    reference: z.string().trim().min(1),
    snippet: z.string().trim().min(1).optional(),
    source: TrialBalanceSourceLocationV1Schema.optional(),
    matchedValue: z.string().trim().min(1).optional(),
    weight: z.number().finite().optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping decision evidence.
 */
export type MappingDecisionEvidenceV1 = z.infer<
  typeof MappingDecisionEvidenceV1Schema
>;

/**
 * Override scope for manual category overrides.
 */
export const MappingDecisionOverrideScopeV1Schema = z.enum([
  "return",
  "group",
  "user",
]);

/**
 * Inferred TypeScript type for override scope.
 */
export type MappingDecisionOverrideScopeV1 = z.infer<
  typeof MappingDecisionOverrideScopeV1Schema
>;

/**
 * Manual override metadata for mapping decisions.
 */
export const MappingDecisionOverrideV1Schema = z
  .object({
    scope: MappingDecisionOverrideScopeV1Schema,
    reason: z.string().trim().min(1),
    author: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * Inferred TypeScript type for manual overrides.
 */
export type MappingDecisionOverrideV1 = z.infer<
  typeof MappingDecisionOverrideV1Schema
>;

/**
 * Mapping decision lifecycle status.
 */
export const MappingDecisionStatusV1Schema = z.enum([
  "proposed",
  "confirmed",
  "overridden",
]);

/**
 * Inferred TypeScript type for mapping decision status.
 */
export type MappingDecisionStatusV1 = z.infer<
  typeof MappingDecisionStatusV1Schema
>;

/**
 * Source origin of a mapping decision.
 */
export const MappingDecisionSourceV1Schema = z.enum([
  "deterministic",
  "manual",
]);

/**
 * Inferred TypeScript type for mapping decision source.
 */
export type MappingDecisionSourceV1 = z.infer<
  typeof MappingDecisionSourceV1Schema
>;

/**
 * Deterministic or manual account-to-tax-category mapping decision.
 */
export const MappingDecisionV1Schema = z
  .object({
    id: z.string().trim().min(1),
    accountNumber: z.string().trim().min(1),
    sourceAccountNumber: z.string().trim().min(1),
    accountName: z.string().trim().min(1),
    proposedCategory: SilverfinTaxCategoryReferenceV1Schema,
    selectedCategory: SilverfinTaxCategoryReferenceV1Schema,
    confidence: z.number().min(0).max(1),
    evidence: z.array(MappingDecisionEvidenceV1Schema).min(1),
    policyRuleReference: z.string().trim().min(1),
    reviewFlag: z.boolean(),
    status: MappingDecisionStatusV1Schema,
    source: MappingDecisionSourceV1Schema,
    override: MappingDecisionOverrideV1Schema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const selectedMatchesProposed =
      value.selectedCategory.code === value.proposedCategory.code;

    if (value.status === "overridden" && !value.override) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Overridden mapping decisions must include override scope and reason.",
        path: ["override"],
      });
    }

    if (value.status !== "overridden" && !selectedMatchesProposed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Selected category can differ from proposed category only when status is overridden.",
        path: ["selectedCategory"],
      });
    }
  });

/**
 * Inferred TypeScript type for mapping decisions.
 */
export type MappingDecisionV1 = z.infer<typeof MappingDecisionV1Schema>;

/**
 * Request payload for deterministic mapping generation.
 */
export const GenerateMappingDecisionsRequestV1Schema = z
  .object({
    trialBalance: TrialBalanceNormalizedV1Schema,
    reconciliation: ReconciliationResultPayloadV1Schema,
    policyVersion: z.string().trim().min(1),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping generation requests.
 */
export type GenerateMappingDecisionsRequestV1 = z.infer<
  typeof GenerateMappingDecisionsRequestV1Schema
>;

/**
 * Summary counters for deterministic mapping output.
 */
export const MappingDecisionSummaryV1Schema = z
  .object({
    totalRows: z.number().int().nonnegative(),
    deterministicDecisions: z.number().int().nonnegative(),
    manualReviewRequired: z.number().int().nonnegative(),
    fallbackDecisions: z.number().int().nonnegative(),
    matchedByAccountNumber: z.number().int().nonnegative(),
    matchedByAccountName: z.number().int().nonnegative(),
    unmatchedRows: z.number().int().nonnegative(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping decision summaries.
 */
export type MappingDecisionSummaryV1 = z.infer<
  typeof MappingDecisionSummaryV1Schema
>;

/**
 * Deterministic mapping decision payload.
 */
export const MappingDecisionSetPayloadV1Schema = z
  .object({
    schemaVersion: z.literal("mapping_decisions_v1"),
    policyVersion: z.string().trim().min(1),
    summary: MappingDecisionSummaryV1Schema,
    decisions: z.array(MappingDecisionV1Schema),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping decision payloads.
 */
export type MappingDecisionSetPayloadV1 = z.infer<
  typeof MappingDecisionSetPayloadV1Schema
>;

/**
 * Structured mapping error codes.
 */
export const GenerateMappingDecisionsErrorCodeV1Schema = z.enum([
  "INPUT_INVALID",
  "RECONCILIATION_BLOCKED",
]);

/**
 * Inferred TypeScript type for mapping error codes.
 */
export type GenerateMappingDecisionsErrorCodeV1 = z.infer<
  typeof GenerateMappingDecisionsErrorCodeV1Schema
>;

/**
 * Failure payload for mapping generation.
 */
export const GenerateMappingDecisionsFailureV1Schema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: GenerateMappingDecisionsErrorCodeV1Schema,
        message: z.string().trim().min(1),
        user_message: z.string().trim().min(1),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * Inferred TypeScript type for mapping generation failures.
 */
export type GenerateMappingDecisionsFailureV1 = z.infer<
  typeof GenerateMappingDecisionsFailureV1Schema
>;

/**
 * Success payload for mapping generation.
 */
export const GenerateMappingDecisionsSuccessV1Schema = z
  .object({
    ok: z.literal(true),
    mapping: MappingDecisionSetPayloadV1Schema,
  })
  .strict();

/**
 * Inferred TypeScript type for mapping generation successes.
 */
export type GenerateMappingDecisionsSuccessV1 = z.infer<
  typeof GenerateMappingDecisionsSuccessV1Schema
>;

/**
 * Discriminated result payload for mapping generation.
 */
export const GenerateMappingDecisionsResultV1Schema = z.discriminatedUnion(
  "ok",
  [
    GenerateMappingDecisionsSuccessV1Schema,
    GenerateMappingDecisionsFailureV1Schema,
  ],
);

/**
 * Inferred TypeScript type for mapping generation results.
 */
export type GenerateMappingDecisionsResultV1 = z.infer<
  typeof GenerateMappingDecisionsResultV1Schema
>;

/**
 * Parses unknown input into linked Silverfin tax category references.
 */
export function parseSilverfinTaxCategoryReferenceV1(
  input: unknown,
): SilverfinTaxCategoryReferenceV1 {
  return SilverfinTaxCategoryReferenceV1Schema.parse(input);
}

/**
 * Safely validates unknown input as linked Silverfin tax category references.
 */
export function safeParseSilverfinTaxCategoryReferenceV1(
  input: unknown,
): z.SafeParseReturnType<unknown, SilverfinTaxCategoryReferenceV1> {
  return SilverfinTaxCategoryReferenceV1Schema.safeParse(input);
}

/**
 * Parses unknown input into mapping decisions.
 */
export function parseMappingDecisionV1(input: unknown): MappingDecisionV1 {
  return MappingDecisionV1Schema.parse(input);
}

/**
 * Safely validates unknown input as mapping decisions.
 */
export function safeParseMappingDecisionV1(
  input: unknown,
): z.SafeParseReturnType<unknown, MappingDecisionV1> {
  return MappingDecisionV1Schema.safeParse(input);
}

/**
 * Parses unknown input into deterministic mapping generation requests.
 */
export function parseGenerateMappingDecisionsRequestV1(
  input: unknown,
): GenerateMappingDecisionsRequestV1 {
  return GenerateMappingDecisionsRequestV1Schema.parse(input);
}

/**
 * Safely validates unknown input as deterministic mapping generation requests.
 */
export function safeParseGenerateMappingDecisionsRequestV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GenerateMappingDecisionsRequestV1> {
  return GenerateMappingDecisionsRequestV1Schema.safeParse(input);
}

/**
 * Parses unknown input into deterministic mapping generation results.
 */
export function parseGenerateMappingDecisionsResultV1(
  input: unknown,
): GenerateMappingDecisionsResultV1 {
  return GenerateMappingDecisionsResultV1Schema.parse(input);
}

/**
 * Safely validates unknown input as deterministic mapping generation results.
 */
export function safeParseGenerateMappingDecisionsResultV1(
  input: unknown,
): z.SafeParseReturnType<unknown, GenerateMappingDecisionsResultV1> {
  return GenerateMappingDecisionsResultV1Schema.safeParse(input);
}
