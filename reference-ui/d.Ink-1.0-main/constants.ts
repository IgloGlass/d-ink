
// Master Data from Silverfin Integration
export const SILVERFIN_DATA = [
  // Balansräkning
  { type: 'balans', name: "Ej skattesensitiv - balans", number: "100000" },
  { type: 'balans', name: "Materiella och förvärvade immateriella tillgångar - Ingående/Utgående balans", number: "102000" }, // Fixed double space
  { type: 'balans', name: "Byggnader - Anskaffningsvärde", number: "111000" },
  { type: 'balans', name: "Markanläggningar - Anskaffningsvärde", number: "115000" }, // Fixed typo Markanlägngingar
  { type: 'balans', name: "Nyttjanderättshavares förbättringar - Anskaffningsvärde", number: "123200" },
  { type: 'balans', name: "Aktier och andelar - Generell balanspost", number: "131000" },
  { type: 'balans', name: "Värdeförändring och nedskrivningar på kapitaltillgångar - Balansposter", number: "138400" },
  { type: 'balans', name: "Kapitalförsäkring", number: "138500" },
  { type: 'balans', name: "Lager - Anskaffningskostnad", number: "141000" },
  { type: 'balans', name: "Lager - Inkuransreservering", number: "141900" },
  { type: 'balans', name: "Osäkra kundfordringar", number: "151500" },
  { type: 'balans', name: "Periodiseringsfond", number: "211000" },
  { type: 'balans', name: "Överavskrivningar - M&I", number: "215000" },
  { type: 'balans', name: "Underlag för avkastningsskatt", number: "221000" },
  { type: 'balans', name: "Garantiavsättning", number: "222000" },
  { type: 'balans', name: "Övriga reserveringar", number: "229000" },
  { type: 'balans', name: "Fastighetsskatt och fastighetsavgift", number: "251300" }, // Removed trailing space
  { type: 'balans', name: "Upplupen särskild löneskatt på pensionskostnader", number: "294300" },
  { type: 'balans', name: "Upplupen avkastningsskatt på pensionskostnader", number: "294400" },

  // Resultaträkning
  { type: 'resultat', name: "Finansiella lagertillgångar - Utdelning", number: "367200" }, // Removed trailing space
  { type: 'resultat', name: "Finansiella lagertillgångar - Kapitalvinst/förlust", number: "367000" },
  { type: 'resultat', name: "Värdeförändring och nedskrivningar på kapitaltillgångar", number: "394000" },
  { type: 'resultat', name: "Restvärdesavskrivning", number: "397000" },
  { type: 'resultat', name: "Byggnader och mark - kapitalvinst", number: "397200" },
  { type: 'resultat', name: "Byggnader och mark - kapitalförlust", number: "797200" },
  { type: 'resultat', name: "Erhållna bidrag och gåvor - ej skattepliktiga", number: "399300" },
  { type: 'resultat', name: "Ackordsvinst - ej skattepliktig", number: "399500" },
  { type: 'resultat', name: "Fastighetsskatt och fastighetsavgift", number: "519100" }, // Removed trailing space
  { type: 'resultat', name: "Bidrag och gåvor - presumtion avdragsgill", number: "598000" },
  { type: 'resultat', name: "Bidrag och gåvor - presumtion ej avdragsgill", number: "699300" },
  { type: 'resultat', name: "Representation - intern och extern - presumtion avdragsgill", number: "607100" },
  { type: 'resultat', name: "Representation - intern och extern - presumtion ej avdragsgill", number: "607200" },
  { type: 'resultat', name: "Sanktionsavgifter och böter", number: "634200" },
  { type: 'resultat', name: "Garantiavsättningar - Förändring av garantiavsättning", number: "636100" },
  { type: 'resultat', name: "Garantiavsättningar - Faktiska garantikostnader", number: "636200" },
  { type: 'resultat', name: "Konsultarvoden", number: "655000" },
  { type: 'resultat', name: "Ränta - Bankkostnader", number: "657000" },
  { type: 'resultat', name: "Övriga ej avdragsgilla kostnader", number: "690000" },
  { type: 'resultat', name: "Föreningsavgifter - presumtion avdragsgill", number: "698100" },
  { type: 'resultat', name: "Föreningsavgifter - presumtion ej avdragsgill", number: "698200" },
  { type: 'resultat', name: "Pensionskostnader och underlag för särskild löneskatt ", number: "740000" }, // Added trailing space
  { type: 'resultat', name: "Särskild löneskatt", number: "753000" },
  { type: 'resultat', name: "Sjuk- och hälsovård - presumtion avdragsgill", number: "762200" },
  { type: 'resultat', name: "Sjuk- och hälsovård - presumtion ej avdragsgill", number: "762300" },
  { type: 'resultat', name: "Byggnader - bokförd avskrivning", number: "777000" },
  { type: 'resultat', name: "Markanläggningar - bokförd avskrivning", number: "782400" },
  { type: 'resultat', name: "Förbättringsutgifter på annans fastighet - bokförd avskrivning", number: "784000" },
  { type: 'resultat', name: "Kapitaltillgångar (aktier och andelar) - Utdelning", number: "801000" },
  { type: 'resultat', name: "Kapitaltillgångar (aktier och andelar) - Kapitalvinst/förlust", number: "802000" },
  { type: 'resultat', name: "Kapitaltillgångar (aktier och andelar) - Orealiserade värdeförändringar", number: "808000" }, // Removed trailing space
  { type: 'resultat', name: "Ränta - Ränteintäkt", number: "831000" },
  { type: 'resultat', name: "Intäktsränta på skattekontot", number: "831400" },
  { type: 'resultat', name: "Kostnadsränta på skattekontot ", number: "842300" }, // Added trailing space
  { type: 'resultat', name: "Ränta - valutakursvinst", number: "843100" },
  { type: 'resultat', name: "Ränta - valutakursförlust", number: "843600" },
  { type: 'resultat', name: "Ränta - finansiell leasing - intäkt", number: "521200" },
  { type: 'resultat', name: "Ränta - finansiell leasing - kostnad", number: "522200" },
  { type: 'resultat', name: "Ränta - Räntekostnad", number: "849000" },
  { type: 'resultat', name: "Periodiseringsfond - årets förändring (nettoredovisning)", number: "881000" },
  { type: 'resultat', name: "Periodiseringsfond - avsättning", number: "881100" },
  { type: 'resultat', name: "Periodiseringsfond - återföring", number: "881900" },
  { type: 'resultat', name: "Koncernbidrag - mottagna", number: "882000" },
  { type: 'resultat', name: "Koncernbidrag - lämnade", number: "883000" },
  { type: 'resultat', name: "Överavskrivning", number: "885000" },
  { type: 'resultat', name: "Skattekostnad", number: "891000" },
  { type: 'resultat', name: "Årets vinst/förlust", number: "940000" },
  { type: 'resultat', name: "Ej skattesensitiv - resultat", number: "950000" },
];

