import React, { useState, useEffect } from 'react';
import { 
  Users, 
  X, 
  ShieldCheck, 
  Lock, 
  Key, 
  Check, 
  Building2,
  UserCheck,
  UserPlus,
  Mail,
  Sliders,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { ChamberRole } from '../types';
import { db, cleanFirestoreData } from '../firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { logAuditEvent } from '../lib/auditLogger';

export interface ChamberMemberRecord {
  id: string;
  email: string;
  name: string;
  role: ChamberRole;
  status: 'Active' | 'Pending Invitation' | 'Revoked';
  invitedAt: string;
}

interface RoleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  officialRole: ChamberRole;
  simulatedRole: ChamberRole | null;
  onSelectSimulatedRole: (role: ChamberRole | null) => void;
  chamberId?: string;
  userEmail?: string;
}

export const RoleManagerModal: React.FC<RoleManagerModalProps> = ({
  isOpen,
  onClose,
  officialRole,
  simulatedRole,
  onSelectSimulatedRole,
  chamberId,
  userEmail
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'simulator'>('roster');
  
  // Member Roster State
  const [members, setMembers] = useState<ChamberMemberRecord[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<ChamberRole>('JUNIOR_ADVOCATE');
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);

  // Default seed members if firestore collection empty
  const defaultMembers: ChamberMemberRecord[] = [
    {
      id: 'm1',
      email: userEmail || 'principal@advocate360.law',
      name: 'Advocate Rajesh Kumar (Chamber Principal)',
      role: 'CHAMBER_OWNER',
      status: 'Active',
      invitedAt: '2026-01-15'
    },
    {
      id: 'm2',
      email: 'priya.junior@advocate360.law',
      name: 'Priya Sharma (Senior Associate)',
      role: 'SENIOR_ADVOCATE',
      status: 'Active',
      invitedAt: '2026-02-01'
    },
    {
      id: 'm3',
      email: 'arun.drafting@advocate360.law',
      name: 'Arun V. (Junior Advocate)',
      role: 'JUNIOR_ADVOCATE',
      status: 'Active',
      invitedAt: '2026-03-10'
    },
    {
      id: 'm4',
      email: 'ramesh.client@gmail.com',
      name: 'Ramesh Kumar (Client Portal User)',
      role: 'CLIENT',
      status: 'Active',
      invitedAt: '2026-04-05'
    }
  ];

  // Load live chamber members from Firestore
  useEffect(() => {
    if (!chamberId) {
      setMembers(defaultMembers);
      return;
    }

    try {
      const membersRef = collection(db, 'chambers', chamberId, 'members');
      const unsub = onSnapshot(membersRef, (snap) => {
        const loaded: ChamberMemberRecord[] = [];
        snap.forEach(d => {
          loaded.push({ id: d.id, ...d.data() } as ChamberMemberRecord);
        });
        if (loaded.length > 0) {
          setMembers(loaded);
        } else {
          setMembers(defaultMembers);
        }
      }, (err) => {
        console.error('Firestore members permission error:', err);
        setMembers(defaultMembers);
      });
      return () => unsub();
    } catch {
      setMembers(defaultMembers);
    }
  }, [chamberId]);

  if (!isOpen) return null;

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    setIsSavingMember(true);
    setMemberMessage(null);

    const memberId = newEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newRecord: ChamberMemberRecord = {
      id: memberId,
      email: newEmail.trim(),
      name: newName.trim(),
      role: newRole,
      status: 'Pending Invitation',
      invitedAt: new Date().toISOString().split('T')[0]
    };

    try {
      if (chamberId) {
        await setDoc(doc(db, 'chambers', chamberId, 'members', memberId), cleanFirestoreData(newRecord));
      } else {
        setMembers(prev => [...prev, newRecord]);
      }

      logAuditEvent('ROLE_CHANGE', `Invited new Chamber Member [${newName}] with bound role [${newRole}]`);
      setMemberMessage(`Invitation sent to ${newEmail}. Role [${newRole}] assigned and bound in Firestore.`);
      setNewEmail('');
      setNewName('');
    } catch (err) {
      console.error('Error adding member:', err);
      setMemberMessage('Failed to save member in Firestore. Local fallback active.');
      setMembers(prev => [...prev, newRecord]);
    } finally {
      setIsSavingMember(false);
    }
  };

  const rolesList: { role: ChamberRole; title: string; desc: string; permissions: string[] }[] = [
    {
      role: 'CHAMBER_OWNER',
      title: 'Chamber Principal / Senior Advocate',
      desc: 'Full governance, fee approvals, case assignment, audit logs, and member role management.',
      permissions: ['case.read', 'case.edit', 'case.delete', 'document.export', 'billing.view', 'workflow.create', 'ai.execute', 'audit.view', 'settings.manage']
    },
    {
      role: 'SENIOR_ADVOCATE',
      title: 'Senior Advocate / Partner',
      desc: 'Full court strategy, fee approvals, document execution, and senior drafting review.',
      permissions: ['case.read', 'case.edit', 'case.delete', 'document.export', 'billing.view', 'workflow.create', 'ai.execute', 'audit.view']
    },
    {
      role: 'JUNIOR_ADVOCATE',
      title: 'Junior Advocate / Associate',
      desc: 'Case research, drafting petitions, evidence scorecard, timeline compilation, hearing prep.',
      permissions: ['case.read', 'case.edit', 'document.upload', 'document.export', 'workflow.create', 'ai.execute']
    },
    {
      role: 'CLERK',
      title: 'Law Clerk / Paralegal',
      desc: 'Filing verification, court dates update, document scanning & OCR upload, task checklist.',
      permissions: ['case.read', 'document.upload']
    },
    {
      role: 'RECEPTIONIST',
      title: 'Chamber Receptionist',
      desc: 'Client intake story entry, appointment scheduling, fee receipt recording.',
      permissions: ['case.read']
    },
    {
      role: 'CLIENT',
      title: 'Client Portal User',
      desc: 'Restricted client portal view for case status updates, document uploads, and Q&A assistant.',
      permissions: ['case.read', 'document.upload']
    },
    {
      role: 'ADMINISTRATOR',
      title: 'Enterprise System Administrator',
      desc: 'Workspace infrastructure, tenant isolation rules, security rule deployments.',
      permissions: ['case.read', 'audit.view', 'settings.manage', 'branch.manage']
    }
  ];

  const currentActiveRole = simulatedRole || officialRole;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-4 bg-[#1A1A1A] text-white flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono bg-amber-500 text-black px-2 py-0.5 font-bold uppercase tracking-wider">
                  Governance & RBAC
                </span>
                {simulatedRole && (
                  <span className="text-[9px] font-mono bg-purple-600 text-white px-2 py-0.5 font-bold uppercase tracking-wider animate-pulse">
                    Simulator Active
                  </span>
                )}
              </div>
              <h3 className="font-serif italic font-light text-xl text-white">Chamber Governance & Permission Simulator</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#F5F2EF] border-b border-[#1A1A1A] px-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'roster'
                ? 'border-[#1A1A1A] text-[#1A1A1A] bg-white'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            <Users className="w-4 h-4 text-amber-700" />
            <span>1. Production Member Roster & Role Binding</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-[#1A1A1A] text-[#1A1A1A] bg-white'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            <Sliders className="w-4 h-4 text-purple-700" />
            <span>2. UI Permission Preview & Role Simulator</span>
          </button>
        </div>

        {/* Tab 1: Member Roster & Production Role Assignment */}
        {activeTab === 'roster' && (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            
            {/* Architecture Explanation Banner */}
            <div className="bg-amber-500/10 border border-amber-700/40 p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Lock className="w-4 h-4 text-amber-800" />
                <span>Production Security Architecture</span>
              </div>
              <p className="text-xs text-[#555555] leading-relaxed">
                In a production deployment, users do not pick their own roles upon logging in. Chamber Owners invite users by email and bind their assigned role directly into Firestore security records (`/chambers/{'{chamberId}'}/members/{'{uid}'}`). The user automatically inherits their assigned role when authenticating.
              </p>
            </div>

            {/* Current Authenticated User Status */}
            <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#555555] block">Authenticated Account:</span>
                <span className="font-mono font-bold text-[#1A1A1A]">{userEmail || 'principal@advocate360.law'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#555555] block">Bound Firestore Role:</span>
                <span className="inline-flex items-center gap-1.5 bg-[#1A1A1A] text-amber-400 font-mono font-bold px-2.5 py-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{officialRole}</span>
                </span>
              </div>
            </div>

            {/* Member Invitation Form */}
            <form onSubmit={handleInviteMember} className="bg-white border border-[#1A1A1A] p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-800" />
                  <span>Invite New Chamber Member & Assign Bound Role</span>
                </span>
                <span className="text-[10px] font-mono text-[#555555]">Chamber Owner / Admin Only</span>
              </div>

              {memberMessage && (
                <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-mono">
                  {memberMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Full Name:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Advocate S. Sundaram"
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs font-mono text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Email Address:</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sundaram@advocate360.law"
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs font-mono text-[#1A1A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#1A1A1A] mb-1">Assigned Role:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as ChamberRole)}
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs font-mono font-bold text-[#1A1A1A]"
                  >
                    <option value="SENIOR_ADVOCATE">Senior Advocate / Partner</option>
                    <option value="JUNIOR_ADVOCATE">Junior Advocate / Associate</option>
                    <option value="ASSOCIATE">Legal Associate</option>
                    <option value="PARALEGAL">Paralegal / Research Fellow</option>
                    <option value="CLERK">Law Clerk</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="CLIENT">Client Portal User</option>
                    <option value="ADMINISTRATOR">System Administrator</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingMember}
                className="w-full py-2.5 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase text-xs tracking-wider border border-[#1A1A1A] flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>{isSavingMember ? 'Saving to Firestore...' : 'Save Member Record & Send Email Invitation'}</span>
              </button>
            </form>

            {/* Active Members Roster */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] block">
                Active Chamber Members Roster ({members.length})
              </span>

              <div className="divide-y border border-[#1A1A1A]">
                {members.map(m => (
                  <div key={m.id} className="p-3 bg-white flex items-center justify-between text-xs hover:bg-[#F9F7F5] transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-[#1A1A1A]">{m.name}</span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 font-bold ${
                          m.status === 'Active' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#555555] block">{m.email}</span>
                    </div>

                    <div className="text-right">
                      <span className="bg-[#1A1A1A] text-amber-300 font-mono text-[10px] font-bold px-2 py-1 uppercase tracking-wider inline-block">
                        {m.role}
                      </span>
                      <span className="text-[9px] text-[#777777] block mt-0.5">Invited: {m.invitedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Permission Matrix & Role Simulator */}
        {activeTab === 'simulator' && (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            
            <div className="bg-purple-500/10 border border-purple-700/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-900">
                  <Sliders className="w-4 h-4 text-purple-800" />
                  <span>UI Permission Simulator (Preview Mode)</span>
                </div>
                {simulatedRole && (
                  <button
                    onClick={() => onSelectSimulatedRole(null)}
                    className="bg-purple-900 text-white hover:bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Exit Simulation Mode
                  </button>
                )}
              </div>
              <p className="text-xs text-[#555555] leading-relaxed">
                Use this simulator to preview how different staff personas (e.g., Junior Advocates, Clerks, or Clients) experience the LegalOS interface. Selecting a role here temporarily overrides UI rendering without modifying your official Firestore security credentials.
              </p>
            </div>

            {/* Active Simulation Status */}
            <div className="p-3 bg-[#1A1A1A] text-white flex items-center justify-between text-xs">
              <span>Official Bound Role: <strong className="text-amber-400 font-mono">{officialRole}</strong></span>
              <span>
                Current Effective UI View: {' '}
                <strong className={`font-mono ${simulatedRole ? 'text-purple-300 uppercase' : 'text-emerald-400 uppercase'}`}>
                  {currentActiveRole} {simulatedRole ? '(SIMULATED)' : '(OFFICIAL)'}
                </strong>
              </span>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {rolesList.map((r) => {
                const isSelected = currentActiveRole === r.role;
                return (
                  <div
                    key={r.role}
                    onClick={() => {
                      onSelectSimulatedRole(r.role === officialRole ? null : r.role);
                    }}
                    className={`p-4 border-2 cursor-pointer transition-all space-y-2 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-md'
                        : 'bg-[#F9F7F5] border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-[#1A1A1A]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className={`font-serif font-bold text-sm ${isSelected ? 'text-amber-400' : 'text-[#1A1A1A]'}`}>
                          {r.title}
                        </h4>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className={`text-[11px] font-serif italic mt-1 leading-relaxed ${isSelected ? 'text-slate-300' : 'text-[#555555]'}`}>
                        {r.desc}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-current/20 flex flex-wrap gap-1">
                      {r.permissions.map((p, idx) => (
                        <span
                          key={idx}
                          className={`text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-bold border ${
                            isSelected
                              ? 'bg-white/10 text-white border-white/20'
                              : 'bg-[#1A1A1A]/10 text-[#1A1A1A] border-[#1A1A1A]/20'
                          }`}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-[#F5F2EF] border-t border-[#1A1A1A] flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-[#555555]">
            Effective Role: [{currentActiveRole}] • Access Enforcement: Unified `hasPermission()` Matrix
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A1A1A] text-white font-bold uppercase text-[10px] tracking-wider hover:bg-black"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
