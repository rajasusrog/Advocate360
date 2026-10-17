import React, { useState, useMemo } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Filter, 
  ArrowRight, 
  Maximize2, 
  ShieldCheck, 
  Info, 
  Check, 
  ChevronRight,
  Layers,
  Activity,
  Calendar,
  X
} from 'lucide-react';
import { PracticeTask, CaseFile, DeadlineAlert } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface TaskDependencyDAGProps {
  tasks: PracticeTask[];
  cases: CaseFile[];
  selectedCaseId?: string;
  onUpdateTasks: (updatedTasks: PracticeTask[]) => void;
  deadlineAlerts?: DeadlineAlert[];
  onApplyBuffer?: (taskId: string, suggestedBufferDays: number, recommendedDate: string) => void;
  onClose?: () => void;
}

interface NodeLayout {
  task: PracticeTask;
  level: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isBlocked: boolean;
  blockingTasks: PracticeTask[];
  isReady: boolean;
}

export const TaskDependencyDAG: React.FC<TaskDependencyDAGProps> = ({
  tasks,
  cases,
  selectedCaseId,
  onUpdateTasks,
  deadlineAlerts = [],
  onApplyBuffer,
  onClose
}) => {
  const [filterCaseId, setFilterCaseId] = useState<string>(selectedCaseId || 'ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [highlightCriticalPath, setHighlightCriticalPath] = useState<boolean>(true);
  
  // Add Dependency Modal
  const [isAddDepModalOpen, setIsAddDepModalOpen] = useState<boolean>(false);
  const [depSourceTaskId, setDepSourceTaskId] = useState<string>('');
  const [depTargetTaskId, setDepTargetTaskId] = useState<string>('');
  const [depError, setDepError] = useState<string | null>(null);

  // Filter tasks by case if not 'ALL'
  const filteredTasks = useMemo(() => {
    if (filterCaseId === 'ALL') return tasks;
    return tasks.filter(t => t.caseId === filterCaseId);
  }, [tasks, filterCaseId]);

  // Map of tasks by id
  const taskMap = useMemo(() => {
    const map = new Map<string, PracticeTask>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Cycle detection and topological layering
  const { levels, hasCycle, criticalPathTaskIds } = useMemo(() => {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>(); // source -> targets
    const revAdjList = new Map<string, string[]>(); // target -> sources

    filteredTasks.forEach(t => {
      inDegree.set(t.id, 0);
      adjList.set(t.id, []);
      revAdjList.set(t.id, []);
    });

    filteredTasks.forEach(t => {
      const deps = t.dependsOn || [];
      deps.forEach(depId => {
        if (inDegree.has(depId)) {
          // depId must finish BEFORE t.id
          adjList.get(depId)?.push(t.id);
          revAdjList.get(t.id)?.push(depId);
          inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        }
      });
    });

    // Kahn's algorithm for topological levels
    const queue: string[] = [];
    const nodeLevel = new Map<string, number>();

    inDegree.forEach((deg, id) => {
      if (deg === 0) {
        queue.push(id);
        nodeLevel.set(id, 0);
      }
    });

    let visitedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      visitedCount++;
      const currentLvl = nodeLevel.get(u) || 0;

      const neighbors = adjList.get(u) || [];
      neighbors.forEach(v => {
        const nextLvl = Math.max(nodeLevel.get(v) || 0, currentLvl + 1);
        nodeLevel.set(v, nextLvl);

        const currentIn = inDegree.get(v)! - 1;
        inDegree.set(v, currentIn);
        if (currentIn === 0) {
          queue.push(v);
        }
      });
    }

    const detectedCycle = visitedCount < filteredTasks.length;

    // Find Critical Path: Longest path based on historicalDurationDays or count
    const criticalPath = new Set<string>();
    const maxDist = new Map<string, number>();
    const parentOf = new Map<string, string>();

    // Topological order list
    const sorted = [...filteredTasks].sort((a, b) => (nodeLevel.get(a.id) || 0) - (nodeLevel.get(b.id) || 0));
    sorted.forEach(t => {
      const duration = t.historicalDurationDays || 2;
      maxDist.set(t.id, duration);
    });

    sorted.forEach(t => {
      const uDist = maxDist.get(t.id) || 0;
      const neighbors = adjList.get(t.id) || [];
      neighbors.forEach(v => {
        const vTask = taskMap.get(v);
        const vDuration = vTask?.historicalDurationDays || 2;
        if (uDist + vDuration > (maxDist.get(v) || 0)) {
          maxDist.set(v, uDist + vDuration);
          parentOf.set(v, t.id);
        }
      });
    });

    // Find node with highest dist
    let endNode: string | null = null;
    let maxTotal = -1;
    maxDist.forEach((d, id) => {
      if (d > maxTotal) {
        maxTotal = d;
        endNode = id;
      }
    });

    let curr = endNode;
    while (curr) {
      criticalPath.add(curr);
      curr = parentOf.get(curr) || null;
    }

    return {
      levels: nodeLevel,
      hasCycle: detectedCycle,
      criticalPathTaskIds: criticalPath
    };
  }, [filteredTasks, taskMap]);

  // Compute Layout Positions (Left to Right DAG columns)
  const nodeWidth = 270;
  const nodeHeight = 135;
  const colSpacing = 90;
  const rowSpacing = 40;

  const { nodeLayouts, nodeLayoutList, totalWidth, totalHeight } = useMemo(() => {
    // Group tasks by level
    const levelBuckets = new Map<number, PracticeTask[]>();
    filteredTasks.forEach(t => {
      const lvl = levels.get(t.id) || 0;
      if (!levelBuckets.has(lvl)) levelBuckets.set(lvl, []);
      levelBuckets.get(lvl)!.push(t);
    });

    const layouts = new Map<string, NodeLayout>();
    let maxLevel = 0;
    let maxRows = 1;

    levelBuckets.forEach((bucketTasks, lvl) => {
      if (lvl > maxLevel) maxLevel = lvl;
      if (bucketTasks.length > maxRows) maxRows = bucketTasks.length;

      bucketTasks.forEach((t, rowIdx) => {
        const x = 50 + lvl * (nodeWidth + colSpacing);
        const y = 50 + rowIdx * (nodeHeight + rowSpacing);

        // Check if blocked by uncompleted prerequisites
        const prereqIds = t.dependsOn || [];
        const blocking = prereqIds
          .map(id => taskMap.get(id))
          .filter((p): p is PracticeTask => !!p && p.status !== 'Completed');

        const isBlocked = blocking.length > 0 && t.status !== 'Completed';
        const isReady = blocking.length === 0 && t.status !== 'Completed';

        layouts.set(t.id, {
          task: t,
          level: lvl,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
          isBlocked,
          blockingTasks: blocking,
          isReady
        });
      });
    });

    const calculatedWidth = Math.max(850, 100 + (maxLevel + 1) * (nodeWidth + colSpacing));
    const calculatedHeight = Math.max(520, 100 + maxRows * (nodeHeight + rowSpacing));
    const layoutList: NodeLayout[] = [];
    layouts.forEach(l => layoutList.push(l));

    return {
      nodeLayouts: layouts,
      nodeLayoutList: layoutList,
      totalWidth: calculatedWidth,
      totalHeight: calculatedHeight
    };
  }, [filteredTasks, levels, taskMap, nodeWidth, nodeHeight, colSpacing, rowSpacing]);

  // Toggle completion of a task
  const handleToggleTaskStatus = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'Completed' ? 'Pending' : 'Completed';
        return { ...t, status: nextStatus as any };
      }
      return t;
    });

    onUpdateTasks(updated);
    const toggled = taskMap.get(taskId);
    logAuditEvent('CASE_UPDATE', `Task Dependency Engine: Toggled status for "${toggled?.title}" (now ${toggled?.status === 'Completed' ? 'Pending' : 'Completed'})`);
  };

  // Add dependency: sourceTaskId -> targetTaskId
  const handleAddDependency = () => {
    setDepError(null);
    if (!depSourceTaskId || !depTargetTaskId) {
      setDepError('Please select both a prerequisite task and a dependent task.');
      return;
    }
    if (depSourceTaskId === depTargetTaskId) {
      setDepError('A task cannot depend on itself.');
      return;
    }

    // Check if depTargetTaskId is an ancestor of depSourceTaskId to prevent cycle
    const visited = new Set<string>();
    const stack = [depSourceTaskId];
    let createsCycle = false;

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr === depTargetTaskId) {
        createsCycle = true;
        break;
      }
      visited.add(curr);
      const currTask = taskMap.get(curr);
      const parents = currTask?.dependsOn || [];
      parents.forEach(p => {
        if (!visited.has(p)) stack.push(p);
      });
    }

    if (createsCycle) {
      setDepError(`Cannot create dependency: Task "${taskMap.get(depSourceTaskId)?.title}" already depends upstream on "${taskMap.get(depTargetTaskId)?.title}". This would create a circular dependency loop (violating DAG requirements).`);
      return;
    }

    // Apply dependency
    const updated = tasks.map(t => {
      if (t.id === depTargetTaskId) {
        const existing = t.dependsOn || [];
        if (!existing.includes(depSourceTaskId)) {
          return { ...t, dependsOn: [...existing, depSourceTaskId] };
        }
      }
      return t;
    });

    onUpdateTasks(updated);
    logAuditEvent('CASE_UPDATE', `Added DAG dependency: "${taskMap.get(depSourceTaskId)?.title}" must finish before "${taskMap.get(depTargetTaskId)?.title}"`);
    setIsAddDepModalOpen(false);
    setDepSourceTaskId('');
    setDepTargetTaskId('');
  };

  // Remove dependency
  const handleRemoveDependency = (targetTaskId: string, sourceTaskId: string) => {
    const updated = tasks.map(t => {
      if (t.id === targetTaskId) {
        const existing = t.dependsOn || [];
        return { ...t, dependsOn: existing.filter(id => id !== sourceTaskId) };
      }
      return t;
    });

    onUpdateTasks(updated);
    logAuditEvent('CASE_UPDATE', `Removed DAG dependency between "${taskMap.get(sourceTaskId)?.title}" and "${taskMap.get(targetTaskId)?.title}"`);
  };

  const selectedLayout = selectedTaskId ? nodeLayouts.get(selectedTaskId) : null;
  const selectedTaskAlert = selectedTaskId ? deadlineAlerts.find(a => a.taskId === selectedTaskId) : null;

  return (
    <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4 text-[#1A1A1A]">
      
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b-2 border-[#1A1A1A] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2 py-0.5 font-mono">
              DIRECTED ACYCLIC GRAPH (DAG)
            </span>
            <span className="text-xs font-mono font-bold text-[#B45309]">
              {filteredTasks.length} Pipeline Nodes
            </span>
            {hasCycle ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-700 text-white px-2 py-0.5 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3 h-3" />
                Cycle Detected
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Valid DAG Structure
              </span>
            )}
          </div>
          <h2 className="font-serif text-2xl font-bold italic text-[#1A1A1A]">
            Workflow Dependencies & Precedence Map
          </h2>
          <p className="text-xs text-[#555555] max-w-2xl mt-0.5">
            Visualize chronological legal prerequisites and task blocking chains. Unblocking upstream tasks dynamically cascades downstream readiness.
          </p>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Case Filter Selector */}
          <div className="flex items-center gap-1.5 bg-[#F5F2EF] border border-[#1A1A1A] px-2.5 py-1.5 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-[#B45309]" />
            <span className="text-[10px] uppercase font-bold text-slate-500">Filter Matter:</span>
            <select
              value={filterCaseId}
              onChange={(e) => setFilterCaseId(e.target.value)}
              className="bg-transparent font-serif font-bold text-xs text-[#1A1A1A] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Matters ({tasks.length} Tasks)</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber || c.title} — {c.clientName}
                </option>
              ))}
            </select>
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={() => setHighlightCriticalPath(!highlightCriticalPath)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 cursor-pointer ${
              highlightCriticalPath
                ? 'bg-amber-500 text-black border-amber-600 shadow-2xs'
                : 'bg-[#FDFCFB] text-slate-700 border-[#1A1A1A] hover:bg-[#F5F2EF]'
            }`}
            title="Highlight longest dependency chain leading to hearing/filing milestone"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Critical Path ({criticalPathTaskIds.size})</span>
          </button>

          {/* Add Dependency Button */}
          <button
            onClick={() => setIsAddDepModalOpen(true)}
            className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Define Dependency</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-[#FDFCFB] hover:bg-slate-200 border border-[#1A1A1A] text-[#1A1A1A] transition-colors cursor-pointer"
              title="Close Workflow Dependencies View"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Interactive Directed Graph Canvas (9 cols) */}
        <div className="lg:col-span-9 bg-[#F9F7F5] border-2 border-[#1A1A1A] relative overflow-hidden shadow-inner flex flex-col">
          
          {/* Canvas Sub-bar */}
          <div className="p-2.5 bg-[#F5F2EF] border-b border-[#1A1A1A] flex items-center justify-between text-[11px] font-mono px-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-600 inline-block" />
                <span className="text-slate-700">Completed (Unblocks downstream)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 inline-block animate-pulse" />
                <span className="text-slate-700">In Progress</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-600 inline-block" />
                <span className="text-slate-700">Blocked (Waiting on Prerequisite)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-600 inline-block" />
                <span className="text-slate-700">Ready to Start</span>
              </span>
            </div>

            <span className="text-slate-500 italic">
              Scroll horizontally to follow sequential stages →
            </span>
          </div>

          {/* SVG Scrollable Canvas Area */}
          <div className="overflow-x-auto overflow-y-auto p-4 max-h-[580px] bg-[radial-gradient(#1a1a1a15_1px,transparent_1px)] [background-size:16px_16px]">
            <div 
              style={{ width: `${totalWidth}px`, height: `${totalHeight}px`, position: 'relative' }}
              className="select-none"
            >
              {/* SVG Edges Layer */}
              <svg 
                className="absolute inset-0 pointer-events-none" 
                width={totalWidth} 
                height={totalHeight}
              >
                <defs>
                  {/* Default arrow marker */}
                  <marker
                    id="arrow-default"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#1A1A1A" />
                  </marker>

                  {/* Completed / Active arrow marker */}
                  <marker
                    id="arrow-completed"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#059669" />
                  </marker>

                  {/* Blocked arrow marker */}
                  <marker
                    id="arrow-blocked"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#E11D48" />
                  </marker>

                  {/* Critical Path arrow marker */}
                  <marker
                    id="arrow-critical"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#D97706" />
                  </marker>
                </defs>

                {/* Render Directed Edges */}
                {nodeLayoutList.map((targetNode: NodeLayout) => {
                  const prereqIds = targetNode.task.dependsOn || [];
                  return prereqIds.map(sourceId => {
                    const sourceNode = nodeLayouts.get(sourceId) as NodeLayout | undefined;
                    if (!sourceNode) return null;

                    const startX = sourceNode.x + sourceNode.width;
                    const startY = sourceNode.y + sourceNode.height / 2;
                    const endX = targetNode.x;
                    const endY = targetNode.y + targetNode.height / 2;

                    const isSourceDone = sourceNode.task.status === 'Completed';
                    const isEdgeCritical = highlightCriticalPath && criticalPathTaskIds.has(sourceId) && criticalPathTaskIds.has(targetNode.task.id);

                    const strokeColor = isEdgeCritical 
                      ? '#D97706' 
                      : isSourceDone 
                        ? '#059669' 
                        : '#E11D48';

                    const markerId = isEdgeCritical 
                      ? 'url(#arrow-critical)' 
                      : isSourceDone 
                        ? 'url(#arrow-completed)' 
                        : 'url(#arrow-blocked)';

                    const strokeWidth = isEdgeCritical ? 2.8 : 2.0;
                    const strokeDasharray = isSourceDone ? undefined : '4 3';

                    // Smooth Bezier curve
                    const dx = endX - startX;
                    const pathData = `M ${startX} ${startY} C ${startX + dx * 0.45} ${startY}, ${endX - dx * 0.45} ${endY}, ${endX} ${endY}`;

                    return (
                      <g key={`${sourceId}->${targetNode.task.id}`}>
                        <path
                          d={pathData}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={strokeDasharray}
                          markerEnd={markerId}
                          opacity={0.9}
                        />
                      </g>
                    );
                  });
                })}
              </svg>

              {/* HTML Nodes Layer */}
              {nodeLayoutList.map((node: NodeLayout) => {
                const isSelected = selectedTaskId === node.task.id;
                const isDone = node.task.status === 'Completed';
                const isInProgress = node.task.status === 'In Progress';
                const isCritical = highlightCriticalPath && criticalPathTaskIds.has(node.task.id);
                const alert = deadlineAlerts.find(a => a.taskId === node.task.id);

                return (
                  <div
                    key={node.task.id}
                    onClick={() => setSelectedTaskId(node.task.id)}
                    style={{
                      position: 'absolute',
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`
                    }}
                    className={`border-2 p-3 transition-all cursor-pointer flex flex-col justify-between select-none shadow-xs ${
                      isSelected
                        ? 'ring-2 ring-[#1A1A1A] ring-offset-2 border-[#1A1A1A] bg-white shadow-md'
                        : isDone
                          ? 'bg-emerald-50/70 border-emerald-600/80 hover:border-emerald-700'
                          : node.isBlocked
                            ? 'bg-rose-50/50 border-rose-500/70 hover:border-rose-600'
                            : isInProgress
                              ? 'bg-amber-50/80 border-amber-600 hover:border-amber-700'
                              : 'bg-white border-[#1A1A1A] hover:border-slate-800'
                    }`}
                  >
                    {/* Node Header */}
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDone ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-700 text-white px-1.5 py-0.2 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              Done
                            </span>
                          ) : node.isBlocked ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-700 text-white px-1.5 py-0.2 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Blocked ({node.blockingTasks.length})
                            </span>
                          ) : isInProgress ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-black px-1.5 py-0.2 flex items-center gap-1 animate-pulse">
                              <Clock className="w-2.5 h-2.5" />
                              In Progress
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-sky-700 text-white px-1.5 py-0.2 flex items-center gap-1">
                              <Unlock className="w-2.5 h-2.5" />
                              Ready
                            </span>
                          )}

                          {isCritical && (
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-400 text-black px-1">
                              CRITICAL PATH
                            </span>
                          )}
                        </div>

                        {/* Proactive Buffer Badge if Alert present */}
                        {alert && (
                          <span 
                            className="text-[9px] font-bold uppercase font-mono px-1 py-0.2 bg-amber-500/20 text-amber-900 border border-amber-500 flex items-center gap-0.5"
                            title={`Proactive Deadline Alert: +${alert.suggestedBufferDays}d Buffer Suggested`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            +{alert.suggestedBufferDays}d Buffer
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif font-bold text-xs text-[#1A1A1A] line-clamp-2 leading-tight">
                        {node.task.title}
                      </h4>
                    </div>

                    {/* Node Footer */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-slate-500">
                          Due: <strong className="text-[#1A1A1A]">{node.task.dueDate}</strong>
                        </span>
                        {node.task.historicalDurationDays && (
                          <span className="text-[9px] text-[#B45309]">
                            Avg {node.task.historicalDurationDays}d work
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleToggleTaskStatus(node.task.id, e)}
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                          isDone 
                            ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800' 
                            : 'bg-white text-slate-800 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                        }`}
                        title={isDone ? 'Mark as Pending' : 'Mark as Completed (unblocks downstream tasks)'}
                      >
                        {isDone ? 'Completed' : 'Complete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Node Inspector & Dependency Editor (3 cols) */}
        <div className="lg:col-span-3 bg-[#F5F2EF] border-2 border-[#1A1A1A] p-4 shadow-xs space-y-4 text-xs">
          {selectedLayout ? (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="border-b border-[#1A1A1A] pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] block">
                  Node Inspector & Precedence
                </span>
                <h3 className="font-serif italic font-bold text-sm text-[#1A1A1A] mt-0.5">
                  {selectedLayout.task.title}
                </h3>
              </div>

              {/* Task Details Card */}
              <div className="bg-[#FDFCFB] p-3 border border-[#1A1A1A] space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-500 uppercase">Category:</span>
                  <span className="font-bold text-[#1A1A1A]">{selectedLayout.task.category}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-500 uppercase">Current Deadline:</span>
                  <span className="font-mono font-bold text-[#1A1A1A]">{selectedLayout.task.dueDate}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-500 uppercase">Historical Duration:</span>
                  <span className="font-mono text-[#B45309]">
                    {selectedLayout.task.historicalDurationDays || 2} business days
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-500 uppercase">Assigned Advocate:</span>
                  <span className="text-slate-800">{selectedLayout.task.assignedTo || 'Unassigned'}</span>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleToggleTaskStatus(selectedLayout.task.id)}
                    className="w-full py-1.5 bg-[#1A1A1A] hover:bg-black text-white font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedLayout.task.status === 'Completed' ? 'Mark as Incomplete' : 'Mark Completed (Unblock)'}</span>
                  </button>
                </div>
              </div>

              {/* Proactive Deadline Alert Callout */}
              {selectedTaskAlert && (
                <div className="p-3 bg-amber-500/15 border-2 border-amber-600 space-y-2">
                  <div className="flex items-center gap-1.5 text-[#B45309] font-bold text-[10px] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Proactive Deadline Alert</span>
                  </div>
                  <p className="text-[11px] leading-relaxed italic font-serif text-[#1A1A1A]">
                    {selectedTaskAlert.reasoning}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-amber-600/30 text-[10px] font-mono">
                    <span>Buffer Suggested:</span>
                    <strong className="text-rose-800">+{selectedTaskAlert.suggestedBufferDays} Days</strong>
                  </div>

                  {onApplyBuffer && (
                    <button
                      onClick={() => onApplyBuffer(selectedLayout.task.id, selectedTaskAlert.suggestedBufferDays, selectedTaskAlert.recommendedDeadline)}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Apply Buffer ({selectedTaskAlert.recommendedDeadline})</span>
                    </button>
                  )}
                </div>
              )}

              {/* Prerequisites (Depends On) Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                  <span>Prerequisites (Must Finish First):</span>
                  <span>{(selectedLayout.task.dependsOn || []).length}</span>
                </div>

                {(selectedLayout.task.dependsOn || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic p-2 bg-[#FDFCFB] border border-slate-200">
                    No prerequisites. This root task can start immediately.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {(selectedLayout.task.dependsOn || []).map(preId => {
                      const preTask = taskMap.get(preId);
                      const isPreDone = preTask?.status === 'Completed';

                      return (
                        <div key={preId} className="p-2 bg-[#FDFCFB] border border-[#1A1A1A] flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-serif font-bold text-[11px] truncate text-[#1A1A1A]">
                              {preTask?.title || preId}
                            </p>
                            <span className={`text-[9px] font-bold uppercase font-mono ${isPreDone ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {isPreDone ? '✓ Completed' : '⏳ Blocking this task'}
                            </span>
                          </div>

                          <button
                            onClick={() => handleRemoveDependency(selectedLayout.task.id, preId)}
                            className="text-slate-400 hover:text-rose-700 p-0.5 cursor-pointer"
                            title="Remove dependency edge"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Add Dependency Action */}
              <button
                onClick={() => {
                  setDepTargetTaskId(selectedLayout.task.id);
                  setIsAddDepModalOpen(true);
                }}
                className="w-full py-2 bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] font-bold uppercase tracking-wider text-[10px] border border-[#1A1A1A] flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 text-[#B45309]" />
                <span>Add Prerequisite To This Task</span>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <Layers className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">Select a Task Node</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                Click any task node in the directed graph to inspect its upstream prerequisites, downstream blockers, historical completion times, and proactive deadline alerts.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* DEFINE DEPENDENCY MODAL */}
      {/* ========================================================================= */}
      {isAddDepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-lg p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                  Precedence Relation
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
              Enforce that <strong>Prerequisite Task (A)</strong> must be marked completed before <strong>Dependent Task (B)</strong> can begin. The engine validates that no circular loops are created.
            </p>

            {depError && (
              <div className="p-3 bg-rose-50 border border-rose-400 text-rose-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{depError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Step 1: Source / Prerequisite */}
              <div className="space-y-1">
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono">
                  1. Prerequisite Task (Must Complete First):
                </label>
                <select
                  value={depSourceTaskId}
                  onChange={(e) => setDepSourceTaskId(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border-2 border-[#1A1A1A] font-serif text-xs font-bold focus:outline-none"
                >
                  <option value="">-- Choose Prerequisite Task --</option>
                  {filteredTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category} • Due {t.dueDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center text-slate-400 font-mono text-xs">
                ↓ must be finished before ↓
              </div>

              {/* Step 2: Target / Dependent */}
              <div className="space-y-1">
                <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A] block font-mono">
                  2. Dependent Task (Blocked until Prerequisite is Done):
                </label>
                <select
                  value={depTargetTaskId}
                  onChange={(e) => setDepTargetTaskId(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border-2 border-[#1A1A1A] font-serif text-xs font-bold focus:outline-none"
                >
                  <option value="">-- Choose Dependent Task --</option>
                  {filteredTasks.map(t => (
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
                onClick={handleAddDependency}
                className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Dependency Edge</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
