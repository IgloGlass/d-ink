import { describe, expect, it } from "vitest";

import { safeParseWorkspaceV1 } from "../../../src/shared/contracts/workspace.v1";

describe("WorkspaceV1Schema", () => {
  const validWorkspace = {
    id: "8f068d48-d67f-4a42-a85a-f083edd9cd7a",
    tenantId: "8f56c254-597b-4f98-8e75-5af4f60974a6",
    companyId: "5037f1c2-cab8-46fe-82c7-2d568ce5efff",
    fiscalYearStart: "2025-01-01",
    fiscalYearEnd: "2025-12-31",
    status: "draft",
    createdAt: "2026-02-24T14:30:00Z",
    updatedAt: "2026-02-24T14:30:00Z",
  } as const;

  it("accepts a valid workspace payload", () => {
    const result = safeParseWorkspaceV1(validWorkspace);

    expect(result.success).toBe(true);
  });

  it("rejects an unknown workspace status", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      status: "drafting",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid UUIDv4 value", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      id: "00000000-0000-1000-8000-000000000000",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid fiscalYearStart format", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      fiscalYearStart: "01-01-2025",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      fiscalYearStart: "2025-02-30",
    });

    expect(result.success).toBe(false);
  });

  it("rejects fiscal year end before fiscal year start", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      fiscalYearStart: "2025-12-31",
      fiscalYearEnd: "2025-01-01",
    });

    expect(result.success).toBe(false);
  });

  it("rejects datetime values without an offset", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      createdAt: "2026-02-24T14:30:00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = safeParseWorkspaceV1({
      ...validWorkspace,
      unexpected: "value",
    });

    expect(result.success).toBe(false);
  });
});
