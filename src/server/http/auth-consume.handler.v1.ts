import { z } from "zod";

import { UuidV4Schema } from "../../shared/contracts/common.v1";
import type { Env } from "../../shared/types/env";
import { consumeMagicLinkTokenV1 } from "../workflow/auth-magic-link.v1";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS_V1,
  SESSION_COOKIE_NAME_V1,
  SESSION_TENANT_COOKIE_NAME_V1,
  buildErrorRedirectUrlV1,
  buildSuccessRedirectUrlV1,
  createAuthDepsV1,
  createNoStoreRedirectResponseV1,
  serializeCookieV1,
} from "./auth-http-helpers.v1";

const ConsumeHttpQueryV1Schema = z
  .object({
    tenantId: UuidV4Schema,
    token: z.string().trim().min(1).max(512),
  })
  .strict();

export async function handleAuthConsumeV1(input: {
  appBaseUrl: URL;
  env: Env;
  request: Request;
}): Promise<Response> {
  const requestUrl = new URL(input.request.url);
  const parsedQuery = ConsumeHttpQueryV1Schema.safeParse({
    tenantId: requestUrl.searchParams.get("tenantId"),
    token: requestUrl.searchParams.get("token"),
  });

  if (!parsedQuery.success) {
    return createNoStoreRedirectResponseV1({
      location: buildErrorRedirectUrlV1(input.appBaseUrl, "INPUT_INVALID"),
    });
  }

  const consumeResult = await consumeMagicLinkTokenV1(
    {
      tenantId: parsedQuery.data.tenantId,
      magicLinkToken: parsedQuery.data.token,
    },
    createAuthDepsV1(input.env),
  );

  if (!consumeResult.ok) {
    return createNoStoreRedirectResponseV1({
      location: buildErrorRedirectUrlV1(
        input.appBaseUrl,
        consumeResult.error.code,
      ),
    });
  }

  const isSecureRequest = requestUrl.protocol === "https:";
  return createNoStoreRedirectResponseV1({
    location: buildSuccessRedirectUrlV1(input.appBaseUrl),
    setCookies: [
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
    ],
  });
}
