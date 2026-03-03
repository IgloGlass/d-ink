import { z } from "zod";

import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { authenticateSessionV1 } from "../workflow/auth-magic-link.v1";
import { createAuthDepsV1, readJsonBodyV1 } from "./auth-http-helpers.v1";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import { requireSessionPrincipalV1 } from "./session-guard.v1";

const AuthenticateHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
  })
  .strict();

export async function handleAuthAuthenticateSessionV1(input: {
  env: Env;
  request: Request;
}): Promise<Response> {
  const sessionResult = await requireSessionPrincipalV1({
    env: input.env,
    operation: "auth.findActiveSessionPrincipalByTokenV1",
    request: input.request,
  });
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const parsedBody = AuthenticateHttpRequestBodyV1Schema.safeParse(
    await readJsonBodyV1(input.request),
  );
  if (!parsedBody.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Session authenticate request body is invalid.",
    });
  }

  const authResult = await authenticateSessionV1(
    {
      tenantId: parsedBody.data.tenantId,
      sessionToken: sessionResult.sessionToken,
    },
    createAuthDepsV1(input.env),
  );

  if (!authResult.ok) {
    const status =
      authResult.error.code === "SESSION_INVALID_OR_EXPIRED"
        ? 401
        : authResult.error.code === "INPUT_INVALID"
          ? 400
          : 500;

    return createJsonErrorResponseV1({
      status,
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
