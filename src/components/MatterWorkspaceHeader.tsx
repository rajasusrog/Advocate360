import React, { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Folder,
  FileText,
  CheckSquare,
  BookOpen,
  CalendarCheck,
  Clock,
  MoreVertical,
  IndianRupee,
  Share2,
  Calendar,
} from 'lucide-react';
import { CaseFile, ChamberProfile, ChamberRole } from '../types';
import { hasPermission } from '../lib/permissions';
import { StatusBadge } from './ui/StatusBadge';

interface MatterWorkspaceHeaderProps {
  matter: CaseFile;
  chamber?: ChamberProfile | null;
  currentRole?: ChamberRole;
  onOpenDigitalSignature?: () => void;
  onOpenScheduleHearing?: (matterId: string) => void;
}

export const MATTER_SUBTABS = [
  { path: 'overview', label: 'Overview', icon: Folder },
  { path: 'work', label: 'Tasks & Hearings', icon: CalendarCheck },
  { path: 'documents', label: 'Documents', icon: FileText },
  { path: 'billing', label: 'Billing', icon: IndianRupee, permission: 'billing.view' as const },
  { path: 'analysis', label: 'Case Analysis', icon: CheckSquare },
  { path: 'research-drafts', label: 'Research & Drafts', icon: BookOpen },
  { path: 'activity', label: 'Activity', icon: Clock },
];

export const MatterWorkspaceHeader: React.FC<MatterWorkspaceHeaderProps> = ({
  matter,
  currentRole = 'CHAMBER_OWNER' as ChamberRole,
  onOpenScheduleHearing,
}) => {
  const navigate = useNavigate();
  const { matterId } = useParams();
  const [isSecondaryMenuOpen, setIsSecondaryMenuOpen] = useState(false);

  const activeMatterId = matterId || matter.id;
  const visibleSubtabs = MATTER_SUBTABS.filter(
    (tab) => !tab.permission || hasPermission(currentRole, tab.permission)
  );

  return (
    <div className="bg-white border border-[#E2DFD7] rounded-2xl overflow-hidden shadow-2xs">
      {/* Top Navy Summary Band */}
      <div className="bg-[#0B1426] text-white px-5 sm:px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C49A36]">
                Matter Detail
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-slate-200">
                {matter.caseNumber || 'Reference Pending'}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">{matter.caseType || 'General Litigation'}</span>
              <StatusBadge label={matter.status} tone="gold" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
              {matter.title}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 block">Client</span>
                <span className="text-white font-medium truncate block">
                  {matter.clientName || 'Not specified'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 block">Court / Forum</span>
                <span className="text-white font-medium truncate block">
                  {matter.courtName || 'Not specified'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 block">Stage</span>
                <span className="text-[#C49A36] font-semibold truncate block">
                  {matter.stage || matter.status || 'Intake'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 block">Next hearing</span>
                <span className="text-white font-semibold u360-table-numeric truncate block">
                  {matter.nextHearingDate || 'Not scheduled'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="flex items-center gap-2 shrink-0 self-start">
            {onOpenScheduleHearing && (
              <button
                type="button"
                onClick={() => onOpenScheduleHearing(activeMatterId)}
                className="px-3.5 py-2 bg-[#C49A36] hover:bg-[#D4AA46] text-[#0B1426] font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule hearing</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(`/app/matters/${activeMatterId}/research-drafts`)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Prepare draft
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSecondaryMenuOpen(!isSecondaryMenuOpen)}
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors cursor-pointer"
                aria-label="More matter actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isSecondaryMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E2DFD7] rounded-xl shadow-xl z-50 p-1.5 space-y-1 text-xs font-medium text-[#0B1426]">
                  {hasPermission(currentRole, 'billing.view') && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSecondaryMenuOpen(false);
                        navigate(`/app/matters/${activeMatterId}/billing`);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#F6F5F1] rounded-lg flex items-center gap-2 cursor-pointer"
                    >
                      <IndianRupee className="w-4 h-4 text-[#C49A36]" />
                      <span>Matter billing</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryMenuOpen(false);
                      navigate('/app/clients');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F6F5F1] rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-[#0B1426]" />
                    <span>Invite client to portal</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clear Sub-Section Tabs (Hearings, Documents, Tasks, Billing) */}
      <nav
        aria-label="Matter sections"
        className="bg-[#F6F5F1] px-4 sm:px-6 py-2 border-t border-[#E2DFD7] flex items-center gap-1.5 overflow-x-auto scrollbar-none"
      >
        {visibleSubtabs.map((subtab) => {
          const Icon = subtab.icon;
          const targetPath = `/app/matters/${activeMatterId}/${subtab.path}`;

          return (
            <NavLink
              key={subtab.path}
              to={targetPath}
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 rounded-lg border ${
                  isActive
                    ? 'bg-[#0B1426] text-white border-[#0B1426] shadow-2xs'
                    : 'bg-white text-[#475569] border-[#E2DFD7] hover:text-[#0B1426] hover:border-[#0B1426]/40'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-[#C49A36]" />
              <span>{subtab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
