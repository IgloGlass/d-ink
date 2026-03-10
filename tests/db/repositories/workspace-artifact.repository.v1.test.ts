import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1WorkspaceArtifactRepositoryV1 } from "../../../src/db/repositories/workspace-artifact.repository.v1";
import { parseAnnualReportExtractionPayloadV1 } from "../../../src/shared/contracts/annual-report-extraction.v1";
import { parseAnnualReportTaxAnalysisPayloadV1 } from "../../../src/shared/contracts/annual-report-tax-analysis.v1";
import { parseExportPackagePayloadV1 } from "../../../src/shared/contracts/export-package.v1";
import { parseInk2FormDraftPayloadV1 } from "../../../src/shared/contracts/ink2-form.v1";
import { parseTaxAdjustmentDecisionSetPayloadV1 } from "../../../src/shared/contracts/tax-adjustments.v1";
import { parseTaxSummaryPayloadV1 } from "../../../src/shared/contracts/tax-summary.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

const TENANT_ID = "9a000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "9a000000-0000-4000-8000-000000000002";
const COMPANY_ID = "9a000000-0000-4000-8000-000000000003";
const OTHER_TENANT_ID = "9a000000-0000-4000-8000-000000000004";
const OTHER_WORKSPACE_ID = "9a000000-0000-4000-8000-000000000005";

