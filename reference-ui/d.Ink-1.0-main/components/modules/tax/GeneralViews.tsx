import React from 'react';
import { Account, TaxAdjustmentEntry, LedgerToResultData } from '../../../types';

interface Props {
  moduleId: string;
  accounts: Account[];
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  isAnalyzing: boolean;
}

export const LedgerToResultView: React.FC<Props> = ({ adjustments, onUpdate }) => {
    const globalId = 'global_ledger_to_result';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    const data = entry.ledgerToResultData || { profitBeforeTaxGL: 0, profitBeforeTaxAnnualReport: 0, discrepancy: 0, taxExpense: 0, netResult: 0, notes: '' };

    const update = (field: keyof LedgerToResultData, val: any) => {
        const newData = { ...data, [field]: val };
        // Auto-recalculate comparison
        newData.discrepancy = (newData.profitBeforeTaxGL || 0) - (newData.profitBeforeTaxAnnualReport || 0);
        onUpdate(globalId, { ledgerToResultData: newData });
    };

    const formatMoney = (val: number | undefined) => {
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold">General Ledger to Reported Result</h2>
            <div className="bg-zinc-50 border border-zinc-200 p-4">
                <div className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-wider">Profit Reconciliation</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Annual Report Side */}
                    <div className="space-y-4">
                        <h3 className="font-bold border-b border-zinc-300 pb-1">Annual Report (Tax Return Base)</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <label>Net Result (Årets Resultat)</label>
                                <input 
                                    type="number" 
                                    value={data.netResult} 
                                    onChange={e => update('netResult', parseFloat(e.target.value))} 
                                    className="border p-1 w-32 text-right font-mono" 
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <label>(+) Tax Expense (Skatt)</label>
                                <input 
                                    type="number" 
                                    value={data.taxExpense} 
                                    onChange={e => update('taxExpense', parseFloat(e.target.value))} 
                                    className="border p-1 w-32 text-right font-mono" 
                                />
                            </div>
                            <div className="flex justify-between items-center font-bold pt-2 border-t border-zinc-200">
                                <span>= Profit Before Tax</span>
                                <input 
                                    type="number" 
                                    value={data.profitBeforeTaxAnnualReport} 
                                    onChange={e => update('profitBeforeTaxAnnualReport', parseFloat(e.target.value))} 
                                    className="border p-1 w-32 text-right font-mono bg-[#86BC25]/10" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* General Ledger Side */}
                    <div className="space-y-4">
                        <h3 className="font-bold border-b border-zinc-300 pb-1">General Ledger (Validation)</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <label>Calculated P&L (Excl. Tax Accounts)</label>
                                <div className="font-mono">{formatMoney(data.profitBeforeTaxGL)}</div>
                            </div>
                            <div className="p-3 bg-white border border-zinc-200 text-zinc-500 italic mt-2">
                                System calculates this by summing all Class 3-8 accounts excluding 89xx series.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis & Result */}
            <div className={`border p-4 flex justify-between items-center ${Math.abs(data.discrepancy) < 100 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                    <h3 className={`font-bold text-sm ${Math.abs(data.discrepancy) < 100 ? 'text-green-800' : 'text-red-800'}`}>
                        {Math.abs(data.discrepancy) < 100 ? 'Reconciliation Successful' : 'Discrepancy Detected'}
                    </h3>
                    <p className="text-xs text-zinc-600 mt-1">Difference between Annual Report and General Ledger: <span className="font-mono font-bold">{formatMoney(data.discrepancy)}</span></p>
                </div>
                {entry.aiReasoning && (
                    <div className="text-xs text-zinc-500 max-w-sm italic text-right">
                        {entry.aiReasoning}
                    </div>
                )}
            </div>

            {/* Notes */}
            <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">Notes / Adjustments Explanation</label>
                <textarea 
                    value={data.notes || ''}
                    onChange={e => update('notes', e.target.value)}
                    className="w-full border border-zinc-300 p-2 text-sm rounded h-24"
                    placeholder="Enter any notes regarding differences or manual adjustments..."
                />
            </div>
        </div>
    );
};