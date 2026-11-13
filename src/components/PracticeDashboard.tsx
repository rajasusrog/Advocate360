import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Briefcase,
  AlertTriangle,
  Plus,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Check,
  Download,
  Archive,
  ArchiveRestore,
  RotateCcw,
  Sliders,
  GitBranch,
  Lock,
  Unlock,
  X,
  Search,
  MapPin,
} from 'lucide-react';
import {
  CaseFile,
  CalendarEvent,
  PracticeTask,
  FeeRecord,
  NotificationItem,
  ArchivePolicySettings,
  DeadlineAlert,
} from '../types';
import { logAuditEvent } from '../lib/auditLogger';
import { DailyBriefing } from './DailyBriefing';
import { downloadICS } from '../lib/calendarExport';
import { fetchCaseQuickSummaries, fetchProactiveDeadlineAlerts } from '../lib/api';
import {
  getStoredArchivePolicy,
  saveStoredArchivePolicy,
  runInactivityArchiveSweep,
  restoreCaseFromArchive,
  getCaseInactivityDays,
} from '../lib/archiveWorkflow';
import { TaskDependencyDAG } from './TaskDependencyDAG';
import { SAMPLE_DEADLINE_ALERTS } from '../data/landingDemoData';
import { PageHeader } from './ui/PageHeader';
import { StatusBadge } from './ui/StatusBadge';
import { EmptyState } from './ui/EmptyState';

interface PracticeDashboardProps {
  cases: CaseFile[];
  chamberId?: string;
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  feeRecords: FeeRecord[];
  notifications?: NotificationItem[];
  onNavigateTab: (tab: string) => void;
  onOpenNewCaseModal: () => void;
  onOpenScheduleHearing?: (matterId?: string) => void;
  onToggleTask?: (taskId: string) => Promise<void> | void;
  onCreateTask?: (task: Omit<PracticeTask, 'id'> & { id?: string }) => Promise<PracticeTask | void> | void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onUpdateCases?: (newCases: CaseFile[]) => Promise<void> | void;
  onUpdateTasks?: (newTasks: PracticeTask[]) => Promise<void> | void;
  initialTaskViewMode?: 'list' | 'dag';
  viewMode?: 'today' | 'matters' | 'work';
  isDemoMode?: boolean;
  onAddCaseFromIntake?: (intake: any) => void;
}

