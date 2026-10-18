-- ====================================================================
-- Advocate360 LegalOS - Hardened Persistence Defects Migration
-- Migration Version: 20261017090500
-- ====================================================================

-- 1. Payments Idempotency Key Column & Unique Index
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key 
  ON public.payments (workspace_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- 2. Secured & Transactional Payment Atomicity RPC
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_workspace_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_method TEXT,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS public.invoices AS $$
DECLARE
  v_invoice public.invoices;
  v_existing_payment public.payments;
  v_total_paid NUMERIC;
  v_new_paid_amount NUMERIC;
  v_new_status VARCHAR(40);
BEGIN
  -- 1. Require Authenticated User (Reject anonymous callers)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is null';
  END IF;

  -- 2. Verify Active Workspace Membership & Billing Permission (Reject outsiders and PARALEGALs)
  IF NOT public.is_workspace_member(p_workspace_id) OR NOT public.is_billing_authorized(p_workspace_id) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not a billing authorized workspace member';
  END IF;

  -- 3. Server-side Payment Amount Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 4. Persistent Idempotency Check
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_payment
    FROM public.payments
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Validate matching payment details
      IF v_existing_payment.invoice_id <> p_invoice_id OR v_existing_payment.amount <> p_amount THEN
        RAISE EXCEPTION 'Idempotency key collision with conflicting payment details';
      END IF;

      -- Idempotent retry: Return current invoice state without re-applying payment
      SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
      RETURN v_invoice;
    END IF;
  END IF;

  -- 5. Lock Invoice Row Transactionally
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized in workspace';
  END IF;

  -- 6. Insert Payment Record
  INSERT INTO public.payments (
    workspace_id,
    invoice_id,
    amount,
    payment_date,
    payment_method,
    reference_no,
    notes,
    idempotency_key
  ) VALUES (
    p_workspace_id,
    p_invoice_id,
    p_amount,
    p_payment_date,
    p_method,
    p_reference_no,
    p_notes,
    p_idempotency_key
  );

  -- 7. Calculate Authoritative Paid Total from Database Payments Table
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id;

  v_new_paid_amount := v_total_paid;
  IF v_new_paid_amount >= v_invoice.total_amount THEN
    v_new_status := 'Paid';
  ELSIF v_new_paid_amount > 0 THEN
    v_new_status := 'Partially Paid';
  ELSE
    v_new_status := 'Unpaid';
  END IF;

  -- 8. Transactionally Update Invoice Paid Amount, Status, and Timestamps
  UPDATE public.invoices
  SET paid_amount = v_new_paid_amount,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restrict execution privileges
REVOKE EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 3. Document Version Retention Enforcement (Replaces unused is_historical approach)
ALTER TABLE public.document_versions ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'committed';

CREATE OR REPLACE FUNCTION public.enforce_document_version_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletion only if version status is pending_upload or orphan_draft (failed upload cleanup path)
  IF OLD.status IS NULL OR OLD.status NOT IN ('pending_upload', 'orphan_draft') THEN
    RAISE EXCEPTION 'Retention policy violation: Historical document versions (status: %) cannot be deleted.', COALESCE(OLD.status, 'committed');
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_historical_doc_deletion ON public.document_versions;
DROP TRIGGER IF EXISTS trg_enforce_document_version_retention ON public.document_versions;
CREATE TRIGGER trg_enforce_document_version_retention
  BEFORE DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_version_retention();

-- 4. Storage Bucket Object Retention Policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS storage_matter_docs_delete ON storage.objects;
    CREATE POLICY storage_matter_docs_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'matter-documents'
        AND public.is_workspace_member(NULLIF((storage.foldername(name))[1], '')::uuid)
        AND NOT EXISTS (
          SELECT 1 FROM public.document_versions dv
          WHERE dv.file_path = storage.objects.name
            AND COALESCE(dv.status, 'committed') NOT IN ('pending_upload', 'orphan_draft')
        )
      );
  END IF;
END $$;

-- 5. Draft Revision-Specific Approval Invalidation
CREATE OR REPLACE FUNCTION public.invalidate_draft_approval_on_content_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title) THEN
    IF NEW.approved_version IS NOT NULL AND NEW.current_version <> NEW.approved_version THEN
      NEW.approved_version := NULL;
      NEW.approved_by_user_id := NULL;
      NEW.approved_at := NULL;
      IF NEW.status = 'Approved' THEN
        NEW.status := 'Draft';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_draft_approval ON public.drafts;
CREATE TRIGGER trg_invalidate_draft_approval
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_draft_approval_on_content_change();
