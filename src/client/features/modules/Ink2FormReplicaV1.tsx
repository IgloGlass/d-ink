import { Fragment, useEffect, useState } from "react";

import type { AnnualReportExtractionPayloadV1 } from "../../../shared/contracts/annual-report-extraction.v1";
import type {
  Ink2DraftFieldV1,
  Ink2FormDraftPayloadV1,
} from "../../../shared/contracts/ink2-form.v1";
import {
  type Ink2FieldDefinitionV1,
  type Ink2FieldSectionV1,
  getInk2FieldDefinitionV1,
  listInk2FieldDefinitionsBySectionV1,
} from "../../../shared/contracts/ink2-layout.v1";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";

type Ink2ReplicaPageV1 = {
  description: string;
  id: Ink2FieldSectionV1;
  label: string;
  leftColumnTitle: string;
  pageNumber: 1 | 2 | 3 | 4;
  pdfLabel: string;
  rightColumnTitle: string;
};

type Ink2EditableSlotsV1 = {
  negative: string;
  positive: string;
};

type Ink2FieldToneV1 = {
  rowClassName: string;
};

const INK2_PAGES_V1: Ink2ReplicaPageV1[] = [
  {
    id: "page_1",
    label: "Sida 1",
    pageNumber: 1,
    pdfLabel: "Inkomstdeklaration 2",
    description: "Skatteunderlag och huvuduppgifter",
    leftColumnTitle: "Underlag för inkomstskatt",
    rightColumnTitle: "Särskild löneskatt och huvuduppgifter",
  },
  {
    id: "ink2r_balance",
    label: "INK2R Balansräkning",
    pageNumber: 2,
    pdfLabel: "Räkenskapsschema",
    description: "Balansräkning enligt INK2R",
    leftColumnTitle: "Tillgångar",
    rightColumnTitle: "Eget kapital, avsättningar och skulder",
  },
  {
    id: "ink2r_income",
    label: "INK2R Resultaträkning",
    pageNumber: 3,
    pdfLabel: "Resultaträkning",
    description: "Resultaträkning enligt INK2R",
    leftColumnTitle: "Resultaträkning",
    rightColumnTitle: "Resultaträkning (forts.)",
  },
  {
    id: "ink2s",
    label: "INK2S Skattemässiga justeringar",
    pageNumber: 4,
    pdfLabel: "Skattemässiga justeringar",
    description: "Justeringar mellan redovisat och skattemässigt resultat",
    leftColumnTitle: "Justeringar och skattemässiga tillägg",
    rightColumnTitle: "Fortsättning, underskott och övriga uppgifter",
  },
] as const;

function formatInk2AmountV1(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(value)));
}

