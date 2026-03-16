import type { AnnualReportDownstreamTaxContextV1 } from "../../shared/contracts/annual-report-tax-context.v1";
import type {
  MappingDecisionRecordV1,
  MappingDecisionSetArtifactV1,
  MappingDecisionV2,
  SilverfinTaxCategoryCodeV1,
} from "../../shared/contracts/mapping.v1";
import {
  getSilverfinTaxCategoryByCodeV1,
  listSilverfinTaxCategoriesV1,
} from "../../shared/contracts/mapping.v1";
import type {
  TrialBalanceNormalizedArtifactV1,
  TrialBalanceNormalizedRowArtifactV1,
} from "../../shared/contracts/trial-balance.v1";
import {
  buildAnnualReportContextLineageV1,
  buildMappedAdjustmentRowIdentityV1,
  parseMappedAdjustmentCandidateV1,
  parseTaxAdjustmentCategoryDispositionRecordV1,
  parseTaxAdjustmentModuleContextV1,
  type MappedAdjustmentCandidateV1,
  type TaxAdjustmentBridgeAiModuleV1,
  type TaxAdjustmentCategoryDecisionModeV1,
  type TaxAdjustmentCategoryDispositionRecordV1,
  type TaxAdjustmentCategoryDispositionStatusV1,
  type TaxAdjustmentCategoryRouteV1,
  type TaxAdjustmentModuleContextAreaV1,
  type TaxAdjustmentModuleContextV1,
} from "../../shared/contracts/tax-adjustment-routing.v1";
import type {
  TaxAdjustmentDirectionV1,
  TaxAdjustmentModuleCodeV1,
  TaxAdjustmentTargetFieldV1,
} from "../../shared/contracts/tax-adjustments.v1";

type RouteGroupInputV1 = {
  bridgeAiModule: TaxAdjustmentBridgeAiModuleV1 | null;
  categoryCodes: readonly SilverfinTaxCategoryCodeV1[];
  contextAreas: readonly TaxAdjustmentModuleContextAreaV1[];
  decisionMode: TaxAdjustmentCategoryDecisionModeV1;
  direction: TaxAdjustmentDirectionV1;
  moduleCode: TaxAdjustmentModuleCodeV1;
  targetField: TaxAdjustmentTargetFieldV1;
};

const NON_ROUTED_CATEGORY_CODES_V1: readonly SilverfinTaxCategoryCodeV1[] = [
  "100000",
  "950000",
];

function createRouteGroupV1(
  input: RouteGroupInputV1,
): TaxAdjustmentCategoryRouteV1[] {
  return input.categoryCodes.map((categoryCode) => ({
    bridgeAiModule: input.bridgeAiModule,
    categoryCode,
    contextAreas: [...input.contextAreas],
    decisionMode: input.decisionMode,
    direction: input.direction,
    moduleCode: input.moduleCode,
    targetField: input.targetField,
  }));
}

