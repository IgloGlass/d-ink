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
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(input: {
    code: string;
    context?: Record<string, unknown>;
    message: string;
    status: number;
    retryable?: boolean;
    userMessage?: string;
  }) {
    super(input.message);
    this.name = "ApiClientError";
    this.code = input.code;
    this.context = input.context ?? {};
    this.status = input.status;
    this.retryable = input.retryable ?? false;
    this.userMessage = input.userMessage ?? input.message;
  }
}

function buildApiClientErrorV1(input: {
  code: string;
  context?: Record<string, unknown>;
  message: string;
  retryable?: boolean;
  status: number;
  userMessage?: string;
}): ApiClientError {
  return new ApiClientError(input);
}

function isRetryableApiStatusV1(status: number): boolean {
  return status === 408 || status >= 500;
}

function isReadRequestV1(method: string): boolean {
  return method.toUpperCase() === "GET";
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
  method?: "GET" | "POST" | "PUT";
  parseResponse: (payload: unknown) => TResponse;
  path: string;
  timeoutMs?: number;
}): Promise<TResponse> {
  const method = input.method ?? "GET";
  const timeoutMs =
    input.timeoutMs ??
    (method === "POST"
      ? LONG_RUNNING_API_TIMEOUT_MS_V1
      : DEFAULT_API_TIMEOUT_MS_V1);
  const isReadRequest = isReadRequestV1(method);
  const maxAttempts = isReadRequest ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController();
    const timeoutHandle = globalThis.setTimeout(() => {
      abortController.abort(
        new DOMException("The request timed out.", "AbortError"),
      );
    }, timeoutMs);

    try {
      const response = await fetch(input.path, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: input.formData
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

      globalThis.clearTimeout(timeoutHandle);

      const { parsedJson: parsedPayload, responseText } =
        await safeReadResponsePayloadV1(response);

      if (!response.ok) {
        const apiError = isApiErrorPayload(parsedPayload)
          ? buildApiClientErrorV1({
              status: response.status,
              code: parsedPayload.error.code,
              message: parsedPayload.error.message,
              userMessage: parsedPayload.error.user_message,
              context: parsedPayload.error.context,
              retryable: isRetryableApiStatusV1(response.status),
            })
          : buildApiClientErrorV1({
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
              retryable: isRetryableApiStatusV1(response.status),
            });

        if (attempt < maxAttempts && apiError.retryable) {
          continue;
        }

        throw apiError;
      }

      try {
        return input.parseResponse(parsedPayload);
      } catch (error) {
        throw buildApiClientErrorV1({
          status: response.status,
          code: "INVALID_RESPONSE",
          message: "API response validation failed.",
          userMessage: "Unexpected API response.",
          context: {
            path: input.path,
            reason:
              error instanceof Error ? error.message : "Unknown parse error.",
            responseText:
              typeof responseText === "string"
                ? responseText.slice(0, 500)
                : null,
          },
        });
      }
    } catch (error) {
      globalThis.clearTimeout(timeoutHandle);

      if (error instanceof ApiClientError) {
        if (attempt < maxAttempts && error.retryable) {
          continue;
        }

        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        const timeoutError = buildApiClientErrorV1({
          status: 408,
          code: "REQUEST_TIMEOUT",
          message: "API request timed out.",
          userMessage:
            "The request took too long and was stopped. Please try again.",
          context: {
            path: input.path,
            timeoutMs,
          },
          retryable: true,
        });

        if (attempt < maxAttempts) {
          continue;
        }

        throw timeoutError;
      }

      const networkError = buildApiClientErrorV1({
        status: 0,
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed.",
        userMessage:
          "Could not reach the app service. Check that the local app is running and try again.",
        context: {
          path: input.path,
        },
        retryable: true,
      });

      if (attempt < maxAttempts) {
        continue;
      }

      throw networkError;
    }
  }

  throw new ApiClientError({
    status: 0,
    code: "NETWORK_ERROR",
    message: "Network request failed.",
    userMessage:
      "Could not reach the app service. Check that the local app is running and try again.",
    context: {
      path: input.path,
    },
  });
}

export function toUserFacingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.userMessage;
  }

  return "Request failed unexpectedly.";
}
