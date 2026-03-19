import { IsoDateTimeSchema } from "../../shared/contracts/common.v1";

/**
 * Normalizes a SQLite-style timestamp into canonical ISO 8601 UTC.
 *
 * D1 and SQLite can surface `CURRENT_TIMESTAMP` values as `YYYY-MM-DD HH:MM:SS`
 * without a timezone suffix. Repository row mappers should convert that legacy
 * shape before handing data to strict contracts.
 */
export function normalizeSqliteTimestampV1(value: string): string {
  if (IsoDateTimeSchema.safeParse(value).success) {
    return value;
  }

  const legacyMatch = value.match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/,
  );
  if (!legacyMatch) {
    return value;
  }

  const [, datePart, timePart, fractionalPart] = legacyMatch;
  const fractionalMilliseconds = fractionalPart
    ? fractionalPart.padEnd(3, "0")
    : "000";
  const normalized = `${datePart}T${timePart}.${fractionalMilliseconds}Z`;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}
