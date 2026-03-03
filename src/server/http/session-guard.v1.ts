import type { D1Database } from "../../shared/types/d1";
import {
  type ActiveSessionPrincipalLookupResultV1,
  type ActiveSessionPrincipalV1,
  findActiveSessionPrincipalByTokenV1,
  parseCookiesV1,
} from "./session-auth.v1";

export const SESSION_COOKIE_NAME_V1 = "dink_session_v1";

export const HTTP_SESSION_OPERATION_LABELS_V1 = {
  authFindActiveSessionPrincipalByToken:
    "auth.findActiveSessionPrincipalByTokenV1",
  workspaceFindActiveSessionPrincipalByToken:
    "workspace.findActiveSessionPrincipalByTokenV1",
} as const;

export type SessionGuardErrorPayloadV1 = {
  code: string;
  context: Record<string, unknown>;
  message: string;
  user_message: string;
};

export type SessionGuardResultV1 =
  | {
      ok: true;
      principal: ActiveSessionPrincipalV1;
      sessionToken: string;
    }
  | {
      error: SessionGuardErrorPayloadV1;
      ok: false;
      status: number;
    };

/**
 * Resolves an authenticated session principal from cookies and optionally enforces tenant scoping.
 * This helper stays deterministic and only wraps cookie parsing + storage-backed principal lookup.
 */
export async function resolveSessionGuardV1(input: {
  db: D1Database;
  hmacSecret: string;
  operation: string;
  request: Request;
  requestTenantId?: string;
  tenantMismatchUserMessage?: string;
  lookupPrincipalByToken?: (input: {
    db: D1Database;
    hmacSecret: string;
    operation: string;
    sessionToken: string;
  }) => Promise<ActiveSessionPrincipalLookupResultV1>;
}): Promise<SessionGuardResultV1> {
  const cookies = parseCookiesV1(input.request.headers.get("Cookie"));
  const sessionToken = cookies[SESSION_COOKIE_NAME_V1];
  if (!sessionToken) {
    return {
      ok: false,
      status: 401,
      error: {
        code: "SESSION_MISSING",
        context: {
          operation: input.operation,
        },
        message: "A valid authenticated session is required.",
        user_message: "A valid authenticated session is required.",
      },
    };
  }

  const lookupPrincipalByToken =
    input.lookupPrincipalByToken ?? findActiveSessionPrincipalByTokenV1;
  const sessionLookupResult = await lookupPrincipalByToken({
    db: input.db,
    hmacSecret: input.hmacSecret,
    operation: input.operation,
    sessionToken,
  });

  if (!sessionLookupResult.ok) {
    return {
      ok: false,
      status:
        sessionLookupResult.code === "SESSION_INVALID_OR_EXPIRED" ? 401 : 500,
      error: {
        code: sessionLookupResult.code,
        context: sessionLookupResult.context,
        message: sessionLookupResult.message,
        user_message: sessionLookupResult.userMessage,
      },
    };
  }

  if (
    input.requestTenantId &&
    sessionLookupResult.principal.tenantId !== input.requestTenantId
  ) {
    return {
      ok: false,
      status: 403,
      error: {
        code: "TENANT_MISMATCH",
        context: {
          operation: input.operation,
          requestTenantId: input.requestTenantId,
          sessionTenantId: sessionLookupResult.principal.tenantId,
        },
        message: "Session tenant does not match requested tenant.",
        user_message:
          input.tenantMismatchUserMessage ??
          "You can only access resources in the active tenant.",
      },
    };
  }

  return {
    ok: true,
    principal: sessionLookupResult.principal,
    sessionToken,
  };
}
