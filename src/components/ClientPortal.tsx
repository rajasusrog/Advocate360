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
    <div className="space-y-6 text-[#0B1426]">
      {/* Staff Header */}
      <div className="bg-[#0B1426] text-white rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs border border-[#16233D]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#C49A36] shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Staff Client Directory &amp; Portal Access Control
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-[#C49A36]/20 text-[#C49A36] border border-[#C49A36]/40">
                Chamber Staff View
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Manage your chamber&apos;s internal client directory and issue matter-scoped invitations for the separate Restricted Client Portal (<code className="text-[#C49A36]">/portal/redeem</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {canManageInvitations ? (
            <button
              type="button"
              onClick={() => handleOpenInviteModal()}
              disabled={cases.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#C49A36] hover:bg-[#D4AA46] disabled:opacity-50 text-[#0B1426] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite client</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 bg-white/10 text-slate-200 rounded-lg text-xs font-medium border border-white/15">
              Only Owner / Senior Advocate / Associate can issue invitations
            </span>
          )}
        </div>
      </div>

      {/* Action / Delivery Honesty Banner */}
      {actionBanner && (
        <div
          className={`rounded-xl p-5 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            actionBanner.deliveryStatus === 'email_not_sent'
              ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#0B1426]'
              : 'bg-white border-[#E2DFD7] text-[#0B1426]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                actionBanner.deliveryStatus === 'email_not_sent'
                  ? 'text-[#B45309]'
                  : 'text-[#C49A36]'
              }`}
            />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {actionBanner.deliveryStatus === 'email_not_sent'
                    ? 'Email not sent'
                    : 'Portal Access Update'}
                </span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">{actionBanner.message}</p>
              {actionBanner.inviteUrl && (
                <p className="text-[11px] font-mono text-[#475569] break-all pt-1">
                  {actionBanner.inviteUrl}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actionBanner.inviteUrl && (
              <button
                type="button"
                onClick={() => handleCopyInviteLink('banner-link', actionBanner.inviteUrl)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedInviteId === 'banner-link' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#C49A36]" />
                    <span>Link Copied (Email not sent)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#C49A36]" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="p-1.5 text-[#64748B] hover:text-[#0B1426] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {inviteError && (
        <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-4 text-xs font-medium text-[#B91C1C] flex items-center justify-between">
          <span>{inviteError}</span>
          <button
            type="button"
            onClick={() => setInviteError(null)}
            className="text-[#B91C1C] hover:text-[#7F1D1D] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Staff Internal Client Directory */}
      <div className="bg-white rounded-xl border border-[#E2DFD7] shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E2DFD7] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0B1426]">
              Chamber Staff Client Directory ({Math.max(cases.length, dbClients.length)})
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Internal staff directory of clients across active workspace matters. Restricted portal users cannot view this directory.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2DFD7] text-[11px] font-semibold text-[#475569] uppercase tracking-wider bg-[#F6F5F1]">
                <th className="py-3 px-6">Client Name</th>
                <th className="py-3 px-6">Matter / Case Title</th>
                <th className="py-3 px-6">Court &amp; Stage</th>
                <th className="py-3 px-6">Next Hearing</th>
                <th className="py-3 px-6 text-right">Restricted Portal Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4] text-sm">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#64748B]">
                    No matters registered in this workspace yet. Add a matter first before issuing a client portal invitation.
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
                    <tr key={c.id} className="hover:bg-[#F6F5F1]/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-[#0B1426]">{c.clientName}</div>
                        <div className="text-xs text-[#64748B]">
                          {c.clientEmail || c.clientPhone || 'No email recorded on matter'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-[#0B1426]">{c.title}</div>
                        <div className="text-xs font-mono text-[#64748B]">
                          {c.caseNumber || 'Unregistered'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-xs font-medium text-[#475569]">{c.courtName}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#0B1426]/5 text-[#0B1426] border border-[#0B1426]/15 font-semibold text-[10px]">
                          {c.stage}
                        </span>
                      </td>
                      <td className="py-4 px-6 u360-table-numeric text-xs text-[#475569]">
                        {c.nextHearingDate || 'Not scheduled'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {activeInv && (
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                                activeInv.status === 'Redeemed'
                                  ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                                  : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                              }`}
                            >
                              {activeInv.status === 'Redeemed'
                                ? 'Grant Active'
                                : 'Invite Pending (Email not sent)'}
                            </span>
                          )}
                          {canManageInvitations && (
                            <button
                              type="button"
                              onClick={() => handleOpenInviteModal(c)}
                              className="px-3 py-1.5 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Invite client
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
      <div className="bg-white rounded-xl border border-[#E2DFD7] shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E2DFD7] flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#C49A36]" />
              <h2 className="text-base font-bold text-[#0B1426]">
                Persisted Client Portal Invitations &amp; Grants ({invitations.length})
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Only SHA-256 token hashes are stored in PostgreSQL. Revoking an invitation immediately invalidates both the link and any active access grant.
            </p>
          </div>
          <button
            type="button"
            onClick={loadWorkspaceInvitations}
            disabled={loadingInvitations}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] text-[#0B1426] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInvitations ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2DFD7] text-[11px] font-semibold text-[#475569] uppercase tracking-wider bg-[#F6F5F1]">
                <th className="py-3 px-6">Intended Recipient</th>
                <th className="py-3 px-6">Matter Scope</th>
                <th className="py-3 px-6">Permitted Scopes</th>
                <th className="py-3 px-6">Expiry &amp; Delivery</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4] text-sm">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                    No client invitations have been issued in this workspace yet.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F6F5F1]/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-[#0B1426]">{inv.clientName}</div>
                      <div className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{inv.clientEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-[#0B1426] text-xs">{inv.matterTitle}</div>
                      <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                        {inv.matterId.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {inv.scopes.viewHearings && (
                          <span className="px-2 py-0.5 rounded bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426] text-[10px] font-medium">
                            Hearings
                          </span>
                        )}
                        {inv.scopes.viewFilings && (
                          <span className="px-2 py-0.5 rounded bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426] text-[10px] font-medium">
                            Filings
                          </span>
                        )}
                        {inv.scopes.viewBilling && (
                          <span className="px-2 py-0.5 rounded bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426] text-[10px] font-medium">
                            Billing
                          </span>
                        )}
                        {inv.scopes.uploadDocs && (
                          <span className="px-2 py-0.5 rounded bg-[#C49A36]/15 border border-[#C49A36]/40 text-[#0B1426] text-[10px] font-medium">
                            Upload Docs
                          </span>
                        )}
                        {inv.scopes.chatAi && (
                          <span className="px-2 py-0.5 rounded bg-[#0B1426]/5 border border-[#0B1426]/15 text-[#0B1426] text-[10px] font-medium">
                            Status Q&amp;A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs u360-table-numeric text-[#475569]">
                        Expires: {String(inv.expiresAt).split('T')[0]}
                      </div>
                      <div className="mt-1">
                        {inv.deliveryStatus === 'email_sent' ? (
                          <span className="text-[11px] font-semibold text-[#15803D]">
                            Email sent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-[10px] font-semibold">
                            Email not sent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          inv.status === 'Redeemed'
                            ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                            : inv.status === 'Active'
                              ? 'bg-[#0B1426]/5 text-[#0B1426] border border-[#0B1426]/20'
                              : inv.status === 'Expired'
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.redeemedAt && (
                        <div className="text-[11px] text-[#64748B] mt-1">
                          Redeemed {String(inv.redeemedAt).split('T')[0]}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.transientInviteUrl && inv.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => handleCopyInviteLink(inv.id, inv.transientInviteUrl)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] text-[#0B1426] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            {copiedInviteId === inv.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#15803D]" />
                                <span>Link Copied (Email not sent)</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#C49A36]" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        )}
                        {canManageInvitations && inv.status !== 'Revoked' && (
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            disabled={revokingInviteId === inv.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{inv.status === 'Redeemed' ? 'Revoke Grant' : 'Revoke Invite'}</span>
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
        <div className="fixed inset-0 bg-[#0B1426]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2DFD7]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2DFD7]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0B1426] text-[#C49A36] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1426]">Invite client to portal</h3>
                  <p className="text-xs text-[#64748B]">
                    Generates a 256-bit cryptographic token and stores only its SHA-256 hash.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#0B1426] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvitation} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0B1426] mb-1">
                  Matter
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
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
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
                  <label className="block text-xs font-semibold text-[#0B1426] mb-1">
                    Client full name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteClientName}
                    onChange={(e) => setInviteClientName(e.target.value)}
                    placeholder="Client full name"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1426] mb-1">
                    Verified recipient email
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteClientEmail}
                    onChange={(e) => setInviteClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1426] mb-1">
                    Phone number (optional)
                  </label>
                  <input
                    type="text"
                    value={inviteClientPhone}
                    onChange={(e) => setInviteClientPhone(e.target.value)}
                    placeholder="+91 98400 00000"
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:border-[#0B1426]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1426] mb-1">
                    Invitation &amp; grant expiry
                  </label>
                  <select
                    value={inviteExpiryDays}
                    onChange={(e) => setInviteExpiryDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426]"
                  >
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B1426] mb-2">
                  Permitted client scopes (internal findings and private drafts remain excluded)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#F6F5F1] p-3.5 rounded-xl border border-[#E2DFD7]">
                  {[
                    { key: 'viewHearings', label: 'View hearing dates & schedule' },
                    { key: 'viewFilings', label: 'View shared filings & orders' },
                    { key: 'viewBilling', label: 'View matter invoices' },
                    { key: 'uploadDocs', label: 'Upload supporting documents' },
                    { key: 'chatAi', label: 'Use client status Q&A' },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 text-xs font-medium text-[#0B1426] cursor-pointer"
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
                        className="accent-[#0B1426]"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E2DFD7]">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#C49A36]" />
                  <span>{isSubmittingInvite ? 'Creating link...' : 'Create invitation link'}</span>
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
      <div className="min-h-screen bg-[#F6F5F1] text-[#0B1426] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E2DFD7] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] p-1 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png"
                alt="UNIKORN360 emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-base text-[#0B1426] block leading-tight">
                Advocate360
              </span>
              <span className="text-[11px] font-medium text-[#C49A36] block leading-tight">
                Client Matter Portal
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#0B1426]/5 text-[#0B1426] border border-[#0B1426]/15">
              Verified Access Required
            </span>
            <h1 className="text-xl font-bold text-[#0B1426]">Sign in to view your matter</h1>
            <p className="text-xs text-[#475569] leading-relaxed">
              This portal is restricted to the invited recipient&apos;s verified email address. Your pending invitation link is preserved automatically during sign-in.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignInForRedemption}
            className="w-full py-3 px-4 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Redeeming Loading State
  if (redemptionState === 'redeeming') {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#0B1426] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E2DFD7] rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <RefreshCw className="w-7 h-7 text-[#C49A36] animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-[#0B1426]">Verifying client invitation</h2>
          <p className="text-xs text-[#64748B]">
            Checking invitation expiry and recipient email ({currentUserEmail}).
          </p>
        </div>
      </div>
    );
  }

  // 3. Denied / Wrong Recipient / Expired / Revoked State
  if (redemptionState === 'error' || !portalView) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#0B1426] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-[#E2DFD7] rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#B91C1C]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B91C1C] block">
                Client Portal Access Denied
              </span>
              <h1 className="text-lg font-bold text-[#0B1426]">
                Unable to open client portal
              </h1>
            </div>
          </div>

          <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3.5 font-medium leading-relaxed">
            {redemptionError || 'Access denied: Invalid, expired, or revoked client portal link.'}
          </p>

          <p className="text-xs text-[#64748B]">
            Signed in as: <strong className="text-[#0B1426]">{currentUserEmail}</strong>
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#C49A36]" />
              <span>Sign out / Switch account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { grant, matter, hearings, timeline, documents, invoices } = portalView;
  const scopes = grant.scopes;

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#0B1426]">
      {/* Standalone Client Portal Top Bar (Zero Advocate Sidebar / Controls) */}
      <header className="bg-white border-b border-[#E2DFD7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#F6F5F1] border border-[#E2DFD7] p-1 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/ChatGPT_Image_Oct_29__2026__07_20_38_PM_11dd3e23.png"
                alt="UNIKORN360 emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base text-[#0B1426] block leading-tight truncate">
                Advocate360 Client Portal
              </span>
              <span className="text-[11px] text-[#64748B] block leading-tight truncate">
                {grant.workspace_name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeGrants.length > 1 && (
              <select
                value={matter.id}
                onChange={(e) => {
                  setSelectedMatterId(e.target.value);
                  loadMatterView(e.target.value);
                }}
                className="px-3 py-1.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg text-xs text-[#0B1426] font-medium"
              >
                {activeGrants.map((g) => (
                  <option key={g.id} value={g.matterId}>
                    Matter {g.matterId.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F5F1] hover:bg-[#EFECE4] border border-[#E2DFD7] text-[#0B1426] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Matter Identity Card */}
        <div className="bg-[#0B1426] text-white rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#C49A36]/20 text-[#C49A36] border border-[#C49A36]/40">
                Verified Client Access
              </span>
              <span className="text-xs text-slate-300 truncate">{grant.client_email}</span>
            </div>
            <h1 className="text-xl font-bold text-white break-words">{matter.title}</h1>
            <p className="text-xs text-slate-300">
              Case Reference: {matter.case_number || 'Pending assignment'} • {matter.court_name}
            </p>
          </div>
        </div>

        {/* Navigation Tabs Restricted by Granted Scopes */}
        <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-[#E2DFD7] shadow-2xs w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#0B1426] text-white'
                : 'text-[#475569] hover:bg-[#F6F5F1] hover:text-[#0B1426]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#C49A36]" />
            <span>Status &amp; Hearings</span>
          </button>
          {scopes.viewFilings && (
            <button
              type="button"
              onClick={() => setActiveTab('filings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'filings'
                  ? 'bg-[#0B1426] text-white'
                  : 'text-[#475569] hover:bg-[#F6F5F1] hover:text-[#0B1426]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#C49A36]" />
              <span>Shared Filings ({documents.length})</span>
            </button>
          )}
          {scopes.viewBilling && (
            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-[#0B1426] text-white'
                  : 'text-[#475569] hover:bg-[#F6F5F1] hover:text-[#0B1426]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#C49A36]" />
              <span>Billing ({invoices.length})</span>
            </button>
          )}
          {scopes.chatAi && (
            <button
              type="button"
              onClick={() => setActiveTab('qa')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'qa'
                  ? 'bg-[#0B1426] text-white'
                  : 'text-[#475569] hover:bg-[#F6F5F1] hover:text-[#0B1426]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C49A36]" />
              <span>Status Q&amp;A</span>
            </button>
          )}
        </div>

        {/* Tab 1: Overview & Hearings */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD7] shadow-2xs">
                <div className="text-[11px] font-medium text-[#64748B]">Current stage</div>
                <div className="text-lg font-bold text-[#0B1426] mt-1">
                  {matter.stage || matter.status || 'Active'}
                </div>
                <div className="text-xs text-[#64748B] mt-1">{matter.court_name}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD7] shadow-2xs">
                <div className="text-[11px] font-medium text-[#64748B]">Next listed hearing</div>
                <div className="text-lg font-bold text-[#0B1426] u360-table-numeric mt-1">
                  {scopes.viewHearings
                    ? matter.next_hearing_date || 'Yet to be listed'
                    : 'Not permitted'}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {matter.judge_name || 'Presiding Bench'}
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2DFD7] shadow-2xs">
                <div className="text-[11px] font-medium text-[#64748B]">Grant expiry</div>
                <div className="text-lg font-bold text-[#0B1426] u360-table-numeric mt-1">
                  {grant.expires_at ? String(grant.expires_at).split('T')[0] : 'Active'}
                </div>
                <div className="text-xs text-[#15803D] font-medium mt-1">
                  Internal notes &amp; private drafts hidden
                </div>
              </div>
            </div>

            {scopes.viewHearings ? (
              <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 shadow-2xs space-y-4">
                <h2 className="text-sm font-bold text-[#0B1426]">
                  Hearing Schedule &amp; Chronology
                </h2>
                {hearings.length === 0 && timeline.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No hearings or chronology events recorded for this matter yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {hearings.map((h) => (
                      <div
                        key={h.id}
                        className="p-4 rounded-xl bg-[#F6F5F1] border border-[#E2DFD7] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#0B1426]">
                            {h.purpose || 'Court Hearing'}
                          </div>
                          {h.outcome_notes && (
                            <div className="text-xs text-[#475569] mt-0.5">{h.outcome_notes}</div>
                          )}
                        </div>
                        <div className="text-xs font-semibold u360-table-numeric text-[#0B1426] shrink-0">
                          {h.hearing_date}
                        </div>
                      </div>
                    ))}
                    {timeline.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-[#F6F5F1] border border-[#E2DFD7] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#0B1426]">{t.title}</div>
                          {t.description && (
                            <div className="text-xs text-[#475569] mt-0.5">{t.description}</div>
                          )}
                        </div>
                        <div className="text-xs u360-table-numeric text-[#64748B] shrink-0">
                          {t.event_date}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 text-xs text-[#64748B]">
                Hearing chronology is not enabled on your client access grant.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Shared Filings */}
        {activeTab === 'filings' && scopes.viewFilings && (
          <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#0B1426]">
                  Shared Matter Filings &amp; Orders
                </h2>
                <p className="text-xs text-[#64748B]">
                  Internal chamber findings and private drafts are excluded from the client view.
                </p>
              </div>
              {scopes.uploadDocs && (
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#C49A36]" />
                  <span>Upload document</span>
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4">
                No filings have been shared on this matter yet.
              </p>
            ) : (
              <div className="divide-y divide-[#EFECE4]">
                {documents.map((d) => (
                  <div key={d.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-[#C49A36] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#0B1426] truncate">
                          {d.name}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {d.doc_type || 'Document'} • v{d.current_version || 1}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs u360-table-numeric text-[#64748B] shrink-0">
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
          <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-[#0B1426]">Matter Invoices &amp; Statements</h2>
            {invoices.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4">
                No invoices have been issued for this matter yet.
              </p>
            ) : (
              <div className="divide-y divide-[#EFECE4]">
                {invoices.map((inv) => (
                  <div key={inv.id} className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#0B1426]">
                        {inv.invoice_number}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        Issued: {inv.issue_date} {inv.due_date ? `• Due: ${inv.due_date}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#0B1426] u360-table-numeric">
                        ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F6F5F1] border border-[#E2DFD7] text-[#0B1426]">
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
          <div className="bg-white rounded-xl border border-[#E2DFD7] p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-[#0B1426]">Matter Status Q&amp;A</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto p-3.5 bg-[#F6F5F1] rounded-xl border border-[#E2DFD7]">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-[#64748B]">
                  Ask a question about your matter&apos;s current stage or next listed hearing date.
                </p>
              ) : (
                chatHistory.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl text-xs ${
                      m.role === 'client'
                        ? 'bg-[#0B1426] text-white ml-auto max-w-md'
                        : 'bg-white border border-[#E2DFD7] text-[#0B1426] max-w-lg'
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
                className="flex-1 px-3.5 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs focus:outline-none focus:border-[#0B1426]"
              />
              <button
                type="submit"
                disabled={isAsking}
                className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#C49A36]" />
              </button>
            </form>
          </div>
        )}

        {/* Client Document Upload Modal */}
        {isUploadModalOpen && scopes.uploadDocs && (
          <div className="fixed inset-0 bg-[#0B1426]/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2DFD7] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2DFD7] pb-3">
                <h3 className="text-base font-bold text-[#0B1426]">Upload supporting document</h3>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-[#64748B] hover:text-[#0B1426] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleClientDocumentUpload} className="space-y-3">
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs focus:outline-none focus:border-[#0B1426]"
                />
                <textarea
                  rows={4}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Document notes or text..."
                  className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs focus:outline-none focus:border-[#0B1426]"
                />
                {uploadStatus && <p className="text-xs text-[#475569]">{uploadStatus}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-3.5 py-2 bg-white border border-[#E2DFD7] rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Submit document
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