function formatInk2IsoDateV1(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${year}-${month}-${day}`;
}

function splitAmountSlotsV1(input: {
  amount: number;
  definition: Ink2FieldDefinitionV1;
}): Ink2EditableSlotsV1 {
  if (input.amount === 0) {
    return { negative: "", positive: "" };
  }

  if (
    input.definition.sign === "+/-" ||
    input.definition.pdfFieldNames.length === 2
  ) {
    return {
      negative: input.amount < 0 ? formatInk2AmountV1(input.amount) : "",
      positive: input.amount > 0 ? formatInk2AmountV1(input.amount) : "",
    };
  }

  return {
    negative: "",
    positive: formatInk2AmountV1(input.amount),
  };
}

function parseInk2AmountInputV1(value: string): number {
  const normalized = value.replace(/[^\d-]/g, "");
  if (normalized.length === 0 || normalized === "-") {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFieldMapV1(
  fields: Ink2DraftFieldV1[],
): Map<string, Ink2DraftFieldV1> {
  return new Map(fields.map((field) => [field.fieldId, field]));
}

function buildEditableStateV1(
  fields: Ink2DraftFieldV1[],
): Record<string, Ink2EditableSlotsV1> {
  const state: Record<string, Ink2EditableSlotsV1> = {};

  for (const field of fields) {
    const definition = getInk2FieldDefinitionV1(field.fieldId);
    if (!definition) {
      continue;
    }

    state[field.fieldId] = splitAmountSlotsV1({
      amount: field.amount,
      definition,
    });
  }

  return state;
}

function resolveEditedAmountV1(input: {
  definition: Ink2FieldDefinitionV1;
  slots: Ink2EditableSlotsV1 | undefined;
}): number {
  const slots = input.slots ?? { negative: "", positive: "" };
  const positive = parseInk2AmountInputV1(slots.positive);
  const negative = parseInk2AmountInputV1(slots.negative);

  if (
    input.definition.sign === "+/-" ||
    input.definition.pdfFieldNames.length === 2
  ) {
    if (positive > 0) {
      return positive;
    }
    if (negative > 0) {
      return -negative;
    }
    return 0;
  }

  return positive;
}

function isManualOrAdjustmentFieldV1(
  field: Ink2DraftFieldV1 | undefined,
): boolean {
  return field?.provenance === "manual" || field?.provenance === "adjustment";
}

function getPopulatedCountByPageV1(input: {
  form: Ink2FormDraftPayloadV1;
  pageId: Ink2FieldSectionV1;
}): number {
  const fieldIds = new Set(
    listInk2FieldDefinitionsBySectionV1(input.pageId).map(
      (definition) => definition.fieldId,
    ),
  );

  return input.form.fields.filter(
    (field) => fieldIds.has(field.fieldId) && field.amount !== 0,
  ).length;
}

function pickDefaultPageV1(
  form: Ink2FormDraftPayloadV1 | undefined,
): Ink2FieldSectionV1 {
  if (!form) {
    return "ink2s";
  }

  const fieldMap = buildFieldMapV1(form.fields);
  const hasAdjustmentRows = listInk2FieldDefinitionsBySectionV1("ink2s").some(
    (definition) => {
      const field = fieldMap.get(definition.fieldId);
      return (
        field !== undefined &&
        field.amount !== 0 &&
        isManualOrAdjustmentFieldV1(field)
      );
    },
  );
  if (hasAdjustmentRows) {
    return "ink2s";
  }

  if (getPopulatedCountByPageV1({ form, pageId: "ink2r_balance" }) > 0) {
    return "ink2r_balance";
  }
  if (getPopulatedCountByPageV1({ form, pageId: "ink2r_income" }) > 0) {
    return "ink2r_income";
  }
  if (getPopulatedCountByPageV1({ form, pageId: "page_1" }) > 0) {
    return "page_1";
  }

  return "ink2s";
}

function shouldRenderSectionHeaderV1(input: {
  currentSubsection: string | undefined;
  pageId: Ink2FieldSectionV1;
  previousSubsection: string | null;
}): boolean {
  if (!input.currentSubsection) {
    return false;
  }

  if (input.pageId === "ink2r_income") {
    return false;
  }

  return input.currentSubsection !== input.previousSubsection;
}

function getFieldToneV1(field: Ink2DraftFieldV1 | undefined): Ink2FieldToneV1 {
  if (field?.provenance === "manual") {
    return {
      rowClassName: "ink2-field-row--manual",
    };
  }

  if (field?.provenance === "adjustment") {
    return {
      rowClassName: "ink2-field-row--adjustment",
    };
  }

  if ((field?.amount ?? 0) !== 0) {
    return {
      rowClassName: "ink2-field-row--synced",
    };
  }

  return {
    rowClassName: "ink2-field-row--empty",
  };
}

function getSignLabelV1(definition: Ink2FieldDefinitionV1): string {
  if (definition.sign === "-") {
    return "-";
  }
  if (definition.sign === "+") {
    return "+";
  }
  return "Belopp";
}

function getPrimaryAriaLabelV1(definition: Ink2FieldDefinitionV1): string {
  if (definition.sign === "-") {
    return `${definition.fieldId} negative amount`;
  }
  if (definition.sign === "+") {
    return `${definition.fieldId} positive amount`;
  }
  return `${definition.fieldId} amount`;
}

function getFieldColumnDefinitionsV1(pageId: Ink2FieldSectionV1): {
  left: Ink2FieldDefinitionV1[];
  right: Ink2FieldDefinitionV1[];
} {
  const definitions = listInk2FieldDefinitionsBySectionV1(pageId);

  return {
    left: definitions.filter(
      (definition) => definition.layoutColumn === "left",
    ),
    right: definitions.filter(
      (definition) => definition.layoutColumn === "right",
    ),
  };
}

function getPageStatusLabelV1(isSyncing: boolean): string {
  return isSyncing ? "Uppdateras automatiskt" : "Live";
}

function Ink2PageNavigatorV1({
  activePageId,
  form,
  onSelectPage,
}: {
  activePageId: Ink2FieldSectionV1;
  form: Ink2FormDraftPayloadV1;
  onSelectPage: (pageId: Ink2FieldSectionV1) => void;
}) {
  return (
    <div className="ink2-page-nav">
      {INK2_PAGES_V1.map((page) => {
        const populatedCount = getPopulatedCountByPageV1({
          form,
          pageId: page.id,
        });
        const isActive = activePageId === page.id;

        return (
          <button
            key={page.id}
            type="button"
            className={`ink2-page-nav__item ${isActive ? "ink2-page-nav__item--active" : ""}`}
            onClick={() => onSelectPage(page.id)}
          >
            <div className="ink2-page-nav__item-topline">
              Sida {page.pageNumber}
            </div>
            <div className="ink2-page-nav__item-title">{page.label}</div>
            <div className="ink2-page-nav__item-description">
              {page.description}
            </div>
            <span className="ink2-page-nav__count">{populatedCount}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ink2DocumentColumnV1({
  definitions,
  draftInputs,
  fieldMap,
  isSavingOverride,
  onCommitField,
  onSlotChange,
  page,
  title,
}: {
  definitions: Ink2FieldDefinitionV1[];
  draftInputs: Record<string, Ink2EditableSlotsV1>;
  fieldMap: Map<string, Ink2DraftFieldV1>;
  isSavingOverride: boolean;
  onCommitField: (fieldId: string) => void;
  onSlotChange: (
    fieldId: string,
    slot: keyof Ink2EditableSlotsV1,
    value: string,
  ) => void;
  page: Ink2ReplicaPageV1;
  title: string;
}) {
  let previousSubsection: string | null = null;

  return (
    <div className="ink2-doc-column">
      <header className="ink2-doc-column__header">
        <p className="ink2-doc-column__eyebrow">{page.pdfLabel}</p>
        <h3 className="ink2-doc-column__title">{title}</h3>
        <span className="ink2-doc-column__meta">
          {definitions.length} rader
        </span>
      </header>

      <div className="ink2-doc-column__rows">
        {definitions.map((definition) => {
          const field = fieldMap.get(definition.fieldId);
          const showSectionHeader = shouldRenderSectionHeaderV1({
            currentSubsection: definition.subsection,
            pageId: page.id,
            previousSubsection,
          });

          if (definition.subsection) {
            previousSubsection = definition.subsection;
          }

          return (
            <Fragment key={definition.fieldId}>
              {showSectionHeader && definition.subsection ? (
                <div className="ink2-doc-column__section-header">
                  {definition.subsection}
                </div>
              ) : null}
              <Ink2FieldRowV1
                definition={definition}
                draftInputs={draftInputs}
                field={field}
                isSavingOverride={isSavingOverride}
                onCommitField={onCommitField}
                onSlotChange={onSlotChange}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Ink2FieldRowV1({
  definition,
  draftInputs,
  field,
  isSavingOverride,
  onCommitField,
  onSlotChange,
}: {
  definition: Ink2FieldDefinitionV1;
  draftInputs: Record<string, Ink2EditableSlotsV1>;
  field: Ink2DraftFieldV1 | undefined;
  isSavingOverride: boolean;
  onCommitField: (fieldId: string) => void;
  onSlotChange: (
    fieldId: string,
    slot: keyof Ink2EditableSlotsV1,
    value: string,
  ) => void;
}) {
  const editableSlots = draftInputs[definition.fieldId] ?? {
    negative: "",
    positive: "",
  };
  const tone = getFieldToneV1(field);
  const showsDualInputs =
    definition.sign === "+/-" || definition.pdfFieldNames.length === 2;

  return (
    <article className={`ink2-field-row ${tone.rowClassName}`}>
      <div className="ink2-field-row__left">
        <div className="ink2-field-row__chips">
          <span className="ink2-field-row__code">{definition.fieldId}</span>
        </div>
        <p className="ink2-field-row__label">{definition.label}</p>
      </div>

      <div className="ink2-field-row__right">
        {showsDualInputs ? (
          <div className="ink2-field-row__dual-inputs">
            <label className="ink2-field-row__input-label">
              <span>+</span>
              <input
                aria-label={`${definition.fieldId} positive amount`}
                className="ink2-field-row__input"
                disabled={isSavingOverride}
                inputMode="numeric"
                placeholder="0"
                value={editableSlots.positive}
                onBlur={() => onCommitField(definition.fieldId)}
                onChange={(event) =>
                  onSlotChange(
                    definition.fieldId,
                    "positive",
                    event.currentTarget.value,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
            <label className="ink2-field-row__input-label">
              <span>-</span>
              <input
                aria-label={`${definition.fieldId} negative amount`}
                className="ink2-field-row__input"
                disabled={isSavingOverride}
                inputMode="numeric"
                placeholder="0"
                value={editableSlots.negative}
                onBlur={() => onCommitField(definition.fieldId)}
                onChange={(event) =>
                  onSlotChange(
                    definition.fieldId,
                    "negative",
                    event.currentTarget.value,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
          </div>
        ) : (
          <label className="ink2-field-row__input-label">
            <span>{getSignLabelV1(definition)}</span>
            <input
              aria-label={getPrimaryAriaLabelV1(definition)}
              className="ink2-field-row__input"
              disabled={isSavingOverride}
              inputMode="numeric"
              placeholder="0"
              value={editableSlots.positive}
              onBlur={() => onCommitField(definition.fieldId)}
              onChange={(event) =>
                onSlotChange(
                  definition.fieldId,
                  "positive",
                  event.currentTarget.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        )}
      </div>
    </article>
  );
}

export function Ink2FormReplicaV1({
  extraction,
  form,
  isDownloadingPdf,
  isSavingOverride,
  isSyncing,
  onDownloadPdf,
  onSaveOverride,
}: {
  extraction?: AnnualReportExtractionPayloadV1;
  form?: Ink2FormDraftPayloadV1;
  isDownloadingPdf: boolean;
  isSavingOverride: boolean;
  isSyncing: boolean;
  onDownloadPdf: () => void;
  onSaveOverride: (input: { amount: number; fieldId: string }) => void;
}) {
  const [activePageId, setActivePageId] = useState<Ink2FieldSectionV1>("ink2s");
  const [draftInputs, setDraftInputs] = useState<
    Record<string, Ink2EditableSlotsV1>
  >({});
  const [pageWasManuallySelected, setPageWasManuallySelected] = useState(false);

  useEffect(() => {
    if (!form) {
      setDraftInputs({});
      setPageWasManuallySelected(false);
      setActivePageId("ink2s");
      return;
    }

    setDraftInputs(buildEditableStateV1(form.fields));
    if (!pageWasManuallySelected) {
      setActivePageId(pickDefaultPageV1(form));
    }
  }, [form, pageWasManuallySelected]);

  if (!extraction && !form && isSyncing) {
    return (
      <CardV1 className="ink2-fallback-card">
        <div className="ink2-fallback-card__content">
          <SkeletonV1 height={28} />
          <SkeletonV1 height={760} />
        </div>
      </CardV1>
    );
  }

  if (!extraction && !form) {
    return (
      <CardV1 className="ink2-fallback-card">
        <div className="ink2-fallback-card__content">
          <EmptyStateV1
            title="No INK2 data available yet"
            description="Upload an annual report first. Module 4 will populate automatically as soon as statement data exists."
          />
        </div>
      </CardV1>
    );
  }

  if (!form) {
    return (
      <CardV1 className="ink2-fallback-card">
        <div className="ink2-fallback-card__content">
          <div className="ink2-fallback-card__header">
            <div className="module-shell__eyebrow">Module 04</div>
            <h1>Tax Return INK2</h1>
            <p>
              Module 4 is syncing automatically from the annual report and tax
              workflow artifacts. The form appears here as soon as the first
              draft is ready.
            </p>
          </div>
          <SkeletonV1 height={760} />
        </div>
      </CardV1>
    );
  }

  const fieldMap = buildFieldMapV1(form.fields);
  const companyName = extraction?.fields.companyName.value ?? "-";
  const organizationNumber = extraction?.fields.organizationNumber.value ?? "-";
  const fiscalYearStart = extraction?.fields.fiscalYearStart.value;
  const fiscalYearEnd = extraction?.fields.fiscalYearEnd.value;
  const activePage =
    INK2_PAGES_V1.find((page) => page.id === activePageId) ?? INK2_PAGES_V1[0];
  const activeColumnDefinitions = getFieldColumnDefinitionsV1(activePage.id);
  const populatedCount = form.fields.filter(
    (field) => field.amount !== 0,
  ).length;

  function handleSlotChange(
    fieldId: string,
    slot: keyof Ink2EditableSlotsV1,
    value: string,
  ) {
    setDraftInputs((current) => {
      const previous = current[fieldId] ?? { negative: "", positive: "" };
      return {
        ...current,
        [fieldId]:
          slot === "positive"
            ? {
                positive: value,
                negative:
                  getInk2FieldDefinitionV1(fieldId)?.sign === "+/-"
                    ? previous.negative
                    : "",
              }
            : { positive: "", negative: value },
      };
    });
  }

  function handleCommitField(fieldId: string) {
    const definition = getInk2FieldDefinitionV1(fieldId);
    const currentField = fieldMap.get(fieldId);
    if (!definition || !currentField) {
      return;
    }

    const nextAmount = resolveEditedAmountV1({
      definition,
      slots: draftInputs[fieldId],
    });
    if (nextAmount === currentField.amount) {
      return;
    }

    onSaveOverride({ fieldId, amount: nextAmount });
  }

  return (
    <section className="ink2-workbench">
      <div className="ink2-workbench__layout">
        <aside className="ink2-workbench__rail">
          <CardV1 className="ink2-rail-card ink2-rail-card--hero">
            <div className="ink2-hero">
              <div>
                <div className="module-shell__eyebrow">Module 04</div>
                <h1>Tax Return INK2</h1>
              </div>

              <ButtonV1
                variant="black"
                busy={isDownloadingPdf}
                onClick={onDownloadPdf}
              >
                Generate INK2 return PDF
              </ButtonV1>

              <div className="ink2-identity">
                <div className="ink2-identity__header">
                  <span>Live draft</span>
                  <strong>{getPageStatusLabelV1(isSyncing)}</strong>
                </div>
                <div className="ink2-identity__company-label">
                  Namn (firma) adress
                </div>
                <div className="ink2-identity__company-name">{companyName}</div>

                <div className="ink2-identity__facts">
                  <p>
                    <span>Organisationsnummer</span>
                    <strong>{organizationNumber}</strong>
                  </p>
                  <p>
                    <span>Fyllda rader</span>
                    <strong>{populatedCount}</strong>
                  </p>
                  <p>
                    <span>Fr.o.m.</span>
                    <strong>{formatInk2IsoDateV1(fiscalYearStart)}</strong>
                  </p>
                  <p>
                    <span>T.o.m.</span>
                    <strong>{formatInk2IsoDateV1(fiscalYearEnd)}</strong>
                  </p>
                </div>
              </div>
            </div>
          </CardV1>

          <CardV1 className="ink2-rail-card">
            <div className="ink2-overview">
              <header className="ink2-overview__header">
                <div>
                  <p className="workspace-panel-header__eyebrow">
                    Formöversikt
                  </p>
                  <h2>Sidor och fyllnadsgrad</h2>
                </div>
                <span>{INK2_PAGES_V1.length} sidor</span>
              </header>

              <div className="ink2-overview__stats">
                <article>
                  <span>Aktiv status</span>
                  <strong>{getPageStatusLabelV1(isSyncing)}</strong>
                </article>
                <article>
                  <span>Fyllda rader</span>
                  <strong>{populatedCount}</strong>
                </article>
              </div>

              <Ink2PageNavigatorV1
                activePageId={activePageId}
                form={form}
                onSelectPage={(pageId) => {
                  setPageWasManuallySelected(true);
                  setActivePageId(pageId);
                }}
              />
            </div>
          </CardV1>
        </aside>

        <main className="ink2-workbench__main">
          <CardV1 className="ink2-document-card">
            <header className="ink2-document-card__header">
              <section className="ink2-document-card__title-block">
                <p className="ink2-document-card__eyebrow">
                  Skatteverket · Aktiv blankett
                </p>
                <h2>{activePage.pdfLabel}</h2>
                <p>{activePage.description}</p>
              </section>

              <section className="ink2-document-card__meta-list">
                <p>
                  <span>Organisationsnummer</span>
                  <strong>{organizationNumber}</strong>
                </p>
                <p>
                  <span>Räkenskapsår</span>
                  <strong>
                    {formatInk2IsoDateV1(fiscalYearStart)} -{" "}
                    {formatInk2IsoDateV1(fiscalYearEnd)}
                  </strong>
                </p>
                <p>
                  <span>Sida</span>
                  <strong>{activePage.label}</strong>
                </p>
                <p>
                  <span>Fyllda rader på sidan</span>
                  <strong>
                    {getPopulatedCountByPageV1({
                      form,
                      pageId: activePage.id,
                    })}
                  </strong>
                </p>
              </section>
            </header>

            <section className="ink2-document-card__columns">
              <Ink2DocumentColumnV1
                definitions={activeColumnDefinitions.left}
                draftInputs={draftInputs}
                fieldMap={fieldMap}
                isSavingOverride={isSavingOverride}
                onCommitField={handleCommitField}
                onSlotChange={handleSlotChange}
                page={activePage}
                title={activePage.leftColumnTitle}
              />
              <Ink2DocumentColumnV1
                definitions={activeColumnDefinitions.right}
                draftInputs={draftInputs}
                fieldMap={fieldMap}
                isSavingOverride={isSavingOverride}
                onCommitField={handleCommitField}
                onSlotChange={handleSlotChange}
                page={activePage}
                title={activePage.rightColumnTitle}
              />
            </section>
          </CardV1>

          <CardV1 className="ink2-review-flags">
            <header className="ink2-review-flags__header">
              <div>
                <p className="workspace-panel-header__eyebrow">Review flags</p>
                <h2>Kontrollpunkter</h2>
              </div>
              <span>{form.validation.issues.length}</span>
            </header>

            {form.validation.issues.length > 0 ? (
              <div className="ink2-review-flags__items">
                {form.validation.issues.map((issue) => (
                  <article key={issue} className="ink2-review-flags__item">
                    <span />
                    <p>{issue}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ink2-review-flags__empty">
                Inga öppna kontrollpunkter just nu. Eventuella
                valideringsproblem visas här längst ned i modulen.
              </div>
            )}
          </CardV1>
        </main>
      </div>
    </section>
  );
}
