-- Migration: 20261019000005_durable_background_jobs_and_ai_results.sql
-- Description: Upgrade ai_jobs and ai_results tables with durable background queue, atomic worker lease claiming, operation idempotency, and idempotent result persistence.

-- 1. Upgrade public.ai_jobs schema
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS job_id TEXT,
  ADD COLUMN IF NOT EXISTS matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'AI Operation',
  ADD COLUMN IF NOT EXISTS input_record_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS input_versions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lease_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS error_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS error_retryable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS logs TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure queued_at, attempt_count, max_attempts, logs are populated if null
UPDATE public.ai_jobs SET queued_at = COALESCE(queued_at, created_at, now()) WHERE queued_at IS NULL;
UPDATE public.ai_jobs SET attempt_count = COALESCE(attempt_count, 0) WHERE attempt_count IS NULL;
UPDATE public.ai_jobs SET max_attempts = COALESCE(max_attempts, 3) WHERE max_attempts IS NULL;
UPDATE public.ai_jobs SET logs = COALESCE(logs, '{}'::text[]) WHERE logs IS NULL;

-- Backfill job_id where NULL
UPDATE public.ai_jobs SET job_id = id::text WHERE job_id IS NULL OR btrim(job_id) = '';
UPDATE public.ai_jobs SET title = operation WHERE title IS NULL OR btrim(title) = '';
UPDATE public.ai_jobs SET operation = 'AI_REASONING_CHAIN' WHERE operation IS NULL OR btrim(operation) = '';

-- Normalize status lower-case values
UPDATE public.ai_jobs SET status = 'queued' WHERE status = 'Queued';
UPDATE public.ai_jobs SET status = 'processing' WHERE status = 'Processing';
UPDATE public.ai_jobs SET status = 'completed' WHERE status = 'Completed';
UPDATE public.ai_jobs SET status = 'failed' WHERE status = 'Failed';

-- Drop legacy global unique constraint on idempotency_key if exists
ALTER TABLE public.ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_idempotency_key_key;

-- Unique index to enforce operation-level idempotency per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_workspace_id_idempotency_key
  ON public.ai_jobs(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '';

-- Index for worker claiming queue lookups
CREATE INDEX IF NOT EXISTS idx_ai_jobs_claiming
  ON public.ai_jobs(status, queued_at, lease_expires_at);

-- Index for user / workspace queries
CREATE INDEX IF NOT EXISTS idx_ai_jobs_workspace_matter
  ON public.ai_jobs(workspace_id, matter_id, created_at DESC);

-- 2. Upgrade public.ai_results schema
CREATE TABLE IF NOT EXISTS public.ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ai_jobs(id) ON DELETE CASCADE UNIQUE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE,
  operation TEXT DEFAULT 'AI_OPERATION',
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_type VARCHAR(50) DEFAULT 'JSON',
  result_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_results
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS operation TEXT DEFAULT 'AI_OPERATION',
  ADD COLUMN IF NOT EXISTS result_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_type VARCHAR(50) DEFAULT 'JSON',
  ADD COLUMN IF NOT EXISTS result_data JSONB DEFAULT '{}'::jsonb;

-- Backfill workspace_id on ai_results from parent ai_jobs
UPDATE public.ai_results r
SET workspace_id = j.workspace_id
FROM public.ai_jobs j
WHERE r.job_id = j.id AND (r.workspace_id IS NULL OR r.workspace_id != j.workspace_id);

-- Backfill result_payload from result_data if present
UPDATE public.ai_results
SET result_payload = COALESCE(result_payload, result_data, '{}'::jsonb)
WHERE result_payload IS NULL OR result_payload = '{}'::jsonb;

-- Set workspace_id NOT NULL if any rows exist without it
ALTER TABLE public.ai_results ALTER COLUMN workspace_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_results_job_id
  ON public.ai_results(job_id);

-- Enable RLS
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_results ENABLE ROW LEVEL SECURITY;

-- RLS for public.ai_jobs
DROP POLICY IF EXISTS "Active workspace members can read ai_jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_member_all" ON public.ai_jobs;
CREATE POLICY "Active workspace members can read ai_jobs"
  ON public.ai_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships m
      WHERE m.workspace_id = public.ai_jobs.workspace_id
        AND m.user_id = auth.uid()
        AND m.status = 'Active'
    )
  );

DROP POLICY IF EXISTS "Active workspace members can enqueue ai_jobs" ON public.ai_jobs;
CREATE POLICY "Active workspace members can enqueue ai_jobs"
  ON public.ai_jobs FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by_user_id AND
    EXISTS (
      SELECT 1 FROM public.workspace_memberships m
      WHERE m.workspace_id = public.ai_jobs.workspace_id
        AND m.user_id = auth.uid()
        AND m.status = 'Active'
        AND m.role <> 'CLIENT'
    )
  );

