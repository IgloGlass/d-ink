
import React, { useState, useMemo } from 'react';
import { Account, MappingResult, TaxAdjustmentEntry, AnnualReportAnalysis } from '../../types';
import { analyzeTaxAdjustments } from '../../services/geminiService';
import { StandardTaxView } from './tax/StandardTaxView';
import { DepreciationView, InventoryView, BuildingDepreciationView } from './tax/AssetViews';
import { WarrantyView, ProvisionsView, PensionView } from './tax/LiabilityViews';
import { InterestView, NonTaxableView } from './tax/CorporateViews';
import { LedgerToResultView } from './tax/GeneralViews';
import { NonDeductibleView } from './tax/ExpenseViews';

interface TaxAdjustmentModuleProps {
  accounts: Account[];
  mappings: Record<string, MappingResult>;
  adjustments: Record<string, TaxAdjustmentEntry>;
  setAdjustments: React.Dispatch<React.SetStateAction<Record<string, TaxAdjustmentEntry>>>;
  annualReportData: AnnualReportAnalysis | null;
}

export const INK2S_CODES = [
  "4.3a", "4.3b", "4.3c",
  "4.4a", "4.4b",
  "4.5a", "4.5b", "4.5c",
  "4.6a", "4.6b", "4.6c", "4.6d", "4.6e",
  "4.7a", "4.7b", "4.7c", "4.7d", "4.7e", "4.7f",
  "4.8a", "4.8b", "4.8c", "4.8d",
  "4.9",
  "4.10", "4.11", "4.12", "4.13",
  "4.14a", "4.14b", "4.14c"
];

// Definition: Restored Version Scope without numbering
const TAX_MODULES = [
    { id: 'ledger_to_result', label: 'General ledger to reported result' },
    { id: 'provisions', label: 'Provisions' },
    { id: 'buildings_improvements', label: 'Buildings & Land Improvements' },
    { id: 'nontaxable_income', label: 'Non-Taxable Income' },
    { id: 'nondeductible_expenses', label: 'Non-deductible expenses' },
    { id: 'depreciation_tangible', label: 'Depreciation (Machinery & Equip)' },
    { id: 'warranty_provisions', label: 'Warranty provisions' },
    { id: 'inventory_obsolescence', label: 'Inventory obsolescence' },
    { id: 'interest_deduction', label: 'Interest Deduction' },
    { id: 'pension_costs', label: 'Pension Costs' },
    { id: 'tax_calculation', label: 'Tax Calculation' }
];

const FORENSIC_MODULES = [];

// Updated Mapping Dictionary
const SILVERFIN_TO_MODULE_MAP: Record<string, string> = {
    "102000": "depreciation_tangible", 
    "111000": "buildings_improvements", "115000": "buildings_improvements", "123200": "buildings_improvements", 
    "141000": "inventory_obsolescence", "141900": "inventory_obsolescence", 
    "151500": "provisions",
    "215000": "depreciation_tangible", 
    "222000": "warranty_provisions", "229000": "provisions",
    "397000": "depreciation_tangible", "397200": "buildings_improvements", "797200": "buildings_improvements",
    "399300": "nontaxable_income", "399500": "nontaxable_income",
    "598000": "nondeductible_expenses", "699300": "nondeductible_expenses", "607100": "nondeductible_expenses", "607200": "nondeductible_expenses",
    "634200": "nondeductible_expenses", 
    "636100": "warranty_provisions", "636200": "warranty_provisions", 
    "655000": "nondeductible_expenses", 
    "657000": "interest_deduction",
    "690000": "nondeductible_expenses", "698100": "nondeductible_expenses", "698200": "nondeductible_expenses", 
    "740000": "pension_costs", "753000": "pension_costs",
    "762200": "nondeductible_expenses", "762300": "nondeductible_expenses", 
    "777000": "buildings_improvements", "782400": "buildings_improvements", "784000": "buildings_improvements",
    "831000": "interest_deduction", "831400": "nontaxable_income",
    "842300": "nondeductible_expenses", 
    "843100": "interest_deduction", "843600": "interest_deduction", "521200": "interest_deduction", "522200": "interest_deduction",
    "849000": "interest_deduction", 
    "885000": "depreciation_tangible", 
    "891000": "ledger_to_result", "940000": "ledger_to_result"
};

