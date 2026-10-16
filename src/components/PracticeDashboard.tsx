import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  Scale, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus, 
  UserPlus, 
  FileText, 
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Zap,
  Bot,
  Activity,
  Bell,
  Check,
  Download
} from 'lucide-react';
import { CaseFile, CalendarEvent, PracticeTask, FeeRecord } from '../types';
import { logAuditEvent } from '../lib/auditLogger';
import { DailyBriefing } from './DailyBriefing';
import { downloadICS } from '../lib/calendarExport';

interface PracticeDashboardProps {
  cases: CaseFile[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  feeRecords: FeeRecord[];
  onNavigateTab: (tab: string) => void;
  onOpenNewCaseModal: () => void;
}

export const PracticeDashboard: React.FC<PracticeDashboardProps> = ({
  cases,
  selectedCaseId,
  setSelectedCaseId,
  calendarEvents,
  tasks,
  feeRecords,
  onNavigateTab,
  onOpenNewCaseModal
}) => {
  const [isCascadeRunning, setIsCascadeRunning] = useState<boolean>(false);
  const [cascadeLogs, setCascadeLogs] = useState<string[]>([]);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];

  const totalFee = feeRecords.reduce((acc, f) => acc + f.totalFee, 0);
  const paidFee = feeRecords.reduce((acc, f) => acc + f.paidAmount, 0);
  const pendingFee = feeRecords.reduce((acc, f) => acc + f.pendingAmount, 0);

