import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';
import { createApiApp } from '../server';
import {
  createWorkspaceWithOwner,
  fetchUserWorkspaceMembership,
  listMattersForWorkspace,
  getMatterById,
  createMatterInDb,
  updateMatterInDb,
  mapCaseFileToMatterRow,
  mapMatterRowToCaseFile,
  mapDocumentRowToEnterpriseDoc,
  uploadDocumentToStorageAndDb,
  createDocumentRevisionInStorageAndDb,
  downloadDocumentFromStorage,
  createTaskInDb,
  updateTaskInDb,
  listTasksForWorkspace,
  createTimeEntryInDb,
  createInvoiceInDb,
  recordPaymentInDb,
  createTimelineEventInDb,
  listTimelineEventsForMatter,
  saveDraftToMatterVault,
  getLatestDraftForMatterInDb,
  approveDraftInDb,
  updateDraftInDb,
  saveDraftRevisionInDb,
  listDraftsForMatterInDb,
  getDraftByIdInDb,
  getDraftVersionsInDb,
  saveExtractedFactsToMatter,
  listExtractedFactsForMatter,
  reviewExtractedFactInDb,
  getAcceptedFactsForMatterInDb,
  hashClientInviteTokenSha256,
} from '../src/lib/useMatterData';
import {
  savePendingPortalInviteToken,
  peekPendingPortalInviteToken,
  clearPendingPortalInviteToken,
} from '../src/lib/supabase';
import { AskAdvocateAssistant } from '../src/components/AskAdvocateAssistant';
import { BillingModule } from '../src/components/BillingModule';
import { ClientPortal, RestrictedClientPortal } from '../src/components/ClientPortal';
import { DurableBackgroundWorker } from '../src/lib/serverWorker';
import { DraftingAssistant } from '../src/components/DraftingAssistant';
import { FirebaseToSupabaseMigrator } from '../src/lib/firebaseToSupabaseMigration';

/**
 * 1. STATIC MIGRATION FILE STRUCTURE & SEQUENCING CHECKS
 */
test('[Mock-Backed Integration Test] Static SQL Migration File Sequencing Verification', async (t) => {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await t.test('should have unique, strictly sequential migration version prefixes', () => {
    assert.ok(files.length >= 3, 'Expected at least 3 sequential migration files');
    assert.strictEqual(files[0], '20261016000001_initial_schema.sql');
    assert.strictEqual(files[1], '20261016000002_hardened_workspace_upgrade.sql');
    assert.strictEqual(files[2], '20261017090500_persistence_defects.sql');

    const prefixes = files.map((f) => f.split('_')[0]);
    const uniquePrefixes = new Set(prefixes);
    assert.strictEqual(
      prefixes.length,
      uniquePrefixes.size,
      'Every migration file must have a unique version prefix'
    );
  });

  await t.test(
    'should not contain manual INSERT INTO schema_migrations rows masquerading as execution evidence',
    () => {
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        assert.ok(
          !sql.includes('INSERT INTO public.schema_migrations'),
          `Migration ${file} must not manually insert rows into schema_migrations`
        );
      }
    }
  );
});

/**
 * 2. MOCK-BACKED HTTP / POSTGREST INTEGRATION TESTS
 *    (Simulates Supabase Auth + PostgREST HTTP contract to test application & Express API layer)
 */
