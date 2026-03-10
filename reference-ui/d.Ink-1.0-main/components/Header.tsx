
import React from 'react';

interface HeaderProps {
  onExport: () => void;
  hasAccounts: boolean;
}

const Header: React.FC<HeaderProps> = ({ onExport, hasAccounts }) => {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* d.Ink Logo */}
          <div className="flex items-baseline select-none">
             <span className="text-2xl font-extrabold tracking-tight text-black">d</span>
             <span className="text-3xl text-[#86BC25] leading-none">.</span>
             <span className="text-2xl font-extrabold tracking-tight text-black">Ink</span>
          </div>
          <div className="h-8 w-px bg-zinc-300 mx-2"></div>
          <div>
            <h1 className="text-lg font-bold text-zinc-800 tracking-tight">Tax Compliance Workspace</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">AI-Verktyget</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <button 
            onClick={onExport}
            disabled={!hasAccounts}
            className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-[#86BC25] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
          >
            <i className="fas fa-file-csv group-hover:animate-bounce"></i>
            Silverfin Export
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