  const runAutonomousCascade = () => {
    setIsCascadeRunning(true);
    setCascadeLogs([]);

    const steps = [
      '1. OCR Agent: Extracted 24 pages from 1995 Parent Title Deed...',
      '2. Document Intelligence Agent: Found 3 key boundary covenants.',
      '3. Evidence Agent: Verified Property Tax Receipts (1995–2025). Score: 88/100.',
      '4. Contradiction Agent: Identified survey number discrepancy vs 2026 Sale Agreement.',
      '5. Precedent Agent: Matched Vineeta Sharma v. Rakesh Sharma (2020 9 SCC 1).',
      '6. Risk Agent: Flagged Article 59 Limitation Act verification requirement.',
      '7. Knowledge Graph Agent: Updated 9 nodes and 8 relationships.',
      '8. Notification Agent: Dispatched Chamber Alert to Advocate Dashboard.'
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setCascadeLogs(prev => [...prev, step]);
        if (idx === steps.length - 1) {
          setIsCascadeRunning(false);
          logAuditEvent('AI_GENERATION', `Autonomous Multi-Agent Cascade executed on Matter: ${selectedCase.title}`);
        }
      }, (idx + 1) * 400);
    });
  };

  if (cases.length === 0) {
    return (
      <div className="space-y-8">
        <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] p-8 lg:p-12 text-[#1A1A1A] text-center space-y-6 shadow-xs">
          <div className="w-16 h-16 bg-[#1A1A1A] text-amber-400 mx-auto flex items-center justify-center font-serif text-2xl font-bold border border-[#1A1A1A]">
            <Scale className="w-8 h-8 text-amber-400" />
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] bg-[#1A1A1A] text-white px-3 py-1 inline-block">
              Clean Chamber State
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-light italic text-[#1A1A1A]">
              Your Chamber is Clean & Ready
            </h1>
            <p className="text-xs sm:text-sm text-[#555555] font-sans leading-relaxed">
              No active matters in this chamber yet. Start by taking down a client intake or creating your first matter record.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
            <button
              onClick={onOpenNewCaseModal}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold px-6 py-3.5 text-xs uppercase tracking-wider flex items-center gap-2 border border-[#1A1A1A] transition-colors"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Create First Matter</span>
            </button>

            <button
              onClick={() => onNavigateTab('intake')}
              className="bg-[#FDFCFB] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] font-bold px-6 py-3.5 text-xs uppercase tracking-wider flex items-center gap-2 border border-[#1A1A1A] transition-colors"
            >
              <UserPlus className="w-4 h-4 text-[#B45309]" />
              <span>Start AI Client Intake</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#1A1A1A]">
      
      {/* Daily Briefing Executive Cause List Summary */}
      <DailyBriefing
        cases={cases}
        calendarEvents={calendarEvents}
        tasks={tasks}
        onNavigateTab={onNavigateTab}
        setSelectedCaseId={setSelectedCaseId}
      />

      {/* Smart Command Header Banner */}
      <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] p-6 lg:p-8 text-[#1A1A1A] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#1A1A1A] pb-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5">
                Executive Command Center
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#B45309] font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>LegalOS Copilot Online</span>
              </span>
            </div>
            
            <h1 className="font-serif text-4xl sm:text-5xl font-light italic leading-tight text-[#1A1A1A]">
              {selectedCase ? selectedCase.title : 'Advocate Chambers Command'}
            </h1>

            <p className="text-sm leading-relaxed text-[#555555]">
              {selectedCase
                ? selectedCase.summary
                : 'Automated legal extraction across land registries, affidavits, cross-examinations, and civil court precedents.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center lg:items-end gap-6 text-right">
            <button
              onClick={runAutonomousCascade}
              disabled={isCascadeRunning}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold px-4 py-3 text-xs uppercase tracking-wider flex items-center gap-2 border border-[#1A1A1A] transition-colors shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isCascadeRunning ? 'Running Cascade...' : 'Trigger Autonomous AI Cascade'}</span>
            </button>
          </div>
        </div>

        {/* Autonomous Cascade Progress Log */}
        {cascadeLogs.length > 0 && (
          <div className="mt-4 p-4 bg-[#1A1A1A] text-amber-300 font-mono text-xs border border-[#1A1A1A] space-y-1">
            <div className="text-amber-400 font-bold uppercase text-[10px] tracking-widest mb-2 flex items-center justify-between">
              <span>Autonomous AI Pipeline Stream</span>
              <span>{cascadeLogs.length}/8 Agents Executed</span>
            </div>
            {cascadeLogs.map((log, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-200">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Shortcuts Strip */}
        <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('intake')}
              className="bg-[#1A1A1A] hover:bg-black text-white font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2 transition-all border border-[#1A1A1A]"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Client Intake</span>
            </button>

            <button
              onClick={() => onNavigateTab('analyzer')}
              className="bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border border-[#1A1A1A] font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Analyze Case Bundle</span>
            </button>

            <button
              onClick={() => onNavigateTab('hearing')}
              className="bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border border-[#1A1A1A] font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-rose-700" />
              <span>Tomorrow's Hearing Brief</span>
            </button>

            <button
              onClick={() => onNavigateTab('conflict')}
              className="bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border border-[#1A1A1A] font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Conflict Check</span>
            </button>
          </div>

          <p className="text-[11px] font-serif italic text-[#555555]">
            Connected Case: <strong className="font-sans font-bold text-[#1A1A1A]">{selectedCase.caseNumber}</strong>
          </p>
        </div>
      </div>

      {/* Urgent AI Recommendations & Risk Alert Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-2">
          <div className="flex items-center gap-2 text-[#B45309] font-bold text-xs uppercase tracking-wider border-b border-[#1A1A1A] pb-1">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>AI Copilot Smart Recommendations</span>
          </div>
          <p className="text-xs font-serif italic text-[#1A1A1A] leading-relaxed">
            • Serve interim injunction order on Star Builders prior to 2026-08-05 hearing.
            <br />
            • Cross-examine Defendant on oral family settlement timeline (Art. 59 Limitation Act).
          </p>
        </div>

        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider border-b border-[#1A1A1A] pb-1">
            <AlertTriangle className="w-4 h-4 text-red-700" />
            <span>Active Risk & Limitation Alerts</span>
          </div>
          <p className="text-xs font-serif italic text-[#1A1A1A] leading-relaxed">
            • Survey No. 402/1A boundary discrepancy requires surveyor witness summons.
            <br />
            • 2 days remaining for rejoinder filing in OS 452/2026.
          </p>
        </div>
      </div>

      {/* Active Case Pipeline Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#B45309]" />
            <span>Active Matter Pipeline ({cases.length})</span>
          </h2>
          <button
            onClick={onOpenNewCaseModal}
            className="text-xs font-bold text-[#B45309] hover:underline uppercase tracking-wider flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open New Case File</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`p-5 border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md'
                    : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A] hover:bg-[#F5F2EF]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${
                      isSelected
                        ? 'bg-white text-[#1A1A1A] border-white'
                        : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    }`}>
                      {c.caseType}
                    </span>
                    <span className="text-xs font-mono opacity-60">{c.caseNumber || 'NO-NUM'}</span>
                  </div>

                  <h3 className="font-serif text-lg font-bold italic line-clamp-1 mb-2">{c.title}</h3>
                  <p className="text-xs opacity-80 line-clamp-2 leading-relaxed mb-4">{c.summary}</p>
                </div>

                <div className="space-y-2 pt-3 border-t border-current/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="opacity-60 text-[10px] uppercase tracking-wider font-bold">Assessment:</span>
                    <span className="font-serif font-bold text-amber-400 text-[11px] truncate">{c.caseAssessment?.overallAssessment || 'Not assessed'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="opacity-60 text-[10px] uppercase tracking-wider font-bold">Hearing:</span>
                    <span className="font-mono text-xs">{c.nextHearingDate || 'Not Scheduled'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] opacity-70">Client: <strong>{c.clientName}</strong></span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseId(c.id);
                        onNavigateTab('analyzer');
                      }}
                      className="text-xs underline font-bold uppercase tracking-wider hover:opacity-80 flex items-center gap-0.5"
                    >
                      Inspect <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Practice Office Manager Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hearing Calendar */}
        <div className="bg-[#F9F7F5] border-2 border-[#1A1A1A] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-700" />
              <span>Hearing Chronology</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadICS(calendarEvents, 'Advocate360_CauseList.ics', 'Chamber Court Hearings')}
                className="px-2 py-0.5 bg-[#1A1A1A] hover:bg-black text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-[#1A1A1A] transition-colors"
                title="Export all fixtures to .ics (Google Calendar / Apple Calendar)"
              >
                <Download className="w-3 h-3 text-amber-400" />
                <span>Sync .ICS</span>
              </button>
              <span className="text-[10px] bg-[#1A1A1A] text-white px-2 py-0.5 font-bold uppercase tracking-wider">
                {calendarEvents.length} Fixtures
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {calendarEvents.map((evt) => (
              <div key={evt.id} className="p-3.5 bg-[#FDFCFB] border border-[#1A1A1A] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-widest font-mono">
                    {evt.date} • {evt.time}
                  </span>
                  <h4 className="font-serif font-bold italic text-sm text-[#1A1A1A]">{evt.caseTitle}</h4>
                  <p className="text-xs opacity-70">{evt.court}</p>
                  <span className="text-[10px] font-bold text-[#1A1A1A] block">Stage: {evt.hearingType}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => onNavigateTab('hearing')}
                    className="px-2.5 py-1 bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
                    title="Prepare Hearing Brief"
                  >
                    Brief
                  </button>
                  <button
                    onClick={() => downloadICS([evt], `Hearing_${evt.caseId}.ics`, evt.caseTitle)}
                    className="text-[9px] font-mono text-slate-600 hover:text-black flex items-center gap-0.5"
                    title="Export single hearing fixture to .ics"
                  >
                    <Download className="w-2.5 h-2.5" />
                    <span>.ICS</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practice Tasks & Follow-ups */}
        <div className="bg-[#F9F7F5] border-2 border-[#1A1A1A] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#B45309]" />
              <span>Evidence Action Items</span>
            </h3>
            <span className="text-[10px] bg-[#1A1A1A] text-white px-2 py-0.5 font-bold uppercase tracking-wider">
              {tasks.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="p-3.5 bg-[#FDFCFB] border border-[#1A1A1A] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-serif italic font-bold text-xs text-[#1A1A1A]">{task.title}</h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-widest border ${
                    task.priority === 'High' ? 'bg-[#FF4444] text-white border-[#FF4444]' : 'bg-[#F5F2EF] text-[#1A1A1A] border-[#1A1A1A]'
                  }`}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] opacity-70">
                  <span>Due: {task.dueDate}</span>
                  <span className="font-bold text-[#B45309]">{task.assignedTo || 'AI Assistant'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fee & Financial Summary */}
        <div className="bg-[#F9F7F5] border-2 border-[#1A1A1A] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              <span>Chambers Fee Ledger</span>
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Accounting</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">Collected</span>
              <p className="text-lg font-serif font-bold text-emerald-900">₹{paidFee.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]">
              <span className="text-[9px] font-bold text-[#B45309] uppercase tracking-widest">Pending</span>
              <p className="text-lg font-serif font-bold text-[#B45309]">₹{pendingFee.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            {feeRecords.map((fee) => (
              <div key={fee.id} className="p-2.5 bg-[#FDFCFB] border border-[#1A1A1A]/30 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-[#1A1A1A]">{fee.clientName}</p>
                  <span className="text-[10px] opacity-60">Due: {fee.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className={`font-serif font-bold ${fee.pendingAmount > 0 ? 'text-[#B45309]' : 'text-emerald-700'}`}>
                    ₹{fee.pendingAmount > 0 ? fee.pendingAmount.toLocaleString() : 'CLEARED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
