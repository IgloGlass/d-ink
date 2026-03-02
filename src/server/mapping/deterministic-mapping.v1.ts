import type { z } from "zod";

import {
  GenerateMappingDecisionsRequestV1Schema,
  type GenerateMappingDecisionsResultV1,
  type MappingDecisionEvidenceV1,
  type SilverfinTaxCategoryCodeV1,
  type SilverfinTaxCategoryStatementTypeV1,
  getSilverfinTaxCategoryByCodeV1,
  parseGenerateMappingDecisionsResultV1,
} from "../../shared/contracts/mapping.v1";
import type { TrialBalanceNormalizedRowV1 } from "../../shared/contracts/trial-balance.v1";

type DeterministicMappingRuleV1 = {
  ruleId: string;
  categoryCode: SilverfinTaxCategoryCodeV1;
  exactAccountNumbers?: readonly string[];
  accountNumberPrefixes?: readonly string[];
  accountNameKeywords?: readonly string[];
  excludeKeywords?: readonly string[];
  minScoreWithAccountMatch?: number;
  minScoreWithoutAccountMatch?: number;
  priorityBoost?: number;
  requireClosingLowerThanOpening?: boolean;
};

type StatementTypeInferenceV1 = SilverfinTaxCategoryStatementTypeV1 | "unknown";

type RuleEvaluationV1 = {
  score: number;
  requiredScore: number;
  evidence: MappingDecisionEvidenceV1[];
  matchedByAccountNumber: boolean;
  matchedByAccountName: boolean;
  rule: DeterministicMappingRuleV1;
};

const MIN_STRONG_RULE_SCORE_WITH_ACCOUNT_MATCH_V1 = 70;
const MIN_STRONG_RULE_SCORE_NAME_ONLY_V1 = 42;
const KEYWORD_MATCH_WEIGHT_V1 = 20;

