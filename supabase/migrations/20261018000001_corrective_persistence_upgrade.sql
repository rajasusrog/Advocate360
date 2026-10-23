-- ====================================================================
-- Advocate360 LegalOS - Corrective Persistence & Draft Approval Migration
-- Migration Version: 20261018000001
-- ====================================================================

-- 1. Ensure balance_amount column exists on invoices and is computed/stored reliably
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance_amount NUMERIC GENERATED ALWAYS AS (GREATEST(0, total_amount - paid_amount)) STORED;

-- 2. Enhanced record_payment_atomic with strict balance calculation and concurrent safety
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
  v_new_balance NUMERIC;
  v_new_status VARCHAR(40);
BEGIN
  -- 1. Require Authenticated User (Reject anonymous callers)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is null';
  END IF;

  -- 2. Verify Active Workspace Membership & Billing Permission
  IF NOT public.is_workspace_member(p_workspace_id) OR NOT public.is_billing_authorized(p_workspace_id) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not a billing authorized workspace member';
  END IF;

  -- 3. Server-side Payment Amount Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 4. Persistent Idempotency Check (Allow distinct separate payments unless exact idempotency key is reused)
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_payment
    FROM public.payments
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Validate matching payment details on retry
      IF v_existing_payment.invoice_id <> p_invoice_id OR v_existing_payment.amount <> p_amount THEN
        RAISE EXCEPTION 'Idempotency key collision with conflicting payment details';
      END IF;

      -- Idempotent retry: Return current invoice state without re-applying payment
      SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
      RETURN v_invoice;
    END IF;
  END IF;

  -- 5. Lock Invoice Row Transactionally for Update
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized in workspace';
  END IF;

  -- 6. Insert Payment Record (Unique idempotency constraint ensures no duplicate execution on retries)
  BEGIN
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
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent retry caught by unique index: fetch and return current state
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
    RETURN v_invoice;
  END;

  -- 7. Calculate Authoritative Paid Total, Balance, and Status
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = p_invoice_id AND workspace_id = p_workspace_id;

  v_new_paid_amount := v_total_paid;
  v_new_balance := GREATEST(0, v_invoice.total_amount - v_new_paid_amount);

  IF v_new_paid_amount >= v_invoice.total_amount THEN
    v_new_status := 'Paid';
  ELSIF v_new_paid_amount > 0 THEN
    v_new_status := 'Partially Paid';
  ELSE
    v_new_status := 'Unpaid';
  END IF;

  -- 8. Transactionally Update Invoice Paid Amount, Balance, Status, and Timestamps
  UPDATE public.invoices
  SET paid_amount = v_new_paid_amount,
      balance_amount = v_new_balance,
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

-- 3. Robust Draft Approval Invalidation (Invalidates on ANY content or title change regardless of version increment)
CREATE OR REPLACE FUNCTION public.invalidate_draft_approval_on_content_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title) THEN
    -- Invalidate approval on any content or title mutation
    NEW.approved_version := NULL;
    NEW.approved_by_user_id := NULL;
    NEW.approved_at := NULL;
    IF NEW.status = 'Approved' THEN
      NEW.status := 'Draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_draft_approval ON public.drafts;
CREATE TRIGGER trg_invalidate_draft_approval
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_draft_approval_on_content_change();
