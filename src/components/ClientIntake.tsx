import React, { useState } from 'react';
import { 
  UserPlus, 
  Sparkles, 
  Send, 
  Clock, 
  Users, 
  AlertCircle, 
  FileCheck, 
  CheckCircle, 
  ArrowRight, 
  Copy, 
  Check,
  RefreshCw,
  FolderPlus,
  ShieldAlert,
  Save,
  Scale,
  X
} from 'lucide-react';
import { IntakeData, CaseFile } from '../types';
import { SAMPLE_INTAKE } from '../data/landingDemoData';
import { apiPost } from '../lib/api';
import { legalIntelligenceEngine, UniversalLegalAnalysis } from '../lib/legalIntelligenceEngine';
import { Brain } from 'lucide-react';
import { logAuditEvent } from '../lib/auditLogger';

interface ClientIntakeProps {
  cases?: CaseFile[];
  chamberId?: string;
  onAddCaseFromIntake: (intake: IntakeData & { chamberId?: string }) => void;
}

export type ConflictDecision = 'pending' | 'cleared' | 'flagged' | 'blocked';

export const ClientIntake: React.FC<ClientIntakeProps> = ({ cases = [], chamberId, onAddCaseFromIntake }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [oppositeParty, setOppositeParty] = useState<string>('');
  const [keyWitnesses, setKeyWitnesses] = useState<string>('');
  
  const [rawStory, setRawStory] = useState<string>('');
  const [jurisdiction, setJurisdiction] = useState<string>('Tamil Nadu / High Court & City Civil Court');
  const [caseType, setCaseType] = useState<string>('Property Dispute');
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [intakeResult, setIntakeResult] = useState<IntakeData | null>(null);
  const [uleAnalysis, setUleAnalysis] = useState<UniversalLegalAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [savedDraftNotice, setSavedDraftNotice] = useState<string | null>(null);

  // Conflict Checking State
  const [conflictMatches, setConflictMatches] = useState<Array<{ caseId: string; title: string; matchedParty: string; matchType: 'client' | 'opposite' }>>([]);
  const [humanConflictDecision, setHumanConflictDecision] = useState<ConflictDecision>('pending');
  const [conflictNotes, setConflictNotes] = useState<string>('');

  // Save Incomplete Intake Draft
  const handleSaveIncompleteDraft = () => {
    try {
      const draftPayload = {
        clientName,
        clientPhone,
        clientEmail,
        oppositeParty,
        keyWitnesses,
        rawStory,
        jurisdiction,
        caseType,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('adv360_intake_draft', JSON.stringify(draftPayload));
      setSavedDraftNotice('✓ Incomplete intake draft saved to chamber storage.');
      logAuditEvent('CASE_CREATE', `Saved incomplete intake draft for client: "${clientName || 'Unnamed Client'}"`);
      setTimeout(() => setSavedDraftNotice(null), 3000);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  // Run Conflict Search
  const handleRunConflictCheck = () => {
    const matches: Array<{ caseId: string; title: string; matchedParty: string; matchType: 'client' | 'opposite' }> = [];
    const searchClient = clientName.trim().toLowerCase();
    const searchOpposite = oppositeParty.trim().toLowerCase();

    cases.forEach(c => {
      if (searchClient && c.clientName?.toLowerCase().includes(searchClient)) {
        matches.push({ caseId: c.id, title: c.title, matchedParty: c.clientName, matchType: 'client' });
      }
      if (searchOpposite && c.oppositeParty?.toLowerCase().includes(searchOpposite)) {
        matches.push({ caseId: c.id, title: c.title, matchedParty: c.oppositeParty, matchType: 'opposite' });
      }
      if (searchOpposite && c.clientName?.toLowerCase().includes(searchOpposite)) {
        matches.push({ caseId: c.id, title: c.title, matchedParty: c.clientName, matchType: 'opposite' });
      }
    });

    setConflictMatches(matches);
    setCurrentStep(3);
  };

  const handleAnalyzeIntake = async () => {
    if (!rawStory.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg('');

    try {
      const uleData = legalIntelligenceEngine.analyzeFacts(rawStory);
      setUleAnalysis(uleData);

      try {
        const data = await apiPost<IntakeData>('/api/ai/intake', { rawStory });
        if (data && (data.caseType || data.parties)) {
          const sanitizedIntake: IntakeData = {
            rawStory: rawStory,
            caseType: data.caseType || caseType || uleData.primaryDomain,
            parties: {
              client: clientName || data.parties?.client || 'Client / Petitioner',
              oppositeParty: oppositeParty || data.parties?.oppositeParty || 'Opposite Party / Respondent',
              keyWitnesses: Array.isArray(data.parties?.keyWitnesses) ? data.parties.keyWitnesses : []
            },
            timeline: Array.isArray(data.timeline) ? data.timeline : [{ date: uleData.triggerEvent.eventDate, event: uleData.triggerEvent.description }],
            importantDates: Array.isArray(data.importantDates) ? data.importantDates : [],
            missingInformation: Array.isArray(data.missingInformation) ? data.missingInformation : uleData.evidenceMatrix.missingEvidence.map(m => `${m.documentName}: ${m.reasonWhyNeeded}`),
            requiredDocuments: Array.isArray(data.requiredDocuments) ? data.requiredDocuments : uleData.evidenceMatrix.availableEvidence,
            suggestedAction: data.suggestedAction || uleData.recommendedRemedies[0]?.title || 'Review core documents and prepare legal notice.'
          };
          setIntakeResult(sanitizedIntake);
          if (sanitizedIntake.parties.client && !clientName) setClientName(sanitizedIntake.parties.client);
          if (sanitizedIntake.parties.oppositeParty && !oppositeParty) setOppositeParty(sanitizedIntake.parties.oppositeParty);
          return;
        }
      } catch (apiErr: any) {
        const fallbackIntake: IntakeData = {
          rawStory: rawStory,
          caseType: caseType || `${uleData.primaryDomain} - ${uleData.coreIssueTitle}`,
          parties: {
            client: clientName || uleData.relationshipGraph.nodes.find(n => n.type === 'Person')?.name || 'Aggrieved Client',
            oppositeParty: oppositeParty || uleData.relationshipGraph.nodes.find(n => n.type === 'Person' && n.id !== 'node-1')?.name || 'Opposite Party',
            keyWitnesses: uleData.relationshipGraph.nodes.filter(n => n.type === 'Person').map(n => n.name)
          },
          timeline: [{ date: uleData.triggerEvent.eventDate, event: uleData.triggerEvent.description }],
          importantDates: [],
          missingInformation: uleData.evidenceMatrix.missingEvidence.map(m => `${m.documentName}: ${m.reasonWhyNeeded}`),
          requiredDocuments: uleData.evidenceMatrix.availableEvidence,
          suggestedAction: uleData.recommendedRemedies[0]?.title || `Initiate proceedings before ${uleData.recommendedAuthorities[0]?.authorityName || 'Competent Court'}.`
        };
        setIntakeResult(fallbackIntake);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process intake statement.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalizeMatterSetup = () => {
    if (humanConflictDecision === 'blocked') {
      alert('Cannot create matter: Conflict review decision is BLOCKED.');
      return;
    }

    const finalIntake: IntakeData = intakeResult || {
      rawStory,
      caseType,
      parties: {
        client: clientName || 'Client / Petitioner',
        oppositeParty: oppositeParty || 'Opposite Party / Respondent',
        keyWitnesses: keyWitnesses ? keyWitnesses.split(',') : []
      },
      timeline: [{ date: new Date().toISOString().split('T')[0], event: 'Intake initiated' }],
      importantDates: [],
      missingInformation: [],
      requiredDocuments: ['Parent Deed / Contract Agreement'],
      suggestedAction: 'Initial consultation and notice drafting'
    };

    // Idempotent creation call with workspace scope attached
    onAddCaseFromIntake({ ...finalIntake, chamberId });
    logAuditEvent('CASE_CREATE', `Created active matter file via intake wizard for client: ${clientName}`, { chamberId });
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      {/* Header Banner */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Operational Workflow • Client Intake & Matter Creation Wizard</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Client Intake, Conflict Check & Matter Setup</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Structured 4-step intake pipeline: Client & Opposing Parties → Story & Jurisdiction → Human Conflict Review → Idempotent Matter Creation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveIncompleteDraft}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#1A1A1A] font-bold uppercase text-xs border border-[#1A1A1A] flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Save Incomplete Intake</span>
            </button>
          </div>
        </div>
      </div>

      {savedDraftNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-400 text-emerald-900 font-mono text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{savedDraftNotice}</span>
        </div>
      )}

      {/* 4-Step Intake Stepper Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <button
          onClick={() => setCurrentStep(1)}
          className={`p-3 border-2 text-left flex items-center gap-2 ${
            currentStep === 1 ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-bold text-[10px]">1</span>
          <span className="font-bold uppercase tracking-wider text-[10px] truncate">1. Client & Parties</span>
        </button>

        <button
          onClick={() => setCurrentStep(2)}
          className={`p-3 border-2 text-left flex items-center gap-2 ${
            currentStep === 2 ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-bold text-[10px]">2</span>
          <span className="font-bold uppercase tracking-wider text-[10px] truncate">2. Issue & Story</span>
        </button>

        <button
          onClick={() => setCurrentStep(3)}
          className={`p-3 border-2 text-left flex items-center gap-2 ${
            currentStep === 3 ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-bold text-[10px]">3</span>
          <span className="font-bold uppercase tracking-wider text-[10px] truncate">3. Conflict Review</span>
        </button>

        <button
          onClick={() => setCurrentStep(4)}
          className={`p-3 border-2 text-left flex items-center gap-2 ${
            currentStep === 4 ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/40'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center font-bold text-[10px]">4</span>
          <span className="font-bold uppercase tracking-wider text-[10px] truncate">4. Matter Setup</span>
        </button>
      </div>

      {/* STEP 1: CLIENT & OPPOSING PARTIES */}
      {currentStep === 1 && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 space-y-4">
          <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A] border-b border-[#1A1A1A] pb-2">
            Step 1: Client & Opposing Parties Particulars
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Client Full Name:*
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Client Phone Number:
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Client Email Address:
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="ramesh@example.com"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Opposite Party Name(s):*
              </label>
              <input
                type="text"
                value={oppositeParty}
                onChange={(e) => setOppositeParty(e.target.value)}
                placeholder="e.g. Suresh Kumar & M/s Star Builders"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Key Witnesses / Related Persons:
              </label>
              <input
                type="text"
                value={keyWitnesses}
                onChange={(e) => setKeyWitnesses(e.target.value)}
                placeholder="Comma separated names"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-[#1A1A1A]">
            <button
              onClick={handleSaveIncompleteDraft}
              className="text-xs font-mono text-[#B45309] underline hover:text-black"
            >
              Save Draft Incomplete
            </button>
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!clientName.trim()}
              className="px-5 py-2.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A] hover:bg-black disabled:opacity-50 flex items-center gap-2"
            >
              <span>Next: Issue & Narrative</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ISSUE & NARRATIVE */}
      {currentStep === 2 && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 space-y-4">
          <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A] border-b border-[#1A1A1A] pb-2">
            Step 2: Legal Issue & Client Story Narrative
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Case Category:*
              </label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              >
                <option value="Property Dispute">Property Dispute</option>
                <option value="Contract & Recovery">Contract & Recovery</option>
                <option value="Criminal / FIR">Criminal / FIR</option>
                <option value="Family & Matrimonial">Family & Matrimonial</option>
                <option value="Corporate & Civil">Corporate & Civil</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
                Jurisdiction / Forum:
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
              Unstructured Story / Voice Transcript:*
            </label>
            <textarea
              value={rawStory}
              onChange={(e) => setRawStory(e.target.value)}
              rows={6}
              placeholder="Paste or type raw story statement..."
              className="w-full p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyzeIntake}
              disabled={isAnalyzing || !rawStory.trim()}
              className="px-4 py-2.5 bg-[#1A1A1A] text-white hover:bg-black font-bold uppercase text-xs border border-[#1A1A1A] flex items-center gap-2"
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
              <span>{isAnalyzing ? 'Extracting...' : 'Extract Intelligence via AI'}</span>
            </button>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-[#1A1A1A]">
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs font-mono text-[#555555] hover:text-black"
            >
              ← Back to Client Details
            </button>

            <button
              onClick={handleRunConflictCheck}
              className="px-5 py-2.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A] hover:bg-black flex items-center gap-2"
            >
              <span>Next: Conflict Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFLICT REVIEW */}
      {currentStep === 3 && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#B45309]" />
              <span>Step 3: Conflict of Interest Search & Human Review</span>
            </h2>
            <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 font-bold uppercase border border-amber-800">
              Mandatory Human Decision Required
            </span>
          </div>

          <p className="text-xs text-[#555555]">
            Advocate360 scanned existing chamber matters for matches against client <strong>"{clientName}"</strong> and opposing party <strong>"{oppositeParty}"</strong>.
          </p>

          {conflictMatches.length > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-400 space-y-3 text-xs">
              <span className="font-bold text-[#B45309] uppercase text-[10px] block">
                ⚠️ Potential Conflict Matches Identified ({conflictMatches.length}):
              </span>
              <div className="space-y-2">
                {conflictMatches.map((m, idx) => (
                  <div key={idx} className="p-2.5 bg-white border border-amber-300 font-mono text-[11px] flex justify-between items-center">
                    <div>
                      <strong>Matched Matter:</strong> {m.title} (ID: {m.caseId})
                    </div>
                    <span className="text-amber-800 font-bold uppercase">
                      Match: {m.matchedParty} ({m.matchType})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-400 text-emerald-900 text-xs font-mono flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>No direct name matches found in existing chamber matters. Human advocate decision still required.</span>
            </div>
          )}

          {/* Explicit Human Decision Buttons */}
          <div className="space-y-2 pt-2">
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block">
              Record Authoritative Human Conflict Decision:*
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                onClick={() => setHumanConflictDecision('cleared')}
                className={`p-3 border-2 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                  humanConflictDecision === 'cleared'
                    ? 'bg-emerald-800 text-white border-emerald-900'
                    : 'bg-white text-emerald-800 border-emerald-600 hover:bg-emerald-50'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Clear Conflict (Proceed)</span>
              </button>

              <button
                onClick={() => setHumanConflictDecision('flagged')}
                className={`p-3 border-2 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                  humanConflictDecision === 'flagged'
                    ? 'bg-amber-600 text-white border-amber-800'
                    : 'bg-white text-amber-800 border-amber-500 hover:bg-amber-50'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Flag Potential Conflict</span>
              </button>

              <button
                onClick={() => setHumanConflictDecision('blocked')}
                className={`p-3 border-2 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                  humanConflictDecision === 'blocked'
                    ? 'bg-[#FF4444] text-white border-red-900'
                    : 'bg-white text-[#FF4444] border-[#FF4444] hover:bg-red-50'
                }`}
              >
                <X className="w-4 h-4" />
                <span>Block / Direct Conflict</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] block mb-1">
              Conflict Review Notes / Waiver References:
            </label>
            <input
              type="text"
              value={conflictNotes}
              onChange={(e) => setConflictNotes(e.target.value)}
              placeholder="e.g. Parties unrelated; checked with Senior Counsel."
              className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-xs"
            />
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-[#1A1A1A]">
            <button onClick={() => setCurrentStep(2)} className="text-xs font-mono text-[#555555]">
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              disabled={humanConflictDecision === 'pending' || humanConflictDecision === 'blocked'}
              className="px-5 py-2.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A] hover:bg-black disabled:opacity-50 flex items-center gap-2"
            >
              <span>Next: Finalize Matter Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: MATTER SETUP */}
      {currentStep === 4 && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 space-y-4">
          <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A] border-b border-[#1A1A1A] pb-2">
            Step 4: Matter Setup & Idempotent File Creation
          </h2>

          <div className="p-4 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 text-xs">
            <div><strong>Client:</strong> {clientName} ({clientEmail || clientPhone || 'No contact specified'})</div>
            <div><strong>Opposite Party:</strong> {oppositeParty}</div>
            <div><strong>Category:</strong> {caseType} | <strong>Jurisdiction:</strong> {jurisdiction}</div>
            <div><strong>Conflict Status:</strong> <span className="uppercase font-bold text-emerald-800">{humanConflictDecision}</span></div>
          </div>

          <button
            onClick={handleFinalizeMatterSetup}
            className="w-full py-3.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A] hover:bg-black flex items-center justify-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Canonical Active Matter File</span>
          </button>
        </div>
      )}

    </div>
  );
};
