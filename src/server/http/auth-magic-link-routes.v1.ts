import { z } from "zod";

import {
  type AuthPrincipalV1,
  AuthRoleV1Schema,
} from "../../shared/contracts/auth-magic-link.v1";
import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { MAX_UPLOAD_JSON_BODY_BYTES_V1 } from "../security/payload-limits.v1";
import {
  authenticateSessionV1,
  consumeMagicLinkTokenV1,
  createDevSessionV1,
  createMagicLinkInviteV1,
  logoutSessionV1,
  resolveSessionPrincipalByTokenV1,
} from "../workflow/auth-magic-link.v1";
import {
  createAuthMagicLinkDepsV1,
  createResolveSessionPrincipalDepsV1,
} from "../workflow/workflow-deps.v1";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
  parseJsonBodyWithSchemaV1,
  validateOriginForPostV1,
} from "./http-helpers.v1";
import { parseCookiesV1 } from "./session-auth.v1";

const SESSION_COOKIE_NAME_V1 = "dink_session_v1";
const SESSION_TENANT_COOKIE_NAME_V1 = "dink_tenant_v1";
const SESSION_COOKIE_MAX_AGE_SECONDS_V1 = 24 * 60 * 60;

const INVITE_ROUTE_PATH_V1 = "/v1/auth/magic-link/invites";
const CONSUME_ROUTE_PATH_V1 = "/v1/auth/magic-link/consume";
const AUTHENTICATE_ROUTE_PATH_V1 = "/v1/auth/session/authenticate";
const CURRENT_SESSION_ROUTE_PATH_V1 = "/v1/auth/session/current";
const LOGOUT_ROUTE_PATH_V1 = "/v1/auth/session/logout";
const DEV_LOGIN_ROUTE_PATH_V1 = "/v1/auth/dev-login";

const InviteHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    inviteeEmail: z.string().trim().email(),
    inviteeRole: AuthRoleV1Schema,
  })
  .strict();

const AuthenticateHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

const DevLoginHttpRequestBodyV1Schema = z
  .object({
    tenantId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: AuthRoleV1Schema.optional(),
  })
  .strict();

const ConsumeHttpQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    token: z.string().trim().min(1).max(512),
  })
  .strict();

function createNoStoreRedirectResponseV1(input: {
  location: string;
  setCookies?: string[];
}): Response {
  const headers = new Headers();
  headers.set("Location", input.location);
  headers.set("Cache-Control", "no-store");

  for (const cookieValue of input.setCookies ?? []) {
    headers.append("Set-Cookie", cookieValue);
  }

  return new Response(null, {
    status: 303,
    headers,
  });
}

function createJsonSuccessResponseV1(input: {
  setCookies?: string[];
  status: number;
}): Response {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  for (const cookieValue of input.setCookies ?? []) {
    headers.append("Set-Cookie", cookieValue);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: input.status,
    headers,
  });
}

