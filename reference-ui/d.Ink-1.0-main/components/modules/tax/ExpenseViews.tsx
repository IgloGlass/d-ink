
import React, { useEffect } from 'react';
import { Account, TaxAdjustmentEntry, NonDeductibleData } from '../../../types';

interface Props {
  moduleId: string;
  accounts: Account[];
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  isAnalyzing: boolean;
}

export const NonDeductibleView: React.FC<Props> = ({ accounts, adjustments, onUpdate }) => {
    
    const formatMoney = (val: number | undefined) => {
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
    };

    // Auto-fix: Ensure that if nonDeductibleAmount is set by AI, it flows to adjustmentAmount
    useEffect(() => {
        accounts.forEach(acc => {
            const entry = adjustments[acc.id];
            if (entry && entry.nonDeductibleData && entry.nonDeductibleData.nonDeductibleAmount > 0) {
                // If there is a calculated non-deductible amount, but top-level adjustment is 0 or mismatch
                if (entry.adjustmentAmount !== entry.nonDeductibleData.nonDeductibleAmount) {
                    onUpdate(acc.id, { 
                        adjustmentAmount: entry.nonDeductibleData.nonDeductibleAmount,
                        ink2sCode: '4.3c' 
                    });
                }
            }
        });
    }, [accounts, adjustments]); // Dependency array careful to avoid infinite loop (onUpdate should be stable)

    const handlePercentageChange = (accountId: string, percentage: number, bookedAmount: number, currentData: NonDeductibleData) => {
        // Calculate Non-Deductible Amount based on Deductible Percentage
        // Non-Deductible = Booked * (1 - Deductible%)
        const nonDeductibleAmt = Math.round(bookedAmount * (1 - (percentage / 100)));
        
        const newData: NonDeductibleData = {
            ...currentData,
            deductiblePercentage: percentage,
            nonDeductibleAmount: nonDeductibleAmt
        };

        onUpdate(accountId, { 
            adjustmentAmount: nonDeductibleAmt, 
            ink2sCode: nonDeductibleAmt > 0 ? '4.3c' : '',
            nonDeductibleData: newData
        });
    };

    const handleReasoningChange = (accountId: string, newReasoning: string) => {
        onUpdate(accountId, { aiReasoning: newReasoning });
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-2">Non-Deductible Expenses</h2>
            <p className="text-xs text-zinc-500 mb-6 max-w-2xl">
                Review and adjust expenses that are not fully tax-deductible. Common items include Representation, Gifts, and Fines.
                The Calculated Non-Deductible Amount will be added back to the tax result (Field 4.3c).
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="border-b border-zinc-200 text-xs font-bold text-zinc-500 uppercase">
                            <th className="py-2 px-3 w-1/4">Account</th>
                            <th className="py-2 px-3 w-1/3">AI Reasoning</th>
                            <th className="py-2 px-3 text-right w-24">Booked</th>
                            <th className="py-2 px-3 text-center w-24">Deductible %</th>
                            <th className="py-2 px-3 text-right w-24">Non-Deductible (4.3c)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {accounts.map(acc => {
                            const entry = adjustments[acc.id] || { accountId: acc.id, adjustmentAmount: 0 };
                            const bookedAmount = Math.abs(parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.')) || 0);
                            
                            // Initialize logic:
                            // If presumption is 'Deductible', it implies 100% deductible (0% Non-deductible)
                            // If presumption is 'Non-Deductible', it implies 0% deductible (100% Non-deductible)
                            // However, we respect existing `deductiblePercentage` if set by user.
                            
                            const defaultPercentage = entry.nonDeductibleData?.deductiblePercentage ?? 
                                (entry.nonDeductibleData?.presumption === 'Deductible' ? 100 : 0);

                            const nonDeductibleData: NonDeductibleData = entry.nonDeductibleData || {
                                category: 'Other',
                                presumption: 'Non-Deductible',
                                deductiblePercentage: defaultPercentage,
                                nonDeductibleAmount: bookedAmount
                            };

                            // Recalculate amount based on percentage for display if strict synchronization is needed
                            // But usually we rely on `adjustmentAmount` being correct from AI or manual update.
                            // Visual calc:
                            const calculatedNonDeductible = Math.round(bookedAmount * (1 - (defaultPercentage / 100)));

                            return (
                                <tr key={acc.id} className="hover:bg-zinc-50 transition-colors text-xs align-top">
                                    <td className="py-3 px-3">
                                        <div className="font-bold text-black">{acc.accountName}</div>
                                        <div className="text-zinc-400 font-mono text-[10px]">{acc.accountNumber}</div>
                                        {nonDeductibleData.category && <span className="mt-1 inline-block bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-[10px]">{nonDeductibleData.category}</span>}
                                        {nonDeductibleData.presumption === 'Deductible' && <span className="ml-2 text-[10px] text-green-600 font-bold"><i className="fas fa-check"></i> Deductible</span>}
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
                                        {formatMoney(bookedAmount)}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <input 
                                                type="number" 
                                                min="0"
                                                max="100"
                                                value={nonDeductibleData.deductiblePercentage}
                                                onChange={e => handlePercentageChange(acc.id, parseFloat(e.target.value) || 0, bookedAmount, nonDeductibleData)}
                                                className="w-16 text-center bg-white border border-zinc-300 rounded focus:border-[#86BC25] focus:ring-[#86BC25] font-bold"
                                            />
                                            <span className="text-zinc-400">%</span>
                                        </div>
                                    </td>
                                    <td className={`py-3 px-3 text-right font-mono font-bold ${calculatedNonDeductible === 0 ? 'text-zinc-300' : 'text-red-500'}`}>
                                        {formatMoney(calculatedNonDeductible)}
                                    </td>
                                </tr>
                            );
                        })}
                        {accounts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-zinc-400 italic">No accounts mapped to Non-Deductible Expenses.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
