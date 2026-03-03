import { env } from "cloudflare:test";

import { hashTokenWithHmacV1 } from "../../src/server/workflow/auth-magic-link.v1";
import type { Env } from "../../src/shared/types/env";

export const APP_BASE_URL = "https://app.dink.test";
export const AUTH_TOKEN_HMAC_SECRET = "test-auth-token-secret";

export function buildWorkerEnv(): Env {
  return {
    DB: env.DB,
    AUTH_TOKEN_HMAC_SECRET,
    APP_BASE_URL,
  };
}

export function buildPostJsonRequest(input: {
  body: unknown;
  cookie?: string;
  origin?: string;
  url: string;
}): Request {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  if (input.origin) {
    headers.set("Origin", input.origin);
  }

  return new Request(input.url, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
  });
}

export function buildGetRequest(input: {
  cookie?: string;
  origin?: string;
  url: string;
}): Request {
  const headers = new Headers();

  if (input.cookie) {
    headers.set("Cookie", input.cookie);
  }

  if (input.origin) {
    headers.set("Origin", input.origin);
  }

  return new Request(input.url, {
    method: "GET",
    headers,
  });
}

export function buildSessionCookie(token: string, tenantId?: string): string {
  const parts = [`dink_session_v1=${token}`];

  if (tenantId) {
    parts.push(`dink_tenant_v1=${tenantId}`);
  }

  return parts.join("; ");
}

export async function seedSession(input: {
  emailNormalized: string;
  role: "Admin" | "Editor";
  sessionToken: string;
  tenantId: string;
  userId: string;
}): Promise<void> {
  const nowTimeMs = Date.now();
  const nowIso = new Date(nowTimeMs).toISOString();
  const expiresAt = new Date(nowTimeMs + 24 * 60 * 60 * 1000).toISOString();
  const sessionTokenHash = await hashTokenWithHmacV1(
    AUTH_TOKEN_HMAC_SECRET,
    input.sessionToken,
  );

  await env.DB.prepare(
    `
      INSERT INTO users (id, email_normalized, created_at)
      VALUES (?1, ?2, ?3)
    `,
  )
    .bind(input.userId, input.emailNormalized, nowIso)
    .run();

  await env.DB.prepare(
    `
      INSERT INTO tenant_memberships (
        id,
        tenant_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      input.role,
      nowIso,
      nowIso,
    )
    .run();

  await env.DB.prepare(
    `
      INSERT INTO auth_sessions (
        id,
        tenant_id,
        user_id,
        token_hash,
        created_at,
        expires_at,
        revoked_at,
        last_seen_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?5)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      sessionTokenHash,
      nowIso,
      expiresAt,
    )
    .run();
}
