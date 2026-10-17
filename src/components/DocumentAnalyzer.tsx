import React, { useState } from 'react';
import { 
  FileSearch, 
  Sparkles, 
  BookOpen, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Upload, 
  RefreshCw, 
  Scale,
  Layers,
  FileCheck
} from 'lucide-react';
import { DocumentAnalysisResult, JudgmentSummary } from '../types';
import { SAMPLE_DOC_ANALYSIS } from '../data/landingDemoData';
import { apiPost } from '../lib/api';
import { eventBus } from '../lib/eventBus';
import { logAuditEvent } from '../lib/auditLogger';
import { legalIntelligenceEngine, UniversalLegalAnalysis } from '../lib/legalIntelligenceEngine';
import { Brain } from 'lucide-react';

import { CaseFile } from '../types';
import { saveExtractedFactsToMatter } from '../lib/useMatterData';
import { PageHeader } from './ui/PageHeader';

interface DocumentAnalyzerProps {
  selectedCase?: CaseFile | null;
  chamberId?: string;
}

export const DocumentAnalyzer: React.FC<DocumentAnalyzerProps> = ({ selectedCase, chamberId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'case_bundle' | 'judgment'>('case_bundle');
  const [documentText, setDocumentText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [uleAnalysis, setUleAnalysis] = useState<UniversalLegalAnalysis | null>(null);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string>('');

  const handleLoadSampleDoc = () => {
    setDocumentText(`SALE DEED DOC NO 4012/2026 SUB REGISTRAR OFFICE MYLAPORE
Date of Execution: 14th June 2026
Vendor: Suresh Kumar, S/o Late K. Ramachandran, residing at Mylapore, Chennai.
Purchaser: M/s Star Builders Pvt Ltd, Rep by Managing Director.
Property Extent: 2400 sq.ft land and building situated at Survey No 114/2, Mylapore.
Consideration Amount: Rs. 1,20,000,000/- (One Crore Twenty Lakhs Only).
Recital 3: Vendor asserts sole and absolute ownership by virtue of oral family arrangement dated August 2020 following demise of father K. Ramachandran on 18-09-2020.
Recital 7: Vendor indemnifies Purchaser against all claims by legal heirs or co-sharers.`);
    setFileName('Mylapore_Property_Bundle.pdf');
  };

  // Judgment Analyzer State
  const [judgmentText, setJudgmentText] = useState<string>(
    `IN THE SUPREME COURT OF INDIA
CIVIL APPELLATE JURISDICTION
CIVIL APPEAL NO. 3260 OF 2019
Vineeta Sharma ... Appellant vs. Rakesh Sharma & Ors ... Respondents
Bench: Justice Arun Mishra, Justice S. Abdul Nazeer, Justice M.R. Shah

JUDGMENT
1. The question referred to this three-Judge Bench concerns the interpretation of Section 6 of the Hindu Succession Act, 1956, as substituted by the Hindu Succession (Amendment) Act, 2005.
2. The fundamental issue is whether the daughter of a coparcener is entitled to equal coparcenary rights by birth in the same manner as a son, and whether the father coparcener had to be alive as on 09-09-2005 (date of amendment).
3. HELD: The provisions contained in substituted Section 6 confer status of coparcener on the daughter by birth. Since coparcenary right is conferred by birth, it is not necessary that the father coparcener should be living as on 09.09.2005.`
  );
  const [judgmentResult, setJudgmentResult] = useState<JudgmentSummary | null>(null);

  const handleAnalyzeDoc = async () => {
    if (!documentText.trim()) return;
    const targetMatterId = selectedCase?.id;
    setIsAnalyzing(true);
    setSaveStatusMsg('');
    try {
      const uleData = legalIntelligenceEngine.analyzeFacts(documentText);
      setUleAnalysis(uleData);

      const data = await apiPost<DocumentAnalysisResult>('/api/ai/analyze-document', { 
        documentText, 
        fileName, 
        chamberId, 
        caseId: targetMatterId 
      });

      if (data.keyFacts) {
        setAnalysisResult(data);

        // Save extracted facts to matter if in active matter context
        if (selectedCase && chamberId && targetMatterId === selectedCase.id) {
          await saveExtractedFactsToMatter(chamberId, targetMatterId, {
            summary: uleData?.inputFactSummary || `Document Bundle Analysis for ${fileName || 'Uploaded Document'}`,
            facts: data.keyFacts || uleData?.rootCauses || [],
            timeline: (data.timelineEvents || []).map(t => ({ date: t.date, event: t.description })),
            riskFactors: uleData?.rootCauses || [],
            favourableFactors: data.importantClauses || []
          });
          setSaveStatusMsg('✓ Extracted facts & chronology persisted to Matter Record');
        }

        // Autonomous Multi-Agent Pipeline Dispatch via Central Event Bus
        eventBus.publish('DOCUMENT_UPLOADED', { chamberId, matterId: targetMatterId, fileName, documentText: documentText.substring(0, 200) });
        eventBus.publish('FACT_EXTRACTED', { chamberId, matterId: targetMatterId, keyFactsCount: data.keyFacts.length });
        eventBus.publish('TIMELINE_UPDATED', { chamberId, matterId: targetMatterId, events: data.timelineEvents });
        eventBus.publish('AI_MEMORY_UPDATED', { chamberId, matterId: targetMatterId, summary: `Analyzed document ${fileName || 'Bundle'} containing ${data.keyFacts.length} facts.` });
        
        logAuditEvent('DOCUMENT_VIEW', `Autonomous AI Pipeline triggered for uploaded file: ${fileName || 'Case Bundle'}`, { chamberId, caseId: targetMatterId });
      }
    } catch (err) {
      console.error('Doc Analysis Error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeJudgment = async () => {
    if (!judgmentText.trim()) return;
    setIsAnalyzing(true);
    try {
      const data = await apiPost<JudgmentSummary>('/api/ai/judgment-analyzer', { judgmentText });
      if (data.ratioDecidendi) {
        setJudgmentResult(data);
      }
    } catch (err) {
      console.error('Judgment Analysis Error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clean Page Header */}
      <PageHeader
        title="Document Analysis & Judgment Intelligence"
        description="Extract facts, chronologies, contradictions, missing evidence, and ratio decidendi from matter documents and judgments."
        badgeText="Document Processing"
        secondaryActions={
          <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setActiveSubTab('case_bundle')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                activeSubTab === 'case_bundle' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Document Bundle
            </button>
            <button
              onClick={() => setActiveSubTab('judgment')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                activeSubTab === 'judgment' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Judgment Ratio
            </button>
          </div>
        }
      />

      {/* CASE BUNDLE SUB TAB */}
      {activeSubTab === 'case_bundle' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Document Upload / Input */}
          <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
                  Document / Bundle Text:
                </label>
                <span className="text-[11px] font-mono text-[#B45309] font-bold">{fileName}</span>
              </div>

              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                rows={10}
                className="w-full p-4 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#B45309] resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer bg-[#F5F2EF] hover:bg-[#EAE6E1] text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider py-2.5 flex items-center justify-center gap-1.5 transition-colors">
                <Upload className="w-4 h-4 text-[#B45309]" />
                <span>Upload PDF / File</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setDocumentText(evt.target?.result as string || '');
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <button
                onClick={() => {
                  setDocumentText(`NOTICE FOR RECOVERY OF ADVANCE AMOUNT
To: Vertex Infra Pvt Ltd
Date: 10th January 2026
Recital: Under MSA dated 05-02-2024, client delivered software modules worth Rs 45,00,000. Defendant issued cheque No 401201 which bounced on 15-12-2025 due to insufficient funds.`);
                  setFileName('Contract_Notice_Bounced_Cheque.txt');
                }}
                className="text-xs text-[#B45309] hover:underline font-bold uppercase tracking-wider"
              >
                Sample Notice
              </button>
            </div>

            <button
              onClick={handleAnalyzeDoc}
              disabled={isAnalyzing || !documentText.trim()}
              className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold py-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-[#1A1A1A] disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Extracting 15 Key Facts & Timeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Analyze Case Document Bundle</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: AI Extraction Output */}
          <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-6">
            {analysisResult ? (
              <div className="space-y-6">

                {/* Universal Legal Intelligence Engine Reasoning Diagnosis */}
                {uleAnalysis && (
                  <div className="p-4 bg-[#1A1A1A] text-white border-2 border-amber-500/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                        <Brain className="w-4 h-4 text-amber-400" />
                        <span>UNIVERSAL LEGAL INTELLIGENCE DIAGNOSIS</span>
                      </div>
                      <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 font-bold font-mono uppercase">
                        {uleAnalysis.primaryDomain}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-300 font-mono uppercase block">Root Cause Defect:</span>
                      <p className="font-serif italic text-sm font-bold text-amber-200">
                        {uleAnalysis.rootCauses[0] || uleAnalysis.coreIssueTitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-300">
                      <div>Primary Forum: <strong className="text-white">{uleAnalysis.recommendedAuthorities[0]?.authorityName}</strong></div>
                      <div>Fastest Remedy: <strong className="text-amber-300">{uleAnalysis.recommendedRemedies[0]?.title}</strong></div>
                    </div>
                  </div>
                )}
                
                {/* 15 Key Facts */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Extracted Key Facts ({analysisResult.keyFacts.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {analysisResult.keyFacts.map((fact, idx) => (
                      <div key={idx} className="p-3 bg-[#F9F7F5] border border-[#1A1A1A]/30 text-xs text-[#1A1A1A] flex items-start gap-3">
                        <span className="w-5 h-5 bg-[#1A1A1A] text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-serif italic leading-relaxed">{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contradictions Alert */}
                {analysisResult.contradictions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF4444] flex items-center gap-2 border-b border-[#FF4444] pb-2">
                      <AlertTriangle className="w-4 h-4 text-[#FF4444]" />
                      <span>Contradictions & Inconsistencies Detected</span>
                    </h3>
                    <div className="space-y-2">
                      {analysisResult.contradictions.map((c, idx) => (
                        <div key={idx} className="p-3.5 bg-[#FFF4F2] border border-[#FF4444] space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#FF4444] uppercase tracking-wider text-[10px]">Severity: {c.severity}</span>
                            <span className="text-[10px] text-[#1A1A1A] font-mono">{c.source1}</span>
                          </div>
                          <p className="text-[#1A1A1A]"><strong>Source 1:</strong> {c.item1}</p>
                          <p className="text-[#1A1A1A]"><strong>Source 2:</strong> {c.item2}</p>
                          <div className="p-2 bg-white border border-[#FF4444]/40 text-[#1A1A1A] font-serif italic text-xs">
                            💡 <strong>Advocate Cross-Exam Strategy:</strong> {c.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Chronology */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2 border-b border-[#1A1A1A] pb-2">
                    <Clock className="w-4 h-4 text-[#B45309]" />
                    <span>Chronological Document Timeline</span>
                  </h3>
                  <div className="space-y-2 border-l-2 border-[#1A1A1A] ml-2 pl-3">
                    {analysisResult.timelineEvents.map((t, idx) => (
                      <div key={idx} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#B45309]">{t.date}</span>
                          <span className="text-[9px] uppercase font-bold bg-[#1A1A1A] text-white px-1.5 py-0.2">{t.sourceDoc}</span>
                        </div>
                        <p className="text-[#1A1A1A] font-serif italic">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Legal Issues */}
                <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#B45309] flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-[#B45309]" />
                    <span>Suggested Legal Issues for Court Framing</span>
                  </h4>
                  <ul className="text-xs space-y-1.5 text-[#1A1A1A]">
                    {analysisResult.suggestedLegalIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="font-bold text-[#1A1A1A]">Issue {idx + 1}:</span>
                        <span className="font-serif italic">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#555555]">
                <FileSearch className="w-12 h-12 text-[#1A1A1A] mb-3" />
                <p className="text-sm font-serif italic">Paste or upload a case document bundle to analyze.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* JUDGMENT RATIO SUB TAB */}
      {activeSubTab === 'judgment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] mb-2">
                Court Judgment Text / Headnotes (up to 150 pages):
              </label>
              <textarea
                value={judgmentText}
                onChange={(e) => setJudgmentText(e.target.value)}
                rows={12}
                className="w-full p-4 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#B45309] resize-none leading-relaxed"
              />
            </div>

            <button
              onClick={handleAnalyzeJudgment}
              disabled={isAnalyzing || !judgmentText.trim()}
              className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold py-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-[#1A1A1A] disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Extracting Ratio Decidendi & Principles...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Analyze Court Judgment</span>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
            {judgmentResult ? (
              <div className="space-y-4">
                <div className="border-b border-[#1A1A1A] pb-3">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#B45309]">{judgmentResult.citation} • {judgmentResult.bench}</span>
                  <h3 className="text-2xl font-serif italic font-bold text-[#1A1A1A]">{judgmentResult.caseName}</h3>
                </div>

                <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#B45309]">Ratio Decidendi (Binding Legal Principle)</span>
                  <p className="text-sm font-serif italic font-bold text-[#1A1A1A]">{judgmentResult.ratioDecidendi}</p>
                </div>

                <div className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 text-xs">
                  <strong className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">Summary of Facts & Background:</strong>
                  <p className="text-[#1A1A1A] font-serif italic leading-relaxed">{judgmentResult.facts}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">Court Reasoning:</h4>
                  <p className="text-xs text-[#1A1A1A] bg-[#F9F7F5] p-3 border border-[#1A1A1A] font-serif italic leading-relaxed">{judgmentResult.courtReasoning}</p>
                </div>

                <div className="p-3.5 bg-[#F5F2EF] border border-[#1A1A1A] space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Practical Advocate Takeaways:</h4>
                  <ul className="text-xs space-y-1 text-[#1A1A1A]">
                    {judgmentResult.practicalTakeaways.map((t, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-700 font-bold">•</span>
                        <span className="font-serif italic">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#555555]">
                <BookOpen className="w-12 h-12 text-[#1A1A1A] mb-3" />
                <p className="text-sm font-serif italic">Paste a judgment text to extract ratio decidendi and practical takeaways.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
