import { describe, expect, it } from "vitest";

import {
  normalizeAnnualReportAiDateFieldV1,
  sanitizeAnnualReportTaxDeepV1,
  normalizeAnnualReportTaxDeepV1,
} from "../../../src/server/workflow/workflow-deps.v1";

describe("workflow deps annual-report AI date normalization v1", () => {
  it("normalizes Gemini-style non-ISO dates into ISO", () => {
    const start = normalizeAnnualReportAiDateFieldV1({
      fieldKey: "fiscalYearStart",
      field: {
        status: "extracted",
        confidence: 0.94,
        valueText: "1 januari 2025",
      },
    });
    const end = normalizeAnnualReportAiDateFieldV1({
      fieldKey: "fiscalYearEnd",
      field: {
        status: "extracted",
        confidence: 0.94,
        valueText: "31/12/2025",
      },
    });

    expect(start.field.status).toBe("extracted");
    expect(start.field.value).toBe("2025-01-01");
    expect(end.field.status).toBe("extracted");
    expect(end.field.value).toBe("2025-12-31");
  });

  it("keeps the extraction path alive when one AI date is malformed", () => {
    const result = normalizeAnnualReportAiDateFieldV1({
      fieldKey: "fiscalYearStart",
      field: {
        status: "extracted",
        confidence: 0.91,
        valueText: "32/13/2025",
        snippet: "Räkenskapsår: 32/13/2025",
      },
    });

    expect(result.field.status).toBe("needs_review");
    expect(result.field.value).toBeUndefined();
    expect(result.warning).toContain("requires manual review");
  });

  it("uses the first or last detected date when Gemini returns a range", () => {
    const start = normalizeAnnualReportAiDateFieldV1({
      fieldKey: "fiscalYearStart",
      field: {
        status: "extracted",
        confidence: 0.87,
        valueText: "2025/01/01 - 2025/12/31",
      },
    });
    const end = normalizeAnnualReportAiDateFieldV1({
      fieldKey: "fiscalYearEnd",
      field: {
        status: "extracted",
        confidence: 0.87,
        valueText: "2025/01/01 - 2025/12/31",
      },
    });

    expect(start.field.value).toBe("2025-01-01");
    expect(end.field.value).toBe("2025-12-31");
  });

  it("normalizes statement and tax-expense values from kSEK into SEK", () => {
    const normalized = normalizeAnnualReportTaxDeepV1({
      ink2rExtracted: {
        statementUnit: "ksek",
        incomeStatement: [
          {
            code: "net-turnover",
            label: "Nettoomsättning",
            currentYearValue: 125,
            priorYearValue: 100,
            evidence: [],
          },
        ],
        balanceSheet: [
          {
            code: "inventories",
            label: "Varulager",
            currentYearValue: 18,
            evidence: [],
          },
        ],
      },
      depreciationContext: {
        assetAreas: [
          {
            assetArea: "Machinery",
            acquisitions: 42,
            depreciationForYear: 10,
            evidence: [],
          },
        ],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      reserveContext: {
        movements: [
          {
            reserveType: "Overavskrivningar",
            closingBalance: 8,
            evidence: [],
          },
        ],
        notes: [],
        evidence: [],
      },
      netInterestContext: {
        netInterest: {
          value: -12,
          evidence: [],
        },
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: {
        currentTax: {
          value: 3,
          evidence: [],
        },
        deferredTax: {
          value: 1,
          evidence: [],
        },
        notes: [],
        evidence: [],
      },
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      priorYearComparatives: [],
    });

    expect(normalized.ink2rExtracted.incomeStatement[0]?.currentYearValue).toBe(
      125000,
    );
    expect(normalized.ink2rExtracted.statementUnit).toBe("sek");
    expect(normalized.depreciationContext.assetAreas[0]?.acquisitions).toBe(
      42000,
    );
    expect(normalized.taxExpenseContext?.currentTax?.value).toBe(3000);
    expect(normalized.taxExpenseContext?.deferredTax?.value).toBe(1000);
  });

  it("sanitizes legacy overdrive taxDeep keys before strict extraction parsing", () => {
    const sanitized = sanitizeAnnualReportTaxDeepV1({
      ink2rExtracted: {
        statementUnit: "ksek",
        incomeStatement: [],
        balanceSheet: [],
      },
      depreciationContext: {
        assetAreas: [],
        evidence: [],
        depreciationOnTangibleAndIntangibleAssets: [
          {
            assetArea: "Inventarier",
            depreciationForYear: 12,
            page: 26,
            snippet: "Årets avskrivningar 12",
          },
        ],
      } as never,
      assetMovements: {
        lines: [],
        evidence: [],
        tangibleAssets: [
          {
            assetArea: "Maskiner",
            acquisitions: 30,
          },
        ],
        intangibleAssets: [
          {
            assetArea: "Programvara",
            acquisitions: 5,
          },
        ],
      } as never,
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
        untaxedReserves: [
          {
            reserveType: "Periodiseringsfond",
            closingBalance: 22,
          },
        ],
        appropriations: ["Bokslutsdispositioner redovisas i not 8."],
      } as never,
      netInterestContext: {
        notes: [],
        evidence: [],
        interestIncome: {
          value: 2,
          page: 24,
          snippet: "Ränteintäkter 2",
        },
        interestExpense: {
          value: -9,
          page: 24,
          snippet: "Räntekostnader -9",
        },
        otherFinancialIncome: {
          value: 1,
          page: 24,
          snippet: "Övriga finansiella intäkter 1",
        },
        otherFinancialExpense: {
          value: -3,
          page: 24,
          snippet: "Övriga finansiella kostnader -3",
        },
      } as never,
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
        pensionCosts: ["Pensionskostnader framgår av not 5."],
      } as never,
      taxExpenseContext: {
        notes: [],
        evidence: [],
        totalTaxExpense: {
          value: 14,
          page: 24,
          snippet: "Skatt på årets resultat 14",
        },
        taxReceivables: ["ignored legacy field"],
      } as never,
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
        futureLeasingCommitments: ["Framtida leasingavgifter uppgår till 40."],
      } as never,
      groupContributionContext: {
        flags: [],
        notes: [],
        evidence: [],
        groupContributionsReceived: ["Koncernbidrag mottaget."],
      } as never,
      shareholdingContext: {
        flags: [],
        notes: [],
        evidence: [],
        proposedDividend: ["Föreslagen utdelning 100."],
      } as never,
      priorYearComparatives: [],
    });

    expect(sanitized.depreciationContext.assetAreas[0]?.depreciationForYear).toBe(12);
    expect(sanitized.assetMovements.lines).toHaveLength(2);
    expect(sanitized.reserveContext.movements[0]?.reserveType).toBe("Periodiseringsfond");
    expect(sanitized.reserveContext.notes).toContain("Bokslutsdispositioner redovisas i not 8.");
    expect(sanitized.netInterestContext.interestIncome?.evidence[0]?.page).toBe(24);
    expect(sanitized.netInterestContext.financeIncome?.value).toBe(1);
    expect(sanitized.taxExpenseContext?.totalTaxExpense?.evidence[0]?.snippet).toContain("Skatt");
    expect(sanitized.pensionContext.notes).toContain("Pensionskostnader framgår av not 5.");
    expect(sanitized.leasingContext.notes).toContain("Framtida leasingavgifter uppgår till 40.");
    expect(sanitized.groupContributionContext.notes).toContain("Koncernbidrag mottaget.");
    expect(sanitized.shareholdingContext.notes).toContain("Föreslagen utdelning 100.");
  });
});
