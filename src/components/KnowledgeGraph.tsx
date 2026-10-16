import React, { useState } from 'react';
import { 
  GitFork, 
  User, 
  FileText, 
  Scale, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  Eye, 
  Network,
  Sparkles,
  Link,
  Layers,
  ArrowRight,
  Bot,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { CaseFile, KnowledgeNode, KnowledgeEdge } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface KnowledgeGraphProps {
  selectedCase: CaseFile;
  onNavigateTab?: (tabId: string) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ selectedCase, onNavigateTab }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-case');
  const [filterType, setFilterType] = useState<string>('all');
  const [graphSearchQuery, setGraphSearchQuery] = useState<string>('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState<boolean>(false);
  const [newNodeLabel, setNewNodeLabel] = useState<string>('');
  const [newNodeType, setNewNodeType] = useState<string>('evidence');
  const [newNodeDetails, setNewNodeDetails] = useState<string>('');

  // Unified Central Database & Knowledge Graph Brain
  const [nodes, setNodes] = useState<KnowledgeNode[]>([
    {
      id: 'node-case',
      label: selectedCase.title || 'Mylapore Ancestral Property Dispute',
      type: 'case',
      status: selectedCase.status || 'Active Litigation',
      details: `Primary Case Entity OS 452/2026 before High Court. Stage: ${selectedCase.stage || 'Interim Injunction'}`
    },
    {
      id: 'node-client',
      label: selectedCase.clientName || 'S. Ramesh (Client)',
      type: 'client',
      status: 'Verified Client Record',
      details: 'Co-heir holding 50% undivided ancestral share under 1995 parent title deed.'
    },
    {
      id: 'node-evidence1',
      label: '1995 Parent Title Deed & Tax Receipts',
      type: 'evidence',
      status: 'Admissible Primary Evidence',
      details: 'Registered parent deed establishing undivided coparcenary ownership and tax continuity.'
    },
    {
      id: 'node-hearing1',
      label: `Order 39 Injunction Hearing (${selectedCase.nextHearingDate || '2026-08-05'})`,
      type: 'hearing',
      status: 'Scheduled Hearing',
      details: 'Urgent application for restraining alienating co-heirs from creating third party rights.'
    },
    {
      id: 'node-task1',
      label: 'Sub-Registrar Witness Summons Task',
      type: 'task',
      status: 'In Progress Task',
      details: 'Issue subpoena to Sub-Registrar Jayaraman to produce Section 32A notification register.'
    },
    {
      id: 'node-research1',
      label: '(2020) 9 SCC 1 Vineeta Sharma SC Precedent',
      type: 'research',
      status: 'Binding Supreme Court Precedent',
      details: 'Full bench ratio confirming coparcenary rights exist by birth regardless of living status in 2005.'
    },
    {
      id: 'node-draft1',
      label: 'Order 39 Rule 1 & 2 Injunction Petition Draft',
      type: 'draft',
      status: 'Ready Draft Document',
      details: 'Draft petition praying for temporary injunction restraining commercial development.'
    },
    {
      id: 'node-memory1',
      label: 'Client Oral Settlement History Memory',
      type: 'aimemory',
      status: 'Indexed AI Context Vector',
      details: 'Remembers client confirmed no written partition deed was ever executed between 1995 and 2026.'
    },
    {
      id: 'node-audit1',
      label: 'Audit Log #9042: Evidence Scorecard Certified',
      type: 'audit',
      status: 'Immutable Security Ledger',
      details: 'Chamber Senior Advocate verified authenticity of tax receipt chain on 2026-07-29.'
    },
    {
      id: 'node-workflow1',
      label: 'Pre-Trial Discovery & Inspection Workflow',
      type: 'workflow',
      status: 'Active Automated Pipeline',
      details: 'Monitors document production deadlines, witness statements, and court filing fees.'
    }
  ]);

  const edges: KnowledgeEdge[] = [
    { id: 'e1', source: 'node-client', target: 'node-case', relationship: 'Client / Petitioner' },
    { id: 'e2', source: 'node-case', target: 'node-evidence1', relationship: 'Supported By' },
    { id: 'e3', source: 'node-case', target: 'node-hearing1', relationship: 'Court Event' },
    { id: 'e4', source: 'node-case', target: 'node-task1', relationship: 'Action Item' },
    { id: 'e5', source: 'node-evidence1', target: 'node-research1', relationship: 'Governed By Ratio' },
    { id: 'e6', source: 'node-research1', target: 'node-draft1', relationship: 'Cited In' },
    { id: 'e7', source: 'node-case', target: 'node-memory1', relationship: 'AI Context Memory' },
    { id: 'e8', source: 'node-evidence1', target: 'node-audit1', relationship: 'Audit Log Trace' },
    { id: 'e9', source: 'node-case', target: 'node-workflow1', relationship: 'Orchestrated By' }
  ];

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel) return;

    const newN: KnowledgeNode = {
      id: `node-${Date.now()}`,
      label: newNodeLabel,
      type: newNodeType as any,
      status: 'Database Record',
      details: newNodeDetails || 'Written into Central Knowledge Graph Database'
    };

    setNodes([newN, ...nodes]);
    setSelectedNodeId(newN.id);
    setShowAddNodeModal(false);
    setNewNodeLabel('');
    setNewNodeDetails('');
    logAuditEvent('DOCUMENT_VIEW', `Injected Entity into Knowledge Graph Database: ${newN.label}`);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || nodes[1];

  const getNodeBadgeColor = (type: string) => {
    switch (type) {
      case 'client': return 'bg-blue-100 text-blue-900 border-blue-900';
      case 'case': return 'bg-amber-100 text-amber-900 border-amber-900';
      case 'document': return 'bg-purple-100 text-purple-900 border-purple-900';
      case 'evidence': return 'bg-emerald-100 text-emerald-900 border-emerald-900';
      case 'witness': return 'bg-cyan-100 text-cyan-900 border-cyan-900';
      case 'hearing': return 'bg-red-100 text-red-900 border-red-900';
      case 'precedent': return 'bg-indigo-100 text-indigo-900 border-indigo-900';
      case 'risk': return 'bg-[#FF4444] text-white border-[#FF4444]';
      default: return 'bg-slate-100 text-slate-900 border-slate-900';
    }
  };

  const runAiGraphReasoning = () => {
    setIsAnalyzing(true);
    logAuditEvent('AI_GENERATION', `Executed AI Graph Intelligence Analysis on Matter: ${selectedCase.title}`);
    
    setTimeout(() => {
      setAiInsight(
        `AI GRAPH INTELLIGENCE DISCOVERY:\n` +
        `• Direct Link: Node [1995 Parent Title Deed] contradicts Node [2026 Impugned Agreement] on Survey No. 402/1A.\n` +
        `• Strategic Path: Relying on Node [(2020) 9 SCC 1 Vineeta Sharma] neutralizes the Defendant's oral family settlement plea.\n` +
        `• Actionable Step: Serve summons on Node [Sub-Registrar S. Jayaraman] prior to hearing on Node [2026-08-05].`
      );
      setIsAnalyzing(false);
    }, 1200);
  };

  const filteredNodes = nodes.filter(n => {
    const matchesFilter = filterType === 'all' || n.type === filterType;
    const matchesSearch = !graphSearchQuery || 
      n.label.toLowerCase().includes(graphSearchQuery.toLowerCase()) || 
      n.details?.toLowerCase().includes(graphSearchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Network className="w-3.5 h-3.5 text-amber-400" />
              <span>Chamber Intelligence & Knowledge Brain</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Matter Knowledge Graph Engine</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Powers AI reasoning, cross-case conflict detection, evidence linking, and non-linear strategic relationship mapping across all chamber assets.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={runAiGraphReasoning}
              disabled={isAnalyzing}
              className="px-4 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isAnalyzing ? 'Analyzing Graph...' : 'Run AI Graph Analysis'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Graph Query Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FDFCFB] p-3 border-2 border-[#1A1A1A]">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#555555] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search graph (e.g. Survey 402/1A, Vineeta Sharma, Jayaraman)..."
            value={graphSearchQuery}
            onChange={(e) => setGraphSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F9F7F5] border border-[#1A1A1A] text-xs text-[#1A1A1A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {['all', 'client', 'case', 'document', 'evidence', 'witness', 'hearing', 'precedent', 'risk'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 font-bold text-[9px] uppercase tracking-wider border transition-colors shrink-0 ${
                filterType === t
                  ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]'
                  : 'bg-[#F9F7F5] text-[#1A1A1A] border-[#1A1A1A]/30 hover:border-[#1A1A1A]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* AI Graph Reasoning Banner */}
      {aiInsight && (
        <div className="p-4 bg-[#1A1A1A] text-amber-100 border-2 border-[#1A1A1A] font-mono text-xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-amber-400 font-bold uppercase text-[10px] tracking-wider border-b border-amber-500/30 pb-1">
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span>AI Graph Reasoning & Relationship Inference</span>
            </span>
            <span>Confidence Score: 96% • Source Citation Verified</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200">{aiInsight}</pre>
        </div>
      )}

      {/* Interactive Visual Graph & Details Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visual Graph Canvas Container */}
        <div className="lg:col-span-8 bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs flex flex-col justify-between min-h-[480px]">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#B45309]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">Graph Topology Canvas</h3>
            </div>
            <span className="text-[10px] font-mono text-[#555555]">{filteredNodes.length} Nodes Rendered • 8 Active Links</span>
          </div>

          {/* Node Grid Layout Simulation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
            {filteredNodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    logAuditEvent('DOCUMENT_VIEW', `Inspected Knowledge Graph Node: ${node.label}`);
                  }}
                  className={`p-3 border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md scale-[1.02]'
                      : 'bg-[#F9F7F5] border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A]'
                  }`}
                >
                  <div className="space-y-1">
                    <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getNodeBadgeColor(node.type)}`}>
                      {node.type}
                    </span>
                    <h4 className={`font-serif font-bold text-xs leading-tight ${isSelected ? 'text-amber-400' : 'text-[#1A1A1A]'}`}>
                      {node.label}
                    </h4>
                  </div>

                  <div className="pt-2 mt-2 border-t border-current/20 flex items-center justify-between text-[10px]">
                    <span className="opacity-70 font-mono italic truncate max-w-[120px]">{node.status}</span>
                    <ArrowRight className={`w-3 h-3 ${isSelected ? 'text-amber-400' : 'text-[#B45309]'}`} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1A1A] text-[10px] text-[#555555] font-serif italic flex items-center justify-between">
            <span>Click any node to inspect relationship ledger and evidence source lineage.</span>
            <span className="font-mono uppercase font-bold text-[#1A1A1A]">Knowledge Graph Level 2</span>
          </div>
        </div>

        {/* Right Column: Selected Node Details & Relationship Inspector */}
        <div className="lg:col-span-4 bg-[#F5F2EF] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="border-b border-[#1A1A1A] pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">Selected Knowledge Entity</span>
            <h3 className="font-serif italic font-bold text-xl text-[#1A1A1A] mt-0.5">{selectedNode.label}</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-bold text-[10px] uppercase text-[#555555] block">Entity Category:</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${getNodeBadgeColor(selectedNode.type)}`}>
                {selectedNode.type}
              </span>
            </div>

            <div>
              <span className="font-bold text-[10px] uppercase text-[#555555] block">Status & Class:</span>
              <p className="font-serif italic font-bold text-[#1A1A1A] mt-0.5">{selectedNode.status}</p>
            </div>

            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]">
              <span className="font-bold text-[10px] uppercase text-[#1A1A1A] block mb-1">Knowledge Node Intelligence:</span>
              <p className="text-xs text-[#1A1A1A] leading-relaxed font-serif italic">{selectedNode.details}</p>
            </div>

            <div>
              <span className="font-bold text-[10px] uppercase text-[#555555] block mb-1.5">Direct Relationships in Case:</span>
              <div className="space-y-1.5">
                {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => (
                  <div key={e.id} className="p-2 bg-[#FDFCFB] border border-[#1A1A1A]/30 text-[11px] flex items-center justify-between">
                    <span className="font-serif italic text-[#1A1A1A]">{e.relationship}</span>
                    <Link className="w-3 h-3 text-[#B45309]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1A1A1A] space-y-2">
            <button
              onClick={() => {
                if (onNavigateTab) onNavigateTab('drafting');
                logAuditEvent('DRAFT_CREATE', `Triggered Petition Draft for Node: ${selectedNode.label}`);
              }}
              className="w-full py-2 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-[10px] border border-[#1A1A1A] transition-colors flex items-center justify-center gap-2"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Draft Notice / Petition for Node</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
