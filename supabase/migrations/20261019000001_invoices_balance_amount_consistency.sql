-- ====================================================================
-- Advocate360 LegalOS - Invoice Balance Amount Automatic Consistency
-- Migration Version: 20261019000001
-- File: 20261019000001_invoices_balance_amount_consistency.sql
-- ====================================================================

-- 1. Automatic trigger to ensure balance_amount is always strictly synchronized
-- with GREATEST(0, total_amount - paid_amount) across all direct inserts and updates.
CREATE OR REPLACE FUNCTION public.sync_invoice_balance_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_amount := GREATEST(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_balance_amount ON public.invoices;
CREATE TRIGGER trg_sync_invoice_balance_amount
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_balance_amount();

-- 2. Backfill existing invoice rows to authoritative calculated balance
UPDATE public.invoices
SET balance_amount = GREATEST(0, total_amount - paid_amount);
