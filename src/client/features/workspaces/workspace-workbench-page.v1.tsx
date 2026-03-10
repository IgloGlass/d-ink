import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useGlobalAppContextV1 } from "../../app/app-context.v1";
import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { GuidanceBannerV1 } from "../../components/guidance-banner-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import {
  getActiveMappingDecisionsV1,
  getActiveTaxAdjustmentsV1,
  getActiveTaxSummaryV1,
  getWorkspaceByIdV1,
} from "../../lib/http/workspace-api";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

export function WorkspaceWorkbenchPageV1() {
  const navigate = useNavigate();
  const principal = useRequiredSessionPrincipalV1();
  const { t } = useI18nV1();
  const { workspaceId } = useParams();
  const { setActiveContext } = useGlobalAppContextV1();

  const resolvedWorkspaceId = workspaceId ?? "";

  const workspaceQuery = useQuery({
    queryKey: ["workspace", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getWorkspaceByIdV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
  });

  const mappingQuery = useQuery({
    queryKey: ["active-mapping", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveMappingDecisionsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxAdjustmentsQuery = useQuery({
    queryKey: [
      "active-tax-adjustments",
      principal.tenantId,
      resolvedWorkspaceId,
    ],
    queryFn: () =>
      getActiveTaxAdjustmentsV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  const taxSummaryQuery = useQuery({
    queryKey: ["active-tax-summary", principal.tenantId, resolvedWorkspaceId],
    queryFn: () =>
      getActiveTaxSummaryV1({
        tenantId: principal.tenantId,
        workspaceId: resolvedWorkspaceId,
      }),
    enabled: resolvedWorkspaceId.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (workspaceQuery.data) {
      const { workspace } = workspaceQuery.data;
      setActiveContext({
        activeWorkspaceId: workspace.id,
        activeFiscalYear: `${workspace.fiscalYearStart} to ${workspace.fiscalYearEnd}`,
      });
    }
  }, [workspaceQuery.data, setActiveContext]);

  const stats = useMemo(() => {
    const mapping = mappingQuery.data?.mapping;
    const summary = taxSummaryQuery.data?.summary;
    const mappingDecisions = mapping?.decisions ?? [];
    return {
      accountsMapped: mappingDecisions.length,
      avgConfidence:
        mappingDecisions.reduce((acc, d) => acc + d.confidence, 0) /
        (mappingDecisions.length || 1),
      taxableIncome: summary?.taxableIncome ?? 0,
      corporateTax: summary?.corporateTax ?? 0,
    };
  }, [mappingQuery.data, taxSummaryQuery.data]);

  const workspace = workspaceQuery.data?.workspace;

  const moduleCards = [
    {
      id: "annual-report-analysis",
      step: "01",
      title: "Annual Report Analysis",
      description: "Extract financial data and perform forensic tax risk analysis from PDF reports.",
      status: workspaceQuery.data?.workspace.status === "draft" ? "Pending" : "Complete",
      path: `/app/workspaces/${resolvedWorkspaceId}/annual-report-analysis`,
      recommended: true
    },
    {
      id: "account-mapping",
      step: "02",
      title: "Account Mapping",
      description: "Map trial balance accounts to Swedish tax categories with AI assistance.",
      status: mappingQuery.data ? "Complete" : "Pending",
      path: `/app/workspaces/${resolvedWorkspaceId}/account-mapping`,
      recommended: mappingQuery.isError
    },
    {
      id: "tax-adjustments",
      step: "03",
      title: "Tax Adjustments",
      description: "Review and apply specific tax adjustments for representation, depreciation, etc.",
      status: taxAdjustmentsQuery.data ? "Complete" : "Pending",
      path: `/app/workspaces/${resolvedWorkspaceId}/tax-adjustments`,
      recommended: false
    },
    {
      id: "tax-return-ink2",
      step: "04",
      title: "Tax Return INK2",
      description: "Final review of the populated INK2 form and export for submission.",
      status: "Review",
      path: `/app/workspaces/${resolvedWorkspaceId}/tax-return-ink2`,
      recommended: false
    }
  ];

  return (
    <div className="space-y-10 py-6 animate-fade-in">
      {/* Workspace Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 pb-8">
        <div className="space-y-1">
          <span className="micro-label text-[#86BC25]">Workbench Overview</span>
          <h1 className="text-3xl font-extrabold text-black">
            {workspace?.id ? workspace.id.slice(0, 12).toUpperCase() : "Loading..."}
          </h1>
          <p className="text-zinc-500 text-sm font-medium">
            Fiscal Period: {workspace?.fiscalYearStart ?? "Loading"} – {workspace?.fiscalYearEnd ?? "Loading"}
          </p>
        </div>
        <div className="flex gap-3">
           <ButtonV1 variant="black" className="px-8 h-10 uppercase text-xs tracking-widest">
              Export to Silverfin
           </ButtonV1>
        </div>
      </section>

      {/* Stats Dashboard */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 border-t-4 border-black shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Accounts Mapped</span>
            <div className="text-3xl font-extrabold text-black">{stats.accountsMapped}</div>
          </div>
          <div className="bg-white p-6 border-t-4 border-[#86BC25] shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">AI Confidence</span>
            <div className="text-3xl font-extrabold text-black">{(stats.avgConfidence * 100).toFixed(0)}%</div>
          </div>
          <div className="bg-white p-6 border-t-4 border-zinc-300 shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Taxable Income</span>
            <div className="text-2xl font-mono font-bold text-black">{new Intl.NumberFormat('sv-SE').format(stats.taxableIncome)}</div>
          </div>
          <div className="bg-white p-6 border-t-4 border-zinc-300 shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Corporate Tax</span>
            <div className="text-2xl font-mono font-bold text-black">{new Intl.NumberFormat('sv-SE').format(stats.corporateTax)}</div>
          </div>
      </section>

      {/* Module Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {moduleCards.map((module) => (
          <CardV1 
            key={module.id} 
            className={`flex flex-col h-full group hover:shadow-xl transition-all ${module.recommended ? 'card-v1--brand' : ''}`}
          >
            <div className="p-6 flex-grow space-y-4">
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${module.recommended ? 'text-[#86BC25]' : 'text-zinc-400'}`}>
                  Step {module.step}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[9px] font-bold uppercase tracking-tighter">
                  {module.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-black group-hover:text-[#86BC25] transition-colors">
                {module.title}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {module.description}
              </p>
            </div>
            <div className="p-6 pt-0 mt-auto">
              <ButtonV1 
                variant={module.recommended ? "black" : "secondary"}
                className="w-full h-10 text-[10px] uppercase tracking-widest"
                onClick={() => navigate(module.path)}
              >
                Enter Module
              </ButtonV1>
            </div>
          </CardV1>
        ))}
      </section>

      <GuidanceBannerV1 tone="neutral" title="Proactive Guidance">
        The system recommends following the numbered sequence (01-04) to ensure AI context is fully populated for final tax calculations.
      </GuidanceBannerV1>
    </div>
  );
}
