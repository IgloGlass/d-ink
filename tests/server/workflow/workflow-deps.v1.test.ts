import { describe, expect, it } from "vitest";

import {
  alignAnnualReportStatementsToInk2CodesV1,
  buildDeterministicAnnualReportTaxAnalysisFallbackV1,
  hydrateAnnualReportStatementEvidenceFromPageTextV1,
  normalizeAnnualReportNumericFieldValueV1,
  normalizeAnnualReportOrganizationNumberV1,
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

  it("normalizes organization numbers to a plain hyphen format", () => {
    expect(normalizeAnnualReportOrganizationNumberV1("556271–5309")).toBe(
      "556271-5309",
    );
    expect(normalizeAnnualReportOrganizationNumberV1("556271-5309")).toBe(
      "556271-5309",
    );
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

  it("normalizes field-level profit before tax using the pre-normalized statement unit", () => {
    expect(normalizeAnnualReportNumericFieldValueV1(545286, "ksek")).toBe(
      545286000,
    );
    expect(normalizeAnnualReportNumericFieldValueV1(545286, "sek")).toBe(
      545286,
    );
    expect(normalizeAnnualReportNumericFieldValueV1(undefined, "ksek")).toBe(
      undefined,
    );
  });

  it("recovers missing statement amounts from evidence snippets before SEK normalization", () => {
    const normalized = normalizeAnnualReportTaxDeepV1({
      ink2rExtracted: {
        statementUnit: "ksek",
        incomeStatement: [
          {
            code: "profit_before_tax",
            label: "Resultat före skatt",
            evidence: [
              {
                snippet: "Resultat före skatt 545 286 771 473",
                page: 15,
              },
            ],
          },
        ],
        balanceSheet: [
          {
            code: "cash",
            label: "Kassa och bank",
            evidence: [
              {
                snippet: "Kassa och bank 301 521 287 144",
                page: 16,
              },
            ],
          },
        ],
      },
      depreciationContext: { assetAreas: [], evidence: [] },
      assetMovements: { lines: [], evidence: [] },
      reserveContext: { movements: [], notes: [], evidence: [] },
      netInterestContext: { notes: [], evidence: [] },
      pensionContext: { flags: [], notes: [], evidence: [] },
      taxExpenseContext: { notes: [], evidence: [] },
      leasingContext: { flags: [], notes: [], evidence: [] },
      groupContributionContext: { flags: [], notes: [], evidence: [] },
      shareholdingContext: { flags: [], notes: [], evidence: [] },
      priorYearComparatives: [],
    });

    expect(normalized.ink2rExtracted.incomeStatement[0]?.currentYearValue).toBe(
      545286000,
    );
    expect(normalized.ink2rExtracted.incomeStatement[0]?.priorYearValue).toBe(
      771473000,
    );
    expect(normalized.ink2rExtracted.balanceSheet[0]?.currentYearValue).toBe(
      301521000,
    );
    expect(normalized.ink2rExtracted.balanceSheet[0]?.priorYearValue).toBe(
      287144000,
    );
  });

  it("recovers single-sided balance-sheet amounts when note references precede the value", () => {
    const normalized = normalizeAnnualReportTaxDeepV1({
      ink2rExtracted: {
        statementUnit: "ksek",
        incomeStatement: [],
        balanceSheet: [
          {
            code: "long-term-liability",
            label: "Övriga långfristiga skulder",
            currentYearValue: 37,
            priorYearValue: 429,
            evidence: [
              {
                snippet: "Övriga långfristiga skulder 24 37 429 -",
                page: 17,
              },
            ],
          },
        ],
      },
      depreciationContext: { assetAreas: [], evidence: [] },
      assetMovements: { lines: [], evidence: [] },
      reserveContext: { movements: [], notes: [], evidence: [] },
      netInterestContext: { notes: [], evidence: [] },
      pensionContext: { flags: [], notes: [], evidence: [] },
      taxExpenseContext: { notes: [], evidence: [] },
      leasingContext: { flags: [], notes: [], evidence: [] },
      groupContributionContext: { flags: [], notes: [], evidence: [] },
      shareholdingContext: { flags: [], notes: [], evidence: [] },
      priorYearComparatives: [],
    });

    expect(normalized.ink2rExtracted.balanceSheet[0]?.currentYearValue).toBe(
      37429000,
    );
    expect(
      normalized.ink2rExtracted.balanceSheet[0]?.priorYearValue,
    ).toBeUndefined();
  });

  it("hydrates missing statement evidence and unit from routed statement pages", () => {
    const pageTexts = Array.from({ length: 16 }, () => "Page");
    pageTexts[14] = [
      "Resultaträkning",
      "Belopp i KSEK",
      "Nettoomsättning 1 3 989 355 4 381 698",
      "Resultat före skatt 545 286 771 473",
    ].join("\n");
    pageTexts[15] = ["Balansräkning", "Kassa och bank 301 521 287 144"].join(
      "\n",
    );

    const hydrated = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: {
        ink2rExtracted: {
          incomeStatement: [
            {
              code: "revenue",
              label: "Nettoomsättning",
              evidence: [],
            },
            {
              code: "profit_before_tax",
              label: "Resultat före skatt",
              evidence: [],
            },
          ],
          balanceSheet: [
            {
              code: "cash",
              label: "Kassa och bank",
              evidence: [],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      pageTexts,
      incomeStatementRanges: [{ startPage: 15, endPage: 15 }],
      balanceSheetRanges: [{ startPage: 16, endPage: 16 }],
    });
    const normalized = normalizeAnnualReportTaxDeepV1(hydrated);

    expect(hydrated.ink2rExtracted.statementUnit).toBe("ksek");
    expect(
      hydrated.ink2rExtracted.incomeStatement[0]?.evidence[0]?.snippet,
    ).toContain("Nettoomsättning 1 3 989 355 4 381 698");
    expect(normalized.ink2rExtracted.incomeStatement[0]?.currentYearValue).toBe(
      3989355000,
    );
    expect(normalized.ink2rExtracted.incomeStatement[1]?.currentYearValue).toBe(
      545286000,
    );
    expect(normalized.ink2rExtracted.balanceSheet[0]?.currentYearValue).toBe(
      301521000,
    );
  });

  it("replaces placeholder statement rows with deterministic rows from routed pages", () => {
    const pageTexts = Array.from({ length: 17 }, () => "Page");
    pageTexts[14] = [
      "Resultaträkning",
      "Belopp i KSEK",
      "Nettoomsättning 1 3 989 355 4 381 698",
      "Rörelseresultat 542 839 624 526",
      "Resultat före skatt 545 286 771 473",
    ].join("\n");
    pageTexts[15] = [
      "Balansräkning",
      "Belopp i KSEK",
      "Tillgångar",
      "Kassa och bank 22 301 521 504 292",
      "SUMMA TILLGÅNGAR 1 282 468 1 425 371",
    ].join("\n");

    const hydrated = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: {
        ink2rExtracted: {
          incomeStatement: [
            {
              code: "unclassified_line",
              label: "Unknown line",
              evidence: [],
            },
          ],
          balanceSheet: [
            {
              code: "unclassified_line",
              label: "Unknown line",
              evidence: [],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      pageTexts,
      incomeStatementRanges: [{ startPage: 15, endPage: 15 }],
      balanceSheetRanges: [{ startPage: 16, endPage: 16 }],
    });
    const normalized = normalizeAnnualReportTaxDeepV1(hydrated);

    expect(hydrated.ink2rExtracted.incomeStatement.length).toBeGreaterThan(1);
    expect(hydrated.ink2rExtracted.balanceSheet.length).toBeGreaterThan(1);
    expect(
      normalized.ink2rExtracted.incomeStatement.find(
        (line) => line.label === "Resultat före skatt",
      )?.currentYearValue,
    ).toBe(545286000);
    expect(
      normalized.ink2rExtracted.balanceSheet.find(
        (line) => line.label === "Kassa och bank",
      )?.currentYearValue,
    ).toBe(301521000);
  });

  it("re-hydrates routed statement rows from the actual balance-sheet page instead of earlier proposal pages", () => {
    const pageTexts = Array.from({ length: 17 }, () => "Page");
    pageTexts[13] = [
      "Förslag till vinstdisposition",
      "Balanserat resultat 1 565",
      "Årets resultat 428 447 322",
      "428 448 887",
    ].join("\n");
    pageTexts[16] = [
      "Balansräkning, forts.",
      "Belopp i KSEK",
      "Fritt eget kapital",
      "Balanserat resultat 236 5",
      "Årets resultat 428 447 634 313",
      "Summa fritt eget kapital 428 683 634 318",
    ].join("\n");

    const hydrated = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: {
        ink2rExtracted: {
          incomeStatement: [],
          balanceSheet: [
            {
              code: "raw-equity-carry-forward",
              label: "Balanserat resultat",
              currentYearValue: 1565000,
              priorYearValue: undefined,
              evidence: [{ snippet: "Balanserat resultat 1 565", page: 14 }],
            },
            {
              code: "raw-current-profit",
              label: "Årets resultat",
              currentYearValue: 428447322000,
              priorYearValue: 428448887000,
              evidence: [
                {
                  snippet: "Årets resultat 428 447 322 428 448 887",
                  page: 14,
                },
              ],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      pageTexts,
      incomeStatementRanges: [{ startPage: 15, endPage: 15 }],
      balanceSheetRanges: [{ startPage: 17, endPage: 17 }],
    });
    const normalized = normalizeAnnualReportTaxDeepV1(hydrated);
    const aligned = alignAnnualReportStatementsToInk2CodesV1({
      taxDeep: normalized,
      pageTexts,
    });

    expect(
      hydrated.ink2rExtracted.balanceSheet.every((line) =>
        line.evidence.every((evidence) => evidence.page === 17),
      ),
    ).toBe(true);
    expect(aligned.taxDeep.ink2rExtracted.balanceSheet).toEqual([
      expect.objectContaining({
        code: "2.28",
        currentYearValue: 428683000,
        priorYearValue: 634318000,
      }),
    ]);
  });

  it("ignores proposal pages when routed statement ranges are broader than the actual balance sheet", () => {
    const pageTexts = Array.from({ length: 17 }, () => "Page");
    pageTexts[13] = [
      "Förslag till vinstdisposition",
      "Till aktieägarna utdelas 428 447 275",
      "Balanserat resultat 1 565",
      "Årets resultat 428 447 322",
      "Beträffande moderbolagets resultat och ställning hänvisas till efterföljande balansräkningar.",
    ].join("\n");
    pageTexts[14] = [
      "Resultaträkning",
      "Belopp i KSEK Not 2025-05-31 2024-05-31",
      "Nettoomsättning 1 3 989 355 4 381 698",
      "Årets resultat 428 447 634 313",
    ].join("\n");
    pageTexts[15] = [
      "Balansräkning",
      "Belopp i KSEK",
      "Tillgångar",
      "Kassa och bank 22 301 521 504 292",
    ].join("\n");
    pageTexts[16] = [
      "Eget kapital och skulder",
      "Fritt eget kapital",
      "Balanserat resultat 236 5",
      "Årets resultat 428 447 634 313",
    ].join("\n");

    const hydrated = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: {
        ink2rExtracted: {
          incomeStatement: [],
          balanceSheet: [
            {
              code: "raw-free-equity",
              label: "Fritt eget kapital",
              evidence: [
                { snippet: "Till aktieägarna utdelas 428 447 275", page: 14 },
              ],
            },
            {
              code: "raw-carry-forward",
              label: "Balanserat resultat",
              evidence: [{ snippet: "Balanserat resultat 1 565", page: 14 }],
            },
            {
              code: "raw-profit",
              label: "Årets resultat",
              evidence: [{ snippet: "Årets resultat 428 447 322", page: 14 }],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      pageTexts,
      incomeStatementRanges: [{ startPage: 14, endPage: 17 }],
      balanceSheetRanges: [{ startPage: 14, endPage: 17 }],
    });

    expect(
      hydrated.ink2rExtracted.balanceSheet.every((line) =>
        line.evidence.every((evidence) => evidence.page !== 14),
      ),
    ).toBe(true);
    expect(
      hydrated.ink2rExtracted.balanceSheet.find(
        (line) => line.label === "Balanserat resultat",
      ),
    ).toMatchObject({
      currentYearValue: 236,
      priorYearValue: 5,
      evidence: [{ page: 17 }],
    });
  });

  it("parses note-referenced and one-sided statement rows from routed pages correctly", () => {
    const hydrated = hydrateAnnualReportStatementEvidenceFromPageTextV1({
      taxDeep: {
        ink2rExtracted: {
          incomeStatement: [
            {
              code: "raw-financial-result",
              label: "Resultat från andelar i koncernföretag",
              evidence: [],
            },
          ],
          balanceSheet: [
            {
              code: "raw-shares",
              label: "Andelar i koncernföretag",
              evidence: [],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
      pageTexts: [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        [
          "Resultaträkning",
          "Belopp i KSEK",
          "Resultat från andelar i koncernföretag - 137 828",
        ].join("\n"),
        [
          "Balansräkning",
          "Belopp i KSEK",
          "Andelar i koncernföretag 18 1 004 120",
        ].join("\n"),
      ],
      incomeStatementRanges: [{ startPage: 15, endPage: 15 }],
      balanceSheetRanges: [{ startPage: 16, endPage: 16 }],
    });
    const normalized = normalizeAnnualReportTaxDeepV1(hydrated);

    expect(normalized.ink2rExtracted.incomeStatement[0]).toMatchObject({
      currentYearValue: undefined,
      priorYearValue: 137828000,
    });
    expect(normalized.ink2rExtracted.balanceSheet[0]).toMatchObject({
      currentYearValue: 1004000,
      priorYearValue: 120000,
    });
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
        recognizedTax: {
          value: 14,
          page: 24,
          snippet: "Redovisad skatt 14",
        },
        reconciliation: ["Skatteavstämning enligt not 9."],
        taxReceivables: ["ignored legacy field"],
      } as never,
      leasingContext: {
        flags: [],
        notes: [],
        evidence: [],
        leasingExpenses: ["Leasingkostnader under året uppgår till 12."],
        leasingObligations: ["Leasingförpliktelser uppgår till 40."],
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
        dividends: ["Utdelningar under året 25."],
        proposedDividend: ["Föreslagen utdelning 100."],
        participationsInGroupCompanies: [
          "Andelar i koncernföretag framgår av not 18.",
        ],
        participationsInAssociatedCompanies: [
          "Andelar i intresseföretag framgår av not 19.",
        ],
        otherLongTermSecurities: [
          "Andra långfristiga värdepappersinnehav framgår av not 20.",
        ],
      } as never,
      priorYearComparatives: [],
    });

    expect(
      sanitized.depreciationContext.assetAreas[0]?.depreciationForYear,
    ).toBe(12);
    expect(sanitized.assetMovements.lines).toHaveLength(2);
    expect(sanitized.reserveContext.movements[0]?.reserveType).toBe(
      "Periodiseringsfond",
    );
    expect(sanitized.reserveContext.notes).toContain(
      "Bokslutsdispositioner redovisas i not 8.",
    );
    expect(sanitized.netInterestContext.interestIncome?.evidence[0]?.page).toBe(
      24,
    );
    expect(sanitized.netInterestContext.financeIncome?.value).toBe(1);
    expect(
      sanitized.taxExpenseContext?.totalTaxExpense?.evidence[0]?.snippet,
    ).toContain("Skatt");
    expect(
      sanitized.taxExpenseContext?.currentTax?.evidence[0]?.snippet,
    ).toContain("Redovisad skatt");
    expect(sanitized.taxExpenseContext?.notes).toContain(
      "Skatteavstämning enligt not 9.",
    );
    expect(sanitized.pensionContext.notes).toContain(
      "Pensionskostnader framgår av not 5.",
    );
    expect(sanitized.leasingContext.notes).toContain(
      "Leasingkostnader under året uppgår till 12.",
    );
    expect(sanitized.leasingContext.notes).toContain(
      "Framtida leasingavgifter uppgår till 40.",
    );
    expect(sanitized.groupContributionContext.notes).toContain(
      "Koncernbidrag mottaget.",
    );
    expect(sanitized.shareholdingContext.notes).toContain(
      "Utdelningar under året 25.",
    );
    expect(sanitized.shareholdingContext.notes).toContain(
      "Föreslagen utdelning 100.",
    );
    expect(sanitized.shareholdingContext.notes).toContain(
      "Andelar i koncernföretag framgår av not 18.",
    );
  });

  it("aligns extracted statement lines to INK2 codes and drops summary rows", () => {
    const aligned = alignAnnualReportStatementsToInk2CodesV1({
      pageTexts: [
        "",
        "",
        "",
        [
          "Resultaträkning",
          "Rörelsens intäkter",
          "Nettoomsättning 3 989 355 4 381 698",
          "Rörelsens kostnader",
          "Övriga externa kostnader 1 234 567 1 111 111",
          "Resultat före skatt 545 286 771 473",
        ].join("\n"),
        [
          "Balansräkning",
          "Tillgångar",
          "Kassa och bank 301 521 287 144",
          "Kortfristiga skulder",
          "Övriga skulder till kreditinstitut 42 000 39 000",
          "Leverantörsskulder 145 000 121 000",
          "SUMMA TILLGÅNGAR 1 282 468 1 425 371",
        ].join("\n"),
      ],
      taxDeep: {
        ink2rExtracted: {
          statementUnit: "sek",
          incomeStatement: [
            {
              code: "raw-revenue",
              label: "Nettoomsättning",
              currentYearValue: 3989355,
              priorYearValue: 4381698,
              evidence: [
                { snippet: "Nettoomsättning 3 989 355 4 381 698", page: 4 },
              ],
            },
            {
              code: "raw-costs",
              label: "Övriga externa kostnader",
              currentYearValue: 1234567,
              priorYearValue: 1111111,
              evidence: [
                {
                  snippet: "Övriga externa kostnader 1 234 567 1 111 111",
                  page: 4,
                },
              ],
            },
            {
              code: "raw-pbt",
              label: "Resultat före skatt",
              currentYearValue: 545286,
              priorYearValue: 771473,
              evidence: [
                { snippet: "Resultat före skatt 545 286 771 473", page: 4 },
              ],
            },
          ],
          balanceSheet: [
            {
              code: "raw-cash",
              label: "Kassa och bank",
              currentYearValue: 301521,
              priorYearValue: 287144,
              evidence: [
                { snippet: "Kassa och bank 301 521 287 144", page: 5 },
              ],
            },
            {
              code: "raw-bank-debt",
              label: "Övriga skulder till kreditinstitut",
              currentYearValue: 42000,
              priorYearValue: 39000,
              evidence: [
                {
                  snippet: "Övriga skulder till kreditinstitut 42 000 39 000",
                  page: 5,
                },
              ],
            },
            {
              code: "raw-suppliers",
              label: "Leverantörsskulder",
              currentYearValue: 145000,
              priorYearValue: 121000,
              evidence: [
                { snippet: "Leverantörsskulder 145 000 121 000", page: 5 },
              ],
            },
            {
              code: "raw-total",
              label: "SUMMA TILLGÅNGAR",
              currentYearValue: 1282468,
              priorYearValue: 1425371,
              evidence: [
                { snippet: "SUMMA TILLGÅNGAR 1 282 468 1 425 371", page: 5 },
              ],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
    });

    expect(aligned.taxDeep.ink2rExtracted.incomeStatement).toEqual([
      expect.objectContaining({ code: "3.1", label: "Nettoomsättning" }),
      expect.objectContaining({
        code: "3.7",
        label: "Övriga externa kostnader",
      }),
    ]);
    expect(
      aligned.taxDeep.ink2rExtracted.incomeStatement.some(
        (line) => line.label === "Resultat före skatt",
      ),
    ).toBe(false);
    expect(aligned.taxDeep.ink2rExtracted.balanceSheet).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "2.26",
          label: "Kassa, bank och redovisningsmedel",
        }),
        expect.objectContaining({
          code: "2.41",
          label: "Övriga skulder till kreditinstitut",
        }),
        expect.objectContaining({
          code: "2.45",
          label: "Leverantörsskulder",
        }),
      ]),
    );
    expect(
      aligned.taxDeep.ink2rExtracted.balanceSheet.some((line) =>
        line.label.includes("SUMMA"),
      ),
    ).toBe(false);
  });

  it("maps common Swedish balance-sheet labels into INK2 codes and ignores disposition-only rows", () => {
    const aligned = alignAnnualReportStatementsToInk2CodesV1({
      pageTexts: [
        "",
        "",
        "",
        "",
        "",
        [
          "Balansräkning",
          "Immateriella anläggningstillgångar",
          "Programvaror 49 004 33 174",
          "Materiella anläggningstillgångar",
          "Datorer 15 572 22 132",
          "Kortfristiga fordringar",
          "Skattefordran 46 760 1 056",
          "Upparbetade ej fakturerade arvoden 42 951 86 307",
          "Eget kapital",
          "Reservfond 3 523 3 523",
          "Långfristiga skulder",
          "Övriga långfristiga skulder 37 429 -",
          "I ny räkning balanseras 1 612",
        ].join("\n"),
      ],
      taxDeep: {
        ink2rExtracted: {
          statementUnit: "sek",
          incomeStatement: [],
          balanceSheet: [
            {
              code: "raw-programs",
              label: "Programvaror",
              currentYearValue: 49004000,
              priorYearValue: 33174000,
              evidence: [{ snippet: "Programvaror 49 004 33 174", page: 5 }],
            },
            {
              code: "raw-computers",
              label: "Datorer",
              currentYearValue: 15572000,
              priorYearValue: 22132000,
              evidence: [{ snippet: "Datorer 15 572 22 132", page: 5 }],
            },
            {
              code: "raw-tax-receivable",
              label: "Skattefordran",
              currentYearValue: 46760000,
              priorYearValue: 1056000,
              evidence: [{ snippet: "Skattefordran 46 760 1 056", page: 5 }],
            },
            {
              code: "raw-unbilled",
              label: "Upparbetade ej fakturerade arvoden",
              currentYearValue: 42951000,
              priorYearValue: 86307000,
              evidence: [
                {
                  snippet: "Upparbetade ej fakturerade arvoden 42 951 86 307",
                  page: 5,
                },
              ],
            },
            {
              code: "raw-reserve-fund",
              label: "Reservfond",
              currentYearValue: 3523000,
              priorYearValue: 3523000,
              evidence: [{ snippet: "Reservfond 3 523 3 523", page: 5 }],
            },
            {
              code: "raw-long-term-other-debt",
              label: "Övriga långfristiga skulder",
              currentYearValue: 37429000,
              evidence: [
                { snippet: "Övriga långfristiga skulder 37 429 -", page: 5 },
              ],
            },
            {
              code: "raw-disposition",
              label: "I ny räkning balanseras",
              currentYearValue: 1612000,
              evidence: [{ snippet: "I ny räkning balanseras 1 612", page: 5 }],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
    });

    expect(aligned.taxDeep.ink2rExtracted.balanceSheet).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "2.1" }),
        expect.objectContaining({ code: "2.4" }),
        expect.objectContaining({ code: "2.21" }),
        expect.objectContaining({ code: "2.22" }),
        expect.objectContaining({ code: "2.27" }),
        expect.objectContaining({ code: "2.39" }),
      ]),
    );
    expect(
      aligned.taxDeep.ink2rExtracted.balanceSheet.some(
        (line) => line.label === "I ny räkning balanseras",
      ),
    ).toBe(false);
    expect(aligned.warnings).toEqual([]);
  });

  it("maps short-term other liabilities and ignores dash-only balance rows in warnings", () => {
    const aligned = alignAnnualReportStatementsToInk2CodesV1({
      pageTexts: [
        [
          "Balansräkning",
          "Tillgångar",
          "Övriga immateriella tillgångar - -",
          "Kortfristiga skulder",
          "Övriga kortfristiga skulder 142 664 121 112",
        ].join("\n"),
      ],
      taxDeep: {
        ink2rExtracted: {
          statementUnit: "sek",
          incomeStatement: [],
          balanceSheet: [
            {
              code: "raw-empty-assets",
              label: "Övriga immateriella tillgångar",
              evidence: [
                { snippet: "Övriga immateriella tillgångar - -", page: 1 },
              ],
            },
            {
              code: "raw-other-short-debt",
              label: "Övriga kortfristiga skulder",
              currentYearValue: 142664000,
              priorYearValue: 121112000,
              evidence: [
                {
                  snippet: "Övriga kortfristiga skulder 142 664 121 112",
                  page: 1,
                },
              ],
            },
          ],
        },
        depreciationContext: { assetAreas: [], evidence: [] },
        assetMovements: { lines: [], evidence: [] },
        reserveContext: { movements: [], notes: [], evidence: [] },
        netInterestContext: { notes: [], evidence: [] },
        pensionContext: { flags: [], notes: [], evidence: [] },
        taxExpenseContext: { notes: [], evidence: [] },
        leasingContext: { flags: [], notes: [], evidence: [] },
        groupContributionContext: { flags: [], notes: [], evidence: [] },
        shareholdingContext: { flags: [], notes: [], evidence: [] },
        priorYearComparatives: [],
      },
    });

    expect(aligned.taxDeep.ink2rExtracted.balanceSheet).toEqual([
      expect.objectContaining({
        code: "2.48",
        label:
          "Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder",
        currentYearValue: 142664000,
        priorYearValue: 121112000,
      }),
    ]);
    expect(aligned.warnings).toEqual([]);
  });

  it("builds a deterministic fallback annual-report tax analysis", () => {
    const fallback = buildDeterministicAnnualReportTaxAnalysisFallbackV1({
      config: null,
      extraction: {
        schemaVersion: "annual_report_extraction_v1",
        sourceFileName: "annual-report.pdf",
        sourceFileType: "pdf",
        policyVersion: "annual-report-manual-first.v1",
        fields: {
          companyName: {
            status: "extracted",
            confidence: 0.9,
            value: "Test AB",
          },
          organizationNumber: {
            status: "extracted",
            confidence: 0.9,
            value: "556123-1234",
          },
          fiscalYearStart: {
            status: "extracted",
            confidence: 0.9,
            value: "2025-01-01",
          },
          fiscalYearEnd: {
            status: "extracted",
            confidence: 0.9,
            value: "2025-12-31",
          },
          accountingStandard: {
            status: "extracted",
            confidence: 0.9,
            value: "K3",
          },
          profitBeforeTax: {
            status: "extracted",
            confidence: 0.9,
            value: 100000,
          },
        },
        summary: { autoDetectedFieldCount: 6, needsReviewFieldCount: 0 },
        taxSignals: [],
        documentWarnings: [
          "degraded.tax_notes_assets.unavailable:[tax notes assets/reserves] Stage timed out.",
        ],
        taxDeep: {
          ink2rExtracted: { incomeStatement: [], balanceSheet: [] },
          depreciationContext: {
            assetAreas: [
              {
                assetArea: "Inventarier",
                acquisitions: 100000,
                evidence: [{ snippet: "Inventarier 100 000", page: 26 }],
              },
            ],
            evidence: [{ snippet: "Not 8 inventarier", page: 26 }],
          },
          assetMovements: { lines: [], evidence: [] },
          reserveContext: {
            movements: [
              {
                reserveType: "Periodiseringsfond",
                closingBalance: 50000,
                evidence: [{ snippet: "Periodiseringsfond 50 000", page: 27 }],
              },
            ],
            notes: [],
            evidence: [{ snippet: "Not 9 periodiseringsfond", page: 27 }],
          },
          netInterestContext: {
            interestExpense: {
              value: 12000,
              evidence: [{ snippet: "Räntekostnader 12 000", page: 24 }],
            },
            notes: [],
            evidence: [{ snippet: "Not 7 finansnetto", page: 24 }],
          },
          pensionContext: { flags: [], notes: [], evidence: [] },
          taxExpenseContext: {
            totalTaxExpense: {
              value: 21000,
              evidence: [
                { snippet: "Skatt på årets resultat 21 000", page: 24 },
              ],
            },
            notes: [],
            evidence: [{ snippet: "Not 10 skatt", page: 24 }],
          },
          leasingContext: { flags: [], notes: [], evidence: [] },
          groupContributionContext: {
            flags: [],
            notes: ["Koncernbidrag förekommer."],
            evidence: [{ snippet: "Koncernbidrag", page: 25 }],
          },
          shareholdingContext: { flags: [], notes: [], evidence: [] },
          priorYearComparatives: [],
        },
        confirmation: { isConfirmed: false },
      },
      extractionArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fallbackReason: "Gemini request timed out after 180000ms.",
      modelName: "gemini-2.5-flash",
      policyVersion: "annual-report-tax-analysis.v1",
    });

    expect(fallback.executiveSummary).toContain("deterministic fallback");
    expect(fallback.findings.length).toBeGreaterThanOrEqual(3);
    expect(fallback.findings.map((finding) => finding.area)).toEqual(
      expect.arrayContaining([
        "depreciation_differences",
        "untaxed_reserves",
        "net_interest",
      ]),
    );
    expect(fallback.missingInformation[0]).toContain(
      "Detailed note extraction",
    );
    expect(fallback.recommendedNextActions).toEqual(
      expect.arrayContaining([
        "Reconcile the fixed-asset note to the tax depreciation schedule.",
      ]),
    );
  });
});
