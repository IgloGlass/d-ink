import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type ExportPackagePayloadV1,
  parseExportPackagePayloadV1,
} from "../../shared/contracts/export-package.v1";
import { type Ink2FormDraftPayloadV1, parseInk2FormDraftPayloadV1 } from "../../shared/contracts/ink2-form.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import { type TaxSummaryPayloadV1, parseTaxSummaryPayloadV1 } from "../../shared/contracts/tax-summary.v1";
import { type WorkspaceV1, parseWorkspaceV1 } from "../../shared/contracts/workspace.v1";

export type GeneratePdfExportInputV1 = {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  adjustmentsArtifactId: string;
  createdAt: string;
  createdByUserId?: string;
  extraction: AnnualReportExtractionPayloadV1;
  extractionArtifactId: string;
  form: Ink2FormDraftPayloadV1;
  formArtifactId: string;
  summary: TaxSummaryPayloadV1;
  summaryArtifactId: string;
  workspace: WorkspaceV1;
};

export type GeneratePdfExportResultV1 =
  | {
      exportPackage: ExportPackagePayloadV1;
      ok: true;
    }
  | {
      error: {
        code: "INPUT_INVALID" | "EXPORT_NOT_ALLOWED";
        context: Record<string, unknown>;
        message: string;
        user_message: string;
      };
      ok: false;
    };

function toDeterministicPdfLikeContentV1(input: {
  adjustments: TaxAdjustmentDecisionSetPayloadV1;
  extraction: AnnualReportExtractionPayloadV1;
  form: Ink2FormDraftPayloadV1;
  summary: TaxSummaryPayloadV1;
  workspace: WorkspaceV1;
}): string {
  const lines = [
    "%PDF-1.4",
    "D.ink V1 PDF Export",
    `Workspace: ${input.workspace.id}`,
    `Tenant: ${input.workspace.tenantId}`,
    `Status: ${input.workspace.status}`,
    `Company: ${input.extraction.fields.companyName.value ?? "-"}`,
    `OrgNo: ${input.extraction.fields.organizationNumber.value ?? "-"}`,
    `FiscalYear: ${input.extraction.fields.fiscalYearStart.value ?? "-"} -> ${
      input.extraction.fields.fiscalYearEnd.value ?? "-"
    }`,
    `ProfitBeforeTax: ${input.summary.profitBeforeTax}`,
    `TotalAdjustments: ${input.summary.totalAdjustments}`,
    `TaxableIncome: ${input.summary.taxableIncome}`,
    `CorporateTax: ${input.summary.corporateTax}`,
    `AdjustmentCount: ${input.adjustments.decisions.length}`,
    "INK2 Fields:",
    ...input.form.fields.map(
      (field) =>
        `- ${field.fieldId}: ${field.amount} (${field.provenance}) [${field.sourceReferences.join(
          ",",
        )}]`,
    ),
    "%%EOF",
  ];

  return lines.join("\n");
}

/**
 * Deterministically builds the V1 PDF export package payload.
 */
export function generatePdfExportPackageV1(
  input: unknown,
): GeneratePdfExportResultV1 {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "PDF export input payload is invalid.",
        user_message: "PDF export input is invalid.",
        context: {},
      },
    };
  }

  const candidate = input as Partial<GeneratePdfExportInputV1>;
  if (
    typeof candidate.extractionArtifactId !== "string" ||
    typeof candidate.adjustmentsArtifactId !== "string" ||
    typeof candidate.summaryArtifactId !== "string" ||
    typeof candidate.formArtifactId !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "PDF export artifact references are invalid.",
        user_message: "PDF export artifact references are invalid.",
        context: {},
      },
    };
  }

  let workspace: WorkspaceV1;
  let extraction: AnnualReportExtractionPayloadV1;
  let adjustments: TaxAdjustmentDecisionSetPayloadV1;
  let summary: TaxSummaryPayloadV1;
  let form: Ink2FormDraftPayloadV1;
  try {
    workspace = parseWorkspaceV1(candidate.workspace);
    extraction = parseAnnualReportExtractionPayloadV1(candidate.extraction);
    adjustments = parseTaxAdjustmentDecisionSetPayloadV1(candidate.adjustments);
    summary = parseTaxSummaryPayloadV1(candidate.summary);
    form = parseInk2FormDraftPayloadV1(candidate.form);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "PDF export input contracts are invalid.",
        user_message: "PDF export input payload is invalid.",
        context: {
          message: error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }

  if (workspace.status !== "approved_for_export") {
    return {
      ok: false,
      error: {
        code: "EXPORT_NOT_ALLOWED",
        message: "Workspace must be approved_for_export before PDF export.",
        user_message: "Approve workspace for export before generating PDF.",
        context: {
          workspaceStatus: workspace.status,
        },
      },
    };
  }

  const deterministicContent = toDeterministicPdfLikeContentV1({
    workspace,
    extraction,
    adjustments,
    summary,
    form,
  });
  const contentBase64 = btoa(deterministicContent);

  try {
    const exportPackage = parseExportPackagePayloadV1({
      schemaVersion: "export_package_v1",
      format: "pdf",
      fileName: `dink-ink2-${workspace.id}.pdf`,
      mimeType: "application/pdf",
      contentBase64,
      createdAt: candidate.createdAt,
      createdByUserId: candidate.createdByUserId,
      artifactReferences: {
        annualReportExtractionArtifactId: candidate.extractionArtifactId,
        adjustmentsArtifactId: candidate.adjustmentsArtifactId,
        summaryArtifactId: candidate.summaryArtifactId,
        ink2FormArtifactId: candidate.formArtifactId,
      },
      workspaceSnapshot: {
        workspaceId: workspace.id,
        tenantId: workspace.tenantId,
        status: workspace.status,
      },
    });

    return {
      ok: true,
      exportPackage,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "PDF export output failed contract validation.",
        user_message: "Generated PDF export is invalid.",
        context: {
          message: error instanceof Error ? error.message : "Unknown parse failure.",
        },
      },
    };
  }
}
