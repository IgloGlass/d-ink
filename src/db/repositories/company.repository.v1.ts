import {
  type CompanyV1,
  parseCompanyV1,
} from "../../shared/contracts/company.v1";
import type { D1Database } from "../../shared/types/d1";
import { normalizeSqliteTimestampV1 } from "./sqlite-timestamp.v1";

/**
 * Failure codes emitted by create operations.
 */
export type CompanyRepositoryCreateFailureCodeV1 =
  | "DUPLICATE_COMPANY"
  | "PERSISTENCE_ERROR";

/**
 * Failure result contract for company creation.
 */
export type CompanyRepositoryCreateFailureV1 = {
  code: CompanyRepositoryCreateFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result contract for company creation.
 */
export type CompanyRepositoryCreateSuccessV1 = {
  ok: true;
  company: CompanyV1;
};

/**
 * Result contract for company creation.
 */
export type CompanyRepositoryCreateResultV1 =
  | CompanyRepositoryCreateSuccessV1
  | CompanyRepositoryCreateFailureV1;

/**
 * Failure codes emitted by update operations.
 */
export type CompanyRepositoryUpdateFailureCodeV1 =
  | "COMPANY_NOT_FOUND"
  | "DUPLICATE_COMPANY"
  | "PERSISTENCE_ERROR";

/**
 * Failure result contract for company updates.
 */
export type CompanyRepositoryUpdateFailureV1 = {
  code: CompanyRepositoryUpdateFailureCodeV1;
  message: string;
  ok: false;
};

/**
 * Success result contract for company updates.
 */
export type CompanyRepositoryUpdateSuccessV1 = {
  company: CompanyV1;
  ok: true;
};

/**
 * Result contract for company updates.
 */
export type CompanyRepositoryUpdateResultV1 =
  | CompanyRepositoryUpdateSuccessV1
  | CompanyRepositoryUpdateFailureV1;

/**
 * Company persistence contract for V1 lifecycle operations.
 */
export interface CompanyRepositoryV1 {
  create(company: CompanyV1): Promise<CompanyRepositoryCreateResultV1>;
  getById(input: {
    companyId: string;
    tenantId: string;
  }): Promise<CompanyV1 | null>;
  update(company: CompanyV1): Promise<CompanyRepositoryUpdateResultV1>;
  listByTenant(input: { tenantId: string }): Promise<CompanyV1[]>;
}

type CompanyRowV1 = {
  id: string;
  tenant_id: string;
  legal_name: string;
  organization_number: string;
  default_fiscal_year_start: string;
  default_fiscal_year_end: string;
  created_at: string;
  updated_at: string;
};

const INSERT_COMPANY_SQL_V1 = `
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
`;

const UPDATE_COMPANY_SQL_V1 = `
UPDATE companies_v1
SET
  legal_name = ?3,
  organization_number = ?4,
  default_fiscal_year_start = ?5,
  default_fiscal_year_end = ?6,
  updated_at = ?7
WHERE tenant_id = ?1 AND id = ?2
`;

const SELECT_COMPANY_BY_ID_SQL_V1 = `
SELECT
  id,
  tenant_id,
  legal_name,
  organization_number,
  default_fiscal_year_start,
  default_fiscal_year_end,
  created_at,
  updated_at
FROM companies_v1
WHERE tenant_id = ?1 AND id = ?2
`;

const LIST_COMPANIES_BY_TENANT_SQL_V1 = `
SELECT
  id,
  tenant_id,
  legal_name,
  organization_number,
  default_fiscal_year_start,
  default_fiscal_year_end,
  created_at,
  updated_at
FROM companies_v1
WHERE tenant_id = ?1
ORDER BY updated_at DESC, id ASC
`;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

function isDuplicateCompanyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique constraint failed") &&
    error.message.toLowerCase().includes("companies_v1.")
  );
}

