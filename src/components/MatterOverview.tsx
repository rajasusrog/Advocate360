import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { CaseFile } from '../types';

interface MatterOverviewProps {
  matter: CaseFile;
  onUpdateMatter?: (updatedMatter: CaseFile) => Promise<void>;
}

export const MatterOverview: React.FC<MatterOverviewProps> = ({ matter, onUpdateMatter }) => {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(matter.title);
  const [draftStatus, setDraftStatus] = useState<CaseFile['status']>(matter.status);
  const [draftClientName, setDraftClientName] = useState(matter.clientName || '');
  const [draftOppositeParty, setDraftOppositeParty] = useState(matter.oppositeParty || '');
  const [draftCourtName, setDraftCourtName] = useState(matter.courtName || '');
  const [draftSummary, setDraftSummary] = useState(matter.summary || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(matter.title);
      setDraftStatus(matter.status);
      setDraftClientName(matter.clientName || '');
      setDraftOppositeParty(matter.oppositeParty || '');
      setDraftCourtName(matter.courtName || '');
      setDraftSummary(matter.summary || '');
    }
  }, [matter, isEditing]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateMatter || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onUpdateMatter({
        ...matter,
        title: draftTitle.trim() || matter.title,
        status: draftStatus,
        stage: draftStatus,
        clientName: draftClientName.trim() || matter.clientName,
        oppositeParty: draftOppositeParty.trim() || undefined,
        courtName: draftCourtName.trim() || matter.courtName,
        summary: draftSummary,
        updatedAt: new Date().toISOString().split('T')[0],
      });
      setIsEditing(false);
    } catch (err: any) {
      // Preserve unsaved input in draft state and surface error visibly
      setSaveError(
        err?.message ||
          'Failed to save matter updates to PostgreSQL. Your unsaved edits are preserved.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const assessment = matter.caseAssessment || {};
  const favourable = assessment.favourableFactors || [];
  const risks = assessment.riskFactors || [];
  const Gaps = assessment.evidenceGaps || [];

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      {/* Overview Top Card: Core Dispute & Procedural Status */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-[#B45309]" />
            <h2 className="font-serif italic font-extrabold text-xl text-[#1A1A1A]">
              Matter Summary & Core Issue
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#1A1A1A] text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              {matter.status}
            </span>
            {onUpdateMatter && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setIsEditing(true);
                }}
                className="px-2.5 py-1 bg-[#F5F2EF] hover:bg-white text-[#1A1A1A] border border-[#1A1A1A] font-bold uppercase text-[10px] flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Matter</span>
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border-2 border-rose-700 text-rose-900 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase text-[10px]">Matter Update Failed</p>
              <p className="mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3 text-xs bg-[#F5F2EF] p-4 border border-[#1A1A1A]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] block">Matter Title:*</label>
                <input
                  type="text"
                  required
                  disabled={isSaving}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-[10px] block">Procedural Status:</label>
                <select
                  disabled={isSaving}
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as CaseFile['status'])}
                  className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
                >
                  <option value="Intake">Intake</option>
                  <option value="Analysis">Analysis</option>
                  <option value="Research">Research</option>
                  <option value="Drafting">Drafting</option>
                  <option value="Pending Hearing">Pending Hearing</option>
                  <option value="Closed">Closed</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] block">Client Name:*</label>
                <input
                  type="text"
                  required
                  disabled={isSaving}
                  value={draftClientName}
                  onChange={(e) => setDraftClientName(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-[10px] block">Opposite Party:</label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={draftOppositeParty}
                  onChange={(e) => setDraftOppositeParty(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-[10px] block">Court / Forum:</label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={draftCourtName}
                  onChange={(e) => setDraftCourtName(e.target.value)}
                  className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-bold uppercase text-[10px] block">Matter Summary:</label>
              <textarea
                rows={3}
                disabled={isSaving}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                className="w-full p-2 bg-white border border-[#1A1A1A] mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setSaveError(null);
                  setIsEditing(false);
                }}
                className="px-3 py-1.5 bg-white text-[#1A1A1A] border border-[#1A1A1A] font-bold uppercase text-[10px] flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 bg-[#1A1A1A] text-amber-400 border border-[#1A1A1A] font-bold uppercase text-[10px] flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                <span>{isSaving ? 'Saving...' : 'Save Matter Changes'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="font-serif text-sm leading-relaxed text-[#1A1A1A]">
              {matter.summary ||
                'No summary or extracted fact statement recorded for this matter yet. Use Client Intake or Case Document Analyzer to populate initial matter facts.'}
            </p>

            {/* Quick Facts & Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  Client Contact
                </span>
                <p className="font-serif font-bold text-xs">
                  {matter.clientName || 'Not specified'}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  {matter.clientPhone || matter.clientEmail || 'No contact details'}
                </p>
              </div>

              <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  Opposite Party
                </span>
                <p className="font-serif font-bold text-xs">
                  {matter.oppositeParty || 'Not specified'}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  Opposing Counsel: Not specified
                </p>
              </div>

              <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">
                  Court / Forum
                </span>
                <p className="font-serif font-bold text-xs">
                  {matter.courtName || 'Not specified'}
                </p>
                <p className="text-[11px] text-slate-600 font-mono">
                  Judge: {matter.judgeName || 'Not specified'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Grid: Extracted Assessment & Risk Factors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Favourable Factors & Supporting Materials */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-3 shadow-xs">
          <h3 className="font-serif italic font-bold text-base text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Key Supporting Factors & Facts</span>
          </h3>

          {favourable.length > 0 ? (
            <ul className="space-y-2 text-xs font-serif leading-relaxed">
              {favourable.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-200"
                >
                  <span className="text-emerald-800 font-bold">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 font-serif italic py-4">
              No favourable factors extracted yet. Upload matter documents in the{' '}
              <strong className="text-black">Documents</strong> tab to analyze.
            </p>
          )}

          <button
            onClick={() => navigate(`/app/matters/${matter.id}/analysis`)}
            className="w-full py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open Case Analysis Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Risk & Procedural Vulnerabilities */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-3 shadow-xs">
          <h3 className="font-serif italic font-bold text-base text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
            <ShieldAlert className="w-4 h-4 text-[#B45309]" />
            <span>Identified Risk & Evidentiary Gaps</span>
          </h3>

          {risks.length > 0 || Gaps.length > 0 ? (
            <ul className="space-y-2 text-xs font-serif leading-relaxed">
              {risks.map((r, i) => (
                <li
                  key={`risk-${i}`}
                  className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-300"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
              {Gaps.map((g, i) => (
                <li
                  key={`gap-${i}`}
                  className="flex items-start gap-2 p-2 bg-slate-100 border border-slate-300"
                >
                  <span className="text-slate-700 font-bold">•</span>
                  <span>Missing Evidence: {g}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 font-serif italic py-4">
              No specific risks or gaps logged for this matter.
            </p>
          )}

          <button
            onClick={() => navigate(`/app/matters/${matter.id}/research-drafts`)}
            className="w-full py-2 bg-[#F5F2EF] hover:bg-white text-[#1A1A1A] font-bold uppercase tracking-wider text-[11px] border border-[#1A1A1A] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Research & Prepare Draft</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
