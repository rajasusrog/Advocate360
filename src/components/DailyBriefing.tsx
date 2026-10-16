import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  Volume2, 
  VolumeX, 
  FileText, 
  Share2, 
  Check, 
  Sparkles, 
  MapPin, 
  User, 
  Gavel, 
  ArrowUpRight,
  Printer,
  ChevronRight,
  Filter
} from 'lucide-react';
import { CalendarEvent, PracticeTask, CaseFile } from '../types';
import { downloadICS } from '../lib/calendarExport';
import { logAuditEvent } from '../lib/auditLogger';

interface DailyBriefingProps {
  cases: CaseFile[];
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  onNavigateTab: (tab: string) => void;
  setSelectedCaseId?: (caseId: string) => void;
  onToggleTask?: (taskId: string) => void;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({
  cases,
  calendarEvents,
  tasks,
  onNavigateTab,
  setSelectedCaseId,
  onToggleTask
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [filterView, setFilterView] = useState<'today' | 'week'>('today');

  // Format today's date in local and Indian Court format
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const todayFormatted = todayObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Hearings filter: if today has fixtures use today, otherwise show upcoming week
  const todayHearings = calendarEvents.filter(e => e.date === todayStr);
  const displayHearings = filterView === 'today' && todayHearings.length > 0 
    ? todayHearings 
    : calendarEvents.slice(0, 5);

  // Urgent pending tasks
  const urgentTasks = tasks.filter(t => t.status !== 'Completed' && (t.priority === 'High' || t.dueDate <= todayStr));
  const otherTasks = tasks.filter(t => t.status !== 'Completed' && t.priority !== 'High');

  // Critical chamber alerts
  const urgentAlerts = [
    {
      id: 'alert-1',
      title: 'Limitation Expiry Alert (Art. 59 Limitation Act)',
      matter: 'Ramesh Kumar vs. Suresh Kumar',
      message: '3-year limitation to cancel 2021 unregistered partition deed is approaching. File rejoinder prior to next date.',
      severity: 'CRITICAL',
      caseId: 'case-101'
    },
    {
      id: 'alert-2',
      title: 'Section 65B Certificate Required',
      matter: 'State vs. Vikram Anand',
      message: 'Electronic WhatsApp transcript printouts must be accompanied by advocate affidavit u/s 65B Indian Evidence Act / BSA.',
      severity: 'URGENT',
      caseId: 'case-103'
    }
  ];

  // AI Synopsis Generation
  const aiSynopsis = `Good morning Advocate. For ${todayFormatted}, your chamber has ${displayHearings.length} scheduled court hearings, with primary focus on ${displayHearings[0]?.court || 'Sessions Court'} at ${displayHearings[0]?.time || '10:30 AM'}. You have ${urgentTasks.length} urgent tasks pending before registry filing cutoff at 4:00 PM. Two limitation alerts require advocate attention today.`;

  // Speech synthesis for AI Daily Briefing readout
  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Text-to-speech is not supported by your browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(aiSynopsis);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
      logAuditEvent('AI_GENERATION', 'Advocate played Morning Daily Briefing audio synopsis');
    }
  };

  const handleExportTodayICS = () => {
    downloadICS(
      displayHearings,
      `Advocate360_CauseList_${todayStr}.ics`,
      `Chamber Cause List - ${todayFormatted}`
    );
    logAuditEvent('AI_GENERATION', `Exported ${displayHearings.length} hearings to .ics format`);
  };

