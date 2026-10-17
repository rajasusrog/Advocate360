import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Download,
  Archive,
  ArchiveRestore,
  RotateCcw,
  Sliders,
  History,
  AlertCircle,
  GitBranch,
  Lock,
  Unlock,
  Layers,
  X,
  Trash2
} from 'lucide-react';
import { CaseFile, CalendarEvent, PracticeTask, FeeRecord, NotificationItem, ArchivePolicySettings, DeadlineAlert } from '../types';
import { logAuditEvent } from '../lib/auditLogger';
import { DailyBriefing } from './DailyBriefing';
import { downloadICS } from '../lib/calendarExport';
import { fetchCaseQuickSummaries, fetchProactiveDeadlineAlerts } from '../lib/api';
import { 
  getStoredArchivePolicy, 
  saveStoredArchivePolicy, 
  runInactivityArchiveSweep, 
  restoreCaseFromArchive, 
  getCaseInactivityDays 
} from '../lib/archiveWorkflow';
import { TaskDependencyDAG } from './TaskDependencyDAG';
import { SAMPLE_DEADLINE_ALERTS } from '../data/landingDemoData';

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
  onToggleTask?: (taskId: string) => Promise<void> | void;
  onCreateTask?: (task: Omit<PracticeTask, 'id'> & { id?: string }) => Promise<PracticeTask | void> | void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onUpdateCases?: (newCases: CaseFile[]) => Promise<void> | void;
  onUpdateTasks?: (newTasks: PracticeTask[]) => Promise<void> | void;
  initialTaskViewMode?: 'list' | 'dag';
  onAddCaseFromIntake?: (intake: any) => void;
}

