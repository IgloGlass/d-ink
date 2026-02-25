import type { Env } from "../../shared/types/env";
import {
  createJsonErrorResponseV1,
  createMethodNotAllowedResponseV1,
} from "./http-error.v1";
import { validatePostOriginV1 } from "./origin-guard.v1";
import { handleWorkspaceCreateV1 } from "./workspace-create.handler.v1";
import { handleWorkspaceGetV1 } from "./workspace-get.handler.v1";
import { WORKSPACES_ROUTE_BASE_PATH_V1 } from "./workspace-http-helpers.v1";
import { handleWorkspaceListV1 } from "./workspace-list.handler.v1";
import { handleWorkspaceTransitionV1 } from "./workspace-transition.handler.v1";

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
      return handleWorkspaceListV1({ request, env });
    }

    if (request.method === "POST") {
      const originError = validatePostOriginV1({ appBaseUrl, request });
      if (originError) {
        return originError;
      }

      return handleWorkspaceCreateV1({ request, env });
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

    return handleWorkspaceGetV1({
      request,
      env,
      workspaceId: routeSegments[0],
    });
  }

  if (
    routeSegments.length === 2 &&
    routeSegments[0] &&
    routeSegments[1] === "transitions"
  ) {
    if (request.method !== "POST") {
      return createMethodNotAllowedResponseV1("POST");
    }

    const originError = validatePostOriginV1({ appBaseUrl, request });
    if (originError) {
      return originError;
    }

    return handleWorkspaceTransitionV1({
      request,
      env,
      workspaceId: routeSegments[0],
    });
  }

  return createJsonErrorResponseV1({
    status: 404,
    code: "NOT_FOUND",
    message: "Workspace route not found.",
  });
}
