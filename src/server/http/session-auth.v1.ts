import type { D1Database } from "../../shared/types/d1";
import { hashTokenWithHmacV1 } from "../workflow/auth-magic-link.v1";

const SELECT_ACTIVE_SESSION_PRINCIPAL_BY_HASH_SQL = `
SELECT
  session.tenant_id AS tenant_id,
  users.id AS user_id,
  users.email_normalized AS user_email_normalized,
  membership.role AS membership_role
FROM auth_sessions session
JOIN users
  ON users.id = session.user_id
JOIN tenant_memberships membership
  ON membership.tenant_id = session.tenant_id
  AND membership.user_id = session.user_id
WHERE session.token_hash = ?1
  AND session.revoked_at IS NULL
  AND session.expires_at > ?2
LIMIT 1
`;

type ActiveSessionPrincipalRowV1 = {
  membership_role: "Admin" | "Editor";
  tenant_id: string;
  user_email_normalized: string;
  user_id: string;
};

/**
 * Tenant-scoped authenticated principal resolved from an active session token.
 */
export type ActiveSessionPrincipalV1 = {
  emailNormalized: string;
  role: "Admin" | "Editor";
  tenantId: string;
  userId: string;
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
  try {
    const nowIsoUtc = new Date().toISOString();
    const tokenHash = await hashTokenWithHmacV1(
      input.hmacSecret,
      input.sessionToken,
    );
    const sessionRow = await input.db
      .prepare(SELECT_ACTIVE_SESSION_PRINCIPAL_BY_HASH_SQL)
      .bind(tokenHash, nowIsoUtc)
      .first<ActiveSessionPrincipalRowV1>();

    if (!sessionRow) {
      return {
        ok: false,
        code: "SESSION_INVALID_OR_EXPIRED",
        message: "Session token is invalid, expired, or revoked.",
        userMessage: "Your session is no longer valid. Please sign in again.",
        context: {},
      };
    }

    return {
      ok: true,
      principal: {
        tenantId: sessionRow.tenant_id,
        userId: sessionRow.user_id,
        emailNormalized: sessionRow.user_email_normalized,
        role: sessionRow.membership_role,
      },
    };
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Session validation failed due to a storage error.",
      userMessage: "Session validation failed due to a storage error.",
      context: {
        operation: input.operation,
      },
    };
  }
}
