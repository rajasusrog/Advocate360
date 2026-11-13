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
  X,
} from 'lucide-react';
import { ChamberRole } from '../types';
import { GranularPermission, hasPermission } from '../lib/permissions';

interface SidebarNavProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  currentRole?: ChamberRole;
  isDemoMode?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export interface MainNavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  requiredPermission: GranularPermission;
}

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { path: '/app/today', label: 'Today', icon: Sun, requiredPermission: 'case.read' },
  { path: '/app/matters', label: 'Matters', icon: Briefcase, requiredPermission: 'case.read' },
  { path: '/app/clients', label: 'Clients', icon: Users, requiredPermission: 'case.read' },
  { path: '/app/work', label: 'Calendar & Tasks', icon: CalendarCheck, requiredPermission: 'case.read' },
  { path: '/app/documents', label: 'Documents', icon: FolderLock, requiredPermission: 'case.read' },
  { path: '/app/billing', label: 'Billing', icon: IndianRupee, requiredPermission: 'billing.view' },
  { path: '/app/reports', label: 'Reports', icon: TrendingUp, requiredPermission: 'case.read' },
];

const EMBLEM_LOGO = '/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png';

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isCollapsed,
  setIsCollapsed,
  currentRole = 'CHAMBER_OWNER' as ChamberRole,
  isDemoMode = false,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const location = useLocation();

  const visibleNavItems = MAIN_NAV_ITEMS.filter((item) =>
    hasPermission(currentRole, item.requiredPermission)
  );

  const canAccessSettings =
    hasPermission(currentRole, 'settings.manage') ||
    hasPermission(currentRole, 'audit.view') ||
    currentRole === 'CHAMBER_OWNER' ||
    currentRole === 'SENIOR_ADVOCATE' ||
    currentRole === 'ADMINISTRATOR';

  const renderSidebarBody = (mobileDrawer: boolean) => {
    const collapsed = mobileDrawer ? false : isCollapsed;

    return (
      <div className="flex flex-col justify-between h-full bg-[#0B1426] text-white select-none">
        {/* Top Brand Lockup & Collapse/Close Control */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3.5 py-4 border-b border-white/10 flex items-start justify-between gap-2">
            <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'mx-auto' : ''}`}>
              <div className="w-10 h-10 rounded-lg bg-white border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={EMBLEM_LOGO}
                  alt="UNIKORN360 emblem"
                  className="w-full h-full object-contain"
                />
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-base tracking-tight text-white block leading-tight">
                    Advocate360
                  </span>
                  <span className="text-[11px] font-medium text-[#C49A36] block leading-snug break-words mt-0.5">
                    UNIKORN360 Business Intelligence
                  </span>
                </div>
              )}
            </div>

            {mobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-white/10 cursor-pointer shrink-0"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              !collapsed && (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  className="p-1 text-slate-400 hover:text-[#C49A36] transition-colors rounded-md hover:bg-white/10 cursor-pointer shrink-0 mt-1"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          {!mobileDrawer && collapsed && (
            <div className="px-2 pt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="p-1.5 text-slate-400 hover:text-[#C49A36] transition-colors rounded-md hover:bg-white/10 cursor-pointer"
                title="Expand Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Primary Navigation Links */}
          <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto scrollbar-none">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path === '/app/matters' && location.pathname.startsWith('/app/matters'));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (mobileDrawer && onCloseMobile) onCloseMobile();
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#C49A36] text-[#0B1426] font-bold shadow-xs'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#0B1426]' : 'text-[#C49A36]'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Settings Link & Role Badge */}
        <div className="p-2.5 border-t border-white/10 space-y-2">
          {canAccessSettings && (
            <NavLink
              to="/app/settings/team"
              onClick={() => {
                if (mobileDrawer && onCloseMobile) onCloseMobile();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                location.pathname.startsWith('/app/settings')
                  ? 'bg-[#C49A36] text-[#0B1426] font-bold'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
              title={collapsed ? 'Settings' : undefined}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${
                  location.pathname.startsWith('/app/settings') ? 'text-[#0B1426]' : 'text-slate-300'
                }`}
              />
              {!collapsed && <span className="truncate">Settings</span>}
            </NavLink>
          )}

          {!collapsed && (
            <div className="px-3 py-2 bg-[#16233D] border border-white/10 rounded-lg text-[11px] text-slate-300 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <Shield className="w-3.5 h-3.5 text-[#C49A36] shrink-0" />
                <strong className="text-white font-semibold uppercase truncate">
                  {currentRole.replace('CHAMBER_', '').replace(/_/g, ' ')}
                </strong>
              </span>
              {isDemoMode && (
                <span className="text-[10px] bg-[#C49A36]/20 text-[#C49A36] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0">
                  Demo
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Navy Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#16233D] transition-all duration-200 z-30 shrink-0 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Navigation Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="Practice navigation">
          <div
            className="fixed inset-0 bg-[#0B1426]/60 backdrop-blur-2xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 border-r border-white/15">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
