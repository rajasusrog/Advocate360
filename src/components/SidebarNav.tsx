import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Sun, 
  Briefcase, 
  Users, 
  CalendarCheck, 
  FolderLock, 
  IndianRupee, 
  TrendingUp, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Sparkles
} from 'lucide-react';
import { ChamberRole } from '../types';

interface SidebarNavProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentRole?: ChamberRole;
  isDemoMode?: boolean;
}

export interface MainNavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { path: '/app/today', label: 'Today', icon: Sun },
  { path: '/app/matters', label: 'Matters', icon: Briefcase },
  { path: '/app/clients', label: 'Clients', icon: Users },
  { path: '/app/work', label: 'Calendar & Tasks', icon: CalendarCheck },
  { path: '/app/documents', label: 'Documents', icon: FolderLock },
  { path: '/app/billing', label: 'Billing', icon: IndianRupee },
  { path: '/app/reports', label: 'Reports', icon: TrendingUp },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isCollapsed,
  setIsCollapsed,
  currentRole = 'CHAMBER_OWNER',
  isDemoMode = false
}) => {
  const location = useLocation();

  return (
    <aside
      className={`bg-[#1A1A1A] text-white flex flex-col justify-between border-r border-slate-800 transition-all duration-200 z-30 shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Main Navigation Menu */}
      <div className="flex-1 py-4 space-y-6 overflow-y-auto scrollbar-none">
        
        {/* Toggle Collapse Button */}
        <div className="px-3 flex items-center justify-between">
          {!isCollapsed && (
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 font-bold px-2">
              Practice Navigation
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-amber-400 transition-colors rounded-xs hover:bg-slate-800 mx-auto cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Navigation Links */}
        <nav className="space-y-1 px-2">
          {MAIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-400 text-black shadow-xs font-extrabold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                {!isCollapsed && <span className="truncate tracking-wide">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Settings Link & Role Badge */}
      <div className="p-2 border-t border-slate-800 space-y-2">
        <NavLink
          to="/app/settings/team"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-bold transition-all ${
              location.pathname.startsWith('/app/settings')
                ? 'bg-amber-400 text-black font-extrabold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className={`w-4 h-4 shrink-0 ${location.pathname.startsWith('/app/settings') ? 'text-black' : 'text-slate-400'}`} />
          {!isCollapsed && <span className="truncate tracking-wide">Settings</span>}
        </NavLink>

        {!isCollapsed && (
          <div className="p-2 bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between rounded-xs">
            <span className="flex items-center gap-1.5 truncate">
              <Shield className="w-3 h-3 text-amber-400 shrink-0" />
              <strong className="text-slate-200 uppercase truncate">{currentRole.replace('CHAMBER_', '')}</strong>
            </span>
            {isDemoMode && (
              <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.5 border border-amber-500/40 font-bold uppercase">
                Demo
              </span>
            )}
          </div>
        )}
      </div>

    </aside>
  );
};
