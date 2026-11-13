import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  AlertTriangle,
  Download,
  Volume2,
  VolumeX,
  Share2,
  MapPin,
  User,
  Gavel,
  ArrowUpRight,
  Printer,
  ChevronRight,
  Bell,
  CheckCheck,
  Plus,
} from 'lucide-react';
import { CalendarEvent, PracticeTask, CaseFile, NotificationItem } from '../types';
import { downloadICS } from '../lib/calendarExport';
import { logAuditEvent } from '../lib/auditLogger';
import { StatusBadge } from './ui/StatusBadge';

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
  onOpenScheduleHearing?: (matterId?: string) => void;
  onOpenNewTaskModal?: () => void;
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
  onMarkAllNotificationsAsRead,
  onOpenScheduleHearing,
  onOpenNewTaskModal,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [filterView, setFilterView] = useState<'today' | 'upcoming'>('upcoming');
  const [notificationFilter, setNotificationFilter] = useState<'attention' | 'all'>('attention');

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];
  const todayFormatted = todayObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Sort upcoming hearings cleanly using existing calendarEvents + matter nextHearingDate fallback
  const sortedHearings = [...calendarEvents].sort((a, b) => a.date.localeCompare(b.date));
  const todayHearings = sortedHearings.filter((e) => e.date === todayStr);
  const upcomingHearings = sortedHearings.filter((e) => e.date >= todayStr);
  const displayHearings =
    filterView === 'today'
      ? todayHearings
      : (upcomingHearings.length > 0 ? upcomingHearings : sortedHearings).slice(0, 6);

  // Due & pending tasks sorted by priority & due date
  const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const pendingTasks = tasks
    .filter((t) => t.status !== 'Completed')
    .sort((a, b) => {
      const aDue = a.dueDate || '9999-12-31';
      const bDue = b.dueDate || '9999-12-31';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    });

  // Matters needing attention computed strictly from real chamber data
  const activeCases = cases.filter((c) => c.status !== 'Archived' && c.status !== 'Closed');
  const mattersNeedingAttention = activeCases
    .map((matter) => {
      const overdueTasks = pendingTasks.filter(
        (t) => t.caseId === matter.id && t.dueDate && t.dueDate <= todayStr
      );
      const nextHearing = matter.nextHearingDate;
      const daysToHearing = nextHearing
        ? Math.ceil((new Date(nextHearing).getTime() - Date.now()) / 86400000)
        : null;
      const reasons: string[] = [];

      if (overdueTasks.length > 0) {
        reasons.push(`${overdueTasks.length} due or overdue task${overdueTasks.length > 1 ? 's' : ''}`);
      }
      if (daysToHearing !== null && daysToHearing >= 0 && daysToHearing <= 3) {
        reasons.push(
          daysToHearing === 0 ? 'Hearing listed today' : `Hearing in ${daysToHearing}d (${nextHearing})`
        );
      } else if (!nextHearing) {
        reasons.push('No upcoming hearing scheduled');
      }
      if (matter.caseAssessment?.riskFactors && matter.caseAssessment.riskFactors.length > 0) {
        reasons.push(matter.caseAssessment.riskFactors[0]);
      }

      if (reasons.length === 0) return null;
      return {
        matter,
        severity:
          overdueTasks.length > 0 || (daysToHearing !== null && daysToHearing <= 1)
            ? ('warning' as const)
            : ('info' as const),
        reason: reasons.slice(0, 2).join(' • '),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 5);

  const unreadNotifications = notifications.filter((n) => !n.isRead);

  const aiSynopsis = `Briefing for ${todayFormatted}. You have ${displayHearings.length} scheduled court hearing${displayHearings.length === 1 ? '' : 's'}, ${pendingTasks.length} pending preparation task${pendingTasks.length === 1 ? '' : 's'}, and ${mattersNeedingAttention.length} matter${mattersNeedingAttention.length === 1 ? '' : 's'} needing attention.`;

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(aiSynopsis);
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
      logAuditEvent('AI_GENERATION', 'Advocate played Today briefing audio synopsis');
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
      `ADVOCATE360 DAILY CAUSE LIST — ${todayFormatted}`,
      ``,
      `UPCOMING HEARINGS (${displayHearings.length}):`,
      ...displayHearings.map(
        (h, i) => `${i + 1}. ${h.date} ${h.time} | ${h.court} — ${h.caseTitle} (${h.hearingType})`
      ),
      ``,
      `DUE TASKS (${pendingTasks.length}):`,
      ...pendingTasks
        .slice(0, 10)
        .map((t, i) => `${i + 1}. Due ${t.dueDate || 'TBD'}: ${t.title} [${t.priority}]`),
      ``,
      `MATTERS NEEDING ATTENTION (${mattersNeedingAttention.length}):`,
      ...mattersNeedingAttention.map(
        (m, i) => `${i + 1}. ${m.matter.title}: ${m.reason}`
      ),
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(listText);
    }
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="space-y-5 text-[#0B1426]">
      {/* Compact Utility Bar */}
      <div className="bg-white border border-[#E2DFD7] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C49A36]">
              Daily Cause List
            </span>
            <span className="text-xs text-[#64748B]">• {todayFormatted}</span>
          </div>
          <p className="text-sm text-[#475569] leading-relaxed">{aiSynopsis}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isPlayingAudio
                ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                : 'bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border-[#E2DFD7]'
            }`}
            title="Listen to daily briefing summary"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#C49A36]" />
                <span>Audio briefing</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportTodayICS}
            className="px-3 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Sync hearings to calendar (.ics)"
          >
            <Download className="w-3.5 h-3.5 text-[#0B1426]" />
            <span>Export .ICS</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCauseList}
            className="px-3 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy cause list to clipboard"
          >
            {copiedSummary ? (
              <Check className="w-3.5 h-3.5 text-[#15803D]" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-[#0B1426]" />
            )}
            <span>{copiedSummary ? 'Copied' : 'Copy summary'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg transition-colors cursor-pointer"
            title="Print cause list"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Priority 3-Column Grid: Upcoming Hearings | Due Tasks | Matters Needing Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Upcoming Hearings */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Gavel className="w-4 h-4 text-[#C49A36] shrink-0" />
                <h3 className="text-sm font-semibold text-[#0B1426] truncate">
                  Upcoming hearings ({displayHearings.length})
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-[#F6F5F1] p-0.5 rounded-lg border border-[#E2DFD7] text-[11px] font-medium shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterView('upcoming')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    filterView === 'upcoming'
                      ? 'bg-[#0B1426] text-white'
                      : 'text-[#475569] hover:text-[#0B1426]'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setFilterView('today')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    filterView === 'today'
                      ? 'bg-[#0B1426] text-white'
                      : 'text-[#475569] hover:text-[#0B1426]'
                  }`}
                >
                  Today
                </button>
              </div>
            </div>

            {displayHearings.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <Calendar className="w-7 h-7 text-[#64748B] mx-auto" />
                <p className="text-xs text-[#64748B]">
                  {filterView === 'today'
                    ? 'No hearings scheduled for today.'
                    : 'No upcoming hearings scheduled yet.'}
                </p>
                {onOpenScheduleHearing && cases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenScheduleHearing()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#C49A36]" />
                    <span>Schedule hearing</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayHearings.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-2 hover:border-[#0B1426]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#0B1426] u360-table-numeric">
                        {evt.date} • {evt.time}
                      </span>
                      <StatusBadge label={evt.hearingType} tone="gold" />
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-[#0B1426] line-clamp-1">
                        {evt.caseTitle}
                      </h4>
                      <p className="text-xs text-[#475569] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#C49A36] shrink-0" />
                        <span className="truncate">{evt.court}</span>
                      </p>
                      {evt.judge && (
                        <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">{evt.judge}</span>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#E2DFD7] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          if (setSelectedCaseId) setSelectedCaseId(evt.caseId);
                          onNavigateTab(`matters/${evt.caseId}/work`);
                        }}
                        className="text-xs font-semibold text-[#0B1426] hover:text-[#C49A36] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open matter</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadICS([evt], `Hearing_${evt.caseId}.ics`)}
                        className="text-[11px] font-medium text-[#475569] hover:text-[#0B1426] flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>.ICS</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#E2DFD7]">
            {onOpenScheduleHearing && cases.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenScheduleHearing()}
                className="flex-1 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer"
              >
                Schedule hearing
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('work')}
              className="flex-1 py-2 bg-white hover:bg-[#F6F5F1] text-[#0B1426] border border-[#E2DFD7] text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer"
            >
              All hearings
            </button>
          </div>
        </section>

        {/* Column 2: Due Tasks */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-[#C49A36] shrink-0" />
                <h3 className="text-sm font-semibold text-[#0B1426] truncate">
                  Due tasks ({pendingTasks.length})
                </h3>
              </div>
              {onOpenNewTaskModal && (
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="text-xs font-semibold text-[#0B1426] hover:text-[#C49A36] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add task</span>
                </button>
              )}
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCheck className="w-7 h-7 text-[#15803D] mx-auto" />
                <p className="text-xs text-[#64748B]">All tasks are complete or up to date.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingTasks.slice(0, 6).map((task) => {
                  const isOverdue = Boolean(task.dueDate && task.dueDate < todayStr);
                  return (
                    <div
                      key={task.id}
                      className="p-3 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg flex items-start justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.status === 'Completed'}
                          onChange={() => onToggleTask && onToggleTask(task.id)}
                          aria-label={`Mark ${task.title} complete`}
                          className="mt-1 accent-[#0B1426] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0B1426] leading-snug">
                            {task.title}
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 u360-table-numeric ${
                              isOverdue ? 'text-[#B91C1C] font-semibold' : 'text-[#64748B]'
                            }`}
                          >
                            {task.dueDate ? `Due ${task.dueDate}` : 'No due date'} • {task.category}
                          </p>
                        </div>
                      </div>
                      <StatusBadge
                        label={task.priority}
                        tone={
                          task.priority === 'High'
                            ? 'danger'
                            : task.priority === 'Medium'
                              ? 'gold'
                              : 'neutral'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('work')}
            className="w-full py-2 bg-white hover:bg-[#F6F5F1] text-[#0B1426] text-xs font-semibold rounded-lg text-center border border-[#E2DFD7] transition-colors cursor-pointer"
          >
            Open calendar &amp; tasks
          </button>
        </section>

        {/* Column 3: Matters Needing Attention & Notifications */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-2xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-[#C49A36] shrink-0" />
                <h3 className="text-sm font-semibold text-[#0B1426] truncate">
                  Matters needing attention
                </h3>
              </div>

              {notifications.length > 0 && (
                <div className="flex items-center gap-1 bg-[#F6F5F1] p-0.5 rounded-lg border border-[#E2DFD7] text-[11px] font-medium shrink-0">
                  <button
                    type="button"
                    onClick={() => setNotificationFilter('attention')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      notificationFilter === 'attention'
                        ? 'bg-[#0B1426] text-white'
                        : 'text-[#475569]'
                    }`}
                  >
                    Matters ({mattersNeedingAttention.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationFilter('all')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      notificationFilter === 'all' ? 'bg-[#0B1426] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Alerts ({unreadNotifications.length})
                  </button>
                </div>
              )}
            </div>

            {notificationFilter === 'all' && notifications.length > 0 ? (
              <div className="space-y-2.5">
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#0B1426]">{n.title}</span>
                      <span className="text-[#64748B]">{n.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#475569] line-clamp-2">{n.body}</p>
                    {!n.isRead && onMarkNotificationAsRead && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationAsRead(n.id)}
                        className="text-[11px] font-semibold text-[#0B1426] hover:underline cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
                {unreadNotifications.length > 0 && onMarkAllNotificationsAsRead && (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsAsRead}
                    className="text-xs font-semibold text-[#C49A36] hover:underline cursor-pointer"
                  >
                    Mark all alerts read
                  </button>
                )}
              </div>
            ) : mattersNeedingAttention.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Bell className="w-7 h-7 text-[#64748B] mx-auto" />
                <p className="text-xs text-[#64748B]">
                  All active matters are on schedule with no overdue tasks.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {mattersNeedingAttention.map(({ matter, severity, reason }) => (
                  <div
                    key={matter.id}
                    onClick={() => {
                      if (setSelectedCaseId) setSelectedCaseId(matter.id);
                      onNavigateTab(`matters/${matter.id}/overview`);
                    }}
                    className="p-3.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-1.5 hover:border-[#0B1426]/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge
                        label={matter.status}
                        tone={severity === 'warning' ? 'warning' : 'navy'}
                      />
                      <span className="text-[11px] text-[#64748B] u360-table-numeric">
                        {matter.caseNumber || 'Matter file'}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-[#0B1426] line-clamp-1">
                      {matter.title}
                    </h4>
                    <p className="text-xs text-[#475569]">{reason}</p>
                    <div className="pt-1 flex items-center justify-end text-xs font-semibold text-[#0B1426]">
                      <span>Inspect matter</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('matters')}
            className="w-full py-2 bg-white hover:bg-[#F6F5F1] text-[#0B1426] text-xs font-semibold rounded-lg text-center border border-[#E2DFD7] transition-colors cursor-pointer"
          >
            View all matters
          </button>
        </section>
      </div>
    </div>
  );
};
