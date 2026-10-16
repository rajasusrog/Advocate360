import React, { useState } from 'react';
import { 
  Scale, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Search, 
  GitCompare, 
  Gavel, 
  Clock, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  BookOpen, 
  Bot, 
  AlertTriangle, 
  Check, 
  FileSearch, 
  Calendar, 
  Layers,
  ChevronRight,
  Shield,
  Briefcase
} from 'lucide-react';

interface LandingPageProps {
  onGoogleSignIn: () => void;
  isLoadingAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGoogleSignIn, isLoadingAuth }) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'matters' | 'hearings' | 'timeline' | 'evidence' | 'drafting'>('matters');

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#B45309] selection:text-white">
      
      {/* 1. PUBLIC TOP BAR & NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#FDFCFB]/90 backdrop-blur-md border-b-2 border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1A1A1A] text-amber-400 flex items-center justify-center font-serif font-bold text-xl border border-[#1A1A1A] shadow-xs">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-xl text-[#1A1A1A] tracking-tight">ADVOCATE360 AI</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-[#B45309] text-white px-1.5 py-0.5">
                  UNIKORN360
                </span>
              </div>
              <p className="text-[10px] text-[#555555] font-serif italic tracking-wide">
                AI-Powered Legal Practice & Litigation Intelligence
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
            <a href="#workflow" className="hover:text-[#B45309] transition-colors">Workflow</a>
            <a href="#features" className="hover:text-[#B45309] transition-colors">Legal AI Agents</a>
            <a href="#security" className="hover:text-[#B45309] transition-colors">Security & Privacy</a>
            <a href="#disclaimer" className="hover:text-[#B45309] transition-colors">Disclaimer</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onGoogleSignIn}
              disabled={isLoadingAuth}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold text-xs uppercase tracking-wider px-5 py-2.5 border border-[#1A1A1A] flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>{isLoadingAuth ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative bg-[#F5F2EF] border-b-2 border-[#1A1A1A] py-16 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] bg-[#1A1A1A] text-white px-3 py-1 border border-[#1A1A1A]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Chamber Litigation Intelligence • Indian Legal Domain</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light italic leading-tight text-[#1A1A1A]">
              YOUR AI JUNIOR ADVOCATE.<br />
              <span className="font-normal not-italic text-[#B45309]">AVAILABLE 24×7.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#555555] font-sans leading-relaxed max-w-2xl">
              From client intake and evidence analysis to legal research, drafting and hearing preparation — Advocate360 AI brings your litigation workflow into one intelligent, secure workspace.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={onGoogleSignIn}
                disabled={isLoadingAuth}
                className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold text-sm uppercase tracking-wider px-8 py-4 border-2 border-[#1A1A1A] flex items-center gap-3 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>START WITH GOOGLE</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>

              <a
                href="#workflow"
                className="bg-[#FDFCFB] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] font-bold text-sm uppercase tracking-wider px-6 py-4 border-2 border-[#1A1A1A] transition-colors"
              >
                EXPLORE ADVOCATE360
              </a>
            </div>

            <div className="pt-4 flex items-center gap-2 text-xs text-[#555555]">
              <ShieldCheck className="w-4 h-4 text-[#B45309]" />
              <span className="font-semibold">Built for advocates, legal professionals and law offices.</span>
            </div>

            {/* Unobtrusive Disclaimer */}
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/30 text-[11px] text-[#555555] font-serif italic max-w-xl">
              * Advocate360 AI provides AI-assisted litigation workflow and research tools. AI outputs require independent professional review before court filing or legal advice.
            </div>

          </div>
        </div>
      </section>

      {/* 3. HERO PRODUCT PREVIEW (ILLUSTRATIVE DEMO DATA) */}
      <section className="py-16 bg-[#FDFCFB] border-b-2 border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#B45309] text-white px-2.5 py-0.5 mb-2">
                <span>Interactive Workspace Preview</span>
              </div>
              <h2 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
                The Intelligent Chamber Workspace
              </h2>
            </div>

            {/* DEMO DATA MANDATORY BADGE */}
            <div className="bg-[#1A1A1A] text-amber-400 font-mono text-[10px] uppercase font-bold tracking-[0.2em] px-3.5 py-1.5 border border-[#1A1A1A] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>DEMO / SAMPLE / ILLUSTRATIVE DATA</span>
            </div>
          </div>

          {/* Interactive Demo Tabs */}
          <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] shadow-xs overflow-hidden">
            <div className="bg-[#1A1A1A] p-2 flex flex-wrap gap-2 border-b border-[#1A1A1A]">
              <button
                onClick={() => setActivePreviewTab('matters')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePreviewTab === 'matters' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Active Matters
              </button>
              <button
                onClick={() => setActivePreviewTab('hearings')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePreviewTab === 'hearings' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Upcoming Hearings
              </button>
              <button
                onClick={() => setActivePreviewTab('timeline')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePreviewTab === 'timeline' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                3. Case Timeline & Contradictions
              </button>
              <button
                onClick={() => setActivePreviewTab('evidence')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePreviewTab === 'evidence' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                4. Evidence Intelligence
              </button>
              <button
                onClick={() => setActivePreviewTab('drafting')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activePreviewTab === 'drafting' ? 'bg-[#FDFCFB] text-[#1A1A1A]' : 'text-slate-300 hover:text-white'
                }`}
              >
                5. Drafting Assistant
              </button>
            </div>

            {/* Preview Tab Content */}
            <div className="p-6">
              {activePreviewTab === 'matters' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#B45309]">O.S. 402 / 2024</span>
                      <h3 className="font-serif italic font-bold text-xl text-[#1A1A1A]">Ramesh Kumar vs. M/s Vertex Infra & Brother</h3>
                      <p className="text-xs text-[#555555]">City Civil Court, Chennai • Stage: Injunction Hearing</p>
                    </div>
                    <span className="bg-[#1A1A1A] text-amber-400 font-mono text-xs font-bold px-3 py-1">
                      Strength Score: 85%
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/30">
                      <strong className="block text-[#1A1A1A] font-bold">Relief Sought:</strong>
                      <p className="text-[#555555] font-serif italic mt-0.5">Permanent injunction & declaration of title over 2400 sq.ft land.</p>
                    </div>
                    <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/30">
                      <strong className="block text-[#1A1A1A] font-bold">Key Contradiction Found:</strong>
                      <p className="text-[#555555] font-serif italic mt-0.5">Sale deed 2026 recites oral partition in 2020; partition deed dated 2021.</p>
                    </div>
                    <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/30">
                      <strong className="block text-[#1A1A1A] font-bold">Next Action:</strong>
                      <p className="text-[#555555] font-serif italic mt-0.5">File Order 39 interim application with tax receipts Exhibit A-3.</p>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'hearings' && (
                <div className="space-y-3">
                  <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">Tomorrow's Courtroom Hearing Package</h3>
                  <div className="p-4 bg-[#FDFCFB] border border-[#1A1A1A] space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-[#B45309]">
                      <span>Hearing Date: Tomorrow, 10:30 AM</span>
                      <span>Court Room 4, Additional District Judge</span>
                    </div>
                    <p className="font-serif italic text-[#1A1A1A]">
                      "AI Brief compiled: 4 key facts verified, 3 exhibits flagged for bench, opponent likely argument regarding non-registration anticipated with Sec 49 counter."
                    </p>
                  </div>
                </div>
              )}

              {activePreviewTab === 'timeline' && (
                <div className="space-y-3">
                  <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">Automated Fact Chronology & Contradiction Engine</h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-[#FFF4F2] border border-[#FF4444] flex items-center justify-between">
                      <div>
                        <strong className="text-[#FF4444] uppercase font-bold text-[10px]">High Severity Contradiction:</strong>
                        <p className="font-serif italic text-[#1A1A1A]">1995 Sale Deed shows purchase by father; 2026 Deed executed by brother claiming sole self-acquisition.</p>
                      </div>
                      <span className="text-[10px] font-mono bg-[#FF4444] text-white px-2 py-0.5 font-bold">Flagged by AI</span>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'evidence' && (
                <div className="space-y-3">
                  <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">Evidence Inventory & Strength Scorecard</h3>
                  <div className="p-4 bg-[#FDFCFB] border border-[#1A1A1A] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1A1A1A]">Municipal Tax Receipts (2015-2026)</span>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 border border-emerald-800 text-[10px]">Proves Possession</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1A1A1A]">Unregistered Partition Deed (2021)</span>
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 border border-amber-800 text-[10px]">Inadmissible for Title (Sec 49)</span>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'drafting' && (
                <div className="space-y-3">
                  <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">AI Drafting Assistant — Legal Notice First Draft</h3>
                  <div className="p-4 bg-[#1A1A1A] text-[#FDFCFB] font-mono text-[11px] leading-relaxed border border-[#1A1A1A]">
                    <span className="text-amber-400 font-bold">// AI-ASSISTED FIRST DRAFT (MANDATORY ADVOCATE REVIEW REQUIRED)</span>
                    <p className="mt-2">"UNDER INSTRUCTIONS FROM OUR CLIENT MR. RAMESH KUMAR, WE HEREBY ISSUE THIS DEMAND NOTICE CALLING UPON YOU TO RESCIND THE UNLAWFUL DEED DATED 14.06.2026 WITHIN 15 DAYS..."</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 4. THE ADVOCATE WORKFLOW SECTION */}
      <section id="workflow" className="py-20 bg-[#F5F2EF] border-b-2 border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-3 py-1">
              <span>End-to-End Litigation Pipeline</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-light italic text-[#1A1A1A]">
              "From First Consultation to Final Argument"
            </h2>
            <p className="text-xs sm:text-sm text-[#555555] leading-relaxed font-sans">
              Advocate360 AI structures every step of a matter into a continuous, intelligent legal workflow designed for trial advocates and law offices.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            {[
              { step: '01', title: 'CLIENT INTAKE', desc: 'Raw story to structured timeline' },
              { step: '02', title: 'DOCUMENTS', desc: 'Multi-page deed analysis' },
              { step: '03', title: 'EVIDENCE', desc: 'Strength & admissibility' },
              { step: '04', title: 'RESEARCH', desc: 'Statutes & verified case law' },
              { step: '05', title: 'DRAFTING', desc: 'Court-ready initial drafts' },
              { step: '06', title: 'TIMELINE', desc: 'Contradiction discovery' },
              { step: '07', title: 'RISK & LIMITATION', desc: 'Limitation date checks' },
              { step: '08', title: 'HEARING BRIEF', desc: 'Courtroom checklist package' },
              { step: '09', title: 'CLIENT PORTAL', desc: '24×7 client updates' },
              { step: '10', title: 'CASE OUTCOME', desc: 'Archiving & follow-ups' }
            ].map((item, idx) => (
              <div key={idx} className="p-4 bg-[#FDFCFB] border border-[#1A1A1A] space-y-1.5 shadow-xs">
                <span className="font-mono text-[10px] font-bold text-[#B45309] block">{item.step}</span>
                <strong className="font-serif italic text-sm text-[#1A1A1A] block">{item.title}</strong>
                <p className="text-[11px] text-[#555555] font-sans leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5 - 13. SPECIALIZED LEGAL MODULES DEEP-DIVE */}
      <section id="features" className="py-20 bg-[#FDFCFB] border-b-2 border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          
          {/* Module 1: Document Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5">
                <FileSearch className="w-3.5 h-3.5" />
                <span>Document Intelligence</span>
              </div>
              <h3 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
                "Turn Hundreds of Pages Into Actionable Case Intelligence"
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Upload sale deeds, partition agreements, petitions, or FIR bundles. Advocate360 AI extracts key facts, important clauses, dates, parties, obligations, and hidden contradictions across documents.
              </p>
              <ul className="space-y-2 text-xs font-serif italic text-[#1A1A1A]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#B45309]" />
                  <span>Extracts 10-15 key facts & chronological event nodes instantly</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#B45309]" />
                  <span>Highlights missing evidence gaps and unfulfilled statutory formalities</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-6 p-6 bg-[#F5F2EF] border-2 border-[#1A1A1A] shadow-xs space-y-3 font-mono text-xs">
              <span className="text-[10px] font-bold uppercase text-[#B45309] block">AI Analysis Summary Example</span>
              <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] space-y-1">
                <strong>Doc Type:</strong> Impugned Sale Deed 2026<br />
                <strong>Clauses Flagged:</strong> Section 17 Registration Act bar, Indemnity Clause 7.<br />
                <strong>Status:</strong> High risk co-heir exclusion detected.
              </div>
            </div>
          </div>

          {/* Module 2: Timeline & Contradiction Engine */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 lg:order-2 space-y-4">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5">
                <GitCompare className="w-3.5 h-3.5" />
                <span>Flagship Feature</span>
              </div>
              <h3 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
                "Find the Contradiction Before the Other Side Does."
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Cross-references dates, statements, transactions, notices, and pleadings. Automatically flags conflicting statements and conflicting dates across filings.
              </p>
              <div className="p-3 bg-[#FFF4F2] border border-[#FF4444] text-xs">
                <strong className="text-[#FF4444] font-bold block uppercase text-[10px]">Contradiction Detection:</strong>
                <p className="font-serif italic text-[#1A1A1A] mt-1">
                  Pleadings state oral partition in Aug 2020, but notice reply dated March 2021 refers to written draft attempt.
                </p>
              </div>
            </div>
            <div className="lg:col-span-6 lg:order-1 p-6 bg-[#F5F2EF] border-2 border-[#1A1A1A] shadow-xs space-y-3">
              <span className="font-serif italic font-bold text-lg text-[#1A1A1A] block">Chronological Timeline Nodes</span>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-[#FDFCFB] border-l-4 border-l-[#1A1A1A] border border-[#1A1A1A]">
                  <strong className="font-mono text-[#B45309]">1995-04-12:</strong> Parent Sale Deed executed in favor of Late Father.
                </div>
                <div className="p-2.5 bg-[#FDFCFB] border-l-4 border-l-[#FF4444] border border-[#1A1A1A]">
                  <strong className="font-mono text-[#FF4444]">2021-03-05:</strong> Disputed unregistered partition draft executed.
                </div>
              </div>
            </div>
          </div>

          {/* Module 3: Legal Research & Citation Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Legal Research & Case Law</span>
              </div>
              <h3 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
                Statutes, Ratios & Citation Verification Status
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Conduct legal research on statutes, sections, principles, and landmark judgments. Advocate360 AI marks citations with clear verification status labels so you never rely on unverified AI results.
              </p>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-800 font-bold px-2 py-1">
                  VERIFIED SOURCE
                </span>
                <span className="bg-amber-100 text-amber-900 border border-amber-800 font-bold px-2 py-1">
                  UNVERIFIED AI RESULT
                </span>
              </div>
            </div>
            <div className="lg:col-span-6 p-6 bg-[#F5F2EF] border-2 border-[#1A1A1A] shadow-xs space-y-3 text-xs">
              <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1</span>
                  <span className="text-emerald-800 font-mono text-[10px] uppercase">VERIFIED SOURCE</span>
                </div>
                <p className="font-serif italic text-[#555555]">
                  Holding that daughters have equal coparcenary rights by birth under Sec 6 Hindu Succession Act.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 15. PRIVACY & SECURITY SECTION */}
      <section id="security" className="py-20 bg-[#1A1A1A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-amber-400 text-black px-3 py-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Chamber Isolation Architecture</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-light italic text-white">
              "Confidential Matters Deserve Serious Security."
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              Legal documents and client files contain highly privileged information. Advocate360 AI enforces strict multi-tenant chamber isolation and Firebase Auth security rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="p-6 bg-slate-900 border border-slate-800 space-y-2">
              <Shield className="w-6 h-6 text-amber-400" />
              <strong className="text-sm font-serif italic text-white block">Multi-Tenant Chamber Isolation</strong>
              <p className="text-slate-400 font-sans leading-relaxed">
                Practice-isolated workspaces. Matter data is access-controlled to authorized members of your legal workspace. No other advocate or chamber can access your matters.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 space-y-2">
              <Users className="w-6 h-6 text-amber-400" />
              <strong className="text-sm font-serif italic text-white block">Google OAuth & Firebase Auth Boundary</strong>
              <p className="text-slate-400 font-sans leading-relaxed">
                Every request to backend AI engines and database paths requires a verified Firebase ID token. Unauthenticated requests receive an immediate 401 response.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 space-y-2">
              <Lock className="w-6 h-6 text-amber-400" />
              <strong className="text-sm font-serif italic text-white block">Zero AI Model Data Training</strong>
              <p className="text-slate-400 font-sans leading-relaxed">
                Your uploaded documents and case narratives are processed in isolated transient API sessions and are never used to train public foundation models.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 16. DISCLAIMER & FOOTER */}
      <footer id="disclaimer" className="bg-[#111111] text-slate-400 py-12 border-t-2 border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-xs font-sans">
          
          <div className="p-4 bg-slate-900/60 border border-slate-800 text-slate-300 font-serif italic leading-relaxed text-[11px]">
            <strong>Legal Disclaimer:</strong> Advocate360 AI (a Unikorn360 platform) provides AI-assisted litigation workflow, document analysis, research, and drafting assistance for legal professionals. AI outputs do not constitute guaranteed legal advice, judicial predictions, or certified legal documents. All generated content, limitation dates, and citations must be independently reviewed and verified by an advocate before reliance, client communication, or submission to court.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-6">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-amber-400" />
              <span className="font-serif italic font-bold text-white text-base">Advocate360 AI</span>
              <span className="text-[10px] font-mono text-slate-400">• Unikorn360 Legal-Tech</span>
            </div>

            <p className="text-[11px] text-slate-400">
              © {new Date().getFullYear()} Advocate360 AI. All rights reserved.
            </p>
          </div>

        </div>
      </footer>

    </div>
  );
};
