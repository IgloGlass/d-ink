import { describe, expect, it } from "vitest";

import {
  CollaborationTaskV1Schema,
  parseCompleteTaskResultV1,
  parseCreateCommentResultV1,
} from "../../../src/shared/contracts/collaboration.v1";

describe("collaboration contracts v1", () => {
  it("accepts valid comment/task envelopes", () => {
    expect(
      parseCreateCommentResultV1({
        ok: true,
        comment: {
          id: "99300000-0000-4000-8000-000000000001",
          tenantId: "99300000-0000-4000-8000-000000000002",
          workspaceId: "99300000-0000-4000-8000-000000000003",
          body: "Please verify representation adjustment.",
          createdByUserId: "99300000-0000-4000-8000-000000000004",
          createdAt: "2026-03-03T09:00:00.000Z",
        },
      }).ok,
    ).toBe(true);

    expect(
      parseCompleteTaskResultV1({
        ok: true,
        task: {
          id: "99300000-0000-4000-8000-000000000010",
          tenantId: "99300000-0000-4000-8000-000000000002",
          workspaceId: "99300000-0000-4000-8000-000000000003",
          title: "Review annual extraction",
          createdByUserId: "99300000-0000-4000-8000-000000000004",
          status: "completed",
          createdAt: "2026-03-03T09:00:00.000Z",
          completedAt: "2026-03-03T09:05:00.000Z",
          completedByUserId: "99300000-0000-4000-8000-000000000004",
        },
      }).ok,
    ).toBe(true);
  });

  it("rejects completed tasks without completed metadata", () => {
    const result = CollaborationTaskV1Schema.safeParse({
      id: "99300000-0000-4000-8000-000000000010",
      tenantId: "99300000-0000-4000-8000-000000000002",
      workspaceId: "99300000-0000-4000-8000-000000000003",
      title: "Review annual extraction",
      createdByUserId: "99300000-0000-4000-8000-000000000004",
      status: "completed",
      createdAt: "2026-03-03T09:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