const DETERMINISTIC_MAPPING_RULES_V1: readonly DeterministicMappingRuleV1[] = [
  {
    ruleId: "map.bs.non-tax-sensitive.capitalized-expenditure.v1",
    categoryCode: "100000",
    accountNameKeywords: [
      "balanserad utgift",
      "aktiverad utgift",
      "capitalized expenditure",
    ],
    excludeKeywords: [
      "byggnad",
      "byggnader",
      "markanlaggning",
      "markanläggning",
      "leasehold",
      "hyrd lokal",
      "forbattringsutgift",
      "förbättringsutgift",
    ],
    minScoreWithoutAccountMatch: 26,
    priorityBoost: 8,
  },
  {
    ruleId:
      "map.bs.non-tax-sensitive.accumulated-depr-building-land-leasehold.v1",
    categoryCode: "100000",
    accountNumberPrefixes: ["1119", "1159", "1239"],
    accountNameKeywords: [
      "ackumulerad avskrivning byggnad",
      "ack avskrivning byggnad",
      "ackumulerad avskrivning markanlaggning",
      "ackumulerad avskrivning markanläggning",
      "ackumulerad avskrivning leasehold",
      "ackumulerad avskrivning hyrd lokal",
      "accumulated depreciation building",
      "accumulated depreciation land improvement",
    ],
    minScoreWithoutAccountMatch: 26,
    priorityBoost: 10,
  },
  {
    ruleId: "map.bs.non-tax-sensitive.land.v1",
    categoryCode: "100000",
    accountNumberPrefixes: ["113", "114"],
    accountNameKeywords: ["mark", "land", "tomt"],
    excludeKeywords: ["markanlaggning", "markanläggning"],
    minScoreWithoutAccountMatch: 26,
    priorityBoost: 8,
  },
  {
    ruleId: "map.bs.non-tax-sensitive.wip.v1",
    categoryCode: "100000",
    accountNumberPrefixes: ["147", "148"],
    accountNameKeywords: [
      "pagaende projekt",
      "pågående projekt",
      "pagaende arbete",
      "pågående arbete",
      "wip",
      "work in progress",
    ],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 8,
  },
  {
    ruleId: "map.bs.non-tax-sensitive.group-contribution-receivable.v1",
    categoryCode: "100000",
    accountNameKeywords: [
      "koncernbidrag",
      "group contribution",
      "fordran",
      "receivable",
    ],
    minScoreWithoutAccountMatch: 36,
    priorityBoost: 8,
  },
  {
    ruleId: "map.bs.buildings.acquisition.v1",
    categoryCode: "111000",
    accountNumberPrefixes: ["111"],
    accountNameKeywords: ["byggnad", "building", "byggnader"],
  },
  {
    ruleId: "map.bs.land-improvements.acquisition.v1",
    categoryCode: "115000",
    accountNumberPrefixes: ["115"],
    accountNameKeywords: [
      "markanlaggning",
      "land improvement",
      "markanläggning",
    ],
  },
  {
    ruleId: "map.bs.leaseholder-improvements.acquisition.v1",
    categoryCode: "123200",
    accountNumberPrefixes: ["1232"],
    accountNameKeywords: [
      "forbattringsutgift",
      "leasehold",
      "hyrd lokal",
      "leaseholder",
      "förbättringsutgift",
    ],
  },
  {
    ruleId: "map.bs.shares.general.v1",
    categoryCode: "131000",
    accountNumberPrefixes: ["131", "132", "133"],
    accountNameKeywords: ["aktier", "shares", "andelar", "shareholding"],
  },
  {
    ruleId: "map.bs.capital-asset-value-changes.v1",
    categoryCode: "138400",
    accountNumberPrefixes: ["1384"],
    accountNameKeywords: [
      "nedskrivning",
      "uppskrivning",
      "value change",
      "write down",
      "capital asset",
    ],
  },
  {
    ruleId:
      "map.bs.capital-asset-value-changes.intra-group-impairment-signal.v1",
    categoryCode: "138400",
    accountNameKeywords: [
      "koncernintern fordran",
      "koncernfordran",
      "intercompany receivable",
      "intra group receivable",
      "intra-group receivable",
      "nedskrivning",
      "impairment",
    ],
    requireClosingLowerThanOpening: true,
    minScoreWithoutAccountMatch: 26,
    priorityBoost: 8,
  },
  {
    ruleId: "map.bs.endowment-insurance.v1",
    categoryCode: "138500",
    accountNumberPrefixes: ["1385"],
    accountNameKeywords: [
      "kapitalforsakring",
      "endowment",
      "insurance",
      "kapitalförsäkring",
    ],
  },
  {
    ruleId: "map.bs.inventory.acquisition.v1",
    categoryCode: "141000",
    accountNumberPrefixes: ["14"],
    accountNameKeywords: ["lager", "inventory", "varulager"],
    excludeKeywords: ["inkurans", "obsolescence", "reserv"],
  },
  {
    ruleId: "map.bs.inventory.obsolescence-reserve.v1",
    categoryCode: "141900",
    accountNumberPrefixes: ["1419", "149"],
    accountNameKeywords: ["inkurans", "obsolescence", "lagerreserv", "reserve"],
  },
  {
    ruleId: "map.bs.doubtful-debts.v1",
    categoryCode: "151500",
    accountNumberPrefixes: ["1515", "1518", "1519"],
    accountNameKeywords: [
      "osakra kundfordringar",
      "doubtful debt",
      "bad debt",
      "osäkra kundfordringar",
      "tvistiga kundfordringar",
      "dubious receivables",
      "kundfordringar omvardering",
      "kundfordringar omvärdering",
    ],
    minScoreWithoutAccountMatch: 28,
  },
  {
    ruleId: "map.bs.tax-allocation-reserve.v1",
    categoryCode: "211000",
    accountNumberPrefixes: ["211"],
    accountNameKeywords: ["periodiseringsfond", "tax allocation reserve"],
  },
  {
    ruleId: "map.bs.accelerated-depreciation.v1",
    categoryCode: "215000",
    accountNumberPrefixes: ["215"],
    accountNameKeywords: [
      "overavskrivning",
      "accelerated depreciation",
      "överavskrivning",
    ],
  },
  {
    ruleId: "map.bs.yield-tax-basis.v1",
    categoryCode: "221000",
    accountNumberPrefixes: ["221"],
    accountNameKeywords: ["avkastningsskatt", "yield tax"],
  },
  {
    ruleId: "map.bs.warranty-provision.v1",
    categoryCode: "222000",
    accountNumberPrefixes: ["222"],
    accountNameKeywords: ["garanti", "warranty", "avsattning", "avsättning"],
  },
  {
    ruleId: "map.bs.other-provisions.v1",
    categoryCode: "229000",
    accountNumberPrefixes: ["229"],
    accountNameKeywords: [
      "avsattning",
      "avsättning",
      "provision",
      "reservering",
      "reservation",
      "upplupen",
      "accrued",
    ],
    excludeKeywords: [
      "garanti",
      "warranty",
      "koncernbidrag",
      "group contribution",
      "fastighetsskatt",
      "fastighetsavgift",
      "property tax",
      "sarskild loneskatt",
      "special payroll tax",
      "avkastningsskatt",
      "yield tax",
    ],
    minScoreWithoutAccountMatch: 28,
  },
  {
    ruleId: "map.bs.property-tax-fee.v1",
    categoryCode: "251300",
    exactAccountNumbers: ["2513"],
    accountNumberPrefixes: ["2513"],
    accountNameKeywords: [
      "fastighetsskatt",
      "fastighetsavgift",
      "property tax",
      "upplupen",
      "accrued",
    ],
    minScoreWithoutAccountMatch: 30,
  },
  {
    ruleId: "map.bs.accrued-special-payroll-tax-pension.v1",
    categoryCode: "294300",
    accountNumberPrefixes: ["2943"],
    accountNameKeywords: [
      "sarskild loneskatt",
      "special payroll tax",
      "pension",
      "upplupen",
      "accrued",
      "reservering",
      "avsattning",
      "avsättning",
      "innevarande ar",
      "innevarande år",
    ],
    minScoreWithoutAccountMatch: 46,
  },
  {
    ruleId: "map.bs.accrued-yield-tax-pension.v1",
    categoryCode: "294400",
    accountNumberPrefixes: ["2944"],
    accountNameKeywords: ["avkastningsskatt", "yield tax", "pension"],
  },
  {
    ruleId: "map.bs.tangible-intangible-opening-closing.v1",
    categoryCode: "102000",
    accountNumberPrefixes: ["10", "11", "12"],
    accountNameKeywords: [
      "anlaggningstillgang",
      "immateriell",
      "materiell",
      "fixed asset",
      "anläggningstillgång",
      "ackumulerad avskrivning",
      "accumulated depreciation",
    ],
    excludeKeywords: [
      "byggnad",
      "byggnader",
      "markanlaggning",
      "markanläggning",
      "leasehold",
      "hyrd lokal",
      "forbattringsutgift",
      "förbättringsutgift",
    ],
    minScoreWithoutAccountMatch: 28,
  },
  {
    ruleId: "map.is.financial-inventory.capital-gain-loss.v1",
    categoryCode: "367000",
    accountNumberPrefixes: ["3670", "3671"],
    accountNameKeywords: [
      "financial inventory",
      "capital gain",
      "capital loss",
    ],
  },
  {
    ruleId: "map.is.financial-inventory.dividend.v1",
    categoryCode: "367200",
    accountNumberPrefixes: ["3672"],
    accountNameKeywords: ["utdelning", "dividend", "financial inventory"],
  },
  {
    ruleId: "map.is.capital-assets.value-change-write-down.v1",
    categoryCode: "394000",
    accountNumberPrefixes: ["394"],
    accountNameKeywords: [
      "nedskrivning",
      "uppskrivning",
      "value change",
      "write down",
      "capital asset",
    ],
  },
  {
    ruleId: "map.is.tangible-intangible.depreciation.v1",
    categoryCode: "397000",
    accountNumberPrefixes: ["781", "783", "785", "786", "787", "788"],
    accountNameKeywords: ["avskrivning", "depreciation", "anlaggningstillgang"],
    excludeKeywords: [
      "byggnad",
      "markanlaggning",
      "leasehold",
      "hyrd lokal",
      "byggnader",
    ],
  },
  {
    ruleId: "map.is.buildings-land.capital-gain.v1",
    categoryCode: "397200",
    accountNumberPrefixes: ["3972"],
    accountNameKeywords: [
      "reavinst",
      "capital gain",
      "byggnad",
      "fastighet",
      "mark",
    ],
  },
  {
    ruleId: "map.is.buildings-land.capital-loss.v1",
    categoryCode: "797200",
    accountNumberPrefixes: ["7972"],
    accountNameKeywords: [
      "reaforlust",
      "capital loss",
      "byggnad",
      "fastighet",
      "mark",
      "reaförlust",
    ],
  },
  {
    ruleId: "map.is.gifts-donations.non-taxable.v1",
    categoryCode: "399300",
    accountNumberPrefixes: ["3993"],
    accountNameKeywords: ["gava", "donation", "non taxable", "gåva"],
  },
  {
    ruleId: "map.is.composition-agreement.non-taxable.v1",
    categoryCode: "399500",
    accountNumberPrefixes: ["3995"],
    accountNameKeywords: ["ackord", "composition agreement", "ackordsvinst"],
  },
  {
    ruleId: "map.is.property-tax-fee.v1",
    categoryCode: "519100",
    accountNumberPrefixes: ["5191"],
    accountNameKeywords: [
      "fastighetsskatt",
      "fastighetsavgift",
      "property tax",
    ],
  },
  {
    ruleId: "map.is.non-tax-sensitive.cogs.v1",
    categoryCode: "950000",
    accountNameKeywords: [
      "cogs",
      "cost of goods sold",
      "kostnad salda varor",
      "kostnad sålda varor",
      "forsaljningskostnad avskrivning",
      "försäljningskostnad avskrivning",
      "kostn avskrivn kostnad salda varor",
      "kostn avskrivn kostnad sålda varor",
    ],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 10,
  },
  {
    ruleId: "map.is.non-tax-sensitive.building-maintenance.v1",
    categoryCode: "950000",
    accountNameKeywords: [
      "underhall byggnad",
      "underhåll byggnad",
      "building maintenance",
      "reparation byggnad",
      "repair building",
      "fastighetsskotsel",
      "fastighetsskötsel",
    ],
    excludeKeywords: ["avskrivning", "depreciation"],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 10,
  },
  {
    ruleId: "map.is.non-tax-sensitive.it-consulting.v1",
    categoryCode: "950000",
    accountNumberPrefixes: ["654", "655"],
    accountNameKeywords: [
      "it konsult",
      "it consulting",
      "it support",
      "software consulting",
      "systemutveckling",
      "hosting",
      "drift",
      "implementation",
    ],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 10,
  },
  {
    ruleId: "map.is.non-tax-sensitive.social-contributions.v1",
    categoryCode: "950000",
    accountNameKeywords: [
      "arbetsgivaravgift",
      "arbetsgivaravgifter",
      "sociala avgifter",
      "social contributions",
      "social fees",
    ],
    excludeKeywords: ["sarskild loneskatt", "special payroll tax"],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 10,
  },
  {
    ruleId: "map.is.non-tax-sensitive.salary-generic.v1",
    categoryCode: "950000",
    accountNameKeywords: ["lon", "lön", "salary", "wages", "personalkostnad"],
    excludeKeywords: [
      "pension",
      "pensionskostnad",
      "sarskild loneskatt",
      "special payroll tax",
    ],
    minScoreWithoutAccountMatch: 34,
    priorityBoost: 6,
  },
  {
    ruleId: "map.is.non-tax-sensitive.staff-catering-events.v1",
    categoryCode: "950000",
    accountNameKeywords: [
      "personalfest",
      "staff catering",
      "personalmaltid",
      "personalmåltid",
      "employee meal",
      "kickoff",
      "julbord",
    ],
    excludeKeywords: ["representation"],
    minScoreWithoutAccountMatch: 24,
    priorityBoost: 10,
  },
  {
    ruleId: "map.is.interest.financial-leasing-income.v1",
    categoryCode: "521200",
    accountNumberPrefixes: ["5212"],
    accountNameKeywords: [
      "financial leasing",
      "leasing",
      "ranteintakt",
      "ränteintäkt",
    ],
  },
  {
    ruleId: "map.is.interest.financial-leasing-cost.v1",
    categoryCode: "522200",
    accountNumberPrefixes: ["5222"],
    accountNameKeywords: [
      "financial leasing",
      "leasing",
      "rantekostnad",
      "räntekostnad",
    ],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.sponsorship-gifts.deductible.v1",
    categoryCode: "598000",
    accountNumberPrefixes: ["598"],
    accountNameKeywords: [
      "sponsring",
      "sponsorship",
      "donation",
      "avdragsgill",
      "julgava",
      "julgåva",
      "personalgava",
      "personalgåva",
      "julklapp",
      "personal",
      "staff",
      "employee",
      "blommor",
      "flowers",
    ],
    excludeKeywords: ["ej avdragsgill", "icke avdragsgill", "non deductible"],
    minScoreWithoutAccountMatch: 40,
  },
  {
    ruleId: "map.is.entertainment.deductible.v1",
    categoryCode: "607100",
    accountNumberPrefixes: ["6071"],
    accountNameKeywords: [
      "representation",
      "internal",
      "external",
      "intern",
      "extern",
      "avdragsgill",
    ],
    excludeKeywords: ["ej avdragsgill", "icke avdragsgill", "non deductible"],
    minScoreWithoutAccountMatch: 46,
  },
  {
    ruleId: "map.is.entertainment.non-deductible.v1",
    categoryCode: "607200",
    accountNumberPrefixes: ["6072", "607"],
    accountNameKeywords: [
      "representation",
      "internal",
      "external",
      "intern",
      "extern",
      "delvis avdragsgill",
      "partially deductible",
      "partiellt avdragsgill",
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
    ],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.sanctions-penalties.v1",
    categoryCode: "634200",
    accountNumberPrefixes: ["6342", "6992"],
    accountNameKeywords: ["boter", "vite", "sanction", "penalty", "böter"],
  },
  {
    ruleId: "map.is.warranty.change-provision.v1",
    categoryCode: "636100",
    accountNumberPrefixes: ["6361"],
    accountNameKeywords: ["garanti", "warranty", "avsattning", "change"],
  },
  {
    ruleId: "map.is.warranty.actual-costs.v1",
    categoryCode: "636200",
    accountNumberPrefixes: ["6362"],
    accountNameKeywords: ["garanti", "warranty", "kostnad", "actual cost"],
  },
  {
    ruleId: "map.is.consulting-fees.v1",
    categoryCode: "655000",
    accountNumberPrefixes: ["655", "654"],
    accountNameKeywords: [
      "konsult",
      "consulting",
      "advisory",
      "legal",
      "tax assistance",
      "tax return",
      "deklaration",
      "ink2",
      "skatteradgivning",
      "skatterådgivning",
    ],
    excludeKeywords: [
      "it ",
      "it-",
      "system",
      "software",
      "hosting",
      "support",
      "implementation",
      "drift",
    ],
    minScoreWithoutAccountMatch: 28,
  },
  {
    ruleId: "map.is.interest.banking-costs.v1",
    categoryCode: "657000",
    accountNumberPrefixes: ["657"],
    accountNameKeywords: ["bankkostnad", "banking cost", "bankavgift"],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.other-non-deductible-costs.v1",
    categoryCode: "690000",
    accountNumberPrefixes: ["690", "6990", "6999"],
    accountNameKeywords: [
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
    ],
  },
  {
    ruleId: "map.is.membership-fees.deductible.v1",
    categoryCode: "698100",
    accountNumberPrefixes: ["6981"],
    accountNameKeywords: [
      "medlemsavgift",
      "membership fee",
      "avdragsgill",
      "konflikt",
      "arbetsgivarorganisation",
      "employers association",
      "conflict purpose",
    ],
    excludeKeywords: ["ej avdragsgill", "icke avdragsgill", "non deductible"],
    minScoreWithoutAccountMatch: 40,
  },
  {
    ruleId: "map.is.membership-fees.non-deductible.v1",
    categoryCode: "698200",
    accountNumberPrefixes: ["6982"],
    accountNameKeywords: [
      "medlemsavgift",
      "membership fee",
      "medlemskap",
      "membership",
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
    ],
    excludeKeywords: [
      "konflikt",
      "arbetsgivarorganisation",
      "employers association",
      "conflict purpose",
    ],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.sponsorship-gifts.non-deductible.v1",
    categoryCode: "699300",
    accountNumberPrefixes: ["6993"],
    accountNameKeywords: [
      "sponsring",
      "sponsorship",
      "donation",
      "gava",
      "gåva",
      "gift",
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
    ],
    excludeKeywords: ["julgava", "julgåva", "personalgava", "personalgåva"],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.pension-costs-basis.v1",
    categoryCode: "740000",
    accountNumberPrefixes: ["740", "741", "742", "743", "744"],
    accountNameKeywords: ["pension", "pensionskostnad"],
    excludeKeywords: [
      "arbetsgivaravgift",
      "sociala avgifter",
      "social contributions",
      "social fees",
    ],
    minScoreWithoutAccountMatch: 30,
  },
  {
    ruleId: "map.is.special-payroll-tax-pension.v1",
    categoryCode: "753000",
    accountNumberPrefixes: ["753"],
    accountNameKeywords: [
      "sarskild loneskatt",
      "special payroll tax",
      "pension",
    ],
    minScoreWithoutAccountMatch: 30,
  },
  {
    ruleId: "map.is.health-care.deductible.v1",
    categoryCode: "762200",
    accountNumberPrefixes: ["7622"],
    accountNameKeywords: ["sjukvard", "health care", "avdragsgill", "sjukvård"],
    excludeKeywords: ["ej avdragsgill", "icke avdragsgill", "non deductible"],
  },
  {
    ruleId: "map.is.health-care.non-deductible.v1",
    categoryCode: "762300",
    accountNumberPrefixes: ["7623"],
    accountNameKeywords: [
      "sjukvard",
      "health care",
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
      "sjukvård",
    ],
  },
  {
    ruleId: "map.is.buildings.booked-depreciation.v1",
    categoryCode: "777000",
    accountNumberPrefixes: ["777"],
    accountNameKeywords: ["byggnad", "building", "avskrivning", "depreciation"],
  },
  {
    ruleId: "map.is.land-improvement.booked-depreciation.v1",
    categoryCode: "782400",
    accountNumberPrefixes: ["7824"],
    accountNameKeywords: [
      "markanlaggning",
      "land improvement",
      "avskrivning",
      "markanläggning",
    ],
  },
  {
    ruleId: "map.is.leaseholder-improvements.booked-depreciation.v1",
    categoryCode: "784000",
    accountNumberPrefixes: ["7840"],
    accountNameKeywords: [
      "forbattringsutgift",
      "hyrd lokal",
      "leasehold",
      "avskrivning",
      "förbättringsutgift",
    ],
  },
  {
    ruleId: "map.is.capital-assets-shares.dividend.v1",
    categoryCode: "801000",
    accountNumberPrefixes: ["801"],
    accountNameKeywords: ["aktieutdelning", "dividend", "shares"],
  },
  {
    ruleId: "map.is.capital-assets-shares.capital-gain-loss.v1",
    categoryCode: "802000",
    accountNumberPrefixes: ["802"],
    accountNameKeywords: [
      "aktier",
      "shares",
      "capital gain",
      "capital loss",
      "reavinst",
      "reaforlust",
    ],
  },
  {
    ruleId: "map.is.capital-assets-shares.unrealized-value-change.v1",
    categoryCode: "808000",
    accountNumberPrefixes: ["808"],
    accountNameKeywords: [
      "orealiserad",
      "unrealized",
      "value change",
      "aktier",
    ],
  },
  {
    ruleId: "map.is.interest.income-tax-account.v1",
    categoryCode: "831400",
    accountNumberPrefixes: ["8314"],
    accountNameKeywords: [
      "skattekonto",
      "interest income",
      "ranteintakt",
      "ränteintäkt",
      "tax exempt",
      "skattefri",
    ],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.interest.income.v1",
    categoryCode: "831000",
    accountNumberPrefixes: ["831"],
    accountNameKeywords: ["ranteintakt", "interest income", "ränteintäkt"],
    excludeKeywords: ["skattekonto"],
  },
  {
    ruleId: "map.is.interest.cost-tax-account.v1",
    categoryCode: "842300",
    accountNumberPrefixes: ["8423"],
    accountNameKeywords: [
      "skattekonto",
      "rantekostnad",
      "interest cost",
      "räntekostnad",
      "ej avdragsgill",
      "icke avdragsgill",
      "non deductible",
    ],
    minScoreWithoutAccountMatch: 26,
  },
  {
    ruleId: "map.is.interest.fx-gain.v1",
    categoryCode: "843100",
    accountNumberPrefixes: ["8431"],
    accountNameKeywords: ["valutakursvinst", "fx gain", "exchange gain"],
    minScoreWithoutAccountMatch: 24,
  },
  {
    ruleId: "map.is.interest.fx-loss.v1",
    categoryCode: "843600",
    accountNumberPrefixes: ["8436"],
    accountNameKeywords: [
      "valutakursforlust",
      "fx loss",
      "exchange loss",
      "valutakursförlust",
    ],
    minScoreWithoutAccountMatch: 24,
  },
  {
    ruleId: "map.is.interest.cost.v1",
    categoryCode: "849000",
    accountNumberPrefixes: ["84", "849"],
    accountNameKeywords: ["rantekostnad", "interest cost", "räntekostnad"],
    excludeKeywords: [
      "skattekonto",
      "valuta",
      "fx",
      "leasing",
      "bankkostnad",
      "bankavgift",
    ],
  },
  {
    ruleId: "map.is.tax-allocation-reserve.allocation.v1",
    categoryCode: "881100",
    accountNumberPrefixes: ["8811"],
    accountNameKeywords: ["periodiseringsfond", "allocation", "avsattning"],
  },
  {
    ruleId: "map.is.tax-allocation-reserve.reversal.v1",
    categoryCode: "881900",
    accountNumberPrefixes: ["8819"],
    accountNameKeywords: [
      "periodiseringsfond",
      "reversal",
      "aterforing",
      "återföring",
    ],
  },
  {
    ruleId: "map.is.tax-allocation-reserve.year-change.v1",
    categoryCode: "881000",
    accountNumberPrefixes: ["881"],
    accountNameKeywords: [
      "periodiseringsfond",
      "forandring",
      "change",
      "förändring",
    ],
  },
  {
    ruleId: "map.is.group-contribution.received.v1",
    categoryCode: "882000",
    accountNumberPrefixes: ["882"],
    accountNameKeywords: [
      "koncernbidrag",
      "group contribution",
      "received",
      "mottaget",
    ],
  },
  {
    ruleId: "map.is.group-contribution.provided.v1",
    categoryCode: "883000",
    accountNumberPrefixes: ["883"],
    accountNameKeywords: [
      "koncernbidrag",
      "group contribution",
      "provided",
      "lamnat",
      "lämnat",
    ],
  },
  {
    ruleId: "map.is.accelerated-depreciation.v1",
    categoryCode: "885000",
    accountNumberPrefixes: ["885"],
    accountNameKeywords: [
      "overavskrivning",
      "accelerated depreciation",
      "överavskrivning",
    ],
  },
  {
    ruleId: "map.is.tax-cost.v1",
    categoryCode: "891000",
    accountNumberPrefixes: ["891"],
    accountNameKeywords: ["skatt", "tax cost", "tax expense"],
  },
  {
    ruleId: "map.is.result-of-year.v1",
    categoryCode: "940000",
    accountNumberPrefixes: ["8999", "8990", "9400"],
    accountNameKeywords: [
      "arets resultat",
      "result of the year",
      "årets resultat",
    ],
  },
];

