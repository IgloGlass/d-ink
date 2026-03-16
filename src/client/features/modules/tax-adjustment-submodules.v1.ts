import type {
  SidebarSectionItemV1,
  SidebarSectionV1,
} from "../../components/sidebar-nav-v1";

export type TaxAdjustmentSubmoduleGroupV1 =
  | "core"
  | "contextual"
  | "advanced"
  | "calculation";

export type TaxAdjustmentSubmoduleScaffoldV1 = {
  aliases?: string[];
  group: TaxAdjustmentSubmoduleGroupV1;
  ordinal: number;
  routeSegment: string;
  summary: string;
  title: string;
  usesBaseRoute?: boolean;
};

const TAX_ADJUSTMENT_SUBMODULES_V1: TaxAdjustmentSubmoduleScaffoldV1[] = [
  {
    ordinal: 1,
    routeSegment: "general-client-information",
    usesBaseRoute: true,
    group: "core",
    title: "General client information",
    summary:
      "Reserve the client-level review surface for filing assumptions, entity facts, and adjustment prerequisites.",
    aliases: ["general-client-information"],
  },
  {
    ordinal: 2,
    routeSegment: "trial-balance-to-local-gaap",
    group: "core",
    title: "Trial balance to local GAAP",
    summary:
      "Reserve the bridge between mapped accounts and the tax-adjustment workbench so local-GAAP normalization can be reviewed later.",
  },
  {
    ordinal: 10,
    routeSegment: "disallowed-expenses",
    group: "core",
    title: "Disallowed expenses",
    summary:
      "Reserve the main review surface for non-deductible cost categories and account-driven tax adjustments.",
  },
  {
    ordinal: 7,
    routeSegment: "non-taxable-income",
    group: "core",
    title: "Non-taxable income",
    summary:
      "Reserve the submodule for exempt income streams, participation exemptions, and related reviewer evidence.",
  },
  {
    ordinal: 3,
    routeSegment: "provisions",
    group: "core",
    title: "Provisions",
    summary:
      "Reserve the provision review surface for timing differences, supporting facts, and future override workflows.",
  },
  {
    ordinal: 12,
    routeSegment: "depreciation-on-tangible-and-acquired-intangible-assets",
    group: "core",
    title: "Depreciation on tangible and acquired intangible assets",
    summary:
      "Reserve the depreciation-difference workspace for mapped asset accounts, annual-report context, and reviewer decisions.",
  },
  {
    ordinal: 9,
    routeSegment: "group-contributions",
    group: "core",
    title: "Group contributions",
    summary:
      "Reserve the group-contribution review surface for intra-group adjustments, supporting notes, and control checks.",
  },
  {
    ordinal: 20,
    routeSegment: "items-not-included-in-the-books",
    group: "core",
    title: "Items not included in the books",
    summary:
      "Reserve space for off-book tax items so future adjustment logic can live beside clear reviewer context.",
  },
  {
    ordinal: 24,
    routeSegment: "tax-losses-carried-forward",
    group: "core",
    title: "Tax losses carried forward",
    summary:
      "Reserve the loss carryforward surface for prior-year continuity, restriction rules, and deduction tracking.",
  },
  {
    ordinal: 15,
    routeSegment: "property-tax-and-property-fee",
    group: "contextual",
    title: "Property tax and property fee",
    summary:
      "Reserve the property-tax review surface for current-year charges, accruals, and entity-specific treatments.",
  },
  {
    ordinal: 16,
    routeSegment: "warranty-provision",
    group: "contextual",
    title: "Warranty provision",
    summary:
      "Reserve a dedicated review surface for warranty assumptions, historical outcomes, and deductible timing differences.",
  },
  {
    ordinal: 11,
    routeSegment: "pension-costs-and-basis-for-special-employers-contribution",
    group: "contextual",
    title: "Pension costs and basis for special employer's contribution",
    summary:
      "Reserve the pension-cost review surface for mapped payroll balances and tax-specific basis calculations.",
  },
  {
    ordinal: 4,
    routeSegment:
      "buildings-building-improvements-leasehold-improvements-land-improvements-and-capital-gains-on-sale-of-commercial-property",
    group: "contextual",
    title:
      "Buildings, building improvements, leasehold improvements, land improvements, and capital gains on sale of commercial property",
    summary:
      "Reserve the property-heavy adjustment space for building movements, gains, and special tax treatments.",
  },
  {
    ordinal: 5,
    routeSegment: "capital-assets-and-unrealized-changes",
    group: "contextual",
    title: "Capital assets and unrealized changes",
    summary:
      "Reserve the capital-asset review surface for unrealized positions, fair-value movements, and tax classification decisions.",
  },
  {
    ordinal: 18,
    routeSegment: "obsolescence-reserve-for-inventory",
    group: "contextual",
    title: "Obsolescence reserve for inventory",
    summary:
      "Reserve the inventory-reserve submodule for aging analysis, reserve evidence, and reviewer approval flows.",
  },
  {
    ordinal: 13,
    routeSegment: "shares-and-participations",
    group: "contextual",
    title: "Shares and participations",
    summary:
      "Reserve the shareholding review surface for participation exemptions, dividend treatment, and disposal logic.",
  },
  {
    ordinal: 19,
    routeSegment: "shares-and-participations-average-method",
    group: "contextual",
    title: "Shares and participations - average method",
    summary:
      "Reserve a dedicated average-method workspace so later calculations can sit next to supporting evidence and reviewer notes.",
  },
  {
    ordinal: 14,
    routeSegment: "partnership-interest-handelsbolag-n3b",
    group: "contextual",
    title: "Partnership interest (Handelsbolag) - N3B",
    summary:
      "Reserve the N3B review surface for partnership-specific inputs, statements, and tax adjustments.",
  },
  {
    ordinal: 6,
    routeSegment: "cfc-taxation",
    group: "advanced",
    title: "CFC taxation",
    summary:
      "Reserve the controlled-foreign-company review surface for specialized fact gathering and tax treatment logic.",
  },
  {
    ordinal: 8,
    routeSegment: "yield-tax-risk-tax-and-renewable-energy",
    group: "advanced",
    title: "Yield tax, risk tax, and renewable energy",
    summary:
      "Reserve the specialized tax surface for sector-driven adjustments that fall outside the standard return flow.",
  },
  {
    ordinal: 21,
    routeSegment:
      "hybrid-and-targeted-interest-limitation-rules-and-offsetting-of-net-interest",
    group: "advanced",
    title:
      "Hybrid and targeted interest limitation rules, and offsetting of net interest",
    summary:
      "Reserve the targeted-interest review space for specialized rule sets, context evidence, and reviewer gating.",
  },
  {
    ordinal: 26,
    routeSegment:
      "deductible-net-interest-under-the-general-interest-deduction-limitation-rule",
    group: "advanced",
    title:
      "Deductible net interest under the general interest deduction limitation rule",
    summary:
      "Reserve the general interest-limitation workspace for deductions, carryforwards, and basis documentation.",
  },
  {
    ordinal: 17,
    routeSegment: "notional-income-on-tax-allocation-reserve",
    group: "advanced",
    title: "Notional income on tax allocation reserve",
    summary:
      "Reserve the notional-income review surface for reserve-linked tax effects and supporting calculation details.",
  },
  {
    ordinal: 25,
    routeSegment: "reversal-of-tax-allocation-reserve",
    group: "advanced",
    title: "Reversal of tax allocation reserve",
    summary:
      "Reserve the reserve-reversal workspace for continuity checks and tax-effect timing decisions.",
  },
  {
    ordinal: 28,
    routeSegment: "allocation-to-tax-allocation-reserve",
    group: "advanced",
    title: "Allocation to tax allocation reserve",
    summary:
      "Reserve the reserve-allocation workspace for planning decisions, reviewer controls, and deterministic follow-through.",
  },
  {
    ordinal: 27,
    routeSegment:
      "increased-deduction-for-restricted-tax-losses-carried-forward-tlcf",
    group: "advanced",
    title:
      "Increased deduction for restricted tax losses carried forward (TLCF)",
    summary:
      "Reserve the restricted-loss submodule for special deduction rules and evidence-heavy reviewer decisions.",
  },
  {
    ordinal: 22,
    routeSegment:
      "tax-calculation-before-deduction-of-prior-year-losses-and-negative-net-interest",
    group: "calculation",
    title:
      "Tax calculation before deduction of prior-year losses and negative net interest",
    summary:
      "Reserve the first calculation checkpoint so future deterministic totals can stay visible inside the adjustment workflow.",
  },
  {
    ordinal: 23,
    routeSegment:
      "tax-calculation-after-deduction-for-negative-net-interest-and-tax-losses-carried-forward",
    group: "calculation",
    title:
      "Tax calculation after deduction for negative net interest and tax losses carried forward",
    summary:
      "Reserve the second calculation checkpoint for downstream deductions and reviewer sign-off.",
  },
  {
    ordinal: 29,
    routeSegment:
      "tax-calculation-after-deduction-for-negative-net-interest-tax-allocation-reserve-and-tax-losses",
    group: "calculation",
    title:
      "Tax calculation after deduction for negative net interest, tax allocation reserve, and tax losses",
    summary:
      "Reserve the late-stage tax calculation checkpoint so the chain remains stable as submodules come online.",
  },
  {
    ordinal: 30,
    routeSegment: "final-tax-calculation",
    group: "calculation",
    title: "Final tax calculation",
    summary:
      "Reserve the final tax-calculation review surface before the deterministic tax summary and INK2 draft consume the result.",
  },
];