function serializeCookieV1(input: {
  httpOnly: boolean;
  maxAgeSeconds: number;
  name: string;
  secure: boolean;
  value: string;
}): string {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    `Max-Age=${input.maxAgeSeconds}`,
    "SameSite=Lax",
  ];

  if (input.httpOnly) {
    parts.push("HttpOnly");
  }

  if (input.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildClearedAuthCookiesV1(isSecureRequest: boolean): string[] {
  return [
    serializeCookieV1({
      name: SESSION_COOKIE_NAME_V1,
      value: "",
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: isSecureRequest,
    }),
    serializeCookieV1({
      name: SESSION_TENANT_COOKIE_NAME_V1,
      value: "",
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: isSecureRequest,
    }),
  ];
}

function buildSuccessRedirectUrlV1(appBaseUrl: URL): string {
  const successUrl = new URL("/", appBaseUrl);
  successUrl.searchParams.set("auth", "success");

  return successUrl.toString();
}

function buildErrorRedirectUrlV1(appBaseUrl: URL, code: string): string {
  const errorUrl = new URL("/", appBaseUrl);
  errorUrl.searchParams.set("auth", "error");
  errorUrl.searchParams.set("code", code);

  return errorUrl.toString();
}

function buildMagicLinkUrlV1(input: {
  appBaseUrl: URL;
  tenantId: string;
  token: string;
}): string {
  const magicLinkUrl = new URL(CONSUME_ROUTE_PATH_V1, input.appBaseUrl);
  magicLinkUrl.searchParams.set("tenantId", input.tenantId);
  magicLinkUrl.searchParams.set("token", input.token);

  return magicLinkUrl.toString();
}

function isEnvFlagEnabledV1(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isDevAuthBypassEnabledV1(env: Env): boolean {
  return isEnvFlagEnabledV1(env.DEV_AUTH_BYPASS_ENABLED);
}

function normalizeDevTenantIdV1(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  const directUuidResult = UuidV4Schema.safeParse(trimmedValue);
  if (directUuidResult.success) {
    return directUuidResult.data;
  }

  if (/^\d{1,12}$/.test(trimmedValue)) {
    return `00000000-0000-4000-8000-${trimmedValue.padStart(12, "0")}`;
  }

  return null;
}

type SessionPrincipalGuardSuccessV1 = {
  ok: true;
  principal: AuthPrincipalV1;
  sessionToken: string;
};

type SessionPrincipalGuardFailureV1 = {
  ok: false;
  response: Response;
};

async function requireSessionPrincipalV1(input: {
  request: Request;
  env: Env;
}): Promise<SessionPrincipalGuardSuccessV1 | SessionPrincipalGuardFailureV1> {
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
    const status =
      sessionLookupResult.error.code === "SESSION_INVALID_OR_EXPIRED" ||
      sessionLookupResult.error.code === "INPUT_INVALID"
        ? 401
        : 500;
    const code =
      status === 401
        ? "SESSION_INVALID_OR_EXPIRED"
        : sessionLookupResult.error.code;

    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status,
        code,
        message: sessionLookupResult.error.message,
        userMessage: sessionLookupResult.error.user_message,
        context: sessionLookupResult.error.context,
      }),
    };
  }

  return {
    ok: true,
    principal: sessionLookupResult.principal,
    sessionToken,
  };
}

async function requireTenantSessionPrincipalV1(input: {
  request: Request;
  env: Env;
  tenantId: string;
  tenantMismatchUserMessage: string;
}): Promise<SessionPrincipalGuardSuccessV1 | SessionPrincipalGuardFailureV1> {
  const sessionGuardResult = await requireSessionPrincipalV1({
    request: input.request,
    env: input.env,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult;
  }

  if (sessionGuardResult.principal.tenantId !== input.tenantId) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status: 403,
        code: "TENANT_MISMATCH",
        message: "Session tenant does not match requested tenant.",
        userMessage: input.tenantMismatchUserMessage,
        context: {
          requestTenantId: input.tenantId,
          sessionTenantId: sessionGuardResult.principal.tenantId,
        },
      }),
    };
  }

  return sessionGuardResult;
}

function requireSessionTokenV1(input: {
  request: Request;
}): { ok: true; sessionToken: string } | { ok: false; response: Response } {
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

  return {
    ok: true,
    sessionToken,
  };
}

