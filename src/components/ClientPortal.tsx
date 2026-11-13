import React, { useState, useEffect, useCallback } from 'react';
import { CaseFile, Invoice, EnterpriseDoc, ChamberRole } from '../types';
import {
  Shield,
  Calendar,
  FileText,
  CreditCard,
  Send,
  Lock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Scale,
  Phone,
  Mail,
  Building2,
  ArrowUpRight,
  Eye,
  Upload,
  Plus,
  X,
  KeyRound,
  UserPlus,
  RefreshCw,
  Ban,
  AlertTriangle,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  useChamberClients,
  ClientInvitationScopes,
  PersistedClientInvitation,
  RestrictedClientPortalMatterView,
  createClientInvitationInDb,
  listClientInvitationsForWorkspace,
  revokeClientInvitationInDb,
  redeemClientInvitationInDb,
  getRestrictedClientPortalMatterInDb,
  listActiveClientGrantsForUser,
  uploadDocumentToStorageAndDb,
} from '../lib/useMatterData';
import {
  supabase,
  signInWithGoogle,
  signOut,
  savePendingPortalInviteToken,
  peekPendingPortalInviteToken,
  clearPendingPortalInviteToken,
} from '../lib/supabase';

interface ClientPortalProps {
  cases: CaseFile[];
  invoices?: Invoice[];
  documents?: EnterpriseDoc[];
  chamberId?: string;
  isDemoMode?: boolean;
  userRole?: ChamberRole;
}

const AUTHORIZED_INVITE_STAFF_ROLES: ChamberRole[] = [
  'CHAMBER_OWNER',
  'SENIOR_ADVOCATE',
  'ASSOCIATE',
];

/**
 * Staff Client Directory & Client Invitation Management View
 * Strictly separated from the restricted client-facing portal (`/portal/redeem` & `/portal/access`).
 */
