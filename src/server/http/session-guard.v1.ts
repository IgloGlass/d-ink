import type { Env } from "../../shared/types/env";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import {
  type ActiveSessionPrincipalV1,
  findActiveSessionPrincipalByTokenV1,
  parseCookiesV1,
} from "./session-auth.v1";

export const SESSION_COOKIE_NAME_V1 = "dink_session_v1";

/**
 * Extracts the session token from HTTP cookies.
 */
export function extractSessionTokenFromRequestV1(
  request: Request,
): string | null {
  const cookies = parseCookiesV1(request.headers.get("Cookie"));
  return cookies[SESSION_COOKIE_NAME_V1] ?? null;
}

/**
 * Resolves the authenticated principal from the session cookie.
 */
export async function requireSessionPrincipalV1(input: {
  env: Env;
  operation: string;
  request: Request;
}): Promise<
  | { ok: true; principal: ActiveSessionPrincipalV1; sessionToken: string }
  | { ok: false; response: Response }
> {
  const sessionToken = extractSessionTokenFromRequestV1(input.request);
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

  const sessionLookupResult = await findActiveSessionPrincipalByTokenV1({
    db: input.env.DB,
    hmacSecret: input.env.AUTH_TOKEN_HMAC_SECRET,
    operation: input.operation,
    sessionToken,
  });

  if (!sessionLookupResult.ok) {
    return {
      ok: false,
      response: createJsonErrorResponseV1({
        status:
          sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
        code: sessionLookupResult.code,
        message: sessionLookupResult.message,
        userMessage: sessionLookupResult.userMessage,
        context: sessionLookupResult.context,
      }),
    };
  }

  return {
    ok: true,
    principal: sessionLookupResult.principal,
    sessionToken,
  };
}

/**
 * Blocks cross-tenant access by comparing request and authenticated tenant IDs.
 */
export function createTenantMismatchResponseV1(input: {
  requestTenantId: string;
  sessionTenantId: string;
  userMessage: string;
}): Response | null {
  if (input.requestTenantId === input.sessionTenantId) {
    return null;
  }

  return createJsonErrorResponseV1({
    status: 403,
    code: "TENANT_MISMATCH",
    message: "Session tenant does not match requested tenant.",
    userMessage: input.userMessage,
    context: {
      requestTenantId: input.requestTenantId,
      sessionTenantId: input.sessionTenantId,
    },
  });
}
