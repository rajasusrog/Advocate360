-- Migration: 20261019000003_hardened_draft_lifecycle.sql
-- Description: Hardened transactional draft persistence, optimistic concurrency,
-- immutable version protection, and role-enforced draft approval.

-- 1. Add operation_id column to public.draft_versions for idempotent retries
ALTER TABLE public.draft_versions ADD COLUMN IF NOT EXISTS operation_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_versions_workspace_operation
  ON public.draft_versions(workspace_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- 2. Prevent modification or direct deletion of historical draft versions
CREATE OR REPLACE FUNCTION public.protect_draft_versions_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Historical draft versions are immutable and cannot be modified';
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent direct deletion of historical versions unless the parent draft itself was deleted
    IF EXISTS (SELECT 1 FROM public.drafts WHERE id = OLD.draft_id) THEN
      RAISE EXCEPTION 'Historical draft versions are immutable and cannot be deleted';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_draft_versions_immutability ON public.draft_versions;
CREATE TRIGGER trg_protect_draft_versions_immutability
  BEFORE UPDATE OR DELETE ON public.draft_versions
  FOR EACH ROW EXECUTE FUNCTION public.protect_draft_versions_immutability();

-- 3. Enforce draft approval invariants, role checks, and approval invalidation on content/title changes
CREATE OR REPLACE FUNCTION public.enforce_draft_invariants_and_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
  v_version_exists BOOLEAN;
BEGIN
  -- A. Automatically invalidate approval whenever content or title is updated
  IF TG_OP = 'UPDATE' AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title) THEN
    -- If content/title changed and the update isn't explicitly setting a new approved state in the same statement:
    IF NEW.status = 'Approved' AND OLD.status = 'Approved' THEN
      NEW.status := 'Draft';
      NEW.approved_version := NULL;
      NEW.approved_by_user_id := NULL;
      NEW.approved_at := NULL;
    ELSIF NEW.status <> 'Approved' THEN
      NEW.approved_version := NULL;
      NEW.approved_by_user_id := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;

  -- B. Enforce permissions when draft is created or updated to 'Approved'
  IF NEW.status = 'Approved' OR NEW.approved_version IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.approved_version IS DISTINCT FROM NEW.approved_version) THEN
      IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.workspace_memberships
        WHERE workspace_id = NEW.workspace_id AND user_id = auth.uid() AND status = 'Active';

        IF v_caller_role IS NULL OR v_caller_role NOT IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE') THEN
          RAISE EXCEPTION 'Unauthorized: Caller does not have permissions to approve drafts';
        END IF;

        IF NEW.approved_version IS NULL THEN
          RAISE EXCEPTION 'Approved draft must specify an approved version';
        END IF;

        -- Check that approved version actually exists in draft_versions
        SELECT EXISTS (
          SELECT 1 FROM public.draft_versions
          WHERE draft_id = NEW.id AND version = NEW.approved_version
        ) INTO v_version_exists;

        IF NOT v_version_exists THEN
          RAISE EXCEPTION 'Cannot approve unsaved draft version %', NEW.approved_version;
        END IF;

        NEW.approved_by_user_id := auth.uid();
        NEW.approved_at := COALESCE(NEW.approved_at, NOW());
        NEW.status := 'Approved';
      ELSIF current_setting('request.jwt.claim.role', true) = 'anon' THEN
        RAISE EXCEPTION 'Authentication required to approve draft';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_draft_approval ON public.drafts;
DROP TRIGGER IF EXISTS trg_enforce_draft_invariants_and_approval ON public.drafts;
CREATE TRIGGER trg_enforce_draft_invariants_and_approval
  BEFORE INSERT OR UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_draft_invariants_and_approval();

