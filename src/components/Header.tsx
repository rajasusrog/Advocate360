import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Scale, 
  Search, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Briefcase, 
  Bot, 
  ChevronDown, 
  Plus,
  ShieldAlert,
  Folder
} from 'lucide-react';
import { CaseFile, ChamberProfile, ChamberRole } from '../types';

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
  onToggleDemoMode
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isMatterRoute = location.pathname.startsWith('/app/matters/') && location.pathname !== '/app/matters';
  const currentMatter = cases.find(c => c.id === selectedCaseId);

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

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xs select-none">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          
          {/* Brand & Mobile Menu Button */}
          <div className="flex items-center gap-3 shrink-0">
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md md:hidden cursor-pointer"
                title="Toggle Navigation Menu"
              >
                <Folder className="w-5 h-5 text-amber-400" />
              </button>
            )}

            <div 
              onClick={() => navigate('/app/today')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              title="Advocate360 AI LegalOS"
            >
              <div className="w-7 h-7 bg-amber-400 text-black flex items-center justify-center font-serif font-bold text-base shadow-xs rounded-xs">
                <Scale className="w-4 h-4 text-black" />
              </div>
              <div className="hidden sm:block">
                <span className="font-serif italic font-extrabold text-base tracking-tight text-white block leading-none">
                  Advocate360
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">
                  {chamber?.name || 'Legal Practice OS'}
                </span>
              </div>
            </div>

            {/* Matter Selector Dropdown (Rendered ONLY when inside a matter route) */}
            {isMatterRoute && cases.length > 0 && (
              <div className="hidden md:flex items-center gap-2 border-l border-slate-700 pl-4">
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleSelectMatter(e.target.value)}
                  className="bg-slate-900 text-amber-300 font-serif font-bold text-xs p-1.5 border border-slate-700 focus:outline-none focus:border-amber-400 max-w-xs truncate cursor-pointer"
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
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Contextual Action Button based on route */}
            {location.pathname === '/app/matters' && (
              <button
                onClick={onOpenNewCaseModal}
                className="px-3 py-1.5 bg-amber-400 text-black hover:bg-amber-300 font-bold uppercase text-[11px] tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Matter</span>
              </button>
            )}

            {/* Global Search Button */}
            <button
              onClick={onOpenSearch}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-2 text-xs cursor-pointer"
              title="Global Search (Cmd + K)"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-[11px] font-mono text-slate-400">Search (Cmd+K)</span>
            </button>

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Single "Ask Advocate360" AI Assistant Entry Point */}
            <button
              onClick={onToggleAskAssistant}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/60 text-amber-300 hover:text-white transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Ask Advocate360 AI Assistant"
            >
              <Bot className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Ask Advocate360</span>
            </button>

            {/* User Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-white cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center text-[10px]">
                  {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1A1A1A] border-2 border-slate-700 shadow-2xl z-50 p-3 space-y-3 animate-in fade-in duration-150 text-xs">
                  <div className="border-b border-slate-700 pb-2">
                    <p className="font-bold text-white truncate">{user?.displayName || 'Advocate User'}</p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold uppercase border border-amber-500/40">
                      {currentRole}
                    </span>
                  </div>

                  {/* Settings & Admin navigation */}
                  <div className="space-y-1 font-bold">
                    <button
                      onClick={() => {
                        navigate('/app/settings/team');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xs"
                    >
                      Team & Permissions
                    </button>
                    <button
                      onClick={() => {
                        navigate('/app/settings/audit');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xs"
                    >
                      Audit Administration
                    </button>
                  </div>

                  {/* Isolated Demo Sandbox Toggle */}
                  {onToggleDemoMode && (
                    <div className="p-2 bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-300">Isolated Demo Sandbox</span>
                        <input
                          type="checkbox"
                          checked={isDemoMode}
                          onChange={(e) => {
                            onToggleDemoMode(e.target.checked);
                            setIsProfileMenuOpen(false);
                          }}
                          className="accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-sans leading-tight">
                        Preview sample case fixtures in an isolated sandbox. Live writes disabled.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 border border-rose-800 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
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
