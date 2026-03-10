import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";
import {
  type AnnualReportTaxAnalysisPayloadV1,
  parseAnnualReportTaxAnalysisPayloadV1,
} from "../../shared/contracts/annual-report-tax-analysis.v1";
import {
  type ExportPackagePayloadV1,
  parseExportPackagePayloadV1,
} from "../../shared/contracts/export-package.v1";
import {
  type Ink2FormDraftPayloadV1,
  parseInk2FormDraftPayloadV1,
} from "../../shared/contracts/ink2-form.v1";
import {
  type TaxAdjustmentDecisionSetPayloadV1,
  parseTaxAdjustmentDecisionSetPayloadV1,
} from "../../shared/contracts/tax-adjustments.v1";
import {
  type TaxSummaryPayloadV1,
  parseTaxSummaryPayloadV1,
} from "../../shared/contracts/tax-summary.v1";
import type { D1Database } from "../../shared/types/d1";

export type WorkspaceArtifactTypeV1 =
  | "annual_report_extraction"
  | "annual_report_tax_analysis"
  | "tax_adjustments"
  | "tax_summary"
  | "ink2_form"
  | "export_package";

type WorkspaceArtifactPayloadByTypeV1 = {
  annual_report_extraction: AnnualReportExtractionPayloadV1;
  annual_report_tax_analysis: AnnualReportTaxAnalysisPayloadV1;
  tax_adjustments: TaxAdjustmentDecisionSetPayloadV1;
  tax_summary: TaxSummaryPayloadV1;
  ink2_form: Ink2FormDraftPayloadV1;
  export_package: ExportPackagePayloadV1;
};

export type WorkspaceArtifactVersionRecordV1<
  TType extends WorkspaceArtifactTypeV1,
> = {
  artifactType: TType;
  createdAt: string;
  createdByUserId?: string;
  id: string;
  payload: WorkspaceArtifactPayloadByTypeV1[TType];
  schemaVersion: WorkspaceArtifactPayloadByTypeV1[TType]["schemaVersion"];
  tenantId: string;
  version: number;
  workspaceId: string;
};

type AppendArtifactInputBaseV1 = {
  artifactId: string;
  createdAt: string;
  createdByUserId?: string;
  tenantId: string;
  workspaceId: string;
};

export type WorkspaceArtifactWriteFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

export type WorkspaceArtifactWriteFailureV1 = {
  code: WorkspaceArtifactWriteFailureCodeV1;
  message: string;
  ok: false;
};

export type WorkspaceArtifactWriteSuccessV1<
  TType extends WorkspaceArtifactTypeV1,
> = {
  artifact: WorkspaceArtifactVersionRecordV1<TType>;
  ok: true;
};

export type WorkspaceArtifactWriteResultV1<
  TType extends WorkspaceArtifactTypeV1,
> = WorkspaceArtifactWriteSuccessV1<TType> | WorkspaceArtifactWriteFailureV1;

export type WorkspaceArtifactClearFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

export type WorkspaceArtifactClearResultV1 =
  | {
      ok: true;
      clearedArtifactTypes: WorkspaceArtifactTypeV1[];
    }
  | {
      ok: false;
      code: WorkspaceArtifactClearFailureCodeV1;
      message: string;
    };

