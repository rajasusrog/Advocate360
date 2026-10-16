import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { 
  GitCompare, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';

export const DocumentComparison: React.FC = () => {
  const [doc1Text, setDoc1Text] = useState<string>(
    `SALE DEED 1995 (PARENT DEED)
Sub-Registrar Office Mylapore, Doc No. 1204/1995.
Vendor: M. Natarajan Mudaliar.
Purchaser: K. Ramachandran.
Property Description: Land measuring 2400 sq.ft at Survey No. 114/2, Mylapore, Chennai.
Consideration: Rs 4,50,000 paid via demand draft.
Witnesses: 1. R. Venkat 2. S. Murugan.`
  );

  const [doc2Text, setDoc2Text] = useState<string>(
    `SALE DEED 2026 (IMPUGNED DEED)
Sub-Registrar Office Mylapore, Doc No. 4012/2026.
Vendor: Suresh Kumar (claiming sole ownership via oral family arrangement 2020).
Purchaser: M/s Star Builders Pvt Ltd.
Property Description: Land measuring 2400 sq.ft at Survey No. 114/2B, Mylapore, Chennai.
Consideration: Rs 1,20,000,000.
Clause 7: Vendor indemnifies Purchaser against all claims by legal co-heirs.
Witnesses: 1. K. Sundaram.`
  );

  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<{
    ownershipChanges: string[];
    areaOrSurveyDifferences: string[];
    clauseAdditions: string[];
    missingSignaturesOrWitnesses: string[];
    summary: string;
  } | null>({
    ownershipChanges: [
      '1995 Deed was purchased solely by Late K. Ramachandran.',
      '2026 Deed executed solely by Suresh Kumar claiming oral partition without joining co-heir Ramesh.'
    ],
    areaOrSurveyDifferences: [
      'Survey Number changed from 114/2 (1995 Deed) to 114/2B (2026 Deed). Require Tahsildar sub-division verification.'
    ],
    clauseAdditions: [
      'Clause 7 added in 2026 Deed: "Vendor indemnifies Purchaser against all claims by legal co-heirs or family members."'
    ],
    missingSignaturesOrWitnesses: [
      'Ramesh Kumar (Co-heir holding 50% undivided right) is NOT a signatory or consenting witness.',
      'Only 1 witness (K. Sundaram) signed 2026 Deed compared to 2 witnesses in 1995 Deed.'
    ],
    summary: 'Critical delta found: Unilateral transfer of entire joint property under altered survey sub-number 114/2B with an explicit indemnity clause guarding against co-heir claims.'
  });

  const handleCompare = async () => {
    setIsComparing(true);
    try {
      const data = await apiPost('/api/ai/compare-documents', { doc1Text, doc2Text });
      if (data.ownershipChanges) {
        setComparisonResult(data);
      }
    } catch (err) {
      console.error('Comparison Error:', err);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <GitCompare className="w-3.5 h-3.5 text-amber-400" />
              <span>Feature #11 • Document Delta & Comparison Engine</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Legal Document & Sale Deed Comparison</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Compare two deeds or agreement drafts side by side. AI highlights ownership shifts, survey number alterations, added indemnity clauses, and missing co-heir signatures.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Document 1 Box */}
        <div className="lg:col-span-6 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            Document A (e.g. Parent Title Deed 1995):
          </label>
          <textarea
            value={doc1Text}
            onChange={(e) => setDoc1Text(e.target.value)}
            rows={7}
            className="w-full p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono focus:outline-none resize-none"
          />
        </div>

        {/* Document 2 Box */}
        <div className="lg:col-span-6 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
            Document B (e.g. Impugned Sale Deed 2026):
          </label>
          <textarea
            value={doc2Text}
            onChange={(e) => setDoc2Text(e.target.value)}
            rows={7}
            className="w-full p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono focus:outline-none resize-none"
          />
        </div>

      </div>

      {/* Compare Trigger Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={isComparing}
          className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs px-6 py-3 border border-[#1A1A1A] flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isComparing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Comparing Document Deltas...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Compare Documents & Highlight Deltas</span>
            </>
          )}
        </button>
      </div>

      {/* Comparison Delta Output */}
      {comparisonResult && (
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs space-y-5 text-[#1A1A1A]">
          <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A]">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309]">Executive Comparison Summary</span>
            <p className="font-serif italic font-bold text-[#1A1A1A] text-sm mt-1">{comparisonResult.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Ownership Changes */}
            <div className="p-4 bg-[#F9F7F5] border border-[#1A1A1A]/40 space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">👤 Ownership & Title Changes:</h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {comparisonResult.ownershipChanges.map((o, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#B45309] font-bold">•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Survey & Extent Diff */}
            <div className="p-4 bg-[#F9F7F5] border border-[#1A1A1A]/40 space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">📐 Survey Number & Extent Differences:</h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {comparisonResult.areaOrSurveyDifferences.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#B45309] font-bold">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Added Clauses */}
            <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#B45309]">📝 Added Clauses & Indemnities:</h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {comparisonResult.clauseAdditions.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#B45309] font-bold">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Signatures */}
            <div className="p-4 bg-[#FFF4F2] border border-[#FF4444] space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#FF4444]">❌ Missing Signatures & Co-Heir Consent:</h4>
              <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                {comparisonResult.missingSignaturesOrWitnesses.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-[#FF4444] font-bold">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
