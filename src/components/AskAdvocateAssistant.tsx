import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bot, 
  Send, 
  Sparkles, 
  Scale, 
  FileText, 
  CheckCircle2,
  AlertCircle, 
  BookmarkPlus, 
  Layers, 
  ListChecks, 
  HelpCircle, 
  FileSearch, 
  GitCommit, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  Building,
  RefreshCw,
  Clock
} from 'lucide-react';
import { CaseFile } from '../types';
import { apiPost } from '../lib/api';
import { assignQuickNoteToMatter, useMatterDocuments } from '../lib/useMatterData';
import { useDurableJobs } from '../lib/useDurableJobs';
import { JobType } from '../lib/backgroundJobs';

interface AskAdvocateAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCase?: CaseFile | null;
  chamberId?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  sourcesUsed?: string[];
  missingContext?: string[];
  suggestedTask?: string;
  savedToMatter?: boolean;
  jobId?: string;
}

export const AskAdvocateAssistant: React.FC<AskAdvocateAssistantProps> = ({
  isOpen,
  onClose,
  selectedCase,
  chamberId
}) => {
  const matterId = selectedCase?.id;
  const activeChamberId = chamberId || selectedCase?.chamberId;
  const { documents } = useMatterDocuments(isOpen ? (activeChamberId || '') : '', matterId);
  const { jobs, activeJobs, completedJobs, failedJobs, enqueue, fetchResult, retry, refresh } = useDurableJobs(
    activeChamberId,
    matterId
  );

  // Selected Context
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedFacts, setSelectedFacts] = useState<string[]>([]);
  const [showContextSelector, setShowContextSelector] = useState<boolean>(false);

  // Messages State
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-init',
      sender: 'ai',
      text: selectedCase
        ? `I am your Advocate360 Legal AI Assistant for matter: **${selectedCase.title}** (${selectedCase.caseNumber || 'Ref Pending'}). How can I assist with document analysis, fact extraction, or litigation strategy?`
        : 'I am your Advocate360 Legal AI Assistant in **Firm Scope**. Select a matter to run matter-scoped analysis or ask general statutory, procedural, and chamber questions.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sourcesUsed: selectedCase ? [`Matter File: ${selectedCase.title}`] : ['Chamber Practice Guidelines'],
      missingContext: selectedCase?.caseAssessment?.evidenceGaps || []
    }
  ]);

  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Sync assistant scope with route matter change
  useEffect(() => {
    setSelectedDocIds([]);
    setSelectedFacts([]);
    if (selectedCase) {
      setMessages([
        {
          id: `msg-init-${selectedCase.id}`,
          sender: 'ai',
          text: `I am your Advocate360 Legal AI Assistant for matter: **${selectedCase.title}** (${selectedCase.caseNumber || 'Ref Pending'}). How can I assist with document analysis, fact extraction, or litigation strategy?`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourcesUsed: [`Matter File: ${selectedCase.title}`],
          missingContext: selectedCase?.caseAssessment?.evidenceGaps || []
        }
      ]);
    } else {
      setMessages([
        {
          id: 'msg-init-firm',
          sender: 'ai',
          text: 'I am your Advocate360 Legal AI Assistant in **Firm Scope**. Select a matter to run matter-scoped analysis or ask general statutory, procedural, and chamber questions.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sourcesUsed: ['Chamber Practice Guidelines'],
          missingContext: []
        }
      ]);
    }
  }, [selectedCase?.id]);

  // Restore completed durable job results after page reload or job completion
  useEffect(() => {
    if (!isOpen || completedJobs.length === 0) return;

    completedJobs.forEach(async (job) => {
      const existingMsg = messages.find(m => m.jobId === job.id || m.jobId === job.jobId);
      if (!existingMsg) {
        const resultRes = await fetchResult(job.id);
        const resultText = resultRes?.resultPayload?.reply || 
          resultRes?.resultPayload?.summary || 
          (resultRes?.resultPayload ? JSON.stringify(resultRes.resultPayload, null, 2) : 'Durable worker completed execution.');

        setMessages(prev => {
          if (prev.some(m => m.jobId === job.id || m.jobId === job.jobId)) return prev;
          return [
            ...prev,
            {
              id: `job-res-${job.id}`,
              sender: 'ai',
              text: `**[Durable Task Result: ${job.title}]**\n\n${resultText}`,
              time: new Date(job.timestamps.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              sourcesUsed: selectedCase ? [`Matter: ${selectedCase.title}`] : ['Durable Job Engine'],
              jobId: job.id,
            }
          ];
        });
      }
    });
  }, [completedJobs, isOpen]);

  if (!isOpen) return null;

  // Human-Readable Litigation Tasks
  const QUICK_TASKS = [
    { label: 'Summarize Documents', icon: FileSearch, taskType: 'Summarize these documents', op: 'SUMMARIZE_DOCS' as JobType },
    { label: 'Extract Facts & Dates', icon: GitCommit, taskType: 'Extract facts and dates', op: 'EXTRACT_FACTS_DATES' as JobType },
    { label: 'Identify Contradictions', icon: AlertTriangle, taskType: 'Identify potential contradictions', op: 'FIND_CONTRADICTIONS' as JobType },
    { label: 'Find Missing Info', icon: HelpCircle, taskType: 'Find missing information', op: 'LARGE_DOC_ANALYSIS' as JobType },
    { label: 'Prepare First Draft', icon: FileText, taskType: 'Prepare a first draft', op: 'AI_REASONING_CHAIN' as JobType },
    { label: 'Prepare Hearing Brief', icon: Scale, taskType: 'Prepare a hearing brief', op: 'PREPARE_HEARING_BRIEF' as JobType }
  ];

  const handleRunTask = (taskType: string, op: JobType) => {
    const promptText = selectedDocIds.length > 0
      ? `${taskType} using selected ${selectedDocIds.length} document(s)`
      : `${taskType} for ${selectedCase ? selectedCase.title : 'active scope'}`;
    
    handleSend(promptText, taskType, op);
  };

  const handleSend = async (overridePrompt?: string, taskType?: string, targetOp?: JobType) => {
    const userText = (overridePrompt || inputMsg).trim();
    if (!userText || isSending) return;

    if (!overridePrompt) setInputMsg('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsgObj: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      time: timeStr
    };

    setMessages(prev => [...prev, userMsgObj]);
    setIsSending(true);

    const resolvedChamberId = activeChamberId || 'chamber-default';

    // Enqueue durable server-side background job
    try {
      const opToRun: JobType = targetOp || 'AI_REASONING_CHAIN';
      const { job, isDuplicate } = await enqueue({
        operation: opToRun,
        title: taskType || userText.substring(0, 30),
        chamberId: resolvedChamberId,
        matterId,
        inputRecordIds: selectedDocIds,
        idempotencyKey: `${resolvedChamberId}_${matterId || 'general'}_${opToRun}_${selectedDocIds.slice().sort().join(',')}`,
      });

      if (isDuplicate) {
        setSaveToast(`ℹ️ Active or completed job found for this prompt.`);
        setTimeout(() => setSaveToast(null), 3000);
      }

      // Also invoke synchronous agent-chat endpoint for instant conversational feedback
      const selectedDocs = documents.filter(d => selectedDocIds.includes(d.id));
      const selectedDocNames = selectedDocs.map(d => d.name);
      const selectedDocContents = selectedDocs.map(d => 
        `[Document: ${d.name}]\n${(d.content || 'Content pending extraction.').substring(0, 1500)}`
      ).join('\n\n');

      const caseCtx = selectedCase
        ? `Matter Title: ${selectedCase.title}. Case No: ${selectedCase.caseNumber || 'Not specified'}. Court: ${selectedCase.courtName || 'Not specified'}. Stage: ${selectedCase.stage || 'Not specified'}. Client: ${selectedCase.clientName}. Summary: ${selectedCase.summary || 'None'}.\n\nSELECTED DOCUMENT CONTENT:\n${selectedDocContents || 'None selected'}\n\nSELECTED FACTS:\n${selectedFacts.join('; ') || 'None'}`
        : 'General Chamber Practice Scope';

      const data = await apiPost<{ reply?: string }>('/api/ai/agent-chat', {
        agentRole: 'legal_research',
        message: userText,
        caseContext: caseCtx,
        chamberId: resolvedChamberId,
        caseId: selectedCase?.id
      });

      const replyText = data?.reply || 'I analyzed the query. Please verify statutory provisions in official law reporters before reliance.';
      
      const sourcesUsed = [
        ...(selectedCase ? [`Matter: ${selectedCase.title}`] : ['Chamber Practice']),
        ...selectedDocNames
      ];

      const missingContext = selectedCase
        ? (selectedCase.oppositeParty ? [] : ['Opposite Party statement missing'])
        : ['No specific matter selected (Firm Scope)'];

      const aiMsgObj: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourcesUsed,
        missingContext,
        suggestedTask: taskType,
        jobId: job?.id,
      };

      setMessages(prev => [...prev, aiMsgObj]);
    } catch (err: any) {
      const errMsg = `Unable to generate AI response: ${err.message || 'Service unavailable'}. Please check credentials or retry.`;
      setMessages(prev => [...prev, { 
        id: `err-${Date.now()}`,
        sender: 'ai', 
        text: errMsg, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveAnswerToMatter = async (msg: AssistantMessage) => {
    if (!selectedCase || !activeChamberId) {
      setSaveToast('⚠️ Select a specific matter to save answers.');
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    try {
      await assignQuickNoteToMatter(
        activeChamberId,
        selectedCase.id,
        msg.suggestedTask ? `AI Assistant: ${msg.suggestedTask}` : 'Advocate360 AI Response',
        msg.text
      );

      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, savedToMatter: true } : m));
      setSaveToast(`✓ Saved answer to Matter File (${selectedCase.title})`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error('Save answer error:', err);
      setSaveToast('❌ Failed to save answer.');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#FDFCFB] border-l-2 border-[#1A1A1A] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-[#1A1A1A]">
      
      {/* Top Header */}
      <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-400" />
          <div>
            <span className="font-serif italic font-bold text-base block leading-none">Ask Advocate360</span>
            <span className="text-[9px] font-mono text-slate-400 uppercase">Durable Server-Side AI Queue</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            title="Refresh Durable Jobs Queue"
            className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Explicit Active Scope Banner */}
      <div className={`p-3 border-b border-[#1A1A1A] text-xs font-mono flex items-center justify-between ${
        selectedCase ? 'bg-amber-50 text-[#1A1A1A]' : 'bg-[#F5F2EF] text-[#555555]'
      }`}>
        <div className="flex items-center gap-2 truncate">
          {selectedCase ? (
            <Scale className="w-4 h-4 text-[#B45309] shrink-0" />
          ) : (
            <Building className="w-4 h-4 text-[#555555] shrink-0" />
          )}
          <span className="font-bold text-[10px] uppercase tracking-wider shrink-0">Active Scope:</span>
          <span className="font-serif italic font-medium truncate">
            {selectedCase ? `Matter: ${selectedCase.title} (${selectedCase.caseNumber || 'Ref Pending'})` : 'Firm Scope: Entire Chamber Practice'}
          </span>
        </div>

        {selectedCase && (
          <button
            onClick={() => setShowContextSelector(!showContextSelector)}
            className="text-[10px] uppercase font-bold text-[#B45309] hover:underline shrink-0 ml-2"
          >
            {showContextSelector ? 'Close Context' : 'Select Context'}
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {saveToast && (
        <div className="p-2.5 bg-[#1A1A1A] text-amber-400 font-mono text-xs border-b border-[#1A1A1A] flex items-center gap-2 animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Active Durable Background Worker Status Bar */}
      {activeJobs.length > 0 && (
        <div className="p-2 bg-amber-50 border-b border-amber-300 text-xs font-mono flex items-center justify-between text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
            <span className="font-bold text-[10px] uppercase">
              {activeJobs.length} Durable Job(s) In Progress...
            </span>
          </div>
          <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 border border-amber-400">
            WORKER ACTIVE
          </span>
        </div>
      )}

      {/* Failed Worker Jobs / Service Disruption Banner */}
      {failedJobs.length > 0 && (
        <div className="p-2.5 bg-red-50 border-b border-red-300 text-xs font-mono text-red-900 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Durable Job Disruption Detected ({failedJobs.length})</span>
            </div>
            <button
              onClick={() => retry(failedJobs[0].id)}
              className="text-[9px] bg-red-900 text-white px-2 py-0.5 font-bold uppercase hover:bg-black transition-colors cursor-pointer"
            >
              Retry Failed Job
            </button>
          </div>
          <p className="text-[10px] italic">
            {failedJobs[0].errorInfo?.message || 'Server worker encountered an execution failure.'}
          </p>
        </div>
      )}

      {/* Context Selector Panel */}
      {showContextSelector && selectedCase && (
        <div className="p-3 bg-[#F9F7F5] border-b border-[#1A1A1A] text-xs space-y-2">
          <span className="font-bold uppercase text-[10px] tracking-wider text-[#1A1A1A] block">
            Include Specific Matter Context in AI Query:
          </span>
          <div className="max-h-28 overflow-y-auto space-y-1 bg-white p-2 border border-[#1A1A1A]">
            {documents.length > 0 ? (
              documents.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-slate-50 p-1">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(d.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDocIds(prev => [...prev, d.id]);
                      } else {
                        setSelectedDocIds(prev => prev.filter(id => id !== d.id));
                      }
                    }}
                    className="accent-[#B45309]"
                  />
                  <FileText className="w-3.5 h-3.5 text-[#B45309]" />
                  <span className="truncate">{d.name}</span>
                </label>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 italic">No documents uploaded for this matter yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Human Task Selector */}
      <div className="p-2.5 bg-[#F5F2EF] border-b border-[#1A1A1A]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#B45309] block mb-1.5">
          Select Task to Execute:
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_TASKS.map((t, idx) => {
            const Icon = t.icon;
            return (
              <button
                key={idx}
                onClick={() => handleRunTask(t.taskType, t.op)}
                disabled={isSending}
                className="p-1.5 bg-white hover:bg-[#1A1A1A] hover:text-amber-400 text-[#1A1A1A] border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Icon className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`p-3 max-w-[92%] space-y-2 ${
              m.sender === 'user' 
                ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]' 
                : 'bg-[#F9F7F5] text-[#1A1A1A] border border-[#1A1A1A]'
            }`}>
              <div className="flex items-center justify-between gap-3 text-[9px] font-mono opacity-70 pb-1 border-b border-current/20">
                <span className="font-bold uppercase">{m.sender === 'user' ? 'Advocate' : 'Advocate360 AI'}</span>
                <span>{m.time}</span>
              </div>

              <div className="font-serif text-xs leading-relaxed whitespace-pre-wrap">
                {m.text}
              </div>

              {/* AI Sources & Missing Context Footer */}
              {m.sender === 'ai' && (m.sourcesUsed || m.missingContext) && (
                <div className="pt-2 mt-2 border-t border-[#1A1A1A]/20 text-[10px] space-y-1 font-mono">
                  {m.sourcesUsed && m.sourcesUsed.length > 0 && (
                    <div className="flex items-start gap-1 text-slate-700">
                      <strong className="text-[#B45309]">Sources Used:</strong>
                      <span className="truncate">{m.sourcesUsed.join(', ')}</span>
                    </div>
                  )}

                  {m.missingContext && m.missingContext.length > 0 && (
                    <div className="flex items-start gap-1 text-amber-800">
                      <strong>Missing Context:</strong>
                      <span className="truncate">{m.missingContext.join(', ')}</span>
                    </div>
                  )}

                  {/* Explicit Save Answer Action */}
                  {selectedCase && (
                    <div className="pt-1.5 flex items-center justify-between">
                      <button
                        onClick={() => handleSaveAnswerToMatter(m)}
                        disabled={m.savedToMatter}
                        className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-[#1A1A1A] transition-colors ${
                          m.savedToMatter 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-400 cursor-default'
                            : 'bg-[#1A1A1A] text-amber-400 hover:bg-black cursor-pointer'
                        }`}
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>{m.savedToMatter ? '✓ Saved to Matter' : 'Save Answer to Matter File'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-800 p-2.5 bg-amber-50 border border-amber-300">
            <Sparkles className="w-4 h-4 animate-spin text-[#B45309]" />
            <span>Analyzing legal provisions, matter context & documents...</span>
          </div>
        )}
      </div>

      {/* Input Footer */}
      <div className="p-3 bg-[#F5F2EF] border-t-2 border-[#1A1A1A] space-y-2">
        <div className="flex items-center gap-2">
          <textarea
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Ask about grounds, limitation, precedents, or draft clauses..."
            className="flex-1 p-2 bg-white border border-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={isSending || !inputMsg.trim()}
            className="p-3 bg-[#1A1A1A] hover:bg-black disabled:bg-slate-400 text-amber-400 font-bold border border-[#1A1A1A] transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-slate-500 font-serif italic text-center">
          Note: Untrusted document content is isolated. Advocate review required before court reliance.
        </p>
      </div>

    </div>
  );
};
