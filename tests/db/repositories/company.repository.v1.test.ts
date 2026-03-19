import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1CompanyRepositoryV1 } from "../../../src/db/repositories/company.repository.v1";
import {
  type CompanyV1,
  parseCompanyV1,
} from "../../../src/shared/contracts/company.v1";
import { applyWorkspaceAuditSchemaForTests } from "../test-schema";

function buildCompanyV1(overrides?: Partial<CompanyV1>): CompanyV1 {
  return parseCompanyV1({
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    legalName: "Examplebolaget AB",
    organizationNumber: "5561231234",
    defaultFiscalYearStart: "2025-01-01",
    defaultFiscalYearEnd: "2025-12-31",
    createdAt: "2026-03-05T12:00:00.000Z",
    updatedAt: "2026-03-05T12:00:00.000Z",
    ...overrides,
  });
}

describe("D1 company repository v1", () => {
  beforeEach(async () => {
    await applyWorkspaceAuditSchemaForTests();
  });

  it("creates a company successfully", async () => {
    const repository = createD1CompanyRepositoryV1(env.DB);
    const company = buildCompanyV1();

    const result = await repository.create(company);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.company).toEqual(company);
    }
  });

  it("updates a company successfully and keeps organization numbers normalized", async () => {
    const repository = createD1CompanyRepositoryV1(env.DB);
    const originalCompany = buildCompanyV1();
    await repository.create(originalCompany);

    const updatedCompany = buildCompanyV1({
      legalName: "Updated Examplebolaget AB",
      organizationNumber: "5569999999",
      updatedAt: "2026-03-05T12:01:00.000Z",
    });

    const result = await repository.update(updatedCompany);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.company.legalName).toBe("Updated Examplebolaget AB");
      expect(result.company.organizationNumber).toBe("5569999999");
    }

    const loaded = await repository.getById({
      tenantId: originalCompany.tenantId,
      companyId: originalCompany.id,
    });
    expect(loaded?.legalName).toBe("Updated Examplebolaget AB");
    expect(loaded?.organizationNumber).toBe("5569999999");
  });

  it("rejects duplicate tenant/organization-number company creation", async () => {
    const repository = createD1CompanyRepositoryV1(env.DB);
    await repository.create(buildCompanyV1());

    const duplicateResult = await repository.create(
      buildCompanyV1({
        id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        legalName: "Another Name AB",
      }),
    );

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.code).toBe("DUPLICATE_COMPANY");
    }
  });

  it("lists companies by tenant in deterministic updatedAt-desc order", async () => {
    const repository = createD1CompanyRepositoryV1(env.DB);

    await repository.create(
      buildCompanyV1({
        id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        organizationNumber: "5562342345",
        updatedAt: "2026-03-05T12:01:00.000Z",
      }),
    );
    await repository.create(
      buildCompanyV1({
        id: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
        organizationNumber: "5563453456",
        updatedAt: "2026-03-05T12:03:00.000Z",
      }),
    );
    await repository.create(
      buildCompanyV1({
        id: "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
        tenantId: "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        organizationNumber: "5564564567",
        updatedAt: "2026-03-05T12:04:00.000Z",
      }),
    );

    const listed = await repository.listByTenant({
      tenantId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });

    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3");
    expect(listed[1]?.id).toBe("aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
  });

  it("normalizes legacy sqlite timestamps when loading companies", async () => {
    const repository = createD1CompanyRepositoryV1(env.DB);
    const company = buildCompanyV1({
      id: "aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    });
    const normalizedCompany = buildCompanyV1({
      id: company.id,
      tenantId: company.tenantId,
      legalName: company.legalName,
      organizationNumber: company.organizationNumber,
      defaultFiscalYearStart: company.defaultFiscalYearStart,
      defaultFiscalYearEnd: company.defaultFiscalYearEnd,
      createdAt: "2026-03-19T20:22:27.000Z",
      updatedAt: "2026-03-19T20:22:27.000Z",
    });

    await env.DB.prepare(
      `
        INSERT INTO companies_v1 (
          id,
          tenant_id,
          legal_name,
          organization_number,
          default_fiscal_year_start,
          default_fiscal_year_end,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
      .bind(
        company.id,
        company.tenantId,
        company.legalName,
        company.organizationNumber,
        company.defaultFiscalYearStart,
        company.defaultFiscalYearEnd,
        "2026-03-19 20:22:27",
        "2026-03-19 20:22:27",
      )
      .run();

    const listed = await repository.listByTenant({
      tenantId: company.tenantId,
    });

    expect(listed).toEqual([normalizedCompany]);
  });
});
