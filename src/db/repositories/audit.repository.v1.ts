import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../shared/contracts/audit-event.v2";
import type { D1Database } from "../../shared/types/d1";

/**
 * Failure codes emitted by `AuditRepositoryV1#append`.
 */
export type AuditRepositoryAppendFailureCodeV1 = "PERSISTENCE_ERROR";

/**
 * Failure result contract for append-only audit writes.
 */
export type AuditRepositoryAppendFailureV1 = {
  code: AuditRepositoryAppendFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result contract for append-only audit writes.
 */
export type AuditRepositoryAppendSuccessV1 = {
  event: AuditEventV2;
  ok: true;
};

/**
 * Result contract for append-only audit writes.
 */
export type AuditRepositoryAppendResultV1 =
  | AuditRepositoryAppendSuccessV1
  | AuditRepositoryAppendFailureV1;

/**
 * Append-only audit persistence contract for V1.
 */
export interface AuditRepositoryV1 {
  append(event: AuditEventV2): Promise<AuditRepositoryAppendResultV1>;
}

const INSERT_AUDIT_EVENT_SQL = `
INSERT INTO audit_events (
  id,
  tenant_id,
  workspace_id,
  actor_type,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  before_json,
  after_json,
  policy_run_id,
  model_run_id,
  timestamp,
  context_json
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
`;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

/**
 * Creates a D1-backed V1 audit repository.
 */
export function createD1AuditRepositoryV1(db: D1Database): AuditRepositoryV1 {
  return {
    async append(event: AuditEventV2): Promise<AuditRepositoryAppendResultV1> {
      try {
        const validatedEvent = parseAuditEventV2(event);

        const beforeJson =
          validatedEvent.before === undefined
            ? null
            : JSON.stringify(validatedEvent.before);
        const afterJson =
          validatedEvent.after === undefined
            ? null
            : JSON.stringify(validatedEvent.after);
        const contextJson = JSON.stringify(validatedEvent.context);

        const insertResult = await db
          .prepare(INSERT_AUDIT_EVENT_SQL)
          .bind(
            validatedEvent.id,
            validatedEvent.tenantId,
            validatedEvent.workspaceId,
            validatedEvent.actorType,
            validatedEvent.actorUserId ?? null,
            validatedEvent.eventType,
            validatedEvent.targetType,
            validatedEvent.targetId,
            beforeJson,
            afterJson,
            validatedEvent.policyRunId ?? null,
            validatedEvent.modelRunId ?? null,
            validatedEvent.timestamp,
            contextJson,
          )
          .run();

        if (!insertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: insertResult.error ?? "Failed to append audit event.",
          };
        }

        return {
          ok: true,
          event: validatedEvent,
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
