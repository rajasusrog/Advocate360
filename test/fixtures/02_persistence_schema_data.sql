-- ====================================================================
-- Fixture 2: Previously Shipped Persistence Schema Data (Milestone 20261017090500)
-- Matches schema state after migrations 1, 2, and 3.
-- Notice: document_versions has status, payments has idempotency_key.
-- Notice: drafts does NOT yet have approved_version (added in migration 4).
-- Notice: invoices balance_amount is not yet synchronized via trigger (added in migration 5).
-- ====================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES 
  ('a2222222-2222-4222-8222-222222222221', 'owner@persist-chamber.in', '{"role":"advocate"}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'associate@persist-chamber.in', '{"role":"advocate"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, advocate_name, city)
VALUES ('b2222222-2222-4222-8222-222222222222', 'Persistence Law Chambers', 'Adv. Persist Counsel', 'Bengaluru');

INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
VALUES 
  ('b2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222221', 'CHAMBER_OWNER', 'Active'),
  ('b2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'ASSOCIATE', 'Active');

INSERT INTO public.clients (id, workspace_id, name, phone, email)
VALUES ('c2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'Persist Client Pvt Ltd', '+91 80123 45678', 'client@persistcorp.in');

INSERT INTO public.matters (id, workspace_id, client_id, title, client_name, stage, status)
VALUES ('e2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', 'Commercial Contract Arbitration', 'Persist Client Pvt Ltd', 'Analysis', 'Analysis');

INSERT INTO public.documents (id, workspace_id, matter_id, name, file_path)
VALUES ('d2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'ArbitrationAgreement.pdf', 'w2/m2/ArbitrationAgreement.pdf');

-- Notice: document_versions status column added in migration 3 ('committed', 'pending_upload')
INSERT INTO public.document_versions (id, workspace_id, document_id, version, file_path, changes_summary, status)
VALUES 
  ('f2222222-2222-4222-8222-222222222221', 'b2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', 1, 'w2/m2/ArbitrationAgreement_v1.pdf', 'Initial signed copy', 'committed'),
  ('f2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222', 2, 'w2/m2/ArbitrationAgreement_v2.pdf', 'Addendum executed', 'pending_upload');

-- Notice: drafts has current_version, but NO approved_version (added in migration 4)
INSERT INTO public.drafts (id, workspace_id, matter_id, title, content, current_version, status)
VALUES ('01222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'Statement of Claim', 'Claim details under section 23 of ACA', 2, 'In Review');

INSERT INTO public.draft_versions (id, workspace_id, draft_id, version, content, change_notes)
VALUES 
  ('02222222-2222-4222-8222-222222222221', 'b2222222-2222-4222-8222-222222222222', '01222222-2222-4222-8222-222222222222', 1, 'Claim draft v1', 'First cut'),
  ('02222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', '01222222-2222-4222-8222-222222222222', 2, 'Claim draft v2 with interest calculation', 'Revised interest');

-- Notice: invoices has subtotal, tax_amount, total_amount, paid_amount, status
INSERT INTO public.invoices (id, workspace_id, matter_id, invoice_number, client_name, subtotal, tax_amount, total_amount, paid_amount, status, due_date)
VALUES ('05222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'INV-PERSIST-001', 'Persist Client Pvt Ltd', 100000, 18000, 118000, 50000, 'Partially Paid', '2026-12-15');

-- Notice: payments has idempotency_key
INSERT INTO public.payments (id, workspace_id, invoice_id, amount, payment_method, reference_no, payment_date, notes, idempotency_key)
VALUES ('06222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', '05222222-2222-4222-8222-222222222222', 50000, 'NEFT', 'UTR-PERSIST-999', '2026-10-17', 'Advance retainer', 'idem-persist-001');
