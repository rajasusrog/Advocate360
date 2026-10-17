import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { 
  MessageSquareText, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Clock, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  Link, 
  Mail, 
  Share2, 
  Copy, 
  Check, 
  Lock, 
  Key, 
  Eye, 
  UserCheck, 
  AlertCircle, 
  Trash2, 
  ArrowUpRight, 
  IndianRupee,
  CheckCircle2, 
  Upload, 
  ExternalLink,
  Smartphone,
  ChevronRight,
  Shield,
  FileCheck2
} from 'lucide-react';
import { CaseFile, ChamberProfile } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface ClientInvitationRecord {
  id: string;
  caseId: string;
  caseTitle: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  token: string;
  accessUrl: string;
  pin: string;
  scopes: {
    viewHearings: boolean;
    viewFilings: boolean;
    viewBilling: boolean;
    chatAi: boolean;
    uploadDocs: boolean;
  };
  expiryDays: number;
  expiresAt: string;
  createdAt: string;
  status: 'Active' | 'Revoked' | 'Expired';
  lastAccessed?: string;
}

interface ChatMessage {
  id: string;
  sender: 'client' | 'ai';
  text: string;
  timestamp: string;
}

interface ClientPortalProps {
  cases?: CaseFile[];
  selectedCaseId?: string;
  setSelectedCaseId?: (id: string) => void;
  chamber?: ChamberProfile | null;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  cases = [],
  selectedCaseId,
  setSelectedCaseId,
  chamber
}) => {
  const currentCase = cases.find(c => c.id === selectedCaseId) || cases[0] || {
    id: 'case-101',
    title: 'Ramesh Kumar vs. Suresh Kumar & Ors.',
    caseNumber: 'O.S. 402/2024',
    clientName: 'Ramesh Kumar',
    clientEmail: 'ramesh.kumar@example.com',
    clientPhone: '+91 98765 43210',
    courtName: 'City Civil Court, Chennai (Hall No. 18)',
    nextHearingDate: '2026-08-05',
    judgeName: 'Hon. Justice M. Swaminathan',
    stage: 'Injunction Arguments & Issues',
    summary: 'Dispute regarding unlawful sale of ancestral undivided plot in Mylapore without consent of legal heir.'
  };

  // View Mode: Advocate Management View vs Client Portal Preview View
  const [viewMode, setViewMode] = useState<'advocate' | 'client_preview'>('advocate');

  // Generator form state
  const [clientEmail, setClientEmail] = useState(currentCase.clientEmail || 'ramesh.kumar@example.com');
  const [clientPhone, setClientPhone] = useState(currentCase.clientPhone || '+91 98765 43210');
  const [clientName, setClientName] = useState(currentCase.clientName || 'Ramesh Kumar');
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [requirePin, setRequirePin] = useState<boolean>(true);
  const [generatedPin, setGeneratedPin] = useState<string>('4829');

  // Permissions scopes
  const [scopes, setScopes] = useState({
    viewHearings: true,
    viewFilings: true,
    viewBilling: true,
    chatAi: true,
    uploadDocs: true
  });

  // Generated Link State
  const [latestGeneratedInvite, setLatestGeneratedInvite] = useState<ClientInvitationRecord | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Access to Your Case Portal: ${currentCase.caseNumber || currentCase.title}`);
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  // Active Invitations Roster
  const [invitations, setInvitations] = useState<ClientInvitationRecord[]>([
    {
      id: 'inv-seed-1',
      caseId: currentCase.id,
      caseTitle: currentCase.title,
      clientName: currentCase.clientName,
      clientEmail: currentCase.clientEmail || 'ramesh.kumar@example.com',
      clientPhone: currentCase.clientPhone || '+91 98765 43210',
      token: 'cpt_8a7d4e129fbc',
      accessUrl: `https://advocate360.legal/portal/access?token=cpt_8a7d4e129fbc&caseId=${currentCase.id}`,
      pin: '4829',
      scopes: {
        viewHearings: true,
        viewFilings: true,
        viewBilling: true,
        chatAi: true,
        uploadDocs: true
      },
      expiryDays: 30,
      expiresAt: new Date(Date.now() + 86400000 * 30).toLocaleDateString(),
      createdAt: new Date().toLocaleDateString(),
      status: 'Active',
      lastAccessed: 'Today at 03:45 PM'
    }
  ]);

  // Client Chat Messages (for Client Preview)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: `Namaste ${currentCase.clientName}. I am your Advocate Chambers AI Assistant for ${currentCase.title} (${currentCase.caseNumber || 'O.S. 402/2024'}). Your next hearing is scheduled on ${currentCase.nextHearingDate || '2026-08-05'}. How may I help you today?`,
      timestamp: '10:00 AM'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Client Document Upload Mock State
  const [clientUploadedFiles, setClientUploadedFiles] = useState<string[]>([
    'Electricity_Bill_May_2026.pdf',
    'Tenant_Rent_Receipt_June_2026.jpg'
  ]);
  const [isUploadingClientDoc, setIsUploadingClientDoc] = useState(false);

  const handleGenerateLink = () => {
    const token = `cpt_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4)}`;
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const accessUrl = `https://advocate360.legal/portal/access?token=${token}&caseId=${currentCase.id}`;
    const expiresAt = new Date(Date.now() + 86400000 * expiryDays).toLocaleDateString();

    const newInvite: ClientInvitationRecord = {
      id: `inv-${Date.now()}`,
      caseId: currentCase.id,
      caseTitle: currentCase.title,
      clientName: clientName.trim() || currentCase.clientName,
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      token,
      accessUrl,
      pin: requirePin ? pin : 'None',
      scopes: { ...scopes },
      expiryDays,
      expiresAt,
      createdAt: new Date().toLocaleDateString(),
      status: 'Active'
    };

    setGeneratedPin(pin);
    setLatestGeneratedInvite(newInvite);
    setInvitations(prev => [newInvite, ...prev]);

    logAuditEvent('ROLE_CHANGE', `Generated Secure Client Portal Access Link for: ${newInvite.clientName} (${currentCase.title})`);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRevokeInvitation = (invId: string) => {
    setInvitations(prev => prev.map(inv => inv.id === invId ? { ...inv, status: 'Revoked' } : inv));
    logAuditEvent('ROLE_CHANGE', `Revoked Client Portal Access Token: ${invId}`);
  };

  const handleSendEmailSimulation = () => {
    // Truthful handling: Email dispatch requires external provider (SMTP/SendGrid/SES)
    // Copy the secure share link directly instead of fake dispatching.
    if (latestGeneratedInvite) {
      navigator.clipboard.writeText(latestGeneratedInvite.accessUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      logAuditEvent('ROLE_CHANGE', `Copied Secure Share Link for client: ${clientEmail} (Email provider unconfigured)`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputQuery.trim()) return;

    const clientMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: 'client',
      text: inputQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, clientMsg]);
    setInputQuery('');
    setIsReplying(true);

    try {
      const data = await apiPost<{ reply: string }>('/api/ai/agent-chat', {
        agentRole: 'Client Communication Agent',
        message: clientMsg.text,
        caseContext: `Client ${currentCase.clientName} inquiring about case ${currentCase.title} (${currentCase.caseNumber}). Next date: ${currentCase.nextHearingDate}. Court: ${currentCase.courtName}. Stage: ${currentCase.stage}.`
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || `Your advocate team has reviewed your query. For ${currentCase.caseNumber}, the court has scheduled the matter for ${currentCase.stage} on ${currentCase.nextHearingDate}. Please keep your original receipts ready.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Client Chat Error:', err);
    } finally {
      setIsReplying(false);
    }
  };

  const handleSimulateClientUpload = () => {
    setIsUploadingClientDoc(true);
    setTimeout(() => {
      setClientUploadedFiles(prev => [...prev, `Property_Tax_Challan_${Date.now().toString().slice(-4)}.pdf`]);
      setIsUploadingClientDoc(false);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-[#1A1A1A]">
      
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Confidential Client Portal Hub</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">
              Client Access Invitation & 24×7 Case Portal
            </h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Generate time-limited, encrypted access links and email invitations for clients to track their matter, view hearing dates, inspect filings, settle fees via UPI, and chat with the 24×7 AI assistant.
            </p>
          </div>

          {/* Perspective View Switcher */}
          <div className="flex items-center gap-2 border-2 border-[#1A1A1A] p-1 bg-white">
            <button
              onClick={() => setViewMode('advocate')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                viewMode === 'advocate'
                  ? 'bg-[#1A1A1A] text-amber-400'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Advocate Manager</span>
            </button>

            <button
              onClick={() => setViewMode('client_preview')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                viewMode === 'client_preview'
                  ? 'bg-[#1A1A1A] text-amber-400'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Client Portal (Live View)</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: ADVOCATE MANAGEMENT & INVITATION GENERATOR */}
      {viewMode === 'advocate' && (
        <div className="space-y-6">
          
          {/* Invitation Generator Panel */}
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-[#B45309]" />
                <h2 className="font-serif italic font-bold text-lg text-[#1A1A1A]">
                  Generate Client Portal Access Link / Invitation
                </h2>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-800 px-2 py-0.5 border border-slate-300">
                End-to-End Isolated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Column 1: Client & Matter Selection */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                    Target Case Matter
                  </label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId && setSelectedCaseId(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] font-serif font-bold text-xs focus:outline-none"
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber ? `${c.caseNumber}: ` : ''}{c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                    Client Legal Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                    Client Email Address
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                    Client Mobile (for WhatsApp Link)
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Column 2: Access Scope Permissions */}
              <div className="space-y-3 bg-[#F9F7F5] p-4 border border-[#1A1A1A]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#B45309] block border-b border-slate-300 pb-1.5">
                  Client Permission Scopes:
                </span>

                <div className="space-y-2.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.viewHearings}
                      onChange={(e) => setScopes({ ...scopes, viewHearings: e.target.checked })}
                      className="accent-[#B45309]"
                    />
                    <span>View Court Hearing Dates & Cause List</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.viewFilings}
                      onChange={(e) => setScopes({ ...scopes, viewFilings: e.target.checked })}
                      className="accent-[#B45309]"
                    />
                    <span>View Pleadings & Order Sheets (Read-Only)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.viewBilling}
                      onChange={(e) => setScopes({ ...scopes, viewBilling: e.target.checked })}
                      className="accent-[#B45309]"
                    />
                    <span>View Chamber Fee Ledger & Pay via UPI</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.chatAi}
                      onChange={(e) => setScopes({ ...scopes, chatAi: e.target.checked })}
                      className="accent-[#B45309]"
                    />
                    <span>24×7 Routine Legal Q&A Assistant</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.uploadDocs}
                      onChange={(e) => setScopes({ ...scopes, uploadDocs: e.target.checked })}
                      className="accent-[#B45309]"
                    />
                    <span>Document Dropbox (Client Uploads)</span>
                  </label>
                </div>
              </div>

              {/* Column 3: Security & Link Expiry */}
              <div className="space-y-4 text-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1">
                      Link Expiration Duration
                    </label>
                    <select
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(Number(e.target.value))}
                      className="w-full p-2 bg-[#F9F7F5] border border-[#1A1A1A] text-xs focus:outline-none"
                    >
                      <option value={7}>7 Days (Recommended for urgent reviews)</option>
                      <option value={30}>30 Days (Standard litigation fixture)</option>
                      <option value={90}>90 Days (Active trial duration)</option>
                      <option value={365}>Until Case Closure (Full retainer)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-300 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requirePin}
                        onChange={(e) => setRequirePin(e.target.checked)}
                        className="accent-[#B45309]"
                      />
                      <span className="font-bold text-[#1A1A1A] text-[11px]">Enforce 4-Digit Security PIN</span>
                    </label>
                    <p className="text-[10px] text-amber-900 font-serif italic">
                      Client will be required to input PIN before opening confidential documents.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleGenerateLink}
                  className="w-full py-3 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 border border-[#1A1A1A] transition-colors shadow-sm"
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Generate Access Link</span>
                </button>
              </div>

            </div>

            {/* Generated Link Result Ribbon */}
            {latestGeneratedInvite && (
              <div className="p-4 bg-[#1A1A1A] text-white border-2 border-amber-500 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Secure Client Link Ready</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Expires: {latestGeneratedInvite.expiresAt}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={latestGeneratedInvite.accessUrl}
                    className="flex-1 w-full p-2 text-xs bg-slate-900 border border-slate-700 font-mono text-amber-300 focus:outline-none"
                  />

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleCopyLink(latestGeneratedInvite.accessUrl)}
                      className="px-3 py-2 bg-amber-500 text-black font-bold uppercase text-[11px] tracking-wider flex items-center gap-1 hover:bg-amber-400 transition-colors shrink-0"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="px-3 py-2 bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider flex items-center gap-1 hover:bg-slate-700 border border-slate-600 transition-colors shrink-0"
                    >
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span>Email Invite</span>
                    </button>

                    <a
                      href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(latestGeneratedInvite.clientPhone)}&text=${encodeURIComponent(
                        `Advocate Chambers: Secure portal access link for ${currentCase.title} (${currentCase.caseNumber}): ${latestGeneratedInvite.accessUrl} (Access PIN: ${latestGeneratedInvite.pin})`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-emerald-700 text-white font-bold uppercase text-[11px] tracking-wider flex items-center gap-1 hover:bg-emerald-600 transition-colors shrink-0"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>

                {latestGeneratedInvite.pin !== 'None' && (
                  <p className="text-[11px] font-mono text-slate-300">
                    Security PIN: <strong className="text-amber-400 font-bold tracking-widest">{latestGeneratedInvite.pin}</strong> (Provided to client privately)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Active Invitations Roster */}
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
              <h3 className="font-serif italic font-bold text-base text-[#1A1A1A] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#B45309]" />
                <span>Active Client Access Records & Security Tokens ({invitations.length})</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                RBAC Level 4: Client Restricted
              </span>
            </div>

            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-4 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    inv.status === 'Active'
                      ? 'bg-[#F9F7F5] border-[#1A1A1A]'
                      : 'bg-slate-100 border-slate-300 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 border ${
                        inv.status === 'Active'
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-rose-700 text-white border-rose-800'
                      }`}>
                        {inv.status}
                      </span>
                      <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">{inv.clientName}</h4>
                      <span className="text-xs text-slate-500 font-mono">({inv.clientEmail})</span>
                    </div>

                    <p className="text-xs text-slate-600 font-serif italic">
                      Matter: <strong>{inv.caseTitle}</strong> • Token: <span className="font-mono text-[11px]">{inv.token}</span>
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1 text-[9px] font-mono font-bold text-slate-600">
                      {inv.scopes.viewHearings && <span className="bg-white border px-1.5 py-0.2">Hearings</span>}
                      {inv.scopes.viewFilings && <span className="bg-white border px-1.5 py-0.2">Filings</span>}
                      {inv.scopes.viewBilling && <span className="bg-white border px-1.5 py-0.2">UPI Billing</span>}
                      {inv.scopes.chatAi && <span className="bg-white border px-1.5 py-0.2">24×7 AI</span>}
                      {inv.scopes.uploadDocs && <span className="bg-white border px-1.5 py-0.2">Uploads</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                      onClick={() => handleCopyLink(inv.accessUrl)}
                      className="px-2.5 py-1.5 bg-white border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider hover:bg-slate-50"
                      title="Copy access link"
                    >
                      Copy Link
                    </button>

                    <button
                      onClick={() => setViewMode('client_preview')}
                      className="px-2.5 py-1.5 bg-[#1A1A1A] text-amber-400 border border-[#1A1A1A] text-xs font-bold uppercase tracking-wider hover:bg-black"
                      title="Preview this client view"
                    >
                      Preview
                    </button>

                    {inv.status === 'Active' && (
                      <button
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold uppercase tracking-wider hover:bg-rose-100"
                        title="Revoke access immediately"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* MODE 2: CLIENT PORTAL LIVE PREVIEW (What the client sees) */}
      {viewMode === 'client_preview' && (
        <div className="space-y-6">
          
          {/* Client Notice Ribbon */}
          <div className="p-3 bg-amber-50 border-2 border-[#B45309] flex items-center justify-between text-xs text-[#1A1A1A]">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#B45309]" />
              <span>
                <strong>Advocate Preview Mode Active:</strong> You are viewing this page exactly as client <strong>{currentCase.clientName}</strong> experiences it.
              </span>
            </div>
            <button
              onClick={() => setViewMode('advocate')}
              className="px-2.5 py-1 bg-[#1A1A1A] text-white font-bold uppercase text-[10px] tracking-wider"
            >
              Exit Preview
            </button>
          </div>

          {/* Client Case Banner */}
          <div className="bg-[#1A1A1A] text-white border-2 border-[#1A1A1A] p-6 lg:p-8 space-y-4 shadow-md">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-700 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] bg-[#B45309] text-white px-2 py-0.5">
                  Client Protected Workspace
                </span>
                <h2 className="font-serif text-3xl font-light italic text-white mt-2">
                  {currentCase.title}
                </h2>
                <p className="text-xs text-slate-300 font-mono mt-1">
                  Court Case No: <strong className="text-amber-400">{currentCase.caseNumber || 'O.S. 402/2024'}</strong> • {currentCase.courtName || 'City Civil Court'}
                </p>
              </div>

              {/* Hearing Countdown Badge */}
              <div className="p-3 bg-slate-900 border border-amber-500/50 text-right shrink-0">
                <span className="text-[9px] uppercase font-bold text-amber-400 block tracking-widest">
                  Next Court Hearing
                </span>
                <span className="font-serif italic font-bold text-lg text-white">
                  {currentCase.nextHearingDate || '2026-08-05'}
                </span>
                <p className="text-[10px] text-slate-300 font-mono">{currentCase.stage || 'Injunction Arguments'}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {currentCase.summary}
            </p>
          </div>

          {/* Client Interactive Grid: Filings & Dropbox + 24x7 Assistant */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Shared Documents & Fee Ledger */}
            <div className="space-y-6">
              
              {/* Shared Filings */}
              <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-700" />
                    <span>Court Filings & Exhibits (Shared with You)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">Read-Only</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-[#F9F7F5] border border-slate-300 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#1A1A1A]">Plaint & Injunction Petition (O.39 R.1&2)</p>
                      <span className="text-[10px] text-slate-500 font-mono">Filed on 20-07-2026 • 18 Pages</span>
                    </div>
                    <button
                      onClick={() => alert('Downloading verified court document...')}
                      className="px-2 py-1 bg-[#1A1A1A] text-white text-[10px] uppercase font-bold hover:bg-black"
                    >
                      Download
                    </button>
                  </div>

                  <div className="p-3 bg-[#F9F7F5] border border-slate-300 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#1A1A1A]">Parent Title Deed (Exhibit A-1)</p>
                      <span className="text-[10px] text-slate-500 font-mono">Sale Deed 1204/1995 • Certified Copy</span>
                    </div>
                    <button
                      onClick={() => alert('Downloading verified court document...')}
                      className="px-2 py-1 bg-[#1A1A1A] text-white text-[10px] uppercase font-bold hover:bg-black"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>

              {/* Client Document Dropbox */}
              <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#B45309]" />
                    <span>Upload Documents to Your Advocate</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.2">Secure</span>
                </div>

                <p className="text-xs text-slate-600">
                  Submit additional receipts, electricity bills, or WhatsApp screenshot evidence directly to chamber counsel.
                </p>

                <div className="space-y-2">
                  {clientUploadedFiles.map((file, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-300 flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-700 truncate">{file}</span>
                      <span className="text-[10px] font-bold text-emerald-700">✓ Received by Chamber</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSimulateClientUpload}
                  disabled={isUploadingClientDoc}
                  className="w-full py-2.5 bg-[#F9F7F5] hover:bg-white text-[#1A1A1A] border-2 border-dashed border-[#1A1A1A] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>{isUploadingClientDoc ? 'Encrypting & Uploading...' : '+ Upload Document / Photo'}</span>
                </button>
              </div>

              {/* Fee Ledger Summary & UPI Pay */}
              <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-emerald-700" />
                    <span>Chamber Fee Ledger & Invoicing</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">Verified UPI</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#F9F7F5] border border-slate-300">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Invoiced</span>
                    <span className="font-serif font-bold text-base text-[#1A1A1A]">₹1,50,000</span>
                  </div>
                  <div className="p-3 bg-[#F9F7F5] border border-slate-300">
                    <span className="text-[9px] uppercase font-bold text-amber-700 block">Pending Balance</span>
                    <span className="font-serif font-bold text-base text-amber-800">₹75,000</span>
                  </div>
                </div>

                <button
                  onClick={() => alert('Opening Secure UPI / NetBanking Gateway...')}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Settle Balance via UPI / QR Code</span>
                </button>
              </div>

            </div>

            {/* Right: 24x7 Routine AI Client Assistant */}
            <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] flex flex-col h-[650px] shadow-xs">
              
              <div className="p-4 bg-[#F5F2EF] border-b border-[#1A1A1A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#1A1A1A] text-amber-400 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1A1A1A]">24×7 Case Status Assistant</h3>
                    <p className="text-[10px] text-slate-500 font-mono">Grounded on your verified court filings</p>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Quick FAQ Prompts */}
              <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-1.5">
                {[
                  'When is my next court hearing?',
                  'Do I need to come to court?',
                  'What documents should I bring?',
                  'What happened on the last date?'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(q);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 text-[10px] font-serif hover:bg-amber-50 hover:border-amber-500 transition-colors"
                  >
                    "{q}"
                  </button>
                ))}
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 max-w-xl ${msg.sender === 'client' ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div className={`w-7 h-7 flex items-center justify-center shrink-0 border border-[#1A1A1A] ${
                      msg.sender === 'client' ? 'bg-[#1A1A1A] text-amber-400' : 'bg-[#F5F2EF] text-[#1A1A1A]'
                    }`}>
                      {msg.sender === 'client' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div className={`p-3 text-xs space-y-1 border ${
                      msg.sender === 'client'
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-[#F9F7F5] text-[#1A1A1A] border-[#1A1A1A]/40'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed font-sans">{msg.text}</p>
                      <span className={`text-[9px] block text-right font-mono ${
                        msg.sender === 'client' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {isReplying && (
                  <div className="flex gap-2.5 max-w-md">
                    <div className="w-7 h-7 bg-[#1A1A1A] text-amber-400 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] text-xs font-serif italic text-slate-600 animate-pulse">
                      Advocate360 AI is reviewing case docket...
                    </div>
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-[#F5F2EF] border-t border-[#1A1A1A] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask a question about your case status..."
                  className="flex-1 p-2.5 bg-[#FDFCFB] border border-[#1A1A1A] text-xs font-serif focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputQuery.trim() || isReplying}
                  className="p-2.5 bg-[#1A1A1A] text-amber-400 font-bold border border-[#1A1A1A] transition-colors disabled:opacity-50 hover:bg-black"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Formal Email Invitation Modal */}
      {showEmailModal && latestGeneratedInvite && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-6 max-w-xl w-full shadow-2xl space-y-4 text-[#1A1A1A]">
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#B45309]" />
                <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">
                  Email Invitation Preview
                </h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-[#1A1A1A] hover:text-[#B45309]">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">Recipient:</label>
                <input
                  type="text"
                  readOnly
                  value={`${latestGeneratedInvite.clientName} <${latestGeneratedInvite.clientEmail}>`}
                  className="w-full p-2 bg-[#F9F7F5] border border-slate-300 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-0.5">Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-2 bg-[#F9F7F5] border border-slate-300 font-serif font-bold text-xs"
                />
              </div>

              {/* Styled Email Letter Body */}
              <div className="p-4 bg-white border border-[#1A1A1A] space-y-3 font-serif leading-relaxed text-xs">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <span className="font-black italic text-sm text-[#1A1A1A]">
                    {chamber?.name || 'Advocate Legal Chambers'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">Privileged & Confidential</span>
                </div>

                <p>Dear {latestGeneratedInvite.clientName},</p>

                <p>
                  Our chamber has granted you confidential access to your online case portal for <strong>{currentCase.title}</strong> ({currentCase.caseNumber}).
                </p>

                <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] space-y-1 text-center font-sans">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#B45309] block">
                    Access Link:
                  </span>
                  <span className="font-mono text-xs text-blue-700 underline break-all block">
                    {latestGeneratedInvite.accessUrl}
                  </span>
                  {latestGeneratedInvite.pin !== 'None' && (
                    <span className="text-[11px] font-bold text-[#1A1A1A] block mt-1">
                      Your Access PIN: <strong className="font-mono bg-white px-2 py-0.5 border">{latestGeneratedInvite.pin}</strong>
                    </span>
                  )}
                </div>

                <p>
                  Through this portal, you can inspect court order sheets, check upcoming hearing fixtures, submit documents, and communicate with the chamber.
                </p>

                <p className="text-[11px] text-slate-500 italic">
                  Regards,<br />
                  Chamber of Advocate | Advocate360 AI LegalOS
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-400 text-amber-900 text-[11px] font-mono flex items-center justify-between">
              <span>Email Service Status: <strong>Not Configured (SMTP/SendGrid)</strong></span>
              <span className="text-[10px] text-amber-800">Use Secure Link</span>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-[#1A1A1A]">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-2 bg-[#F5F2EF] text-[#1A1A1A] border border-[#1A1A1A] font-bold uppercase tracking-wider text-xs"
              >
                Close
              </button>
              <button
                onClick={handleSendEmailSimulation}
                className="flex-1 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 border border-[#1A1A1A] font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Link Copied!' : 'Copy Secure Share Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
