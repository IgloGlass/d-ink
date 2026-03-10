
import { GoogleGenAI, Type } from "@google/genai";
import { Account, MappingResult, TaxAdjustmentEntry, AnnualReportAnalysis } from '../types';
import { TAX_CATEGORIES, SYSTEM_INSTRUCTION } from '../constants';
import { TAX_MODULE_PROMPTS, DEFAULT_TAX_PROMPT } from './taxModulePrompts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function mapAccounts(accounts: Account[], annualReportData?: AnnualReportAnalysis | null): Promise<MappingResult[]> {
  const model = "gemini-3-flash-preview";

  const accountsPayload = accounts.map(a => `${a.accountNumber} - ${a.accountName} (${a.type}) [IB: ${a.ib}, UB: ${a.ub}, YearEnd: ${a.yearEnd}]`);
  
  const prompt = `
    ${SYSTEM_INSTRUCTION}
    
    Here is the list of accounts to map:
    ${JSON.stringify(accountsPayload)}
    
    Annual Report Context (if available, use this to better understand the nature of accounts):
    ${annualReportData ? annualReportData.analysisMarkdown.substring(0, 2000) : "No annual report context available."}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              accountNumber: { type: Type.STRING },
              suggestedCategory: { type: Type.STRING, enum: TAX_CATEGORIES },
              reasoning: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["accountNumber", "suggestedCategory", "reasoning", "confidence"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error mapping accounts:", error);
    return [];
  }
}

export async function parseTrialBalance(text: string, fiscalYearEnd: string): Promise<Account[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert accountant parser. 
    Parse the following raw text which represents a trial balance (balans- och resultatrapport).
    Extract a list of accounts.
    
    Fiscal Year End to apply: ${fiscalYearEnd}
    
    Rules:
    1. Identify Account Number, Account Name, IB (Opening Balance), UB (Closing Balance).
    2. Determine if it is a 'balans' (Balance Sheet) or 'resultat' (Income Statement) account based on standard Swedish accounting (BAS-kontoplan).
       - Class 1, 2 = balans
       - Class 3, 4, 5, 6, 7, 8 = resultat
    3. IB and UB should be strings representing numbers (e.g. "-15000.50"). Clean formatting.
    
    Raw Text:
    ${text.substring(0, 30000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              accountNumber: { type: Type.STRING },
              accountName: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["balans", "resultat"] },
              ib: { type: Type.STRING },
              ub: { type: Type.STRING }
            },
            required: ["accountNumber", "accountName", "type", "ub"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((p: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      accountNumber: p.accountNumber,
      accountName: p.accountName,
      type: p.type as 'balans' | 'resultat',
      ib: p.ib || "0",
      ub: p.ub || "0",
      yearEnd: fiscalYearEnd
    }));

  } catch (error) {
    console.error("Error parsing trial balance:", error);
    return [];
  }
}

export async function parseExcelDataWithGemini(rows: any[][], fiscalYearEnd: string): Promise<Account[]> {
   const model = "gemini-3-flash-preview";
   
   const prompt = `
    I have raw data from an Excel file representing a Trial Balance.
    The data is an array of arrays (rows).
    Identify the columns for: Account Number, Account Name, IB, UB.
    Ignore header rows or empty rows.
    
    Fiscal Year End: ${fiscalYearEnd}
    
    Standard Swedish BAS chart of accounts logic:
    - Accounts starting with 1 or 2 are 'balans'.
    - Accounts starting with 3-8 are 'resultat'.
    
    Data:
    ${JSON.stringify(rows.slice(0, 200))}
   `;

   try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
               accountNumber: { type: Type.STRING },
               accountName: { type: Type.STRING },
               type: { type: Type.STRING, enum: ["balans", "resultat"] },
               ib: { type: Type.STRING },
               ub: { type: Type.STRING }
             },
             required: ["accountNumber", "accountName", "type", "ub"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        accountNumber: p.accountNumber,
        accountName: p.accountName,
        type: p.type,
        ib: p.ib,
        ub: p.ub,
        yearEnd: fiscalYearEnd
    }));
   } catch (error) {
     console.error("Error parsing excel:", error);
     return [];
   }
}

export async function performForensicAudit(pdfBase64: string): Promise<{ analysisMarkdown: string, currencyUnit: string, companyName?: string, orgNumber?: string, taxLosses?: number }> {
  const model = "gemini-3-pro-preview"; 
  
  const prompt = `