-- RLS for public.ai_results
DROP POLICY IF EXISTS "Active workspace members can read ai_results" ON public.ai_results;
DROP POLICY IF EXISTS "ai_results_member_all" ON public.ai_results;
CREATE POLICY "Active workspace members can read ai_results"
  ON public.ai_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships m
      WHERE m.workspace_id = public.ai_results.workspace_id
        AND m.user_id = auth.uid()
        AND m.status = 'Active'
    )
  );

-- Atomic RPC to claim next queued job or recover expired lease
DROP FUNCTION IF EXISTS claim_next_ai_job_atomic(TEXT, INT);
CREATE OR REPLACE FUNCTION claim_next_ai_job_atomic(
  p_worker_id TEXT,
  p_lease_seconds INT DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  job_id TEXT,
  workspace_id UUID,
  matter_id UUID,
  requested_by_user_id UUID,
  operation TEXT,
  title TEXT,
  input_record_ids TEXT[],
  input_versions TEXT[],
  idempotency_key TEXT,
  status TEXT,
  attempt_count INT,
  max_attempts INT,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  logs TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_new_lease_token UUID;
  v_lease_expiry TIMESTAMPTZ;
BEGIN
  v_new_lease_token := gen_random_uuid();
  v_lease_expiry := now() + (p_lease_seconds || ' seconds')::interval;

  -- 1. Identify candidate job to claim or expire
  SELECT j.id INTO v_job_id
  FROM public.ai_jobs j
  WHERE (
    j.status = 'queued'
    OR (j.status = 'processing' AND j.lease_expires_at < now())
  )
  ORDER BY j.queued_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Update job row atomically
  UPDATE public.ai_jobs j
  SET
    status = CASE
      WHEN (j.attempt_count + 1) > j.max_attempts THEN 'failed'
      ELSE 'processing'
    END,
    attempt_count = j.attempt_count + 1,
    lease_token = v_new_lease_token,
    lease_expires_at = v_lease_expiry,
    started_at = COALESCE(j.started_at, now()),
    error_code = CASE WHEN (j.attempt_count + 1) > j.max_attempts THEN 'MAX_ATTEMPTS_EXCEEDED' ELSE j.error_code END,
    error_message = CASE WHEN (j.attempt_count + 1) > j.max_attempts THEN 'Worker lease expired: Maximum execution attempts exceeded' ELSE j.error_message END,
    failed_at = CASE WHEN (j.attempt_count + 1) > j.max_attempts THEN now() ELSE j.failed_at END,
    logs = array_append(j.logs, 'Claimed by worker ' || p_worker_id || ' at ' || now()::text),
    updated_at = now()
  WHERE j.id = v_job_id;

  RETURN QUERY
  SELECT
    j.id,
    j.job_id::TEXT,
    j.workspace_id,
    j.matter_id,
    j.requested_by_user_id,
    j.operation::TEXT,
    j.title::TEXT,
    j.input_record_ids,
    j.input_versions,
    j.idempotency_key::TEXT,
    j.status::TEXT,
    j.attempt_count,
    j.max_attempts,
    j.lease_token,
    j.lease_expires_at,
    j.logs
  FROM public.ai_jobs j
  WHERE j.id = v_job_id AND j.status = 'processing';
END;
$$;

-- Atomic RPC to commit job result and mark completed
CREATE OR REPLACE FUNCTION commit_ai_job_result_atomic(
  p_job_id UUID,
  p_result_payload JSONB,
  p_log_message TEXT DEFAULT NULL
)
RETURNS SETOF public.ai_results
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_row public.ai_jobs%ROWTYPE;
  v_result_row public.ai_results%ROWTYPE;
BEGIN
  SELECT * INTO v_job_row
  FROM public.ai_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI job with ID % not found', p_job_id;
  END IF;

  -- Insert or update result idempotently
  INSERT INTO public.ai_results (
    job_id,
    workspace_id,
    matter_id,
    operation,
    result_type,
    result_data,
    result_payload
  ) VALUES (
    v_job_row.id,
    v_job_row.workspace_id,
    v_job_row.matter_id,
    v_job_row.operation,
    COALESCE(v_job_row.operation, 'JSON'),
    p_result_payload,
    p_result_payload
  )
  ON CONFLICT (job_id) DO UPDATE SET
    result_data = EXCLUDED.result_data,
    result_payload = EXCLUDED.result_payload
  RETURNING * INTO v_result_row;

  -- Update job status to completed
  UPDATE public.ai_jobs
  SET
    status = 'completed',
    progress = 100,
    completed_at = now(),
    lease_token = NULL,
    lease_expires_at = NULL,
    logs = CASE
      WHEN p_log_message IS NOT NULL THEN array_append(logs, p_log_message)
      ELSE logs
    END,
    updated_at = now()
  WHERE id = p_job_id;

  RETURN NEXT v_result_row;
  RETURN;
END;
$$;
