import {
  type AnnualReportExtractionPayloadV1,
  parseAnnualReportExtractionPayloadV1,
} from "../../../shared/contracts/annual-report-extraction.v1";
import {
  type AnnualReportTaxAnalysisPayloadV1,
  parseAnnualReportTaxAnalysisPayloadV1,
} from "../../../shared/contracts/annual-report-tax-analysis.v1";
import {
  parseAnnualReportDownstreamTaxContextV1,
  parseAnnualReportMappingContextV1,
  type AnnualReportDownstreamTaxContextV1,
  type AnnualReportMappingContextV1,
} from "../../../shared/contracts/annual-report-tax-context.v1";

/**
 * Projects annual-report extraction and advisory tax analysis into stable
 * downstream AI context contracts. Downstream modules must consume these
 * projections rather than raw provider payloads.
 */
export function projectAnnualReportTaxContextV1(input: {
  extraction: AnnualReportExtractionPayloadV1;
  taxAnalysis?: AnnualReportTaxAnalysisPayloadV1 | null;
}): AnnualReportDownstreamTaxContextV1 {
  const extraction = parseAnnualReportExtractionPayloadV1(input.extraction);
  const taxAnalysis = input.taxAnalysis
    ? parseAnnualReportTaxAnalysisPayloadV1(input.taxAnalysis)
    : null;
  const taxDeep = extraction.taxDeep;

  return parseAnnualReportDownstreamTaxContextV1({
    schemaVersion: "annual_report_tax_context_v1",
    incomeStatementAnchors: taxDeep?.ink2rExtracted.incomeStatement ?? [],
    balanceSheetAnchors: taxDeep?.ink2rExtracted.balanceSheet ?? [],
    depreciationContext: {
      assetAreas: taxDeep?.depreciationContext.assetAreas ?? [],
      evidence: taxDeep?.depreciationContext.evidence ?? [],
    },
    assetMovements: {
      lines: taxDeep?.assetMovements.lines ?? [],
      evidence: taxDeep?.assetMovements.evidence ?? [],
    },
    netInterestContext: {
      financeIncome: taxDeep?.netInterestContext.financeIncome,
      financeExpense: taxDeep?.netInterestContext.financeExpense,
      interestIncome: taxDeep?.netInterestContext.interestIncome,
      interestExpense: taxDeep?.netInterestContext.interestExpense,
      netInterest: taxDeep?.netInterestContext.netInterest,
      notes: taxDeep?.netInterestContext.notes ?? [],
      evidence: taxDeep?.netInterestContext.evidence ?? [],
    },
    reserveContext: {
      movements: taxDeep?.reserveContext.movements ?? [],
      notes: taxDeep?.reserveContext.notes ?? [],
      evidence: taxDeep?.reserveContext.evidence ?? [],
    },
    pensionContext: {
      specialPayrollTax: taxDeep?.pensionContext.specialPayrollTax,
      flags: taxDeep?.pensionContext.flags ?? [],
      notes: taxDeep?.pensionContext.notes ?? [],
      evidence: taxDeep?.pensionContext.evidence ?? [],
    },
    taxExpenseContext: taxDeep?.taxExpenseContext,
    leasingContext: {
      flags: taxDeep?.leasingContext.flags ?? [],
      notes: taxDeep?.leasingContext.notes ?? [],
      evidence: taxDeep?.leasingContext.evidence ?? [],
    },
    groupContributionContext: {
      flags: taxDeep?.groupContributionContext.flags ?? [],
      notes: taxDeep?.groupContributionContext.notes ?? [],
      evidence: taxDeep?.groupContributionContext.evidence ?? [],
    },
    shareholdingContext: {
      dividendsReceived: taxDeep?.shareholdingContext.dividendsReceived,
      dividendsPaid: taxDeep?.shareholdingContext.dividendsPaid,
      flags: taxDeep?.shareholdingContext.flags ?? [],
      notes: taxDeep?.shareholdingContext.notes ?? [],
      evidence: taxDeep?.shareholdingContext.evidence ?? [],
    },
    relevantNotes: taxDeep?.relevantNotes ?? [],
    priorYearComparatives: taxDeep?.priorYearComparatives ?? [],
    selectedRiskFindings:
      taxAnalysis?.findings.map((finding) => ({
        area: finding.area,
        title: finding.title,
        severity: finding.severity,
        rationale: finding.rationale,
        policyRuleReference: finding.policyRuleReference,
        evidence: finding.evidence,
      })) ?? [],
    missingInformation: taxAnalysis?.missingInformation ?? [],
  });
}

export function projectAnnualReportMappingContextV1(input: {
  annualReportTaxContext: AnnualReportDownstreamTaxContextV1;
}): AnnualReportMappingContextV1 {
  return parseAnnualReportMappingContextV1({
    schemaVersion: "annual_report_mapping_context_v1",
    incomeStatementAnchors: input.annualReportTaxContext.incomeStatementAnchors,
    balanceSheetAnchors: input.annualReportTaxContext.balanceSheetAnchors,
    depreciationContext: input.annualReportTaxContext.depreciationContext,
    assetMovements: input.annualReportTaxContext.assetMovements,
    taxExpenseContext: input.annualReportTaxContext.taxExpenseContext,
    pensionContext: input.annualReportTaxContext.pensionContext,
    leasingContext: input.annualReportTaxContext.leasingContext,
    reserveContext: input.annualReportTaxContext.reserveContext,
    netInterestContext: input.annualReportTaxContext.netInterestContext,
    groupContributionContext: input.annualReportTaxContext.groupContributionContext,
    shareholdingContext: input.annualReportTaxContext.shareholdingContext,
    relevantNotes: input.annualReportTaxContext.relevantNotes,
    priorYearComparatives: input.annualReportTaxContext.priorYearComparatives,
    selectedRiskFindings: input.annualReportTaxContext.selectedRiskFindings,
    missingInformation: input.annualReportTaxContext.missingInformation,
  });
}
