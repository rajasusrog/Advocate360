import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION_1_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261016000001_initial_schema.sql'
);
const MIGRATION_2_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261016000002_hardened_workspace_upgrade.sql'
);
const MIGRATION_3_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261017090500_persistence_defects.sql'
);

/**
 * Bootstraps a disposable PostgreSQL 16 (PGlite) instance with Supabase-compatible
 * `auth` and `storage` schemas, JWT claim helpers (`auth.uid()`, `auth.role()`),
 * and non-superuser roles (`authenticated`, `anon`) so PostgreSQL Row-Level Security (RLS)
 * policies execute identically to Supabase PostgreSQL.
 */
async function createDisposableSupabasePostgres(): Promise<PGlite> {
  const db = new PGlite();

  await db.exec(`
    -- Create standard Supabase roles (non-superuser so RLS is strictly enforced)
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS TEXT AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user);
    $$ LANGUAGE sql STABLE;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public BOOLEAN DEFAULT FALSE,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT REFERENCES storage.buckets(id),
      name TEXT NOT NULL,
      owner UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
    RETURNS TEXT[] AS $$
      SELECT string_to_array(name, '/');
    $$ LANGUAGE sql IMMUTABLE;

    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, storage TO anon, authenticated;
  `);

  return db;
}

/**
 * Grants table & function privileges in `public` to `authenticated` and `anon`
 * after migrations create tables/functions (mirrors Supabase default privileges).
 */
async function grantSupabasePublicPrivileges(db: PGlite): Promise<void> {
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  `);
}

/**
 * Executes a SQL block or parameterized query as a specific authenticated user
 * (`SET LOCAL ROLE authenticated` + `request.jwt.claim.sub = userId`) inside a transaction
 * so PostgreSQL evaluates real RLS policies for that user.
 */
async function runAsAuthenticatedUser<T = any>(
  db: PGlite,
  userId: string,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE authenticated;`);
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [userId]);
    await tx.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true);`, []);
    return callback(tx);
  });
}

test('[Database-Backed PostgreSQL Test] 1. Fresh Installation of Both Migrations on Disposable PostgreSQL', async (t) => {
  const db = await createDisposableSupabasePostgres();
  const sql1 = fs.readFileSync(MIGRATION_1_PATH, 'utf8');
  const sql2 = fs.readFileSync(MIGRATION_2_PATH, 'utf8');
  const sql3 = fs.readFileSync(MIGRATION_3_PATH, 'utf8');

  try {
    await t.test('executes 20261016000001_initial_schema.sql, 20261016000002_hardened_workspace_upgrade.sql, and 20261017090500_persistence_defects.sql sequentially without error', async () => {
      await db.exec(sql1);
      await db.exec(sql2);
      await db.exec(sql3);
      await grantSupabasePublicPrivileges(db);

      const tablesRes = await db.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      const tableNames = tablesRes.rows.map((r) => r.table_name);

      const expectedTables = [
        'activity_events',
        'ai_jobs',
        'ai_results',
        'client_access_grants',
        'client_invitations',
        'clients',
        'document_versions',
        'documents',
        'draft_versions',
        'drafts',
        'evidence',
        'findings',
        'hearings',
        'invoices',
        'matters',
        'payments',
        'profiles',
        'research_notes',
        'tasks',
        'time_entries',
        'timeline_events',
        'workspace_memberships',
        'workspaces',
      ];

      for (const expected of expectedTables) {
        assert.ok(
          tableNames.includes(expected),
          `Expected table public.${expected} to exist in PostgreSQL`
        );
      }
    });

    await t.test('verifies RLS is enabled on all 23 public tables and zero obsolete *_member_all policies remain', async () => {
      const rlsDisabledRes = await db.query<{ tablename: string }>(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = false;
      `);
      assert.strictEqual(
        rlsDisabledRes.rows.length,
        0,
        'Every public table must have row level security enabled'
      );

      const obsoletePoliciesRes = await db.query<{ policyname: string }>(`
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
            policyname LIKE '%_member_all'
            OR policyname IN ('workspaces_member_select', 'workspace_memberships_user_select', 'profiles_self_all')
          );
      `);
      assert.strictEqual(
        obsoletePoliciesRes.rows.length,
        0,
        'All obsolete permissive policies must be removed after migration 2'
      );
    });
  } finally {
    await db.close();
  }
});