export const PracticeDashboard: React.FC<PracticeDashboardProps> = ({
  cases,
  chamberId,
  selectedCaseId,
  setSelectedCaseId,
  calendarEvents,
  tasks,
  feeRecords,
  notifications = [],
  onNavigateTab,
  onOpenNewCaseModal,
  onToggleTask,
  onCreateTask,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onUpdateCases,
  onUpdateTasks,
  initialTaskViewMode = 'list'
}) => {
  const navigate = useNavigate();
  const [isCascadeRunning, setIsCascadeRunning] = useState<boolean>(false);
  const [cascadeLogs, setCascadeLogs] = useState<string[]>([]);
  const [showQuickSummary, setShowQuickSummary] = useState<boolean>(false);
  const [quickSummaries, setQuickSummaries] = useState<Record<string, string>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState<boolean>(false);

  // Inactivity Archive Workflow state
  const [pipelineTab, setPipelineTab] = useState<'active' | 'archived'>('active');
  const [archivePolicy, setArchivePolicy] = useState<ArchivePolicySettings>(() => getStoredArchivePolicy());
  const [isPolicyPopoverOpen, setIsPolicyPopoverOpen] = useState<boolean>(false);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);

  // Proactive Deadline Alert Service & Task Dependencies state
  const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>(SAMPLE_DEADLINE_ALERTS);
  const [alertSummary, setAlertSummary] = useState<string>('LLM Scan: 2 deadline collisions detected. Suggested buffer days calculated based on historical drafting durations.');
  const [overallHealthScore, setOverallHealthScore] = useState<number>(78);
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
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState<PracticeTask['priority']>('High');
  const [newTaskCategory, setNewTaskCategory] = useState<PracticeTask['category']>('Drafting');
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState<boolean>(false);

  const activeCases = cases.filter(c => c.status !== 'Archived');
  const archivedCases = cases.filter(c => c.status === 'Archived');
  const displayedCases = pipelineTab === 'active' ? activeCases : archivedCases;

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];

  const totalFee = feeRecords.reduce((acc, f) => acc + f.totalFee, 0);
  const paidFee = feeRecords.reduce((acc, f) => acc + f.paidAmount, 0);
  const pendingFee = feeRecords.reduce((acc, f) => acc + f.pendingAmount, 0);

  // Run automated inactivity sweep
  const triggerInactivitySweep = (customPolicy?: ArchivePolicySettings) => {
    const policyToUse = customPolicy || archivePolicy;
    const sweep = runInactivityArchiveSweep(cases, policyToUse);
    if (onUpdateCases) {
      onUpdateCases(sweep.updatedCases);
    }
    if (sweep.count > 0) {
      setArchiveToast(`Automated workflow archived ${sweep.count} inactive matter${sweep.count > 1 ? 's' : ''} (${sweep.archivedCases.map(c => c.caseNumber || c.title).join(', ')}) to reduce active dashboard clutter.`);
    } else {
      setArchiveToast(`Inactivity sweep complete: 0 matters exceeded the ${policyToUse.inactivityDays}-day inactivity threshold.`);
    }
    setTimeout(() => setArchiveToast(null), 5000);
  };

  // Restore archived case back to active pipeline
  const handleRestoreCase = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    if (!onUpdateCases) return;
    const res = restoreCaseFromArchive(caseId, cases);
    onUpdateCases(res.updatedCases);
    if (res.restoredCase) {
      setSelectedCaseId(caseId);
      setArchiveToast(`Restored "${res.restoredCase.title}" (${res.restoredCase.caseNumber || ''}) back to active pipeline.`);
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

  // Proactive Deadline Alert Service Scanner
  const loadProactiveDeadlineAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const activeChamberId = chamberId || cases[0]?.chamberId;
      const res = await fetchProactiveDeadlineAlerts(tasks, calendarEvents, activeChamberId);
      if (res) {
        setDeadlineAlerts(res.alerts || []);
        setAlertSummary(res.summary || 'Deadline audit completed.');
        setOverallHealthScore(res.overallHealthScore || 85);
        setArchiveToast(`Gemini scanned deadlines: ${res.alerts?.length || 0} buffer recommendation(s) generated.`);
        setTimeout(() => setArchiveToast(null), 4000);
        logAuditEvent('AI_GENERATION', `Scanned ${tasks.length} tasks and ${calendarEvents.length} calendar events with Gemini for proactive buffer recommendations`);
      }
    } catch (err) {
      console.error('Failed to load proactive deadline alerts:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  // 1-Click Apply AI Buffer Days
  const handleApplyBuffer = async (taskId: string, suggestedBufferDays: number, recommendedDate: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          dueDate: recommendedDate,
          suggestedBufferDays,
          bufferAlertReason: `Applied +${suggestedBufferDays}d AI buffer. Adjusted deadline from ${t.dueDate} to ${recommendedDate}.`
        };
      }
      return t;
    });

    try {
      if (onUpdateTasks) {
        await onUpdateTasks(updatedTasks);
      }
      setDeadlineAlerts(prev => prev.filter(a => a.taskId !== taskId));
      setArchiveToast(`Applied +${suggestedBufferDays} buffer days to "${task.title}". New deadline set to ${recommendedDate}.`);
      logAuditEvent('CASE_UPDATE', `Applied +${suggestedBufferDays} proactive deadline buffer to task: "${task.title}". New deadline: ${recommendedDate}`);
      setTimeout(() => setArchiveToast(null), 5000);
    } catch {
      // Error surfaced via parent banner
    }
  };

  // Persistent Task Status Toggle
  const handleToggleTaskItem = async (taskId: string) => {
    try {
      if (onToggleTask) {
        await onToggleTask(taskId);
      } else if (onUpdateTasks) {
        await onUpdateTasks(tasks.map(t => t.id === taskId ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' } : t));
      }
    } catch {
      // Error surfaced via parent banner
    }
  };

  // Create Persistent Task
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
      setArchiveToast(`Saved task "${payload.title}" to PostgreSQL.`);
      setTimeout(() => setArchiveToast(null), 4000);
    } catch (err: any) {
      setNewTaskError(err?.message || 'Failed to save task to PostgreSQL. Unsaved input preserved.');
    } finally {
      setIsSavingTask(false);
    }
  };

  // Transitive Cycle Prevention Helper
  const hasTransitiveDependency = (
    startTaskId: string,
    targetTaskId: string,
    allTasks: PracticeTask[],
    visited = new Set<string>()
  ): boolean => {
    if (startTaskId === targetTaskId) return true;
    if (visited.has(startTaskId)) return false;
    visited.add(startTaskId);

    const startTask = allTasks.find(t => t.id === startTaskId);
    if (!startTask || !startTask.dependsOn) return false;

    for (const depId of startTask.dependsOn) {
      if (hasTransitiveDependency(depId, targetTaskId, allTasks, visited)) {
        return true;
      }
    }
    return false;
  };

  // Save Task Dependency Edge
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

    const sourceTask = tasks.find(t => t.id === depSourceId);
    const targetTask = tasks.find(t => t.id === depTargetId);

    if (hasTransitiveDependency(depSourceId, depTargetId, tasks)) {
      setDepError(`Cannot create dependency: linking "${sourceTask?.title}" → "${targetTask?.title}" creates a circular dependency loop (violating DAG requirements).`);
      return;
    }

    if (onUpdateTasks) {
      const updated = tasks.map(t => {
        if (t.id === depTargetId) {
          const existing = t.dependsOn || [];
          if (!existing.includes(depSourceId)) {
            return { ...t, dependsOn: [...existing, depSourceId] };
          }
        }
        return t;
      });
      onUpdateTasks(updated);
      logAuditEvent('CASE_UPDATE', `Created task dependency: "${sourceTask?.title}" must complete before "${targetTask?.title}"`);
      setArchiveToast(`Linked dependency: "${sourceTask?.title}" → "${targetTask?.title}"`);
      setTimeout(() => setArchiveToast(null), 4000);
    }

    setIsAddDepModalOpen(false);
    setDepSourceId('');
    setDepTargetId('');
  };

  // Automated sweep on mount if policy is enabled
  useEffect(() => {
    if (archivePolicy.enabled) {
      const sweep = runInactivityArchiveSweep(cases, archivePolicy);
      if (sweep.count > 0 && onUpdateCases) {
        onUpdateCases(sweep.updatedCases);
        setArchiveToast(`Automated inactivity workflow archived ${sweep.count} inactive matter${sweep.count > 1 ? 's' : ''} to reduce active dashboard clutter.`);
        setTimeout(() => setArchiveToast(null), 5000);
      }
    }
  }, []);


  const loadQuickSummaries = async () => {
    setIsLoadingSummaries(true);
    try {
      const activeChamberId = chamberId || cases[0]?.chamberId;
      const summariesMap = await fetchCaseQuickSummaries(cases, activeChamberId);
      setQuickSummaries(summariesMap);
      logAuditEvent('AI_GENERATION', `Generated Gemini one-sentence status updates for ${cases.length} cases`);
    } catch (err) {
      console.error('Failed to load quick summaries:', err);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  const handleToggleQuickSummary = () => {
    const nextState = !showQuickSummary;
    setShowQuickSummary(nextState);
    if (nextState && Object.keys(quickSummaries).length === 0) {
      loadQuickSummaries();
    }
  };

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

          {/* Onboarding Checklist for Fresh Workspaces */}
          <div className="p-5 bg-white border border-[#1A1A1A] text-xs font-mono space-y-3 text-left max-w-xl mx-auto">
            <span className="font-bold text-[#B45309] uppercase tracking-wider text-[11px] block border-b border-[#1A1A1A] pb-2">
              📋 Chamber Setup & Onboarding Checklist:
            </span>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-[#F9F7F5] border border-[#1A1A1A]/30">
                <div>
                  <span className="font-bold text-[#1A1A1A] block">1. Open First Matter File</span>
                  <span className="text-[10px] text-slate-500">Record title, client name, opposite party & court</span>
                </div>
                <button onClick={onOpenNewCaseModal} className="px-2.5 py-1 bg-[#1A1A1A] text-amber-400 text-[10px] font-bold uppercase border border-[#1A1A1A]">
                  Open Matter
                </button>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#F9F7F5] border border-[#1A1A1A]/30">
                <div>
                  <span className="font-bold text-[#1A1A1A] block">2. AI Client Intake Analysis</span>
                  <span className="text-[10px] text-slate-500">Analyze unstructured story & check conflicts</span>
                </div>
                <button onClick={() => onNavigateTab('intake')} className="px-2.5 py-1 bg-[#1A1A1A] text-amber-400 text-[10px] font-bold uppercase border border-[#1A1A1A]">
                  Run Intake
                </button>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#F9F7F5] border border-[#1A1A1A]/30">
                <div>
                  <span className="font-bold text-[#1A1A1A] block">3. Configure Practice & Billing</span>
                  <span className="text-[10px] text-slate-500">Set chamber fee rates and currency</span>
                </div>
                <button onClick={() => navigate('/app/settings/firm')} className="px-2.5 py-1 bg-white text-[#1A1A1A] text-[10px] font-bold uppercase border border-[#1A1A1A]">
                  Settings
                </button>
              </div>
            </div>
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
        notifications={notifications}
        onNavigateTab={onNavigateTab}
        setSelectedCaseId={setSelectedCaseId}
        onToggleTask={onToggleTask}
        onMarkNotificationAsRead={onMarkNotificationAsRead}
        onMarkAllNotificationsAsRead={onMarkAllNotificationsAsRead}
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

      {/* Notification Toast for Automated Archive Sweep */}
      {archiveToast && (
        <div className="p-3 bg-amber-500/15 border-2 border-amber-600 text-[#1A1A1A] font-mono text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{archiveToast}</span>
          </div>
          <button 
            onClick={() => setArchiveToast(null)} 
            className="text-xs font-bold text-amber-900 hover:text-black cursor-pointer px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Proactive Deadline Alert Service (LLM Historical Scan) */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1A1A1A] pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-amber-400 px-2 py-0.5 font-mono">
                PROACTIVE DEADLINE ENGINE
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800">
                {overallHealthScore}% Schedule Buffer Health
              </span>
              <span className="text-[10px] font-mono text-[#B45309]">
                {deadlineAlerts.length} Collision Risks Detected
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold italic text-[#1A1A1A]">
              AI Proactive Deadline & Task Buffer Alert Service
            </h3>
            <p className="text-xs text-[#555555] max-w-3xl mt-0.5">
              {alertSummary}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadProactiveDeadlineAlerts}
              disabled={isLoadingAlerts}
              className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Audit upcoming court hearings and tasks with Gemini 3.8 Flash to calculate required buffer days"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoadingAlerts ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{isLoadingAlerts ? 'Scanning Deadlines with Gemini...' : 'Scan Deadlines with Gemini'}</span>
            </button>

            <button
              onClick={() => setTaskViewMode(taskViewMode === 'dag' ? 'list' : 'dag')}
              className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                taskViewMode === 'dag'
                  ? 'bg-amber-500 text-black border-amber-600'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A] hover:bg-[#F5F2EF]'
              }`}
              title="Toggle Directed Acyclic Graph (DAG) Workflow Dependencies View"
            >
              <GitBranch className="w-3.5 h-3.5 text-[#B45309]" />
              <span>{taskViewMode === 'dag' ? 'Close Workflow DAG' : 'Workflow Dependencies (DAG)'}</span>
            </button>
          </div>
        </div>

        {/* Proactive Alerts Stream */}
        {deadlineAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {deadlineAlerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 border-2 space-y-2.5 transition-all ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-50/70 border-red-500 text-[#1A1A1A]'
                    : alert.severity === 'HIGH'
                      ? 'bg-amber-50/80 border-amber-600 text-[#1A1A1A]'
                      : 'bg-[#F9F7F5] border-[#1A1A1A]/40 text-[#1A1A1A]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 font-mono ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-700 text-white'
                          : alert.severity === 'HIGH'
                            ? 'bg-amber-600 text-white'
                            : 'bg-[#1A1A1A] text-white'
                      }`}>
                        {alert.severity} RISK
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Task: <strong>{alert.taskTitle}</strong>
                      </span>
                    </div>
                    {alert.relatedHearingDate && (
                      <span className="text-[10px] font-mono text-rose-800 font-bold block">
                        Court Fixture: {alert.relatedHearingTitle} on {alert.relatedHearingDate}
                      </span>
                    )}
                  </div>

                  <span className="px-2 py-0.5 bg-amber-500 text-black text-[10px] font-mono font-bold shrink-0">
                    +{alert.suggestedBufferDays}d Buffer Needed
                  </span>
                </div>

                <p className="text-xs font-serif italic text-slate-800 leading-relaxed">
                  "{alert.reasoning}"
                </p>

                {alert.historicalDuration && (
                  <p className="text-[10px] font-mono text-slate-600">
                    <strong>Historical Benchmark:</strong> {alert.historicalDuration}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-300 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="font-mono text-[10px]">
                    <span className="text-slate-500">Deadline: </span>
                    <span className="line-through text-slate-500 mr-1.5">{alert.currentDeadline}</span>
                    <strong className="text-emerald-800">→ {alert.recommendedDeadline}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeadlineAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="text-[10px] font-mono text-slate-500 hover:text-black underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleApplyBuffer(alert.taskId, alert.suggestedBufferDays, alert.recommendedDeadline)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="Apply AI recommended buffer days directly to task deadline"
                    >
                      <Check className="w-3 h-3" />
                      <span>Apply Buffer Days</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>All task deadlines satisfy chamber historical buffer thresholds. No collisions with court fixtures detected.</span>
            </div>
            <button
              onClick={loadProactiveDeadlineAlerts}
              className="text-[10px] font-bold uppercase underline hover:text-black cursor-pointer"
            >
              Re-Scan
            </button>
          </div>
        )}
      </div>

      {/* Workflow Dependencies (Directed Acyclic Graph) View */}
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

      {/* Case Pipeline Grid (Active vs Archived Filter) */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b-2 border-[#1A1A1A] pb-3 gap-3">
          
          {/* Tabs: Active Matters vs Archived Matters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border-2 border-[#1A1A1A] bg-[#F5F2EF] p-0.5">
              <button
                onClick={() => setPipelineTab('active')}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                  pipelineTab === 'active'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-[#1A1A1A] hover:bg-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Active Pipeline ({activeCases.length})</span>
              </button>

              <button
                onClick={() => setPipelineTab('archived')}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                  pipelineTab === 'archived'
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-[#555555] hover:bg-slate-200 hover:text-black'
                }`}
                title="View archived matters moved out of active view due to inactivity"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400" />
                <span>Archived ({archivedCases.length})</span>
              </button>
            </div>

            {/* Inactivity Policy Indicator & Trigger */}
            <div className="relative">
              <button
                onClick={() => setIsPolicyPopoverOpen(!isPolicyPopoverOpen)}
                className="px-2.5 py-1.5 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Configure Automated Inactivity Archiving Policy"
              >
                <Sliders className="w-3 h-3 text-[#B45309]" />
                <span>Auto-Archive: {archivePolicy.enabled ? `${archivePolicy.inactivityDays}d` : 'Off'}</span>
              </button>

              {/* Policy Popover */}
              {isPolicyPopoverOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-[#1A1A1A] text-white border-2 border-amber-500 shadow-2xl z-50 p-3.5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-serif font-bold italic text-amber-400 text-xs flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5" />
                      Inactivity Archive Policy
                    </span>
                    <button
                      onClick={() => setIsPolicyPopoverOpen(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    Automatically moves dormant legal matters to 'Archived' status after specified inactivity to reduce dashboard clutter.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Inactivity Threshold:
                    </label>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      {[30, 60, 90, 180].map((days) => (
                        <button
                          key={days}
                          onClick={() => handleUpdatePolicy({ inactivityDays: days, enabled: true })}
                          className={`py-1 text-center font-bold border transition-colors cursor-pointer ${
                            archivePolicy.inactivityDays === days && archivePolicy.enabled
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">Auto-Archive Closed:</span>
                    <input
                      type="checkbox"
                      checked={archivePolicy.autoArchiveClosed}
                      onChange={(e) => handleUpdatePolicy({ autoArchiveClosed: e.target.checked })}
                      className="accent-amber-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        triggerInactivitySweep();
                        setIsPolicyPopoverOpen(false);
                      }}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Run Inactivity Sweep Now</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Case Quick-Summary Toggle Button */}
            <div className={`flex items-center gap-2 px-3 py-1.5 border-2 transition-all ${
              showQuickSummary 
                ? 'bg-amber-500/10 border-amber-600 text-[#1A1A1A]' 
                : 'bg-[#FDFCFB] border-[#1A1A1A] text-slate-700'
            }`}>
              <button
                type="button"
                onClick={handleToggleQuickSummary}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                title="Toggle Gemini one-sentence legal status update for all matters"
              >
                <div className={`w-8 h-4 flex items-center p-0.5 border border-[#1A1A1A] transition-colors ${
                  showQuickSummary ? 'bg-amber-500' : 'bg-slate-300'
                }`}>
                  <div className={`w-3 h-3 bg-black transition-transform ${
                    showQuickSummary ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
                <span className="flex items-center gap-1.5">
                  <Sparkles className={`w-3.5 h-3.5 ${showQuickSummary ? 'text-amber-600 animate-spin' : 'text-slate-500'}`} />
                  <span>Case Quick-Summary</span>
                  <span className={`text-[9px] px-1.5 py-0.2 font-mono font-bold ${
                    showQuickSummary ? 'bg-[#1A1A1A] text-amber-400' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {showQuickSummary ? 'GEMINI ON' : 'OFF'}
                  </span>
                </span>
              </button>

              {showQuickSummary && (
                <button
                  type="button"
                  onClick={loadQuickSummaries}
                  disabled={isLoadingSummaries}
                  className="text-[10px] uppercase font-bold text-[#B45309] hover:underline flex items-center gap-1 border-l border-[#1A1A1A] pl-2 cursor-pointer"
                  title="Regenerate one-sentence statuses with Gemini"
                >
                  <span>{isLoadingSummaries ? 'Updating...' : 'Regenerate'}</span>
                </button>
              )}
            </div>

            <button
              onClick={onOpenNewCaseModal}
              className="text-xs font-bold text-[#B45309] hover:underline uppercase tracking-wider flex items-center gap-1 border-2 border-[#1A1A1A] bg-[#FDFCFB] px-3 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open New Case</span>
            </button>
          </div>
        </div>

        {/* Matter Grid */}
        {displayedCases.length === 0 ? (
          <div className="p-10 text-center bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-3">
            <Archive className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-serif font-bold text-lg text-[#1A1A1A]">
              {pipelineTab === 'active' ? 'No Active Matters' : 'No Archived Matters'}
            </h3>
            <p className="text-xs text-[#555555] max-w-md mx-auto">
              {pipelineTab === 'active'
                ? 'All matters are currently archived or completed. Create a new case or check the Archived tab.'
                : `Cases with over ${archivePolicy.inactivityDays} days of inactivity will automatically be moved here to keep your dashboard clean.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayedCases.map((c) => {
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
                  className={`p-5 border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    isArchived
                      ? isSelected
                        ? 'bg-slate-900 text-white border-amber-500 shadow-md'
                        : 'bg-slate-100/90 text-slate-800 border-dashed border-slate-500 hover:bg-slate-200'
                      : isSelected
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md'
                        : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A] hover:bg-[#F5F2EF]'
                  }`}
                >
                  <div>
                    {/* Top Row Badges */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border ${
                          isArchived
                            ? 'bg-slate-700 text-amber-300 border-slate-600'
                            : isSelected
                              ? 'bg-white text-[#1A1A1A] border-white'
                              : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        }`}>
                          {c.caseType}
                        </span>

                        {isArchived && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-amber-500 text-black flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            Archived ({inactivityDays}d Inactive)
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-mono opacity-60">{c.caseNumber || 'NO-NUM'}</span>
                    </div>

                    <h3 className="font-serif text-lg font-bold italic line-clamp-1 mb-2">{c.title}</h3>

                    {/* Archived Reason Callout */}
                    {isArchived && (
                      <div className="p-2.5 mb-3 bg-amber-500/10 border border-amber-600/40 text-[11px] space-y-1">
                        <span className="text-[9px] font-mono font-bold uppercase text-[#B45309] block">
                          Inactivity Archive Reason:
                        </span>
                        <p className="font-sans italic text-slate-700 dark:text-slate-300 text-[11px] leading-tight">
                          {c.archivedReason || `Inactive for ${inactivityDays} days without court filings.`}
                        </p>
                      </div>
                    )}

                    {/* Gemini Quick-Summary View */}
                    {showQuickSummary ? (
                      <div className={`p-3 border space-y-1 mb-4 ${
                        isSelected 
                          ? 'bg-amber-950/40 border-amber-400/50' 
                          : 'bg-amber-500/10 border-amber-500/40'
                      }`}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#B45309]">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Gemini 1-Sentence Status
                          </span>
                          <span className="text-[8px] bg-[#1A1A1A] text-amber-400 px-1.5 py-0.2 font-mono">
                            STATUS
                          </span>
                        </div>
                        {isLoadingSummaries && !quickSummaries[c.id] ? (
                          <div className="flex items-center gap-2 py-1 text-xs text-amber-600 italic animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            Generating legal update with Gemini...
                          </div>
                        ) : (
                          <p className={`text-xs font-serif italic leading-relaxed font-medium ${
                            isSelected ? 'text-amber-200' : 'text-[#1A1A1A]'
                          }`}>
                            "{quickSummaries[c.id] || c.summary}"
                          </p>
                        )}
                      </div>
                    ) : (
                      !isArchived && <p className="text-xs opacity-80 line-clamp-2 leading-relaxed mb-4">{c.summary}</p>
                    )}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-current/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60 text-[10px] uppercase tracking-wider font-bold">Assessment:</span>
                      <span className="font-serif font-bold text-amber-400 text-[11px] truncate">{c.caseAssessment?.overallAssessment || 'Not assessed'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60 text-[10px] uppercase tracking-wider font-bold">
                        {isArchived ? 'Last Active:' : 'Hearing:'}
                      </span>
                      <span className="font-mono text-xs">
                        {isArchived 
                          ? (c.lastActivityDate || c.updatedAt) 
                          : (c.nextHearingDate || 'Not Scheduled')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] opacity-70">Client: <strong>{c.clientName}</strong></span>
                      
                      <div className="flex items-center gap-2">
                        {isArchived ? (
                          <button
                            onClick={(e) => handleRestoreCase(e, c.id)}
                            className="text-xs font-bold uppercase tracking-wider bg-amber-500 text-black px-2.5 py-1 flex items-center gap-1 hover:bg-amber-400 transition-colors shadow-2xs"
                            title="Unarchive and return matter to active dashboard pipeline"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            <span>Restore to Active</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCaseId(c.id);
                              navigate(`/app/matters/${c.id}/overview`);
                            }}
                            className="text-xs underline font-bold uppercase tracking-wider hover:opacity-80 flex items-center gap-0.5"
                          >
                            Inspect Matter <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

        {/* Practice Tasks & Workflow Dependencies */}
        <div className="bg-[#F9F7F5] border-2 border-[#1A1A1A] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#B45309]" />
                <span>Task Precedence Pipeline</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} Done
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTaskViewMode(taskViewMode === 'dag' ? 'list' : 'dag')}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-colors cursor-pointer ${
                  taskViewMode === 'dag' 
                    ? 'bg-amber-500 text-black border-amber-600' 
                    : 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A] hover:bg-black'
                }`}
                title="Open Workflow Dependencies DAG"
              >
                <GitBranch className="w-3 h-3" />
                <span>DAG View</span>
              </button>

              <button
                onClick={() => {
                  setNewTaskError(null);
                  setNewTaskCaseId(selectedCaseId || cases[0]?.id || '');
                  setIsNewTaskModalOpen(true);
                }}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-black border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                title="Create a new persistent task in PostgreSQL"
              >
                <Plus className="w-3 h-3" />
                <span>New Task</span>
              </button>

              <button
                onClick={() => setIsAddDepModalOpen(true)}
                className="px-2 py-1 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                title="Define dependency between two tasks"
              >
                <Plus className="w-3 h-3 text-[#B45309]" />
                <span>Link Dep</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {tasks.map((task) => {
              const isDone = task.status === 'Completed';
              const prereqTasks = (task.dependsOn || []).map(id => tasks.find(t => t.id === id)).filter((p): p is PracticeTask => !!p);
              const blockingPrereqs = prereqTasks.filter(p => p.status !== 'Completed');
              const isBlocked = blockingPrereqs.length > 0 && !isDone;
              
              // Find downstream tasks that depend on this task
              const downstreamCount = tasks.filter(t => t.dependsOn?.includes(task.id)).length;

              return (
                <div 
                  key={task.id} 
                  className={`p-3.5 border transition-all space-y-2 ${
                    isDone
                      ? 'bg-emerald-50/60 border-emerald-500/70 opacity-80'
                      : isBlocked
                        ? 'bg-rose-50/50 border-rose-400'
                        : 'bg-[#FDFCFB] border-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        onClick={() => handleToggleTaskItem(task.id)}
                        className={`w-4 h-4 mt-0.5 border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isDone 
                            ? 'bg-emerald-700 border-emerald-800 text-white' 
                            : 'bg-white border-[#1A1A1A] hover:border-black'
                        }`}
                        title={isDone ? 'Mark as Incomplete' : 'Mark as Completed (unblocks downstream tasks)'}
                      >
                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <h4 className={`font-serif font-bold text-xs leading-snug ${isDone ? 'line-through text-slate-500' : 'text-[#1A1A1A]'}`}>
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 mt-0.5 flex-wrap">
                          <span>{task.category}</span>
                          {task.historicalDurationDays && (
                            <>
                              <span>•</span>
                              <span className="text-[#B45309]">⏱️ Hist: {task.historicalDurationDays}d avg</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-widest border shrink-0 ${
                      task.priority === 'High' ? 'bg-[#FF4444] text-white border-[#FF4444]' : 'bg-[#F5F2EF] text-[#1A1A1A] border-[#1A1A1A]'
                    }`}>
                      {task.priority}
                    </span>
                  </div>

                  {/* Dependency Blocking Alert Strip */}
                  {isBlocked && (
                    <div className="p-2 bg-rose-100/70 border border-rose-300 text-rose-950 text-[10px] flex items-center justify-between gap-1 font-mono">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Lock className="w-3 h-3 text-rose-700 shrink-0" />
                        <span className="truncate">
                          Blocked by: <strong>{blockingPrereqs.map(p => p.title).join(', ')}</strong>
                        </span>
                      </div>
                      <span className="text-[8px] bg-rose-800 text-white px-1 py-0.2 shrink-0 uppercase font-bold">
                        BLOCKED
                      </span>
                    </div>
                  )}

                  {!isBlocked && !isDone && prereqTasks.length > 0 && (
                    <div className="p-1.5 bg-sky-50 border border-sky-300 text-sky-900 text-[10px] flex items-center gap-1 font-mono">
                      <Unlock className="w-3 h-3 text-sky-700 shrink-0" />
                      <span>All {prereqTasks.length} prerequisites completed. Ready for execution.</span>
                    </div>
                  )}

                  {/* Footer Info */}
                  <div className="flex items-center justify-between text-[10px] font-mono opacity-80 pt-1 border-t border-slate-200">
                    <span className="text-slate-600">Due: <strong className="text-[#1A1A1A]">{task.dueDate}</strong></span>
                    <div className="flex items-center gap-2">
                      {downstreamCount > 0 && (
                        <span className="text-[9px] font-bold text-amber-700">
                          Blocks {downstreamCount} task{downstreamCount > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="font-bold text-[#B45309]">{task.assignedTo || 'Advocate'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#1A1A1A] flex items-center justify-between text-[11px]">
            <button
              onClick={() => setIsAddDepModalOpen(true)}
              className="text-[#B45309] font-bold uppercase tracking-wider text-[10px] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Define Task Dependency</span>
            </button>
            <button
              onClick={() => setTaskViewMode('dag')}
              className="text-slate-700 hover:text-black font-bold uppercase tracking-wider text-[10px] flex items-center gap-1"
            >
              <span>Explore DAG</span>
              <ChevronRight className="w-3 h-3" />
            </button>
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

      {/* Define Task Dependency Modal */}
      {isAddDepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-lg p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                  Chamber Task Precedence
                </span>
                <h3 className="font-serif text-xl font-bold italic text-[#1A1A1A]">
                  Define Task Dependency Edge
                </h3>
              </div>
              <button
                onClick={() => setIsAddDepModalOpen(false)}
                className="p-1 hover:bg-slate-200 border border-[#1A1A1A] text-[#1A1A1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#555555] leading-relaxed">
              Enforce that <strong>Prerequisite Task (A)</strong> must be completed before <strong>Dependent Task (B)</strong> can begin. This establishes the sequence in the DAG and automatically locks Task B until Task A is cleared.
            </p>

            {depError && (
              <div className="p-3 bg-rose-50 border border-rose-400 text-rose-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{depError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono">
                  1. Prerequisite Task (Must Complete First):
                </label>
                <select
                  value={depSourceId}
                  onChange={(e) => setDepSourceId(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border-2 border-[#1A1A1A] font-serif text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Prerequisite Task --</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category} • Due {t.dueDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center text-slate-400 font-mono text-xs">
                ↓ must complete before ↓
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono">
                  2. Dependent Task (Blocked until Prerequisite is Done):
                </label>
                <select
                  value={depTargetId}
                  onChange={(e) => setDepTargetId(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border-2 border-[#1A1A1A] font-serif text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Dependent Task --</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category} • Due {t.dueDate})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-[#1A1A1A] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddDepModalOpen(false)}
                className="px-4 py-2 border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveDependency}
                className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Dependency</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* New Task Creation Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                  PostgreSQL Task Persistence
                </span>
                <h3 className="font-serif text-xl font-bold italic text-[#1A1A1A]">
                  Create Practice Task
                </h3>
              </div>
              <button
                onClick={() => setIsNewTaskModalOpen(false)}
                className="p-1 hover:bg-slate-200 border border-[#1A1A1A] text-[#1A1A1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newTaskError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-400 text-rose-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{newTaskError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTaskSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., File Written Statement & Affidavit"
                  className="w-full p-2.5 bg-[#F9F7F5] border-2 border-[#1A1A1A] text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border-2 border-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full p-2 bg-[#F9F7F5] border-2 border-[#1A1A1A] text-xs focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as any)}
                    className="w-full p-2 bg-[#F9F7F5] border-2 border-[#1A1A1A] text-xs focus:outline-none"
                  >
                    <option value="Drafting">Drafting</option>
                    <option value="Filing">Filing</option>
                    <option value="Research">Research</option>
                    <option value="Client Follow-up">Client Follow-up</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono mb-1">
                    Associated Matter
                  </label>
                  <select
                    value={newTaskCaseId}
                    onChange={(e) => setNewTaskCaseId(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border-2 border-[#1A1A1A] text-xs focus:outline-none"
                  >
                    <option value="">General Chamber Task</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-[#1A1A1A] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2 border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTask}
                  className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingTask ? 'Saving Task...' : 'Save Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

