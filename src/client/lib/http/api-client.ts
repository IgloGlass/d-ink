export type ApiErrorPayload = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
  ok: false;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;
  readonly status: number;
  readonly userMessage: string;

  constructor(input: {
    code: string;
    context?: Record<string, unknown>;
    message: string;
    status: number;
    userMessage?: string;
  }) {
    super(input.message);
    this.name = "ApiClientError";
    this.code = input.code;
    this.context = input.context ?? {};
    this.status = input.status;
    this.userMessage = input.userMessage ?? input.message;
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybePayload = value as Partial<ApiErrorPayload>;
  if (maybePayload.ok !== false || typeof maybePayload.error !== "object") {
    return false;
  }

  const maybeError = maybePayload.error as {
    code?: unknown;
    context?: unknown;
    message?: unknown;
    user_message?: unknown;
  };

  return (
    typeof maybeError.code === "string" &&
    typeof maybeError.message === "string" &&
    typeof maybeError.user_message === "string" &&
    typeof maybeError.context === "object" &&
    maybeError.context !== null
  );
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<TResponse>(input: {
  body?: unknown;
  method?: "GET" | "POST";
  path: string;
}): Promise<TResponse> {
  const response = await fetch(input.path, {
    method: input.method ?? "GET",
    credentials: "include",
    cache: "no-store",
    headers:
      input.body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  const parsedPayload = await safeParseJson(response);

  if (!response.ok) {
    if (isApiErrorPayload(parsedPayload)) {
      throw new ApiClientError({
        status: response.status,
        code: parsedPayload.error.code,
        message: parsedPayload.error.message,
        userMessage: parsedPayload.error.user_message,
        context: parsedPayload.error.context,
      });
    }

    throw new ApiClientError({
      status: response.status,
      code: "HTTP_ERROR",
      message: "Unexpected API response.",
      userMessage: "Unexpected API response.",
    });
  }

  return parsedPayload as TResponse;
}

export function toUserFacingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.userMessage;
  }

  return "Request failed unexpectedly.";
}
