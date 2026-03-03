import type { Env } from "../../shared/types/env";
import { logoutSessionV1 } from "../workflow/auth-magic-link.v1";
import {
  buildClearedAuthCookiesV1,
  createAuthDepsV1,
  createJsonSuccessResponseV1,
} from "./auth-http-helpers.v1";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import { extractSessionTokenFromRequestV1 } from "./session-guard.v1";

export async function handleAuthLogoutV1(input: {
  env: Env;
  request: Request;
}): Promise<Response> {
  const requestUrl = new URL(input.request.url);
  const isSecureRequest = requestUrl.protocol === "https:";
  const clearCookies = buildClearedAuthCookiesV1(isSecureRequest);

  const sessionToken = extractSessionTokenFromRequestV1(input.request);
  if (!sessionToken) {
    return createJsonSuccessResponseV1({
      status: 200,
      setCookies: clearCookies,
    });
  }

  const logoutResult = await logoutSessionV1(
    {
      sessionToken,
    },
    createAuthDepsV1(input.env),
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