// Extracted Component for Tax Calculation View to manage its own expansion state
const TaxCalculationView: React.FC<{ adjustments: Record<string, TaxAdjustmentEntry> }> = ({ adjustments }) => {
    const [expandPerm, setExpandPerm] = useState(true);
    const [expandTemp, setExpandTemp] = useState(true);

    const formatMoney = (val: string | number | undefined) => {
        if (val === undefined) return '0';
        const num = typeof val === 'string' ? parseFloat(val.replace(/\s/g, '').replace(',', '.')) : val;
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
    };

    const profit = adjustments['global_ledger_to_result']?.ledgerToResultData?.profitBeforeTaxAnnualReport || 0;
    
    // Categorize Adjustments
    let permTotal = 0;
    let tempTotal = 0;
    const permItems: {name: string, val: number}[] = [];
    const tempItems: {name: string, val: number}[] = [];

    const getLabel = (adj: TaxAdjustmentEntry) => {
        if (adj.nonDeductibleData) return `Non-Deductible: ${adj.nonDeductibleData.category}`;
        if (adj.nonTaxableData) {
            const types = [];
            if(adj.nonTaxableData.isTaxAccountInterest) types.push("Tax Interest");
            if(adj.nonTaxableData.isTaxRefund) types.push("Tax Refund");
            if(adj.nonTaxableData.isAckord) types.push("Ackord");
            return `Non-Taxable: ${types.join(', ') || 'Income'}`;
        }
        if (adj.interestDeductionData) return `Interest Deduction Limitation`;
        if (adj.warrantyData) return `Warranty Provisions`;
        if (adj.inventoryObsolescenceData) return `Inventory Obsolescence`;
        if (adj.buildingDepreciationData) return `Building Depreciation (4.9)`;
        if (adj.depreciationData) return `Machinery Depreciation`;
        return adj.aiReasoning?.substring(0, 50) || "Manual Adjustment";
    };

    (Object.values(adjustments) as TaxAdjustmentEntry[]).forEach(adj => {
        if (adj.accountId === 'global_ledger_to_result') return;
        if (!adj.adjustmentAmount) return;

        // Sign Logic: Deductions (4.5c etc) reduce the tax base, Adds (4.3c) increase it.
        // We assume adjustmentAmount is absolute magnitude usually, but depends on module implementation.
        // TaxAdjustmentEntry comments say "Amount to add/deduct". 
        // Standard convention in app: 
        // 4.3c (Add) -> Positive adjustmentAmount
        // 4.5c (Deduct) -> Positive adjustmentAmount, but mapped to a deductive code
        
        let signedAmount = adj.adjustmentAmount;
        if (['4.5a', '4.5b', '4.5c', '4.11', '4.4a', '4.4b'].includes(adj.ink2sCode)) {
            signedAmount = -adj.adjustmentAmount;
        }

        // Determine Type (Permanent vs Temporary)
        // Temporary: Depreciation (4.9), Warranty, Inventory, Provisions
        const isDepreciation = adj.accountId.includes('depreciation') || adj.ink2sCode === '4.9';
        const isProvision = adj.accountId.includes('warranty') || adj.accountId.includes('provision') || adj.accountId.includes('inventory');
        
        if (isDepreciation || isProvision) {
            tempTotal += signedAmount;
            tempItems.push({ name: getLabel(adj), val: signedAmount });
        } else {
            permTotal += signedAmount;
            permItems.push({ name: getLabel(adj), val: signedAmount });
        }
    });

    const taxableIncome = profit + permTotal + tempTotal;
    const tax = Math.max(0, taxableIncome) * 0.206;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-black tracking-tight">Tax Calculation Waterfall</h2>
            
            {/* Natural Language Summary */}
            <div className="bg-zinc-50 border-l-4 border-[#86BC25] p-6 mb-8 text-sm text-zinc-700 leading-relaxed shadow-sm">
                <p>
                    <span className="font-bold text-black">Executive Summary:</span> The company started with a Local GAAP profit of <span className="font-mono font-bold">{formatMoney(profit)} SEK</span>. 
                    {permTotal !== 0 && <span> After adjusting for permanent differences ({formatMoney(permTotal)} SEK){tempTotal !== 0 ? ',' : '.'}</span>} 
                    {tempTotal !== 0 && <span> and temporary differences ({formatMoney(tempTotal)} SEK).</span>}
                    The final taxable income is <span className="font-mono font-bold">{formatMoney(taxableIncome)} SEK</span>. 
                    The corporate tax liability is calculated as <span className="font-mono font-bold text-[#86BC25]">{formatMoney(tax)} SEK</span> (20.6%).
                </p>
            </div>

            {/* Waterfall Table */}
            <div className="bg-white border border-zinc-200 shadow-lg rounded-sm overflow-hidden">
                {/* Row 1: Local GAAP */}
                <div className="flex justify-between items-center p-5 border-b border-zinc-100">
                    <span className="font-bold text-lg">1. Local GAAP Result</span>
                    <span className="font-mono text-lg font-bold">{formatMoney(profit)}</span>
                </div>

                {/* Row 2: Permanent Differences */}
                <div className="border-b border-zinc-100 bg-zinc-50/50">
                    <button 
                        onClick={() => setExpandPerm(!expandPerm)}
                        className="w-full flex justify-between items-center p-5 hover:bg-zinc-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <i className={`fas fa-chevron-${expandPerm ? 'down' : 'right'} text-xs text-zinc-400`}></i>
                            <span className="font-bold text-zinc-700">2. Permanent Differences</span>
                        </div>
                        <span className={`font-mono font-bold ${permTotal > 0 ? 'text-red-600' : permTotal < 0 ? 'text-green-600' : 'text-zinc-400'}`}>
                            {permTotal > 0 ? '+' : ''}{formatMoney(permTotal)}
                        </span>
                    </button>
                    {expandPerm && (
                        <div className="px-12 pb-5 space-y-2 text-xs border-t border-zinc-100 bg-zinc-50">
                            {permItems.length === 0 && <div className="text-zinc-400 italic">No permanent differences found.</div>}
                            {permItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between border-b border-zinc-100 last:border-0 py-1">
                                    <span className="text-zinc-600">{item.name}</span>
                                    <span className={`font-mono ${item.val < 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(item.val)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Row 3: Temporary Differences */}
                <div className="border-b border-black">
                    <button 
                        onClick={() => setExpandTemp(!expandTemp)}
                        className="w-full flex justify-between items-center p-5 hover:bg-zinc-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <i className={`fas fa-chevron-${expandTemp ? 'down' : 'right'} text-xs text-zinc-400`}></i>
                            <span className="font-bold text-zinc-700">3. Temporary Differences</span>
                        </div>
                        <span className={`font-mono font-bold ${tempTotal > 0 ? 'text-red-600' : tempTotal < 0 ? 'text-green-600' : 'text-zinc-400'}`}>
                            {tempTotal > 0 ? '+' : ''}{formatMoney(tempTotal)}
                        </span>
                    </button>
                    {expandTemp && (
                        <div className="px-12 pb-5 space-y-2 text-xs border-t border-zinc-100 bg-zinc-50">
                            {tempItems.length === 0 && <div className="text-zinc-400 italic">No temporary differences found.</div>}
                            {tempItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between border-b border-zinc-100 last:border-0 py-1">
                                    <span className="text-zinc-600">{item.name}</span>
                                    <span className={`font-mono ${item.val < 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(item.val)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Row 4: Taxable Income */}
                <div className="flex justify-between items-center p-5 bg-zinc-50">
                    <span className="font-bold text-lg">4. Final Taxable Income</span>
                    <span className="font-mono text-xl font-extrabold border-b-2 border-black pb-1">{formatMoney(taxableIncome)}</span>
                </div>

                {/* Row 5: Tax Liability */}
                <div className="flex justify-between items-center p-5 bg-black text-white">
                    <div className="flex flex-col">
                        <span className="font-bold text-lg">5. Total Tax to Pay</span>
                        <span className="text-xs text-zinc-400 uppercase tracking-widest">Rate: 20.6%</span>
                    </div>
                    <span className="font-mono text-2xl font-bold text-[#86BC25]">{formatMoney(tax)}</span>
                </div>
            </div>
        </div>
    );
};

const TaxAdjustmentModule: React.FC<TaxAdjustmentModuleProps> = ({ 
  accounts, mappings, adjustments, setAdjustments, annualReportData
}) => {
  const [activeModuleId, setActiveModuleId] = useState<string>('ledger_to_result');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState(0);

  const getModuleForAccount = (silverfinNr: string | undefined): string | null => {
    if (!silverfinNr) return null;
    return SILVERFIN_TO_MODULE_MAP[silverfinNr] || null;
  };

  const activeModule = TAX_MODULES.find(m => m.id === activeModuleId);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    accounts.forEach(acc => {
      const mapping = mappings[acc.accountNumber];
      if (mapping && mapping.silverfinAccountNr) {
        const modId = getModuleForAccount(mapping.silverfinAccountNr);
        if (modId) {
          counts[modId] = (counts[modId] || 0) + 1;
        }
      }
    });
    return counts;
  }, [accounts, mappings]);

  const filteredAccounts = useMemo(() => {
    // Special Case: Ledger to Result needs FULL P&L context
    if (activeModuleId === 'ledger_to_result') {
        return accounts;
    }
    // Special Case: Interest Deduction needs full context for calc, but view filters only mapped ones.
    // We'll let the view handle the calc using global accounts prop if needed, or stick to mapped.
    // For now, filter accounts normally.

    return accounts.filter(acc => {
      const mapping = mappings[acc.accountNumber];
      if (!mapping || !mapping.silverfinAccountNr) return false;
      const modId = getModuleForAccount(mapping.silverfinAccountNr);
      return modId === activeModuleId;
    });
  }, [accounts, mappings, activeModuleId]);

  const handleUpdateAdjustment = (accountId: string, data: Partial<TaxAdjustmentEntry>) => {
      setAdjustments(prev => {
          const existing = prev[accountId] || { 
              accountId, 
              accountNumber: accounts.find(a => a.id === accountId)?.accountNumber || 'GLOBAL', 
              adjustmentAmount: 0, 
              ink2sCode: '', 
              manualOverride: false 
          };
          return {
              ...prev,
              [accountId]: { ...existing, ...data, manualOverride: true }
          };
      });
  };

  const mergeResultsWithState = (currentAdjustments: Record<string, TaxAdjustmentEntry>, aiResults: TaxAdjustmentEntry[], inputAccounts: Account[]) => {
      const updated = { ...currentAdjustments };
      const processedIds = new Set(aiResults.map(r => r.accountId));

      aiResults.forEach(res => {
          if (res.accountId.startsWith('global_')) {
              const existing = updated[res.accountId];
              if (existing?.manualOverride) return; 
              updated[res.accountId] = { ...res };
              return;
          }

          const acc = accounts.find(a => a.id === res.accountId);
          if (acc) {
              const existing = updated[res.accountId];
              if (existing?.manualOverride) return;

              updated[res.accountId] = {
                  ...res,
                  accountNumber: acc.accountNumber,
                  manualOverride: false
              };
          }
      });

      // Force update for accounts that were in the input batch but NOT in the AI response (failed or skipped)
      // BUT ONLY if we haven't already processed them. 
      // This prevents the default "No adjustment" from overwriting a valid result if the AI simply failed to return it this time.
      // However, the prompt now requires ALL accounts to be returned. 
      inputAccounts.forEach(acc => {
          if (!processedIds.has(acc.id) && !updated[acc.id]?.manualOverride) {
              // If AI skipped it, we default to no adjustment, but we flag it in reasoning.
              updated[acc.id] = {
                  accountId: acc.id,
                  accountNumber: acc.accountNumber,
                  adjustmentAmount: 0,
                  ink2sCode: '',
                  manualOverride: false,
                  aiReasoning: "AI analysis skipped this account (default: No adjustment)."
              };
          }
      });

      return updated;
  };

  const handleAnalyzeAll = async () => {
    setIsAnalyzing(true);
    setProgressStatus("Initializing tax review...");

    const moduleGroups: Record<string, Account[]> = {};
    accounts.forEach(acc => {
        const mapping = mappings[acc.accountNumber];
        if (mapping && mapping.silverfinAccountNr) {
            const modId = getModuleForAccount(mapping.silverfinAccountNr);
            if (modId) {
                if (!moduleGroups[modId]) moduleGroups[modId] = [];
                moduleGroups[modId].push(acc);
            }
        }
    });

    const modulesToRun = TAX_MODULES.filter(m => {
        if (m.id === 'tax_calculation') return false;
        const hasAccounts = (moduleGroups[m.id] || []).length > 0;
        const isForensic = FORENSIC_MODULES.includes(m.id);
        return hasAccounts || isForensic;
    });

    // Run modules individually to maximize context window and AI focus
    let completedCount = 0;

    try {
        for (const module of modulesToRun) {
            setProgressStatus(`Analyzing ${module.label}...`);
            const accountsInModule = moduleGroups[module.id] || [];
            
            if (accountsInModule.length > 0 || FORENSIC_MODULES.includes(module.id)) {
                try {
                    // Call AI for this specific module
                    const results = await analyzeTaxAdjustments(accountsInModule, module.id, annualReportData);
                    
                    // Immediately update state with results from this module
                    setAdjustments(prev => mergeResultsWithState(prev, results, accountsInModule));
                } catch (err: any) {
                    console.error(`Analysis failed for ${module.id}`, err);
                }
            }
            completedCount++;
            setProgressPercent(Math.round((completedCount / modulesToRun.length) * 100));
        }
        setProgressStatus("Analysis complete.");
    } catch (e) {
        console.error("Global Analysis Error", e);
        setProgressStatus("Error during analysis.");
    } finally {
        setTimeout(() => { setIsAnalyzing(false); setProgressStatus(""); setProgressPercent(0); }, 1000);
    }
  };

  const handleRunSingleAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          const results = await analyzeTaxAdjustments(filteredAccounts, activeModuleId, annualReportData);
          setAdjustments(prev => mergeResultsWithState(prev, results, filteredAccounts));
      } catch (e) {
          console.error(e);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const getTotalAdjustment = (): number => {
    return (Object.values(adjustments) as TaxAdjustmentEntry[]).reduce((acc: number, curr: TaxAdjustmentEntry) => {
        // Adjust for deductions (4.5c) being negative in tax base
        if (['4.5a', '4.5b', '4.5c'].includes(curr.ink2sCode)) {
            return acc - (curr.adjustmentAmount || 0);
        }
        return acc + (curr.adjustmentAmount || 0);
    }, 0);
  };

  const formatMoney = (val: string | number | undefined) => {
    if (val === undefined) return '0';
    const num = typeof val === 'string' ? parseFloat(val.replace(/\s/g, '').replace(',', '.')) : val;
    return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
  };

  // --- View Factory ---
  const renderActiveView = () => {
      const props = {
          moduleId: activeModuleId,
          accounts: filteredAccounts,
          adjustments,
          onUpdate: handleUpdateAdjustment,
          annualReportData,
          isAnalyzing,
          onAnalyze: handleRunSingleAnalysis
      };

      // Pass all accounts to Interest View for EBITDA calc
      const allAccountsProps = { ...props, accounts: accounts }; 

      switch (activeModuleId) {
          // General
          case 'ledger_to_result': return <LedgerToResultView {...props} />;

          // Asset Modules
          case 'depreciation_tangible': return <DepreciationView {...props} />;
          case 'buildings_improvements': return <BuildingDepreciationView {...props} />;
          case 'inventory_obsolescence': return <InventoryView {...props} />;
          
          // Liability Modules
          case 'warranty_provisions': return <WarrantyView {...props} />;
          case 'provisions': return <ProvisionsView {...props} />;
          case 'pension_costs': return <PensionView {...props} />;
          
          // Corporate/Complex Modules
          case 'interest_deduction': return <InterestView {...allAccountsProps} />; // Needs full ledger context
          case 'nondeductible_expenses': return <NonDeductibleView {...props} />;
          case 'nontaxable_income': return <NonTaxableView {...props} />;
          
          // Tax Calculation (Waterfall)
          case 'tax_calculation': 
              return <TaxCalculationView adjustments={adjustments} />;
          
          default: return <StandardTaxView {...props} title={activeModule?.label || 'Module'} />;
      }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Sidebar */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
        <div className="bg-white border border-zinc-200 shadow-sm max-h-[calc(100vh-200px)] overflow-y-auto">
             {TAX_MODULES.map(module => {
                const count = moduleCounts[module.id] || 0;
                return (
                <button
                    key={module.id}
                    onClick={() => setActiveModuleId(module.id)}
                    className={`w-full text-left px-4 py-3 text-xs font-bold border-l-4 transition-all flex justify-between items-center ${
                        activeModuleId === module.id 
                        ? 'border-[#86BC25] bg-zinc-50 text-black' 
                        : 'border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-black'
                    }`}
                >
                    <span className="truncate pr-2">{module.label}</span>
                    {count > 0 && <span className="bg-zinc-200 text-black text-[10px] px-1.5 py-0.5 rounded-full font-mono flex-shrink-0">{count}</span>}
                </button>
            )})}
        </div>
        
        <div className="space-y-2">
            <button onClick={handleRunSingleAnalysis} disabled={isAnalyzing} className="w-full bg-[#86BC25] text-white py-3 rounded-full font-bold text-xs hover:bg-[#76a820] transition-colors flex items-center justify-center gap-2 shadow-sm">
                {isAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} Analyze Current Module
            </button>
            <button onClick={handleAnalyzeAll} disabled={isAnalyzing} className="w-full bg-black text-white py-3 rounded-full font-bold text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-sm relative overflow-hidden">
                {isAnalyzing ? (
                    <>
                        <i className="fas fa-spinner fa-spin z-10 relative"></i> <span className="z-10 relative">Running Analysis...</span>
                        <div className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
                    </>
                ) : (
                    <><i className="fas fa-layer-group"></i> Analyze All Modules</>
                )}
            </button>
            {progressStatus && <div className="text-center text-[10px] text-zinc-500 animate-pulse font-mono">{progressStatus}</div>}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow min-w-0 bg-white border border-zinc-200 shadow-sm min-h-[600px] flex flex-col">
          <div className="flex-grow">
            {renderActiveView()}
          </div>
          <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center">
             <div className="text-xs text-zinc-500 font-bold uppercase">Total Adjustment Impact</div>
             <div className="font-mono font-bold text-lg text-black">{formatMoney(getTotalAdjustment())}</div>
          </div>
      </div>
    </div>
  );
};

export default TaxAdjustmentModule;