export interface WorkspaceArtifactRepositoryV1 {
  appendAnnualReportExtractionAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      extraction: AnnualReportExtractionPayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"annual_report_extraction">>;
  appendAnnualReportTaxAnalysisAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      taxAnalysis: AnnualReportTaxAnalysisPayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"annual_report_tax_analysis">>;
  appendTaxAdjustmentsAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      adjustments: TaxAdjustmentDecisionSetPayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"tax_adjustments">>;
  appendTaxSummaryAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      summary: TaxSummaryPayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"tax_summary">>;
  appendInk2FormAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      form: Ink2FormDraftPayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"ink2_form">>;
  appendExportPackageAndSetActive(
    input: AppendArtifactInputBaseV1 & {
      exportPackage: ExportPackagePayloadV1;
    },
  ): Promise<WorkspaceArtifactWriteResultV1<"export_package">>;
  getActiveAnnualReportExtraction(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"annual_report_extraction"> | null>;
  getActiveAnnualReportTaxAnalysis(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"annual_report_tax_analysis"> | null>;
  getActiveTaxAdjustments(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"tax_adjustments"> | null>;
  getActiveTaxSummary(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"tax_summary"> | null>;
  getActiveInk2Form(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"ink2_form"> | null>;
  getActiveExportPackage(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"export_package"> | null>;
  listExportPackages(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<"export_package">[]>;
  clearActiveArtifacts(input: {
    tenantId: string;
    workspaceId: string;
    artifactTypes: WorkspaceArtifactTypeV1[];
  }): Promise<WorkspaceArtifactClearResultV1>;
}

type WorkspaceExistsRowV1 = {
  id: string;
};

type NextVersionRowV1 = {
  next_version: number;
};

type ArtifactVersionRowV1 = {
  artifact_type: WorkspaceArtifactTypeV1;
  created_at: string;
  created_by_user_id: string | null;
  id: string;
  payload_json: string;
  schema_version: string;
  tenant_id: string;
  version: number;
  workspace_id: string;
};

const SELECT_WORKSPACE_EXISTS_SQL_V1 = `
SELECT id
FROM workspaces
WHERE tenant_id = ?1 AND id = ?2
LIMIT 1
`;

const SELECT_NEXT_VERSION_SQL_V1 = `
SELECT COALESCE(MAX(version), 0) + 1 AS next_version
FROM workspace_artifact_versions_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND artifact_type = ?3
`;

const INSERT_ARTIFACT_VERSION_SQL_V1 = `
INSERT INTO workspace_artifact_versions_v1 (
  id,
  tenant_id,
  workspace_id,
  artifact_type,
  version,
  schema_version,
  payload_json,
  created_at,
  created_by_user_id
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
`;

const UPSERT_ACTIVE_ARTIFACT_SQL_V1 = `
INSERT INTO workspace_active_artifacts_v1 (
  tenant_id,
  workspace_id,
  artifact_type,
  active_artifact_id,
  active_version,
  updated_at
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6)
ON CONFLICT (tenant_id, workspace_id, artifact_type)
DO UPDATE SET
  active_artifact_id = excluded.active_artifact_id,
  active_version = excluded.active_version,
  updated_at = excluded.updated_at
`;

const SELECT_ACTIVE_ARTIFACT_SQL_V1 = `
SELECT
  versions.id,
  versions.tenant_id,
  versions.workspace_id,
  versions.artifact_type,
  versions.version,
  versions.schema_version,
  versions.payload_json,
  versions.created_at,
  versions.created_by_user_id
FROM workspace_active_artifacts_v1 active
JOIN workspace_artifact_versions_v1 versions
  ON versions.id = active.active_artifact_id
WHERE active.tenant_id = ?1
  AND active.workspace_id = ?2
  AND active.artifact_type = ?3
LIMIT 1
`;

const LIST_ARTIFACT_VERSIONS_SQL_V1 = `
SELECT
  id,
  tenant_id,
  workspace_id,
  artifact_type,
  version,
  schema_version,
  payload_json,
  created_at,
  created_by_user_id
FROM workspace_artifact_versions_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND artifact_type = ?3
ORDER BY version DESC, id ASC
`;

const DELETE_ACTIVE_ARTIFACT_SQL_V1 = `
DELETE FROM workspace_active_artifacts_v1
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND artifact_type = ?3
`;

const MAX_VERSION_INSERT_RETRIES_V1 = 3;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function toVersionNumberV1(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Persisted artifact version is invalid.");
  }

  return parsed;
}

function isVersionUniquenessConflictV1(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unique constraint failed") &&
    message.includes("workspace_artifact_versions_v1.tenant_id") &&
    message.includes("workspace_artifact_versions_v1.workspace_id") &&
    message.includes("workspace_artifact_versions_v1.artifact_type") &&
    message.includes("workspace_artifact_versions_v1.version")
  );
}

function parseArtifactPayloadByTypeV1<TType extends WorkspaceArtifactTypeV1>(
  artifactType: TType,
  input: unknown,
): WorkspaceArtifactPayloadByTypeV1[TType] {
  switch (artifactType) {
    case "annual_report_extraction":
      return parseAnnualReportExtractionPayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    case "annual_report_tax_analysis":
      return parseAnnualReportTaxAnalysisPayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    case "tax_adjustments":
      return parseTaxAdjustmentDecisionSetPayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    case "tax_summary":
      return parseTaxSummaryPayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    case "ink2_form":
      return parseInk2FormDraftPayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    case "export_package":
      return parseExportPackagePayloadV1(
        input,
      ) as WorkspaceArtifactPayloadByTypeV1[TType];
    default: {
      const exhaustiveCheck: never = artifactType;
      throw new Error(`Unsupported artifact type: ${String(exhaustiveCheck)}`);
    }
  }
}

function mapArtifactRowToRecordV1<
  TType extends WorkspaceArtifactTypeV1,
>(input: {
  artifactType: TType;
  row: ArtifactVersionRowV1;
}): WorkspaceArtifactVersionRecordV1<TType> {
  if (input.row.artifact_type !== input.artifactType) {
    throw new Error("Persisted artifact type does not match requested type.");
  }

  let parsedPayloadJson: unknown = null;
  try {
    parsedPayloadJson = JSON.parse(input.row.payload_json);
  } catch (error) {
    throw new Error(
      `Failed to parse persisted artifact payload JSON: ${toErrorMessage(error)}`,
    );
  }

  const payload = parseArtifactPayloadByTypeV1(
    input.artifactType,
    parsedPayloadJson,
  );
  if (payload.schemaVersion !== input.row.schema_version) {
    throw new Error(
      "Persisted artifact schema_version does not match payload schemaVersion.",
    );
  }

  return {
    id: input.row.id,
    tenantId: input.row.tenant_id,
    workspaceId: input.row.workspace_id,
    artifactType: input.artifactType,
    version: toVersionNumberV1(input.row.version),
    schemaVersion: payload.schemaVersion,
    payload,
    createdAt: input.row.created_at,
    createdByUserId: input.row.created_by_user_id ?? undefined,
  };
}

export function createD1WorkspaceArtifactRepositoryV1(
  db: D1Database,
): WorkspaceArtifactRepositoryV1 {
  async function appendArtifactAndSetActiveInternalV1<
    TType extends WorkspaceArtifactTypeV1,
  >(input: {
    artifactId: string;
    artifactType: TType;
    createdAt: string;
    createdByUserId?: string;
    payload: WorkspaceArtifactPayloadByTypeV1[TType];
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactWriteResultV1<TType>> {
    const parsedPayload = parseArtifactPayloadByTypeV1(
      input.artifactType,
      input.payload,
    );

    const workspaceRow = await db
      .prepare(SELECT_WORKSPACE_EXISTS_SQL_V1)
      .bind(input.tenantId, input.workspaceId)
      .first<WorkspaceExistsRowV1>();
    if (!workspaceRow) {
      return {
        ok: false,
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    for (
      let attemptNumber = 1;
      attemptNumber <= MAX_VERSION_INSERT_RETRIES_V1;
      attemptNumber += 1
    ) {
      try {
        const nextVersionRow = await db
          .prepare(SELECT_NEXT_VERSION_SQL_V1)
          .bind(input.tenantId, input.workspaceId, input.artifactType)
          .first<NextVersionRowV1>();

        const nextVersion = toVersionNumberV1(
          nextVersionRow?.next_version ?? 1,
        );
        const [insertVersionResult, upsertActiveResult] = await db.batch([
          db
            .prepare(INSERT_ARTIFACT_VERSION_SQL_V1)
            .bind(
              input.artifactId,
              input.tenantId,
              input.workspaceId,
              input.artifactType,
              nextVersion,
              parsedPayload.schemaVersion,
              JSON.stringify(parsedPayload),
              input.createdAt,
              input.createdByUserId ?? null,
            ),
          db
            .prepare(UPSERT_ACTIVE_ARTIFACT_SQL_V1)
            .bind(
              input.tenantId,
              input.workspaceId,
              input.artifactType,
              input.artifactId,
              nextVersion,
              input.createdAt,
            ),
        ]);

        if (!insertVersionResult.success || !upsertActiveResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Failed to atomically persist artifact version and active pointer.",
          };
        }

        const insertedRows = Number(insertVersionResult.meta.changes ?? 0);
        const upsertedRows = Number(upsertActiveResult.meta.changes ?? 0);
        if (insertedRows !== 1 || upsertedRows !== 1) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Artifact persistence write counts were inconsistent with expected atomic insert/upsert behavior.",
          };
        }

        return {
          ok: true,
          artifact: {
            id: input.artifactId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            artifactType: input.artifactType,
            version: nextVersion,
            schemaVersion: parsedPayload.schemaVersion,
            payload: parsedPayload,
            createdAt: input.createdAt,
            createdByUserId: input.createdByUserId,
          },
        };
      } catch (error) {
        if (
          isVersionUniquenessConflictV1(error) &&
          attemptNumber < MAX_VERSION_INSERT_RETRIES_V1
        ) {
          continue;
        }

        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    }

    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message:
        "Failed to allocate artifact version after retrying uniqueness conflicts.",
    };
  }

  async function getActiveArtifactInternalV1<
    TType extends WorkspaceArtifactTypeV1,
  >(input: {
    artifactType: TType;
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<TType> | null> {
    const row = await db
      .prepare(SELECT_ACTIVE_ARTIFACT_SQL_V1)
      .bind(input.tenantId, input.workspaceId, input.artifactType)
      .first<ArtifactVersionRowV1>();

    if (!row) {
      return null;
    }

    return mapArtifactRowToRecordV1({
      artifactType: input.artifactType,
      row,
    });
  }

  async function listArtifactVersionsInternalV1<
    TType extends WorkspaceArtifactTypeV1,
  >(input: {
    artifactType: TType;
    tenantId: string;
    workspaceId: string;
  }): Promise<WorkspaceArtifactVersionRecordV1<TType>[]> {
    const queryResult = await db
      .prepare(LIST_ARTIFACT_VERSIONS_SQL_V1)
      .bind(input.tenantId, input.workspaceId, input.artifactType)
      .all<ArtifactVersionRowV1>();

    if (!queryResult.success) {
      throw new Error(
        queryResult.error ?? "Failed to list persisted artifact versions.",
      );
    }

    return (queryResult.results ?? []).map((row) =>
      mapArtifactRowToRecordV1({
        artifactType: input.artifactType,
        row,
      }),
    );
  }

  async function clearActiveArtifactsInternalV1(input: {
    tenantId: string;
    workspaceId: string;
    artifactTypes: WorkspaceArtifactTypeV1[];
  }): Promise<WorkspaceArtifactClearResultV1> {
    const uniqueArtifactTypes = [...new Set(input.artifactTypes)];
    const workspaceRow = await db
      .prepare(SELECT_WORKSPACE_EXISTS_SQL_V1)
      .bind(input.tenantId, input.workspaceId)
      .first<WorkspaceExistsRowV1>();
    if (!workspaceRow) {
      return {
        ok: false,
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace does not exist for tenant and workspace ID.",
      };
    }

    try {
      if (uniqueArtifactTypes.length === 0) {
        return {
          ok: true,
          clearedArtifactTypes: [],
        };
      }

      const operations = uniqueArtifactTypes.map((artifactType) =>
        db
          .prepare(DELETE_ACTIVE_ARTIFACT_SQL_V1)
          .bind(input.tenantId, input.workspaceId, artifactType),
      );
      const results = await db.batch(operations);
      const clearedArtifactTypes = uniqueArtifactTypes.filter(
        (_, index) =>
          results[index]?.success &&
          Number(results[index]?.meta.changes ?? 0) > 0,
      );

      if (results.some((result) => !result.success)) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: "Failed to clear one or more active artifact pointers.",
        };
      }

      return {
        ok: true,
        clearedArtifactTypes,
      };
    } catch (error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: toErrorMessage(error),
      };
    }
  }

  return {
    appendAnnualReportExtractionAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "annual_report_extraction",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.extraction,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    appendAnnualReportTaxAnalysisAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "annual_report_tax_analysis",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.taxAnalysis,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    appendTaxAdjustmentsAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "tax_adjustments",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.adjustments,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    appendTaxSummaryAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "tax_summary",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.summary,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    appendInk2FormAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "ink2_form",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.form,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    appendExportPackageAndSetActive(input) {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "export_package",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.exportPackage,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveAnnualReportExtraction(input) {
      return getActiveArtifactInternalV1({
        artifactType: "annual_report_extraction",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveAnnualReportTaxAnalysis(input) {
      return getActiveArtifactInternalV1({
        artifactType: "annual_report_tax_analysis",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveTaxAdjustments(input) {
      return getActiveArtifactInternalV1({
        artifactType: "tax_adjustments",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveTaxSummary(input) {
      return getActiveArtifactInternalV1({
        artifactType: "tax_summary",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveInk2Form(input) {
      return getActiveArtifactInternalV1({
        artifactType: "ink2_form",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    getActiveExportPackage(input) {
      return getActiveArtifactInternalV1({
        artifactType: "export_package",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    listExportPackages(input) {
      return listArtifactVersionsInternalV1({
        artifactType: "export_package",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
    clearActiveArtifacts(input) {
      return clearActiveArtifactsInternalV1(input);
    },
  };
}
