import React, { useState } from 'react';
import { X, Briefcase, AlertTriangle } from 'lucide-react';
import { CaseFile } from '../types';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCase: (newCase: CaseFile) => Promise<void> | void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose, onAddCase }) => {
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [caseType, setCaseType] = useState<CaseFile['caseType']>('Property Dispute');
  const [clientName, setClientName] = useState('');
  const [oppositeParty, setOppositeParty] = useState('');
  const [courtName, setCourtName] = useState('');
  const [summary, setSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setCaseNumber('');
    setCaseType('Property Dispute');
    setClientName('');
    setOppositeParty('');
    setCourtName('');
    setSummary('');
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim() || isSaving) return;

    const newCase: CaseFile = {
      id: `case-${Date.now()}`,
      title: title.trim(),
      caseType,
      status: 'Intake',
      clientName: clientName.trim(),
      courtName: courtName.trim() || 'Court Not Specified',
      summary: summary.trim() || 'New matter created in Advocate360.',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (caseNumber.trim()) {
      newCase.caseNumber = caseNumber.trim();
    }
    if (oppositeParty.trim()) {
      newCase.oppositeParty = oppositeParty.trim();
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onAddCase(newCase);
      resetForm();
      onClose();
    } catch (err: any) {
      // Preserve unsaved form inputs and display visible error message
      setSaveError(
        err?.message ||
          'Failed to save matter. Your input has been preserved — please review and retry.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#0B1426]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-matter-modal-title"
    >
      <div className="bg-white border border-[#E2DFD7] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-[#0B1426]">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B1426] text-[#C49A36] flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 id="add-matter-modal-title" className="font-bold text-lg text-[#0B1426]">
              Add matter
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close Add matter dialog"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0B1426] hover:bg-[#F6F5F1] disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#B91C1C] text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to save matter</p>
              <p className="mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Matter title / Cause title <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSaving}
              placeholder="e.g. Meenakshi Textiles vs. Kavitha Builders"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Case number / Forum ID
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="e.g. O.S. 402/2026"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Case category <span className="text-[#B91C1C]">*</span>
              </label>
              <select
                disabled={isSaving}
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as CaseFile['caseType'])}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              >
                <option value="Property Dispute">Property Dispute</option>
                <option value="Contract & Recovery">Contract & Recovery</option>
                <option value="Criminal / FIR">Criminal / FIR</option>
                <option value="Family & Matrimonial">Family & Matrimonial</option>
                <option value="Corporate & Civil">Corporate & Civil</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Client name <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isSaving}
                placeholder="Client full name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Opposite party
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="Opposing party / organization"
                value={oppositeParty}
                onChange={(e) => setOppositeParty(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Court / Forum name
            </label>
            <input
              type="text"
              disabled={isSaving}
              placeholder="e.g. City Civil Court, Chennai"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
            />
          </div>

          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Brief case summary
            </label>
            <textarea
              disabled={isSaving}
              placeholder="Brief facts or dispute summary..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 resize-none focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-[#E2DFD7]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="flex-1 py-2.5 bg-white hover:bg-[#F6F5F1] text-[#0B1426] border border-[#E2DFD7] rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving matter...' : 'Add matter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
