import {
  ANNUAL_REPORT_CODES_SV_V1,
  getAnnualReportCodeDefinitionV1,
} from "./annual-report-codes.v1";

export type Ink2FieldSignV1 = "+" | "-" | "+/-";

export type Ink2FieldSectionV1 =
  | "page_1"
  | "ink2r_balance"
  | "ink2r_income"
  | "ink2s";

export type Ink2FieldDefinitionV1 = {
  fieldId: string;
  label: string;
  layoutColumn: "left" | "right";
  page: 1 | 2 | 3 | 4;
  pdfFieldNames: string[];
  section: Ink2FieldSectionV1;
  sign?: Ink2FieldSignV1;
  sourceCode?: string;
  subsection?: string;
};

const PAGE_1_FIELD_DEFINITIONS_V1: readonly Ink2FieldDefinitionV1[] = [
  {
    fieldId: "1.1",
    label: "Överskott av näringsverksamhet",
    layoutColumn: "left",
    page: 1,
    pdfFieldNames: ["2002011"],
    section: "page_1",
    sign: "+",
  },
  {
    fieldId: "1.2",
    label: "Underskott av näringsverksamhet",
    layoutColumn: "left",
    page: 1,
    pdfFieldNames: ["2002012"],
    section: "page_1",
    sign: "-",
  },
  {
    fieldId: "1.3",
    label:
      "Underskott som inte redovisas i p. 1.2, koncernbidrags- och fusionsspärrat underskott",
    layoutColumn: "left",
    page: 1,
    pdfFieldNames: ["2002013"],
    section: "page_1",
    sign: "+",
  },
  {
    fieldId: "1.4",
    label: "Underlag för särskild löneskatt på pensionskostnader",
    layoutColumn: "right",
    page: 1,
    pdfFieldNames: ["2002014"],
    section: "page_1",
    sign: "+",
  },
  {
    fieldId: "1.5",
    label: "Negativt underlag för särskild löneskatt på pensionskostnader",
    layoutColumn: "right",
    page: 1,
    pdfFieldNames: ["2002015"],
    section: "page_1",
    sign: "-",
  },
] as const;

const PAGE_2_FIELD_DEFINITIONS_V1: readonly Ink2FieldDefinitionV1[] =
  Array.from({ length: 50 }, (_, index) => {
    const fieldId = `2.${index + 1}`;
    const definition = getAnnualReportCodeDefinitionV1(fieldId);
    if (!definition) {
      throw new Error(`Missing annual-report code definition for ${fieldId}.`);
    }

    return {
      fieldId,
      label: definition.labelSv,
      layoutColumn: index < 26 ? ("left" as const) : ("right" as const),
      page: 2 as const,
      pdfFieldNames: [`200202${index + 1}`],
      section: "ink2r_balance" as const,
      sourceCode: fieldId,
      subsection:
        definition.subgroupSv ?? definition.groupSv ?? definition.sectionSv,
    };
  });

