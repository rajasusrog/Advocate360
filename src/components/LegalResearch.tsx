import React, { useState } from 'react';
import { 
  Scale, 
  Sparkles, 
  BookOpen, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw, 
  Copy, 
  Check,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { LegalResearchResult } from '../types';
import { apiPost } from '../lib/api';

import { CaseFile } from '../types';
import { saveExtractedFactsToMatter } from '../lib/useMatterData';

interface LegalResearchProps {
  selectedCase?: CaseFile | null;
  chamberId?: string;
}

export const LegalResearch: React.FC<LegalResearchProps> = ({ selectedCase, chamberId }) => {
  const [query, setQuery] = useState<string>(() => {
    if (selectedCase) {
      return `Legal issues and precedent search for: ${selectedCase.title}`;
    }
    return '';
  });

  React.useEffect(() => {
    if (selectedCase) {
      setQuery(`Legal issues and precedent search for: ${selectedCase.title}`);
    }
  }, [selectedCase?.id]);

  const [jurisdiction, setJurisdiction] = useState<string>('Tamil Nadu / Indian Civil Laws');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [researchResult, setResearchResult] = useState<LegalResearchResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string>('');

  const handleSearchResearch = async () => {
    if (!query.trim()) return;
    const targetMatterId = selectedCase?.id;
    setIsSearching(true);
    setSaveStatusMsg('');
    try {
      const data = await apiPost<LegalResearchResult>('/api/ai/legal-research', { 
        query, 
        jurisdiction, 
        chamberId, 
        caseId: targetMatterId 
      });

      if (data.relevantProvisions) {
        setResearchResult(data);

        // Auto-save research findings to matter if in active matter context
        if (selectedCase && chamberId && targetMatterId === selectedCase.id) {
          const researchNotes = [
            `Research Query: ${query}`,
            ...data.relevantProvisions.map(p => `${p.act} (${p.section}): ${p.explanation}`),
            ...data.landmarkJudgments.map(j => `Citation: ${j.citation} - ${j.ratio}`)
          ];
          await saveExtractedFactsToMatter(chamberId, targetMatterId, {
            overallAssessment: `Research Brief: ${data.relevantProvisions.length} provisions & ${data.landmarkJudgments.length} precedents retrieved`
          });
          setSaveStatusMsg('✓ Saved research findings to Matter File');
        }
      }
    } catch (err) {
      console.error('Research Error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyResearch = () => {
    if (!researchResult) return;
    const text = `LEGAL RESEARCH BRIEF
Query: ${researchResult.query}

RELEVANT PROVISIONS:
${researchResult.relevantProvisions.map(p => `- ${p.act} (${p.section}): ${p.explanation}`).join('\n')}

LANDMARK PRECEDENTS:
${researchResult.landmarkJudgments.map(j => `- ${j.citation}: ${j.ratio}`).join('\n')}

SUPPORTING ARGUMENTS:
${researchResult.supportingArguments.map(a => `- ${a}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Feature #3 • Legal Research Assistant</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">AI Statutory & Precedent Research Assistant</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Ask complex legal questions. Advocate360 retrieves relevant Bare Act sections, landmark Supreme Court / High Court precedents, ratio decidendi, and supporting vs opposing viewpoints.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Query Box */}
        <div className="lg:col-span-4 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-2">
              Legal Query / Proposition:
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              placeholder="e.g. Can an unregistered partition deed be relied upon in court?"
              className="w-full p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-serif italic focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-1">
              Jurisdiction / Forum:
            </label>
            <input
              type="text"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none"
            />
          </div>

          {/* Quick Prompts */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-wider">Preset Research Questions:</span>
            <div className="space-y-1">
              <button
                onClick={() => setQuery("Can an unregistered partition deed be relied upon in Tamil Nadu?")}
                className="w-full text-left p-2 bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/30 text-[11px] font-serif italic transition-colors truncate"
              >
                1. Unregistered partition deed admissibility
              </button>
              <button
                onClick={() => setQuery("Can anticipatory bail be granted in Sec 420 IPC financial fraud cases without deposit?")}
                className="w-full text-left p-2 bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/30 text-[11px] font-serif italic transition-colors truncate"
              >
                2. Anticipatory bail in Sec 420 IPC fraud
              </button>
              <button
                onClick={() => setQuery("Is a electronic WhatsApp chat admissible without Sec 65B Evidence Act certificate?")}
                className="w-full text-left p-2 bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-white border border-[#1A1A1A]/30 text-[11px] font-serif italic transition-colors truncate"
              >
                3. WhatsApp chat & Sec 65B requirement
              </button>
            </div>
          </div>

          <button
            onClick={handleSearchResearch}
            disabled={isSearching || !query.trim()}
            className="w-full bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs py-3 border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Searching Precedents...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 text-amber-400" />
                <span>Conduct Legal AI Research</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Research Result */}
        <div className="lg:col-span-8 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
          {researchResult ? (
            <div className="space-y-5">
              
              <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B45309]">Research Query Brief</span>
                  <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">{researchResult.query}</h3>
                </div>

                <button
                  onClick={handleCopyResearch}
                  className="bg-[#F5F2EF] hover:bg-[#1A1A1A] hover:text-amber-400 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Brief'}</span>
                </button>
              </div>

              {/* Statutory Provisions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#B45309]" />
                  <span>Statutory Bare Act Provisions</span>
                </h4>
                <div className="space-y-2">
                  {researchResult.relevantProvisions.map((prov, idx) => (
                    <div key={idx} className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#1A1A1A] font-bold">{prov.act}</strong>
                        <span className="font-mono text-[10px] font-bold text-[#B45309]">{prov.section}</span>
                      </div>
                      <p className="text-[#1A1A1A] font-serif italic">{prov.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Landmark Judgments */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#B45309]" />
                  <span>Landmark Judicial Precedents & Citation Verification</span>
                </h4>
                
                {/* 5-Stage Verification Pipeline Indicator */}
                <div className="p-3 bg-amber-50 border border-amber-300 text-[10px] font-mono space-y-1">
                  <span className="font-bold text-[#B45309] block uppercase">Research Verification Pipeline Stages:</span>
                  <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                    <span className="bg-[#1A1A1A] text-white px-2 py-0.5">1. AI Suggestion</span>
                    <span>→</span>
                    <span className="bg-amber-200 text-amber-900 px-2 py-0.5">2. Source Retrieval (Not Configured)</span>
                    <span>→</span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5">3. Citation Metadata</span>
                    <span>→</span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5">4. Proposition Check</span>
                    <span>→</span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5">5. Human Review</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {researchResult.landmarkJudgments.map((j, idx) => (
                    <div key={idx} className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#1A1A1A] font-serif text-sm">{j.citation}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 border bg-amber-100 text-amber-900 border-amber-800">
                            Unverified Research Suggestion — Bare Act / Reporter Check Required
                          </span>
                          <span className="text-[10px] text-[#B45309] font-mono font-bold uppercase">{j.court} ({j.year})</span>
                        </div>
                      </div>
                      <p className="text-[#1A1A1A] font-serif italic">Ratio: "{j.ratio}"</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supporting vs Opposing Viewpoints */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 text-xs">
                  <h5 className="font-bold uppercase tracking-wider text-[10px] text-emerald-800">✔ Supporting Arguments for Client</h5>
                  <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                    {researchResult.supportingArguments.map((arg, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-emerald-700 font-bold">•</span>
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-[#FFF4F2] border border-[#FF4444] space-y-2 text-xs">
                  <h5 className="font-bold uppercase tracking-wider text-[10px] text-[#FF4444]">❌ Likely Opposing Arguments to Counter</h5>
                  <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                    {researchResult.opposingArguments.map((arg, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-[#FF4444] font-bold">•</span>
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Practical Steps */}
              <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] text-xs space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#B45309]">💡 Practical Advocate Courtroom Strategy:</h4>
                <ul className="space-y-1 text-[#1A1A1A] font-serif italic">
                  {researchResult.practicalConsiderations.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="font-bold text-[#B45309] font-mono">{idx + 1}.</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 text-[#1A1A1A] space-y-4 bg-[#F5F2EF] border border-[#1A1A1A]">
              <div className="w-12 h-12 bg-[#1A1A1A] text-amber-400 flex items-center justify-center border border-[#1A1A1A]">
                <Scale className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif italic text-lg font-bold">No legal research has been saved for this matter.</h3>
                <p className="text-xs text-[#555555]">Conduct statutory and precedent research using the query panel on the left.</p>
              </div>
              <button
                onClick={() => setQuery("Can an unregistered partition deed be relied upon in court?")}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] transition-colors"
              >
                Start Research
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
