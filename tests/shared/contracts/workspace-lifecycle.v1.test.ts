import { describe, expect, it } from "vitest";

import {
  safeParseApplyWorkspaceTransitionRequestV1,
  safeParseApplyWorkspaceTransitionResultV1,
  safeParseCreateWorkspaceRequestV1,
  safeParseCreateWorkspaceResultV1,
} from "../../../src/shared/contracts/workspace-lifecycle.v1";

describe("Workspace lifecycle shared contracts", () => {
  const validActor = {
    actorType: "user",
    actorRole: "Admin",
    actorUserId: "11111111-1111-4111-8111-111111111111",
  } as const;

  it("accepts a valid create workspace request with user actor context", () => {
    const result = safeParseCreateWorkspaceRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      companyId: "33333333-3333-4333-8333-333333333333",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      actor: validActor,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid actor context for system actor without actorUserId", () => {
    const result = safeParseCreateWorkspaceRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      companyId: "33333333-3333-4333-8333-333333333333",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      actor: {
        actorType: "system",
        actorRole: "Editor",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects user actor context when actorUserId is missing", () => {
    const result = safeParseCreateWorkspaceRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      companyId: "33333333-3333-4333-8333-333333333333",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      actor: {
        actorType: "user",
        actorRole: "Editor",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects system actor context when actorUserId is present", () => {
    const result = safeParseCreateWorkspaceRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      companyId: "33333333-3333-4333-8333-333333333333",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      actor: {
        actorType: "system",
        actorRole: "Editor",
        actorUserId: "11111111-1111-4111-8111-111111111111",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid create success and failure result payloads", () => {
    const successResult = safeParseCreateWorkspaceResultV1({
      ok: true,
      workspace: {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId: "22222222-2222-4222-8222-222222222222",
        companyId: "33333333-3333-4333-8333-333333333333",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        status: "draft",
        createdAt: "2026-02-24T10:00:00.000Z",
        updatedAt: "2026-02-24T10:00:00.000Z",
      },
      auditEvent: {
        id: "55555555-5555-4555-8555-555555555555",
        tenantId: "22222222-2222-4222-8222-222222222222",
        workspaceId: "44444444-4444-4444-8444-444444444444",
        actorType: "user",
        actorUserId: "11111111-1111-4111-8111-111111111111",
        eventType: "workspace.created",
        targetType: "workspace",
        targetId: "44444444-4444-4444-8444-444444444444",
        timestamp: "2026-02-24T10:00:00.000Z",
        context: { actorRole: "Admin" },
      },
    });

    const failureResult = safeParseCreateWorkspaceResultV1({
      ok: false,
      error: {
        code: "DUPLICATE_WORKSPACE",
        message: "Duplicate workspace.",
        user_message: "A workspace already exists.",
        context: {
          companyId: "33333333-3333-4333-8333-333333333333",
        },
      },
    });

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(true);
  });

  it("accepts valid apply transition success and failure result payloads", () => {
    const successResult = safeParseApplyWorkspaceTransitionResultV1({
      ok: true,
      workspace: {
        id: "44444444-4444-4444-8444-444444444444",
        tenantId: "22222222-2222-4222-8222-222222222222",
        companyId: "33333333-3333-4333-8333-333333333333",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        status: "in_review",
        createdAt: "2026-02-24T10:00:00.000Z",
        updatedAt: "2026-02-24T10:05:00.000Z",
      },
      auditEvent: {
        id: "66666666-6666-4666-8666-666666666666",
        tenantId: "22222222-2222-4222-8222-222222222222",
        workspaceId: "44444444-4444-4444-8444-444444444444",
        actorType: "user",
        actorUserId: "11111111-1111-4111-8111-111111111111",
        eventType: "workspace.status_changed",
        targetType: "workspace",
        targetId: "44444444-4444-4444-8444-444444444444",
        before: { status: "draft" },
        after: { status: "in_review" },
        timestamp: "2026-02-24T10:05:00.000Z",
        context: { actorRole: "Admin" },
      },
    });

    const failureResult = safeParseApplyWorkspaceTransitionResultV1({
      ok: false,
      error: {
        code: "TRANSITION_REJECTED",
        message: "Transition rejected.",
        user_message: "This status change is not allowed.",
        context: {
          transitionError: {
            code: "INVALID_TRANSITION",
          },
        },
      },
    });

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(true);
  });

  it("rejects unknown top-level fields via strict schema", () => {
    const result = safeParseApplyWorkspaceTransitionRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      workspaceId: "44444444-4444-4444-8444-444444444444",
      toStatus: "in_review",
      actor: validActor,
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});
