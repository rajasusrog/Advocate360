import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle } from 'lucide-react';
import { CaseFile } from '../types';

export interface ScheduleHearingInput {
  matterId: string;
  date: string;
  time: string;
  courtName: string;
  purpose: string;
  judgeOrBench: string;
  notes: string;
}

interface ScheduleHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseFile[];
  defaultMatterId?: string;
  onScheduleHearing: (input: ScheduleHearingInput) => Promise<void>;
}

export const ScheduleHearingModal: React.FC<ScheduleHearingModalProps> = ({
  isOpen,
  onClose,
  cases,
  defaultMatterId,
  onScheduleHearing,
}) => {
  const [matterId, setMatterId] = useState<string>(defaultMatterId || cases[0]?.id || '');
  const [date, setDate] = useState<string>(() => {
    const nextWeek = new Date(Date.now() + 86400000 * 3);
    return nextWeek.toISOString().split('T')[0];
  });
  const [time, setTime] = useState<string>('10:30');
  const [courtName, setCourtName] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Injunction Hearing / Arguments');
  const [judgeOrBench, setJudgeOrBench] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const targetId = defaultMatterId || matterId || cases[0]?.id || '';
      setMatterId(targetId);
      const targetCase = cases.find((c) => c.id === targetId);
      if (targetCase && !courtName) {
        setCourtName(targetCase.courtName || '');
      }
      setSaveError(null);
    }
  }, [isOpen, defaultMatterId, cases]);

  if (!isOpen) return null;

  const handleMatterChange = (nextId: string) => {
    setMatterId(nextId);
    const matched = cases.find((c) => c.id === nextId);
    if (matched?.courtName) {
      setCourtName(matched.courtName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matterId || !date || !purpose.trim() || isSaving) {
      setSaveError('Please select a matter, hearing date, and hearing stage/purpose.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onScheduleHearing({
        matterId,
        date,
        time,
        courtName: courtName.trim(),
        purpose: purpose.trim(),
        judgeOrBench: judgeOrBench.trim(),
        notes: notes.trim(),
      });
      setPurpose('Injunction Hearing / Arguments');
      setJudgeOrBench('');
      setNotes('');
      onClose();
    } catch (err: any) {
      // Preserve unsaved form inputs on save failure
      setSaveError(
        err?.message ||
          'Failed to schedule hearing. Your input has been preserved — please review and retry.'
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
      aria-labelledby="schedule-hearing-title"
    >
      <div className="bg-white border border-[#E2DFD7] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-[#0B1426]">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B1426] text-[#C49A36] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 id="schedule-hearing-title" className="font-bold text-lg text-[#0B1426]">
              Schedule hearing
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close Schedule hearing dialog"
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
              <p className="font-semibold">Unable to schedule hearing</p>
              <p className="mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Matter <span className="text-[#B91C1C]">*</span>
            </label>
            <select
              required
              disabled={isSaving || cases.length === 0}
              value={matterId}
              onChange={(e) => handleMatterChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
            >
              {cases.length === 0 ? (
                <option value="">No matters available — add a matter first</option>
              ) : (
                cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.caseNumber ? `(${c.caseNumber})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Hearing date <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="date"
                required
                disabled={isSaving}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Courtroom call time
              </label>
              <input
                type="time"
                disabled={isSaving}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Stage / Purpose <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSaving}
              placeholder="e.g. Interim Injunction Arguments"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Court / Bench hall
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="e.g. City Civil Court, Hall 4"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426]">
                Presiding judge (optional)
              </label>
              <input
                type="text"
                disabled={isSaving}
                placeholder="e.g. Hon. Justice S. Kumar"
                value={judgeOrBench}
                onChange={(e) => setJudgeOrBench(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] mt-1 focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-xs text-[#0B1426]">
              Preparation notes / Next steps
            </label>
            <textarea
              disabled={isSaving}
              rows={2}
              placeholder="Exhibits to bring, citations to serve..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              disabled={isSaving || cases.length === 0}
              className="flex-1 py-2.5 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Scheduling...' : 'Schedule hearing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
