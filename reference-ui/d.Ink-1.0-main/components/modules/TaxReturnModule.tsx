
import React, { useState, useMemo, useEffect } from 'react';
import { Account, MappingResult, AnnualReportAnalysis, TaxAdjustmentEntry } from '../../types';
import { calculateInk2Data, SRU_MAPPING } from '../../services/ink2CalculationService';

interface TaxReturnModuleProps {
  accounts: Account[];
  mappings: Record<string, MappingResult>;
  annualReportData: AnnualReportAnalysis | null;
  taxAdjustments?: Record<string, TaxAdjustmentEntry>;
}

const TaxReturnModule: React.FC<TaxReturnModuleProps> = ({ accounts, mappings, annualReportData, taxAdjustments }) => {
  const [activeTab, setActiveTab] = useState<'page1' | 'ink2r_bs' | 'ink2r_is' | 'ink2s' | 'n9'>('page1');
  const [consultantAssisted, setConsultantAssisted] = useState(false);
  const [audited, setAudited] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});
  
  // Company Information State
  const [orgNumber, setOrgNumber] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (annualReportData) {
        if (annualReportData.companyName) setCompanyName(annualReportData.companyName);
        if (annualReportData.orgNumber) setOrgNumber(annualReportData.orgNumber);
    }
  }, [annualReportData]);

  const handleFieldChange = (code: string, valueStr: string, signMultiplier: number = 1) => {
      // Remove spaces, replace comma with dot
      const cleanStr = valueStr.replace(/\s/g, '').replace(',', '.');
      
      if (cleanStr === '') {
          // If empty, remove override to let calculation flow
          const newOverrides = { ...manualOverrides };
          delete newOverrides[code];
          setManualOverrides(newOverrides);
          return;
      }

      const floatVal = parseFloat(cleanStr);
      if (!isNaN(floatVal)) {
          setManualOverrides(prev => ({
              ...prev,
              [code]: floatVal * signMultiplier
          }));
      }
  };

  const ink2Data = useMemo(() => {
      return calculateInk2Data(accounts, mappings, annualReportData, taxAdjustments, manualOverrides);
  }, [accounts, mappings, annualReportData, taxAdjustments, manualOverrides]);

  const handleExportSRU = () => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const safeOrgNr = orgNumber.replace(/\D/g, '') || "0000000000";
      const safeName = companyName || "Unknown Company";

      const lines = [
          '#DATABESKRIVNING_START',
          '#PRODUKT SRU',
          '#PROGRAM d.Ink',
          '#FILNAMN BLANKETTER.SRU',
          '#DATABESKRIVNING_SLUT',
          '#BLANKETT INK2-2024P4',
          `#IDENTITET ${safeOrgNr} ${timestamp}`,
          `#NAMN ${safeName}`,
          `#SYSTEMINFO d.Ink Web App`
      ];
      
      Object.entries(ink2Data.fields).forEach(([humanCode, value]) => {
          const sruCode = SRU_MAPPING[humanCode];
          if (sruCode && (value as number) !== 0) {
              const intVal = Math.round(value as number);
              if (intVal !== 0) {
                 lines.push(`#UPPGIFT ${sruCode} ${intVal}`);
              }
          }
      });
      
      if (consultantAssisted) lines.push('#UPPGIFT 7096 1');
      if (audited) lines.push('#UPPGIFT 7427 1');

      lines.push('#BLANKETTSLUT');
      lines.push('#FIL_SLUT');
      
      const fileContent = lines.join('\r\n');
      const blob = new Blob([fileContent], { type: 'text/plain;charset=ISO-8859-1' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `blanketter.sru`;
      link.click();
  };

  const formatVal = (val: number | undefined) => {
      if (val === undefined || val === 0) return '';
      return new Intl.NumberFormat('sv-SE', { useGrouping: true, maximumFractionDigits: 0 }).format(Math.round(Math.abs(val)));
  };

  // --- Components ---

  const FieldRow = ({ code, label, sign, bg = "bg-white", bold = false, indent = false, dual = false }: { code: string, label: string, sign?: "+" | "-" | "+/-", bg?: string, bold?: boolean, indent?: boolean, dual?: boolean }) => {
    const val = ink2Data.fields[code] || 0;
    const isOverridden = manualOverrides[code] !== undefined;
    
    // Determine which cell(s) are active/visible
    const showPlus = sign === "+" || sign === "+/-";
    const showMinus = sign === "-" || sign === "+/-";
    
    // Value display logic
    const displayPlus = val > 0 ? val : undefined;
    const displayMinus = val < 0 ? val : undefined; // stored as negative, displayed as abs

    return (
      <div className={`flex border-b border-black last:border-b-0 ${bg} min-h-[32px] items-stretch`}>
          {/* Code */}
          <div className={`w-10 border-r border-black flex items-start justify-center pt-1.5 text-[10px] font-bold text-black flex-shrink-0`}>
              {code}
          </div>
          
          {/* Label */}
          <div className={`flex-grow px-2 py-1 flex items-center text-[10px] text-black leading-tight border-r border-black ${indent ? 'pl-6' : ''}`}>
              {label}
          </div>
          
          {/* Input Area */}
          <div className="w-[140px] flex-shrink-0 flex flex-col">
               {/* Plus Cell */}
               {showPlus && (
                   <div className={`flex items-center h-8 border-b border-black last:border-b-0 ${!showMinus ? 'h-full' : ''}`}>
                        <div className="w-6 h-full flex items-center justify-center border-r border-black bg-zinc-100 text-[10px] font-bold">+</div>
                        <input 
                            type="text"
                            defaultValue={formatVal(displayPlus)}
                            key={`plus-${displayPlus}`}
                            onBlur={(e) => handleFieldChange(code, e.target.value, 1)}
                            className={`w-full h-full text-right px-1 bg-transparent focus:ring-0 focus:outline-none font-mono text-xs ${bold ? 'font-bold' : ''} ${isOverridden && val > 0 ? 'text-[#86BC25]' : 'text-black'}`}
                        />
                   </div>
               )}
               {/* Minus Cell */}
               {showMinus && (
                   <div className={`flex items-center h-8 ${!showPlus ? 'h-full' : ''}`}>
                        <div className="w-6 h-full flex items-center justify-center border-r border-black bg-zinc-100 text-[10px] font-bold">-</div>
                        <input 
                            type="text"
                            defaultValue={formatVal(displayMinus)}
                            key={`minus-${displayMinus}`}
                            onBlur={(e) => handleFieldChange(code, e.target.value, -1)}
                            className={`w-full h-full text-right px-1 bg-transparent focus:ring-0 focus:outline-none font-mono text-xs ${bold ? 'font-bold' : ''} ${isOverridden && val < 0 ? 'text-[#86BC25]' : 'text-black'}`}
                        />
                   </div>
               )}
          </div>
      </div>
    );
  };

  const HeaderRow = ({ title }: { title: string }) => (
      <div className="bg-white border-b border-black px-1 py-0.5 text-[10px] font-bold text-black flex">
          <div className="w-10 flex-shrink-0"></div>
          <div>{title}</div>
      </div>
  );

  const SectionHeader = ({ title, className = "" }: { title: string, className?: string }) => (
      <div className={`bg-zinc-100 border-b border-zinc-300 px-2 py-1 text-xs font-bold uppercase tracking-wider text-black ${className}`}>
          {title}
      </div>
  );

  const SimpleField = ({ code, label, bg = "bg-white", bold = false }: { code?: string, label: string, bg?: string, bold?: boolean }) => {
    const val = code ? (ink2Data.fields[code] || 0) : 0;
    const isOverridden = code && manualOverrides[code] !== undefined;

    return (
      <div className={`flex border-b border-zinc-300 last:border-b-0 ${bg} h-10`}>
          <div className="w-12 border-r border-zinc-300 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0">
              {code || '-'}
          </div>
          <div className="flex-grow px-2 flex items-center text-xs text-zinc-800 truncate border-r border-zinc-300" title={label}>
              {label}
          </div>
          <div className={`w-32 flex items-center px-1`}>
             {code ? (
                 <input 
                    type="text"
                    defaultValue={val === 0 ? '' : Math.round(val).toString()}
                    key={val}
                    onBlur={(e) => handleFieldChange(code, e.target.value)}
                    className={`w-full text-right bg-transparent focus:ring-0 focus:outline-none font-mono text-sm border-b border-transparent focus:border-[#86BC25] transition-colors ${bold ? 'font-bold' : ''} ${isOverridden ? 'text-[#86BC25]' : 'text-zinc-800'}`}
                    placeholder="0"
                 />
             ) : (
                 <div className="w-full text-right text-zinc-300 font-mono text-sm">0</div>
             )}
          </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
        {/* Controls */}
        <div className="flex flex-col gap-4 bg-white p-4 border border-zinc-200 shadow-sm">
             <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-zinc-500 mb-1">Company Name</label>
                    <input 
                        type="text" 
                        value={companyName} 
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="e.g. AB Exempel"
                        className="w-full text-sm border-zinc-300 rounded px-2 py-1 focus:ring-[#86BC25] focus:border-[#86BC25]"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-bold text-zinc-500 mb-1">Org Number</label>
                    <input 
                        type="text" 
                        value={orgNumber} 
                        onChange={e => setOrgNumber(e.target.value)}
                        placeholder="e.g. 556000-0000"
                        className="w-full text-sm border-zinc-300 rounded px-2 py-1 focus:ring-[#86BC25] focus:border-[#86BC25]"
                    />
                </div>
                <button onClick={handleExportSRU} className="bg-[#86BC25] text-white px-6 py-2 rounded-full font-bold text-xs shadow-sm hover:bg-[#76a820] transition-all flex items-center gap-2 whitespace-nowrap h-9 self-end mb-0.5">
                    <i className="fas fa-file-export"></i> Export .SRU
                </button>
            </div>
            
            <div className="w-full h-px bg-zinc-100"></div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button onClick={() => setActiveTab('page1')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${activeTab === 'page1' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>1. Page 1</button>
                <button onClick={() => setActiveTab('ink2r_bs')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${activeTab === 'ink2r_bs' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>2. Balansräkning</button>
                <button onClick={() => setActiveTab('ink2r_is')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${activeTab === 'ink2r_is' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>3. Resultaträkning</button>
                <button onClick={() => setActiveTab('ink2s')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${activeTab === 'ink2s' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>4. INK2S</button>
                <button onClick={() => setActiveTab('n9')} className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${activeTab === 'n9' ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>5. N9-bilaga</button>
            </div>
        </div>

        {/* --- PAGE 1 --- */}
        {activeTab === 'page1' && (
            <div className="max-w-[1000px] mx-auto w-full bg-white border border-zinc-400 shadow-lg relative">
                <div className="p-8 pb-4">
                   <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-3"><i className="fas fa-crown text-3xl"></i><span className="text-2xl font-bold tracking-tight">Skatteverket</span></div>
                       <div className="text-right"><h1 className="text-xl font-bold">Inkomstdeklaration 2</h1></div>
                   </div>
                </div>

                <div className="px-8 pb-8 grid grid-cols-2 gap-x-8 gap-y-4">
                    <div className="border border-black">
                        <SectionHeader title="Underlag för inkomstskatt" />
                        <SimpleField code="1.1" label="Överskott av näringsverksamhet" bold />
                        <SimpleField code="1.2" label="Underskott av näringsverksamhet" />
                    </div>
                    <div className="border border-black">
                        <SectionHeader title="Underlag för riskskatt" />
                        <SimpleField code="1.3" label="Kreditinstituts underlag för riskskatt" />
                    </div>
                    <div className="border border-black">
                        <SectionHeader title="Underlag för särskild löneskatt" />
                        <SimpleField code="1.4" label="Underlag för särskild löneskatt på pensionskostnader" />
                        <SimpleField code="1.5" label="Negativt underlag för särskild löeskatt på pensionskostnader" />
                    </div>
                     <div className="border border-black">
                        <SectionHeader title="Underlag för avkastningsskatt" />
                        <SimpleField code="1.6a" label="Försäkringsföretag m.fl. samt avsatt till pensioner 15 %" />
                        <SimpleField code="1.6b" label="Utländska pensionsförsäkringar 15 %" />
                        <SimpleField code="1.7a" label="Försäkringsföretag m.fl. 30 %" />
                        <SimpleField code="1.7b" label="Utländska kapitalförsäkringar 30 %" />
                    </div>
                    <div className="border border-black">
                        <SectionHeader title="Underlag för fastighetsavgift" />
                        <SimpleField code="1.8" label="Småhus/ägarlägenhet" />
                        <SimpleField code="1.9" label="Hyreshus: bostäder" />
                    </div>
                     <div className="border border-black">
                        <SectionHeader title="Underlag för fastighetsskatt" />
                        <SimpleField code="1.10" label="Småhus/ägarlägenhet: tomtmark, byggnad under uppförande" />
                        <SimpleField code="1.11" label="Hyreshus: tomtmark, bostäder under uppförande" />
                        <SimpleField code="1.12" label="Hyreshus: lokaler" />
                        <SimpleField code="1.13" label="Industrienhet och elproduktionsenhet: värmekraftverk" />
                        <SimpleField code="1.14" label="Elproduktionsenhet: vattenkraftverk" />
                        <SimpleField code="1.15" label="Elproduktionsenhet: vindkraftverk" />
                    </div>
                    <div className="border border-black">
                        <SectionHeader title="Skattereduktion" />
                        <SimpleField code="1.16" label="Förnybar el (kWh)" />
                    </div>
                </div>
            </div>
        )}

        {/* --- INK2R BALANS --- */}
        {activeTab === 'ink2r_bs' && (
             <div className="max-w-[1200px] mx-auto w-full bg-white border border-zinc-400 shadow-lg p-6 flex flex-col h-auto">
                <div className="mb-4 border-b-2 border-black pb-2 flex justify-between items-end">
                     <div><h1 className="text-xl font-bold">INK2R - Balansräkning</h1></div>
                     <div className="text-right">
                         <div className="text-xs text-zinc-400 uppercase tracking-widest">Calculated Balance Diff</div>
                         <div className={`font-mono font-bold text-lg ${Math.abs(ink2Data.sumAssets - ink2Data.sumEquityAndLiabilities) < 100 ? 'text-[#86BC25]' : 'text-red-600'}`}>
                             {formatVal(ink2Data.sumAssets - ink2Data.sumEquityAndLiabilities)}
                         </div>
                     </div>
                 </div>

                <div className="grid grid-cols-2 gap-8 flex-grow">
                    {/* ASSETS */}
                    <div className="border border-black flex flex-col h-full">
                        <div className="bg-black text-white px-2 py-1 font-bold text-sm">Tillgångar/Anläggningstillgångar</div>
                        <SectionHeader title="Immateriella anläggningstillgångar" />
                        <SimpleField code="2.1" label="Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill och liknande rättigheter" />
                        <SimpleField code="2.2" label="Förskott avseende immateriella anläggningstillgångar" />
                        
                        <SectionHeader title="Materiella anläggningstillgångar" />
                        <SimpleField code="2.3" label="Byggnader och mark" />
                        <SimpleField code="2.4" label="Maskiner, inventarier och övriga materiella anläggningstillgångar" />
                        <SimpleField code="2.5" label="Förbättringsutgifter på annans fastighet" />
                        <SimpleField code="2.6" label="Pågående nyanläggninar och förskott avseende materiella anläggningstillgångar" />
                        
                        <SectionHeader title="Finansiella anläggningstillgångar" />
                        <SimpleField code="2.7" label="Andelar i koncernföretag" />
                        <SimpleField code="2.8" label="Andelar i intressebolag och gemensamt styrda företag" />
                        <SimpleField code="2.9" label="Ägarintressen i övriga företag och andra långfristiga värdepappersinnehav" />
                        <SimpleField code="2.10" label="Fordringar hos koncern-, intresse- och gemensamt styrda företag" />
                        <SimpleField code="2.11" label="Lån till delägare eller närstående" />
                        <SimpleField code="2.12" label="Fordringar hos övriga företag som det finns ett ägarintresse i och andra långfristiga fordringar" />
                        
                        <div className="bg-black text-white px-2 py-1 font-bold text-sm mt-4">Omsättningstillgångar</div>
                        <SectionHeader title="Varulager m.m." />
                        <SimpleField code="2.13" label="Råvaror och förnödenheter" />
                        <SimpleField code="2.14" label="Varor under tillverkning" />
                        <SimpleField code="2.15" label="Färdiga varor och handelsvaror" />
                        <SimpleField code="2.16" label="Övriga lagertillgångar" />
                        <SimpleField code="2.17" label="Pågående arbeten för annans räkning" />
                        <SimpleField code="2.18" label="Förskott till leverantörer" />
                        
                        <SectionHeader title="Kortfristiga fordringar" />
                        <SimpleField code="2.19" label="Kundfordringar" />
                        <SimpleField code="2.20" label="Fordringar hos koncern-, intresse- och gemensamt styrda företag" />
                        <SimpleField code="2.21" label="Fordringar hos övriga företag som det finns ett ägarintresse i och övriga fordringar" />
                        <SimpleField code="2.22" label="Fakturerad men ej upparbetad intäkt" />
                        <SimpleField code="2.23" label="Förutbetalda kostnader och upplupna intäkter" />
                        
                        <SectionHeader title="Kortfristiga placeringar" />
                        <SimpleField code="2.24" label="Andelar i koncernföretag" />
                        <SimpleField code="2.25" label="Övriga kortfristiga placeringar" />
                        
                        <SectionHeader title="Kassa och bank" />
                        <SimpleField code="2.26" label="Kassa, bank och redovisningsmedel" bold />
                        
                        <div className="mt-auto bg-zinc-100 border-t-2 border-black p-2 flex justify-between items-center">
                            <span className="font-bold text-sm uppercase">Summa Tillgångar</span>
                            <span className="font-mono font-bold text-lg">{formatVal(ink2Data.sumAssets)}</span>
                        </div>
                    </div>

                    {/* EQUITY & LIABILITIES */}
                    <div className="border border-black flex flex-col h-full">
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm">Eget kapital</div>
                         <SimpleField code="2.27" label="Bundet eget kapital" />
                         <SimpleField code="2.28" label="Fritt eget kapital" />
                         
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm mt-4">Obeskattade reserver och avsättningar</div>
                         <SectionHeader title="Obeskattade reserver" />
                         <SimpleField code="2.29" label="Periodiseringsfonder" />
                         <SimpleField code="2.30" label="Ackumulerade överavskrivningar" />
                         
                         <SectionHeader title="Avsättningar" />
                         <SimpleField code="2.31" label="Övriga obeskattade reserver" />
                         <SimpleField code="2.32" label="Avsättningar för pensioner och liknande förpliktelser enligt lag (1967:531)" />
                         <SimpleField code="2.33" label="Övriga avsättningar för pensioner och liknande förpliktelser" />
                         <SimpleField code="2.34" label="Övriga avsättningar" />
                         
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm mt-4">Skulder (Liabilities)</div>
                         <SectionHeader title="Långfristiga skulder" />
                         <SimpleField code="2.35" label="Obligationslån" />
                         <SimpleField code="2.36" label="Checkräkningskredit" />
                         <SimpleField code="2.37" label="Övriga skulder till kreditinstitut" />
                         <SimpleField code="2.38" label="Skulder till koncern-, intresse- och gemensamt styrda företag" />
                         <SimpleField code="2.39" label="Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" />
                         
                         <SectionHeader title="Kortfristiga skulder" />
                         <SimpleField code="2.40" label="Checkräkningskredit" />
                         <SimpleField code="2.41" label="Övriga skulder till kreditinstitut" />
                         <SimpleField code="2.42" label="Förskott från kunder" />
                         <SimpleField code="2.43" label="Pågående arbeten för annans räkning" />
                         <SimpleField code="2.44" label="Fakturerad men ej upparbetad intäkt" />
                         <SimpleField code="2.45" label="Leverantörskulder" />
                         <SimpleField code="2.46" label="Växelskulder" />
                         <SimpleField code="2.47" label="Skulder till koncern-, intresse- och gemensamt styrda företag" />
                         <SimpleField code="2.48" label="Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" />
                         <SimpleField code="2.49" label="Skatteskulder" />
                         <SimpleField code="2.50" label="Upplupna kostnader och förutbetalda intäkter" />

                         <div className="mt-auto bg-zinc-100 border-t-2 border-black p-2 flex justify-between items-center">
                            <span className="font-bold text-sm uppercase">Summa Eget Kapital & Skulder</span>
                            <span className="font-mono font-bold text-lg">{formatVal(ink2Data.sumEquityAndLiabilities)}</span>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* --- INK2R RESULTAT --- */}
        {activeTab === 'ink2r_is' && (
             <div className="max-w-[1000px] mx-auto w-full bg-white border border-zinc-400 shadow-lg p-6">
                <div className="mb-4 border-b-2 border-black pb-2 flex justify-between items-end">
                     <div><h1 className="text-xl font-bold">INK2R - Resultaträkning</h1></div>
                     <div className="text-right">
                         <div className="text-xs text-zinc-400 uppercase tracking-widest">Calculated Result</div>
                         <div className={`font-mono font-bold text-lg ${ink2Data.fields["3.26"] > 0 ? 'text-black' : 'text-red-600'}`}>
                             {formatVal(ink2Data.fields["3.26"] > 0 ? ink2Data.fields["3.26"] : -ink2Data.fields["3.27"])}
                         </div>
                     </div>
                 </div>

                <div className="grid grid-cols-2 gap-8">
                    {/* Intäkter */}
                    <div className="border border-black">
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm">Rörelsens intäkter m.m.</div>
                         <SimpleField code="3.1" label="Nettoomsättning" />
                         <SimpleField code="3.2" label="Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning" />
                         <SimpleField code="3.3" label="Aktiverat arbete för egen räkning" />
                         <SimpleField code="3.4" label="Övriga rörelseintäkter" />
                         <div className="bg-zinc-100 p-1 font-bold text-xs border-b border-zinc-300 uppercase">Kostnader</div>
                         <SimpleField code="3.5" label="Råvaror och förnödenheter" />
                         <SimpleField code="3.6" label="Handelsvaror" />
                         <SimpleField code="3.7" label="Övriga externa kostnader" />
                         <SimpleField code="3.8" label="Personalkostnader" />
                         <SimpleField code="3.9" label="Av- och nedskrivningar av materiella och immateriella anläggningstillgångar" />
                         <SimpleField code="3.10" label="Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar" />
                         <SimpleField code="3.11" label="Övriga rörelsekostnader" />
                    </div>

                    {/* Finansiella poster & Bokslutsdisp */}
                    <div className="border border-black flex flex-col h-full">
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm">Finansiella poster</div>
                         <SimpleField code="3.12" label="Resultat från andelar i koncernföretag" />
                         <SimpleField code="3.13" label="Resultat från andelar i intresseföretag" />
                         <SimpleField code="3.14" label="Resultat från övriga företag (ägarintresse)" />
                         <SimpleField code="3.15" label="Resultat från övriga finansiella anläggningstillgångar" />
                         <SimpleField code="3.16" label="Övriga ränteintäkter och liknande inkomster" />
                         <SimpleField code="3.17" label="Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar" />
                         <SimpleField code="3.18" label="Räntekostnader och liknande resultatposter" />
                         
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm mt-4">Bokslutsdispositioner</div>
                         <SimpleField code="3.19" label="Lämnade koncernbidrag" />
                         <SimpleField code="3.20" label="Mottagna koncernbidrag" />
                         <SimpleField code="3.21" label="Återföring av periodiseringsfond" />
                         <SimpleField code="3.22" label="Avsättning till periodiseringsfond" />
                         <SimpleField code="3.23" label="Förändring av överavskrivningar" />
                         <SimpleField code="3.24" label="Övriga bokslutsdispositioner" />
                         
                         <div className="bg-black text-white px-2 py-1 font-bold text-sm mt-4">Skatt och Årets resultat</div>
                         <SimpleField code="3.25" label="Skatt på årets resultat" />
                         <SimpleField code="3.26" label="Årets resultat, vinst" bold />
                         <SimpleField code="3.27" label="Årets resultat, förlust" bold />
                    </div>
                </div>
             </div>
        )}

        {/* --- INK2S --- */}
        {activeTab === 'ink2s' && (
             <div className="max-w-[1200px] mx-auto w-full bg-white p-8 border border-zinc-300 shadow-xl">
                 <div className="mb-6 border-b-2 border-black pb-2 flex justify-between items-end">
                     <div>
                         <h1 className="text-2xl font-bold tracking-tight">INK2S</h1>
                         <p className="text-xs text-zinc-500 font-bold uppercase">Skattemässiga justeringar</p>
                     </div>
                     <div className="text-right">
                         <div className="text-[10px] text-zinc-400 uppercase tracking-widest">Skattepliktigt Resultat</div>
                         <div className={`font-mono font-bold text-xl ${ink2Data.fields["4.15"] > 0 ? 'text-black' : 'text-zinc-400'}`}>
                             {formatVal(ink2Data.fields["4.15"] > 0 ? ink2Data.fields["4.15"] : -ink2Data.fields["4.16"])}
                         </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-x-0 border-t border-l border-black">
                    {/* Left Column */}
                    <div className="border-r border-black">
                        <FieldRow code="4.1" label="Årets resultat, vinst" sign="+" />
                        <FieldRow code="4.2" label="Årets resultat, förlust" sign="-" />
                        
                        <HeaderRow title="4.3 Bokförda kostnader som inte ska dras av" />
                        <FieldRow code="4.3a" label="a. Skatt på årets resultat" sign="+" indent />
                        <FieldRow code="4.3b" label="b. Nedskrivning av finansiella tillgångar" sign="+" indent />
                        <FieldRow code="4.3c" label="c. Andra bokförda kostnader" sign="+" indent />

                        <HeaderRow title="4.4 Kostnader som ska dras av men som inte ingår i det redovisade resultatet" />
                        <FieldRow code="4.4a" label="a. Lämnade koncernbidrag" sign="-" indent />
                        <FieldRow code="4.4b" label="b. Andra ej bokförda kostnader" sign="-" indent />

                        <HeaderRow title="4.5 Bokförda intäkter som inte ska tas upp" />
                        <FieldRow code="4.5a" label="a. Ackordsvinster" sign="-" indent />
                        <FieldRow code="4.5b" label="b. Utdelning" sign="-" indent />
                        <FieldRow code="4.5c" label="c. Andra bokförda intäkter" sign="-" indent />

                        <HeaderRow title="4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet" />
                        <FieldRow code="4.6a" label="a. Beräknad schablonintäkt på periodiseringsfonder vid beskattningsårets ingång" sign="+" indent />
                        <FieldRow code="4.6b" label="b. Beräknad schablonintäkt på fondandelar ägda vid kalenderårets ingång" sign="+" indent />
                        <FieldRow code="4.6c" label="c. Mottagna koncernbidrag" sign="+" indent />
                        <FieldRow code="4.6d" label="d. Uppräknat belopp vid återföring av periodiseringsfond" sign="+" indent />
                        <FieldRow code="4.6e" label="e. Andra ej bokförda intäkter" sign="+" indent />

                        <HeaderRow title="4.7 Avyttring av delägarrätter" />
                        <FieldRow code="4.7a" label="a. Bokförd vinst" sign="-" indent />
                        <FieldRow code="4.7b" label="b. Bokförd förlust" sign="+" indent />
                        <FieldRow code="4.7c" label="c. Uppskov med kapitalvinst enligt blankett N4" sign="-" indent />
                        <FieldRow code="4.7d" label="d. Återfört uppskov av kapitalvinst enligt blankett N4" sign="+" indent />
                        <FieldRow code="4.7e" label="e. Kapitalvinst för beskattningsåret" sign="+" indent />
                        <FieldRow code="4.7f" label="f. Kapitalförlust som ska dras av" sign="-" indent />

                        <HeaderRow title="4.8 Andel i handelsbolag (inkl. avyttring)" />
                        <FieldRow code="4.8a" label="a. Bokförd intäkt/vinst" sign="-" indent />
                        <FieldRow code="4.8b" label="b. Skattemässigt överskott enligt N3B" sign="+" indent />
                        <FieldRow code="4.8c" label="c. Bokförd kostnad/förlust" sign="+" indent />
                        <FieldRow code="4.8d" label="d. Skattemässigt underskott enligt N3B" sign="-" indent />

                        <FieldRow code="4.9" label="Skattemässig justering av bokfört resultat för avskrivning på byggnader och annan fast egendom samt vid restvärdesavskrivning på maskiner och inventarier" sign="+/-" />
                    </div>

                    {/* Right Column */}
                    <div className="border-r border-black border-b border-black">
                        <FieldRow code="4.10" label="Skattemässig justering av bokfört resultat vid avyttring av näringsfastighet och näringsbostadsrätt" sign="+/-" />
                        <FieldRow code="4.11" label="Skogs-/substansminskningsavdrag (specificeras på blankett N8)" sign="-" />
                        
                        <FieldRow code="4.12" label="Återföringar vid avyttring av fastighet, t.ex. värdeminskningsavdrag, skogsavdrag och substansminskningsavdrag (skogs- och substansminskningsavdrag redovisas även på N8)" sign="+" />
                        
                        <FieldRow code="4.13" label="Andra skattemässiga justeringar av resultatet" sign="+/-" />
                        
                        <div className="h-4 bg-zinc-100 border-b border-black"></div>

                        <HeaderRow title="4.14 Underskott" />
                        <FieldRow code="4.14a" label="a. Outnyttjat underskott från föregående år" sign="-" indent />
                        <FieldRow code="4.14b" label="b. Reduktion av outnyttjat underskott med hänsyn till beloppsspärr, ackord, konkurs m.m." sign="+" indent />
                        <FieldRow code="4.14c" label="c. Reduktion av outnyttjat underskott med hänsyn till koncernbidragsspärr, fusionsspärr m.m. (beloppet ska också tas upp vid p. 1.2. på sid. 1)" sign="+" indent />

                        <div className="border-b border-black">
                            {/* 4.15 and 4.16 often have special display rules (Summation) */}
                            <div className={`flex border-b border-black last:border-b-0 min-h-[32px] items-stretch`}>
                                <div className={`w-10 border-r border-black flex items-start justify-center pt-1.5 text-[10px] font-bold text-black flex-shrink-0`}>4.15</div>
                                <div className={`flex-grow px-2 py-1 flex items-center text-[10px] text-black font-bold leading-tight border-r border-black`}>Överskott (flyttas till p. 1.1 på sid. 1)</div>
                                <div className="w-[140px] flex-shrink-0 flex items-center h-8">
                                    <div className="w-6 h-full flex items-center justify-center border-r border-black bg-zinc-100 text-[10px] font-bold">+</div>
                                    <input type="text" value={formatVal(ink2Data.fields["4.15"] > 0 ? ink2Data.fields["4.15"] : 0)} readOnly className="w-full h-full text-right px-1 bg-transparent font-mono text-xs font-bold text-black" />
                                </div>
                            </div>
                            <div className={`flex border-b border-black last:border-b-0 min-h-[32px] items-stretch`}>
                                <div className={`w-10 border-r border-black flex items-start justify-center pt-1.5 text-[10px] font-bold text-black flex-shrink-0`}>4.16</div>
                                <div className={`flex-grow px-2 py-1 flex items-center text-[10px] text-black font-bold leading-tight border-r border-black`}>Underskott (flyttas till p. 1.2 på sid. 1)</div>
                                <div className="w-[140px] flex-shrink-0 flex items-center h-8">
                                    <div className="w-6 h-full flex items-center justify-center border-r border-black bg-zinc-100 text-[10px] font-bold">-</div>
                                    <input type="text" value={formatVal(ink2Data.fields["4.16"] > 0 ? ink2Data.fields["4.16"] : 0)} readOnly className="w-full h-full text-right px-1 bg-transparent font-mono text-xs font-bold text-black" />
                                </div>
                            </div>
                        </div>

                        <div className="p-0 border-b border-black">
                            <div className="bg-white border-b border-black px-2 py-1 text-sm font-bold text-black uppercase mt-4">
                                Övriga uppgifter
                            </div>
                            <FieldRow code="4.17" label="Årets begärda och tidigare års medgivna värdeminskningsavdrag som finns vid beskattningsårets utgång avseende byggnader" />
                            <FieldRow code="4.18" label="Årets begärda och tidigare års medgivna värdeminskningsavdrag som finns vid beskattningsårets utgång avseende markanläggningar" />
                            <FieldRow code="4.19" label="Vid restvärdesavskrivning: återförda belopp för av- och nedskrivning, försäljning, utrangering" />
                            <FieldRow code="4.20" label="Lån från aktieägare (fysisk person) vid beskattningsårets utgång" />
                            <FieldRow code="4.21" label="Pensionskostnader (som ingår i p. 3.8)" />
                            <FieldRow code="4.22" label="Koncernbidragsspärrat och fusionsspärrat underskott m.m. (frivillig uppgift)" />
                        </div>

                        <div className="p-2 border-b border-black bg-white">
                            <h3 className="font-bold text-sm mb-2">Upplysningar om årsredovisningen</h3>
                            <div className="flex justify-between mb-2 text-xs">
                                <span>Uppdragstagare (t.ex. redovisningskonsult) har biträtt vid upprättandet av årsredovisningen</span>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={consultantAssisted} onChange={e => setConsultantAssisted(e.target.checked)} /> Ja</label>
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={!consultantAssisted} onChange={e => setConsultantAssisted(!e.target.checked)} /> Nej</label>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span>Årsredovisningen har varit föremål för revision</span>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={audited} onChange={e => setAudited(e.target.checked)} /> Ja</label>
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={!audited} onChange={e => setAudited(!e.target.checked)} /> Nej</label>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-2 text-right text-[10px] font-mono text-black">
                            INK2SM-1-33-2025P4
                        </div>
                    </div>
                 </div>
             </div>
        )}
        
        {/* --- N9 --- */}
        {activeTab === 'n9' && (
             <div className="max-w-[800px] mx-auto w-full bg-white border border-zinc-400 shadow-lg p-6">
                <div className="mb-4 border-b-2 border-black pb-2 flex justify-between items-end">
                     <div><h1 className="text-xl font-bold">Bilaga N9 - Ränteavdrag</h1></div>
                 </div>
                 
                 <div className="bg-zinc-100 p-6 rounded mb-6">
                     <div className="grid grid-cols-2 gap-4 text-sm">
                         <div className="font-bold">Ränteintäkter:</div>
                         <div className="text-right font-mono">{formatVal(ink2Data.fields["3.16"])}</div>
                         
                         <div className="font-bold">Räntekostnader:</div>
                         <div className="text-right font-mono">{formatVal(ink2Data.fields["3.18"])}</div>
                         
                         <div className="col-span-2 border-t border-zinc-300 my-2"></div>
                         
                         <div className="font-bold">Netto (Negativt = Kostnad):</div>
                         <div className={`text-right font-mono font-bold ${ink2Data.n9.netInterest < 0 ? 'text-red-600' : 'text-black'}`}>
                             {formatVal(ink2Data.n9.netInterest)}
                         </div>
                     </div>
                 </div>

                 <div className="space-y-4">
                     <div className="border border-zinc-300 p-4">
                         <div className="font-bold text-sm mb-2">Förenklingsregeln (5 MSEK)</div>
                         <p className="text-xs text-zinc-500 mb-2">Medger avdrag för negativt räntenetto upp till 5 miljoner kronor.</p>
                         <div className="flex justify-between items-center font-bold text-sm">
                             <span>Avdragsutrymme:</span>
                             <span>5 000 000</span>
                         </div>
                         <div className="flex justify-between items-center font-bold text-sm mt-2 text-[#86BC25]">
                             <span>Status:</span>
                             <span>{Math.abs(ink2Data.n9.netInterest) <= 5000000 ? "OK - Fullt avdrag" : "Överskrider - Använd EBITDA"}</span>
                         </div>
                     </div>
                     
                     <div className="border border-zinc-300 p-4">
                         <div className="font-bold text-sm mb-2">EBITDA-regeln (30%)</div>
                         <p className="text-xs text-zinc-500 mb-2">Avdrag medges med 30% av skattemässigt EBITDA.</p>
                         
                         <div className="grid grid-cols-2 gap-2 text-xs">
                             <div>Skattepliktigt resultat (före ränteavdrag):</div>
                             <div className="text-right font-mono">{formatVal(ink2Data.n9.taxEBITDA)}</div>
                             
                             <div className="font-bold">30% av detta:</div>
                             <div className="text-right font-mono font-bold">{formatVal(ink2Data.n9.deductionCap30)}</div>
                         </div>
                     </div>
                 </div>
             </div>
        )}

    </div>
  );
};

export default TaxReturnModule;