export const TAX_ADJUSTMENT_CATEGORY_ROUTES_V1: readonly TaxAdjustmentCategoryRouteV1[] =
  [
    ...createRouteGroupV1({
      bridgeAiModule: "depreciation_differences_basic",
      categoryCodes: ["102000", "215000", "397000", "885000"],
      contextAreas: [
        "balanceSheetAnchors",
        "incomeStatementAnchors",
        "depreciationContext",
        "assetMovements",
      ],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "depreciation_tangible_and_acquired_intangible_assets",
      targetField: "INK2S.depreciation_adjustment",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["111000", "115000", "123200", "397200", "797200"],
      contextAreas: [
        "balanceSheetAnchors",
        "incomeStatementAnchors",
        "depreciationContext",
        "assetMovements",
      ],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "buildings_improvements_property_gains",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: "depreciation_differences_basic",
      categoryCodes: ["777000", "782400", "784000"],
      contextAreas: [
        "balanceSheetAnchors",
        "incomeStatementAnchors",
        "depreciationContext",
        "assetMovements",
      ],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "buildings_improvements_property_gains",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["131000", "801000", "802000"],
      contextAreas: ["shareholdingContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "shares_and_participations",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["138400", "367000", "367200", "394000", "808000"],
      contextAreas: ["shareholdingContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "capital_assets_and_unrealized_changes",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["138500", "221000", "294400"],
      contextAreas: ["pensionContext", "taxExpenseContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "yield_risk_and_renewable_energy_taxes",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["141000", "141900"],
      contextAreas: ["balanceSheetAnchors"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "inventory_obsolescence_reserve",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["151500", "229000"],
      contextAreas: ["reserveContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "provisions",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["211000", "881000", "881100", "881900"],
      contextAreas: ["reserveContext", "taxExpenseContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "notional_income_on_tax_allocation_reserve",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["222000", "636100", "636200"],
      contextAreas: ["reserveContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "warranty_provision",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["251300", "519100"],
      contextAreas: ["balanceSheetAnchors"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "property_tax_and_property_fee",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: "non_deductible_expenses",
      categoryCodes: ["607200", "634200", "690000", "698200", "699300", "762300"],
      contextAreas: ["taxExpenseContext"],
      decisionMode: "full_amount",
      direction: "increase_taxable_income",
      moduleCode: "disallowed_expenses",
      targetField: "INK2S.non_deductible_expenses",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: "representation_entertainment",
      categoryCodes: ["607100"],
      contextAreas: ["taxExpenseContext"],
      decisionMode: "representation_10_percent",
      direction: "increase_taxable_income",
      moduleCode: "disallowed_expenses",
      targetField: "INK2S.representation_non_deductible",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["598000", "655000", "698100", "762200"],
      contextAreas: ["taxExpenseContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "disallowed_expenses",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["294300", "740000", "753000"],
      contextAreas: ["pensionContext", "taxExpenseContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "pension_costs_and_special_payroll_tax",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["399300", "399500"],
      contextAreas: ["taxExpenseContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "non_taxable_income",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: [
        "521200",
        "522200",
        "657000",
        "831000",
        "831400",
        "842300",
        "843100",
        "843600",
        "849000",
      ],
      contextAreas: ["netInterestContext", "leasingContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "hybrid_targeted_interest_and_net_interest_offset",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["882000", "883000"],
      contextAreas: ["groupContributionContext"],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "group_contributions",
      targetField: "INK2S.other_manual_adjustments",
    }),
    ...createRouteGroupV1({
      bridgeAiModule: null,
      categoryCodes: ["891000", "940000"],
      contextAreas: [
        "incomeStatementAnchors",
        "balanceSheetAnchors",
        "taxExpenseContext",
      ],
      decisionMode: "manual_review",
      direction: "informational",
      moduleCode: "trial_balance_to_local_gaap",
      targetField: "INK2S.other_manual_adjustments",
    }),
  ];

function deriveDispositionStatusV1(
  route: TaxAdjustmentCategoryRouteV1 | null,
): TaxAdjustmentCategoryDispositionStatusV1 {
  if (!route) {
    return "unsupported_in_v1";
  }
  if (route.decisionMode === "full_amount") {
    return "routed_to_submodule";
  }
  if (route.decisionMode === "representation_10_percent") {
    return "routed_to_submodule";
  }
  if (route.decisionMode === "manual_review") {
    return "manual_review_required";
  }
  return "deterministically_informational";
}

const ROUTE_BY_CATEGORY_CODE_V1 = new Map(
  TAX_ADJUSTMENT_CATEGORY_ROUTES_V1.map((route) => [route.categoryCode, route]),
);

function normalizeKeyPartV1(value: string): string {
  return value.trim().toLowerCase();
}

function buildExactRowLookupKeyV1(input: {
  sourceAccountNumber: string;
  accountNumber: string;
  accountName: string;
}): string {
  return [
    normalizeKeyPartV1(input.sourceAccountNumber),
    normalizeKeyPartV1(input.accountNumber),
    normalizeKeyPartV1(input.accountName),
  ].join("|");
}

function buildLooseRowLookupKeyV1(input: {
  sourceAccountNumber: string;
  accountNumber: string;
}): string {
  return [
    normalizeKeyPartV1(input.sourceAccountNumber),
    normalizeKeyPartV1(input.accountNumber),
  ].join("|");
}

function resolveRowForMappingDecisionV1(input: {
  decision: MappingDecisionRecordV1;
  trialBalance: TrialBalanceNormalizedArtifactV1;
}): {
  row: TrialBalanceNormalizedRowArtifactV1 | null;
  status: "matched" | "missing";
  reason?: string;
} {
  if (hasStableRowIdentityV1(input.decision)) {
    const rowKey = input.decision.trialBalanceRowIdentity.rowKey;
    const exactRow =
      input.trialBalance.rows.find(
        (row) => buildMappedAdjustmentRowIdentityV1(row.source)?.rowKey === rowKey,
      ) ?? null;

    return exactRow
      ? {
          row: exactRow,
          status: "matched",
        }
      : {
          row: null,
          status: "missing",
          reason:
            "The mapped row identity no longer resolves to an active trial-balance row.",
        };
  }

  const exactMatches = input.trialBalance.rows.filter(
    (row) =>
      buildExactRowLookupKeyV1({
        sourceAccountNumber: row.sourceAccountNumber,
        accountNumber: row.accountNumber,
        accountName: row.accountName,
      }) ===
      buildExactRowLookupKeyV1({
        sourceAccountNumber: input.decision.sourceAccountNumber,
        accountNumber: input.decision.accountNumber,
        accountName: input.decision.accountName,
      }),
  );
  if (exactMatches.length === 1) {
    return {
      row: exactMatches[0],
      status: "matched",
    };
  }

  const looseMatches = input.trialBalance.rows.filter(
    (row) =>
      buildLooseRowLookupKeyV1({
        sourceAccountNumber: row.sourceAccountNumber,
        accountNumber: row.accountNumber,
      }) ===
      buildLooseRowLookupKeyV1({
        sourceAccountNumber: input.decision.sourceAccountNumber,
        accountNumber: input.decision.accountNumber,
      }),
  );
  if (looseMatches.length === 1) {
    return {
      row: looseMatches[0],
      status: "matched",
    };
  }

  const sourceMatches = input.trialBalance.rows.filter(
    (row) =>
      normalizeKeyPartV1(row.sourceAccountNumber) ===
      normalizeKeyPartV1(input.decision.sourceAccountNumber),
  );
  if (sourceMatches.length === 1) {
    return {
      row: sourceMatches[0],
      status: "matched",
    };
  }

  return {
    row: null,
    status: "missing",
    reason:
      "The mapping decision could not be resolved to a unique active trial-balance row.",
  };
}

function hasStableRowIdentityV1(
  decision: MappingDecisionRecordV1,
): decision is MappingDecisionV2 {
  return "trialBalanceRowIdentity" in decision;
}

export function listNonRoutedTaxCategoryCodesV1(): SilverfinTaxCategoryCodeV1[] {
  return [...NON_ROUTED_CATEGORY_CODES_V1];
}

export function listTaxAdjustmentCategoryRoutesV1(): TaxAdjustmentCategoryRouteV1[] {
  return [...TAX_ADJUSTMENT_CATEGORY_ROUTES_V1];
}

export function listTaxAdjustmentCategoryDispositionRecordsV1(): TaxAdjustmentCategoryDispositionRecordV1[] {
  return listSilverfinTaxCategoriesV1().map((category) => {
    const route = getTaxAdjustmentCategoryRouteByCodeV1(category.code);
    if (!route) {
      return parseTaxAdjustmentCategoryDispositionRecordV1({
        category,
        moduleCode: null,
        bridgeAiModule: null,
        dispositionStatus: NON_ROUTED_CATEGORY_CODES_V1.includes(category.code)
          ? "deterministically_informational"
          : "unsupported_in_v1",
        decisionMode: null,
        direction: null,
        targetField: null,
        contextAreas: [],
      });
    }

    return parseTaxAdjustmentCategoryDispositionRecordV1({
      category,
      moduleCode: route.moduleCode,
      bridgeAiModule: route.bridgeAiModule,
      dispositionStatus: deriveDispositionStatusV1(route),
      decisionMode: route.decisionMode,
      direction: route.direction,
      targetField: route.targetField,
      contextAreas: [...route.contextAreas],
    });
  });
}

export function getTaxAdjustmentCategoryRouteByCodeV1(
  categoryCode: SilverfinTaxCategoryCodeV1,
): TaxAdjustmentCategoryRouteV1 | null {
  return ROUTE_BY_CATEGORY_CODE_V1.get(categoryCode) ?? null;
}

export function listRoutedTaxCategoryCodesV1(): SilverfinTaxCategoryCodeV1[] {
  return [...ROUTE_BY_CATEGORY_CODE_V1.keys()];
}

export function listUncoveredTaxCategoryCodesV1(): SilverfinTaxCategoryCodeV1[] {
  const routed = new Set(listRoutedTaxCategoryCodesV1());
  const nonRouted = new Set(NON_ROUTED_CATEGORY_CODES_V1);

  return listSilverfinTaxCategoriesV1()
    .map((category) => category.code)
    .filter((code) => !routed.has(code) && !nonRouted.has(code));
}

export function projectRoutedTaxAdjustmentCandidatesV1(input: {
  mapping: MappingDecisionSetArtifactV1;
  trialBalance: TrialBalanceNormalizedArtifactV1;
}): MappedAdjustmentCandidateV1[] {
  return input.mapping.decisions
    .map((decision) => {
      const route = getTaxAdjustmentCategoryRouteByCodeV1(
        decision.selectedCategory.code,
      );
      if (!route) {
        return null;
      }

      const rowResolution = resolveRowForMappingDecisionV1({
        decision,
        trialBalance: input.trialBalance,
      });

      return parseMappedAdjustmentCandidateV1({
        schemaVersion: "mapped_adjustment_candidate_v1",
        mappingDecisionId: decision.id,
        trialBalanceRowIdentity:
          hasStableRowIdentityV1(decision)
            ? decision.trialBalanceRowIdentity
            : buildMappedAdjustmentRowIdentityV1(rowResolution.row?.source),
        rowResolutionStatus: rowResolution.status,
        rowResolutionReason: rowResolution.reason,
        sourceAccountNumber: decision.sourceAccountNumber,
        accountNumber: decision.accountNumber,
        accountName: decision.accountName,
        openingBalance: rowResolution.row?.openingBalance ?? 0,
        closingBalance: rowResolution.row?.closingBalance ?? 0,
        selectedCategory: decision.selectedCategory,
        mappingConfidence: decision.confidence,
        mappingReviewFlag: decision.reviewFlag,
        mappingPolicyRuleReference: decision.policyRuleReference,
        moduleCode: route.moduleCode,
        bridgeAiModule: route.bridgeAiModule,
        dispositionStatus: deriveDispositionStatusV1(route),
        decisionMode: route.decisionMode,
        direction: route.direction,
        targetField: route.targetField,
        annualReportContextLineage: buildAnnualReportContextLineageV1({
          includedAreas: [...route.contextAreas],
        }),
      });
    })
    .filter((candidate): candidate is MappedAdjustmentCandidateV1 => candidate !== null);
}

export function projectTaxAdjustmentModuleContextV1(input: {
  annualReportTaxContext: AnnualReportDownstreamTaxContextV1;
  moduleCode: TaxAdjustmentModuleCodeV1;
}): TaxAdjustmentModuleContextV1 {
  const moduleRoutes = TAX_ADJUSTMENT_CATEGORY_ROUTES_V1.filter(
    (route) => route.moduleCode === input.moduleCode,
  );
  const contextAreas: TaxAdjustmentModuleContextAreaV1[] = Array.from(
    new Set(moduleRoutes.flatMap((route) => route.contextAreas)),
  ) as TaxAdjustmentModuleContextAreaV1[];

  const projection: Record<string, unknown> = {
    schemaVersion: "tax_adjustment_module_context_v1",
    moduleCode: input.moduleCode,
    shared: {
      relevantNotes: input.annualReportTaxContext.relevantNotes ?? [],
      priorYearComparatives:
        input.annualReportTaxContext.priorYearComparatives ?? [],
      selectedRiskFindings:
        input.annualReportTaxContext.selectedRiskFindings ?? [],
      missingInformation: input.annualReportTaxContext.missingInformation ?? [],
    },
  };

  for (const area of contextAreas) {
    projection[area] = input.annualReportTaxContext[area];
  }

  return parseTaxAdjustmentModuleContextV1(projection);
}

export function getTaxAdjustmentCategoryDisplayNameByCodeV1(
  categoryCode: SilverfinTaxCategoryCodeV1,
): string {
  return getSilverfinTaxCategoryByCodeV1(categoryCode).name;
}
