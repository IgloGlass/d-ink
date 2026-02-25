import { z } from "zod";

import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { IsoDateSchema, UuidV4Schema } from "../../shared/contracts/common.v1";
import { WorkspaceStatusV1Schema } from "../../shared/contracts/workspace.v1";
import type { Env } from "../../shared/types/env";
import {
  applyWorkspaceTransitionV1,
  createWorkspaceV1,
  getWorkspaceByIdV1,
  listWorkspacesByTenantV1,
} from "../workflow/workspace-lifecycle.v1";
import { getAllowedNextWorkspaceStatusesV1 } from "../workflow/workspace-status-transition.v1";
import {
  findActiveSessionPrincipalByTokenV1,
  parseCookiesV1,
} from "./session-auth.v1";

const SESSION_COOKIE_NAME_V1 = "dink_session_v1";
const WORKSPACES_ROUTE_BASE_PATH_V1 = "/v1/workspaces";

const CreateWorkspaceHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    companyId: UuidV4Schema,
    fiscalYearStart: IsoDateSchema,
    fiscalYearEnd: IsoDateSchema,
  })
  .strict();

const WorkspaceGetQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

const WorkspaceTransitionHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    toStatus: WorkspaceStatusV1Schema,
    reason: z.string().optional(),
  })
  .strict();

type JsonErrorBodyV1 = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
  ok: false;
};

function createJsonErrorResponseV1(input: {
  code: string;
  context?: Record<string, unknown>;
  message: string;
  status: number;
  userMessage?: string;
}): Response {
  const isServerError = input.status >= 500;
  const safeUserMessage = isServerError
    ? (input.userMessage ?? "Internal server error.")
    : (input.userMessage ?? input.message);
  const safeMessage = isServerError ? safeUserMessage : input.message;

  const responseBody: JsonErrorBodyV1 = {
    ok: false,
    error: {
      code: input.code,
      context: input.context ?? {},
      message: safeMessage,
      user_message: safeUserMessage,
    },
  };

  return Response.json(responseBody, {
    status: input.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function createMethodNotAllowedResponseV1(
  allowedMethods: string | string[],
): Response {
  const allowedHeader = Array.isArray(allowedMethods)
    ? allowedMethods.join(", ")
    : allowedMethods;
  const headers = new Headers();
  headers.set("Allow", allowedHeader);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        context: {},
        message: `Expected ${allowedHeader} for this route.`,
        user_message: `Expected ${allowedHeader} for this route.`,
      },
    }),
    {
      status: 405,
      headers,
    },
  );
}

function validateOriginForPostV1(input: {
  appBaseUrl: URL;
  request: Request;
}): Response | null {
  if (input.request.method !== "POST") {
    return null;
  }

  const originHeader = input.request.headers.get("Origin");
  if (!originHeader) {
    return null;
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(originHeader).origin;
  } catch {
    return createJsonErrorResponseV1({
      status: 403,
      code: "ORIGIN_FORBIDDEN",
      message: "Request origin is invalid.",
    });
  }

  if (requestOrigin !== input.appBaseUrl.origin) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "ORIGIN_FORBIDDEN",
      message: "Request origin is not allowed for this endpoint.",
    });
  }

  return null;
}

