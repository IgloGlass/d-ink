import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalAppContextV1 } from "../app/app-context.v1";
import { listWorkspacesByTenantV1 } from "../lib/http/workspace-api";

const workspaceListKeyV1 = (tenantId: string) => ["workspaces", tenantId];

export function LauncherV1({
  isOpen,
  onClose,
  tenantId,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}) {
  const navigate = useNavigate();
  const { setActiveContext } = useGlobalAppContextV1();
  const [launcherQuery, setLauncherQuery] = useState("");
  const launcherInputRef = useRef<HTMLInputElement | null>(null);

  const workspaceListQuery = useQuery({
    queryKey: workspaceListKeyV1(tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId }),
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => launcherInputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const filteredWorkspaces = useMemo(() => {
    const workspaces = workspaceListQuery.data?.workspaces ?? [];
    const query = launcherQuery.trim().toLowerCase();
    if (!query) return workspaces.slice(0, 5);
    return workspaces.filter((w) => 
      w.companyId.toLowerCase().includes(query) || 
      w.id.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [launcherQuery, workspaceListQuery.data]);

  const switchWorkspace = (workspace: {
    fiscalYearEnd: string;
    id: string;
  }) => {
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: workspace.fiscalYearEnd.slice(0, 4),
    });
    navigate(`/app/workspaces/${workspace.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-fade-in" onMouseDown={onClose}>
      <div 
        className="w-full max-w-2xl bg-white shadow-2xl overflow-hidden animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400"></i>
          <input
            ref={launcherInputRef}
            type="text"
            value={launcherQuery}
            onChange={(e) => setLauncherQuery(e.target.value)}
            placeholder="Search workspaces, clients, or modules..."
            className="w-full h-20 pl-14 pr-6 bg-white border-b border-zinc-100 text-xl focus:outline-none text-black font-medium"
          />
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {filteredWorkspaces.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm italic">
              No matching results found.
            </div>
          ) : (
            filteredWorkspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => switchWorkspace(w)}
                className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-100 rounded flex items-center justify-center text-zinc-400 group-hover:bg-[#86BC25]/10 group-hover:text-[#86BC25]">
                    <i className="fas fa-building"></i>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-black group-hover:text-[#86BC25]">{w.companyId}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      ID: {w.id.slice(0, 8)} · {w.fiscalYearStart}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-zinc-300 uppercase group-hover:text-zinc-500">Jump to Workspace →</div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
           <div className="flex gap-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest"><kbd className="bg-white border border-zinc-200 px-1 rounded mr-1">↑↓</kbd> Navigate</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest"><kbd className="bg-white border border-zinc-200 px-1 rounded mr-1">↵</kbd> Select</span>
           </div>
           <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Esc to Close</span>
        </div>
      </div>
    </div>
  );
}
