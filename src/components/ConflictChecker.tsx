import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  Building2, 
  Scale,
  FileText
} from 'lucide-react';
import { CaseFile, ConflictCheckResult } from '../types';

interface ConflictCheckerProps {
  cases: CaseFile[];
}

export const ConflictChecker: React.FC<ConflictCheckerProps> = ({ cases }) => {
  const [queryName, setQueryName] = useState('');
  const [partyRole, setPartyRole] = useState<'Prospective Client' | 'Adverse Party' | 'Co-Defendant' | 'Corporate Entity'>('Prospective Client');
  const [result, setResult] = useState<ConflictCheckResult | null>(null);

  const handleRunCheck = () => {
    if (!queryName.trim()) return;

    const queryLower = queryName.trim().toLowerCase();

    // Scan chamber cases for matches in clientName or oppositeParty or title
    const matched = cases.find(c => 
      c.clientName.toLowerCase().includes(queryLower) ||
      (c.oppositeParty && c.oppositeParty.toLowerCase().includes(queryLower)) ||
      c.title.toLowerCase().includes(queryLower)
    );

    if (matched) {
      const isClientMatch = matched.clientName.toLowerCase().includes(queryLower);
      
      setResult({
        queryName: queryName.trim(),
        isConflictFound: true,
        matchedCase: matched.title,
        matchedParty: isClientMatch ? matched.clientName : (matched.oppositeParty || 'Adverse Party'),
        conflictLevel: 'Direct Conflict',
        details: isClientMatch 
          ? `DIRECT CONFLICT DETECTED: "${queryName}" is an active existing client in Case ${matched.caseNumber || matched.id} (${matched.title}). Representing an adverse party or contrary interest violates Bar Council Rules.`
          : `DIRECT ADVERSE PARTY MATCH: "${queryName}" is named as the Opposite Party in Case ${matched.caseNumber || matched.id} (${matched.title}). Confidentiality rules prohibit representation without explicit waiver.`,
        timestamp: new Date().toLocaleTimeString()
      });
    } else {
      setResult({
        queryName: queryName.trim(),
        isConflictFound: false,
        conflictLevel: 'Clear',
        details: `CLEAR: No direct matches found for "${queryName}" across active or archived chamber files. Safe to proceed with initial consultation.`,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Banner */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Ethical & Professional Compliance Engine</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Conflict-of-Interest Scanner</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Cross-reference prospective clients, adverse parties, co-defendants, or corporate entities against active and archived chamber matter records to prevent professional conflict before intake.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form & Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-5 bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] border-b border-[#1A1A1A] pb-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-[#B45309]" />
            <span>Intake Conflict Verification Query</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-[10px] uppercase text-[#1A1A1A]">Target Party / Entity Name:</label>
              <input
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="e.g. 'Star Builders', 'Ramesh', 'K. V. Sundaram'"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-[10px] uppercase text-[#1A1A1A]">Target Party Capacity:</label>
              <select
                value={partyRole}
                onChange={(e: any) => setPartyRole(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 font-bold focus:outline-none"
              >
                <option value="Prospective Client">Prospective Client</option>
                <option value="Adverse Party">Adverse / Opposite Party</option>
                <option value="Co-Defendant">Co-Defendant / Co-Respondent</option>
                <option value="Corporate Entity">Corporate Entity / Director</option>
              </select>
            </div>

            <button
              onClick={handleRunCheck}
              className="w-full py-3 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] transition-colors"
            >
              Execute Ethical Conflict Audit
            </button>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] border-b border-[#1A1A1A] pb-2 flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#B45309]" />
            <span>Audit Findings & Bar Council Compliance Status</span>
          </h3>

          {result ? (
            <div className={`p-5 border-2 space-y-3 ${
              result.isConflictFound
                ? 'bg-[#FFF4F2] border-[#FF4444]'
                : 'bg-[#F5F2EF] border-[#1A1A1A]'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Query Target: "{result.queryName}"</span>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                  result.isConflictFound
                    ? 'bg-[#FF4444] text-white border-[#FF4444]'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-900'
                }`}>
                  {result.conflictLevel}
                </span>
              </div>

              <p className="font-serif italic font-bold text-base text-[#1A1A1A] leading-relaxed">
                {result.details}
              </p>

              {result.matchedCase && (
                <div className="pt-2 border-t border-current/20 text-xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#555555] block">Conflicting Matter Details:</span>
                  <p className="font-serif font-bold text-[#1A1A1A]">{result.matchedCase}</p>
                </div>
              )}

              <div className="pt-2 border-t border-current/20 flex justify-between text-[10px] text-[#555555] font-mono">
                <span>Audited against {cases.length} chamber case records</span>
                <span>Audit Timestamp: {result.timestamp}</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#F5F2EF] border border-[#1A1A1A] text-xs text-[#555555] font-serif italic space-y-2">
              <p className="font-bold text-[#1A1A1A]">No conflict check has been executed in this session.</p>
              <p>Enter party details on the left to verify non-conflict before initiating new client intake.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
