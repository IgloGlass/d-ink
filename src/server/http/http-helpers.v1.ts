/**
 * Shared JSON error envelope used by V1 HTTP routes.
 */
export type JsonErrorBodyV1 = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
  ok: false;
};

export function createJsonErrorResponseV1(input: {
  code: string;
  context?: Record<string, unknown>;
  message: string;
  status: number;
  userMessage?: string;
}): Response {
  const isServerError = input.status >= 500;
  const safeUserMessage = isServerError
    ? (input.userMessage ?? "Internal server error.")
    : (input.userMessage ?? input.message);
  const safeMessage = isServerError ? safeUserMessage : input.message;

  const responseBody: JsonErrorBodyV1 = {
    ok: false,
    error: {
      code: input.code,
      context: input.context ?? {},
      message: safeMessage,
      user_message: safeUserMessage,
    },
  };

  return Response.json(responseBody, {
    status: input.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function createMethodNotAllowedResponseV1(
  allowedMethods: string | string[],
): Response {
  const allowedHeader = Array.isArray(allowedMethods)
    ? allowedMethods.join(", ")
    : allowedMethods;
  const headers = new Headers();
  headers.set("Allow", allowedHeader);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        context: {},
        message: `Expected ${allowedHeader} for this route.`,
        user_message: `Expected ${allowedHeader} for this route.`,
      },
    }),
    {
      status: 405,
      headers,
    },
  );
}

const LOOPBACK_HOSTNAME_SET_V1 = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
]);

function resolveOriginPortV1(originUrl: URL): string {
  if (originUrl.port.length > 0) {
    return originUrl.port;
  }

  return originUrl.protocol === "https:" ? "443" : "80";
}

function isEquivalentLoopbackOriginV1(input: {
  appBaseUrl: URL;
  requestOriginUrl: URL;
}): boolean {
  const appHostname = input.appBaseUrl.hostname.toLowerCase();
  const requestHostname = input.requestOriginUrl.hostname.toLowerCase();
  if (
    !LOOPBACK_HOSTNAME_SET_V1.has(appHostname) ||
    !LOOPBACK_HOSTNAME_SET_V1.has(requestHostname)
  ) {
    return false;
  }

  if (input.requestOriginUrl.protocol !== input.appBaseUrl.protocol) {
    return false;
  }

  return (
    resolveOriginPortV1(input.requestOriginUrl) ===
    resolveOriginPortV1(input.appBaseUrl)
  );
}

/**
 * CSRF boundary: reject browser POST requests from untrusted origins.
 */
export function validateOriginForPostV1(input: {
  appBaseUrl: URL;
  request: Request;
}): Response | null {
  if (input.request.method !== "POST") {
    return null;
  }

  const originHeader = input.request.headers.get("Origin");
  if (!originHeader) {
    return null;
  }

  let requestOriginUrl: URL;
  try {
    requestOriginUrl = new URL(originHeader);
  } catch {
    return createJsonErrorResponseV1({
      status: 403,
      code: "ORIGIN_FORBIDDEN",
      message: "Request origin is invalid.",
    });
  }

  const isSameOrigin = requestOriginUrl.origin === input.appBaseUrl.origin;
  const isEquivalentLocalOrigin = isEquivalentLoopbackOriginV1({
    requestOriginUrl,
    appBaseUrl: input.appBaseUrl,
  });
  if (!isSameOrigin && !isEquivalentLocalOrigin) {
    return createJsonErrorResponseV1({
      status: 403,
      code: "ORIGIN_FORBIDDEN",
      message: "Request origin is not allowed for this endpoint.",
    });
  }

  return null;
}

export async function readJsonBodyV1(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
