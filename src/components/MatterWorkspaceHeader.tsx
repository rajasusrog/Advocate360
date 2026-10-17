import React, { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { 
  Folder, 
  FileText, 
  CheckSquare, 
  BookOpen, 
  CalendarCheck, 
  Clock, 
  ChevronRight, 
  User, 
  Scale, 
  MoreVertical, 
  IndianRupee, 
  Share2, 
  Plus
} from 'lucide-react';
import { CaseFile, ChamberProfile } from '../types';

interface MatterWorkspaceHeaderProps {
  matter: CaseFile;
  chamber?: ChamberProfile | null;
  onOpenDigitalSignature?: () => void;
}

export const MATTER_SUBTABS = [
  { path: 'overview', label: 'Overview', icon: Folder },
  { path: 'documents', label: 'Documents', icon: FileText },
  { path: 'analysis', label: 'Case Analysis', icon: CheckSquare },
  { path: 'research-drafts', label: 'Research & Drafts', icon: BookOpen },
  { path: 'work', label: 'Tasks & Hearings', icon: CalendarCheck },
  { path: 'activity', label: 'Activity', icon: Clock },
];

export const MatterWorkspaceHeader: React.FC<MatterWorkspaceHeaderProps> = ({
  matter,
  chamber
}) => {
  const navigate = useNavigate();
  const { matterId } = useParams();
  const [isSecondaryMenuOpen, setIsSecondaryMenuOpen] = useState(false);

  const activeMatterId = matterId || matter.id;

  return (
    <div className="bg-[#1A1A1A] text-white border-b-2 border-slate-800 shadow-md">
      
      {/* Top Banner: Matter Meta Summary Header */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Ref */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-300">
              <span className="bg-[#B45309] text-white font-bold text-[9px] uppercase px-2 py-0.5 tracking-wider">
                MATTER WORKSPACE
              </span>
              <span className="text-amber-400 font-bold">
                {matter.caseNumber || 'Ref: Pending Assignment'}
              </span>
              <span>•</span>
              <span className="text-slate-300">
                {matter.caseType || 'General Litigation'}
              </span>
            </div>

            <h1 className="font-serif italic font-extrabold text-2xl sm:text-3xl text-white truncate">
              {matter.title}
            </h1>

            {/* Sub Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Client</span>
                <span className="text-slate-200 font-bold truncate block">{matter.clientName || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Court / Jurisdiction</span>
                <span className="text-slate-200 truncate block">{matter.courtName || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Stage</span>
                <span className="text-amber-300 font-bold truncate block">{matter.stage || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Next Hearing / Deadline</span>
                <span className="text-emerald-400 font-bold truncate block">{matter.nextHearingDate || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Right Relevant & Secondary Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            
            <button
              onClick={() => navigate(`/app/matters/${activeMatterId}/research-drafts`)}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Prepare Draft</span>
            </button>

            {/* Secondary Actions Dropdown (Billing & Client Portal Sharing) */}
            <div className="relative">
              <button
                onClick={() => setIsSecondaryMenuOpen(!isSecondaryMenuOpen)}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Secondary Matter Actions (Billing & Client Sharing)"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isSecondaryMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#1A1A1A] border-2 border-slate-700 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in duration-150 text-xs font-bold">
                  <button
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      navigate('/app/billing');
                    }}
                    className="w-full text-left p-2 hover:bg-slate-800 text-slate-200 hover:text-amber-300 flex items-center gap-2 rounded-xs"
                  >
                    <IndianRupee className="w-4 h-4 text-amber-400" />
                    <span>Matter Billing & Time Logs</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      navigate('/app/clients');
                    }}
                    className="w-full text-left p-2 hover:bg-slate-800 text-slate-200 hover:text-amber-300 flex items-center gap-2 rounded-xs"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Share Access to Client Portal</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Navigation Ribbon for Matter Sub-sections */}
      <div className="border-t border-slate-800 bg-slate-950/80 px-4 sm:px-6">
        <div className="max-w-[1700px] mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">
          {MATTER_SUBTABS.map((subtab) => {
            const Icon = subtab.icon;
            const targetPath = `/app/matters/${activeMatterId}/${subtab.path}`;

            return (
              <NavLink
                key={subtab.path}
                to={targetPath}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 rounded-xs border ${
                    isActive
                      ? 'bg-amber-400 text-black border-amber-400 font-extrabold shadow-xs'
                      : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{subtab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

    </div>
  );
};