  const handleCopyCauseList = () => {
    const listText = [
      `=== ADVOCATE360 MORNING CAUSE LIST & BRIEFING ===`,
      `Date: ${todayFormatted}`,
      ``,
      `[SCHEDULED COURT HEARINGS]`,
      ...displayHearings.map((h, i) => `${i + 1}. [${h.time}] ${h.court} - ${h.caseTitle} (${h.hearingType}) | Bench: ${h.judge || 'Hon. Court'}`),
      ``,
      `[URGENT ACTION ITEMS]`,
      ...urgentTasks.map((t, i) => `${i + 1}. Due ${t.dueDate}: ${t.title} [Priority: ${t.priority}] (Assigned: ${t.assignedTo || 'Chamber'})`),
      ``,
      `[STATUTORY LIMITATION & ALERTS]`,
      ...urgentAlerts.map((a, i) => `${i + 1}. [${a.severity}] ${a.title} - ${a.matter}: ${a.message}`)
    ].join('\n');

    navigator.clipboard.writeText(listText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] text-[#1A1A1A] p-5 lg:p-7 space-y-6 shadow-sm">
      
      {/* Top Banner & Control Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#1A1A1A] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5">
              Morning Cause List Briefing
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B45309] font-bold">
              • Working Court Day
            </span>
          </div>
          
          <h2 className="font-serif text-2xl sm:text-3xl font-bold italic text-[#1A1A1A]">
            Advocate Daily Briefing — {todayFormatted}
          </h2>
          <p className="text-xs text-[#555555]">
            Aggregated intelligence across court cause lists, registry deadlines, and high-priority chamber matters.
          </p>
        </div>

        {/* Global Briefing Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Readout */}
          <button
            onClick={handleToggleSpeech}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
              isPlayingAudio 
                ? 'bg-rose-700 text-white border-rose-800 animate-pulse'
                : 'bg-[#1A1A1A] hover:bg-black text-amber-400 border-[#1A1A1A]'
            }`}
            title="Listen to AI Morning Audio Briefing"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Audio Briefing</span>
              </>
            )}
          </button>

          {/* Export to .ICS */}
          <button
            onClick={handleExportTodayICS}
            className="px-3 py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export Today's Hearings to .ics (Google Calendar / Apple Calendar)"
          >
            <Download className="w-3.5 h-3.5 text-[#B45309]" />
            <span>Sync Calendar (.ICS)</span>
          </button>

          {/* Copy Cause List */}
          <button
            onClick={handleCopyCauseList}
            className="px-3 py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            title="Copy Cause List text to clipboard"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-700" />}
            <span>{copiedSummary ? 'Copied List' : 'Copy List'}</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] transition-colors"
            title="Print Morning Cause List"
          >
            <Printer className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      </div>

      {/* AI Morning Synopsis Box */}
      <div className="p-4 bg-[#1A1A1A] text-white border-2 border-[#1A1A1A] flex items-start gap-3">
        <div className="w-8 h-8 rounded-none bg-amber-500 text-black flex items-center justify-center shrink-0 font-serif font-black">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
              Chamber Intelligence Synopsis
            </span>
          </div>
          <p className="text-xs sm:text-sm font-serif italic text-slate-200 leading-relaxed">
            "{aiSynopsis}"
          </p>
        </div>
      </div>

      {/* Main 3-Column Briefing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Today's Hearings & Cause List */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-rose-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Court Fixtures ({displayHearings.length})
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <button
                  onClick={() => setFilterView('today')}
                  className={`px-1.5 py-0.5 font-bold uppercase border ${
                    filterView === 'today' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setFilterView('week')}
                  className={`px-1.5 py-0.5 font-bold uppercase border ${
                    filterView === 'week' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Upcoming
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {displayHearings.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic text-xs">
                  No scheduled hearings on today's cause list.
                </div>
              ) : (
                displayHearings.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 hover:border-amber-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#B45309] bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                        {evt.time} • {evt.date}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-1.5 py-0.2">
                        {evt.hearingType}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-serif font-bold italic text-sm text-[#1A1A1A] line-clamp-1">
                        {evt.caseTitle}
                      </h4>
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-rose-700 shrink-0" />
                        <span className="truncate">{evt.court}</span>
                      </p>
                      {evt.judge && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{evt.judge}</span>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          if (setSelectedCaseId) setSelectedCaseId(evt.caseId);
                          onNavigateTab('hearing');
                        }}
                        className="text-[10px] font-bold uppercase text-[#B45309] hover:underline flex items-center gap-0.5"
                      >
                        Prepare Brief <ArrowUpRight className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => downloadICS([evt], `Hearing_${evt.caseId}.ics`)}
                        className="text-[10px] font-mono text-slate-600 hover:text-black flex items-center gap-1"
                        title="Export this single hearing to .ics"
                      >
                        <Download className="w-3 h-3" />
                        <span>.ICS</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('hearing')}
            className="w-full py-2 bg-[#1A1A1A] text-amber-400 hover:bg-black text-[11px] font-bold uppercase tracking-wider text-center border border-[#1A1A1A] transition-colors"
          >
            Open Comprehensive Hearing Brief
          </button>
        </div>

        {/* Column 2: Urgent Pending Tasks & Action Items */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#B45309]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Priority Actions ({urgentTasks.length})
                </h3>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest bg-rose-700 text-white px-1.5 py-0.2">
                Filing Cutoff: 4 PM
              </span>
            </div>

            <div className="space-y-2.5">
              {urgentTasks.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic text-xs">
                  All urgent tasks completed!
                </div>
              ) : (
                urgentTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 hover:border-[#B45309] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={t.status === 'Completed'}
                          onChange={() => onToggleTask && onToggleTask(t.id)}
                          className="mt-0.5 accent-[#B45309] cursor-pointer"
                        />
                        <h4 className="font-serif font-bold italic text-xs text-[#1A1A1A] leading-tight">
                          {t.title}
                        </h4>
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.2 bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                        {t.priority}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-1 border-t border-slate-300">
                      <span>Due: <strong>{t.dueDate}</strong></span>
                      <span className="text-[#B45309] font-bold">{t.assignedTo || 'Junior Associate'}</span>
                    </div>
                  </div>
                ))
              )}

              {/* Other tasks summary */}
              {otherTasks.length > 0 && (
                <div className="p-2 bg-slate-50 border border-slate-300 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>+ {otherTasks.length} standard practice tasks in pipeline</span>
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="font-bold underline text-[#1A1A1A]"
                  >
                    View All
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('workflow')}
            className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] text-[11px] font-bold uppercase tracking-wider text-center border-2 border-[#1A1A1A] transition-colors"
          >
            Open Chamber Workflow Board
          </button>
        </div>

        {/* Column 3: Critical Limitation & Red Alerts */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Limitation & Risk Alerts
                </h3>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest bg-red-100 text-red-900 border border-red-300 px-1.5 py-0.2">
                Statutory
              </span>
            </div>

            <div className="space-y-3">
              {urgentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-red-50/50 border-2 border-red-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[8px] font-black uppercase tracking-wider bg-red-700 text-white px-1.5 py-0.2">
                      {alert.severity}
                    </span>
                    <span className="text-[10px] font-mono text-red-900 font-bold truncate max-w-[150px]">
                      {alert.matter}
                    </span>
                  </div>

                  <h4 className="font-serif font-bold text-xs text-red-950">
                    {alert.title}
                  </h4>

                  <p className="text-[11px] text-red-900/90 leading-relaxed font-sans">
                    {alert.message}
                  </p>

                  <div className="pt-1.5 border-t border-red-200 flex justify-end">
                    <button
                      onClick={() => {
                        if (setSelectedCaseId) setSelectedCaseId(alert.caseId);
                        onNavigateTab('risk');
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-red-800 hover:text-black flex items-center gap-0.5"
                    >
                      Audit Limitation <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('risk')}
            className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] text-[11px] font-bold uppercase tracking-wider text-center border-2 border-[#1A1A1A] transition-colors"
          >
            Review Limitation Act Analyzer
          </button>
        </div>

      </div>

    </div>
  );
};
