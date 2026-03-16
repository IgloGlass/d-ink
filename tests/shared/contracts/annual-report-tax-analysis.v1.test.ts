import { describe, expect, it } from "vitest";

import {
  parseAnnualReportTaxAnalysisPayloadV1,
} from "../../../src/shared/contracts/annual-report-tax-analysis.v1";
import {
  parseAnnualReportDownstreamTaxContextV1,
  parseAnnualReportMappingContextV1,
} from "../../../src/shared/contracts/annual-report-tax-context.v1";

describe("annual-report tax analysis contracts v1", () => {
  it("parses structured annual-report tax analysis payloads", () => {
    const payload = parseAnnualReportTaxAnalysisPayloadV1({
      schemaVersion: "annual_report_tax_analysis_v1",
      sourceExtractionArtifactId: "9f000000-0000-4000-8000-000000000001",
      policyVersion: "annual-report-tax-analysis.v1",
      basedOn: {
        ink2rExtracted: {
          incomeStatement: [],
          balanceSheet: [],
        },
        depreciationContext: {
          assetAreas: [
            {
              assetArea: "Machinery and equipment",
              acquisitions: 125000,
              disposals: 10000,
              depreciationForYear: 45000,
              closingCarryingAmount: 300000,
              evidence: [{ snippet: "Note 8 machinery additions", page: 14 }],
            },
          ],
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
        netInterestContext: {
          notes: ["Interest expense increased year over year."],
          evidence: [],
        },
        pensionContext: {
          flags: [],
          notes: [],
          evidence: [],
        },
        taxExpenseContext: {
          currentTax: {
            value: 12000,
            evidence: [],
          },
          deferredTax: {
            value: -4000,
            evidence: [],
          },
          notes: ["Deferred tax note should be reconciled to the tax computation."],
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
      },
      executiveSummary: "Depreciation movements and finance-note context need tax review.",
      accountingStandardAssessment: {
        status: "aligned",
        rationale: "K3 references are explicit in the report.",
      },
      reviewState: {
        mode: "full_ai",
        reasons: [],
        sourceDocumentAvailable: true,
        sourceDocumentUsed: true,
      },
      findings: [
        {
          id: "finding-1",
          area: "depreciation_differences",
          title: "Asset-note movement suggests tax-vs-book review",
          severity: "high",
          rationale: "Large acquisitions and depreciation movement were disclosed.",
          recommendedFollowUp: "Reconcile book and tax depreciation schedules.",
          missingInformation: ["Tax depreciation base"],
          policyRuleReference: "annual-report-tax-analysis.depreciation.v1",
          evidence: [{ snippet: "Acquisitions during the year", page: 14 }],
        },
      ],
      missingInformation: ["Tax depreciation schedule not included in annual report."],
      recommendedNextActions: ["Cross-check with fixed-asset register."],
    });

    expect(payload.findings).toHaveLength(1);
    expect(payload.basedOn.depreciationContext.assetAreas[0]?.acquisitions).toBe(
      125000,
    );
  });

  it("parses downstream tax-context projection payloads", () => {
    const projection = parseAnnualReportDownstreamTaxContextV1({
      schemaVersion: "annual_report_tax_context_v1",
      incomeStatementAnchors: [],
      balanceSheetAnchors: [],
      depreciationContext: {
        assetAreas: [],
        evidence: [],
      },
      assetMovements: {
        lines: [],
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
        currentTax: {
          value: 12000,
          evidence: [],
        },
        notes: ["Current tax note captured from the annual report."],
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
      missingInformation: [],
    });

    expect(projection.netInterestContext.notes).toContain(
      "Interest expense disclosed in finance note.",
    );
    expect(projection.taxExpenseContext?.currentTax?.value).toBe(12000);
  });

  it("parses expanded mapping-context payloads", () => {
    const projection = parseAnnualReportMappingContextV1({
      schemaVersion: "annual_report_mapping_context_v1",
      incomeStatementAnchors: [],
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
        lines: [],
        evidence: [],
      },
      netInterestContext: {
        notes: [],
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

    expect(projection.depreciationContext.assetAreas[0]?.assetArea).toBe(
      "Leasehold improvements",
    );
    expect(projection.taxExpenseContext?.deferredTax?.value).toBe(12000);
    expect(projection.missingInformation).toContain(
      "No building note was found in the annual report.",
    );
  });
});
