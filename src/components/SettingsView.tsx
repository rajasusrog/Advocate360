import React from 'react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Users, 
  Boxes, 
  Layers, 
  Clock, 
  Activity, 
  ShieldCheck, 
  Lock,
  Building2,
  FileCheck2
} from 'lucide-react';
import { ChamberRole, ChamberProfile } from '../types';
import { AuditLogViewer } from './AuditLogViewer';
import { PluginManager } from './PluginManager';
import { OpsHealthDashboard } from './OpsHealthDashboard';

interface SettingsViewProps {
  chamber?: ChamberProfile | null;
  currentRole?: ChamberRole;
  userEmail?: string;
  onOpenRoleManager?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  chamber,
  currentRole = 'CHAMBER_OWNER',
  userEmail = '',
  onOpenRoleManager
}) => {
  const location = useLocation();
  const isAdmin = currentRole === 'CHAMBER_OWNER' || currentRole === 'ADMINISTRATOR';

  const SETTINGS_TABS = [
    { path: 'team', label: 'Team & Permissions', icon: Users },
    { path: 'integrations', label: 'Integrations & e-Sign', icon: Boxes },
    { path: 'workflows', label: 'Workflow Configuration', icon: Layers },
    { path: 'audit', label: 'Audit Administration', icon: Clock },
    { path: 'diagnostics', label: 'Technical Diagnostics', icon: Activity, adminOnly: true },
  ];

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Chamber System Settings</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
              Chamber Administration & Governance
            </h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Configure chamber RBAC roles, third-party integrations, automated archival policies, immutable audit logs, and technical system health.
            </p>
          </div>

          {chamber && (
            <div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A] text-xs font-mono">
              <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Chamber Identity</span>
              <p className="font-serif font-bold text-sm text-[#1A1A1A]">{chamber.name}</p>
              <p className="text-[10px] text-slate-600">ID: {chamber.id}</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Navigation Ribbon */}
      <div className="flex border-b-2 border-[#1A1A1A] bg-[#F5F2EF] text-xs font-bold uppercase tracking-wider overflow-x-auto scrollbar-none">
        {SETTINGS_TABS.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;

          const Icon = tab.icon;
          const targetPath = `/app/settings/${tab.path}`;
          const isActive = location.pathname.startsWith(targetPath);

          return (
            <NavLink
              key={tab.path}
              to={targetPath}
              className={({ isActive }) =>
                `px-4 py-3 border-r-2 border-[#1A1A1A] flex items-center gap-2 transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#1A1A1A] text-amber-400 font-extrabold'
                    : 'text-[#1A1A1A] hover:bg-[#FDFCFB]'
                }`
              }
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-[#B45309]'}`} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Tab Content Sub-Router */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs">
        <Routes>
          <Route path="team" element={
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
                <div className="space-y-1">
                  <h2 className="font-serif italic font-bold text-lg text-[#1A1A1A] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#B45309]" />
                    <span>Team Members & Role-Based Access Control (RBAC)</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Manage advocate roles and permissions within chamber workspace.
                  </p>
                </div>

                {onOpenRoleManager && (
                  <button
                    onClick={onOpenRoleManager}
                    className="px-4 py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs tracking-wider border border-[#1A1A1A] hover:bg-black transition-colors"
                  >
                    Manage Member Roles
                  </button>
                )}
              </div>

              <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1A1A1A]">Your Verified Chamber Role:</span>
                  <span className="px-2 py-0.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase">
                    {currentRole}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-sans">
                  Permissions are enforced server-side using authoritative chamber records stored in Firestore.
                </p>
              </div>
            </div>
          } />

          <Route path="integrations" element={
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border-2 border-[#B45309] space-y-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#B45309] text-white font-mono text-[10px] font-bold uppercase">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  e-Sign & External API Provider Configuration
                </span>
                <p className="text-slate-700">
                  Configure certified PKI e-Sign providers (eMudhra / DocuSign / Aadhaar eSign) and external messaging gateways.
                </p>
              </div>

              <PluginManager />
            </div>
          } />

          <Route path="workflows" element={
            <div className="space-y-6">
              <div className="p-4 bg-[#F5F2EF] border-2 border-[#1A1A1A] space-y-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#1A1A1A] text-amber-400 font-mono text-[10px] font-bold uppercase">
                  <Layers className="w-3.5 h-3.5" />
                  Inactivity Archival & Workflow Lifecycle Rules
                </span>
                <p className="text-slate-700">
                  Configure automated dormancy policies (30, 60, 90, 180 days) for auto-archiving inactive matters.
                </p>
              </div>
            </div>
          } />

          <Route path="audit" element={
            <AuditLogViewer chamberId={chamber?.id} userEmail={userEmail} />
          } />

          <Route path="diagnostics" element={
            isAdmin ? (
              <OpsHealthDashboard />
            ) : (
              <div className="p-8 bg-rose-50 border-2 border-rose-800 text-rose-950 text-center space-y-3">
                <Lock className="w-8 h-8 text-rose-800 mx-auto" />
                <h3 className="font-serif italic font-bold text-lg">Access Denied</h3>
                <p className="text-xs max-w-md mx-auto">
                  Technical diagnostics are strictly restricted to Chamber Administrators ({'CHAMBER_OWNER'}).
                </p>
              </div>
            )
          } />

          <Route path="*" element={<Navigate to="team" replace />} />
        </Routes>
      </div>

    </div>
  );
};
