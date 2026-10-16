import React from 'react';
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
  IndianRupee
} from 'lucide-react';
import { useTranslation } from '../lib/multilingualEngine';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const TABS = [
  { id: 'dashboard', labelKey: 'nav.practice_hub', defaultLabel: 'Practice Hub', icon: LayoutDashboard, badge: 'Command' },
  { id: 'billing', labelKey: 'nav.billing', defaultLabel: 'Billing & Invoicing', icon: IndianRupee, badge: 'Finance' },
  { id: 'intelligence', labelKey: 'nav.legal_intelligence', defaultLabel: 'Universal AI Engine', icon: Brain, badge: '10-Step Core' },
  { id: 'graph', labelKey: 'nav.knowledge_graph', defaultLabel: 'Knowledge Graph', icon: Network, badge: 'Graph' },
  { id: 'orchestrator', labelKey: 'nav.ai_pipeline', defaultLabel: 'AI Pipeline', icon: Zap, badge: 'Multi-Agent' },
  { id: 'ops', labelKey: 'nav.telemetry', defaultLabel: 'System Telemetry', icon: Activity, badge: 'Ops Health' },
  { id: 'intake', labelKey: 'nav.client_intake', defaultLabel: 'Client Intake', icon: UserPlus, badge: 'AI Chat' },
  { id: 'analyzer', labelKey: 'nav.case_analyzer', defaultLabel: 'Case Analyzer', icon: FileSearch, badge: 'Deeds & FIR' },
  { id: 'evidence', labelKey: 'nav.evidence_matrix', defaultLabel: 'Evidence Matrix', icon: CheckSquare, badge: 'Scorecard' },
  { id: 'timeline', labelKey: 'nav.timeline', defaultLabel: 'Timeline & Contradictions', icon: GitCommit, badge: 'Chronology' },
  { id: 'research', labelKey: 'nav.legal_research', defaultLabel: 'Legal Research', icon: Scale, badge: 'Precedents' },
  { id: 'drafting', labelKey: 'nav.drafting', defaultLabel: 'Drafting & Cross-Exam', icon: FileText, badge: 'Petitions' },
  { id: 'risk', labelKey: 'nav.risk', defaultLabel: 'Risk & Limitation', icon: ShieldAlert, badge: 'Statute' },
  { id: 'hearing', labelKey: 'nav.hearings', defaultLabel: 'Hearing Prep', icon: CalendarCheck, badge: 'Brief' },
  { id: 'conflict', labelKey: 'nav.conflict', defaultLabel: 'Conflict Check', icon: Lock, badge: 'Compliance' },
  { id: 'audit', labelKey: 'nav.audit', defaultLabel: 'Audit Trail', icon: Clock, badge: 'Ledger' },
  { id: 'analytics', labelKey: 'nav.analytics', defaultLabel: 'Executive Analytics', icon: TrendingUp, badge: 'Metrics' },
  { id: 'plugins', labelKey: 'nav.plugins', defaultLabel: 'Plugin Extensions', icon: Boxes, badge: 'Marketplace' },
  { id: 'repository', labelKey: 'nav.vault', defaultLabel: 'Chamber Vault', icon: FolderLock, badge: 'DM Vault' },
  { id: 'client', labelKey: 'nav.client_portal', defaultLabel: 'Client Portal', icon: MessageSquareText, badge: 'Routine Q&A' },
  { id: 'comparison', labelKey: 'nav.comparison', defaultLabel: 'Doc Compare', icon: GitCompare, badge: 'Diff' }
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();

  return (
    <nav className="bg-[#F5F2EF] border-b-2 border-[#1A1A1A] text-[#1A1A1A] shadow-xs overflow-x-auto no-scrollbar sticky top-[92px] z-30">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 min-w-max py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const label = t(tab.labelKey) !== tab.labelKey ? t(tab.labelKey) : tab.defaultLabel;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A] hover:bg-white'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-[#B45309]'}`} />
              <span className="font-serif italic font-semibold">{label}</span>
              {tab.badge && (
                <span className={`text-[9px] px-1.5 py-0.2 font-sans font-bold uppercase tracking-widest ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#1A1A1A]/10 text-[#1A1A1A]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

