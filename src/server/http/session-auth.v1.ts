import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import type { AuthPrincipalV1 } from "../../shared/contracts/auth-magic-link.v1";
import type { D1Database } from "../../shared/types/d1";
import { resolveSessionPrincipalByTokenV1 } from "../workflow/auth-magic-link.v1";

/**
 * Tenant-scoped authenticated principal resolved from an active session token.
 */
export type ActiveSessionPrincipalV1 = {
  emailNormalized: AuthPrincipalV1["emailNormalized"];
  role: AuthPrincipalV1["role"];
  tenantId: AuthPrincipalV1["tenantId"];
  userId: AuthPrincipalV1["userId"];
};

/**
 * Structured result payload for HTTP-layer session principal lookups.
 */
export type ActiveSessionPrincipalLookupResultV1 =
  | {
      ok: true;
      principal: ActiveSessionPrincipalV1;
    }
  | {
      code: "PERSISTENCE_ERROR" | "SESSION_INVALID_OR_EXPIRED";
      context: Record<string, unknown>;
      message: string;
      ok: false;
      userMessage: string;
    };

/**
 * Parses a Cookie header value into a simple name->value map.
 */
export function parseCookiesV1(
  cookieHeader: string | null,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const cookieName = trimmed.slice(0, separatorIndex).trim();
    const cookieValue = trimmed.slice(separatorIndex + 1).trim();

    if (!cookieName || !cookieValue) {
      continue;
    }

    try {
      cookies[cookieName] = decodeURIComponent(cookieValue);
    } catch {
      cookies[cookieName] = cookieValue;
    }
  }

  return cookies;
}

/**
 * Resolves the active session principal from a raw session token.
 */
export async function findActiveSessionPrincipalByTokenV1(input: {
  db: D1Database;
  hmacSecret: string;
  operation: string;
  sessionToken: string;
}): Promise<ActiveSessionPrincipalLookupResultV1> {
  const lookupResult = await resolveSessionPrincipalByTokenV1(
    {
      sessionToken: input.sessionToken,
    },
    {
      authRepository: createD1AuthRepositoryV1(input.db),
      hmacSecret: input.hmacSecret,
      nowIsoUtc: () => new Date().toISOString(),
    },
  );

  if (lookupResult.ok) {
    return {
      ok: true,
      principal: lookupResult.principal,
    };
  }

  if (
    lookupResult.error.code === "SESSION_INVALID_OR_EXPIRED" ||
    lookupResult.error.code === "INPUT_INVALID"
  ) {
    return {
      ok: false,
      code: "SESSION_INVALID_OR_EXPIRED",
      message: "Session token is invalid, expired, or revoked.",
      userMessage: "Your session is no longer valid. Please sign in again.",
      context: {},
    };
  }

  return {
    ok: false,
    code: "PERSISTENCE_ERROR",
    message: lookupResult.error.message,
    userMessage: lookupResult.error.user_message,
    context: {
      ...lookupResult.error.context,
      operation: input.operation,
    },
  };
}
