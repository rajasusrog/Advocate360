import React, { useState, useEffect } from 'react';
import { 
  StickyNote, 
  Plus, 
  X, 
  Mic, 
  MicOff, 
  FolderPlus, 
  Check, 
  Trash2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Sparkles,
  Volume2,
  FileCheck2,
  Copy,
  Layers,
  ArrowRight
} from 'lucide-react';
import { CaseFile, QuickNote, PracticeTask } from '../types';
import { useVoiceRecorder } from '../lib/useVoiceRecorder';
import { logAuditEvent } from '../lib/auditLogger';

interface QuickNotesDrawerProps {
  cases: CaseFile[];
  selectedCaseId?: string;
  onAssignToCase?: (caseId: string, noteContent: string, noteTitle: string) => void;
  onConvertToTask?: (task: PracticeTask) => void;
}

const STORAGE_KEY = 'adv360_quick_notes';

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({
  cases,
  selectedCaseId,
  onAssignToCase,
  onConvertToTask
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned'>('unassigned');
  
  // Note creation form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'High' | 'Normal' | 'Urgent'>('Normal');
  const [tag, setTag] = useState<QuickNote['tag']>('Urgent Thought');
  const [selectedCaseToAssign, setSelectedCaseToAssign] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [assignDropdownNoteId, setAssignDropdownNoteId] = useState<string | null>(null);

  // Voice recorder hook
  const {
    isRecording,
    transcript,
    setTranscript,
    interimTranscript,
    recordingDuration,
    startRecording,
    stopRecording,
    resetRecording,
    insertSampleCourtDictation,
    error: micError
  } = useVoiceRecorder();

  // Load notes from localStorage
  const [notes, setNotes] = useState<QuickNote[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading quick notes from storage:', e);
    }
    // Default initial seed note so user immediately sees how it functions
    return [
      {
        id: 'qn-init-1',
        title: 'Call Revenue Inspector regarding survey 402/1A',
        content: 'Check whether village adangal reflects 2020 partition sketch or old undivided parent holding before Friday hearing.',
        createdAt: new Date().toISOString(),
        priority: 'High',
        tag: 'Limitation',
        hasAudioTranscription: true
      },
      {
        id: 'qn-init-2',
        title: 'Cross-examination question on cash consideration',
        content: 'Defendant claimed ₹25 Lakhs cash handed over in registrar office. Require income tax returns of purchaser for FY 2024-25.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        priority: 'Urgent',
        tag: 'Strategy'
      }
    ];
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn('Failed saving quick notes to storage:', e);
    }
  }, [notes]);

  // Sync transcript into content
  useEffect(() => {
    if (transcript) {
      setContent(transcript);
    }
  }, [transcript]);

  const unassignedNotes = notes.filter(n => !n.assignedCaseId);
  const assignedNotes = notes.filter(n => !!n.assignedCaseId);

  const handleSaveNote = () => {
    if (!content.trim()) return;

    const newNote: QuickNote = {
      id: `qn-${Date.now()}`,
      title: title.trim() || `Urgent Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      priority,
      tag,
      hasAudioTranscription: isRecording || !!transcript,
      assignedCaseId: selectedCaseToAssign || undefined,
      assignedCaseTitle: selectedCaseToAssign ? cases.find(c => c.id === selectedCaseToAssign)?.title : undefined
    };

    if (newNote.assignedCaseId && onAssignToCase) {
      onAssignToCase(newNote.assignedCaseId, newNote.content, newNote.title);
      logAuditEvent('CASE_UPDATE', `Assigned quick note to matter: ${newNote.assignedCaseTitle}`);
    }

    setNotes(prev => [newNote, ...prev]);
    setTitle('');
    setContent('');
    setTranscript('');
    resetRecording();
    setSelectedCaseToAssign('');
  };

  const handleAssignExistingNote = (noteId: string, caseId: string) => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;

    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          assignedCaseId: caseId,
          assignedCaseTitle: targetCase.title
        };
      }
      return n;
    }));

    const note = notes.find(n => n.id === noteId);
    if (note && onAssignToCase) {
      onAssignToCase(caseId, note.content, note.title);
    }

    logAuditEvent('CASE_UPDATE', `Assigned quick note "${note?.title}" to matter: ${targetCase.title}`);
    setAssignDropdownNoteId(null);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConvertNoteToTask = (note: QuickNote) => {
    if (onConvertToTask) {
      const newTask: PracticeTask = {
        id: `task-${Date.now()}`,
        caseId: note.assignedCaseId,
        title: note.title,
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        priority: note.priority === 'Urgent' ? 'High' : note.priority === 'Normal' ? 'Medium' : 'High',
        status: 'Pending',
        category: note.tag === 'Client Call' ? 'Client Follow-up' : 'Hearing',
        assignedTo: 'Advocate Chamber'
      };
      onConvertToTask(newTask);
      logAuditEvent('CASE_UPDATE', `Converted quick note "${note.title}" into practice task`);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 px-4 py-3 bg-[#1A1A1A] hover:bg-black text-amber-400 border-2 border-amber-500 shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 group ${
            isOpen ? 'ring-4 ring-amber-400/30' : ''
          }`}
          title="Urgent Quick Notes & Voice Dictation"
        >
          <div className="relative">
            <StickyNote className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
            {unassignedNotes.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-black font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {unassignedNotes.length}
              </span>
            )}
          </div>
          <span className="font-serif font-bold italic tracking-wide text-sm hidden sm:inline text-white">
            Quick Notes
          </span>
          <span className="text-[10px] uppercase tracking-widest font-mono text-amber-400/80 border-l border-slate-700 pl-2 hidden md:inline">
            Voice AI
          </span>
        </button>
      </div>

      {/* Floating Slide-over / Modal Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md sm:max-w-lg bg-[#FDFCFB] border-l-2 border-[#1A1A1A] shadow-2xl flex flex-col font-sans text-[#1A1A1A] animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-4 bg-[#1A1A1A] text-white border-b-2 border-[#1A1A1A] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-serif font-bold text-base">
                <StickyNote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif italic font-bold text-base text-amber-300">
                  Quick Notes & Urgent Memos
                </h3>
                <p className="text-[11px] text-slate-300 font-mono">
                  {unassignedNotes.length} unassigned thoughts pending matter mapping
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Capture Input & Voice Dictation */}
          <div className="p-4 bg-[#F5F2EF] border-b-2 border-[#1A1A1A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#B45309] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Instant Thought Capture</span>
              </span>
              
              {/* Voice-to-Text Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                    isRecording
                      ? 'bg-rose-700 text-white border-rose-800 animate-pulse'
                      : 'bg-[#1A1A1A] text-amber-400 hover:bg-black border-[#1A1A1A]'
                  }`}
                  title={isRecording ? 'Stop Voice Recording' : 'Record voice note (Voice-to-Text)'}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-white" />
                      <span>Recording ({recordingDuration}s)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span>Record Voice</span>
                    </>
                  )}
                </button>

                {/* Simulated Dictation fallback for demo */}
                <button
                  type="button"
                  onClick={() => insertSampleCourtDictation()}
                  className="px-2 py-1 bg-white border border-[#1A1A1A] text-[10px] font-bold uppercase text-[#1A1A1A] hover:bg-[#FDFCFB]"
                  title="Simulate Voice-to-Text legal dictation"
                >
                  Sample Dictation
                </button>
              </div>
            </div>

            {/* Error or Recording Banner */}
            {isRecording && (
              <div className="p-2 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span>Listening... Speak in English or Court Terminology</span>
                </div>
                <span className="font-mono font-bold">{recordingDuration}s</span>
              </div>
            )}

            {micError && (
              <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
                {micError}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Note Title / Keyword (e.g., Cross-exam point, Surveyor call)..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-serif font-bold bg-[#FDFCFB] border border-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#B45309]"
              />

              <div className="relative">
                <textarea
                  rows={3}
                  placeholder="Dictate or type urgent matter thought, client instruction, or statutory limitation note..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3 text-xs bg-[#FDFCFB] border border-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#B45309] font-sans resize-none"
                />
                {interimTranscript && (
                  <p className="absolute bottom-2 left-3 right-3 text-[11px] text-slate-500 italic truncate font-mono">
                    Interim: "{interimTranscript}"
                  </p>
                )}
              </div>
            </div>

            {/* Tags and Assignment */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                  Category Tag
                </label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value as any)}
                  className="w-full px-2 py-1 text-xs bg-[#FDFCFB] border border-[#1A1A1A] focus:outline-none cursor-pointer"
                >
                  <option value="Urgent Thought">Urgent Thought</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Limitation">Limitation & Expiry</option>
                  <option value="Court Memo">Court Memo</option>
                  <option value="Client Call">Client Instruction</option>
                  <option value="Evidence Note">Evidence Finding</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                  Map to Matter (Optional)
                </label>
                <select
                  value={selectedCaseToAssign}
                  onChange={(e) => setSelectedCaseToAssign(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-[#FDFCFB] border border-[#1A1A1A] focus:outline-none cursor-pointer truncate"
                >
                  <option value="">Leave Unassigned (Case-Agnostic)</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                {(['Normal', 'High', 'Urgent'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                      priority === p
                        ? p === 'Urgent'
                          ? 'bg-rose-700 text-white border-rose-800'
                          : p === 'High'
                          ? 'bg-[#B45309] text-white border-amber-600'
                          : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!content.trim()}
                className="bg-[#1A1A1A] hover:bg-black disabled:opacity-50 text-amber-400 font-bold px-4 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1.5 border border-[#1A1A1A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Save Note</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b-2 border-[#1A1A1A] bg-[#F9F7F5] text-xs font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`flex-1 py-2.5 px-3 text-center border-r border-[#1A1A1A] transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'unassigned'
                  ? 'bg-[#FDFCFB] text-[#B45309] border-b-2 border-b-transparent'
                  : 'text-slate-600 hover:text-[#1A1A1A]'
              }`}
            >
              <span>Unassigned Thoughts</span>
              <span className="bg-[#1A1A1A] text-white px-1.5 py-0.2 text-[10px] rounded-full font-mono">
                {unassignedNotes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 py-2.5 px-3 text-center transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'assigned'
                  ? 'bg-[#FDFCFB] text-[#B45309] border-b-2 border-b-transparent'
                  : 'text-slate-600 hover:text-[#1A1A1A]'
              }`}
            >
              <span>Assigned to Matters</span>
              <span className="bg-slate-300 text-slate-800 px-1.5 py-0.2 text-[10px] rounded-full font-mono">
                {assignedNotes.length}
              </span>
            </button>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === 'unassigned' && unassignedNotes.length === 0 && (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <Check className="w-8 h-8 mx-auto text-emerald-600" />
                <p className="font-serif italic text-sm text-[#1A1A1A]">No unassigned thoughts pending</p>
                <p className="text-xs">All captured memos have been assigned to specific case matters.</p>
              </div>
            )}

            {activeTab === 'assigned' && assignedNotes.length === 0 && (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <FolderPlus className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-serif italic text-sm text-[#1A1A1A]">No notes mapped yet</p>
                <p className="text-xs">Use the "Assign to Matter" button on any unassigned note to organize it.</p>
              </div>
            )}

            {(activeTab === 'unassigned' ? unassignedNotes : assignedNotes).map((note) => (
              <div
                key={note.id}
                className={`p-3.5 border-2 transition-all space-y-2.5 ${
                  note.priority === 'Urgent'
                    ? 'border-rose-700 bg-rose-50/40'
                    : note.priority === 'High'
                    ? 'border-amber-600 bg-amber-50/30'
                    : 'border-[#1A1A1A] bg-[#FDFCFB]'
                }`}
              >
                {/* Note Top Bar */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                        note.priority === 'Urgent'
                          ? 'bg-rose-700 text-white border-rose-800'
                          : note.priority === 'High'
                          ? 'bg-[#B45309] text-white border-amber-600'
                          : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      }`}>
                        {note.priority}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5">
                        {note.tag}
                      </span>
                      {note.hasAudioTranscription && (
                        <span className="text-[9px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 flex items-center gap-1">
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>Voice AI</span>
                        </span>
                      )}
                    </div>
                    <h4 className="font-serif font-bold italic text-sm text-[#1A1A1A] mt-1">
                      {note.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500">
                    <button
                      onClick={() => handleCopyToClipboard(note.content, note.id)}
                      className="p-1 hover:text-[#1A1A1A]"
                      title="Copy to clipboard"
                    >
                      {copiedId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:text-rose-700"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs text-[#333333] leading-relaxed whitespace-pre-wrap font-sans">
                  {note.content}
                </p>

                {/* Note Meta & Actions */}
                <div className="pt-2 border-t border-slate-300/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1 font-mono text-[10px]">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(note.createdAt).toLocaleDateString()}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Convert to Task */}
                    <button
                      onClick={() => handleConvertNoteToTask(note)}
                      className="text-[10px] uppercase font-bold text-slate-700 hover:text-black flex items-center gap-1 bg-white border border-slate-300 px-1.5 py-0.5"
                      title="Turn this note into an actionable chamber task"
                    >
                      <FileCheck2 className="w-3 h-3 text-[#B45309]" />
                      <span>Task</span>
                    </button>

                    {/* Assign to Matter Button */}
                    {!note.assignedCaseId ? (
                      <div className="relative">
                        <button
                          onClick={() => setAssignDropdownNoteId(assignDropdownNoteId === note.id ? null : note.id)}
                          className="text-[10px] uppercase font-bold text-[#B45309] hover:bg-[#B45309] hover:text-white flex items-center gap-1 bg-amber-50 border border-amber-500 px-2 py-0.5 transition-colors"
                        >
                          <FolderPlus className="w-3 h-3" />
                          <span>Assign Matter</span>
                        </button>

                        {assignDropdownNoteId === note.id && (
                          <div className="absolute right-0 bottom-full mb-1 w-64 bg-[#1A1A1A] border-2 border-amber-500 shadow-xl z-20 p-2 space-y-1">
                            <span className="text-[9px] uppercase font-bold text-amber-400 tracking-wider block border-b border-slate-700 pb-1">
                              Select Case Matter:
                            </span>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {cases.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => handleAssignExistingNote(note.id, c.id)}
                                  className="w-full text-left p-1.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 truncate transition-colors flex items-center justify-between"
                                >
                                  <span className="truncate">{c.title}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0 ml-1 opacity-70" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 border border-emerald-300 truncate max-w-[150px]">
                        ✓ {note.assignedCaseTitle || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Footer Gazette info */}
          <div className="p-3 bg-[#1A1A1A] text-slate-400 text-[10px] font-mono border-t-2 border-[#1A1A1A] flex items-center justify-between">
            <span>Advocate360 Local Thought Vault</span>
            <span className="text-amber-400">Auto-persisted to Chamber State</span>
          </div>

        </div>
      )}
    </>
  );
};
