import React from 'react';
import { 
  Folder, 
  FileText, 
  CheckSquare, 
  BookOpen, 
  Edit3, 
  CalendarCheck, 
  ShieldAlert, 
  GitBranch, 
  Network,
  Cpu,
  Brain,
  ListOrdered,
  Clock,
  ChevronRight
} from 'lucide-react';
import { CaseFile } from '../types';
import { useTranslation, multilingualEngine } from '../lib/multilingualEngine';

interface MatterWorkspaceBarProps {
  selectedCase: CaseFile;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
}

export const MatterWorkspaceBar: React.FC<MatterWorkspaceBarProps> = ({
  selectedCase,
  activeTab,
  onNavigateTab
}) => {
  const { lang, formatTerm } = useTranslation();

  const matterSubTabs = [
    { id: 'dashboard', label: 'Overview', icon: Folder },
    { id: 'timeline', label: 'Timeline', icon: GitBranch },
    { id: 'repository', label: 'Documents', icon: FileText },
    { id: 'evidence', label: 'Evidence', icon: CheckSquare },
    { id: 'research', label: 'Research', icon: BookOpen },
    { id: 'drafting', label: 'Drafts', icon: Edit3 },
    { id: 'hearing', label: 'Hearings', icon: CalendarCheck },
    { id: 'orchestrator', label: 'Tasks', icon: ListOrdered },
    { id: 'billing', label: 'Billing', icon: Clock },
    { id: 'analyzer', label: 'AI', icon: Cpu },
    { id: 'audit', label: 'Audit', icon: Clock },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'memory', label: 'AI Memory', icon: Brain }
  ];

  return (
    <div className="bg-[#1A1A1A] text-white border-b-2 border-[#1A1A1A] px-4 py-2 text-xs shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Active Matter Meta */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="bg-[#B45309] text-white font-bold text-[9px] uppercase px-2 py-0.5 tracking-wider shrink-0">
            {multilingualEngine.translateUIKey('Matter Workspace', lang)}
          </span>
          <span className="font-serif italic font-bold text-amber-300 text-sm truncate max-w-xs md:max-w-md">
            {selectedCase.title}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[10px] font-mono text-slate-300 truncate shrink-0">
            {selectedCase.courtName || 'High Court'} • {selectedCase.stage || 'Interim Injunction'}
          </span>
        </div>

        {/* Matter Navigation Ribbon */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {matterSubTabs.map((st) => {
            const Icon = st.icon;
            const isActive = activeTab === st.id;
            const localizedLabel = multilingualEngine.translateUIKey(st.label, lang);
            return (
              <button
                key={st.id}
                onClick={() => onNavigateTab(st.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 border ${
                  isActive
                    ? 'bg-amber-400 text-black border-amber-400 font-extrabold shadow-xs'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500 hover:text-white'
                }`}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                <span>{localizedLabel}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
