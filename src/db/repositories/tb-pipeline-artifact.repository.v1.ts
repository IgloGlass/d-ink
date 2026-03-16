import {
  type MappingDecisionSetArtifactV1,
  parseMappingDecisionSetArtifactV1,
} from "../../shared/contracts/mapping.v1";
import {
  type ReconciliationResultPayloadV1,
  parseReconciliationResultPayloadV1,
} from "../../shared/contracts/reconciliation.v1";
import {
  type TrialBalanceNormalizedArtifactV1,
  parseTrialBalanceNormalizedV1,
} from "../../shared/contracts/trial-balance.v1";
import type { D1Database } from "../../shared/types/d1";

/**
 * Artifact domains persisted as immutable versions for the TB pipeline.
 */
export type TbPipelineArtifactTypeV1 =
  | "trial_balance"
  | "reconciliation"
  | "mapping";

type TbPipelineArtifactPayloadByTypeV1 = {
  mapping: MappingDecisionSetArtifactV1;
  reconciliation: ReconciliationResultPayloadV1;
  trial_balance: TrialBalanceNormalizedArtifactV1;
};

/**
 * Strongly typed persisted artifact record, including immutable metadata.
 */
export type TbPipelineArtifactVersionRecordV1<
  TType extends TbPipelineArtifactTypeV1,