export const ClientPortal: React.FC<ClientPortalProps> = ({
  cases,
  invoices = [],
  chamberId = '',
  isDemoMode = false,
  userRole = 'CHAMBER_OWNER',
}) => {
  const { clients: dbClients } = useChamberClients(chamberId, isDemoMode);

  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [invitations, setInvitations] = useState<PersistedClientInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: 'info' | 'warning' | 'error';
    message: string;
    inviteUrl?: string;
    deliveryStatus?: 'email_not_sent' | 'email_sent';
  } | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  // Invitation Form State
  const [inviteClientName, setInviteClientName] = useState('');
  const [inviteClientEmail, setInviteClientEmail] = useState('');
  const [inviteClientPhone, setInviteClientPhone] = useState('');
  const [inviteCaseId, setInviteCaseId] = useState(cases[0]?.id || '');
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(7);
  const [invitePermissions, setInvitePermissions] = useState<ClientInvitationScopes>({
    viewHearings: true,
    viewFilings: true,
    viewBilling: true,
    uploadDocs: false,
    chatAi: false,
  });

  const canManageInvitations = AUTHORIZED_INVITE_STAFF_ROLES.includes(userRole as ChamberRole);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      setSelectedCaseId(cases[0].id);
    }
    if (!inviteCaseId && cases.length > 0) {
      setInviteCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId, inviteCaseId]);

  const loadWorkspaceInvitations = useCallback(async () => {
    // Live workspaces NEVER load sample invitations
    if (!chamberId || isDemoMode) {
      setInvitations([]);
      return;
    }

    setLoadingInvitations(true);
    setInviteError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (accessToken) {
        const res = await fetch(
          `/api/client-portal/invitations?chamberId=${encodeURIComponent(chamberId)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (res.ok) {
          const payload = await res.json();
          const rows = Array.isArray(payload.invitations) ? payload.invitations : [];
          const mapped: PersistedClientInvitation[] = rows.map((row: any) => {
            const matchedCase = cases.find((c) => c.id === row.matter_id);
            const expiresIso = row.expires_at || new Date().toISOString();
            const isExpired = new Date(expiresIso).getTime() <= Date.now();
            let status: PersistedClientInvitation['status'] = row.status || 'Active';
            if (row.revoked_at || status === 'Revoked') status = 'Revoked';
            else if (row.redeemed_at || status === 'Redeemed') status = 'Redeemed';
            else if (isExpired || status === 'Expired') status = 'Expired';

            return {
              id: row.id,
              workspaceId: row.workspace_id,
              matterId: row.matter_id,
              matterTitle: matchedCase?.title || 'Matter',
              clientEmail: row.client_email,
              clientName: row.client_name || matchedCase?.clientName || 'Client',
              clientPhone: row.client_phone || null,
              scopes: {
                viewHearings: Boolean(row.scopes?.viewHearings ?? true),
                viewFilings: Boolean(row.scopes?.viewFilings ?? true),
                viewBilling: Boolean(row.scopes?.viewBilling ?? true),
                uploadDocs: Boolean(row.scopes?.uploadDocs ?? false),
                chatAi: Boolean(row.scopes?.chatAi ?? false),
              },
              expiresAt: expiresIso,
              createdByUserId: row.created_by_user_id || null,
              redeemedByUserId: row.redeemed_by_user_id || null,
              redeemedAt: row.redeemed_at || null,
              revokedByUserId: row.revoked_by_user_id || null,
              revokedAt: row.revoked_at || null,
              status,
              deliveryStatus: row.delivery_status === 'email_sent' ? 'email_sent' : 'email_not_sent',
              createdAt: row.created_at,
            };
          });
          setInvitations(mapped);
          setLoadingInvitations(false);
          return;
        }
      }

      const loaded = await listClientInvitationsForWorkspace(chamberId, cases);
      setInvitations(loaded);
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to load client invitations.');
    } finally {
      setLoadingInvitations(false);
    }
  }, [chamberId, isDemoMode, cases]);

  useEffect(() => {
    loadWorkspaceInvitations();
  }, [loadWorkspaceInvitations]);

  const handleOpenInviteModal = (caseItem?: CaseFile) => {
    const target = caseItem || cases.find((c) => c.id === selectedCaseId) || cases[0];
    if (target) {
      setInviteCaseId(target.id);
      setInviteClientName(target.clientName || '');
      setInviteClientEmail(target.clientEmail || '');
      setInviteClientPhone(target.clientPhone || '');
    }
    setInviteError(null);
    setIsInviteModalOpen(true);
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInvitations) {
      setInviteError(
        '403 Forbidden: Only authorized chamber staff (Owner, Senior Advocate, or Associate) can issue client invitations.'
      );
      return;
    }

    const targetCase = cases.find((c) => c.id === inviteCaseId);
    if (!targetCase || !chamberId) {
      setInviteError('Please select a valid matter belonging to this workspace.');
      return;
    }

    const cleanEmail = inviteClientEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('Please enter a valid intended recipient email address.');
      return;
    }

    setIsSubmittingInvite(true);
    setInviteError(null);
    setActionBanner(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const appOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost:3000';

      let createdInvite: PersistedClientInvitation | null = null;
      let generatedUrl = '';
      let emailSent = false;

      if (accessToken) {
        const res = await fetch('/api/client-portal/invitations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            chamberId,
            workspaceId: chamberId,
            matterId: targetCase.id,
            clientEmail: cleanEmail,
            clientName: inviteClientName.trim() || targetCase.clientName || 'Client',
            clientPhone: inviteClientPhone.trim() || null,
            scopes: invitePermissions,
            expiresInDays: inviteExpiryDays,
            origin: appOrigin,
          }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to create client invitation.');
        }

        const invRow = body.invitation || {};
        generatedUrl = body.inviteUrl || '';
        emailSent = Boolean(body.emailSent);

        createdInvite = {
          id: invRow.id,
          workspaceId: invRow.workspace_id || chamberId,
          matterId: invRow.matter_id || targetCase.id,
          matterTitle: targetCase.title,
          clientEmail: invRow.client_email || cleanEmail,
          clientName: invRow.client_name || inviteClientName.trim() || 'Client',
          clientPhone: invRow.client_phone || null,
          scopes: invRow.scopes || invitePermissions,
          expiresAt: invRow.expires_at,
          createdByUserId: invRow.created_by_user_id || null,
          status: 'Active',
          deliveryStatus: emailSent ? 'email_sent' : 'email_not_sent',
          createdAt: invRow.created_at || new Date().toISOString(),
          transientInviteUrl: generatedUrl,
        };
      } else {
        const result = await createClientInvitationInDb(
          {
            workspaceId: chamberId,
            matterId: targetCase.id,
            clientEmail: cleanEmail,
            clientName: inviteClientName.trim() || targetCase.clientName || 'Client',
            clientPhone: inviteClientPhone.trim() || null,
            scopes: invitePermissions,
            expiresInDays: inviteExpiryDays,
            origin: appOrigin,
          },
          cases
        );
        createdInvite = result.invitation;
        generatedUrl = result.inviteUrl;
        emailSent = result.emailSent;
      }

      if (createdInvite) {
        setInvitations((prev) => [createdInvite!, ...prev.filter((i) => i.id !== createdInvite!.id)]);
      }

      setIsInviteModalOpen(false);
      setActionBanner({
        type: emailSent ? 'info' : 'warning',
        message: emailSent
          ? `Invitation created for ${cleanEmail}.`
          : `Email not sent — email delivery is not configured for this workspace. Use "Copy Link" below to share the redemption link manually with ${cleanEmail}.`,
        inviteUrl: generatedUrl,
        deliveryStatus: emailSent ? 'email_sent' : 'email_not_sent',
      });
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to create client invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleCopyInviteLink = (id: string, url?: string) => {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedInviteId(id);
    setTimeout(() => setCopiedInviteId(null), 2500);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!chamberId || !canManageInvitations) return;
    setRevokingInviteId(invitationId);
    setInviteError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (accessToken) {
        const res = await fetch(
          `/api/client-portal/invitations/${encodeURIComponent(invitationId)}/revoke`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              chamberId,
              workspaceId: chamberId,
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to revoke client access.');
        }
      } else {
        await revokeClientInvitationInDb(chamberId, invitationId);
      }

      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId
            ? {
                ...inv,
                status: 'Revoked',
                revokedAt: new Date().toISOString(),
                transientInviteUrl: undefined,
              }
            : inv
        )
      );
      setActionBanner({
        type: 'info',
        message:
          'Client invitation and any associated portal access grant have been revoked immediately.',
      });
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to revoke client invitation.');
    } finally {
      setRevokingInviteId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Staff Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Staff Client Directory &amp; Portal Access Control
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Chamber Staff View
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage your chamber&apos;s internal client directory and issue Matter-Scoped, SHA-256 hashed invitations for the separate Restricted Client Portal (<code>/portal/redeem</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {canManageInvitations ? (
            <button
              onClick={() => handleOpenInviteModal()}
              disabled={cases.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Issue Client Portal Invitation
            </button>
          ) : (
            <span className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-xl text-xs font-medium border border-slate-700">
              Only Owner / Senior Advocate / Associate can issue invitations
            </span>
          )}
        </div>
      </div>

      {/* Action / Delivery Honesty Banner */}
      {actionBanner && (
        <div
          className={`rounded-2xl p-5 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            actionBanner.deliveryStatus === 'email_not_sent'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                actionBanner.deliveryStatus === 'email_not_sent'
                  ? 'text-amber-600'
                  : 'text-indigo-600'
              }`}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {actionBanner.deliveryStatus === 'email_not_sent'
                    ? 'Email not sent'
                    : 'Portal Access Update'}
                </span>
                {actionBanner.deliveryStatus === 'email_not_sent' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/70 text-amber-900">
                    Email not sent
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed">{actionBanner.message}</p>
              {actionBanner.inviteUrl && (
                <p className="text-[11px] font-mono text-slate-600 break-all pt-1">
                  {actionBanner.inviteUrl}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actionBanner.inviteUrl && (
              <button
                onClick={() => handleCopyInviteLink('banner-link', actionBanner.inviteUrl)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {copiedInviteId === 'banner-link' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Link Copied (Email not sent)
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setActionBanner(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {inviteError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-700 flex items-center justify-between">
          <span>{inviteError}</span>
          <button onClick={() => setInviteError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Staff Internal Client Directory */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Chamber Staff Client Directory ({Math.max(cases.length, dbClients.length)})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Internal staff directory of clients across active workspace matters. Restricted portal users cannot view this directory.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-6">Client Name</th>
                <th className="py-3.5 px-6">Matter / Case Title</th>
                <th className="py-3.5 px-6">Court &amp; Stage</th>
                <th className="py-3.5 px-6">Next Hearing</th>
                <th className="py-3.5 px-6 text-right">Restricted Portal Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No matters registered in this workspace yet. Create a matter first before issuing a client portal invitation.
                  </td>
                </tr>
              ) : (
                cases.map((c) => {
                  const activeInv = invitations.find(
                    (inv) =>
                      inv.matterId === c.id &&
                      (inv.status === 'Active' || inv.status === 'Redeemed')
                  );
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{c.clientName}</div>
                        <div className="text-xs text-slate-500">
                          {c.clientEmail || c.clientPhone || 'No email recorded on matter'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{c.title}</div>
                        <div className="text-xs font-mono text-slate-500">
                          {c.caseNumber || 'Unregistered'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-xs font-medium text-slate-700">{c.courtName}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                          {c.stage}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        {c.nextHearingDate || 'TBA'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {activeInv && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                activeInv.status === 'Redeemed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {activeInv.status === 'Redeemed'
                                ? 'Grant Active (Redeemed)'
                                : 'Invite Pending (Email not sent)'}
                            </span>
                          )}
                          {canManageInvitations && (
                            <button
                              onClick={() => handleOpenInviteModal(c)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Invite Client
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Persisted Client Invitations & Active Grants Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Persisted Client Portal Invitations &amp; Grants ({invitations.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Only SHA-256 token hashes are stored in PostgreSQL. Revoking an invitation immediately invalidates both the link and any redeemed client access grant.
            </p>
          </div>
          <button
            onClick={loadWorkspaceInvitations}
            disabled={loadingInvitations}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInvitations ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-6">Intended Recipient</th>
                <th className="py-3.5 px-6">Matter Scope</th>
                <th className="py-3.5 px-6">Permitted Data Scopes</th>
                <th className="py-3.5 px-6">Expiry &amp; Delivery</th>
                <th className="py-3.5 px-6">Grant Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No client invitations have been issued in this workspace.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{inv.clientName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {inv.clientEmail}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800 text-xs">{inv.matterTitle}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Matter ID: {inv.matterId.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {inv.scopes.viewHearings && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            Hearings
                          </span>
                        )}
                        {inv.scopes.viewFilings && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            Filings
                          </span>
                        )}
                        {inv.scopes.viewBilling && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            Billing
                          </span>
                        )}
                        {inv.scopes.uploadDocs && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                            Upload Docs
                          </span>
                        )}
                        {inv.scopes.chatAi && (
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">
                            Status Q&amp;A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-mono text-slate-600">
                        Expires: {String(inv.expiresAt).split('T')[0]}
                      </div>
                      <div className="mt-1">
                        {inv.deliveryStatus === 'email_sent' ? (
                          <span className="text-[10px] font-bold text-emerald-700">
                            Email sent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Email not sent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === 'Redeemed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.status === 'Active'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : inv.status === 'Expired'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.redeemedAt && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Redeemed {String(inv.redeemedAt).split('T')[0]}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.transientInviteUrl && inv.status === 'Active' && (
                          <button
                            onClick={() => handleCopyInviteLink(inv.id, inv.transientInviteUrl)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            title="Copy one-time redemption link (Email not sent)"
                          >
                            {copiedInviteId === inv.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Link Copied (Email not sent)
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Link
                              </>
                            )}
                          </button>
                        )}
                        {canManageInvitations && inv.status !== 'Revoked' && (
                          <button
                            onClick={() => handleRevokeInvitation(inv.id)}
                            disabled={revokingInviteId === inv.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {inv.status === 'Redeemed' ? 'Revoke Grant' : 'Revoke Invite'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Client Invitation Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Issue Client Portal Invitation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generates a 256-bit cryptographic token and stores only its SHA-256 hash.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Workspace Matter
                </label>
                <select
                  value={inviteCaseId}
                  onChange={(e) => {
                    setInviteCaseId(e.target.value);
                    const found = cases.find((c) => c.id === e.target.value);
                    if (found) {
                      setInviteClientName(found.clientName || '');
                      if (found.clientEmail) setInviteClientEmail(found.clientEmail);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Client Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteClientName}
                    onChange={(e) => setInviteClientName(e.target.value)}
                    placeholder="e.g., Ramesh Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Verified Recipient Email
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteClientEmail}
                    onChange={(e) => setInviteClientEmail(e.target.value)}
                    placeholder="client@company.in"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteClientPhone}
                    onChange={(e) => setInviteClientPhone(e.target.value)}
                    placeholder="+91 98201 11223"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Invitation &amp; Grant Expiry
                  </label>
                  <select
                    value={inviteExpiryDays}
                    onChange={(e) => setInviteExpiryDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Explicitly Permitted Client Scopes (Internal Findings &amp; Private Drafts Always Excluded)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  {[
                    { key: 'viewHearings', label: 'View Hearing Dates & Chronology' },
                    { key: 'viewFilings', label: 'View Shared Filings & Orders' },
                    { key: 'viewBilling', label: 'View Matter Invoices & Billing' },
                    { key: 'uploadDocs', label: 'Upload Supporting Documents' },
                    { key: 'chatAi', label: 'Use Client Matter Status Q&A' },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(invitePermissions as any)[perm.key]}
                        onChange={(e) =>
                          setInvitePermissions((prev) => ({
                            ...prev,
                            [perm.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {isSubmittingInvite ? 'Generating Secure Link...' : 'Create Invitation Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RESTRICTED CLIENT-FACING PORTAL & INVITATION REDEMPTION ROUTE (/portal/redeem & /portal/access)
// ============================================================================

interface RestrictedClientPortalProps {
  initialToken?: string | null;
  currentUserEmail?: string | null;
  currentUserId?: string | null;
}

export const RestrictedClientPortal: React.FC<RestrictedClientPortalProps> = ({
  initialToken,
  currentUserEmail,
  currentUserId,
}) => {
  const [token, setToken] = useState<string>(() => {
    if (initialToken && initialToken.trim()) return initialToken.trim();
    if (typeof window !== 'undefined') {
      const urlToken = new URLSearchParams(window.location.search).get('token');
      if (urlToken && urlToken.trim()) return urlToken.trim();
    }
    return peekPendingPortalInviteToken() || '';
  });

  const [redemptionState, setRedemptionState] = useState<
    'idle' | 'authenticating' | 'redeeming' | 'redeemed' | 'error'
  >('idle');
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [portalView, setPortalView] = useState<RestrictedClientPortalMatterView | null>(null);
  const [activeGrants, setActiveGrants] = useState<
    Array<{
      id: string;
      workspaceId: string;
      matterId: string;
      clientEmail: string;
      clientName: string;
      scopes: ClientInvitationScopes;
      grantedAt: string;
      expiresAt?: string | null;
    }>
  >([]);
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'filings' | 'billing' | 'qa'>('overview');

  // Client Q&A and Document Upload States
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'client' | 'ai'; text: string }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Preserve token in storage so Google OAuth redirect returns safely
  useEffect(() => {
    if (token && token.length >= 32) {
      savePendingPortalInviteToken(token);
    }
  }, [token]);

  const loadMatterView = useCallback(async (matterId: string) => {
    if (!matterId) return;
    setRedemptionError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (accessToken) {
        const res = await fetch(
          `/api/client-portal/matters/${encodeURIComponent(matterId)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || '403 Forbidden: Access to this matter is not permitted.');
        }
        setPortalView(body as RestrictedClientPortalMatterView);
        setRedemptionState('redeemed');
        return;
      }

      const viewData = await getRestrictedClientPortalMatterInDb(matterId);
      setPortalView(viewData);
      setRedemptionState('redeemed');
    } catch (err: any) {
      setPortalView(null);
      setRedemptionState('error');
      setRedemptionError(
        err?.message || 'Access denied: Your client portal grant has expired or been revoked.'
      );
    }
  }, []);

  // Automatically redeem invitation once authenticated, or load existing active grants
  useEffect(() => {
    let cancelled = false;

    const executeFlow = async () => {
      if (!currentUserId) {
        setRedemptionState('authenticating');
        return;
      }

      if (token && token.length >= 32) {
        setRedemptionState('redeeming');
        setRedemptionError(null);
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          let redeemedMatterId = '';

          if (accessToken) {
            const res = await fetch('/api/client-portal/redeem', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ token }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(body?.error || 'Invitation redemption failed.');
            }
            redeemedMatterId = body.grant?.matter_id || body.grant?.matterId || '';
          } else {
            const grant = await redeemClientInvitationInDb(token);
            redeemedMatterId = grant.matterId;
          }

          if (cancelled) return;

          // Clear pending token from storage and remove raw token from URL bar
          clearPendingPortalInviteToken();
          setToken('');
          if (typeof window !== 'undefined' && window.location.search.includes('token=')) {
            window.history.replaceState({}, '', '/portal/access');
          }

          const grants = await listActiveClientGrantsForUser();
          if (!cancelled) {
            setActiveGrants(grants);
            const targetId = redeemedMatterId || grants[0]?.matterId || '';
            setSelectedMatterId(targetId);
            if (targetId) {
              await loadMatterView(targetId);
            }
          }
        } catch (err: any) {
          if (!cancelled) {
            setRedemptionState('error');
            setRedemptionError(err?.message || 'Failed to redeem client portal invitation.');
          }
        }
        return;
      }

      // No pending token: check if authenticated user already holds active client_access_grants
      try {
        const grants = await listActiveClientGrantsForUser();
        if (cancelled) return;
        setActiveGrants(grants);
        if (grants.length > 0) {
          const targetId = selectedMatterId || grants[0].matterId;
          setSelectedMatterId(targetId);
          await loadMatterView(targetId);
        } else {
          setRedemptionState('error');
          setRedemptionError(
            'No active client portal access grants found for your account. Please open a valid invitation link from your legal chamber.'
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setRedemptionState('error');
          setRedemptionError(err?.message || 'Unable to load client portal grants.');
        }
      }
    };

    executeFlow();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, token, loadMatterView, selectedMatterId]);

  const handleGoogleSignInForRedemption = async () => {
    if (token) {
      savePendingPortalInviteToken(token);
    }
    await signInWithGoogle({ pendingInviteToken: token || undefined });
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !portalView?.matter?.id || !portalView.grant.scopes.chatAi) return;
    const q = question.trim();
    setQuestion('');
    setChatHistory((prev) => [...prev, { role: 'client', text: q }]);
    setIsAsking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken) {
        const res = await fetch(
          `/api/client-portal/matters/${encodeURIComponent(portalView.matter.id)}/chat`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ question: q }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || 'AI Q&A is not permitted.');
        }
        setChatHistory((prev) => [...prev, { role: 'ai', text: body.answer }]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'ai', text: err?.message || 'Unable to answer status question.' },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleClientDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalView || !portalView.grant.scopes.uploadDocs || !uploadTitle.trim()) return;
    setUploadStatus('Uploading...');
    try {
      const bytes = new TextEncoder().encode(uploadContent || `Client uploaded: ${uploadTitle}`);
      await uploadDocumentToStorageAndDb({
        workspaceId: portalView.grant.workspace_id,
        matterId: portalView.matter.id,
        fileName: uploadTitle.trim().endsWith('.txt')
          ? uploadTitle.trim()
          : `${uploadTitle.trim()}.txt`,
        fileBytes: bytes,
        fileSize: bytes.byteLength,
        mimeType: 'text/plain',
        docType: 'Client Upload',
        changesSummary: 'Uploaded by Client via Restricted Portal',
        extractedText: uploadContent || null,
      });
      setUploadTitle('');
      setUploadContent('');
      setIsUploadModalOpen(false);
      setUploadStatus(null);
      await loadMatterView(portalView.matter.id);
    } catch (err: any) {
      setUploadStatus(err?.message || 'Upload failed.');
    }
  };

  // 1. Unauthenticated Recipient Sign-In Prompt
  if (!currentUserId || redemptionState === 'authenticating') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Restricted Client Portal
            </span>
            <h1 className="text-2xl font-bold mt-3">Verify Recipient Identity</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Client portal invitations are bound to the intended recipient&apos;s verified email address. Please sign in with the email address that received this invitation. Your pending invitation will be preserved automatically across sign-in.
            </p>
          </div>

          <button
            onClick={handleGoogleSignInForRedemption}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            Sign In with Verified Email to Redeem
          </button>
        </div>
      </div>
    );
  }

  // 2. Redeeming Loading State
  if (redemptionState === 'redeeming') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <h2 className="text-lg font-bold">Verifying Invitation &amp; Granting Scoped Access...</h2>
          <p className="text-xs text-slate-400">
            Validating SHA-256 token digest, expiry, and recipient email match ({currentUserEmail}).
          </p>
        </div>
      </div>
    );
  }

  // 3. Denied / Wrong Recipient / Expired / Revoked State
  if (redemptionState === 'error' || !portalView) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
              Client Portal Access Denied
            </span>
            <h1 className="text-xl font-bold mt-3">Unable to Access Restricted Matter Portal</h1>
            <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 rounded-xl p-3.5 mt-3 font-medium">
              {redemptionError || 'Access denied: Invalid, expired, or revoked client portal grant.'}
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Signed in as: <strong className="text-slate-200">{currentUserEmail}</strong>
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { grant, matter, hearings, timeline, documents, invoices } = portalView;
  const scopes = grant.scopes;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Restricted Client Header */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Client Access Grant
                </span>
                <span className="text-xs text-slate-400">{grant.workspace_name}</span>
              </div>
              <h1 className="text-xl font-bold mt-1">{matter.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Recipient: {grant.client_email} • Case No: {matter.case_number || 'Pending'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeGrants.length > 1 && (
              <select
                value={matter.id}
                onChange={(e) => {
                  setSelectedMatterId(e.target.value);
                  loadMatterView(e.target.value);
                }}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-semibold"
              >
                {activeGrants.map((g) => (
                  <option key={g.id} value={g.matterId}>
                    Matter {g.matterId.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs Restricted by Granted Scopes */}
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Matter Status &amp; Hearings
          </button>
          {scopes.viewFilings && (
            <button
              onClick={() => setActiveTab('filings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'filings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Shared Filings ({documents.length})
            </button>
          )}
          {scopes.viewBilling && (
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Invoices &amp; Billing ({invoices.length})
            </button>
          )}
          {scopes.chatAi && (
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'qa'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Status Q&amp;A
            </button>
          )}
        </div>

        {/* Tab 1: Overview & Hearings */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Current Stage
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {matter.stage || matter.status || 'Active'}
                </div>
                <div className="text-xs text-slate-500 mt-1">{matter.court_name}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Next Listed Hearing
                </div>
                <div className="text-lg font-bold text-indigo-600 mt-1">
                  { scopes.viewHearings
                    ? matter.next_hearing_date || 'Yet to be listed'
                    : 'Scope not enabled' }
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {matter.judge_name || 'Presiding Bench'}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Grant Expiry
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {grant.expires_at ? String(grant.expires_at).split('T')[0] : 'Active'}
                </div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">
                  Internal findings &amp; private drafts hidden
                </div>
              </div>
            </div>

            {scopes.viewHearings ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Hearing Schedule &amp; Matter Chronology
                </h2>
                {hearings.length === 0 && timeline.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No hearings or chronology events recorded for this matter yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {hearings.map((h) => (
                      <div
                        key={h.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {h.purpose || 'Court Hearing'}
                          </div>
                          {h.outcome_notes && (
                            <div className="text-xs text-slate-600 mt-0.5">{h.outcome_notes}</div>
                          )}
                        </div>
                        <div className="text-xs font-mono font-bold text-indigo-600">
                          {h.hearing_date}
                        </div>
                      </div>
                    ))}
                    {timeline.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{t.title}</div>
                          {t.description && (
                            <div className="text-xs text-slate-600 mt-0.5">{t.description}</div>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500">{t.event_date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs text-slate-500">
                Hearing chronology is not enabled on your client access grant.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Shared Filings */}
        {activeTab === 'filings' && scopes.viewFilings && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Shared Matter Filings &amp; Orders
                </h2>
                <p className="text-xs text-slate-500">
                  Private advocate drafts and internal fact findings are never accessible in the client portal.
                </p>
              </div>
              {scopes.uploadDocs && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Document
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">
                No filings have been shared on this matter yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((d) => (
                  <div key={d.id} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="text-sm font-bold text-slate-900">{d.name}</div>
                        <div className="text-xs text-slate-500">
                          {d.doc_type || 'Document'} • v{d.current_version || 1}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {d.created_at ? String(d.created_at).split('T')[0] : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Billing */}
        {activeTab === 'billing' && scopes.viewBilling && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Matter Invoices &amp; Statements</h2>
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">
                No invoices have been issued for this matter yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <div key={inv.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{inv.invoice_number}</div>
                      <div className="text-xs text-slate-500">
                        Issued: {inv.issue_date} {inv.due_date ? `• Due: ${inv.due_date}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Status Q&A */}
        {activeTab === 'qa' && scopes.chatAi && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Client Matter Status Q&amp;A</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Ask a question about your matter&apos;s current stage or next listed hearing date.
                </p>
              ) : (
                chatHistory.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl text-xs ${
                      m.role === 'client'
                        ? 'bg-indigo-600 text-white ml-auto max-w-md'
                        : 'bg-white border border-slate-200 text-slate-800 max-w-lg'
                    }`}
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your next hearing date..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
              <button
                type="submit"
                disabled={isAsking}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Client Document Upload Modal */}
        {isUploadModalOpen && scopes.uploadDocs && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Upload Supporting Document</h3>
                <button onClick={() => setIsUploadModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleClientDocumentUpload} className="space-y-3">
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title (e.g., Certified Receipt)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                <textarea
                  rows={4}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Paste document text or notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                {uploadStatus && <p className="text-xs text-slate-600">{uploadStatus}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                  >
                    Submit Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
