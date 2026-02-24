import { describe, expect, it } from "vitest";

import {
  evaluateWorkspaceStatusTransitionV1,
  getAllowedNextWorkspaceStatusesV1,
} from "../../../src/server/workflow/workspace-status-transition.v1";

describe("workspace status transition workflow", () => {
  it("allows canonical forward transitions for Editor", () => {
    const transitions = [
      { fromStatus: "draft", toStatus: "in_review" },
      { fromStatus: "in_review", toStatus: "changes_requested" },
      { fromStatus: "changes_requested", toStatus: "draft" },
      { fromStatus: "in_review", toStatus: "ready_for_approval" },
      { fromStatus: "ready_for_approval", toStatus: "approved_for_export" },
      { fromStatus: "approved_for_export", toStatus: "exported" },
      { fromStatus: "exported", toStatus: "client_accepted" },
      { fromStatus: "client_accepted", toStatus: "filed" },
    ] as const;

    for (const transition of transitions) {
      const result = evaluateWorkspaceStatusTransitionV1({
        ...transition,
        actorRole: "Editor",
      });

      expect(result.ok).toBe(true);
    }
  });

  it("allows reopen transitions to draft from approved_for_export, exported, and client_accepted", () => {
    const fromStatuses = [
      "approved_for_export",
      "exported",
      "client_accepted",
    ] as const;

    for (const fromStatus of fromStatuses) {
      const result = evaluateWorkspaceStatusTransitionV1({
        fromStatus,
        toStatus: "draft",
        actorRole: "Editor",
      });

      expect(result.ok).toBe(true);
    }
  });

  it("rejects filed to draft for Editor with ROLE_FORBIDDEN", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "filed",
      toStatus: "draft",
      actorRole: "Editor",
      reason: "Need to reopen",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROLE_FORBIDDEN");
      expect(result.error.context.allowedNextStatuses).toEqual([]);
    }
  });

  it("allows filed to draft for Admin with non-empty reason", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "filed",
      toStatus: "draft",
      actorRole: "Admin",
      reason: "Client requested correction",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects filed to draft for Admin without reason", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "filed",
      toStatus: "draft",
      actorRole: "Admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REASON_REQUIRED");
    }
  });

  it("rejects filed to draft for Admin with whitespace reason", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "filed",
      toStatus: "draft",
      actorRole: "Admin",
      reason: "   ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REASON_REQUIRED");
    }
  });

  it("rejects no-op transitions", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "draft",
      toStatus: "draft",
      actorRole: "Admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_OP_TRANSITION");
    }
  });

  it("rejects invalid non-matrix transitions with allowedNextStatuses context", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "in_review",
      toStatus: "exported",
      actorRole: "Editor",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TRANSITION");
      expect(result.error.context.allowedNextStatuses).toEqual([
        "changes_requested",
        "ready_for_approval",
      ]);
    }
  });

  it("returns actor-aware allowed next statuses", () => {
    const adminAllowed = getAllowedNextWorkspaceStatusesV1({
      fromStatus: "filed",
      actorRole: "Admin",
    });
    const editorAllowed = getAllowedNextWorkspaceStatusesV1({
      fromStatus: "filed",
      actorRole: "Editor",
    });

    expect(adminAllowed).toEqual(["draft"]);
    expect(editorAllowed).toEqual([]);
  });

  it("returns INPUT_INVALID instead of throwing on malformed input", () => {
    const result = evaluateWorkspaceStatusTransitionV1({
      fromStatus: "not_a_status",
      actorRole: "Editor",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_INVALID");
      expect(result.error.context.allowedNextStatuses).toEqual(["in_review"]);
    }
  });
});
