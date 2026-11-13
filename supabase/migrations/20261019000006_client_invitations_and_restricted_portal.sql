-- ====================================================================
-- Migration: 20261019000006_client_invitations_and_restricted_portal.sql
-- Description: Persisted client invitations (SHA-256 token_hash only),
--              atomic verified-recipient redemption, post-redemption revocation,
--              and strict RLS/scope enforcement for the restricted client portal.
-- ====================================================================

-- 1. Extend public.client_invitations with complete audit and lifecycle columns
ALTER TABLE public.client_invitations
  ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT 'Client',
  ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(40) NOT NULL DEFAULT 'email_not_sent',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure token_hash is always a SHA-256 hex digest (64 hex chars) or cryptographic hash
ALTER TABLE public.client_invitations
  DROP CONSTRAINT IF EXISTS chk_client_invitations_token_hash_format;
ALTER TABLE public.client_invitations
  ADD CONSTRAINT chk_client_invitations_token_hash_format
  CHECK (token_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_client_invitations_ws_matter
  ON public.client_invitations(workspace_id, matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_invitations_email
  ON public.client_invitations(lower(btrim(client_email)));

-- 2. Extend public.client_access_grants with linkage, expiry, and revocation actor metadata
ALTER TABLE public.client_access_grants
  ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES public.client_invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS granted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_access_grants_ws_matter_user
  ON public.client_access_grants(workspace_id, matter_id, client_user_id);

CREATE INDEX IF NOT EXISTS idx_client_access_grants_invitation_id
  ON public.client_access_grants(invitation_id);

-- 3. Upgrade RLS Helper Functions for Client Access Grants & Scopes (enforcing revocation AND expiry)
CREATE OR REPLACE FUNCTION public.is_authorized_staff_for_invitations(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    public.get_user_workspace_role(ws_id) IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE'),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_client_matter_grant(m_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_access_grants
    WHERE matter_id = m_id
      AND client_user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_client_matter_scope(m_id UUID, scope_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_access_grants
    WHERE matter_id = m_id
      AND client_user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND COALESCE((scopes ->> scope_key)::boolean, false) = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Harden RLS Policies Across Tables for Restricted Client Grants & Strict Staff Data Isolation

-- 4a. Ensure ai_jobs and ai_results strictly exclude CLIENT role
DROP POLICY IF EXISTS "Active workspace members can read ai_jobs" ON public.ai_jobs;
CREATE POLICY "Active workspace members can read ai_jobs"
  ON public.ai_jobs FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Active workspace members can read ai_results" ON public.ai_results;
CREATE POLICY "Active workspace members can read ai_results"
  ON public.ai_results FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- 4b. Workspaces: allow staff members OR clients with an active non-expired grant in the workspace to view basic workspace info
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT USING (
    public.is_workspace_member(id)
    OR EXISTS (
      SELECT 1 FROM public.client_access_grants g
      WHERE g.workspace_id = public.workspaces.id
        AND g.client_user_id = auth.uid()
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > NOW())
    )
  );

-- 4c. Client Access Grants: staff can view all grants in their workspace; clients can only view their own active, non-expired grants
DROP POLICY IF EXISTS client_access_grants_select ON public.client_access_grants;
CREATE POLICY client_access_grants_select ON public.client_access_grants
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR (
      client_user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- 4d. Client Invitations: only workspace staff can query invitations table; write operations require authorized staff role
DROP POLICY IF EXISTS client_invitations_select ON public.client_invitations;
CREATE POLICY client_invitations_select ON public.client_invitations
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS client_invitations_write ON public.client_invitations;
CREATE POLICY client_invitations_write ON public.client_invitations
  FOR ALL USING (public.is_authorized_staff_for_invitations(workspace_id))
  WITH CHECK (public.is_authorized_staff_for_invitations(workspace_id));

-- 4e. Documents & Document Versions: enforce viewFilings for SELECT and uploadDocs for INSERT
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR (matter_id IS NOT NULL AND public.has_client_matter_scope(matter_id, 'viewFilings'))
  );

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (
    public.is_workspace_member(workspace_id)
    OR (matter_id IS NOT NULL AND public.has_client_matter_scope(matter_id, 'uploadDocs'))
  );

DROP POLICY IF EXISTS document_versions_select ON public.document_versions;
CREATE POLICY document_versions_select ON public.document_versions
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = public.document_versions.document_id
        AND d.matter_id IS NOT NULL
        AND public.has_client_matter_scope(d.matter_id, 'viewFilings')
    )
  );

DROP POLICY IF EXISTS document_versions_insert ON public.document_versions;
CREATE POLICY document_versions_insert ON public.document_versions
  FOR INSERT WITH CHECK (
    public.is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = public.document_versions.document_id
        AND d.matter_id IS NOT NULL
        AND public.has_client_matter_scope(d.matter_id, 'uploadDocs')
    )
  );

