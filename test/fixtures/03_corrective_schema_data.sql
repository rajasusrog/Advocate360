-- ====================================================================
-- Fixture 3: Previously Shipped Corrective Schema Data (Milestone 20261018000001)
-- Matches full schema after migrations 1, 2, 3, and 4.
-- Notice: document_versions has status ('committed', 'pending_upload').
-- Notice: drafts has approved_version, approved_by_user_id, approved_at.
-- Notice: invoices has automatically computed balance_amount.
-- ====================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES 
  ('a3333333-3333-4333-8333-333333333331', 'owner@corrective-chamber.in', '{"role":"advocate"}'::jsonb),
  ('a3333333-3333-4333-8333-333333333332', 'associate@corrective-chamber.in', '{"role":"advocate"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, advocate_name, city)
VALUES ('b3333333-3333-4333-8333-333333333333', 'Apex Corrective Chambers', 'Adv. Apex Senior', 'New Delhi');

INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
VALUES 
  ('b3333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333331', 'CHAMBER_OWNER', 'Active'),
  ('b3333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333332', 'ASSOCIATE', 'Active');

INSERT INTO public.clients (id, workspace_id, name, phone, email)
VALUES ('c3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'Apex Global Corp', '+91 11456 78901', 'legal@apexglobal.in');

INSERT INTO public.matters (id, workspace_id, client_id, title, client_name, stage, status)
VALUES ('e3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'c3333333-3333-4333-8333-333333333333', 'Apex Supreme Court SLP', 'Apex Global Corp', 'Pleading', 'Pleading');

INSERT INTO public.documents (id, workspace_id, matter_id, name, file_path)
VALUES ('d3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'e3333333-3333-4333-8333-333333333333', 'ImpugnedOrder_HighCourt.pdf', 'w3/m3/ImpugnedOrder_HighCourt.pdf');

-- Committed document version protected by retention trigger
INSERT INTO public.document_versions (id, workspace_id, document_id, version, file_path, changes_summary, status)
VALUES ('f3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'd3333333-3333-4333-8333-333333333333', 1, 'w3/m3/ImpugnedOrder_HighCourt_v1.pdf', 'Certified true copy', 'committed');

-- Draft with persistent revision-specific approval
INSERT INTO public.drafts (id, workspace_id, matter_id, title, content, current_version, approved_version, approved_by_user_id, approved_at, status)
VALUES (
  '01333333-3333-4333-8333-333333333333',
  'b3333333-3333-4333-8333-333333333333',
  'e3333333-3333-4333-8333-333333333333',
  'Special Leave Petition (Civil)',
  'Questions of law for consideration of the Supreme Court of India',
  1,
  1,
  'a3333333-3333-4333-8333-333333333331',
  NOW(),
  'Approved'
);

INSERT INTO public.draft_versions (id, workspace_id, draft_id, version, content, change_notes)
VALUES ('02333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', '01333333-3333-4333-8333-333333333333', 1, 'Questions of law for consideration of the Supreme Court of India', 'Initial approved draft');

-- Invoice with automatic balance_amount calculation
INSERT INTO public.invoices (id, workspace_id, matter_id, invoice_number, client_name, subtotal, tax_amount, total_amount, paid_amount, status, due_date)
VALUES ('05333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'e3333333-3333-4333-8333-333333333333', 'INV-CORRECTIVE-001', 'Apex Global Corp', 150000, 27000, 177000, 77000, 'Partially Paid', '2026-12-31');

-- Payment recorded with idempotency key
INSERT INTO public.payments (id, workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes, idempotency_key)
VALUES ('06333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', '05333333-3333-4333-8333-333333333333', 77000, 'RTGS', 'UTR-CORRECTIVE-888', '2026-10-18', 'Senior counsel fee part payment', 'idem-corrective-001');
