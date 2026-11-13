-- ====================================================================
-- Migration: 20261019000004_hardened_document_revision_and_fact_review.sql
-- Description: Hardens document upload/revision persistence, operation ID idempotency,
--              version locks, retention triggers, and fact-review lifecycle with Proposed/Accepted/Rejected
--              status, actor timestamps, and source document/version references.
-- ====================================================================

-- 1. Extend document_versions for operation ID idempotency and commit status tracking
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS operation_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'committed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_workspace_operation
  ON public.document_versions (workspace_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- 2. Extend findings (extracted facts) schema for review workflow
ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS source_version INT,
  ADD COLUMN IF NOT EXISTS edited_text TEXT,
  ALTER COLUMN status SET DEFAULT 'Proposed';

-- 3. Atomic Initial Document Creation RPC with Retry Idempotency
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

  -- Auth & Workspace Membership check if running in authenticated user context
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND status = 'Active';

    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Caller is not an active member of this workspace';
    END IF;
  ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Authentication required to create document';
  END IF;

  -- Validate matter scope
  SELECT EXISTS (
    SELECT 1 FROM public.matters WHERE id = p_matter_id AND workspace_id = p_workspace_id
  ) INTO v_matter_exists;

  IF NOT v_matter_exists THEN
    RAISE EXCEPTION 'Matter % not found or scope mismatch in workspace %', p_matter_id, p_workspace_id;
  END IF;

  -- Verify operation ID idempotency
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

  -- Input Validation
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Document name cannot be empty';
  END IF;

  IF p_file_path IS NULL OR trim(p_file_path) = '' THEN
    RAISE EXCEPTION 'File path cannot be empty';
  END IF;

  -- Verify storage path scope contains workspace and matter id
  IF NOT (p_file_path LIKE p_workspace_id::text || '/' || p_matter_id::text || '/%') THEN
    RAISE EXCEPTION 'Storage path scope violation: path must start with workspace_id/matter_id/';
  END IF;

  v_processing_status := CASE
    WHEN p_extracted_text IS NOT NULL AND length(trim(p_extracted_text)) > 0 THEN 'Processed'
    ELSE 'Uploaded'
  END;

  -- 1. Insert Document
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

  -- 2. Insert Version 1
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

-- 4. Atomic Revision Commit RPC with Lock & Expected Version Check
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

  -- Auth & Workspace Membership check if running in authenticated user context
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role
    FROM public.workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND status = 'Active';

    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Caller is not an active member of this workspace';
    END IF;
  ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Authentication required to commit document revision';
  END IF;

  -- Verify operation ID idempotency
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

  -- Acquire ROW-LEVEL LOCK on parent document record
  SELECT * INTO v_doc_row
  FROM public.documents
  WHERE id = p_document_id AND workspace_id = p_workspace_id AND matter_id = p_matter_id
  FOR UPDATE;

  IF v_doc_row.id IS NULL THEN
    RAISE EXCEPTION 'Document % not found or scope mismatch for workspace % and matter %', p_document_id, p_workspace_id, p_matter_id;
  END IF;

  -- Verify storage path scope contains workspace and matter id
  IF NOT (p_file_path LIKE p_workspace_id::text || '/' || p_matter_id::text || '/%') THEN
    RAISE EXCEPTION 'Storage path scope violation: path must start with workspace_id/matter_id/';
  END IF;

  -- Check Optimistic Concurrency Expected Version if provided
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

  -- 1. Insert new committed version row
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

  -- 2. Update parent document current_version pointer
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

-- 5. Atomic Fact Review Action RPC (Accept, Reject, Edit)
CREATE OR REPLACE FUNCTION public.review_extracted_fact_atomic(
  p_workspace_id UUID,
  p_finding_id UUID,
  p_action TEXT, -- 'Accept', 'Reject', 'Edit'
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

    IF v_caller_role IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Caller is not an active member of this workspace';
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
    v_new_status := 'Accepted'; -- Editing accepts the refined fact
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

-- 6. Retention Trigger for Committed Document Versions
CREATE OR REPLACE FUNCTION public.protect_document_versions_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Allow deletion only if parent document is being cascade-deleted
    IF OLD.status = 'committed' AND EXISTS (SELECT 1 FROM public.documents WHERE id = OLD.document_id) THEN
      RAISE EXCEPTION 'Retention policy violation: committed document version % cannot be deleted directly', OLD.id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Immutable version contents
    IF OLD.version IS DISTINCT FROM NEW.version
       OR OLD.file_path IS DISTINCT FROM NEW.file_path
       OR OLD.document_id IS DISTINCT FROM NEW.document_id THEN
      RAISE EXCEPTION 'Retention policy violation: document_versions version, document_id, and file_path are immutable';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_document_versions_retention ON public.document_versions;
CREATE TRIGGER trg_protect_document_versions_retention
  BEFORE UPDATE OR DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.protect_document_versions_retention();
