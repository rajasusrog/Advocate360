import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Target, 
  Scale,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { LimitationCheckResult, CaseAssessment } from '../types';

export const RiskAndLimitation: React.FC = () => {
  // Limitation Checker State
  const [causeOfActionDate, setCauseOfActionDate] = useState<string>('');
  const [filingDate, setFilingDate] = useState<string>('');
  const [caseCategory, setCaseCategory] = useState<string>('Suit for Cancellation of Instrument (3 Years - Art 59)');
  const [limitationResult, setLimitationResult] = useState<LimitationCheckResult | null>(null);

  // Qualitative Case Assessment State
  const [assessment, setAssessment] = useState<CaseAssessment>({
    overallAssessment: 'Moderate Supporting Material',
    favourableFactors: [
      'Documentary Title: Registered parent title deed and heirship certificates established.',
      'Possession: Long-standing tax receipts and utility records available.'
    ],
    riskFactors: [
      'Possession Challenge: Opposite party claims vacant physical handover.',
      'Counter-Plea: Likely plea of adverse possession or past oral partition.'
    ],
    evidenceGaps: [
      'Original encumbrance certificate for 1995–2010 window pending retrieval.'
    ],
    contradictions: [
      'Discrepancy in boundary measurements between 1995 Parent Deed and 2026 Sale Agreement.'
    ],
    proceduralRisks: [
      'Ad Valorem court fee calculation under Sec 40 Tamil Nadu Court Fees Act.'
    ],
    limitationIssues: [
      'Verification required on exact date client gained knowledge of impugned transaction.'
    ],
    supportingAuthorities: [
      '(2020) 9 SCC 1 (Vineeta Sharma v. Rakesh Sharma) - Coparcenary rights.'
    ],
    opposingAuthorities: [
      'AIR 2021 SC 3012 - Family arrangement admissibility.'
    ],
    disclaimer: 'AI-assisted assessment — advocate review required.'
  });

  const handleCheckLimitation = () => {
    if (!causeOfActionDate || !filingDate) {
      setLimitationResult({
        causeOfActionDate: causeOfActionDate || 'Unspecified',
        filingDate: filingDate || 'Unspecified',
        caseType: caseCategory,
        statutoryLimit: 'Standard Limitation Period',
        isWithinLimitation: null,
        status: 'Requires Condonation of Delay',
        keyVerifications: [
          'Verify exact starting point of cause of action date',
          'Check for statutory exclusions under Sec 12–15 Limitation Act'
        ],
        notes: 'Insufficient information to determine limitation. Both cause of action and filing dates are required.'
      });
      return;
    }

    const causeDate = new Date(causeOfActionDate);
    const fileDate = new Date(filingDate);
    const diffMonths = (fileDate.getFullYear() - causeDate.getFullYear()) * 12 + (fileDate.getMonth() - causeDate.getMonth());

    if (diffMonths <= 36) {
      setLimitationResult({
        causeOfActionDate,
        filingDate,
        caseType: caseCategory,
        statutoryLimit: '3 Years under Limitation Act 1963',
        isWithinLimitation: true,
        status: 'Safe',
        keyVerifications: [
          'Verify exact date client gained knowledge of impugned transaction',
          'Ensure court fee calculation matches valuation under Court Fees Act'
        ],
        notes: `Suit proposed within ${diffMonths} months of cause of action. Within 3-year statutory limit.`
      });
    } else {
      setLimitationResult({
        causeOfActionDate,
        filingDate,
        caseType: caseCategory,
        statutoryLimit: '3 Years under Limitation Act 1963',
        isWithinLimitation: false,
        status: 'Barred by Limitation',
        keyVerifications: [
          'Check if Section 17 Limitation Act (Fraud) can extend starting point to date of discovery',
          'Prepare Section 5 Condonation of Delay Application with affidavit'
        ],
        notes: `Proposed filing date exceeds 36 months limit. Condonation of delay or Sec 17 pleading required.`
      });
    }
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Risk Assessment, Limitation Analysis & Case Strategy</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Qualitative Case Assessment & Limitation Engine</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Decision support system that analyzes favourable factors, risks, evidence gaps, contradictions, and statutory limitation parameters under the Limitation Act 1963.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Limitation Checker */}
        <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#B45309]" />
              <span>Limitation Act Period Analysis</span>
            </h3>
          </div>

          <div className="bg-amber-50/80 border border-amber-300 p-2.5 text-[11px] text-amber-900 font-bold uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-[#B45309] shrink-0" />
            <span>AI-assisted limitation analysis — advocate verification required.</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-[10px] uppercase tracking-wider text-[#1A1A1A]">Case Category / Relief:</label>
              <select
                value={caseCategory}
                onChange={(e) => setCaseCategory(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 font-bold focus:outline-none"
              >
                <option value="Suit for Cancellation of Instrument (3 Years - Art 59)">Suit for Cancellation of Instrument (3 Years - Art 59)</option>
                <option value="Recovery of Money / Contract (3 Years - Art 55)">Recovery of Money / Breach of MSA (3 Years - Art 55)</option>
                <option value="Partition Suit (12 Years - Art 110)">Partition of Joint Family Property (12 Years - Art 110)</option>
                <option value="Specific Performance (3 Years - Art 54)">Specific Performance of Contract (3 Years - Art 54)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-[10px] uppercase text-[#1A1A1A]">Cause of Action Date:</label>
                <input
                  type="date"
                  value={causeOfActionDate}
                  onChange={(e) => setCauseOfActionDate(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[10px] uppercase text-[#1A1A1A]">Filing / Proposed Date:</label>
                <input
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] mt-1 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleCheckLimitation}
              className="w-full py-3 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] transition-colors"
            >
              Analyze Limitation Period
            </button>
          </div>

          {/* Result Output */}
          {limitationResult ? (
            <div className={`p-4 border space-y-2 text-xs ${
              limitationResult.isWithinLimitation === true
                ? 'bg-[#F5F2EF] border-[#1A1A1A]'
                : limitationResult.isWithinLimitation === false
                ? 'bg-[#FFF4F2] border-[#FF4444]'
                : 'bg-[#F9F7F5] border-[#1A1A1A]'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-[#1A1A1A]">Analysis Status</span>
                <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 border ${
                  limitationResult.isWithinLimitation === true ? 'bg-emerald-100 text-emerald-900 border-emerald-900' : 'bg-[#FF4444] text-white border-[#FF4444]'
                }`}>
                  {limitationResult.status}
                </span>
              </div>
              <p className="font-serif italic font-bold text-[#1A1A1A] text-sm">{limitationResult.notes}</p>
              <div className="pt-2 border-t border-[#1A1A1A]/30 space-y-1">
                <strong className="text-[10px] uppercase tracking-wider text-[#1A1A1A]">Advocate Verifications:</strong>
                <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                  {limitationResult.keyVerifications.map((v, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-[#B45309] font-bold">•</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] text-xs text-[#555555] font-serif italic text-center">
              Select cause of action and filing dates above to generate limitation analysis.
            </div>
          )}
        </div>

        {/* Right Column: Case Strategy & Qualitative Assessment */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between border-b border-[#1A1A1A] pb-3 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#B45309]" />
              <span>Case Assessment Breakdown</span>
            </h3>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] bg-[#1A1A1A] text-amber-400 px-3 py-1 border border-[#1A1A1A]">
              {assessment.overallAssessment}
            </span>
          </div>

          <p className="text-[10px] text-[#555555] font-mono uppercase tracking-wider">
            {assessment.disclaimer}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Favourable Factors */}
            <div className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Favourable Factors</span>
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.favourableFactors?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-emerald-700 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk Factors */}
            <div className="p-3.5 bg-[#FFF4F2] border border-[#FF4444] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#FF4444] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF4444]" />
                <span>Risk Factors</span>
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.riskFactors?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#FF4444] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence Gaps */}
            <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#B45309]">
                Evidence Gaps
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.evidenceGaps?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#B45309] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contradictions */}
            <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Contradictions & Discrepancies
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.contradictions?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#1A1A1A] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Procedural Risks */}
            <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">
                Procedural & Court Fee Risks
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.proceduralRisks?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#1A1A1A] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Supporting Authorities */}
            <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-emerald-900">
                Supporting Precedent Authorities
              </h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {assessment.supportingAuthorities?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-emerald-700 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Tactical Steps */}
          <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] space-y-2 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#B45309] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#B45309]" />
              <span>Advocate Trial Roadmap & Next Actions</span>
            </h4>
            <ol className="space-y-1.5 text-[#1A1A1A] font-serif italic list-decimal list-inside">
              <li>Move urgent Order 39 interim injunction application before construction commences.</li>
              <li>Issue summons to Sub-Registrar Office for production of original register volumes.</li>
              <li>File Section 65B Electronic Evidence Affidavit for electronic messaging admissions.</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
};
