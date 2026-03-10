
import { Account, MappingResult, AnnualReportAnalysis, TaxAdjustmentEntry } from '../types';

export const SRU_MAPPING: Record<string, string> = {
    // Page 1
    "1.1": "7014", "1.2": "7013", "1.3": "7018", "1.4": "7015", "1.5": "7016",
    "1.6a": "7020", "1.6b": "7021", "1.7a": "7022", "1.7b": "7023",
    "1.8": "7030", "1.9": "7031", "1.10": "7032", "1.11": "7033", "1.12": "7034", "1.13": "7035", "1.14": "7036", "1.15": "7037",
    "1.16": "7040",

    // Balance Sheet - Assets (2.x)
    "2.1": "7100", "2.2": "7101", "2.3": "7102", "2.4": "7103", "2.5": "7104", "2.6": "7105",
    "2.7": "7106", "2.8": "7107", "2.9": "7108", "2.10": "7109", "2.11": "7110", "2.12": "7111",
    "2.13": "7112", "2.14": "7113", "2.15": "7114", "2.16": "7115", "2.17": "7116", "2.18": "7117",
    "2.19": "7118", "2.20": "7119", "2.21": "7120", "2.22": "7121", "2.23": "7122",
    "2.24": "7123", "2.25": "7124", "2.26": "7125",

    // Balance Sheet - Equity & Liabilities (2.x)
    "2.27": "7140", "2.28": "7141",
    "2.29": "7142", "2.30": "7143",
    "2.31": "7144", "2.32": "7145", "2.33": "7146", "2.34": "7147",
    "2.35": "7148", "2.36": "7149", "2.37": "7150", "2.38": "7151", "2.39": "7152",
    "2.40": "7153", "2.41": "7154", "2.42": "7155", "2.43": "7156", "2.44": "7157", "2.45": "7158",
    "2.46": "7159", "2.47": "7160", "2.48": "7161", "2.49": "7162", "2.50": "7163",

    // Income Statement (3.x)
    "3.1": "7351", "3.2": "7352", "3.3": "7353", "3.4": "7354",
    "3.5": "7355", "3.6": "7356", "3.7": "7357", "3.8": "7358", "3.9": "7359", "3.10": "7360", "3.11": "7361",
    "3.12": "7362", "3.13": "7363", "3.14": "7364", "3.15": "7365", "3.16": "7366", "3.17": "7367", "3.18": "7368",
    "3.19": "7369", "3.20": "7370", "3.21": "7371", "3.22": "7372", "3.23": "7373", "3.24": "7374", "3.25": "7375",
    "3.26": "7380", "3.27": "7381",

    // Tax Adjustments (4.x)
    "4.1": "7500", "4.2": "7501",
    "4.3a": "7502", "4.3b": "7503", "4.3c": "7504",
    "4.4a": "7505", "4.4b": "7506",
    "4.5a": "7507", "4.5b": "7508", "4.5c": "7509",
    "4.6a": "7510", "4.6b": "7511", "4.6c": "7512", "4.6d": "7513", "4.6e": "7514",
    "4.7a": "7515", "4.7b": "7516", "4.7c": "7517", "4.7d": "7518", "4.7e": "7519", "4.7f": "7520",
    "4.8a": "7521", "4.8b": "7522", "4.8c": "7523", "4.8d": "7524",
    "4.9": "7525", "4.10": "7526", "4.11": "7527", "4.12": "7528", "4.13": "7529",
    "4.14a": "7530", "4.14b": "7533", "4.14c": "7534",
    "4.15": "7531", "4.16": "7532",
    "4.17": "7535", "4.18": "7536", "4.19": "7537", "4.20": "7538", "4.21": "7539", "4.22": "7540"
};

