import React, { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  ShieldCheck, 
  GitBranch, 
  Layers, 
  MapPin, 
  AlertCircle, 
  FileCheck, 
  Search, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  BookOpen, 
  Scale, 
  FileText, 
  Building2, 
  Sliders, 
  HelpCircle,
  Download,
  Share2
} from 'lucide-react';
import { 
  legalIntelligenceEngine, 
  UNIVERSAL_KNOWLEDGE_PACKS, 
  UniversalLegalDomain, 
  StateJurisdiction, 
  UniversalLegalAnalysis 
} from '../lib/legalIntelligenceEngine';
import { useTranslation } from '../lib/multilingualEngine';

export const LegalIntelligenceWorkspace: React.FC = () => {
  const { t, formatTerm } = useTranslation();

  const [inputStory, setInputStory] = useState<string>(
    'My brother Suresh Kumar sold our ancestral 2400 sq.ft land at Mylapore, Survey No 114/2, to a private builder without my consent or a registered partition deed. He obtained a sole Patta from the Tahsildar claiming an oral family arrangement following our father Ramachandran’s demise in September 2020.'
  );

  const [selectedJurisdiction, setSelectedJurisdiction] = useState<StateJurisdiction>('Tamil Nadu');
  const [selectedDomainPack, setSelectedDomainPack] = useState<UniversalLegalDomain>('Property360');
  const [activeStepTab, setActiveStepTab] = useState<'overview' | 'domain' | 'root_cause' | 'graph' | 'evidence' | 'authority' | 'remedy' | 'opponent' | 'predictions'>('overview');

  const [analysis, setAnalysis] = useState<UniversalLegalAnalysis>(() => 
    legalIntelligenceEngine.analyzeFacts(inputStory, selectedJurisdiction)
  );

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const handleRunPipeline = () => {
    if (!inputStory.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = legalIntelligenceEngine.analyzeFacts(inputStory, selectedJurisdiction);
      setAnalysis(res);
      setSelectedDomainPack(res.primaryDomain);
      setIsAnalyzing(false);
    }, 400);
  };

  const domainPackMeta = UNIVERSAL_KNOWLEDGE_PACKS[selectedDomainPack];

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#1A1A1A] text-white p-6 border-2 border-amber-500/40 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] bg-amber-500 text-black px-2.5 py-0.5 mb-2">
              <Brain className="w-3.5 h-3.5 text-black" />
              <span>Universal Legal Intelligence Engine • 10-Step Reasoning Matrix</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-white">AI Legal Reasoning & Domain Knowledge Engine</h1>
            <p className="text-xs text-slate-300 leading-relaxed mt-1 max-w-3xl">
              Underneath Advocate360 lies a universal reasoning core. Enter raw client facts or legal queries to trigger domain detection, root cause pinpointing, legal relationship graph construction, authority recommendation, missing evidence extraction, and opponent defense prediction across 16 universal legal domains.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value as StateJurisdiction)}
              className="bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold px-3 py-2 uppercase tracking-wider focus:outline-none"
            >
              <option value="Tamil Nadu">State Pack: Tamil Nadu</option>
              <option value="Karnataka">State Pack: Karnataka</option>
              <option value="Kerala">State Pack: Kerala</option>
              <option value="Maharashtra">State Pack: Maharashtra</option>
              <option value="Andhra Pradesh">State Pack: Andhra Pradesh</option>
              <option value="Telangana">State Pack: Telangana</option>
              <option value="National / All India">National / Central Codes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Input Fact Canvas & Knowledge Pack Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Input Fact Story */}
        <div className="lg:col-span-7 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-700" />
              <span>Raw Client Fact / Natural Language Case Story:</span>
            </label>
            <span className="text-[10px] font-mono text-[#555555]">Auto-Detects Legal Domain & Root Cause</span>
          </div>

          <textarea
            value={inputStory}
            onChange={(e) => setInputStory(e.target.value)}
            rows={5}
            placeholder="Type or paste client facts, e.g., 'My brother sold our ancestral property without my consent...'"
            className="w-full p-3.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-600 resize-none"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-[#555555]">
              <MapPin className="w-3.5 h-3.5 text-amber-800" />
              <span>Selected State Pack: <strong className="font-mono text-[#1A1A1A]">{selectedJurisdiction}</strong></span>
            </div>

            <button
              onClick={handleRunPipeline}
              disabled={isAnalyzing}
              className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-amber-400 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] flex items-center gap-2 transition-all shadow-sm"
            >
              <Brain className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Running Legal Engine...' : 'Run 10-Step Reasoning Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Knowledge Packs Browser */}
        <div className="lg:col-span-5 bg-[#F5F2EF] border border-[#1A1A1A] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-purple-800" />
              <span>Universal Knowledge Packs (16 Domains)</span>
            </span>
            <span className="text-[10px] font-mono text-purple-900 font-bold">Domain 360</span>
          </div>

          <p className="text-[11px] text-[#555555] leading-relaxed">
            Select a specialized Knowledge Pack to view embedded statutory provisions, mandatory evidence checklists, and primary administrative authorities:
          </p>

          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {(Object.keys(UNIVERSAL_KNOWLEDGE_PACKS) as UniversalLegalDomain[]).map((dom) => {
              const meta = UNIVERSAL_KNOWLEDGE_PACKS[dom];
              const isSelected = selectedDomainPack === dom;
              return (
                <button
                  key={dom}
                  onClick={() => setSelectedDomainPack(dom)}
                  className={`px-2.5 py-1.5 text-left text-[11px] font-mono font-bold flex items-center justify-between border transition-all ${
                    isSelected 
                      ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' 
                      : 'bg-white text-[#1A1A1A] border-[#1A1A1A]/30 hover:border-[#1A1A1A]'
                  }`}
                >
                  <span className="truncate">{dom}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-white border border-[#1A1A1A] text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-[#1A1A1A]">{domainPackMeta.title}</span>
              <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase ${domainPackMeta.badgeColor}`}>
                Active Pack
              </span>
            </div>
            <p className="text-[11px] font-serif italic text-[#555555] leading-tight">
              {domainPackMeta.description}
            </p>
          </div>
        </div>

      </div>

      {/* 10-STEP REASONING RESULTS MATRIX */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] shadow-md overflow-hidden">
        
        {/* Navigation Tabs for the 10 Steps */}
        <div className="bg-[#1A1A1A] text-white p-2 flex flex-wrap items-center gap-1 text-[11px] font-mono font-bold uppercase border-b border-amber-500/40 overflow-x-auto">
          <button
            onClick={() => setActiveStepTab('overview')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'overview' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            1. Overview
          </button>
          <button
            onClick={() => setActiveStepTab('domain')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'domain' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            2. Domain & Laws
          </button>
          <button
            onClick={() => setActiveStepTab('root_cause')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'root_cause' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            3. Root Cause Engine
          </button>
          <button
            onClick={() => setActiveStepTab('graph')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'graph' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            4. Legal Graph
          </button>
          <button
            onClick={() => setActiveStepTab('evidence')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'evidence' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            5. Missing Evidence ({analysis.evidenceMatrix.missingEvidence.length})
          </button>
          <button
            onClick={() => setActiveStepTab('authority')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'authority' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            6. Authority Map
          </button>
          <button
            onClick={() => setActiveStepTab('remedy')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'remedy' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            7. Remedy Tree
          </button>
          <button
            onClick={() => setActiveStepTab('opponent')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'opponent' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            8. Opponent Strategy
          </button>
          <button
            onClick={() => setActiveStepTab('predictions')}
            className={`px-3 py-1.5 border transition-all ${activeStepTab === 'predictions' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'}`}
          >
            9. Time & Cost Predictor
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="p-6">
          
          {/* TAB 1: OVERVIEW SUMMARY */}
          {activeStepTab === 'overview' && (
            <div className="space-y-6">
              
              <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#1A1A1A] text-amber-400 px-2.5 py-1">
                    AI Legal Diagnosis Output
                  </span>
                  <span className="text-xs font-mono text-[#555555]">
                    Confidence Score: <strong className="text-emerald-700">{analysis.domainConfidenceScore}%</strong>
                  </span>
                </div>

                <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                  {analysis.coreIssueTitle}
                </h3>

                <p className="text-xs font-serif italic text-[#555555] leading-relaxed">
                  "{analysis.inputFactSummary}"
                </p>
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 bg-white border border-[#1A1A1A] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#555555] block">Detected Domain</span>
                  <span className="font-mono text-sm font-bold text-[#B45309] block">{analysis.primaryDomain}</span>
                  <span className="text-[10px] text-[#777777] block">State Pack: {analysis.jurisdiction}</span>
                </div>

                <div className="p-4 bg-white border border-[#1A1A1A] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#555555] block">Primary Remedy</span>
                  <span className="font-mono text-xs font-bold text-[#1A1A1A] block">{analysis.recommendedRemedies[0]?.title}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">Fastest Path to Relief</span>
                </div>

                <div className="p-4 bg-white border border-[#1A1A1A] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#555555] block">Missing Critical Evidence</span>
                  <span className="font-mono text-lg font-bold text-red-700 block">{analysis.evidenceMatrix.missingEvidence.length} Documents</span>
                  <span className="text-[10px] text-[#777777] block">Required for Title / Relief</span>
                </div>

                <div className="p-4 bg-white border border-[#1A1A1A] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#555555] block">Estimated Duration & Cost</span>
                  <span className="font-mono text-xs font-bold text-purple-900 block">{analysis.predictions.estimatedDurationMonths} Months • {analysis.predictions.estimatedCostINR}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">Success Probability: {analysis.predictions.successProbabilityPercentage}%</span>
                </div>
              </div>

              {/* Preventive Legal Advice */}
              <div className="p-4 bg-amber-500/10 border border-amber-700/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-800" />
                  <span>Preventive Legal Advice & Next Urgent Steps:</span>
                </div>
                <ul className="space-y-1 text-xs text-[#1A1A1A]">
                  {analysis.predictions.preventiveAdvice.map((adv, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-amber-800">•</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

          {/* TAB 2: DOMAIN & LAWS */}
          {activeStepTab === 'domain' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#F5F2EF] p-4 border border-[#1A1A1A] flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-lg text-[#1A1A1A]">{domainPackMeta.title}</h4>
                  <p className="text-[#555555] text-xs mt-0.5">{domainPackMeta.description}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold font-mono uppercase ${domainPackMeta.badgeColor}`}>
                  {analysis.primaryDomain}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-[#1A1A1A] space-y-2">
                  <span className="text-[10px] font-bold uppercase text-[#1A1A1A] block border-b pb-1">
                    Applicable Key Statutes & Codes
                  </span>
                  <ul className="space-y-1.5 font-mono text-[11px] text-[#1A1A1A]">
                    {domainPackMeta.keyStatutes.map((st, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-white border border-[#1A1A1A] space-y-2">
                  <span className="text-[10px] font-bold uppercase text-[#1A1A1A] block border-b pb-1">
                    Primary Administrative & Judicial Authorities
                  </span>
                  <ul className="space-y-1.5 font-mono text-[11px] text-[#1A1A1A]">
                    {domainPackMeta.primaryAuthorities.map((auth, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>{auth}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROOT CAUSE ENGINE */}
          {activeStepTab === 'root_cause' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-white border border-[#1A1A1A] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block">
                  Root Cause Diagnosis & Dispute Trigger Pinpointing
                </span>
                <p className="text-xs text-[#555555] leading-relaxed">
                  Instead of treating this as a generic dispute, the AI Root Cause Engine extracts the precise origin of defect:
                </p>

                <div className="space-y-2 pt-2">
                  {analysis.rootCauses.map((rc, idx) => (
                    <div key={idx} className="p-3 bg-[#F9F7F5] border-l-4 border-amber-600 border border-[#1A1A1A]/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-[#555555] uppercase block">Root Defect Cause #{idx + 1}</span>
                        <span className="font-serif font-bold text-sm text-[#1A1A1A]">{rc}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-[#1A1A1A] text-amber-300 px-2 py-0.5">Diagnosed</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEGAL GRAPH */}
          {activeStepTab === 'graph' && (
            <div className="space-y-4 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block">
                Extracted Legal Relationship Graph Nodes & Entities
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.relationshipGraph.nodes.map((node) => (
                  <div key={node.id} className="p-3 bg-white border border-[#1A1A1A] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-[#1A1A1A]">{node.name}</span>
                      <span className="text-[9px] font-mono bg-[#1A1A1A] text-amber-400 px-2 py-0.5 uppercase">
                        {node.type}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[#555555]">{node.role || node.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MISSING EVIDENCE */}
          {activeStepTab === 'evidence' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Missing Evidence Detector & Document Procurement Checklist ({analysis.evidenceMatrix.missingEvidence.length})
                </span>
                <span className="text-[10px] font-mono text-red-700 font-bold bg-red-100 px-2 py-0.5 border border-red-300">
                  Critical Gap Analysis
                </span>
              </div>

              <div className="space-y-3">
                {analysis.evidenceMatrix.missingEvidence.map((item, idx) => (
                  <div key={idx} className="p-4 bg-white border border-[#1A1A1A] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-700" />
                        <span>{item.documentName}</span>
                      </span>
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 ${
                        item.urgency === 'Critical' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        {item.urgency} Gap
                      </span>
                    </div>

                    <p className="text-xs text-[#555555]">{item.reasonWhyNeeded}</p>

                    <div className="pt-2 border-t border-[#1A1A1A]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono">
                      <span>Issuing Authority: <strong className="text-[#1A1A1A]">{item.issuingAuthority}</strong></span>
                      <span className="text-purple-800 font-bold">Action: {item.howToObtain}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: AUTHORITY MAP */}
          {activeStepTab === 'authority' && (
            <div className="space-y-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block">
                Recommended Administrative & Judicial Forum Hierarchy
              </span>

              <div className="divide-y border border-[#1A1A1A]">
                {analysis.recommendedAuthorities.map((auth) => (
                  <div key={auth.rank} className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-[#1A1A1A] text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center rounded-full">
                          #{auth.rank}
                        </span>
                        <span className="font-serif font-bold text-sm text-[#1A1A1A]">{auth.authorityName}</span>
                      </div>
                      <p className="text-xs text-[#555555] pl-7">{auth.reason}</p>
                    </div>

                    <div className="text-right sm:shrink-0 pl-7 sm:pl-0">
                      <span className="text-[10px] font-mono font-bold bg-[#F5F2EF] text-[#1A1A1A] border border-[#1A1A1A] px-2.5 py-1 inline-block uppercase">
                        {auth.forumType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: REMEDY TREE */}
          {activeStepTab === 'remedy' && (
            <div className="space-y-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] block">
                Legal Remedy Recommendation Tree & Strategic Options
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.recommendedRemedies.map((rem, idx) => (
                  <div key={idx} className={`p-4 border-2 space-y-2 ${rem.fastestPath ? 'bg-amber-500/10 border-amber-600' : 'bg-white border-[#1A1A1A]'}`}>
                    <div className="flex items-center justify-between">
                      <h5 className="font-serif font-bold text-sm text-[#1A1A1A]">{rem.title}</h5>
                      {rem.fastestPath && (
                        <span className="text-[9px] font-mono bg-amber-600 text-white font-bold px-2 py-0.5 uppercase">
                          Fastest Path
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-mono text-purple-900 font-bold">{rem.statutoryProvision}</p>

                    <div className="pt-2 border-t border-current/20 flex items-center justify-between text-[10px] font-mono">
                      <span>Timeframe: <strong>{rem.timeframeToRelief}</strong></span>
                      <span>Est. Cost: <strong>{rem.costEstimateBracket}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: OPPONENT STRATEGY */}
          {activeStepTab === 'opponent' && (
            <div className="p-5 bg-white border border-[#1A1A1A] space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-serif font-bold text-base text-[#1A1A1A]">
                  AI Opponent Defense Predictor & Weakness Analysis
                </span>
                <span className="text-xs font-mono font-bold text-purple-900 bg-purple-100 px-2.5 py-0.5 border border-purple-300">
                  Defensive Probability: {analysis.strategyPredictions.probabilityScore}%
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#F9F7F5] border-l-4 border-red-600 border border-[#1A1A1A]/20">
                  <span className="text-[10px] font-mono uppercase font-bold text-red-800 block">Predicted Opponent Defense / Objection:</span>
                  <p className="text-xs font-serif italic text-[#1A1A1A] mt-1">{analysis.strategyPredictions.likelyDefense}</p>
                </div>

                <div className="p-3 bg-[#F9F7F5] border-l-4 border-amber-600 border border-[#1A1A1A]/20">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">Client Vulnerability / Gap to Shield:</span>
                  <p className="text-xs font-serif italic text-[#1A1A1A] mt-1">{analysis.strategyPredictions.vulnerabilityInClientCase}</p>
                </div>

                <div className="p-3 bg-[#F9F7F5] border-l-4 border-emerald-600 border border-[#1A1A1A]/20">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">Recommended Advocate Counter-Strategy:</span>
                  <p className="text-xs font-serif italic text-[#1A1A1A] mt-1">{analysis.strategyPredictions.bestCounterStrategy}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: TIME & COST PREDICTIONS */}
          {activeStepTab === 'predictions' && (
            <div className="p-5 bg-white border border-[#1A1A1A] space-y-4 text-xs">
              <span className="font-serif font-bold text-base text-[#1A1A1A] block border-b pb-2">
                Litigation Timeframe, Cost & Complexity Calculator
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A]">
                  <span className="text-[10px] font-bold uppercase text-[#555555] block">Estimated Duration</span>
                  <span className="font-mono text-2xl font-bold text-[#1A1A1A]">{analysis.predictions.estimatedDurationMonths} Months</span>
                </div>

                <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A]">
                  <span className="text-[10px] font-bold uppercase text-[#555555] block">Estimated Cost Bracket</span>
                  <span className="font-mono text-lg font-bold text-[#B45309]">{analysis.predictions.estimatedCostINR}</span>
                </div>

                <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A]">
                  <span className="text-[10px] font-bold uppercase text-[#555555] block">Success Probability</span>
                  <span className="font-mono text-2xl font-bold text-emerald-700">{analysis.predictions.successProbabilityPercentage}%</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
