import type { Env } from "../../shared/types/env";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import { requireSessionPrincipalV1 } from "./session-guard.v1";

export async function handleAuthCurrentSessionV1(input: {
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

  return Response.json(
    {
      ok: true,
      principal: sessionResult.principal,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