function mapCompanyRowToContractV1(row: CompanyRowV1): CompanyV1 {
  return parseCompanyV1({
    id: row.id,
    tenantId: row.tenant_id,
    legalName: row.legal_name,
    organizationNumber: row.organization_number,
    defaultFiscalYearStart: row.default_fiscal_year_start,
    defaultFiscalYearEnd: row.default_fiscal_year_end,
    createdAt: normalizeSqliteTimestampV1(row.created_at),
    updatedAt: normalizeSqliteTimestampV1(row.updated_at),
  });
}

/**
 * Creates a D1-backed V1 company repository.
 */
export function createD1CompanyRepositoryV1(
  db: D1Database,
): CompanyRepositoryV1 {
  return {
    async create(company: CompanyV1): Promise<CompanyRepositoryCreateResultV1> {
      const validatedCompany = parseCompanyV1(company);

      try {
        const insertResult = await db
          .prepare(INSERT_COMPANY_SQL_V1)
          .bind(
            validatedCompany.id,
            validatedCompany.tenantId,
            validatedCompany.legalName,
            validatedCompany.organizationNumber,
            validatedCompany.defaultFiscalYearStart,
            validatedCompany.defaultFiscalYearEnd,
            validatedCompany.createdAt,
            validatedCompany.updatedAt,
          )
          .run();

        if (!insertResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: insertResult.error ?? "Failed to insert company.",
          };
        }

        return {
          ok: true,
          company: validatedCompany,
        };
      } catch (error) {
        if (isDuplicateCompanyError(error)) {
          return {
            ok: false,
            code: "DUPLICATE_COMPANY",
            message:
              "Company already exists for this tenant and organization number.",
          };
        }

        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async getById(input: {
      companyId: string;
      tenantId: string;
    }): Promise<CompanyV1 | null> {
      const row = await db
        .prepare(SELECT_COMPANY_BY_ID_SQL_V1)
        .bind(input.tenantId, input.companyId)
        .first<CompanyRowV1>();

      if (!row) {
        return null;
      }

      return mapCompanyRowToContractV1(row);
    },

    async update(company: CompanyV1): Promise<CompanyRepositoryUpdateResultV1> {
      const validatedCompany = parseCompanyV1(company);

      try {
        const updateResult = await db
          .prepare(UPDATE_COMPANY_SQL_V1)
          .bind(
            validatedCompany.tenantId,
            validatedCompany.id,
            validatedCompany.legalName,
            validatedCompany.organizationNumber,
            validatedCompany.defaultFiscalYearStart,
            validatedCompany.defaultFiscalYearEnd,
            validatedCompany.updatedAt,
          )
          .run();

        if (!updateResult.success) {
          return {
            ok: false,
            code: "PERSISTENCE_ERROR",
            message: updateResult.error ?? "Failed to update company.",
          };
        }

        if (Number(updateResult.meta.changes ?? 0) === 0) {
          return {
            ok: false,
            code: "COMPANY_NOT_FOUND",
            message: "Company does not exist for this tenant and company ID.",
          };
        }

        return {
          ok: true,
          company: validatedCompany,
        };
      } catch (error) {
        if (isDuplicateCompanyError(error)) {
          return {
            ok: false,
            code: "DUPLICATE_COMPANY",
            message:
              "Company already exists for this tenant and organization number.",
          };
        }

        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: toErrorMessage(error),
        };
      }
    },

    async listByTenant(input: { tenantId: string }): Promise<CompanyV1[]> {
      const queryResult = await db
        .prepare(LIST_COMPANIES_BY_TENANT_SQL_V1)
        .bind(input.tenantId)
        .all<CompanyRowV1>();

      if (!queryResult.success) {
        throw new Error(
          queryResult.error ?? "Failed to list tenant companies.",
        );
      }

      return (queryResult.results ?? []).map((row) =>
        mapCompanyRowToContractV1(row),
      );
    },
  };
}
