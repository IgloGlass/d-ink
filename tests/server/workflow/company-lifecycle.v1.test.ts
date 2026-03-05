import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type CompanyRepositoryV1,
  createD1CompanyRepositoryV1,
} from "../../../src/db/repositories/company.repository.v1";
import {
  type CompanyLifecycleDepsV1,
  createCompanyV1,
  getCompanyByIdV1,
  listCompaniesByTenantV1,
} from "../../../src/server/workflow/company-lifecycle.v1";
import { applyWorkspaceAuditSchemaForTests } from "../../db/test-schema";

const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "50000000-0000-4000-8000-000000000005";

function buildDepsForTest(input: {
  ids: string[];
  timestamps: string[];
  companyRepository?: CompanyRepositoryV1;
}): CompanyLifecycleDepsV1 {
  let idIndex = 0;
  let timestampIndex = 0;

  return {
    companyRepository:
      input.companyRepository ?? createD1CompanyRepositoryV1(env.DB),
    generateId: () => {
      const value = input.ids[idIndex];
      idIndex += 1;
      if (!value) {
        throw new Error("No remaining deterministic IDs for test.");
      }
      return value;
    },
    nowIsoUtc: () => {
      const value = input.timestamps[timestampIndex];
      timestampIndex += 1;
      if (!value) {
        throw new Error("No remaining deterministic timestamps for test.");
      }
      return value;
    },
  };
}

describe("company lifecycle workflow service", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates company with normalized organization number", async () => {
    const deps = buildDepsForTest({
      ids: ["30000000-0000-4000-8000-000000000003"],
      timestamps: ["2026-03-05T12:00:00.000Z"],
    });

    const result = await createCompanyV1(
      {
        tenantId: TENANT_ID,
        legalName: "Examplebolaget AB",
        organizationNumber: "556123-1234",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: USER_ID,
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.company.organizationNumber).toBe("5561231234");
    }
  });

  it("gets company by tenant and company id", async () => {
    const deps = buildDepsForTest({
      ids: ["30000000-0000-4000-8000-000000000013"],
      timestamps: ["2026-03-05T12:01:00.000Z"],
    });

    const createResult = await createCompanyV1(
      {
        tenantId: TENANT_ID,
        legalName: "Lookup AB",
        organizationNumber: "556234-2345",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: USER_ID,
        },
      },
      deps,
    );
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    const getResult = await getCompanyByIdV1(
      {
        tenantId: TENANT_ID,
        companyId: createResult.company.id,
      },
      deps,
    );

    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.company?.id).toBe(createResult.company.id);
      expect(getResult.company?.legalName).toBe("Lookup AB");
    }
  });

  it("lists companies by tenant", async () => {
    const deps = buildDepsForTest({
      ids: [
        "30000000-0000-4000-8000-000000000023",
        "30000000-0000-4000-8000-000000000024",
      ],
      timestamps: ["2026-03-05T12:02:00.000Z", "2026-03-05T12:03:00.000Z"],
    });

    await createCompanyV1(
      {
        tenantId: TENANT_ID,
        legalName: "First AB",
        organizationNumber: "556345-3456",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: USER_ID,
        },
      },
      deps,
    );
    await createCompanyV1(
      {
        tenantId: TENANT_ID,
        legalName: "Second AB",
        organizationNumber: "556456-4567",
        defaultFiscalYearStart: "2025-01-01",
        defaultFiscalYearEnd: "2025-12-31",
        actor: {
          actorType: "user",
          actorRole: "Admin",
          actorUserId: USER_ID,
        },
      },
      deps,
    );

    const listResult = await listCompaniesByTenantV1(
      { tenantId: TENANT_ID },
      deps,
    );

    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.companies).toHaveLength(2);
      expect(listResult.companies[0]?.legalName).toBe("Second AB");
    }
  });
});
