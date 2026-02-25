import type { Env } from "../../shared/types/env";
import { handleAuthAuthenticateSessionV1 } from "./auth-authenticate.handler.v1";
import { handleAuthConsumeV1 } from "./auth-consume.handler.v1";
import { handleAuthCreateInviteV1 } from "./auth-create-invite.handler.v1";
import { handleAuthCurrentSessionV1 } from "./auth-current-session.handler.v1";
import {
  AUTHENTICATE_ROUTE_PATH_V1,
  CONSUME_ROUTE_PATH_V1,
  CURRENT_SESSION_ROUTE_PATH_V1,
  INVITE_ROUTE_PATH_V1,
  LOGOUT_ROUTE_PATH_V1,
} from "./auth-http-helpers.v1";
import { handleAuthLogoutV1 } from "./auth-logout.handler.v1";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
} from "./http-error.v1";
import { validatePostOriginV1 } from "./origin-guard.v1";

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

    const originError = validatePostOriginV1({ appBaseUrl, request });
    if (originError) {
      return originError;
    }

    return handleAuthCreateInviteV1({ request, env, appBaseUrl });
  }

  if (pathname === CONSUME_ROUTE_PATH_V1) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleAuthConsumeV1({ request, env, appBaseUrl });
  }

  if (pathname === AUTHENTICATE_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    const originError = validatePostOriginV1({ appBaseUrl, request });
    if (originError) {
      return originError;
    }

    return handleAuthAuthenticateSessionV1({ request, env });
  }

  if (pathname === CURRENT_SESSION_ROUTE_PATH_V1) {
    if (request.method !== "GET") {
      return createMethodNotAllowedResponseV1("GET");
    }

    return handleAuthCurrentSessionV1({ request, env });
  }

  if (pathname === LOGOUT_ROUTE_PATH_V1) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    const originError = validatePostOriginV1({ appBaseUrl, request });
    if (originError) {
      return originError;
    }

    return handleAuthLogoutV1({ request, env });
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Auth route not found.",
  });
}
