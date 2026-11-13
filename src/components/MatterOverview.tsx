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
  Calendar,
  FileText,
  IndianRupee,
  CheckSquare,
  Plus,
} from 'lucide-react';
import { CaseFile, CalendarEvent, PracticeTask } from '../types';
import { StatusBadge } from './ui/StatusBadge';

interface MatterOverviewProps {
  matter: CaseFile;
  hearings?: CalendarEvent[];
  tasks?: PracticeTask[];
  onOpenScheduleHearing?: () => void;
  onUpdateMatter?: (updatedMatter: CaseFile) => Promise<void>;
}

export const MatterOverview: React.FC<MatterOverviewProps> = ({
  matter,
  hearings = [],
  tasks = [],
  onOpenScheduleHearing,
  onUpdateMatter,
}) => {
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
      // Preserve unsaved form inputs in draft state and surface error visibly
      setSaveError(
        err?.message ||
          'Failed to save matter updates. Your unsaved edits have been preserved.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const assessment = matter.caseAssessment || {};
  const favourable = assessment.favourableFactors || [];
  const risks = assessment.riskFactors || [];
  const gaps = assessment.evidenceGaps || [];
  const openTasksCount = tasks.filter((t) => t.status !== 'Completed').length;

  return (
    <div className="space-y-6 text-[#0B1426]">
      {/* Quick Section Shortcut Strip: Hearings, Documents, Tasks, Billing */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate(`/app/matters/${matter.id}/work`)}
          className="bg-white border border-[#E2DFD7] hover:border-[#0B1426]/40 rounded-xl p-4 cursor-pointer transition-colors space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Hearings</span>
            <Calendar className="w-4 h-4 text-[#C49A36]" />
          </div>
          <p className="text-lg font-bold text-[#0B1426] u360-table-numeric">{hearings.length}</p>
          <p className="text-xs text-[#475569] truncate">
            {matter.nextHearingDate ? `Next: ${matter.nextHearingDate}` : 'No date listed'}
          </p>
        </div>

        <div
          onClick={() => navigate(`/app/matters/${matter.id}/work`)}
          className="bg-white border border-[#E2DFD7] hover:border-[#0B1426]/40 rounded-xl p-4 cursor-pointer transition-colors space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Due tasks</span>
            <CheckSquare className="w-4 h-4 text-[#C49A36]" />
          </div>
          <p className="text-lg font-bold text-[#0B1426] u360-table-numeric">{openTasksCount}</p>
          <p className="text-xs text-[#475569] truncate">
            {tasks.length} total matter task{tasks.length === 1 ? '' : 's'}
          </p>
        </div>

        <div
          onClick={() => navigate(`/app/matters/${matter.id}/documents`)}
          className="bg-white border border-[#E2DFD7] hover:border-[#0B1426]/40 rounded-xl p-4 cursor-pointer transition-colors space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Documents</span>
            <FileText className="w-4 h-4 text-[#C49A36]" />
          </div>
          <p className="text-sm font-semibold text-[#0B1426] pt-1">Case repository</p>
          <p className="text-xs text-[#475569]">Upload deeds &amp; review versions</p>
        </div>

        <div
          onClick={() => navigate(`/app/matters/${matter.id}/billing`)}
          className="bg-white border border-[#E2DFD7] hover:border-[#0B1426]/40 rounded-xl p-4 cursor-pointer transition-colors space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748B]">Billing</span>
            <IndianRupee className="w-4 h-4 text-[#C49A36]" />
          </div>
          <p className="text-sm font-semibold text-[#0B1426] pt-1">Time &amp; invoices</p>
          <p className="text-xs text-[#475569]">View entries and fee statements</p>
        </div>
      </div>

      {/* Upcoming Hearings Snapshot */}
      <div className="bg-white border border-[#E2DFD7] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C49A36]" />
            <h2 className="text-sm font-semibold text-[#0B1426]">Upcoming hearings</h2>
          </div>
          {onOpenScheduleHearing && (
            <button
              type="button"
              onClick={onOpenScheduleHearing}
              className="px-3 py-1.5 bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#C49A36]" />
              <span>Schedule hearing</span>
            </button>
          )}
        </div>

        {hearings.length === 0 ? (
          <p className="text-xs text-[#64748B] py-2">
            No hearings recorded for this matter yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hearings.slice(0, 4).map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0B1426] truncate">{h.hearingType}</p>
                  <p className="text-xs text-[#475569] truncate">{h.court}</p>
                </div>
                <span className="text-xs font-semibold text-[#0B1426] u360-table-numeric shrink-0">
                  {h.date} • {h.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overview Core Summary & Edit Form */}
      <div className="bg-white border border-[#E2DFD7] rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-[#C49A36]" />
            <h2 className="font-bold text-base text-[#0B1426]">Matter summary &amp; parties</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={matter.status} tone="navy" />
            {onUpdateMatter && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setIsEditing(true);
                }}
                className="px-3 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit matter</span>
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#B91C1C] text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to save matter changes</p>
              <p className="mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        {isEditing ? (
          <form
            onSubmit={handleSaveEdit}
            className="space-y-3.5 text-xs bg-[#F6F5F1] p-4 border border-[#E2DFD7] rounded-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Matter title <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isSaving}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                />
              </div>
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Procedural status
                </label>
                <select
                  disabled={isSaving}
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as CaseFile['status'])}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
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
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Client name <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isSaving}
                  value={draftClientName}
                  onChange={(e) => setDraftClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                />
              </div>
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Opposite party
                </label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={draftOppositeParty}
                  onChange={(e) => setDraftOppositeParty(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                />
              </div>
              <div>
                <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                  Court / Forum
                </label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={draftCourtName}
                  onChange={(e) => setDraftCourtName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-xs text-[#0B1426] block mb-1">
                Matter summary
              </label>
              <textarea
                rows={3}
                disabled={isSaving}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
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
                className="px-3.5 py-2 bg-white hover:bg-[#EFECE4] text-[#0B1426] border border-[#E2DFD7] rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-[#C49A36]" />
                <span>{isSaving ? 'Saving...' : 'Save changes'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-[#475569]">
              {matter.summary ||
                'No matter summary recorded yet. Use Edit matter or upload case documents to populate key facts.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-1">
                <span className="text-[11px] font-medium text-[#64748B] block">Client contact</span>
                <p className="font-semibold text-xs text-[#0B1426]">
                  {matter.clientName || 'Not specified'}
                </p>
                <p className="text-xs text-[#475569]">
                  {matter.clientPhone || matter.clientEmail || 'No contact recorded'}
                </p>
              </div>

              <div className="p-3.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-1">
                <span className="text-[11px] font-medium text-[#64748B] block">
                  Opposite party
                </span>
                <p className="font-semibold text-xs text-[#0B1426]">
                  {matter.oppositeParty || 'Not specified'}
                </p>
                <p className="text-xs text-[#475569]">Opposing counsel: Not specified</p>
              </div>

              <div className="p-3.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-1">
                <span className="text-[11px] font-medium text-[#64748B] block">Court / Forum</span>
                <p className="font-semibold text-xs text-[#0B1426]">
                  {matter.courtName || 'Not specified'}
                </p>
                <p className="text-xs text-[#475569]">
                  Judge: {matter.judgeName || 'Not specified'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assessment & Risk Factors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-3 shadow-2xs">
          <h3 className="font-semibold text-sm text-[#0B1426] flex items-center gap-2 border-b border-[#E2DFD7] pb-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
            <span>Supporting factors &amp; facts</span>
          </h3>

          {favourable.length > 0 ? (
            <ul className="space-y-2 text-xs leading-relaxed">
              {favourable.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]"
                >
                  <span className="text-[#15803D] font-bold">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#64748B] py-3">
              No supporting factors extracted yet. Upload case files in the{' '}
              <strong className="text-[#0B1426]">Documents</strong> tab to analyze.
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate(`/app/matters/${matter.id}/analysis`)}
            className="w-full py-2 bg-[#0B1426] hover:bg-[#16233D] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open case analysis</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#C49A36]" />
          </button>
        </div>

        <div className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-3 shadow-2xs">
          <h3 className="font-semibold text-sm text-[#0B1426] flex items-center gap-2 border-b border-[#E2DFD7] pb-2.5">
            <ShieldAlert className="w-4 h-4 text-[#C49A36]" />
            <span>Identified risks &amp; evidentiary gaps</span>
          </h3>

          {risks.length > 0 || gaps.length > 0 ? (
            <ul className="space-y-2 text-xs leading-relaxed">
              {risks.map((r, i) => (
                <li
                  key={`risk-${i}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
              {gaps.map((g, i) => (
                <li
                  key={`gap-${i}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7]"
                >
                  <span className="text-[#0B1426] font-bold">•</span>
                  <span>Missing evidence: {g}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#64748B] py-3">
              No risks or evidentiary gaps logged for this matter.
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate(`/app/matters/${matter.id}/research-drafts`)}
            className="w-full py-2 bg-[#F6F5F1] hover:bg-[#EFECE4] text-[#0B1426] font-semibold text-xs border border-[#E2DFD7] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Research &amp; drafts</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#C49A36]" />
          </button>
        </div>
      </div>
    </div>
  );
};
