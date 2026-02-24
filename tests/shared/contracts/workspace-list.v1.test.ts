import { describe, expect, it } from "vitest";

import {
  safeParseListWorkspacesByTenantRequestV1,
  safeParseListWorkspacesByTenantResultV1,
} from "../../../src/shared/contracts/workspace-lifecycle.v1";

describe("Workspace list shared contracts", () => {
  it("accepts valid list workspaces request", () => {
    const result = safeParseListWorkspacesByTenantRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown top-level fields on list workspaces request", () => {
    const result = safeParseListWorkspacesByTenantRequestV1({
      tenantId: "22222222-2222-4222-8222-222222222222",
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid list workspaces success and failure results", () => {
    const successResult = safeParseListWorkspacesByTenantResultV1({
      ok: true,
      workspaces: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          tenantId: "22222222-2222-4222-8222-222222222222",
          companyId: "33333333-3333-4333-8333-333333333333",
          fiscalYearStart: "2025-01-01",
          fiscalYearEnd: "2025-12-31",
          status: "draft",
          createdAt: "2026-02-24T10:00:00.000Z",
          updatedAt: "2026-02-24T10:00:00.000Z",
        },
      ],
    });

    const failureResult = safeParseListWorkspacesByTenantResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Invalid request.",
        user_message: "The request is invalid.",
        context: {
          issues: [],
        },
      },
    });

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(true);
  });
});