export const BS_TAX_CATEGORIES = SILVERFIN_DATA.filter(d => d.type === 'balans').map(d => d.name);
export const IS_TAX_CATEGORIES = SILVERFIN_DATA.filter(d => d.type === 'resultat').map(d => d.name);

// Helper to look up number by name
export const getSilverfinNumber = (name: string, type?: string): string => {
  const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  const target = normalize(name);
  
  let found = SILVERFIN_DATA.find(d => normalize(d.name) === target && (type ? d.type === type : true));
  
  // Fallback if strict type check fails
  if (!found && type) {
    found = SILVERFIN_DATA.find(d => normalize(d.name) === target);
  }
  return found ? found.number : "";
};

// Combine all tax categories for use in the prompt
export const TAX_CATEGORIES = [...BS_TAX_CATEGORIES, ...IS_TAX_CATEGORIES];

export const SYSTEM_INSTRUCTION = `
You are a tax account mapping assistant specialised in Swedish corporate income tax. Your task is to map account numbers and names to certain tax categories. You have been fine-tuned on a dataset mapping company account numbers and account names to specific tax categories. You should be very careful with what tax categories you pick for each account. Use your fine-tuning data and general Swedish corporate income tax knowledge to make choices, but do not hallucinate and choose "Ej skattesensitiv - Balans" or "Ej skattesensitiv - Resultat" if you are not sure of any proper mapping.

Below is the complete and limited list of valid tax categories you must use. You should only assign categories from these lists. For Balance Sheet accounts, only assign tax categories from the balance sheet list. For Income Statement Accounts, only assign tax categories from the Income Statement list.

Balance Sheet tax category list: 
Ej skattesensitiv - balans
Materiella och förvärvade immateriella tillgångar  - Ingående/Utgående balans
Byggnader - Anskaffningsvärde
Markanläggningar - Anskaffningsvärde
Nyttjanderättshavares förbättringar - Anskaffningsvärde
Aktier och andelar - Generell balanspost
Värdeförändring och nedskrivningar på kapitaltillgångar - Balansposter
Kapitalförsäkring
Lager - Anskaffningskostnad
Lager - Inkuransreservering
Osäkra kundfordringar
Periodiseringsfond
Överavskrivningar - M&I
Underlag för avkastningsskatt
Garantiavsättning
Övriga reserveringar
Fastighetsskatt och fastighetsavgift
Upplupen särskild löneskatt på pensionskostnader
Upplupen avkastningsskatt på pensionskostnader

Income Statement Tax Category list. 
Ej skattesensitiv - resultat
Finansiella lagertillgångar - Kapitalvinst/förlust
Finansiella lagertillgångar - Utdelning
Värdeförändring och nedskrivningar på kapitaltillgångar
Restvärdesavskrivning
Byggnader och mark - kapitalvinst
Byggnader och mark - kapitalförlust
Erhållna bidrag och gåvor - ej skattepliktiga
Ackordsvinst - ej skattepliktig
Fastighetsskatt och fastighetsavgift
Bidrag och gåvor - presumtion avdragsgill
Bidrag och gåvor - presumtion ej avdragsgill
Representation - intern och extern - presumtion avdragsgill
Representation - intern och extern - presumtion ej avdragsgill
Sanktionsavgifter och böter
Garantiavsättningar - Förändring av garantiavsättning
Garantiavsättningar - Faktiska garantikostnader
Konsultarvoden
Ränta - Bankkostnader
Övriga ej avdragsgilla kostnader
Föreningsavgifter - presumtion avdragsgill
Föreningsavgifter - presumtion ej avdragsgill
Pensionskostnader och underlag för särskild löneskatt 
Särskild löneskatt
Sjuk- och hälsovård - presumtion avdragsgill
Sjuk- och hälsovård - presumtion ej avdragsgill
Byggnader - bokförd avskrivning
Markanläggningar - bokförd avskrivning
Förbättringsutgifter på annans fastighet - bokförd avskrivning
Kapitaltillgångar (aktier och andelar) - Utdelning
Kapitaltillgångar (aktier och andelar) - Kapitalvinst/förlust
Kapitaltillgångar (aktier och andelar) - Orealiserade värdeförändringar
Ränta - Ränteintäkt
Intäktsränta på skattekontot
Kostnadsränta på skattekontot 
Ränta - valutakursvinst
Ränta - valutakursförlust
Ränta - finansiell leasing - intäkt
Ränta - finansiell leasing - kostnad
Ränta - Räntekostnad
Periodiseringsfond - årets förändring (nettoredovisning)
Periodiseringsfond - avsättning
Periodiseringsfond - återföring
Koncernbidrag - mottagna
Koncernbidrag - lämnade
Överavskrivning
Skattekostnad
Årets vinst/förlust

Instructions:
- I will provide you with a list of account numbers and account names, opening and closing balance, financial year, as well as whether they are Balance Sheet or Income Statement accounts.
- For each account, assign the correct tax category from the list above.
- Use your fine-tuned knowledge primarily.
- If uncertain, use your general knowledge of Swedish corporate income tax law to choose the best matching category. 
- Do not invent or use any categories outside the list.
- Output the results as a table that can be copied and pasted to Excel. 
- Confirm that you have received the instructions properly and are ready to begin assessing accounts. 

Guidelines: 
- In the balance sheet, "balanserad utgift"(capitalized expenditure) and associated depreciation are not tax sensitive and should be mapped as such. However, if data suggests that the account is rather concerns building acquisition costs or similar, then map the account to the more specific Silverfin account category. 
- In the balance sheet, we do not map building depreciation, land improvement depreciation, or leasehold improvement depreciations. Building, land improvement and leasehold improvement depreciations are only mapped in the Income Statement. In the balance sheet, they should be mapped as "Ej skattesensitiv - balans". This is because only the closing balance of the balance sheet accounts is compared to the depreciation in the income statement.
- In the balance sheet, land (sw: "mark") cannot be depreciated since it does not lose value. This follows from general accounting knowledge. Land should therefore be mapped as tax-non sensitive.  
- In the balance sheet, accounts such as "accumulated depreciation" (ackumulerad avskrivning) are mapped as "Materiella och förvärvade immateriella tillgångar - Ingående/Utgående balans" and not "Överavskrivningar - M&I", which is only used for Excess Depreciation (Överavskrivningar) and not general accumulated depreciations. 
- In the balance sheet, WIP or "pågående projekt" or similar are not depreciated and should therefore only be mapped as "Ej skattesensitiv - balans". 
- In the Balance Sheet, accounts concerning accruals and provisions ("reserveringar" and "avsättningar" in Swedish) should generally be mapped as "Övriga reserveringar". For example, if there is "accrued", "provision", "reservering", "avsättning" or similar in the account name, it should likely be mapped as "Övriga reserveringar."
- In the balance sheet, accrued expenses for property tax or similar should be mapped as "Fastighetsskatt och fastighetsavgift" and not general accruals ("Övriga reserveringar") since property tax is more specific. 
- On the other hand, a "group contribution receivable" or similar in the balance sheet should likely not be mapped as "övriga reserveringar".  
- In the balance sheet, intra-group receivables may be mapped a "Värdeförändring och nedskrivningar på kapitaltillgångar - Balansposter" if the closing balance is lower than the opening balance, in which case we must check whether the company has recorded a non-deductible impairment.
- In the balance sheet, "estimated special employer's contribution" or similar such as "löneskatt innevarande år" should generally be mapped as "upplupen särskild löneskatt på pensionskostnader". This does not mean that all balance sheet liabilities for special employer's contribution should be mapped as such, they must still concern provisions/accruals (reservering/upplupen), etc. 
- In the balance sheet, no account should be mapped as "Årets vinst/förlust", that category is only used in the Income Statement. 
- In the balance sheet, accounts concerning "bad debt" or "osäkra kundfordringar" or similar should be mapped as "Osäkra kundfordringar". Accounts concerning "kundfordringar" or "accounts receivable" or similar in general are not tax sensitive and should not be mapped as bad debt. However, "tvistiga kundfordringar" "dubious receivables" or similar such as "revaluation" may still be prudently mapped as "Osäkra kundfordringar".  
- In the income statement, accounts concerning leasing costs should generally be mapped as "Ränta - finansiell leasing - kostnad". 
- For recorded inventory (i.e., PP&E and not Building or Land Improvements) depreciation costs in the income statement, the tax category should be "Restvärdesavskrivning" and not the balance sheet category "Materiella och förvärvade immateriella tillgångar", which should only be used for balance sheet assets. 
- Building and Land Improvement depreciation costs in the income statement should still be mapped as "Byggnader - bokförd avskrivning" and "Markanläggningar - bokförd avskrivning", respectively.
- Please make sure to differentiate between recorded depreciation for building and general maintenance costs for the building. Maintenance costs and similar should be mapped as "Ej skattesensitiv - Resultat" while Building costs that are depreciated should be mapped as "Byggnader - bokförd avskrivning". 
- In the income statement, COGS, costs for sold goods, "kostnad sålda varor", "kostn, avskrivn (kostnad sålda varor)" or "försäljningskostnad avskrivning" in Swedish or similar is not tax sensitive and never mapped as depreciation. Such accounts or similar should be mapped as "Ej skattesensitiv - resultat". 
- In the Income Statement, costs that are specifically for special employer's contribution (the tax itself) should be mapped as "Särskild löneskatt". Costs for pensions that form the basis for special employer's contribution (but not the tax itself) should be mapped as "Pensionskostnader och underlag för särskild löneskatt". Remember that the tax category mapping "upplupen särskild löneskatt på pensionskostnader" should only be used for accounts in the balance sheet. 
- In the income statements, Legal fees or Consultant fees are only non-tax deductible if they concern assistance with income tax, for example preparing an income tax return. This means that accounts named Legal Fees, or Consultant Fees in general (or e.g. Tax Assistance in particular) should be mapped as "Konsultarvoden", but consultant costs related to IT or similar should be mapped as "Ej skattesensitiv - resultat". Sometimes tax assistance fees may be hidden in accounts like "accounting fees" so take a prudent approach. 
- In the income statements, when accounts are named "partially deductible" or similar in Swedish, for example "Entertainment - Partially tax deductible", you should generally take a prudent approach and map it as tax sensitive, in the example "Representation - intern och extern - presumtion ej avdragsgill".
- "Social contributions", "social fees", "arbetsgivaravgifter" or similar concerns wage tax, which should be mapped as "Ej skattesensitiv - resultat" for income statements accounts. You must differentiate this from acocunts concerning "special employer's contribution" or "särskild löneskatt" or similar which should still be mapped as "Särskild löneskatt". 
- This does not mean that all salary costs should med mapped as "Pensionskostnader och underlag för särskild löneskatt". Most salary/employment costs are non-tax sensitive and should be mapped as "Ej skattesensitiv - resultat". 
- In the Income Statement, remember that interest income on the tax account should be mapped as "Intäktsränta på skattekontot" and conversely, interest costs on the tax account should be mapped as "Kostnadsränta på skattekontot". Interest income on the tax account can often be called "tax exempt" and interest costs on the tax account can be called "non-deductible" in the account names. 
- In the income statements, banking costs ("Bankkostnader") or similar should generally be mapped as "Ränta - Bankkostnader", even if it does not have the expected account number for interest costs. 
- In the income statement, foreign exchange gains/losses and other Fx effects should generally be mapped as "Ränta - valutakursvinst" or "Ränta - valutakursförlust" even if the account number indicates that it is an operating item and not financial. This is because they are included in net interest deduction calculations.
`;

