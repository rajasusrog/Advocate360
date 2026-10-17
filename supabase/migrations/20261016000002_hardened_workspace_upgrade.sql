-- ====================================================================
-- Advocate360 LegalOS - Hardened Workspace Upgrade & RLS Migration
-- Migration Version: 20261016000002
-- File: 20261016000002_hardened_workspace_upgrade.sql
--
-- Supports both:
--   1. Fresh installations (executed sequentially after 20261016000001)
--   2. Existing databases upgrading from 20261016000001_initial_schema.sql
--
-- Key Actions:
--   - Explicitly upgrades workspaces and matters columns to match UI fields
--   - Explicitly adds missing workspace_id columns to document_versions,
--     draft_versions, and ai_results, backfills from parent rows, and sets NOT NULL
--   - Enforces cross-table workspace & matter consistency for all parent,
--     client, source-document, source-finding, invoice, and task relationships
--   - Removes obsolete permissive *_member_all policies
--   - Establishes hardened role-based RLS policies (including restricted client grants)
--   - Provides atomic create_workspace_with_owner and create_matter_with_client RPCs
-- ====================================================================

-- 1. EXPLICIT ALTER TABLE UPGRADES FOR WORKSPACES & MATTERS (UI FIELD ALIGNMENT)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_no TEXT,
  ADD COLUMN IF NOT EXISTS state_bar_council TEXT,
  ADD COLUMN IF NOT EXISTS office_location TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS practice_areas JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'Intake',
  ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS opposite_party TEXT,
  ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS case_assessment JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workflow_stages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS previous_status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100) NOT NULL DEFAULT 'matter-documents',
  ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1;

ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT;

ALTER TABLE public.workspace_memberships
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS member_email TEXT,
  ADD COLUMN IF NOT EXISTS member_name TEXT,
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS proves_what TEXT,
  ADD COLUMN IF NOT EXISTS cannot_prove TEXT,
  ADD COLUMN IF NOT EXISTS evidence_date DATE DEFAULT CURRENT_DATE;

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS flag TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS depends_on JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS suggested_buffer_days INT,
  ADD COLUMN IF NOT EXISTS buffer_alert_reason TEXT;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS advocate_role TEXT DEFAULT 'Advocate';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate_percentage NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS approved_version INT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. EXPLICIT UPGRADE & BACKFILL OF MISSING workspace_id COLUMNS ON CHILD TABLES
-- 2a. document_versions
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.document_versions dv
SET workspace_id = d.workspace_id
FROM public.documents d
WHERE dv.document_id = d.id
  AND dv.workspace_id IS NULL;

ALTER TABLE public.document_versions
  ALTER COLUMN workspace_id SET NOT NULL;

-- 2b. draft_versions
ALTER TABLE public.draft_versions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.draft_versions drv
SET workspace_id = dr.workspace_id
FROM public.drafts dr
WHERE drv.draft_id = dr.id
  AND drv.workspace_id IS NULL;

ALTER TABLE public.draft_versions
  ALTER COLUMN workspace_id SET NOT NULL;

-- 2c. ai_results
ALTER TABLE public.ai_results
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.ai_results ar
SET workspace_id = aj.workspace_id
FROM public.ai_jobs aj
WHERE ar.job_id = aj.id
  AND ar.workspace_id IS NULL;

ALTER TABLE public.ai_results
  ALTER COLUMN workspace_id SET NOT NULL;

