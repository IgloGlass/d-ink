
import React, { useState, useMemo } from 'react';
import { Account, MappingResult } from '../types';
import { BS_TAX_CATEGORIES, IS_TAX_CATEGORIES } from '../constants';

interface AccountTableProps {
  accounts: Account[];
  mappings: Record<string, MappingResult>;
  onUpdateMapping: (accountNumber: string, updates: Partial<MappingResult>) => void;
  onUpdateAccountType: (id: string, newType: 'balans' | 'resultat') => void;
  onUpdateAccountField: (id: string, field: keyof Account, value: string) => void;
  onCommitAccountField: () => void;
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
}

type SortKey = 'accountNumber' | 'accountName' | 'type';
type SortDirection = 'asc' | 'desc';

const AccountTable: React.FC<AccountTableProps> = ({ 
  accounts, 
  mappings, 
  onUpdateMapping, 
  onUpdateAccountType,
  onUpdateAccountField,
  onCommitAccountField,
  isLoading,
  selectedIds,
  onToggleSelection,
  onToggleAll
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);

  // Column Widths State
  const [columnWidths, setColumnWidths] = useState({
    accountNumber: 120,
    accountName: 400, // Increased
    ib: 120,
    ub: 120,
    yearEnd: 120,
    type: 100,
    silverfinAccount: 300, // Increased
    silverfinAccountNr: 90,
    reasoning: 350 // Increased
  });

  const startResize = (e: React.MouseEvent, colKey: keyof typeof columnWidths) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent sorting triggering if clicking resizer

    const startX = e.clientX;
    const startWidth = columnWidths[colKey];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + delta)
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const sortedAccounts = useMemo(() => {
    if (!sortConfig) return accounts;
    const sorted = [...accounts];
    sorted.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortConfig.key === 'accountNumber') {
          // Numeric sort for account numbers
          valA = parseInt(a.accountNumber.replace(/\D/g, '')) || 0;
          valB = parseInt(b.accountNumber.replace(/\D/g, '')) || 0;
      } else if (sortConfig.key === 'type') {
          valA = a.type;
          valB = b.type;
      } else {
          valA = a.accountName.toLowerCase();
          valB = b.accountName.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [accounts, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
    setShowSortMenu(false);
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) return <i className="fas fa-sort text-zinc-300 ml-1"></i>;
    return sortConfig.direction === 'asc' 
      ? <i className="fas fa-sort-up text-[#86BC25] ml-1"></i>
      : <i className="fas fa-sort-down text-[#86BC25] ml-1"></i>;
  };

  const handleCopyColumn = (e: React.MouseEvent, colKey: string) => {
    e.stopPropagation(); // Prevent sorting
    
    const values = sortedAccounts.map(acc => {
      const mapping = mappings[acc.accountNumber];
      if (colKey === 'silverfinAccountNr') return mapping?.silverfinAccountNr || '';
      if (colKey === 'silverfinAccount') return mapping?.suggestedCategory || '';
      return '';
    });
    
    const text = values.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedColumn(colKey);
      setTimeout(() => setCopiedColumn(null), 2000);
    }).catch(err => {
      console.error("Failed to copy column", err);
    });
  };

  const allSelected = accounts.length > 0 && selectedIds.size === accounts.length;

  if (accounts.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-zinc-200 rounded-none p-12 text-center">
        <div className="text-zinc-300 mb-4 text-4xl">
          <i className="fas fa-table"></i>
        </div>
        <h3 className="text-lg font-semibold text-black mb-1">No accounts submitted</h3>
        <p className="text-zinc-500 max-w-sm mx-auto">Please submit the accounts to be mapped by pasting from Excel or adding manually.</p>
      </div>
    );
  }

  // Resizer Component (Inline for simplicity)
  const Resizer = ({ colKey }: { colKey: keyof typeof columnWidths }) => (
    <div 
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#86BC25] z-10 transition-colors opacity-0 hover:opacity-100"
      onMouseDown={(e) => startResize(e, colKey)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  return (
    <div className="bg-white rounded-none shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex flex-row justify-between items-center gap-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {accounts.length} Accounts
        </div>
        <div className="relative">
             <button 
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-2 text-xs font-bold text-zinc-600 bg-white border border-zinc-300 px-3 py-1.5 rounded-full hover:bg-black hover:text-white transition-all shadow-sm"
             >
                 <i className="fas fa-sort"></i>
                 Sort Table
             </button>
             
             {showSortMenu && (
                 <>
                   <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)}></div>
                   <div className="absolute right-0 mt-2 w-48 bg-white rounded-none shadow-xl border border-zinc-200 z-20 overflow-hidden animate-fade-in">
                       <div className="p-1">
                           <button 
                               onClick={() => handleSort('accountNumber')}
                               className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${sortConfig?.key === 'accountNumber' ? 'bg-[#86BC25] text-white font-bold' : 'text-zinc-600 hover:bg-zinc-50'}`}
                           >
                               <span>Account Number</span>
                               {sortConfig?.key === 'accountNumber' && <i className={`fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                           </button>
                           <button 
                               onClick={() => handleSort('accountName')}
                               className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${sortConfig?.key === 'accountName' ? 'bg-[#86BC25] text-white font-bold' : 'text-zinc-600 hover:bg-zinc-50'}`}
                           >
                               <span>Account Name</span>
                               {sortConfig?.key === 'accountName' && <i className={`fas fa-sort-${sortConfig.direction === 'asc' ? 'alpha-up' : 'alpha-down'}`}></i>}
                           </button>
                           <button 
                               onClick={() => handleSort('type')}
                               className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${sortConfig?.key === 'type' ? 'bg-[#86BC25] text-white font-bold' : 'text-zinc-600 hover:bg-zinc-50'}`}
                           >
                               <span>Type (Bal/Res)</span>
                               {sortConfig?.key === 'type' && <i className={`fas fa-sort-${sortConfig.direction === 'asc' ? 'amount-up' : 'amount-down'}`}></i>}
                           </button>
                       </div>
                   </div>
                 </>
             )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Added table-fixed and style for explicit widths */}
        <table className="text-left border-collapse table-fixed" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-4 w-10 relative">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="rounded border-zinc-300 text-[#86BC25] focus:ring-[#86BC25]"
                />
              </th>
              <th 
                style={{ width: columnWidths.accountNumber }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors group relative"
                onClick={() => handleSort('accountNumber')}
              >
                Konto {getSortIcon('accountNumber')}
                <Resizer colKey="accountNumber" />
              </th>
              <th 
                style={{ width: columnWidths.accountName }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider cursor-pointer hover:bg-zinc-100 transition-colors group relative"
                onClick={() => handleSort('accountName')}
              >
                Konto_text {getSortIcon('accountName')}
                <Resizer colKey="accountName" />
              </th>
              <th 
                style={{ width: columnWidths.ib }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider text-right whitespace-nowrap relative"
              >
                IB
                <Resizer colKey="ib" />
              </th>
              <th 
                style={{ width: columnWidths.ub }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider text-right whitespace-nowrap relative"
              >
                UB
                <Resizer colKey="ub" />
              </th>
              <th 
                style={{ width: columnWidths.yearEnd }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap relative"
              >
                Räkenskap slut
                <Resizer colKey="yearEnd" />
              </th>
              <th 
                style={{ width: columnWidths.type }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-zinc-100 transition-colors group relative"
                onClick={() => handleSort('type')}
              >
                Kontotyp {getSortIcon('type')}
                <Resizer colKey="type" />
              </th>
              <th 
                style={{ width: columnWidths.silverfinAccount }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider relative group"
              >
                 <div className="flex justify-between items-center">
                    <span>Silverfin Account</span>
                    <button
                        onClick={(e) => handleCopyColumn(e, 'silverfinAccount')}
                        className="text-zinc-400 hover:text-[#86BC25] transition-colors ml-1"
                        title="Copy column"
                    >
                        <i className={`fas ${copiedColumn === 'silverfinAccount' ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                </div>
                <Resizer colKey="silverfinAccount" />
              </th>
              <th 
                style={{ width: columnWidths.silverfinAccountNr }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider relative align-bottom group"
              >
                <div className="flex justify-between items-end">
                    <div className="leading-tight">Silverfin<br/>Account Nr</div>
                    <button
                        onClick={(e) => handleCopyColumn(e, 'silverfinAccountNr')}
                        className="text-zinc-400 hover:text-[#86BC25] transition-colors mb-0.5 ml-1"
                        title="Copy column"
                    >
                        <i className={`fas ${copiedColumn === 'silverfinAccountNr' ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                </div>
                <Resizer colKey="silverfinAccountNr" />
              </th>
              <th 
                style={{ width: columnWidths.reasoning }}
                className="px-4 py-4 text-xs font-bold text-black uppercase tracking-wider relative"
              >
                Reasoning
                <Resizer colKey="reasoning" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {sortedAccounts.map((account) => {
              const mapping = mappings[account.accountNumber];
              const categories = account.type === 'balans' ? BS_TAX_CATEGORIES : IS_TAX_CATEGORIES;
              const isSelected = selectedIds.has(account.id);
              
              // Determine if Tax Sensitive
              const category = mapping?.suggestedCategory || "";
              const isTaxSensitive = category && !category.toLowerCase().startsWith("ej skattesensitiv");
              
              // Determine Styling
              const rowBgClass = isSelected 
                ? 'bg-[#86BC25]/20' 
                : 'hover:bg-zinc-50 transition-colors';
                
              // Keep tax sensitive highlight subtle
              const cellBgClass = isTaxSensitive ? 'bg-[#86BC25]/25' : '';
              
              return (
                <tr key={account.id} className={`group text-sm ${rowBgClass}`}>
                  <td className="px-4 py-3 align-top">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => onToggleSelection(account.id)}
                      className="rounded border-zinc-300 text-[#86BC25] focus:ring-[#86BC25] mt-1"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                     <input
                      type="text"
                      value={account.accountNumber}
                      onChange={(e) => onUpdateAccountField(account.id, 'accountNumber', e.target.value)}
                      onBlur={onCommitAccountField}
                      className="bg-transparent border-b border-transparent focus:border-[#86BC25] focus:ring-0 text-sm font-medium text-black w-full"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <textarea
                      value={account.accountName}
                      onChange={(e) => {
                         onUpdateAccountField(account.id, 'accountName', e.target.value);
                         e.target.style.height = 'auto';
                         e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onBlur={onCommitAccountField}
                      rows={2}
                      className="bg-transparent border-b border-transparent focus:border-[#86BC25] focus:ring-0 text-sm text-zinc-700 w-full resize-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <input
                      type="text"
                      value={account.ib || '0'}
                      onChange={(e) => onUpdateAccountField(account.id, 'ib', e.target.value)}
                      onBlur={onCommitAccountField}
                      className="bg-transparent border-b border-transparent focus:border-[#86BC25] focus:ring-0 text-sm font-mono text-zinc-700 w-full text-right"
                    />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <input
                      type="text"
                      value={account.ub || '0'}
                      onChange={(e) => onUpdateAccountField(account.id, 'ub', e.target.value)}
                      onBlur={onCommitAccountField}
                      className="bg-transparent border-b border-transparent focus:border-[#86BC25] focus:ring-0 text-sm font-mono text-zinc-700 w-full text-right"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="text-sm text-zinc-500 block py-1">
                      {account.yearEnd || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <select
                      value={account.type}
                      onChange={(e) => onUpdateAccountType(account.id, e.target.value as 'balans' | 'resultat')}
                      className="text-xs font-bold rounded px-2 py-1 border-zinc-200 text-zinc-700 cursor-pointer focus:ring-2 focus:ring-[#86BC25] focus:border-transparent w-full"
                    >
                      <option value="balans">balans</option>
                      <option value="resultat">resultat</option>
                    </select>
                  </td>
                  <td className={`px-4 py-3 transition-colors duration-300 align-top ${cellBgClass}`}>
                    {isLoading && !mapping ? (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <i className="fas fa-circle-notch fa-spin text-xs"></i>
                        <span className="text-xs italic">Mapping...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 w-full relative">
                        <div className="relative">
                          <select
                            value={mapping?.suggestedCategory || ""}
                            onChange={(e) => onUpdateMapping(account.accountNumber, { suggestedCategory: e.target.value })}
                            className={`text-xs bg-transparent border-none focus:ring-2 focus:ring-[#86BC25] rounded-none py-1 pr-6 pl-1 transition-all cursor-pointer w-full appearance-none ${
                               mapping ? 'text-black font-semibold' : 'text-zinc-400 italic'
                            }`}
                          >
                            <option value="" disabled>Select category...</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat} className="text-black font-normal">
                                {cat}
                              </option>
                            ))}
                          </select>
                          {/* Manual Override Icon */}
                          {mapping?.isManualOverride && (
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                                <i className="fas fa-user-edit text-[#86BC25] text-xs"></i>
                             </div>
                          )}
                        </div>
                        
                        {mapping && !mapping.isManualOverride && (
                          <div className="flex items-center gap-1.5 pl-1">
                            <div className="w-12 h-1 bg-zinc-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  mapping.confidence > 0.8 ? 'bg-[#86BC25]' : mapping.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                                }`} 
                                style={{ width: `${mapping.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-400 font-bold">{(mapping.confidence * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input 
                      type="text"
                      value={mapping?.silverfinAccountNr || ""}
                      readOnly
                      placeholder="-"
                      className="w-full bg-zinc-50 border-b border-transparent text-xs py-1 text-zinc-500 font-mono"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate align-top" title={mapping?.reasoning}>
                    {mapping?.reasoning || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountTable;
