import { z } from "zod";

import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { MAX_UPLOAD_JSON_BODY_BYTES_V1 } from "../security/payload-limits.v1";
import { resolveSessionPrincipalByTokenV1 } from "../workflow/auth-magic-link.v1";
import {
  createCompanyV1,
  getCompanyByIdV1,
  listCompaniesByTenantV1,
} from "../workflow/company-lifecycle.v1";
import {
  createCompanyLifecycleDepsV1,
  createResolveSessionPrincipalDepsV1,
} from "../workflow/workflow-deps.v1";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
  createServiceFailureResponseV1,
  parseJsonBodyWithSchemaV1,
  validateOriginForPostV1,
} from "./http-helpers.v1";
import { parseCookiesV1 } from "./session-auth.v1";

const SESSION_COOKIE_NAME_V1 = "dink_session_v1";
const COMPANIES_ROUTE_BASE_PATH_V1 = "/v1/companies";

const CompanyQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

const CreateCompanyHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    legalName: z.string().trim().min(1).max(200),
    organizationNumber: z
      .string()
      .trim()
      .regex(
        /^\d{6}-?\d{4}$/,
        "Expected organization number in 10-digit format (with optional dash).",
      ),
    defaultFiscalYearStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date in YYYY-MM-DD format."),
    defaultFiscalYearEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date in YYYY-MM-DD format."),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.defaultFiscalYearEnd < input.defaultFiscalYearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "defaultFiscalYearEnd must be on or after defaultFiscalYearStart.",
        path: ["defaultFiscalYearEnd"],
      });
    }
  });

async function requireTenantSessionPrincipalV1(input: {
  request: Request;
  env: Env;
  tenantId: string;
}): Promise<
  | {
      ok: true;
      principal: {
        emailNormalized: string;
        role: "Admin" | "Editor";
        tenantId: string;
        userId: string;
      };
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const cookies = parseCookiesV1(input.request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 401,
        code: "SESSION_MISSING",
        message: "A valid authenticated session is required.",
      }),
    };
  }

  const sessionLookupResult = await resolveSessionPrincipalByTokenV1(
    {
      sessionToken,
    },
    createResolveSessionPrincipalDepsV1(input.env),
  );

  if (!sessionLookupResult.ok) {
    if (
      sessionLookupResult.error.code === "SESSION_INVALID_OR_EXPIRED" ||
      sessionLookupResult.error.code === "INPUT_INVALID"
    ) {
      return {
        ok: false,
        response: createJsonErrorResponseV1({
          status: 401,
          code: "SESSION_INVALID_OR_EXPIRED",
          message: sessionLookupResult.error.message,
          userMessage: sessionLookupResult.error.user_message,
          context: sessionLookupResult.error.context,
        }),
      };
    }

    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 500,
        code: "PERSISTENCE_ERROR",
        message: sessionLookupResult.error.message,
        userMessage: sessionLookupResult.error.user_message,
        context: sessionLookupResult.error.context,
      }),
    };
  }

  if (sessionLookupResult.principal.tenantId !== input.tenantId) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 403,
        code: "TENANT_MISMATCH",
        message: "Session tenant does not match requested tenant.",
        userMessage:
          "You can only access company resources in the active tenant.",
        context: {
          requestTenantId: input.tenantId,
          sessionTenantId: sessionLookupResult.principal.tenantId,
        },
      }),
    };
  }

  return {
    ok: true,
    principal: sessionLookupResult.principal,
  };
}

type WorkflowFailureResultV1 = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
};

function createWorkflowFailureResponseV1(input: {
  code?: string;
  failure: WorkflowFailureResultV1;
  status: number;
}): Response {
  return createServiceFailureResponseV1({
    code: input.code,
    failure: input.failure,
    status: input.status,
  });
}

function mapCompanyLifecycleFailureToResponseV1(
  input: WorkflowFailureResultV1,
): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createWorkflowFailureResponseV1({
      status: 400,
      failure: input,
    });
  }

  if (input.error.code === "DUPLICATE_COMPANY") {
    return createWorkflowFailureResponseV1({
      status: 409,
      failure: input,
    });
  }

  if (input.error.code === "COMPANY_NOT_FOUND") {
    return createWorkflowFailureResponseV1({
      status: 404,
      failure: input,
    });
  }

  if (input.error.code === "PERSISTENCE_ERROR") {
    return createWorkflowFailureResponseV1({
      status: 500,
      failure: input,
    });
  }

  return createWorkflowFailureResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    failure: input,
  });
}

async function handleCreateCompanyRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Create company",
    schema: CreateCompanyHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createCompanyV1(
    {
      ...parsedBody,
      actor: {
        actorType: "user",
        actorRole: sessionGuardResult.principal.role,
        actorUserId: sessionGuardResult.principal.userId,
      },
    },
    createCompanyLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapCompanyLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleListCompaniesRouteV1(
  request: Request,
  env: Env,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = CompanyQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Company query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await listCompaniesByTenantV1(
    {
      tenantId: parsedQuery.data.tenantId,
    },
    createCompanyLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapCompanyLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleGetCompanyRouteV1(
  request: Request,
  env: Env,
  companyId: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = CompanyQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Company query parameters are invalid.",
    });
  }

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await getCompanyByIdV1(
    {
      tenantId: parsedQuery.data.tenantId,
      companyId,
    },
    createCompanyLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapCompanyLifecycleFailureToResponseV1(result);
  }

  if (!result.company) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "COMPANY_NOT_FOUND",
      message: "Company does not exist for tenant and company ID.",
      userMessage: "Company could not be found.",
      context: {
        tenantId: parsedQuery.data.tenantId,
        companyId,
      },
    });
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Handles V1 company HTTP routes for create, fetch, and list operations.
 */
export async function handleCompanyRoutesV1(
  request: Request,
  env: Env,
): Promise<Response> {
  let appBaseUrl: URL;
  try {
    appBaseUrl = new URL(env.APP_BASE_URL);
  } catch {
    return createJsonErrorResponseV1({
      status: 500,
      code: "APP_BASE_URL_INVALID",
      message: "APP_BASE_URL must be a valid absolute URL.",
    });
  }

  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;

  if (pathname === COMPANIES_ROUTE_BASE_PATH_V1) {
    if (request.method === "GET") {
      return handleListCompaniesRouteV1(request, env);
    }

    if (request.method === "POST") {
      return handleCreateCompanyRouteV1(request, env, appBaseUrl);
    }

    return createMethodNotAllowedResponseV1(["GET", "POST"]);
  }

  if (!pathname.startsWith(`${COMPANIES_ROUTE_BASE_PATH_V1}/`)) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "NOT_FOUND",
      message: "Company route not found.",
    });
  }

  const routeSegments = pathname
    .slice(COMPANIES_ROUTE_BASE_PATH_V1.length + 1)
    .split("/");

  if (routeSegments.length === 1 && routeSegments[0]) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetCompanyRouteV1(request, env, routeSegments[0]);
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Company route not found.",
  });
}
