import React from 'react';
import { Account, TaxAdjustmentEntry } from '../../../types';
import { INK2S_CODES } from '../TaxAdjustmentModule';

interface Props {
  moduleId: string;
  accounts: Account[];
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  title: string;
  renderExtraFields?: (acc: Account, entry: TaxAdjustmentEntry) => React.ReactNode;
}

export const StandardTaxView: React.FC<Props> = ({ accounts, adjustments, onUpdate, title, renderExtraFields }) => {
  const formatMoney = (val: string | number | undefined) => {
    if (val === undefined) return '0';
    const num = typeof val === 'string' ? parseFloat(val.replace(/\s/g, '').replace(',', '.')) : val;
    return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);
  };

  const handleUpdateField = (accountId: string, field: string, value: string) => {
      let numVal: any = value;
      if (field === 'adjustmentAmount' || field === 'reversalAmount') {
          numVal = parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0;
      }
      onUpdate(accountId, { [field]: numVal });
  };

  const handleTreatmentType = (accountId: string, value: string, ub: string) => {
      const amount = parseFloat((ub || "0").replace(/\s/g, '').replace(',', '.'));
      let update: Partial<TaxAdjustmentEntry> = { treatmentType: value };
      
      switch (value) {
          case "Deductible FX":
          case "Interest/Derivative":
              update.adjustmentAmount = 0;
              update.ink2sCode = "";
              break;
          case "Non-Deductible Share Impairment (4.3b)":
              update.adjustmentAmount = Math.abs(amount);
              update.ink2sCode = "4.3b";
              break;
          case "Non-Deductible Other (4.3c)":
              update.adjustmentAmount = Math.abs(amount);
              update.ink2sCode = "4.3c";
              break;
          case "Non-Taxable Revaluation":
              update.adjustmentAmount = Math.abs(amount);
              update.ink2sCode = "4.5c";
              break;
      }
      onUpdate(accountId, update);
  };

  return (
    <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
             <div>
                <h2 className="text-lg font-bold text-black">{title}</h2>
                <p className="text-xs text-zinc-500">{accounts.length} accounts mapped to this category</p>
             </div>
        </div>
        
        <div className="flex-grow overflow-auto p-6 space-y-4">
             {accounts.length === 0 ? (
                 <div className="text-center text-zinc-400 py-12 italic text-sm">No accounts found for this module.</div>
             ) : (
                 accounts.map(acc => {
                     const entry = adjustments[acc.id] || { accountId: acc.id, adjustmentAmount: 0, ink2sCode: '', manualOverride: false };
                     return (
                         <div key={acc.id} className="bg-white border border-zinc-200 p-4 shadow-sm hover:border-zinc-300 transition-colors">
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-mono font-bold text-sm bg-zinc-100 px-1.5 py-0.5 rounded">{acc.accountNumber}</span>
                                         <span className="font-bold text-sm text-black">{acc.accountName}</span>
                                     </div>
                                     <div className="text-xs text-zinc-500 mt-1">UB: <span className="font-mono text-black">{formatMoney(acc.ub)}</span></div>
                                 </div>
                                 <div className="text-right">
                                     <label className="block text-[10px] font-bold text-zinc-400 uppercase">Adjustment</label>
                                     <input 
                                        type="text" 
                                        value={entry.adjustmentAmount || ''}
                                        onChange={(e) => handleUpdateField(acc.id, 'adjustmentAmount', e.target.value)}
                                        className="w-32 text-right font-mono text-sm border-zinc-300 rounded focus:ring-[#86BC25] focus:border-[#86BC25]"
                                        placeholder="0"
                                     />
                                 </div>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-3 rounded text-xs">
                                 <div>
                                     <label className="block font-bold text-zinc-500 mb-1">Tax Code (INK2S)</label>
                                     <select 
                                        value={entry.ink2sCode || ''}
                                        onChange={(e) => handleUpdateField(acc.id, 'ink2sCode', e.target.value)}
                                        className="w-full text-xs border-zinc-300 rounded focus:ring-[#86BC25] focus:border-[#86BC25]"
                                     >
                                         <option value="">None</option>
                                         {INK2S_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                                     </select>
                                 </div>
                                 <div>
                                      <label className="block font-bold text-zinc-500 mb-1">AI Reasoning</label>
                                      <p className="text-zinc-600 italic leading-snug">{entry.aiReasoning || "No AI analysis available."}</p>
                                 </div>
                             </div>
                             {/* Capital Assets Logic */}
                             {title.includes("Capital assets") && (
                                <div className="mt-2">
                                    <label className="text-xs font-bold block mb-1">Treatment</label>
                                    <select 
                                        value={entry.treatmentType || ''} 
                                        onChange={(e) => handleTreatmentType(acc.id, e.target.value, acc.ub || "0")}
                                        className="text-xs border p-1 rounded w-full"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Deductible FX">Deductible FX</option>
                                        <option value="Interest/Derivative">Interest/Derivative</option>
                                        <option value="Non-Deductible Share Impairment (4.3b)">Non-Deductible Share Impairment</option>
                                        <option value="Non-Deductible Other (4.3c)">Non-Deductible Other</option>
                                        <option value="Non-Taxable Revaluation">Non-Taxable Revaluation</option>
                                    </select>
                                </div>
                             )}
                             {renderExtraFields && renderExtraFields(acc, entry)}
                         </div>
                     );
                 })
             )}
        </div>
    </div>
  );
};