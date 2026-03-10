import { describe, expect, it } from "vitest";

import {
  AnnualReportAiCoreExtractionResultV1Schema,
  AnnualReportAiExtractionResultV1Schema,
  AnnualReportAiMovementsResultV1Schema,
  AnnualReportAiNarrativeResultV1Schema,
  AnnualReportAiStatementsResultV1Schema,
} from "../../../src/shared/contracts/annual-report-ai.v1";
import { parseAnnualReportTaxAnalysisAiResultV1 } from "../../../src/shared/contracts/annual-report-tax-analysis-ai.v1";

describe("annual report AI contracts v1", () => {
  it("normalizes unexpected schema versions from Gemini core extraction output", () => {
    const result = AnnualReportAiCoreExtractionResultV1Schema.parse({
      schemaVersion: "1.0",
      fields: {
        companyName: {
          status: "extracted",
          confidence: 0.99,
          valueText: "Acme AB",
        },
        organizationNumber: {
          status: "extracted",
          confidence: 0.99,
          valueText: "556677-8899",
        },
        fiscalYearStart: {
          status: "extracted",
          confidence: 0.99,
          valueText: "2025-01-01",
        },
        fiscalYearEnd: {
          status: "extracted",
          confidence: 0.99,
          valueText: "2025-12-31",
        },
        accountingStandard: {
          status: "extracted",
          confidence: 0.99,
          valueText: "K2",
          normalizedValue: "K2",
        },
        profitBeforeTax: {
          status: "extracted",
          confidence: 0.99,
          valueText: "1000000",
          normalizedValue: 1000000,
        },
      },
      taxSignals: [],
      documentWarnings: [],
    });

    expect(result.schemaVersion).toBe("annual_report_ai_core_extraction_v1");
  });

  it("accepts missing schema versions for follow-on annual report extraction stages", () => {
    const statements = AnnualReportAiStatementsResultV1Schema.parse({
      ink2rExtracted: {
        statementUnit: "ksek",
        incomeStatement: [],
        balanceSheet: [],
      },
      priorYearComparatives: [],
      evidence: [],
    });
    const movements = AnnualReportAiMovementsResultV1Schema.parse({
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
    });
    const narrative = AnnualReportAiNarrativeResultV1Schema.parse({
      netInterestContext: {
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
          value: 12,
          evidence: [],
        },
        deferredTax: {
          value: -2,
          evidence: [],
        },
        notes: ["Current and deferred tax were disclosed in note 12."],
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
      evidence: [],
    });
    const merged = AnnualReportAiExtractionResultV1Schema.parse({
      fields: {
        companyName: {
          status: "extracted",
          confidence: 0.99,
          valueText: "Acme AB",
        },
        organizationNumber: {
          status: "extracted",
          confidence: 0.99,
          valueText: "556677-8899",
        },
        fiscalYearStart: {
          status: "extracted",
          confidence: 0.99,
          valueText: "2025-01-01",
        },
        fiscalYearEnd: {
          status: "extracted",
          confidence: 0.99,
          valueText: "2025-12-31",
        },
        accountingStandard: {
          status: "extracted",
          confidence: 0.99,
          valueText: "K3",
          normalizedValue: "K3",
        },
        profitBeforeTax: {
          status: "extracted",
          confidence: 0.99,
          valueText: "1000000",
          normalizedValue: 1000000,
        },
      },
      taxSignals: [],
      documentWarnings: [],
      evidence: [],
      taxDeep: {
        ink2rExtracted: statements.ink2rExtracted,
        depreciationContext: movements.depreciationContext,
        assetMovements: movements.assetMovements,
        reserveContext: movements.reserveContext,
        netInterestContext: narrative.netInterestContext,
        pensionContext: narrative.pensionContext,
        taxExpenseContext: narrative.taxExpenseContext,
        leasingContext: narrative.leasingContext,
        groupContributionContext: narrative.groupContributionContext,
        shareholdingContext: narrative.shareholdingContext,
        priorYearComparatives: statements.priorYearComparatives,
      },
    });

    expect(statements.schemaVersion).toBe("annual_report_ai_statements_v1");
    expect(movements.schemaVersion).toBe("annual_report_ai_movements_v1");
    expect(narrative.schemaVersion).toBe("annual_report_ai_narrative_v1");
    expect(merged.schemaVersion).toBe("annual_report_ai_extraction_v1");
  });

  it("normalizes unexpected schema versions from Gemini tax-analysis output", () => {
    const result = parseAnnualReportTaxAnalysisAiResultV1({
      schemaVersion: "1.0.0",
      executiveSummary: "Depreciation note needs follow-up.",
      accountingStandardAssessment: {
        status: "aligned",
        rationale: "K3 is explicit in the annual report.",
      },
      findings: [
        {
          id: "finding-1",
          area: "depreciation_differences",
          title: "Movement schedule should be reconciled",
          severity: "high",
          rationale: "Large acquisitions were disclosed in note 8.",
          recommendedFollowUp: "Compare with the fixed-asset register.",
          missingInformation: ["Tax depreciation base"],
          policyRuleReference: "annual-report-tax-analysis.depreciation.v1",
          evidence: [{ snippet: "Note 8", page: 12 }],
        },
      ],
      missingInformation: ["Tax depreciation base"],
      recommendedNextActions: ["Compare with the fixed-asset register."],
    });

    expect(result.schemaVersion).toBe("annual_report_tax_analysis_ai_v1");
  });

  it("defaults missing repeated fields and missing nested note contexts", () => {
    const result = AnnualReportAiNarrativeResultV1Schema.parse({});

    expect(result.netInterestContext.notes).toEqual([]);
    expect(result.netInterestContext.evidence).toEqual([]);
    expect(result.pensionContext.flags).toEqual([]);
    expect(result.leasingContext.notes).toEqual([]);
    expect(result.groupContributionContext.notes).toEqual([]);
    expect(result.shareholdingContext.flags).toEqual([]);
    expect(result.evidence).toEqual([]);
  });

  it("accepts harmless extra keys and coerces known numeric strings", () => {
    const result = AnnualReportAiStatementsResultV1Schema.parse({
      unexpectedTopLevelKey: "ignored",
      ink2rExtracted: {
        statementUnit: "KSEK",
        incomeStatement: {
          code: "profit_before_tax",
          label: "Profit before tax",
          currentYearValue: "1 250,5",
          unexpectedLineKey: "ignored",
        },
      },
      priorYearComparatives: {
        area: "income_statement",
        code: "profit_before_tax",
        label: "Profit before tax",
        priorYearValue: "950",
      },
    });

    expect(result.ink2rExtracted.statementUnit).toBe("ksek");
    expect(result.ink2rExtracted.incomeStatement).toHaveLength(1);
    expect(result.ink2rExtracted.incomeStatement[0]?.currentYearValue).toBe(1250.5);
    expect(result.priorYearComparatives[0]?.priorYearValue).toBe(950);
  });

  it("normalizes empty strings in optional fields to absent values", () => {
    const result = AnnualReportAiCoreExtractionResultV1Schema.parse({
      fields: {
        companyName: {
          status: "needs_review",
          confidence: "",
          valueText: " ",
        },
        organizationNumber: {},
        fiscalYearStart: {
          normalizedValue: " ",
        },
        fiscalYearEnd: {},
        accountingStandard: {
          normalizedValue: "k3",
        },
        profitBeforeTax: {
          normalizedValue: " ",
        },
      },
    });

    expect(result.fields.companyName.valueText).toBeUndefined();
    expect(result.fields.companyName.confidence).toBe(0);
    expect(result.fields.fiscalYearStart.normalizedValue).toBeUndefined();
    expect(result.fields.accountingStandard.normalizedValue).toBe("K3");
    expect(result.fields.profitBeforeTax.normalizedValue).toBeUndefined();
    expect(result.taxSignals).toEqual([]);
    expect(result.documentWarnings).toEqual([]);
  });
});
