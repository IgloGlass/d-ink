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

function formatOrgNumberV1(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return raw;
}

export function LauncherV1({
  isOpen,
  onClose,
  tenantId,
  companies,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  companies: Array<{ id: string; legalName: string; organizationNumber: string }>;
}) {
  const navigate = useNavigate();
  const { setActiveContext } = useGlobalAppContextV1();
  const [launcherQuery, setLauncherQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const launcherInputRef = useRef<HTMLInputElement | null>(null);

  const workspaceListQuery = useQuery({
    queryKey: workspaceListKeyV1(tenantId),
    queryFn: () => listWorkspacesByTenantV1({ tenantId }),
  });

  useEffect(() => {
    if (isOpen) {
      setLauncherQuery("");
      setSelectedIndex(-1);
      setTimeout(() => launcherInputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const filteredWorkspaces = useMemo(() => {
    const workspaces = workspaceListQuery.data?.workspaces ?? [];
    // Only include workspaces whose company is known — orphaned records are hidden
    const resolved = workspaces.filter((w) => companies.some((c) => c.id === w.companyId));
    const query = launcherQuery.trim().toLowerCase();
    if (!query) return resolved.slice(0, 6);
    return resolved.filter((w) => {
      const company = companies.find((c) => c.id === w.companyId);
      return (
        company?.legalName.toLowerCase().includes(query) ||
        company?.organizationNumber.toLowerCase().includes(query)
      );
    }).slice(0, 6);
  }, [launcherQuery, workspaceListQuery.data, companies]);

  const switchWorkspace = (workspace: { fiscalYearEnd: string; id: string }) => {
    setActiveContext({
      activeWorkspaceId: workspace.id,
      activeFiscalYear: workspace.fiscalYearEnd.slice(0, 4),
    });
    navigate(`/app/workspaces/${workspace.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="launcher-backdrop" onMouseDown={onClose} aria-modal="true" role="dialog">
      <div
        className="launcher-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="launcher-search">
          <span className="launcher-search__icon" aria-hidden="true">⌕</span>
          <input
            ref={launcherInputRef}
            type="text"
            value={launcherQuery}
            onChange={(e) => {
              setLauncherQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev < filteredWorkspaces.length - 1 ? prev + 1 : prev
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const target = selectedIndex >= 0
                  ? filteredWorkspaces[selectedIndex]
                  : filteredWorkspaces[0];
                if (target) switchWorkspace(target);
              }
            }}
            placeholder="Search companies or workspaces…"
            className="launcher-search__input"
            aria-label="Search companies or workspaces"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div className="launcher-results" role="listbox">
          {filteredWorkspaces.length === 0 ? (
            <div className="launcher-empty">
              No results for <strong>"{launcherQuery}"</strong>
            </div>
          ) : (
            filteredWorkspaces.map((w, index) => {
              const company = companies.find((c) => c.id === w.companyId);
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`launcher-result${isSelected ? " launcher-result--active" : ""}`}
                  onClick={() => switchWorkspace(w)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="launcher-result__avatar" aria-hidden="true">
                    {(company?.legalName ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="launcher-result__body">
                    <span className="launcher-result__name">
                      {company?.legalName ?? w.companyId}
                    </span>
                    <span className="launcher-result__meta">
                      {company ? formatOrgNumberV1(company.organizationNumber) : "N/A"} · FY {w.fiscalYearEnd.slice(0, 4)}
                    </span>
                  </div>
                  <span className="launcher-result__cta" aria-hidden="true">
                    Open →
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="launcher-footer">
          <div className="launcher-footer__hints">
            <span className="launcher-hint">
              <kbd className="launcher-kbd">↑↓</kbd>Navigate
            </span>
            <span className="launcher-hint">
              <kbd className="launcher-kbd">↵</kbd>Open
            </span>
            <span className="launcher-hint">
              <kbd className="launcher-kbd">Esc</kbd>Close
            </span>
          </div>
          <span className="launcher-footer__label">Quick Search</span>
        </div>
      </div>
    </div>
  );
}