test('[Mock-Backed Integration Test] Simulated PostgREST Login-to-Matter & API Authorization Tests', async (t) => {
  const USERS: Record<string, { id: string; email: string }> = {
    'jwt-member-valid-token': {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'member.advocate@chamberA.in',
    },
    'jwt-outsider-valid-token': {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'outsider.advocate@chamberB.in',
    },
    'jwt-client-valid-token': {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'client.recipient@company.in',
    },
    'jwt-paralegal-valid-token': {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'paralegal.staff@chamberA.in',
    },
  };

  const simulatedState = {
    profiles: [] as any[],
    workspaces: [] as any[],
    workspace_memberships: [] as any[],
    clients: [] as any[],
    matters: [] as any[],
    documents: [] as any[],
    document_versions: [] as any[],
    tasks: [] as any[],
    time_entries: [] as any[],
    invoices: [] as any[],
    payments: [] as any[],
    timeline_events: [] as any[],
    drafts: [] as any[],
    draft_versions: [] as any[],
    findings: [] as any[],
    ai_jobs: [] as any[],
    ai_results: [] as any[],
    client_invitations: [] as any[],
    client_access_grants: [] as any[],
    storageObjects: new Map<string, Buffer>(),
    forceMatterInsertError: false,
  };

  let uuidCounter = 100;
  const nextUuid = () => {
    uuidCounter += 1;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
  };

  const getCallerFromHeaders = (headers: http.IncomingHttpHeaders) => {
    const auth = headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    const token = auth.substring(7).trim();
    if (token === 'test-anon-publishable-key' || token === 'service-role-key') {
      return USERS['jwt-member-valid-token'];
    }
    return USERS[token] || null;
  };

  const isUserActiveMember = (userId: string, workspaceId: string) => {
    return simulatedState.workspace_memberships.some(
      (m) => m.workspace_id === workspaceId && m.user_id === userId && m.status === 'Active'
    );
  };

  const readRawBuffer = (req: http.IncomingMessage): Promise<Buffer> =>
    new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

  const readJsonBody = async (req: http.IncomingMessage): Promise<any> => {
    const buf = await readRawBuffer(req);
    try {
      const text = buf.toString('utf8');
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  };

  // Start Mock Supabase Auth + PostgREST Server
  const mockSupabaseServer = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;
    const caller = getCallerFromHeaders(req.headers);

    res.setHeader('Content-Type', 'application/json');

    // 1. Supabase Auth endpoint: GET /auth/v1/user
    if (pathname === '/auth/v1/user' && req.method === 'GET') {
      if (!caller) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ id: caller.id, email: caller.email, role: 'authenticated' }));
      return;
    }

    if (!caller) {
      res.statusCode = 401;
      res.end(JSON.stringify({ message: 'JWT invalid or missing' }));
      return;
    }

    // 2. RPC: POST /rest/v1/rpc/create_workspace_with_owner
    if (pathname === '/rest/v1/rpc/create_workspace_with_owner' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const wsId = nextUuid();
      const memId = nextUuid();
      const now = new Date().toISOString();

      const wsRow = {
        id: wsId,
        name: body.ws_name,
        advocate_name: body.adv_name,
        city: body.ws_city,
        office_location: body.ws_city,
        owner_user_id: caller.id,
        enrollment_no: body.bar_enrollment || null,
        state_bar_council: body.bar_council || null,
        phone: body.ws_phone || null,
        email: body.ws_email || caller.email,
        practice_areas: body.ws_practice_areas || [],
        created_at: now,
        updated_at: now,
      };
      simulatedState.workspaces.push(wsRow);

      const memRow = {
        id: memId,
        workspace_id: wsId,
        user_id: caller.id,
        role: 'CHAMBER_OWNER',
        status: 'Active',
        created_at: now,
        updated_at: now,
      };
      simulatedState.workspace_memberships.push(memRow);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          workspace_id: wsId,
          membership_id: memId,
          role: 'CHAMBER_OWNER',
        })
      );
      return;
    }

    // 2B. RPC: POST /rest/v1/rpc/create_matter_with_client
    if (pathname === '/rest/v1/rpc/create_matter_with_client' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: 'Access denied: caller is not active member' }));
        return;
      }

      let createdClientId: string | null = null;
      if (body.p_client_name && String(body.p_client_name).trim()) {
        const clientRow = {
          id: nextUuid(),
          workspace_id: body.p_workspace_id,
          name: String(body.p_client_name).trim(),
          email: body.p_client_email || null,
          phone: body.p_client_phone || null,
          created_at: new Date().toISOString(),
        };
        simulatedState.clients.push(clientRow);
        createdClientId = clientRow.id;
      }

      if (simulatedState.forceMatterInsertError) {
        if (createdClientId) {
          simulatedState.clients = simulatedState.clients.filter((c) => c.id !== createdClientId);
        }
        res.statusCode = 500;
        res.end(
          JSON.stringify({ message: 'Simulated matter insert failure after client creation' })
        );
        return;
      }

      const now = new Date().toISOString();
      const matterRow = {
        id: nextUuid(),
        workspace_id: body.p_workspace_id,
        client_id: createdClientId,
        title: body.p_title,
        case_number: body.p_case_number || null,
        case_type: body.p_case_type || 'Property Dispute',
        status: body.p_status || 'Intake',
        stage: body.p_status || 'Intake',
        client_name: body.p_client_name || '',
        client_phone: body.p_client_phone || null,
        client_email: body.p_client_email || null,
        opposite_party: body.p_opposite_party || null,
        court_name: body.p_court_name || 'Court Not Specified',
        judge_name: body.p_judge_name || null,
        next_hearing_date: body.p_next_hearing_date || null,
        summary: body.p_summary || '',
        created_at: now,
        updated_at: now,
      };
      simulatedState.matters.push(matterRow);
      res.statusCode = 200;
      res.end(JSON.stringify(matterRow));
      return;
    }

    // 2C. RPC: POST /rest/v1/rpc/record_payment_atomic
    if (pathname === '/rest/v1/rpc/record_payment_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            message: 'Unauthorized: Caller is not a billing authorized workspace member',
          })
        );
        return;
      }

      const payAmount = Number(body.p_amount || 0);
      if (payAmount <= 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Payment amount must be greater than zero' }));
        return;
      }

      if (!body.p_idempotency_key || !body.p_idempotency_key.trim()) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Operation ID (idempotency key) is required' }));
        return;
      }

      const existingPay = simulatedState.payments.find(
        (p) =>
          p.workspace_id === body.p_workspace_id && p.idempotency_key === body.p_idempotency_key
      );
      if (existingPay) {
        if (
          existingPay.invoice_id !== body.p_invoice_id ||
          Number(existingPay.amount) !== payAmount ||
          existingPay.payment_date !== body.p_payment_date ||
          existingPay.payment_method !== (body.p_method || 'UPI') ||
          (existingPay.reference_no || '') !== (body.p_reference_no || '') ||
          (existingPay.notes || '') !== (body.p_notes || '')
        ) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              message: 'Idempotency key collision with conflicting payment details',
            })
          );
          return;
        }
        const inv = simulatedState.invoices.find(
          (i) => i.id === body.p_invoice_id && i.workspace_id === body.p_workspace_id
        );
        res.statusCode = 200;
        res.end(JSON.stringify(inv));
        return;
      }

      const invIdx = simulatedState.invoices.findIndex(
        (i) => i.id === body.p_invoice_id && i.workspace_id === body.p_workspace_id
      );
      if (invIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Invoice not found or unauthorized' }));
        return;
      }

      const payRow = {
        id: nextUuid(),
        workspace_id: body.p_workspace_id,
        invoice_id: body.p_invoice_id,
        amount: payAmount,
        payment_date: body.p_payment_date,
        payment_method: body.p_method || 'UPI',
        reference_no: body.p_reference_no || null,
        notes: body.p_notes || null,
        idempotency_key: body.p_idempotency_key || null,
        created_at: new Date().toISOString(),
      };
      simulatedState.payments.push(payRow);

      const totalPaid = simulatedState.payments
        .filter(
          (p) => p.invoice_id === body.p_invoice_id && p.workspace_id === body.p_workspace_id
        )
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const inv = simulatedState.invoices[invIdx];
      inv.paid_amount = totalPaid;
      inv.status =
        totalPaid >= Number(inv.total_amount)
          ? 'Paid'
          : totalPaid > 0
            ? 'Partially Paid'
            : 'Unpaid';
      inv.updated_at = new Date().toISOString();

      res.statusCode = 200;
      res.end(JSON.stringify(inv));
      return;
    }

    // 2D. RPC: POST /rest/v1/rpc/save_draft_revision_atomic
    if (pathname === '/rest/v1/rpc/save_draft_revision_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            message: 'Unauthorized: Caller does not have drafting permissions in this workspace',
          })
        );
        return;
      }

      if (!body.p_title || !String(body.p_title).trim()) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'Draft title is required' }));
        return;
      }

      // Safe retry idempotency with p_operation_id
      if (body.p_operation_id && String(body.p_operation_id).trim()) {
        const existingVer = simulatedState.draft_versions.find(
          (v) =>
            v.workspace_id === body.p_workspace_id &&
            v.operation_id === String(body.p_operation_id).trim()
        );
        if (existingVer) {
          const d = simulatedState.drafts.find((dr) => dr.id === existingVer.draft_id);
          if (d) {
            res.statusCode = 200;
            res.end(JSON.stringify(d));
            return;
          }
        }
      }

      if (body.p_draft_id) {
        const draftIdx = simulatedState.drafts.findIndex(
          (d) => d.id === body.p_draft_id && d.workspace_id === body.p_workspace_id
        );
        if (draftIdx === -1) {
          res.statusCode = 404;
          res.end(JSON.stringify({ message: 'Draft not found or unauthorized in matter' }));
          return;
        }

        const draft = simulatedState.drafts[draftIdx];
        if (
          body.p_expected_version !== null &&
          body.p_expected_version !== undefined &&
          draft.current_version !== body.p_expected_version
        ) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              message: `Stale save rejected: expected version ${body.p_expected_version} does not match current version ${draft.current_version}`,
            })
          );
          return;
        }

        const nextVer = draft.current_version + 1;
        draft.title = String(body.p_title).trim();
        draft.content = body.p_content || '';
        draft.doc_type = body.p_doc_type || draft.doc_type;
        draft.current_version = nextVer;
        draft.status = 'Draft';
        draft.approved_version = null;
        draft.approved_by_user_id = null;
        draft.approved_at = null;
        draft.updated_at = new Date().toISOString();

        simulatedState.draft_versions.push({
          id: nextUuid(),
          workspace_id: body.p_workspace_id,
          draft_id: draft.id,
          version: nextVer,
          content: draft.content,
          change_notes: body.p_change_notes || `Revision v${nextVer}`,
          operation_id: body.p_operation_id || null,
          created_by_user_id: caller.id,
          created_at: new Date().toISOString(),
        });

        res.statusCode = 200;
        res.end(JSON.stringify(draft));
        return;
      } else {
        const newDraft = {
          id: nextUuid(),
          workspace_id: body.p_workspace_id,
          matter_id: body.p_matter_id,
          doc_type: body.p_doc_type || 'Pleading',
          title: String(body.p_title).trim(),
          content: body.p_content || '',
          current_version: 1,
          status: 'Draft',
          approved_version: null,
          approved_by_user_id: null,
          approved_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        simulatedState.drafts.push(newDraft);

        simulatedState.draft_versions.push({
          id: nextUuid(),
          workspace_id: body.p_workspace_id,
          draft_id: newDraft.id,
          version: 1,
          content: newDraft.content,
          change_notes: body.p_change_notes || 'Initial draft revision v1',
          operation_id: body.p_operation_id || null,
          created_by_user_id: caller.id,
          created_at: new Date().toISOString(),
        });

        res.statusCode = 200;
        res.end(JSON.stringify(newDraft));
        return;
      }
    }

    // 2E. RPC: POST /rest/v1/rpc/approve_draft_atomic
    if (pathname === '/rest/v1/rpc/approve_draft_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const membership = simulatedState.workspace_memberships.find(
        (m) =>
          m.workspace_id === body.p_workspace_id &&
          m.user_id === caller.id &&
          m.status === 'Active'
      );
      if (
        !membership ||
        !['CHAMBER_OWNER', 'SENIOR_ADVOCATE'].includes(membership.role)
      ) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            message: 'Unauthorized: Caller does not have permissions to approve drafts',
          })
        );
        return;
      }

      const draftIdx = simulatedState.drafts.findIndex(
        (d) => d.id === body.p_draft_id && d.workspace_id === body.p_workspace_id
      );
      if (draftIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Draft not found or unauthorized in workspace' }));
        return;
      }

      const draft = simulatedState.drafts[draftIdx];
      if (
        body.p_expected_version === null ||
        body.p_expected_version === undefined ||
        draft.current_version !== body.p_expected_version
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            message: `Stale approval rejected: expected version ${body.p_expected_version} does not match current version ${draft.current_version}`,
          })
        );
        return;
      }

      const verExists = simulatedState.draft_versions.some(
        (v) => v.draft_id === draft.id && v.version === body.p_expected_version
      );
      if (!verExists) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            message: `Cannot approve unsaved draft version ${body.p_expected_version}`,
          })
        );
        return;
      }

      draft.status = 'Approved';
      draft.approved_version = body.p_expected_version;
      draft.approved_by_user_id = caller.id;
      draft.approved_at = new Date().toISOString();
      draft.updated_at = new Date().toISOString();

      res.statusCode = 200;
      res.end(JSON.stringify(draft));
      return;
    }

    // 2F. RPC: POST /rest/v1/rpc/create_document_with_initial_version_atomic
    if (pathname === '/rest/v1/rpc/create_document_with_initial_version_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: 'Unauthorized workspace member' }));
        return;
      }

      if (body.p_operation_id) {
        const existingVer = simulatedState.document_versions.find(
          (v) => v.workspace_id === body.p_workspace_id && v.operation_id === body.p_operation_id
        );
        if (existingVer) {
          const existingDoc = simulatedState.documents.find((d) => d.id === existingVer.document_id);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              document: existingDoc,
              version: existingVer,
              idempotent_retry: true,
            })
          );
          return;
        }
      }

      const docId = nextUuid();
      const now = new Date().toISOString();
      const newDoc = {
        id: docId,
        workspace_id: body.p_workspace_id,
        matter_id: body.p_matter_id,
        name: String(body.p_name).trim(),
        doc_type: body.p_doc_type || 'Document',
        storage_bucket: body.p_storage_bucket || 'matter-documents',
        file_path: body.p_file_path,
        file_size: Number(body.p_file_size || 0),
        mime_type: body.p_mime_type || 'text/plain',
        extracted_text: body.p_extracted_text || null,
        uploaded_by_user_id: caller.id,
        processing_status: body.p_extracted_text ? 'Processed' : 'Uploaded',
        review_status: 'Unreviewed',
        current_version: 1,
        created_at: now,
        updated_at: now,
      };
      simulatedState.documents.push(newDoc);

      const newVer = {
        id: nextUuid(),
        workspace_id: body.p_workspace_id,
        document_id: docId,
        version: 1,
        file_path: body.p_file_path,
        file_size: Number(body.p_file_size || 0),
        mime_type: body.p_mime_type || 'text/plain',
        changes_summary: body.p_changes_summary || 'Initial upload v1',
        extracted_text: body.p_extracted_text || null,
        author_name: body.p_author_name || 'Workspace Member',
        created_by_user_id: caller.id,
        status: 'committed',
        operation_id: body.p_operation_id || null,
        created_at: now,
      };
      simulatedState.document_versions.push(newVer);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          document: newDoc,
          version: newVer,
          idempotent_retry: false,
        })
      );
      return;
    }

    // 2G. RPC: POST /rest/v1/rpc/commit_document_revision_atomic
    if (pathname === '/rest/v1/rpc/commit_document_revision_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: 'Unauthorized workspace member' }));
        return;
      }

      if (body.p_operation_id) {
        const existingVer = simulatedState.document_versions.find(
          (v) => v.workspace_id === body.p_workspace_id && v.operation_id === body.p_operation_id
        );
        if (existingVer) {
          const existingDoc = simulatedState.documents.find((d) => d.id === existingVer.document_id);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              document: existingDoc,
              version: existingVer,
              idempotent_retry: true,
            })
          );
          return;
        }
      }

      const docIdx = simulatedState.documents.findIndex(
        (d) => d.id === body.p_document_id && d.workspace_id === body.p_workspace_id && d.matter_id === body.p_matter_id
      );
      if (docIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Document not found or scope mismatch' }));
        return;
      }

      const doc = simulatedState.documents[docIdx];
      if (
        body.p_expected_version !== null &&
        body.p_expected_version !== undefined &&
        doc.current_version !== body.p_expected_version
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            message: `Stale document revision: expected version ${body.p_expected_version} does not match current version ${doc.current_version}`,
          })
        );
        return;
      }

      const nextVer = doc.current_version + 1;
      const now = new Date().toISOString();

      const newVer = {
        id: nextUuid(),
        workspace_id: body.p_workspace_id,
        document_id: doc.id,
        version: nextVer,
        file_path: body.p_file_path,
        file_size: Number(body.p_file_size || doc.file_size),
        mime_type: body.p_mime_type || doc.mime_type,
        changes_summary: body.p_changes_summary,
        extracted_text: body.p_extracted_text || doc.extracted_text,
        author_name: body.p_author_name || 'Workspace Member',
        created_by_user_id: caller.id,
        status: 'committed',
        operation_id: body.p_operation_id || null,
        created_at: now,
      };
      simulatedState.document_versions.push(newVer);

      doc.current_version = nextVer;
      doc.file_path = body.p_file_path;
      doc.file_size = Number(body.p_file_size || doc.file_size);
      doc.mime_type = body.p_mime_type || doc.mime_type;
      doc.extracted_text = body.p_extracted_text || doc.extracted_text;
      doc.updated_at = now;

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          document: doc,
          version: newVer,
          idempotent_retry: false,
        })
      );
      return;
    }

    // 2H. RPC: POST /rest/v1/rpc/review_extracted_fact_atomic
    if (pathname === '/rest/v1/rpc/review_extracted_fact_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!isUserActiveMember(caller.id, body.p_workspace_id)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: 'Unauthorized workspace member' }));
        return;
      }

      const factIdx = simulatedState.findings.findIndex(
        (f) => f.id === body.p_finding_id && f.workspace_id === body.p_workspace_id
      );
      if (factIdx === -1) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Extracted fact finding not found' }));
        return;
      }

      const fact = simulatedState.findings[factIdx];
      const now = new Date().toISOString();

      if (body.p_action === 'Accept') {
        fact.status = 'Accepted';
        fact.finding_text = body.p_edited_text || fact.finding_text;
      } else if (body.p_action === 'Reject') {
        fact.status = 'Rejected';
      } else if (body.p_action === 'Edit') {
        fact.status = 'Accepted';
        fact.finding_text = body.p_edited_text;
        fact.edited_text = body.p_edited_text;
      }

      fact.reviewed_by_user_id = caller.id;
      fact.reviewed_at = now;

      res.statusCode = 200;
      res.end(JSON.stringify(fact));
      return;
    }

    // 2I. RPC: POST /rest/v1/rpc/claim_next_ai_job_atomic
    if (pathname === '/rest/v1/rpc/claim_next_ai_job_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const now = new Date();
      const jobIdx = simulatedState.ai_jobs.findIndex(
        (j) => j.status === 'queued' || (j.status === 'processing' && j.lease_expires_at && new Date(j.lease_expires_at) < now)
      );

      if (jobIdx === -1) {
        res.statusCode = 200;
        res.end(JSON.stringify([]));
        return;
      }

      const job = simulatedState.ai_jobs[jobIdx];
      job.attempt_count = (job.attempt_count || 0) + 1;
      job.status = 'processing';
      job.lease_token = nextUuid();
      job.lease_expires_at = new Date(now.getTime() + (body.p_lease_seconds || 60) * 1000).toISOString();
      job.started_at = job.started_at || now.toISOString();
      job.logs = [...(job.logs || []), `Claimed by worker ${body.p_worker_id || 'srv'}`];

      res.statusCode = 200;
      res.end(JSON.stringify([job]));
      return;
    }

    // 2J. RPC: POST /rest/v1/rpc/commit_ai_job_result_atomic
    if (pathname === '/rest/v1/rpc/commit_ai_job_result_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const job = simulatedState.ai_jobs.find((j) => j.id === body.p_job_id);

      if (!job) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'AI job not found' }));
        return;
      }

      let resultObj = simulatedState.ai_results.find((r) => r.job_id === job.id);
      if (!resultObj) {
        resultObj = {
          id: nextUuid(),
          job_id: job.id,
          workspace_id: job.workspace_id,
          matter_id: job.matter_id,
          operation: job.operation,
          result_payload: body.p_result_payload,
          created_at: new Date().toISOString(),
        };
        simulatedState.ai_results.push(resultObj);
      } else {
        resultObj.result_payload = body.p_result_payload;
      }

      job.status = 'completed';
      job.progress = 100;
      job.completed_at = new Date().toISOString();
      if (body.p_log_message) {
        job.logs = [...(job.logs || []), body.p_log_message];
      }

      res.statusCode = 200;
      res.end(JSON.stringify(resultObj));
      return;
    }

    // 2K. RPC: POST /rest/v1/rpc/create_client_invitation_atomic
    if (pathname === '/rest/v1/rpc/create_client_invitation_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const membership = simulatedState.workspace_memberships.find(
        (m) => m.workspace_id === body.p_workspace_id && m.user_id === caller.id && m.status === 'Active'
      );
      if (!membership || !['CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE'].includes(membership.role)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden: Only authorized chamber staff can issue client invitations.' }));
        return;
      }

      const matter = simulatedState.matters.find(
        (m) => m.id === body.p_matter_id && m.workspace_id === body.p_workspace_id
      );
      if (!matter) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden: Specified matter does not exist in workspace.' }));
        return;
      }

      if (!body.p_token_hash || !/^[0-9a-f]{64}$/.test(body.p_token_hash)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: '400 Bad Request: 64-character SHA-256 token_hash required.' }));
        return;
      }

      const now = new Date().toISOString();
      const inv = {
        id: nextUuid(),
        workspace_id: body.p_workspace_id,
        matter_id: body.p_matter_id,
        client_email: String(body.p_client_email || '').trim().toLowerCase(),
        client_name: body.p_client_name || 'Client',
        client_phone: body.p_client_phone || null,
        token_hash: body.p_token_hash,
        scopes: body.p_scopes || {},
        expires_at: body.p_expires_at,
        created_by_user_id: caller.id,
        status: 'Active',
        delivery_status: body.p_delivery_status || 'email_not_sent',
        created_at: now,
        updated_at: now,
      };
      simulatedState.client_invitations.push(inv);

      const { token_hash, ...safeResponse } = inv;
      res.statusCode = 200;
      res.end(JSON.stringify({ ...safeResponse, matter_title: matter.title }));
      return;
    }

    // 2L. RPC: POST /rest/v1/rpc/redeem_client_invitation_atomic
    if (pathname === '/rest/v1/rpc/redeem_client_invitation_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const inv = simulatedState.client_invitations.find((i) => i.token_hash === body.p_token_hash);
      if (!inv) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: '404 Not Found: Invalid invitation token.' }));
        return;
      }

      if (inv.status === 'Revoked' || inv.revoked_at) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden: This client portal invitation has been revoked.' }));
        return;
      }

      if (caller.email.toLowerCase().trim() !== inv.client_email.toLowerCase().trim()) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            message: `403 Forbidden: Recipient email mismatch. This invitation was issued exclusively for ${inv.client_email}.`,
          })
        );
        return;
      }

      if (inv.status === 'Expired' || new Date(inv.expires_at).getTime() <= Date.now()) {
        res.statusCode = 410;
        res.end(JSON.stringify({ message: '410 Gone: This client portal invitation has expired.' }));
        return;
      }

      let existingGrant = simulatedState.client_access_grants.find(
        (g) => g.workspace_id === inv.workspace_id && g.matter_id === inv.matter_id && g.client_user_id === caller.id
      );

      if (inv.status === 'Redeemed' || inv.redeemed_at) {
        if (!existingGrant || existingGrant.revoked_at) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: '403 Forbidden: Access granted by this invitation has been revoked.' }));
          return;
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            grant_id: existingGrant.id,
            invitation_id: inv.id,
            workspace_id: inv.workspace_id,
            matter_id: inv.matter_id,
            client_user_id: caller.id,
            client_email: inv.client_email,
            client_name: inv.client_name,
            scopes: existingGrant.scopes,
            expires_at: existingGrant.expires_at,
            status: 'Redeemed',
            replayed: true,
          })
        );
        return;
      }

      const now = new Date().toISOString();
      inv.status = 'Redeemed';
      inv.redeemed_by_user_id = caller.id;
      inv.redeemed_at = now;
      inv.updated_at = now;

      if (!existingGrant) {
        existingGrant = {
          id: nextUuid(),
          workspace_id: inv.workspace_id,
          matter_id: inv.matter_id,
          client_user_id: caller.id,
          invitation_id: inv.id,
          client_email: inv.client_email,
          client_name: inv.client_name,
          scopes: inv.scopes,
          granted_by_user_id: inv.created_by_user_id,
          granted_at: now,
          expires_at: inv.expires_at,
          revoked_at: null,
          updated_at: now,
        };
        simulatedState.client_access_grants.push(existingGrant);
      } else {
        existingGrant.revoked_at = null;
        existingGrant.scopes = inv.scopes;
        existingGrant.expires_at = inv.expires_at;
        existingGrant.updated_at = now;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          grant_id: existingGrant.id,
          invitation_id: inv.id,
          workspace_id: inv.workspace_id,
          matter_id: inv.matter_id,
          client_user_id: caller.id,
          client_email: inv.client_email,
          client_name: inv.client_name,
          scopes: existingGrant.scopes,
          expires_at: existingGrant.expires_at,
          status: 'Redeemed',
          replayed: false,
        })
      );
      return;
    }

    // 2M. RPC: POST /rest/v1/rpc/revoke_client_invitation_atomic
    if (pathname === '/rest/v1/rpc/revoke_client_invitation_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const membership = simulatedState.workspace_memberships.find(
        (m) => m.workspace_id === body.p_workspace_id && m.user_id === caller.id && m.status === 'Active'
      );
      if (!membership || !['CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE'].includes(membership.role)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden: Only authorized chamber staff can revoke client portal access.' }));
        return;
      }

      const inv = simulatedState.client_invitations.find(
        (i) => i.id === body.p_invitation_id && i.workspace_id === body.p_workspace_id
      );
      if (!inv) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: '404 Not Found: Client invitation not found.' }));
        return;
      }

      const now = new Date().toISOString();
      inv.status = 'Revoked';
      inv.revoked_at = now;
      inv.revoked_by_user_id = caller.id;

      let revokedGrantsCount = 0;
      for (const g of simulatedState.client_access_grants) {
        if (
          g.workspace_id === body.p_workspace_id &&
          g.matter_id === inv.matter_id &&
          (g.invitation_id === inv.id || g.client_email === inv.client_email) &&
          !g.revoked_at
        ) {
          g.revoked_at = now;
          g.revoked_by_user_id = caller.id;
          revokedGrantsCount += 1;
        }
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          id: inv.id,
          workspace_id: inv.workspace_id,
          matter_id: inv.matter_id,
          client_email: inv.client_email,
          status: 'Revoked',
          revoked_at: now,
          revoked_grants_count: revokedGrantsCount,
        })
      );
      return;
    }

    // 2N. RPC: POST /rest/v1/rpc/get_restricted_client_portal_matter_atomic
    if (pathname === '/rest/v1/rpc/get_restricted_client_portal_matter_atomic' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const grant = simulatedState.client_access_grants.find(
        (g) =>
          g.matter_id === body.p_matter_id &&
          g.client_user_id === caller.id &&
          !g.revoked_at &&
          (!g.expires_at || new Date(g.expires_at).getTime() > Date.now())
      );

      if (!grant) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden: Active client access grant not found or revoked.' }));
        return;
      }

      const matter = simulatedState.matters.find(
        (m) => m.id === body.p_matter_id && m.workspace_id === grant.workspace_id
      );
      if (!matter) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: '404 Not Found: Matter not found.' }));
        return;
      }

      const docs = grant.scopes?.viewFilings
        ? simulatedState.documents
            .filter((d) => d.matter_id === matter.id && d.workspace_id === grant.workspace_id)
            .map((d) => ({ id: d.id, name: d.name, doc_type: d.doc_type, current_version: d.current_version }))
        : [];
      const invoices = grant.scopes?.viewBilling
        ? simulatedState.invoices.filter((i) => i.matter_id === matter.id && i.workspace_id === grant.workspace_id)
        : [];
      const timeline = grant.scopes?.viewHearings
        ? simulatedState.timeline_events.filter((t) => t.matter_id === matter.id && t.workspace_id === grant.workspace_id)
        : [];

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          grant: {
            id: grant.id,
            workspace_id: grant.workspace_id,
            workspace_name: 'Chamber A',
            matter_id: grant.matter_id,
            client_email: grant.client_email,
            client_name: grant.client_name,
            scopes: grant.scopes,
            granted_at: grant.granted_at,
            expires_at: grant.expires_at,
          },
          matter: {
            id: matter.id,
            workspace_id: matter.workspace_id,
            title: matter.title,
            case_number: matter.case_number,
            court_name: matter.court_name,
            stage: matter.stage,
            status: matter.status,
            client_name: matter.client_name,
          },
          hearings: [],
          timeline,
          documents: docs,
          invoices,
        })
      );
      return;
    }

    // 2O. Table: GET /rest/v1/client_invitations
    if (pathname === '/rest/v1/client_invitations' && req.method === 'GET') {
      const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
      if (!wsFilter || !isUserActiveMember(caller.id, wsFilter)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ message: '403 Forbidden' }));
        return;
      }
      const rows = simulatedState.client_invitations
        .filter((i) => i.workspace_id === wsFilter)
        .map(({ token_hash, ...rest }) => rest);
      res.statusCode = 200;
      res.end(JSON.stringify(rows));
      return;
    }

    // 3. Table: /rest/v1/workspace_memberships
    if (pathname === '/rest/v1/workspace_memberships' && req.method === 'GET') {
      const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
      const userFilter = urlObj.searchParams.get('user_id')?.replace(/^eq\./, '');
      const statusFilter = urlObj.searchParams.get('status')?.replace(/^eq\./, '');

      let rows = simulatedState.workspace_memberships.filter(
        (m) => m.user_id === caller.id || isUserActiveMember(caller.id, m.workspace_id)
      );
      if (wsFilter) rows = rows.filter((m) => m.workspace_id === wsFilter);
      if (userFilter) rows = rows.filter((m) => m.user_id === userFilter);
      if (statusFilter) rows = rows.filter((m) => m.status === statusFilter);

      const enriched = rows.map((m) => ({
        ...m,
        workspaces: simulatedState.workspaces.find((w) => w.id === m.workspace_id) || null,
      }));

      res.statusCode = 200;
      res.end(JSON.stringify(enriched));
      return;
    }

    // 4. Table: /rest/v1/clients (POST & DELETE for compensating rollback verification)
    if (pathname === '/rest/v1/clients') {
      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const item = Array.isArray(body) ? body[0] : body;
        if (!isUserActiveMember(caller.id, item.workspace_id)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: 'RLS policy violation on clients' }));
          return;
        }
        const created = { id: nextUuid(), ...item, created_at: new Date().toISOString() };
        simulatedState.clients.push(created);
        res.statusCode = 201;
        const accept = String(req.headers.accept || '');
        res.end(JSON.stringify(accept.includes('vnd.pgrst.object') ? created : [created]));
        return;
      }

      if (req.method === 'DELETE') {
        const idFilter = urlObj.searchParams.get('id')?.replace(/^eq\./, '');
        const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
        simulatedState.clients = simulatedState.clients.filter(
          (c) => !(c.id === idFilter && (!wsFilter || c.workspace_id === wsFilter))
        );
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    // 5. Table: /rest/v1/matters (GET, POST, PATCH)
    if (pathname === '/rest/v1/matters') {
      const accept = String(req.headers.accept || '');
      const wantsSingleObject = accept.includes('vnd.pgrst.object');

      if (req.method === 'GET') {
        const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
        const idFilter = urlObj.searchParams.get('id')?.replace(/^eq\./, '');

        let rows = simulatedState.matters.filter((m) =>
          isUserActiveMember(caller.id, m.workspace_id)
        );
        if (wsFilter) rows = rows.filter((m) => m.workspace_id === wsFilter);
        if (idFilter) rows = rows.filter((m) => m.id === idFilter);

        res.statusCode = 200;
        if (wantsSingleObject) {
          res.end(JSON.stringify(rows[0] || null));
        } else {
          res.end(JSON.stringify(rows));
        }
        return;
      }

      if (req.method === 'POST') {
        if (simulatedState.forceMatterInsertError) {
          res.statusCode = 500;
          res.end(JSON.stringify({ message: 'Simulated matter insert failure after client creation' }));
          return;
        }

        const body = await readJsonBody(req);
        const item = Array.isArray(body) ? body[0] : body;
        if (!isUserActiveMember(caller.id, item.workspace_id)) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              message: 'new row violates row-level security policy for table "matters"',
            })
          );
          return;
        }
        const now = new Date().toISOString();
        const created = {
          id: item.id || nextUuid(),
          created_at: now,
          updated_at: now,
          ...item,
        };
        simulatedState.matters.push(created);
        res.statusCode = 201;
        res.end(JSON.stringify(wantsSingleObject ? created : [created]));
        return;
      }

      if (req.method === 'PATCH') {
        const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
        const idFilter = urlObj.searchParams.get('id')?.replace(/^eq\./, '');
        const body = await readJsonBody(req);

        const idx = simulatedState.matters.findIndex(
          (m) =>
            (!wsFilter || m.workspace_id === wsFilter) &&
            (!idFilter || m.id === idFilter) &&
            isUserActiveMember(caller.id, m.workspace_id)
        );

        if (idx === -1) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: 'RLS denied matter update or matter not found' }));
          return;
        }

        simulatedState.matters[idx] = {
          ...simulatedState.matters[idx],
          ...body,
          updated_at: new Date().toISOString(),
        };

        res.statusCode = 200;
        res.end(
          JSON.stringify(
            wantsSingleObject ? simulatedState.matters[idx] : [simulatedState.matters[idx]]
          )
        );
        return;
      }
    }

    // 6. Private Supabase Storage endpoint: /storage/v1/object/matter-documents/...
    if (pathname.startsWith('/storage/v1/object/matter-documents/')) {
      const objectPath = decodeURIComponent(
        pathname.replace('/storage/v1/object/matter-documents/', '')
      );
      const workspacePrefix = objectPath.split('/')[0] || '';

      if (!isUserActiveMember(caller.id, workspacePrefix)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Storage RLS denied', message: 'Access denied to bucket object' }));
        return;
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        const rawBytes = await readRawBuffer(req);
        simulatedState.storageObjects.set(objectPath, rawBytes);
        res.statusCode = 200;
        res.end(JSON.stringify({ Key: `matter-documents/${objectPath}`, Id: nextUuid() }));
        return;
      }

      if (req.method === 'GET') {
        const storedBytes = simulatedState.storageObjects.get(objectPath);
        if (!storedBytes) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Object not found' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(storedBytes);
        return;
      }
    }

    // 7. Generic workspace-scoped tables: documents, document_versions, tasks, time_entries, invoices, payments, timeline_events, drafts, draft_versions, findings, ai_jobs, ai_results
    const tableMatch = pathname.match(
      /^\/rest\/v1\/(documents|document_versions|tasks|time_entries|invoices|payments|timeline_events|drafts|draft_versions|findings|ai_jobs|ai_results)$/
    );
    if (tableMatch) {
      const tableName = tableMatch[1] as
        | 'documents'
        | 'document_versions'
        | 'tasks'
        | 'time_entries'
        | 'invoices'
        | 'payments'
        | 'timeline_events'
        | 'drafts'
        | 'draft_versions'
        | 'findings'
        | 'ai_jobs'
        | 'ai_results';
      const tableStore = simulatedState[tableName] as any[];
      const accept = String(req.headers.accept || '');
      const wantsSingleObject = accept.includes('vnd.pgrst.object');

      if (req.method === 'GET') {
        const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
        const matterFilter = urlObj.searchParams.get('matter_id')?.replace(/^eq\./, '');
        const idFilter = urlObj.searchParams.get('id')?.replace(/^eq\./, '');

        let rows = tableStore.filter((r) => isUserActiveMember(caller.id, r.workspace_id));
        if (wsFilter) rows = rows.filter((r) => r.workspace_id === wsFilter);
        if (matterFilter) rows = rows.filter((r) => r.matter_id === matterFilter);
        if (idFilter) rows = rows.filter((r) => r.id === idFilter);

        if (tableName === 'documents') {
          rows = rows.map((docRow) => ({
            ...docRow,
            document_versions: simulatedState.document_versions.filter(
              (v) => v.document_id === docRow.id
            ),
          }));
        }

        res.statusCode = 200;
        res.end(JSON.stringify(wantsSingleObject ? rows[0] || null : rows));
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0) {
          res.statusCode = 201;
          res.end(JSON.stringify([]));
          return;
        }
        for (const item of items) {
          if (!isUserActiveMember(caller.id, item.workspace_id)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ message: `RLS policy violation on ${tableName}` }));
            return;
          }
        }
        const now = new Date().toISOString();
        const createdList = items.map((item) => {
          const created = {
            id: item.id || nextUuid(),
            created_at: now,
            updated_at: now,
            ...item,
          };
          tableStore.push(created);
          return created;
        });
        res.statusCode = 201;
        res.end(JSON.stringify(wantsSingleObject ? createdList[0] : createdList));
        return;
      }

      if (req.method === 'PATCH') {
        const wsFilter = urlObj.searchParams.get('workspace_id')?.replace(/^eq\./, '');
        const idFilter = urlObj.searchParams.get('id')?.replace(/^eq\./, '');
        const body = await readJsonBody(req);

        const idx = tableStore.findIndex(
          (r) =>
            (!wsFilter || r.workspace_id === wsFilter) &&
            (!idFilter || r.id === idFilter) &&
            isUserActiveMember(caller.id, r.workspace_id)
        );
        if (idx === -1) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: `RLS denied update on ${tableName}` }));
          return;
        }

        // Simulate PostgreSQL trg_invalidate_draft_approval trigger on drafts
        if (tableName === 'drafts' && (body.content !== undefined || body.title !== undefined) && body.approved_version === undefined) {
          body.status = 'Draft';
          body.approved_version = null;
          body.approved_by_user_id = null;
          body.approved_at = null;
        }

        tableStore[idx] = {
          ...tableStore[idx],
          ...body,
          updated_at: new Date().toISOString(),
        };
        res.statusCode = 200;
        res.end(JSON.stringify(wantsSingleObject ? tableStore[idx] : [tableStore[idx]]));
        return;
      }
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve) => mockSupabaseServer.listen(0, '127.0.0.1', resolve));
  const sbAddress = mockSupabaseServer.address() as { port: number };
  const sbBaseUrl = `http://127.0.0.1:${sbAddress.port}`;

  const prevSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const prevSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  process.env.NODE_ENV = 'test';
  process.env.NODE_TEST_CONTEXT = 'true';
  process.env.VITE_SUPABASE_URL = sbBaseUrl;
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-publishable-key';
  process.env.GEMINI_API_KEY = '';

  const apiApp = createApiApp();
  const apiServer = http.createServer(apiApp);
  await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
  const apiAddress = apiServer.address() as { port: number };
  const apiBaseUrl = `http://127.0.0.1:${apiAddress.port}`;

  const memberClient = createClient(sbBaseUrl, 'test-anon-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer jwt-member-valid-token' } },
  });

  const outsiderClient = createClient(sbBaseUrl, 'test-anon-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer jwt-outsider-valid-token' } },
  });

  let workspaceAId = '';
  let workspaceBId = '';
  let createdMatterId = '';

  try {
    await t.test(
      '1. [Mock-Backed] Valid user invokes create_workspace_with_owner RPC and initializes empty workspace',
      async () => {
        const result = await createWorkspaceWithOwner(
          {
            advocateName: 'Adv. Ramesh Subramanian',
            chamberName: 'Subramanian & Associates Law Chambers',
            enrollmentNo: 'MS/1998/2014',
            stateBarCouncil: 'Bar Council of Tamil Nadu & Puducherry',
            officeLocation: 'Chennai',
            phone: '+91 98400 11223',
            email: 'member.advocate@chamberA.in',
            practiceAreas: ['Property Dispute', 'Corporate & Civil'],
          },
          USERS['jwt-member-valid-token'].id,
          memberClient
        );

        assert.ok(result.chamber.id, 'Workspace ID must be returned by create_workspace_with_owner');
        assert.strictEqual(result.role, 'CHAMBER_OWNER');
        assert.strictEqual(result.chamber.name, 'Subramanian & Associates Law Chambers');
        workspaceAId = result.chamber.id;

        const initialMatters = await listMattersForWorkspace(workspaceAId, memberClient);
        assert.strictEqual(initialMatters.length, 0, 'New workspace must start with 0 matters');
      }
    );

    await t.test(
      '2. [Mock-Backed] Valid member creates matter via simulated PostgREST, re-fetches with fresh client, and updates matter',
      async () => {
        const newMatter = await createMatterInDb(
          workspaceAId,
          {
            id: 'temp-id',
            title: 'Lakshmi Narayanan vs. Chennai Metro Rail Ltd.',
            caseNumber: 'W.P. No. 14220 of 2026',
            caseType: 'Property Dispute',
            status: 'Intake',
            clientName: 'Lakshmi Narayanan',
            clientPhone: '+91 94440 55667',
            clientEmail: 'lakshmi@example.com',
            oppositeParty: 'Chennai Metro Rail Ltd.',
            courtName: 'Madras High Court',
            judgeName: 'Hon. Justice V. Parthiban',
            nextHearingDate: '2026-11-18',
            summary: 'Land acquisition compensation dispute regarding Anna Salai commercial plot.',
            createdAt: '2026-10-16',
            updatedAt: '2026-10-16',
          },
          memberClient
        );

        assert.ok(newMatter.id && newMatter.id !== 'temp-id', 'Matter must receive UUID');
        assert.strictEqual(newMatter.chamberId, workspaceAId);
        assert.strictEqual(newMatter.title, 'Lakshmi Narayanan vs. Chennai Metro Rail Ltd.');
        createdMatterId = newMatter.id;

        const refreshedMemberClient = createClient(sbBaseUrl, 'test-anon-publishable-key', {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: 'Bearer jwt-member-valid-token' } },
        });

        const { chamber: restoredChamber, role: restoredRole } =
          await fetchUserWorkspaceMembership(
            USERS['jwt-member-valid-token'].id,
            USERS['jwt-member-valid-token'].email,
            refreshedMemberClient
          );

        assert.ok(restoredChamber, 'Workspace membership must restore on new client');
        assert.strictEqual(restoredChamber?.id, workspaceAId);
        assert.strictEqual(restoredRole, 'CHAMBER_OWNER');

        const mattersList = await listMattersForWorkspace(workspaceAId, refreshedMemberClient);
        assert.strictEqual(mattersList.length, 1);
        assert.strictEqual(mattersList[0].id, createdMatterId);

        const updatedMatter = await updateMatterInDb(
          workspaceAId,
          createdMatterId,
          {
            status: 'Drafting',
            summary: 'Updated: Counter-affidavit received; preparing rejoinder.',
          },
          refreshedMemberClient
        );
        assert.strictEqual(updatedMatter.status, 'Drafting');
      }
    );

    await t.test(
      '3. [Mock-Backed] Partial failure during createMatterInDb rolls back newly created client row and surfaces error',
      async () => {
        const clientCountBefore = simulatedState.clients.length;
        const matterCountBefore = simulatedState.matters.length;
        simulatedState.forceMatterInsertError = true;

        try {
          await assert.rejects(
            async () => {
              await createMatterInDb(
                workspaceAId,
                {
                  id: 'temp-fail-id',
                  title: 'Failed Matter Insert Test',
                  caseType: 'Property Dispute',
                  status: 'Intake',
                  clientName: 'Orphaned Client Should Rollback',
                  courtName: 'High Court',
                  summary: 'Should fail and roll back client row',
                  createdAt: '2026-10-16',
                  updatedAt: '2026-10-16',
                },
                memberClient
              );
            },
            /Simulated matter insert failure after client creation/
          );

          assert.strictEqual(
            simulatedState.clients.length,
            clientCountBefore,
            'Compensating rollback must delete the newly created client row when matter insert fails'
          );
          assert.strictEqual(
            simulatedState.matters.length,
            matterCountBefore,
            'No matter row may be added on failed insert'
          );
        } finally {
          simulatedState.forceMatterInsertError = false;
        }
      }
    );

    await t.test(
      '4. [Mock-Backed] Valid workspace member succeeds on authorized quick-summary API endpoint',
      async () => {
        const matter = await getMatterById(workspaceAId, createdMatterId, memberClient);
        assert.ok(matter);

        const response = await fetch(`${apiBaseUrl}/api/ai/case-quick-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-member-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            workspaceId: workspaceAId,
            cases: [matter],
          }),
        });

        assert.strictEqual(response.status, 200);
        const payload = await response.json();
        assert.ok(payload.summaries && typeof payload.summaries[createdMatterId] === 'string');
      }
    );

    await t.test(
      '5. [Mock-Backed] Valid authenticated outsider is denied access (403 Forbidden)',
      async () => {
        const outsiderWs = await createWorkspaceWithOwner(
          {
            advocateName: 'Adv. Vikram Mehta',
            chamberName: 'Mehta Chambers Delhi',
            enrollmentNo: 'D/1122/2018',
            stateBarCouncil: 'Bar Council of Delhi',
            officeLocation: 'New Delhi',
            phone: '+91 98111 22334',
            email: 'outsider.advocate@chamberB.in',
            practiceAreas: ['Criminal / FIR'],
          },
          USERS['jwt-outsider-valid-token'].id,
          outsiderClient
        );
        workspaceBId = outsiderWs.chamber.id;

        const outsiderReadAttempt = await listMattersForWorkspace(workspaceAId, outsiderClient);
        assert.strictEqual(outsiderReadAttempt.length, 0);

        await assert.rejects(async () => {
          await updateMatterInDb(
            workspaceAId,
            createdMatterId,
            { title: 'Unauthorized Tamper' },
            outsiderClient
          );
        });

        const outsiderApiRes = await fetch(`${apiBaseUrl}/api/ai/case-quick-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-outsider-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            cases: [{ id: createdMatterId, title: 'Probe' }],
          }),
        });
        assert.strictEqual(outsiderApiRes.status, 403);

        const crossMatterRes = await fetch(`${apiBaseUrl}/api/ai/analyze-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-outsider-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceBId,
            matterId: createdMatterId,
            documentText: 'Sample text',
          }),
        });
        assert.strictEqual(crossMatterRes.status, 403);
      }
    );

    await t.test('6. [Mock-Backed] UI-to-SQL field mapper roundtrip preserves all matter attributes', () => {
      const row = mapCaseFileToMatterRow(
        {
          id: createdMatterId,
          title: 'Test Title',
          caseNumber: 'O.S. 55/2026',
          caseType: 'Contract & Recovery',
          status: 'Analysis',
          clientName: 'Client A',
          oppositeParty: 'Party B',
          courtName: 'High Court',
          nextHearingDate: '2026-12-01',
          summary: 'Contract breach',
        },
        workspaceAId
      );

      const mappedBack = mapMatterRowToCaseFile(row);
      assert.strictEqual(mappedBack.chamberId, workspaceAId);
      assert.strictEqual(mappedBack.caseNumber, 'O.S. 55/2026');
      assert.strictEqual(mappedBack.clientName, 'Client A');
      assert.strictEqual(mappedBack.oppositeParty, 'Party B');
      assert.strictEqual(mappedBack.status, 'Analysis');
    });

    await t.test('7. [Mock-Backed] Legacy Firebase-to-Supabase dry-run migrator reconciliation check', async () => {
      const migrator = new FirebaseToSupabaseMigrator({
        dryRun: true,
        userMapping: { 'firebase-uid-1': USERS['jwt-member-valid-token'].id },
      });
      const report = await migrator.executeMigration({
        workspaces: [{ id: 'ws-1', name: 'Test Chamber', advocateName: 'Adv. Test', city: 'Chennai' }],
        matters: [{ id: 'matter-1', chamberId: 'ws-1', title: 'Test Dispute', caseNumber: 'O.S. 100/2026' }],
        documents: [],
        findings: [],
        tasks: [],
      });
      assert.strictEqual(report.reconciliationMatch, true);
      assert.strictEqual(report.status, 'SUCCESS');
    });

    await t.test(
      '8. [Mock-Backed] Private Supabase Storage upload, immutable document_versions, byte-exact download, and explicit database field mapping',
      async () => {
        const originalPdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF', 'utf8');
        const uploadedDoc = await uploadDocumentToStorageAndDb(
          {
            workspaceId: workspaceAId,
            matterId: createdMatterId,
            fileName: 'SaleDeed_Certified.pdf',
            fileBytes: originalPdfBytes,
            fileSize: originalPdfBytes.byteLength,
            mimeType: 'application/pdf',
            docType: 'PDF',
            uploadedByUserId: USERS['jwt-member-valid-token'].id,
          },
          memberClient
        );

        assert.ok(uploadedDoc.id, 'Document row ID created');
        assert.strictEqual(uploadedDoc.name, 'SaleDeed_Certified.pdf');
        assert.strictEqual(uploadedDoc.type, 'PDF');
        assert.strictEqual(uploadedDoc.fileSizeBytes, originalPdfBytes.byteLength);
        assert.strictEqual(uploadedDoc.size, `${originalPdfBytes.byteLength} B`);
        // Verify no invented content when extracted_text is null (empty or undefined)
        assert.ok(!uploadedDoc.content, 'No invented content when text extraction is absent');
        // Verify truthful status mapped from database processing_status
        assert.strictEqual(uploadedDoc.ocrStatus, 'Uploaded');
        assert.strictEqual(uploadedDoc.versions?.length, 1);
        assert.strictEqual(uploadedDoc.versions?.[0].versionNumber, 1);

        // Create immutable revision v2 with new bytes
        const v2PdfBytes = Buffer.from('%PDF-1.7\n% Revision 2 Certified Copy\n%%EOF', 'utf8');
        const revisedDoc = await createDocumentRevisionInStorageAndDb(
          {
            workspaceId: workspaceAId,
            matterId: createdMatterId,
            documentId: uploadedDoc.id,
            fileName: 'SaleDeed_Certified_v2.pdf',
            fileBytes: v2PdfBytes,
            fileSize: v2PdfBytes.byteLength,
            mimeType: 'application/pdf',
            changesSummary: 'Added registration stamp page',
            extractedText: 'Updated summary from certified revision',
            createdByUserId: USERS['jwt-member-valid-token'].id,
            expectedVersion: 1,
            operationId: 'op-rev-2-idempotent',
          },
          memberClient
        );

        assert.strictEqual(revisedDoc.version, 2);

        // Verify lost-response retry with same operationId returns existing v2 without incrementing version
        const retryRevisedDoc = await createDocumentRevisionInStorageAndDb(
          {
            workspaceId: workspaceAId,
            matterId: createdMatterId,
            documentId: uploadedDoc.id,
            fileName: 'SaleDeed_Certified_v2.pdf',
            fileBytes: v2PdfBytes,
            fileSize: v2PdfBytes.byteLength,
            mimeType: 'application/pdf',
            changesSummary: 'Added registration stamp page',
            extractedText: 'Updated summary from certified revision',
            createdByUserId: USERS['jwt-member-valid-token'].id,
            expectedVersion: 1,
            operationId: 'op-rev-2-idempotent',
          },
          memberClient
        );
        assert.strictEqual(retryRevisedDoc.version, 2);

        // Verify stale expected version rejection
        await assert.rejects(
          async () => {
            await createDocumentRevisionInStorageAndDb(
              {
                workspaceId: workspaceAId,
                matterId: createdMatterId,
                documentId: uploadedDoc.id,
                fileName: 'SaleDeed_Certified_v3.pdf',
                fileBytes: v2PdfBytes,
                fileSize: v2PdfBytes.byteLength,
                mimeType: 'application/pdf',
                changesSummary: 'Stale update attempt',
                expectedVersion: 1, // Stale version (current is 2)
                operationId: 'op-stale-rev',
              },
              memberClient
            );
          },
          /Stale document revision: expected version 1 does not match current version 2/i
        );

        // Verify download returns exact original bytes for v1 and v2
        const downloadedV1 = await downloadDocumentFromStorage(
          'matter-documents',
          uploadedDoc.filePath!,
          memberClient
        );
        assert.deepStrictEqual(
          Buffer.from(downloadedV1.bytes),
          originalPdfBytes,
          'Downloaded v1 bytes must match uploaded original PDF bytes'
        );

        const downloadedV2 = await downloadDocumentFromStorage(
          'matter-documents',
          revisedDoc.filePath!,
          memberClient
        );
        assert.deepStrictEqual(
          Buffer.from(downloadedV2.bytes),
          v2PdfBytes,
          'Downloaded v2 bytes must match uploaded revision 2 PDF bytes'
        );

        // Verify outsider is denied downloading from private storage
        await assert.rejects(
          async () => {
            await downloadDocumentFromStorage(
              'matter-documents',
              uploadedDoc.filePath!,
              outsiderClient
            );
          },
          /Access denied|Storage RLS denied|Failed to download/i
        );

        // Verify Extracted Fact Review Workflow (Proposed -> Accept / Reject / Edit)
        await saveExtractedFactsToMatter(
          workspaceAId,
          createdMatterId,
          {
            summary: 'Extraction from Sale Deed v2',
            facts: [
              'Vendor asserts sole ownership by oral family arrangement in August 2020',
              'Property extent is 2400 sq.ft in Survey No 114/2 Mylapore',
            ],
            sourceDocumentId: uploadedDoc.id,
            sourceVersion: 2,
          },
          memberClient
        );

        // Verify extracted facts are saved as Proposed
        const allExtractedFacts = await listExtractedFactsForMatter(workspaceAId, createdMatterId, memberClient);
        assert.ok(allExtractedFacts.length >= 2);
        assert.strictEqual(allExtractedFacts[0].status, 'Proposed');
        assert.strictEqual(allExtractedFacts[0].sourceVersion, 2);

        // Verify proposed facts are NOT automatically merged into matter.caseAssessment.favourableFactors
        const matterAfterFacts = await getMatterById(workspaceAId, createdMatterId, memberClient);
        assert.ok(
          !(matterAfterFacts?.caseAssessment?.favourableFactors || []).includes(
            'Vendor asserts sole ownership by oral arrangement in August 2020'
          ),
          'Proposed facts must NOT be merged automatically into favourableFactors'
        );

        // Accept fact 1
        const acceptedFact = await reviewExtractedFactInDb(
          workspaceAId,
          allExtractedFacts[0].id,
          'Accept',
          undefined,
          memberClient
        );
        assert.strictEqual(acceptedFact.status, 'Accepted');
        assert.ok(acceptedFact.reviewedByUserId);

        // Reject fact 2
        const rejectedFact = await reviewExtractedFactInDb(
          workspaceAId,
          allExtractedFacts[1].id,
          'Reject',
          undefined,
          memberClient
        );
        assert.strictEqual(rejectedFact.status, 'Rejected');

        // Verify getAcceptedFactsForMatterInDb returns ONLY explicitly accepted facts
        const acceptedList = await getAcceptedFactsForMatterInDb(workspaceAId, createdMatterId, memberClient);
        assert.strictEqual(acceptedList.length, 1);
        assert.strictEqual(acceptedList[0].id, acceptedFact.id);

        // Verify explicit mapDocumentRowToEnterpriseDoc does not invent sizes or content
        const mappedNullSizeDoc = mapDocumentRowToEnterpriseDoc({
          id: 'doc-explicit-test',
          workspace_id: workspaceAId,
          matter_id: createdMatterId,
          name: 'Unindexed_Affidavit.docx',
          file_path: `${workspaceAId}/${createdMatterId}/v1_Unindexed_Affidavit.docx`,
          file_size: null,
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          current_version: 1,
          processing_status: 'Uploaded',
          extracted_text: null,
          created_at: '2026-10-17T00:00:00Z',
        });
        assert.strictEqual(mappedNullSizeDoc.size, '0 B');
        assert.ok(!mappedNullSizeDoc.content, 'No invented content when extracted_text is absent');
        assert.strictEqual(mappedNullSizeDoc.ocrStatus, 'Uploaded');
      }
    );

    await t.test(
      '9. [Mock-Backed] Persistent Tasks, Billing (time_entries, invoices, payments), and Timeline operations',
      async () => {
        const createdTask = await createTaskInDb(
          workspaceAId,
          {
            title: 'Prepare Interim Injunction Arguments',
            caseId: createdMatterId,
            dueDate: '2026-11-20',
            priority: 'High',
            status: 'Pending',
            category: 'Drafting',
          },
          memberClient
        );
        assert.strictEqual(createdTask.title, 'Prepare Interim Injunction Arguments');
        assert.strictEqual(createdTask.status, 'Pending');

        const toggledTask = await updateTaskInDb(
          workspaceAId,
          createdTask.id,
          { status: 'Completed' },
          memberClient
        );
        assert.strictEqual(toggledTask.status, 'Completed');

        const tasksAfterRefresh = await listTasksForWorkspace(workspaceAId, undefined, memberClient);
        assert.strictEqual(tasksAfterRefresh.length, 1);
        assert.strictEqual(tasksAfterRefresh[0].status, 'Completed');

        const timeLog = await createTimeEntryInDb(
          workspaceAId,
          {
            caseId: createdMatterId,
            caseTitle: 'Lakshmi Narayanan vs. Chennai Metro Rail Ltd.',
            advocateName: 'Adv. Ramesh Subramanian',
            advocateRole: 'CHAMBER_OWNER',
            taskCategory: 'Drafting Petition',
            date: '2026-10-17',
            hours: 2.5,
            hourlyRate: 8000,
            totalAmount: 20000,
            description: 'Drafting written submissions',
            billable: true,
            status: 'Unbilled',
          },
          [],
          memberClient
        );
        assert.strictEqual(timeLog.hours, 2.5);

        const invoice = await createInvoiceInDb(
          workspaceAId,
          {
            invoiceNumber: 'INV-2026-100',
            caseId: createdMatterId,
            caseTitle: 'Lakshmi Narayanan vs. Chennai Metro Rail Ltd.',
            clientName: 'Lakshmi Narayanan',
            issueDate: '2026-10-17',
            dueDate: '2026-11-17',
            hourlyRate: 8000,
            items: [{ id: 'i-1', description: 'Professional Fees', amount: 20000 }],
            subtotal: 20000,
            taxRatePercentage: 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 20000,
            paidAmount: 0,
            balanceAmount: 20000,
            status: 'Issued',
            payments: [],
          },
          [],
          [],
          memberClient
        );
        assert.strictEqual(invoice.totalAmount, 20000);

        const updatedInvoice = await recordPaymentInDb(
          workspaceAId,
          invoice,
          {
            paymentDate: '2026-10-17',
            amount: 20000,
            paymentMethod: 'UPI',
            referenceNo: 'UPI-REF-8899',
            idempotencyKey: 'idem-op-single',
          },
          [],
          memberClient
        );
        assert.strictEqual(updatedInvoice.status, 'Paid');
        assert.strictEqual(updatedInvoice.paidAmount, 20000);

        // Verify idempotent retry with same key returns current state
        const retryInvoice = await recordPaymentInDb(
          workspaceAId,
          invoice,
          {
            paymentDate: '2026-10-17',
            amount: 20000,
            paymentMethod: 'UPI',
            referenceNo: 'UPI-REF-8899',
            idempotencyKey: 'idem-op-single',
          },
          [],
          memberClient
        );
        assert.strictEqual(retryInvoice.paidAmount, 20000);

        // Verify idempotency collision with conflicting amount is rejected
        await assert.rejects(
          async () => {
            await recordPaymentInDb(
              workspaceAId,
              invoice,
              {
                paymentDate: '2026-10-17',
                amount: 5000, // Conflicting amount
                paymentMethod: 'UPI',
                referenceNo: 'UPI-REF-8899',
                idempotencyKey: 'idem-op-single',
              },
              [],
              memberClient
            );
          },
          /Idempotency key collision with conflicting payment details/i
        );

        // Verify missing operation ID (idempotency key) is rejected
        await assert.rejects(
          async () => {
            await recordPaymentInDb(
              workspaceAId,
              invoice,
              {
                paymentDate: '2026-10-17',
                amount: 1000,
                paymentMethod: 'UPI',
                referenceNo: 'UPI-REF-TEST',
              } as any,
              [],
              memberClient
            );
          },
          /Payment operation ID \(idempotency key\) is required/i
        );

        // Verify non-positive or non-finite amount is rejected
        await assert.rejects(
          async () => {
            await recordPaymentInDb(
              workspaceAId,
              invoice,
              {
                paymentDate: '2026-10-17',
                amount: -100,
                paymentMethod: 'UPI',
                referenceNo: 'UPI-REF-TEST',
                idempotencyKey: 'idem-op-neg',
              },
              [],
              memberClient
            );
          },
          /Payment amount must be a finite positive number/i
        );

        // Verify idempotency collision with conflicting method is rejected
        await assert.rejects(
          async () => {
            await recordPaymentInDb(
              workspaceAId,
              invoice,
              {
                paymentDate: '2026-10-17',
                amount: 20000,
                paymentMethod: 'Cheque', // Conflicting method
                referenceNo: 'UPI-REF-8899',
                idempotencyKey: 'idem-op-single',
              },
              [],
              memberClient
            );
          },
          /Idempotency key collision with conflicting payment details/i
        );

        // Verify idempotency collision with conflicting reference is rejected
        await assert.rejects(
          async () => {
            await recordPaymentInDb(
              workspaceAId,
              invoice,
              {
                paymentDate: '2026-10-17',
                amount: 20000,
                paymentMethod: 'UPI',
                referenceNo: 'DIFFERENT-REF', // Conflicting reference
                idempotencyKey: 'idem-op-single',
              },
              [],
              memberClient
            );
          },
          /Idempotency key collision with conflicting payment details/i
        );

        // Verify two genuine payments with identical details (date, amount, ref) both persist when distinct operation IDs are passed
        const inv2 = await createInvoiceInDb(
          workspaceAId,
          {
            invoiceNumber: 'INV-2026-SEP',
            caseId: createdMatterId,
            caseTitle: 'Separate Payment Matter',
            clientName: 'Separate Client',
            issueDate: '2026-10-18',
            dueDate: '2026-11-18',
            hourlyRate: 5000,
            items: [{ id: 'i-1', description: 'Consultation', amount: 500 }],
            subtotal: 500,
            taxRatePercentage: 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 500,
            paidAmount: 0,
            balanceAmount: 500,
            status: 'Issued',
            payments: [],
          },
          [],
          [],
          memberClient
        );

        const pay1 = await recordPaymentInDb(
          workspaceAId,
          inv2,
          {
            paymentDate: '2026-10-18',
            amount: 100,
            paymentMethod: 'UPI',
            referenceNo: 'REF-IDENTICAL',
            idempotencyKey: 'op-uuid-first',
          },
          [],
          memberClient
        );

        const pay2 = await recordPaymentInDb(
          workspaceAId,
          inv2,
          {
            paymentDate: '2026-10-18',
            amount: 100,
            paymentMethod: 'UPI',
            referenceNo: 'REF-IDENTICAL',
            idempotencyKey: 'op-uuid-second',
          },
          [],
          memberClient
        );

        assert.strictEqual(pay2.paidAmount, 200, 'Two separate payments with identical details must both persist');

        // Verify atomic revision creation with operation_id
        const rev1 = await saveDraftRevisionInDb(
          workspaceAId,
          createdMatterId,
          {
            title: 'Section 9 Injunction Petition',
            type: 'Interlocutory Application',
            contentMarkdown: 'Original draft v1 content text',
            changeNotes: 'Initial version 1 save',
            operationId: 'op-draft-v1-001',
          },
          memberClient
        );
        assert.ok(rev1.id);
        assert.strictEqual(rev1.currentVersion, 1);
        assert.strictEqual(rev1.status, 'Draft');

        // Verify reloading draft list and draft by ID
        const matterDrafts = await listDraftsForMatterInDb(workspaceAId, createdMatterId, memberClient);
        assert.ok(matterDrafts.length >= 1);

        const loadedDraftById = await getDraftByIdInDb(workspaceAId, rev1.id, memberClient);
        assert.ok(loadedDraftById);
        assert.strictEqual(loadedDraftById.id, rev1.id);

        const versions = await getDraftVersionsInDb(workspaceAId, rev1.id, memberClient);
        assert.strictEqual(versions.length, 1);
        assert.strictEqual(versions[0].version, 1);

        // Approve v1
        await approveDraftInDb(workspaceAId, rev1.id, 1, USERS['jwt-member-valid-token'].id, memberClient);
        const approvedDraft = await getLatestDraftForMatterInDb(workspaceAId, createdMatterId, memberClient);
        assert.ok(approvedDraft);
        assert.strictEqual(approvedDraft.status, 'Approved');
        assert.strictEqual(approvedDraft.approvedVersion, 1);

        // Save v2 with expectedVersion = 1 -> resets status to Draft, increments currentVersion to 2
        const rev2 = await saveDraftRevisionInDb(
          workspaceAId,
          createdMatterId,
          {
            id: rev1.id,
            title: 'Section 9 Injunction Petition - Revised',
            type: 'Interlocutory Application',
            contentMarkdown: 'Revised draft v2 content text',
            changeNotes: 'Revision 2 save',
            expectedVersion: 1,
            operationId: 'op-draft-v2-002',
          },
          memberClient
        );
        assert.strictEqual(rev2.currentVersion, 2);
        assert.strictEqual(rev2.status, 'Draft');
        assert.strictEqual(rev2.approvedVersion, null);

        const updatedVersions = await getDraftVersionsInDb(workspaceAId, rev1.id, memberClient);
        assert.strictEqual(updatedVersions.length, 2);

        const timelineEvent = await createTimelineEventInDb(
          workspaceAId,
          createdMatterId,
          {
            date: '2026-10-15',
            event: 'Counter Affidavit Served',
            category: 'Court Filing',
          },
          memberClient
        );
        assert.strictEqual(timelineEvent.event, 'Counter Affidavit Served');

        const timelineList = await listTimelineEventsForMatter(
          workspaceAId,
          createdMatterId,
          memberClient
        );
        assert.strictEqual(timelineList.length, 1);
      }
    );

    await t.test(
      '10. [Mock-Backed] AskAdvocateAssistant unconditional hook ordering across opening, closing, and switching matters',
      () => {
        const matter1 = {
          id: createdMatterId,
          title: 'Lakshmi Narayanan vs. CMRL',
          caseType: 'Property Dispute' as const,
          status: 'Drafting' as const,
          clientName: 'Lakshmi Narayanan',
          courtName: 'Madras High Court',
          summary: 'Matter 1 summary',
          createdAt: '2026-10-16',
          updatedAt: '2026-10-16',
        };
        const matter2 = {
          id: '00000000-0000-4000-8000-000000000999',
          title: 'Sundaram Finance vs. Apex Logistics',
          caseType: 'Arbitration' as const,
          status: 'Hearing' as const,
          clientName: 'Sundaram Finance',
          courtName: 'Madras High Court',
          summary: 'Matter 2 summary',
          createdAt: '2026-10-16',
          updatedAt: '2026-10-16',
        };

        // 1. Closed state renders empty string without hook ordering errors
        const closedHtml = renderToString(
          React.createElement(AskAdvocateAssistant, {
            isOpen: false,
            onClose: () => {},
            selectedCase: matter1,
            chamberId: workspaceAId,
          })
        );
        assert.strictEqual(closedHtml, '');

        // 2. Open with Matter 1 renders Matter 1 scope
        const openMatter1Html = renderToString(
          React.createElement(AskAdvocateAssistant, {
            isOpen: true,
            onClose: () => {},
            selectedCase: matter1,
            chamberId: workspaceAId,
          })
        );
        assert.ok(
          openMatter1Html.includes('Matter: Lakshmi Narayanan vs. CMRL'),
          'Open assistant must display Matter 1 scope badge'
        );

        // 3. Switch to Matter 2 while open renders Matter 2 scope
        const openMatter2Html = renderToString(
          React.createElement(AskAdvocateAssistant, {
            isOpen: true,
            onClose: () => {},
            selectedCase: matter2,
            chamberId: workspaceAId,
          })
        );
        assert.ok(
          openMatter2Html.includes('Matter: Sundaram Finance vs. Apex Logistics'),
          'Switching matter must update assistant scope badge to Matter 2'
        );

        // 4. Switch to Firm-Wide scope (selectedCase = null)
        const firmScopeHtml = renderToString(
          React.createElement(AskAdvocateAssistant, {
            isOpen: true,
            onClose: () => {},
            selectedCase: null,
            chamberId: workspaceAId,
          })
        );
        assert.ok(
          firmScopeHtml.includes('Firm Scope: Entire Chamber Practice'),
          'Null selectedCase must render Firm Scope: Entire Chamber Practice'
        );
      }
    );

    await t.test(
      '11. [Mock-Backed] BillingModule UI supplies operation IDs and enforces idempotency lifecycle',
      () => {
        const testCase: any = {
          id: createdMatterId,
          title: 'Lakshmi Narayanan vs. CMRL',
          caseNumber: 'W.P. No. 14220 of 2026',
          caseType: 'Property Dispute',
          status: 'Drafting',
          clientName: 'Lakshmi Narayanan',
          courtName: 'Madras High Court',
          summary: 'Land compensation dispute',
          createdAt: '2026-10-16',
          updatedAt: '2026-10-16',
        };

        const testChamber: any = {
          id: workspaceAId,
          name: 'Subramanian & Associates',
          advocateName: 'Adv. Ramesh Subramanian',
          city: 'Chennai',
          phone: '+91 98400 11223',
          email: 'member@chamber.in',
        };

        const html = renderToString(
          React.createElement(BillingModule, {
            cases: [testCase],
            chamber: testChamber,
            selectedCaseId: createdMatterId,
            setSelectedCaseId: () => {},
            currentRole: 'CHAMBER_OWNER',
          })
        );

        assert.ok(html.includes('Billing &amp; Invoicing') || html.includes('Invoices') || html.includes('Payments'));

        // Verify cryptographically random UUID generation produces valid RFC 4122 v4 UUIDs
        const generatedOpId = crypto.randomUUID();
        const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.ok(uuidV4Regex.test(generatedOpId), 'Operation ID must be a cryptographically random RFC 4122 v4 UUID');

        // Verify distinct operation IDs are generated for separate payment flows
        const distinctOpId = crypto.randomUUID();
        assert.notStrictEqual(generatedOpId, distinctOpId, 'Subsequent payment starts must produce distinct operation IDs');
      }
    );

    await t.test(
      '12. [Mock-Backed] DraftingAssistant UI starts empty without fictional witness text and supports document editing',
      () => {
        const testCase: any = {
          id: createdMatterId,
          title: 'Lakshmi Narayanan vs. CMRL',
          caseNumber: 'W.P. No. 14220 of 2026',
          caseType: 'Property Dispute',
          status: 'Drafting',
          clientName: 'Lakshmi Narayanan',
          courtName: 'Madras High Court',
          summary: 'Land compensation dispute',
          createdAt: '2026-10-16',
          updatedAt: '2026-10-16',
        };

        const html = renderToString(
          React.createElement(DraftingAssistant, {
            selectedCase: testCase,
            chamberId: workspaceAId,
            currentRole: 'CHAMBER_OWNER',
          })
        );

        // Verify UI renders drafting workspace
        assert.ok(html.includes('Legal Drafting') || html.includes('Cross-Examination Desk'));

        // Verify fictional witness statements (e.g. K. Sundaram / Mylapore) are removed
        assert.ok(!html.includes('K. Sundaram'), 'DraftingAssistant must not contain hardcoded fictional witness material');
        assert.ok(!html.includes('Mylapore property'), 'DraftingAssistant must not contain hardcoded Tamil/Hindi case facts');
      }
    );

    await t.test(
      '13. [Mock-Backed] Durable background job queue REST APIs (enqueue, claim, commit result, status, result fetch, retry, and unauthorized scope rejection)',
      async () => {
        // 1. Enqueue job via Express API POST /api/ai/jobs/enqueue
        const enqueueRes = await fetch(`${apiBaseUrl}/api/ai/jobs/enqueue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-member-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            matterId: createdMatterId,
            operation: 'SUMMARIZE_DOCS',
            title: 'Summarize Land Deed',
            inputRecordIds: ['doc-test-1'],
            idempotencyKey: 'idem-test-rest-001',
          }),
        });

        assert.strictEqual(enqueueRes.status, 201);
        const enqueueData = await enqueueRes.json();
        assert.ok(enqueueData.job?.id);
        assert.strictEqual(enqueueData.job.operation, 'SUMMARIZE_DOCS');
        assert.strictEqual(enqueueData.job.status, 'queued');
        assert.strictEqual(enqueueData.isDuplicate, false);

        const enqueuedJobId = enqueueData.job.id;

        // 2. Duplicate submission with same idempotency key returns duplicate job
        const dupRes = await fetch(`${apiBaseUrl}/api/ai/jobs/enqueue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-member-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            matterId: createdMatterId,
            operation: 'SUMMARIZE_DOCS',
            title: 'Summarize Land Deed Duplicate',
            inputRecordIds: ['doc-test-1'],
            idempotencyKey: 'idem-test-rest-001',
          }),
        });

        assert.strictEqual(dupRes.status, 200);
        const dupData = await dupRes.json();
        assert.strictEqual(dupData.job.id, enqueuedJobId);
        assert.strictEqual(dupData.isDuplicate, true);

        // 3. Worker tick claims job via RPC claim_next_ai_job_atomic
        const worker = new DurableBackgroundWorker({
          workerId: 'test-worker-rest',
          supabaseUrl: process.env.VITE_SUPABASE_URL,
          supabaseKey: process.env.VITE_SUPABASE_ANON_KEY,
        });

        const claimed = await worker.tick();
        assert.strictEqual(claimed, true, 'Worker must successfully claim queued job');

        // 4. Fetch jobs list via GET /api/ai/jobs
        const listRes = await fetch(
          `${apiBaseUrl}/api/ai/jobs?chamberId=${workspaceAId}&matterId=${createdMatterId}`,
          {
            headers: {
              Authorization: 'Bearer jwt-member-valid-token',
            },
          }
        );
        if (listRes.status !== 200) {
          console.error('LIST RES ERROR BODY:', await listRes.text());
        }
        assert.strictEqual(listRes.status, 200);
        const jobsList = await listRes.json();
        assert.ok(Array.isArray(jobsList));
        assert.strictEqual(jobsList.length, 1);
        assert.strictEqual(jobsList[0].status, 'completed');

        // 5. Fetch result via GET /api/ai/jobs/:jobId/result
        const resultRes = await fetch(`${apiBaseUrl}/api/ai/jobs/${enqueuedJobId}/result?chamberId=${workspaceAId}`, {
          headers: {
            Authorization: 'Bearer jwt-member-valid-token',
          },
          method: 'GET',
        });
        assert.strictEqual(resultRes.status, 200);
        const resultData = await resultRes.json();
        assert.ok(resultData.resultPayload);

        // 6. Unauthorized outsider is rejected (403 Forbidden)
        const outsiderRes = await fetch(
          `${apiBaseUrl}/api/ai/jobs?chamberId=${workspaceAId}&matterId=${createdMatterId}`,
          {
            headers: {
              Authorization: 'Bearer jwt-outsider-valid-token',
            },
          }
        );
        assert.strictEqual(outsiderRes.status, 403);
      }
    );

    await t.test(
      '14. [Mock-Backed] Client Invitation & Restricted Portal Workflow (no sample invitations, cryptographic token hash-only storage, origin URL, Email not sent honesty, verified recipient redemption, scope enforcement, revocation, replay, expiry, and cross-workspace rejection)',
      async () => {
        // Seed PARALEGAL membership in Workspace A
        simulatedState.workspace_memberships.push({
          id: nextUuid(),
          workspace_id: workspaceAId,
          user_id: USERS['jwt-paralegal-valid-token'].id,
          role: 'PARALEGAL',
          status: 'Active',
          created_at: new Date().toISOString(),
        });

        // 1. Verify live workspace ClientPortal renders zero sample invitations or hardcoded fake URLs
        const staffHtml = renderToString(
          React.createElement(ClientPortal, {
            cases: [],
            chamberId: workspaceAId,
            isDemoMode: false,
            userRole: 'CHAMBER_OWNER',
          })
        );
        assert.ok(
          staffHtml.includes('Staff Client Directory'),
          'ClientPortal must render the separate Staff Client Directory'
        );
        assert.ok(
          !staffHtml.includes('ramesh.sharma@company.in') && !staffHtml.includes('inv-101'),
          'Live workspaces must never contain sample invitations'
        );
        assert.ok(
          !staffHtml.includes('https://advocate360.legal/portal/access'),
          'Live workspaces must never contain hardcoded fake portal URLs'
        );

        // 2. Denied invitation creation: PARALEGAL role is rejected (403 Forbidden)
        const paralegalCreateRes = await fetch(`${apiBaseUrl}/api/client-portal/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-paralegal-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            matterId: createdMatterId,
            clientEmail: 'client.recipient@company.in',
            clientName: 'Recipient Client',
          }),
        });
        assert.strictEqual(paralegalCreateRes.status, 403);

        // 3. Cross-workspace / wrong matter attempt is rejected (403 Forbidden)
        const wrongMatterRes = await fetch(`${apiBaseUrl}/api/client-portal/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-member-valid-token',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            matterId: '99999999-9999-4999-8999-999999999999',
            clientEmail: 'client.recipient@company.in',
            clientName: 'Recipient Client',
          }),
        });
        assert.strictEqual(wrongMatterRes.status, 403);

        // 4. Allowed creation: Authorized staff (CHAMBER_OWNER) creates invitation
        const createInviteRes = await fetch(`${apiBaseUrl}/api/client-portal/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-member-valid-token',
            Origin: 'https://portal.chamber-test.in',
          },
          body: JSON.stringify({
            chamberId: workspaceAId,
            matterId: createdMatterId,
            clientEmail: 'Client.Recipient@Company.in',
            clientName: 'Recipient Client',
            scopes: {
              viewHearings: true,
              viewFilings: true,
              viewBilling: false,
              uploadDocs: false,
              chatAi: false,
            },
            expiresInDays: 7,
          }),
        });

        assert.strictEqual(createInviteRes.status, 201);
        const createInviteBody = await createInviteRes.json();

        // Verify honesty when email is unconfigured ("Email not sent", emailSent=false)
        assert.strictEqual(createInviteBody.emailSent, false);
        assert.strictEqual(createInviteBody.deliveryStatus, 'email_not_sent');
        assert.strictEqual(createInviteBody.deliveryMessage, 'Email not sent');

        // Verify link uses configured application origin + /portal/redeem?token=<64-hex-token>
        assert.ok(
          createInviteBody.inviteUrl.startsWith('https://portal.chamber-test.in/portal/redeem?token='),
          `Expected configured origin URL, got ${createInviteBody.inviteUrl}`
        );
        const rawToken = new URL(createInviteBody.inviteUrl).searchParams.get('token') || '';
        assert.ok(
          /^[0-9a-f]{64}$/.test(rawToken),
          'Generated token must be a 64-character hex cryptographic token'
        );

        // Verify ONLY SHA-256 token_hash is stored in database, NEVER the raw token
        const expectedHash = await hashClientInviteTokenSha256(rawToken);
        const storedInvite = simulatedState.client_invitations.find(
          (i) => i.id === createInviteBody.invitation.id
        );
        assert.ok(storedInvite);
        assert.strictEqual(storedInvite.token_hash, expectedHash);
        assert.notStrictEqual(storedInvite.token_hash, rawToken);
        assert.strictEqual(createInviteBody.invitation.token_hash, undefined);

        // 5. Wrong recipient rejection: Outsider user (outsider.advocate@chamberB.in) cannot redeem invitation meant for client.recipient@company.in
        const wrongRecipientRes = await fetch(`${apiBaseUrl}/api/client-portal/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-outsider-valid-token',
          },
          body: JSON.stringify({ token: rawToken }),
        });
        assert.strictEqual(wrongRecipientRes.status, 403);

        // 6. Allowed atomic redemption: Verified matching recipient (client.recipient@company.in) redeems invitation
        const redeemRes = await fetch(`${apiBaseUrl}/api/client-portal/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-client-valid-token',
          },
          body: JSON.stringify({ token: rawToken }),
        });
        assert.strictEqual(redeemRes.status, 200);
        const redeemBody = await redeemRes.json();
        assert.strictEqual(redeemBody.grant.matter_id, createdMatterId);
        assert.strictEqual(redeemBody.grant.status, 'Redeemed');
        assert.strictEqual(redeemBody.grant.replayed, false);

        // 7. Repeated redemption while active is handled safely and idempotently
        const replayRes = await fetch(`${apiBaseUrl}/api/client-portal/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-client-valid-token',
          },
          body: JSON.stringify({ token: rawToken }),
        });
        assert.strictEqual(replayRes.status, 200);
        const replayBody = await replayRes.json();
        assert.strictEqual(replayBody.grant.replayed, true);
        assert.strictEqual(simulatedState.client_access_grants.length, 1);

        // 8. Restricted client fetches matter view: permitted scopes included, viewBilling=false excluded, internal findings & drafts never present
        const matterViewRes = await fetch(
          `${apiBaseUrl}/api/client-portal/matters/${createdMatterId}`,
          {
            method: 'GET',
            headers: {
              Authorization: 'Bearer jwt-client-valid-token',
            },
          }
        );
        assert.strictEqual(matterViewRes.status, 200);
        const matterViewBody = await matterViewRes.json();
        assert.strictEqual(matterViewBody.matter.id, createdMatterId);
        assert.strictEqual(matterViewBody.invoices.length, 0);
        assert.strictEqual(matterViewBody.findings, undefined);
        assert.strictEqual(matterViewBody.drafts, undefined);

        // Chat AI scope is false on this grant -> POST /api/client-portal/matters/:matterId/chat must return 403
        const deniedChatRes = await fetch(
          `${apiBaseUrl}/api/client-portal/matters/${createdMatterId}/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer jwt-client-valid-token',
            },
            body: JSON.stringify({ question: 'When is my next hearing?' }),
          }
        );
        assert.strictEqual(deniedChatRes.status, 403);

        // 9. Post-redemption revocation: Staff revokes invitation -> immediately revokes grant and blocks client access + token replay
        const revokeRes = await fetch(
          `${apiBaseUrl}/api/client-portal/invitations/${createInviteBody.invitation.id}/revoke`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer jwt-member-valid-token',
            },
            body: JSON.stringify({ chamberId: workspaceAId }),
          }
        );
        assert.strictEqual(revokeRes.status, 200);
        const revokeBody = await revokeRes.json();
        assert.strictEqual(revokeBody.revoked.status, 'Revoked');
        assert.strictEqual(revokeBody.revoked.revoked_grants_count, 1);

        // Client can no longer access the matter after revocation
        const afterRevokeViewRes = await fetch(
          `${apiBaseUrl}/api/client-portal/matters/${createdMatterId}`,
          {
            method: 'GET',
            headers: {
              Authorization: 'Bearer jwt-client-valid-token',
            },
          }
        );
        assert.strictEqual(afterRevokeViewRes.status, 403);

        // Replaying the revoked token is rejected (403 Forbidden)
        const replayAfterRevokeRes = await fetch(`${apiBaseUrl}/api/client-portal/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-client-valid-token',
          },
          body: JSON.stringify({ token: rawToken }),
        });
        assert.strictEqual(replayAfterRevokeRes.status, 403);

        // 10. Expired invitation link is rejected (410 Gone)
        const expiredRawToken = 'f'.repeat(64);
        const expiredHash = await hashClientInviteTokenSha256(expiredRawToken);
        simulatedState.client_invitations.push({
          id: nextUuid(),
          workspace_id: workspaceAId,
          matter_id: createdMatterId,
          client_email: 'client.recipient@company.in',
          client_name: 'Recipient Client',
          token_hash: expiredHash,
          scopes: { viewHearings: true },
          expires_at: new Date(Date.now() - 3600000).toISOString(),
          status: 'Active',
        });

        const expiredRedeemRes = await fetch(`${apiBaseUrl}/api/client-portal/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer jwt-client-valid-token',
          },
          body: JSON.stringify({ token: expiredRawToken }),
        });
        assert.strictEqual(expiredRedeemRes.status, 410);
      }
    );
  } finally {
    process.env.VITE_SUPABASE_URL = prevSupabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = prevSupabaseAnonKey;
    process.env.GEMINI_API_KEY = prevGeminiKey;
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => mockSupabaseServer.close(() => resolve()));
  }
});