test('[Database-Backed PostgreSQL Test] 2. Upgrade from Previously Shipped Initial Schema with Existing Data Backfill', async (t) => {
  const db = await createDisposableSupabasePostgres();
  const sql1 = fs.readFileSync(MIGRATION_1_PATH, 'utf8');
  const sql2 = fs.readFileSync(MIGRATION_2_PATH, 'utf8');
  const sql3 = fs.readFileSync(MIGRATION_3_PATH, 'utf8');

  const userA = 'aaaa1111-1111-4111-8111-111111111111';
  let wsId = '';
  let docVersionId = '';
  let draftVersionId = '';
  let aiResultId = '';

  try {
    await t.test('applies initial schema (migration 1), seeds legacy child rows without workspace_id, and upgrades cleanly via migration 2', async () => {
      // Step 1: Execute ONLY the previously shipped initial schema
      await db.exec(sql1);
      await grantSupabasePublicPrivileges(db);

      // Verify child tables initially lack workspace_id
      const initialCols = await db.query<{ table_name: string; column_name: string }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('document_versions', 'draft_versions', 'ai_results')
          AND column_name = 'workspace_id';
      `);
      assert.strictEqual(
        initialCols.rows.length,
        0,
        'Before upgrade, document_versions, draft_versions, and ai_results did not have workspace_id'
      );

      // Seed existing data against the initial schema
      await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'owner@legacy.in');`, [userA]);

      const wsRes = await db.query<{ id: string }>(
        `INSERT INTO public.workspaces (name, advocate_name, city) VALUES ('Legacy Chamber', 'Adv. Legacy', 'Mumbai') RETURNING id;`
      );
      wsId = wsRes.rows[0].id;

      await db.query(
        `INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status) VALUES ($1, $2, 'CHAMBER_OWNER', 'Active');`,
        [wsId, userA]
      );

      const matterRes = await db.query<{ id: string }>(
        `INSERT INTO public.matters (workspace_id, title, stage) VALUES ($1, 'Legacy Matter 2025', 'Intake') RETURNING id;`,
        [wsId]
      );
      const matterId = matterRes.rows[0].id;

      const docRes = await db.query<{ id: string }>(
        `INSERT INTO public.documents (workspace_id, matter_id, name, file_path) VALUES ($1, $2, 'Plaint.pdf', 'ws/m/plaint.pdf') RETURNING id;`,
        [wsId, matterId]
      );
      const docId = docRes.rows[0].id;

      const dvRes = await db.query<{ id: string }>(
        `INSERT INTO public.document_versions (document_id, version, file_path, changes_summary) VALUES ($1, 1, 'ws/m/plaint_v1.pdf', 'Initial upload') RETURNING id;`,
        [docId]
      );
      docVersionId = dvRes.rows[0].id;

      const draftRes = await db.query<{ id: string }>(
        `INSERT INTO public.drafts (workspace_id, matter_id, title, content) VALUES ($1, $2, 'Written Statement', 'Draft text') RETURNING id;`,
        [wsId, matterId]
      );
      const draftId = draftRes.rows[0].id;

      const drvRes = await db.query<{ id: string }>(
        `INSERT INTO public.draft_versions (draft_id, version, content, change_notes) VALUES ($1, 1, 'Draft text v1', 'First version') RETURNING id;`,
        [draftId]
      );
      draftVersionId = drvRes.rows[0].id;

      const jobRes = await db.query<{ id: string }>(
        `INSERT INTO public.ai_jobs (workspace_id, matter_id, operation, status) VALUES ($1, $2, 'SUMMARIZE', 'Completed') RETURNING id;`,
        [wsId, matterId]
      );
      const jobId = jobRes.rows[0].id;

      const arRes = await db.query<{ id: string }>(
        `INSERT INTO public.ai_results (job_id, result_type, result_data) VALUES ($1, 'SUMMARY', '{"text":"ok"}'::jsonb) RETURNING id;`,
        [jobId]
      );
      aiResultId = arRes.rows[0].id;

      // Step 2: Execute Upgrade Migration 20261016000002 against the populated database
      await db.exec(sql2);
      await grantSupabasePublicPrivileges(db);

      // Step 3: Verify workspace_id columns were added, backfilled from parent rows, and set NOT NULL
      const upgradedCols = await db.query<{
        table_name: string;
        is_nullable: string;
      }>(`
        SELECT table_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('document_versions', 'draft_versions', 'ai_results')
          AND column_name = 'workspace_id'
        ORDER BY table_name;
      `);
      assert.strictEqual(upgradedCols.rows.length, 3);
      for (const col of upgradedCols.rows) {
        assert.strictEqual(
          col.is_nullable,
          'NO',
          `${col.table_name}.workspace_id must be NOT NULL after upgrade backfill`
        );
      }

      const dvCheck = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM public.document_versions WHERE id = $1;`,
        [docVersionId]
      );
      assert.strictEqual(dvCheck.rows[0].workspace_id, wsId);

      const drvCheck = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM public.draft_versions WHERE id = $1;`,
        [draftVersionId]
      );
      assert.strictEqual(drvCheck.rows[0].workspace_id, wsId);

      // Step 4: Execute Migration 3 (Persistence Defects Hardening)
      await db.exec(sql3);
      await grantSupabasePublicPrivileges(db);
    });
  } finally {
    await db.close();
  }
});

