
import React from 'react';

interface HomeModuleProps {
  onChangeTab: (tab: 'mapper' | 'annual-report') => void;
}

const HomeModule: React.FC<HomeModuleProps> = ({ onChangeTab }) => {
  return (
    <div className="animate-fade-in max-w-5xl mx-auto py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-black mb-4 tracking-tight">
          Swedish Corporate Tax Assistant
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
          An AI-powered workbench for Deloitte professionals to automate account mapping and analyze annual reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Module 1: Annual Report */}
        <div 
          onClick={() => onChangeTab('annual-report')}
          className="bg-white p-8 rounded-none border border-zinc-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group text-center"
        >
          <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-6 mx-auto group-hover:bg-[#86BC25] transition-colors">
            <i className="fas fa-file-invoice text-2xl"></i>
          </div>
          <h3 className="text-xl font-bold text-black mb-2">Annual Report</h3>
          <p className="text-sm text-zinc-500">
            Extract financials & forensic audit.
          </p>
        </div>

        {/* Module 2: Mapper */}
        <div 
          onClick={() => onChangeTab('mapper')}
          className="bg-white p-8 rounded-none border border-zinc-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group text-center"
        >
          <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-6 mx-auto group-hover:bg-[#86BC25] transition-colors">
            <i className="fas fa-list-ol text-2xl"></i>
          </div>
          <h3 className="text-xl font-bold text-black mb-2">Account Mapper</h3>
          <p className="text-sm text-zinc-500">
            Map accounts to tax categories.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeModule;
