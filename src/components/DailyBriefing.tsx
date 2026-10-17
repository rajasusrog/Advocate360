import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  Volume2, 
  VolumeX, 
  Share2, 
  Check, 
  Sparkles, 
  MapPin, 
  User, 
  Gavel, 
  ArrowUpRight,
  Printer,
  ChevronRight,
  Bell,
  CheckCheck,
  ShieldAlert,
  Flame,
  FileCheck,
  ExternalLink
} from 'lucide-react';
import { CalendarEvent, PracticeTask, CaseFile, NotificationItem } from '../types';
import { downloadICS } from '../lib/calendarExport';
import { logAuditEvent } from '../lib/auditLogger';

interface DailyBriefingProps {
  cases: CaseFile[];
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  notifications?: NotificationItem[];
  onNavigateTab: (tab: string) => void;
  setSelectedCaseId?: (caseId: string) => void;
  onToggleTask?: (taskId: string) => void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({
  cases,
  calendarEvents,
  tasks,
  notifications = [],
  onNavigateTab,
  setSelectedCaseId,
  onToggleTask,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [filterView, setFilterView] = useState<'today' | 'week'>('today');
  const [notificationFilter, setNotificationFilter] = useState<'unread' | 'all'>('unread');

  // Format today's date in local and Indian Court format
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const todayFormatted = todayObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Hearings filter: if today has fixtures use today, otherwise show upcoming fixtures
  const todayHearings = calendarEvents.filter(e => e.date === todayStr);
  const displayHearings = filterView === 'today' && todayHearings.length > 0 
    ? todayHearings 
    : calendarEvents.slice(0, 5);

  // Critical deadlines & urgent pending tasks
  const urgentTasks = tasks.filter(t => t.status !== 'Completed' && (t.priority === 'High' || t.dueDate <= todayStr));
  const otherTasks = tasks.filter(t => t.status !== 'Completed' && t.priority !== 'High');

  // Critical Chamber Statutory & Procedural Deadlines
  const criticalDeadlines = [
    {
      id: 'deadline-1',
      title: 'Limitation Expiry Alert (Art. 59 Limitation Act)',
      matter: 'Ramesh Kumar vs. Suresh Kumar',
      message: '3-year limitation to cancel 2021 unregistered deed is approaching. File rejoinder prior to next date.',
      severity: 'CRITICAL',
      cutoff: 'Today, 4:00 PM Registry',
      caseId: 'case-101',
      tab: 'risk'
    },
    {
      id: 'deadline-2',
      title: 'Section 65B / BSA Electronic Evidence Affidavit',
      matter: 'State vs. Vikram Anand',
      message: 'WhatsApp transcript records must be submitted with mandatory advocate certificate under Sec 65B.',
      severity: 'URGENT',
      cutoff: 'Prior to Trial Call',
      caseId: 'case-103',
      tab: 'repository'
    },
    {
      id: 'deadline-3',
      title: 'Commercial Suit Written Statement Filing Window',
      matter: 'Apex Tech Ltd vs. Vertex Infra',
      message: '30-day statutory window under Commercial Courts Act requires filing rejoinder with certified invoices.',
      severity: 'HIGH',
      cutoff: '2 Days Remaining',
      caseId: 'case-102',
      tab: 'workflow'
    }
  ];

  // Unread case notifications
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const displayedNotifications = notificationFilter === 'unread' ? unreadNotifications : notifications;

  // AI Synopsis Generation
  const aiSynopsis = `Good morning Advocate. For ${todayFormatted}, your chamber has ${displayHearings.length} scheduled court hearings, with primary listing at ${displayHearings[0]?.court || 'City Civil Court'} (${displayHearings[0]?.time || '10:30 AM'}). There are ${criticalDeadlines.length} critical statutory deadlines and ${urgentTasks.length} urgent tasks pending before registry filing cutoff at 4:00 PM. You have ${unreadNotifications.length} unread case notification${unreadNotifications.length === 1 ? '' : 's'} requiring immediate attention.`;

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
      `[TODAY'S COURT HEARINGS]`,
      ...displayHearings.map((h, i) => `${i + 1}. [${h.time}] ${h.court} - ${h.caseTitle} (${h.hearingType}) | Bench: ${h.judge || 'Hon. Court'}`),
      ``,
      `[CRITICAL STATUTORY DEADLINES]`,
      ...criticalDeadlines.map((d, i) => `${i + 1}. [${d.severity}] ${d.title} - ${d.matter} (Cutoff: ${d.cutoff})`),
      ``,
      `[URGENT ACTION ITEMS]`,
      ...urgentTasks.map((t, i) => `${i + 1}. Due ${t.dueDate}: ${t.title} [Priority: ${t.priority}] (Assigned: ${t.assignedTo || 'Chamber'})`),
      ``,
      `[UNREAD CASE NOTIFICATIONS: ${unreadNotifications.length}]`,
      ...unreadNotifications.map((n, i) => `${i + 1}. [${n.category.toUpperCase()}] ${n.title}: ${n.body}`)
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5">
              Daily Briefing Command
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#B45309] font-bold">
              • Working Court Day
            </span>
            {unreadNotifications.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 flex items-center gap-1 animate-pulse">
                <Bell className="w-3 h-3 text-rose-700" />
                {unreadNotifications.length} Unread Notifications
              </span>
            )}
          </div>
          
          <h2 className="font-serif text-2xl sm:text-3xl font-bold italic text-[#1A1A1A]">
            Advocate Daily Briefing — {todayFormatted}
          </h2>
          <p className="text-xs text-[#555555]">
            Aggregating today's hearing schedule, critical court deadlines, and unread case alerts for the advocate.
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
            title="Sync Today's Hearings with Google Calendar / Outlook (.ics)"
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

      {/* Main 3-Column Briefing Grid: Hearings | Deadlines | Unread Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Today's Hearing Schedule */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-rose-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Hearing Schedule ({displayHearings.length})
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

        {/* Column 2: Critical Deadlines & High-Priority Actions */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Critical Deadlines ({criticalDeadlines.length})
                </h3>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest bg-rose-700 text-white px-1.5 py-0.2">
                Registry Cutoff: 4 PM
              </span>
            </div>

            <div className="space-y-3">
              {/* Statutory limitation and filing deadlines */}
              {criticalDeadlines.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-red-50/60 border border-red-800 space-y-1.5 hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[8px] font-black uppercase tracking-wider bg-red-700 text-white px-1.5 py-0.2">
                      {d.severity}
                    </span>
                    <span className="text-[10px] font-mono text-red-900 font-bold">
                      {d.cutoff}
                    </span>
                  </div>

                  <h4 className="font-serif font-bold text-xs text-red-950">
                    {d.title}
                  </h4>

                  <p className="text-[11px] text-red-900/90 leading-relaxed font-sans">
                    {d.message}
                  </p>

                  <div className="pt-1.5 border-t border-red-200 flex justify-between items-center text-[10px]">
                    <span className="text-slate-600 font-serif italic truncate max-w-[140px]">{d.matter}</span>
                    <button
                      onClick={() => {
                        if (setSelectedCaseId) setSelectedCaseId(d.caseId);
                        onNavigateTab(d.tab);
                      }}
                      className="font-bold uppercase tracking-wider text-red-800 hover:text-black flex items-center gap-0.5"
                    >
                      Address Now <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Priority chamber tasks */}
              <div className="pt-2 border-t border-slate-300">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center justify-between">
                  <span>Priority Chamber Tasks ({urgentTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {urgentTasks.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className="p-2 bg-[#F9F7F5] border border-slate-300 flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={t.status === 'Completed'}
                          onChange={() => onToggleTask && onToggleTask(t.id)}
                          className="mt-0.5 accent-[#B45309] cursor-pointer"
                        />
                        <div>
                          <p className="font-serif font-bold italic text-xs text-[#1A1A1A] leading-tight">
                            {t.title}
                          </p>
                          <span className="text-[10px] font-mono text-slate-500">Due: {t.dueDate}</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold uppercase px-1 py-0.2 bg-amber-100 text-amber-800 shrink-0">
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('workflow')}
            className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] text-[11px] font-bold uppercase tracking-wider text-center border-2 border-[#1A1A1A] transition-colors"
          >
            Open Chamber Workflow Board
          </button>
        </div>

        {/* Column 3: Unread Case Notifications */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#B45309]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Unread Notifications ({unreadNotifications.length})
                </h3>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <button
                    onClick={() => setNotificationFilter('unread')}
                    className={`px-1.5 py-0.5 font-bold uppercase border ${
                      notificationFilter === 'unread' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setNotificationFilter('all')}
                    className={`px-1.5 py-0.5 font-bold uppercase border ${
                      notificationFilter === 'all' ? 'bg-[#1A1A1A] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                </div>

                {unreadNotifications.length > 0 && onMarkAllNotificationsAsRead && (
                  <button
                    onClick={onMarkAllNotificationsAsRead}
                    className="text-[9px] font-bold uppercase tracking-wider text-[#B45309] hover:underline"
                    title="Mark all notifications as read"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {displayedNotifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 italic text-xs space-y-2">
                  <CheckCheck className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p>All case notifications are up to date.</p>
                </div>
              ) : (
                displayedNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 border transition-colors space-y-1.5 ${
                      !n.isRead 
                        ? 'bg-amber-50/40 border-amber-500' 
                        : 'bg-[#F9F7F5] border-slate-300 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${!n.isRead ? 'bg-amber-500 animate-ping' : 'bg-slate-300'}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                          {n.category.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {n.timestamp}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-xs text-[#1A1A1A] leading-tight">
                      {n.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {n.body}
                    </p>

                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px]">
                      {n.linkTab ? (
                        <button
                          onClick={() => onNavigateTab(n.linkTab || 'dashboard')}
                          className="font-bold text-[#B45309] hover:underline flex items-center gap-0.5 uppercase tracking-wider"
                        >
                          View In Case <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : <span />}

                      {!n.isRead && onMarkNotificationAsRead && (
                        <button
                          onClick={() => onMarkNotificationAsRead(n.id)}
                          className="font-bold text-slate-500 hover:text-black uppercase tracking-wider text-[9px]"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('dashboard')}
            className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] text-[11px] font-bold uppercase tracking-wider text-center border-2 border-[#1A1A1A] transition-colors"
          >
            View Full Notification History
          </button>
        </div>

      </div>

    </div>
  );
};