function buildErrorContextFromZod(error: z.ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}

function isRuleEvaluationV1(
  value: RuleEvaluationV1 | null,
): value is RuleEvaluationV1 {
  return value !== null;
}

function normalizeTextForMatchingV1(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAccountNumberForMatchingV1(
  row: TrialBalanceNormalizedRowV1,
): string {
  const primary =
    row.sourceAccountNumber.trim().length > 0
      ? row.sourceAccountNumber
      : row.accountNumber;
  const trimmedPrimary = primary.trim();
  const leadingDigits = trimmedPrimary.match(/^\d+/)?.[0] ?? "";
  if (leadingDigits.length > 0) {
    return leadingDigits;
  }

  return trimmedPrimary.replace(/[^0-9]/g, "");
}

function inferStatementTypeFromAccountNumberV1(
  normalizedAccountNumber: string,
): StatementTypeInferenceV1 {
  if (normalizedAccountNumber.length === 0) {
    return "unknown";
  }

  const firstDigit = normalizedAccountNumber[0];
  if (firstDigit === "1" || firstDigit === "2") {
    return "balance_sheet";
  }

  if (/[3-9]/.test(firstDigit)) {
    return "income_statement";
  }

  return "unknown";
}

function getFallbackCategoryCodeV1(
  inferredStatementType: StatementTypeInferenceV1,
): SilverfinTaxCategoryCodeV1 {
  if (inferredStatementType === "balance_sheet") {
    return "100000";
  }

  return "950000";
}

function evaluateRuleForRowV1(input: {
  row: TrialBalanceNormalizedRowV1;
  normalizedAccountNumber: string;
  normalizedAccountName: string;
  inferredStatementType: StatementTypeInferenceV1;
  rule: DeterministicMappingRuleV1;
}): RuleEvaluationV1 | null {
  if (
    input.rule.requireClosingLowerThanOpening &&
    !(input.row.closingBalance < input.row.openingBalance)
  ) {
    return null;
  }

  const evidence: MappingDecisionEvidenceV1[] = [];
  let score = 0;
  let matchedByAccountNumber = false;
  let matchedByAccountName = false;

  const exactAccountMatch = input.rule.exactAccountNumbers?.find(
    (account) => account === input.normalizedAccountNumber,
  );
  if (exactAccountMatch) {
    score += 130;
    matchedByAccountNumber = true;
    evidence.push({
      type: "account_number_exact",
      reference: input.rule.ruleId,
      snippet: `Exact BAS account match ${exactAccountMatch}`,
      matchedValue: exactAccountMatch,
      weight: 130,
    });
  }

  const matchingPrefix = (input.rule.accountNumberPrefixes ?? [])
    .filter((prefix) => input.normalizedAccountNumber.startsWith(prefix))
    .sort((left, right) => right.length - left.length)[0];
  if (matchingPrefix) {
    const prefixWeight = 55 + matchingPrefix.length * 10;
    score += prefixWeight;
    matchedByAccountNumber = true;
    evidence.push({
      type: "account_number_prefix",
      reference: input.rule.ruleId,
      snippet: `BAS account prefix ${matchingPrefix}`,
      matchedValue: matchingPrefix,
      weight: prefixWeight,
    });
  }

  const normalizedRuleKeywords = Array.from(
    new Set(
      (input.rule.accountNameKeywords ?? [])
        .map((keyword) => normalizeTextForMatchingV1(keyword))
        .filter((keyword) => keyword.length > 0),
    ),
  );
  const matchedKeywords = normalizedRuleKeywords.filter((keyword) =>
    input.normalizedAccountName.includes(keyword),
  );
  if (matchedKeywords.length > 0) {
    matchedByAccountName = true;
    for (const keyword of matchedKeywords) {
      score += KEYWORD_MATCH_WEIGHT_V1;
      evidence.push({
        type: "account_name_keyword",
        reference: input.rule.ruleId,
        snippet: `Account-name keyword "${keyword}"`,
        matchedValue: keyword,
        weight: KEYWORD_MATCH_WEIGHT_V1,
      });
    }
  }

  const normalizedExcludeKeywords = Array.from(
    new Set(
      (input.rule.excludeKeywords ?? [])
        .map((keyword) => normalizeTextForMatchingV1(keyword))
        .filter((keyword) => keyword.length > 0),
    ),
  );
  const excludedKeywordMatches = normalizedExcludeKeywords.filter((keyword) =>
    input.normalizedAccountName.includes(keyword),
  );
  if (excludedKeywordMatches.length > 0) {
    score -= excludedKeywordMatches.length * 18;
  }

  if (!matchedByAccountNumber && !matchedByAccountName) {
    return null;
  }

  const category = getSilverfinTaxCategoryByCodeV1(input.rule.categoryCode);
  if (input.inferredStatementType !== "unknown") {
    const statementWeight =
      category.statementType === input.inferredStatementType ? 8 : -8;
    score += statementWeight;
    evidence.push({
      type: "statement_type_inference",
      reference: input.rule.ruleId,
      snippet:
        category.statementType === input.inferredStatementType
          ? `Statement type ${input.inferredStatementType} aligns with category`
          : `Statement type ${input.inferredStatementType} conflicts with category`,
      matchedValue: input.inferredStatementType,
      weight: statementWeight,
    });
  }

  if (score <= 0) {
    return null;
  }

  if (input.rule.requireClosingLowerThanOpening) {
    score += 12;
    evidence.push({
      type: "tb_row",
      reference: input.rule.ruleId,
      snippet: "Closing balance is lower than opening balance.",
      weight: 12,
    });
  }

  if (input.rule.priorityBoost) {
    score += input.rule.priorityBoost;
  }

  const requiredScore = matchedByAccountNumber
    ? (input.rule.minScoreWithAccountMatch ??
      MIN_STRONG_RULE_SCORE_WITH_ACCOUNT_MATCH_V1)
    : (input.rule.minScoreWithoutAccountMatch ??
      MIN_STRONG_RULE_SCORE_NAME_ONLY_V1);

  return {
    score,
    requiredScore,
    evidence,
    matchedByAccountNumber,
    matchedByAccountName,
    rule: input.rule,
  };
}

function clamp01V1(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeConfidenceV1(input: {
  topScore: number;
  secondScore: number | null;
  usedFallback: boolean;
}): number {
  if (input.usedFallback) {
    return 0.4;
  }

  const scoreComponent = Math.min(0.55, input.topScore / 220);
  const margin =
    input.secondScore === null
      ? input.topScore
      : input.topScore - input.secondScore;
  const marginComponent = Math.max(0, Math.min(0.25, margin / 100));
  return clamp01V1(0.25 + scoreComponent + marginComponent);
}

/**
 * Deterministically maps normalized trial-balance rows to Silverfin tax categories.
 *
 * Safety boundary:
 * - This mapping must remain deterministic and AI-free.
 * - Reconciliation must be green before mapping can proceed.
 */
export function generateDeterministicMappingDecisionsV1(
  input: unknown,
): GenerateMappingDecisionsResultV1 {
  const parsedRequest =
    GenerateMappingDecisionsRequestV1Schema.safeParse(input);
  if (!parsedRequest.success) {
    return parseGenerateMappingDecisionsResultV1({
      ok: false,
      error: {
        code: "INPUT_INVALID",
        message: "Mapping request payload is invalid.",
        user_message: "The mapping request is invalid. Refresh and retry.",
        context: buildErrorContextFromZod(parsedRequest.error),
      },
    });
  }

  const request = parsedRequest.data;
  if (!request.reconciliation.canProceedToMapping) {
    return parseGenerateMappingDecisionsResultV1({
      ok: false,
      error: {
        code: "RECONCILIATION_BLOCKED",
        message:
          "Deterministic mapping is blocked because reconciliation did not pass.",
        user_message:
          "Reconciliation failed. Resolve blocking issues before mapping.",
        context: {
          reconciliationStatus: request.reconciliation.status,
          blockingReasonCodes: request.reconciliation.blockingReasonCodes,
          summary: request.reconciliation.summary,
        },
      },
    });
  }

  const decisions = request.trialBalance.rows.map((row) => {
    const normalizedAccountNumber = normalizeAccountNumberForMatchingV1(row);
    const normalizedAccountName = normalizeTextForMatchingV1(row.accountName);
    const inferredStatementType = inferStatementTypeFromAccountNumberV1(
      normalizedAccountNumber,
    );

    const evaluations = DETERMINISTIC_MAPPING_RULES_V1.map((rule) =>
      evaluateRuleForRowV1({
        row,
        normalizedAccountNumber,
        normalizedAccountName,
        inferredStatementType,
        rule,
      }),
    )
      .filter(isRuleEvaluationV1)
      .sort((left, right) => right.score - left.score);

    const passingEvaluations = evaluations.filter(
      (evaluation) => evaluation.score >= evaluation.requiredScore,
    );
    const selectedEvaluation = passingEvaluations[0] ?? null;
    const secondScore = passingEvaluations[1]?.score ?? null;

    const shouldUseFallback = selectedEvaluation === null;
    const chosenCategoryCode = shouldUseFallback
      ? getFallbackCategoryCodeV1(inferredStatementType)
      : selectedEvaluation.rule.categoryCode;
    const chosenCategory = getSilverfinTaxCategoryByCodeV1(chosenCategoryCode);
    const confidence = computeConfidenceV1({
      topScore: selectedEvaluation?.score ?? 0,
      secondScore,
      usedFallback: shouldUseFallback,
    });
    const reviewFlag =
      shouldUseFallback ||
      confidence < 0.72 ||
      (selectedEvaluation !== null &&
        secondScore !== null &&
        selectedEvaluation.score - secondScore < 12) ||
      selectedEvaluation?.rule.requireClosingLowerThanOpening === true;

    const evidence: MappingDecisionEvidenceV1[] = [
      {
        type: "tb_row",
        reference: `${row.source.sheetName}:${row.source.rowNumber}`,
        snippet: `${row.sourceAccountNumber} ${row.accountName}`,
        source: row.source,
      },
    ];
    if (selectedEvaluation) {
      evidence.push(...selectedEvaluation.evidence);
    }
    if (shouldUseFallback) {
      evidence.push({
        type: "fallback_category",
        reference: `map.fallback.${chosenCategoryCode}.v1`,
        snippet: `Fallback to ${chosenCategory.name}`,
        matchedValue: chosenCategory.code,
      });
    }

    return {
      id: `${row.source.sheetName}:${row.source.rowNumber}:${row.sourceAccountNumber}`,
      accountNumber: row.accountNumber,
      sourceAccountNumber: row.sourceAccountNumber,
      accountName: row.accountName,
      proposedCategory: chosenCategory,
      selectedCategory: chosenCategory,
      confidence,
      evidence,
      policyRuleReference: shouldUseFallback
        ? `map.fallback.${chosenCategoryCode}.v1`
        : selectedEvaluation.rule.ruleId,
      reviewFlag,
      status: "proposed" as const,
      source: "deterministic" as const,
      __meta: {
        fallback: shouldUseFallback,
        matchedByAccountNumber:
          selectedEvaluation?.matchedByAccountNumber ?? false,
        matchedByAccountName: selectedEvaluation?.matchedByAccountName ?? false,
      },
    };
  });

  const fallbackDecisions = decisions.filter(
    (decision) => decision.__meta.fallback,
  );
  const matchedByAccountNumber = decisions.filter(
    (decision) => decision.__meta.matchedByAccountNumber,
  ).length;
  const matchedByAccountName = decisions.filter(
    (decision) => decision.__meta.matchedByAccountName,
  ).length;

  return parseGenerateMappingDecisionsResultV1({
    ok: true,
    mapping: {
      schemaVersion: "mapping_decisions_v1",
      policyVersion: request.policyVersion,
      summary: {
        totalRows: decisions.length,
        deterministicDecisions: decisions.length,
        manualReviewRequired: decisions.filter(
          (decision) => decision.reviewFlag,
        ).length,
        fallbackDecisions: fallbackDecisions.length,
        matchedByAccountNumber,
        matchedByAccountName,
        unmatchedRows: fallbackDecisions.length,
      },
      decisions: decisions.map(({ __meta, ...decision }) => decision),
    },
  });
}