const TAX_ADJUSTMENT_SECTION_ORDER_V1: TaxAdjustmentSubmoduleGroupV1[] = [
  "core",
  "contextual",
  "advanced",
  "calculation",
];

const TAX_ADJUSTMENT_SECTION_TITLES_V1: Record<
  TaxAdjustmentSubmoduleGroupV1,
  string
> = {
  core: "Core adjustments",
  contextual: "Frequent contextual adjustments",
  advanced: "Advanced and specialized",
  calculation: "Calculation chain",
};

function sortTaxAdjustmentSubmodulesByOrdinalV1(
  submodules: TaxAdjustmentSubmoduleScaffoldV1[],
): TaxAdjustmentSubmoduleScaffoldV1[] {
  return [...submodules].sort((left, right) => left.ordinal - right.ordinal);
}

/**
 * The tax-adjustments workbench needs a stable sidebar contract before the
 * individual submodules are implemented. Keep this list UI-owned for now so
 * the client can scaffold all reserved screens without importing server code.
 */
export function listTaxAdjustmentSubmodulesV1(): TaxAdjustmentSubmoduleScaffoldV1[] {
  return sortTaxAdjustmentSubmodulesByOrdinalV1(TAX_ADJUSTMENT_SUBMODULES_V1);
}

export function findTaxAdjustmentSubmoduleV1(
  routeSegment: string | undefined,
): TaxAdjustmentSubmoduleScaffoldV1 {
  const normalizedSegment = routeSegment?.trim().toLowerCase();
  if (!normalizedSegment) {
    return TAX_ADJUSTMENT_SUBMODULES_V1[0];
  }

  const matchedSubmodule = TAX_ADJUSTMENT_SUBMODULES_V1.find((submodule) => {
    if (submodule.routeSegment === normalizedSegment) {
      return true;
    }

    return submodule.aliases?.includes(normalizedSegment) ?? false;
  });

  return matchedSubmodule ?? TAX_ADJUSTMENT_SUBMODULES_V1[0];
}

