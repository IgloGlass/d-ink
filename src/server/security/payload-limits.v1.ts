import { MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1 } from "../../shared/contracts/annual-report-upload-session.v1";

/**
 * Request and decoded payload limits for V1 upload surfaces.
 */
export const MAX_UPLOAD_JSON_BODY_BYTES_V1 = 20 * 1024 * 1024;
export const MAX_TRIAL_BALANCE_FILE_BYTES_V1 = 8 * 1024 * 1024;
export const MAX_ANNUAL_REPORT_FILE_BYTES_V1 =
  MAX_ANNUAL_REPORT_UPLOAD_BYTES_V1;

export type PayloadLimitReasonV1 =
  | "content_length_invalid"
  | "payload_too_large";

export function parseContentLengthHeaderV1(
  contentLengthHeaderValue: string | null,
): number | null {
  if (!contentLengthHeaderValue) {
    return null;
  }

  if (!/^\d+$/.test(contentLengthHeaderValue)) {
    return Number.NaN;
  }

  const parsed = Number(contentLengthHeaderValue);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return parsed;
}
