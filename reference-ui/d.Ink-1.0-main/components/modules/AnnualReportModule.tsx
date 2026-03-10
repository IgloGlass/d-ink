
import React, { useState } from 'react';
import { performForensicAudit, extractFinancialsFromReport } from '../../services/geminiService';
import { AnnualReportAnalysis, Account } from '../../types';

interface AnnualReportModuleProps {
  onAnalysisComplete: (data: AnnualReportAnalysis) => void;
  data: AnnualReportAnalysis | null;
  accounts: Account[];
}

const INK2_TABLE_ROWS = [
    { header: "Tillgångar/Anläggningstillgångar" },
    { subHeader: "Immateriella anläggningstillgångar" },
    { code: "2.1", label: "Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill och liknande rättigheter" },
    { code: "2.2", label: "Förskott avseende immateriella anläggningstillgångar" },
    { subHeader: "Materiella anläggningstillgångar" },
    { code: "2.3", label: "Byggnader och mark" },
    { code: "2.4", label: "Maskiner, inventarier och övriga materiella anläggningstillgångar" },
    { code: "2.5", label: "Förbättringsutgifter på annans fastighet" },
    { code: "2.6", label: "Pågående nyanläggninar och förskott avseende materiella anläggningstillgångar" },
    { subHeader: "Finansiella anläggningstillgångar" },
    { code: "2.7", label: "Andelar i koncernföretag" },
    { code: "2.8", label: "Andelar i intressebolag och gemensamt styrda företag" },
    { code: "2.9", label: "Ägarintressen i övriga företag och andra långfristiga värdepappersinnehav" },
    { code: "2.10", label: "Fordringar hos koncern-, intresse- och gemensamt styrda företag" },
    { code: "2.11", label: "Lån till delägare eller närstående" },
    { code: "2.12", label: "Fordringar hos övriga företag som det finns ett ägarintresse i och andra långfristiga fordringar" },
    { header: "Omsättningstillgångar" },
    { subHeader: "Varulager m.m." },
    { code: "2.13", label: "Råvaror och förnödenheter" },
    { code: "2.14", label: "Varor under tillverkning" },
    { code: "2.15", label: "Färdiga varor och handelsvaror" },
    { code: "2.16", label: "Övriga lagertillgångar" },
    { code: "2.17", label: "Pågående arbeten för annans räkning" },
    { code: "2.18", label: "Förskott till leverantörer" },
    { subHeader: "Kortfristiga fordringar" },
    { code: "2.19", label: "Kundfordringar" },
    { code: "2.20", label: "Fordringar hos koncern-, intresse- och gemensamt styrda företag" },
    { code: "2.21", label: "Fordringar hos övriga företag som det finns ett ägarintresse i och övriga fordringar" },
    { code: "2.22", label: "Fakturerad men ej upparbetad intäkt" },
    { code: "2.23", label: "Förutbetalda kostnader och upplupna intäkter" },
    { subHeader: "Kortfristiga placeringar" },
    { code: "2.24", label: "Andelar i koncernföretag" },
    { code: "2.25", label: "Övriga kortfristiga placeringar" },
    { subHeader: "Kassa och bank" },
    { code: "2.26", label: "Kassa, bank och redovisningsmedel" },
    { header: "Eget kapital" },
    { code: "2.27", label: "Bundet eget kapital" },
    { code: "2.28", label: "Fritt eget kapital" },
    { header: "Obeskattade reserver och avsättningar" },
    { subHeader: "Obeskattade reserver" },
    { code: "2.29", label: "Periodiseringsfonder" },
    { code: "2.30", label: "Ackumulerade överavskrivningar" },
    { subHeader: "Avsättningar" },
    { code: "2.31", label: "Övriga obeskattade reserver" },
    { code: "2.32", label: "Avsättningar för pensioner och liknande förpliktelser enligt lag (1967:531)" },
    { code: "2.33", label: "Övriga avsättningar för pensioner och liknande förpliktelser" },
    { code: "2.34", label: "Övriga avsättningar" },
    { header: "Skulder (Liabilities)" },
    { subHeader: "Långfristiga skulder" },
    { code: "2.35", label: "Obligationslån" },
    { code: "2.36", label: "Checkräkningskredit" },
    { code: "2.37", label: "Övriga skulder till kreditinstitut" },
    { code: "2.38", label: "Skulder till koncern-, intresse- och gemensamt styrda företag" },
    { code: "2.39", label: "Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" },
    { subHeader: "Kortfristiga skulder" },
    { code: "2.40", label: "Checkräkningskredit" },
    { code: "2.41", label: "Övriga skulder till kreditinstitut" },
    { code: "2.42", label: "Förskott från kunder" },
    { code: "2.43", label: "Pågående arbeten för annans räkning" },
    { code: "2.44", label: "Fakturerad men ej upparbetad intäkt" },
    { code: "2.45", label: "Leverantörskulder" },
    { code: "2.46", label: "Växelskulder" },
    { code: "2.47", label: "Skulder till koncern-, intresse- och gemensamt styrda företag" },
    { code: "2.48", label: "Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" },
    { code: "2.49", label: "Skatteskulder" },
    { code: "2.50", label: "Upplupna kostnader och förutbetalda intäkter" },
    { header: "Resultaträkning" },
    { code: "3.1", label: "Nettoomsättning" },
    { code: "3.2", label: "Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning" },
    { code: "3.3", label: "Aktiverat arbete för egen räkning" },
    { code: "3.4", label: "Övriga rörelseintäkter" },
    { code: "3.5", label: "Råvaror och förnödenheter" },
    { code: "3.6", label: "Handelsvaror" },
    { code: "3.7", label: "Övriga externa kostnader" },
    { code: "3.8", label: "Personalkostnader" },
    { code: "3.9", label: "Av- och nedskrivningar av materiella och immateriella anläggningstillgångar" },
    { code: "3.10", label: "Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar" },
    { code: "3.11", label: "Övriga rörelsekostnader" },
    { code: "3.12", label: "Resultat från andelar i koncernföretag" },
    { code: "3.13", label: "Resultat från andelar i intresseföretag och gemensamt styrda företag" },
    { code: "3.14", label: "Resultat från övriga företag som det finns ett ägarintresse i" },
    { code: "3.15", label: "Resultat från övriga finansiella anläggningstillgångar" },
    { header: "Resultaträkning (forts.)" },
    { code: "3.16", label: "Övriga ränteintäkter och liknande inkomster" },
    { code: "3.17", label: "Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar" },
    { code: "3.18", label: "Räntekostnader och liknande resultatposter" },
    { code: "3.19", label: "Lämnade koncernbidrag" },
    { code: "3.20", label: "Mottagna koncernbidrag" },
    { code: "3.21", label: "Återföring av periodiseringsfond" },
    { code: "3.22", label: "Avsättning till periodiseringsfond" },
    { code: "3.23", label: "Förändring av överavskrivningar" },
    { code: "3.24", label: "Övriga bokslutsdispositioner" },
    { code: "3.25", label: "Skatt på årets resultat" },
    { code: "3.26", label: "Årets resultat, vinst (Flyttas till p. 4.1)" },
    { code: "3.27", label: "Årets resultat, förlust (Flyttas till p. 4.2)" },
];

