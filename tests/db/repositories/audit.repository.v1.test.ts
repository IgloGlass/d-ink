import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1AuditRepositoryV1 } from "../../../src/db/repositories/audit.repository.v1";
import {
  type AuditEventV2,
  parseAuditEventV2,
} from "../../../src/shared/contracts/audit-event.v2";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

function buildAuditEvent(overrides?: Partial<AuditEventV2>): AuditEventV2 {
  return parseAuditEventV2({
    id: "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1",
    tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    workspaceId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    actorType: "user",
    actorUserId: "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
    eventType: "workspace.created",
    targetType: "workspace",
    targetId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    before: {
      status: "draft",
    },
    after: {
      status: "in_review",
    },
    timestamp: "2026-02-24T10:00:00.000Z",
    context: {
      actorRole: "Admin",
      nested: {
        source: "test",
      },
    },
    ...overrides,
  });
}

describe("D1 audit repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("appends a valid audit event and preserves JSON payloads", async () => {
    const repository = createD1AuditRepositoryV1(env.DB);
    const event = buildAuditEvent();

    const result = await repository.append(event);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const persisted = await env.DB.prepare(
      `
        SELECT before_json, after_json, context_json, event_type
        FROM audit_events
        WHERE id = ?1
        `,
    )
      .bind(event.id)
      .first<{
        after_json: string | null;
        before_json: string | null;
        context_json: string;
        event_type: string;
      }>();

    expect(persisted).not.toBeNull();
    expect(persisted?.event_type).toBe("workspace.created");
    expect(JSON.parse(persisted?.before_json ?? "{}")).toEqual({
      status: "draft",
    });
    expect(JSON.parse(persisted?.after_json ?? "{}")).toEqual({
      status: "in_review",
    });
    expect(JSON.parse(persisted?.context_json ?? "{}")).toEqual({
      actorRole: "Admin",
      nested: {
        source: "test",
      },
    });
  });

  it("rejects invalid runtime payloads before DB write", async () => {
    const repository = createD1AuditRepositoryV1(env.DB);
    const invalidEvent = {
      ...buildAuditEvent(),
      actorType: "system",
      actorUserId: "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
    } as unknown as AuditEventV2;

    const result = await repository.append(invalidEvent);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSISTENCE_ERROR");
    }

    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events",
    ).first<{ count: number }>();

    expect(countRow?.count).toBe(0);
  });
});
