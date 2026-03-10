import { useNavigate } from "react-router-dom";
import { SidebarNavV1 } from "../../components/sidebar-nav-v1";
import { CardV1 } from "../../components/card-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { ButtonV1 } from "../../components/button-v1";
import { ApiClientError, toUserFacingErrorMessage } from "../../lib/http/api-client";
import { useState } from "react";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

const taxAdjustmentGroupsV1 = {
  common: [
    "General Client Information",
    "Trial Balance to Local GAAP",
    "Disallowed Expenses",
    "Non-Taxable Income",
    "Provisions",
    "Depreciation on Tangible and Acquired Intangible Assets",
    "Group Contributions",
    "Items Not Included in the Books",
    "Tax Losses Carried Forward",
  ],
  advanced: [
    "Property Tax and Property Fee",
    "Warranty Provision",
    "Pension Costs",
    "Buildings and Improvements",
    "Capital Assets",
    "Obsolescence Reserve",
    "Shares and Participations",
    "CFC Taxation",
    "Interest Limitation Rules",
    "Tax Allocation Reserve",
  ],
};

function toSlugV1(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function TaxAdjustmentsWorkbenchV1({
  workspaceId,
  subModule,
  taxAdjustmentsQuery,
  taxSummaryQuery,
}: {
  workspaceId: string;
  subModule?: string;
  taxAdjustmentsQuery: any;
  taxSummaryQuery: any;
}) {
  const { t } = useI18nV1();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sidebarSections = [
    {
      id: "common",
      title: "Common Adjustments",
      items: taxAdjustmentGroupsV1.common.map((label, index) => ({
        id: toSlugV1(label),
        label,
        to: index === 0 ? `/app/workspaces/${workspaceId}/tax-adjustments` : `/app/workspaces/${workspaceId}/tax-adjustments/${toSlugV1(label)}`,
        exact: index === 0
      })),
    },
    {
      id: "advanced",
      title: "Advanced / Specialized",
      collapsible: true,
      collapsed: !showAdvanced,
      onToggle: () => setShowAdvanced(!showAdvanced),
      items: taxAdjustmentGroupsV1.advanced.map((label) => ({
        id: toSlugV1(label),
        label,
        to: `/app/workspaces/${workspaceId}/tax-adjustments/${toSlugV1(label)}`,
      })),
    },
  ];

  return (
    <div className="flex gap-8 items-start animate-fade-in">
      {/* Left Navigation */}
      <aside className="w-80 flex-shrink-0 space-y-4 sticky top-24">
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
           <div className="p-4 bg-zinc-50 border-b border-zinc-200">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-black">Adjustment Navigator</span>
           </div>
           <div className="p-2">
              <SidebarNavV1 sections={sidebarSections} />
           </div>
        </div>

        {/* Pinned Summary in Sidebar */}
        <div className="bg-black text-white p-6 shadow-xl">
           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4">Live Tax Impact</span>
           {taxSummaryQuery.isSuccess ? (
             <div className="space-y-4">
                <div>
                   <div className="text-2xl font-mono font-bold text-[#86BC25]">
                      {new Intl.NumberFormat('sv-SE').format(taxSummaryQuery.data.summary.corporateTax)}
                   </div>
                   <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Calculated Corporate Tax</div>
                </div>
                <div className="pt-4 border-t border-zinc-800">
                   <div className="text-xl font-mono font-bold text-white">
                      {new Intl.NumberFormat('sv-SE').format(taxSummaryQuery.data.summary.taxableIncome)}
                   </div>
                   <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Taxable Income</div>
                </div>
             </div>
           ) : <SkeletonV1 height={80} />}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow space-y-6">
        <CardV1 className="p-10 border-t-4 border-black">
          <div className="space-y-1 mb-8">
             <span className="micro-label text-[#86BC25]">Module 03</span>
             <h1 className="text-2xl font-extrabold text-black">
               {subModule ? subModule.replace(/-/g, ' ').toUpperCase() : "General Client Information"}
             </h1>
             <p className="text-sm text-zinc-500">
                Review and finalize tax-specific adjustments identified by AI or manually entered.
             </p>
          </div>

          {taxAdjustmentsQuery.isPending ? (
            <div className="space-y-4">
               <SkeletonV1 height={40} />
               <SkeletonV1 height={200} />
            </div>
          ) : taxAdjustmentsQuery.isSuccess ? (
            <div className="bg-zinc-50 border border-zinc-200 p-8 text-center">
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-200">
                  <i className="fas fa-check text-[#86BC25]"></i>
               </div>
               <h3 className="font-bold text-black mb-1">Module Content Ready</h3>
               <p className="text-xs text-zinc-500 mb-6">Adjustment artifact v{taxAdjustmentsQuery.data.active.version} is currently loaded for review.</p>
               <ButtonV1 variant="black" className="px-8 text-[10px] uppercase tracking-widest">Mark Submodule Reviewed</ButtonV1>
            </div>
          ) : (
            <EmptyStateV1 title="Adjustment data unavailable" description="Run previous modules to generate adjustments." />
          )}
        </CardV1>

        <div className="flex justify-between items-center bg-white border border-zinc-200 p-4 shadow-sm">
           <ButtonV1 variant="secondary" className="h-9 px-4 text-[10px] uppercase tracking-widest">
              <i className="fas fa-chevron-left mr-2"></i> Previous Section
           </ButtonV1>
           <ButtonV1 variant="black" className="h-9 px-6 text-[10px] uppercase tracking-widest">
              Next Section <i className="fas fa-chevron-right ml-2"></i>
           </ButtonV1>
        </div>
      </main>
    </div>
  );
}
