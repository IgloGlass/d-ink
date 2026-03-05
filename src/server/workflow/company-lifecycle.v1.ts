import type { z } from "zod";

import type { CompanyRepositoryV1 } from "../../db/repositories/company.repository.v1";
import {
  type CompanyLifecycleErrorCodeV1,
  type CompanyLifecycleFailureV1,
  CreateCompanyRequestV1Schema,
  type CreateCompanyResultV1,
  GetCompanyByIdRequestV1Schema,
  type GetCompanyByIdResultV1,
  ListCompaniesByTenantRequestV1Schema,
  type ListCompaniesByTenantResultV1,
  parseCreateCompanyResultV1,
  parseGetCompanyByIdResultV1,
  parseListCompaniesByTenantResultV1,
} from "../../shared/contracts/company-lifecycle.v1";
import {
  normalizeOrganizationNumberV1,
  parseCompanyV1,
} from "../../shared/contracts/company.v1";

/**
 * Dependencies required by the V1 company lifecycle service.
 */
export interface CompanyLifecycleDepsV1 {
  companyRepository: CompanyRepositoryV1;
  generateId: () => string;
  nowIsoUtc: () => string;
}

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function buildFailure(
  code: CompanyLifecycleErrorCodeV1,
  message: string,
  userMessage: string,
  context: Record<string, unknown>,
): CompanyLifecycleFailureV1 {
  return {
    ok: false,
    error: {
      code,
      message,
      user_message: userMessage,
      context,
    },
  };
}

function toUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown persistence error.";
}

/**
 * Creates a company in persistent storage.
 */
export async function createCompanyV1(
  input: unknown,
  deps: CompanyLifecycleDepsV1,
): Promise<CreateCompanyResultV1> {
  const parsed = CreateCompanyRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseCreateCompanyResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Create company request payload is invalid.",
        "The company request is invalid. Please review the input and try again.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const createdAt = deps.nowIsoUtc();
    const company = parseCompanyV1({
      id: deps.generateId(),
      tenantId: parsed.data.tenantId,
      legalName: parsed.data.legalName,
      organizationNumber: normalizeOrganizationNumberV1(
        parsed.data.organizationNumber,
      ),
      defaultFiscalYearStart: parsed.data.defaultFiscalYearStart,
      defaultFiscalYearEnd: parsed.data.defaultFiscalYearEnd,
      createdAt,
      updatedAt: createdAt,
    });

    const createResult = await deps.companyRepository.create(company);

    if (!createResult.ok) {
      if (createResult.code === "DUPLICATE_COMPANY") {
        return parseCreateCompanyResultV1(
          buildFailure(
            "DUPLICATE_COMPANY",
            createResult.message,
            "A company already exists for this organization number.",
            {
              tenantId: company.tenantId,
              organizationNumber: company.organizationNumber,
            },
          ),
        );
      }

      return parseCreateCompanyResultV1(
        buildFailure(
          "PERSISTENCE_ERROR",
          createResult.message,
          "Company could not be created due to a storage error.",
          {
            operation: "company.create",
          },
        ),
      );
    }

    return parseCreateCompanyResultV1({
      ok: true,
      company: createResult.company,
    });
  } catch (error) {
    return parseCreateCompanyResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Company could not be created due to an unexpected error.",
        {
          operation: "company.create",
        },
      ),
    );
  }
}

/**
 * Fetches a company by tenant and company ID.
 */
export async function getCompanyByIdV1(
  input: unknown,
  deps: CompanyLifecycleDepsV1,
): Promise<GetCompanyByIdResultV1> {
  const parsed = GetCompanyByIdRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseGetCompanyByIdResultV1(
      buildFailure(
        "INPUT_INVALID",
        "Get company request payload is invalid.",
        "The company lookup request is invalid.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const company = await deps.companyRepository.getById({
      companyId: parsed.data.companyId,
      tenantId: parsed.data.tenantId,
    });

    return parseGetCompanyByIdResultV1({
      ok: true,
      company,
    });
  } catch (error) {
    return parseGetCompanyByIdResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Company could not be loaded due to a storage error.",
        {
          operation: "company.getById",
        },
      ),
    );
  }
}

/**
 * Lists all companies for a tenant in deterministic recency order.
 */
export async function listCompaniesByTenantV1(
  input: unknown,
  deps: CompanyLifecycleDepsV1,
): Promise<ListCompaniesByTenantResultV1> {
  const parsed = ListCompaniesByTenantRequestV1Schema.safeParse(input);

  if (!parsed.success) {
    return parseListCompaniesByTenantResultV1(
      buildFailure(
        "INPUT_INVALID",
        "List companies request payload is invalid.",
        "The company list request is invalid.",
        buildErrorContextFromZod(parsed.error),
      ),
    );
  }

  try {
    const companies = await deps.companyRepository.listByTenant({
      tenantId: parsed.data.tenantId,
    });

    return parseListCompaniesByTenantResultV1({
      ok: true,
      companies,
    });
  } catch (error) {
    return parseListCompaniesByTenantResultV1(
      buildFailure(
        "PERSISTENCE_ERROR",
        toUnknownErrorMessage(error),
        "Company list could not be loaded due to a storage error.",
        {
          operation: "company.listByTenant",
        },
      ),
    );
  }
}
