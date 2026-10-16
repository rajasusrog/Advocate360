import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  FileSearch, 
  CheckSquare, 
  GitCommit, 
  Scale, 
  FileText, 
  ShieldAlert, 
  CalendarCheck, 
  MessageSquareText, 
  GitCompare,
  Network,
  Zap,
  Lock,
  Clock,
  TrendingUp,
  FolderLock,
  Boxes,
  Activity,
  Brain,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Search,
  Plus,
  Briefcase,
  Layers,
  Cpu,
  ShieldCheck,
  Building2,
  FolderOpen,
  IndianRupee
} from 'lucide-react';
import { useTranslation } from '../lib/multilingualEngine';
import { CaseFile, ChamberRole } from '../types';
import { hasPermission } from '../lib/permissions';

interface SidebarNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  cases: CaseFile[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  onOpenNewCaseModal: () => void;
  currentRole?: ChamberRole;
}

export interface NavTabItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ElementType;
  badge?: string;
  permissionRequired?: string;
}

export interface NavGroup {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ElementType;
  items: NavTabItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'intelligence',
    titleKey: 'nav.group.intelligence',
    defaultTitle: 'AI Legal Intelligence Core',
    icon: Brain,
    items: [
      { id: 'intelligence', labelKey: 'nav.legal_intelligence', defaultLabel: 'Universal AI Engine', icon: Brain, badge: '10-Step' },
      { id: 'graph', labelKey: 'nav.knowledge_graph', defaultLabel: 'Knowledge Graph', icon: Network, badge: 'Matrix' },
      { id: 'orchestrator', labelKey: 'nav.ai_pipeline', defaultLabel: 'Multi-Agent Pipeline', icon: Zap, badge: 'Orchestrator' },
      { id: 'memory', labelKey: 'nav.memory_inspector', defaultLabel: 'AI Context Memory', icon: Cpu, badge: 'Context' }
    ]
  },
  {
    id: 'practice',
    titleKey: 'nav.group.practice',
    defaultTitle: 'Practice & Intake Hub',
    icon: Building2,
    items: [
      { id: 'dashboard', labelKey: 'nav.practice_hub', defaultLabel: 'Practice Hub', icon: LayoutDashboard, badge: 'Command' },
      { id: 'billing', labelKey: 'nav.billing', defaultLabel: 'Billing & Invoicing', icon: IndianRupee, badge: 'Finance' },
      { id: 'intake', labelKey: 'nav.client_intake', defaultLabel: 'Client Intake', icon: UserPlus, badge: 'Chat' },
      { id: 'analyzer', labelKey: 'nav.case_analyzer', defaultLabel: 'Case Document Analyzer', icon: FileSearch, badge: 'Deeds & FIR' },
      { id: 'repository', labelKey: 'nav.vault', defaultLabel: 'Chamber Vault', icon: FolderLock, badge: 'Vault' },
      { id: 'workflow', labelKey: 'nav.workflow', defaultLabel: 'Workflow Automation', icon: Layers, badge: 'Dynamic' }
    ]
  },
  {
    id: 'litigation',
    titleKey: 'nav.group.litigation',
    defaultTitle: 'Litigation & Case Analysis',
    icon: Scale,
    items: [
      { id: 'evidence', labelKey: 'nav.evidence_matrix', defaultLabel: 'Evidence Matrix', icon: CheckSquare, badge: 'Gap Score' },
      { id: 'timeline', labelKey: 'nav.timeline', defaultLabel: 'Timeline & Contradictions', icon: GitCommit, badge: 'Chronology' },
      { id: 'research', labelKey: 'nav.legal_research', defaultLabel: 'Legal Research', icon: Scale, badge: 'Precedents' },
      { id: 'drafting', labelKey: 'nav.drafting', defaultLabel: 'Drafting & Cross-Exam', icon: FileText, badge: 'Petitions' },
      { id: 'risk', labelKey: 'nav.risk', defaultLabel: 'Risk & Limitation', icon: ShieldAlert, badge: 'Statute' },
      { id: 'hearing', labelKey: 'nav.hearings', defaultLabel: 'Hearing Prep & Briefs', icon: CalendarCheck, badge: 'Cause List' },
      { id: 'comparison', labelKey: 'nav.comparison', defaultLabel: 'Doc Compare & Diff', icon: GitCompare, badge: 'Diff' }
    ]
  },
  {
    id: 'governance',
    titleKey: 'nav.group.governance',
    defaultTitle: 'Governance, Ops & Analytics',
    icon: ShieldCheck,
    items: [
      { id: 'ops', labelKey: 'nav.telemetry', defaultLabel: 'System Telemetry', icon: Activity, badge: 'Ops' },
      { id: 'conflict', labelKey: 'nav.conflict', defaultLabel: 'Conflict Checker', icon: Lock, badge: 'Ethics' },
      { id: 'audit', labelKey: 'nav.audit', defaultLabel: 'Audit Trail Ledger', icon: Clock, badge: 'Ledger' },
      { id: 'analytics', labelKey: 'nav.analytics', defaultLabel: 'Executive Analytics', icon: TrendingUp, badge: 'BI' },
      { id: 'plugins', labelKey: 'nav.plugins', defaultLabel: 'Plugin Extensions', icon: Boxes, badge: 'Marketplace' },
      { id: 'client', labelKey: 'nav.client_portal', defaultLabel: 'Client Portal', icon: MessageSquareText, badge: 'Portal' }
    ]
  }
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  cases,
  selectedCaseId,
  setSelectedCaseId,
  onOpenNewCaseModal,
  currentRole = 'CHAMBER_OWNER'
}) => {
  const { t } = useTranslation();
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Accordion open state for groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    intelligence: false,
    practice: false,
    litigation: false,
    governance: false
  });

  // Pinned favorite tabs
  const [pinnedTabs, setPinnedTabs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('adv360_pinned_tabs');
      return saved ? JSON.parse(saved) : ['dashboard', 'intelligence', 'analyzer', 'drafting'];
    } catch {
      return ['dashboard', 'intelligence', 'analyzer', 'drafting'];
    }
  });

  const togglePin = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedTabs((prev) => {
      const updated = prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId];
      localStorage.setItem('adv360_pinned_tabs', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Find all items for search
  const allItems = NAV_GROUPS.flatMap(g => g.items);
  const selectedCase = cases.find(c => c.id === selectedCaseId);

  return (
    <aside
      className={`bg-[#1A1A1A] text-white border-r-2 border-[#1A1A1A] flex flex-col transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Top Sidebar Header & Collapse Toggle */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/60">
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-300 truncate">
              LegalOS Navigator
            </span>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-500 transition-colors mx-auto"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Action: New Matter (+) Button */}
      <div className="p-2 border-b border-slate-800 bg-slate-900/30">
        <button
          onClick={onOpenNewCaseModal}
          className={`w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
            isCollapsed ? 'px-0' : 'px-3'
          }`}
          title="Create New Case Matter"
        >
          <Plus className="w-4 h-4 shrink-0 text-black stroke-[3]" />
          {!isCollapsed && <span>New Case Matter</span>}
        </button>
      </div>

      {/* Quick Search Filter inside Sidebar (When Expanded) */}
      {!isCollapsed && (
        <div className="p-2 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter modules..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-200 text-xs font-mono pl-8 pr-2 py-1.5 focus:outline-none"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-2 text-slate-500 hover:text-white text-[10px] font-mono"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sidebar Navigation Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
        
        {/* Pinned / Favorites Quick Section (When Expanded and Has Items) */}
        {!isCollapsed && pinnedTabs.length > 0 && !searchFilter && (
          <div className="space-y-1">
            <div className="px-2 text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-amber-500/80 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Pinned Favorites</span>
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {pinnedTabs.map((pinId) => {
                const item = allItems.find(i => i.id === pinId);
                if (!item) return null;
                const Icon = item.icon;
                const isActive = activeTab === pinId;
                const label = t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.defaultLabel;

                return (
                  <div
                    key={pinId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab(pinId)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(pinId); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-mono border transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-black font-bold border-amber-500 shadow-xs'
                        : 'bg-slate-900/60 text-slate-300 border-slate-800/80 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                      <span className="truncate">{label}</span>
                    </div>
                    <button
                      onClick={(e) => togglePin(pinId, e)}
                      title="Unpin"
                      className="text-slate-500 hover:text-amber-400 p-0.5 z-10"
                    >
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Grouped Accordion Menu */}
        {NAV_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const isGroupCollapsed = collapsedGroups[group.id];

          // Filter items based on search input
          const filteredItems = searchFilter
            ? group.items.filter(item => {
                const label = t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.defaultLabel;
                return label.toLowerCase().includes(searchFilter.toLowerCase()) || 
                       item.defaultLabel.toLowerCase().includes(searchFilter.toLowerCase()) ||
                       item.id.toLowerCase().includes(searchFilter.toLowerCase());
              })
            : group.items;

          if (searchFilter && filteredItems.length === 0) return null;

          return (
            <div key={group.id} className="space-y-1">
              
              {/* Group Header */}
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-amber-400 transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <GroupIcon className="w-3 h-3 text-amber-500/80 shrink-0" />
                    <span className="truncate">{group.defaultTitle}</span>
                  </div>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`} />
                </button>
              ) : (
                <div className="h-px bg-slate-800 my-2" />
              )}

              {/* Group Nav Items */}
              {(!isGroupCollapsed || searchFilter) && (
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const isPinned = pinnedTabs.includes(item.id);
                    const label = t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.defaultLabel;

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveTab(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(item.id); }}
                        title={isCollapsed ? label : undefined}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-mono border transition-all text-left cursor-pointer ${
                          isCollapsed ? 'justify-center px-0' : ''
                        } ${
                          isActive
                            ? 'bg-amber-500 text-black font-bold border-amber-500 shadow-md'
                            : 'bg-slate-900/40 text-slate-300 border-slate-800/80 hover:bg-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                          {!isCollapsed && <span className="truncate">{label}</span>}
                        </div>

                        {!isCollapsed && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.badge && (
                              <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 ${
                                isActive ? 'bg-black/20 text-black' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                            <button
                              onClick={(e) => togglePin(item.id, e)}
                              title={isPinned ? 'Unpin from favorites' : 'Pin to favorites'}
                              className={`p-0.5 transition-colors z-10 ${
                                isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'
                              }`}
                            >
                              <Star className={`w-3 h-3 ${isPinned ? 'fill-amber-400' : ''}`} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}

      </div>

      {/* Footer: Active Matter Selector Indicator */}
      {!isCollapsed && selectedCase && (
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-400">
            <span className="flex items-center gap-1 text-amber-400">
              <Briefcase className="w-3 h-3" />
              <span>Active Workspace</span>
            </span>
            <span>{selectedCase.caseNumber}</span>
          </div>
          <p className="font-serif italic font-bold text-slate-100 truncate">
            {selectedCase.title}
          </p>
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Forum: {selectedCase.jurisdiction}</span>
            <span className="text-emerald-400 font-bold">{selectedCase.status}</span>
          </div>
        </div>
      )}

    </aside>
  );
};