async function handleCreateInviteRouteV1(
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
    routeLabel: "Invite",
    schema: InviteHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const sessionGuardResult = await requireTenantSessionPrincipalV1({
    request,
    env,
    tenantId: parsedBody.tenantId,
    tenantMismatchUserMessage:
      "You can only invite users in the active tenant.",
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  const deps = createAuthMagicLinkDepsV1(env);
  const createInviteResult = await createMagicLinkInviteV1(
    {
      tenantId: parsedBody.tenantId,
      inviteeEmail: parsedBody.inviteeEmail,
      inviteeRole: parsedBody.inviteeRole,
      actorUserId: sessionGuardResult.principal.userId,
    },
    deps,
  );

  if (!createInviteResult.ok) {
    if (createInviteResult.error.code === "INPUT_INVALID") {
      return createJsonErrorResponseV1({
        status: 400,
        code: createInviteResult.error.code,
        message: createInviteResult.error.message,
        userMessage: createInviteResult.error.user_message,
        context: createInviteResult.error.context,
      });
    }

    if (
      createInviteResult.error.code === "ROLE_FORBIDDEN" ||
      createInviteResult.error.code === "MEMBERSHIP_NOT_FOUND"
    ) {
      return createJsonErrorResponseV1({
        status: 403,
        code: createInviteResult.error.code,
        message: createInviteResult.error.message,
        userMessage: createInviteResult.error.user_message,
        context: createInviteResult.error.context,
      });
    }

    return createJsonErrorResponseV1({
      status: 500,
      code: createInviteResult.error.code,
      message: createInviteResult.error.message,
      userMessage: createInviteResult.error.user_message,
      context: createInviteResult.error.context,
    });
  }

  const magicLinkUrl = buildMagicLinkUrlV1({
    appBaseUrl,
    tenantId: parsedBody.tenantId,
    token: createInviteResult.magicLinkToken,
  });

  return Response.json(
    {
      ok: true,
      invite: createInviteResult.invite,
      magicLinkExpiresAt: createInviteResult.magicLinkExpiresAt,
      magicLinkUrl,
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleConsumeRouteV1(
  request: Request,
  env: Env,
  appBaseUrl: URL,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const parsedQuery = ConsumeHttpQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
    token: requestUrl.searchParams.get("token"),
  });

  if (!parsedQuery.success) {
    return createNoStoreRedirectResponseV1({
      location: buildErrorRedirectUrlV1(appBaseUrl, "INPUT_INVALID"),
    });
  }

  const deps = createAuthMagicLinkDepsV1(env);
  const consumeResult = await consumeMagicLinkTokenV1(
    {
      tenantId: parsedQuery.data.tenantId,
      magicLinkToken: parsedQuery.data.token,
    },
    deps,
  );

  if (!consumeResult.ok) {
    return createNoStoreRedirectResponseV1({
      location: buildErrorRedirectUrlV1(appBaseUrl, consumeResult.error.code),
    });
  }

  const isSecureRequest = requestUrl.protocol === "https:";
  const setCookies = [
    serializeCookieV1({
      name: SESSION_COOKIE_NAME_V1,
      value: consumeResult.sessionToken,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS_V1,
      httpOnly: true,
      secure: isSecureRequest,
    }),
    serializeCookieV1({
      name: SESSION_TENANT_COOKIE_NAME_V1,
      value: consumeResult.principal.tenantId,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS_V1,
      httpOnly: true,
      secure: isSecureRequest,
    }),
  ];

  return createNoStoreRedirectResponseV1({
    location: buildSuccessRedirectUrlV1(appBaseUrl),
    setCookies,
  });
}

async function handleAuthenticateSessionRouteV1(
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

  const sessionTokenResult = requireSessionTokenV1({ request });
  if (!sessionTokenResult.ok) {
    return sessionTokenResult.response;
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Session authenticate",
    schema: AuthenticateHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const deps = createAuthMagicLinkDepsV1(env);
  const authResult = await authenticateSessionV1(
    {
      tenantId: parsedBody.tenantId,
      sessionToken: sessionTokenResult.sessionToken,
    },
    deps,
  );

  if (!authResult.ok) {
    if (authResult.error.code === "SESSION_INVALID_OR_EXPIRED") {
      return createJsonErrorResponseV1({
        status: 401,
        code: authResult.error.code,
        message: authResult.error.message,
        userMessage: authResult.error.user_message,
        context: authResult.error.context,
      });
    }

    if (authResult.error.code === "INPUT_INVALID") {
      return createJsonErrorResponseV1({
        status: 400,
        code: authResult.error.code,
        message: authResult.error.message,
        userMessage: authResult.error.user_message,
        context: authResult.error.context,
      });
    }

    return createJsonErrorResponseV1({
      status: 500,
      code: authResult.error.code,
      message: authResult.error.message,
      userMessage: authResult.error.user_message,
      context: authResult.error.context,
    });
  }

  return Response.json(
    {
      ok: true,
      principal: authResult.principal,
      session: authResult.session,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleDevLoginRouteV1(
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

  if (!isDevAuthBypassEnabledV1(env)) {
    return createJsonErrorResponseV1({
      status: 404,
      code: "NOT_FOUND",
      message: "Auth route not found.",
    });
  }

  const bodyParseResult = await parseJsonBodyWithSchemaV1({
    request,
    maxBytes: MAX_UPLOAD_JSON_BODY_BYTES_V1,
    routeLabel: "Dev login",
    schema: DevLoginHttpRequestBodyV1Schema,
  });
  if (!bodyParseResult.ok) {
    return bodyParseResult.response;
  }
  const parsedBody = bodyParseResult.data;

  const tenantIdCandidate =
    parsedBody.tenantId ?? env.DEV_AUTH_DEFAULT_TENANT_ID;
  const normalizedTenantId = normalizeDevTenantIdV1(tenantIdCandidate);
  if (!normalizedTenantId) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message:
        "Dev login requires tenantId as UUIDv4 or short numeric ID (e.g. 5335).",
    });
  }

  const emailCandidate =
    parsedBody.email ?? env.DEV_AUTH_DEFAULT_EMAIL ?? "dev.user@example.com";
  const emailResult = z.string().trim().email().safeParse(emailCandidate);
  if (!emailResult.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message:
        "Dev login email is invalid. Provide email in body or DEV_AUTH_DEFAULT_EMAIL.",
    });
  }

  const roleCandidate = parsedBody.role ?? env.DEV_AUTH_DEFAULT_ROLE;
  const roleResult = AuthRoleV1Schema.safeParse(roleCandidate ?? "Admin");
  if (!roleResult.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message:
        "Dev login role is invalid. Use Admin/Editor via body or DEV_AUTH_DEFAULT_ROLE.",
    });
  }

  const devSessionResult = await createDevSessionV1(
    {
      tenantId: normalizedTenantId,
      email: emailResult.data,
      role: roleResult.data,
    },
    createAuthMagicLinkDepsV1(env),
  );
  if (!devSessionResult.ok) {
    if (devSessionResult.error.code === "INPUT_INVALID") {
      return createJsonErrorResponseV1({
        status: 400,
        code: devSessionResult.error.code,
        message: devSessionResult.error.message,
        userMessage: devSessionResult.error.user_message,
        context: devSessionResult.error.context,
      });
    }

    return createJsonErrorResponseV1({
      status: 500,
      code: devSessionResult.error.code,
      message: devSessionResult.error.message,
      userMessage: devSessionResult.error.user_message,
      context: devSessionResult.error.context,
    });
  }

  const isSecureRequest = new URL(request.url).protocol === "https:";
  const setCookies = [
    serializeCookieV1({
      name: SESSION_COOKIE_NAME_V1,
      value: devSessionResult.sessionToken,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS_V1,
      httpOnly: true,
      secure: isSecureRequest,
    }),
    serializeCookieV1({
      name: SESSION_TENANT_COOKIE_NAME_V1,
      value: devSessionResult.principal.tenantId,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS_V1,
      httpOnly: true,
      secure: isSecureRequest,
    }),
  ];

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const cookieValue of setCookies) {
    headers.append("Set-Cookie", cookieValue);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      principal: devSessionResult.principal,
      session: devSessionResult.session,
    }),
    {
      status: 200,
      headers,
    },
  );
}

