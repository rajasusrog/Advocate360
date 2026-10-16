import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Folder, 
  FileText, 
  User, 
  Scale, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight,
  Zap,
  Clock,
  Briefcase,
  Calendar,
  FileCheck,
  GitCompare,
  FolderLock,
  Lock,
  Brain,
  Lightbulb
} from 'lucide-react';
import { CaseFile } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseFile[];
  onSelectCase: (caseId: string) => void;
  onNavigateTab: (tabId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  cases,
  onSelectCase,
  onNavigateTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const semanticPresetQueries = [
    { text: 'Show property disputes involving Survey 142', tab: 'graph', note: 'Vector Index Match: Survey 142 parcel boundaries & Land Registry' },
    { text: 'Find matters missing witness evidence', tab: 'evidence', note: 'Gaps Match: Order 16 CPC witness list & attestation gaps' },
    { text: 'Cases similar to this agreement', tab: 'analyzer', note: 'Vector Similarity Match: Unlawful conveyance & Section 44 TP Act' },
    { text: 'Clients with hearings next week and unpaid invoices', tab: 'analytics', note: 'Cross-Domain Match: Cause list & fee retainer recovery ledger' },
    { text: 'Show every matter mentioning adverse possession', tab: 'research', note: 'Ratio Match: Article 65 Limitation Act 1963 & Title extinction' },
    { text: 'Property sold without consent', tab: 'evidence', note: 'Semantic Match: Co-heir alienation & Section 44 TP Act' },
    { text: 'Unregistered partition deed', tab: 'research', note: 'Semantic Match: Registration Act Sec 17 & SC precedents' },
    { text: 'Bank transfer 2018 consideration', tab: 'analyzer', note: 'Semantic Match: Bank statement & receipt evidence audit' }
  ];

  const filteredSemanticPresets = semanticPresetQueries.filter(q =>
    !searchQuery ||
    q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.note.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.caseNumber && c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.caseType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const commandPalette = [
    { label: 'Draft legal notice', icon: FileCheck, tab: 'drafting', hint: 'Drafting & Petitions' },
    { label: 'Show tomorrow hearings', icon: Calendar, tab: 'hearing', hint: 'Hearing Prep & Cause List' },
    { label: 'Find all FIRs / Criminal Cases', icon: FileText, tab: 'analyzer', hint: 'Case Analyzer' },
    { label: 'Compare sale deeds', icon: GitCompare, tab: 'comparison', hint: 'Document Diff' },
    { label: 'Create new client intake', icon: User, tab: 'intake', hint: 'Client Onboarding' },
    { label: 'Search survey 142/3 / Land records', icon: Sparkles, tab: 'graph', hint: 'Knowledge Graph' },
    { label: 'Run conflict check', icon: Lock, tab: 'conflict', hint: 'Bar Council Compliance' },
    { label: 'View audit trail & ledger', icon: Clock, tab: 'audit', hint: 'Security Log' },
    { label: 'Executive analytics & revenue', icon: Briefcase, tab: 'analytics', hint: 'Chamber Metrics' },
    { label: 'Chamber Vault / Document Repository', icon: FolderLock, tab: 'repository', hint: 'OCR & Versioning' }
  ].filter(cmd => 
    !searchQuery || 
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.hint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Header Input */}
        <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F5F2EF] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#B45309]" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commands or natural concepts (e.g. 'Property sold without consent', 'Unregistered partition')..."
            className="flex-1 bg-transparent text-[#1A1A1A] placeholder:text-[#888888] text-sm font-medium focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1A1A1A]/10 text-[#1A1A1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results / Action List */}
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-4 text-xs text-[#1A1A1A]">
          
          {/* Semantic Natural Language Matches */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B45309] mb-2 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-amber-600" />
              <span>Semantic AI Vector Search Queries</span>
            </p>
            <div className="space-y-1">
              {filteredSemanticPresets.map((sem, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    logAuditEvent('DOCUMENT_VIEW', `Semantic Search Query Executed: ${sem.text}`);
                    onNavigateTab(sem.tab);
                    onClose();
                  }}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A]/30 hover:bg-[#1A1A1A] hover:text-white flex items-center justify-between group transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-serif italic font-bold block leading-tight">{sem.text}</span>
                      <span className="text-[9px] opacity-70 font-mono block">{sem.note}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Executable Commands */}
          {commandPalette.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#555555] mb-2">LegalOS Executable Commands</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {commandPalette.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        logAuditEvent('DOCUMENT_VIEW', `Command Palette Executed: ${cmd.label}`);
                        onNavigateTab(cmd.tab);
                        onClose();
                      }}
                      className="p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white flex items-center justify-between group transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#B45309] group-hover:text-amber-400 shrink-0" />
                        <div>
                          <span className="font-serif italic font-bold block leading-tight">{cmd.label}</span>
                          <span className="text-[9px] opacity-70 block font-sans">{cmd.hint}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matched Cases */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#555555] mb-2">Chamber Active Matters ({filteredCases.length})</p>
            {filteredCases.length === 0 ? (
              <p className="p-3 bg-[#F5F2EF] border border-[#1A1A1A]/20 font-serif italic text-[#777777]">No matching matter records found.</p>
            ) : (
              <div className="space-y-1.5">
                {filteredCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCase(c.id);
                      onNavigateTab('dashboard');
                      logAuditEvent('DOCUMENT_VIEW', `Command Palette Selected Case: ${c.title}`);
                      onClose();
                    }}
                    className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] hover:border-amber-700 hover:bg-[#F5F2EF] cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-4 h-4 text-[#B45309] shrink-0" />
                      <div>
                        <p className="font-serif font-bold text-sm text-[#1A1A1A] group-hover:text-amber-900">{c.title}</p>
                        <p className="text-[10px] text-[#555555] flex items-center gap-2">
                          <span>Client: {c.clientName}</span>
                          <span>•</span>
                          <span>{c.caseType}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-[#1A1A1A] text-amber-400 px-2 py-0.5 border border-[#1A1A1A]">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Shortcut Bar */}
        <div className="p-2.5 bg-[#1A1A1A] text-white text-[10px] flex items-center justify-between px-4">
          <span className="text-slate-300 font-mono">Use Cmd/Ctrl + K anytime • Esc to exit</span>
          <span className="text-amber-400 font-serif italic font-bold">Advocate360 Universal Command Palette</span>
        </div>

      </div>
    </div>
  );
};
