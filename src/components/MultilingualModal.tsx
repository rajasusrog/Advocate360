import React, { useState, useEffect } from 'react';
import { 
  Languages, 
  Check, 
  Globe, 
  Sparkles, 
  Mic, 
  FileText, 
  Bot, 
  Search, 
  Volume2, 
  ArrowRight, 
  Settings, 
  X,
  Layers,
  Copy,
  BookOpen,
  ShieldCheck,
  Award,
  CheckCircle2,
  Cpu,
  Zap,
  Filter,
  FileCheck,
  Scale,
  RotateCcw
} from 'lucide-react';
import { 
  multilingualEngine, 
  SUPPORTED_LANGUAGES, 
  LanguageCode, 
  MultilingualPreferences,
  OutputMode,
  MultiStageTranslationResult,
  LEGAL_TRANSLATION_MEMORY
} from '../lib/multilingualEngine';
import { logAuditEvent } from '../lib/auditLogger';

interface MultilingualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultilingualModal: React.FC<MultilingualModalProps> = ({ isOpen, onClose }) => {
  const [prefs, setPrefs] = useState<MultilingualPreferences>(multilingualEngine.getPreferences());
  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'config' | 'memory'>('pipeline');

  // 10-Stage Pipeline State
  const [targetLang, setTargetLang] = useState<LanguageCode>('ta');
  const [outputMode, setOutputMode] = useState<OutputMode>('bilingual');
  const [inputText, setInputText] = useState<string>(
    'என் அண்ணன் 14/08/1995 அன்று எங்கள் பூர்வீக நிலத்தை (SF No. 142/3B, Patta No. 892) எனது அனுமதி இல்லாமல் Rs. 45,00,000க்கு விற்றுவிட்டார். நான் சிவில் நடைமுறைச் சட்டம் ஆணை 39 விதிகள் 1 & 2 இன் கீழ் இடைக்கால தடை மனு கோர விரும்புகிறேன்.'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pipelineResult, setPipelineResult] = useState<MultiStageTranslationResult | null>(null);
  const [searchTermMemory, setSearchTermMemory] = useState<string>('');

  useEffect(() => {
    const unsub = multilingualEngine.subscribe(updated => setPrefs(updated));
    return () => unsub();
  }, []);

  // Run pipeline initially or on test
  useEffect(() => {
    if (isOpen && !pipelineResult) {
      runPipeline();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdatePref = (key: keyof MultilingualPreferences, code: LanguageCode) => {
    multilingualEngine.updatePreferences({ [key]: code });
    logAuditEvent('ROLE_CHANGE', `Updated Multilingual Legal Intelligence Preference: ${key} = ${code}`);
  };

  const runPipeline = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const res = multilingualEngine.executeMultiStageTranslation(inputText, targetLang, outputMode);
      setPipelineResult(res);
      setIsProcessing(false);
      logAuditEvent('AI_GENERATION', `Executed 10-Stage Enterprise Multilingual Pipeline for target [${targetLang.toUpperCase()}] in [${outputMode}] mode`);
    }, 600);
  };