// Maps Tax Categories AND Account Context to INK2 Field Codes
const getInk2Field = (category: string, accountName: string, accountNumber: string): { ink2r: string | null, ink2s: string | null, sign: number } => {
  const c = category.toLowerCase();
  
  // --- Balance Sheet (Assets = Positive, Equity/Liab = Negative in raw data usually) ---
  // Assets (2.x) - Sign: 1
  if (c.includes("immateriella")) {
      if (accountName.toLowerCase().includes("förskott")) return { ink2r: "2.2", ink2s: null, sign: 1 };
      return { ink2r: "2.1", ink2s: null, sign: 1 };
  }
  if (c.includes("byggnader")) return { ink2r: "2.3", ink2s: null, sign: 1 };
  if (c.includes("markanläggningar")) return { ink2r: "2.3", ink2s: null, sign: 1 };
  if (c.includes("materiella") || c.includes("maskiner") || c.includes("inventarier")) return { ink2r: "2.4", ink2s: null, sign: 1 };
  if (c.includes("nyttjanderättshavares")) return { ink2r: "2.5", ink2s: null, sign: 1 };
  if (c.includes("pågående nyanläggningar")) return { ink2r: "2.6", ink2s: null, sign: 1 };
  
  if (c.includes("aktier") && c.includes("balans")) {
      // Crude heuristic: 13xx = Financial Fixed Assets, 1xxx = Assets
      if (accountNumber.startsWith("13")) return { ink2r: "2.9", ink2s: null, sign: 1 };
      return { ink2r: "2.24", ink2s: null, sign: 1 }; // Short term
  }
  if (c.includes("kapitalförsäkring")) return { ink2r: "2.9", ink2s: null, sign: 1 };
  
  if (c.includes("lager")) return { ink2r: "2.13", ink2s: null, sign: 1 }; // Default Råvaror
  
  if (c.includes("kundfordringar")) return { ink2r: "2.19", ink2s: null, sign: 1 };
  if (c.includes("kassa") || c.includes("bank")) return { ink2r: "2.26", ink2s: null, sign: 1 };

  // Equity & Liabilities (2.x) - Sign: -1 (Flip negative values to positive for form)
  if (c.includes("aktiekapital")) return { ink2r: "2.27", ink2s: null, sign: -1 };
  if (c.includes("balanserad vinst") || c.includes("årets resultat") || c.includes("fritt eget")) return { ink2r: "2.28", ink2s: null, sign: -1 };
  
  if (c.includes("periodiseringsfond")) return { ink2r: "2.29", ink2s: null, sign: -1 };
  if (c.includes("överavskrivningar")) return { ink2r: "2.30", ink2s: null, sign: -1 };
  
  if (c.includes("garantiavsättning")) return { ink2r: "2.34", ink2s: null, sign: -1 };
  if (c.includes("övriga reserveringar")) return { ink2r: "2.31", ink2s: null, sign: -1 }; // Or 2.34
  
  if (c.includes("leverantörsskulder")) return { ink2r: "2.45", ink2s: null, sign: -1 };
  if (c.includes("skatteskulder") || c.includes("moms")) return { ink2r: "2.49", ink2s: null, sign: -1 };
  if (c.includes("upplupen") || c.includes("förutbetalda intäkter")) return { ink2r: "2.50", ink2s: null, sign: -1 };
  
  // Fallback for "Ej skattesensitiv - balans" based on name/number
  if (c.includes("ej skattesensitiv - balans")) {
      const num = parseInt(accountNumber);
      if (num >= 1900 && num < 2000) return { ink2r: "2.26", ink2s: null, sign: 1 }; // Cash
      if (num >= 1500 && num < 1600) return { ink2r: "2.19", ink2s: null, sign: 1 }; // AR
      if (num >= 2440 && num < 2450) return { ink2r: "2.45", ink2s: null, sign: -1 }; // AP
      if (num >= 2600 && num < 2700) return { ink2r: "2.49", ink2s: null, sign: -1 }; // Tax/VAT
      if (num >= 2900 && num < 3000) return { ink2r: "2.50", ink2s: null, sign: -1 }; // Accruals
      if (num >= 2000 && num < 2100) return { ink2r: "2.28", ink2s: null, sign: -1 }; // Equity
  }

  // --- Income Statement (3.x) ---
  // Sign: -1 for Revenue, 1 for Cost (typically)
  
  // Revenue
  if (c.includes("nettoomsättning") || c.includes("försäljning")) return { ink2r: "3.1", ink2s: null, sign: -1 };
  if (c.includes("övriga rörelseintäkter")) return { ink2r: "3.4", ink2s: null, sign: -1 };
  if (c.includes("aktiverat arbete")) return { ink2r: "3.3", ink2s: null, sign: -1 };
  
  // Costs
  if (c.includes("varukostnader") || c.includes("råvaror")) return { ink2r: "3.5", ink2s: null, sign: 1 };
  if (c.includes("handelsvaror")) return { ink2r: "3.6", ink2s: null, sign: 1 };
  if (c.includes("övriga externa") || c.includes("lokalhyra") || c.includes("telekom") || c.includes("konsult")) return { ink2r: "3.7", ink2s: null, sign: 1 };
  
  if (c.includes("representation")) {
      const isNonDeductible = c.includes("ej avdragsgill");
      return { ink2r: "3.7", ink2s: isNonDeductible ? "4.3c" : null, sign: 1 };
  }

  if (c.includes("personalkostnader") || c.includes("löner") || c.includes("arbetsgivaravgifter")) return { ink2r: "3.8", ink2s: null, sign: 1 };
  if (c.includes("pensionskostnader")) return { ink2r: "3.8", ink2s: null, sign: 1 }; 
  
  // Depreciation Mapping
  if (c.includes("byggnader - bokförd avskrivning")) return { ink2r: "3.9", ink2s: "4.9", sign: 1 }; // Specific adjustment 4.9
  if (c.includes("avskrivningar") || c.includes("av- och nedskrivningar")) return { ink2r: "3.9", ink2s: null, sign: 1 };
  
  // Financials
  if (c.includes("ränteintäkter") || c.includes("ränteintäkt") || c.includes("finansiell leasing - intäkt")) return { ink2r: "3.16", ink2s: null, sign: -1 };
  
  if (c.includes("intäktsränta på skattekontot")) return { ink2r: "3.16", ink2s: "4.5c", sign: -1 }; // Tax free
  
  if (c.includes("räntekostnader") || c.includes("räntekostnad") || c.includes("finansiell leasing - kostnad")) return { ink2r: "3.18", ink2s: null, sign: 1 };
  
  if (c.includes("kostnadsränta på skattekontot")) return { ink2r: "3.18", ink2s: "4.3c", sign: 1 }; // Non deductible

  if (c.includes("valutakursvinst")) return { ink2r: "3.16", ink2s: null, sign: -1 };
  if (c.includes("valutakursförlust")) return { ink2r: "3.18", ink2s: null, sign: 1 };
  
  if (c.includes("bankkostnader")) return { ink2r: "3.7", ink2s: null, sign: 1 }; 

  // Appropriations
  if (c.includes("koncernbidrag - mottagna")) return { ink2r: "3.20", ink2s: null, sign: -1 };
  if (c.includes("koncernbidrag - lämnade")) return { ink2r: "3.19", ink2s: null, sign: 1 };
  if (c.includes("periodiseringsfond - återföring")) return { ink2r: "3.21", ink2s: null, sign: -1 };
  if (c.includes("periodiseringsfond - avsättning")) return { ink2r: "3.22", ink2s: null, sign: 1 };
  if (c.includes("överavskrivning")) return { ink2r: "3.23", ink2s: null, sign: 1 }; // Depends on sign really, assume cost
  
  // Tax
  if (c.includes("skattekostnad")) return { ink2r: "3.25", ink2s: "4.3a", sign: 1 };
  
  // Specific Adjustments
  if (c.includes("ej avdragsgilla kostnader")) return { ink2r: "3.7", ink2s: "4.3c", sign: 1 };
  if (c.includes("ej skattepliktiga intäkter")) return { ink2r: "3.4", ink2s: "4.5c", sign: -1 };
  if (c.includes("särskild löneskatt")) return { ink2r: "3.7", ink2s: null, sign: 1 }; // Usually 3.7 or 3.8. 
  
  return { ink2r: null, ink2s: null, sign: 1 };
};