async function readJsonBodyV1(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function createWorkspaceLifecycleDepsV1(env: Env) {
  return {
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

function mapWorkspaceLifecycleFailureToResponseV1(input: {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
}): Response {
  if (input.error.code === "INPUT_INVALID") {
    return createJsonErrorResponseV1({
      status: 400,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "DUPLICATE_WORKSPACE") {
    return createJsonErrorResponseV1({
      status: 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "WORKSPACE_NOT_FOUND") {
    return createJsonErrorResponseV1({
      status: 404,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "STATE_CONFLICT") {
    return createJsonErrorResponseV1({
      status: 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "TRANSITION_REJECTED") {
    const transitionError = input.error.context.transitionError;
    const transitionErrorCode =
      typeof transitionError === "object" &&
      transitionError !== null &&
      "code" in transitionError
        ? (transitionError as { code: unknown }).code
        : null;

    return createJsonErrorResponseV1({
      status: transitionErrorCode === "ROLE_FORBIDDEN" ? 403 : 409,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  if (input.error.code === "PERSISTENCE_ERROR") {
    return createJsonErrorResponseV1({
      status: 500,
      code: input.error.code,
      message: input.error.message,
      userMessage: input.error.user_message,
      context: input.error.context,
    });
  }

  return createJsonErrorResponseV1({
    status: 500,
    code: "PERSISTENCE_ERROR",
    message: input.error.message,
    userMessage: input.error.user_message,
    context: input.error.context,
  });
}

async function handleCreateWorkspaceRouteV1(
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

  const cookies = parseCookiesV1(request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return createJsonErrorResponseV1({
      status: 401,
      code: "SESSION_MISSING",
      message: "A valid authenticated session is required.",
    });
  }

  const parsedBody = CreateWorkspaceHttpRequestBodyV1Schema.safeParse(
    await readJsonBodyV1(request),
  );
  if (!parsedBody.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Create workspace request body is invalid.",
    });
  }

  const sessionLookupResult = await findActiveSessionPrincipalByTokenV1({
    db: env.DB,
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    sessionToken,
  });
  if (!sessionLookupResult.ok) {
    return createJsonErrorResponseV1({
      status:
        sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
      code: sessionLookupResult.code,
      message: sessionLookupResult.message,
      userMessage: sessionLookupResult.userMessage,
      context: sessionLookupResult.context,
    });
  }

  if (sessionLookupResult.principal.tenantId !== parsedBody.data.tenantId) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "TENANT_MISMATCH",
      message: "Session tenant does not match requested tenant.",
      userMessage:
        "You can only access workspace resources in the active tenant.",
      context: {
        requestTenantId: parsedBody.data.tenantId,
        sessionTenantId: sessionLookupResult.principal.tenantId,
      },
    });
  }

  const result = await createWorkspaceV1(
    {
      tenantId: parsedBody.data.tenantId,
      companyId: parsedBody.data.companyId,
      fiscalYearStart: parsedBody.data.fiscalYearStart,
      fiscalYearEnd: parsedBody.data.fiscalYearEnd,
      actor: {
        actorType: "user",
        actorRole: sessionLookupResult.principal.role,
        actorUserId: sessionLookupResult.principal.userId,
      },
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleGetWorkspaceRouteV1(
  request: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const cookies = parseCookiesV1(request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return createJsonErrorResponseV1({
      status: 401,
      code: "SESSION_MISSING",
      message: "A valid authenticated session is required.",
    });
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace query parameters are invalid.",
    });
  }

  const sessionLookupResult = await findActiveSessionPrincipalByTokenV1({
    db: env.DB,
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    sessionToken,
  });
  if (!sessionLookupResult.ok) {
    return createJsonErrorResponseV1({
      status:
        sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
      code: sessionLookupResult.code,
      message: sessionLookupResult.message,
      userMessage: sessionLookupResult.userMessage,
      context: sessionLookupResult.context,
    });
  }

  if (sessionLookupResult.principal.tenantId !== parsedQuery.data.tenantId) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "TENANT_MISMATCH",
      message: "Session tenant does not match requested tenant.",
      userMessage:
        "You can only access workspace resources in the active tenant.",
      context: {
        requestTenantId: parsedQuery.data.tenantId,
        sessionTenantId: sessionLookupResult.principal.tenantId,
      },
    });
  }

  const result = await getWorkspaceByIdV1(
    {
      tenantId: parsedQuery.data.tenantId,
      workspaceId,
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  if (!result.workspace) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
      message: "Workspace does not exist for tenant and workspace ID.",
      userMessage: "Workspace could not be found.",
      context: {
        tenantId: parsedQuery.data.tenantId,
        workspaceId,
      },
    });
  }

  return Response.json(
    {
      ...result,
      allowedNextStatuses: getAllowedNextWorkspaceStatusesV1({
        fromStatus: result.workspace.status,
        actorRole: sessionLookupResult.principal.role,
      }),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleListWorkspacesRouteV1(
  request: Request,
  env: Env,
): Promise<Response> {
  const cookies = parseCookiesV1(request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return createJsonErrorResponseV1({
      status: 401,
      code: "SESSION_MISSING",
      message: "A valid authenticated session is required.",
    });
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = WorkspaceGetQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
  });
  if (!parsedQuery.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace query parameters are invalid.",
    });
  }

  const sessionLookupResult = await findActiveSessionPrincipalByTokenV1({
    db: env.DB,
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    sessionToken,
  });
  if (!sessionLookupResult.ok) {
    return createJsonErrorResponseV1({
      status:
        sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
      code: sessionLookupResult.code,
      message: sessionLookupResult.message,
      userMessage: sessionLookupResult.userMessage,
      context: sessionLookupResult.context,
    });
  }

  if (sessionLookupResult.principal.tenantId !== parsedQuery.data.tenantId) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "TENANT_MISMATCH",
      message: "Session tenant does not match requested tenant.",
      userMessage:
        "You can only access workspace resources in the active tenant.",
      context: {
        requestTenantId: parsedQuery.data.tenantId,
        sessionTenantId: sessionLookupResult.principal.tenantId,
      },
    });
  }

  const result = await listWorkspacesByTenantV1(
    {
      tenantId: parsedQuery.data.tenantId,
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleWorkspaceTransitionRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
  workspaceId: string,
): Promise<Response> {
  const originValidationError = validateOriginForPostV1({
    request,
    appBaseUrl,
  });
  if (originValidationError) {
    return originValidationError;
  }

  const cookies = parseCookiesV1(request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return createJsonErrorResponseV1({
      status: 401,
      code: "SESSION_MISSING",
      message: "A valid authenticated session is required.",
    });
  }

  const parsedBody = WorkspaceTransitionHttpRequestBodyV1Schema.safeParse(
    await readJsonBodyV1(request),
  );
  if (!parsedBody.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Workspace transition request body is invalid.",
    });
  }

  const sessionLookupResult = await findActiveSessionPrincipalByTokenV1({
    db: env.DB,
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
    operation: "workspace.findActiveSessionPrincipalByTokenV1",
    sessionToken,
  });
  if (!sessionLookupResult.ok) {
    return createJsonErrorResponseV1({
      status:
        sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
      code: sessionLookupResult.code,
      message: sessionLookupResult.message,
      userMessage: sessionLookupResult.userMessage,
      context: sessionLookupResult.context,
    });
  }

  if (sessionLookupResult.principal.tenantId !== parsedBody.data.tenantId) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "TENANT_MISMATCH",
      message: "Session tenant does not match requested tenant.",
      userMessage:
        "You can only access workspace resources in the active tenant.",
      context: {
        requestTenantId: parsedBody.data.tenantId,
        sessionTenantId: sessionLookupResult.principal.tenantId,
      },
    });
  }

  const result = await applyWorkspaceTransitionV1(
    {
      tenantId: parsedBody.data.tenantId,
      workspaceId,
      toStatus: parsedBody.data.toStatus,
      reason: parsedBody.data.reason,
      actor: {
        actorType: "user",
        actorRole: sessionLookupResult.principal.role,
        actorUserId: sessionLookupResult.principal.userId,
      },
    },
    createWorkspaceLifecycleDepsV1(env),
  );

  if (!result.ok) {
    return mapWorkspaceLifecycleFailureToResponseV1(result);
  }

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Handles V1 workspace HTTP routes for create, fetch, and status transitions.
 */
export async function handleWorkspaceRoutesV1(
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

  if (pathname === WORKSPACES_ROUTE_BASE_PATH_V1) {
    if (request.method === "GET") {
      return handleListWorkspacesRouteV1(request, env);
    }

    if (request.method === "POST") {
      return handleCreateWorkspaceRouteV1(request, env, appBaseUrl);
    }

    return createMethodNotAllowedResponseV1(["GET", "POST"]);
  }

  if (!pathname.startsWith(`${WORKSPACES_ROUTE_BASE_PATH_V1}/`)) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "NOT_FOUND",
      message: "Workspace route not found.",
    });
  }

  const routeSegments = pathname
    .slice(WORKSPACES_ROUTE_BASE_PATH_V1.length + 1)
    .split("/");

  if (routeSegments.length === 1 && routeSegments[0]) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleGetWorkspaceRouteV1(request, env, routeSegments[0]);
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "transitions"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleWorkspaceTransitionRouteV1(
      request,
      env,
      appBaseUrl,
      routeSegments[0],
    );
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Workspace route not found.",
  });
}