# System Instruction: SkatteJurist AI - Forensic Auditor

## Role
You are a **Senior Swedish Tax Attorney** and **Authorized Public Accountant** (Auktoriserad Revisor). Your task is to perform a comprehensive **Forensic Tax Due Diligence** on the provided Swedish Annual Report (*Årsredovisning*). 

## Objectives
You must analyze the document to extract critical company information and identify potential tax risks or adjustments required for the INK2 Corporate Income Tax Return.

## Requirements
1. **Language:** The output \`analysisMarkdown\` MUST be written in **ENGLISH**.
2. **Precision:** Use precise tax and accounting terminology.
3. **Completeness:** Ensure no major tax area (losses, interest, non-deductibles) is overlooked.

## Output Structure (JSON)
You must return a JSON object with the following fields:

1.  **companyName**: (String) The official name of the company.
2.  **orgNumber**: (String) The Swedish organization number (e.g., 556xxx-xxxx).
3.  **currencyUnit**: (String) The reporting currency found (e.g., "kSEK", "SEK", "MSEK").
4.  **taxLosses**: (Number) The amount of accumulated tax losses carried forward (*Balanserade underskott*) from the previous year. Look for this in the notes regarding "Deferred Tax" (*Uppskjuten skatt*) or "Tax" (*Skatt*). Return 0 if none found.
5.  **analysisMarkdown**: (String) A comprehensive markdown report covering:
    *   **Executive Summary**: Brief overview of the financial health and major tax findings.
    *   **Entity Verification**: Confirmation of company details and registered activity.
    *   **Tax Loss Analysis**: Detailed check of tax losses. **Crucial:** Explicitly mention if there have been any *ownership changes* (*ägarförändringar*) or *mergers* (*fusioner*) mentioned in the administration report (*förvaltningsberättelsen*) that could trigger the "Beloppsspärr" or "Koncernbidragsspärr".
    *   **Interest Deduction Analysis**: Analyze net interest income/expense. Identify if the company has significant intra-group interest or negative net interest that might be subject to EBITDA rules or the 5M SEK threshold.
    *   **Non-Deductible Expenses**: Scan for potential non-deductible items such as:
        *   Non-deductible entertainment (*Ej avdragsgill representation*).
        *   Gifts/Donations.
        *   Fines/Penalties (*Sanktionsavgifter*).
        *   Impairment of financial assets.
    *   **Tax Exempt Income**: Identify dividends from subsidiaries (*Näringsbetingade andelar*) or other tax-exempt income.
    *   **Untaxed Reserves**: Analyze changes in Tax Allocation Reserves (*Periodiseringsfonder*) or Excess Depreciation (*Överavskrivningar*).
    *   **Provisions**: Analyze provisions (*Avsättningar*) for warranty, pensions, etc., and their tax deductibility status.
    *   **Related Party Transactions**: Highlight any significant transactions with shareholders or group companies (Transfer Pricing risks).

## Input
A base64 encoded PDF of the Annual Report.
  `;

  try {
     const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: pdfBase64
                    }
                },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysisMarkdown: { type: Type.STRING },
                    currencyUnit: { type: Type.STRING },
                    companyName: { type: Type.STRING },
                    orgNumber: { type: Type.STRING },
                    taxLosses: { type: Type.NUMBER }
                },
                required: ["analysisMarkdown", "currencyUnit"]
            }
        }
     });
     return JSON.parse(response.text || "{}");
  } catch (error) {
      console.error("Forensic audit failed:", error);
      return { analysisMarkdown: "Analysis failed due to an error.", currencyUnit: "SEK" };
  }
}