export function calculateInk2Data(
    accounts: Account[], 
    mappings: Record<string, MappingResult>, 
    annualReportData: AnnualReportAnalysis | null, 
    taxAdjustments: Record<string, TaxAdjustmentEntry> | undefined,
    manualOverrides: Record<string, number>
) {
    // 1. Initialize ALL fields with 0
    const fields: Record<string, number> = {};
    const allCodes = [
        "1.1", "1.2", "1.3", "1.4", "1.5", "1.6a", "1.6b", "1.7a", "1.7b", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13", "1.14", "1.15", "1.16",
        "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "2.15", "2.16", "2.17", "2.18", "2.19", "2.20", "2.21", "2.22", "2.23", "2.24", "2.25", "2.26",
        "2.27", "2.28", "2.29", "2.30", "2.31", "2.32", "2.33", "2.34", "2.35", "2.36", "2.37", "2.38", "2.39", "2.40", "2.41", "2.42", "2.43", "2.44", "2.45", "2.46", "2.47", "2.48", "2.49", "2.50",
        "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15",
        "3.16", "3.17", "3.18", "3.19", "3.20", "3.21", "3.22", "3.23", "3.24", "3.25", "3.26", "3.27",
        "4.1", "4.2", "4.3a", "4.3b", "4.3c", "4.4a", "4.4b", "4.5a", "4.5b", "4.5c", "4.6a", "4.6b", "4.6c", "4.6d", "4.6e",
        "4.7a", "4.7b", "4.7c", "4.7d", "4.7e", "4.7f", "4.8a", "4.8b", "4.8c", "4.8d", "4.9", "4.10", "4.11", "4.12", "4.13",
        "4.14a", "4.14b", "4.14c", "4.15", "4.16", "4.17", "4.18", "4.19", "4.20", "4.21", "4.22"
    ];

    // 2. Initialize fields with extracted data from Annual Report if available
    allCodes.forEach(c => {
        fields[c] = annualReportData?.financials?.[c] || 0;
    });

    // 3. Iterate Accounts to populate standard tax adjustments (4.x)
    let pensionBaseAccumulator = 0;

    accounts.forEach(acc => {
      const mapping = mappings[acc.accountNumber];
      const category = mapping?.suggestedCategory || "";
      const rawVal = parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.')) || 0;
      
      const { ink2s } = getInk2Field(category, acc.accountName, acc.accountNumber);
      
      // -- Primary Source: Global Tax Adjustments from Module --
      const specificAdjustment = taxAdjustments?.[acc.id];
      
      if (specificAdjustment && specificAdjustment.adjustmentAmount > 0) {
          // If specific adjustment exists (AI or Manual), add it to the specified code
          if (specificAdjustment.ink2sCode) {
               fields[specificAdjustment.ink2sCode] = (fields[specificAdjustment.ink2sCode] || 0) + specificAdjustment.adjustmentAmount;
          }
          // Also handle reversal (e.g. 4.5c for provisions)
          if (specificAdjustment.reversalCode && specificAdjustment.reversalAmount) {
              fields[specificAdjustment.reversalCode] = (fields[specificAdjustment.reversalCode] || 0) + specificAdjustment.reversalAmount;
          }
      } else {
          // -- Fallback: Standard logic based on account mapping category --
          // Only apply standard logic if NO specific adjustment overwrote it
          // But beware of double counting if specificAdjustment exists with amount 0 (meaning 'deductible')
          
          if (!specificAdjustment && ink2s) {
              fields[ink2s] = (fields[ink2s] || 0) + Math.abs(rawVal);
          }
      }
      
      // Special Logic: Pension Costs (3.8 includes pensions, but 4.21 needs just the pension part)
      if (category.toLowerCase().includes("pensionskostnader")) {
          pensionBaseAccumulator += Math.abs(rawVal);
          fields["4.21"] = (fields["4.21"] || 0) + Math.abs(rawVal);
      }
    });

    // Check for explicit pension override from the Global Pension Module
    const pensionModule = taxAdjustments?.['global_pension']?.pensionData;
    if (pensionModule && pensionModule.slpBasis !== undefined) {
        fields["1.4"] = pensionModule.slpBasis;
    } else {
        // Fallback to accumulated 74xx
        fields["1.4"] = manualOverrides["1.4"] !== undefined ? manualOverrides["1.4"] : pensionBaseAccumulator;
    }
    
    // Add GLOBAL adjustments (e.g. from Depreciation module 20-rule difference)
    Object.values(taxAdjustments || {}).forEach(adj => {
        if (adj.accountId.startsWith('global_') && adj.adjustmentAmount > 0 && adj.ink2sCode) {
             fields[adj.ink2sCode] = (fields[adj.ink2sCode] || 0) + adj.adjustmentAmount;
        }
    });

    // 4. Helper to get value with override priority
    const val = (code: string) => {
        if (manualOverrides[code] !== undefined) return manualOverrides[code];
        return fields[code] || 0;
    };
    
    // --- Calculated Fields (Resultaträkning) ---
    const sumRevenue = 
        val("3.1") + val("3.2") + val("3.3") + val("3.4") + 
        val("3.12") + val("3.13") + val("3.14") + val("3.15") + val("3.16") + 
        val("3.20") + val("3.21"); 

    const sumCost = 
        val("3.5") + val("3.6") + val("3.7") + val("3.8") + val("3.9") + val("3.10") + val("3.11") + 
        val("3.17") + val("3.18") + val("3.19") + val("3.22") + val("3.23") + val("3.24") + val("3.25");

    const result = sumRevenue - sumCost;
    
    let calculatedProfit = result >= 0 ? result : 0;
    let calculatedLoss = result < 0 ? Math.abs(result) : 0;

    fields["3.26"] = manualOverrides["3.26"] !== undefined ? manualOverrides["3.26"] : calculatedProfit;
    fields["3.27"] = manualOverrides["3.27"] !== undefined ? manualOverrides["3.27"] : calculatedLoss;

    // --- INK2S Flow ---
    if (manualOverrides["4.3a"] === undefined) {
        fields["4.3a"] = val("3.25");
    }

    // 4.1 comes from 3.26 (Profit)
    fields["4.1"] = manualOverrides["4.1"] !== undefined ? manualOverrides["4.1"] : val("3.26");
    
    // 4.2 comes from 3.27 (Loss)
    fields["4.2"] = manualOverrides["4.2"] !== undefined ? manualOverrides["4.2"] : val("3.27");

    // Sums for Tax Calculation
    const sum4_3 = val("4.3a") + val("4.3b") + val("4.3c");
    const sum4_4 = val("4.4a") + val("4.4b");
    const sum4_5 = val("4.5a") + val("4.5b") + val("4.5c");
    const sum4_6 = val("4.6a") + val("4.6b") + val("4.6c") + val("4.6d") + val("4.6e");
    
    const sumAdditions = val("4.7a") + val("4.7d") + val("4.7e") + val("4.8a") + val("4.8b") + val("4.10") + val("4.12") + val("4.13");
    const sumDeductions = val("4.7b") + val("4.7c") + val("4.7f") + val("4.8c") + val("4.8d") + val("4.11");
    
    // Calculate Tax Base strictly from INK2S fields
    // Formula: (4.1 - 4.2) + (Additions) - (Deductions)
    let taxBaseBeforeDeficit = (val("4.1") - val("4.2")) 
        + (sum4_3 + sum4_4) 
        - sum4_5 
        + sum4_6 
        + sumAdditions 
        - sumDeductions 
        + val("4.9");
    
    const effectiveDeficitDeduction = val("4.14a") - val("4.14b") - val("4.14c");
    let finalTaxBase = taxBaseBeforeDeficit - effectiveDeficitDeduction;

    if (manualOverrides["4.15"] !== undefined) {
        fields["4.15"] = manualOverrides["4.15"];
    } else {
        fields["4.15"] = finalTaxBase >= 0 ? finalTaxBase : 0;
    }

    if (manualOverrides["4.16"] !== undefined) {
        fields["4.16"] = manualOverrides["4.16"];
    } else {
        fields["4.16"] = finalTaxBase < 0 ? Math.abs(finalTaxBase) : 0;
    }

    // --- Page 1 Population ---
    fields["1.1"] = manualOverrides["1.1"] !== undefined ? manualOverrides["1.1"] : fields["4.15"];
    
    const deficitValue = fields["4.16"] + val("4.14c");
    fields["1.2"] = manualOverrides["1.2"] !== undefined ? manualOverrides["1.2"] : deficitValue;
    // 1.4 is already set above either via manual override or pension module logic

    // --- N9 Calculations ---
    const interestIncome = val("3.16");
    const interestExpense = val("3.18");
    const netInterest = interestIncome - interestExpense; 
    const taxEBITDA = (val("4.15") - val("4.16")) + interestExpense + val("3.9"); 
    
    const deductionCap30 = taxEBITDA > 0 ? taxEBITDA * 0.30 : 0;
    const deductionCapSafe = 5000000;
    
    const n9 = {
        netInterest,
        taxEBITDA,
        deductionCap30,
        deductionCapSafe
    };

    // --- Balansräkning Totals ---
    const sumAssets = 
        val("2.1") + val("2.2") + val("2.3") + val("2.4") + val("2.5") + val("2.6") + 
        val("2.7") + val("2.8") + val("2.9") + val("2.10") + val("2.11") + val("2.12") + 
        val("2.13") + val("2.14") + val("2.15") + val("2.16") + val("2.17") + val("2.18") + 
        val("2.19") + val("2.20") + val("2.21") + val("2.22") + val("2.23") + 
        val("2.24") + val("2.25") + val("2.26");

    const sumEquityAndLiabilities = 
        val("2.27") + val("2.28") + 
        val("2.29") + val("2.30") + 
        val("2.31") + val("2.32") + val("2.33") + val("2.34") + 
        val("2.35") + val("2.36") + val("2.37") + val("2.38") + val("2.39") + 
        val("2.40") + val("2.41") + val("2.42") + val("2.43") + val("2.44") + val("2.45") + 
        val("2.46") + val("2.47") + val("2.48") + val("2.49") + val("2.50");

    const finalFields = { ...fields, ...manualOverrides };

    return { fields: finalFields, n9, sumAssets, sumEquityAndLiabilities };
}