-- 4. Atomic draft revision creation and update RPC with optimistic concurrency and idempotent retries
CREATE OR REPLACE FUNCTION public.save_draft_revision_atomic(
  p_workspace_id UUID,
  p_matter_id UUID,
  p_draft_id UUID,
  p_title TEXT,
  p_doc_type TEXT,
  p_content TEXT,
  p_expected_version INT DEFAULT NULL,
  p_change_notes TEXT DEFAULT NULL,
  p_operation_id TEXT DEFAULT NULL
)
RETURNS public.drafts AS $$
DECLARE
  v_caller_role TEXT;
  v_draft public.drafts%ROWTYPE;
  v_next_version INT;
  v_existing_draft_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to save draft';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.workspace_memberships
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND status = 'Active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE', 'ASSOCIATE') THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not have drafting permissions in this workspace';
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Draft title is required';
  END IF;

  IF p_content IS NULL THEN
    p_content := '';
  END IF;

  -- Safe retry idempotency: if operation_id was already committed, return the draft without creating duplicate version
  IF p_operation_id IS NOT NULL AND trim(p_operation_id) <> '' THEN
    SELECT dv.draft_id INTO v_existing_draft_id
    FROM public.draft_versions dv
    WHERE dv.workspace_id = p_workspace_id AND dv.operation_id = trim(p_operation_id);

    IF v_existing_draft_id IS NOT NULL THEN
      SELECT * INTO v_draft FROM public.drafts WHERE id = v_existing_draft_id;
      RETURN v_draft;
    END IF;
  END IF;

  IF p_draft_id IS NOT NULL THEN
    -- Updating existing draft: lock the draft row
    SELECT * INTO v_draft
    FROM public.drafts
    WHERE id = p_draft_id AND workspace_id = p_workspace_id AND matter_id = p_matter_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Draft not found or unauthorized in matter';
    END IF;

    -- Optimistic concurrency check
    IF p_expected_version IS NOT NULL AND v_draft.current_version <> p_expected_version THEN
      RAISE EXCEPTION 'Stale save rejected: expected version % does not match current version %', p_expected_version, v_draft.current_version;
    END IF;

    v_next_version := v_draft.current_version + 1;

    INSERT INTO public.draft_versions (
      workspace_id, draft_id, version, content, change_notes, created_by_user_id, operation_id, created_at
    ) VALUES (
      p_workspace_id, p_draft_id, v_next_version, p_content, COALESCE(p_change_notes, 'Revision v' || v_next_version), auth.uid(), NULLIF(trim(p_operation_id), ''), NOW()
    );

    UPDATE public.drafts
    SET title = trim(p_title),
        doc_type = COALESCE(p_doc_type, v_draft.doc_type),
        content = p_content,
        current_version = v_next_version,
        status = 'Draft',
        approved_version = NULL,
        approved_by_user_id = NULL,
        approved_at = NULL,
        updated_at = NOW()
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;

  ELSE
    -- Creating a new draft
    IF NOT EXISTS (
      SELECT 1 FROM public.matters WHERE id = p_matter_id AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'Matter not found or unauthorized in workspace';
    END IF;

    INSERT INTO public.drafts (
      workspace_id, matter_id, doc_type, title, content, current_version, status, created_at, updated_at
    ) VALUES (
      p_workspace_id, p_matter_id, COALESCE(p_doc_type, 'Pleading'), trim(p_title), p_content, 1, 'Draft', NOW(), NOW()
    )
    RETURNING * INTO v_draft;

    INSERT INTO public.draft_versions (
      workspace_id, draft_id, version, content, change_notes, created_by_user_id, operation_id, created_at
    ) VALUES (
      p_workspace_id, v_draft.id, 1, p_content, COALESCE(p_change_notes, 'Initial draft revision v1'), auth.uid(), NULLIF(trim(p_operation_id), ''), NOW()
    );
  END IF;

  RETURN v_draft;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Atomic draft approval RPC enforcing permissions and explicit revision verification
CREATE OR REPLACE FUNCTION public.approve_draft_atomic(
  p_workspace_id UUID,
  p_draft_id UUID,
  p_expected_version INT
)
RETURNS public.drafts AS $$
DECLARE
  v_caller_role TEXT;
  v_draft public.drafts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve draft';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.workspace_memberships
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND status = 'Active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('CHAMBER_OWNER', 'SENIOR_ADVOCATE') THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not have permissions to approve drafts';
  END IF;

  SELECT * INTO v_draft
  FROM public.drafts
  WHERE id = p_draft_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found or unauthorized in workspace';
  END IF;

  IF p_expected_version IS NULL OR v_draft.current_version <> p_expected_version THEN
    RAISE EXCEPTION 'Stale approval rejected: expected version % does not match current version %', p_expected_version, v_draft.current_version;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.draft_versions
    WHERE draft_id = p_draft_id AND version = p_expected_version
  ) THEN
    RAISE EXCEPTION 'Cannot approve unsaved draft version %', p_expected_version;
  END IF;

  UPDATE public.drafts
  SET status = 'Approved',
      approved_version = p_expected_version,
      approved_by_user_id = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  RETURN v_draft;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution privileges to authenticated users
REVOKE EXECUTE ON FUNCTION public.save_draft_revision_atomic(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_draft_revision_atomic(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_draft_atomic(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_draft_atomic(UUID, UUID, INT) TO authenticated;
