import React, { useState } from 'react';
import { 
  ListOrdered, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  User, 
  Bot, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  Calendar,
  Sparkles
} from 'lucide-react';
import { CaseFile, WorkflowStageItem, WorkflowStepId } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface WorkflowAutomationProps {
  selectedCase: CaseFile;
  onNavigateTab: (tabId: string) => void;
}

export const WorkflowAutomation: React.FC<WorkflowAutomationProps> = ({ selectedCase, onNavigateTab }) => {
  const defaultSteps: WorkflowStageItem[] = [
    { id: 'intake', label: '1. New Client Intake & Fact Recording', status: 'completed', assignedTo: 'Clerk / Reception', autoExecuted: true, timestamp: '2026-07-28 10:15' },
    { id: 'create_matter', label: '2. Matter Creation & RBAC Provisioning', status: 'completed', assignedTo: 'Senior Advocate', autoExecuted: true, timestamp: '2026-07-28 10:20' },
    { id: 'request_docs', label: '3. Document Gathering & Client Upload Request', status: 'completed', assignedTo: 'Client Portal Bot', autoExecuted: true, timestamp: '2026-07-28 10:25' },
    { id: 'analyze_docs', label: '4. AI Document OCR & Fact Extraction', status: 'completed', assignedTo: 'Doc Intelligence Agent', autoExecuted: true, timestamp: '2026-07-28 10:30' },
    { id: 'extract_timeline', label: '5. Automatic Timeline & Contradiction Detection', status: 'completed', assignedTo: 'Timeline Agent', autoExecuted: true, timestamp: '2026-07-28 10:32' },
    { id: 'risk_report', label: '6. Limitation & Case Risk Assessment', status: 'in_progress', assignedTo: 'Case Strategy Agent', autoExecuted: false, timestamp: '2026-07-29 14:00' },
    { id: 'assign_junior', label: '7. Junior Advocate Assignment & Briefing', status: 'pending', assignedTo: 'Advocate Rajesh', autoExecuted: false },
    { id: 'schedule_hearing', label: '8. Court Hearing Date & Calendar Sync', status: 'pending', assignedTo: 'Court Hearing Agent', autoExecuted: false },
    { id: 'prepare_draft', label: '9. Plaint & Interlocutory Petition Drafting', status: 'pending', assignedTo: 'Drafting Agent', autoExecuted: false },
    { id: 'senior_review', label: '10. Senior Advocate Approval Gate', status: 'action_required', assignedTo: 'Senior Advocate S. V.', autoExecuted: false },
    { id: 'court_filing', label: '11. Digital Signature & e-Filing Submission', status: 'pending', assignedTo: 'Senior Advocate', autoExecuted: false },
    { id: 'archive', label: '12. Case Closure & Immutable Audit Archival', status: 'pending', assignedTo: 'Chamber Vault', autoExecuted: false }
  ];

  const [stages, setStages] = useState<WorkflowStageItem[]>(selectedCase.workflowStages || defaultSteps);
  const [isExecutingPipeline, setIsExecutingPipeline] = useState<boolean>(false);

  const handleRunFullPipeline = () => {
    setIsExecutingPipeline(true);

    setTimeout(() => {
      setStages(prev => prev.map(stage => {
        if (stage.id === 'risk_report' || stage.id === 'assign_junior' || stage.id === 'schedule_hearing' || stage.id === 'prepare_draft') {
          return { ...stage, status: 'completed', autoExecuted: true, timestamp: new Date().toISOString().substring(0, 16).replace('T', ' ') };
        }
        return stage;
      }));
      setIsExecutingPipeline(false);
      logAuditEvent('AI_GENERATION', `Executed Automated End-to-End Workflow Pipeline for Matter: ${selectedCase.title}`);
    }, 1800);
  };

  const handleApproveStage = (stepId: WorkflowStepId) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stepId) {
        return { ...stage, status: 'completed', timestamp: new Date().toISOString().substring(0, 16).replace('T', ' ') };
      }
      return stage;
    }));
    logAuditEvent('DRAFT_CREATE', `Approved workflow stage ${stepId} for Matter: ${selectedCase.title}`);
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
              <span>Chamber Workflow Automation Lifecycle</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">End-to-End Matter Pipeline</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Automated 12-step legal lifecycle: from client intake to document analysis, timeline creation, risk assessment, draft generation, senior advocate approval, and e-filing.
            </p>
          </div>

          <button
            onClick={handleRunFullPipeline}
            disabled={isExecutingPipeline}
            className="px-5 py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors self-start md:self-auto shrink-0 shadow-xs"
          >
            <Sparkles className={`w-4 h-4 text-amber-400 ${isExecutingPipeline ? 'animate-spin' : ''}`} />
            <span>{isExecutingPipeline ? 'Executing Automated Workflow...' : 'Run Automated AI Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* Progress Metric Header */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[10px] uppercase tracking-wider text-[#555555]">Pipeline Execution:</span>
          <div className="flex items-center gap-1.5 font-mono font-bold text-sm">
            <span className="text-emerald-800">{stages.filter(s => s.status === 'completed').length} / 12 Steps Completed</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-emerald-900 text-white font-mono text-[9px]">AUTOMATED OCR ACTIVE</span>
          <span className="px-2 py-0.5 bg-[#1A1A1A] text-amber-400 font-mono text-[9px]">APPROVAL GATES ENFORCED</span>
        </div>
      </div>

      {/* Workflow Step Timeline List */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const isDone = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isApprovalRequired = stage.status === 'action_required';

          return (
            <div 
              key={stage.id}
              className={`p-4 border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isDone ? 'bg-[#FDFCFB] border-[#1A1A1A]' :
                isApprovalRequired ? 'bg-amber-500/10 border-[#B45309]' :
                isInProgress ? 'bg-[#F5F2EF] border-[#1A1A1A]' :
                'bg-white border-[#1A1A1A]/30 opacity-70'
              }`}
            >
              <div className="flex items-start md:items-center gap-3">
                <div className="shrink-0 mt-0.5 md:mt-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-800" />
                  ) : isApprovalRequired ? (
                    <AlertTriangle className="w-5 h-5 text-[#B45309] animate-bounce" />
                  ) : isInProgress ? (
                    <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-[#1A1A1A]/40 text-[10px] font-mono flex items-center justify-center font-bold text-[#555555]">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-sm text-[#1A1A1A]">{stage.label}</h3>
                    {stage.autoExecuted && (
                      <span className="bg-[#1A1A1A] text-amber-400 text-[8px] font-mono uppercase px-1.5 py-0.5 font-bold flex items-center gap-1">
                        <Bot className="w-2.5 h-2.5" />
                        AUTO-EXECUTED
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-[#555555]">
                    Assigned: <span className="font-bold text-[#1A1A1A]">{stage.assignedTo}</span>
                    {stage.timestamp && ` • Executed: ${stage.timestamp}`}
                  </p>
                </div>
              </div>

              {/* Action Buttons / Status Badge */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                {isApprovalRequired && (
                  <button
                    onClick={() => handleApproveStage(stage.id)}
                    className="px-3 py-1.5 bg-[#B45309] text-white hover:bg-amber-900 font-bold uppercase text-[10px] border border-[#1A1A1A] flex items-center gap-1 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Senior Advocate Approve</span>
                  </button>
                )}

                {isDone ? (
                  <span className="px-2.5 py-1 bg-emerald-900 text-white font-mono text-[9px] uppercase font-bold">
                    COMPLETED
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-[#1A1A1A]/10 text-[#1A1A1A] border border-[#1A1A1A] font-mono text-[9px] uppercase font-bold">
                    {stage.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
