
import React from 'react';
import { Account, TaxAdjustmentEntry, WarrantyGroup, ProvisionData, PensionData } from '../../../types';

interface Props {
  moduleId: string;
  accounts: Account[];
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  isAnalyzing: boolean;
}

export const WarrantyView: React.FC<Props> = ({ adjustments, onUpdate }) => {
    const globalId = 'global_warranty';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    const data = entry.warrantyData || { groups: [], priorYearNonDeductible: 0 };

    const calculateExcess = (groups: WarrantyGroup[]) => {
        let totalExcess = 0;
        groups.forEach(g => {
            // Standard Rule: Max Deduction = Actual Cost * (Months / 24)
            // (Assumes provision covers future costs based on this year's actuals)
            const maxDeduction = g.isRealized ? g.bookedProvision : (g.actualCosts * (g.warrantyMonths / 24));
            const excess = Math.max(0, g.bookedProvision - maxDeduction);
            totalExcess += excess;
        });
        return totalExcess;
    };

    const updateGroup = (i: number, field: keyof WarrantyGroup, val: any) => {
        const newGroups = [...data.groups];
        newGroups[i] = { ...newGroups[i], [field]: val };
        const excess = calculateExcess(newGroups);
        onUpdate(globalId, { 
            adjustmentAmount: excess, 
            ink2sCode: '4.3c',
            reversalAmount: data.priorYearNonDeductible,
            reversalCode: '4.5c',
            warrantyData: { ...data, groups: newGroups } 
        });
    };

    const addGroup = () => {
        const newGroups = [...data.groups, { id: Math.random().toString(), name: '', warrantyMonths: 24, actualCosts: 0, bookedProvision: 0, isRealized: false }];
        onUpdate(globalId, { warrantyData: { ...data, groups: newGroups } });
    };

    const updateReasoning = (text: string) => {
        onUpdate(globalId, { aiReasoning: text });
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Warranty Provisions (Schablonregeln)</h2>
            <div className="bg-zinc-50 p-4 border border-zinc-200 mb-6">
                <div className="flex justify-between items-center text-xs">
                    <label className="font-bold">Reversal from Prev Year (4.5c)</label>
                    <input 
                        type="number" 
                        value={data.priorYearNonDeductible} 
                        onChange={e => {
                            const val = parseFloat(e.target.value);
                            onUpdate(globalId, { 
                                reversalAmount: val, 
                                reversalCode: '4.5c',
                                warrantyData: { ...data, priorYearNonDeductible: val } 
                            });
                        }} 
                        className="border p-2 w-32 text-right focus:ring-[#86BC25]" 
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs font-bold text-zinc-500 mb-1">AI Reasoning / Notes</label>
                <textarea 
                    value={entry.aiReasoning || ''} 
                    onChange={e => updateReasoning(e.target.value)}
                    className="w-full border border-zinc-300 p-2 text-xs rounded focus:ring-[#86BC25] focus:border-[#86BC25]" 
                    rows={2} 
                    placeholder="Enter compliance notes..."
                />
            </div>

            <div className="space-y-4">
                {data.groups.map((g, i) => {
                    const maxDed = g.actualCosts * (g.warrantyMonths / 24);
                    const excess = Math.max(0, g.bookedProvision - maxDed);
                    return (
                        <div key={i} className="border p-3 text-xs grid grid-cols-2 md:grid-cols-5 gap-4 items-end bg-white relative">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block mb-1 font-bold">Group Name</label>
                                <input value={g.name} onChange={e => updateGroup(i, 'name', e.target.value)} className="border p-1.5 w-full focus:ring-[#86BC25]" placeholder="e.g. Products A" />
                            </div>
                            <div>
                                <label className="block mb-1">Actual Costs</label>
                                <input type="number" value={g.actualCosts} onChange={e => updateGroup(i, 'actualCosts', parseFloat(e.target.value))} className="border p-1.5 w-full focus:ring-[#86BC25]" />
                            </div>
                            <div>
                                <label className="block mb-1">Booked Prov (UB)</label>
                                <input type="number" value={g.bookedProvision} onChange={e => updateGroup(i, 'bookedProvision', parseFloat(e.target.value))} className="border p-1.5 w-full focus:ring-[#86BC25]" />
                            </div>
                            <div>
                                <label className="block mb-1">Period (Months)</label>
                                <input type="number" value={g.warrantyMonths} onChange={e => updateGroup(i, 'warrantyMonths', parseFloat(e.target.value))} className="border p-1.5 w-full focus:ring-[#86BC25]" />
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-zinc-500 uppercase">Non-Deductible</div>
                                <div className="font-bold text-red-500 text-sm">{Math.round(excess)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={addGroup} className="mt-4 text-xs bg-black text-white px-4 py-2 rounded">Add Warranty Group</button>
        </div>
    );
};

export const PensionView: React.FC<Props> = ({ accounts, adjustments, onUpdate }) => {
    const globalId = 'global_pension';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    
    // Auto-calculate book value from accounts mapped to this module
    const calculatedBooked = accounts.reduce((sum, acc) => sum + Math.abs(parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.'))), 0);
    
    const data = entry.pensionData || { slpBasis: calculatedBooked, bookedExpenses: calculatedBooked };

    // Update handler for manual override of SLP Basis
    const update = (val: number) => {
        onUpdate(globalId, { 
            // Pension adjustment is usually 0 unless there's a specific non-deductible part, 
            // but for this module the primary output is Field 1.4 population.
            adjustmentAmount: 0, 
            pensionData: { ...data, slpBasis: val } 
        });
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Pension Costs</h2>
            <div className="bg-zinc-50 p-6 border border-zinc-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-sm font-bold text-zinc-600">Total Booked Pension Costs (Group 74xx)</div>
                    <div className="font-mono text-lg font-bold">{new Intl.NumberFormat('sv-SE').format(Math.round(calculatedBooked))}</div>
                </div>
                
                <div className="p-4 bg-white border border-zinc-300 rounded shadow-sm">
                    <label className="block text-xs font-bold text-black mb-2">Basis for Special Payroll Tax (Field 1.4)</label>
                    <p className="text-xs text-zinc-500 mb-3">This amount will be automatically populated in the Tax Return.</p>
                    <input 
                        type="number" 
                        value={data.slpBasis} 
                        onChange={e => update(parseFloat(e.target.value))} 
                        className="w-full p-2 border border-zinc-300 rounded font-mono text-right text-lg font-bold text-[#86BC25] focus:ring-[#86BC25] focus:border-[#86BC25]" 
                    />
                </div>
            </div>
            <div className="mt-4">
                <h3 className="text-xs font-bold text-zinc-500 mb-2">Mapped Accounts</h3>
                <ul className="text-xs text-zinc-600 space-y-1">
                    {accounts.map(a => (
                        <li key={a.id} className="flex justify-between border-b border-zinc-100 pb-1">
                            <span>{a.accountNumber} {a.accountName}</span>
                            <span className="font-mono">{a.ub}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export const ProvisionsView: React.FC<Props> = ({ accounts, adjustments, onUpdate }) => {
    
    const updateProvData = (accountId: string, updates: Partial<ProvisionData>) => {
        const entry = adjustments[accountId];
        const currentData = entry?.provisionData || { status: 'Deductible', riskAssessment: 'Standard', ib: 0, ub: 0 };
        const newData = { ...currentData, ...updates };
        
        let adjustmentAmount = 0;
        let reversalAmount = 0;
        let ink2sCode = "";
        let reversalCode = "";

        if (newData.status === 'Non-Deductible') {
            adjustmentAmount = newData.ub;
            ink2sCode = "4.3c";
            reversalAmount = newData.ib;
            reversalCode = "4.5c";
        }

        onUpdate(accountId, { 
            adjustmentAmount, 
            ink2sCode,
            reversalAmount,
            reversalCode,
            provisionData: newData 
        });
    };

    const updateReasoning = (accountId: string, text: string) => {
        onUpdate(accountId, { aiReasoning: text });
    };

    const formatMoney = (val: number | undefined) => {
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-2">Provisions (Avsättningar)</h2>
            <p className="text-xs text-zinc-500 mb-6 max-w-2xl">
                Analyze provisions for tax deductibility. All fields are editable to allow for professional judgment override.
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-200 text-xs font-bold text-zinc-500 uppercase">
                            <th className="py-2 px-3 w-1/4">Account & Reasoning</th>
                            <th className="py-2 px-3 text-right">IB (Opening)</th>
                            <th className="py-2 px-3 text-right">UB (Closing)</th>
                            <th className="py-2 px-3 text-center">Risk Assessment</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Add Back (4.3c)</th>
                            <th className="py-2 px-3 text-right">Reversal (4.5c)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {accounts.map(acc => {
                            const entry = adjustments[acc.id] || { accountId: acc.id, adjustmentAmount: 0 };
                            const parseVal = (s: string | undefined) => Math.abs(parseFloat((s || "0").replace(/\s/g, '').replace(',', '.')) || 0);
                            
                            const provData: ProvisionData = entry.provisionData || {
                                status: 'Deductible',
                                riskAssessment: 'Standard',
                                ib: parseVal(acc.ib),
                                ub: parseVal(acc.ub)
                            };

                            const isNonDeductible = provData.status === 'Non-Deductible';

                            return (
                                <tr key={acc.id} className="hover:bg-zinc-50 transition-colors text-xs align-top">
                                    <td className="py-3 px-3">
                                        <div className="font-bold text-black">{acc.accountName}</div>
                                        <div className="text-zinc-400 font-mono text-[10px] mb-1">{acc.accountNumber}</div>
                                        <textarea 
                                            value={entry.aiReasoning || ''}
                                            onChange={(e) => updateReasoning(acc.id, e.target.value)}
                                            className="w-full text-[10px] text-zinc-500 italic bg-transparent border border-transparent hover:border-zinc-200 rounded p-1 resize-none h-16 focus:bg-white focus:border-[#86BC25] focus:outline-none focus:ring-0"
                                            placeholder="Enter reasoning..."
                                        />
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <input 
                                            type="number" 
                                            value={provData.ib}
                                            onChange={e => updateProvData(acc.id, { ib: parseFloat(e.target.value) || 0 })}
                                            className="w-20 text-right bg-transparent border-b border-zinc-200 focus:border-[#86BC25] focus:outline-none text-zinc-600 font-mono"
                                        />
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <input 
                                            type="number" 
                                            value={provData.ub}
                                            onChange={e => updateProvData(acc.id, { ub: parseFloat(e.target.value) || 0 })}
                                            className="w-20 text-right bg-transparent border-b border-zinc-200 focus:border-[#86BC25] focus:outline-none text-zinc-600 font-mono"
                                        />
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <select 
                                            value={provData.riskAssessment}
                                            onChange={e => updateProvData(acc.id, { riskAssessment: e.target.value as any })}
                                            className={`text-[10px] font-bold border rounded px-1 py-0.5 focus:ring-0 ${provData.riskAssessment === 'High Risk' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-zinc-600 border-zinc-200'}`}
                                        >
                                            <option value="Standard">Standard</option>
                                            <option value="High Risk">High Risk</option>
                                        </select>
                                    </td>
                                    <td className="py-3 px-3">
                                        <button 
                                            onClick={() => updateProvData(acc.id, { status: isNonDeductible ? 'Deductible' : 'Non-Deductible' })}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm w-24 ${
                                                isNonDeductible 
                                                ? 'bg-red-500 text-white' 
                                                : 'bg-[#86BC25] text-white'
                                            }`}
                                        >
                                            {provData.status}
                                        </button>
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono font-bold text-black">
                                        {isNonDeductible ? formatMoney(provData.ub) : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-500">
                                        {isNonDeductible ? formatMoney(provData.ib) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                        {accounts.length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-zinc-400 italic">No accounts mapped to Provisions.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