async function seedWorkspace(input: {
  companyId: string;
  tenantId: string;
  workspaceId: string;
}): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO workspaces (
        id,
        tenant_id,
        company_id,
        fiscal_year_start,
        fiscal_year_end,
        status,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `,
  )
    .bind(
      input.workspaceId,
      input.tenantId,
      input.companyId,
      "2025-01-01",
      "2025-12-31",
      "draft",
      "2026-03-03T10:00:00.000Z",
      "2026-03-03T10:00:00.000Z",
    )
    .run();
}

function annualExtractionPayload() {
  return parseAnnualReportExtractionPayloadV1({
    schemaVersion: "annual_report_extraction_v1",
    sourceFileName: "annual-report.pdf",
    sourceFileType: "pdf",
    policyVersion: "annual-report-manual-first.v1",
    fields: {
      companyName: { status: "manual", confidence: 1, value: "Acme AB" },
      organizationNumber: {
        status: "manual",
        confidence: 1,
        value: "556677-8899",
      },
      fiscalYearStart: { status: "manual", confidence: 1, value: "2025-01-01" },
      fiscalYearEnd: { status: "manual", confidence: 1, value: "2025-12-31" },
      accountingStandard: { status: "manual", confidence: 1, value: "K2" },
      profitBeforeTax: { status: "manual", confidence: 1, value: 1000000 },
    },
    summary: {
      autoDetectedFieldCount: 0,
      needsReviewFieldCount: 0,
    },
    confirmation: {
      isConfirmed: true,
      confirmedAt: "2026-03-03T10:01:00.000Z",
      confirmedByUserId: "9a000000-0000-4000-8000-000000000010",
    },
  });
}

function taxAdjustmentsPayload() {
  return parseTaxAdjustmentDecisionSetPayloadV1({
    schemaVersion: "tax_adjustments_v1",
    policyVersion: "tax-adjustments.v1",
    generatedFrom: {
      mappingArtifactId: "9a000000-0000-4000-8000-000000000011",
      annualReportExtractionArtifactId: "9a000000-0000-4000-8000-000000000012",
    },
    summary: {
      totalDecisions: 1,
      manualReviewRequired: 0,
      totalPositiveAdjustments: 5000,
      totalNegativeAdjustments: 0,
      totalNetAdjustments: 5000,
    },
    decisions: [
      {
        id: "adj-1",
        module: "non_deductible_expenses",
        amount: 5000,
        direction: "increase_taxable_income",
        targetField: "INK2S.non_deductible_expenses",
        status: "proposed",
        confidence: 1,
        reviewFlag: false,
        policyRuleReference: "adj.non_deductible_expenses.v1",
        rationale: "Mapped to known non-deductible category.",
        evidence: [{ type: "category", reference: "607200" }],
      },
    ],
  });
}

function annualReportTaxAnalysisPayload() {
  return parseAnnualReportTaxAnalysisPayloadV1({
    schemaVersion: "annual_report_tax_analysis_v1",
    sourceExtractionArtifactId: "9a000000-0000-4000-8000-000000000013",
    policyVersion: "annual-report-tax-analysis.v1",
    basedOn: {
      ink2rExtracted: {
        incomeStatement: [],
        balanceSheet: [],
      },
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      priorYearComparatives: [],
    },
    executiveSummary: "Advisory tax analysis.",
    accountingStandardAssessment: {
      status: "aligned",
      rationale: "Annual report explicitly states K2.",
    },
    findings: [],
    missingInformation: [],
    recommendedNextActions: [],
  });
}

function taxSummaryPayload() {
  return parseTaxSummaryPayloadV1({
    schemaVersion: "tax_summary_v1",
    extractionArtifactId: "9a000000-0000-4000-8000-000000000021",
    adjustmentsArtifactId: "9a000000-0000-4000-8000-000000000022",
    fiscalYearEnd: "2025-12-31",
    taxRatePercent: 20.6,
    profitBeforeTax: 1000000,
    totalAdjustments: 5000,
    taxableIncome: 1005000,
    corporateTax: 207030,
    lineItems: [
      {
        code: "profit_before_tax",
        amount: 1000000,
        sourceReference: "annual_report_extraction",
      },
      {
        code: "total_adjustments",
        amount: 5000,
        sourceReference: "tax_adjustments",
      },
      {
        code: "taxable_income",
        amount: 1005000,
        sourceReference: "calc",
      },
      {
        code: "corporate_tax",
        amount: 207030,
        sourceReference: "calc",
      },
    ],
  });
}

function formPayload() {
  return parseInk2FormDraftPayloadV1({
    schemaVersion: "ink2_form_draft_v1",
    extractionArtifactId: "9a000000-0000-4000-8000-000000000031",
    adjustmentsArtifactId: "9a000000-0000-4000-8000-000000000032",
    summaryArtifactId: "9a000000-0000-4000-8000-000000000033",
    fields: [
      {
        fieldId: "INK2R.profit_before_tax",
        amount: 1000000,
        provenance: "extracted",
        sourceReferences: ["extraction"],
      },
      {
        fieldId: "INK2S.non_deductible_expenses",
        amount: 5000,
        provenance: "adjustment",
        sourceReferences: ["adjustments"],
      },
      {
        fieldId: "INK2S.representation_non_deductible",
        amount: 0,
        provenance: "adjustment",
        sourceReferences: ["adjustments"],
      },
      {
        fieldId: "INK2S.depreciation_adjustment",
        amount: 0,
        provenance: "adjustment",
        sourceReferences: ["adjustments"],
      },
      {
        fieldId: "INK2S.other_manual_adjustments",
        amount: 0,
        provenance: "manual",
        sourceReferences: ["manual"],
      },
      {
        fieldId: "INK2S.total_adjustments",
        amount: 5000,
        provenance: "calculated",
        sourceReferences: ["summary"],
      },
      {
        fieldId: "INK2S.taxable_income",
        amount: 1005000,
        provenance: "calculated",
        sourceReferences: ["summary"],
      },
      {
        fieldId: "INK2S.corporate_tax",
        amount: 207030,
        provenance: "calculated",
        sourceReferences: ["summary"],
      },
    ],
    validation: {
      status: "valid",
      issues: [],
    },
  });
}

function exportPayload() {
  return parseExportPackagePayloadV1({
    schemaVersion: "export_package_v1",
    format: "pdf",
    fileName: "ink2-export.pdf",
    mimeType: "application/pdf",
    contentBase64: "JVBERi0xLjQK",
    createdAt: "2026-03-03T10:07:00.000Z",
    artifactReferences: {
      annualReportExtractionArtifactId: "9a000000-0000-4000-8000-000000000041",
      adjustmentsArtifactId: "9a000000-0000-4000-8000-000000000042",
      summaryArtifactId: "9a000000-0000-4000-8000-000000000043",
      ink2FormArtifactId: "9a000000-0000-4000-8000-000000000044",
    },
    workspaceSnapshot: {
      workspaceId: WORKSPACE_ID,
      tenantId: TENANT_ID,
      status: "approved_for_export",
    },
  });
}

describe("D1 workspace artifact repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("increments versions and active pointers per artifact type", async () => {
    await seedWorkspace({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      companyId: COMPANY_ID,
    });
    const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);

    const first = await repository.appendAnnualReportExtractionAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000101",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:01:00.000Z",
      extraction: annualExtractionPayload(),
    });
    const second = await repository.appendAnnualReportExtractionAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000102",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:02:00.000Z",
      extraction: annualExtractionPayload(),
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.artifact.version).toBe(2);

    const active = await repository.getActiveAnnualReportExtraction({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(active?.id).toBe("9a000000-0000-4000-8000-000000000102");
    expect(active?.version).toBe(2);

    const adj = await repository.appendTaxAdjustmentsAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000103",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:03:00.000Z",
      adjustments: taxAdjustmentsPayload(),
    });
    expect(adj.ok).toBe(true);
    if (!adj.ok) {
      return;
    }
    expect(adj.artifact.version).toBe(1);

    const taxAnalysis =
      await repository.appendAnnualReportTaxAnalysisAndSetActive({
        artifactId: "9a000000-0000-4000-8000-000000000130",
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        createdAt: "2026-03-03T10:03:30.000Z",
        taxAnalysis: annualReportTaxAnalysisPayload(),
      });
    expect(taxAnalysis.ok).toBe(true);
    if (!taxAnalysis.ok) {
      return;
    }
    expect(taxAnalysis.artifact.version).toBe(1);

    const activeTaxAnalysis =
      await repository.getActiveAnnualReportTaxAnalysis({
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
      });
    expect(activeTaxAnalysis?.schemaVersion).toBe(
      "annual_report_tax_analysis_v1",
    );
  });

  it("returns WORKSPACE_NOT_FOUND for missing workspace", async () => {
    const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);
    const write = await repository.appendTaxSummaryAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000111",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:04:00.000Z",
      summary: taxSummaryPayload(),
    });

    expect(write.ok).toBe(false);
    if (!write.ok) {
      expect(write.code).toBe("WORKSPACE_NOT_FOUND");
    }
  });

  it("isolates exports by tenant/workspace", async () => {
    await seedWorkspace({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      companyId: COMPANY_ID,
    });
    await seedWorkspace({
      tenantId: OTHER_TENANT_ID,
      workspaceId: OTHER_WORKSPACE_ID,
      companyId: "9a000000-0000-4000-8000-000000000006",
    });
    const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);

    await repository.appendInk2FormAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000120",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:05:00.000Z",
      form: formPayload(),
    });
    await repository.appendExportPackageAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000121",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:06:00.000Z",
      exportPackage: exportPayload(),
    });
    await repository.appendExportPackageAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000122",
      tenantId: OTHER_TENANT_ID,
      workspaceId: OTHER_WORKSPACE_ID,
      createdAt: "2026-03-03T10:06:30.000Z",
      exportPackage: parseExportPackagePayloadV1({
        ...exportPayload(),
        workspaceSnapshot: {
          workspaceId: OTHER_WORKSPACE_ID,
          tenantId: OTHER_TENANT_ID,
          status: "approved_for_export",
        },
      }),
    });

    const primary = await repository.listExportPackages({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    const secondary = await repository.listExportPackages({
      tenantId: OTHER_TENANT_ID,
      workspaceId: OTHER_WORKSPACE_ID,
    });

    expect(primary).toHaveLength(1);
    expect(secondary).toHaveLength(1);
    expect(primary[0]?.workspaceId).toBe(WORKSPACE_ID);
    expect(secondary[0]?.workspaceId).toBe(OTHER_WORKSPACE_ID);
  });

  it("clears active artifact pointers without deleting persisted versions", async () => {
    await seedWorkspace({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      companyId: COMPANY_ID,
    });
    const repository = createD1WorkspaceArtifactRepositoryV1(env.DB);

    await repository.appendAnnualReportExtractionAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000140",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:08:00.000Z",
      extraction: annualExtractionPayload(),
    });
    await repository.appendTaxSummaryAndSetActive({
      artifactId: "9a000000-0000-4000-8000-000000000141",
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      createdAt: "2026-03-03T10:08:30.000Z",
      summary: taxSummaryPayload(),
    });

    const clearResult = await repository.clearActiveArtifacts({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      artifactTypes: ["annual_report_extraction", "tax_summary"],
    });

    expect(clearResult.ok).toBe(true);
    if (!clearResult.ok) {
      return;
    }
    expect(clearResult.clearedArtifactTypes).toEqual([
      "annual_report_extraction",
      "tax_summary",
    ]);

    const activeExtraction = await repository.getActiveAnnualReportExtraction({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });
    const activeSummary = await repository.getActiveTaxSummary({
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(activeExtraction).toBeNull();
    expect(activeSummary).toBeNull();
  });
});
