import { z } from "zod";

import { AuthRoleV1Schema } from "../../shared/contracts/auth-magic-link.v1";
import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { createMagicLinkInviteV1 } from "../workflow/auth-magic-link.v1";
import {
  buildMagicLinkUrlV1,
  createAuthDepsV1,
  readJsonBodyV1,
} from "./auth-http-helpers.v1";
import { createJsonErrorResponseV1 } from "./http-error.v1";
import {
  createTenantMismatchResponseV1,
  requireSessionPrincipalV1,
} from "./session-guard.v1";

const InviteHttpRequestBodyV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    inviteeEmail: z.string().trim().email(),
    inviteeRole: AuthRoleV1Schema,
  })
  .strict();

export async function handleAuthCreateInviteV1(input: {
  appBaseUrl: URL;
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

  const parsedBody = InviteHttpRequestBodyV1Schema.safeParse(
    await readJsonBodyV1(input.request),
  );
  if (!parsedBody.success) {
    return createJsonErrorResponseV1({
      status: 400,
      code: "INPUT_INVALID",
      message: "Invite request body is invalid.",
    });
  }

  const tenantMismatchResponse = createTenantMismatchResponseV1({
    requestTenantId: parsedBody.data.tenantId,
    sessionTenantId: sessionResult.principal.tenantId,
    userMessage: "You can only invite users in the active tenant.",
  });
  if (tenantMismatchResponse) {
    return tenantMismatchResponse;
  }

  const createInviteResult = await createMagicLinkInviteV1(
    {
      tenantId: parsedBody.data.tenantId,
      inviteeEmail: parsedBody.data.inviteeEmail,
      inviteeRole: parsedBody.data.inviteeRole,
      actorUserId: sessionResult.principal.userId,
    },
    createAuthDepsV1(input.env),
  );

  if (!createInviteResult.ok) {
    const status =
      createInviteResult.error.code === "INPUT_INVALID"
        ? 400
        : createInviteResult.error.code === "ROLE_FORBIDDEN" ||
            createInviteResult.error.code === "MEMBERSHIP_NOT_FOUND"
          ? 403
          : 500;

    return createJsonErrorResponseV1({
      status,
      code: createInviteResult.error.code,
      message: createInviteResult.error.message,
      userMessage: createInviteResult.error.user_message,
      context: createInviteResult.error.context,
    });
  }

  return Response.json(
    {
      ok: true,
      invite: createInviteResult.invite,
      magicLinkExpiresAt: createInviteResult.magicLinkExpiresAt,
      magicLinkUrl: buildMagicLinkUrlV1({
        appBaseUrl: input.appBaseUrl,
        tenantId: parsedBody.data.tenantId,
        token: createInviteResult.magicLinkToken,
      }),
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
