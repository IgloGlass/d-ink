export type ApiErrorPayload = {
  error: {
    code: string;
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
  ok: false;
};

const DEFAULT_API_TIMEOUT_MS_V1 = 30_000;
const LONG_RUNNING_API_TIMEOUT_MS_V1 = 180_000;

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

async function safeReadResponsePayloadV1(response: Response): Promise<{
  parsedJson: unknown;
  responseText: string | null;
}> {
  try {
    const responseText = await response.text();
    if (responseText.trim().length === 0) {
      return {
        parsedJson: null,
        responseText: null,
      };
    }

    try {
      return {
        parsedJson: JSON.parse(responseText),
        responseText,
      };
    } catch {
      return {
        parsedJson: null,
        responseText,
      };
    }
  } catch {
    return {
      parsedJson: null,
      responseText: null,
    };
  }
}

export async function apiRequest<TResponse>(input: {
  body?: unknown;
  formData?: FormData;
  method?: "GET" | "POST";
  parseResponse: (payload: unknown) => TResponse;
  path: string;
  timeoutMs?: number;
}): Promise<TResponse> {
  const timeoutMs =
    input.timeoutMs ??
    (input.method === "POST" ? LONG_RUNNING_API_TIMEOUT_MS_V1 : DEFAULT_API_TIMEOUT_MS_V1);
  const abortController = new AbortController();
  const timeoutHandle = globalThis.setTimeout(() => {
    abortController.abort(
      new DOMException("The request timed out.", "AbortError"),
    );
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(input.path, {
      method: input.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers:
        input.formData
          ? undefined
          : input.body === undefined
          ? undefined
          : {
              "Content-Type": "application/json",
            },
      body: input.formData
        ? input.formData
        : input.body === undefined
          ? undefined
          : JSON.stringify(input.body),
      signal: abortController.signal,
    });
  } catch (error) {
    globalThis.clearTimeout(timeoutHandle);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError({
        status: 408,
        code: "REQUEST_TIMEOUT",
        message: "API request timed out.",
        userMessage:
          "The request took too long and was stopped. Please try again.",
        context: {
          path: input.path,
          timeoutMs,
        },
      });
    }

    throw new ApiClientError({
      status: 0,
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Network request failed.",
      userMessage:
        "Could not reach the app service. Check that the local app is running and try again.",
      context: {
        path: input.path,
      },
    });
  }

  globalThis.clearTimeout(timeoutHandle);

  const { parsedJson: parsedPayload, responseText } =
    await safeReadResponsePayloadV1(response);

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
      context: {
        path: input.path,
        responseText:
          typeof responseText === "string"
            ? responseText.slice(0, 500)
            : null,
      },
    });
  }

  try {
    return input.parseResponse(parsedPayload);
  } catch (error) {
    throw new ApiClientError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "API response validation failed.",
      userMessage: "Unexpected API response.",
      context: {
        path: input.path,
        reason: error instanceof Error ? error.message : "Unknown parse error.",
        responseText:
          typeof responseText === "string"
            ? responseText.slice(0, 500)
            : null,
      },
    });
  }
}

export function toUserFacingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.userMessage;
  }

  return "Request failed unexpectedly.";
}
