import { describe, expect, it } from "vitest";

import { safeParseAuditEventV2 } from "../../../src/shared/contracts/audit-event.v2";

describe("AuditEventV2Schema", () => {
  const baseEvent = {
    id: "25f0135f-e842-41cd-a153-00e7a267f762",
    tenantId: "b425bcc4-7e1a-4d0f-a26e-c8d6dfe2037d",
    workspaceId: "6f780333-952f-40cc-b32c-4f8f654d9f69",
    actorType: "system",
    eventType: "workspace.created",
    targetType: "workspace",
    targetId: "66f0ecfa-fbf4-41ba-92b4-cb7eea58fd25",
    timestamp: "2026-02-24T15:30:00+01:00",
    context: {
      nested: {
        source: "seed",
      },
    },
  } as const;

  it("accepts a valid event with UUID targetId", () => {
    const result = safeParseAuditEventV2(baseEvent);

    expect(result.success).toBe(true);
  });

  it("accepts a valid event with non-UUID targetId", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      targetId: "ink2.field.B3",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty targetId", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      targetId: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only targetId", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      targetId: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a user event without actorUserId", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      actorType: "user",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a system event when actorUserId is present", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      actorUserId: "a335de9f-58bc-45ff-b393-896b22889af6",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid eventType pattern", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      eventType: "WorkspaceCreated",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      extra: "unexpected",
    });

    expect(result.success).toBe(false);
  });

  it("accepts arbitrary nested keys inside context", () => {
    const result = safeParseAuditEventV2({
      ...baseEvent,
      context: {
        one: 1,
        two: "two",
        deep: {
          value: true,
          items: [1, 2, 3],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
