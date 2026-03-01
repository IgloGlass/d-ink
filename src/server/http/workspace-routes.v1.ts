import { z } from "zod";

import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import { createD1WorkspaceRepositoryV1 } from "../../db/repositories/workspace.repository.v1";
import { IsoDateSchema, UuidV4Schema } from "../../shared/contracts/common.v1";
import { WorkspaceStatusV1Schema } from "../../shared/contracts/workspace.v1";
import type { Env } from "../../shared/types/env";
import { resolveSessionPrincipalByTokenV1 } from "../workflow/auth-magic-link.v1";
import {
  applyWorkspaceTransitionV1,
  createWorkspaceV1,
  getWorkspaceByIdV1,
  listWorkspacesByTenantV1,
} from "../workflow/workspace-lifecycle.v1";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
  readJsonBodyV1,
  validateOriginForPostV1,
} from "./http-helpers.v1";
import { parseCookiesV1 } from "./session-auth.v1";

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

function createWorkspaceLifecycleDepsV1(env: Env) {
  return {
    workspaceRepository: createD1WorkspaceRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    nowIsoUtc: () => new Date().toISOString(),
  };
}

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
    {
      authRepository: createD1AuthRepositoryV1(input.env.DB),
      hmacSecret: input.env.AUTH_TOKEN_HMAC_SECRET,
      nowIsoUtc: () => new Date().toISOString(),
    },
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
          "You can only access workspace resources in the active tenant.",
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

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await createWorkspaceV1(
    {
      tenantId: parsedBody.data.tenantId,
      companyId: parsedBody.data.companyId,
      fiscalYearStart: parsedBody.data.fiscalYearStart,
      fiscalYearEnd: parsedBody.data.fiscalYearEnd,
      actor: {
        actorType: "user",
        actorRole: sessionGuardResult.principal.role,
        actorUserId: sessionGuardResult.principal.userId,
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

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
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

  return Response.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function handleListWorkspacesRouteV1(
  request: Request,
  env: Env,
): Promise<Response> {
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

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedQuery.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
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

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.data.tenantId,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const result = await applyWorkspaceTransitionV1(
    {
      tenantId: parsedBody.data.tenantId,
      workspaceId,
      toStatus: parsedBody.data.toStatus,
      reason: parsedBody.data.reason,
      actor: {
        actorType: "user",
        actorRole: sessionGuardResult.principal.role,
        actorUserId: sessionGuardResult.principal.userId,
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