  const filteredMemory = LEGAL_TRANSLATION_MEMORY.filter(rec => 
    rec.englishTerm.toLowerCase().includes(searchTermMemory.toLowerCase()) ||
    rec.category.toLowerCase().includes(searchTermMemory.toLowerCase()) ||
    Object.values(rec.translations).some(t => t.toLowerCase().includes(searchTermMemory.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-5xl shadow-2xl space-y-0 my-8">
        
        {/* Modal Header */}
        <div className="bg-[#1A1A1A] text-white p-5 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono bg-amber-500 text-black px-2 py-0.5 font-bold uppercase tracking-wider">
                  Enterprise Engine v10.0
                </span>
                <span className="text-[10px] font-mono text-amber-200">10-Stage Quality Validation Pipeline Active</span>
              </div>
              <h2 className="font-serif text-2xl font-light italic">Multilingual Legal OS Intelligence Engine</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                multilingualEngine.resetToDefaults();
                logAuditEvent('ROLE_CHANGE', 'Reset all multilingual OS preferences to English defaults');
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-xs"
              title="Reset all preferences to English defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-black" />
              <span>Reset to English</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="bg-[#F5F2EF] border-b border-[#1A1A1A] px-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveSubTab('pipeline')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 ${
              activeSubTab === 'pipeline'
                ? 'border-[#1A1A1A] text-[#1A1A1A] bg-white font-bold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>10-Stage Multi-Translation Pipeline</span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 ${
              activeSubTab === 'config'
                ? 'border-[#1A1A1A] text-[#1A1A1A] bg-white font-bold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-slate-700" />
            <span>Domain Language Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 ${
              activeSubTab === 'memory'
                ? 'border-[#1A1A1A] text-[#1A1A1A] bg-white font-bold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-800" />
            <span>Legal Translation Memory (TM)</span>
          </button>
        </div>

        {/* Sub-Tab 1: 10-Stage Pipeline Inspector */}
        {activeSubTab === 'pipeline' && (
          <div className="p-6 space-y-6">
            
            {/* Input & Options Control Panel */}
            <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Target Language */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">
                    Target Output Language:
                  </label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                    className="w-full bg-white border border-[#1A1A1A] p-2 text-xs font-mono font-bold text-[#1A1A1A]"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name} ({lang.nativeName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Output Mode */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">
                    Output Mode Presentation:
                  </label>
                  <select
                    value={outputMode}
                    onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                    className="w-full bg-white border border-[#1A1A1A] p-2 text-xs font-mono font-bold text-[#1A1A1A]"
                  >
                    <option value="bilingual">Side-by-Side Bilingual (English + Native)</option>
                    <option value="regional_only">Target Language Report Only</option>
                    <option value="english_only">Canonical English Report Only</option>
                    <option value="multi_bundle">Multi-Language Bundle (EN + TA + HI + TE)</option>
                  </select>
                </div>

                {/* Run Button */}
                <div className="flex items-end">
                  <button
                    onClick={runPipeline}
                    disabled={isProcessing}
                    className="w-full py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A] hover:bg-black flex items-center justify-center gap-2 transition-colors"
                  >
                    <Cpu className={`w-4 h-4 ${isProcessing ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{isProcessing ? 'Executing Pipeline...' : 'Run 10-Stage Pipeline'}</span>
                  </button>
                </div>

              </div>

              {/* Sample Statement Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">
                  Input Statement (Any Indian Language or Dialect):
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-[#1A1A1A] text-xs font-mono text-[#1A1A1A] focus:outline-none"
                />
              </div>
            </div>

            {pipelineResult && (
              <div className="space-y-6">
                
                {/* 10-Stage Progress Workflow Tracker */}
                <div className="border border-[#1A1A1A] bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>10-Stage Execution & Validation Pipeline</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-800 text-white px-2 py-0.5 uppercase">
                      All 10 Stages Validated & Certified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {pipelineResult.pipelineStages.map((stg) => (
                      <div key={stg.stageNumber} className="p-2 bg-[#F5F2EF] border border-[#1A1A1A]/30 text-[10px] font-mono space-y-1">
                        <div className="flex items-center justify-between font-bold text-[#1A1A1A]">
                          <span>Stage {stg.stageNumber}</span>
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        </div>
                        <p className="font-sans font-bold text-slate-800 line-clamp-1">{stg.name}</p>
                        <p className="text-[9px] text-slate-500 line-clamp-1">{stg.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scorecard & Preserved Identifiers Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Quality Scorecard */}
                  <div className="bg-[#1A1A1A] text-white p-4 border-2 border-amber-500 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Quality Scorecard</span>
                      <Award className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-mono font-bold text-amber-400">
                        {pipelineResult.qualityScore.overallScore}
                      </span>
                      <span className="text-xs text-slate-400">/ 100 Overall Score</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-slate-800">
                      <div>Accuracy: <span className="text-emerald-400 font-bold">{pipelineResult.qualityScore.translationAccuracy}%</span></div>
                      <div>Legal Tone: <span className="text-emerald-400 font-bold">{pipelineResult.qualityScore.legalAccuracy}%</span></div>
                      <div>Consistency: <span className="text-emerald-400 font-bold">{pipelineResult.qualityScore.consistencyScore}%</span></div>
                      <div>Terminology: <span className="text-emerald-400 font-bold">{pipelineResult.qualityScore.terminologyScore}%</span></div>
                    </div>
                  </div>

                  {/* Preserved Uncorrupted Identifiers */}
                  <div className="md:col-span-2 bg-[#F5F2EF] border border-[#1A1A1A] p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-amber-800" />
                      <span>Stage 6 Protected Non-Translatable Identifiers</span>
                    </span>
                    <p className="text-[11px] text-[#555555]">
                      Dates, Survey Numbers, Patta/Doc Numbers, Section Citations, and Monetary Values are strictly preserved from corruption during multi-language conversion:
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pipelineResult.preservedIdentifiers.dates.map((d, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white border border-[#1A1A1A] px-2 py-0.5 text-[#1A1A1A]">
                          📅 {d}
                        </span>
                      ))}
                      {pipelineResult.preservedIdentifiers.surveyNumbers.map((s, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white border border-[#1A1A1A] px-2 py-0.5 text-amber-900 font-bold">
                          🗺️ {s}
                        </span>
                      ))}
                      {pipelineResult.preservedIdentifiers.sectionNumbers.map((sec, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white border border-[#1A1A1A] px-2 py-0.5 text-purple-900 font-bold">
                          ⚖️ {sec}
                        </span>
                      ))}
                      {pipelineResult.preservedIdentifiers.monetaryValues.map((m, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white border border-[#1A1A1A] px-2 py-0.5 text-emerald-900 font-bold">
                          ₹ {m}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Final Report Output Presentation */}
                <div className="bg-white border-2 border-[#1A1A1A] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest font-bold bg-[#1A1A1A] text-amber-400 px-2 py-0.5">
                        Generated Report Mode: {outputMode.toUpperCase()}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-[#1A1A1A] mt-1">
                        {pipelineResult.translatedReport.title}
                      </h3>
                    </div>
                    <button className="px-3 py-1 bg-[#1A1A1A] text-white text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-black">
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Report</span>
                    </button>
                  </div>

                  {/* Mode 1: Side-by-Side Bilingual */}
                  {outputMode === 'bilingual' && pipelineResult.bilingualReport && (
                    <div className="space-y-4">
                      
                      {/* Executive Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F5F2EF] p-4 border border-[#1A1A1A]/40">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">English Canonical</span>
                          <p className="text-xs text-[#1A1A1A] font-sans leading-relaxed">
                            {pipelineResult.bilingualReport.executiveSummary.en}
                          </p>
                        </div>
                        <div className="space-y-1 border-t md:border-t-0 md:border-l border-[#1A1A1A]/20 pt-2 md:pt-0 md:pl-4">
                          <span className="text-[10px] font-bold font-mono text-amber-800 uppercase">
                            Native Target ({targetLang.toUpperCase()})
                          </span>
                          <p className="text-xs text-[#1A1A1A] font-sans leading-relaxed">
                            {pipelineResult.bilingualReport.executiveSummary.native}
                          </p>
                        </div>
                      </div>

                      {/* Fact Matrix */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase text-[#1A1A1A] font-mono">Bilingual Fact Matrix</span>
                        <div className="space-y-2">
                          {pipelineResult.bilingualReport.facts.map((f, i) => (
                            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#F5F2EF] border border-[#1A1A1A]/30 text-xs font-mono">
                              <div><span className="font-bold text-slate-500">EN:</span> {f.en}</div>
                              <div className="text-[#1A1A1A]"><span className="font-bold text-amber-800">NATIVE:</span> {f.native}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Mode 2: Regional Only */}
                  {outputMode === 'regional_only' && (
                    <div className="bg-[#F5F2EF] p-4 border border-[#1A1A1A]/40 space-y-3 text-xs font-mono">
                      <div>
                        <span className="font-bold text-amber-800 uppercase">Executive Summary:</span>
                        <p className="mt-1 text-[#1A1A1A] font-sans">{pipelineResult.translatedReport.executiveSummary}</p>
                      </div>
                      <div>
                        <span className="font-bold text-amber-800 uppercase">Core Facts:</span>
                        <ul className="list-disc pl-5 space-y-1 mt-1 text-[#1A1A1A]">
                          {pipelineResult.translatedReport.facts.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Canonical English Only */}
                  {outputMode === 'english_only' && (
                    <div className="bg-[#F5F2EF] p-4 border border-[#1A1A1A]/40 space-y-3 text-xs font-mono">
                      <div>
                        <span className="font-bold text-slate-800 uppercase">Executive Summary:</span>
                        <p className="mt-1 text-[#1A1A1A] font-sans">{pipelineResult.canonicalEnglishReport.executiveSummary}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 uppercase">Core Facts:</span>
                        <ul className="list-disc pl-5 space-y-1 mt-1 text-[#1A1A1A]">
                          {pipelineResult.canonicalEnglishReport.facts.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Mode 4: Multi-Bundle */}
                  {outputMode === 'multi_bundle' && pipelineResult.multiBundleReports && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(pipelineResult.multiBundleReports).map(([langCode, b]) => {
                        const bundle = b as { title: string; executiveSummary: string };
                        return (
                          <div key={langCode} className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1 text-xs">
                            <span className="text-[10px] font-mono font-bold bg-[#1A1A1A] text-white px-2 py-0.5">
                              Language: {langCode.toUpperCase()}
                            </span>
                            <p className="font-bold text-[#1A1A1A]">{bundle.title}</p>
                            <p className="text-[11px] text-[#555555] line-clamp-3">{bundle.executiveSummary}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        )}

        {/* Sub-Tab 2: Domain Preferences Matrix */}
        {activeSubTab === 'config' && (
          <div className="p-6 space-y-6">
            <p className="text-xs text-[#555555] leading-relaxed border-b border-[#1A1A1A]/20 pb-3">
              Configure independent preferences per operational domain. Your UI, AI conversation, legal drafting, document display, OCR parser, and speech-to-text voice pipeline can all operate in different regional languages seamlessly.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">1. UI & Navigation Language</span>
                <p className="text-[11px] text-[#555555]">Controls menus, headers, tab labels, and system notifications.</p>
                <select
                  value={prefs.uiLanguage}
                  onChange={(e) => handleUpdatePref('uiLanguage', e.target.value as LanguageCode)}
                  className="w-full bg-white border border-[#1A1A1A] p-2 text-xs font-mono font-bold text-[#1A1A1A]"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">2. AI Agent Conversation Language</span>
                <p className="text-[11px] text-[#555555]">Language used by AI agents when replying in chat drawers and intake portals.</p>
                <select
                  value={prefs.aiConversationLanguage}
                  onChange={(e) => handleUpdatePref('aiConversationLanguage', e.target.value as LanguageCode)}
                  className="w-full bg-white border border-[#1A1A1A] p-2 text-xs font-mono font-bold text-[#1A1A1A]"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        )}

        {/* Sub-Tab 3: Legal Translation Memory Registry */}
        {activeSubTab === 'memory' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">Legal Translation Memory Registry (TM)</h3>
                <p className="text-xs text-[#555555]">
                  Standardized government & judicial vocabulary mapping maintained across all 10 supported regional languages.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTermMemory}
                  onChange={(e) => setSearchTermMemory(e.target.value)}
                  placeholder="Filter legal terms..."
                  className="bg-white border border-[#1A1A1A] text-xs font-mono pl-8 pr-3 py-1.5 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[400px]">
              {filteredMemory.map((item, idx) => (
                <div key={idx} className="bg-[#F5F2EF] border border-[#1A1A1A] p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1A1A] font-serif text-sm">{item.englishTerm}</span>
                    <span className="text-[9px] font-mono font-bold uppercase bg-[#1A1A1A] text-amber-400 px-2 py-0.5">
                      Category: {item.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono bg-white p-2 border border-[#1A1A1A]/20">
                    <div><span className="text-slate-400">TA:</span> {item.translations.ta}</div>
                    <div><span className="text-slate-400">HI:</span> {item.translations.hi}</div>
                    <div><span className="text-slate-400">TE:</span> {item.translations.te}</div>
                    <div><span className="text-slate-400">UR:</span> {item.translations.ur}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-[#F5F2EF] border-t border-[#1A1A1A] flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-[#555555]">
            Enterprise Multilingual Engine Active • Standardized Legal Vocabulary Enforcement Enabled
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#1A1A1A] text-white font-bold uppercase text-[10px] tracking-wider hover:bg-black"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
