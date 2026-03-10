
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AccountTable from '../AccountTable';
import { Account, MappingResult, AnnualReportAnalysis } from '../../types';
import { EXAMPLE_ACCOUNTS, getSilverfinNumber, TAX_CATEGORIES } from '../../constants';
import { mapAccounts, parseTrialBalance, parseExcelDataWithGemini } from '../../services/geminiService';
import * as XLSX from 'xlsx';

interface AccountMapperModuleProps {
  accounts: Account[];
  mappings: Record<string, MappingResult>;
  setAccounts: (accounts: Account[]) => void;
  setMappings: (mappings: Record<string, MappingResult>) => void;
  annualReportData?: AnnualReportAnalysis | null;
}

export const AccountMapperModule: React.FC<AccountMapperModuleProps> = ({ 
  accounts, 
  mappings, 
  setAccounts, 
  setMappings,
  annualReportData
}) => {
  // History Management
  const [history, setHistory] = useState<{accounts: Account[], mappings: Record<string, MappingResult>}[]>([
    { accounts: [], mappings: {} }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modal State
  const [showYearEndModal, setShowYearEndModal] = useState(false);
  const [bulkYearEnd, setBulkYearEnd] = useState('');

  // Selection State
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  // Import Mode State
  const [importMode, setImportMode] = useState<'standard' | 'ai'>('standard');
  const [fiscalYearEnd, setFiscalYearEnd] = useState<string>(new Date().getFullYear() + "-12-31");
  const [isParsing, setIsParsing] = useState(false);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);

  // Form states for manual entry
  const [newAccNum, setNewAccNum] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'balans' | 'resultat'>('balans');

  // --- History Logic ---

  const commitState = useCallback((newAccounts: Account[], newMappings: Record<string, MappingResult>) => {
    // Slice history to current index
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Add new state
    newHistory.push({
      accounts: newAccounts,
      mappings: newMappings
    });
    
    // Limit history stack size
    if (newHistory.length > 30) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Update Actual State via props
    setAccounts(newAccounts);
    setMappings(newMappings);
  }, [history, historyIndex, setAccounts, setMappings]);

  // Sync initial history with props if empty
  useEffect(() => {
    if (history.length === 1 && history[0].accounts.length === 0 && accounts.length > 0) {
        commitState(accounts, mappings);
    }
  }, [accounts, mappings, commitState, history]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      setAccounts(prevState.accounts);
      setMappings(prevState.mappings);
      setHistoryIndex(prevIndex);
      setSelectedAccountIds(new Set()); 
    }
  }, [history, historyIndex, setAccounts, setMappings]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      setAccounts(nextState.accounts);
      setMappings(nextState.mappings);
      setHistoryIndex(nextIndex);
      setSelectedAccountIds(new Set());
    }
  }, [history, historyIndex, setAccounts, setMappings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // --- Core Logic ---

  const sortAccounts = (accs: Account[]) => {
    return [...accs].sort((a, b) => {
      const numA = parseInt(a.accountNumber.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.accountNumber.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccNum || !newAccName) return;

    const newAccount: Account = {
      id: Math.random().toString(36).substr(2, 9),
      accountNumber: newAccNum,
      accountName: newAccName,
      type: newAccType,
      ib: "0",
      ub: "0",
      yearEnd: new Date().getFullYear() + "-12-31"
    };

    const nextAccounts = [...accounts, newAccount];
    commitState(nextAccounts, mappings);
    
    setNewAccNum('');
    setNewAccName('');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleUpdateAccountType = (id: string, newType: 'balans' | 'resultat') => {
    const nextAccounts = accounts.map(acc => 
      acc.id === id ? { ...acc, type: newType } : acc
    );
    commitState(nextAccounts, mappings);
  };

  const handleAccountFieldChange = (id: string, field: keyof Account, value: string) => {
      const nextAccounts = accounts.map(a => {
          if (a.id === id) {
              return { ...a, [field]: value };
          }
          return a;
      });
      
      if (field === 'accountNumber') {
          const oldAcc = accounts.find(a => a.id === id);
          if (oldAcc && oldAcc.accountNumber !== value) {
              const oldNum = oldAcc.accountNumber;
              const mapping = mappings[oldNum];
              if (mapping) {
                   const newMappings = { ...mappings };
                   delete newMappings[oldNum];
                   newMappings[value] = { ...mapping, accountNumber: value };
                   setMappings(newMappings);
              }
          }
      }
      
      setAccounts(nextAccounts);
  };

  const handleAccountFieldBlur = () => {
      commitState(accounts, mappings);
  };

  const handlePasteFromExcel = () => {
    if (!pasteValue.trim()) return;
    
    const parseExcelData = (text: string): string[][] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === '\t' && !inQuotes) {
                currentRow.push(currentCell);
                currentCell = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        if (currentRow.length > 0 || currentCell) {
            currentRow.push(currentCell);
            rows.push(currentRow);
        }
        return rows;
    };

    const parsedRows = parseExcelData(pasteValue.trim());
    const newAccounts: Account[] = [];
    
    parsedRows.forEach(parts => {
      if (parts.length < 2) return;
      
      const accNum = parts[0]?.trim();
      const accName = parts[1]?.replace(/[\r\n]+/g, ' ').trim();
      const ib = parts[2]?.trim() || "0";
      const ub = parts[3]?.trim() || "0";
      const yearEnd = parts[4]?.trim() || "";
      const typeStrRaw = parts[5]?.trim(); 
      
      let accType: 'balans' | 'resultat' = 'balans';
      
      if (typeStrRaw) {
        const typeStr = typeStrRaw.toLowerCase();
        if (typeStr.includes('resultat') || typeStr.includes('p') || typeStr.includes('income')) accType = 'resultat';
        else if (typeStr.includes('balans') || typeStr.includes('b')) accType = 'balans';
        else if (accNum && parseInt(accNum.charAt(0)) >= 3) accType = 'resultat';
      } else if (accNum && parseInt(accNum.charAt(0)) >= 3) accType = 'resultat';

      if (accNum && accName) {
        newAccounts.push({
          id: Math.random().toString(36).substr(2, 9),
          accountNumber: accNum,
          accountName: accName,
          type: accType,
          ib: ib,
          ub: ub,
          yearEnd: yearEnd || (new Date().getFullYear() + "-12-31")
        });
      }
    });

    if (newAccounts.length > 0) {
      const nextAccounts = [...accounts, ...newAccounts];
      commitState(nextAccounts, mappings);
      setPasteValue('');
      setError(null);
      setIsSidebarOpen(false);
    } else {
      setError("Could not parse data. Ensure columns are correct.");
    }
  };

  const handleAiTrialBalanceImport = async () => {
    if (!pasteValue.trim()) return;
    setIsParsing(true);
    setError(null);

    try {
      const parsedAccounts = await parseTrialBalance(pasteValue, fiscalYearEnd);
      if (parsedAccounts.length > 0) {
        const nextAccounts = sortAccounts([...accounts, ...parsedAccounts]);
        commitState(nextAccounts, mappings);
        setPasteValue('');
        setIsSidebarOpen(false);
      } else {
        setError("AI could not extract any accounts.");
      }
    } catch (err) {
      setError("Failed to parse trial balance.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleExcelUpload = async (file: File) => {
    setIsParsing(true);
    setError(null);
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            // Take first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Get raw rows
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (rows.length === 0) {
                setError("Excel file appears empty.");
                setIsParsing(false);
                return;
            }

            // Send to Gemini
            const parsedAccounts = await parseExcelDataWithGemini(rows, fiscalYearEnd);
            
            if (parsedAccounts.length > 0) {
                const nextAccounts = sortAccounts([...accounts, ...parsedAccounts]);
                commitState(nextAccounts, mappings);
                setExcelFileName(null); // Reset
                setIsSidebarOpen(false);
            } else {
                setError("AI could not identify trial balance data in the Excel file.");
            }

        } catch (err) {
            console.error(err);
            setError("Failed to read Excel file.");
        } finally {
            setIsParsing(false);
        }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            handleExcelUpload(file);
        } else {
            setError("Please drop a valid Excel file (.xlsx or .xls)");
        }
    }
  };

  const handleUpdateMapping = (accountNumber: string, updates: Partial<MappingResult>) => {
    const existing = mappings[accountNumber] || { 
      accountNumber, 
      suggestedCategory: '', 
      confidence: 1, 
      reasoning: "Manually created." 
    };

    let isManualOverride = existing.isManualOverride;
    
    if (updates.suggestedCategory !== undefined) {
      const account = accounts.find(a => a.accountNumber === accountNumber);
      updates.silverfinAccountNr = getSilverfinNumber(updates.suggestedCategory, account?.type);

      if (existing.originalAICategory === updates.suggestedCategory) {
        isManualOverride = false;
      } else {
        isManualOverride = true;
      }
    }

    const nextMappings = {
      ...mappings,
      [accountNumber]: {
        ...existing,
        ...updates,
        isManualOverride
      }
    };
    
    commitState(accounts, nextMappings);
  };

  const handleLoadExamples = () => {
    const examples: Account[] = EXAMPLE_ACCOUNTS.map(a => ({
      ...a,
      id: Math.random().toString(36).substr(2, 9),
      type: a.type as 'balans' | 'resultat'
    }));
    commitState(sortAccounts(examples), mappings);
    setIsSidebarOpen(false);
  };

  const handleStartMapping = async () => {
    const isSelectionActive = selectedAccountIds.size > 0;
    const targetAccounts = isSelectionActive
      ? accounts.filter(a => selectedAccountIds.has(a.id))
      : accounts;

    if (targetAccounts.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // PASS annualReportData to the service
      const results = await mapAccounts(targetAccounts, annualReportData);
      const mappingDict: Record<string, MappingResult> = { ...mappings };
      
      results.forEach(res => {
        const account = accounts.find(a => a.accountNumber === res.accountNumber);
        const correctNr = getSilverfinNumber(res.suggestedCategory, account?.type);
        const existing = mappingDict[res.accountNumber];
        
        const aiSuggestion: MappingResult = {
          ...res,
          silverfinAccountNr: correctNr, 
          originalAICategory: res.suggestedCategory,
          comment: existing?.comment,
          isManualOverride: false
        };

        if (isSelectionActive || !existing?.isManualOverride) {
          mappingDict[res.accountNumber] = aiSuggestion;
        } else {
          mappingDict[res.accountNumber] = {
            ...existing,
            originalAICategory: res.suggestedCategory,
          };
        }
      });
      commitState(accounts, mappingDict);
      if (isSelectionActive) setSelectedAccountIds(new Set());
    } catch (err: any) {
      setError("Mapping failed. Ensure your data follows the expected format.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (accounts.length === 0) return;
    const headers = [
      'Konto', 'Konto_text', 'IB', 'UB', 'Räkenskap slut', 'Kontotyp', 
      'Silverfin Account', 'Silverfin Account Nr', 'Reasoning'
    ];
    
    const rows = accounts.map(acc => {
      const mapping = mappings[acc.accountNumber];
      const clean = (str: string | undefined) => (str || '').replace(/[\r\n]+/g, ' ');
      return [
        clean(acc.accountNumber), clean(acc.accountName), clean(acc.ib), clean(acc.ub),
        clean(acc.yearEnd), clean(acc.type), clean(mapping?.suggestedCategory),
        clean(mapping?.silverfinAccountNr), clean(mapping?.reasoning)
      ].join('\t');
    });

    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
  };

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedAccountIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAccountIds(newSet);
  };

  const handleToggleAll = (selected: boolean) => {
    if (selected) {
      setSelectedAccountIds(new Set(accounts.map(a => a.id)));
    } else {
      setSelectedAccountIds(new Set());
    }
  };

  const handleBulkTypeChange = (newType: 'balans' | 'resultat') => {
    const nextAccounts = accounts.map(acc => 
      selectedAccountIds.has(acc.id) ? { ...acc, type: newType } : acc
    );
    commitState(nextAccounts, mappings);
    setSelectedAccountIds(new Set());
  };

  const handleBulkCategoryChange = (newCategory: string) => {
    const nextMappings = { ...mappings };
    accounts.forEach(acc => {
      if (selectedAccountIds.has(acc.id)) {
        const existing = nextMappings[acc.accountNumber] || { 
          accountNumber: acc.accountNumber, confidence: 1, reasoning: "Bulk updated", suggestedCategory: '' 
        };
        const isOverride = existing.originalAICategory !== newCategory;
        nextMappings[acc.accountNumber] = {
          ...existing,
          suggestedCategory: newCategory,
          silverfinAccountNr: getSilverfinNumber(newCategory, acc.type),
          isManualOverride: isOverride
        };
      }
    });
    commitState(accounts, nextMappings);
    setSelectedAccountIds(new Set());
  };

  const handleReverseSigns = (targetType: 'balans' | 'resultat') => {
    const nextAccounts = accounts.map(acc => {
      if (acc.type === targetType) {
        const parseVal = (v: string) => parseFloat(v.replace(',', '.').replace(/\s/g, '')) || 0;
        const ibVal = parseVal(acc.ib || "0") * -1;
        const ubVal = parseVal(acc.ub || "0") * -1;
        return {
          ...acc,
          ib: ibVal.toString(),
          ub: ubVal.toString()
        };
      }
      return acc;
    });
    commitState(nextAccounts, mappings);
  };
  
  const handleOpenYearEndModal = () => {
      if (accounts.length === 0) return;
      setBulkYearEnd(accounts[0].yearEnd || new Date().getFullYear() + "-12-31");
      setShowYearEndModal(true);
  };

  const handleApplyYearEnd = () => {
      if (!bulkYearEnd) return;
      const nextAccounts = accounts.map(acc => ({ ...acc, yearEnd: bulkYearEnd }));
      commitState(nextAccounts, mappings);
      setShowYearEndModal(false);
  };

  const stats = useMemo(() => {
    const mappedValues = Object.values(mappings) as MappingResult[];
    const mappedCount = mappedValues.filter(m => m.suggestedCategory).length;
    const totalCount = accounts.length;
    const avgConfidence = totalCount > 0 
      ? mappedValues.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / (mappedCount || 1)
      : 0;

    // Calculate Totals
    let totalBalans = 0;
    let totalResultat = 0;

    accounts.forEach(acc => {
        const val = parseFloat((acc.ub || '0').replace(/\s/g, '').replace(',', '.')) || 0;
        if (acc.type === 'balans') totalBalans += val;
        if (acc.type === 'resultat') totalResultat += val;
    });
      
    return { mappedCount, totalCount, avgConfidence, totalBalans, totalResultat };
  }, [accounts, mappings]);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? 'w-full lg:w-80 flex-shrink-0 opacity-100' : 'w-0 overflow-hidden opacity-0'} transition-all duration-300 ease-in-out space-y-6`}>
             <div className="flex justify-between items-center mb-2 lg:hidden">
                <span className="text-sm font-bold text-zinc-500">Import Tools</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                    <i className="fas fa-times"></i>
                </button>
             </div>

            <div className="bg-white rounded-none shadow-sm border border-zinc-200 overflow-hidden min-w-[300px]">
              <div className="flex border-b border-zinc-200">
                <button
                  onClick={() => setImportMode('standard')}
                  className={`flex-1 py-4 text-xs font-bold text-center transition-all uppercase tracking-wide ${
                    importMode === 'standard' ? 'bg-white text-black border-b-4 border-[#86BC25]' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 border-b-4 border-transparent'
                  }`}
                >
                  Standard Format
                </button>
                <button
                  onClick={() => setImportMode('ai')}
                  className={`flex-1 py-4 text-xs font-bold text-center transition-all uppercase tracking-wide ${
                    importMode === 'ai' ? 'bg-white text-black border-b-4 border-[#86BC25]' : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 border-b-4 border-transparent'
                  }`}
                >
                  AI Smart Import
                </button>
              </div>
              
              <div className="p-6">
                <h3 className="text-sm font-bold text-black mb-2 flex items-center gap-2">
                  <i className={`fas ${importMode === 'standard' ? 'fa-file-excel' : 'fa-magic'} ${importMode === 'standard' ? 'text-[#86BC25]' : 'text-zinc-900'}`}></i>
                  {importMode === 'standard' ? 'Paste from Excel-verktyget' : 'AI Trial Balance Import'}
                </h3>
                
                {importMode === 'standard' ? (
                  <>
                    <p className="text-[10px] text-zinc-500 mb-3">Copy 6 columns from Excel-verktyget (Konto, Konto_text, IB, UB, Räkenskap slut, Kontotyp) and paste below.</p>
                    <textarea 
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      placeholder="Paste tab-separated columns here..."
                      className="w-full h-32 px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-xs focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all resize-none font-mono"
                    ></textarea>
                    <button 
                      onClick={handlePasteFromExcel}
                      className="w-full mt-2 bg-zinc-100 text-black border border-zinc-300 py-2.5 rounded-full text-xs font-bold hover:bg-[#86BC25] hover:text-white hover:border-[#86BC25] transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-file-import"></i> Import Accounts
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-zinc-500 mb-3">Paste raw trial balance data OR drop an Excel file. The AI will extract accounts, identify columns, and classify types.</p>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-zinc-500 mb-1">Fiscal Year End</label>
                      <input 
                        type="date" 
                        value={fiscalYearEnd}
                        onChange={(e) => setFiscalYearEnd(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-xs focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all"
                      />
                    </div>
                    
                    {/* Excel Drop Zone */}
                    <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="mb-3 border-2 border-dashed border-zinc-300 rounded-none p-4 text-center hover:bg-zinc-50 transition-colors"
                    >
                         <input 
                            type="file" 
                            accept=".xlsx, .xls"
                            id="excel-upload"
                            className="hidden"
                            onChange={(e) => e.target.files && e.target.files[0] && handleExcelUpload(e.target.files[0])}
                            disabled={isParsing}
                         />
                         <label htmlFor="excel-upload" className="cursor-pointer">
                            <i className="fas fa-file-excel text-2xl text-[#86BC25] mb-2"></i>
                            <div className="text-xs font-bold text-zinc-600">
                                {isParsing ? 'Analyzing Excel...' : excelFileName ? `Selected: ${excelFileName}` : 'Drop Excel File Here'}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-1">
                                or click to browse
                            </div>
                         </label>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-zinc-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-2 bg-white text-[10px] text-zinc-400">OR PASTE TEXT</span>
                        </div>
                    </div>

                    <textarea 
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                      placeholder="Paste any trial balance text (Account, Name, IB, UB)..."
                      className="w-full h-24 px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-xs focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all resize-none font-mono mt-3"
                    ></textarea>
                    
                    <button 
                      onClick={handleAiTrialBalanceImport}
                      disabled={isParsing || (!pasteValue.trim() && !excelFileName)}
                      className={`w-full mt-2 text-white py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        isParsing ? 'bg-zinc-400' : 'bg-[#86BC25] hover:bg-[#76a820] shadow-sm'
                      }`}
                    >
                      {isParsing ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-robot"></i>
                          Analyze & Import
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-none shadow-sm border border-zinc-200 p-6 min-w-[300px]">
              <h3 className="text-sm font-bold text-black mb-4 flex items-center gap-2">
                <i className="fas fa-plus-circle text-zinc-400"></i>
                Manual Entry
              </h3>
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Account Number</label>
                  <input 
                    type="text" 
                    value={newAccNum}
                    onChange={(e) => setNewAccNum(e.target.value)}
                    placeholder="e.g. 1930"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Account Name</label>
                  <input 
                    type="text" 
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder="e.g. Företagskonto"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAccType('balans')}
                      className={`px-3 py-2 text-xs font-bold rounded-full transition-all ${
                        newAccType === 'balans' ? 'bg-black text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      balans
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAccType('resultat')}
                      className={`px-3 py-2 text-xs font-bold rounded-full transition-all ${
                        newAccType === 'resultat' ? 'bg-black text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      resultat
                    </button>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-black text-white py-2.5 rounded-full text-sm font-bold hover:bg-zinc-800 transition-all shadow-sm"
                >
                  Add Account
                </button>
              </form>
            </div>

            <div className="space-y-2 min-w-[300px]">
              <button 
                onClick={handleLoadExamples}
                className="w-full bg-zinc-50 text-zinc-700 border border-zinc-200 py-2.5 rounded-full text-xs font-bold hover:bg-[#86BC25] hover:text-white hover:border-[#86BC25] transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-lightbulb"></i> Load Example Accounts
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-none text-xs flex items-start gap-3 min-w-[300px]">
                <i className="fas fa-exclamation-circle mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex-grow min-w-0 space-y-6">
            
            {/* Sidebar Toggle */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center gap-2 text-xs font-bold text-zinc-600 bg-white border border-zinc-300 px-3 py-2 rounded-full hover:bg-zinc-50 hover:text-black transition-all shadow-sm"
            >
                <i className={`fas ${isSidebarOpen ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}`}></i>
                {isSidebarOpen ? 'Hide Import Tools' : 'Show Import Tools'}
            </button>
            
            {/* Stats Dashboard */}
            <div className="space-y-4">
               {/* Upper Row: 3 White Boxes */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-none shadow-sm border-t-4 border-black">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Queue Size</span>
                    <div className="text-3xl font-extrabold text-black">{stats.totalCount}</div>
                  </div>
                  <div className="bg-white p-6 rounded-none shadow-sm border-t-4 border-[#86BC25]">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Mappings Complete</span>
                    <div className="text-3xl font-extrabold text-black">{stats.mappedCount}</div>
                  </div>
                  <div className="bg-white p-6 rounded-none shadow-sm border-t-4 border-zinc-300">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">AI Confidence</span>
                    <div className="text-3xl font-extrabold text-black">{(stats.avgConfidence * 100).toFixed(0)}%</div>
                  </div>
               </div>

               {/* Lower Row: Financial Check */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-none shadow-sm border-t-4 border-zinc-800">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Total Balans (Assets = Equity+Liab)</span>
                    <div className="text-2xl font-mono font-bold text-black">
                        {new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.totalBalans)}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-none shadow-sm border-t-4 border-zinc-500">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Total Resultat</span>
                    <div className="text-2xl font-mono font-bold text-black">
                        {new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.totalResultat)}
                    </div>
                  </div>
               </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div>
                <h2 className="text-lg font-bold text-black tracking-tight">Account Mapping Workbench</h2>
                <p className="text-xs text-zinc-500">Mapping results for Silverfin Integration</p>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-1 mr-2 border-r border-zinc-300 pr-3">
                  <button 
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-300 text-zinc-600 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo (Ctrl+Z)"
                  >
                    <i className="fas fa-undo text-xs"></i>
                  </button>
                  <button 
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-300 text-zinc-600 rounded-lg hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Redo (Ctrl+Y)"
                  >
                    <i className="fas fa-redo text-xs"></i>
                  </button>
                </div>

                <button 
                  onClick={handleCopy}
                  disabled={accounts.length === 0}
                  className="px-4 py-2 border border-zinc-300 text-zinc-600 text-xs font-bold rounded-full hover:bg-zinc-100 transition-all disabled:opacity-50 flex items-center gap-2"
                  title="Copy entire table to clipboard"
                >
                  {isCopied ? (
                    <>
                      <i className="fas fa-check text-[#86BC25]"></i>
                      Copied!
                    </>
                  ) : (
                    <>
                      <i className="fas fa-copy"></i>
                      Copy Table
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { 
                     const empty: Account[] = [];
                     const emptyMap: Record<string, MappingResult> = {};
                     commitState(empty, emptyMap);
                     setSelectedAccountIds(new Set()); 
                     setIsSidebarOpen(true); 
                  }}
                  disabled={accounts.length === 0 || isLoading}
                  className="px-4 py-2 border border-zinc-300 text-zinc-600 text-xs font-bold rounded-full hover:bg-zinc-100 transition-all disabled:opacity-50"
                >
                  Reset
                </button>
                <button 
                  onClick={handleStartMapping}
                  disabled={accounts.length === 0 || isLoading}
                  className={`px-8 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                    isLoading 
                      ? 'bg-zinc-400 text-white cursor-not-allowed' 
                      : 'bg-[#86BC25] text-white hover:bg-[#76a820]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Applying Guidelines...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-brain"></i>
                      {selectedAccountIds.size > 0 ? `Run on ${selectedAccountIds.size} Selected` : "Run AI Analysis"}
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Bulk Edit Bar */}
            {selectedAccountIds.size > 0 && (
              <div className="bg-zinc-100 border border-zinc-200 p-3 rounded-none flex flex-wrap items-center gap-4 animate-fade-in">
                 <span className="text-xs font-bold text-white bg-black px-2 py-1">
                   {selectedAccountIds.size} selected
                 </span>
                 <div className="h-4 w-px bg-zinc-300"></div>
                 <div className="flex items-center gap-2">
                    <span className="text-xs text-black font-bold">Set Type:</span>
                    <button onClick={() => handleBulkTypeChange('balans')} className="px-3 py-1 bg-white border border-zinc-300 text-xs rounded hover:bg-black hover:text-white transition-colors text-black">Balans</button>
                    <button onClick={() => handleBulkTypeChange('resultat')} className="px-3 py-1 bg-white border border-zinc-300 text-xs rounded hover:bg-black hover:text-white transition-colors text-black">Resultat</button>
                 </div>
                 <div className="h-4 w-px bg-zinc-300"></div>
                 <div className="flex items-center gap-2 flex-grow">
                    <span className="text-xs text-black font-bold">Set Silverfin Account:</span>
                    <select 
                      onChange={(e) => handleBulkCategoryChange(e.target.value)}
                      defaultValue=""
                      className="text-xs border-zinc-300 rounded py-1 px-2 focus:ring-[#86BC25] focus:border-[#86BC25] max-w-xs"
                    >
                      <option value="" disabled>Choose category...</option>
                      {TAX_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                 </div>
              </div>
            )}

            <AccountTable 
              accounts={accounts} 
              mappings={mappings} 
              onUpdateMapping={handleUpdateMapping}
              onUpdateAccountType={handleUpdateAccountType}
              onUpdateAccountField={handleAccountFieldChange}
              onCommitAccountField={handleAccountFieldBlur}
              isLoading={isLoading}
              selectedIds={selectedAccountIds}
              onToggleSelection={handleToggleSelection}
              onToggleAll={handleToggleAll}
            />

            {/* Data Tools Section */}
            <div className="bg-white border border-zinc-200 rounded-none p-4 flex flex-col sm:flex-row items-center gap-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2">
                    <i className="fas fa-tools text-zinc-400"></i>
                    <span className="text-sm font-bold text-zinc-700">Data Tools</span>
                </div>
                <div className="hidden sm:block h-6 w-px bg-zinc-200"></div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button 
                    onClick={() => handleReverseSigns('balans')}
                    disabled={accounts.length === 0}
                    className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs font-bold rounded-full hover:bg-zinc-50 transition-all disabled:opacity-50 flex items-center gap-2"
                    title="Multiply IB and UB by -1 for all Balance Sheet accounts"
                  >
                    <i className="fas fa-exchange-alt text-zinc-500"></i>
                    Flip Sign (Balans)
                  </button>
                  <button 
                    onClick={() => handleReverseSigns('resultat')}
                    disabled={accounts.length === 0}
                    className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs font-bold rounded-full hover:bg-zinc-50 transition-all disabled:opacity-50 flex items-center gap-2"
                    title="Multiply IB and UB by -1 for all Income Statement accounts"
                  >
                    <i className="fas fa-exchange-alt text-zinc-500"></i>
                    Flip Sign (Resultat)
                  </button>
                  <button 
                    onClick={handleOpenYearEndModal}
                    disabled={accounts.length === 0}
                    className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs font-bold rounded-full hover:bg-zinc-50 transition-all disabled:opacity-50 flex items-center gap-2"
                    title="Change financial year end date for all accounts"
                  >
                    <i className="fas fa-calendar-alt text-zinc-500"></i>
                    Edit financial year
                  </button>
               </div>
            </div>

            {/* Financial Year Modal */}
            {showYearEndModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-none shadow-2xl p-6 max-w-sm w-full animate-fade-in mx-4 border-t-4 border-[#86BC25]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-black">Edit Financial Year</h3>
                            <button 
                              onClick={() => setShowYearEndModal(false)}
                              className="text-zinc-400 hover:text-black transition-colors"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <p className="text-xs text-zinc-600 mb-4">
                            Select a new financial year end date. This will update the "Räkenskap slut" for all <strong>{accounts.length}</strong> accounts.
                        </p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-black mb-1">New Date</label>
                            <input 
                                type="date"
                                value={bulkYearEnd}
                                onChange={(e) => setBulkYearEnd(e.target.value)}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-[#86BC25] focus:border-transparent transition-all"
                            />
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                            <button 
                                onClick={() => setShowYearEndModal(false)}
                                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleApplyYearEnd}
                                className="px-4 py-2 text-xs font-bold text-white bg-[#86BC25] hover:bg-[#76a820] rounded-full transition-colors shadow-sm"
                            >
                                Apply Change
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
  );
};
