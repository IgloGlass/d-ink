import { z } from "zod";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_TYPE_REGEX = /^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/;

function isValidIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/**
 * Canonical UUIDv4 identifier schema for shared V1 contracts.
 */
export const UuidV4Schema = z
  .string()
  .regex(UUID_V4_REGEX, "Expected UUIDv4 string.");

/**
 * Canonical ISO calendar date schema (`YYYY-MM-DD`) with real calendar validation.
 */
export const IsoDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Expected ISO date in YYYY-MM-DD format.")
  .refine(isValidIsoCalendarDate, "Expected a valid calendar date.");

/**
 * Canonical ISO 8601 datetime schema with required timezone offset.
 */
export const IsoDateTimeSchema = z.string().datetime({
  offset: true,
  message: "Expected ISO 8601 datetime with offset.",
});

/**
 * Canonical event namespace format (`module.action`) used by audit/event contracts.
 */
export const EventTypeSchema = z
  .string()
  .regex(EVENT_TYPE_REGEX, "Expected event type in module.action format.");
