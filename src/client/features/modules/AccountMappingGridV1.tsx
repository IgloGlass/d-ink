import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

import {
  type SilverfinTaxCategoryCodeV1,
  listSilverfinTaxCategoriesV1,
} from "../../../shared/contracts/mapping.v1";
import { ButtonV1 } from "../../components/button-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { GuidanceBannerV1 } from "../../components/guidance-banner-v1";
import { InputV1 } from "../../components/input-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  ApiClientError,
  toUserFacingErrorMessage,
} from "../../lib/http/api-client";
import { applyMappingOverridesV1 } from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

const mappingGridRowHeightV1 = 48;
const mappingGridViewportHeightV1 = 600;
const mappingGridOverscanV1 = 10;

export function AccountMappingGridV1({
  tenantId,
  workspaceId,
  mappingQuery,
}: {
  tenantId: string;
  workspaceId: string;
  mappingQuery: {
    data?: {
      mapping?: {
        decisions?: Array<Record<string, unknown>>;
      };
    };
    isPending: boolean;
  };
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18nV1();
  
  // Grid State
  const [mappingViewMode, setMappingViewMode] = useState<"all" | "exceptions">("all");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [mappingScrollTop, setMappingScrollTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Column Widths
  const [columnWidths, setColumnWidths] = useState({
    select: 40,
    account: 120,
    description: 300,
    amount: 140,
    category: 240,
    confidence: 100,
    state: 140
  });

  const mappingScrollRef = useRef<HTMLDivElement | null>(null);

  const startResize = (e: React.MouseEvent, colKey: keyof typeof columnWidths) => {
    e.preventDefault();
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

  const mappingAllRows = mappingQuery.data?.mapping?.decisions ?? [];

  const mappingRows = useMemo(() => {
    if (mappingViewMode === "all") return mappingAllRows;
    return mappingAllRows.filter((row: any) => row.confidence < 0.8 || row.status === "overridden" || row.reviewFlag);
  }, [mappingAllRows, mappingViewMode]);

  const virtualRows = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(mappingScrollTop / mappingGridRowHeightV1) - mappingGridOverscanV1);
    const endIndex = Math.min(mappingRows.length, Math.ceil((mappingScrollTop + mappingGridViewportHeightV1) / mappingGridRowHeightV1) + mappingGridOverscanV1);
    
    return mappingRows.slice(startIndex, endIndex).map((row: any, i: number) => ({
      row,
      index: startIndex + i,
      offsetTop: (startIndex + i) * mappingGridRowHeightV1
    }));
  }, [mappingRows, mappingScrollTop]);

  const handleToggleSelection = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) setSelectedRowIds(new Set(mappingRows.map((r: any) => r.id)));
    else setSelectedRowIds(new Set());
  };

  // Drag and Drop Logic
  const handleExcelUpload = async (file: File) => {
    console.log("Uploading Excel:", file.name);
    // Implementation would link to existing parse logic or new service
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleExcelUpload(file);
      }
    }
  };

  if (mappingQuery.isPending) {
    return <div className="p-12 space-y-4"><SkeletonV1 height={48} /><SkeletonV1 height={400} /></div>;
  }

  const allSelected = mappingRows.length > 0 && selectedRowIds.size === mappingRows.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Grid Toolbar */}
      <section className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex rounded-full bg-zinc-100 p-1">
            <button 
              onClick={() => setMappingViewMode("all")}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${mappingViewMode === 'all' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              View All
            </button>
            <button 
              onClick={() => setMappingViewMode("exceptions")}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${mappingViewMode === 'exceptions' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Exceptions Only
            </button>
          </div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            {mappingRows.length} Rows
          </span>
        </div>

        <div className="flex items-center gap-2">
           <ButtonV1 variant="secondary" className="h-9 px-4 text-[10px] uppercase tracking-widest">
              <i className="fas fa-file-export mr-2 opacity-50"></i> Export CSV
           </ButtonV1>
           <ButtonV1 variant="primary" className="h-9 px-6 text-[10px] uppercase tracking-widest shadow-sm">
              Run AI Analysis
           </ButtonV1>
        </div>
      </section>

      {/* Bulk Action Bar */}
      {selectedRowIds.size > 0 && (
        <div className="bg-black text-white p-3 flex items-center justify-between animate-fade-in shadow-xl">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#86BC25] text-black px-2 py-1">
              {selectedRowIds.size} Selected
            </span>
            <div className="h-4 w-px bg-zinc-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bulk Action:</span>
              <select className="bg-zinc-900 border-none text-xs font-bold py-1 px-2 focus:ring-0">
                <option>Set Category...</option>
                {listSilverfinTaxCategoriesV1().map(c => <option key={c.code}>{c.name}</option>)}
              </select>
              <ButtonV1 variant="primary" className="h-7 px-3 text-[9px] uppercase tracking-tighter">Apply</ButtonV1>
            </div>
          </div>
          <button onClick={() => setSelectedRowIds(new Set())} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest mr-2">Clear</button>
        </div>
      )}

      {/* Virtualized Table */}
      <div 
        className={`table-container relative overflow-hidden flex flex-col ${isDragging ? 'ring-2 ring-[#86BC25] ring-inset bg-[#86BC25]/5' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* Table Header */}
        <div className="flex bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
          <div style={{ width: columnWidths.select }} className="px-4 py-4 flex items-center">
            <input 
              type="checkbox" 
              checked={allSelected}
              onChange={(e) => handleToggleAll(e.target.checked)}
              className="rounded border-zinc-300 text-[#86BC25] focus:ring-[#86BC25]"
            />
          </div>
          {[
            { key: 'account', label: 'Konto' },
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount' },
            { key: 'category', label: 'Tax Category' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'state', label: 'State' }
          ].map((col) => (
            <div 
              key={col.key} 
              style={{ width: columnWidths[col.key as keyof typeof columnWidths] }}
              className="px-4 py-4 text-[10px] font-extrabold text-black uppercase tracking-widest relative flex items-center group"
            >
              {col.label}
              <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#86BC25] transition-colors opacity-0 group-hover:opacity-100"
                onMouseDown={(e) => startResize(e, col.key as keyof typeof columnWidths)}
              />
            </div>
          ))}
        </div>

        {/* Scrollable Body */}
        <div 
          ref={mappingScrollRef}
          onScroll={(e) => setMappingScrollTop(e.currentTarget.scrollTop)}
          className="overflow-y-auto"
          style={{ height: mappingGridViewportHeightV1 }}
        >
          <div style={{ height: mappingRows.length * mappingGridRowHeightV1, position: 'relative' }}>
            {virtualRows.map((v: (typeof virtualRows)[number]) => {
              const isSelected = selectedRowIds.has(v.row.id);
              const isHighConfidence = v.row.confidence > 0.9;
              const isException = v.row.confidence < 0.7;

              return (
                <div 
                  key={v.row.id}
                  className={`flex absolute left-0 right-0 border-b border-zinc-100 transition-colors group ${isSelected ? 'bg-[#86BC25]/10' : 'hover:bg-zinc-50'}`}
                  style={{ height: mappingGridRowHeightV1, transform: `translateY(${v.offsetTop}px)` }}
                >
                  <div style={{ width: columnWidths.select }} className="px-4 flex items-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleToggleSelection(v.row.id)}
                      className="rounded border-zinc-300 text-[#86BC25] focus:ring-[#86BC25]"
                    />
                  </div>
                  <div style={{ width: columnWidths.account }} className="px-4 flex items-center font-bold text-black text-xs">
                    {v.row.sourceAccountNumber}
                  </div>
                  <div style={{ width: columnWidths.description }} className="px-4 flex items-center text-xs text-zinc-600 truncate" title={v.row.accountName}>
                    {v.row.accountName}
                  </div>
                  <div style={{ width: columnWidths.amount }} className="px-4 flex items-center justify-end font-mono text-xs text-zinc-900 pr-8">
                    {new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2 }).format(Number(v.row.accountNumber ?? 0))}
                  </div>
                  <div style={{ width: columnWidths.category }} className="px-4 flex items-center">
                    <div className={`px-2 py-1 rounded-sm text-[10px] font-bold w-full truncate border ${isHighConfidence ? 'bg-[#86BC25]/5 border-[#86BC25]/20 text-black' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                      {v.row.selectedCategory.name}
                    </div>
                  </div>
                  <div style={{ width: columnWidths.confidence }} className="px-4 flex items-center gap-2">
                    <div className="flex-grow h-1 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${isHighConfidence ? 'bg-[#86BC25]' : isException ? 'bg-red-500' : 'bg-yellow-500'}`}
                        style={{ width: `${v.row.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">{(v.row.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ width: columnWidths.state }} className="px-4 flex items-center">
                    <span className={`text-[9px] font-extrabold uppercase tracking-tighter px-2 py-0.5 rounded-full ${v.row.status === 'overridden' ? 'bg-yellow-100 text-yellow-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {v.row.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drop Zone Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#86BC25]/5 flex items-center justify-center pointer-events-none border-2 border-dashed border-[#86BC25] z-50">
            <div className="text-center animate-bounce">
              <i className="fas fa-file-excel text-4xl text-[#86BC25] mb-2"></i>
              <div className="text-sm font-bold text-black uppercase tracking-widest">Drop Excel to Import</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-zinc-50 border border-zinc-200 p-4 flex items-center gap-3">
        <i className="fas fa-info-circle text-[#86BC25]"></i>
        <p className="text-xs text-zinc-500 italic">
          High-performance grid rendering active. Optimized for desktop dual-monitor workflows.
        </p>
      </div>
    </div>
  );
}