> = {
  artifactType: TType;
  createdAt: string;
  createdByUserId?: string;
  id: string;
  payload: TbPipelineArtifactPayloadByTypeV1[TType];
  schemaVersion: TbPipelineArtifactPayloadByTypeV1[TType]["schemaVersion"];
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

/**
 * Append request for a parsed trial balance artifact.
 */
export type AppendTrialBalanceArtifactInputV1 = AppendArtifactInputBaseV1 & {
  trialBalance: TrialBalanceNormalizedArtifactV1;
};

/**
 * Append request for a reconciliation artifact.
 */
export type AppendReconciliationArtifactInputV1 = AppendArtifactInputBaseV1 & {
  reconciliation: ReconciliationResultPayloadV1;
};

/**
 * Append request for a deterministic mapping artifact.
 */
export type AppendMappingArtifactInputV1 = AppendArtifactInputBaseV1 & {
  mapping: MappingDecisionSetArtifactV1;
};

/**
 * Failure codes emitted by append-and-set-active writes.
 */
export type TbPipelineArtifactWriteFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

/**
 * Failure result for append-and-set-active writes.
 */
export type TbPipelineArtifactWriteFailureV1 = {
  code: TbPipelineArtifactWriteFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result for append-and-set-active writes.
 */
export type TbPipelineArtifactWriteSuccessV1<
  TType extends TbPipelineArtifactTypeV1,
> = {
  artifact: TbPipelineArtifactVersionRecordV1<TType>;
  ok: true;
};

/**
 * Result contract for append-and-set-active writes.
 */
export type TbPipelineArtifactWriteResultV1<
  TType extends TbPipelineArtifactTypeV1,
> = TbPipelineArtifactWriteSuccessV1<TType> | TbPipelineArtifactWriteFailureV1;

export type TbPipelineArtifactClearFailureCodeV1 =
  | "WORKSPACE_NOT_FOUND"
  | "PERSISTENCE_ERROR";

export type TbPipelineArtifactClearResultV1 =
  | {
      ok: true;
      clearedArtifactTypes: TbPipelineArtifactTypeV1[];
    }
  | {
      ok: false;
      code: TbPipelineArtifactClearFailureCodeV1;
      message: string;
    };

/**
 * Persistence contract for immutable TB pipeline artifacts.
 */
export interface TbPipelineArtifactRepositoryV1 {
  appendMappingAndSetActive(
    input: AppendMappingArtifactInputV1,
  ): Promise<TbPipelineArtifactWriteResultV1<"mapping">>;
  appendReconciliationAndSetActive(
    input: AppendReconciliationArtifactInputV1,
  ): Promise<TbPipelineArtifactWriteResultV1<"reconciliation">>;
  appendTrialBalanceAndSetActive(
    input: AppendTrialBalanceArtifactInputV1,
  ): Promise<TbPipelineArtifactWriteResultV1<"trial_balance">>;
  getActiveMapping(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"mapping"> | null>;
  getActiveReconciliation(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"reconciliation"> | null>;
  getActiveTrialBalance(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"trial_balance"> | null>;
  clearActiveArtifacts(input: {
    tenantId: string;
    workspaceId: string;
    artifactTypes: TbPipelineArtifactTypeV1[];
  }): Promise<TbPipelineArtifactClearResultV1>;
  listMappingVersions(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"mapping">[]>;
  listReconciliationVersions(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"reconciliation">[]>;
  listTrialBalanceVersions(input: {
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<"trial_balance">[]>;
}

type WorkspaceExistsRowV1 = {
  id: string;
};

type NextVersionRowV1 = {
  next_version: number;
};

type ArtifactVersionRowV1 = {
  artifact_type: TbPipelineArtifactTypeV1;
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
FROM tb_pipeline_artifact_versions
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND artifact_type = ?3
`;

const INSERT_ARTIFACT_VERSION_SQL_V1 = `
INSERT INTO tb_pipeline_artifact_versions (
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
INSERT INTO tb_pipeline_active_artifacts (
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
FROM tb_pipeline_active_artifacts active
JOIN tb_pipeline_artifact_versions versions
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
FROM tb_pipeline_artifact_versions
WHERE tenant_id = ?1
  AND workspace_id = ?2
  AND artifact_type = ?3
ORDER BY version DESC, id ASC
`;

const DELETE_ACTIVE_ARTIFACT_SQL_V1 = `
DELETE FROM tb_pipeline_active_artifacts
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
    message.includes("tb_pipeline_artifact_versions.tenant_id") &&
    message.includes("tb_pipeline_artifact_versions.workspace_id") &&
    message.includes("tb_pipeline_artifact_versions.artifact_type") &&
    message.includes("tb_pipeline_artifact_versions.version")
  );
}

function parseArtifactPayloadByTypeV1<TType extends TbPipelineArtifactTypeV1>(
  artifactType: TType,
  input: unknown,
): TbPipelineArtifactPayloadByTypeV1[TType] {
  switch (artifactType) {
    case "trial_balance":
      return parseTrialBalanceNormalizedV1(
        input,
      ) as TbPipelineArtifactPayloadByTypeV1[TType];
    case "reconciliation":
      return parseReconciliationResultPayloadV1(
        input,
      ) as TbPipelineArtifactPayloadByTypeV1[TType];
    case "mapping":
      return parseMappingDecisionSetArtifactV1(
        input,
      ) as TbPipelineArtifactPayloadByTypeV1[TType];
    default: {
      const exhaustiveCheck: never = artifactType;
      throw new Error(`Unsupported artifact type: ${String(exhaustiveCheck)}`);
    }
  }
}

function mapArtifactRowToRecordV1<
  TType extends TbPipelineArtifactTypeV1,
>(input: {
  artifactType: TType;
  row: ArtifactVersionRowV1;
}): TbPipelineArtifactVersionRecordV1<TType> {
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

/**
 * Creates a D1-backed repository for versioned trial-balance pipeline artifacts.
 */
export function createD1TbPipelineArtifactRepositoryV1(
  db: D1Database,
): TbPipelineArtifactRepositoryV1 {
  async function appendArtifactAndSetActiveInternalV1<
    TType extends TbPipelineArtifactTypeV1,
  >(input: {
    artifactId: string;
    artifactType: TType;
    createdAt: string;
    createdByUserId?: string;
    payload: TbPipelineArtifactPayloadByTypeV1[TType];
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactWriteResultV1<TType>> {
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
    TType extends TbPipelineArtifactTypeV1,
  >(input: {
    artifactType: TType;
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<TType> | null> {
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
    TType extends TbPipelineArtifactTypeV1,
  >(input: {
    artifactType: TType;
    tenantId: string;
    workspaceId: string;
  }): Promise<TbPipelineArtifactVersionRecordV1<TType>[]> {
    const queryResult = await db
      .prepare(LIST_ARTIFACT_VERSIONS_SQL_V1)
      .bind(input.tenantId, input.workspaceId, input.artifactType)
      .all<ArtifactVersionRowV1>();

    if (!queryResult.success) {
      throw new Error(
        queryResult.error ?? "Failed to list persisted artifact versions.",
      );
    }

    const rows = queryResult.results ?? [];
    return rows.map((row) =>
      mapArtifactRowToRecordV1({
        artifactType: input.artifactType,
        row,
      }),
    );
  }

  async function clearActiveArtifactsInternalV1(input: {
    tenantId: string;
    workspaceId: string;
    artifactTypes: TbPipelineArtifactTypeV1[];
  }): Promise<TbPipelineArtifactClearResultV1> {
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
          message: "Failed to clear one or more active TB pipeline pointers.",
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
    appendTrialBalanceAndSetActive(
      input: AppendTrialBalanceArtifactInputV1,
    ): Promise<TbPipelineArtifactWriteResultV1<"trial_balance">> {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "trial_balance",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.trialBalance,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    appendReconciliationAndSetActive(
      input: AppendReconciliationArtifactInputV1,
    ): Promise<TbPipelineArtifactWriteResultV1<"reconciliation">> {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "reconciliation",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.reconciliation,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    appendMappingAndSetActive(
      input: AppendMappingArtifactInputV1,
    ): Promise<TbPipelineArtifactWriteResultV1<"mapping">> {
      return appendArtifactAndSetActiveInternalV1({
        artifactId: input.artifactId,
        artifactType: "mapping",
        createdAt: input.createdAt,
        createdByUserId: input.createdByUserId,
        payload: input.mapping,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    getActiveTrialBalance(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"trial_balance"> | null> {
      return getActiveArtifactInternalV1({
        artifactType: "trial_balance",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    getActiveReconciliation(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"reconciliation"> | null> {
      return getActiveArtifactInternalV1({
        artifactType: "reconciliation",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    getActiveMapping(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"mapping"> | null> {
      return getActiveArtifactInternalV1({
        artifactType: "mapping",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    clearActiveArtifacts(input: {
      tenantId: string;
      workspaceId: string;
      artifactTypes: TbPipelineArtifactTypeV1[];
    }): Promise<TbPipelineArtifactClearResultV1> {
      return clearActiveArtifactsInternalV1(input);
    },

    listTrialBalanceVersions(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"trial_balance">[]> {
      return listArtifactVersionsInternalV1({
        artifactType: "trial_balance",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    listReconciliationVersions(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"reconciliation">[]> {
      return listArtifactVersionsInternalV1({
        artifactType: "reconciliation",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },

    listMappingVersions(input: {
      tenantId: string;
      workspaceId: string;
    }): Promise<TbPipelineArtifactVersionRecordV1<"mapping">[]> {
      return listArtifactVersionsInternalV1({
        artifactType: "mapping",
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
      });
    },
  };
}
