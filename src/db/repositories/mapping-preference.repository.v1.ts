import {
  type MappingPreferenceScopeV1,
  MappingPreferenceScopeV1Schema,
} from "../../shared/contracts/mapping-override.v1";
import {
  type SilverfinTaxCategoryCodeV1,
  SilverfinTaxCategoryCodeV1Schema,
  type SilverfinTaxCategoryStatementTypeV1,
  SilverfinTaxCategoryStatementTypeV1Schema,
} from "../../shared/contracts/mapping.v1";
import type { D1Database } from "../../shared/types/d1";

/**
 * Persisted mapping preference record used for deterministic auto-apply.
 */
export type MappingPreferenceRecordV1 = {
  id: string;
  tenantId: string;
  scope: MappingPreferenceScopeV1;
  workspaceId?: string;
  userId?: string;
  sourceAccountNumber: string;
  statementType: SilverfinTaxCategoryStatementTypeV1;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
  reason: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
};

/**
 * Deterministic preference key.
 */
export type MappingPreferenceKeyV1 = {
  sourceAccountNumber: string;
  statementType: SilverfinTaxCategoryStatementTypeV1;
};

type MappingPreferenceUpsertEntryBaseV1 = {
  reason: string;
  selectedCategoryCode: SilverfinTaxCategoryCodeV1;
  sourceAccountNumber: string;
  statementType: SilverfinTaxCategoryStatementTypeV1;
};

/**
 * Return-scoped preference upsert entry.
 */
export type MappingPreferenceReturnUpsertEntryV1 =
  MappingPreferenceUpsertEntryBaseV1 & {
    scope: "return";
    workspaceId: string;
  };

/**
 * User-scoped preference upsert entry.
 */
export type MappingPreferenceUserUpsertEntryV1 =
  MappingPreferenceUpsertEntryBaseV1 & {
    scope: "user";
    userId: string;
  };

/**
 * Union of supported V1 preference upsert entries.
 */
export type MappingPreferenceUpsertEntryV1 =
  | MappingPreferenceReturnUpsertEntryV1
  | MappingPreferenceUserUpsertEntryV1;

/**
 * Failure codes for mapping preference repository operations.
 */
export type MappingPreferenceRepositoryFailureCodeV1 = "PERSISTENCE_ERROR";

/**
 * Failure result for mapping preference repository operations.
 */
