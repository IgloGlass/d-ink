import type { AuditEventV2 } from "../../shared/contracts/audit-event.v2";

/**
 * Canonical INSERT statement for persisted V1 audit events.
 *
 * Keep this centralized so all repositories use identical column ordering.
 */
export const INSERT_AUDIT_EVENT_SQL_V1 = `
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

/**
 * Conditional INSERT used after a compare-and-set write in the same batch.
 *
 * Invariants:
 * - must execute immediately after the guarded write
 * - inserts exactly one row only when the prior statement changed one row
 */
export const INSERT_AUDIT_EVENT_IF_PREVIOUS_WRITE_APPLIED_SQL_V1 = `
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
SELECT
  ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
WHERE changes() = 1
`;

/**
 * Converts a validated audit contract into D1 bind values in stable order.
 */
export function toAuditDbValuesV1(event: AuditEventV2): Array<string | null> {
  return [
    event.id,
    event.tenantId,
    event.workspaceId,
    event.actorType,
    event.actorUserId ?? null,
    event.eventType,
    event.targetType,
    event.targetId,
    event.before === undefined ? null : JSON.stringify(event.before),
    event.after === undefined ? null : JSON.stringify(event.after),
    event.policyRunId ?? null,
    event.modelRunId ?? null,
    event.timestamp,
    JSON.stringify(event.context),
  ];
}
