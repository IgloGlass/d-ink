
import React, { useMemo } from 'react';
import { Account, TaxAdjustmentEntry, InterestDeductionData, NonTaxableData } from '../../../types';

interface Props {
  moduleId: string;
  accounts: Account[]; // Should contain ALL accounts for EBITDA Calc
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  isAnalyzing: boolean;
}

export const InterestView: React.FC<Props> = ({ accounts, adjustments, onUpdate }) => {
    const globalId = 'global_interest_deduction';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    // Default to EBITDA per user request, but allow fallback
    const data = entry.interestDeductionData || { targetedRuleAdjustment: 0, useSimplificationRule: false, allocatedSimplificationAmount: 5000000, transferredDeductionCapacity: 0, manualTaxEBITDAOverride: 0, remainingNegativeInterest: 0 };

    const formatMoney = (val: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

    // --- Dynamic Calculation Logic ---
    const calc = useMemo(() => {
        // 1. Profit Before Tax
        let profitBeforeTax = adjustments['global_ledger_to_result']?.ledgerToResultData?.profitBeforeTaxAnnualReport;
        
        if (profitBeforeTax === undefined || profitBeforeTax === 0) {
             const rev = accounts.filter(a => a.type === 'resultat' && parseFloat(a.ub || '0') < 0).reduce((acc, curr) => acc + parseFloat(curr.ub || '0'), 0);
             const cost = accounts.filter(a => a.type === 'resultat' && parseFloat(a.ub || '0') > 0).reduce((acc, curr) => acc + parseFloat(curr.ub || '0'), 0);
             profitBeforeTax = (rev + cost) * -1; 
        }

        // 2. Identify Interest & Depreciation
        let interestIncome = 0;
        let interestExpense = 0;
        let depreciation = 0;

        accounts.forEach(acc => {
            const val = parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.'));
            const num = parseInt(acc.accountNumber);
            
            // Heuristic for Interest
            if (num >= 8300 && num < 8400) interestIncome += Math.abs(val);
            if (num >= 8400 && num < 8500) interestExpense += Math.abs(val);
            
            // Heuristic for Depreciation (78xx is standard) or by name
            if ((num >= 7700 && num < 7900) || acc.accountName.toLowerCase().includes("avskrivning")) {
                depreciation += Math.abs(val);
            }
        });

        // Net Interest
        const netInterest = interestIncome - interestExpense;
        const negativeNetInterest = netInterest < 0 ? Math.abs(netInterest) : 0;

        // 3. Tax EBITDA Calculation
        // Tax EBITDA = Taxable Income + Net Interest Expense + Depreciation
        // A simpler proxy for view: Profit Before Tax + Interest Expense + Depreciation (Assuming interest income is minimal or treated separately)
        // Correct Formula: Taxable Profit (Before InterestDeduction) + Net Interest Expense + Tax Depreciation
        
        const calculatedEBITDA = (profitBeforeTax || 0) + interestExpense + depreciation; 
        const estimatedEBITDA = data.manualTaxEBITDAOverride || calculatedEBITDA;

        // 4. Calculate Limits
        const limitSimplification = data.allocatedSimplificationAmount || 5000000;
        const limitEBITDA = estimatedEBITDA * 0.30;

        // 5. Determine Add-Back for BOTH methods
        const addBackSimplification = Math.max(0, negativeNetInterest - limitSimplification);
        const addBackEBITDA = Math.max(0, negativeNetInterest - limitEBITDA);

        // 6. Select active adjustment based on user toggle
        const activeAdjustment = data.useSimplificationRule ? addBackSimplification : addBackEBITDA;
        const activeLimit = data.useSimplificationRule ? limitSimplification : limitEBITDA;

        return { 
            profitBeforeTax,
            interestExpense,
            depreciation,
            calculatedEBITDA,
            estimatedEBITDA, 
            negativeNetInterest, 
            limitSimplification, 
            limitEBITDA, 
            addBackSimplification, 
            addBackEBITDA,
            activeAdjustment,
            activeLimit
        };
    }, [accounts, adjustments, data]);

    const update = (field: keyof InterestDeductionData, val: any) => {
        const newData = { ...data, [field]: val };
        onUpdate(globalId, { interestDeductionData: newData });
    };

    // Effect to sync calculated adjustment
    React.useEffect(() => {
        if (entry.adjustmentAmount !== calc.activeAdjustment) {
            onUpdate(globalId, { adjustmentAmount: calc.activeAdjustment, ink2sCode: '4.3c' });
        }
    }, [calc.activeAdjustment, entry.adjustmentAmount]);

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Interest Deduction (Ränteavdrag)</h2>
            
            {/* Calculation Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 border border-zinc-200 shadow-sm">
                    <h3 className="font-bold text-sm text-zinc-500 uppercase mb-3">Negative Net Interest</h3>
                    <div className="text-3xl font-mono font-bold text-red-600 mb-1">{formatMoney(calc.negativeNetInterest)}</div>
                    <p className="text-xs text-zinc-400">Total Interest Expense (Net)</p>
                </div>

                <div className="bg-white p-4 border border-zinc-200 shadow-sm relative">
                    <h3 className="font-bold text-sm text-zinc-500 uppercase mb-3">Tax EBITDA Base</h3>
                    <div className="text-3xl font-mono font-bold text-black mb-1">{formatMoney(calc.estimatedEBITDA)}</div>
                    <div className="flex gap-2 text-xs">
                        <span className="text-zinc-400">Limit (30%):</span>
                        <span className="font-bold text-black">{formatMoney(calc.limitEBITDA)}</span>
                    </div>
                    
                    {/* Fixed Breakdown Display */}
                    <div className="mt-4 pt-4 border-t border-zinc-200 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-zinc-600">Profit Before Tax</span>
                            <span className="font-mono">{formatMoney(calc.profitBeforeTax)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-600">(+) Interest Expense</span>
                            <span className="font-mono">{formatMoney(calc.interestExpense)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-600">(+) Depreciation</span>
                            <span className="font-mono">{formatMoney(calc.depreciation)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-1 border-t border-zinc-100">
                            <span>= Calculated</span>
                            <span className="font-mono">{formatMoney(calc.calculatedEBITDA)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-50 p-6 border border-zinc-200">
                <h3 className="font-bold text-sm mb-4">Method Selection</h3>
                
                <div className="space-y-4">
                    {/* Method 1: EBITDA (Default per request) */}
                    <label className={`flex items-center justify-between p-4 border rounded cursor-pointer transition-all ${!data.useSimplificationRule ? 'bg-white border-[#86BC25] shadow-md' : 'border-zinc-200 hover:bg-white'}`}>
                        <div className="flex items-center gap-3">
                            <input 
                                type="radio" 
                                name="interestMethod" 
                                checked={!data.useSimplificationRule} 
                                onChange={() => update('useSimplificationRule', false)} 
                                className="text-[#86BC25] focus:ring-[#86BC25]"
                            />
                            <div>
                                <span className="font-bold block text-sm">EBITDA Rule (30%)</span>
                                <span className="text-xs text-zinc-500">Allowed Deduction: {formatMoney(calc.limitEBITDA)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-zinc-400 uppercase">Add-Back</div>
                            <div className={`font-mono font-bold ${calc.addBackEBITDA > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {formatMoney(calc.addBackEBITDA)}
                            </div>
                        </div>
                    </label>

                    {/* Method 2: Simplification */}
                    <label className={`flex items-center justify-between p-4 border rounded cursor-pointer transition-all ${data.useSimplificationRule ? 'bg-white border-[#86BC25] shadow-md' : 'border-zinc-200 hover:bg-white'}`}>
                        <div className="flex items-center gap-3">
                            <input 
                                type="radio" 
                                name="interestMethod" 
                                checked={data.useSimplificationRule} 
                                onChange={() => update('useSimplificationRule', true)} 
                                className="text-[#86BC25] focus:ring-[#86BC25]"
                            />
                            <div>
                                <span className="font-bold block text-sm">Simplification Rule</span>
                                <span className="text-xs text-zinc-500">Allowed Deduction: {formatMoney(calc.limitSimplification)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-zinc-400 uppercase">Add-Back</div>
                            <div className={`font-mono font-bold ${calc.addBackSimplification > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {formatMoney(calc.addBackSimplification)}
                            </div>
                        </div>
                    </label>
                </div>

                {/* Additional Settings */}
                <div className="mt-6 pt-4 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 font-bold text-xs text-zinc-500">Manual EBITDA Override</label>
                        <input type="number" value={data.manualTaxEBITDAOverride} onChange={e => update('manualTaxEBITDAOverride', parseFloat(e.target.value))} className="border p-1.5 w-full text-sm rounded focus:ring-[#86BC25]" placeholder="0" />
                    </div>
                    <div>
                        <label className="block mb-1 font-bold text-xs text-zinc-500">Targeted Rule Adjustment (Manual)</label>
                        <input type="number" value={data.targetedRuleAdjustment} onChange={e => update('targetedRuleAdjustment', parseFloat(e.target.value))} className="border p-1.5 w-full text-sm rounded focus:ring-[#86BC25]" placeholder="0" />
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-between items-center bg-black text-white p-4 rounded">
                <div className="flex flex-col">
                    <span className="font-bold">Calculated Add-Back (Field 4.3c)</span>
                    <span className="text-[10px] text-zinc-400 font-normal mt-1">
                        {calc.negativeNetInterest < calc.activeLimit 
                            ? `Net interest is within the selected limit.` 
                            : `Net interest exceeds limit by ${formatMoney(calc.activeAdjustment)}`}
                    </span>
                </div>
                <span className="font-mono text-xl font-bold">{formatMoney(calc.activeAdjustment)}</span>
            </div>
        </div>
    );
};

export const NonTaxableView: React.FC<Props> = ({ accounts, adjustments, onUpdate }) => {
    
    const formatMoney = (val: number | undefined) => {
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
    };

    const handleUpdateData = (accountId: string, updates: Partial<NonTaxableData>, bookedAmount: number) => {
        const entry = adjustments[accountId];
        const currentData = entry?.nonTaxableData || { isTaxAccountInterest: false, isAckord: false, insolvencyConfirmed: false, isTaxRefund: false };
        const newData = { ...currentData, ...updates };
        
        let adjustmentAmount = 0;
        let ink2sCode = "";

        // Logic: If any "Exempt" condition is true, set deduction amount
        if (newData.isTaxAccountInterest || (newData.isAckord && newData.insolvencyConfirmed) || newData.isTaxRefund) {
            adjustmentAmount = Math.abs(bookedAmount);
            ink2sCode = "4.5c"; // Tax-exempt income deduction
        }

        onUpdate(accountId, { 
            adjustmentAmount, 
            ink2sCode,
            nonTaxableData: newData 
        });
    };

    const handleReasoningChange = (accountId: string, newReasoning: string) => {
        onUpdate(accountId, { aiReasoning: newReasoning });
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-2">Non-Taxable Income (Skattefria intäkter)</h2>
            <p className="text-xs text-zinc-500 mb-6">
                Identify specific income items that should be deducted from the tax result (Field 4.5c).
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="border-b border-zinc-200 text-xs font-bold text-zinc-500 uppercase">
                            <th className="py-2 px-3 w-1/4">Account</th>
                            <th className="py-2 px-3 w-1/3">AI Reasoning</th>
                            <th className="py-2 px-3 text-right w-24">Booked</th>
                            <th className="py-2 px-3 text-center">Type</th>
                            <th className="py-2 px-3 text-right w-24">Deduct (4.5c)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {accounts.map(acc => {
                            const entry = adjustments[acc.id] || { accountId: acc.id, adjustmentAmount: 0 };
                            const bookedAmount = parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.')) || 0;
                            const data = entry.nonTaxableData || { isTaxAccountInterest: false, isAckord: false, insolvencyConfirmed: false, isTaxRefund: false };
                            const isExempt = entry.adjustmentAmount > 0;

                            return (
                                <tr key={acc.id} className="hover:bg-zinc-50 transition-colors text-xs align-top">
                                    <td className="py-3 px-3">
                                        <div className="font-bold text-black">{acc.accountName}</div>
                                        <div className="text-zinc-400 font-mono text-[10px]">{acc.accountNumber}</div>
                                    </td>
                                    <td className="py-3 px-3">
                                        <textarea
                                            value={entry.aiReasoning || ''}
                                            onChange={(e) => handleReasoningChange(acc.id, e.target.value)}
                                            className="w-full text-[10px] text-zinc-500 italic bg-transparent border border-transparent hover:border-zinc-200 rounded p-1 resize-none focus:bg-white focus:border-[#86BC25] focus:outline-none focus:ring-0"
                                            rows={2}
                                            placeholder="Reasoning..."
                                        />
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-zinc-600">
                                        {formatMoney(Math.abs(bookedAmount))}
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.isTaxAccountInterest}
                                                    onChange={e => handleUpdateData(acc.id, { isTaxAccountInterest: e.target.checked }, bookedAmount)}
                                                />
                                                Tax Interest
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.isTaxRefund}
                                                    onChange={e => handleUpdateData(acc.id, { isTaxRefund: e.target.checked }, bookedAmount)}
                                                />
                                                Tax Refund
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.isAckord}
                                                    onChange={e => handleUpdateData(acc.id, { isAckord: e.target.checked }, bookedAmount)}
                                                />
                                                Ackord
                                            </label>
                                            {data.isAckord && (
                                                <label className="flex items-center gap-1 ml-4 text-[10px] text-zinc-500">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={data.insolvencyConfirmed}
                                                        onChange={e => handleUpdateData(acc.id, { insolvencyConfirmed: e.target.checked }, bookedAmount)}
                                                    />
                                                    Insolvency?
                                                </label>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono font-bold text-green-700">
                                        {isExempt ? formatMoney(entry.adjustmentAmount) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                        
                        {accounts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-zinc-400 italic">No accounts mapped to Non-Taxable Income.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
