export type AnnualReportStatementNameSvV1 =
  | "Balansräkning"
  | "Resultaträkning";

export type AnnualReportCodeDefinitionV1 = {
  code: string;
  statementSv: AnnualReportStatementNameSvV1;
  sectionSv: string;
  groupSv: string | null;
  subgroupSv: string | null;
  labelSv: string;
  normalSign?: "+" | "-" | "+/-";
  noteSv?: string;
};

// This codebook is the contract between annual-report extraction and the later
// INK2 flow. Statement rows should be aligned to these codes before downstream
// modules consume them.
export const ANNUAL_REPORT_CODES_SV_V1: readonly AnnualReportCodeDefinitionV1[] =
  [
    {
      code: "2.1",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Immateriella anläggningstillgångar",
      labelSv:
        "Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill och liknande rättigheter",
    },
    {
      code: "2.2",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Immateriella anläggningstillgångar",
      labelSv: "Förskott avseende immateriella anläggningstillgångar",
    },
    {
      code: "2.3",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Materiella anläggningstillgångar",
      labelSv: "Byggnader och mark",
    },
    {
      code: "2.4",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Materiella anläggningstillgångar",
      labelSv: "Maskiner, inventarier och övriga materiella anläggningstillgångar",
    },
    {
      code: "2.5",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Materiella anläggningstillgångar",
      labelSv: "Förbättringsutgifter på annans fastighet",
    },
    {
      code: "2.6",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Materiella anläggningstillgångar",
      labelSv:
        "Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar",
    },
    {
      code: "2.7",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv: "Andelar i koncernföretag",
    },
    {
      code: "2.8",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv:
        "Andelar i intresseföretag och gemensamt styrda företag",
    },
    {
      code: "2.9",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv:
        "Ägarintressen i övriga företag och andra långfristiga värdepappersinnehav",
    },
    {
      code: "2.10",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv:
        "Fordringar hos koncern-, intresse- och gemensamt styrda företag",
    },
    {
      code: "2.11",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv: "Lån till delägare eller närstående",
    },
    {
      code: "2.12",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Anläggningstillgångar",
      subgroupSv: "Finansiella anläggningstillgångar",
      labelSv:
        "Fordringar hos övriga företag som det finns ett ägarintresse i och andra långfristiga fordringar",
    },
    {
      code: "2.13",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Råvaror och förnödenheter",
    },
    {
      code: "2.14",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Varor under tillverkning",
    },
    {
      code: "2.15",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Färdiga varor och handelsvaror",
    },
    {
      code: "2.16",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Övriga lagertillgångar",
    },
    {
      code: "2.17",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Pågående arbeten för annans räkning",
    },
    {
      code: "2.18",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Varulager m.m.",
      subgroupSv: null,
      labelSv: "Förskott till leverantörer",
    },
    {
      code: "2.19",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga fordringar",
      subgroupSv: null,
      labelSv: "Kundfordringar",
    },
    {
      code: "2.20",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga fordringar",
      subgroupSv: null,
      labelSv:
        "Fordringar hos koncern-, intresse- och gemensamt styrda företag",
    },
    {
      code: "2.21",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga fordringar",
      subgroupSv: null,
      labelSv:
        "Fordringar hos övriga företag som det finns ett ägarintresse i och övriga fordringar",
    },
    {
      code: "2.22",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga fordringar",
      subgroupSv: null,
      labelSv: "Upparbetad men ej fakturerad intäkt",
    },
    {
      code: "2.23",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga fordringar",
      subgroupSv: null,
      labelSv: "Förutbetalda kostnader och upplupna intäkter",
    },
    {
      code: "2.24",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga placeringar",
      subgroupSv: null,
      labelSv: "Andelar i koncernföretag",
    },
    {
      code: "2.25",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kortfristiga placeringar",
      subgroupSv: null,
      labelSv: "Övriga kortfristiga placeringar",
    },
    {
      code: "2.26",
      statementSv: "Balansräkning",
      sectionSv: "Tillgångar",
      groupSv: "Kassa och bank",
      subgroupSv: null,
      labelSv: "Kassa, bank och redovisningsmedel",
    },
    {
      code: "2.27",
      statementSv: "Balansräkning",
      sectionSv: "Eget kapital",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Bundet eget kapital",
    },
    {
      code: "2.28",
      statementSv: "Balansräkning",
      sectionSv: "Eget kapital",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Fritt eget kapital",
    },
    {
      code: "2.29",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Obeskattade reserver",
      subgroupSv: null,
      labelSv: "Periodiseringsfonder",
    },
    {
      code: "2.30",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Obeskattade reserver",
      subgroupSv: null,
      labelSv: "Ackumulerade överavskrivningar",
    },
    {
      code: "2.31",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Obeskattade reserver",
      subgroupSv: null,
      labelSv: "Övriga obeskattade reserver",
    },
    {
      code: "2.32",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Avsättningar",
      subgroupSv: null,
      labelSv:
        "Avsättningar för pensioner och liknande förpliktelser enligt lag (1967:531) om tryggande av pensionsutfästelse m.m.",
    },
    {
      code: "2.33",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Avsättningar",
      subgroupSv: null,
      labelSv: "Övriga avsättningar för pensioner och liknande förpliktelser",
    },
    {
      code: "2.34",
      statementSv: "Balansräkning",
      sectionSv: "Obeskattade reserver och avsättningar",
      groupSv: "Avsättningar",
      subgroupSv: null,
      labelSv: "Övriga avsättningar",
    },
    {
      code: "2.35",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Långfristiga skulder",
      subgroupSv: null,
      labelSv: "Obligationslån",
    },
    {
      code: "2.36",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Långfristiga skulder",
      subgroupSv: null,
      labelSv: "Checkräkningskredit",
    },
    {
      code: "2.37",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Långfristiga skulder",
      subgroupSv: null,
      labelSv: "Övriga skulder till kreditinstitut",
    },
    {
      code: "2.38",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Långfristiga skulder",
      subgroupSv: null,
      labelSv:
        "Skulder till koncern-, intresse- och gemensamt styrda företag",
    },
    {
      code: "2.39",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Långfristiga skulder",
      subgroupSv: null,
      labelSv:
        "Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder",
    },
    {
      code: "2.40",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Checkräkningskredit",
    },
    {
      code: "2.41",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Övriga skulder till kreditinstitut",
    },
    {
      code: "2.42",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Förskott från kunder",
    },
    {
      code: "2.43",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Pågående arbeten för annans räkning",
    },
    {
      code: "2.44",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Fakturerad men ej upparbetad intäkt",
    },
    {
      code: "2.45",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Leverantörsskulder",
    },
    {
      code: "2.46",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Växelskulder",
    },
    {
      code: "2.47",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv:
        "Skulder till koncern-, intresse- och gemensamt styrda företag",
    },
    {
      code: "2.48",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv:
        "Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder",
    },
    {
      code: "2.49",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Skatteskulder",
    },
    {
      code: "2.50",
      statementSv: "Balansräkning",
      sectionSv: "Skulder",
      groupSv: "Kortfristiga skulder",
      subgroupSv: null,
      labelSv: "Upplupna kostnader och förutbetalda intäkter",
    },
    {
      code: "3.1",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens intäkter",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Nettoomsättning",
      normalSign: "+",
    },
    {
      code: "3.2",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens intäkter",
      groupSv: null,
      subgroupSv: null,
      labelSv:
        "Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning",
      normalSign: "+/-",
    },
    {
      code: "3.3",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens intäkter",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Aktiverat arbete för egen räkning",
      normalSign: "+",
    },
    {
      code: "3.4",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens intäkter",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Övriga rörelseintäkter",
      normalSign: "+",
    },
    {
      code: "3.5",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Råvaror och förnödenheter",
      normalSign: "-",
    },
    {
      code: "3.6",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Handelsvaror",
      normalSign: "-",
    },
    {
      code: "3.7",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Övriga externa kostnader",
      normalSign: "-",
    },
    {
      code: "3.8",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Personalkostnader",
      normalSign: "-",
    },
    {
      code: "3.9",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv:
        "Av- och nedskrivningar av materiella och immateriella anläggningstillgångar",
      normalSign: "-",
    },
    {
      code: "3.10",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv:
        "Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar",
      normalSign: "-",
    },
    {
      code: "3.11",
      statementSv: "Resultaträkning",
      sectionSv: "Rörelsens kostnader",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Övriga rörelsekostnader",
      normalSign: "-",
    },
    {
      code: "3.12",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Resultat från andelar i koncernföretag",
      normalSign: "+/-",
    },
    {
      code: "3.13",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv:
        "Resultat från andelar i intresseföretag och gemensamt styrda företag",
      normalSign: "+/-",
    },
    {
      code: "3.14",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Resultat från övriga företag som det finns ett ägarintresse i",
      normalSign: "+/-",
    },
    {
      code: "3.15",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Resultat från övriga finansiella anläggningstillgångar",
      normalSign: "+/-",
    },
    {
      code: "3.16",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Övriga ränteintäkter och liknande resultatposter",
      normalSign: "+",
    },
    {
      code: "3.17",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv:
        "Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar",
      normalSign: "-",
    },
    {
      code: "3.18",
      statementSv: "Resultaträkning",
      sectionSv: "Finansiella poster",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Räntekostnader och liknande resultatposter",
      normalSign: "-",
    },
    {
      code: "3.19",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Lämnade koncernbidrag",
      normalSign: "-",
    },
    {
      code: "3.20",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Mottagna koncernbidrag",
      normalSign: "+",
    },
    {
      code: "3.21",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Återföring av periodiseringsfond",
      normalSign: "+",
    },
    {
      code: "3.22",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Avsättning till periodiseringsfond",
      normalSign: "-",
    },
    {
      code: "3.23",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Förändring av överavskrivningar",
      normalSign: "+/-",
    },
    {
      code: "3.24",
      statementSv: "Resultaträkning",
      sectionSv: "Bokslutsdispositioner",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Övriga bokslutsdispositioner",
      normalSign: "+/-",
    },
    {
      code: "3.25",
      statementSv: "Resultaträkning",
      sectionSv: "Skatt",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Skatt på årets resultat",
      normalSign: "-",
    },
    {
      code: "3.26",
      statementSv: "Resultaträkning",
      sectionSv: "Årets resultat",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Årets resultat, vinst",
      normalSign: "+",
      noteSv: "Flyttas till p. 4.1",
    },
    {
      code: "3.27",
      statementSv: "Resultaträkning",
      sectionSv: "Årets resultat",
      groupSv: null,
      subgroupSv: null,
      labelSv: "Årets resultat, förlust",
      normalSign: "-",
      noteSv: "Flyttas till p. 4.2",
    },
  ] as const;

