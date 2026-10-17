import React, { useState } from 'react';
import { X, Scale, AlertTriangle } from 'lucide-react';
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
      summary: summary.trim() || 'New case file opened via Advocate360 AI.',
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
          'Failed to save matter to PostgreSQL. Your input has been preserved — please retry.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 max-w-lg w-full shadow-2xl space-y-4 text-[#1A1A1A]">
        <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#B45309]" />
            <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">
              Open New Legal Case File
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 text-[#1A1A1A] hover:text-[#B45309] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            className="p-3 bg-rose-50 border-2 border-rose-700 text-rose-900 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase text-[10px]">Matter Save Failed</p>
              <p className="mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
              Case Title / Cause Title:*
            </label>
            <input
              type="text"
              required
              disabled={isSaving}
              placeholder="e.g. Ramesh Kumar vs. Suresh Kumar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Case Number / Forum ID:
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="e.g. O.S. 402/2024"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
              />
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Case Category:*
              </label>
              <select
                disabled={isSaving}
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as any)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Client Name:*
              </label>
              <input
                type="text"
                required
                disabled={isSaving}
                placeholder="Client full name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
              />
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Opposite Party:
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="Opposing party / company"
                value={oppositeParty}
                onChange={(e) => setOppositeParty(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
              Court / Forum Name:
            </label>
            <input
              type="text"
              disabled={isSaving}
              placeholder="e.g. City Civil Court, Hall 18"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none focus:ring-1 focus:ring-[#B45309]"
            />
          </div>

          <div>
            <label className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
              Brief Case Summary:
            </label>
            <textarea
              disabled={isSaving}
              placeholder="Brief facts or dispute summary..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 resize-none focus:outline-none focus:ring-1 focus:ring-[#B45309]"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-[#1A1A1A]/20">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#F5F2EF] text-[#1A1A1A] border border-[#1A1A1A] font-bold uppercase tracking-wider text-xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] disabled:opacity-50"
            >
              {isSaving ? 'Saving Matter...' : 'Open Case File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
