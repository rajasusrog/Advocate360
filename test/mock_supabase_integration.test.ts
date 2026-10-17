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
} from '../src/lib/useMatterData';
import { AskAdvocateAssistant } from '../src/components/AskAdvocateAssistant';
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
    assert.ok(files.length >= 2, 'Expected at least 2 sequential migration files');
    assert.strictEqual(files[0], '20261016000001_initial_schema.sql');
    assert.strictEqual(files[1], '20261016000002_hardened_workspace_upgrade.sql');

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

    // 7. Generic workspace-scoped tables: documents, document_versions, tasks, time_entries, invoices, payments, timeline_events
    const tableMatch = pathname.match(
      /^\/rest\/v1\/(documents|document_versions|tasks|time_entries|invoices|payments|timeline_events)$/
    );
    if (tableMatch) {
      const tableName = tableMatch[1] as
        | 'documents'
        | 'document_versions'
        | 'tasks'
        | 'time_entries'
        | 'invoices'
        | 'payments'
        | 'timeline_events';
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
        const item = Array.isArray(body) ? body[0] : body;
        if (!isUserActiveMember(caller.id, item.workspace_id)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ message: `RLS policy violation on ${tableName}` }));
          return;
        }
        const now = new Date().toISOString();
        const created = {
          id: item.id || nextUuid(),
          created_at: now,
          updated_at: now,
          ...item,
        };
        tableStore.push(created);
        res.statusCode = 201;
        res.end(JSON.stringify(wantsSingleObject ? created : [created]));
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
  process.env.VITE_SUPABASE_URL = sbBaseUrl;
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-publishable-key';

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
          },
          memberClient
        );

        assert.strictEqual(revisedDoc.version, 2);

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
          },
          [],
          memberClient
        );
        assert.strictEqual(updatedInvoice.status, 'Paid');
        assert.strictEqual(updatedInvoice.paidAmount, 20000);

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
  } finally {
    process.env.VITE_SUPABASE_URL = prevSupabaseUrl;
    process.env.VITE_SUPABASE_ANON_KEY = prevSupabaseAnonKey;
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => mockSupabaseServer.close(() => resolve()));
  }
});