const CODE_ORDER_V1 = new Map(
  ANNUAL_REPORT_CODES_SV_V1.map((definition, index) => [
    definition.code,
    index,
  ]),
);

export const ANNUAL_REPORT_CODE_BY_CODE_V1 = new Map(
  ANNUAL_REPORT_CODES_SV_V1.map((definition) => [definition.code, definition]),
);

export function getAnnualReportCodeDefinitionV1(
  code: string,
): AnnualReportCodeDefinitionV1 | undefined {
  return ANNUAL_REPORT_CODE_BY_CODE_V1.get(code);
}

export function getAnnualReportCodeOrderV1(code: string): number {
  return CODE_ORDER_V1.get(code) ?? Number.MAX_SAFE_INTEGER;
}

function parseBalanceCodeNumberV1(code: string): number | null {
  const match = code.match(/^2\.(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export function isAnnualReportBalanceAssetCodeV1(code: string): boolean {
  const numericCode = parseBalanceCodeNumberV1(code);
  return numericCode !== null && numericCode >= 1 && numericCode <= 26;
}

export function isAnnualReportBalanceEquityLiabilityCodeV1(
  code: string,
): boolean {
  const numericCode = parseBalanceCodeNumberV1(code);
  return numericCode !== null && numericCode >= 27 && numericCode <= 50;
}