export type MappingPreferenceRepositoryFailureV1 = {
  code: MappingPreferenceRepositoryFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result for preference upsert writes.
 */
export type MappingPreferenceUpsertBatchSuccessV1 = {
  ok: true;
  savedCount: number;
};

/**
 * Result contract for preference upsert writes.
 */
export type MappingPreferenceUpsertBatchResultV1 =
  | MappingPreferenceUpsertBatchSuccessV1
  | MappingPreferenceRepositoryFailureV1;

/**
 * Success result for applicable preference lookups.
 */
export type MappingPreferenceFindApplicableSuccessV1 = {
  ok: true;
  preferences: MappingPreferenceRecordV1[];
};

/**
 * Result contract for applicable preference lookups.
 */
export type MappingPreferenceFindApplicableResultV1 =
  | MappingPreferenceFindApplicableSuccessV1
  | MappingPreferenceRepositoryFailureV1;

/**
 * Mapping preference persistence contract for V1 override + auto-apply workflows.
 */
export interface MappingPreferenceRepositoryV1 {
  findApplicableForRows(input: {
    rows: MappingPreferenceKeyV1[];
    tenantId: string;
    userId?: string;
    workspaceId: string;
  }): Promise<MappingPreferenceFindApplicableResultV1>;
  upsertBatch(input: {
    entries: MappingPreferenceUpsertEntryV1[];
    nowIsoUtc: string;
    tenantId: string;
    actorUserId: string;
  }): Promise<MappingPreferenceUpsertBatchResultV1>;
}

type MappingPreferenceRowV1 = {
  id: string;
  tenant_id: string;
  scope: string;
  workspace_id: string | null;
  user_id: string | null;
  source_account_number: string;
  statement_type: string;
  selected_category_code: string;
  reason: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  updated_by_user_id: string;
};

const UPSERT_RETURN_SCOPE_PREFERENCE_SQL_V1 = `
INSERT INTO mapping_preferences_v1 (
  id,
  tenant_id,
  scope,
  workspace_id,
  user_id,
  source_account_number,
  statement_type,
  selected_category_code,
  reason,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
)
VALUES (?1, ?2, 'return', ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
ON CONFLICT (
  tenant_id,
  workspace_id,
  source_account_number,
  statement_type
)
WHERE scope = 'return'
DO UPDATE SET
  selected_category_code = excluded.selected_category_code,
  reason = excluded.reason,
  updated_at = excluded.updated_at,
  updated_by_user_id = excluded.updated_by_user_id
`;

const UPSERT_USER_SCOPE_PREFERENCE_SQL_V1 = `
INSERT INTO mapping_preferences_v1 (
  id,
  tenant_id,
  scope,
  workspace_id,
  user_id,
  source_account_number,
  statement_type,
  selected_category_code,
  reason,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
)
VALUES (?1, ?2, 'user', NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
ON CONFLICT (
  tenant_id,
  user_id,
  source_account_number,
  statement_type
)
WHERE scope = 'user'
DO UPDATE SET
  selected_category_code = excluded.selected_category_code,
  reason = excluded.reason,
  updated_at = excluded.updated_at,
  updated_by_user_id = excluded.updated_by_user_id
`;

const SELECT_APPLICABLE_PREFERENCES_WITH_USER_SQL_V1 = `
SELECT
  id,
  tenant_id,
  scope,
  workspace_id,
  user_id,
  source_account_number,
  statement_type,
  selected_category_code,
  reason,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
FROM mapping_preferences_v1
WHERE tenant_id = ?1
  AND (
    (scope = 'return' AND workspace_id = ?2) OR
    (scope = 'user' AND user_id = ?3)
  )
`;

const SELECT_APPLICABLE_PREFERENCES_RETURN_ONLY_SQL_V1 = `
SELECT
  id,
  tenant_id,
  scope,
  workspace_id,
  user_id,
  source_account_number,
  statement_type,
  selected_category_code,
  reason,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
FROM mapping_preferences_v1
WHERE tenant_id = ?1
  AND scope = 'return'
  AND workspace_id = ?2
`;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function normalizePreferenceKeyV1(input: MappingPreferenceKeyV1): string {
  return `${input.sourceAccountNumber.trim()}|${input.statementType}`;
}

function mapPreferenceRowToRecordV1(
  row: MappingPreferenceRowV1,
): MappingPreferenceRecordV1 {
  const scope = MappingPreferenceScopeV1Schema.parse(row.scope);
  const statementType = SilverfinTaxCategoryStatementTypeV1Schema.parse(
    row.statement_type,
  );
  const selectedCategoryCode = SilverfinTaxCategoryCodeV1Schema.parse(
    row.selected_category_code,
  );

  if (scope === "return" && !row.workspace_id) {
    throw new Error(
      "Return-scoped mapping preference is missing workspace_id.",
    );
  }

  if (scope === "user" && !row.user_id) {
    throw new Error("User-scoped mapping preference is missing user_id.");
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    scope,
    workspaceId: row.workspace_id ?? undefined,
    userId: row.user_id ?? undefined,
    sourceAccountNumber: row.source_account_number,
    statementType,
    selectedCategoryCode,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  };
}

function dedupeUpsertEntriesV1(
  entries: MappingPreferenceUpsertEntryV1[],
): MappingPreferenceUpsertEntryV1[] {
  const dedupedByKey = new Map<string, MappingPreferenceUpsertEntryV1>();
  for (const entry of entries) {
    const uniqueScopeKey =
      entry.scope === "return"
        ? `${entry.scope}|${entry.workspaceId}|${normalizePreferenceKeyV1(entry)}`
        : `${entry.scope}|${entry.userId}|${normalizePreferenceKeyV1(entry)}`;
    dedupedByKey.set(uniqueScopeKey, entry);
  }

  return [...dedupedByKey.values()];
}

/**
 * Creates a D1-backed repository for mapping override preferences.
 */
export function createD1MappingPreferenceRepositoryV1(
  db: D1Database,
): MappingPreferenceRepositoryV1 {
  return {
    async upsertBatch(input: {
      entries: MappingPreferenceUpsertEntryV1[];
      nowIsoUtc: string;
      tenantId: string;
      actorUserId: string;
    }): Promise<MappingPreferenceUpsertBatchResultV1> {
      const dedupedEntries = dedupeUpsertEntriesV1(input.entries);
      if (dedupedEntries.length === 0) {
        return {
          ok: true,
          savedCount: 0,
        };
      }

      try {
        const statements = dedupedEntries.map((entry) => {
          if (entry.scope === "return") {
            return db
              .prepare(UPSERT_RETURN_SCOPE_PREFERENCE_SQL_V1)
              .bind(
                crypto.randomUUID(),
                input.tenantId,
                entry.workspaceId,
                entry.sourceAccountNumber,
                entry.statementType,
                entry.selectedCategoryCode,
                entry.reason,
                input.nowIsoUtc,
                input.nowIsoUtc,
                input.actorUserId,
                input.actorUserId,
              );
          }

          return db
            .prepare(UPSERT_USER_SCOPE_PREFERENCE_SQL_V1)
            .bind(
              crypto.randomUUID(),
              input.tenantId,
              entry.userId,
              entry.sourceAccountNumber,
              entry.statementType,
              entry.selectedCategoryCode,
              entry.reason,
              input.nowIsoUtc,
              input.nowIsoUtc,
              input.actorUserId,
              input.actorUserId,
            );
        });

        const results = await db.batch(statements);
        if (results.some((result) => !result.success)) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              "Failed to persist one or more mapping preference upsert statements.",
          };
        }

        return {
          ok: true,
          savedCount: dedupedEntries.length,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async findApplicableForRows(input: {
      rows: MappingPreferenceKeyV1[];
      tenantId: string;
      userId?: string;
      workspaceId: string;
    }): Promise<MappingPreferenceFindApplicableResultV1> {
      const requestedKeySet = new Set(
        input.rows.map((row) => normalizePreferenceKeyV1(row)),
      );
      if (requestedKeySet.size === 0) {
        return {
          ok: true,
          preferences: [],
        };
      }

      try {
        const statement = input.userId
          ? db
              .prepare(SELECT_APPLICABLE_PREFERENCES_WITH_USER_SQL_V1)
              .bind(input.tenantId, input.workspaceId, input.userId)
          : db
              .prepare(SELECT_APPLICABLE_PREFERENCES_RETURN_ONLY_SQL_V1)
              .bind(input.tenantId, input.workspaceId);

        const queryResult = await statement.all<MappingPreferenceRowV1>();
        if (!queryResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message:
              queryResult.error ?? "Failed to query mapping preferences.",
          };
        }

        const rows = queryResult.results ?? [];
        const matchedPreferences = rows
          .map((row) => mapPreferenceRowToRecordV1(row))
          .filter((preference) =>
            requestedKeySet.has(
              normalizePreferenceKeyV1({
                sourceAccountNumber: preference.sourceAccountNumber,
                statementType: preference.statementType,
              }),
            ),
          );

        const preferredByKey = new Map<string, MappingPreferenceRecordV1>();
        for (const preference of matchedPreferences) {
          const key = normalizePreferenceKeyV1({
            sourceAccountNumber: preference.sourceAccountNumber,
            statementType: preference.statementType,
          });

          if (!preferredByKey.has(key)) {
            preferredByKey.set(key, preference);
            continue;
          }

          const current = preferredByKey.get(key);
          if (!current) {
            preferredByKey.set(key, preference);
            continue;
          }

          const shouldReplace =
            preference.scope === "return" && current.scope === "user";
          if (shouldReplace) {
            preferredByKey.set(key, preference);
          }
        }

        const sortedPreferences = [...preferredByKey.values()].sort((a, b) => {
          const keyA = normalizePreferenceKeyV1({
            sourceAccountNumber: a.sourceAccountNumber,
            statementType: a.statementType,
          });
          const keyB = normalizePreferenceKeyV1({
            sourceAccountNumber: b.sourceAccountNumber,
            statementType: b.statementType,
          });
          return keyA.localeCompare(keyB);
        });

        return {
          ok: true,
          preferences: sortedPreferences,
        };
      } catch (error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },
  };
}
