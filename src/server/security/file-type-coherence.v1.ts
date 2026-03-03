type SniffedBinaryContentKindV1 = "ole" | "pdf" | "text" | "unknown" | "zip";

type FileTypeCoherenceFailureV1 = {
  allowedContentKinds: SniffedBinaryContentKindV1[];
  declaredFileType: string | null;
  detectedContentKind: SniffedBinaryContentKindV1;
  fileName: string;
  inferredFileType: string | null;
  reason: "file_type_content_mismatch";
};

function startsWithBytesV1(input: {
  bytes: Uint8Array;
  signature: readonly number[];
}): boolean {
  if (input.bytes.byteLength < input.signature.length) {
    return false;
  }

  return input.signature.every((byte, index) => input.bytes[index] === byte);
}

function isLikelyUtf8TextV1(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.byteLength, 1024);
  if (sampleSize === 0) {
    return false;
  }

  let printableCount = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const byte = bytes[index] as number;
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e)
    ) {
      printableCount += 1;
    }
  }

  return printableCount / sampleSize >= 0.85;
}

export function sniffBinaryContentKindV1(
  bytes: Uint8Array,
): SniffedBinaryContentKindV1 {
  if (startsWithBytesV1({ bytes, signature: [0x25, 0x50, 0x44, 0x46, 0x2d] })) {
    return "pdf";
  }

  if (
    startsWithBytesV1({ bytes, signature: [0x50, 0x4b, 0x03, 0x04] }) ||
    startsWithBytesV1({ bytes, signature: [0x50, 0x4b, 0x05, 0x06] }) ||
    startsWithBytesV1({ bytes, signature: [0x50, 0x4b, 0x07, 0x08] })
  ) {
    return "zip";
  }

  if (
    startsWithBytesV1({
      bytes,
      signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    })
  ) {
    return "ole";
  }

  if (isLikelyUtf8TextV1(bytes)) {
    return "text";
  }

  return "unknown";
}

function inferTrialBalanceFileTypeFromNameV1(fileName: string): string | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xlsx")) {
    return "xlsx";
  }
  if (lowerName.endsWith(".xlsm")) {
    return "xlsm";
  }
  if (lowerName.endsWith(".xls")) {
    return "xls";
  }
  if (lowerName.endsWith(".xlsb")) {
    return "xlsb";
  }
  if (lowerName.endsWith(".csv")) {
    return "csv";
  }

  return null;
}

function inferAnnualReportFileTypeFromNameV1(fileName: string): string | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (lowerName.endsWith(".docx")) {
    return "docx";
  }

  return null;
}

function buildCoherenceFailureV1(input: {
  allowedContentKinds: SniffedBinaryContentKindV1[];
  declaredFileType: string | null;
  detectedContentKind: SniffedBinaryContentKindV1;
  fileName: string;
  inferredFileType: string | null;
}): FileTypeCoherenceFailureV1 {
  return {
    reason: "file_type_content_mismatch",
    fileName: input.fileName,
    declaredFileType: input.declaredFileType,
    inferredFileType: input.inferredFileType,
    detectedContentKind: input.detectedContentKind,
    allowedContentKinds: input.allowedContentKinds,
  };
}

/**
 * Validates trial-balance upload content kind against declared/inferred file type.
 *
 * Security boundary:
 * - Reject clearly mismatched binary types before expensive parse paths.
 * - Keep parser contract checks (extension/schema) as the source of truth.
 */
export function validateTrialBalanceFileTypeCoherenceV1(input: {
  fileBytes: Uint8Array;
  fileName: string;
  fileType?: "csv" | "xls" | "xlsb" | "xlsm" | "xlsx";
}): FileTypeCoherenceFailureV1 | null {
  const inferredFileType = inferTrialBalanceFileTypeFromNameV1(input.fileName);
  const declaredFileType = input.fileType ?? null;
  const expectedFileType = declaredFileType ?? inferredFileType;
  if (!expectedFileType) {
    return null;
  }

  const detectedContentKind = sniffBinaryContentKindV1(input.fileBytes);
  const allowedContentKinds =
    expectedFileType === "csv"
      ? (["text"] as SniffedBinaryContentKindV1[])
      : expectedFileType === "xls"
        ? (["ole", "zip"] as SniffedBinaryContentKindV1[])
        : (["zip"] as SniffedBinaryContentKindV1[]);

  if (allowedContentKinds.includes(detectedContentKind)) {
    return null;
  }

  return buildCoherenceFailureV1({
    fileName: input.fileName,
    declaredFileType,
    inferredFileType,
    detectedContentKind,
    allowedContentKinds,
  });
}

/**
 * Validates annual-report upload content kind against declared/inferred file type.
 *
 * Security boundary:
 * - Reject obvious workbook/archive uploads on annual-report endpoints.
 * - Keep text-only extraction fallback for the current deterministic parser.
 */
export function validateAnnualReportFileTypeCoherenceV1(input: {
  fileBytes: Uint8Array;
  fileName: string;
  fileType?: "docx" | "pdf";
}): FileTypeCoherenceFailureV1 | null {
  const inferredFileType = inferAnnualReportFileTypeFromNameV1(input.fileName);
  const declaredFileType = input.fileType ?? null;
  const expectedFileType = declaredFileType ?? inferredFileType;
  if (!expectedFileType) {
    return null;
  }

  const detectedContentKind = sniffBinaryContentKindV1(input.fileBytes);
  const allowedContentKinds =
    expectedFileType === "docx"
      ? (["zip"] as SniffedBinaryContentKindV1[])
      : (["pdf", "text"] as SniffedBinaryContentKindV1[]);

  if (allowedContentKinds.includes(detectedContentKind)) {
    return null;
  }

  return buildCoherenceFailureV1({
    fileName: input.fileName,
    declaredFileType,
    inferredFileType,
    detectedContentKind,
    allowedContentKinds,
  });
}

