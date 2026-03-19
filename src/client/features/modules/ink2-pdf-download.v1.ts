import { PDFDocument } from "pdf-lib";

import type { AnnualReportExtractionPayloadV1 } from "../../../shared/contracts/annual-report-extraction.v1";
import type { Ink2FormDraftPayloadV1 } from "../../../shared/contracts/ink2-form.v1";
import {
  buildInk2PdfIdentityFieldMapV1,
  buildInk2TemplateCheckboxFieldMapV1,
  getInk2FieldDefinitionV1,
} from "../../../shared/contracts/ink2-layout.v1";

const INK2_TEMPLATE_URL_V1 = "/templates/ink2/INK2-200223P3.pdf";

function formatIsoDateForPdfV1(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPdfAmountSlotV1(input: {
  amount: number;
  slotCount: number;
  slotIndex: number;
  sign: "+" | "-" | "+/-" | undefined;
}): string {
  const rounded = Math.round(input.amount);
  if (input.slotCount === 2) {
    if (input.slotIndex === 0) {
      return rounded > 0 ? String(Math.abs(rounded)) : "";
    }

    return rounded < 0 ? String(Math.abs(rounded)) : "";
  }

  if (rounded === 0) {
    return "";
  }

  if (input.sign === "+/-") {
    return String(rounded);
  }

  return String(Math.abs(rounded));
}

function setOptionalTextFieldV1(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldName: string,
  value: string,
): void {
  try {
    form.getTextField(fieldName).setText(value);
  } catch {
    // Keep template evolution non-fatal for this first pass.
  }
}

export function populateInk2PdfFormV1(input: {
  audited?: boolean;
  consultantAssisted?: boolean;
  extraction: AnnualReportExtractionPayloadV1;
  formDraft: Ink2FormDraftPayloadV1;
  pdfForm: ReturnType<PDFDocument["getForm"]>;
}): void {
  const identityFields = buildInk2PdfIdentityFieldMapV1({
    companyName: input.extraction.fields.companyName.value,
    organizationNumber: input.extraction.fields.organizationNumber.value,
    fiscalYearStart: input.extraction.fields.fiscalYearStart.value,
    fiscalYearEnd: input.extraction.fields.fiscalYearEnd.value,
    generatedDateIso: formatIsoDateForPdfV1(new Date()),
  });

  for (const [fieldName, value] of Object.entries(identityFields)) {
    setOptionalTextFieldV1(input.pdfForm, fieldName, value);
  }

  const checkboxFields = buildInk2TemplateCheckboxFieldMapV1({
    consultantAssisted: input.consultantAssisted,
    audited: input.audited,
  });
  for (const [fieldName, value] of Object.entries(checkboxFields)) {
    setOptionalTextFieldV1(input.pdfForm, fieldName, value);
  }

  for (const field of input.formDraft.fields) {
    const definition = getInk2FieldDefinitionV1(field.fieldId);
    if (!definition) {
      continue;
    }

    definition.pdfFieldNames.forEach((pdfFieldName, slotIndex) => {
      setOptionalTextFieldV1(
        input.pdfForm,
        pdfFieldName,
        formatPdfAmountSlotV1({
          amount: field.amount,
          slotCount: definition.pdfFieldNames.length,
          slotIndex,
          sign: definition.sign,
        }),
      );
    });
  }
}

export async function buildPopulatedInk2PdfBytesV1(input: {
  audited?: boolean;
  consultantAssisted?: boolean;
  extraction: AnnualReportExtractionPayloadV1;
  formDraft: Ink2FormDraftPayloadV1;
}): Promise<Uint8Array> {
  const templateResponse = await fetch(INK2_TEMPLATE_URL_V1);
  if (!templateResponse.ok) {
    throw new Error("INK2 PDF template could not be loaded.");
  }

  const templateBytes = await templateResponse.arrayBuffer();
  const pdfDocument = await PDFDocument.load(templateBytes);
  const pdfForm = pdfDocument.getForm();
  populateInk2PdfFormV1({
    audited: input.audited,
    consultantAssisted: input.consultantAssisted,
    extraction: input.extraction,
    formDraft: input.formDraft,
    pdfForm,
  });
  pdfForm.flatten();
  return pdfDocument.save();
}

export async function downloadPopulatedInk2PdfV1(input: {
  audited?: boolean;
  consultantAssisted?: boolean;
  extraction: AnnualReportExtractionPayloadV1;
  fileName?: string;
  formDraft: Ink2FormDraftPayloadV1;
}): Promise<void> {
  const pdfBytes = await buildPopulatedInk2PdfBytesV1(input);
  const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
  normalizedBytes.set(pdfBytes);
  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const companySlug =
    input.extraction.fields.companyName.value
      ?.trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() ?? "company";

  link.href = downloadUrl;
  link.download = input.fileName ?? `${companySlug}-ink2-return.pdf`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}