-- 4f. Hearings & Timeline Events: enforce viewHearings scope
DROP POLICY IF EXISTS hearings_select ON public.hearings;
CREATE POLICY hearings_select ON public.hearings
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR public.has_client_matter_scope(matter_id, 'viewHearings')
  );

DROP POLICY IF EXISTS timeline_events_select ON public.timeline_events;
CREATE POLICY timeline_events_select ON public.timeline_events
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR (matter_id IS NOT NULL AND public.has_client_matter_scope(matter_id, 'viewHearings'))
  );

-- 4g. Invoices and Payments: enforce viewBilling scope
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR (matter_id IS NOT NULL AND public.has_client_matter_scope(matter_id, 'viewBilling'))
  );

DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
  FOR SELECT USING (
    public.is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = public.payments.invoice_id
        AND i.matter_id IS NOT NULL
        AND public.has_client_matter_scope(i.matter_id, 'viewBilling')
    )
  );

-- 4h. Strictly keep internal findings, private drafts, research notes, tasks, time entries, and staff client directory inaccessible to restricted clients
DROP POLICY IF EXISTS findings_select ON public.findings;
CREATE POLICY findings_select ON public.findings
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS drafts_select ON public.drafts;
CREATE POLICY drafts_select ON public.drafts
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS draft_versions_select ON public.draft_versions;
CREATE POLICY draft_versions_select ON public.draft_versions
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS research_notes_select ON public.research_notes;
CREATE POLICY research_notes_select ON public.research_notes
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS time_entries_select ON public.time_entries;
CREATE POLICY time_entries_select ON public.time_entries
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- 5. Harden Document & Fact Review RPCs Against Restricted Client Role Bypass
CREATE OR REPLACE FUNCTION public.create_document_with_initial_version_atomic(
  p_workspace_id UUID,
  p_matter_id UUID,
  p_name TEXT,
  p_doc_type TEXT,
  p_storage_bucket TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_changes_summary TEXT,
  p_extracted_text TEXT DEFAULT NULL,
  p_author_name TEXT DEFAULT 'Workspace Member',
  p_operation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_matter_exists BOOLEAN;
  v_existing_doc_id UUID;
  v_doc_row public.documents%ROWTYPE;
  v_ver_row public.document_versions%ROWTYPE;
  v_processing_status TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND status = 'Active';

    IF v_caller_role IS NULL OR v_caller_role = 'CLIENT' THEN
      IF NOT public.has_client_matter_scope(p_matter_id, 'uploadDocs') THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized staff member and lacks uploadDocs scope for this matter';
      END IF;
    END IF;
  ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Authentication required to create document';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.matters WHERE id = p_matter_id AND workspace_id = p_workspace_id
  ) INTO v_matter_exists;

  IF NOT v_matter_exists THEN
    RAISE EXCEPTION 'Matter % not found or scope mismatch in workspace %', p_matter_id, p_workspace_id;
  END IF;

  IF p_operation_id IS NOT NULL THEN
    SELECT document_id INTO v_existing_doc_id
    FROM public.document_versions
    WHERE workspace_id = p_workspace_id AND operation_id = p_operation_id;

    IF v_existing_doc_id IS NOT NULL THEN
      SELECT * INTO v_doc_row
      FROM public.documents
      WHERE id = v_existing_doc_id AND workspace_id = p_workspace_id;

      SELECT * INTO v_ver_row
      FROM public.document_versions
      WHERE workspace_id = p_workspace_id AND operation_id = p_operation_id;

      RETURN jsonb_build_object(
        'document', to_jsonb(v_doc_row),
        'version', to_jsonb(v_ver_row),
        'idempotent_retry', true
      );
    END IF;
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Document name cannot be empty';
  END IF;

  IF p_file_path IS NULL OR trim(p_file_path) = '' THEN
    RAISE EXCEPTION 'File path cannot be empty';
  END IF;

  IF NOT (p_file_path LIKE p_workspace_id::text || '/' || p_matter_id::text || '/%') THEN
    RAISE EXCEPTION 'Storage path scope violation: path must start with workspace_id/matter_id/';
  END IF;

  v_processing_status := CASE
    WHEN p_extracted_text IS NOT NULL AND length(trim(p_extracted_text)) > 0 THEN 'Processed'
    ELSE 'Uploaded'
  END;

  INSERT INTO public.documents (
    workspace_id,
    matter_id,
    name,
    doc_type,
    storage_bucket,
    file_path,
    file_size,
    mime_type,
    extracted_text,
    uploaded_by_user_id,
    processing_status,
    review_status,
    current_version
  ) VALUES (
    p_workspace_id,
    p_matter_id,
    trim(p_name),
    COALESCE(p_doc_type, 'Legal Document'),
    COALESCE(p_storage_bucket, 'matter-documents'),
    p_file_path,
    COALESCE(p_file_size, 0),
    COALESCE(p_mime_type, 'text/plain'),
    p_extracted_text,
    v_caller_id,
    v_processing_status,
    'Unreviewed',
    1
  ) RETURNING * INTO v_doc_row;

  INSERT INTO public.document_versions (
    workspace_id,
    document_id,
    version,
    file_path,
    file_size,
    mime_type,
    changes_summary,
    extracted_text,
    author_name,
    created_by_user_id,
    status,
    operation_id
  ) VALUES (
    p_workspace_id,
    v_doc_row.id,
    1,
    p_file_path,
    COALESCE(p_file_size, 0),
    COALESCE(p_mime_type, 'text/plain'),
    COALESCE(p_changes_summary, 'Initial document upload v1'),
    p_extracted_text,
    COALESCE(p_author_name, 'Workspace Member'),
    v_caller_id,
    'committed',
    p_operation_id
  ) RETURNING * INTO v_ver_row;

  RETURN jsonb_build_object(
    'document', to_jsonb(v_doc_row),
    'version', to_jsonb(v_ver_row),
    'idempotent_retry', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.commit_document_revision_atomic(
  p_workspace_id UUID,
  p_matter_id UUID,
  p_document_id UUID,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_changes_summary TEXT,
  p_extracted_text TEXT DEFAULT NULL,
  p_author_name TEXT DEFAULT 'Workspace Member',
  p_expected_version INT DEFAULT NULL,
  p_operation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_doc_row public.documents%ROWTYPE;
  v_ver_row public.document_versions%ROWTYPE;
  v_existing_doc_id UUID;
  v_next_version INT;
  v_processing_status TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND status = 'Active';

    IF v_caller_role IS NULL OR v_caller_role = 'CLIENT' THEN
      RAISE EXCEPTION 'Unauthorized: Caller is not an active staff member of this workspace';
    END IF;
  ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Authentication required to commit document revision';
  END IF;

  IF p_operation_id IS NOT NULL THEN
    SELECT document_id INTO v_existing_doc_id
    FROM public.document_versions
    WHERE workspace_id = p_workspace_id AND operation_id = p_operation_id;

    IF v_existing_doc_id IS NOT NULL THEN
      IF v_existing_doc_id <> p_document_id THEN
        RAISE EXCEPTION 'Operation ID collision: % already used for document %', p_operation_id, v_existing_doc_id;
      END IF;

      SELECT * INTO v_doc_row
      FROM public.documents
      WHERE id = p_document_id AND workspace_id = p_workspace_id;

      SELECT * INTO v_ver_row
      FROM public.document_versions
      WHERE workspace_id = p_workspace_id AND operation_id = p_operation_id;

      RETURN jsonb_build_object(
        'document', to_jsonb(v_doc_row),
        'version', to_jsonb(v_ver_row),
        'idempotent_retry', true
      );
    END IF;
  END IF;

  SELECT * INTO v_doc_row
  FROM public.documents
  WHERE id = p_document_id AND workspace_id = p_workspace_id AND matter_id = p_matter_id
  FOR UPDATE;

  IF v_doc_row.id IS NULL THEN
    RAISE EXCEPTION 'Document % not found or scope mismatch for workspace % and matter %', p_document_id, p_workspace_id, p_matter_id;
  END IF;

  IF NOT (p_file_path LIKE p_workspace_id::text || '/' || p_matter_id::text || '/%') THEN
    RAISE EXCEPTION 'Storage path scope violation: path must start with workspace_id/matter_id/';
  END IF;

  IF p_expected_version IS NOT NULL AND v_doc_row.current_version <> p_expected_version THEN
    RAISE EXCEPTION 'Stale document revision: expected version % does not match current version %', p_expected_version, v_doc_row.current_version;
  END IF;

  IF p_changes_summary IS NULL OR trim(p_changes_summary) = '' THEN
    RAISE EXCEPTION 'Changes summary is required for document revision';
  END IF;

  v_next_version := v_doc_row.current_version + 1;
  v_processing_status := CASE
    WHEN p_extracted_text IS NOT NULL AND length(trim(p_extracted_text)) > 0 THEN 'Processed'
    ELSE v_doc_row.processing_status
  END;

  INSERT INTO public.document_versions (
    workspace_id,
    document_id,
    version,
    file_path,
    file_size,
    mime_type,
    changes_summary,
    extracted_text,
    author_name,
    created_by_user_id,
    status,
    operation_id
  ) VALUES (
    p_workspace_id,
    p_document_id,
    v_next_version,
    p_file_path,
    COALESCE(p_file_size, v_doc_row.file_size),
    COALESCE(p_mime_type, v_doc_row.mime_type),
    trim(p_changes_summary),
    COALESCE(p_extracted_text, v_doc_row.extracted_text),
    COALESCE(p_author_name, 'Workspace Member'),
    v_caller_id,
    'committed',
    p_operation_id
  ) RETURNING * INTO v_ver_row;

  UPDATE public.documents
  SET
    current_version = v_next_version,
    file_path = p_file_path,
    file_size = COALESCE(p_file_size, v_doc_row.file_size),
    mime_type = COALESCE(p_mime_type, v_doc_row.mime_type),
    extracted_text = COALESCE(p_extracted_text, v_doc_row.extracted_text),
    processing_status = v_processing_status,
    updated_at = NOW()
  WHERE id = p_document_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_doc_row;

  RETURN jsonb_build_object(
    'document', to_jsonb(v_doc_row),
    'version', to_jsonb(v_ver_row),
    'idempotent_retry', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.review_extracted_fact_atomic(
  p_workspace_id UUID,
  p_finding_id UUID,
  p_action TEXT,
  p_edited_text TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_finding_row public.findings%ROWTYPE;
  v_new_status TEXT;
  v_final_text TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND status = 'Active';

    IF v_caller_role IS NULL OR v_caller_role = 'CLIENT' THEN
      RAISE EXCEPTION 'Unauthorized: Caller is not an active staff member of this workspace';
    END IF;
  ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Authentication required to review extracted facts';
  END IF;

  SELECT * INTO v_finding_row
  FROM public.findings
  WHERE id = p_finding_id AND workspace_id = p_workspace_id;

  IF v_finding_row.id IS NULL THEN
    RAISE EXCEPTION 'Extracted fact finding % not found in workspace %', p_finding_id, p_workspace_id;
  END IF;

  IF p_action = 'Accept' THEN
    v_new_status := 'Accepted';
    v_final_text := COALESCE(p_edited_text, v_finding_row.finding_text);
  ELSIF p_action = 'Reject' THEN
    v_new_status := 'Rejected';
    v_final_text := v_finding_row.finding_text;
  ELSIF p_action = 'Edit' THEN
    v_new_status := 'Accepted';
    IF p_edited_text IS NULL OR trim(p_edited_text) = '' THEN
      RAISE EXCEPTION 'Edited text cannot be empty';
    END IF;
    v_final_text := trim(p_edited_text);
  ELSE
    RAISE EXCEPTION 'Invalid review action: %. Allowed: Accept, Reject, Edit', p_action;
  END IF;

  UPDATE public.findings
  SET
    status = v_new_status,
    finding_text = v_final_text,
    edited_text = CASE WHEN p_edited_text IS NOT NULL THEN trim(p_edited_text) ELSE edited_text END,
    reviewed_by_user_id = v_caller_id,
    reviewed_at = NOW()
  WHERE id = p_finding_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_finding_row;

  RETURN to_jsonb(v_finding_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic RPC: Create Client Invitation (Authorized Staff + Valid Workspace Matter + Hash-Only Storage)
CREATE OR REPLACE FUNCTION public.create_client_invitation_atomic(
  p_workspace_id UUID,
  p_matter_id UUID,
  p_client_email TEXT,
  p_client_name TEXT,
  p_client_phone TEXT DEFAULT NULL,
  p_token_hash TEXT DEFAULT NULL,
  p_scopes JSONB DEFAULT '{"viewHearings":true,"viewFilings":true,"viewBilling":true,"uploadDocs":false,"chatAi":false}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  p_delivery_status TEXT DEFAULT 'email_not_sent'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_matter public.matters%ROWTYPE;
  v_normalized_email TEXT;
  v_sanitized_scopes JSONB;
  v_invite public.client_invitations%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Authentication required to create a client invitation.';
  END IF;

  -- Require authorized staff role (CHAMBER_OWNER, SENIOR_ADVOCATE, ASSOCIATE) in the target workspace
  v_caller_role := public.get_user_workspace_role(p_workspace_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE') THEN
    RAISE EXCEPTION '403 Forbidden: Only authorized chamber staff (Owner, Senior Advocate, or Associate) can issue client invitations.';
  END IF;

  -- Require a valid matter belonging to that workspace
  SELECT * INTO v_matter
  FROM public.matters
  WHERE id = p_matter_id AND workspace_id = p_workspace_id;

  IF v_matter.id IS NULL THEN
    RAISE EXCEPTION '403 Forbidden: Specified matter does not exist in workspace %.', p_workspace_id;
  END IF;

  -- Validate recipient email
  v_normalized_email := lower(btrim(COALESCE(p_client_email, '')));
  IF v_normalized_email = '' OR position('@' IN v_normalized_email) = 0 THEN
    RAISE EXCEPTION '400 Bad Request: A valid intended recipient email is required.';
  END IF;

  -- Validate token_hash is a 64-character hex SHA-256 digest
  IF p_token_hash IS NULL OR NOT (p_token_hash ~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION '400 Bad Request: Invitation must provide a 64-character SHA-256 token_hash.';
  END IF;

  -- Validate expiry is in the future
  IF p_expires_at IS NULL OR p_expires_at <= NOW() THEN
    RAISE EXCEPTION '400 Bad Request: Invitation expiry must be in the future.';
  END IF;

  -- Normalize explicit boolean scopes
  v_sanitized_scopes := jsonb_build_object(
    'viewHearings', COALESCE((p_scopes ->> 'viewHearings')::boolean, true),
    'viewFilings', COALESCE((p_scopes ->> 'viewFilings')::boolean, true),
    'viewBilling', COALESCE((p_scopes ->> 'viewBilling')::boolean, true),
    'uploadDocs', COALESCE((p_scopes ->> 'uploadDocs')::boolean, false),
    'chatAi', COALESCE((p_scopes ->> 'chatAi')::boolean, false)
  );

  INSERT INTO public.client_invitations (
    workspace_id,
    matter_id,
    client_email,
    client_name,
    client_phone,
    token_hash,
    scopes,
    expires_at,
    created_by_user_id,
    status,
    delivery_status,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_id,
    p_matter_id,
    v_normalized_email,
    COALESCE(NULLIF(btrim(p_client_name), ''), v_matter.client_name, 'Client'),
    NULLIF(btrim(COALESCE(p_client_phone, '')), ''),
    p_token_hash,
    v_sanitized_scopes,
    p_expires_at,
    v_caller_id,
    'Active',
    COALESCE(NULLIF(btrim(p_delivery_status), ''), 'email_not_sent'),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_invite;

  -- Return invitation metadata without exposing token_hash
  RETURN jsonb_build_object(
    'id', v_invite.id,
    'workspace_id', v_invite.workspace_id,
    'matter_id', v_invite.matter_id,
    'matter_title', v_matter.title,
    'client_email', v_invite.client_email,
    'client_name', v_invite.client_name,
    'client_phone', v_invite.client_phone,
    'scopes', v_invite.scopes,
    'expires_at', v_invite.expires_at,
    'created_by_user_id', v_invite.created_by_user_id,
    'status', v_invite.status,
    'delivery_status', v_invite.delivery_status,
    'created_at', v_invite.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_client_invitation_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_invitation_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT) TO authenticated;

-- 7. Atomic RPC: Redeem Client Invitation (Verified Recipient Identity, Expiry/Revocation Enforcement, Safe Idempotent Replay)
CREATE OR REPLACE FUNCTION public.redeem_client_invitation_atomic(
  p_token_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_email_verified BOOLEAN;
  v_invite public.client_invitations%ROWTYPE;
  v_existing_grant public.client_access_grants%ROWTYPE;
  v_grant public.client_access_grants%ROWTYPE;
  v_matter public.matters%ROWTYPE;
  v_workspace_name TEXT;
  v_existing_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: You must be signed in to redeem a client portal invitation.';
  END IF;

  IF p_token_hash IS NULL OR NOT (p_token_hash ~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION '400 Bad Request: Invalid invitation token hash format.';
  END IF;

  -- Look up authenticated user's verified email from auth.users
  SELECT
    u.email,
    COALESCE((u.raw_user_meta_data ->> 'email_verified')::boolean, true)
  INTO v_user_email, v_email_verified
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF v_user_email IS NULL OR btrim(v_user_email) = '' THEN
    RAISE EXCEPTION '403 Forbidden: Authenticated account does not have a verified email address.';
  END IF;

  IF NOT v_email_verified THEN
    RAISE EXCEPTION '403 Forbidden: Recipient email address must be verified before redeeming an invitation.';
  END IF;

  -- Lock the invitation row atomically
  SELECT * INTO v_invite
  FROM public.client_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION '404 Not Found: Client portal invitation not found or invalid.';
  END IF;

  -- 1. Reject revoked links immediately
  IF v_invite.status = 'Revoked' OR v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION '403 Forbidden: This client portal invitation has been revoked by the chamber.';
  END IF;

  -- 2. Verify recipient email matches the invitation's intended client_email
  IF lower(btrim(v_user_email)) <> lower(btrim(v_invite.client_email)) THEN
    RAISE EXCEPTION '403 Forbidden: Recipient email mismatch. This invitation was issued exclusively for %.', v_invite.client_email;
  END IF;

  -- 3. Reject expired links immediately
  IF v_invite.status = 'Expired' OR v_invite.expires_at <= NOW() THEN
    RAISE EXCEPTION '410 Gone: This client portal invitation has expired.';
  END IF;

  -- Check if a grant already exists for this user & matter
  SELECT * INTO v_existing_grant
  FROM public.client_access_grants
  WHERE workspace_id = v_invite.workspace_id
    AND matter_id = v_invite.matter_id
    AND client_user_id = v_user_id
  FOR UPDATE;

  -- 4. Handle repeated redemption / replay safely
  IF v_invite.status = 'Redeemed' OR v_invite.redeemed_at IS NOT NULL THEN
    IF v_invite.redeemed_by_user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION '409 Conflict: This invitation has already been redeemed.';
    END IF;

    IF v_existing_grant.id IS NULL OR v_existing_grant.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION '403 Forbidden: Access granted by this invitation has been revoked.';
    END IF;

    IF v_existing_grant.expires_at IS NOT NULL AND v_existing_grant.expires_at <= NOW() THEN
      RAISE EXCEPTION '410 Gone: Access granted by this invitation has expired.';
    END IF;

    SELECT * INTO v_matter FROM public.matters WHERE id = v_invite.matter_id AND workspace_id = v_invite.workspace_id;
    SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = v_invite.workspace_id;

    -- Safe idempotent return for repeated redemption by the same verified recipient while grant is active
    RETURN jsonb_build_object(
      'grant_id', v_existing_grant.id,
      'invitation_id', v_invite.id,
      'workspace_id', v_existing_grant.workspace_id,
      'workspace_name', COALESCE(v_workspace_name, 'Legal Chamber'),
      'matter_id', v_existing_grant.matter_id,
      'matter_title', COALESCE(v_matter.title, 'Matter'),
      'client_user_id', v_existing_grant.client_user_id,
      'client_email', v_Invite.client_email,
      'client_name', v_invite.client_name,
      'scopes', v_existing_grant.scopes,
      'expires_at', v_existing_grant.expires_at,
      'status', 'Redeemed',
      'replayed', true
    );
  END IF;

  -- 5. First-time atomic redemption: mark invitation Redeemed
  UPDATE public.client_invitations
  SET
    status = 'Redeemed',
    redeemed_by_user_id = v_user_id,
    redeemed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_invite.id
  RETURNING * INTO v_invite;

  -- 6. Create or update the restricted client_access_grants record
  INSERT INTO public.client_access_grants (
    workspace_id,
    matter_id,
    client_user_id,
    invitation_id,
    client_email,
    client_name,
    scopes,
    granted_by_user_id,
    granted_at,
    expires_at,
    revoked_at,
    revoked_by_user_id,
    updated_at
  ) VALUES (
    v_invite.workspace_id,
    v_invite.matter_id,
    v_user_id,
    v_invite.id,
    v_invite.client_email,
    v_invite.client_name,
    v_invite.scopes,
    v_invite.created_by_user_id,
    NOW(),
    v_invite.expires_at,
    NULL,
    NULL,
    NOW()
  )
  ON CONFLICT (workspace_id, matter_id, client_user_id) DO UPDATE
  SET
    invitation_id = EXCLUDED.invitation_id,
    client_email = EXCLUDED.client_email,
    client_name = EXCLUDED.client_name,
    scopes = EXCLUDED.scopes,
    granted_by_user_id = EXCLUDED.granted_by_user_id,
    granted_at = NOW(),
    expires_at = EXCLUDED.expires_at,
    revoked_at = NULL,
    revoked_by_user_id = NULL,
    updated_at = NOW()
  RETURNING * INTO v_grant;

  -- 7. Ensure user has a profile row and if they are not already a staff member in this workspace, ensure a CLIENT workspace_memberships record
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_user_id, v_invite.client_email, v_invite.client_name)
  ON CONFLICT (id) DO NOTHING;

  SELECT role INTO v_existing_role
  FROM public.workspace_memberships
  WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;

  IF v_existing_role IS NULL THEN
    INSERT INTO public.workspace_memberships (
      workspace_id,
      user_id,
      member_email,
      member_name,
      role,
      status,
      invited_by_user_id
    ) VALUES (
      v_invite.workspace_id,
      v_user_id,
      v_invite.client_email,
      v_invite.client_name,
      'CLIENT',
      'Active',
      v_invite.created_by_user_id
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET
      status = CASE WHEN public.workspace_memberships.role = 'CLIENT' THEN 'Active' ELSE public.workspace_memberships.status END,
      updated_at = NOW();
  ELSIF v_existing_role = 'CLIENT' THEN
    UPDATE public.workspace_memberships
    SET status = 'Active', updated_at = NOW()
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id AND role = 'CLIENT';
  END IF;

  SELECT * INTO v_matter FROM public.matters WHERE id = v_invite.matter_id AND workspace_id = v_invite.workspace_id;
  SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = v_invite.workspace_id;

  RETURN jsonb_build_object(
    'grant_id', v_grant.id,
    'invitation_id', v_invite.id,
    'workspace_id', v_grant.workspace_id,
    'workspace_name', COALESCE(v_workspace_name, 'Legal Chamber'),
    'matter_id', v_grant.matter_id,
    'matter_title', COALESCE(v_matter.title, 'Matter'),
    'client_user_id', v_grant.client_user_id,
    'client_email', v_invite.client_email,
    'client_name', v_invite.client_name,
    'scopes', v_grant.scopes,
    'expires_at', v_grant.expires_at,
    'status', 'Redeemed',
    'replayed', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.redeem_client_invitation_atomic(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_client_invitation_atomic(TEXT) TO authenticated;

-- 8. Atomic RPC: Revoke Client Invitation AND Post-Redemption Access Grant
CREATE OR REPLACE FUNCTION public.revoke_client_invitation_atomic(
  p_workspace_id UUID,
  p_invitation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_invite public.client_invitations%ROWTYPE;
  v_revoked_grants_count INT := 0;
  v_remaining_grants INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Authentication required to revoke client portal access.';
  END IF;

  v_caller_role := public.get_user_workspace_role(p_workspace_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE') THEN
    RAISE EXCEPTION '403 Forbidden: Only authorized chamber staff can revoke client invitations or portal grants.';
  END IF;

  SELECT * INTO v_invite
  FROM public.client_invitations
  WHERE id = p_invitation_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION '404 Not Found: Client invitation not found in this workspace.';
  END IF;

  -- Mark invitation as Revoked
  UPDATE public.client_invitations
  SET
    status = 'Revoked',
    revoked_at = COALESCE(revoked_at, NOW()),
    revoked_by_user_id = COALESCE(revoked_by_user_id, v_caller_id),
    updated_at = NOW()
  WHERE id = v_invite.id
  RETURNING * INTO v_invite;

  -- Immediately revoke any active client_access_grants associated with this invitation or recipient+matter
  WITH revoked_rows AS (
    UPDATE public.client_access_grants
    SET
      revoked_at = NOW(),
      revoked_by_user_id = v_caller_id,
      updated_at = NOW()
    WHERE workspace_id = p_workspace_id
      AND matter_id = v_invite.matter_id
      AND (
        invitation_id = v_invite.id
        OR client_user_id = v_invite.redeemed_by_user_id
        OR lower(btrim(COALESCE(client_email, ''))) = lower(btrim(v_invite.client_email))
      )
      AND revoked_at IS NULL
    RETURNING id, client_user_id
  )
  SELECT COUNT(*) INTO v_revoked_grants_count FROM revoked_rows;

  -- If the redeemed client user has no remaining active grants in this workspace, mark their CLIENT membership as Revoked
  IF v_invite.redeemed_by_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_remaining_grants
    FROM public.client_access_grants
    WHERE workspace_id = p_workspace_id
      AND client_user_id = v_invite.redeemed_by_user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW());

    IF v_remaining_grants = 0 THEN
      UPDATE public.workspace_memberships
      SET status = 'Revoked', updated_at = NOW()
      WHERE workspace_id = p_workspace_id
        AND user_id = v_invite.redeemed_by_user_id
        AND role = 'CLIENT';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'workspace_id', v_invite.workspace_id,
    'matter_id', v_invite.matter_id,
    'client_email', v_invite.client_email,
    'status', v_invite.status,
    'revoked_at', v_invite.revoked_at,
    'revoked_by_user_id', v_invite.revoked_by_user_id,
    'revoked_grants_count', v_revoked_grants_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.revoke_client_invitation_atomic(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_client_invitation_atomic(UUID, UUID) TO authenticated;

-- 9. Atomic RPC: Fetch Restricted Client Portal Matter View (Strictly Enforces Grant & Scopes, Excludes Staff Data)
CREATE OR REPLACE FUNCTION public.get_restricted_client_portal_matter_atomic(
  p_matter_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_grant public.client_access_grants%ROWTYPE;
  v_matter public.matters%ROWTYPE;
  v_workspace_name TEXT;
  v_hearings JSONB := '[]'::jsonb;
  v_timeline JSONB := '[]'::jsonb;
  v_documents JSONB := '[]'::jsonb;
  v_invoices JSONB := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Authentication required.';
  END IF;

  SELECT * INTO v_grant
  FROM public.client_access_grants
  WHERE matter_id = p_matter_id
    AND client_user_id = v_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY granted_at DESC
  LIMIT 1;

  IF v_grant.id IS NULL THEN
    RAISE EXCEPTION '403 Forbidden: Active client access grant not found or expired/revoked for this matter.';
  END IF;

  SELECT * INTO v_matter
  FROM public.matters
  WHERE id = p_matter_id AND workspace_id = v_grant.workspace_id;

  IF v_matter.id IS NULL THEN
    RAISE EXCEPTION '404 Not Found: Matter not found.';
  END IF;

  SELECT name INTO v_workspace_name
  FROM public.workspaces
  WHERE id = v_grant.workspace_id;

  -- Scope 1: viewHearings
  IF COALESCE((v_grant.scopes ->> 'viewHearings')::boolean, false) = true THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'hearing_date', h.hearing_date,
        'purpose', h.purpose,
        'court_room', h.court_name,
        'outcome_notes', h.outcome,
        'next_date', h.next_steps
      ) ORDER BY h.hearing_date ASC
    ), '[]'::jsonb)
    INTO v_hearings
    FROM public.hearings h
    WHERE h.matter_id = p_matter_id AND h.workspace_id = v_grant.workspace_id;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'event_date', t.event_date,
        'title', t.event_title,
        'description', t.category,
        'event_type', t.category
      ) ORDER BY t.event_date DESC
    ), '[]'::jsonb)
    INTO v_timeline
    FROM public.timeline_events t
    WHERE t.matter_id = p_matter_id AND t.workspace_id = v_grant.workspace_id;
  END IF;

  -- Scope 2: viewFilings
  IF COALESCE((v_grant.scopes ->> 'viewFilings')::boolean, false) = true THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'doc_type', d.doc_type,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'current_version', d.current_version,
        'created_at', d.created_at
      ) ORDER BY d.created_at DESC
    ), '[]'::jsonb)
    INTO v_documents
    FROM public.documents d
    WHERE d.matter_id = p_matter_id AND d.workspace_id = v_grant.workspace_id;
  END IF;

  -- Scope 3: viewBilling
  IF COALESCE((v_grant.scopes ->> 'viewBilling')::boolean, false) = true THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'invoice_number', i.invoice_number,
        'issue_date', i.issue_date,
        'due_date', i.due_date,
        'subtotal', i.subtotal,
        'tax_amount', i.tax_amount,
        'total_amount', i.total_amount,
        'paid_amount', i.paid_amount,
        'balance_amount', (COALESCE(i.total_amount, 0) - COALESCE(i.paid_amount, 0)),
        'status', i.status
      ) ORDER BY i.issue_date DESC
    ), '[]'::jsonb)
    INTO v_invoices
    FROM public.invoices i
    WHERE i.matter_id = p_matter_id AND i.workspace_id = v_grant.workspace_id;
  END IF;

  -- Return strictly scoped client portal view (NEVER includes findings, drafts, draft_versions, tasks, time_entries, or internal memory)
  RETURN jsonb_build_object(
    'grant', jsonb_build_object(
      'id', v_grant.id,
      'workspace_id', v_grant.workspace_id,
      'workspace_name', COALESCE(v_workspace_name, 'Legal Chamber'),
      'matter_id', v_grant.matter_id,
      'client_email', v_grant.client_email,
      'client_name', v_grant.client_name,
      'scopes', v_grant.scopes,
      'granted_at', v_grant.granted_at,
      'expires_at', v_grant.expires_at
    ),
    'matter', jsonb_build_object(
      'id', v_matter.id,
      'workspace_id', v_matter.workspace_id,
      'title', v_matter.title,
      'case_number', v_matter.case_number,
      'court_name', v_matter.court_name,
      'judge_name', v_matter.judge_name,
      'stage', v_matter.stage,
      'status', v_matter.status,
      'case_type', v_matter.case_type,
      'client_name', v_matter.client_name,
      'next_hearing_date', v_matter.next_hearing_date,
      'updated_at', v_matter.updated_at
    ),
    'hearings', v_hearings,
    'timeline', v_timeline,
    'documents', v_documents,
    'invoices', v_invoices
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_restricted_client_portal_matter_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restricted_client_portal_matter_atomic(UUID) TO authenticated;