export const EXAMPLE_ACCOUNTS = [
  // Assets (Total 543,000 + 150,000 + 100,000 - 30,000 = 763,000)
  { accountNumber: "1220", accountName: "Inventarier och verktyg", type: "balans", ib: "100000", ub: "100000", yearEnd: "2024-12-31" },
  { accountNumber: "1229", accountName: "Ackumulerade avskrivningar på inventarier", type: "balans", ib: "-10000", ub: "-30000", yearEnd: "2024-12-31" }, 
  { accountNumber: "1510", accountName: "Kundfordringar", type: "balans", ib: "100000", ub: "150000", yearEnd: "2024-12-31" },
  { accountNumber: "1930", accountName: "Företagskonto", type: "balans", ib: "200000", ub: "543000", yearEnd: "2024-12-31" },

  // Equity & Liabilities (Total -50 - 200 - 80 - 40 + 30 = -340,000)
  { accountNumber: "2081", accountName: "Aktiekapital", type: "balans", ib: "-50000", ub: "-50000", yearEnd: "2024-12-31" },
  { accountNumber: "2091", accountName: "Balanserad vinst", type: "balans", ib: "-200000", ub: "-200000", yearEnd: "2024-12-31" },
  { accountNumber: "2440", accountName: "Leverantörsskulder", type: "balans", ib: "-140000", ub: "-80000", yearEnd: "2024-12-31" },
  { accountNumber: "2610", accountName: "Utgående moms, oredovisad", type: "balans", ib: "0", ub: "-40000", yearEnd: "2024-12-31" },
  { accountNumber: "2640", accountName: "Ingående moms, oredovisad", type: "balans", ib: "0", ub: "30000", yearEnd: "2024-12-31" },

  // Resultat (Total -423,000)
  { accountNumber: "3001", accountName: "Försäljning varor 25% moms", type: "resultat", ib: "0", ub: "-1500000", yearEnd: "2024-12-31" },
  { accountNumber: "3041", accountName: "Försäljning tjänst 25% moms", type: "resultat", ib: "0", ub: "-500000", yearEnd: "2024-12-31" },
  { accountNumber: "4010", accountName: "Varukostnader", type: "resultat", ib: "0", ub: "600000", yearEnd: "2024-12-31" },
  { accountNumber: "5010", accountName: "Lokalhyra", type: "resultat", ib: "0", ub: "120000", yearEnd: "2024-12-31" },
  { accountNumber: "5410", accountName: "Förbrukningsinventarier", type: "resultat", ib: "0", ub: "25000", yearEnd: "2024-12-31" },
  { accountNumber: "6210", accountName: "Telekommunikation", type: "resultat", ib: "0", ub: "15000", yearEnd: "2024-12-31" },
  { accountNumber: "6570", accountName: "Bankkostnader", type: "resultat", ib: "0", ub: "2000", yearEnd: "2024-12-31" },
  { accountNumber: "7010", accountName: "Löner till kollektivanställda", type: "resultat", ib: "0", ub: "600000", yearEnd: "2024-12-31" },
  { accountNumber: "7510", accountName: "Arbetsgivaravgifter 31,42%", type: "resultat", ib: "0", ub: "190000", yearEnd: "2024-12-31" },
  { accountNumber: "7832", accountName: "Avskrivningar på inventarier", type: "resultat", ib: "0", ub: "20000", yearEnd: "2024-12-31" },
  { accountNumber: "8423", accountName: "Räntekostnader skattekonto", type: "resultat", ib: "0", ub: "5000", yearEnd: "2024-12-31" }
];