async function handleCurrentSessionRouteV1(
  request: Request,
  env: Env,
): Promise<Response> {
  const sessionGuardResult = await requireSessionPrincipalV1({
    request,
    env,
  });
  if (!sessionGuardResult.ok) {
    return sessionGuardResult.response;
  }

  return Response.json(
    {
      ok: true,
      principal: sessionGuardResult.principal,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleLogoutSessionRouteV1(
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

  const requestUrl = new URL(request.url);
  const isSecureRequest = requestUrl.protocol === "https:";
  const clearCookies = buildClearedAuthCookiesV1(isSecureRequest);

  const sessionTokenResult = requireSessionTokenV1({ request });
  if (!sessionTokenResult.ok) {
    return createJsonSuccessResponseV1({
      status: 200,
      setCookies: clearCookies,
    });
  }

  const deps = createAuthMagicLinkDepsV1(env);
  const logoutResult = await logoutSessionV1(
    {
      sessionToken: sessionTokenResult.sessionToken,
    },
    deps,
  );

  if (!logoutResult.ok) {
    if (logoutResult.error.code === "INPUT_INVALID") {
      return createJsonSuccessResponseV1({
        status: 200,
        setCookies: clearCookies,
      });
    }

    return createJsonErrorResponseV1({
      status: 500,
      code: logoutResult.error.code,
      message: logoutResult.error.message,
      userMessage: logoutResult.error.user_message,
      context: logoutResult.error.context,
    });
  }

  return createJsonSuccessResponseV1({
    status: 200,
    setCookies: clearCookies,
  });
}

/**
 * Handles V1 auth HTTP routes for magic-link invite, consume, and session checks.
 */
export async function handleAuthMagicLinkRoutesV1(
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

  const pathname = new URL(request.url).pathname;

  if (pathname === INVITE_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleCreateInviteRouteV1(request, env, appBaseUrl);
  }

  if (pathname === CONSUME_ROUTE_PATH_V1) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleConsumeRouteV1(request, env, appBaseUrl);
  }

  if (pathname === AUTHENTICATE_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleAuthenticateSessionRouteV1(request, env, appBaseUrl);
  }

  if (pathname === DEV_LOGIN_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleDevLoginRouteV1(request, env, appBaseUrl);
  }

  if (pathname === CURRENT_SESSION_ROUTE_PATH_V1) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleCurrentSessionRouteV1(request, env);
  }

  if (pathname === LOGOUT_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    return handleLogoutSessionRouteV1(request, env, appBaseUrl);
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Auth route not found.",
  });
}
