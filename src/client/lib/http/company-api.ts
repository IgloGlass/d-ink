import {
  type CreateCompanyResultV1,
  type ListCompaniesByTenantResultV1,
  parseCreateCompanyResultV1,
  parseListCompaniesByTenantResultV1,
} from "../../../shared/contracts/company-lifecycle.v1";
import {
  type CompanyV1,
  parseCompanyV1,
} from "../../../shared/contracts/company.v1";
import { ApiClientError, apiRequest } from "./api-client";

export type CompanySummaryV1 = CompanyV1;

export type ListCompaniesResponseV1 = Extract<
  ListCompaniesByTenantResultV1,
  { ok: true }
>;

export type CreateCompanyInputV1 = {
  defaultFiscalYearEnd: string;
  defaultFiscalYearStart: string;
  legalName: string;
  organizationNumber: string;
  tenantId: string;
};

export type CreateCompanyResponseV1 = Extract<
  CreateCompanyResultV1,
  { ok: true }
>;

function expectSuccessResultV1<
  TResult extends
    | { ok: true }
    | {
        ok: false;
        error: {
          code: string;
          context: Record<string, unknown>;
          message: string;
          user_message: string;
        };
      },
>(result: TResult): Extract<TResult, { ok: true }> {
  if (!result.ok) {
    throw new ApiClientError({
      status: 200,
      code: result.error.code,
      message: result.error.message,
      userMessage: result.error.user_message,
      context: result.error.context,
    });
  }

  return result as Extract<TResult, { ok: true }>;
}

function parseListCompaniesHttpResponseV1(
  payload: unknown,
): ListCompaniesResponseV1 {
  return expectSuccessResultV1(parseListCompaniesByTenantResultV1(payload));
}

function parseCreateCompanyHttpResponseV1(
  payload: unknown,
): CreateCompanyResponseV1 {
  return expectSuccessResultV1(parseCreateCompanyResultV1(payload));
}

export async function listCompaniesByTenantV1(input: {
  tenantId: string;
}): Promise<ListCompaniesResponseV1> {
  const search = new URLSearchParams({ tenantId: input.tenantId });

  const result = await apiRequest<ListCompaniesResponseV1>({
    path: `/v1/companies?${search.toString()}`,
    method: "GET",
    parseResponse: parseListCompaniesHttpResponseV1,
  });

  return {
    ...result,
    companies: result.companies.map((company) => parseCompanyV1(company)),
  };
}

export async function createCompanyV1(
  input: CreateCompanyInputV1,
): Promise<CreateCompanyResponseV1> {
  const result = await apiRequest<CreateCompanyResponseV1>({
    path: "/v1/companies",
    method: "POST",
    body: input,
    parseResponse: parseCreateCompanyHttpResponseV1,
  });

  return {
    ...result,
    company: parseCompanyV1(result.company),
  };
}
