import React, { useState } from 'react';
import { 
  Bot, 
  Zap, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  FileSearch, 
  CheckSquare, 
  GitCommit, 
  Scale, 
  FileText, 
  ShieldAlert, 
  CalendarCheck, 
  MessageSquareText, 
  Briefcase,
  ArrowRight,
  Brain,
  ListFilter,
  Lightbulb,
  HelpCircle,
  Database,
  Search,
  Link
} from 'lucide-react';
import { AgentOrchestrationTask, CaseFile } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface AgentOrchestratorProps {
  selectedCase: CaseFile;
  onNavigateTab: (tabId: string) => void;
}

interface ExplainabilityNode {
  title: string;
  confidence: number;
  why: string;
  supportingDocs: string[];
  sourceCitations: string[];
  reasoning: string;
}

export const AgentOrchestrator: React.FC<AgentOrchestratorProps> = ({ selectedCase, onNavigateTab }) => {
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<number>(100);
  const [activeExplainability, setActiveExplainability] = useState<ExplainabilityNode | null>(null);

  const [agents, setAgents] = useState<AgentOrchestrationTask[]>([
    {
      agentId: 'planner_agent',
      name: '1. Planner Agent (Task Decomposition)',
      status: 'completed',
      lastRun: '10 minutes ago',
      summary: 'Decomposed case strategy into 5 concurrent worker tasks and assigned validation parameters.',
      outputsCount: 5
    },
    {
      agentId: 'document_intelligence',
      name: '2. Doc OCR & Extraction Worker',
      status: 'completed',
      lastRun: '10 minutes ago',
      summary: 'Parsed 1995 Parent Title Deed, verified Sub-Registrar stamp, extracted parcel boundaries.',
      outputsCount: 4
    },
    {
      agentId: 'evidence_analysis',
      name: '3. Evidence Authenticity Worker',
      status: 'completed',
      lastRun: '10 minutes ago',
      summary: 'Scored Title Deed authenticity at 92/100; verified municipal tax receipt chain.',
      outputsCount: 3
    },
    {
      agentId: 'case_strategy',
      name: '4. Timeline & Contradiction Worker',
      status: 'completed',
      lastRun: '8 minutes ago',
      summary: 'Cross-referenced 1995 deed against 2026 sale agreement; detected boundary variance.',
      outputsCount: 2
    },
    {
      agentId: 'legal_research',
      name: '5. Precedents & Citation Worker',
      status: 'completed',
      lastRun: '8 minutes ago',
      summary: 'Retrieved Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1 coparcenary precedents.',
      outputsCount: 5
    },
    {
      agentId: 'compliance_procedure',
      name: '6. Limitation & Strategy Worker',
      status: 'alert',
      lastRun: '5 minutes ago',
      summary: 'Analyzed Art 59 Limitation Act; flagged need to establish exact date of knowledge.',
      outputsCount: 3
    },
    {
      agentId: 'reviewer_agent',
      name: '7. Reviewer Agent (Quality & Hallucination Gate)',
      status: 'completed',
      lastRun: '2 minutes ago',
      summary: 'Validated citations against Supreme Court DB; certified zero hallucinations; updated Knowledge Graph.',
      outputsCount: 6
    }
  ]);

  const explainabilityData: Record<string, ExplainabilityNode> = {
    planner_agent: {
      title: 'Planner Agent Strategy Decomposition',
      confidence: 98,
      why: 'Case involves coparcenary land alienation dispute requiring parallel verification of title deeds, limitation status, and Supreme Court precedent alignment.',
      supportingDocs: ['Parent_Title_Deed_1995.pdf', 'Agreement_Of_Sale_2026.pdf'],
      sourceCitations: ['Section 44 Transfer of Property Act', 'Article 59 Limitation Act 1963'],
      reasoning: 'Initiated parallel execution across OCR Worker, Evidence Worker, and Precedent Research Worker before synthesizing findings into Reviewer Agent.'
    },
    reviewer_agent: {
      title: 'Reviewer Agent Citation & Consistency Audit',
      confidence: 96,
      why: 'Verifies that all extracted facts match primary uploaded source documents without hallucination or invented case law.',
      supportingDocs: ['Municipal_Tax_Receipts_1996_2025.pdf', 'Sub_Registrar_Search_Report.pdf'],
      sourceCitations: ['Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1', 'Anathula Sudhakar (2008) 4 SCC 594'],
      reasoning: 'Cross-checked 30-year tax receipt dates against title deed execution date. Certified facts to 96% statistical confidence.'
    },
    compliance_procedure: {
      title: 'Limitation Risk Evaluation',
      confidence: 89,
      why: 'Cancellation of agreement of sale must be filed within 3 years of cause of action under Article 59.',
      supportingDocs: ['Agreement_Of_Sale_2026.pdf'],
      sourceCitations: ['Article 59 Limitation Act 1963'],
      reasoning: 'Recommended pleading specific date of knowledge (2026-06-15) when client discovered unauthorized encumbrance to prevent limitation bar.'
    }
  };

  const handleTriggerFullPipeline = () => {
    setIsRunningPipeline(true);
    setPipelineProgress(10);

    const interval = setInterval(() => {
      setPipelineProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRunningPipeline(false);
          logAuditEvent('AI_GENERATION', `Executed Planner-Worker-Reviewer AI Pipeline for Matter: ${selectedCase.title}`);
          return 100;
        }
        return prev + 25;
      });
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-[#1A1A1A] text-amber-400 border border-[#1A1A1A] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified</span>;
      case 'running':
        return <span className="bg-amber-100 text-amber-900 border border-amber-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><RefreshCw className="w-3 h-3 text-amber-700 animate-spin" /> Worker Running</span>;
      case 'alert':
        return <span className="bg-[#FF4444] text-white border border-[#FF4444] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Risk Flagged</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 border border-slate-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Standby</span>;
    }
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Header Banner */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Planner-Worker-Reviewer AI Architecture</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Autonomous Legal Orchestrator & Explainability Ledger</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              High-precision multi-agent architecture: Planner breaks strategy into worker tasks, specialized Workers execute OCR/research, and Reviewer verifies citations before updating the central Knowledge Graph & Memory.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={handleTriggerFullPipeline}
              disabled={isRunningPipeline}
              className="px-5 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isRunningPipeline ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Orchestrating Pipeline ({pipelineProgress}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>Execute Planner-Worker-Reviewer Cycle</span>
                </>
              )}
            </button>
            <span className="text-[10px] font-mono text-[#555555]">Matter: {selectedCase.title}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunningPipeline && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
            <span>Running Planner -&gt; Task Queue -&gt; Worker Agents -&gt; Reviewer Gate</span>
            <span>{pipelineProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-[#F5F2EF] border border-[#1A1A1A]">
            <div 
              className="h-full bg-[#1A1A1A] transition-all duration-300"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Agent Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((ag) => {
          const exp = explainabilityData[ag.agentId];
          return (
            <div 
              key={ag.agentId}
              className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-amber-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 bg-[#1A1A1A] text-amber-400 border border-[#1A1A1A]">
                    <Bot className="w-4 h-4" />
                  </div>
                  {getStatusBadge(ag.status)}
                </div>

                <div>
                  <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">{ag.name}</h4>
                  <p className="text-[10px] text-[#555555] font-mono">Status: Verified • {ag.lastRun}</p>
                </div>

                <p className="text-xs text-[#1A1A1A] font-serif italic leading-relaxed bg-[#F9F7F5] p-2.5 border border-[#1A1A1A]/30">
                  {ag.summary}
                </p>
              </div>

              <div className="pt-2 border-t border-[#1A1A1A]/30 flex items-center justify-between text-xs">
                {exp ? (
                  <button
                    onClick={() => setActiveExplainability(exp)}
                    className="text-[10px] font-bold uppercase tracking-wider bg-[#1A1A1A] text-amber-400 px-2 py-1 border border-[#1A1A1A] flex items-center gap-1 hover:bg-black"
                  >
                    <Lightbulb className="w-3 h-3 text-amber-400" />
                    <span>Explainability & Reasoning</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-[#555555]">Standard Execution</span>
                )}

                <button
                  onClick={() => onNavigateTab(ag.agentId === 'legal_research' ? 'research' : 'analyzer')}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:text-[#B45309] flex items-center gap-1"
                >
                  <span>Output</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Explainability & Citation Ledger Drawer / Modal */}
      {activeExplainability && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">{activeExplainability.title}</h3>
              </div>
              <span className="bg-emerald-900 text-emerald-100 font-mono font-bold text-xs px-2.5 py-1 border border-emerald-950">
                Confidence: {activeExplainability.confidence}%
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]">
                <p className="font-bold uppercase text-[10px] text-[#B45309] mb-1">Why Was This Decision Made?</p>
                <p className="font-serif italic text-[#1A1A1A] text-sm">{activeExplainability.why}</p>
              </div>

              <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]">
                <p className="font-bold uppercase text-[10px] text-[#B45309] mb-1">Reasoning Tree & Step Sequence</p>
                <p className="font-serif text-[#1A1A1A] leading-relaxed">{activeExplainability.reasoning}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-[#1A1A1A]/30 space-y-1">
                  <p className="font-bold uppercase text-[10px] text-[#555555] flex items-center gap-1">
                    <FileText className="w-3 h-3 text-[#B45309]" />
                    Supporting Case Documents
                  </p>
                  <ul className="list-disc list-inside font-mono text-[11px] text-[#1A1A1A] space-y-0.5">
                    {activeExplainability.supportingDocs.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-white border border-[#1A1A1A]/30 space-y-1">
                  <p className="font-bold uppercase text-[10px] text-[#555555] flex items-center gap-1">
                    <Scale className="w-3 h-3 text-[#B45309]" />
                    Binding Legal Citations
                  </p>
                  <ul className="list-disc list-inside font-serif italic text-[11px] text-[#1A1A1A] space-y-0.5">
                    {activeExplainability.sourceCitations.map((cit, idx) => (
                      <li key={idx}>{cit}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveExplainability(null)}
                className="px-4 py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] hover:bg-black"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
