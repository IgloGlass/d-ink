import { CardV1 } from "../../components/card-v1";
import { SkeletonV1 } from "../../components/skeleton-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { ButtonV1 } from "../../components/button-v1";
import { ApiClientError, toUserFacingErrorMessage } from "../../lib/http/api-client";
import { useI18nV1 } from "../../lib/i18n/use-i18n.v1";

export function Ink2FormReplicaV1({
  ink2Query,
}: {
  ink2Query: any;
}) {
  const { t } = useI18nV1();

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
      <header className="text-center space-y-4">
         <span className="micro-label text-[#86BC25]">Module 04</span>
         <h1 className="text-3xl font-extrabold text-black">Tax Return INK2</h1>
         <p className="text-sm text-zinc-500 max-w-lg mx-auto">
            Final visual review of the official Swedish Skatteverket INK2 form draft.
         </p>
      </header>

      <CardV1 className="p-0 border-t-4 border-black overflow-hidden shadow-2xl">
        <div className="p-6 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold text-xs">S</div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-black">INK2 Draft Replica</span>
           </div>
           <div className="flex gap-2">
              <ButtonV1 variant="secondary" className="h-8 px-4 text-[10px] uppercase tracking-widest">
                 <i className="fas fa-print mr-2 opacity-50"></i> Preview PDF
              </ButtonV1>
              <ButtonV1 variant="black" className="h-8 px-4 text-[10px] uppercase tracking-widest">
                 <i className="fas fa-file-export mr-2 opacity-50"></i> Export SRU
              </ButtonV1>
           </div>
        </div>

        <div className="bg-zinc-100 p-8 min-h-[600px]">
           {ink2Query.isPending ? (
             <div className="bg-white p-12 border border-zinc-200 space-y-6">
                <SkeletonV1 height={40} />
                <SkeletonV1 height={400} />
             </div>
           ) : ink2Query.isSuccess ? (
             <div className="bg-white border border-zinc-300 shadow-sm max-w-3xl mx-auto overflow-hidden">
                {/* Form Header */}
                <div className="grid grid-cols-12 border-b-2 border-black">
                   <div className="col-span-8 p-4 border-r border-zinc-200">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Inkomstdeklaration 2</div>
                      <div className="text-lg font-extrabold text-black">Aktiebolag, ekonomiska föreningar m.fl.</div>
                   </div>
                   <div className="col-span-4 p-4 bg-zinc-50">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Inkomståret</div>
                      <div className="text-lg font-mono font-bold text-black">2025</div>
                   </div>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-12">
                   <div className="col-span-1 border-r border-zinc-200 bg-zinc-50 flex items-center justify-center font-mono font-bold text-xs">P</div>
                   <div className="col-span-8 border-r border-zinc-200 p-3 text-[10px] font-bold uppercase text-zinc-500">Field Description</div>
                   <div className="col-span-3 p-3 text-[10px] font-bold uppercase text-zinc-500 text-right">Amount (SEK)</div>
                </div>

                <div className="divide-y divide-zinc-200">
                   {ink2Query.data.form.fields.map((field: any) => {
                      const isAi = field.provenance !== "manual";
                      return (
                        <div key={field.fieldId} className="grid grid-cols-12 group hover:bg-zinc-50 transition-colors">
                           <div className="col-span-1 border-r border-zinc-200 bg-zinc-50 flex items-center justify-center font-mono font-bold text-xs p-3">
                              {field.fieldId.split(".")[1] || "???"}
                           </div>
                           <div className={`col-span-8 border-r border-zinc-200 p-3 text-xs font-bold flex items-center gap-3 ${isAi ? 'text-[#86BC25]' : 'text-black'}`}>
                              {isAi && <i className="fas fa-robot text-[10px]"></i>}
                              {field.fieldId}
                           </div>
                           <div className={`col-span-3 p-3 text-sm font-mono font-bold text-right flex items-center justify-end ${isAi ? 'bg-[#86BC25]/5' : ''}`}>
                              {new Intl.NumberFormat('sv-SE').format(field.amount)}
                           </div>
                        </div>
                      );
                   })}
                </div>

                {/* Form Footer */}
                <div className="p-6 bg-zinc-50 border-t-2 border-black text-[9px] font-bold text-zinc-400 uppercase tracking-widest text-center">
                   Official Replica · Not for submission purposes · Verified by AI
                </div>
             </div>
           ) : (
             <EmptyStateV1 title="Form data unavailable" description="Run calculations to populate the INK2R replica." />
           )}
        </div>
      </CardV1>

      <div className="bg-white border border-zinc-200 p-6 flex items-start gap-4 shadow-sm">
         <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
            <i className="fas fa-shield-alt text-white text-sm"></i>
         </div>
         <div className="space-y-1">
            <h4 className="text-sm font-bold text-black">Audit Compliance Check</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
               All AI-populated fields have been traced back to source trial balance accounts and annual report extracts. Review the provenance in the Account Mapping module for specific justifications.
            </p>
         </div>
      </div>
    </div>
  );
}
