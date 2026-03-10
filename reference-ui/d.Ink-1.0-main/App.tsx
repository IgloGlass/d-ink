
import React, { useState } from 'react';
import Header from './components/Header';
import { Account, MappingResult, AnnualReportAnalysis } from './types';
import HomeModule from './components/modules/HomeModule';
import { AccountMapperModule } from './components/modules/AccountMapperModule';
import AnnualReportModule from './components/modules/AnnualReportModule';
import { exportToSilverfin } from './services/exportService';

const App: React.FC = () => {
  // --- Global State ---
  const [activeTab, setActiveTab] = useState<'home' | 'annual-report' | 'mapper'>('home');
  
  // Data State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingResult>>({});
  const [annualReportData, setAnnualReportData] = useState<AnnualReportAnalysis | null>(null);

  const handleExportSilverfin = () => {
    if (accounts.length === 0) {
      alert("No accounts to export.");
      return;
    }
    exportToSilverfin(accounts, mappings);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 font-sans text-zinc-900">
      <Header onExport={handleExportSilverfin} hasAccounts={accounts.length > 0} />
      
      {/* Navigation Tabs (Visible unless on Home) */}
      {activeTab !== 'home' && (
        <div className="bg-white border-b border-zinc-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('home')}
                className="py-4 text-xs font-bold text-zinc-500 hover:text-black transition-colors whitespace-nowrap"
              >
                <i className="fas fa-arrow-left mr-1"></i> Home
              </button>
              <button
                onClick={() => setActiveTab('annual-report')}
                className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'annual-report' 
                    ? 'border-[#86BC25] text-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                1. Annual Report
              </button>
              <button
                onClick={() => setActiveTab('mapper')}
                className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'mapper' 
                    ? 'border-[#86BC25] text-black' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                2. Account Mapper
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300">
        
        {/* 
            We use CSS hiding (hidden class) instead of conditional rendering (&&) 
            to ensure background processes (AI imports) persist when switching tabs.
        */}

        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          <HomeModule onChangeTab={setActiveTab} />
        </div>

        <div className={activeTab === 'annual-report' ? 'block' : 'hidden'}>
          <AnnualReportModule 
            data={annualReportData}
            onAnalysisComplete={setAnnualReportData}
            accounts={accounts}
          />
        </div>

        <div className={activeTab === 'mapper' ? 'block' : 'hidden'}>
          <AccountMapperModule 
            accounts={accounts} 
            mappings={mappings} 
            setAccounts={setAccounts} 
            setMappings={setMappings}
            annualReportData={annualReportData} 
          />
        </div>

      </main>

      <footer className="bg-black border-t border-zinc-800 py-8 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg font-bold text-white tracking-tight">Deloitte</span>
                <span className="text-lg text-[#86BC25] font-bold">.</span>
            </div>
           <div className="text-zinc-500 text