export async function extractFinancialsFromReport(pdfBase64: string, currencyHint: string, accounts?: Account[]): Promise<Record<string, number>> {
    const model = "gemini-3-pro-preview";
    
    let accountContext = "";
    if (accounts && accounts.length > 0) {
        const simplifiedAccounts = accounts.map(a => `${a.accountNumber} ${a.accountName}: ${a.ub}`).join("\n");
        accountContext = `
        **REFERENCE TRIAL BALANCE (For Verification Only):**
        Use this data to cross-reference if the OCR from PDF is unclear.
        ${simplifiedAccounts.substring(0, 10000)}
        `;
    }

    const prompt = `
    # System Instruction: INK2R Data Extractor
    
    ## Role
    You are an expert Swedish Authorized Public Accountant tasked with extracting financial data from an Annual Report (*Årsredovisning*) to populate the **INK2 Tax Return (Page 2 & 3 - Balansräkning & Resultaträkning)**.

    ## Task
    Analyze the Balance Sheet (*Balansräkning*) and Income Statement (*Resultaträkning*) in the provided PDF. Extract the values for the **Current Fiscal Year** and map them to the specific INK2 field codes listed below.

    ## Context
    Currency Hint: ${currencyHint} (Note: Values in the report might be in kSEK or MSEK. You MUST convert them to **SEK units**. E.g., if the table says "Belopp i kSEK" and the value is "100", you must output 100000).

    ${accountContext}

    ## Fields to Extract (INK2 Codes)
    
    **Balance Sheet - Assets (Tillgångar)**
    2.1  Koncessioner, patent, licenser, goodwill
    2.2  Förskott avseende immateriella tillgångar
    2.3  Byggnader och mark
    2.4  Maskiner, inventarier och övriga mat. anl.
    2.5  Förbättringsutgifter på annans fastighet
    2.6  Pågående nyanläggningar (materiella)
    2.7  Andelar i koncernföretag (långfristiga)
    2.8  Andelar i intressebolag
    2.9  Ägarintressen i övriga företag (långfristiga)
    2.10 Fordringar hos koncernföretag (långfristiga)
    2.11 Lån till delägare/närstående
    2.12 Andra långfristiga fordringar
    2.13 Råvaror och förnödenheter
    2.14 Varor under tillverkning
    2.15 Färdiga varor och handelsvaror
    2.16 Övriga lagertillgångar
    2.17 Pågående arbeten för annans räkning (tillgång)
    2.18 Förskott till leverantörer
    2.19 Kundfordringar
    2.20 Fordringar hos koncernföretag (kortfristiga)
    2.21 Övriga fordringar
    2.22 Fakturerad men ej upparbetad intäkt
    2.23 Förutbetalda kostnader och upplupna intäkter
    2.24 Andelar i koncernföretag (kortfristiga)
    2.25 Övriga kortfristiga placeringar
    2.26 Kassa och bank

    **Balance Sheet - Equity & Liabilities (Eget Kapital & Skulder)**
    2.27 Bundet eget kapital (Aktiekapital, Reservfond, Uppskrivningsfond)
    2.28 Fritt eget kapital (Balanserat resultat + Årets resultat)
    2.29 Periodiseringsfonder
    2.30 Ackumulerade överavskrivningar
    2.31 Övriga obeskattade reserver
    2.32 Avsättningar för pensioner (Tryggandelagen)
    2.33 Övriga avsättningar för pensioner
    2.34 Övriga avsättningar (Garantier, tvister etc.)
    2.35 Obligationslån (Lång)
    2.36 Checkräkningskredit (Lång)
    2.37 Övriga skulder till kreditinstitut (Lång)
    2.38 Skulder till koncernföretag (Lång)
    2.39 Övriga skulder (Lång)
    2.40 Checkräkningskredit (Kort)
    2.41 Övriga skulder till kreditinstitut (Kort)
    2.42 Förskott från kunder
    2.43 Pågående arbeten för annans räkning (skuld)
    2.44 Fakturerad men ej upparbetad intäkt
    2.45 Leverantörskulder
    2.46 Växelskulder
    2.47 Skulder till koncernföretag (Kort)
    2.48 Övriga skulder (Kort)
    2.49 Skatteskulder
    2.50 Upplupna kostnader och förutbetalda intäkter

    **Income Statement (Resultaträkning)**
    3.1  Nettoomsättning
    3.2  Förändring av lager (produkter i arbete etc.)
    3.3  Aktiverat arbete för egen räkning
    3.4  Övriga rörelseintäkter
    3.5  Råvaror och förnödenheter
    3.6  Handelsvaror
    3.7  Övriga externa kostnader
    3.8  Personalkostnader
    3.9  Av- och nedskrivningar av materiella och immateriella anläggningstillgångar"
    3.10 Nedskrivningar av omsättningstillgångar
    3.11 Övriga rörelsekostnader
    3.12 Resultat från andelar i koncernföretag
    3.13 Resultat från andelar i intresseföretag
    3.14 Resultat från övriga företag (lång)
    3.15 Resultat från övriga finansiella anl.
    3.16 Övriga ränteintäkter och liknande
    3.17 Nedskrivningar av finansiella anl. (kort)
    3.18 Räntekostnader och liknande
    3.19 Lämnade koncernbidrag
    3.20 Mottagna koncernbidrag
    3.21 Återföring av periodiseringsfond
    3.22 Avsättning till periodiseringsfond
    3.23 Förändring av överavskrivningar
    3.24 Övriga bokslutsdispositioner
    3.25 Skatt på årets resultat
    3.26 Årets resultat, vinst
    3.27 Årets resultat, förlust

    ## Output Format
    Return a single JSON object where keys are the codes (e.g. "3.1") and values are the Numbers (float or int).
    Do NOT use string values for numbers.
    If a field is not found or is zero, omit it or set to 0.
    
    Example:
    {
      "3.1": 5000000,
      "3.7": 1200000,
      "2.26": 450000
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: {
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });
        const rawResult = JSON.parse(response.text || "{}");
        const simpleResult: Record<string, number> = {};
        
        // Sanitize result
        Object.keys(rawResult).forEach(key => {
            const item = rawResult[key];
            let numVal = 0;
            
            if (typeof item === 'object' && item !== null && 'value' in item) {
                numVal = typeof item.value === 'string' ? parseFloat(item.value.replace(/\s/g, '').replace(',', '.')) : item.value;
            } else if (typeof item === 'string') {
                numVal = parseFloat(item.replace(/\s/g, '').replace(',', '.'));
            } else if (typeof item === 'number') {
                numVal = item;
            }
            
            if (!isNaN(numVal)) {
                simpleResult[key] = numVal;
            }
        });
        
        return simpleResult;
    } catch (error) {
        console.error("Financial extraction failed:", error);
        return {};
    }
}

export async function extractHistoricalAcquisitions(files: {name: string, data: string}[]): Promise<{ year: string, amount: number, sourceSnippet?: string }[]> {
    const model = "gemini-3-pro-preview";

    const prompt = `
    Role: You are a Swedish Corporate Tax Expert.
    Task: Analyze the provided Annual Reports (PDFs) to find historical acquisition costs for the "20-rule" calculation (Kompletteringsregeln).

    Target Data:
    Look for the Notes (Noter) section, specifically for "Materiella anläggningstillgångar" or "Inventarier, verktyg och installationer" (Equipment, Tools, Installations).
    Find the table showing changes in acquisition value (Anskaffningsvärden).
    Extract the "Årets inköp" / "Årets anskaffningar" (Purchases/Acquisitions for the year) for the fiscal year that the report covers.
    
    IMPORTANT:
    - Identify the fiscal year of the report (e.g., 2022, 2023).
    - Provide a short "sourceSnippet" verification text, e.g., "Found 500 kSEK in Note 4 of Annual Report 2022".
    - Ensure the amount is the gross acquisition cost (Anskaffningsvärde) added during that year.

    Input: Multiple PDF files representing different fiscal years.
    
    Output: A JSON array containing the year, the acquisition amount found, and the source snippet.
    Format: [{ "year": "2023", "amount": 50000, "sourceSnippet": "Found 50k in Note 3..." }, ...]
    If a year is not found, do not include it.
    `;

    const parts = files.map(f => ({
        inlineData: {
            mimeType: "application/pdf",
            data: f.data
        }
    }));

    parts.push({ text: prompt } as any);

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts }, 
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            year: { type: Type.STRING },
                            amount: { type: Type.NUMBER },
                            sourceSnippet: { type: Type.STRING }
                        },
                        required: ["year", "amount"]
                    }
                }
            }
        });

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Historical extraction failed:", error);
        return [];
    }
}

// Helper to construct schemas dynamically
const getSchemaForModule = (moduleType: string) => {
    const baseProperties: any = {
        accountId: { type: Type.STRING },
        adjustmentAmount: { type: Type.NUMBER },
        ink2sCode: { type: Type.STRING },
        reversalAmount: { type: Type.NUMBER },
        reversalCode: { type: Type.STRING },
        aiReasoning: { type: Type.STRING },
        manualOverride: { type: Type.BOOLEAN }
    };

    let specificProps: any = {};

    switch (moduleType) {
        case 'yield_risk_tax':
            specificProps.yieldTaxData = {
                type: Type.OBJECT,
                properties: {
                    bookedExpense: { type: Type.NUMBER },
                    pensionProvisionsBase: { type: Type.NUMBER },
                    foreignPensionBase: { type: Type.NUMBER },
                    foreignEndowmentBase: { type: Type.NUMBER },
                    renewableElectricityKwh: { type: Type.NUMBER },
                    riskTaxBase: { type: Type.NUMBER },
                    priorYearError: { type: Type.BOOLEAN }
                }
            };
            break;
        case 'interest_deduction':
            specificProps.interestDeductionData = {
                type: Type.OBJECT,
                properties: {
                    targetedRuleAdjustment: { type: Type.NUMBER },
                    useSimplificationRule: { type: Type.BOOLEAN },
                    allocatedSimplificationAmount: { type: Type.NUMBER },
                    transferredDeductionCapacity: { type: Type.NUMBER },
                    manualTaxEBITDAOverride: { type: Type.NUMBER },
                    remainingNegativeInterest: { type: Type.NUMBER }
                }
            };
            break;
        case 'tax_losses_carried_forward':
            specificProps.taxLossesData = {
                type: Type.OBJECT,
                properties: {
                    openingLoss: { type: Type.NUMBER },
                    ownershipChange: { type: Type.BOOLEAN },
                    merger: { type: Type.BOOLEAN },
                    acquisitionPrice: { type: Type.NUMBER },
                    amountBlockExtinguished: { type: Type.NUMBER },
                    gcBlocked: { type: Type.NUMBER },
                    mergerBlocked: { type: Type.NUMBER },
                    unblocked: { type: Type.NUMBER }
                }
            };
            break;
        case 'ledger_to_result':
            specificProps.ledgerToResultData = {
                type: Type.OBJECT,
                properties: {
                    profitBeforeTaxGL: { type: Type.NUMBER },
                    profitBeforeTaxAnnualReport: { type: Type.NUMBER },
                    discrepancy: { type: Type.NUMBER },
                    taxExpense: { type: Type.NUMBER },
                    netResult: { type: Type.NUMBER },
                    notes: { type: Type.STRING }
                }
            };
            break;
        case 'provisions':
            specificProps.provisionData = {
                type: Type.OBJECT,
                properties: {
                    status: { type: Type.STRING, enum: ['Deductible', 'Non-Deductible'] },
                    riskAssessment: { type: Type.STRING, enum: ['High Risk', 'Standard'] },
                    ib: { type: Type.NUMBER },
                    ub: { type: Type.NUMBER }
                }
            };
            break;
        case 'buildings_improvements':
            specificProps.buildingDepreciationData = {
                type: Type.OBJECT,
                properties: {
                    assets: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                category: { type: Type.STRING, enum: ['Building', 'Land Improvement', 'Leasehold Improvement'] },
                                description: { type: Type.STRING },
                                taxAcquisitionValue: { type: Type.NUMBER },
                                bookedDepreciation: { type: Type.NUMBER },
                                taxRate: { type: Type.NUMBER },
                                calculatedTaxDepreciation: { type: Type.NUMBER },
                                isExtendedRepair: { type: Type.BOOLEAN },
                                aiReasoning: { type: Type.STRING }
                            }
                        }
                    },
                    totalAdjustment49: { type: Type.NUMBER }
                }
            };
            break;
        case 'nondeductible_expenses':
            specificProps.nonDeductibleData = {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['Representation', 'Gifts', 'Fines', 'Consulting', 'Sponsorship', 'TaxInterest', 'Membership', 'Other'] },
                    presumption: { type: Type.STRING, enum: ['Deductible', 'Non-Deductible'] },
                    deductiblePercentage: { type: Type.NUMBER },
                    nonDeductibleAmount: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                }
            };
            break;
        case 'pension_costs':
            specificProps.pensionData = {
                type: Type.OBJECT,
                properties: {
                    totalPensionCosts: { type: Type.NUMBER },
                    specialEmployerContributionBasis: { type: Type.NUMBER },
                    negativeBasisAdjustment: { type: Type.NUMBER },
                    nonDeductibleAmount: { type: Type.NUMBER },
                    hasCapitalInsuranceOrExcess: { type: Type.BOOLEAN }
                }
            };
            break;
        case 'depreciation_tangible':
            specificProps.depreciationData = {
                type: Type.OBJECT,
                properties: {
                    method: { type: Type.STRING, enum: ['main', 'alternative', 'residual'] },
                    ibTaxValue: { type: Type.NUMBER },
                    currentAcquisitions: { type: Type.NUMBER },
                    disposalProceeds: { type: Type.NUMBER },
                    historicalAcquisitions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                yearLabel: { type: Type.STRING },
                                acquisitionCost: { type: Type.NUMBER },
                                multiplier: { type: Type.NUMBER },
                                sourceSnippet: { type: Type.STRING }
                            }
                        }
                    },
                    isFusionsGoodwill: { type: Type.BOOLEAN }
                }
            };
            break;
        case 'shares_dividends':
            specificProps.shareData = {
                type: Type.OBJECT,
                properties: {
                    holdings: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                amount: { type: Type.NUMBER },
                                type: { type: Type.STRING },
                                category: { type: Type.STRING },
                                salesPrice: { type: Type.NUMBER },
                                avgCostAmount: { type: Type.NUMBER }
                            }
                        }
                    },
                    fundValueJan1: { type: Type.NUMBER },
                    savedCapitalLosses: { type: Type.NUMBER }
                }
            };
            break;
        case 'real_estate_tax':
            specificProps.realEstateTaxData = {
                type: Type.OBJECT,
                properties: {
                    properties: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                type: { type: Type.STRING },
                                description: { type: Type.STRING },
                                taxAssessmentValue: { type: Type.NUMBER },
                                apartments: { type: Type.NUMBER },
                                isNewBuild: { type: Type.BOOLEAN },
                                taxRate: { type: Type.NUMBER },
                                calculatedTax: { type: Type.NUMBER }
                            }
                        }
                    },
                    bookedExpense: { type: Type.NUMBER },
                    adjustment43c: { type: Type.NUMBER }
                }
            };
            break;
        case 'warranty_provisions':
            specificProps.warrantyData = {
                type: Type.OBJECT,
                properties: {
                    groups: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                warrantyMonths: { type: Type.NUMBER },
                                actualCosts: { type: Type.NUMBER },
                                bookedProvision: { type: Type.NUMBER },
                                isRealized: { type: Type.BOOLEAN }
                            }
                        }
                    },
                    priorYearNonDeductible: { type: Type.NUMBER }
                }
            };
            break;
        case 'imputed_income':
            specificProps.taxAllocationReserveData = {
                type: Type.OBJECT,
                properties: {
                    totalOpeningBalance: { type: Type.NUMBER },
                    fiscalYear: { type: Type.NUMBER },
                    interestRate: { type: Type.NUMBER },
                    calculatedImputedIncome: { type: Type.NUMBER }
                }
            };
            break;
        case 'inventory_obsolescence':
            specificProps.inventoryObsolescenceData = {
                type: Type.OBJECT,
                properties: {
                    acquisitionValue: { type: Type.NUMBER },
                    bookedReserve: { type: Type.NUMBER },
                    valuationMethod: { type: Type.STRING, enum: ['alternative', 'main'] },
                    priorYearNonDeductible: { type: Type.NUMBER }
                }
            };
            break;
        case 'capital_assets_value':
            specificProps.treatmentType = { type: Type.STRING };
            break;
        case 'nontaxable_income':
            specificProps.nonTaxableData = {
                type: Type.OBJECT,
                properties: {
                    isTaxAccountInterest: { type: Type.BOOLEAN },
                    isTaxRefund: { type: Type.BOOLEAN },
                    isAckord: { type: Type.BOOLEAN },
                    insolvencyConfirmed: { type: Type.BOOLEAN },
                    openingDeficit: { type: Type.NUMBER }
                }
            };
            break;
        default:
            // Standard adjustment fields only
            break;
    }

    return {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: { ...baseProperties, ...specificProps },
            required: ["accountId", "adjustmentAmount", "aiReasoning"]
        }
    };
};

export async function analyzeTaxAdjustments(accounts: Account[], mappingType: string, annualReportData?: AnnualReportAnalysis | null): Promise<TaxAdjustmentEntry[]> {
    const model = "gemini-3-flash-preview";

    // Use the modular prompt registry
    const systemInstruction = TAX_MODULE_PROMPTS[mappingType] || DEFAULT_TAX_PROMPT;

    const prompt = `
    ${systemInstruction}
    
    Annual Report Context:
    ${annualReportData ? annualReportData.analysisMarkdown.substring(0, 10000) : "No full context."}
    
    Data to Analyze:
    ${JSON.stringify(accounts.map(a => ({ 
        id: a.id, 
        num: a.accountNumber, 
        name: a.accountName, 
        val: a.ub,
        ib: a.ib,
        type: a.type,
        yearEnd: a.yearEnd
    })))}

    Output:
    Return a JSON array of adjustment objects based on the specific module schema.
    Ensure "adjustmentAmount" is always a number (0 if none).
    `;

    const dynamicSchema = getSchemaForModule(mappingType);

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicSchema
            }
        });

        // Safe parse
        const text = response.text || "[]";
        let results = [];
        try {
            results = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parsing Error", e);
            // Fallback: try to find array in text
            const arrayMatch = text.match(/\[.*\]/s);
            if (arrayMatch) {
                try {
                    results = JSON.parse(arrayMatch[0]);
                } catch (e2) {
                    console.error("Fallback JSON Parse Error", e2);
                    return [];
                }
            } else {
                return [];
            }
        }

        // Map back ensuring structure matches what TaxAdjustmentEntry expects (optional fields undefined)
        return results.map((r: any) => ({
            accountId: r.accountId,
            accountNumber: "", // Populated by consumer
            adjustmentAmount: r.adjustmentAmount || 0,
            ink2sCode: r.ink2sCode || "",
            manualOverride: false,
            aiReasoning: r.aiReasoning || "",
            reversalAmount: r.reversalAmount,
            reversalCode: r.reversalCode,
            // Only map properties that exist in the result
            ...r
        }));

    } catch (e) {
        console.error("Error analyzing tax adjustments", e);
        return [];
    }
}
