import { createD1AuthRepositoryV1 } from "../../db/repositories/auth.repository.v1";
import type { Env } from "../../shared/types/env";

export const SESSION_COOKIE_NAME_V1 = "dink_session_v1";
export const SESSION_TENANT_COOKIE_NAME_V1 = "dink_tenant_v1";
export const SESSION_COOKIE_MAX_AGE_SECONDS_V1 = 24 * 60 * 60;

export const INVITE_ROUTE_PATH_V1 = "/v1/auth/magic-link/invites";
export const CONSUME_ROUTE_PATH_V1 = "/v1/auth/magic-link/consume";
export const AUTHENTICATE_ROUTE_PATH_V1 = "/v1/auth/session/authenticate";
export const CURRENT_SESSION_ROUTE_PATH_V1 = "/v1/auth/session/current";
export const LOGOUT_ROUTE_PATH_V1 = "/v1/auth/session/logout";

export async function readJsonBodyV1(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function toBase64UrlV1(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateTokenV1(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return toBase64UrlV1(bytes);
}

export function createAuthDepsV1(env: Env) {
  return {
    authRepository: createD1AuthRepositoryV1(env.DB),
    generateId: () => crypto.randomUUID(),
    generateToken: () => generateTokenV1(),
    nowIsoUtc: () => new Date().toISOString(),
    hmacSecret: env.AUTH_TOKEN_HMAC_SECRET,
  };
}

export function serializeCookieV1(input: {
  httpOnly: boolean;
  maxAgeSeconds: number;
  name: string;
  secure: boolean;
  value: string;
}): string {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    `Max-Age=${input.maxAgeSeconds}`,
    "SameSite=Lax",
  ];

  if (input.httpOnly) {
    parts.push("HttpOnly");
  }

  if (input.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createNoStoreRedirectResponseV1(input: {
  location: string;
  setCookies?: string[];
}): Response {
  const headers = new Headers();
  headers.set("Location", input.location);
  headers.set("Cache-Control", "no-store");

  for (const cookieValue of input.setCookies ?? []) {
    headers.append("Set-Cookie", cookieValue);
  }

  return new Response(null, {
    status: 303,
    headers,
  });
}

export function createJsonSuccessResponseV1(input: {
  setCookies?: string[];
  status: number;
}): Response {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  for (const cookieValue of input.setCookies ?? []) {
    headers.append("Set-Cookie", cookieValue);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: input.status,
    headers,
  });
}

export function buildClearedAuthCookiesV1(isSecureRequest: boolean): string[] {
  return [
    serializeCookieV1({
      name: SESSION_COOKIE_NAME_V1,
      value: "",
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: isSecureRequest,
    }),
    serializeCookieV1({
      name: SESSION_TENANT_COOKIE_NAME_V1,
      value: "",
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: isSecureRequest,
    }),
  ];
}

export function buildSuccessRedirectUrlV1(appBaseUrl: URL): string {
  const successUrl = new URL("/", appBaseUrl);
  successUrl.searchParams.set("auth", "success");

  return successUrl.toString();
}

export function buildErrorRedirectUrlV1(appBaseUrl: URL, code: string): string {
  const errorUrl = new URL("/", appBaseUrl);
  errorUrl.searchParams.set("auth", "error");
  errorUrl.searchParams.set("code", code);

  return errorUrl.toString();
}

export function buildMagicLinkUrlV1(input: {
  appBaseUrl: URL;
  tenantId: string;
  token: string;
}): string {
  const magicLinkUrl = new URL(CONSUME_ROUTE_PATH_V1, input.appBaseUrl);
  magicLinkUrl.searchParams.set("tenantId", input.tenantId);
  magicLinkUrl.searchParams.set("token", input.token);

  return magicLinkUrl.toString();
}
