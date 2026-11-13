import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  LogOut,
  Bot,
  ChevronDown,
  Plus,
  Folder,
  Menu,
} from 'lucide-react';
import { CaseFile, ChamberProfile, ChamberRole } from '../types';
import { hasPermission } from '../lib/permissions';

export interface HeaderUser {
  id?: string;
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
}

interface HeaderProps {
  user: HeaderUser | null;
  chamber: ChamberProfile | null;
  currentRole: ChamberRole;
  cases: CaseFile[];
  selectedCaseId: string;
  onOpenNewCaseModal: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onLogout: () => Promise<void>;
  onToggleAskAssistant: () => void;
  onToggleMobileMenu?: () => void;
  unreadNotificationsCount?: number;
  isDemoMode?: boolean;
  onToggleDemoMode?: (val: boolean) => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/app/today': 'Today Overview',
  '/app/matters': 'Matters',
  '/app/clients': 'Clients',
  '/app/work': 'Calendar & Tasks',
  '/app/documents': 'Documents',
  '/app/billing': 'Billing',
  '/app/reports': 'Reports',
};

export const Header: React.FC<HeaderProps> = ({
  user,
  chamber,
  currentRole,
  cases,
  selectedCaseId,
  onOpenNewCaseModal,
  onOpenSearch,
  onOpenNotifications,
  onLogout,
  onToggleAskAssistant,
  onToggleMobileMenu,
  unreadNotificationsCount = 0,
  isDemoMode = false,
  onToggleDemoMode,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isMatterRoute =
    location.pathname.startsWith('/app/matters/') && location.pathname !== '/app/matters';

  const canCreateMatter = hasPermission(currentRole, 'CREATE_CASE');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectMatter = (matterId: string) => {
    if (!matterId) return;
    const pathParts = location.pathname.split('/');
    const currentSubtab = pathParts[4] || 'overview';
    navigate(`/app/matters/${matterId}/${currentSubtab}`);
  };

  const pageLabel =
    ROUTE_TITLES[location.pathname] ||
    (isMatterRoute
      ? 'Matter Detail'
      : location.pathname.startsWith('/app/settings')
        ? 'Settings'
        : 'Workspace');

  return (
    <header className="bg-white text-[#0B1426] border-b border-[#E2DFD7] sticky top-0 z-40 select-none">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Left: Mobile Drawer Button & Chamber Context */}
          <div className="flex items-center gap-3 min-w-0">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="p-2 text-[#0B1426] hover:bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg md:hidden cursor-pointer shrink-0"
                aria-label="Open navigation menu"
                title="Open navigation menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#64748B] truncate leading-tight">
                {chamber?.name || 'Legal Practice Workspace'}
              </p>
              <p className="text-sm font-semibold text-[#0B1426] truncate leading-tight">
                {pageLabel}
              </p>
            </div>

            {/* Matter Selector Dropdown inside a matter route */}
            {isMatterRoute && cases.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 border-l border-[#E2DFD7] pl-4 ml-1 min-w-0">
                <Folder className="w-4 h-4 text-[#C49A36] shrink-0" />
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleSelectMatter(e.target.value)}
                  className="bg-[#F6F5F1] text-[#0B1426] font-medium text-xs px-2.5 py-1.5 rounded-lg border border-[#E2DFD7] focus:outline-none focus:border-[#0B1426] max-w-xs truncate cursor-pointer"
                  title="Switch Active Matter Context"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            {location.pathname === '/app/matters' && canCreateMatter && (
              <button
                type="button"
                onClick={onOpenNewCaseModal}
                className="px-3 py-1.5 bg-[#0B1426] text-white hover:bg-[#16233D] font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C49A36]" />
                <span className="hidden sm:inline">Add matter</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenSearch}
              className="px-2.5 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] text-[#0B1426] rounded-lg transition-colors flex items-center gap-2 text-xs cursor-pointer"
              title="Search (Cmd + K)"
            >
              <Search className="w-3.5 h-3.5 text-[#475569]" />
              <span className="hidden lg:inline text-xs font-medium text-[#475569]">Search</span>
            </button>

            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] text-[#0B1426] rounded-lg transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-[#0B1426]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#B91C1C] text-white font-semibold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleAskAssistant}
              className="px-3 py-1.5 bg-white hover:bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426] rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Ask Advocate360 Assistant"
            >
              <Bot className="w-4 h-4 text-[#C49A36]" />
              <span className="hidden sm:inline">Ask Advocate360</span>
            </button>

            {/* User Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-1.5 p-1 pr-2 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] rounded-lg text-xs text-[#0B1426] cursor-pointer"
                aria-expanded={isProfileMenuOpen}
                aria-label="User profile menu"
              >
                <div className="w-7 h-7 rounded-md bg-[#0B1426] text-[#C49A36] font-bold flex items-center justify-center text-xs">
                  {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E2DFD7] rounded-xl shadow-lg z-50 p-3 space-y-3 text-xs text-[#0B1426]">
                  <div className="border-b border-[#E2DFD7] pb-2.5">
                    <p className="font-semibold text-[#0B1426] truncate">
                      {user?.displayName || 'Advocate User'}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">{user?.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-[#0B1426]/5 text-[#0B1426] border border-[#0B1426]/15 rounded text-[10px] font-semibold uppercase">
                      {currentRole.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="space-y-1 font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/app/settings/team');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-[#F6F5F1] text-[#0B1426] rounded-md cursor-pointer"
                    >
                      Team & Permissions
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/app/settings/audit');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-[#F6F5F1] text-[#0B1426] rounded-md cursor-pointer"
                    >
                      Audit Administration
                    </button>
                  </div>

                  {onToggleDemoMode && (
                    <div className="p-2.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg space-y-1">
                      <label className="flex items-center justify-between text-[11px] cursor-pointer">
                        <span className="font-semibold text-[#0B1426]">Isolated Demo Sandbox</span>
                        <input
                          type="checkbox"
                          checked={isDemoMode}
                          onChange={(e) => {
                            onToggleDemoMode(e.target.checked);
                            setIsProfileMenuOpen(false);
                          }}
                          className="accent-[#0B1426] cursor-pointer"
                        />
                      </label>
                      <p className="text-[10px] text-[#64748B] leading-tight">
                        Preview sample case fixtures safely without affecting live workspace records.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 border border-[#FECACA] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
