-- ====================================================================
-- Advocate360 LegalOS - Hardened Payment Atomicity & Direct Write Invariant Protection
-- Migration Version: 20261019000002
-- File: 20261019000002_hardened_payment_atomicity.sql
-- ====================================================================

-- 1. Enforce Non-Null Idempotency Key & Finite Positive Amount on Payments Table
ALTER TABLE public.payments ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_positive_amount'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT chk_payments_positive_amount CHECK (amount > 0 AND amount < 10000000000);
  END IF;
END $$;

-- 2. Strict Workspace + Idempotency Key Uniqueness Index
DROP INDEX IF EXISTS public.idx_payments_idempotency_key;
DROP INDEX IF EXISTS public.idx_payments_workspace_idempotency;
CREATE UNIQUE INDEX idx_payments_workspace_idempotency ON public.payments (workspace_id, idempotency_key);

-- 3. Automatic Synchronization Trigger to Prevent Direct Client Writes from Bypassing Invariants
CREATE OR REPLACE FUNCTION public.trg_enforce_payment_invariants_and_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_target_inv_id UUID;
  v_target_ws_id UUID;
  v_total_paid NUMERIC;
  v_inv_total NUMERIC;
  v_status VARCHAR(40);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_inv_id := OLD.invoice_id;
    v_target_ws_id := OLD.workspace_id;
  ELSE
    v_target_inv_id := NEW.invoice_id;
    v_target_ws_id := NEW.workspace_id;

    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF NEW.idempotency_key IS NULL OR btrim(NEW.idempotency_key) = '' THEN
      RAISE EXCEPTION 'Operation ID (idempotency key) is required';
    END IF;
  END IF;

  -- Recompute authoritative paid total from payments table
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = v_target_inv_id AND workspace_id = v_target_ws_id;

  SELECT total_amount INTO v_inv_total
  FROM public.invoices
  WHERE id = v_target_inv_id AND workspace_id = v_target_ws_id;

  IF FOUND THEN
    IF v_total_paid >= v_inv_total THEN
      v_status := 'Paid';
    ELSIF v_total_paid > 0 THEN
      v_status := 'Partially Paid';
    ELSE
      v_status := 'Unpaid';
    END IF;

    -- Update invoice without manually updating generated/computed balance_amount
    UPDATE public.invoices
    SET paid_amount = v_total_paid,
        status = v_status,
        updated_at = NOW()
    WHERE id = v_target_inv_id AND workspace_id = v_target_ws_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_from_payments ON public.payments;
CREATE TRIGGER trg_sync_invoice_from_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_payment_invariants_and_sync();

-- 4. Hardened record_payment_atomic RPC
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
  v_new_status VARCHAR(40);
BEGIN
  -- 1. Require Authenticated User
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is null';
  END IF;

  -- 2. Verify Active Workspace Membership & Billing Permission
  IF NOT public.is_workspace_member(p_workspace_id) OR NOT public.is_billing_authorized(p_workspace_id) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not a billing authorized workspace member';
  END IF;

  -- 3. Require Non-Empty Operation Key
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Operation ID (idempotency key) is required';
  END IF;

  -- 4. Server-Side Finite Positive Amount Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 5. Lock Invoice Row Transactionally for Update
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized in workspace';
  END IF;

  -- 6. Persistent Idempotency Check (Compare complete canonical payload: invoice, amount, date, method, reference, notes)
  SELECT * INTO v_existing_payment
  FROM public.payments
  WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Canonical payload comparison: ALL details must match exactly
    IF v_existing_payment.invoice_id <> p_invoice_id
       OR v_existing_payment.amount <> p_amount
       OR v_existing_payment.payment_date <> p_payment_date
       OR COALESCE(v_existing_payment.payment_method, '') <> COALESCE(p_method, '')
       OR COALESCE(v_existing_payment.reference_no, '') <> COALESCE(p_reference_no, '')
       OR COALESCE(v_existing_payment.notes, '') <> COALESCE(p_notes, '')
    THEN
      RAISE EXCEPTION 'Idempotency key collision with conflicting payment details';
    END IF;

    -- Return authoritative current invoice state
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
    RETURN v_invoice;
  END IF;

  -- 7. Insert Payment Record
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
    -- Handle concurrent retry collision: verify payload before returning
    SELECT * INTO v_existing_payment
    FROM public.payments
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing_payment.invoice_id <> p_invoice_id
         OR v_existing_payment.amount <> p_amount
         OR v_existing_payment.payment_date <> p_payment_date
         OR COALESCE(v_existing_payment.payment_method, '') <> COALESCE(p_method, '')
         OR COALESCE(v_existing_payment.reference_no, '') <> COALESCE(p_reference_no, '')
         OR COALESCE(v_existing_payment.notes, '') <> COALESCE(p_notes, '')
      THEN
        RAISE EXCEPTION 'Idempotency key collision with conflicting payment details';
      END IF;
    END IF;

    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
    RETURN v_invoice;
  END;

  -- 8. Return Authoritative Updated Invoice (trigger trg_sync_invoice_from_payments updated totals and status)
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND workspace_id = p_workspace_id;
  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
