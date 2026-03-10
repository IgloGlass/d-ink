
import * as XLSX from 'xlsx';
import { Account, MappingResult } from '../types';

export const exportToSilverfin = (accounts: Account[], mappings: Record<string, MappingResult>) => {
    // 1. Prepare data structure optimized for Silverfin import
    // Standard expectation: Account Number, Account Name, Mapping Code (Silverfin Account Nr)
    
    const exportData = accounts.map(acc => {
        const mapping = mappings[acc.accountNumber];
        
        // Clean numeric values
        const parseVal = (v: string | undefined) => {
            if (!v) return 0;
            return parseFloat(v.replace(/\s/g, '').replace(',', '.')) || 0;
        };

        return {
            'Account Number': acc.accountNumber,
            'Account Name': acc.accountName,
            'Silverfin Mapping Number': mapping?.silverfinAccountNr || '',
            'Silverfin Mapping Name': mapping?.suggestedCategory || '',
            'Internal Type': acc.type,
            'Opening Balance': parseVal(acc.ib),
            'Closing Balance': parseVal(acc.ub),
            'Year End': acc.yearEnd || ''
        };
    });

    // 2. Create Workbook and Sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // 3. Style / Widths (Metadata for better UX)
    const wscols = [
        { wch: 15 }, // Acc Num
        { wch: 40 }, // Acc Name
        { wch: 20 }, // Map Num
        { wch: 40 }, // Map Name
        { wch: 10 }, // Type
        { wch: 15 }, // IB
        { wch: 15 }, // UB
        { wch: 12 }  // Year End
    ];
    ws['!cols'] = wscols;

    // 4. Append
    XLSX.utils.book_append_sheet(wb, ws, "Silverfin Export");

    // 5. Download
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `dInk_Silverfin_Export_${dateStr}.xlsx`);
};
