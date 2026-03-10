
import React, { useState, useEffect, useRef } from 'react';
import { Account, TaxAdjustmentEntry, DepreciationData, InventoryObsolescenceData, BuildingAsset, AnnualReportAnalysis } from '../../../types';
import { extractHistoricalAcquisitions } from '../../../services/geminiService';

interface Props {
  moduleId: string;
  accounts: Account[];
  adjustments: Record<string, TaxAdjustmentEntry>;
  onUpdate: (accountId: string, data: Partial<TaxAdjustmentEntry>) => void;
  isAnalyzing: boolean;
  annualReportData?: AnnualReportAnalysis | null;
}

export const DepreciationView: React.FC<Props> = ({ adjustments, onUpdate, accounts, annualReportData }) => {
    const globalId = 'global_depreciation';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    const data = entry.depreciationData || { method: 'main', ibTaxValue: 0, currentAcquisitions: 0, disposalProceeds: 0, historicalAcquisitions: [], isFusionsGoodwill: false };
    
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Calculate Totals from Mapped Accounts (Booked Values)
    const bookedUB = accounts
        .filter(acc => acc.type === 'balans')
        .reduce((sum, acc) => sum + parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.')), 0);
    
    // Auto-calculate IB from mapped Asset accounts
    const calculatedIB = accounts
        .filter(acc => acc.type === 'balans')
        .reduce((sum, acc) => sum + parseFloat((acc.ib || "0").replace(/\s/g, '').replace(',', '.')), 0);

    // Identify current Fiscal Year from first account
    const currentFiscalYearStr = accounts[0]?.yearEnd?.substring(0, 4) || new Date().getFullYear().toString();
    const currentFiscalYear = parseInt(currentFiscalYearStr);

    // Initialize IB Tax Value
    useEffect(() => {
        if (data.ibTaxValue === 0 && calculatedIB !== 0) {
            updateData('ibTaxValue', calculatedIB);
        }
    }, [calculatedIB]);

    // Reactive Calculation
    useEffect(() => {
        // Main Rule (30-Rule)
        const base = (data.ibTaxValue || 0) + (data.currentAcquisitions || 0) - (data.disposalProceeds || 0);
        const limit30 = Math.max(0, base * 0.70);

        // Alternative Rule (20-Rule)
        const limit20 = data.historicalAcquisitions.reduce((sum, item) => sum + (item.acquisitionCost * item.multiplier), 0);

        // Lowest Allowed Tax Value
        const effectiveLimit20 = limit20 > 0 ? limit20 : Number.MAX_VALUE;
        const lowestAllowedTaxValue = Math.min(limit30, effectiveLimit20 === Number.MAX_VALUE ? limit30 : effectiveLimit20);
        
        // Adjustment
        const excessDepreciation = Math.max(0, lowestAllowedTaxValue - bookedUB);
        
        // Auto-select method if not set manually by user interaction recently (simple logic: best for client)
        const method = limit30 <= limit20 ? 'main' : 'alternative';

        if (entry.adjustmentAmount !== excessDepreciation || data.method !== method) {
             onUpdate(globalId, { 
                adjustmentAmount: excessDepreciation, 
                ink2sCode: '4.9', 
                depreciationData: { ...data, method } 
            });
        }
    }, [data.ibTaxValue, data.currentAcquisitions, data.disposalProceeds, data.historicalAcquisitions, bookedUB]);

    const updateData = (field: keyof DepreciationData, val: any) => {
        const newData = { ...data, [field]: val };
        onUpdate(globalId, { depreciationData: newData });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files) as File[];
            await handleExtract(filesArray);
        }
    };

    const handleExtract = async (files: File[]) => {
        if(files.length === 0) return;
        setIsExtracting(true);
        try {
            const fileData = await Promise.all(files.map(async f => ({ name: f.name, data: (await new Promise<string>(r => { const rd = new FileReader(); rd.onload = e => r((e.target?.result as string).split(',')[1]); rd.readAsDataURL(f); })) })));
            const extracted = await extractHistoricalAcquisitions(fileData);
            
            // Map extracted years relative to Current Fiscal Year (T)
            // T   (Current): 80% multiplier
            // T-1 (Last Yr): 60% multiplier
            // T-2          : 40% multiplier
            // T-3          : 20% multiplier
            
            const multipliers = [0.8, 0.6, 0.4, 0.2];
            const mappedHistory = multipliers.map((mult, idx) => {
                const targetYear = currentFiscalYear - idx;
                const foundItem = extracted.find(item => parseInt(item.year) === targetYear);
                
                return {
                    yearLabel: `${targetYear}`,
                    acquisitionCost: foundItem ? foundItem.amount : 0,
                    multiplier: mult,
                    sourceSnippet: foundItem?.sourceSnippet
                };
            });
            
            updateData('historicalAcquisitions', mappedHistory);
        } catch (error) {
            console.error("Extraction failed", error);
        } finally { 
            setIsExtracting(false); 
        }
    };

    const formatMoney = (val: number) => new Intl.NumberFormat('sv-SE').format(Math.round(val));

    // Display Values
    const base = (data.ibTaxValue || 0) + (data.currentAcquisitions || 0) - (data.disposalProceeds || 0);
    const limit30 = Math.max(0, base * 0.70);
    const limit20 = data.historicalAcquisitions.reduce((sum, item) => sum + (item.acquisitionCost * item.multiplier), 0);
    const lowestAllowed = Math.min(limit30, limit20 > 0 ? limit20 : limit30);
    const difference = Math.abs(limit30 - limit20);
    const recommendedMethod = limit30 < limit20 ? "30-rule (Main Rule)" : "20-rule (Alternative Rule)";

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold">Depreciation (Machinery & Equipment)</h2>
            
            {entry.aiReasoning && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-xs text-blue-800 italic">
                    <span className="font-bold not-italic block mb-1 text-blue-900">AI Analysis:</span>
                    {entry.aiReasoning}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {/* 30-Rule Card */}
                    <div className={`p-4 border shadow-sm transition-all ${data.method === 'main' ? 'bg-white border-[#86BC25] ring-1 ring-[#86BC25]' : 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100'}`}>
                        <div className="flex justify-between items-center mb-3 border-b border-zinc-100 pb-2">
                            <h3 className="font-bold text-sm text-black">Main Rule (30-rule)</h3>
                            {data.method === 'main' && <span className="bg-[#86BC25] text-white text-[10px] px-2 py-0.5 rounded font-bold">Active</span>}
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <div>
                                    <label className="text-zinc-600 font-bold">IB Tax Value</label>
                                    <div className="text-[10px] text-zinc-400">Sum of mapped IBs: {formatMoney(calculatedIB)}</div>
                                </div>
                                <input type="number" value={data.ibTaxValue} onChange={e => updateData('ibTaxValue', parseFloat(e.target.value))} className="w-24 p-1 border text-right focus:ring-[#86BC25]" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-zinc-600">(+) Acquisitions</label>
                                <input type="number" value={data.currentAcquisitions} onChange={e => updateData('currentAcquisitions', parseFloat(e.target.value))} className="w-24 p-1 border text-right focus:ring-[#86BC25]" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-zinc-600">(-) Disposals</label>
                                <input type="number" value={data.disposalProceeds} onChange={e => updateData('disposalProceeds', parseFloat(e.target.value))} className="w-24 p-1 border text-right focus:ring-[#86BC25]" />
                            </div>
                            <div className="border-t border-zinc-200 my-2 pt-2 flex justify-between font-bold">
                                <span>Adjusted Base</span>
                                <span>{formatMoney(base)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-600 italic">
                                <span>Lowest Allowed (70%)</span>
                                <span className="font-mono font-bold text-black">{formatMoney(limit30)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 20-Rule Card */}
                    <div className={`p-4 border shadow-sm transition-all ${data.method === 'alternative' ? 'bg-white border-[#86BC25] ring-1 ring-[#86BC25]' : 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100'}`}>
                        <div className="flex justify-between items-center mb-3 border-b border-zinc-100 pb-2">
                            <h3 className="font-bold text-sm text-black">Alternative Rule (20-rule)</h3>
                            {data.method === 'alternative' && <span className="bg-[#86BC25] text-white text-[10px] px-2 py-0.5 rounded font-bold">Active</span>}
                        </div>
                        
                        {/* File Upload Zone */}
                        <div className="mb-4">
                            <input 
                                type="file" 
                                multiple 
                                accept="application/pdf" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileUpload}
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isExtracting} 
                                className="w-full text-[10px] bg-zinc-100 border-2 border-dashed border-zinc-300 py-3 rounded hover:bg-zinc-50 hover:border-black transition-all text-zinc-500"
                            >
                                {isExtracting ? <><i className="fas fa-spinner fa-spin mr-1"></i> Analyzing Annual Reports...</> : <><i className="fas fa-file-pdf mr-1"></i> Upload Previous Annual Reports</>}
                            </button>
                        </div>

                        {/* 20-Rule Grid */}
                        <div className="space-y-1">
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-zinc-400 border-b border-zinc-200 pb-1 mb-1">
                                <div className="col-span-2">Year</div>
                                <div className="col-span-3 text-right">Cost</div>
                                <div className="col-span-2 text-center">%</div>
                                <div className="col-span-3 text-right">Tax Value</div>
                                <div className="col-span-2"></div>
                            </div>
                            
                            {data.historicalAcquisitions.length === 0 && (
                                <div className="text-center py-4 text-[10px] text-zinc-400 italic">
                                    No history. Upload reports or init manually.
                                </div>
                            )}

                            {data.historicalAcquisitions.map((h, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 text-xs items-center group relative">
                                    <div className="col-span-2 font-bold text-zinc-600">{h.yearLabel}</div>
                                    <div className="col-span-3">
                                        <input 
                                            type="number" 
                                            value={h.acquisitionCost} 
                                            onChange={e => {
                                                const newHist = [...data.historicalAcquisitions];
                                                newHist[i].acquisitionCost = parseFloat(e.target.value);
                                                updateData('historicalAcquisitions', newHist);
                                            }} 
                                            className="w-full border p-1 text-right focus:ring-[#86BC25] text-[10px]" 
                                        />
                                    </div>
                                    <div className="col-span-2 text-center text-zinc-400 text-[10px]">{(h.multiplier * 100).toFixed(0)}%</div>
                                    <div className="col-span-3 text-right font-mono text-zinc-600">{formatMoney(h.acquisitionCost * h.multiplier)}</div>
                                    
                                    {/* Source Snippet Icon */}
                                    <div className="col-span-2 flex justify-center">
                                        {h.sourceSnippet && (
                                            <div className="relative group/tooltip">
                                                <i className="fas fa-file-alt text-zinc-400 cursor-help"></i>
                                                <div className="absolute right-0 bottom-full mb-2 w-48 bg-black text-white text-[10px] p-2 rounded hidden group-hover/tooltip:block z-10 shadow-lg">
                                                    {h.sourceSnippet}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {data.historicalAcquisitions.length > 0 && (
                                <div className="border-t border-zinc-200 mt-2 pt-2 flex justify-between text-xs font-bold text-zinc-600">
                                    <span>Lowest Allowed (Sum)</span>
                                    <span>{formatMoney(limit20)}</span>
                                </div>
                            )}
                        </div>
                        {data.historicalAcquisitions.length === 0 && (
                             <button onClick={() => updateData('historicalAcquisitions', [0.8, 0.6, 0.4, 0.2].map((m, i) => ({ yearLabel: `${currentFiscalYear - i}`, acquisitionCost: 0, multiplier: m })))} className="text-[10px] underline text-zinc-400 text-center w-full block mt-2">Initialize T to T-3</button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-zinc-900 text-white p-6 rounded shadow-lg h-fit">
                        <div>
                            <div className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Booked Value (UB)</div>
                            <div className="text-2xl font-mono font-bold">{formatMoney(bookedUB)}</div>
                            <div className="text-[10px] text-zinc-500 mt-1">Sum of mapped Class 1 accounts</div>
                        </div>
                        
                        <div className="border-t border-zinc-700 pt-4 mt-4">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="text-zinc-400">Lowest Allowed Tax Value</span>
                                <span className="font-mono text-[#86BC25] font-bold">{formatMoney(lowestAllowed)}</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 text-right">
                                Using {data.method === 'main' ? "30-Rule" : "20-Rule"}
                            </div>
                        </div>

                        <div className={`p-4 rounded border mt-4 ${entry.adjustmentAmount > 0 ? 'bg-red-900/20 border-red-500/50' : 'bg-green-900/20 border-green-500/50'}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-sm">Adjustment (4.9)</span>
                                <span className={`font-mono text-xl font-bold ${entry.adjustmentAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {formatMoney(entry.adjustmentAmount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Recommendation Box */}
                    <div className="bg-white border-l-4 border-[#86BC25] p-4 shadow-sm text-xs leading-relaxed text-zinc-600">
                        <h4 className="font-bold text-black mb-1"><i className="fas fa-lightbulb text-[#86BC25] mr-1"></i> Recommendation</h4>
                        <p>
                            Based on the calculations, the lowest allowable tax value is <span className="font-bold">{formatMoney(lowestAllowed)}</span>. 
                            The {data.method === 'main' ? "Alternative Rule (20-rule)" : "Main Rule (30-rule)"} would result in a floor of {formatMoney(data.method === 'main' ? limit20 : limit30)}. 
                        </p>
                        <p className="mt-2">
                            We recommend using the <span className="font-bold text-black bg-zinc-100 px-1 rounded">{recommendedMethod}</span> to maximize your depreciation deduction potential.
                            {difference > 0 && <span> This choice lowers the tax floor by {formatMoney(difference)} compared to the other method.</span>}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const BuildingDepreciationView: React.FC<Props> = ({ adjustments, onUpdate, accounts }) => {
    const globalId = 'global_building_depreciation';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    const data = entry.buildingDepreciationData || { assets: [], totalAdjustment49: 0 };

    // Calculate Total Booked Depreciation from Mapped Expense Accounts (Class 7)
    // Positive Cost in source -> Positive Depreciation to Add Back
    const totalBookedDepreciation = accounts
        .filter(acc => acc.type === 'resultat' && (acc.accountNumber.startsWith('7') || acc.accountName.toLowerCase().includes('avskrivning')))
        .reduce((sum, acc) => sum + Math.abs(parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.'))), 0);

    // Sync assets with mapped Balance Sheet accounts (Class 1)
    useEffect(() => {
        const assetAccounts = accounts.filter(a => a.accountNumber.startsWith('1') && a.type === 'balans');
        
        let needsUpdate = false;
        const newAssets = [...data.assets];

        assetAccounts.forEach(acc => {
            const exists = newAssets.find(asset => asset.id === acc.id || asset.description.includes(acc.accountNumber));
            if (!exists) {
                // Determine default category based on name
                let category: any = 'Building';
                if (acc.accountName.toLowerCase().includes('mark')) category = 'Land Improvement';
                
                // Determine Tax Basis (IB)
                const ib = parseFloat((acc.ib || "0").replace(/\s/g, '').replace(',', '.'));

                newAssets.push({
                    id: acc.id,
                    category: category,
                    description: `${acc.accountNumber} - ${acc.accountName}`,
                    taxAcquisitionValue: ib,
                    bookedDepreciation: 0, // Not used per asset for 4.9 calculation in this method, we sum totals
                    taxRate: category === 'Building' ? 0.04 : 0.05,
                    calculatedTaxDepreciation: Math.round(ib * (category === 'Building' ? 0.04 : 0.05)),
                    isExtendedRepair: false,
                    aiReasoning: 'Auto-populated from mapped account'
                });
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            recalculateAndSave(newAssets);
        } else {
            // Also recalculate if totalBookedDepreciation changes (accounts prop changed) even if assets didn't
            // This ensures the net adjustment updates if an expense account changes
            recalculateAndSave(data.assets); 
        }
    }, [accounts, totalBookedDepreciation]); 

    const recalculateAndSave = (assets: BuildingAsset[]) => {
        const totalTaxDepreciation = assets.reduce((sum, asset) => sum + asset.calculatedTaxDepreciation, 0);
        
        // Field 4.9 = Booked Depreciation (Added Back) - Tax Depreciation (Deducted)
        // If Booked > Tax, we have a net add-back (Positive)
        // If Booked < Tax, we have a net deduction (Negative)
        const netAdjustment = totalBookedDepreciation - totalTaxDepreciation;
        
        const finalAdjustment = Math.abs(netAdjustment) <= 10 ? 0 : netAdjustment;

        // Only update if changed to avoid loop
        if (entry.adjustmentAmount !== finalAdjustment || JSON.stringify(data.assets) !== JSON.stringify(assets)) {
            onUpdate(globalId, { 
                adjustmentAmount: finalAdjustment, 
                ink2sCode: '4.9',
                buildingDepreciationData: { ...data, assets, totalAdjustment49: finalAdjustment } 
            });
        }
    };

    const updateAsset = (i: number, field: keyof BuildingAsset, val: any) => {
        const newAssets = [...data.assets];
        newAssets[i] = { ...newAssets[i], [field]: val };
        
        const asset = newAssets[i];
        if (field === 'taxAcquisitionValue' || field === 'taxRate') {
             asset.calculatedTaxDepreciation = Math.round(asset.taxAcquisitionValue * asset.taxRate);
        }
        recalculateAndSave(newAssets);
    };

    const addAsset = (category: 'Building' | 'Land Improvement' | 'Leasehold Improvement') => {
        const newAssets = [...data.assets, { 
            id: Math.random().toString(), 
            category: category, 
            description: `New ${category}`, 
            taxAcquisitionValue: 0, 
            bookedDepreciation: 0, 
            taxRate: category === 'Building' ? 0.04 : 0.05, 
            calculatedTaxDepreciation: 0, 
            isExtendedRepair: false,
            aiReasoning: 'Manual addition'
        }];
        recalculateAndSave(newAssets);
    };

    const removeAsset = (index: number) => {
        const newAssets = [...data.assets];
        newAssets.splice(index, 1);
        recalculateAndSave(newAssets);
    };

    const formatMoney = (val: number | undefined) => {
        return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
    };

    const groups = ['Building', 'Land Improvement', 'Leasehold Improvement'];

    // Calculate total tax depreciation for display
    const totalTaxDepr = data.assets.reduce((sum, a) => sum + a.calculatedTaxDepreciation, 0);

    return (
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h2 className="text-lg font-bold">Real Estate Depreciation (4.9)</h2>
                    <p className="text-xs text-zinc-500">Adjustment = Booked Depreciation (Add Back) - Tax Depreciation (Deduct)</p>
                </div>
            </div>

            {/* Booked Depreciation Summary */}
            <div className="bg-zinc-50 border border-zinc-200 p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-black">Booked Depreciation (Class 7)</h3>
                    <span className="font-mono text-lg font-bold text-red-700">+ {formatMoney(totalBookedDepreciation)}</span>
                </div>
                <div className="text-xs text-zinc-500">
                    Sum of mapped expense accounts (e.g. 78xx).
                </div>
                <div className="mt-2 text-[10px] text-zinc-400 space-y-1">
                    {accounts.filter(acc => acc.type === 'resultat' && (acc.accountNumber.startsWith('7') || acc.accountName.toLowerCase().includes('avskrivning'))).map(acc => (
                        <div key={acc.id} className="flex justify-between">
                            <span>{acc.accountNumber} {acc.accountName}</span>
                            <span>{formatMoney(Math.abs(parseFloat((acc.ub || "0").replace(/\s/g, '').replace(',', '.'))))}</span>
                        </div>
                    ))}
                </div>
            </div>

            {groups.map((group: any) => {
                const groupAssets = data.assets.filter(a => a.category === group);
                
                return (
                    <div key={group} className="border border-zinc-200 rounded-none overflow-hidden">
                        <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                            <span className="font-bold text-xs uppercase tracking-wider text-zinc-600">{group}s</span>
                            <button onClick={() => addAsset(group)} className="text-[10px] bg-white border border-zinc-300 px-2 py-1 rounded hover:bg-black hover:text-white transition-colors">
                                <i className="fas fa-plus mr-1"></i> Add Asset
                            </button>
                        </div>
                        
                        {groupAssets.length === 0 ? (
                            <div className="p-4 text-center text-xs text-zinc-400 italic">
                                No assets mapped to {group}.
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                {groupAssets.map((asset, index) => {
                                    const realIndex = data.assets.findIndex(a => a.id === asset.id);
                                    return (
                                        <div key={asset.id} className="bg-white border border-zinc-200 p-4 shadow-sm text-xs relative grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                            
                                            <div className="md:col-span-5">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-zinc-500 font-bold">Description</label>
                                                    <button onClick={() => removeAsset(realIndex)} className="text-zinc-300 hover:text-red-500 text-[10px]" title="Delete"><i className="fas fa-trash"></i></button>
                                                </div>
                                                <input 
                                                    value={asset.description} 
                                                    onChange={e => updateAsset(realIndex, 'description', e.target.value)} 
                                                    className="w-full border p-1.5 rounded focus:ring-[#86BC25] focus:border-[#86BC25]"
                                                />
                                            </div>
                                            
                                            <div className="md:col-span-3">
                                                <label className="block text-zinc-500 font-bold mb-1">Tax Basis (IB)</label>
                                                <input 
                                                    type="number"
                                                    value={asset.taxAcquisitionValue} 
                                                    onChange={e => updateAsset(realIndex, 'taxAcquisitionValue', parseFloat(e.target.value))} 
                                                    className="w-full border p-1.5 rounded font-mono text-right focus:ring-[#86BC25] focus:border-[#86BC25]"
                                                />
                                            </div>

                                            <div className="md:col-span-1">
                                                <label className="block text-zinc-500 font-bold mb-1">Rate</label>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={asset.taxRate} 
                                                    onChange={e => updateAsset(realIndex, 'taxRate', parseFloat(e.target.value))} 
                                                    className="w-full border p-1.5 rounded text-center focus:ring-[#86BC25] focus:border-[#86BC25]"
                                                />
                                            </div>

                                            <div className="md:col-span-3">
                                                <label className="block text-zinc-500 font-bold mb-1 text-green-700">(-) Tax Depr</label>
                                                <div className="p-1.5 bg-green-50 text-green-800 font-mono font-bold border border-green-100 rounded text-right">
                                                    {formatMoney(asset.calculatedTaxDepreciation)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="bg-black text-white p-6 rounded shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <div className="text-sm opacity-70">Total Added (Booked Depreciation)</div>
                    <div className="font-mono text-sm">{formatMoney(totalBookedDepreciation)}</div>
                </div>
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-4">
                    <div className="text-sm opacity-70">Total Deducted (Tax Depreciation)</div>
                    <div className="font-mono text-sm text-[#86BC25]">- {formatMoney(totalTaxDepr)}</div>
                </div>
                <div className="flex justify-between items-center">
                    <div className="font-bold text-lg">Net Adjustment (Field 4.9)</div>
                    <div className="text-right">
                        <div className={`font-mono text-2xl font-bold ${data.totalAdjustment49 > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {formatMoney(data.totalAdjustment49)}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase mt-1">
                            {data.totalAdjustment49 > 0 ? "Net Addition to Tax Base" : "Net Deduction from Tax Base"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const InventoryView: React.FC<Props> = ({ adjustments, onUpdate }) => {
    const globalId = 'global_inventory_obsolescence';
    const entry = adjustments[globalId] || { accountId: globalId, adjustmentAmount: 0 };
    const data = entry.inventoryObsolescenceData || { acquisitionValue: 0, bookedReserve: 0, valuationMethod: 'alternative', priorYearNonDeductible: 0 };

    const update = (field: keyof InventoryObsolescenceData, val: any) => {
        const newData = { ...data, [field]: val };
        let excess = 0;
        
        if (newData.valuationMethod === 'main') {
            // Main Rule (Individuell värdering) allows full deduction if substantiated
            excess = 0;
        } else {
            // Alternative Rule (97%)
            const allowedReserve = newData.acquisitionValue * 0.03; // Max 3% obsolescence allowed by standard rule
            excess = Math.max(0, newData.bookedReserve - allowedReserve);
        }
        
        onUpdate(globalId, { adjustmentAmount: excess, ink2sCode: '4.3c', inventoryObsolescenceData: newData });
    };

    return (
        <div className="p-6">
            <h2 className="text-lg font-bold mb-4">Inventory Obsolescence</h2>
            <div className="bg-white border border-zinc-200 p-4 space-y-4 max-w-md">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold">Acquisition Value (Cost)</label>
                    <input type="number" value={data.acquisitionValue} onChange={e => update('acquisitionValue', parseFloat(e.target.value))} className="border p-2 w-32 text-right font-mono focus:ring-[#86BC25]" />
                </div>
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold">Booked Reserve (UB)</label>
                    <input type="number" value={data.bookedReserve} onChange={e => update('bookedReserve', parseFloat(e.target.value))} className="border p-2 w-32 text-right font-mono focus:ring-[#86BC25]" />
                </div>
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold">Method</label>
                    <select value={data.valuationMethod} onChange={e => update('valuationMethod', e.target.value)} className="border p-2 w-32 text-right focus:ring-[#86BC25]">
                        <option value="alternative">Standard (97%)</option>
                        <option value="main">Individual Valuation</option>
                    </select>
                </div>
                <div className="border-t pt-4 mt-4 flex justify-between text-red-500 font-bold">
                    <span>Non-Deductible Reserve (4.3c)</span>
                    <span>{Math.round(entry.adjustmentAmount)}</span>
                </div>
                {data.valuationMethod === 'main' && <p className="text-[10px] text-zinc-500 italic">With Individual Valuation, we assume the booked reserve is substantiated and deductible.</p>}
            </div>
        </div>
    );
};