export const PracticeDashboard: React.FC<PracticeDashboardProps> = ({
  cases,
  chamberId,
  selectedCaseId,
  setSelectedCaseId,
  calendarEvents,
  tasks,
  notifications = [],
  onNavigateTab,
  onOpenNewCaseModal,
  onOpenScheduleHearing,
  onToggleTask,
  onCreateTask,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onUpdateCases,
  onUpdateTasks,
  initialTaskViewMode = 'list',
  viewMode = 'today',
  isDemoMode = false,
}) => {
  const navigate = useNavigate();
  const [showQuickSummary, setShowQuickSummary] = useState<boolean>(false);
  const [quickSummaries, setQuickSummaries] = useState<Record<string, string>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState<boolean>(false);

  // Search & Filter states for Matters list
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');

  // Inactivity Archive Workflow state
  const [pipelineTab, setPipelineTab] = useState<'active' | 'archived'>('active');
  const [archivePolicy, setArchivePolicy] = useState<ArchivePolicySettings>(() =>
    getStoredArchivePolicy()
  );
  const [isPolicyPopoverOpen, setIsPolicyPopoverOpen] = useState<boolean>(false);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);

  // Proactive Deadline Alert Service & Task Dependencies state (No sample leakage in live mode)
  const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>(
    isDemoMode ? SAMPLE_DEADLINE_ALERTS : []
  );
  const [alertSummary, setAlertSummary] = useState<string>(
    'Scan tasks and court dates to detect scheduling collisions and recommended buffer days.'
  );
  const [overallHealthScore, setOverallHealthScore] = useState<number>(100);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(false);
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'dag'>(initialTaskViewMode);
  const [isAddDepModalOpen, setIsAddDepModalOpen] = useState<boolean>(false);
  const [depSourceId, setDepSourceId] = useState<string>('');
  const [depTargetId, setDepTargetId] = useState<string>('');
  const [depError, setDepError] = useState<string | null>(null);

  // New Task Creation Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskCaseId, setNewTaskCaseId] = useState<string>(selectedCaseId || '');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [newTaskPriority, setNewTaskPriority] = useState<PracticeTask['priority']>('High');
  const [newTaskCategory, setNewTaskCategory] = useState<PracticeTask['category']>('Drafting');
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);

  useEffect(() => {
    setDeadlineAlerts(isDemoMode ? SAMPLE_DEADLINE_ALERTS : []);
  }, [isDemoMode]);

  useEffect(() => {
    setTaskViewMode(initialTaskViewMode);
  }, [initialTaskViewMode]);

  const activeCases = cases.filter((c) => c.status !== 'Archived');
  const archivedCases = cases.filter((c) => c.status === 'Archived');

  const uniqueTypes = Array.from(new Set(cases.map((c) => c.caseType).filter(Boolean)));
  const uniqueStages = Array.from(new Set(cases.map((c) => c.status).filter(Boolean)));

  const basePipelineCases = pipelineTab === 'active' ? activeCases : archivedCases;
  const filteredCases = basePipelineCases.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      (c.clientName || '').toLowerCase().includes(q) ||
      (c.caseNumber || '').toLowerCase().includes(q) ||
      (c.courtName || '').toLowerCase().includes(q);
    const matchesType = filterType === 'all' || c.caseType === filterType;
    const matchesStage = filterStage === 'all' || c.status === filterStage;
    return matchesSearch && matchesType && matchesStage;
  });

  const triggerInactivitySweep = (customPolicy?: ArchivePolicySettings) => {
    const policyToUse = customPolicy || archivePolicy;
    const sweep = runInactivityArchiveSweep(cases, policyToUse);
    if (onUpdateCases) {
      onUpdateCases(sweep.updatedCases);
    }
    if (sweep.count > 0) {
      setArchiveToast(
        `Archived ${sweep.count} inactive matter${sweep.count > 1 ? 's' : ''} (${sweep.archivedCases
          .map((c) => c.caseNumber || c.title)
          .join(', ')}).`
      );
    } else {
      setArchiveToast(
        `Inactivity check complete: no matters exceeded ${policyToUse.inactivityDays} days.`
      );
    }
    setTimeout(() => setArchiveToast(null), 5000);
  };

  const handleRestoreCase = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    if (!onUpdateCases) return;
    const res = restoreCaseFromArchive(caseId, cases);
    onUpdateCases(res.updatedCases);
    if (res.restoredCase) {
      setSelectedCaseId(caseId);
      setArchiveToast(`Restored "${res.restoredCase.title}" to active matters.`);
      setTimeout(() => setArchiveToast(null), 4500);
    }
  };

  const handleUpdatePolicy = (newPolicy: Partial<ArchivePolicySettings>) => {
    const updated = { ...archivePolicy, ...newPolicy, lastSweepRun: new Date().toISOString() };
    setArchivePolicy(updated);
    saveStoredArchivePolicy(updated);
    if (updated.enabled) {
      triggerInactivitySweep(updated);
    }
  };

  const loadProactiveDeadlineAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const activeChamberId = chamberId || cases[0]?.chamberId;
      const res = await fetchProactiveDeadlineAlerts(tasks, calendarEvents, activeChamberId);
      if (res) {
        setDeadlineAlerts(res.alerts || []);
        setAlertSummary(res.summary || 'Deadline scan completed.');
        setOverallHealthScore(res.overallHealthScore || 90);
        setArchiveToast(
          `Deadline scan complete: ${res.alerts?.length || 0} buffer recommendation(s).`
        );
        setTimeout(() => setArchiveToast(null), 4000);
        logAuditEvent(
          'AI_GENERATION',
          `Scanned ${tasks.length} tasks and ${calendarEvents.length} hearings for buffer alerts`
        );
      }
    } catch (err) {
      console.error('Failed to load proactive deadline alerts:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const handleApplyBuffer = async (
    taskId: string,
    suggestedBufferDays: number,
    recommendedDate: string
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          dueDate: recommendedDate,
          suggestedBufferDays,
          bufferAlertReason: `Applied +${suggestedBufferDays}d buffer. Adjusted deadline from ${t.dueDate} to ${recommendedDate}.`,
        };
      }
      return t;
    });

    try {
      if (onUpdateTasks) {
        await onUpdateTasks(updatedTasks);
      }
      setDeadlineAlerts((prev) => prev.filter((a) => a.taskId !== taskId));
      setArchiveToast(
        `Applied +${suggestedBufferDays} buffer days to "${task.title}". New due date: ${recommendedDate}.`
      );
      logAuditEvent(
        'CASE_UPDATE',
        `Applied +${suggestedBufferDays} deadline buffer to task: "${task.title}"`
      );
      setTimeout(() => setArchiveToast(null), 5000);
    } catch {
      // Error surfaced via parent banner
    }
  };

  const handleToggleTaskItem = async (taskId: string) => {
    try {
      if (onToggleTask) {
        await onToggleTask(taskId);
      } else if (onUpdateTasks) {
        await onUpdateTasks(
          tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' }
              : t
          )
        );
      }
    } catch {
      // Error surfaced via parent banner
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewTaskError(null);
    if (!newTaskTitle.trim()) {
      setNewTaskError('Task title is required.');
      return;
    }

    const payload: Omit<PracticeTask, 'id'> = {
      title: newTaskTitle.trim(),
      caseId: newTaskCaseId || selectedCaseId || cases[0]?.id || '',
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      priority: newTaskPriority,
      status: 'Pending',
      category: newTaskCategory,
    };

    setIsSavingTask(true);
    try {
      if (onCreateTask) {
        await onCreateTask(payload);
      } else if (onUpdateTasks) {
        await onUpdateTasks([{ id: `task-${Date.now()}`, ...payload }, ...tasks]);
      }
      setNewTaskTitle('');
      setIsNewTaskModalOpen(false);
      setArchiveToast(`Saved task "${payload.title}".`);
      setTimeout(() => setArchiveToast(null), 4000);
    } catch (err: any) {
      // Preserve form input when save fails
      setNewTaskError(
        err?.message || 'Failed to save task. Your entered details have been preserved.'
      );
    } finally {
      setIsSavingTask(false);
    }
  };

  const hasTransitiveDependency = (
    startTaskId: string,
    targetTaskId: string,
    allTasks: PracticeTask[],
    visited = new Set<string>()
  ): boolean => {
    if (startTaskId === targetTaskId) return true;
    if (visited.has(startTaskId)) return false;
    visited.add(startTaskId);

    const startTask = allTasks.find((t) => t.id === startTaskId);
    if (!startTask || !startTask.dependsOn) return false;

    for (const depId of startTask.dependsOn) {
      if (hasTransitiveDependency(depId, targetTaskId, allTasks, visited)) {
        return true;
      }
    }
    return false;
  };

  const handleSaveDependency = () => {
    setDepError(null);
    if (!depSourceId || !depTargetId) {
      setDepError('Please select both a prerequisite and a dependent task.');
      return;
    }
    if (depSourceId === depTargetId) {
      setDepError('A task cannot depend on itself.');
      return;
    }

    const sourceTask = tasks.find((t) => t.id === depSourceId);
    const targetTask = tasks.find((t) => t.id === depTargetId);

    if (hasTransitiveDependency(depSourceId, depTargetId, tasks)) {
      setDepError(
        `Circular dependency detected between "${sourceTask?.title}" and "${targetTask?.title}".`
      );
      return;
    }

    if (onUpdateTasks) {
      const updated = tasks.map((t) => {
        if (t.id === depTargetId) {
          const existing = t.dependsOn || [];
          if (!existing.includes(depSourceId)) {
            return { ...t, dependsOn: [...existing, depSourceId] };
          }
        }
        return t;
      });
      onUpdateTasks(updated);
      logAuditEvent(
        'CASE_UPDATE',
        `Linked task dependency: "${sourceTask?.title}" → "${targetTask?.title}"`
      );
      setArchiveToast(`Linked dependency: "${sourceTask?.title}" → "${targetTask?.title}"`);
      setTimeout(() => setArchiveToast(null), 4000);
    }

    setIsAddDepModalOpen(false);
    setDepSourceId('');
    setDepTargetId('');
  };

  const loadQuickSummaries = async () => {
    setIsLoadingSummaries(true);
    try {
      const activeChamberId = chamberId || cases[0]?.chamberId;
      const summariesMap = await fetchCaseQuickSummaries(cases, activeChamberId);
      setQuickSummaries(summariesMap);
      logAuditEvent('AI_GENERATION', `Generated one-sentence summaries for ${cases.length} cases`);
    } catch (err) {
      console.error('Failed to load quick summaries:', err);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  const handleToggleQuickSummary = () => {
    const nextState = !showQuickSummary;
    setShowQuickSummary(nextState);
    if (nextState && Object.keys(quickSummaries).length === 0 && cases.length > 0) {
      loadQuickSummaries();
    }
  };

  useEffect(() => {
    if (archivePolicy.enabled && cases.length > 0) {
      const sweep = runInactivityArchiveSweep(cases, archivePolicy);
      if (sweep.count > 0 && onUpdateCases) {
        onUpdateCases(sweep.updatedCases);
      }
    }
  }, []);

  const openCreateTaskDialog = () => {
    setNewTaskError(null);
    setNewTaskCaseId(selectedCaseId || cases[0]?.id || '');
    setIsNewTaskModalOpen(true);
  };

  // Shared Modals Renderer
  const renderModals = () => (
    <>
      {isAddDepModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1426]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2DFD7] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C49A36]">
                  Task Precedence
                </p>
                <h3 className="text-lg font-bold text-[#0B1426]">Link task dependency</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F6F5F1] text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              Require the prerequisite task to be completed before the dependent task can begin.
            </p>

            {depError && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#B91C1C] text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{depError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  1. Prerequisite task (must complete first)
                </label>
                <select
                  value={depSourceId}
                  onChange={(e) => setDepSourceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
                >
                  <option value="">Select prerequisite task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category} • Due {t.dueDate || 'TBD'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  2. Dependent task (blocked until prerequisite completes)
                </label>
                <select
                  value={depTargetId}
                  onChange={(e) => setDepTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
                >
                  <option value="">Select dependent task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category} • Due {t.dueDate || 'TBD'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2DFD7] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#E2DFD7] hover:bg-[#F6F5F1] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDependency}
                className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#C49A36]" />
                <span>Save dependency</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1426]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2DFD7] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C49A36]">
                  Chamber Task
                </p>
                <h3 className="text-lg font-bold text-[#0B1426]">Add task</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F6F5F1] text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newTaskError && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#B91C1C] text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{newTaskError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTaskSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Task title <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. File Written Statement & Affidavit"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as PracticeTask['priority'])}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as PracticeTask['category'])}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  >
                    <option value="Drafting">Drafting</option>
                    <option value="Filing">Filing</option>
                    <option value="Research">Research</option>
                    <option value="Client Follow-up">Client Follow-up</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                    Matter
                  </label>
                  <select
                    value={newTaskCaseId}
                    onChange={(e) => setNewTaskCaseId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  >
                    <option value="">General chamber task</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2DFD7] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E2DFD7] hover:bg-[#F6F5F1] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTask}
                  className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-[#C49A36]" />
                  <span>{isSavingTask ? 'Saving...' : 'Save task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  // Toast Strip
  const renderToast = () =>
    archiveToast ? (
      <div className="p-3 bg-[#FFFBEB] border border-[#F59E0B]/40 rounded-xl text-[#0B1426] text-xs flex items-center justify-between shadow-2xs">
        <span className="font-medium">{archiveToast}</span>
        <button
          type="button"
          onClick={() => setArchiveToast(null)}
          className="text-xs font-semibold text-[#475569] hover:text-[#0B1426] px-2 cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    ) : null;

  // Empty chamber state (when zero matters exist on Today or Matters)
  if (cases.length === 0 && viewMode !== 'work') {
    return (
      <div className="space-y-6">
        <PageHeader
          title={viewMode === 'matters' ? 'Matters' : 'Today'}
          subtitle={
            viewMode === 'matters'
              ? 'Manage chamber case files, court filings, and active proceedings.'
              : 'Upcoming hearings, due tasks, and matters needing attention.'
          }
          actions={
            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-[#C49A36]" />
              <span>Add matter</span>
            </button>
          }
        />

        <EmptyState
          icon={<Briefcase className="w-7 h-7" />}
          title="No matters in this chamber yet"
          description="Create your first matter record with client details, opposing party, and court forum to unlock hearing schedules, tasks, documents, and billing."
          action={
            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="px-5 py-2.5 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C49A36]" />
              <span>Add matter</span>
            </button>
          }
        />

        {renderModals()}
      </div>
    );
  }

  // VIEW MODE 1: TODAY (/app/today)
  if (viewMode === 'today') {
    return (
      <div className="space-y-6 text-[#0B1426]">
        <PageHeader
          title="Today"
          subtitle={`${activeCases.length} active matter${activeCases.length === 1 ? '' : 's'} • ${calendarEvents.length} scheduled hearing${calendarEvents.length === 1 ? '' : 's'} • ${tasks.filter((t) => t.status !== 'Completed').length} pending task${tasks.filter((t) => t.status !== 'Completed').length === 1 ? '' : 's'}`}
          actions={
            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-[#C49A36]" />
              <span>Add matter</span>
            </button>
          }
        />

        {renderToast()}

        <DailyBriefing
          cases={cases}
          calendarEvents={calendarEvents}
          tasks={tasks}
          notifications={notifications}
          onNavigateTab={onNavigateTab}
          setSelectedCaseId={setSelectedCaseId}
          onToggleTask={handleToggleTaskItem}
          onMarkNotificationAsRead={onMarkNotificationAsRead}
          onMarkAllNotificationsAsRead={onMarkAllNotificationsAsRead}
          onOpenScheduleHearing={onOpenScheduleHearing}
          onOpenNewTaskModal={openCreateTaskDialog}
        />

        {/* Quick Jump to Active Matters */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-3 border-b border-[#E2DFD7] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0B1426]">Active matters</h2>
              <p className="text-xs text-[#64748B]">
                Open any matter to inspect hearings, documents, tasks, and billing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/matters')}
              className="text-xs font-semibold text-[#0B1426] hover:text-[#C49A36] flex items-center gap-1 cursor-pointer"
            >
              <span>View all matters</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCases.slice(0, 6).map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCaseId(c.id);
                  navigate(`/app/matters/${c.id}/overview`);
                }}
                className="p-4 bg-[#F6F5F1] border border-[#E2DFD7] hover:border-[#0B1426]/40 rounded-xl space-y-2.5 cursor-pointer transition-colors flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge label={c.status} tone="navy" />
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {c.caseNumber || 'Matter file'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-[#0B1426] line-clamp-1">{c.title}</h3>
                  <p className="text-xs text-[#475569] line-clamp-1">
                    Client: {c.clientName} • {c.courtName}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E2DFD7] flex items-center justify-between text-xs">
                  <span className="text-[#64748B] u360-table-numeric">
                    Next hearing: {c.nextHearingDate || 'Not scheduled'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#0B1426]" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Compact Schedule Buffer Scanner */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C49A36]">
                  Schedule Audit
                </span>
                {deadlineAlerts.length > 0 && (
                  <StatusBadge
                    label={`${deadlineAlerts.length} buffer alert${deadlineAlerts.length === 1 ? '' : 's'}`}
                    tone="warning"
                  />
                )}
              </div>
              <h2 className="text-sm font-semibold text-[#0B1426]">
                Deadline &amp; Hearing Buffer Check ({overallHealthScore}% health)
              </h2>
              <p className="text-xs text-[#64748B]">{alertSummary}</p>
            </div>

            <button
              type="button"
              onClick={loadProactiveDeadlineAlerts}
              disabled={isLoadingAlerts}
              className="px-3.5 py-2 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Sparkles
                className={`w-3.5 h-3.5 text-[#C49A36] ${isLoadingAlerts ? 'animate-spin' : ''}`}
              />
              <span>{isLoadingAlerts ? 'Scanning...' : 'Scan deadlines'}</span>
            </button>
          </div>

          {deadlineAlerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {deadlineAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-[#F6F5F1] border border-[#E2DFD7] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge
                      label={`${alert.severity} RISK`}
                      tone={alert.severity === 'CRITICAL' ? 'danger' : 'warning'}
                    />
                    <span className="text-[11px] font-semibold text-[#0B1426]">
                      +{alert.suggestedBufferDays}d buffer
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#0B1426]">{alert.taskTitle}</p>
                  <p className="text-xs text-[#475569]">{alert.reasoning}</p>
                  <div className="pt-2 border-t border-[#E2DFD7] flex items-center justify-between text-xs">
                    <span className="text-[#64748B] u360-table-numeric">
                      {alert.currentDeadline} → {alert.recommendedDeadline}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyBuffer(
                          alert.taskId,
                          alert.suggestedBufferDays,
                          alert.recommendedDeadline
                        )
                      }
                      className="px-3 py-1 bg-[#0B1426] text-white rounded-md text-[11px] font-semibold cursor-pointer"
                    >
                      Apply buffer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {renderModals()}
      </div>
    );
  }

  // VIEW MODE 2: MATTERS (/app/matters) — Search and filters placed cleanly above the list
  if (viewMode === 'matters') {
    return (
      <div className="space-y-5 text-[#0B1426]">
        <PageHeader
          title="Matters"
          subtitle={`${activeCases.length} active • ${archivedCases.length} archived`}
          actions={
            <button
              type="button"
              onClick={onOpenNewCaseModal}
              className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-[#C49A36]" />
              <span>Add matter</span>
            </button>
          }
        />

        {renderToast()}

        {/* Search & Filters Directly Above Matter List */}
        <div className="bg-white border border-[#E2DFD7] rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, client, case number, or court..."
                className="w-full pl-9 pr-3 py-2 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg text-sm text-[#0B1426] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#0B1426]"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-[#F6F5F1] p-0.5 rounded-lg border border-[#E2DFD7] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPipelineTab('active')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    pipelineTab === 'active'
                      ? 'bg-[#0B1426] text-white'
                      : 'text-[#475569] hover:text-[#0B1426]'
                  }`}
                >
                  Active ({activeCases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineTab('archived')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    pipelineTab === 'archived'
                      ? 'bg-[#0B1426] text-white'
                      : 'text-[#475569] hover:text-[#0B1426]'
                  }`}
                >
                  Archived ({archivedCases.length})
                </button>
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label="Filter by case category"
                className="px-3 py-2 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg text-xs font-medium text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
              >
                <option value="all">All categories</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                aria-label="Filter by stage"
                className="px-3 py-2 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg text-xs font-medium text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
              >
                <option value="all">All stages</option>
                {uniqueStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>

              {/* Auto-Archive Policy Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPolicyPopoverOpen(!isPolicyPopoverOpen)}
                  className="px-3 py-2 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#C49A36]" />
                  <span>Auto-archive: {archivePolicy.enabled ? `${archivePolicy.inactivityDays}d` : 'Off'}</span>
                </button>

                {isPolicyPopoverOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E2DFD7] rounded-xl shadow-xl z-40 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-2">
                      <span className="font-semibold text-[#0B1426]">Inactivity Archive Policy</span>
                      <button
                        type="button"
                        onClick={() => setIsPolicyPopoverOpen(false)}
                        className="text-[#64748B] hover:text-[#0B1426] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[#475569] leading-relaxed">
                      Move dormant matters to Archived after inactivity without updates.
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[30, 60, 90, 180].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => handleUpdatePolicy({ inactivityDays: days, enabled: true })}
                          className={`py-1.5 rounded-md font-semibold border cursor-pointer ${
                            archivePolicy.inactivityDays === days && archivePolicy.enabled
                              ? 'bg-[#0B1426] text-white border-[#0B1426]'
                              : 'bg-[#F6F5F1] text-[#0B1426] border-[#E2DFD7]'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        triggerInactivitySweep();
                        setIsPolicyPopoverOpen(false);
                      }}
                      className="w-full py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#C49A36]" />
                      <span>Run inactivity sweep</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleQuickSummary}
                className={`px-3 py-2 border rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showQuickSummary
                    ? 'bg-[#0B1426] text-white border-[#0B1426]'
                    : 'bg-[#F6F5F1] text-[#0B1426] border-[#E2DFD7] hover:bg-[#EFECE4]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C49A36]" />
                <span>AI Summaries</span>
              </button>
            </div>
          </div>
        </div>

        {/* Matter List */}
        {filteredCases.length === 0 ? (
          <EmptyState
            icon={<Archive className="w-7 h-7" />}
            title={
              searchQuery || filterType !== 'all' || filterStage !== 'all'
                ? 'No matters match these filters'
                : pipelineTab === 'active'
                  ? 'No active matters'
                  : 'No archived matters'
            }
            description="Try adjusting your search or filter criteria, or add a new matter."
            action={
              searchQuery || filterType !== 'all' || filterStage !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterStage('all');
                  }}
                  className="px-4 py-2 bg-white border border-[#E2DFD7] hover:bg-[#F6F5F1] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenNewCaseModal}
                  className="px-4 py-2 bg-[#0B1426] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Add matter
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCases.map((c) => {
              const isSelected = c.id === selectedCaseId;
              const isArchived = c.status === 'Archived';
              const inactivityDays = getCaseInactivityDays(c);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCaseId(c.id);
                    if (!isArchived) {
                      navigate(`/app/matters/${c.id}/overview`);
                    }
                  }}
                  className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between shadow-2xs ${
                    isArchived
                      ? 'bg-[#F6F5F1] border-[#CBD5E1] text-[#0B1426]'
                      : isSelected
                        ? 'bg-white border-[#0B1426] ring-1 ring-[#C49A36]'
                        : 'bg-white border-[#E2DFD7] hover:border-[#0B1426]/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge label={c.caseType} tone="navy" />
                        <StatusBadge
                          label={isArchived ? `Archived (${inactivityDays}d)` : c.status}
                          tone={isArchived ? 'warning' : 'gold'}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                        {c.caseNumber || 'No ref'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base text-[#0B1426] line-clamp-1">
                        {c.title}
                      </h3>
                      <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">
                        {c.courtName}
                      </p>
                    </div>

                    {showQuickSummary ? (
                      <div className="p-3 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] text-xs text-[#0B1426]">
                        {isLoadingSummaries && !quickSummaries[c.id]
                          ? 'Generating summary...'
                          : quickSummaries[c.id] || c.summary}
                      </div>
                    ) : (
                      <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed">
                        {c.summary || 'No summary recorded yet.'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-3 mt-4 border-t border-[#E2DFD7] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Client</span>
                      <span className="font-medium text-[#0B1426] truncate max-w-[180px]">
                        {c.clientName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">
                        {isArchived ? 'Last active' : 'Next hearing'}
                      </span>
                      <span className="u360-table-numeric font-medium text-[#0B1426]">
                        {isArchived
                          ? c.lastActivityDate || c.updatedAt
                          : c.nextHearingDate || 'Not scheduled'}
                      </span>
                    </div>

                    <div className="pt-1 flex justify-end">
                      {isArchived ? (
                        <button
                          type="button"
                          onClick={(e) => handleRestoreCase(e, c.id)}
                          className="px-3 py-1.5 bg-[#0B1426] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 text-[#C49A36]" />
                          <span>Restore matter</span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-[#0B1426] flex items-center gap-1">
                          <span>Open matter</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#C49A36]" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {renderModals()}
      </div>
    );
  }

  // VIEW MODE 3: WORK / TASKS & HEARINGS (/app/work and /app/matters/:matterId/work)
  return (
    <div className="space-y-6 text-[#0B1426]">
      <PageHeader
        title="Tasks & Hearings"
        subtitle={`${calendarEvents.length} scheduled hearing${calendarEvents.length === 1 ? '' : 's'} • ${tasks.filter((t) => t.status === 'Completed').length} of ${tasks.length} tasks completed`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateTaskDialog}
              className="px-3.5 py-2 bg-white hover:bg-[#F6F5F1] text-[#0B1426] border border-[#E2DFD7] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#0B1426]" />
              <span>Add task</span>
            </button>
            <button
              type="button"
              onClick={() => setTaskViewMode(taskViewMode === 'dag' ? 'list' : 'dag')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                taskViewMode === 'dag'
                  ? 'bg-[#C49A36] text-[#0B1426] border-[#C49A36]'
                  : 'bg-white hover:bg-[#F6F5F1] text-[#0B1426] border-[#E2DFD7]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{taskViewMode === 'dag' ? 'List view' : 'Dependencies DAG'}</span>
            </button>
            {onOpenScheduleHearing && (
              <button
                type="button"
                onClick={() => onOpenScheduleHearing(selectedCaseId || cases[0]?.id)}
                className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#C49A36]" />
                <span>Schedule hearing</span>
              </button>
            )}
          </div>
        }
      />

      {renderToast()}

      {taskViewMode === 'dag' && (
        <TaskDependencyDAG
          tasks={tasks}
          cases={cases}
          selectedCaseId={selectedCaseId}
          onUpdateTasks={onUpdateTasks || (() => {})}
          deadlineAlerts={deadlineAlerts}
          onApplyBuffer={handleApplyBuffer}
          onClose={() => setTaskViewMode('list')}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Hearings Panel */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
            <h2 className="text-sm font-semibold text-[#0B1426] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C49A36]" />
              <span>Scheduled hearings ({calendarEvents.length})</span>
            </h2>
            {calendarEvents.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadICS(calendarEvents, 'Advocate360_CauseList.ics', 'Chamber Court Hearings')
                }
                className="px-2.5 py-1 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] rounded-lg text-xs font-medium text-[#0B1426] flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .ICS</span>
              </button>
            )}
          </div>

          {calendarEvents.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Calendar className="w-7 h-7 text-[#64748B] mx-auto" />
              <p className="text-xs text-[#64748B]">No hearings scheduled yet.</p>
              {onOpenScheduleHearing && cases.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenScheduleHearing(selectedCaseId || cases[0]?.id)}
                  className="px-4 py-2 bg-[#0B1426] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C49A36]" />
                  <span>Schedule hearing</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {calendarEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 bg-[#F6F5F1] border border-[#E2DFD7] rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#0B1426] u360-table-numeric">
                        {evt.date} • {evt.time}
                      </span>
                      <StatusBadge label={evt.hearingType} tone="gold" />
                    </div>
                    <h3 className="font-semibold text-sm text-[#0B1426] truncate">
                      {evt.caseTitle}
                    </h3>
                    <p className="text-xs text-[#475569] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#C49A36] shrink-0" />
                      <span>{evt.court}</span>
                    </p>
                    {evt.notes && <p className="text-xs text-[#64748B] pt-1">{evt.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadICS([evt], `Hearing_${evt.caseId}.ics`, evt.caseTitle)}
                    className="px-2.5 py-1 bg-white hover:bg-[#EFECE4] border border-[#E2DFD7] rounded-lg text-[11px] font-medium text-[#0B1426] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>.ICS</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tasks Pipeline Panel */}
        <section className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
            <h2 className="text-sm font-semibold text-[#0B1426] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C49A36]" />
              <span>Tasks ({tasks.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(true)}
                className="px-2.5 py-1 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] rounded-lg text-xs font-medium text-[#0B1426] cursor-pointer"
              >
                Link dependency
              </button>
              <button
                type="button"
                onClick={openCreateTaskDialog}
                className="px-2.5 py-1 bg-[#0B1426] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#C49A36]" />
                <span>Add task</span>
              </button>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <ShieldCheck className="w-7 h-7 text-[#64748B] mx-auto" />
              <p className="text-xs text-[#64748B]">No preparation tasks added yet.</p>
              <button
                type="button"
                onClick={openCreateTaskDialog}
                className="px-4 py-2 bg-[#0B1426] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C49A36]" />
                <span>Add task</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {tasks.map((task) => {
                const isDone = task.status === 'Completed';
                const prereqTasks = (task.dependsOn || [])
                  .map((id) => tasks.find((t) => t.id === id))
                  .filter((p): p is PracticeTask => !!p);
                const blockingPrereqs = prereqTasks.filter((p) => p.status !== 'Completed');
                const isBlocked = blockingPrereqs.length > 0 && !isDone;

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDone
                        ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                        : isBlocked
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : 'bg-[#F6F5F1] border-[#E2DFD7]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTaskItem(task.id)}
                          className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            isDone
                              ? 'bg-[#15803D] border-[#15803D] text-white'
                              : 'bg-white border-[#CBD5E1] hover:border-[#0B1426]'
                          }`}
                          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                        <div className="min-w-0">
                          <h4
                            className={`text-xs font-semibold leading-snug ${
                              isDone ? 'line-through text-[#64748B]' : 'text-[#0B1426]'
                            }`}
                          >
                            {task.title}
                          </h4>
                          <p className="text-[11px] text-[#64748B] mt-0.5 u360-table-numeric">
                            {task.category} • Due {task.dueDate || 'TBD'}
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

                    {isBlocked && (
                      <div className="p-2 rounded-lg bg-white/80 border border-[#FECACA] text-[#B91C1C] text-[11px] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Blocked by: {blockingPrereqs.map((p) => p.title).join(', ')}
                        </span>
                      </div>
                    )}

                    {!isBlocked && !isDone && prereqTasks.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] flex items-center gap-1.5">
                        <Unlock className="w-3.5 h-3.5 shrink-0" />
                        <span>Prerequisites complete</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {renderModals()}
    </div>
  );
};