-- 3. ENFORCE CROSS-TABLE WORKSPACE & MATTER CONSISTENCY
-- 3a. Composite Unique Constraints on Parent Entities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_clients_id_workspace') THEN
    ALTER TABLE public.clients ADD CONSTRAINT uq_clients_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_matters_id_workspace') THEN
    ALTER TABLE public.matters ADD CONSTRAINT uq_matters_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_documents_id_workspace') THEN
    ALTER TABLE public.documents ADD CONSTRAINT uq_documents_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_documents_id_matter_workspace') THEN
    ALTER TABLE public.documents ADD CONSTRAINT uq_documents_id_matter_workspace UNIQUE (id, matter_id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_findings_id_workspace') THEN
    ALTER TABLE public.findings ADD CONSTRAINT uq_findings_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_findings_id_matter_workspace') THEN
    ALTER TABLE public.findings ADD CONSTRAINT uq_findings_id_matter_workspace UNIQUE (id, matter_id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_drafts_id_workspace') THEN
    ALTER TABLE public.drafts ADD CONSTRAINT uq_drafts_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tasks_id_workspace') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT uq_tasks_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_id_workspace') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT uq_invoices_id_workspace UNIQUE (id, workspace_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ai_jobs_id_workspace') THEN
    ALTER TABLE public.ai_jobs ADD CONSTRAINT uq_ai_jobs_id_workspace UNIQUE (id, workspace_id);
  END IF;
END $$;

-- 3b. Composite Foreign Keys Guaranteeing Same-Workspace (and Same-Matter) Ownership
--     Includes client relationships (matters -> clients) and source-document relationships
--     (findings -> documents, evidence -> documents, timeline_events -> findings)
DO $$
BEGIN
  -- Matter -> Client same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_matters_client_workspace') THEN
    ALTER TABLE public.matters
      ADD CONSTRAINT fk_matters_client_workspace
      FOREIGN KEY (client_id, workspace_id) REFERENCES public.clients(id, workspace_id) ON DELETE SET NULL (client_id);
  END IF;

  -- Document -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_matter_workspace') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT fk_documents_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Document Version -> Document same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_document_versions_doc_workspace') THEN
    ALTER TABLE public.document_versions
      ADD CONSTRAINT fk_document_versions_doc_workspace
      FOREIGN KEY (document_id, workspace_id) REFERENCES public.documents(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Finding -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_findings_matter_workspace') THEN
    ALTER TABLE public.findings
      ADD CONSTRAINT fk_findings_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Finding -> Source Document same-matter & same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_findings_document_workspace') THEN
    ALTER TABLE public.findings
      ADD CONSTRAINT fk_findings_document_workspace
      FOREIGN KEY (document_id, matter_id, workspace_id) REFERENCES public.documents(id, matter_id, workspace_id) ON DELETE SET NULL (document_id);
  END IF;

  -- Evidence -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evidence_matter_workspace') THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT fk_evidence_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Evidence -> Source Document same-matter & same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evidence_source_doc_workspace') THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT fk_evidence_source_doc_workspace
      FOREIGN KEY (source_doc_id, matter_id, workspace_id) REFERENCES public.documents(id, matter_id, workspace_id) ON DELETE SET NULL (source_doc_id);
  END IF;

  -- Timeline Event -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timeline_events_matter_workspace') THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT fk_timeline_events_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Timeline Event -> Source Finding same-matter & same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timeline_finding_workspace') THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT fk_timeline_finding_workspace
      FOREIGN KEY (source_finding_id, matter_id, workspace_id) REFERENCES public.findings(id, matter_id, workspace_id) ON DELETE SET NULL (source_finding_id);
  END IF;

  -- Research Note -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_research_notes_matter_workspace') THEN
    ALTER TABLE public.research_notes
      ADD CONSTRAINT fk_research_notes_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Draft -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_drafts_matter_workspace') THEN
    ALTER TABLE public.drafts
      ADD CONSTRAINT fk_drafts_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Draft Version -> Draft same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_draft_versions_draft_workspace') THEN
    ALTER TABLE public.draft_versions
      ADD CONSTRAINT fk_draft_versions_draft_workspace
      FOREIGN KEY (draft_id, workspace_id) REFERENCES public.drafts(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Task -> Dependency Task same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_dependency_workspace') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_dependency_workspace
      FOREIGN KEY (dependency_task_id, workspace_id) REFERENCES public.tasks(id, workspace_id) ON DELETE SET NULL (dependency_task_id);
  END IF;

  -- Hearing -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hearings_matter_workspace') THEN
    ALTER TABLE public.hearings
      ADD CONSTRAINT fk_hearings_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Time Entry -> Invoice same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_entries_invoice_workspace') THEN
    ALTER TABLE public.time_entries
      ADD CONSTRAINT fk_time_entries_invoice_workspace
      FOREIGN KEY (invoice_id, workspace_id) REFERENCES public.invoices(id, workspace_id) ON DELETE SET NULL (invoice_id);
  END IF;

  -- Payment -> Invoice same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_invoice_workspace') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT fk_payments_invoice_workspace
      FOREIGN KEY (invoice_id, workspace_id) REFERENCES public.invoices(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Client Invitation -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_invitations_matter_workspace') THEN
    ALTER TABLE public.client_invitations
      ADD CONSTRAINT fk_client_invitations_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- Client Access Grant -> Matter same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_access_grants_matter_workspace') THEN
    ALTER TABLE public.client_access_grants
      ADD CONSTRAINT fk_client_access_grants_matter_workspace
      FOREIGN KEY (matter_id, workspace_id) REFERENCES public.matters(id, workspace_id) ON DELETE CASCADE;
  END IF;

  -- AI Result -> AI Job same-workspace constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_results_job_workspace') THEN
    ALTER TABLE public.ai_results
      ADD CONSTRAINT fk_ai_results_job_workspace
      FOREIGN KEY (job_id, workspace_id) REFERENCES public.ai_jobs(id, workspace_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3c. Trigger Enforcing Workspace Consistency Across Nullable MatterForeign Keys
CREATE OR REPLACE FUNCTION public.enforce_matter_workspace_consistency()
RETURNS TRIGGER AS $$
DECLARE
  parent_ws_id UUID;
BEGIN
  IF NEW.matter_id IS NOT NULL THEN
    SELECT workspace_id INTO parent_ws_id FROM public.matters WHERE id = NEW.matter_id;
    IF parent_ws_id IS NULL OR parent_ws_id != NEW.workspace_id THEN
      RAISE EXCEPTION 'Workspace consistency violation: matter % does not belong to workspace %', NEW.matter_id, NEW.workspace_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
  nullable_matter_tables TEXT[] := ARRAY['tasks', 'time_entries', 'invoices', 'ai_jobs', 'activity_events'];
BEGIN
  FOREACH tbl IN ARRAY nullable_matter_tables LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_enforce_ws_%I ON public.%I;
      CREATE TRIGGER trg_enforce_ws_%I
      BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.enforce_matter_workspace_consistency();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- 4. REMOVE OBSOLETE PERMISSIVE POLICIES
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname LIKE '%_member_all'
        OR policyname IN (
          'workspaces_member_select',
          'workspace_memberships_user_select',
          'profiles_self_all'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 5. HARDENED AUTHORIZATION FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_workspace_role(ws_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  user_role VARCHAR;
BEGIN
  SELECT role INTO user_role
  FROM public.workspace_memberships
  WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND status = 'Active';
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  role VARCHAR;
BEGIN
  role := public.get_user_workspace_role(ws_id);
  RETURN role IS NOT NULL AND role != 'CLIENT';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_chamber_admin(ws_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  role VARCHAR;
BEGIN
  role := public.get_user_workspace_role(ws_id);
  RETURN role IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_client_matter_grant(m_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_access_grants
    WHERE matter_id = m_id
      AND client_user_id = auth.uid()
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_client_matter_scope(m_id UUID, scope_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_access_grants
    WHERE matter_id = m_id
      AND client_user_id = auth.uid()
      AND revoked_at IS NULL
      AND COALESCE((scopes ->> scope_key)::boolean, false) = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. EXPLICIT ROLE-BASED RLS POLICIES

-- Profiles
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_upsert ON public.profiles;
CREATE POLICY profiles_self_upsert ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Workspaces
DROP POLICY IF EXISTS workspaces_member ON public.workspaces;
CREATE POLICY workspaces_member ON public.workspaces
  FOR SELECT USING (public.get_user_workspace_role(id) IS NOT NULL);

DROP POLICY IF EXISTS workspaces_admin_update ON public.workspaces;
CREATE POLICY workspaces_admin_update ON public.workspaces
  FOR UPDATE USING (public.is_chamber_admin(id)) WITH CHECK (public.is_chamber_admin(id));

-- Workspace Memberships
DROP POLICY IF EXISTS memberships_select ON public.workspace_memberships;
CREATE POLICY memberships_select ON public.workspace_memberships
  FOR SELECT USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS memberships_admin_manage ON public.workspace_memberships;
CREATE POLICY memberships_admin_manage ON public.workspace_memberships
  FOR ALL USING (public.is_chamber_admin(workspace_id)) WITH CHECK (public.is_chamber_admin(workspace_id));

-- Matters (Staff full access; Restricted Clients read-only on explicitly granted matters)
DROP POLICY IF EXISTS matters_select ON public.matters;
CREATE POLICY matters_select ON public.matters
  FOR SELECT USING (public.is_workspace_member(workspace_id) OR public.has_client_matter_grant(id));

DROP POLICY IF EXISTS matters_modify ON public.matters;
CREATE POLICY matters_modify ON public.matters
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.is_billing_authorized(ws_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  role VARCHAR;
BEGIN
  role := public.get_user_workspace_role(ws_id);
  RETURN role IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Parent-Based & Workspace-Scoped Policies for Staff Operational Tables
DO $$
DECLARE
  t TEXT;
  staff_tables TEXT[] := ARRAY[
    'clients', 'documents', 'findings', 'evidence',
    'timeline_events', 'research_notes', 'drafts', 'tasks',
    'time_entries', 'client_invitations',
    'client_access_grants', 'ai_jobs'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I_select ON public.%I;
      CREATE POLICY %I_select ON public.%I
        FOR SELECT USING (public.is_workspace_member(workspace_id));
      DROP POLICY IF EXISTS %I_modify ON public.%I;
      CREATE POLICY %I_modify ON public.%I
        FOR ALL USING (public.is_workspace_member(workspace_id))
        WITH CHECK (public.is_workspace_member(workspace_id));
    ', t, t, t, t, t, t, t, t);
  END LOOP;
END $$;

-- Append-Only Activity/Audit Events (Insert & Select allowed, No Update or Delete to prevent tampering)
DROP POLICY IF EXISTS activity_events_select ON public.activity_events;
CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS activity_events_insert ON public.activity_events;
CREATE POLICY activity_events_insert ON public.activity_events
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

-- Hearings (Staff full access; Restricted Clients read-only when granted viewHearings scope on matter)
DROP POLICY IF EXISTS hearings_select ON public.hearings;
CREATE POLICY hearings_select ON public.hearings
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR public.has_client_matter_scope(matter_id, 'viewHearings')
  );

DROP POLICY IF EXISTS hearings_modify ON public.hearings;
CREATE POLICY hearings_modify ON public.hearings
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Invoices (Billing-Authorized Staff full access; Restricted Clients read-only when granted viewBilling scope on matter)
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR (matter_id IS NOT NULL AND public.has_client_matter_scope(matter_id, 'viewBilling'))
  );

DROP POLICY IF EXISTS invoices_modify ON public.invoices;
CREATE POLICY invoices_modify ON public.invoices
  FOR ALL USING (
    public.is_billing_authorized(workspace_id)
    AND public.get_user_workspace_role(workspace_id) != 'PARALEGAL'
  )
  WITH CHECK (
    public.is_billing_authorized(workspace_id)
    AND public.get_user_workspace_role(workspace_id) != 'PARALEGAL'
  );

-- Payments (Billing-Authorized Staff modify; Workspace Members select)
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS payments_modify ON public.payments;
CREATE POLICY payments_modify ON public.payments
  FOR ALL USING (
    public.is_billing_authorized(workspace_id)
    AND public.get_user_workspace_role(workspace_id) != 'PARALEGAL'
  )
  WITH CHECK (
    public.is_billing_authorized(workspace_id)
    AND public.get_user_workspace_role(workspace_id) != 'PARALEGAL'
  );

-- Parent-verified policies for document_versions, draft_versions, and ai_results
DROP POLICY IF EXISTS document_versions_select ON public.document_versions;
CREATE POLICY document_versions_select ON public.document_versions
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_versions.document_id
        AND d.workspace_id = document_versions.workspace_id
    )
  );

DROP POLICY IF EXISTS document_versions_modify ON public.document_versions;
CREATE POLICY document_versions_modify ON public.document_versions
  FOR ALL USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_versions.document_id
        AND d.workspace_id = document_versions.workspace_id
    )
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_versions.document_id
        AND d.workspace_id = document_versions.workspace_id
    )
  );

DROP POLICY IF EXISTS draft_versions_select ON public.draft_versions;
CREATE POLICY draft_versions_select ON public.draft_versions
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.drafts dr
      WHERE dr.id = draft_versions.draft_id
        AND dr.workspace_id = draft_versions.workspace_id
    )
  );

DROP POLICY IF EXISTS draft_versions_modify ON public.draft_versions;
CREATE POLICY draft_versions_modify ON public.draft_versions
  FOR ALL USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.drafts dr
      WHERE dr.id = draft_versions.draft_id
        AND dr.workspace_id = draft_versions.workspace_id
    )
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.drafts dr
      WHERE dr.id = draft_versions.draft_id
        AND dr.workspace_id = draft_versions.workspace_id
    )
  );

