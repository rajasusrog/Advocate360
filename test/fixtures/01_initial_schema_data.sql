-- ====================================================================
-- Fixture 1: Initial Schema Data (Milestone 20261016000001)
-- Matches ONLY the initial schema tables and columns.
-- Notice: document_versions, draft_versions, and ai_results do NOT have workspace_id.
-- Notice: matters does NOT have client_name (added in migration 2).
-- Notice: drafts does NOT have approved_version, approved_by_user_id.
-- ====================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES 
  ('a1111111-1111-4111-8111-111111111111', 'owner@initial-chamber.in', '{"role":"advocate"}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'associate@initial-chamber.in', '{"role":"advocate"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, advocate_name, city)
VALUES ('b1111111-1111-4111-8111-111111111111', 'Initial Legal Chamber', 'Adv. Initial Founder', 'Chennai');

INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
VALUES 
  ('b1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'CHAMBER_OWNER', 'Active'),
  ('b1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'ASSOCIATE', 'Active');

INSERT INTO public.clients (id, workspace_id, name, phone, email)
VALUES ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'Legacy Initial Client', '+91 98401 11222', 'legacy.client@gmail.com');

-- Notice: NO client_name or status column in initial schema for matters
INSERT INTO public.matters (id, workspace_id, client_id, title, stage)
VALUES ('e1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'Initial Partition Suit', 'Intake');

INSERT INTO public.documents (id, workspace_id, matter_id, name, file_path)
VALUES ('d1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'RegisteredSaleDeed_1995.pdf', 'w1/m1/RegisteredSaleDeed_1995.pdf');

-- Notice: NO workspace_id column in initial schema for document_versions
INSERT INTO public.document_versions (id, document_id, version, file_path, changes_summary)
VALUES ('f1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111', 1, 'w1/m1/RegisteredSaleDeed_1995_v1.pdf', 'Original registered copy');

-- Notice: NO approved_version, approved_by_user_id in initial schema for drafts
INSERT INTO public.drafts (id, workspace_id, matter_id, title, content)
VALUES ('01111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Plaint Draft Initial', 'Initial plaint statement text');

-- Notice: NO workspace_id column in initial schema for draft_versions
INSERT INTO public.draft_versions (id, draft_id, version, content, change_notes)
VALUES ('02111111-1111-4111-8111-111111111111', '01111111-1111-4111-8111-111111111111', 1, 'Initial plaint statement text v1', 'First draft from intake');

INSERT INTO public.ai_jobs (id, workspace_id, matter_id, operation, status)
VALUES ('03111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'EXTRACT_FACTS_DATES', 'Completed');

-- Notice: NO workspace_id column in initial schema for ai_results
INSERT INTO public.ai_results (id, job_id, result_type, result_data)
VALUES ('04111111-1111-4111-8111-111111111111', '03111111-1111-4111-8111-111111111111', 'CHRONOLOGY', '{"events":[{"date":"1995-04-12","event":"Sale Deed Registered"}]}'::jsonb);