const PAGE_3_FIELD_DEFINITIONS_V1: readonly Ink2FieldDefinitionV1[] = [
  {
    fieldId: "3.1",
    label: "Nettoomsättning",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002031"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.1",
    subsection: "Rörelsens intäkter",
  },
  {
    fieldId: "3.2",
    label:
      "Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002032", "2002033"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.2",
    subsection: "Rörelsens intäkter",
  },
  {
    fieldId: "3.3",
    label: "Aktiverat arbete för egen räkning",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002034"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.3",
    subsection: "Rörelsens intäkter",
  },
  {
    fieldId: "3.4",
    label: "Övriga rörelseintäkter",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002035"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.4",
    subsection: "Rörelsens intäkter",
  },
  {
    fieldId: "3.5",
    label: "Råvaror och förnödenheter",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002036"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.5",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.6",
    label: "Handelsvaror",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002037"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.6",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.7",
    label: "Övriga externa kostnader",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002038"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.7",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.8",
    label: "Personalkostnader",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["2002039"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.8",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.9",
    label:
      "Av- och nedskrivningar av materiella och immateriella anläggningstillgångar",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020310"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.9",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.10",
    label:
      "Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020311"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.10",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.11",
    label: "Övriga rörelsekostnader",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020312"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.11",
    subsection: "Rörelsens kostnader",
  },
  {
    fieldId: "3.12",
    label: "Resultat från andelar i koncernföretag",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020313", "20020314"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.12",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.13",
    label: "Resultat från andelar i intresseföretag",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020315", "20020316"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.13",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.14",
    label: "Resultat från övriga finansiella anläggningstillgångar",
    layoutColumn: "left",
    page: 3,
    pdfFieldNames: ["20020317", "20020318"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.15",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.15",
    label: "Övriga ränteintäkter och liknande resultatposter",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020319"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.16",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.16",
    label:
      "Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020320"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.17",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.17",
    label: "Räntekostnader och liknande resultatposter",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020321"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.18",
    subsection: "Finansiella poster",
  },
  {
    fieldId: "3.18",
    label: "Extraordinära intäkter",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020322"],
    section: "ink2r_income",
    sign: "+",
    subsection: "Extraordinära poster",
  },
  {
    fieldId: "3.19",
    label: "Extraordinära kostnader",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020323"],
    section: "ink2r_income",
    sign: "-",
    subsection: "Extraordinära poster",
  },
  {
    fieldId: "3.20",
    label: "Lämnade koncernbidrag",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020324"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.19",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.21",
    label: "Mottagna koncernbidrag",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020325"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.20",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.22",
    label: "Återföring av periodiseringsfond",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020326"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.21",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.23",
    label: "Avsättning till periodiseringsfond",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020327"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.22",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.24",
    label: "Förändring av överavskrivningar",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020328", "20020329"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.23",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.25",
    label: "Övriga bokslutsdispositioner",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020330", "20020331"],
    section: "ink2r_income",
    sign: "+/-",
    sourceCode: "3.24",
    subsection: "Bokslutsdispositioner",
  },
  {
    fieldId: "3.26",
    label: "Skatt på årets resultat",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020332"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.25",
    subsection: "Skatt",
  },
  {
    fieldId: "3.27",
    label: "Årets resultat, vinst (flyttas till p. 4.1)",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020333"],
    section: "ink2r_income",
    sign: "+",
    sourceCode: "3.26",
    subsection: "Årets resultat",
  },
  {
    fieldId: "3.28",
    label: "Årets resultat, förlust (flyttas till p. 4.2)",
    layoutColumn: "right",
    page: 3,
    pdfFieldNames: ["20020334"],
    section: "ink2r_income",
    sign: "-",
    sourceCode: "3.27",
    subsection: "Årets resultat",
  },
] as const;

const PAGE_4_FIELD_DEFINITIONS_V1: readonly Ink2FieldDefinitionV1[] = [
  {
    fieldId: "4.1",
    label: "Årets resultat, vinst",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002041"],
    section: "ink2s",
    sign: "+",
  },
  {
    fieldId: "4.2",
    label: "Årets resultat, förlust",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002042"],
    section: "ink2s",
    sign: "-",
  },
  {
    fieldId: "4.3a",
    label: "Skatt på årets resultat",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002043"],
    section: "ink2s",
    sign: "+",
    subsection: "4.3 Bokförda kostnader som inte ska dras av",
  },
  {
    fieldId: "4.3b",
    label: "Nedskrivning av finansiella tillgångar",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002044"],
    section: "ink2s",
    sign: "+",
    subsection: "4.3 Bokförda kostnader som inte ska dras av",
  },
  {
    fieldId: "4.3c",
    label: "Andra bokförda kostnader",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002045"],
    section: "ink2s",
    sign: "+",
    subsection: "4.3 Bokförda kostnader som inte ska dras av",
  },
  {
    fieldId: "4.4a",
    label: "Lämnade koncernbidrag",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002046"],
    section: "ink2s",
    sign: "-",
    subsection:
      "4.4 Kostnader som ska dras av men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.4b",
    label: "Andra ej bokförda kostnader",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002047"],
    section: "ink2s",
    sign: "-",
    subsection:
      "4.4 Kostnader som ska dras av men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.5a",
    label: "Ackordsvinster",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002048"],
    section: "ink2s",
    sign: "-",
    subsection: "4.5 Bokförda intäkter som inte ska tas upp",
  },
  {
    fieldId: "4.5b",
    label: "Utdelning",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["2002049"],
    section: "ink2s",
    sign: "-",
    subsection: "4.5 Bokförda intäkter som inte ska tas upp",
  },
  {
    fieldId: "4.5c",
    label: "Andra bokförda intäkter",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020410"],
    section: "ink2s",
    sign: "-",
    subsection: "4.5 Bokförda intäkter som inte ska tas upp",
  },
  {
    fieldId: "4.6a",
    label:
      "Beräknad schablonintäkt på kvarvarande periodiseringsfonder vid beskattningsårets ingång",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020411"],
    section: "ink2s",
    sign: "+",
    subsection:
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.6b",
    label:
      "Beräknad schablonintäkt på investeringsfonder ägda vid ingången av kalenderåret",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020412"],
    section: "ink2s",
    sign: "+",
    subsection:
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.6c",
    label: "Mottagna koncernbidrag",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020413"],
    section: "ink2s",
    sign: "+",
    subsection:
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.6d",
    label: "Intäkt negativ justerad anskaffningsutgift",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020414"],
    section: "ink2s",
    sign: "+",
    subsection:
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.6e",
    label: "Andra ej bokförda intäkter",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020415"],
    section: "ink2s",
    sign: "+",
    subsection:
      "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
  },
  {
    fieldId: "4.7a",
    label: "Bokförd vinst",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020416"],
    section: "ink2s",
    sign: "-",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.7b",
    label: "Bokförd förlust",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020417"],
    section: "ink2s",
    sign: "+",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.7c",
    label: "Uppskov med kapitalvinst enligt blankett N4",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020418"],
    section: "ink2s",
    sign: "-",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.7d",
    label: "Återfört uppskov av kapitalvinst enligt blankett N4",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020419"],
    section: "ink2s",
    sign: "+",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.7e",
    label: "Kapitalvinst för beskattningsåret",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020420"],
    section: "ink2s",
    sign: "+",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.7f",
    label: "Kapitalförlust som ska dras av",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020421"],
    section: "ink2s",
    sign: "-",
    subsection: "4.7 Avyttring av delägarrätter",
  },
  {
    fieldId: "4.8a",
    label: "Bokförd intäkt/vinst",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020422"],
    section: "ink2s",
    sign: "-",
    subsection: "4.8 Andel i handelsbolag (inkl. avyttring)",
  },
  {
    fieldId: "4.8b",
    label: "Skattemässigt överskott enligt N3B",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020423"],
    section: "ink2s",
    sign: "+",
    subsection: "4.8 Andel i handelsbolag (inkl. avyttring)",
  },
  {
    fieldId: "4.8c",
    label: "Bokförd kostnad/förlust",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020424"],
    section: "ink2s",
    sign: "+",
    subsection: "4.8 Andel i handelsbolag (inkl. avyttring)",
  },
  {
    fieldId: "4.8d",
    label: "Skattemässigt underskott enligt N3B",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020425"],
    section: "ink2s",
    sign: "-",
    subsection: "4.8 Andel i handelsbolag (inkl. avyttring)",
  },
  {
    fieldId: "4.9",
    label:
      "Skattemässig justering av bokfört resultat för avskrivning på byggnader och annan fast egendom samt vid restvärdesavskrivning på maskiner och inventarier",
    layoutColumn: "left",
    page: 4,
    pdfFieldNames: ["20020426", "20020427"],
    section: "ink2s",
    sign: "+/-",
  },
  {
    fieldId: "4.10",
    label:
      "Skattemässig korrigering av bokfört resultat vid avyttring av näringsfastighet och näringsbostadsrätt",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020428"],
    section: "ink2s",
    sign: "-",
  },
  {
    fieldId: "4.11",
    label: "Skogs-/substansminskningsavdrag (specificeras på blankett N8)",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020429"],
    section: "ink2s",
    sign: "-",
  },
  {
    fieldId: "4.12",
    label:
      "Återföringar vid avyttring av fastighet, t.ex. värdeminskningsavdrag, skogsavdrag och substansminskningsavdrag (skogs- och substansminskningsavdrag redovisas även på N8)",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020430"],
    section: "ink2s",
    sign: "+",
  },
  {
    fieldId: "4.13",
    label: "Andra skattemässiga justeringar av resultatet",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020431"],
    section: "ink2s",
    sign: "+/-",
  },
  {
    fieldId: "4.14a",
    label: "Outnyttjat underskott från föregående år",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020432"],
    section: "ink2s",
    sign: "-",
    subsection: "4.14 Underskott",
  },
  {
    fieldId: "4.14b",
    label:
      "Reduktion av underskott med hänsyn till exempelvis ägarförändring eller ackord",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020433"],
    section: "ink2s",
    sign: "+",
    subsection: "4.14 Underskott",
  },
  {
    fieldId: "4.14c",
    label: "Översiktligt spärrat underskott som flyttas till p. 1.3 på sid. 1",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020434"],
    section: "ink2s",
    sign: "+",
    subsection: "4.14 Underskott",
  },
  {
    fieldId: "4.15",
    label: "Överskott (flyttas till p. 1.1 på sid. 1)",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020435"],
    section: "ink2s",
    sign: "+",
  },
  {
    fieldId: "4.16",
    label: "Underskott (flyttas till p. 1.2 på sid. 1)",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020436"],
    section: "ink2s",
    sign: "-",
  },
  {
    fieldId: "4.17",
    label:
      "Årets begärda och tidigare års medgivna värdeminskningsavdrag på byggnader som finns kvar vid beskattningsårets utgång",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020437"],
    section: "ink2s",
    sign: "+",
    subsection: "Övriga uppgifter",
  },
  {
    fieldId: "4.18",
    label:
      "Årets begärda och tidigare års medgivna värdeminskningsavdrag på markanläggningar som finns kvar vid beskattningsårets utgång",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020438"],
    section: "ink2s",
    sign: "+",
    subsection: "Övriga uppgifter",
  },
  {
    fieldId: "4.19",
    label:
      "Vid restvärdesavskrivning: återförda belopp för av- och nedskrivning, försäljning, utrangering",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020439"],
    section: "ink2s",
    sign: "+",
    subsection: "Övriga uppgifter",
  },
  {
    fieldId: "4.20",
    label: "Lån från aktieägare (fysisk person) vid beskattningsårets utgång",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020440"],
    section: "ink2s",
    sign: "+",
    subsection: "Övriga uppgifter",
  },
  {
    fieldId: "4.21",
    label: "Pensionskostnader (som ingår i p. 3.8)",
    layoutColumn: "right",
    page: 4,
    pdfFieldNames: ["20020441"],
    section: "ink2s",
    sign: "+",
    subsection: "Övriga uppgifter",
  },
] as const;

export const INK2_FIELD_DEFINITIONS_V1: readonly Ink2FieldDefinitionV1[] = [
  ...PAGE_1_FIELD_DEFINITIONS_V1,
  ...PAGE_2_FIELD_DEFINITIONS_V1,
  ...PAGE_3_FIELD_DEFINITIONS_V1,
  ...PAGE_4_FIELD_DEFINITIONS_V1,
] as const;

const INK2_FIELD_DEFINITION_BY_ID_V1 = new Map(
  INK2_FIELD_DEFINITIONS_V1.map((field) => [field.fieldId, field]),
);

export function getInk2FieldDefinitionV1(
  fieldId: string,
): Ink2FieldDefinitionV1 | undefined {
  return INK2_FIELD_DEFINITION_BY_ID_V1.get(fieldId);
}

export function listInk2FieldDefinitionsV1(): Ink2FieldDefinitionV1[] {
  return [...INK2_FIELD_DEFINITIONS_V1];
}

export function listInk2FieldDefinitionsBySectionV1(
  section: Ink2FieldSectionV1,
): Ink2FieldDefinitionV1[] {
  return INK2_FIELD_DEFINITIONS_V1.filter((field) => field.section === section);
}

export function buildInk2PdfIdentityFieldMapV1(input: {
  companyName?: string;
  organizationNumber?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  generatedDateIso: string;
}): Record<string, string> {
  return {
    Adr1: input.companyName ?? "",
    Adr2: "",
    Adr3: "",
    Adr4: "",
    Adr5: "",
    DatFramst: input.generatedDateIso,
    From: input.fiscalYearStart ?? "",
    PersOrgNr: input.organizationNumber ?? "",
    Tom: input.fiscalYearEnd ?? "",
  };
}

export function buildInk2TemplateCheckboxFieldMapV1(input: {
  consultantAssisted?: boolean;
  audited?: boolean;
}): Record<string, string> {
  return {
    "20020443": input.consultantAssisted ? "X" : "",
    "20020444": input.consultantAssisted ? "" : "X",
    "20020445": input.audited ? "X" : "",
    "20020446": input.audited ? "" : "X",
  };
}

export function getInk2CanonicalStatementCodesV1(): string[] {
  return ANNUAL_REPORT_CODES_SV_V1.map((definition) => definition.code);
}