const AnnualReportModule: React.FC<AnnualReportModuleProps> = ({ onAnalysisComplete, data, accounts }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initial file processing: Just store the file, do not auto-run analysis
  const processFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError("Please upload a PDF file.");
      return;
    }
    setFileName(file.name);
    setUploadedFile(file);
    setError(null);
  };

  const handleForensicAudit = () => {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const result = await performForensicAudit(base64Data);
        // Merge with existing data if any (e.g. if financials were done first)
        const newData: AnnualReportAnalysis = {
            financials: data?.financials || {},
            analysisMarkdown: result.analysisMarkdown,
            currencyUnit: result.currencyUnit || data?.currencyUnit,
            companyName: result.companyName || data?.companyName,
            orgNumber: result.orgNumber || data?.orgNumber,
            taxLosses: result.taxLosses || data?.taxLosses
        };
        onAnalysisComplete(newData);
      } catch (err) {
        setError("Failed to analyze the PDF.");
        console.error(err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(uploadedFile);
  };

  const handleExtractFinancials = (withContext = false) => {
    if (!uploadedFile) return;
    setIsExtracting(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const base64Data = (reader.result as string).split(',')[1];
            // Use existing currency unit if available, otherwise default to SEK
            const currencyHint = data?.currencyUnit || "SEK";
            
            // Pass accounts if withContext is true
            const accountsToUse = withContext ? accounts : undefined;
            
            const financials = await extractFinancialsFromReport(base64Data, currencyHint, accountsToUse);
            
            // Merge with existing data
            const newData: AnnualReportAnalysis = {
                financials: financials,
                analysisMarkdown: data?.analysisMarkdown || "",
                currencyUnit: data?.currencyUnit, // Keep existing currency if known
                companyName: data?.companyName,
                orgNumber: data?.orgNumber,
                taxLosses: data?.taxLosses
            };
            onAnalysisComplete(newData);
        } catch (err) {
            setError("Failed to extract financials.");
        } finally {
            setIsExtracting(false);
        }
    };
    reader.readAsDataURL(uploadedFile);
  };

  const handleUpdateFinancial = (code: string, rawValue: string) => {
      if (!data) return;
      const valStr = rawValue.replace(',', '.').replace(/[^\d.-]/g, '');
      const numVal = parseFloat(valStr);
      
      const updatedFinancials = {
          ...data.financials,
          [code]: isNaN(numVal) ? 0 : numVal
      };

      onAnalysisComplete({
          ...data,
          financials: updatedFinancials
      });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Helper function to clean LaTeX artifacts
  const cleanLatex = (text: string) => {
      if (!text) return "";
      return text
          .replace(/\$\$/g, '')          // Remove double dollar signs
          .replace(/\$/g, '')            // Remove single dollar signs
          .replace(/\\text\{([^}]+)\}/g, '$1') // Remove \text{} wrapper
          .replace(/\\approx/g, '≈')     // Replace approx symbol
          .replace(/\\times/g, '×')      // Replace times symbol
          .replace(/\\%/g, '%')          // Replace escaped percent
          .replace(/\\/g, '');           // Remove remaining backslashes
  };

  // Helper to render markdown text cleanly
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let cleanLine = cleanLatex(line.trim());
      
      // Headers (Remove ###, ##, #)
      if (cleanLine.startsWith('#')) {
          const level = cleanLine.match(/^#+/)?.[0].length || 1;
          const content = cleanLine.replace(/^#+\s*/, '');
          
          if (level === 1) return <h1 key={idx} className="text-2xl font-bold text-black mt-8 mb-4">{content}</h1>;
          if (level === 2) return <h2 key={idx} className="text-xl font-bold text-black mt-6 mb-3 border-b border-zinc-200 pb-2">{content}</h2>;
          return <h3 key={idx} className="text-sm font-bold text-black mt-4 mb-2 uppercase tracking-wide">{content}</h3>;
      }

      // Lists
      if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
        const content = cleanLine.replace(/^[*|-]\s*/, '');
        return (
            <li key={idx} className="ml-4 mb-1 text-sm text-zinc-700 list-disc pl-1 marker:text-[#86BC25]">
                <span dangerouslySetInnerHTML={{ __html: parseBold(content) }} />
            </li>
        );
      }
      
      // Empty lines
      if (cleanLine === '') return <div key={idx} className="h-2"></div>;

      // Regular Paragraphs
      return (
        <p key={idx} className="text-sm text-zinc-600 mb-1 leading-relaxed">
           <span dangerouslySetInnerHTML={{ __html: parseBold(cleanLine) }} />
        </p>
      );
    });
  };

  // Simple parser for **bold** text to HTML
  const parseBold = (text: string) => {
      return text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-900">$1</strong>');
  };

  const hasForensicData = data && data.analysisMarkdown && data.analysisMarkdown.length > 0;
  const hasFinancialData = data && data.financials && Object.keys(data.financials).length > 0;
  const hasAnyData = hasForensicData || hasFinancialData;

  // View: Choice Selection (If file uploaded but no data yet)
  if (uploadedFile && !hasAnyData) {
      return (
          <div className="animate-fade-in pb-20 max-w-4xl mx-auto">
              <div className="bg-white p-8 rounded-none border border-zinc-200 shadow-sm text-center">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-file-pdf text-2xl text-black"></i>
                  </div>
                  <h2 className="text-xl font-bold text-black mb-2">{fileName}</h2>
                  <p className="text-sm text-zinc-500 mb-8">File uploaded successfully. Choose an analysis to begin.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button 
                        onClick={handleForensicAudit}
                        disabled={isAnalyzing}
                        className="group flex flex-col items-center p-6 border-2 border-zinc-100 hover:border-black transition-all bg-zinc-50 hover:bg-white text-left"
                      >
                          <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors">
                              <i className="fas fa-search-dollar text-lg"></i>
                          </div>
                          <h3 className="font-bold text-lg mb-1">Forensic Tax Audit</h3>
                          <p className="text-xs text-zinc-500 text-center">Analyze text for tax risks, non-deductible costs, and accounting anomalies.</p>
                          {isAnalyzing && <div className="mt-4 text-xs font-bold text-[#86BC25] animate-pulse">Running Analysis...</div>}
                      </button>

                      <button 
                        onClick={() => handleExtractFinancials(accounts.length > 0)}
                        disabled={isExtracting}
                        className="group flex flex-col items-center p-6 border-2 border-zinc-100 hover:border-[#86BC25] transition-all bg-zinc-50 hover:bg-white text-left"
                      >
                          <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center mb-4 group-hover:bg-[#86BC25] group-hover:text-white transition-colors">
                              <i className="fas fa-table text-lg"></i>
                          </div>
                          <h3 className="font-bold text-lg mb-1">Extract Financials</h3>
                          <p className="text-xs text-zinc-500 text-center">
                              {accounts.length > 0 ? "Fast extraction using imported Trial Balance context." : "Fast extraction of balance sheet and income statement figures."}
                          </p>
                          {isExtracting && <div className="mt-4 text-xs font-bold text-[#86BC25] animate-pulse">Extracting Data...</div>}
                      </button>
                  </div>
              </div>
              <div className="text-center mt-6">
                 <button onClick={() => { setUploadedFile(null); setFileName(null); }} className="text-xs text-red-500 hover:underline">Remove file and start over</button>
              </div>
          </div>
      );
  }

  // View: Main Dashboard (If at least one analysis exists)
  if (hasAnyData) {
      return (
        <div className="flex flex-col gap-6 animate-fade-in pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Forensic Analysis */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-none shadow-sm h-fit min-h-[400px]">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-search-dollar text-[#86BC25]"></i>
                        <h3 className="font-bold text-sm text-black">Forensic Tax Audit</h3>
                    </div>
                    <div className="text-right">
                        {hasForensicData && <span className="text-[10px] text-zinc-400 font-mono">Completed</span>}
                    </div>
                </div>
                
                {hasForensicData ? (
                    <div className="p-8">
                        {renderMarkdown(data!.analysisMarkdown)}
                    </div>
                ) : (
                    <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                        <p className="text-sm text-zinc-500 mb-6">Forensic analysis has not been run yet.</p>
                        <button 
                            onClick={handleForensicAudit}
                            disabled={isAnalyzing}
                            className="bg-black text-white px-6 py-2.5 rounded-full text-xs font-bold hover:bg-[#86BC25] transition-all flex items-center gap-2"
                        >
                            {isAnalyzing ? <><i className="fas fa-spinner fa-spin"></i> Running...</> : <><i className="fas fa-play"></i> Run Forensic Audit</>}
                        </button>
                    </div>
                )}
            </div>

            {/* Right Column: Financial Data */}
            <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white border border-zinc-200 rounded-none shadow-sm">
                    <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-file-invoice-dollar text-zinc-400"></i>
                            <h3 className="font-bold text-sm text-black">Extracted INK2R Data</h3>
                        </div>
                        {hasFinancialData && <span className="text-[10px] font-bold text-[#86BC25] uppercase tracking-wider">Active</span>}
                    </div>

                    {!hasFinancialData ? (
                         <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <p className="text-sm text-zinc-500 mb-6">Financial data has not been extracted yet.</p>
                            <button 
                                onClick={() => handleExtractFinancials(accounts.length > 0)}
                                disabled={isExtracting}
                                className="bg-black text-white px-6 py-2.5 rounded-full text-xs font-bold hover:bg-[#86BC25] transition-all flex items-center gap-2"
                            >
                                {isExtracting ? <><i className="fas fa-spinner fa-spin"></i> Extracting...</> : <><i className="fas fa-magic"></i> Extract Financials</>}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Re-run controls inside the header or top bar if needed, currently implicit via 'Active' state */}
                            <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                                <span className="text-[10px] text-zinc-500">
                                    {accounts.length > 0 ? `${accounts.length} Trial Balance accounts available for context.` : "No Trial Balance imported."}
                                </span>
                                <button 
                                    onClick={() => handleExtractFinancials(true)}
                                    disabled={isExtracting || accounts.length === 0}
                                    className="text-[10px] font-bold text-black border border-zinc-300 rounded px-2 py-1 hover:bg-black hover:text-white transition-all disabled:opacity-50"
                                    title="Re-run extraction using imported accounts for higher accuracy"
                                >
                                    {isExtracting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>} Deep Verify
                                </button>
                            </div>

                            <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <tbody className="divide-y divide-zinc-100">
                                        {INK2_TABLE_ROWS.map((row, idx) => {
                                            if (row.header) {
                                                return <tr key={idx} className="bg-zinc-100"><td colSpan={3} className="px-4 py-1.5 font-bold text-black uppercase text-[10px] tracking-wider border-y border-zinc-200">{row.header}</td></tr>;
                                            }
                                            if (row.subHeader) {
                                                return <tr key={idx} className="bg-zinc-50"><td colSpan={3} className="px-4 py-1 font-bold text-zinc-500 text-[10px] pl-6 italic">{row.subHeader}</td></tr>;
                                            }
                                            if (row.code) {
                                                const val = data!.financials?.[row.code] || 0;
                                                const hasValue = val !== 0;
                                                return (
                                                    <tr key={idx} className={`hover:bg-zinc-50 transition-colors ${hasValue ? 'bg-[#86BC25]/5' : ''}`}>
                                                        <td className="px-4 py-2 text-zinc-500 font-mono font-bold align-middle w-12">{row.code}</td>
                                                        <td className="px-4 py-2 text-zinc-700 align-middle">{row.label}</td>
                                                        <td className="px-4 py-1 text-right w-32 align-middle">
                                                            <input 
                                                                type="text"
                                                                key={val}
                                                                defaultValue={val === 0 ? '' : Math.round(val).toString()}
                                                                onBlur={(e) => handleUpdateFinancial(row.code, e.target.value)}
                                                                className={`w-full text-right font-mono text-xs bg-transparent border-b focus:ring-0 focus:border-[#86BC25] transition-colors ${
                                                                    hasValue ? 'border-zinc-300 font-bold text-black' : 'border-transparent text-zinc-400 hover:border-zinc-200'
                                                                }`}
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            return null;
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
            </div>
        </div>
      );
  }

  // View: Upload (Default)
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
          <div 
            className={`bg-white p-8 rounded-none border-2 shadow-sm text-center transition-all duration-200 ${
                isDragging 
                ? 'border-[#86BC25] border-dashed bg-zinc-50 scale-[1.01]' 
                : 'border-zinc-200 border-solid'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                isDragging ? 'bg-[#86BC25]/10' : 'bg-zinc-100'
            }`}>
              <i className={`fas fa-file-pdf text-2xl ${isDragging ? 'text-[#86BC25]' : 'text-zinc-400'}`}></i>
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Upload Annual Report</h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
              Drag and drop the Annual Report (PDF) here to begin the analysis.
            </p>
            
            <div className="relative inline-block">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload"
                className="px-6 py-3 bg-[#86BC25] text-white hover:bg-[#76a820] rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <i className="fas fa-upload"></i>
                Select PDF
              </label>
            </div>
            {fileName && <p className="text-xs text-zinc-500 mt-2 font-mono">{fileName}</p>}
            {error && <p className="text-xs text-red-600 mt-4 font-bold"><i className="fas fa-exclamation-triangle mr-1"></i>{error}</p>}
          </div>
    </div>
  );
};

export default AnnualReportModule;
