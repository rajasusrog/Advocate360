import React, { useState } from 'react';
import { 
  CalendarCheck, 
  Sparkles, 
  CheckSquare, 
  Printer, 
  Copy, 
  Check, 
  HelpCircle, 
  AlertTriangle, 
  FileCheck,
  User,
  Scale,
  Download
} from 'lucide-react';
import { HearingBrief as HearingBriefType } from '../types';
import { downloadICS } from '../lib/calendarExport';

export const HearingBrief: React.FC = () => {
  const [brief, setBrief] = useState<HearingBriefType>({
    caseTitle: 'Ramesh Kumar vs. Suresh Kumar & Ors.',
    caseNumber: 'O.S. 402/2024',
    court: 'City Civil Court, Chennai (Hall No. 18)',
    nextHearingDate: '2026-08-05 (11:15 AM)',
    purposeOfHearing: 'Injunction Arguments & Framing Issues',
    factsSummary: [
      'Client Ramesh and Defendant Suresh are legal heirs of Late K. Ramachandran (Died 2020).',
      'Original Mylapore plot purchased via Sale Deed Doc 1204/1995.',
      'Suresh executed unlawful Sale Deed Doc 4012/2026 transferring entire 2400 sq.ft to Star Builders for ₹1.2 Cr without Ramesh consent.',
      'Ramesh holds continuous physical possession via tenant and paid property taxes till 2026.'
    ],
    keyDates: [
      { date: '12-04-1995', event: 'Parent Sale Deed in father name' },
      { date: '18-09-2020', event: 'Father intestate demise' },
      { date: '14-06-2026', event: 'Impugned Sale Deed to Star Builders' },
      { date: '20-07-2026', event: 'Present Suit O.S. 402/2024 filed' }
    ],
    reliefSought: 'Temporary Injunction under Order 39 Rules 1 & 2 CPC restraining defendants from altering physical feature of property or creating third-party encumbrances.',
    opponentLikelyArguments: [
      'Opposite party will argue that oral partition took place in August 2020.',
      'Builder will claim to be a bona fide purchaser for value without notice.'
    ],
    keyDocumentsToKeepReady: [
      'Original Parent Title Deed 1204/1995 (Exhibit A-1)',
      'Certified Copy of Impugned Sale Deed 4012/2026 (Exhibit A-2)',
      'Municipal Property Tax Receipts 2020-2026 (Exhibit A-3)',
      'Tenant Rental Receipts & EB Bill (Exhibit A-4)'
    ],
    questionsForClient: [
      'Confirm if any written communication or notice was sent before June 2026.',
      'Confirm if builder ever visited the site for inspection in client presence.'
    ],
    hearingChecklist: [
      { item: 'Verify file has certified copy of parent deed Exhibit A-1', checked: true },
      { item: 'Keep Sec 65B Evidence Act Affidavit ready for WhatsApp admissions', checked: true },
      { item: 'Ensure 3 copies of Order 39 Injunction application bundle ready for Judge & Defendants', checked: false },
      { item: 'Confirm client Ramesh presence in courtroom gallery', checked: false }
    ]
  });

  const [copied, setCopied] = useState<boolean>(false);

  const toggleCheck = (index: number) => {
    const updated = [...brief.hearingChecklist];
    updated[index].checked = !updated[index].checked;
    setBrief({ ...brief, hearingChecklist: updated });
  };

  const handleCopy = () => {
    const text = `COURT HEARING BRIEF - ${brief.caseTitle} (${brief.caseNumber})
Court: ${brief.court}
Date & Time: ${brief.nextHearingDate}
Purpose: ${brief.purposeOfHearing}

RELIEF SOUGHT:
${brief.reliefSought}

FACTS SUMMARY:
${brief.factsSummary.map(f => `- ${f}`).join('\n')}

OPPONENT LIKELY ARGUMENTS & COUNTERS:
${brief.opponentLikelyArguments.map(o => `- ${o}`).join('\n')}

KEY EXHIBITS TO KEEP READY:
${brief.keyDocumentsToKeepReady.map(d => `- ${d}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Feature #9 • Tomorrow Court Hearing Preparation Package</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Courtroom Hearing Brief & Checklist</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              AI compiles tomorrow’s courtroom package: facts summary, key dates, opponent likely arguments, exhibit list, client Q&A, and courtroom checklist.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                downloadICS([{
                  id: 'hearing-brief-1',
                  caseId: brief.caseNumber,
                  caseTitle: brief.caseTitle,
                  court: brief.court,
                  hearingType: brief.purposeOfHearing,
                  date: '2026-08-05',
                  time: '11:15 AM',
                  status: 'Scheduled'
                }], `${brief.caseNumber.replace(/[^a-zA-Z0-9]/g, '_')}_Hearing.ics`, brief.caseTitle);
              }}
              className="bg-[#FDFCFB] hover:bg-white text-[#1A1A1A] border-2 border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center gap-1.5 transition-colors shadow-xs"
              title="Sync this hearing with Google Calendar / Apple Calendar (.ics)"
            >
              <Download className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Sync .ICS</span>
            </button>

            <button
              onClick={handleCopy}
              className="bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-amber-400 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Brief Copied' : 'Copy Brief'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-[#1A1A1A] text-amber-400 font-bold text-xs uppercase tracking-wider px-4 py-2 border border-[#1A1A1A] flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Brief</span>
            </button>
          </div>
        </div>
      </div>

      {/* Case Details Bar */}
      <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309] font-mono">{brief.caseNumber}</span>
          <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A]">{brief.caseTitle}</h2>
          <p className="text-xs text-[#555555] font-sans">{brief.court}</p>
        </div>

        <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block">Hearing Date & Stage</span>
          <span className="font-serif italic text-sm font-bold text-[#1A1A1A]">{brief.nextHearingDate}</span>
          <p className="text-xs text-[#B45309] font-bold">{brief.purposeOfHearing}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Facts & Opponent Counters */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Relief & Facts */}
          <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309]">Relief Sought in Hearing</span>
              <p className="text-xs font-serif italic font-bold text-[#1A1A1A]">{brief.reliefSought}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">Essential Facts Briefing:</h3>
              <ul className="space-y-1.5 text-xs text-[#1A1A1A] font-serif italic">
                {brief.factsSummary.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2 bg-[#F9F7F5] border border-[#1A1A1A]/30">
                    <span className="font-bold text-[#B45309] font-sans">{idx + 1}.</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Opponent Likely Arguments */}
          <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF4444] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#FF4444]" />
              <span>Opponent Likely Arguments & Counter-Punches</span>
            </h3>

            <div className="space-y-2 text-xs">
              {brief.opponentLikelyArguments.map((opp, idx) => (
                <div key={idx} className="p-3 bg-[#FFF4F2] border border-[#FF4444] space-y-1">
                  <strong className="text-[#1A1A1A] font-serif italic font-bold block">Argument {idx + 1}: "{opp}"</strong>
                  <p className="text-[#555555] text-[11px] font-sans">
                    💡 <strong>Counter Strategy:</strong> Produce Municipal Tax Receipts Exhibit A-3 and rely on Registration Act Section 17/49 mandatory bar.
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Exhibits & Courtroom Checklist */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Exhibit List */}
          <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#B45309]" />
              <span>Key Exhibits to Keep Ready in File</span>
            </h3>

            <ul className="space-y-2 text-xs">
              {brief.keyDocumentsToKeepReady.map((doc, idx) => (
                <li key={idx} className="p-2.5 bg-[#F9F7F5] border border-[#1A1A1A]/40 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-none bg-[#1A1A1A] shrink-0" />
                  <span className="text-[#1A1A1A] font-serif italic font-bold">{doc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hearing Checklist */}
          <div className="bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>Courtroom Readiness Checklist</span>
            </h3>

            <div className="space-y-2 text-xs">
              {brief.hearingChecklist.map((item, idx) => (
                <label
                  key={idx}
                  onClick={() => toggleCheck(idx)}
                  className={`p-3 border flex items-center gap-2.5 cursor-pointer transition-all ${
                    item.checked
                      ? 'bg-[#F5F2EF] border-[#1A1A1A] text-[#1A1A1A] line-through opacity-70'
                      : 'bg-[#F9F7F5] border-[#1A1A1A] text-[#1A1A1A]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {}}
                    className="w-4 h-4 text-[#1A1A1A] border-[#1A1A1A] focus:ring-0"
                  />
                  <span className="font-serif italic font-bold">{item.item}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
