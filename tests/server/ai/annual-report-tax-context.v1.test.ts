import { describe, expect, it } from "vitest";

import { projectAnnualReportMappingContextV1 } from "../../../src/server/ai/context/annual-report-tax-context.v1";
import { parseAnnualReportDownstreamTaxContextV1 } from "../../../src/shared/contracts/annual-report-tax-context.v1";

describe("annual-report mapping context projection v1", () => {
  it("projects structured depreciation, tax, and statement facts into the mapping context", () => {
    const downstreamContext = parseAnnualReportDownstreamTaxContextV1({
      schemaVersion: "annual_report_tax_context_v1",
      incomeStatementAnchors: [
        {
          code: "profit_before_tax",
          label: "Resultat fore skatt",
          currentYearValue: 500000,
          evidence: [],
        },
      ],
      balanceSheetAnchors: [
        {
          code: "leasehold_improvements",
          label: "Forbattringsutgifter pa annans fastighet",
          currentYearValue: 125000,
          evidence: [],
        },
      ],
      depreciationContext: {
        assetAreas: [
          {
            assetArea: "Leasehold improvements",
            acquisitions: 50000,
            depreciationForYear: 25000,
            closingCarryingAmount: 125000,
            evidence: [],
          },
        ],
        evidence: [],
      },
      assetMovements: {
        lines: [
          {
            assetArea: "Machinery and equipment",
            openingCarryingAmount: 200000,
            closingCarryingAmount: 160000,
            depreciationForYear: 40000,
            evidence: [],
          },
        ],
        evidence: [],
      },
      netInterestContext: {
        notes: ["Interest expense disclosed in finance note."],
        evidence: [],
      },
      reserveContext: {
        movements: [],
        notes: [],
        evidence: [],
      },
      pensionContext: {
        flags: [],
        notes: [],
        evidence: [],
      },
      taxExpenseContext: {
        deferredTax: {
          value: 12000,
          evidence: [],
        },
        notes: ["Deferred tax note captured from the annual report."],
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
      selectedRiskFindings: [],
      missingInformation: ["No building note was found in the annual report."],
    });

    const mappingContext = projectAnnualReportMappingContextV1({
      annualReportTaxContext: downstreamContext,
    });

    expect(mappingContext.balanceSheetAnchors[0]?.code).toBe(
      "leasehold_improvements",
    );
    expect(mappingContext.depreciationContext.assetAreas[0]?.assetArea).toBe(
      "Leasehold improvements",
    );
    expect(mappingContext.assetMovements.lines[0]?.assetArea).toBe(
      "Machinery and equipment",
    );
    expect(mappingContext.taxExpenseContext?.deferredTax?.value).toBe(12000);
    expect(mappingContext.missingInformation).toContain(
      "No building note was found in the annual report.",
    );
  });
});