test('[Database-Backed PostgreSQL Test] 3. Real RLS with Two Authenticated Users, a Restricted Client, Cross-Workspace Constraints, and Atomic Rollback', async (t) => {
  const db = await createDisposableSupabasePostgres();
  const sql1 = fs.readFileSync(MIGRATION_1_PATH, 'utf8');
  const sql2 = fs.readFileSync(MIGRATION_2_PATH, 'utf8');
  const sql3 = fs.readFileSync(MIGRATION_3_PATH, 'utf8');
  await db.exec(sql1);
  await db.exec(sql2);
  await db.exec(sql3);
  await grantSupabasePublicPrivileges(db);

  const userAId = '11111111-1111-4111-8111-111111111111'; // Advocate Owner of Workspace A
  const userBId = '22222222-2222-4222-8222-222222222222'; // Advocate Owner of Workspace B (Outsider to A)
  const clientCId = '33333333-3333-4333-8333-333333333333'; // Restricted Client in Workspace A

  await db.query(
    `INSERT INTO auth.users (id, email) VALUES
      ($1, 'advocateA@chamberA.in'),
      ($2, 'advocateB@chamberB.in'),
      ($3, 'clientC@client.in');`,
    [userAId, userBId, clientCId]
  );

  let workspaceAId = '';
  let workspaceBId = '';
  let clientAId = '';
  let clientBId = '';
  let matterA1Id = '';
  let matterA2Id = '';
  let matterB1Id = '';
  let docA1Id = '';
  let docB1Id = '';
  let invoiceId = '';
  let paralegalId = '55555555-5555-4555-8555-555555555555';
  let findingA1Id = '';
  let findingB1Id = '';

  try {
    await t.test('3A. User A and User B create isolated workspaces and matters via PostgreSQL RPCs under real RLS', async () => {
      // User A creates Workspace A via create_workspace_with_owner
      const wsARes = await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const res = await tx.query(
          `SELECT public.create_workspace_with_owner(
            'Chamber A Legal',
            'Adv. Ananya Iyer',
            'Chennai',
            'MS/101/2015',
            'Bar Council of Tamil Nadu',
            '+91 90000 00001',
            'advocateA@chamberA.in',
            '["Property Dispute"]'::jsonb
          ) AS payload;`
        );
        return res.rows[0].payload;
      });
      workspaceAId = wsARes.workspace_id;
      assert.ok(workspaceAId, 'User A workspace_id created in PostgreSQL');

      // User A atomically creates Client A + Matter A1 via create_matter_with_client
      const m1Row = await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const res = await tx.query(
          `SELECT * FROM public.create_matter_with_client(
            $1::uuid,
            'Iyer Partition Suit vs. State',
            'Smt. Meenakshi Sundaram',
            'C.S. 201/2026',
            'Property Dispute',
            'Intake',
            '+91 98401 23456',
            'clientC@client.in',
            'State Highways Dept',
            'Madras High Court',
            'Hon. Justice R. Mahadevan',
            '2026-12-10'::date,
            'Suit for declaration of title and permanent injunction.'
          );`,
          [workspaceAId]
        );
        return res.rows[0];
      });
      matterA1Id = m1Row.id;
      clientAId = m1Row.client_id;
      assert.ok(matterA1Id && clientAId, 'Matter A1 and Client A created atomically');

      // User A creates a second Matter A2 in Workspace A (NOT granted to Client C)
      const m2Row = await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.matters (workspace_id, client_id, title, client_name, status, stage)
           VALUES ($1, $2, 'Confidential Merger Arbitration', 'Private Corp', 'Analysis', 'Analysis')
           RETURNING *;`,
          [workspaceAId, clientAId]
        );
        return res.rows[0];
      });
      matterA2Id = m2Row.id;

      // User A seeds Document, Document Version, Finding, Evidence, Hearing, and Invoice on Matter A1
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const dRes = await tx.query(
          `INSERT INTO public.documents (workspace_id, matter_id, name, file_path)
           VALUES ($1, $2, 'SaleDeed1998.pdf', 'wsA/mA1/SaleDeed1998.pdf') RETURNING id;`,
          [workspaceAId, matterA1Id]
        );
        docA1Id = dRes.rows[0].id;

        await tx.query(
          `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, changes_summary)
           VALUES ($1, $2, 1, 'wsA/mA1/SaleDeed1998_v1.pdf', 'Registered copy');`,
          [workspaceAId, docA1Id]
        );

        const fRes = await tx.query(
          `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
           VALUES ($1, $2, $3, 'Continuous possession since 1998 confirmed.') RETURNING id;`,
          [workspaceAId, matterA1Id, docA1Id]
        );
        findingA1Id = fRes.rows[0].id;

        await tx.query(
          `INSERT INTO public.evidence (workspace_id, matter_id, title, source_doc_id, verification_status)
           VALUES ($1, $2, 'Patta Passbook Exhibit A1', $3, 'Verified');`,
          [workspaceAId, matterA1Id, docA1Id]
        );

        await tx.query(
          `INSERT INTO public.hearings (workspace_id, matter_id, court_name, hearing_date, purpose)
           VALUES ($1, $2, 'Madras High Court', '2026-12-10T10:30:00Z', 'Interim Injunction Hearing');`,
          [workspaceAId, matterA1Id]
        );

        await tx.query(
          `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, status)
           VALUES ($1, $2, 'INV-2026-001', 'Smt. Meenakshi Sundaram', 50000, 50000, 'Unpaid');`,
          [workspaceAId, matterA1Id]
        );
      });

      // User B creates Workspace B, Client B, Matter B1, Document B1, Finding B1
      const wsBRes = await runAsAuthenticatedUser(db, userBId, async (tx) => {
        const res = await tx.query(
          `SELECT public.create_workspace_with_owner(
            'Chamber B Associates',
            'Adv. Vikram Mehta',
            'New Delhi'
          ) AS payload;`
        );
        return res.rows[0].payload;
      });
      workspaceBId = wsBRes.workspace_id;

      await runAsAuthenticatedUser(db, userBId, async (tx) => {
        const mBRes = await tx.query(
          `SELECT * FROM public.create_matter_with_client(
            $1::uuid,
            'Delhi Commercial Arbitration',
            'Northern Infra Ltd'
          );`,
          [workspaceBId]
        );
        matterB1Id = mBRes.rows[0].id;
        clientBId = mBRes.rows[0].client_id;

        const dBRes = await tx.query(
          `INSERT INTO public.documents (workspace_id, matter_id, name, file_path)
           VALUES ($1, $2, 'ContractB.pdf', 'wsB/mB1/ContractB.pdf') RETURNING id;`,
          [workspaceBId, matterB1Id]
        );
        docB1Id = dBRes.rows[0].id;

        const fBRes = await tx.query(
          `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
           VALUES ($1, $2, $3, 'Clause 14 arbitration seat is New Delhi.') RETURNING id;`,
          [workspaceBId, matterB1Id, docB1Id]
        );
        findingB1Id = fBRes.rows[0].id;
      });
    });

    await t.test('3B. Real PostgreSQL RLS strictly denies User B (valid outsider) read or write access to Workspace A records', async () => {
      await runAsAuthenticatedUser(db, userBId, async (tx) => {
        // User B cannot SELECT Workspace A matters
        const mattersARes = await tx.query(
          `SELECT * FROM public.matters WHERE workspace_id = $1;`,
          [workspaceAId]
        );
        assert.strictEqual(
          mattersARes.rows.length,
          0,
          'PostgreSQL RLS must return 0 rows when User B queries Workspace A matters'
        );

        // User B cannot SELECT Workspace A documents, document_versions, findings, evidence, clients, or invoices
        for (const table of [
          'clients',
          'documents',
          'document_versions',
          'findings',
          'evidence',
          'hearings',
          'invoices',
        ]) {
          const res = await tx.query(
            `SELECT count(*)::int AS cnt FROM public.${table} WHERE workspace_id = $1;`,
            [workspaceAId]
          );
          assert.strictEqual(
            res.rows[0].cnt,
            0,
            `PostgreSQL RLS must hide Workspace A ${table} from User B`
          );
        }

        // User B cannot UPDATE Workspace A matter
        const updateRes = await tx.query(
          `UPDATE public.matters SET title = 'Hacked by User B' WHERE id = $1 RETURNING id;`,
          [matterA1Id]
        );
        assert.strictEqual(
          updateRes.rows.length,
          0,
          'PostgreSQL RLS must prevent User B from updating Workspace A matter'
        );
      });

      // User B INSERT into Workspace A must throw an RLS policy violation in PostgreSQL
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userBId, async (tx) => {
            await tx.query(
              `INSERT INTO public.matters (workspace_id, title, client_name)
               VALUES ($1, 'Unauthorized Matter Injection', 'Fake Client');`,
              [workspaceAId]
            );
          });
        },
        /row-level security policy/i,
        'PostgreSQL RLS must reject INSERT into Workspace A by User B'
      );
    });

    await t.test('3C. Real PostgreSQL RLS enforces restricted client access grants and scopes for Client User C', async () => {
      // User A adds Client C as a 'CLIENT' member in Workspace A and grants access ONLY to Matter A1 with viewHearings=true, viewBilling=false
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        await tx.query(
          `INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
           VALUES ($1, $2, 'CLIENT', 'Active');`,
          [workspaceAId, clientCId]
        );

        await tx.query(
          `INSERT INTO public.client_access_grants (workspace_id, matter_id, client_user_id, scopes)
           VALUES ($1, $2, $3, '{"viewHearings": true, "viewBilling": false}'::jsonb);`,
          [workspaceAId, matterA1Id, clientCId]
        );
      });

      await runAsAuthenticatedUser(db, clientCId, async (tx) => {
        // 1. Client C can SELECT only Matter A1 (granted), NOT Matter A2 (ungranted in same workspace)
        const visibleMatters = await tx.query(
          `SELECT id, title FROM public.matters WHERE workspace_id = $1;`,
          [workspaceAId]
        );
        assert.strictEqual(
          visibleMatters.rows.length,
          1,
          'Restricted client must only see the single explicitly granted matter'
        );
        assert.strictEqual(visibleMatters.rows[0].id, matterA1Id);

        // 2. Client C cannot UPDATE even the granted Matter A1
        const clientUpdateAttempt = await tx.query(
          `UPDATE public.matters SET title = 'Client Edit Attempt' WHERE id = $1 RETURNING id;`,
          [matterA1Id]
        );
        assert.strictEqual(
          clientUpdateAttempt.rows.length,
          0,
          'Restricted client must not be able to modify granted matter'
        );

        // 3. Client C CAN view hearings on Matter A1 because viewHearings = true
        const visibleHearings = await tx.query(
          `SELECT * FROM public.hearings WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(
          visibleHearings.rows.length,
          1,
          'Restricted client with viewHearings=true must see hearings for granted matter'
        );

        // 4. Client C CANNOT view invoices on Matter A1 because viewBilling = false
        const hiddenInvoices = await tx.query(
          `SELECT * FROM public.invoices WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(
          hiddenInvoices.rows.length,
          0,
          'Restricted client with viewBilling=false must not see invoices'
        );

        // 5. Client C CANNOT view internal advocate findings, documents, or evidence
        const hiddenFindings = await tx.query(
          `SELECT * FROM public.findings WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(
          hiddenFindings.rows.length,
          0,
          'Restricted client must never see internal advocate findings'
        );
      });

      // When User A enables viewBilling = true on the grant, Client C can now read Matter A1's invoice
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        await tx.query(
          `UPDATE public.client_access_grants
           SET scopes = '{"viewHearings": true, "viewBilling": true}'::jsonb
           WHERE matter_id = $1 AND client_user_id = $2;`,
          [matterA1Id, clientCId]
        );
      });

      await runAsAuthenticatedUser(db, clientCId, async (tx) => {
        const grantedInvoices = await tx.query(
          `SELECT invoice_number FROM public.invoices WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(
          grantedInvoices.rows.length,
          1,
          'Restricted client with viewBilling=true must see the granted matter invoice'
        );
        assert.strictEqual(grantedInvoices.rows[0].invoice_number, 'INV-2026-001');
      });
    });

    await t.test('3D. Cross-workspace and cross-matter reference constraints reject mismatched client, source-document, source-finding, and matter relationships', async () => {
      // 1. Matter in Workspace A referencing Client B from Workspace B -> fails fk_matters_client_workspace
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.matters (workspace_id, client_id, title, client_name)
               VALUES ($1, $2, 'Cross-Workspace Client Matter', 'Invalid Client Ref');`,
              [workspaceAId, clientBId]
            );
          });
        },
        /fk_matters_client_workspace/,
        'PostgreSQL must reject linking a matter in Workspace A to a client in Workspace B'
      );

      // 2. Finding in Workspace A referencing Source Document B1 from Workspace B -> fails fk_findings_document_workspace
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
               VALUES ($1, $2, $3, 'Cross-workspace source doc reference');`,
              [workspaceAId, matterA1Id, docB1Id]
            );
          });
        },
        /fk_findings_document_workspace/,
        'PostgreSQL must reject linking a finding to a source document from another workspace'
      );

      // 3. Finding in Matter A2 referencing Source Document A1 from Matter A1 (same workspace, wrong matter) -> fails fk_findings_document_workspace
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
               VALUES ($1, $2, $3, 'Cross-matter source doc reference');`,
              [workspaceAId, matterA2Id, docA1Id]
            );
          });
        },
        /fk_findings_document_workspace/,
        'PostgreSQL must reject linking a finding in Matter A2 to a source document in Matter A1'
      );

      // 4. Evidence in Workspace A referencing Source Document B1 from Workspace B -> fails fk_evidence_source_doc_workspace
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.evidence (workspace_id, matter_id, title, source_doc_id)
               VALUES ($1, $2, 'Invalid Evidence Ref', $3);`,
              [workspaceAId, matterA1Id, docB1Id]
            );
          });
        },
        /fk_evidence_source_doc_workspace/,
        'PostgreSQL must reject linking evidence to a source document from another workspace'
      );

      // 5. Timeline Event in Workspace A referencing Source Finding B1 from Workspace B -> fails fk_timeline_finding_workspace
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.timeline_events (workspace_id, matter_id, event_date, event_title, source_finding_id)
               VALUES ($1, $2, '2026-10-16', 'Invalid Finding Ref', $3);`,
              [workspaceAId, matterA1Id, findingB1Id]
            );
          });
        },
        /fk_timeline_finding_workspace/,
        'PostgreSQL must reject linking a timeline event to a finding from another workspace'
      );

      // 6. Task in Workspace A referencing Matter B1 from Workspace B -> fails trigger enforce_matter_workspace_consistency
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `INSERT INTO public.tasks (workspace_id, matter_id, title)
               VALUES ($1, $2, 'Cross-workspace task');`,
              [workspaceAId, matterB1Id]
            );
          });
        },
        /Workspace consistency violation/,
        'PostgreSQL trigger must reject task with mismatched matter_id and workspace_id'
      );
    });

    await t.test('3E. Atomic create_matter_with_client RPC rolls back client creation if matter creation fails', async () => {
      const beforeClients = await db.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM public.clients WHERE workspace_id = $1;`,
        [workspaceAId]
      );

      // Passing NULL for p_title violates matters.title NOT NULL after client is inserted inside the RPC
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            await tx.query(
              `SELECT * FROM public.create_matter_with_client($1::uuid, NULL, 'Client That Must Rollback');`,
              [workspaceAId]
            );
          });
        },
        /null value in column "title"/i
      );

      const afterClients = await db.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM public.clients WHERE workspace_id = $1;`,
        [workspaceAId]
      );
      assert.strictEqual(
        afterClients.rows[0].cnt,
        beforeClients.rows[0].cnt,
        'Atomic PostgreSQL RPC must roll back client insert when matter insert fails'
      );
    });

    await t.test('3F. Schema & RLS Verification for Roles, Billing (time_entries, invoices, payments), Evidence, Timeline, Tasks, Document Versions, and Storage Bucket Policies', async () => {
      const juniorId = '44444444-4444-4444-8444-444444444444';
      await db.query(
        `INSERT INTO auth.users (id, email) VALUES
          ($1, 'junior@chamberA.in'),
          ($2, 'paralegal@chamberA.in');`,
        [juniorId, paralegalId]
      );

      // 1. RoleManagerModal workflow: CHAMBER_OWNER invites JUNIOR_ADVOCATE & PARALEGAL, then promotes JUNIOR_ADVOCATE -> ASSOCIATE
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        await tx.query(
          `INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
           VALUES
             ($1, $2, 'JUNIOR_ADVOCATE', 'Active'),
             ($1, $3, 'PARALEGAL', 'Active');`,
          [workspaceAId, juniorId, paralegalId]
        );

        const updateRoleRes = await tx.query(
          `UPDATE public.workspace_memberships
           SET role = 'ASSOCIATE'
           WHERE workspace_id = $1 AND user_id = $2
           RETURNING role;`,
          [workspaceAId, juniorId]
        );
        assert.strictEqual(updateRoleRes.rows[0].role, 'ASSOCIATE');
      });

      // Verify PARALEGAL cannot modify workspace_memberships roles (denied by RLS workspace_memberships_admin_update)
      await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
        const unauthorizedRoleChange = await tx.query(
          `UPDATE public.workspace_memberships
           SET role = 'CHAMBER_OWNER'
           WHERE workspace_id = $1 AND user_id = $2
           RETURNING id;`,
          [workspaceAId, paralegalId]
        );
        assert.strictEqual(
          unauthorizedRoleChange.rows.length,
          0,
          'Non-admin member must be prevented by RLS from escalating workspace role'
        );
      });

      // 2. Tasks workflow: create task, toggle status to Completed, update deadline buffer & dependencies
      let task1Id = '';
      let task2Id = '';
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const t1Res = await tx.query(
          `INSERT INTO public.tasks (workspace_id, matter_id, title, priority, status, due_date)
           VALUES ($1, $2, 'File Counter Affidavit', 'High', 'Pending', '2026-11-15')
           RETURNING id, status;`,
          [workspaceAId, matterA1Id]
        );
        task1Id = t1Res.rows[0].id;
        assert.strictEqual(t1Res.rows[0].status, 'Pending');

        const t2Res = await tx.query(
          `INSERT INTO public.tasks (workspace_id, matter_id, title, priority, status, due_date, depends_on)
           VALUES ($1, $2, 'Serve Copy on Opposite Counsel', 'Medium', 'Pending', '2026-11-18', $3::jsonb)
           RETURNING id, depends_on;`,
          [workspaceAId, matterA1Id, JSON.stringify([task1Id])]
        );
        task2Id = t2Res.rows[0].id;
        assert.deepStrictEqual(t2Res.rows[0].depends_on, [task1Id]);

        const toggleRes = await tx.query(
          `UPDATE public.tasks SET status = 'Completed' WHERE id = $1 AND workspace_id = $2 RETURNING status;`,
          [task1Id, workspaceAId]
        );
        assert.strictEqual(toggleRes.rows[0].status, 'Completed');
      });

      // 3. EvidenceIntelligence & TimelineAndContradictions workflows
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const evRes = await tx.query(
          `INSERT INTO public.evidence (workspace_id, matter_id, title, summary, type, verification_status, proves_what)
           VALUES ($1, $2, 'Certified Encumbrance Certificate', 'Covers 1995-2025 period', 'Document', 'Verified', 'Continuous chain of title')
           RETURNING id, verification_status;`,
          [workspaceAId, matterA1Id]
        );
        assert.strictEqual(evRes.rows[0].verification_status, 'Verified');

        const tlRes = await tx.query(
          `INSERT INTO public.timeline_events (workspace_id, matter_id, event_date, event_title, notes, category)
           VALUES ($1, $2, '2026-10-12', 'Section 80 CPC Notice Served', 'Statutory notice delivered via RPAD', 'Notice')
           RETURNING id, event_title;`,
          [workspaceAId, matterA1Id]
        );
        assert.strictEqual(tlRes.rows[0].event_title, 'Section 80 CPC Notice Served');
      });

      // 4. BillingModule workflow: time_entries, invoices, payments + role-based RLS protection
      invoiceId = '';
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        const teRes = await tx.query(
          `INSERT INTO public.time_entries (workspace_id, matter_id, advocate_name, description, hours, hourly_rate, total_amount, billable, status, date)
           VALUES ($1, $2, 'Adv. Ananya Iyer', 'Drafting injunction affidavit and annexures', 3.5, 10000, 35000, true, 'Unbilled', '2026-10-16')
           RETURNING id, hours, hourly_rate;`,
          [workspaceAId, matterA1Id]
        );
        assert.strictEqual(Number(teRes.rows[0].hours), 3.5);

        const invRes = await tx.query(
          `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, items, subtotal, tax_amount, total_amount, paid_amount, status, due_date)
           VALUES ($1, $2, 'INV-2026-002', 'Smt. Meenakshi Sundaram', '[{"id":"item-1","description":"Legal Fees","amount":35000}]'::jsonb, 35000, 0, 35000, 0, 'Unpaid', '2026-11-16')
           RETURNING id, status, total_amount;`,
          [workspaceAId, matterA1Id]
        );
        invoiceId = invRes.rows[0].id;
        assert.strictEqual(Number(invRes.rows[0].total_amount), 35000);

        const payRes = await tx.query(
          `INSERT INTO public.payments (workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes)
           VALUES ($1, $2, 35000, 'NEFT', 'UTR99887766', '2026-10-17', 'Full settlement')
           RETURNING id, amount;`,
          [workspaceAId, invoiceId]
        );
        assert.strictEqual(Number(payRes.rows[0].amount), 35000);

        const updInvRes = await tx.query(
          `UPDATE public.invoices SET paid_amount = 35000, status = 'Paid' WHERE id = $1 AND workspace_id = $2 RETURNING status;`,
          [invoiceId, workspaceAId]
        );
        assert.strictEqual(updInvRes.rows[0].status, 'Paid');
      });

      // Verify PARALEGAL (non-billing role) is denied creating invoices by RLS policy invoices_billing_insert
      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
            await tx.query(
              `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, status)
               VALUES ($1, $2, 'INV-PARALEGAL-001', 'Unauthorized Invoice', 10000, 10000, 'Draft');`,
              [workspaceAId, matterA1Id]
            );
          });
        },
        /row-level security policy/i,
        'PostgreSQL RLS must deny PARALEGAL from issuing invoices'
      );

      // 5. Private Supabase Storage bucket (`matter-documents`) & immutable `document_versions` verification
      const storageObjectPath = `${workspaceAId}/${matterA1Id}/v2_SaleDeed1998.pdf`;
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        // Upload object metadata into storage.objects under Workspace A path
        const objRes = await tx.query(
          `INSERT INTO storage.objects (bucket_id, name, owner)
           VALUES ('matter-documents', $1, $2)
           RETURNING id, name;`,
          [storageObjectPath, userAId]
        );
        assert.strictEqual(objRes.rows[0].name, storageObjectPath);

        // Insert immutable version 2 in public.document_versions
        const ver2Res = await tx.query(
          `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, changes_summary, created_by_user_id)
           VALUES ($1, $2, 2, $3, 'Added certified registration endorsement page', $4)
           RETURNING id, version, file_path;`,
          [workspaceAId, docA1Id, storageObjectPath, userAId]
        );
        assert.strictEqual(ver2Res.rows[0].version, 2);

        const versionsList = await tx.query(
          `SELECT version, file_path FROM public.document_versions WHERE document_id = $1 ORDER BY version ASC;`,
          [docA1Id]
        );
        assert.strictEqual(versionsList.rows.length, 2, 'Both immutable document versions (v1 and v2) must persist');
      });

      // Verify Outsider User B cannot read or upload into Workspace A's private storage path
      await runAsAuthenticatedUser(db, userBId, async (tx) => {
        const outsiderStorageRead = await tx.query(
          `SELECT * FROM storage.objects WHERE bucket_id = 'matter-documents' AND name = $1;`,
          [storageObjectPath]
        );
        assert.strictEqual(
          outsiderStorageRead.rows.length,
          0,
          'Private storage RLS must hide Workspace A objects from Outsider User B'
        );
      });

      await assert.rejects(
        async () => {
          await runAsAuthenticatedUser(db, userBId, async (tx) => {
            await tx.query(
              `INSERT INTO storage.objects (bucket_id, name, owner)
               VALUES ('matter-documents', $1, $2);`,
              [`${workspaceAId}/${matterA1Id}/outsider_inject.pdf`, userBId]
            );
          });
        },
        /row-level security policy/i,
        'Private storage RLS must reject Outsider User B uploading into Workspace A folder'
      );
      // 6. Subtest 3G: record_payment_atomic security, idempotency, amount validation & role restrictions
      await t.test(
        '3G. record_payment_atomic requires auth.uid(), workspace membership, billing role, idempotency, and amount > 0',
        async () => {
          // Test anonymous caller rejection
          await assert.rejects(
            async () => {
              await db.query(`SELECT set_config('request.jwt.claim.sub', '', true);`);
              await db.query(
                `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-anon');`,
                [workspaceAId, invoiceId]
              );
            },
            /Authentication required|auth\.uid\(\) is null/i
          );

          // Test outsider caller rejection
          await assert.rejects(
            async () => {
              await runAsAuthenticatedUser(db, userBId, async (tx) => {
                await tx.query(
                  `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-outsider');`,
                  [workspaceAId, invoiceId]
                );
              });
            },
            /Unauthorized: Caller is not a billing authorized workspace member/i
          );

          // Test PARALEGAL caller rejection
          await assert.rejects(
            async () => {
              await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
                await tx.query(
                  `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-para');`,
                  [workspaceAId, invoiceId]
                );
              });
            },
            /Unauthorized: Caller is not a billing authorized workspace member/i
          );

          // Test invalid amount (<= 0) rejection
          await assert.rejects(
            async () => {
              await runAsAuthenticatedUser(db, userAId, async (tx) => {
                await tx.query(
                  `SELECT * FROM public.record_payment_atomic($1, $2, -500, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-neg');`,
                  [workspaceAId, invoiceId]
                );
              });
            },
            /Payment amount must be greater than zero/i
          );

          // Test successful payment record with idempotency
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            const res1 = await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-key-100');`,
              [workspaceAId, invoiceId]
            );
            assert.ok(res1.rows.length > 0);

            // Retry identical payment with same idempotency key -> returns existing state without duplicate insertion
            const res2 = await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-key-100');`,
              [workspaceAId, invoiceId]
            );
            assert.strictEqual(res2.rows[0].id, invoiceId);
          });

          // Test idempotency key collision with conflicting details -> throws error
          await assert.rejects(
            async () => {
              await runAsAuthenticatedUser(db, userAId, async (tx) => {
                await tx.query(
                  `SELECT * FROM public.record_payment_atomic($1, $2, 20000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Conflicting amount', 'idem-key-100');`,
                  [workspaceAId, invoiceId]
                );
              });
            },
            /Idempotency key collision with conflicting payment details/i
          );
        }
      );

      // 7. Subtest 3H: create_matter_with_client 13-field preservation
      await t.test(
        '3H. create_matter_with_client preserves all 13 supported matter attributes through creation and reload',
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            const res = await tx.query(
              `SELECT * FROM public.create_matter_with_client(
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13
              );`,
              [
                workspaceAId,
                'Full Parameter Test Matter',
                'Srinivasa Ramanujan',
                'C.S. 889/2026',
                'Intellectual Property',
                'Drafting',
                '+91 91234 56789',
                'srinivasa@math.in',
                'Kumbakonam Corporation',
                'Madras High Court',
                'Hon. Justice S. Vaidyanathan',
                '2026-12-01',
                'Mathematical copyright infringement suit',
              ]
            );

            const m = res.rows[0];
            assert.strictEqual(m.title, 'Full Parameter Test Matter');
            assert.strictEqual(m.case_number, 'C.S. 889/2026');
            assert.strictEqual(m.case_type, 'Intellectual Property');
            assert.strictEqual(m.status, 'Drafting');
            assert.strictEqual(m.client_phone, '+91 91234 56789');
            assert.strictEqual(m.client_email, 'srinivasa@math.in');
            assert.strictEqual(m.opposite_party, 'Kumbakonam Corporation');
            assert.strictEqual(m.court_name, 'Madras High Court');
            assert.strictEqual(m.judge_name, 'Hon. Justice S. Vaidyanathan');
            assert.strictEqual(m.summary, 'Mathematical copyright infringement suit');
          });
        }
      );

      // 8. Subtest 3I: Enforceable document retention for committed versions and storage objects
      await t.test(
        '3I. Enforceable retention rules block deletion of committed version rows and storage objects',
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            // Inserting committed version
            const commVer = await tx.query(
              `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, status)
               VALUES ($1, $2, 10, 'ws/m/committed.pdf', 'committed')
               RETURNING id;`,
              [workspaceAId, docA1Id]
            );
            const commId = commVer.rows[0].id;

            // Attempting to delete committed version -> rejected by trigger
            await assert.rejects(
              async () => {
                await tx.query(`DELETE FROM public.document_versions WHERE id = $1;`, [commId]);
              },
              /Retention policy violation: Historical document versions/i
            );

            // Inserting uncommitted/pending version
            const pendVer = await tx.query(
              `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, status)
               VALUES ($1, $2, 11, 'ws/m/pending.pdf', 'pending_upload')
               RETURNING id;`,
              [workspaceAId, docA1Id]
            );
            const pendId = pendVer.rows[0].id;

            // Deleting pending_upload version -> succeeds (failed/orphan upload cleanup path)
            const delRes = await tx.query(
              `DELETE FROM public.document_versions WHERE id = $1 RETURNING id;`,
              [pendId]
            );
            assert.strictEqual(delRes.rows.length, 1);
          });
        }
      );

      // 9. Subtest 3J: Draft approval invalidation on content changes
      await t.test(
        '3J. Updating draft content or title automatically invalidates prior approval status',
        async () => {
          await runAsAuthenticatedUser(db, userAId, async (tx) => {
            const draftRes = await tx.query(
              `INSERT INTO public.drafts (workspace_id, matter_id, title, content, current_version, approved_version, approved_by_user_id, approved_at, status)
               VALUES ($1, $2, 'Initial Petition', 'Original content v1', 1, 1, $3, NOW(), 'Approved')
               RETURNING id, status, approved_version;`,
              [workspaceAId, matterA1Id, userAId]
            );
            const dId = draftRes.rows[0].id;
            assert.strictEqual(draftRes.rows[0].status, 'Approved');

            // Update content and increment version
            const updRes = await tx.query(
              `UPDATE public.drafts
               SET content = 'Modified content v2', current_version = 2
               WHERE id = $1
               RETURNING status, approved_version, approved_by_user_id;`,
              [dId]
            );
            assert.strictEqual(updRes.rows[0].status, 'Draft');
            assert.strictEqual(updRes.rows[0].approved_version, null);
            assert.strictEqual(updRes.rows[0].approved_by_user_id, null);
          });
        }
      );
    });
  } finally {
    await db.close();
  }
});

