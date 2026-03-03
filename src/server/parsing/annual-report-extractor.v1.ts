import {
  type AnnualReportExtractionFieldStatusV1,
  type AnnualReportExtractionPayloadV1,
  AnnualReportFileTypeV1Schema,
  parseAnnualReportExtractionPayloadV1,
} from "../../shared/contracts/annual-report-extraction.v1";

export type ParseAnnualReportExtractionRequestV1 = {
  fileBytes: Uint8Array;
  fileName: string;
  fileType?: "pdf" | "docx";
  policyVersion: string;
};

export type ParseAnnualReportExtractionFailureV1 = {
  error: {
    code: "INPUT_INVALID" | "PARSE_FAILED";
    context: Record<string, unknown>;
    message: string;
    user_message: string;
  };
  ok: false;
};

export type ParseAnnualReportExtractionSuccessV1 = {
  extraction: AnnualReportExtractionPayloadV1;
  ok: true;
};

export type ParseAnnualReportExtractionResultV1 =
  | ParseAnnualReportExtractionSuccessV1
  | ParseAnnualReportExtractionFailureV1;

function normalizeWhitespaceV1(input: string): string {
  return input.replace(/\r/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}

function parseNumberValueV1(input: string): number | null {
  let normalized = input
    .replace(/\u00a0/g, " ")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[kr$€£]/gi, "");

  if (normalized.length === 0) {
    return null;
  }

  const isNegativeByParentheses =
    normalized.startsWith("(") && normalized.endsWith(")");
  if (isNegativeByParentheses) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimal = lastComma > lastDot ? "," : ".";
    const thousand = decimal === "," ? "." : ",";
    normalized = normalized.split(thousand).join("");
    if (decimal === ",") {
      normalized = normalized.replace(",", ".");
    }
  } else if (/^(\d{1,3})(,\d{3})+([.]\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^(\d{1,3})(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  return isNegativeByParentheses ? -Math.abs(value) : value;
}

function inferFileTypeV1(input: {
  fileName: string;
  fileType?: "pdf" | "docx";
}): "pdf" | "docx" | null {
  if (input.fileType) {
    const parsed = AnnualReportFileTypeV1Schema.safeParse(input.fileType);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }

  const lowerName = input.fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (lowerName.endsWith(".docx")) {
    return "docx";
  }

  return null;
}

function extractWithPatternV1(input: {
  pattern: RegExp;
  text: string;
}): { snippet: string; value: string } | null {
  const match = input.text.match(input.pattern);
  if (!match) {
    return null;
  }

  const value = (match[1] ?? "").trim();
  if (value.length === 0) {
    return null;
  }

  return {
    value,
    snippet: match[0].trim().slice(0, 200),
  };
}

function buildStringFieldV1(input: {
  value: string | null;
  snippet?: string;
  confidence: number;
}) {
  const status: AnnualReportExtractionFieldStatusV1 = input.value
    ? "extracted"
    : "needs_review";
  return {
    status,
    confidence: input.value ? input.confidence : 0,
    value: input.value ?? undefined,
    sourceSnippet: input.snippet
      ? {
          snippet: input.snippet,
        }
      : undefined,
  };
}

function buildDateFieldV1(input: {
  value: string | null;
  snippet?: string;
  confidence: number;
}) {
  const status: AnnualReportExtractionFieldStatusV1 = input.value
    ? "extracted"
    : "needs_review";
  return {
    status,
    confidence: input.value ? input.confidence : 0,
    value: input.value ?? undefined,
    sourceSnippet: input.snippet
      ? {
          snippet: input.snippet,
        }
      : undefined,
  };
}

function buildEnumFieldV1(input: {
  value: "K2" | "K3" | null;
  snippet?: string;
  confidence: number;
}) {
  const status: AnnualReportExtractionFieldStatusV1 = input.value
    ? "extracted"
    : "needs_review";
  return {
    status,
    confidence: input.value ? input.confidence : 0,
    value: input.value ?? undefined,
    sourceSnippet: input.snippet
      ? {
          snippet: input.snippet,
        }
      : undefined,
  };
}

function buildNumberFieldV1(input: {
  value: number | null;
  snippet?: string;
  confidence: number;
}) {
  const status: AnnualReportExtractionFieldStatusV1 = input.value !== null
    ? "extracted"
    : "needs_review";
  return {
    status,
    confidence: input.value !== null ? input.confidence : 0,
    value: input.value ?? undefined,
    sourceSnippet: input.snippet
      ? {
          snippet: input.snippet,
        }
      : undefined,
  };
}

function parseAnnualReportExtractionRequestV1(
  input: unknown,
): ParseAnnualReportExtractionRequestV1 | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const candidate = input as Partial<ParseAnnualReportExtractionRequestV1>;
  if (typeof candidate.fileName !== "string" || candidate.fileName.trim() === "") {
    return null;
  }
  if (
    !(candidate.fileBytes instanceof Uint8Array) ||
    candidate.fileBytes.byteLength === 0
  ) {
    return null;
  }
  if (
    typeof candidate.policyVersion !== "string" ||
    candidate.policyVersion.trim() === ""
  ) {
    return null;
  }

  return {
    fileName: candidate.fileName,
    fileBytes: candidate.fileBytes,
    policyVersion: candidate.policyVersion,
    fileType: candidate.fileType,
  };
}

/**
 * Extracts annual report fields using deterministic text patterns.
 *
 * Safety boundary:
 * - Extraction is strictly schema-first and deterministic.
 * - Missing fields are surfaced as `needs_review` so manual completion is always possible.
 */
export function parseAnnualReportExtractionV1(
  input: unknown,
): ParseAnnualReportExtractionResultV1 {
  const parsedRequest = parseAnnualReportExtractionRequestV1(input);
  if (!parsedRequest) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Annual report extraction request payload is invalid.",
        user_message: "The annual report payload is invalid.",
        context: {},
      },
    };
  }

  const resolvedFileType = inferFileTypeV1({
    fileName: parsedRequest.fileName,
    fileType: parsedRequest.fileType,
  });
  if (!resolvedFileType) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Annual report file type is unsupported.",
        user_message: "Upload a PDF or DOCX annual report file.",
        context: {
          fileName: parsedRequest.fileName,
        },
      },
    };
  }

  let decodedText = "";
  try {
    decodedText = new TextDecoder("utf-8", { fatal: false }).decode(
      parsedRequest.fileBytes,
    );
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: "Annual report text decoding failed.",
        user_message: "The annual report could not be parsed.",
        context: {
          error:
            error instanceof Error ? error.message : "Unknown decoding failure.",
        },
      },
    };
  }

  const text = normalizeWhitespaceV1(decodedText);
  if (text.length === 0) {
    return {
      ok: false,
      error: {
        code: "PARSE_FAILED",
        message: "Annual report file did not contain readable text.",
        user_message: "The annual report could not be parsed into readable text.",
        context: {
          fileName: parsedRequest.fileName,
        },
      },
    };
  }

  const companyNameMatch =
    extractWithPatternV1({
      text,
      pattern: /\b(?:company name|bolagsnamn|företagsnamn)\s*[:\-]\s*([^\n]+)/i,
    }) ??
    extractWithPatternV1({
      text,
      pattern: /\b([A-ZÅÄÖ][A-Za-zÅÄÖåäö0-9\s.&-]{2,80}\sAB)\b/,
    });

  const orgNumberMatch = extractWithPatternV1({
    text,
    pattern: /\b(\d{6}[- ]?\d{4})\b/,
  });

  const fiscalRangeMatch = text.match(
    /\b(\d{4}-\d{2}-\d{2})\s*(?:to|till|-|–)\s*(\d{4}-\d{2}-\d{2})\b/i,
  );

  const accountingStandardMatch = text.match(/\b(K2|K3)\b/i);

  const profitBeforeTaxMatch =
    extractWithPatternV1({
      text,
      pattern: /\b(?:profit before tax|resultat före skatt)\s*[:\-]?\s*(-?[0-9().,\s]+)/i,
    }) ??
    extractWithPatternV1({
      text,
      pattern: /\b(?:result before tax)\s*[:\-]?\s*(-?[0-9().,\s]+)/i,
    });
  const parsedProfitBeforeTax = profitBeforeTaxMatch
    ? parseNumberValueV1(profitBeforeTaxMatch.value)
    : null;

  try {
    const extraction = parseAnnualReportExtractionPayloadV1({
      schemaVersion: "annual_report_extraction_v1",
      sourceFileName: parsedRequest.fileName,
      sourceFileType: resolvedFileType,
      policyVersion: parsedRequest.policyVersion,
      fields: {
        companyName: buildStringFieldV1({
          value: companyNameMatch?.value ?? null,
          snippet: companyNameMatch?.snippet,
          confidence: companyNameMatch ? 0.9 : 0,
        }),
        organizationNumber: buildStringFieldV1({
          value: orgNumberMatch?.value ?? null,
          snippet: orgNumberMatch?.snippet,
          confidence: orgNumberMatch ? 0.95 : 0,
        }),
        fiscalYearStart: buildDateFieldV1({
          value: fiscalRangeMatch?.[1] ?? null,
          snippet: fiscalRangeMatch?.[0],
          confidence: fiscalRangeMatch ? 0.8 : 0,
        }),
        fiscalYearEnd: buildDateFieldV1({
          value: fiscalRangeMatch?.[2] ?? null,
          snippet: fiscalRangeMatch?.[0],
          confidence: fiscalRangeMatch ? 0.8 : 0,
        }),
        accountingStandard: buildEnumFieldV1({
          value:
            accountingStandardMatch?.[1]?.toUpperCase() === "K2"
              ? "K2"
              : accountingStandardMatch?.[1]?.toUpperCase() === "K3"
                ? "K3"
                : null,
          snippet: accountingStandardMatch?.[0],
          confidence: accountingStandardMatch ? 0.85 : 0,
        }),
        profitBeforeTax: buildNumberFieldV1({
          value: parsedProfitBeforeTax,
          snippet: profitBeforeTaxMatch?.snippet,
          confidence: parsedProfitBeforeTax !== null ? 0.85 : 0,
        }),
      },
      summary: {
        autoDetectedFieldCount: [
          companyNameMatch?.value,
          orgNumberMatch?.value,
          fiscalRangeMatch?.[1],
          fiscalRangeMatch?.[2],
          accountingStandardMatch?.[1],
          parsedProfitBeforeTax !== null ? "1" : null,
        ].filter(Boolean).length,
        needsReviewFieldCount: [
          !companyNameMatch?.value,
          !orgNumberMatch?.value,
          !fiscalRangeMatch?.[1],
          !fiscalRangeMatch?.[2],
          !accountingStandardMatch?.[1],
          parsedProfitBeforeTax === null,
        ].filter(Boolean).length,
      },
      confirmation: {
        isConfirmed: false,
      },
    });

    return {
      ok: true,
      extraction,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Extracted annual report payload did not pass contract validation.",
        user_message:
          "The report was read but extracted values could not be validated.",
        context: {
          message: error instanceof Error ? error.message : "Unknown validation error.",
        },
      },
    };
  }
}
