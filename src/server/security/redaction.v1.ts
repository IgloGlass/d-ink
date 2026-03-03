const SENSITIVE_FIELD_NAME_PATTERN_V1 =
  /(filebytesbase64|contentbase64|token|authorization|cookie|snippet|password|secret)/i;

const REDACTED_LITERAL_V1 = "[REDACTED]";

function redactObjectV1(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_FIELD_NAME_PATTERN_V1.test(key)) {
      next[key] = REDACTED_LITERAL_V1;
      continue;
    }

    next[key] = redactSensitiveLogFieldsV1(nestedValue);
  }

  return next;
}

/**
 * Redacts sensitive fields from structured logging payloads.
 *
 * Security boundary:
 * - Never log base64 file bytes, token values, cookies, or extracted snippets.
 * - Keep non-sensitive metadata intact for troubleshooting and auditability.
 */
export function redactSensitiveLogFieldsV1(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveLogFieldsV1(entry));
  }

  if (typeof value === "object" && value !== null) {
    return redactObjectV1(value as Record<string, unknown>);
  }

  return value;
}
