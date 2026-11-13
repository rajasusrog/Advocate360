import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  HelpCircle, 
  RefreshCw, 
  FileCheck,
  Plus,
  AlertCircle,
  AlertTriangle,
  FolderOpen,
  History,
  CheckCircle2,
  X
} from 'lucide-react';
import { DraftDocument, CrossExamQuestion, CaseFile, ChamberRole } from '../types';
import { apiPost } from '../lib/api';
import { useTranslation, SUPPORTED_LANGUAGES, LanguageCode } from '../lib/multilingualEngine';
import { 
  saveDraftRevisionInDb,
  getLatestDraftForMatterInDb,
  listDraftsForMatterInDb,
  getDraftByIdInDb,
  approveDraftInDb,
  DraftRecord
} from '../lib/useMatterData';

interface DraftingAssistantProps {
  selectedCase?: CaseFile | null;
  chamberId?: string;
  currentRole?: ChamberRole;
}

export const DraftingAssistant: React.FC<DraftingAssistantProps> = ({ 
  selectedCase, 
  chamberId,
  currentRole = 'CHAMBER_OWNER'
}) => {
  const { prefs, updatePreferences } = useTranslation();
  const [activeTab, setActiveTab] = useState<'drafting' | 'cross_exam'>('drafting');

  // Active Matter Reference to prevent delayed requests from Matter A leaking into Matter B
  const activeMatterIdRef = useRef<string | null>(null);

  // Drafting Input State
  const [docType, setDocType] = useState<DraftDocument['type']>('Legal Notice');
  const [draftLanguage, setDraftLanguage] = useState<string>(prefs.draftingLanguage || 'en');

  useEffect(() => {
    if (prefs.draftingLanguage) {
      setDraftLanguage(prefs.draftingLanguage);
    }
  }, [prefs.draftingLanguage]);

  const handleLanguageChange = (newLang: string) => {
    setDraftLanguage(newLang);
    updatePreferences({ draftingLanguage: newLang as LanguageCode });
  };

  const [clientName, setClientName] = useState<string>(() => selectedCase?.clientName || '');
  const [oppositeParty, setOppositeParty] = useState<string>(() => selectedCase?.oppositeParty || '');
  const [facts, setFacts] = useState<string>(() => selectedCase?.summary || '');

  // Active Draft & Persistence State
  const [savedDrafts, setSavedDrafts] = useState<DraftRecord[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState<boolean>(false);

  const [activeDraft, setActiveDraft] = useState<{
    id?: string;
    title: string;
    type: string;
    contentMarkdown: string;
    currentVersion: number;
    approvedVersion: number | null;
    approvedByUserId: string | null;
    approvedAt: string | null;
    status: string;
    createdAt?: string;
    updatedAt?: string;
  } | null>(null);

  // Snapshot of what is authoritative in PostgreSQL
  const [savedSnapshot, setSavedSnapshot] = useState<{
    id?: string;
    title: string;
    contentMarkdown: string;
    currentVersion: number;
    approvedVersion: number | null;
    status: string;
  } | null>(null);

  // Loading & In-flight Action States
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Discard Warning Modal State
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<(() => void) | null>(null);
  const [discardMessage, setDiscardMessage] = useState<string>('');

  // Cross Examination State (starts strictly empty without fictional witness material)
  const [witnessStatement, setWitnessStatement] = useState<string>('');
  const [isGeneratingCross, setIsGeneratingCross] = useState<boolean>(false);
  const [crossQuestions, setCrossQuestions] = useState<CrossExamQuestion[]>([]);

  // Compute whether active draft has unsaved edits compared to authoritative PostgreSQL snapshot
  const hasUnsavedChanges = Boolean(
    activeDraft && (
      !savedSnapshot ||
      activeDraft.title !== savedSnapshot.title ||
      activeDraft.contentMarkdown !== savedSnapshot.contentMarkdown
    )
  );

  // Load drafts and sync matter when selectedCase or chamberId changes
  useEffect(() => {
    const newMatterId = selectedCase?.id || null;
    activeMatterIdRef.current = newMatterId;

    if (selectedCase) {
      setClientName(selectedCase.clientName || '');
      setOppositeParty(selectedCase.oppositeParty || '');
      setFacts(selectedCase.summary || '');
    } else {
      setClientName('');
      setOppositeParty('');
      setFacts('');
    }

    // Reset cross examination when switching matter
    setWitnessStatement('');
    setCrossQuestions([]);
    setStatusMsg('');
    setErrorMsg('');

    if (chamberId && newMatterId) {
      setIsLoadingDrafts(true);
      listDraftsForMatterInDb(chamberId, newMatterId)
        .then((drafts) => {
          if (activeMatterIdRef.current !== newMatterId) return; // Drop stale response
          setSavedDrafts(drafts);
          if (drafts.length > 0) {
            const latest = drafts[0];
            setActiveDraft({
              id: latest.id,
              title: latest.title,
              type: latest.type,
              contentMarkdown: latest.contentMarkdown,
              currentVersion: latest.currentVersion,
              approvedVersion: latest.approvedVersion,
              approvedByUserId: latest.approvedByUserId,
              approvedAt: latest.approvedAt,
              status: latest.status,
              createdAt: latest.createdAt,
              updatedAt: latest.updatedAt,
            });
            setSavedSnapshot({
              id: latest.id,
              title: latest.title,
              contentMarkdown: latest.contentMarkdown,
              currentVersion: latest.currentVersion,
              approvedVersion: latest.approvedVersion,
              status: latest.status,
            });
          } else {
            setActiveDraft(null);
            setSavedSnapshot(null);
          }
        })
        .catch((err) => {
          if (activeMatterIdRef.current !== newMatterId) return;
          console.error('[DraftingAssistant] Error loading drafts from PostgreSQL:', err);
          setErrorMsg(`Failed to load drafts for matter: ${err.message}`);
        })
        .finally(() => {
          if (activeMatterIdRef.current === newMatterId) {
            setIsLoadingDrafts(false);
          }
        });
    } else {
      setSavedDrafts([]);
      setActiveDraft(null);
      setSavedSnapshot(null);
    }
  }, [selectedCase?.id, chamberId]);

  // Safe action executor with unsaved changes confirmation guard
  const requestActionWithUnsavedGuard = (action: () => void, description: string) => {
    if (hasUnsavedChanges) {
      setDiscardMessage(`You have unsaved changes in "${activeDraft?.title || 'Current Draft'}". Discarding will permanently lose these modifications.`);
      setPendingDiscardAction(() => action);
      setShowDiscardModal(true);
    } else {
      action();
    }
  };

  const handleConfirmDiscard = () => {
    if (pendingDiscardAction) {
      pendingDiscardAction();
    }
    setShowDiscardModal(false);
    setPendingDiscardAction(null);
  };

  const handleCancelDiscard = () => {
    setShowDiscardModal(false);
    setPendingDiscardAction(null);
  };

  // Reload an existing saved draft from PostgreSQL
  const handleSelectDraft = (draftId: string) => {
    requestActionWithUnsavedGuard(async () => {
      if (!chamberId || !selectedCase?.id) return;
      try {
        const loaded = await getDraftByIdInDb(chamberId, draftId);
        if (loaded) {
          setActiveDraft({
            id: loaded.id,
            title: loaded.title,
            type: loaded.type,
            contentMarkdown: loaded.contentMarkdown,
            currentVersion: loaded.currentVersion,
            approvedVersion: loaded.approvedVersion,
            approvedByUserId: loaded.approvedByUserId,
            approvedAt: loaded.approvedAt,
            status: loaded.status,
            createdAt: loaded.createdAt,
            updatedAt: loaded.updatedAt,
          });
          setSavedSnapshot({
            id: loaded.id,
            title: loaded.title,
            contentMarkdown: loaded.contentMarkdown,
            currentVersion: loaded.currentVersion,
            approvedVersion: loaded.approvedVersion,
            status: loaded.status,
          });
          setStatusMsg(`Loaded draft "${loaded.title}" (Revision v${loaded.currentVersion}.0) from PostgreSQL.`);
          setErrorMsg('');
        }
      } catch (err: any) {
        setErrorMsg(`Failed to load draft from PostgreSQL: ${err.message}`);
      }
    }, 'load another draft');
  };

  // Start a fresh draft in the editor
  const handleStartNewDraft = () => {
    requestActionWithUnsavedGuard(() => {
      setActiveDraft({
        title: `${docType} - ${selectedCase?.title || 'Draft'}`,
        type: docType,
        contentMarkdown: '',
        currentVersion: 1,
        approvedVersion: null,
        approvedByUserId: null,
        approvedAt: null,
        status: 'Draft',
      });
      setSavedSnapshot(null);
      setStatusMsg('Started new blank draft. Fill facts and generate or draft directly in the editor.');
      setErrorMsg('');
    }, 'start a new draft');
  };

  // AI Draft Generation
  const handleGenerateDraft = async () => {
    if (!facts.trim()) {
      setErrorMsg('Please provide facts and grounds summary to generate a draft.');
      return;
    }
    if (!selectedCase?.id || !chamberId) {
      setErrorMsg('Active matter and chamber scope are required for legal drafting.');
      return;
    }

    requestActionWithUnsavedGuard(async () => {
      const currentReqMatterId = selectedCase.id;
      setIsDrafting(true);
      setStatusMsg('');
      setErrorMsg('');

      try {
        const data = await apiPost<DraftDocument>('/api/ai/draft', {
          chamberId,
          workspaceId: chamberId,
          matterId: selectedCase.id,
          caseId: selectedCase.id,
          docType,
          facts,
          clientName: clientName.trim(),
          oppositeParty: oppositeParty.trim(),
          language: draftLanguage,
        });

        // Drop response if user switched matters while generation was in-flight
        if (activeMatterIdRef.current !== currentReqMatterId) {
          return;
        }

        if (data && (data.contentMarkdown || data.title)) {
          const generatedTitle = data.title || `${docType} - ${selectedCase.title}`;
          const generatedContent = data.contentMarkdown || '';

          setActiveDraft(prev => ({
            id: prev?.id, // Preserve existing draft ID if revising current draft
            title: generatedTitle,
            type: data.type || docType,
            contentMarkdown: generatedContent,
            currentVersion: prev ? prev.currentVersion : 1,
            approvedVersion: null,
            approvedByUserId: null,
            approvedAt: null,
            status: 'Draft',
          }));

          setStatusMsg(`✓ Generated AI court draft. Review, edit in the live editor below, and save to Matter Vault.`);
        } else {
          throw new Error('AI service returned empty draft response.');
        }
      } catch (err: any) {
        if (activeMatterIdRef.current !== currentReqMatterId) return;
        console.error('[DraftingAssistant] AI Drafting Error:', err);
        setErrorMsg(err.message || 'AI drafting request failed. User inputs have been preserved.');
      } finally {
        if (activeMatterIdRef.current === currentReqMatterId) {
          setIsDrafting(false);
        }
      }
    }, 'generate a new AI draft');
  };

  // Content change in editor
  const handleContentChange = (newContent: string) => {
    if (!activeDraft) {
      setActiveDraft({
        title: `${docType} - ${selectedCase?.title || 'Draft'}`,
        type: docType,
        contentMarkdown: newContent,
        currentVersion: 1,
        approvedVersion: null,
        approvedByUserId: null,
        approvedAt: null,
        status: 'Draft',
      });
      return;
    }

    setActiveDraft(prev => prev ? ({
      ...prev,
      contentMarkdown: newContent,
      // Unsaved edit immediately invalidates approval status in UI
      status: 'Draft',
      approvedVersion: null,
      approvedByUserId: null,
      approvedAt: null,
    }) : null);
  };

  // Title change in editor
  const handleTitleChange = (newTitle: string) => {
    if (!activeDraft) return;
    setActiveDraft(prev => prev ? ({
      ...prev,
      title: newTitle,
      status: 'Draft',
      approvedVersion: null,
      approvedByUserId: null,
      approvedAt: null,
    }) : null);
  };

  // Transactional Save Revision with Optimistic Concurrency and Safe Retry Idempotency
  const handleSaveToMatterVault = async () => {
    if (!activeDraft || !selectedCase?.id || !chamberId) return;
    if (!activeDraft.title.trim()) {
      setErrorMsg('Draft title cannot be empty.');
      return;
    }

    setIsSaving(true);
    setStatusMsg('');
    setErrorMsg('');

    // Generate cryptographic operation ID for this revision save operation
    const operationId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `draft-op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const saved = await saveDraftRevisionInDb(chamberId, selectedCase.id, {
        id: activeDraft.id,
        title: activeDraft.title,
        type: activeDraft.type || docType,
        contentMarkdown: activeDraft.contentMarkdown || '',
        expectedVersion: savedSnapshot?.currentVersion ?? undefined,
        changeNotes: activeDraft.id 
          ? `Revision v${(savedSnapshot?.currentVersion || 1) + 1} updated from editor` 
          : 'Initial draft revision v1',
        operationId,
      });

      // Update authoritative snapshot and active draft state
      setActiveDraft({
        id: saved.id,
        title: saved.title,
        type: saved.type,
        contentMarkdown: saved.contentMarkdown,
        currentVersion: saved.currentVersion,
        approvedVersion: saved.approvedVersion,
        approvedByUserId: saved.approvedByUserId,
        approvedAt: saved.approvedAt,
        status: saved.status,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      setSavedSnapshot({
        id: saved.id,
        title: saved.title,
        contentMarkdown: saved.contentMarkdown,
        currentVersion: saved.currentVersion,
        approvedVersion: saved.approvedVersion,
        status: saved.status,
      });

      // Refresh saved drafts list for current matter
      const updatedList = await listDraftsForMatterInDb(chamberId, selectedCase.id);
      setSavedDrafts(updatedList);

      setStatusMsg(`✓ Saved Revision v${saved.currentVersion}.0 transactionally to PostgreSQL Matter Vault.`);
    } catch (err: any) {
      console.error('[DraftingAssistant] Save revision error:', err);
      setErrorMsg(err.message || 'Failed to save draft revision in PostgreSQL.');
    } finally {
      setIsSaving(false);
    }
  };

  // Explicit Revision Approval
  const handleApproveDraft = async () => {
    if (!activeDraft || !selectedCase?.id || !chamberId) return;

    if (!activeDraft.id) {
      setErrorMsg('This draft must be saved to the database before it can be approved.');
      return;
    }

    if (hasUnsavedChanges) {
      setErrorMsg(`Unsaved changes detected. Please save revision v${activeDraft.currentVersion + 1}.0 before approving.`);
      return;
    }

    setIsApproving(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const approved = await approveDraftInDb(
        chamberId,
        activeDraft.id,
        activeDraft.currentVersion
      );

      setActiveDraft({
        id: approved.id,
        title: approved.title,
        type: approved.type,
        contentMarkdown: approved.contentMarkdown,
        currentVersion: approved.currentVersion,
        approvedVersion: approved.approvedVersion,
        approvedByUserId: approved.approvedByUserId,
        approvedAt: approved.approvedAt,
        status: approved.status,
        createdAt: approved.createdAt,
        updatedAt: approved.updatedAt,
      });

      setSavedSnapshot({
        id: approved.id,
        title: approved.title,
        contentMarkdown: approved.contentMarkdown,
        currentVersion: approved.currentVersion,
        approvedVersion: approved.approvedVersion,
        status: approved.status,
      });

      // Refresh list
      const updatedList = await listDraftsForMatterInDb(chamberId, selectedCase.id);
      setSavedDrafts(updatedList);

      setStatusMsg(`✓ Revision v${approved.approvedVersion}.0 Approved & Legally Bound in PostgreSQL by Advocate.`);
    } catch (err: any) {
      console.error('[DraftingAssistant] Approve draft error:', err);
      setErrorMsg(err.message || 'Failed to approve draft. Enforce approval permissions in database.');
    } finally {
      setIsApproving(false);
    }
  };

  // Cross Examination Generation
  const handleGenerateCross = async () => {
    if (!witnessStatement.trim()) {
      setErrorMsg('Please enter a witness statement or deposition excerpt to generate questions.');
      return;
    }
    if (!selectedCase?.id || !chamberId) {
      setErrorMsg('Active matter and chamber scope are required for cross-examination.');
      return;
    }

    const currentReqMatterId = selectedCase.id;
    setIsGeneratingCross(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const data = await apiPost<{ questions: CrossExamQuestion[] }>('/api/ai/cross-examination', {
        chamberId,
        workspaceId: chamberId,
        matterId: selectedCase.id,
        caseId: selectedCase.id,
        witnessStatement: witnessStatement.trim(),
        caseContext: selectedCase.summary || '',
      });

      if (activeMatterIdRef.current !== currentReqMatterId) return;

      if (data && Array.isArray(data.questions)) {
        setCrossQuestions(data.questions);
        setStatusMsg(`✓ Formulated ${data.questions.length} tactical cross-examination questions from witness statement.`);
      } else {
        throw new Error('AI service returned invalid cross-examination questions payload.');
      }
    } catch (err: any) {
      if (activeMatterIdRef.current !== currentReqMatterId) return;
      console.error('[DraftingAssistant] Cross Exam Error:', err);
      setErrorMsg(err.message || 'Failed to generate cross-examination questions. Witness statement was preserved.');
    } finally {
      if (activeMatterIdRef.current === currentReqMatterId) {
        setIsGeneratingCross(false);
      }
    }
  };

  const handleCopyDraft = () => {
    if (!activeDraft?.contentMarkdown) return;
    navigator.clipboard.writeText(activeDraft.contentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine effective status badge
  const renderStatusBadge = () => {
    if (!activeDraft) return null;

    if (hasUnsavedChanges) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-500 shadow-xs">
          <AlertTriangle className="w-3 h-3 text-amber-700" />
          <span>Unsaved changes (Editing v{activeDraft.currentVersion}.0)</span>
        </span>
      );
    }

    if (activeDraft.status === 'Approved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-600 shadow-xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          <span>Approved (Revision v{activeDraft.approvedVersion}.0)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-400 shadow-xs">
        <FileText className="w-3 h-3 text-slate-600" />
        <span>Draft Saved (Revision v{activeDraft.currentVersion}.0)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Features #4 & #12 • Legal Drafting & AI Cross-Examination</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Legal Drafting & Cross-Examination Desk</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Transactional draft persistence, immutable revisions, and judicial approval tracking in PostgreSQL.
              {selectedCase ? ` Active Matter: "${selectedCase.title}"` : ' Select a matter to begin drafting.'}
            </p>
          </div>

          <div className="flex items-center bg-[#1A1A1A] p-1 border border-[#1A1A1A]">
            <button
              onClick={() => setActiveTab('drafting')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'drafting' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Drafting Desk
            </button>
            <button
              onClick={() => setActiveTab('cross_exam')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === 'cross_exam' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
              }`}
            >
              Cross-Exam AI
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {statusMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-500/80 text-emerald-950 p-4 text-xs font-mono flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span><strong>Status:</strong> {statusMsg}</span>
          </div>
          <button
            onClick={() => setStatusMsg('')}
            className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 hover:text-black px-2 py-1 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="bg-rose-50 border-2 border-rose-500/80 text-rose-950 p-4 text-xs font-mono flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Error:</strong> {errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-[10px] font-bold uppercase tracking-wider text-rose-900 hover:text-black px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DRAFTING TAB */}
      {activeTab === 'drafting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Draft Configuration & Saved Drafts List */}
          <div className="lg:col-span-4 space-y-4">
            {/* Generator Form */}
            <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">Draft Parameters</span>
                <button
                  onClick={handleStartNewDraft}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:text-black cursor-pointer"
                  title="Clear editor and start new draft"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Blank Draft</span>
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                  Document Type:
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-bold focus:outline-none"
                >
                  <option value="Legal Notice">Legal Notice</option>
                  <option value="Plaint / Petition">Plaint / Petition for Suit</option>
                  <option value="Affidavit">Sworn Affidavit</option>
                  <option value="Written Statement">Written Statement (Defense)</option>
                  <option value="Bail Application">Bail Application</option>
                  <option value="Injunction Application">Injunction Application (Order 39)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                  Drafting Output Language:
                </label>
                <select
                  value={draftLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono font-bold focus:outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Client Name:</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter client name"
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Opposite Party:</label>
                  <input
                    type="text"
                    value={oppositeParty}
                    onChange={(e) => setOppositeParty(e.target.value)}
                    placeholder="Enter opposite party"
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
                  Facts & Grounds Summary:
                </label>
                <textarea
                  value={facts}
                  onChange={(e) => setFacts(e.target.value)}
                  placeholder="Summarize key facts, dates, breaches, property particulars, or relief sought..."
                  rows={6}
                  className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleGenerateDraft}
                disabled={isDrafting || !facts.trim() || !selectedCase?.id}
                className="w-full bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs py-3 border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDrafting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Drafting Legal Document...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Generate Court Draft</span>
                  </>
                )}
              </button>
            </div>

            {/* Saved Drafts List for this Matter */}
            <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>Saved Matter Drafts ({savedDrafts.length})</span>
                </span>
                {isLoadingDrafts && <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />}
              </div>

              {savedDrafts.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No saved drafts in this matter yet. Generate or compose and save your first revision.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {savedDrafts.map((d) => {
                    const isSelected = activeDraft?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => handleSelectDraft(d.id)}
                        className={`w-full text-left p-2.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                            : 'bg-[#F9F7F5] hover:bg-amber-50 text-[#1A1A1A] border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-[10px] font-bold uppercase truncate ${isSelected ? 'text-amber-400' : 'text-amber-800'}`}>
                            {d.type || 'Pleading'}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 border ${
                            d.status === 'Approved'
                              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500'
                              : isSelected
                              ? 'bg-white/10 text-slate-300 border-slate-500'
                              : 'bg-slate-200 text-slate-700 border-slate-400'
                          }`}>
                            v{d.currentVersion}.0 {d.status === 'Approved' ? '• Approved' : ''}
                          </span>
                        </div>
                        <p className={`text-xs font-serif font-bold truncate ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>
                          {d.title}
                        </p>
                        <span className={`text-[9px] font-mono block mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                          Updated {d.updatedAt ? d.updatedAt.split('T')[0] : 'today'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Editor Output */}
          <div className="lg:col-span-8 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            {activeDraft ? (
              <div className="space-y-4">
                {/* Header Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1A1A1A] pb-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309]">
                        {activeDraft.type || docType}
                      </span>
                      {renderStatusBadge()}
                    </div>

                    <input
                      type="text"
                      value={activeDraft.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Draft Document Title"
                      className="font-serif italic font-bold text-lg text-[#1A1A1A] bg-transparent border-b border-dashed border-slate-300 hover:border-black focus:border-black focus:outline-none w-full"
                      title="Draft Title (editing title invalidates approval)"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Save Revision Button */}
                    <button
                      onClick={handleSaveToMatterVault}
                      disabled={isSaving}
                      className="bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-[#1A1A1A] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      title={activeDraft.id ? `Save as Revision v${(savedSnapshot?.currentVersion || 1) + 1}.0` : 'Save initial revision v1.0'}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Saving Revision...</span>
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>{activeDraft.id ? `Save Revision v${(savedSnapshot?.currentVersion || 1) + 1}.0` : 'Save Draft v1.0'}</span>
                        </>
                      )}
                    </button>

                    {/* Approve Revision Button */}
                    <button
                      onClick={handleApproveDraft}
                      disabled={isApproving || hasUnsavedChanges || !activeDraft.id || activeDraft.status === 'Approved'}
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 border flex items-center gap-1.5 transition-colors shadow-xs ${
                        hasUnsavedChanges || !activeDraft.id || activeDraft.status === 'Approved'
                          ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                          : 'bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-900 cursor-pointer'
                      }`}
                      title={
                        hasUnsavedChanges
                          ? 'Save your changes before approving'
                          : !activeDraft.id
                          ? 'Save draft before approving'
                          : activeDraft.status === 'Approved'
                          ? `Revision v${activeDraft.approvedVersion}.0 is already approved`
                          : `Approve Revision v${activeDraft.currentVersion}.0`
                      }
                    >
                      {isApproving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {activeDraft.status === 'Approved' && !hasUnsavedChanges
                          ? 'Revision Approved'
                          : `Approve v${activeDraft.currentVersion}.0`}
                      </span>
                    </button>

                    <button
                      onClick={handleCopyDraft}
                      className="bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-amber-400 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="bg-[#1A1A1A] text-amber-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-[#1A1A1A] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Formatted Textarea / Document Live Editor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    <span>Draft Document Body (Live Editor)</span>
                    <span>
                      {activeDraft.contentMarkdown.trim() 
                        ? `${activeDraft.contentMarkdown.trim().split(/\s+/).length} words • ${activeDraft.contentMarkdown.length} chars` 
                        : '0 words'}
                    </span>
                  </div>

                  <textarea
                    value={activeDraft.contentMarkdown}
                    onChange={(e) => handleContentChange(e.target.value)}
                    rows={18}
                    className="w-full p-4 bg-[#F9F7F5] border border-[#1A1A1A] font-serif text-[#1A1A1A] text-xs whitespace-pre-wrap leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
                    placeholder="Compose or paste legal document body here. Edits invalidate prior approval and require explicit revision saving..."
                  />
                </div>

                {/* Footer Metadata */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-200 pt-2">
                  <span>
                    Immutable Versions in PostgreSQL: {activeDraft.currentVersion} revision{activeDraft.currentVersion > 1 ? 's' : ''}
                  </span>
                  <span>
                    {activeDraft.approvedAt 
                      ? `Approved on ${activeDraft.approvedAt.split('T')[0]}` 
                      : 'Pending Advocate Approval'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 text-[#555555]">
                <FileText className="w-12 h-12 text-[#1A1A1A] mb-3" />
                <p className="text-sm font-serif italic font-bold">No draft active in editor.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Select a saved draft from the list on the left, or enter facts and click "Generate Court Draft", or start a new blank draft.
                </p>
                <button
                  onClick={handleStartNewDraft}
                  className="mt-4 px-3 py-1.5 bg-[#1A1A1A] text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] cursor-pointer"
                >
                  Start Blank Draft
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CROSS EXAMINATION SUB TAB */}
      {activeTab === 'cross_exam' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-2">
                Witness Statement / Deposition Excerpt:
              </label>
              <textarea
                value={witnessStatement}
                onChange={(e) => setWitnessStatement(e.target.value)}
                placeholder="Enter or paste witness deposition, chief affidavit, or adverse testimony here..."
                rows={9}
                className="w-full p-3 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleGenerateCross}
              disabled={isGeneratingCross || !witnessStatement.trim() || !selectedCase?.id}
              className="w-full bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs py-3 border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingCross ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Formulating Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generate Cross-Exam Questions</span>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
              <HelpCircle className="w-4 h-4 text-[#B45309]" />
              <span>Tactical Courtroom Questions ({crossQuestions.length})</span>
            </h3>

            {crossQuestions.length === 0 ? (
              <div className="min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <HelpCircle className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs font-serif italic font-bold">No cross-examination questions generated yet.</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Paste the adverse witness's examination-in-chief or deposition on the left to extract contradictions, impeachment targets, and questions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {crossQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 bg-[#F9F7F5] border border-[#1A1A1A]/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#B45309] uppercase tracking-wider text-[10px]">{q.category}</span>
                      <span className="text-[10px] text-[#1A1A1A] font-mono font-bold">{q.targetContradictionOrDoc}</span>
                    </div>
                    <p className="font-serif italic font-bold text-sm text-[#1A1A1A]">"{q.question}"</p>
                    <p className="text-[#555555] italic">💡 <strong>Tactical Objective:</strong> {q.objective}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discard Unsaved Changes Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">Unsaved Draft Changes</h3>
            </div>
            <p className="text-xs text-[#555555] leading-relaxed">
              {discardMessage}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleCancelDiscard}
                className="px-4 py-2 border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider bg-[#F5F2EF] hover:bg-slate-200 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-4 py-2 border border-rose-800 text-xs font-bold uppercase tracking-wider bg-rose-700 hover:bg-rose-800 text-white cursor-pointer"
              >
                Discard &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
