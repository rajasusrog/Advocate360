import React from 'react';
import {
  Briefcase,
  Calendar,
  FileText,
  Lock,
  ShieldCheck,
  Users,
  ArrowRight,
  FolderLock,
  IndianRupee,
} from 'lucide-react';

interface LandingPageProps {
  onGoogleSignIn: () => void;
  isLoadingAuth?: boolean;
}

const BI_SQUARE_LOGO = '/assets/aistudio/ChatGPT_Image_Oct_30__2026__07_25_15_AM_a8896c5c.png';
const EMBLEM_LOGO = '/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png';

export const LandingPage: React.FC<LandingPageProps> = ({ onGoogleSignIn, isLoadingAuth }) => {
  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#0B1426] font-sans flex flex-col">
      {/* Compact Public Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E2DFD7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] p-1 flex items-center justify-center shrink-0">
              <img
                src={EMBLEM_LOGO}
                alt="UNIKORN360 emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-lg text-[#0B1426] tracking-tight block leading-tight">
                Advocate360
              </span>
              <span className="text-[11px] font-medium text-[#64748B] block leading-tight break-words">
                UNIKORN360 Business Intelligence
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#475569]">
            <a href="#overview" className="hover:text-[#0B1426] transition-colors">
              Workspace Overview
            </a>
            <a href="#security" className="hover:text-[#0B1426] transition-colors">
              Chamber Security
            </a>
            <a href="#disclaimer" className="hover:text-[#0B1426] transition-colors">
              Disclaimer
            </a>
          </nav>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={isLoadingAuth}
            className="bg-[#0B1426] hover:bg-[#16233D] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isLoadingAuth ? 'Connecting...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      {/* Main Content: Focused Sign-In First, Concise Overview Below */}
      <main className="flex-1">
        <section className="py-10 sm:py-14 lg:py-16 px-4 sm:px-6 border-b border-[#E2DFD7]">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* 1. Focused Sign-In Card */}
            <div className="max-w-md mx-auto bg-white border border-[#E2DFD7] rounded-2xl shadow-sm p-6 sm:p-8 text-center space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-[#E2DFD7] bg-[#F6F5F1] p-1.5 shadow-2xs">
                  <img
                    src={BI_SQUARE_LOGO}
                    alt="UNIKORN360 Business Intelligence"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                <div className="space-y-1.5 max-w-full">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C49A36] break-words">
                    UNIKORN360 Business Intelligence
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1426]">
                    Sign in to Advocate360
                  </h1>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    Access your private chamber workspace for litigation matters, court hearings, tasks, billing, and verified client updates.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isLoadingAuth}
                  className="w-full bg-[#0B1426] hover:bg-[#16233D] text-white font-semibold text-sm px-5 py-3.5 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>{isLoadingAuth ? 'Signing in...' : 'Sign in with Google'}</span>
                  <ArrowRight className="w-4 h-4 text-[#C49A36] shrink-0" />
                </button>

                <p className="text-xs text-[#64748B] flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C49A36] shrink-0" />
                  <span>Protected by chamber role-based access control</span>
                </p>
              </div>
            </div>

            {/* 2. Concise Practice Overview Below */}
            <div id="overview" className="space-y-6 pt-2">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C49A36]">
                  Chamber Operations Platform
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B1426]">
                  Built for trial advocates and modern law offices
                </h2>
                <p className="text-sm text-[#475569]">
                  Manage active matters, court schedules, document versions, client portals, and fee ledgers inside a single multi-tenant workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    icon: Briefcase,
                    title: 'Matters & Case Briefs',
                    desc: 'Organize cause titles, court numbers, opposing parties, timelines, and strength assessments per matter.',
                  },
                  {
                    icon: Calendar,
                    title: 'Hearings & Task Queues',
                    desc: 'Track upcoming court appearances, statutory deadlines, and dependent preparation tasks on Today.',
                  },
                  {
                    icon: FolderLock,
                    title: 'Document Repository',
                    desc: 'Maintain private matter files with immutable version history and AI-assisted document analysis.',
                  },
                  {
                    icon: Users,
                    title: 'Restricted Client Portal',
                    desc: 'Issue email-verified, scope-limited invitations so clients view only approved matter updates.',
                  },
                  {
                    icon: IndianRupee,
                    title: 'Time & Fee Billing',
                    desc: 'Record billable appearances, generate chamber invoices, and monitor collection status cleanly.',
                  },
                  {
                    icon: FileText,
                    title: 'Research & Drafting',
                    desc: 'Draft notices and petitions with advocate review checkpoints and explicit citation status flags.',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="bg-white border border-[#E2DFD7] rounded-xl p-5 space-y-2.5 shadow-2xs"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#0B1426] text-[#C49A36] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-[#0B1426]">{item.title}</h3>
                      <p className="text-xs text-[#475569] leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Security Architecture Strip */}
        <section id="security" className="py-12 px-4 sm:px-6 bg-white border-b border-[#E2DFD7]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1426]">
                <Lock className="w-4 h-4 text-[#C49A36]" />
                <span>Strict Tenant Isolation</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Every chamber workspace enforces row-level security so matters, drafts, and notes stay isolated to authorized staff.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1426]">
                <ShieldCheck className="w-4 h-4 text-[#C49A36]" />
                <span>Verified Google Sign-In</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Staff members and invited clients authenticate via verified Google identity before accessing any workspace or portal route.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1426]">
                <FileText className="w-4 h-4 text-[#C49A36]" />
                <span>Advocate Review Required</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Drafts, timelines, and research notes assist advocate preparation and require professional review prior to filing.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Navy Disclaimer Footer */}
      <footer id="disclaimer" className="bg-[#0B1426] text-slate-300 py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-4 text-xs">
          <div className="p-4 rounded-lg bg-[#16233D] border border-slate-700/70 text-slate-200 leading-relaxed">
            <strong className="text-[#C49A36]">Professional Disclaimer:</strong> Advocate360 (UNIKORN360 Business Intelligence) provides litigation practice management, document organization, and AI-assisted research tools for advocates and law offices. Outputs require independent verification by an enrolled advocate before court submission or legal advice.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
            <span className="font-semibold text-white">
              Advocate360 • UNIKORN360 Business Intelligence
            </span>
            <span>© {new Date().getFullYear()} UNIKORN360. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