export function getTaxAdjustmentSubmoduleGroupTitleV1(
  group: TaxAdjustmentSubmoduleGroupV1,
): string {
  return TAX_ADJUSTMENT_SECTION_TITLES_V1[group];
}

export function buildTaxAdjustmentSubmodulePathV1(
  workspaceId: string,
  submodule: TaxAdjustmentSubmoduleScaffoldV1,
): string {
  const basePath = `/app/workspaces/${workspaceId}/tax-adjustments`;
  return submodule.usesBaseRoute
    ? basePath
    : `${basePath}/${submodule.routeSegment}`;
}

export function buildTaxAdjustmentSidebarSectionsV1(workspaceId: string): {
  sections: SidebarSectionV1[];
} {
  const buildItems = (
    group: TaxAdjustmentSubmoduleGroupV1,
  ): SidebarSectionItemV1[] =>
    sortTaxAdjustmentSubmodulesByOrdinalV1(
      TAX_ADJUSTMENT_SUBMODULES_V1.filter(
        (submodule) => submodule.group === group,
      ),
    ).map((submodule) => ({
      id: submodule.routeSegment,
      label: submodule.title,
      prefix: String(submodule.ordinal).padStart(2, "0"),
      to: buildTaxAdjustmentSubmodulePathV1(workspaceId, submodule),
      exact: submodule.usesBaseRoute,
    }));

  return {
    sections: TAX_ADJUSTMENT_SECTION_ORDER_V1.map((group) => ({
      id: group,
      title: TAX_ADJUSTMENT_SECTION_TITLES_V1[group],
      items: buildItems(group),
    })),
  };
}
