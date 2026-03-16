export type CoreModuleSlugV1 =
  | "annual-report-analysis"
  | "account-mapping"
  | "tax-adjustments"
  | "tax-return-ink2";

export type CoreModuleDefinitionV1 = {
  checklist: string[];
  ctaLabel: string;
  description: string;
  longLabel: string;
  nextStepLabel: string;
  shortLabel: string;
  slug: CoreModuleSlugV1;
  step: string;
};

export const coreModuleDefinitionsV1: CoreModuleDefinitionV1[] = [
  {
    slug: "annual-report-analysis",
    step: "01",
    shortLabel: "Annual Report",
    longLabel: "Annual Report Analysis",
    ctaLabel: "Upload annual report",
    nextStepLabel: "Inspect extracted facts",
    description:
      "Upload the annual report so D.ink can prepare workflow-ready structured data for downstream tax work.",
    checklist: [
      "Upload the signed annual report",
      "Extract company facts and financial values",
      "Inspect extracted fields and flagged gaps",
    ],
  },
  {
    slug: "account-mapping",
    step: "02",
    shortLabel: "Account Mapping",
    longLabel: "Account Mapping",
    ctaLabel: "Import trial balance",
    nextStepLabel: "Run AI mapping",
    description:
      "Map bookkeeping accounts into the tax structure and review exceptions.",
    checklist: [
      "Upload or import the trial balance",
      "Populate the account table",
      "Run and review AI-assisted mapping",
    ],
  },
  {
    slug: "tax-adjustments",
    step: "03",
    shortLabel: "Tax Adjustments",
    longLabel: "Tax Adjustments",
    ctaLabel: "Generate adjustments",
    nextStepLabel: "Review tax effect",
    description:
      "Review non-deductibles, timing differences, and other tax-only changes.",
    checklist: [
      "Generate the draft adjustment set",
      "Review high-impact adjustments",
      "Confirm the resulting tax summary",
    ],
  },
  {
    slug: "tax-return-ink2",
    step: "04",
    shortLabel: "INK2",
    longLabel: "Tax Return INK2",
    ctaLabel: "Generate INK2 draft",
    nextStepLabel: "Prepare export package",
    description:
      "Review the final INK2 draft and export package before sign-off.",
    checklist: [
      "Generate the INK2 draft from the tax summary",
      "Review material fields and provenance",
      "Prepare the export package",
    ],
  },
];

export const defaultCoreModuleSlugV1: CoreModuleSlugV1 =
  "annual-report-analysis";

export function buildCoreModulePathV1(
  workspaceId: string,
  moduleSlug: CoreModuleSlugV1,
): string {
  return `/app/workspaces/${workspaceId}/${moduleSlug}`;
}
