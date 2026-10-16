import React, { useState, useEffect, useRef } from 'react';
import { 
  Scale, 
  Sparkles, 
  LogOut, 
  LogIn, 
  ChevronDown,
  Search, 
  Bell, 
  Users, 
  Globe,
  Bot,
  Shield,
  Activity,
  Cpu,
  Check,
  ChevronRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { User, signInWithPopup, googleProvider, auth } from '../firebase';
import { AgentRole, CaseFile, ChamberProfile, ChamberRole } from '../types';
import { ADVOCATE_AGENTS } from '../data/agents';
import { useTranslation, SUPPORTED_LANGUAGES, LanguageCode } from '../lib/multilingualEngine';

interface HeaderProps {
  user: User | null;
  chamber: ChamberProfile | null;
  currentRole: ChamberRole;
  simulatedRole?: ChamberRole | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAgent: AgentRole;
  setActiveAgent: (agent: AgentRole) => void;
  cases: CaseFile[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  onOpenNewCaseModal: () => void;
  toggleAgentChatDrawer: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenRoleManager: () => void;
  onOpenMultilingual: () => void;
  onLogout: () => Promise<void>;
  aiStatusOverride?: string;
}

const AI_PROCESSING_STATES = [
  { text: 'Analyzing evidence...', icon: Activity, detail: 'Validating title deeds & stamp duty' },
  { text: 'Mapping laws (BNS / IPC)...', icon: Cpu, detail: 'Cross-referencing statutory penal provisions' },
  { text: 'Cross-referencing Limitation (Art. 59)...', icon: Sparkles, detail: 'Checking 3-year cancellation limitation' },
  { text: 'Synthesizing cross-exam vectors...', icon: Cpu, detail: 'Identifying affidavit contradictions' },
  { text: 'Scanning High Court cause lists...', icon: Activity, detail: 'Syncing tomorrow’s judicial fixtures' },
  { text: 'Indexing precedent citations (AIR/SCC)...', icon: Sparkles, detail: 'Verifying binding co-ordinate bench ratios' },
  { text: 'Neural Engine Ready • Chamber Idle', icon: Cpu, detail: 'Zero telemetry • Isolated workspace' }
];

export const Header: React.FC<HeaderProps> = ({
  user,
  chamber,
  currentRole,
  simulatedRole,
  activeTab,
  setActiveTab,
  activeAgent,
  setActiveAgent,
  cases,
  selectedCaseId,
  setSelectedCaseId,
  onOpenNewCaseModal,
  toggleAgentChatDrawer,
  onOpenSearch,
  onOpenNotifications,
  onOpenRoleManager,
  onOpenMultilingual,
  onLogout,
  aiStatusOverride
}) => {
  const { lang, updatePreferences } = useTranslation();
  const [statusIndex, setStatusIndex] = useState(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAiStatusPopoverOpen, setIsAiStatusPopoverOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const aiStatusRef = useRef<HTMLDivElement>(null);

  // Dynamic cycling of the AI Status indicator
  useEffect(() => {
    if (aiStatusOverride) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % AI_PROCESSING_STATES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [aiStatusOverride]);

  // Click away listener for menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (aiStatusRef.current && !aiStatusRef.current.contains(event.target as Node)) {
        setIsAiStatusPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProcessing = AI_PROCESSING_STATES[statusIndex];
  const activeAgentInfo = ADVOCATE_AGENTS.find(a => a.id === activeAgent) || ADVOCATE_AGENTS[0];

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const handleQuickLangChange = (code: LanguageCode) => {
    updatePreferences({
      uiLanguage: code,
      aiConversationLanguage: code,
      draftingLanguage: code
    });
  };

  return (
    <header className="bg-[#1A1A1A] border-b-2 border-[#1A1A1A] text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Logo & Chamber Title */}
          <div 
            className="flex items-center gap-3 cursor-pointer select-none shrink-0" 
            onClick={() => setActiveTab('dashboard')}
            title="Go to Practice Dashboard"
          >
            <div className="w-9 h-9 border border-amber-500/40 bg-slate-900 flex items-center justify-center text-amber-400 font-serif font-black text-xl italic shadow-xs">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif italic text-2xl font-black tracking-tighter text-white">
                  Advocate360
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold px-1.5 py-0.5 bg-[#B45309] text-white">
                  LegalOS
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold truncate max-w-[180px] sm:max-w-xs">
                {chamber ? chamber.name : 'Enterprise AI Practice Suite'}
              </p>
            </div>
          </div>

          {/* 2. AI Status Indicator (Dynamically shows what system is processing) */}
          <div className="relative hidden lg:flex items-center" ref={aiStatusRef}>
            <button
              onClick={() => setIsAiStatusPopoverOpen(!isAiStatusPopoverOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 transition-all text-xs group"
              title="Click to view AI Cognitive Engine status & background processes"
            >
              {/* Dynamic Animated Status Pulse LED */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>

              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 group-hover:text-amber-400 transition-colors">
                AI Engine:
              </span>

              <span className="font-mono text-amber-300 font-medium text-xs max-w-[210px] xl:max-w-xs truncate transition-all duration-300">
                {aiStatusOverride || currentProcessing.text}
              </span>
            </button>

            {/* AI Status Detail Popover */}
            {isAiStatusPopoverOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-[#1A1A1A] border-2 border-amber-500 shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      Neural Engine Pipeline
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">
                    Active
                  </span>
                </div>

                <div className="p-2.5 bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400 block font-mono">
                    Current Task:
                  </span>
                  <p className="text-xs font-serif font-bold text-white">
                    {aiStatusOverride || currentProcessing.text}
                  </p>
                  <p className="text-[11px] text-slate-400 font-sans">
                    {currentProcessing.detail}
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                    Background Autonomous Agents:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                    <span className="px-2 py-1 bg-slate-900 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      OCR Pipeline
                    </span>
                    <span className="px-2 py-1 bg-slate-900 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Evidence Scorer
                    </span>
                    <span className="px-2 py-1 bg-slate-900 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Limitation Audit
                    </span>
                    <span className="px-2 py-1 bg-slate-900 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Cross-Exam Synth
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Global Search (Command Bar Cmd+K) */}
          <div className="flex-1 max-w-sm mx-2">
            <button
              onClick={onOpenSearch}
              className="w-full bg-slate-900/90 border border-slate-700 hover:border-amber-500 text-slate-300 px-3 py-1.5 text-xs font-mono flex items-center justify-between text-left transition-colors"
              title="Global Search & AI Commands (Cmd+K)"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Search cases, acts, filings...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* 4. Current Case Switcher */}
          <div className="flex items-center gap-2">
            {cases.length > 0 && (
              <div className="relative flex items-center bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-500/50 transition-colors">
                <select
                  value={selectedCaseId}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_CASE__') {
                      onOpenNewCaseModal();
                    } else {
                      setSelectedCaseId(e.target.value);
                    }
                  }}
                  className="bg-transparent text-amber-100 font-serif font-semibold focus:outline-none cursor-pointer truncate text-xs max-w-[130px] sm:max-w-[180px] xl:max-w-[220px]"
                  title="Switch Active Matter Context"
                >
                  <optgroup label="Active Chamber Matters" className="bg-[#1A1A1A] text-white">
                    {cases.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#1A1A1A] text-white font-sans">
                        {c.caseNumber ? `${c.caseNumber}: ` : ''}{c.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Actions" className="bg-[#1A1A1A] text-amber-400">
                    <option value="__NEW_CASE__">+ Open New Matter...</option>
                  </optgroup>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 pointer-events-none shrink-0" />
              </div>
            )}
          </div>

          {/* 5. Notifications Bell */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotifications}
              className="relative p-2 bg-slate-900 border border-slate-700 hover:border-amber-500 text-amber-400 transition-colors shrink-0"
              title="Chamber Alerts & Limitation Deadlines"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-amber-500 text-black font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono">
                2
              </span>
            </button>

            {/* 6. Profile & Chamber Specialized Menu */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2 bg-slate-900 border border-slate-700 hover:border-amber-500 transition-colors"
                  title="Chamber Profile, Role Simulator & Auxiliary Settings"
                >
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Advocate')}&background=B45309&color=fff`}
                    alt="User Avatar"
                    className="w-7 h-7 rounded-none border border-amber-400/60 object-cover"
                  />
                  <div className="text-left hidden sm:block max-w-[100px] truncate">
                    <p className="text-[11px] font-serif font-bold text-white truncate leading-none">
                      {user.displayName || 'Advocate'}
                    </p>
                    <span className="text-[9px] font-mono text-amber-400 truncate uppercase">
                      {simulatedRole || currentRole}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Profile & Auxiliary Settings Menu Dropdown */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#1A1A1A] border-2 border-amber-500 shadow-2xl z-50 divide-y divide-slate-800 animate-in fade-in duration-150">
                    
                    {/* Chamber Identity Block */}
                    <div className="p-3 bg-slate-950/60">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Advocate')}&background=B45309&color=fff`}
                          alt="User Avatar"
                          className="w-9 h-9 border border-amber-400"
                        />
                        <div className="truncate">
                          <p className="font-serif font-bold text-sm text-white truncate">
                            {user.displayName || 'Advocate'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                          <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                            {chamber?.name || 'Advocate Chambers'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active AI Agent Selector (Relocated from header bar) */}
                    <div className="p-3 space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#B45309] flex items-center justify-between">
                        <span>Active AI Agent:</span>
                        <span className="font-mono text-slate-400 font-normal">{activeAgentInfo.name}</span>
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        {ADVOCATE_AGENTS.map((agent) => {
                          const isCur = activeAgent === agent.id;
                          return (
                            <button
                              key={agent.id}
                              onClick={() => {
                                setActiveAgent(agent.id);
                              }}
                              className={`p-1.5 text-left text-xs transition-colors border ${
                                isCur
                                  ? 'bg-[#B45309] text-white border-amber-500 font-bold'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isCur ? 'bg-white' : 'bg-green-500'}`} />
                                <span className="uppercase text-[9px] tracking-wider truncate">{agent.title.split(' ')[0]}</span>
                              </div>
                              <p className="text-[10px] opacity-80 truncate">{agent.name.replace(' Agent', '')}</p>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          toggleAgentChatDrawer();
                        }}
                        className="w-full mt-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Bot className="w-3.5 h-3.5 text-amber-400" />
                        <span>Launch Agent Chat Drawer</span>
                      </button>
                    </div>

                    {/* Specialized Menus & Auxiliary Toggles */}
                    <div className="p-2 space-y-1">
                      {/* RBAC Governance & Simulator */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenRoleManager();
                        }}
                        className="w-full p-2 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <div>
                            <p className="font-bold">Role & Permission Simulator</p>
                            <p className="text-[10px] text-slate-400">Current: {currentRole} {simulatedRole && '(SIM)'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {/* Multilingual OS Engine */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenMultilingual();
                        }}
                        className="w-full p-2 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-amber-400" />
                          <div>
                            <p className="font-bold">Multilingual Engine (10 Languages)</p>
                            <p className="text-[10px] text-slate-400">Active: {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.name || 'English'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {/* Add Matter Shortcut */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onOpenNewCaseModal();
                        }}
                        className="w-full p-2 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-emerald-400" />
                          <div>
                            <p className="font-bold">Open New Case File</p>
                            <p className="text-[10px] text-slate-400">Add client dispute or commercial suit</p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>

                    {/* Sign Out */}
                    <div className="p-2">
                      <button
                        onClick={async () => {
                          setIsProfileMenuOpen(false);
                          await onLogout();
                        }}
                        className="w-full p-2 text-left text-xs text-rose-300 hover:bg-rose-950/60 flex items-center gap-2 transition-colors font-bold uppercase tracking-wider"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>Sign Out & Lock Workspace</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-[#B45309] hover:bg-amber-600 text-white font-bold px-4 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-amber-500"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
