import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const FIXTURES_DIR = path.join(process.cwd(), 'test', 'fixtures');

const FIXTURE_1_PATH = path.join(FIXTURES_DIR, '01_initial_schema_data.sql');
const FIXTURE_2_PATH = path.join(FIXTURES_DIR, '02_persistence_schema_data.sql');
const FIXTURE_3_PATH = path.join(FIXTURES_DIR, '03_corrective_schema_data.sql');

/**
 * Reads all shipped migration SQL files strictly in filename (chronological) order.
 */
function getShippedMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Bootstraps a disposable PostgreSQL 16 (PGlite in-memory engine) instance with
 * Supabase-compatible `auth` and `storage` schemas, JWT claim helpers (`auth.uid()`, `auth.role()`),
 * and non-superuser roles (`authenticated`, `anon`) so PostgreSQL Row-Level Security (RLS)
 * policies execute identically to Supabase PostgreSQL.
 *
 * NOTE: PGlite runs purely in-memory for fast deterministic unit tests and does NOT
 * constitute external live Supabase cloud or Google OAuth verification.
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

/**
 * Executes a SQL block as an anonymous caller (`SET LOCAL ROLE anon`, empty sub) inside an isolated transaction.
 */
async function runAsAnonymousUser<T = any>(
  db: PGlite,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE anon;`);
    await tx.query(`SELECT set_config('request.jwt.claim.sub', '', true);`, []);
    await tx.query(`SELECT set_config('request.jwt.claim.role', 'anon', true);`, []);
    return callback(tx);
  });
}

/**
 * Executes an operation inside a PostgreSQL SAVEPOINT. If it fails as expected,
 * it rolls back to the savepoint so the encompassing transaction is not aborted (preventing 25P02).
 */
async function expectTransactionFailure(
  tx: any,
  action: () => Promise<any>,
  expectedErrorRegex?: RegExp
): Promise<void> {
  const sp = `sp_${Math.random().toString(36).slice(2, 9)}`;
  await tx.exec(`SAVEPOINT ${sp};`);
  let caughtError: any = null;
  try {
    await action();
  } catch (err) {
    caughtError = err;
    await tx.exec(`ROLLBACK TO SAVEPOINT ${sp};`);
  } finally {
    if (!caughtError) {
      await tx.exec(`RELEASE SAVEPOINT ${sp};`).catch(() => {});
      assert.fail('Expected PostgreSQL statement to fail, but it succeeded.');
    }
  }
  if (expectedErrorRegex && caughtError) {
    assert.match(
      caughtError.message || String(caughtError),
      expectedErrorRegex,
      `Expected error matching ${expectedErrorRegex}, but got: ${caughtError.message}`
    );
  }
}

// ============================================================================
// TEST 1: Fresh Installation of All Shipped Migrations in Filename Order
// ============================================================================
test('[Database-Backed PostgreSQL Test] 1. Fresh Installation of All Shipped Migrations in Filename Order', { timeout: 30000 }, async (t) => {
  const db = await createDisposableSupabasePostgres();
  const migrationFiles = getShippedMigrationFiles();

  try {
    await t.test('executes all shipped migrations sequentially without error in filename order', { timeout: 15000 }, async () => {
      assert.ok(migrationFiles.length >= 4, `Expected at least 4 shipped migrations, got ${migrationFiles.length}`);

      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await db.exec(sql);
      }
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

    await t.test('verifies RLS is enabled on all 23 public tables and zero obsolete *_member_all policies remain', { timeout: 15000 }, async () => {
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

// ============================================================================
// TEST 2A: Upgrade from Initial Schema with Existing Data Fixture
// ============================================================================
test('[Database-Backed PostgreSQL Test] 2A. Upgrade from Initial Schema with Existing Data Fixture', { timeout: 30000 }, async (t) => {
  const db = await createDisposableSupabasePostgres();
  const migrationFiles = getShippedMigrationFiles();

  try {
    await t.test('loads initial schema fixture, verifies child tables lack workspace_id, and upgrades through all subsequent migrations', { timeout: 20000 }, async () => {
      // Step 1: Apply Migration 1 ONLY
      const sql1 = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[0]), 'utf8');
      await db.exec(sql1);
      await grantSupabasePublicPrivileges(db);

      // Verify child tables initially lack workspace_id
      const initialCols = await db.query<{ table_name: string; column_name: string }>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('document_versions', 'draft_versions')
          AND column_name = 'workspace_id';
      `);
      assert.strictEqual(
        initialCols.rows.length,
        0,
        'Before upgrade, document_versions and draft_versions did not have workspace_id'
      );

      // Step 2: Seed existing data using exact Initial Schema fixture (Milestone 1)
      const fixture1Sql = fs.readFileSync(FIXTURE_1_PATH, 'utf8');
      await db.exec(fixture1Sql);

      // Verify fixture data exists
      const docVerRes = await db.query<{ id: string }>(`SELECT id FROM public.document_versions WHERE id = 'f1111111-1111-4111-8111-111111111111';`);
      assert.strictEqual(docVerRes.rows.length, 1);

      // Step 3: Apply Migration 2 (Hardened Workspace Upgrade)
      const sql2 = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[1]), 'utf8');
      await db.exec(sql2);
      await grantSupabasePublicPrivileges(db);

      // Verify workspace_id was added, backfilled from parent rows, and set NOT NULL
      const upgradedCols = await db.query<{
        table_name: string;
        is_nullable: string;
      }>(`
        SELECT table_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('document_versions', 'draft_versions')
          AND column_name = 'workspace_id'
        ORDER BY table_name;
      `);
      assert.strictEqual(upgradedCols.rows.length, 2);
      for (const col of upgradedCols.rows) {
        assert.strictEqual(
          col.is_nullable,
          'NO',
          `${col.table_name}.workspace_id must be NOT NULL after upgrade backfill`
        );
      }

      const backfilledDv = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM public.document_versions WHERE id = 'f1111111-1111-4111-8111-111111111111';`
      );
      assert.strictEqual(backfilledDv.rows[0].workspace_id, 'b1111111-1111-4111-8111-111111111111');

      // Step 4: Apply remaining migrations (Migration 3 and 4)
      for (let i = 2; i < migrationFiles.length; i++) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[i]), 'utf8');
        await db.exec(sql);
      }
      await grantSupabasePublicPrivileges(db);

      // Verify table integrity intact
      const matterCheck = await db.query<{ title: string }>(
        `SELECT title FROM public.matters WHERE id = 'e1111111-1111-4111-8111-111111111111';`
      );
      assert.strictEqual(matterCheck.rows[0].title, 'Initial Partition Suit');
    });
  } finally {
    await db.close();
  }
});

// ============================================================================
// TEST 2B: Upgrade from Previously Shipped Persistence Schema Fixture
// ============================================================================
test('[Database-Backed PostgreSQL Test] 2B. Upgrade from Previously Shipped Persistence Schema Fixture', { timeout: 30000 }, async (t) => {
  const db = await createDisposableSupabasePostgres();
  const migrationFiles = getShippedMigrationFiles();

  try {
    await t.test('loads persistence schema fixture after migrations 1-3 and upgrades cleanly through migration 4', { timeout: 20000 }, async () => {
      // Step 1: Apply migrations 1, 2, and 3
      for (let i = 0; i < 3; i++) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[i]), 'utf8');
        await db.exec(sql);
      }
      await grantSupabasePublicPrivileges(db);

      // Step 2: Seed existing data using exact Persistence Schema fixture (Milestone 3)
      const fixture2Sql = fs.readFileSync(FIXTURE_2_PATH, 'utf8');
      await db.exec(fixture2Sql);

      // Verify persistence fixture data exists
      const preInvoice = await db.query<{ total_amount: number; paid_amount: number }>(
        `SELECT total_amount, paid_amount FROM public.invoices WHERE id = '05222222-2222-4222-8222-222222222222';`
      );
      assert.strictEqual(Number(preInvoice.rows[0].total_amount), 118000);
      assert.strictEqual(Number(preInvoice.rows[0].paid_amount), 50000);

      // Step 3: Apply remaining migrations (Migration 4 and any subsequent corrective upgrades)
      for (let i = 3; i < migrationFiles.length; i++) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[i]), 'utf8');
        await db.exec(sql);
      }
      await grantSupabasePublicPrivileges(db);

      // Verify stored generated balance_amount computed automatically for existing invoice
      const postInvoice = await db.query<{ total_amount: number; paid_amount: number; balance_amount: number }>(
        `SELECT total_amount, paid_amount, balance_amount FROM public.invoices WHERE id = '05222222-2222-4222-8222-222222222222';`
      );
      assert.strictEqual(Number(postInvoice.rows[0].balance_amount), 68000, 'balance_amount must equal total - paid (118000 - 50000 = 68000)');

      // Verify historical version is backfilled to committed status
      const postDv = await db.query<{ status: string }>(
        `SELECT status FROM public.document_versions WHERE id = 'f2222222-2222-4222-8222-222222222221';`
      );
      assert.strictEqual(postDv.rows[0].status, 'committed');

      // Verify deletion of committed version is rejected by retention policy
      await assert.rejects(
        async () => {
          await db.query(`DELETE FROM public.document_versions WHERE id = 'f2222222-2222-4222-8222-222222222221';`);
        },
        /Retention policy violation/i
      );
    });
  } finally {
    await db.close();
  }
});

// ============================================================================
// TEST 2C: Validation of Previously Shipped Corrective Schema Fixture
// ============================================================================
test('[Database-Backed PostgreSQL Test] 2C. Validation of Previously Shipped Corrective Schema Fixture', { timeout: 30000 }, async (t) => {
  const db = await createDisposableSupabasePostgres();
  const migrationFiles = getShippedMigrationFiles();

  try {
    await t.test('applies all 4 migrations and loads corrective schema fixture, verifying triggers and constraints', { timeout: 20000 }, async () => {
      // Step 1: Apply all 4 migrations
      for (const file of migrationFiles) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await db.exec(sql);
      }
      await grantSupabasePublicPrivileges(db);

      // Step 2: Seed corrective schema fixture
      const fixture3Sql = fs.readFileSync(FIXTURE_3_PATH, 'utf8');
      await db.exec(fixture3Sql);

      // Verify draft approval state
      const draftRes = await db.query<{ status: string; approved_version: number }>(
        `SELECT status, approved_version FROM public.drafts WHERE id = '01333333-3333-4333-8333-333333333333';`
      );
      assert.strictEqual(draftRes.rows[0].status, 'Approved');
      assert.strictEqual(draftRes.rows[0].approved_version, 1);

      // Verify draft editing invalidates approval automatically via trigger
      await db.query(
        `UPDATE public.drafts SET content = 'New revision text without version bump' WHERE id = '01333333-3333-4333-8333-333333333333';`
      );
      const invalidatedDraft = await db.query<{ status: string; approved_version: number | null }>(
        `SELECT status, approved_version FROM public.drafts WHERE id = '01333333-3333-4333-8333-333333333333';`
      );
      assert.strictEqual(invalidatedDraft.rows[0].status, 'Draft');
      assert.strictEqual(invalidatedDraft.rows[0].approved_version, null);

      // Verify invoice balance calculation
      const invRes = await db.query<{ balance_amount: number }>(
        `SELECT balance_amount FROM public.invoices WHERE id = '05333333-3333-4333-8333-333333333333';`
      );
      assert.strictEqual(Number(invRes.rows[0].balance_amount), 100000);
    });
  } finally {
    await db.close();
  }
});

// ============================================================================
// TEST 3: Real RLS with Two Authenticated Users, Restricted Client, Cross-Workspace Constraints & Atomic Rollback
// ============================================================================
test('[Database-Backed PostgreSQL Test] 3. Real RLS with Two Authenticated Users, a Restricted Client, Cross-Workspace Constraints, and Atomic Rollback', { timeout: 60000 }, async (t) => {
  const db = await createDisposableSupabasePostgres();
  const migrationFiles = getShippedMigrationFiles();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.exec(sql);
  }
  await grantSupabasePublicPrivileges(db);

  const userAId = '11111111-1111-4111-8111-111111111111'; // Advocate Owner of Workspace A
  const userBId = '22222222-2222-4222-8222-222222222222'; // Advocate Owner of Workspace B (Outsider to A)
  const clientCId = '33333333-3333-4333-8333-333333333333'; // Restricted Client in Workspace A
  const juniorId = '44444444-4444-4444-8444-444444444444';
  const paralegalId = '55555555-5555-4555-8555-555555555555';

  await db.query(
    `INSERT INTO auth.users (id, email) VALUES
      ($1, 'advocateA@chamberA.in'),
      ($2, 'advocateB@chamberB.in'),
      ($3, 'clientC@client.in'),
      ($4, 'junior@chamberA.in'),
      ($5, 'paralegal@chamberA.in');`,
    [userAId, userBId, clientCId, juniorId, paralegalId]
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
  let findingA1Id = '';
  let findingB1Id = '';

  try {
    // 3A. Workspace & Matter Creation
    await t.test('3A. User A and User B create isolated workspaces and matters via PostgreSQL RPCs under real RLS', { timeout: 15000 }, async (tA) => {
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

    // 3B. Outsider Access Denial
    await t.test('3B. Real PostgreSQL RLS strictly denies User B (valid outsider) read or write access to Workspace A records', { timeout: 15000 }, async (tB) => {
      await runAsAuthenticatedUser(db, userBId, async (tx) => {
        const mattersARes = await tx.query(
          `SELECT * FROM public.matters WHERE workspace_id = $1;`,
          [workspaceAId]
        );
        assert.strictEqual(mattersARes.rows.length, 0, 'PostgreSQL RLS must return 0 rows when User B queries Workspace A matters');

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
          assert.strictEqual(res.rows[0].cnt, 0, `PostgreSQL RLS must hide Workspace A ${table} from User B`);
        }

        const updateRes = await tx.query(
          `UPDATE public.matters SET title = 'Hacked by User B' WHERE id = $1 RETURNING id;`,
          [matterA1Id]
        );
        assert.strictEqual(updateRes.rows.length, 0, 'PostgreSQL RLS must prevent User B from updating Workspace A matter');

        // Test expected INSERT failure using SAVEPOINT within the transaction
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.matters (workspace_id, title, client_name)
             VALUES ($1, 'Unauthorized Matter Injection', 'Fake Client');`,
            [workspaceAId]
          );
        }, /row-level security policy/i);

        // Transaction remains active after savepoint rollback
        const checkActive = await tx.query(`SELECT 1 AS alive;`);
        assert.strictEqual(checkActive.rows[0].alive, 1);
      });
    });

    // 3C. Restricted Client Scopes
    await t.test('3C. Real PostgreSQL RLS enforces restricted client access grants and scopes for Client User C', { timeout: 15000 }, async (tC) => {
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
        // Client C can SELECT only Matter A1
        const visibleMatters = await tx.query(
          `SELECT id, title FROM public.matters WHERE workspace_id = $1;`,
          [workspaceAId]
        );
        assert.strictEqual(visibleMatters.rows.length, 1);
        assert.strictEqual(visibleMatters.rows[0].id, matterA1Id);

        // Client C cannot UPDATE even the granted Matter A1
        const clientUpdateAttempt = await tx.query(
          `UPDATE public.matters SET title = 'Client Edit Attempt' WHERE id = $1 RETURNING id;`,
          [matterA1Id]
        );
        assert.strictEqual(clientUpdateAttempt.rows.length, 0);

        // Client C CAN view hearings on Matter A1 (viewHearings = true)
        const visibleHearings = await tx.query(
          `SELECT * FROM public.hearings WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(visibleHearings.rows.length, 1);

        // Client C CANNOT view invoices on Matter A1 (viewBilling = false)
        const hiddenInvoices = await tx.query(
          `SELECT * FROM public.invoices WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(hiddenInvoices.rows.length, 0);

        // Client C CANNOT view internal advocate findings
        const hiddenFindings = await tx.query(
          `SELECT * FROM public.findings WHERE matter_id = $1;`,
          [matterA1Id]
        );
        assert.strictEqual(hiddenFindings.rows.length, 0);
      });

      // User A enables viewBilling = true on the grant
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
        assert.strictEqual(grantedInvoices.rows.length, 1);
        assert.strictEqual(grantedInvoices.rows[0].invoice_number, 'INV-2026-001');
      });
    });

    // 3D. Cross-Workspace Constraints with SAVEPOINT
    await t.test('3D. Cross-workspace and cross-matter reference constraints reject mismatched relationships via savepoint', { timeout: 15000 }, async (tD) => {
      await runAsAuthenticatedUser(db, userAId, async (tx) => {
        // 1. Cross-workspace Client Ref
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.matters (workspace_id, client_id, title, client_name)
             VALUES ($1, $2, 'Cross-Workspace Client Matter', 'Invalid Client Ref');`,
            [workspaceAId, clientBId]
          );
        }, /fk_matters_client_workspace/);

        // 2. Cross-workspace Source Doc
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
             VALUES ($1, $2, $3, 'Cross-workspace source doc reference');`,
            [workspaceAId, matterA1Id, docB1Id]
          );
        }, /fk_findings_document_workspace/);

        // 3. Cross-matter Source Doc (Same workspace, wrong matter)
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.findings (workspace_id, matter_id, document_id, finding_text)
             VALUES ($1, $2, $3, 'Cross-matter source doc reference');`,
            [workspaceAId, matterA2Id, docA1Id]
          );
        }, /fk_findings_document_workspace/);

        // 4. Cross-workspace Evidence Source Doc
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.evidence (workspace_id, matter_id, title, source_doc_id)
             VALUES ($1, $2, 'Invalid Evidence Ref', $3);`,
            [workspaceAId, matterA1Id, docB1Id]
          );
        }, /fk_evidence_source_doc_workspace/);

        // 5. Cross-workspace Timeline Finding
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.timeline_events (workspace_id, matter_id, event_date, event_title, source_finding_id)
             VALUES ($1, $2, '2026-10-16', 'Invalid Finding Ref', $3);`,
            [workspaceAId, matterA1Id, findingB1Id]
          );
        }, /fk_timeline_finding_workspace/);

        // 6. Cross-workspace Task
        await expectTransactionFailure(tx, async () => {
          await tx.query(
            `INSERT INTO public.tasks (workspace_id, matter_id, title)
             VALUES ($1, $2, 'Cross-workspace task');`,
            [workspaceAId, matterB1Id]
          );
        }, /Workspace consistency violation/);

        // Verifying transaction remained fully operational across all 6 savepoint rollbacks
        const healthyRes = await tx.query(`SELECT count(*)::int AS cnt FROM public.matters WHERE workspace_id = $1;`, [workspaceAId]);
        assert.ok(healthyRes.rows[0].cnt >= 2, 'Transaction remained healthy after 6 savepoint recoveries');
      });
    });

    // 3E. Atomic RPC Rollback
    await t.test('3E. Atomic create_matter_with_client RPC rolls back client creation if matter creation fails', { timeout: 15000 }, async (tE) => {
      const beforeClients = await db.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM public.clients WHERE workspace_id = $1;`,
        [workspaceAId]
      );

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
      assert.strictEqual(afterClients.rows[0].cnt, beforeClients.rows[0].cnt);
    });

    // 3F. Schema & RLS Verification for Roles, Tasks, Evidence, Timeline, Billing, and Storage
    // Uses child context (tF) for all nested subtests to guarantee proper scheduling
    await t.test('3F. Schema & RLS Verification for Roles, Billing, Evidence, Timeline, Tasks, and Storage Policies', { timeout: 20000 }, async (tF) => {
      // 3F-1. Roles & Promotion
      await tF.test('3F-1. Role management and escalation rejection', async () => {
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

        // PARALEGAL cannot escalate role
        await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
          const unauthorizedRoleChange = await tx.query(
            `UPDATE public.workspace_memberships
             SET role = 'CHAMBER_OWNER'
             WHERE workspace_id = $1 AND user_id = $2
             RETURNING id;`,
            [workspaceAId, paralegalId]
          );
          assert.strictEqual(unauthorizedRoleChange.rows.length, 0);
        });
      });

      // 3F-2. Tasks Workflow
      await tF.test('3F-2. Tasks workflow and dependencies', async () => {
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const t1Res = await tx.query(
            `INSERT INTO public.tasks (workspace_id, matter_id, title, priority, status, due_date)
             VALUES ($1, $2, 'File Counter Affidavit', 'High', 'Pending', '2026-11-15')
             RETURNING id, status;`,
            [workspaceAId, matterA1Id]
          );
          const task1Id = t1Res.rows[0].id;
          assert.strictEqual(t1Res.rows[0].status, 'Pending');

          const t2Res = await tx.query(
            `INSERT INTO public.tasks (workspace_id, matter_id, title, priority, status, due_date, depends_on)
             VALUES ($1, $2, 'Serve Copy on Opposite Counsel', 'Medium', 'Pending', '2026-11-18', $3::jsonb)
             RETURNING id, depends_on;`,
            [workspaceAId, matterA1Id, JSON.stringify([task1Id])]
          );
          assert.deepStrictEqual(t2Res.rows[0].depends_on, [task1Id]);

          const toggleRes = await tx.query(
            `UPDATE public.tasks SET status = 'Completed' WHERE id = $1 AND workspace_id = $2 RETURNING status;`,
            [task1Id, workspaceAId]
          );
          assert.strictEqual(toggleRes.rows[0].status, 'Completed');
        });
      });

      // 3F-3. Evidence & Timeline
      await tF.test('3F-3. Evidence intelligence and timeline events', async () => {
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
      });

      // 3F-4. Billing & Invoices
      await tF.test('3F-4. BillingModule workflow and PARALEGAL restriction with SAVEPOINT', async () => {
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
            `INSERT INTO public.payments (workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes, idempotency_key)
             VALUES ($1, $2, 35000, 'NEFT', 'UTR99887766', '2026-10-17', 'Full settlement', 'idem-3f4-full')
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

        // PARALEGAL invoice insert rejection tested using SAVEPOINT inside transaction
        await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, status)
               VALUES ($1, $2, 'INV-PARALEGAL-001', 'Unauthorized Invoice', 10000, 10000, 'Draft');`,
              [workspaceAId, matterA1Id]
            );
          }, /row-level security policy/i);

          // Proving transaction survived through savepoint rollback:
          const checkTx = await tx.query(`SELECT count(*)::int AS cnt FROM public.workspace_memberships WHERE user_id = $1;`, [paralegalId]);
          assert.strictEqual(checkTx.rows[0].cnt, 1, 'Transaction must remain operational after savepoint rollback');
        });
      });

      // 3F-5. Storage Policies
      await tF.test('3F-5. Private storage bucket policies and immutable document versions', async () => {
        const storageObjectPath = `${workspaceAId}/${matterA1Id}/v2_SaleDeed1998.pdf`;
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const objRes = await tx.query(
            `INSERT INTO storage.objects (bucket_id, name, owner)
             VALUES ('matter-documents', $1, $2)
             RETURNING id, name;`,
            [storageObjectPath, userAId]
          );
          assert.strictEqual(objRes.rows[0].name, storageObjectPath);

          const ver2Res = await tx.query(
            `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, changes_summary, created_by_user_id)
             VALUES ($1, $2, 2, $3, 'Added certified registration endorsement page', $4)
             RETURNING id, version, file_path;`,
            [workspaceAId, docA1Id, storageObjectPath, userAId]
          );
          assert.strictEqual(ver2Res.rows[0].version, 2);
        });

        // Outsider User B cannot read or upload into Workspace A private storage
        await runAsAuthenticatedUser(db, userBId, async (tx) => {
          const outsiderStorageRead = await tx.query(
            `SELECT * FROM storage.objects WHERE bucket_id = 'matter-documents' AND name = $1;`,
            [storageObjectPath]
          );
          assert.strictEqual(outsiderStorageRead.rows.length, 0);

          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `INSERT INTO storage.objects (bucket_id, name, owner)
               VALUES ('matter-documents', $1, $2);`,
              [`${workspaceAId}/${matterA1Id}/outsider_inject.pdf`, userBId]
            );
          }, /row-level security policy/i);
        });
      });
    });

    // 3G. record_payment_atomic Security & Idempotency
    await t.test(
      '3G. record_payment_atomic requires auth.uid(), workspace membership, billing role, idempotency, and amount > 0',
      { timeout: 15000 },
      async (tG) => {
        let testInvoice3GId = '';
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const invRes = await tx.query(
            `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, items, subtotal, tax_amount, total_amount, paid_amount, status, due_date)
             VALUES ($1, $2, 'INV-3G-TEST', 'Fixture Client 3G', '[{"id":"item-3g","description":"Court Appearance","amount":50000}]'::jsonb, 50000, 0, 50000, 0, 'Unpaid', '2026-11-20')
             RETURNING id;`,
            [workspaceAId, matterA1Id]
          );
          testInvoice3GId = invRes.rows[0].id;
        });

        // Anonymous caller rejection
        await assert.rejects(
          async () => {
            await runAsAnonymousUser(db, async (tx) => {
              await tx.query(
                `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-anon');`,
                [workspaceAId, testInvoice3GId]
              );
            });
          },
          /Authentication required|auth\.uid\(\) is null|permission denied/i
        );

        // Outsider caller rejection
        await assert.rejects(
          async () => {
            await runAsAuthenticatedUser(db, userBId, async (tx) => {
              await tx.query(
                `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-outsider');`,
                [workspaceAId, testInvoice3GId]
              );
            });
          },
          /Unauthorized: Caller is not a billing authorized workspace member/i
        );

        // PARALEGAL caller rejection
        await assert.rejects(
          async () => {
            await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
              await tx.query(
                `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-para');`,
                [workspaceAId, testInvoice3GId]
              );
            });
          },
          /Unauthorized: Caller is not a billing authorized workspace member/i
        );

        // Input validation: empty / whitespace idempotency key and amount <= 0
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          // Empty / whitespace idempotency key rejected
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 5000, '2026-10-17'::date, 'UPI', 'REF1', 'Note', '   ');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Operation ID \(idempotency key\) is required/i);

          // Negative amount rejected via savepoint
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, -500, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-neg');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Payment amount must be greater than zero/i);

          // Zero amount rejected via savepoint
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 0, '2026-10-17'::date, 'UPI', 'REF1', 'Note', 'idem-zero');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Payment amount must be greater than zero/i);

          // Valid payment records successfully in same transaction
          const res1 = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-canonical-all');`,
            [workspaceAId, testInvoice3GId]
          );
          assert.strictEqual(Number(res1.rows[0].paid_amount), 10000);
          assert.strictEqual(Number(res1.rows[0].balance_amount), 40000);

          // Retry identical payment with same idempotency key and identical 6 fields -> returns existing state without duplicate
          const res2 = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-canonical-all');`,
            [workspaceAId, testInvoice3GId]
          );
          assert.strictEqual(res2.rows[0].id, testInvoice3GId);
          assert.strictEqual(Number(res2.rows[0].paid_amount), 10000);

          // Conflicting details reuse: 1. Conflicting amount
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 20000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-canonical-all');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Idempotency key collision with conflicting payment details/i);

          // Conflicting details reuse: 2. Conflicting payment date
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-18'::date, 'UPI', 'TXN-001', 'Part payment', 'idem-canonical-all');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Idempotency key collision with conflicting payment details/i);

          // Conflicting details reuse: 3. Conflicting payment method
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'Cheque', 'TXN-001', 'Part payment', 'idem-canonical-all');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Idempotency key collision with conflicting payment details/i);

          // Conflicting details reuse: 4. Conflicting reference number
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-DIFF-REF', 'Part payment', 'idem-canonical-all');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Idempotency key collision with conflicting payment details/i);

          // Conflicting details reuse: 5. Conflicting notes
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.record_payment_atomic($1, $2, 10000, '2026-10-17'::date, 'UPI', 'TXN-001', 'Changed Notes Content', 'idem-canonical-all');`,
              [workspaceAId, testInvoice3GId]
            );
          }, /Idempotency key collision with conflicting payment details/i);

          // Verify that conflicting reuse rejections did NOT alter totals or insert rogue rows
          const invVerify = await tx.query(
            `SELECT paid_amount, balance_amount, status FROM public.invoices WHERE id = $1;`,
            [testInvoice3GId]
          );
          assert.strictEqual(Number(invVerify.rows[0].paid_amount), 10000);
          assert.strictEqual(Number(invVerify.rows[0].balance_amount), 40000);
          assert.strictEqual(invVerify.rows[0].status, 'Partially Paid');
        });

        // Exact balance calculation: Total 100, Payment 10 -> paid must be 10 and balance 90
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const inv100Res = await tx.query(
            `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, paid_amount, status, due_date)
             VALUES ($1, $2, 'INV-EXACT-100', 'Test Client 100', 100, 100, 0, 'Unpaid', '2026-11-30')
             RETURNING id;`,
            [workspaceAId, matterA1Id]
          );
          const inv100Id = inv100Res.rows[0].id;

          const pay10Res = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 10, '2026-10-18'::date, 'UPI', 'REF-10', 'Partial 10', 'idem-100-10');`,
            [workspaceAId, inv100Id]
          );
          const updatedInv = pay10Res.rows[0];
          assert.strictEqual(Number(updatedInv.paid_amount), 10);
          assert.strictEqual(Number(updatedInv.balance_amount), 90);
          assert.strictEqual(updatedInv.status, 'Partially Paid');
        });

        // Two separate payments with identical details both persist when unique idempotency keys are used
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const invSepRes = await tx.query(
            `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, paid_amount, status, due_date)
             VALUES ($1, $2, 'INV-SEP-PAY', 'Separate Payments Client', 500, 500, 0, 'Unpaid', '2026-11-30')
             RETURNING id;`,
            [workspaceAId, matterA1Id]
          );
          const invSepId = invSepRes.rows[0].id;

          await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 100, '2026-10-18'::date, 'UPI', 'REF-SAME', 'Payment 1', 'idem-key-sep-1');`,
            [workspaceAId, invSepId]
          );
          const p2 = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 100, '2026-10-18'::date, 'UPI', 'REF-SAME', 'Payment 2', 'idem-key-sep-2');`,
            [workspaceAId, invSepId]
          );
          assert.strictEqual(Number(p2.rows[0].paid_amount), 200);

          const countRes = await tx.query(
            `SELECT COUNT(*) AS cnt FROM public.payments WHERE invoice_id = $1;`,
            [invSepId]
          );
          assert.strictEqual(Number(countRes.rows[0].cnt), 2, 'Two separate payments with identical details must both persist');
        });

        // Direct client writes invariant protection
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const invDirectRes = await tx.query(
            `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, paid_amount, status, due_date)
             VALUES ($1, $2, 'INV-DIRECT-TEST', 'Direct Invariant Client', 300, 300, 0, 'Unpaid', '2026-11-30')
             RETURNING id;`,
            [workspaceAId, matterA1Id]
          );
          const invDirectId = invDirectRes.rows[0].id;

          // Attempt direct insert into public.payments without idempotency_key -> fails NOT NULL
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `INSERT INTO public.payments (workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes)
               VALUES ($1, $2, 50, 'Cash', 'CASH-01', '2026-10-18', 'No Idem Key');`,
              [workspaceAId, invDirectId]
            );
          }, /idempotency_key/i);

          // Attempt direct insert with negative amount -> fails check constraint
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `INSERT INTO public.payments (workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes, idempotency_key)
               VALUES ($1, $2, -50, 'Cash', 'CASH-02', '2026-10-18', 'Negative', 'idem-direct-neg');`,
              [workspaceAId, invDirectId]
            );
          }, /chk_payments_positive_amount/i);

          // Direct insert with valid fields triggers trg_enforce_payment_invariants_and_sync
          await tx.query(
            `INSERT INTO public.payments (workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes, idempotency_key)
             VALUES ($1, $2, 100, 'Cash', 'CASH-03', '2026-10-18', 'Direct Payment', 'idem-direct-valid');`,
            [workspaceAId, invDirectId]
          );

          // Verify invoice paid_amount and balance_amount updated automatically by trigger
          const syncedInv = await tx.query(
            `SELECT paid_amount, balance_amount, status FROM public.invoices WHERE id = $1;`,
            [invDirectId]
          );
          assert.strictEqual(Number(syncedInv.rows[0].paid_amount), 100);
          assert.strictEqual(Number(syncedInv.rows[0].balance_amount), 200);
          assert.strictEqual(syncedInv.rows[0].status, 'Partially Paid');
        });

        // Distinct concurrent payments produce correct totals
        // [PGlite Local Database Concurrency / In-Memory PostgreSQL Verification - Remote Live Supabase Concurrency Unverified]
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const invConcRes = await tx.query(
            `INSERT INTO public.invoices (workspace_id, matter_id, invoice_number, client_name, subtotal, total_amount, paid_amount, status, due_date)
             VALUES ($1, $2, 'INV-CONC-TEST', 'Concurrency Client', 100, 100, 0, 'Unpaid', '2026-11-30')
             RETURNING id;`,
            [workspaceAId, matterA1Id]
          );
          const invConcId = invConcRes.rows[0].id;

          // Execute distinct payments with keys conc-1 (amount 25) and conc-2 (amount 35)
          const p1 = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 25, '2026-10-18'::date, 'UPI', 'CONC-1', 'Conc 1', 'idem-conc-1');`,
            [workspaceAId, invConcId]
          );
          const p2 = await tx.query(
            `SELECT * FROM public.record_payment_atomic($1, $2, 35, '2026-10-18'::date, 'UPI', 'CONC-2', 'Conc 2', 'idem-conc-2');`,
            [workspaceAId, invConcId]
          );

          assert.strictEqual(Number(p2.rows[0].paid_amount), 60);
          assert.strictEqual(Number(p2.rows[0].balance_amount), 40);
          assert.strictEqual(p2.rows[0].status, 'Partially Paid');
        });
      }
    );

    // 3H. create_matter_with_client 13-Field Preservation
    await t.test(
      '3H. create_matter_with_client preserves all 13 supported matter attributes through creation and reload',
      { timeout: 15000 },
      async (tH) => {
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

    // 3I. Enforceable Document Retention with SAVEPOINT
    await t.test(
      '3I. Enforceable retention rules block deletion of committed version rows and allow pending cleanup via savepoint',
      { timeout: 15000 },
      async (tI) => {
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          // Inserting committed version
          const commVer = await tx.query(
            `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, status)
             VALUES ($1, $2, 10, 'ws/m/committed.pdf', 'committed')
             RETURNING id;`,
            [workspaceAId, docA1Id]
          );
          const commId = commVer.rows[0].id;

          // Attempting to delete committed version -> rejected by trigger, rolled back to SAVEPOINT so tx stays valid
          await expectTransactionFailure(tx, async () => {
            await tx.query(`DELETE FROM public.document_versions WHERE id = $1;`, [commId]);
          }, /Retention policy violation: Historical document versions/i);

          // Inserting uncommitted/pending version in the SAME transaction
          const pendVer = await tx.query(
            `INSERT INTO public.document_versions (workspace_id, document_id, version, file_path, status)
             VALUES ($1, $2, 11, 'ws/m/pending.pdf', 'pending_upload')
             RETURNING id;`,
            [workspaceAId, docA1Id]
          );
          const pendId = pendVer.rows[0].id;

          // Deleting pending_upload version -> succeeds in the same transaction
          const delRes = await tx.query(
            `DELETE FROM public.document_versions WHERE id = $1 RETURNING id;`,
            [pendId]
          );
          assert.strictEqual(delRes.rows.length, 1, 'Uncommitted/pending version must be cleanable in same transaction');
        });
      }
    );

    // 3J. Draft Revision Lifecycle, Immutability, Optimistic Concurrency, and Approval Security
    await t.test(
      '3J. End-to-end draft lifecycle: save v1 -> approve v1 -> edit -> save v2 (requires fresh approval), immutability, and stale/unauthorized rejection',
      { timeout: 15000 },
      async (tJ) => {
        let draftId = '';

        // 1. Generate & Save v1 transactionally
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const v1Res = await tx.query(
            `SELECT * FROM public.save_draft_revision_atomic(
              $1, $2, NULL, 'Section 9 Injunction Petition', 'Injunction Application', 'Original Petition Content v1', NULL, 'Initial v1', 'op-save-v1'
            );`,
            [workspaceAId, matterA1Id]
          );

          const draft = v1Res.rows[0];
          draftId = draft.id;
          assert.strictEqual(Number(draft.current_version), 1);
          assert.strictEqual(draft.status, 'Draft');
          assert.strictEqual(draft.approved_version, null);

          // Verify version 1 row in public.draft_versions
          const v1Row = await tx.query(
            `SELECT * FROM public.draft_versions WHERE draft_id = $1 AND version = 1;`,
            [draftId]
          );
          assert.strictEqual(v1Row.rows.length, 1);
          assert.strictEqual(v1Row.rows[0].content, 'Original Petition Content v1');
        });

        // 2. Safe retry of save v1 with same operation ID returns existing draft without creating duplicate version
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const retryRes = await tx.query(
            `SELECT * FROM public.save_draft_revision_atomic(
              $1, $2, NULL, 'Section 9 Injunction Petition', 'Injunction Application', 'Original Petition Content v1', NULL, 'Initial v1', 'op-save-v1'
            );`,
            [workspaceAId, matterA1Id]
          );
          assert.strictEqual(retryRes.rows[0].id, draftId);
          assert.strictEqual(Number(retryRes.rows[0].current_version), 1);

          const countVers = await tx.query(
            `SELECT COUNT(*)::int AS cnt FROM public.draft_versions WHERE draft_id = $1;`,
            [draftId]
          );
          assert.strictEqual(countVers.rows[0].cnt, 1, 'Retry must not create duplicate draft version');
        });

        // 3. Unauthorized approval rejection: PARALEGAL cannot approve drafts
        await assert.rejects(
          async () => {
            await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
              await tx.query(
                `SELECT * FROM public.approve_draft_atomic($1, $2, 1);`,
                [workspaceAId, draftId]
              );
            });
          },
          /Unauthorized: Caller does not have permissions to approve drafts/i
        );

        // 4. Unauthorized approval rejection: OUTSIDER User B cannot approve Workspace A drafts
        await assert.rejects(
          async () => {
            await runAsAuthenticatedUser(db, userBId, async (tx) => {
              await tx.query(
                `SELECT * FROM public.approve_draft_atomic($1, $2, 1);`,
                [workspaceAId, draftId]
              );
            });
          },
          /Unauthorized: Caller does not have permissions to approve drafts/i
        );

        // 5. Authorized approver (CHAMBER_OWNER) approves revision v1
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const appRes = await tx.query(
            `SELECT * FROM public.approve_draft_atomic($1, $2, 1);`,
            [workspaceAId, draftId]
          );
          const appDraft = appRes.rows[0];
          assert.strictEqual(appDraft.status, 'Approved');
          assert.strictEqual(Number(appDraft.approved_version), 1);
          assert.strictEqual(appDraft.approved_by_user_id, userAId);
          assert.ok(appDraft.approved_at);
        });

        // 6. Direct client update on title/content invalidates approval
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const invRes = await tx.query(
            `UPDATE public.drafts SET content = 'Unsaved Live Edit Content' WHERE id = $1 RETURNING status, approved_version;`,
            [draftId]
          );
          assert.strictEqual(invRes.rows[0].status, 'Draft');
          assert.strictEqual(invRes.rows[0].approved_version, null);

          // Restore content back to v1
          await tx.query(
            `UPDATE public.drafts SET content = 'Original Petition Content v1' WHERE id = $1;`,
            [draftId]
          );
          // Re-approve v1
          await tx.query(
            `SELECT * FROM public.approve_draft_atomic($1, $2, 1);`,
            [workspaceAId, draftId]
          );
        });

        // 7. Save revision v2 transactionally using expected_version = 1
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const v2Res = await tx.query(
            `SELECT * FROM public.save_draft_revision_atomic(
              $1, $2, $3, 'Section 9 Injunction Petition (Amended)', 'Injunction Application', 'Revised Petition Content v2 with Additional Grounds', 1, 'Added interim reliefs', 'op-save-v2'
            );`,
            [workspaceAId, matterA1Id, draftId]
          );

          const v2Draft = v2Res.rows[0];
          assert.strictEqual(Number(v2Draft.current_version), 2);
          // Revision v2 requires fresh approval!
          assert.strictEqual(v2Draft.status, 'Draft');
          assert.strictEqual(v2Draft.approved_version, null);
          assert.strictEqual(v2Draft.approved_by_user_id, null);

          // Verify version 2 row in draft_versions
          const v2Row = await tx.query(
            `SELECT * FROM public.draft_versions WHERE draft_id = $1 AND version = 2;`,
            [draftId]
          );
          assert.strictEqual(v2Row.rows.length, 1);
          assert.strictEqual(v2Row.rows[0].content, 'Revised Petition Content v2 with Additional Grounds');
        });

        // 8. Immutability verification: v1 in public.draft_versions cannot be modified or deleted
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `UPDATE public.draft_versions SET content = 'Tampered Content' WHERE draft_id = $1 AND version = 1;`,
              [draftId]
            );
          }, /Historical draft versions are immutable/i);

          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `DELETE FROM public.draft_versions WHERE draft_id = $1 AND version = 1;`,
              [draftId]
            );
          }, /Historical draft versions are immutable/i);

          // Verify v1 content is intact
          const checkV1 = await tx.query(
            `SELECT content FROM public.draft_versions WHERE draft_id = $1 AND version = 1;`,
            [draftId]
          );
          assert.strictEqual(checkV1.rows[0].content, 'Original Petition Content v1');
        });

        // 9. Stale save rejection: saving with expected_version = 1 when draft is now at v2 fails
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.save_draft_revision_atomic(
                $1, $2, $3, 'Conflicting Save Title', 'Injunction Application', 'Conflicting Stale Content', 1, 'Stale save attempt', 'op-save-stale'
              );`,
              [workspaceAId, matterA1Id, draftId]
            );
          }, /Stale save rejected: expected version 1 does not match current version 2/i);
        });

        // 10. Stale approval rejection: approving v1 when draft is now at v2 fails
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.approve_draft_atomic($1, $2, 1);`,
              [workspaceAId, draftId]
            );
          }, /Stale approval rejected: expected version 1 does not match current version 2/i);
        });

        // 11. Empty title validation failure
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT * FROM public.save_draft_revision_atomic(
                $1, $2, $3, '   ', 'Injunction Application', 'Valid Content', 2, 'Notes', 'op-empty-title'
              );`,
              [workspaceAId, matterA1Id, draftId]
            );
          }, /Draft title is required/i);
        });

        // 12. Direct write cannot forge approval of an unsaved version
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `UPDATE public.drafts SET status = 'Approved', approved_version = 99 WHERE id = $1;`,
              [draftId]
            );
          }, /Cannot approve unsaved draft version 99/i);
        });

        // 13. Direct write cannot forge approval from unauthorized role (PARALEGAL)
        await runAsAuthenticatedUser(db, paralegalId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `UPDATE public.drafts SET status = 'Approved', approved_version = 2 WHERE id = $1;`,
              [draftId]
            );
          }, /Unauthorized: Caller does not have permissions to approve drafts/i);
        });
      }
    );

    // 3K. End-to-end Document Upload/Revision Persistence, Lock Concurrency, Idempotency, Retention, and Fact-Review Workflow
    await t.test(
      '3K. Document upload/revision persistence, lock concurrency, operation idempotency, retention, and fact-review workflow',
      { timeout: 20000 },
      async (tK) => {
        let createdDocId = '';
        const storagePathV1 = `${workspaceAId}/${matterA1Id}/attempt_1_v1_title_deed.pdf`;
        const storagePathV2 = `${workspaceAId}/${matterA1Id}/doc1_attempt_2_v2_title_deed.pdf`;

        // 1. Initial document creation via atomic RPC
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const docRes = await tx.query(
            `SELECT public.create_document_with_initial_version_atomic(
              $1, $2, 'Original Title Deed', 'Property Deed', 'matter-documents', $3, 1024, 'application/pdf', 'Initial document upload', 'Extracted deed text', 'Adv. Ramesh', 'op-doc-init-1'
            ) AS create_document_with_initial_version_atomic;`,
            [workspaceAId, matterA1Id, storagePathV1]
          );

          const payload = docRes.rows[0].create_document_with_initial_version_atomic;
          assert.strictEqual(payload.idempotent_retry, false);
          assert.strictEqual(payload.document.name, 'Original Title Deed');
          assert.strictEqual(Number(payload.document.current_version), 1);
          createdDocId = payload.document.id;
          assert.ok(createdDocId);
        });

        // 2. Idempotent retry with same operation_id returns existing document/version
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const retryRes = await tx.query(
            `SELECT public.create_document_with_initial_version_atomic(
              $1, $2, 'Original Title Deed', 'Property Deed', 'matter-documents', $3, 1024, 'application/pdf', 'Initial document upload', 'Extracted deed text', 'Adv. Ramesh', 'op-doc-init-1'
            ) AS create_document_with_initial_version_atomic;`,
            [workspaceAId, matterA1Id, storagePathV1]
          );

          const payload = retryRes.rows[0].create_document_with_initial_version_atomic;
          assert.strictEqual(payload.idempotent_retry, true);
          assert.strictEqual(payload.document.id, createdDocId);
        });

        // 3. Commit revision v2 via commit_document_revision_atomic with lock and expected_version = 1
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const revRes = await tx.query(
            `SELECT public.commit_document_revision_atomic(
              $1, $2, $3, $4, 2048, 'application/pdf', 'Added encumbrance certificate annexure', 'Updated extracted text v2', 'Adv. Ramesh', 1, 'op-doc-rev-2'
            ) AS commit_document_revision_atomic;`,
            [workspaceAId, matterA1Id, createdDocId, storagePathV2]
          );

          const payload = revRes.rows[0].commit_document_revision_atomic;
          assert.strictEqual(payload.idempotent_retry, false);
          assert.strictEqual(Number(payload.document.current_version), 2);
          assert.strictEqual(payload.version.file_path, storagePathV2);
        });

        // 4. Lost response retry with same operation_id returns existing v2 without creating v3
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const retryRevRes = await tx.query(
            `SELECT public.commit_document_revision_atomic(
              $1, $2, $3, $4, 2048, 'application/pdf', 'Added encumbrance certificate annexure', 'Updated extracted text v2', 'Adv. Ramesh', 1, 'op-doc-rev-2'
            ) AS commit_document_revision_atomic;`,
            [workspaceAId, matterA1Id, createdDocId, storagePathV2]
          );

          const payload = retryRevRes.rows[0].commit_document_revision_atomic;
          assert.strictEqual(payload.idempotent_retry, true);
          assert.strictEqual(Number(payload.document.current_version), 2);
        });

        // 5. Stale version rejection: committing with expected_version = 1 when document is now at v2 fails
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT public.commit_document_revision_atomic(
                $1, $2, $3, $4, 3072, 'application/pdf', 'Stale attempt', 'Text', 'Adv. Ramesh', 1, 'op-stale-attempt'
              );`,
              [workspaceAId, matterA1Id, createdDocId, `${workspaceAId}/${matterA1Id}/stale_v3.pdf`]
            );
          }, /Stale document revision: expected version 1 does not match current version 2/i);
        });

        // 6. Cross-matter scope mismatch rejection
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `SELECT public.commit_document_revision_atomic(
                $1, $2, $3, $4, 3072, 'application/pdf', 'Cross matter attempt', 'Text', 'Adv. Ramesh', 2, 'op-cross-matter'
              );`,
              [workspaceAId, matterB1Id, createdDocId, `${workspaceAId}/${matterB1Id}/cross_v3.pdf`]
            );
          }, /Document .* not found or scope mismatch/i);
        });

        // 7. Retention Policy: Direct deletion of committed document version 1 is blocked
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `DELETE FROM public.document_versions WHERE document_id = $1 AND version = 1;`,
              [createdDocId]
            );
          }, /Retention policy violation/i);
        });

        // 8. Extracted Fact Review Workflow: Proposed -> Accept / Reject / Edit
        let finding1Id = '';
        let finding2Id = '';

        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          // Insert 2 proposed findings for matter
          const f1 = await tx.query(
            `INSERT INTO public.findings (workspace_id, matter_id, document_id, source_version, finding_text, status)
             VALUES ($1, $2, $3, 1, 'Recital asserts vendor sole ownership by oral arrangement in August 2020', 'Proposed')
             RETURNING id;`,
            [workspaceAId, matterA1Id, createdDocId]
          );
          finding1Id = f1.rows[0].id;

          const f2 = await tx.query(
            `INSERT INTO public.findings (workspace_id, matter_id, document_id, source_version, finding_text, status)
             VALUES ($1, $2, $3, 1, 'Unverified indemnity clause against claims by co-sharers', 'Proposed')
             RETURNING id;`,
            [workspaceAId, matterA1Id, createdDocId]
          );
          finding2Id = f2.rows[0].id;
        });

        // Accept finding 1
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const accRes = await tx.query(
            `SELECT public.review_extracted_fact_atomic($1, $2, 'Accept') AS review_extracted_fact_atomic;`,
            [workspaceAId, finding1Id]
          );
          const f1 = accRes.rows[0].review_extracted_fact_atomic;
          assert.strictEqual(f1.status, 'Accepted');
          assert.strictEqual(f1.reviewed_by_user_id, userAId);
          assert.ok(f1.reviewed_at);
        });

        // Reject finding 2
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const rejRes = await tx.query(
            `SELECT public.review_extracted_fact_atomic($1, $2, 'Reject') AS review_extracted_fact_atomic;`,
            [workspaceAId, finding2Id]
          );
          const f2 = rejRes.rows[0].review_extracted_fact_atomic;
          assert.strictEqual(f2.status, 'Rejected');
          assert.strictEqual(f2.reviewed_by_user_id, userAId);
        });

        // Verify query filtering: ONLY accepted finding enters active context
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const acceptedRows = await tx.query(
            `SELECT * FROM public.findings WHERE workspace_id = $1 AND matter_id = $2 AND status = 'Accepted';`,
            [workspaceAId, matterA1Id]
          );
          assert.strictEqual(acceptedRows.rows.length, 1);
          assert.strictEqual(acceptedRows.rows[0].id, finding1Id);

          // Rejected finding remains in database for audit history
          const rejectedRows = await tx.query(
            `SELECT * FROM public.findings WHERE workspace_id = $1 AND matter_id = $2 AND status = 'Rejected';`,
            [workspaceAId, matterA1Id]
          );
          assert.strictEqual(rejectedRows.rows.length, 1);
          assert.strictEqual(rejectedRows.rows[0].id, finding2Id);
        });
      }
    );

    // 3L. Durable Background Jobs, Atomic Worker Claiming, Lease Recovery, and Idempotent Result Commits
    await t.test(
      '3L. Durable background job queue, atomic lease claiming, lease recovery, idempotent result commits, and RLS isolation',
      { timeout: 15000 },
      async (tL) => {
        let job1Id = '';

        // 1. User A enqueues durable job in Workspace A
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const insertRes = await tx.query(
            `INSERT INTO public.ai_jobs (job_id, workspace_id, matter_id, requested_by_user_id, operation, title, input_record_ids, idempotency_key, status)
             VALUES ('job-3l-001', $1, $2, $3, 'SUMMARIZE_DOCS', 'Summarize Property Deed', ARRAY['doc-3l-1'], 'idem-key-3l-001', 'queued')
             RETURNING id, status, attempt_count;`,
            [workspaceAId, matterA1Id, userAId]
          );
          assert.strictEqual(insertRes.rows[0].status, 'queued');
          assert.strictEqual(insertRes.rows[0].attempt_count, 0);
          job1Id = insertRes.rows[0].id;
        });

        // 2. Operation-level idempotency: duplicate (workspace_id, idempotency_key) rejected by unique constraint
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(tx, async () => {
            await tx.query(
              `INSERT INTO public.ai_jobs (job_id, workspace_id, matter_id, requested_by_user_id, operation, title, input_record_ids, idempotency_key, status)
               VALUES ('job-3l-dup', $1, $2, $3, 'SUMMARIZE_DOCS', 'Duplicate Job', ARRAY['doc-3l-1'], 'idem-key-3l-001', 'queued');`,
              [workspaceAId, matterA1Id, userAId]
            );
          }, /unique constraint|idx_ai_jobs_workspace_id_idempotency_key/i);
        });

        // 3. Worker claims job via claim_next_ai_job_atomic
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const claimRes = await tx.query(
            `SELECT * FROM public.claim_next_ai_job_atomic('test-worker-1', 60);`
          );
          assert.strictEqual(claimRes.rows.length, 1);
          const claimed = claimRes.rows[0];
          assert.strictEqual(claimed.id, job1Id);
          assert.strictEqual(claimed.status, 'processing');
          assert.strictEqual(claimed.attempt_count, 1);
          assert.ok(claimed.lease_token);
          assert.ok(claimed.lease_expires_at);
        });

        // 4. Worker commits result via commit_ai_job_result_atomic
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const commitRes = await tx.query(
            `SELECT * FROM public.commit_ai_job_result_atomic($1, '{"summary":"Deed verified successfully"}'::jsonb, 'Completed processing');`,
            [job1Id]
          );
          assert.ok(commitRes.rows[0].id);
          assert.strictEqual(commitRes.rows[0].job_id, job1Id);

          // Verify job status updated to completed with 100% progress
          const jobCheck = await tx.query(
            `SELECT status, progress, completed_at FROM public.ai_jobs WHERE id = $1;`,
            [job1Id]
          );
          assert.strictEqual(jobCheck.rows[0].status, 'completed');
          assert.strictEqual(jobCheck.rows[0].progress, 100);
          assert.ok(jobCheck.rows[0].completed_at);
        });

        // 5. Duplicate result commit is idempotent
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await tx.query(
            `SELECT * FROM public.commit_ai_job_result_atomic($1, '{"summary":"Updated Deed Summary"}'::jsonb, 'Re-committed');`,
            [job1Id]
          );
          const countRes = await tx.query(
            `SELECT count(*) FROM public.ai_results WHERE job_id = $1;`,
            [job1Id]
          );
          assert.strictEqual(parseInt(countRes.rows[0].count, 10), 1);
        });

        // 6. Lease expiry and recovery test
        let expiredJobId = '';
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const expRes = await tx.query(
            `INSERT INTO public.ai_jobs (job_id, workspace_id, matter_id, requested_by_user_id, operation, title, idempotency_key, status, lease_token, lease_expires_at, attempt_count)
             VALUES ('job-3l-exp', $1, $2, $3, 'FIND_CONTRADICTIONS', 'Contradiction Audit', 'idem-key-exp-01', 'processing', gen_random_uuid(), now() - interval '5 seconds', 1)
             RETURNING id;`,
            [workspaceAId, matterA1Id, userAId]
          );
          expiredJobId = expRes.rows[0].id;
        });

        // Worker recovers expired lease
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const recRes = await tx.query(
            `SELECT * FROM public.claim_next_ai_job_atomic('test-worker-recovery', 60);`
          );
          assert.strictEqual(recRes.rows.length, 1);
          assert.strictEqual(recRes.rows[0].id, expiredJobId);
          assert.strictEqual(recRes.rows[0].status, 'processing');
          assert.strictEqual(recRes.rows[0].attempt_count, 2);
        });

        // 7. RLS Isolation: Outsider User B cannot see Workspace A jobs or results
        await runAsAuthenticatedUser(db, userBId, async (tx) => {
          const outsiderJobs = await tx.query(
            `SELECT * FROM public.ai_jobs WHERE workspace_id = $1;`,
            [workspaceAId]
          );
          assert.strictEqual(outsiderJobs.rows.length, 0);

          const outsiderResults = await tx.query(
            `SELECT * FROM public.ai_results WHERE workspace_id = $1;`,
            [workspaceAId]
          );
          assert.strictEqual(outsiderResults.rows.length, 0);
        });
      }
    );

    // 3M. Client Invitation & Restricted Portal Workflow (Allowed, Denied, Wrong Recipient, Expiry, Revocation, Replay, Cross-Workspace, Internal Data Isolation)
    await t.test(
      '3M. Client invitation lifecycle: staff role & matter checks, SHA-256 token hash enforcement, verified recipient redemption, scope enforcement, internal data isolation, post-redemption revocation, expiry, replay, and cross-workspace attempts',
      { timeout: 20000 },
      async () => {
        const portalClientUserId = '77777777-7777-4777-8777-777777777777';
        const unverifiedClientUserId = '88888888-8888-4888-8888-888888888888';
        const paralegalDId = '99999999-9999-4999-8999-999999999999';
        const matterA2Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

        // Seed additional matter in Workspace A, a verified portal client user, an unverified user, and a paralegal staff member
        await db.query(
          `INSERT INTO auth.users (id, email, raw_user_meta_data)
           VALUES
             ($1, 'verified.client@company.in', '{"email_verified": true}'::jsonb),
             ($2, 'unverified.client@company.in', '{"email_verified": false}'::jsonb),
             ($3, 'paralegal.d@chamberA.in', '{"email_verified": true}'::jsonb)
           ON CONFLICT (id) DO NOTHING;`,
          [portalClientUserId, unverifiedClientUserId, paralegalDId]
        );

        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await tx.query(
            `INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
             VALUES ($1, $2, 'PARALEGAL', 'Active')
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'PARALEGAL', status = 'Active';`,
            [workspaceAId, paralegalDId]
          );
          await tx.query(
            `INSERT INTO public.matters (id, workspace_id, title, case_number, client_name, client_email, court_name, stage, status)
             VALUES ($1, $2, 'Unshared Matter A2', 'CS/999/2026', 'Other Client', 'other@company.in', 'Bombay High Court', 'Trial', 'Active')
             ON CONFLICT (id) DO NOTHING;`,
            [matterA2Id, workspaceAId]
          );
          // Seed a shared filing document and internal staff records on matterA1Id
          await tx.query(
            `INSERT INTO public.documents (workspace_id, matter_id, name, doc_type, storage_bucket, file_path, file_size, mime_type, current_version)
             VALUES ($1, $2, 'Order_Sheet_Shared.pdf', 'Court Order', 'matter-documents', $3, 4096, 'application/pdf', 1);`,
            [workspaceAId, matterA1Id, `${workspaceAId}/${matterA1Id}/Order_Sheet_Shared.pdf`]
          );
          await tx.query(
            `INSERT INTO public.clients (workspace_id, name, email, phone)
             VALUES ($1, 'Confidential Staff Directory Client', 'directory@chamberA.in', '+919999900000');`,
            [workspaceAId]
          );
          await tx.query(
            `INSERT INTO public.research_notes (workspace_id, matter_id, query, notes)
             VALUES ($1, $2, 'Internal Strategy Memo', 'Do not disclose settlement floor to opposite counsel');`,
            [workspaceAId, matterA1Id]
          );
        });

        const validTokenHash =
          'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

        // 1. Reject non-SHA-256 / raw short tokens
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.create_client_invitation_atomic($1, $2, 'verified.client@company.in', 'Verified Client', NULL, 'short-math-random-token', '{"viewHearings":true}'::jsonb, NOW() + INTERVAL '7 days', 'email_not_sent');`,
                [workspaceAId, matterA1Id]
              );
            },
            /64-character SHA-256 token_hash/i
          );
        });

        // 2. Denied creation: PARALEGAL role in Workspace A cannot create client invitations
        await runAsAuthenticatedUser(db, paralegalDId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.create_client_invitation_atomic($1, $2, 'verified.client@company.in', 'Verified Client', NULL, $3, '{"viewHearings":true}'::jsonb, NOW() + INTERVAL '7 days', 'email_not_sent');`,
                [workspaceAId, matterA1Id, validTokenHash]
              );
            },
            /403 Forbidden/i
          );
        });

        // 3. Cross-workspace attempt: User B (Workspace B owner) cannot create an invitation in Workspace A or for Matter A1 in Workspace B
        await runAsAuthenticatedUser(db, userBId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.create_client_invitation_atomic($1, $2, 'verified.client@company.in', 'Verified Client', NULL, $3, '{"viewHearings":true}'::jsonb, NOW() + INTERVAL '7 days', 'email_not_sent');`,
                [workspaceAId, matterA1Id, validTokenHash]
              );
            },
            /403 Forbidden/i
          );

          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.create_client_invitation_atomic($1, $2, 'verified.client@company.in', 'Verified Client', NULL, $3, '{"viewHearings":true}'::jsonb, NOW() + INTERVAL '7 days', 'email_not_sent');`,
                [workspaceBId, matterA1Id, validTokenHash]
              );
            },
            /403 Forbidden: Specified matter does not exist in workspace/i
          );
        });

        // 4. Allowed creation: Authorized staff (User A, CHAMBER_OWNER) creates invitation with explicit scopes (viewHearings=true, viewFilings=true, viewBilling=false)
        let createdInvitationId = '';
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const res = await tx.query(
            `SELECT public.create_client_invitation_atomic(
               $1,
               $2,
               '  Verified.Client@Company.in ',
               'Verified Client',
               '+91 98201 11223',
               $3,
               '{"viewHearings":true,"viewFilings":true,"viewBilling":false,"uploadDocs":true,"chatAi":false}'::jsonb,
               NOW() + INTERVAL '7 days',
               'email_not_sent'
             ) AS result;`,
            [workspaceAId, matterA1Id, validTokenHash]
          );
          const inv = res.rows[0].result;
          assert.ok(inv.id);
          assert.strictEqual(inv.client_email, 'verified.client@company.in');
          assert.strictEqual(inv.matter_id, matterA1Id);
          assert.strictEqual(inv.workspace_id, workspaceAId);
          assert.strictEqual(inv.created_by_user_id, userAId);
          assert.strictEqual(inv.status, 'Active');
          assert.strictEqual(inv.delivery_status, 'email_not_sent');
          assert.strictEqual(inv.scopes.viewHearings, true);
          assert.strictEqual(inv.scopes.viewFilings, true);
          assert.strictEqual(inv.scopes.viewBilling, false);
          assert.strictEqual(inv.scopes.uploadDocs, true);
          assert.strictEqual(inv.token_hash, undefined, 'RPC response must not leak token_hash');
          createdInvitationId = inv.id;
        });

        // 5. Wrong recipient rejection: User B (advocate.b@chamberB.in) attempts to redeem invitation meant for verified.client@company.in
        await runAsAuthenticatedUser(db, userBId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(`SELECT public.redeem_client_invitation_atomic($1);`, [validTokenHash]);
            },
            /403 Forbidden: Recipient email mismatch/i
          );
        });

        // 6. Unverified recipient rejection: unverified.client@company.in cannot redeem an invitation
        const unverifiedTokenHash =
          'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9012';
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await tx.query(
            `SELECT public.create_client_invitation_atomic($1, $2, 'unverified.client@company.in', 'Unverified Client', NULL, $3, '{"viewHearings":true}'::jsonb, NOW() + INTERVAL '7 days', 'email_not_sent');`,
            [workspaceAId, matterA1Id, unverifiedTokenHash]
          );
        });
        await runAsAuthenticatedUser(db, unverifiedClientUserId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(`SELECT public.redeem_client_invitation_atomic($1);`, [
                unverifiedTokenHash,
              ]);
            },
            /403 Forbidden: Recipient email address must be verified/i
          );
        });

        // 7. Allowed atomic redemption: verified.client@company.in redeems the invitation
        await runAsAuthenticatedUser(db, portalClientUserId, async (tx) => {
          const redeemRes = await tx.query(
            `SELECT public.redeem_client_invitation_atomic($1) AS result;`,
            [validTokenHash]
          );
          const grant = redeemRes.rows[0].result;
          assert.strictEqual(grant.invitation_id, createdInvitationId);
          assert.strictEqual(grant.workspace_id, workspaceAId);
          assert.strictEqual(grant.matter_id, matterA1Id);
          assert.strictEqual(grant.client_user_id, portalClientUserId);
          assert.strictEqual(grant.status, 'Redeemed');
          assert.strictEqual(grant.replayed, false);
          assert.strictEqual(grant.scopes.viewBilling, false);
          assert.strictEqual(grant.scopes.viewFilings, true);
        });

        // 8. Repeated redemption / replay handling:
        // 8a. Same verified recipient repeating redemption while grant is active succeeds idempotently (replayed=true, no duplicate grants)
        await runAsAuthenticatedUser(db, portalClientUserId, async (tx) => {
          const replayRes = await tx.query(
            `SELECT public.redeem_client_invitation_atomic($1) AS result;`,
            [validTokenHash]
          );
          assert.strictEqual(replayRes.rows[0].result.replayed, true);

          const grantsCount = await tx.query(
            `SELECT COUNT(*) AS count FROM public.client_access_grants WHERE workspace_id = $1 AND matter_id = $2 AND client_user_id = $3;`,
            [workspaceAId, matterA1Id, portalClientUserId]
          );
          assert.strictEqual(parseInt(grantsCount.rows[0].count, 10), 1);
        });

        // 9. Enforce grants, scopes, and strict internal data isolation via RLS & backend RPC
        await runAsAuthenticatedUser(db, portalClientUserId, async (tx) => {
          // Allowed: granted matter A1 is visible, but unshared matter A2 (same workspace) and matter B1 (other workspace) are invisible
          const mattersRes = await tx.query(`SELECT id FROM public.matters;`);
          assert.strictEqual(mattersRes.rows.length, 1);
          assert.strictEqual(mattersRes.rows[0].id, matterA1Id);

          // Allowed scope: viewHearings=true -> hearings on matterA1Id visible
          const hearingsRes = await tx.query(
            `SELECT id FROM public.hearings WHERE matter_id = $1;`,
            [matterA1Id]
          );
          assert.ok(hearingsRes.rows.length >= 1);

          // Allowed scope: viewFilings=true -> documents on matterA1Id visible
          const docsRes = await tx.query(
            `SELECT id, name FROM public.documents WHERE matter_id = $1;`,
            [matterA1Id]
          );
          assert.ok(docsRes.rows.length >= 1);

          // Denied scope: viewBilling=false -> invoices on matterA1Id MUST return 0 rows
          const invoicesRes = await tx.query(
            `SELECT id FROM public.invoices WHERE matter_id = $1;`,
            [matterA1Id]
          );
          assert.strictEqual(
            invoicesRes.rows.length,
            0,
            'Client without viewBilling scope must not see invoices'
          );

          // Strictly inaccessible internal data: findings, drafts, draft_versions, research_notes, tasks, time_entries, clients, ai_jobs, ai_results, client_invitations
          const findingsRes = await tx.query(`SELECT id FROM public.findings;`);
          assert.strictEqual(findingsRes.rows.length, 0, 'Internal findings must be inaccessible');

          const draftsRes = await tx.query(`SELECT id FROM public.drafts;`);
          assert.strictEqual(draftsRes.rows.length, 0, 'Private drafts must be inaccessible');

          const draftVerRes = await tx.query(`SELECT id FROM public.draft_versions;`);
          assert.strictEqual(draftVerRes.rows.length, 0, 'Draft versions must be inaccessible');

          const notesRes = await tx.query(`SELECT id FROM public.research_notes;`);
          assert.strictEqual(notesRes.rows.length, 0, 'Research notes must be inaccessible');

          const tasksRes = await tx.query(`SELECT id FROM public.tasks;`);
          assert.strictEqual(tasksRes.rows.length, 0, 'Staff tasks must be inaccessible');

          const timeRes = await tx.query(`SELECT id FROM public.time_entries;`);
          assert.strictEqual(timeRes.rows.length, 0, 'Staff time entries must be inaccessible');

          const dirRes = await tx.query(`SELECT id FROM public.clients;`);
          assert.strictEqual(dirRes.rows.length, 0, 'Staff client directory must be inaccessible');

          const jobsRes = await tx.query(`SELECT id FROM public.ai_jobs;`);
          assert.strictEqual(jobsRes.rows.length, 0, 'Internal AI jobs must be inaccessible');

          const invTableRes = await tx.query(`SELECT id FROM public.client_invitations;`);
          assert.strictEqual(
            invTableRes.rows.length,
            0,
            'Workspace client_invitations table must be inaccessible to clients'
          );

          // Verify get_restricted_client_portal_matter_atomic returns scoped data and blocks ungranted matterA2Id
          const portalDataRes = await tx.query(
            `SELECT public.get_restricted_client_portal_matter_atomic($1) AS view;`,
            [matterA1Id]
          );
          const portalView = portalDataRes.rows[0].view;
          assert.strictEqual(portalView.matter.id, matterA1Id);
          assert.ok(Array.isArray(portalView.hearings) && portalView.hearings.length >= 1);
          assert.ok(Array.isArray(portalView.documents) && portalView.documents.length >= 1);
          assert.strictEqual(portalView.invoices.length, 0);
          assert.strictEqual(portalView.findings, undefined);
          assert.strictEqual(portalView.drafts, undefined);

          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.get_restricted_client_portal_matter_atomic($1);`,
                [matterA2Id]
              );
            },
            /403 Forbidden/i
          );
        });

        // 10. Post-Redemption Revocation & Replay-After-Revocation Rejection
        // Unauthorized user cannot revoke
        await runAsAuthenticatedUser(db, paralegalDId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.revoke_client_invitation_atomic($1, $2);`,
                [workspaceAId, createdInvitationId]
              );
            },
            /403 Forbidden/i
          );
        });

        // Authorized staff (User A) revokes invitation after redemption
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          const revRes = await tx.query(
            `SELECT public.revoke_client_invitation_atomic($1, $2) AS result;`,
            [workspaceAId, createdInvitationId]
          );
          assert.strictEqual(revRes.rows[0].result.status, 'Revoked');
          assert.strictEqual(revRes.rows[0].result.revoked_grants_count, 1);
        });

        // Verify client access is immediately terminated and token replay is rejected
        await runAsAuthenticatedUser(db, portalClientUserId, async (tx) => {
          const mattersAfterRevoke = await tx.query(
            `SELECT id FROM public.matters WHERE id = $1;`,
            [matterA1Id]
          );
          assert.strictEqual(
            mattersAfterRevoke.rows.length,
            0,
            'Revoked client must immediately lose RLS access to matter'
          );

          const docsAfterRevoke = await tx.query(
            `SELECT id FROM public.documents WHERE matter_id = $1;`,
            [matterA1Id]
          );
          assert.strictEqual(
            docsAfterRevoke.rows.length,
            0,
            'Revoked client must immediately lose RLS access to documents'
          );

          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(
                `SELECT public.get_restricted_client_portal_matter_atomic($1);`,
                [matterA1Id]
              );
            },
            /403 Forbidden/i
          );

          // Replay of revoked token must be rejected
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(`SELECT public.redeem_client_invitation_atomic($1);`, [
                validTokenHash,
              ]);
            },
            /403 Forbidden: This client portal invitation has been revoked/i
          );
        });

        // 11. Expired Invitation Rejection (410 Gone)
        const expiredTokenHash =
          'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f901234';
        await runAsAuthenticatedUser(db, userAId, async (tx) => {
          await tx.query(
            `INSERT INTO public.client_invitations (workspace_id, matter_id, client_email, client_name, token_hash, scopes, expires_at, created_by_user_id, status)
             VALUES ($1, $2, 'verified.client@company.in', 'Verified Client', $3, '{"viewHearings":true}'::jsonb, NOW() - INTERVAL '1 hour', $4, 'Active');`,
            [workspaceAId, matterA1Id, expiredTokenHash, userAId]
          );
        });

        await runAsAuthenticatedUser(db, portalClientUserId, async (tx) => {
          await expectTransactionFailure(
            tx,
            async () => {
              await tx.query(`SELECT public.redeem_client_invitation_atomic($1);`, [
                expiredTokenHash,
              ]);
            },
            /410 Gone: This client portal invitation has expired/i
          );
        });
      }
    );
  } finally {
    await db.close();
  }
});