DROP POLICY IF EXISTS ai_results_select ON public.ai_results;
CREATE POLICY ai_results_select ON public.ai_results
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_jobs aj
      WHERE aj.id = ai_results.job_id
        AND aj.workspace_id = ai_results.workspace_id
    )
  );

DROP POLICY IF EXISTS ai_results_modify ON public.ai_results;
CREATE POLICY ai_results_modify ON public.ai_results
  FOR ALL USING (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_jobs aj
      WHERE aj.id = ai_results.job_id
        AND aj.workspace_id = ai_results.workspace_id
    )
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.ai_jobs aj
      WHERE aj.id = ai_results.job_id
        AND aj.workspace_id = ai_results.workspace_id
    )
  );

-- Restricted Client Access Grants Self-Select
DROP POLICY IF EXISTS client_grants_self_select ON public.client_access_grants;
CREATE POLICY client_grants_self_select ON public.client_access_grants
  FOR SELECT USING (client_user_id = auth.uid() AND revoked_at IS NULL);

-- 7. ATOMIC WORKSPACE CREATION RPC (Drop 3-arg overload first to avoid ambiguity)
DROP FUNCTION IF EXISTS public.create_workspace_with_owner(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  ws_name TEXT,
  adv_name TEXT,
  ws_city TEXT,
  bar_enrollment TEXT DEFAULT NULL,
  bar_council TEXT DEFAULT NULL,
  ws_phone TEXT DEFAULT NULL,
  ws_email TEXT DEFAULT NULL,
  ws_practice_areas JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB AS $$
DECLARE
  caller_uid UUID;
  new_ws_id UUID;
  new_membership_id UUID;
  result JSONB;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated call to create_workspace_with_owner';
  END IF;

  INSERT INTO public.workspaces (
    name,
    advocate_name,
    city,
    office_location,
    owner_user_id,
    enrollment_no,
    state_bar_council,
    phone,
    email,
    practice_areas
  )
  VALUES (
    ws_name,
    adv_name,
    ws_city,
    ws_city,
    caller_uid,
    bar_enrollment,
    bar_council,
    ws_phone,
    ws_email,
    COALESCE(ws_practice_areas, '[]'::jsonb)
  )
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_memberships (workspace_id, user_id, member_email, member_name, role, status)
  VALUES (new_ws_id, caller_uid, COALESCE(ws_email, ''), adv_name, 'CHAMBER_OWNER', 'Active')
  RETURNING id INTO new_membership_id;

  INSERT INTO public.profiles (id, full_name, email, bar_enrollment_no, phone)
  VALUES (
    caller_uid,
    adv_name,
    COALESCE(ws_email, ''),
    bar_enrollment,
    ws_phone
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    bar_enrollment_no = COALESCE(EXCLUDED.bar_enrollment_no, public.profiles.bar_enrollment_no),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();

  result := jsonb_build_object(
    'workspace_id', new_ws_id,
    'membership_id', new_membership_id,
    'role', 'CHAMBER_OWNER'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. ATOMIC CLIENT + MATTER CREATION RPC
CREATE OR REPLACE FUNCTION public.create_matter_with_client(
  p_workspace_id UUID,
  p_title TEXT,
  p_client_name TEXT,
  p_case_number TEXT DEFAULT NULL,
  p_case_type TEXT DEFAULT 'Property Dispute',
  p_status VARCHAR(40) DEFAULT 'Intake',
  p_client_phone TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_opposite_party TEXT DEFAULT NULL,
  p_court_name TEXT DEFAULT 'Court Not Specified',
  p_judge_name TEXT DEFAULT NULL,
  p_next_hearing_date DATE DEFAULT NULL,
  p_summary TEXT DEFAULT ''
) RETURNS public.matters AS $$
DECLARE
  v_client_id UUID;
  v_matter public.matters;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated call to create_matter_with_client';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not an active advocate member of workspace %', p_workspace_id;
  END IF;

  IF p_client_name IS NOT NULL AND btrim(p_client_name) <> '' THEN
    INSERT INTO public.clients (workspace_id, name, email, phone)
    VALUES (p_workspace_id, btrim(p_client_name), p_client_email, p_client_phone)
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO public.matters (
    workspace_id,
    client_id,
    title,
    case_number,
    case_type,
    status,
    stage,
    client_name,
    client_phone,
    client_email,
    opposite_party,
    court_name,
    judge_name,
    next_hearing_date,
    summary
  )
  VALUES (
    p_workspace_id,
    v_client_id,
    p_title,
    p_case_number,
    p_case_type,
    COALESCE(p_status, 'Intake'),
    COALESCE(p_status, 'Intake'),
    COALESCE(p_client_name, ''),
    p_client_phone,
    p_client_email,
    p_opposite_party,
    p_court_name,
    p_judge_name,
    p_next_hearing_date,
    COALESCE(p_summary, '')
  )
  RETURNING * INTO v_matter;

  RETURN v_matter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. IMMUTABLE DOCUMENT VERSIONS TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_document_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutable record violation: document_versions rows cannot be modified in place. Insert a new version row instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_document_versions ON public.document_versions;
CREATE TRIGGER trg_immutable_document_versions
  BEFORE UPDATE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_document_version_mutation();

-- 10. PRIVATE SUPABASE STORAGE BUCKET & RLS POLICIES (matter-documents)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('matter-documents', 'matter-documents', false, 52428800)
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS storage_matter_docs_select ON storage.objects;
    CREATE POLICY storage_matter_docs_select ON storage.objects
      FOR SELECT USING (
        bucket_id = 'matter-documents'
        AND public.is_workspace_member(NULLIF((storage.foldername(name))[1], '')::uuid)
      );

    DROP POLICY IF EXISTS storage_matter_docs_insert ON storage.objects;
    CREATE POLICY storage_matter_docs_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'matter-documents'
        AND public.is_workspace_member(NULLIF((storage.foldername(name))[1], '')::uuid)
      );

    DROP POLICY IF EXISTS storage_matter_docs_delete ON storage.objects;
    CREATE POLICY storage_matter_docs_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'matter-documents'
        AND public.is_workspace_member(NULLIF((storage.foldername(name))[1], '')::uuid)
      );
  END IF;
END $$;

