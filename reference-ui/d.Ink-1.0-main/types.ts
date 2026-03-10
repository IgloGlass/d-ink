
export interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  type: 'balans' | 'resultat';
  ib?: string;
  ub?: string;
  yearEnd?: string;
}

export interface MappingResult {
  accountNumber: string;
  suggestedCategory: string;
  originalAICategory?: string;
  silverfinAccountNr?: string;
  reasoning: string;
  confidence: number;
  isManualOverride?: boolean;
  comment?: string;
}

export interface NonDeductibleData {
  category: 'Representation' | 'Gifts' | 'Fines' | 'Consulting' | 'Sponsorship' | 'TaxInterest' | 'Membership' | 'Other';
  presumption: 'Deductible' | 'Non-Deductible';
  deductiblePercentage?: number; // 0 to 100
  nonDeductibleAmount?: number; // Calculated result
  description?: string; // Custom user note for the attachment
}

export interface HistoricalAcquisition {
  yearLabel: string; // e.g. "2023 (T-1)"
  acquisitionCost: number;
  multiplier: number; // 0.8, 0.6, 0.4, 0.2
  sourceSnippet?: string; // Verification text from source PDF
}

export interface DepreciationData {
  method: 'main' | 'alternative' | 'residual'; // 30-rule (main), 20-rule (alternative), restvärde
  ibTaxValue: number; // IB Skattemässigt värde
  currentAcquisitions: number; // T
  disposalProceeds: number; // Sales proceeds (Ersättning)
  historicalAcquisitions: HistoricalAcquisition[]; // For 20-rule
  isFusionsGoodwill?: boolean;
}

export interface BuildingAsset {
    id: string;
    category: 'Building' | 'Land Improvement' | 'Leasehold Improvement';
    description: string;
    taxAcquisitionValue: number; // IB Tax Value
    bookedDepreciation: number;
    taxRate: number; // 0.02, 0.04, etc.
    calculatedTaxDepreciation: number;
    isExtendedRepair: boolean;
    aiReasoning?: string;
}

export interface BuildingDepreciationData {
    assets: BuildingAsset[];
    totalAdjustment49: number;
}

export interface WarrantyGroup {
  id: string;
  name: string; // e.g. "General Warranties"
  warrantyMonths: number;
  actualCosts: number;
  bookedProvision: number; // UB
  isRealized: boolean; // If true, fully deductible (Cap = Provision)
}

export interface WarrantyData {
  groups: WarrantyGroup[];
  priorYearNonDeductible: number; // For 4.5c
}

export interface InventoryObsolescenceData {
  acquisitionValue: number; // Anskaffningsvärde
  bookedReserve: number; // Bokförd reserv (UB)
  valuationMethod: 'alternative' | 'main'; // 97% rule vs LVP
  priorYearNonDeductible: number; // IB Adjustment to reverse (4.5c)
}

export interface InterestDeductionData {
  targetedRuleAdjustment: number; // Manual override for non-deductible intra-group interest
  useSimplificationRule: boolean; // Toggle 5M rule vs 30% EBITDA
  allocatedSimplificationAmount: number; // Portion of 5M used (if group)
  transferredDeductionCapacity: number; // Kvittning (+/-)
  manualTaxEBITDAOverride?: number; // Allow user to force EBITDA base
  remainingNegativeInterest: number; // Kvarstående räntenetto (Carry forward)
}

export interface PensionData {
  slpBasis: number; // Field 1.4
  bookedExpenses: number;
}

export interface NonTaxableData {
  isTaxAccountInterest: boolean;
  isAckord: boolean;
  insolvencyConfirmed: boolean;
  isTaxRefund: boolean;
}

export interface LedgerToResultData {
  profitBeforeTaxGL: number;
  profitBeforeTaxAnnualReport: number;
  discrepancy: number;
  taxExpense: number; // Skatt på årets resultat
  netResult: number; // Årets resultat
  notes?: string;
}

export interface ProvisionData {
  status: 'Deductible' | 'Non-Deductible';
  riskAssessment: 'High Risk' | 'Standard';
  ib: number;
  ub: number;
}

export interface TaxAdjustmentEntry {
  accountId: string;
  accountNumber: string;
  adjustmentAmount: number; // The amount to add/deduct in INK2S. Can be negative for net fields like 4.9.
  ink2sCode: string; // e.g., "4.3c", "4.9"
  manualOverride: boolean;
  aiReasoning?: string;
  // New fields for Provisions (IB/UB Method)
  reversalAmount?: number; // Amount to reverse/dissolve (e.g. IB)
  reversalCode?: string;   // e.g. "4.5c"
  // New fields for Real Estate (Buildings) Module
  taxBase?: number; // Acquisition Cost (Anskaffningsvärde)
  taxRate?: number; // Depreciation Rate (e.g. 0.04 for 4%)
  assetType?: string; // e.g. "Industrial", "Residential"
  groupName?: string; // Grouping key (e.g. "Buildings") to link Assets and Expenses
  
  treatmentType?: string; // Added field for Capital Assets module

  // Module Specific Data
  nonDeductibleData?: NonDeductibleData;
  depreciationData?: DepreciationData;
  warrantyData?: WarrantyData;
  inventoryObsolescenceData?: InventoryObsolescenceData;
  interestDeductionData?: InterestDeductionData;
  ledgerToResultData?: LedgerToResultData;
  provisionData?: ProvisionData;
  buildingDepreciationData?: BuildingDepreciationData;
  pensionData?: PensionData;
  nonTaxableData?: NonTaxableData;
}

export interface AnnualReportAnalysis {
  financials?: Record<string, number>; 
  analysisMarkdown: string; 
  currencyUnit?: string; 
  companyName?: string;
  orgNumber?: string;
  taxLosses?: number;
}

export interface Ink2Data {
  orgNr: string;
  companyName: string;
  year: string;
  periodStart: string;
  periodEnd: string;
  rFields: Record<string, number>; 
  sFields: Record<string, number>;
  n9: {
    netInterest: number;
    deductionCapacity: number; 
    disallowedInterest: number;
  }
}
