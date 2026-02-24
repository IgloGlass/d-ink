import { describe, expect, it } from "vitest";

import {
  safeParseWorkspaceTransitionRequestV1,
  safeParseWorkspaceTransitionResultV1,
} from "../../../src/shared/contracts/workspace-status-transition.v1";

describe("Workspace status transition shared contracts", () => {
  const validRequest = {
    fromStatus: "draft",
    toStatus: "in_review",
    actorRole: "Admin",
  } as const;

  it("accepts valid transition request with Admin role", () => {
    const result = safeParseWorkspaceTransitionRequestV1(validRequest);

    expect(result.success).toBe(true);
  });

  it("accepts valid transition request with Editor role", () => {
    const result = safeParseWorkspaceTransitionRequestV1({
      ...validRequest,
      actorRole: "Editor",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown role values", () => {
    const result = safeParseWorkspaceTransitionRequestV1({
      ...validRequest,
      actorRole: "Reviewer",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid status values", () => {
    const result = safeParseWorkspaceTransitionRequestV1({
      ...validRequest,
      toStatus: "done",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level request fields", () => {
    const result = safeParseWorkspaceTransitionRequestV1({
      ...validRequest,
      unknown: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepts success result payloads", () => {
    const result = safeParseWorkspaceTransitionResultV1({
      ok: true,
      fromStatus: "in_review",
      toStatus: "ready_for_approval",
    });

    expect(result.success).toBe(true);
  });

  it("accepts failure result payloads", () => {
    const result = safeParseWorkspaceTransitionResultV1({
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Transition is not allowed.",
        user_message: "This status change is not allowed.",
        context: {
          fromStatus: "in_review",
          toStatus: "draft",
          actorRole: "Editor",
          allowedNextStatuses: ["changes_requested", "ready_for_approval"],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts INPUT_INVALID as a failure error code", () => {
    const result = safeParseWorkspaceTransitionResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Transition request payload is invalid.",
        user_message: "The status change request is invalid.",
        context: {
          fromStatus: "draft",
          toStatus: "draft",
          actorRole: "Editor",
          allowedNextStatuses: ["in_review"],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
